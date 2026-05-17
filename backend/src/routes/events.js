const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');

async function eventsRoutes(fastify) {
  const { prisma, redis } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('scanner', 'admin', 'super_admin', 'admin_volunteers', 'team_leader_volunteers'));

  // GET /api/admin/events — readable by all roles
  fastify.get('/events', async () => {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, name: true, type: true,
        date: true, location: true, active: true, status: true,
        registrationOpen: true, volunteersOpen: true, createdAt: true,
        runnerLevels: true, distances: true, optionalFields: true,
        bibStart: true, bibEnd: true, primaryColor: true,
      },
    });
    return { data: events };
  });

  // GET /api/admin/events/:id
  fastify.get('/events/:id', async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');
    return { data: event };
  });

  // POST /api/admin/events
  fastify.post('/events', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const body = request.body || {};

    if (!body.name) throw new AppError(400, 'Nom requis', 'VALIDATION_ERROR');

    // Auto-generate slug from name
    const slug = body.slug || body.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check slug uniqueness
    const existing = await prisma.event.findUnique({ where: { slug } });
    if (existing) throw new AppError(409, 'Ce slug est déjà utilisé', 'SLUG_TAKEN');

    const event = await prisma.event.create({
      data: {
        slug,
        name: body.name,
        type: body.type || 'trail',
        description: body.description || null,
        date: body.date ? new Date(body.date) : null,
        location: body.location || 'Alger',
        primaryColor: body.primaryColor || '#C42826',
        logoPath: body.logoPath || null,
        coverImagePath: body.coverImagePath || null,
        facebookUrl: body.facebookUrl || null,
        instagramUrl: body.instagramUrl || null,
        tiktokUrl: body.tiktokUrl || null,
        websiteUrl: body.websiteUrl || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        contactLabel: body.contactLabel || null,
        distances: body.distances || [],
        runnerLevels: body.runnerLevels || ['Débutant', 'Confirmé', 'Elite'],
        faq: body.faq || [],
        registrationOpen: body.registrationOpen ?? true,
        registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
        maxCapacity: body.maxCapacity ?? null,
        autoCloseOnExhaustion: body.autoCloseOnExhaustion ?? true,
        bibStart: body.bibStart ?? 101,
        bibEnd: body.bibEnd ?? 1500,
        bibManualUpperEnd: body.bibManualUpperEnd ?? null,
        bibPrefix: body.bibPrefix || null,
        priceInCentimes: body.priceInCentimes ?? 200000,
        photoPackPrice: body.photoPackPrice ?? null,
        optionalFields: body.optionalFields || {},
        termsText: body.termsText || null,
        active: false,
        status: 'upcoming',
      },
    });

    await logActivity({
      action: 'event_created',
      adminUsername: request.user.username,
      targetType: 'event',
      targetId: event.id,
      details: { name: event.name, slug: event.slug },
    });

    return { data: event };
  });

  // PUT /api/admin/events/:id
  fastify.put('/events/:id', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const body = request.body || {};
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    // Bib range lock logic
    if (event.bibRangeLocked) {
      // bibStart: LOCKED always
      if (body.bibStart !== undefined && body.bibStart !== event.bibStart) {
        throw new AppError(400,
          'Le début de plage ne peut plus être modifié (des dossards ont été attribués)',
          'BIB_START_LOCKED'
        );
      }
      // bibEnd: can INCREASE only
      if (body.bibEnd !== undefined) {
        if (body.bibEnd < event.bibEnd) {
          throw new AppError(400,
            'La fin de plage ne peut pas être réduite',
            'BIB_END_DECREASE'
          );
        }
        // Cannot decrease below highest assigned bib in the auto range
        const maxBib = await prisma.registration.aggregate({
          where: { eventId: event.id, bibNumber: { not: null } },
          _max: { bibNumber: true },
        });
        if (maxBib._max.bibNumber && body.bibEnd < maxBib._max.bibNumber) {
          throw new AppError(400,
            `bibEnd ne peut pas être inférieur au plus grand dossard attribué (${maxBib._max.bibNumber})`,
            'BIB_END_BELOW_MAX'
          );
        }
      }
    }

    // bibEnd increase must not swallow a high-band manual bib that's already assigned
    if (body.bibEnd !== undefined && body.bibEnd > event.bibEnd) {
      const overlap = await prisma.registration.findFirst({
        where: {
          eventId: event.id,
          bibNumber: { gt: event.bibEnd, lte: body.bibEnd },
        },
        select: { bibNumber: true },
      });
      if (overlap) {
        throw new AppError(400,
          `bibEnd ne peut pas être augmenté à ${body.bibEnd} : un dossard manuel haut (#${overlap.bibNumber}) chevaucherait la plage auto`,
          'BIB_END_OVERLAPS_MANUAL_HIGH'
        );
      }
    }

    // bibManualUpperEnd validation
    if (body.bibManualUpperEnd !== undefined && body.bibManualUpperEnd !== null) {
      const targetBibEnd = body.bibEnd ?? event.bibEnd;
      if (!Number.isInteger(body.bibManualUpperEnd) || body.bibManualUpperEnd <= targetBibEnd) {
        throw new AppError(400,
          `Le plafond manuel haut doit être supérieur à la fin de plage auto (${targetBibEnd})`,
          'BIB_MANUAL_UPPER_INVALID'
        );
      }
      // Cannot lower below the highest assigned high-band bib
      const maxHigh = await prisma.registration.aggregate({
        where: { eventId: event.id, bibNumber: { gt: targetBibEnd } },
        _max: { bibNumber: true },
      });
      if (maxHigh._max.bibNumber && body.bibManualUpperEnd < maxHigh._max.bibNumber) {
        throw new AppError(400,
          `Le plafond manuel haut ne peut pas être inférieur au plus grand dossard manuel haut attribué (${maxHigh._max.bibNumber})`,
          'BIB_MANUAL_UPPER_BELOW_MAX'
        );
      }
    } else if (body.bibManualUpperEnd === null && event.bibManualUpperEnd != null) {
      // Clearing the ceiling — refuse if any high-band bibs exist (clearing would orphan them)
      const targetBibEnd = body.bibEnd ?? event.bibEnd;
      const existingHigh = await prisma.registration.findFirst({
        where: { eventId: event.id, bibNumber: { gt: targetBibEnd } },
        select: { bibNumber: true },
      });
      if (existingHigh) {
        throw new AppError(400,
          `Impossible de désactiver la plage manuelle haute : un dossard (#${existingHigh.bibNumber}) y est déjà attribué`,
          'BIB_MANUAL_UPPER_HAS_BIBS'
        );
      }
    }

    const allowedFields = [
      'name', 'type', 'description', 'date', 'location',
      'primaryColor', 'logoPath', 'coverImagePath',
      'facebookUrl', 'instagramUrl', 'tiktokUrl', 'websiteUrl',
      'contactEmail', 'contactPhone', 'contactLabel',
      'distances', 'runnerLevels', 'faq',
      'registrationOpen', 'registrationDeadline', 'maxCapacity', 'autoCloseOnExhaustion',
      'volunteersOpen',
      'bibStart', 'bibEnd', 'bibManualUpperEnd', 'bibPrefix',
      'priceInCentimes', 'photoPackPrice',
      'optionalFields', 'termsText',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'registrationDeadline' || field === 'date') {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: updateData,
    });

    // Sync Redis bib counter when bibStart changes (only if not locked)
    if (updateData.bibStart !== undefined && updateData.bibStart !== event.bibStart) {
      await redis.set(`bib:next:${event.id}`, updateData.bibStart - 1);
    }

    await logActivity({
      action: 'event_updated',
      adminUsername: request.user.username,
      targetType: 'event',
      targetId: event.id,
      details: updateData,
    });

    return { data: updated };
  });

  // POST /api/admin/events/:id/upload — upload logo or cover image
  fastify.post('/events/:id/upload', { preHandler: authorize('admin', 'super_admin') }, async (request, reply) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    const fs = require('fs');
    const path = require('path');
    const { pipeline } = require('stream/promises');

    const data = await request.file();
    if (!data) throw new AppError(400, 'Fichier requis', 'NO_FILE');

    const fieldName = data.fieldname; // 'logo' or 'cover'
    if (!['logo', 'cover'].includes(fieldName)) {
      throw new AppError(400, 'Champ invalide (logo ou cover)', 'INVALID_FIELD');
    }

    const dir = path.resolve(__dirname, `../../uploads/events/${event.id}`);
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(data.filename) || '.png';
    const filePath = path.join(dir, `${fieldName}${ext}`);
    await pipeline(data.file, fs.createWriteStream(filePath));

    const storedPath = `/uploads/events/${event.id}/${fieldName}${ext}`;
    const updateField = fieldName === 'logo' ? 'logoPath' : 'coverImagePath';

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { [updateField]: storedPath },
    });

    return { data: updated, path: storedPath };
  });

  // POST /api/admin/events/:id/activate
  fastify.post('/events/:id/activate', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    // Deactivate all other events
    await prisma.event.updateMany({
      where: { active: true },
      data: { active: false },
    });

    // Activate this one
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { active: true, status: 'active' },
    });

    // Initialize Redis bib counter if not exists
    const bibKey = `bib:next:${event.id}`;
    const exists = await redis.exists(bibKey);
    if (!exists) {
      await redis.set(bibKey, event.bibStart - 1);
    }

    await logActivity({
      action: 'event_activated',
      adminUsername: request.user.username,
      targetType: 'event',
      targetId: event.id,
      details: { name: event.name },
    });

    return { data: updated };
  });

  // POST /api/admin/events/:id/archive
  fastify.post('/events/:id/archive', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { active: false, status: 'archived', registrationOpen: false },
    });

    await logActivity({
      action: 'event_archived',
      adminUsername: request.user.username,
      targetType: 'event',
      targetId: event.id,
      details: { name: event.name },
    });

    return { data: updated };
  });

  // POST /api/admin/events/:id/unarchive
  fastify.post('/events/:id/unarchive', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');
    if (event.status !== 'archived') {
      throw new AppError(400, 'Cet événement n\'est pas archivé', 'NOT_ARCHIVED');
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { status: 'upcoming' },
    });

    await logActivity({
      action: 'event_unarchived',
      adminUsername: request.user.username,
      targetType: 'event',
      targetId: event.id,
      details: { name: event.name },
    });

    return { data: updated };
  });

  // DELETE /api/admin/events/:id — super_admin only
  fastify.delete('/events/:id', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');
    if (event.active) {
      throw new AppError(400, 'Impossible de supprimer l\'événement actif', 'CANNOT_DELETE_ACTIVE');
    }

    // Check if event has registrations
    const regCount = await prisma.registration.count({ where: { eventId: event.id } });
    if (regCount > 0) {
      // Delete related email logs first, then registrations
      await prisma.emailLog.deleteMany({
        where: { registration: { eventId: event.id } },
      });
      await prisma.registration.deleteMany({ where: { eventId: event.id } });
    }

    await prisma.event.delete({ where: { id: event.id } });

    // Clean up Redis key
    await redis.del(`bib:next:${event.id}`);

    await logActivity({
      action: 'event_deleted',
      adminUsername: request.user.username,
      targetType: 'event',
      targetId: event.id,
      details: { name: event.name, registrationsDeleted: regCount },
    });

    return { success: true };
  });

  // GET /api/admin/events/:id/bib-stats
  fastify.get('/events/:id/bib-stats', async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    const stockTotal = event.bibEnd - event.bibStart + 1;
    const manualMax = event.bibStart - 1;
    const hasUpperBand = event.bibManualUpperEnd != null && event.bibManualUpperEnd > event.bibEnd;
    const manualHighTotal = hasUpperBand ? event.bibManualUpperEnd - event.bibEnd : 0;

    const [bibsAutoRange, bibsTotal, bibsManualUsed, bibsManualHighUsed] = await Promise.all([
      prisma.registration.count({
        where: { eventId: event.id, bibNumber: { gte: event.bibStart, lte: event.bibEnd } },
      }),
      prisma.registration.count({
        where: { eventId: event.id, bibNumber: { not: null } },
      }),
      prisma.registration.count({
        where: { eventId: event.id, bibNumber: { gte: 1, lt: event.bibStart } },
      }),
      hasUpperBand
        ? prisma.registration.count({
            where: { eventId: event.id, bibNumber: { gt: event.bibEnd, lte: event.bibManualUpperEnd } },
          })
        : Promise.resolve(0),
    ]);

    const prochainNumero = await redis.get(`bib:next:${event.id}`);

    // Build the list of GAPS only — holes inside [bibStart..maxAssigned] that aren't taken.
    // The unused sequential tail [maxAssigned+1..bibEnd] is excluded; those are "à venir"
    // and will be filled by normal assignment order, not gap-first.
    const takenRows = await prisma.registration.findMany({
      where: { eventId: event.id, bibNumber: { gte: event.bibStart, lte: event.bibEnd } },
      select: { bibNumber: true },
    });
    const taken = new Set(takenRows.map((r) => r.bibNumber));

    const GAP_LIST_CAP = 2000;
    const gapBibsList = [];
    let gapBibsCount = 0;
    let maxAssigned = null;
    if (taken.size > 0) {
      for (const b of taken) {
        if (maxAssigned === null || b > maxAssigned) maxAssigned = b;
      }
      // All taken bibs are <= maxAssigned by definition (taken is bounded by bibEnd above)
      gapBibsCount = (maxAssigned - event.bibStart + 1) - taken.size;
      for (let b = event.bibStart; b <= maxAssigned; b++) {
        if (!taken.has(b)) {
          gapBibsList.push(b);
          if (gapBibsList.length >= GAP_LIST_CAP) break;
        }
      }
    }
    const gapBibsTruncated = gapBibsList.length >= GAP_LIST_CAP && gapBibsCount > GAP_LIST_CAP;

    return {
      stockTotal,
      bibsAttribues: bibsTotal,
      bibsAutoRange,
      bibsRestants: stockTotal - bibsAutoRange,
      bibsManualTotal: manualMax,
      bibsManualUsed,
      bibsManualRestants: manualMax - bibsManualUsed,
      // Upper manual band — only meaningful when bibManualUpperEnd is set
      bibManualUpperEnd: event.bibManualUpperEnd,
      bibsManualHighTotal: manualHighTotal,
      bibsManualHighUsed,
      bibsManualHighRestants: hasUpperBand ? manualHighTotal - bibsManualHighUsed : 0,
      tauxOccupation: Math.round((bibsAutoRange / stockTotal) * 100),
      prochainNumero: parseInt(prochainNumero, 10) || event.bibStart,
      bibRangeLocked: event.bibRangeLocked,
      gapBibsCount,
      gapBibsList,
      gapBibsTruncated,
      maxAssigned,
    };
  });
}

module.exports = eventsRoutes;
