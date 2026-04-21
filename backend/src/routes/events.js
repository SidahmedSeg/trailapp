const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');

async function eventsRoutes(fastify) {
  const { prisma, redis } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('admin', 'super_admin'));

  // GET /api/admin/events
  fastify.get('/events', async () => {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, name: true, type: true,
        date: true, location: true, active: true, status: true,
        registrationOpen: true, createdAt: true,
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
  fastify.post('/events', async (request) => {
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
        websiteUrl: body.websiteUrl || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        contactLabel: body.contactLabel || null,
        distances: body.distances || [],
        registrationOpen: body.registrationOpen ?? true,
        registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
        maxCapacity: body.maxCapacity ?? null,
        autoCloseOnExhaustion: body.autoCloseOnExhaustion ?? true,
        bibStart: body.bibStart ?? 101,
        bibEnd: body.bibEnd ?? 1500,
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
  fastify.put('/events/:id', async (request) => {
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
        // Cannot decrease below highest assigned bib
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

    const allowedFields = [
      'name', 'type', 'description', 'date', 'location',
      'primaryColor', 'logoPath', 'coverImagePath',
      'facebookUrl', 'instagramUrl', 'websiteUrl',
      'contactEmail', 'contactPhone', 'contactLabel',
      'distances',
      'registrationOpen', 'registrationDeadline', 'maxCapacity', 'autoCloseOnExhaustion',
      'bibStart', 'bibEnd', 'bibPrefix',
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
  fastify.post('/events/:id/upload', async (request, reply) => {
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
  fastify.post('/events/:id/activate', async (request) => {
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
  fastify.post('/events/:id/archive', async (request) => {
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
  fastify.post('/events/:id/unarchive', async (request) => {
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

  // GET /api/admin/events/:id/bib-stats
  fastify.get('/events/:id/bib-stats', async (request) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    const stockTotal = event.bibEnd - event.bibStart + 1;
    const manualMax = event.bibStart - 1;

    const [bibsAutoRange, bibsTotal, bibsManualUsed] = await Promise.all([
      prisma.registration.count({
        where: { eventId: event.id, bibNumber: { gte: event.bibStart, lte: event.bibEnd } },
      }),
      prisma.registration.count({
        where: { eventId: event.id, bibNumber: { not: null } },
      }),
      prisma.registration.count({
        where: { eventId: event.id, bibNumber: { gte: 1, lt: event.bibStart } },
      }),
    ]);

    const prochainNumero = await redis.get(`bib:next:${event.id}`);

    return {
      stockTotal,
      bibsAttribues: bibsTotal,
      bibsAutoRange,
      bibsRestants: stockTotal - bibsAutoRange,
      bibsManualTotal: manualMax,
      bibsManualUsed,
      bibsManualRestants: manualMax - bibsManualUsed,
      tauxOccupation: Math.round((bibsAutoRange / stockTotal) * 100),
      prochainNumero: parseInt(prochainNumero, 10) || event.bibStart,
      bibRangeLocked: event.bibRangeLocked,
    };
  });
}

module.exports = eventsRoutes;
