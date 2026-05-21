const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');

const PROXY_RELATIONS = new Set(['conjoint', 'ami', 'famille', 'autre']);
const PROXY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROXY_PHOTO_ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/webp': '.webp',
};

// Build the on-disk root path for proxy ID photos of a given event/registration.
function proxyPhotoDir(eventId, registrationId) {
  return path.resolve(__dirname, '../../uploads/proxy-ids', eventId, registrationId);
}

// Validates and normalizes a proxy payload from the distribute request body.
// Returns { fields, link } or throws AppError. Returns null when no proxy.
async function normalizeProxy(prisma, registrationEventId, registrationId, proxy) {
  if (!proxy || typeof proxy !== 'object') return null;
  const name = (proxy.name || '').trim();
  const phone = (proxy.phone || '').trim();
  if (!name) throw new AppError(400, 'Nom du récupérateur requis', 'VALIDATION_ERROR');
  if (!phone) throw new AppError(400, 'Téléphone du récupérateur requis', 'VALIDATION_ERROR');
  if (!/^\+?[\d\s\-().]{6,30}$/.test(phone)) {
    throw new AppError(400, 'Téléphone invalide', 'VALIDATION_ERROR');
  }

  const cin = proxy.cin ? String(proxy.cin).trim().slice(0, 32) : null;
  const relation = proxy.relation ? String(proxy.relation).trim().toLowerCase() : null;
  if (relation && !PROXY_RELATIONS.has(relation)) {
    throw new AppError(400, 'Relation invalide', 'VALIDATION_ERROR');
  }

  let linkedRegistrationId = null;
  if (proxy.linkedRegistrationId) {
    const linked = await prisma.registration.findUnique({
      where: { id: String(proxy.linkedRegistrationId) },
      select: { id: true, eventId: true },
    });
    if (!linked || linked.eventId !== registrationEventId) {
      throw new AppError(400, 'Coureur lié introuvable pour cet événement', 'VALIDATION_ERROR');
    }
    if (linked.id === registrationId) {
      throw new AppError(400, 'Le récupérateur ne peut pas être le coureur lui-même', 'VALIDATION_ERROR');
    }
    linkedRegistrationId = linked.id;
  }

  let cinPhotoPath = null;
  if (proxy.cinPhotoPath) {
    const raw = String(proxy.cinPhotoPath);
    const expectedPrefix = `uploads/proxy-ids/${registrationEventId}/${registrationId}/`;
    // Anti-path-traversal: only accept paths under the expected dir for THIS registration.
    if (!raw.startsWith(expectedPrefix) || raw.includes('..')) {
      throw new AppError(400, 'Chemin photo invalide', 'VALIDATION_ERROR');
    }
    const onDisk = path.resolve(__dirname, '../..', raw);
    if (!fs.existsSync(onDisk)) {
      throw new AppError(400, 'Photo non trouvée — refaire l\'upload', 'VALIDATION_ERROR');
    }
    cinPhotoPath = raw;
  }

  return {
    pickedUpByName: name,
    pickedUpByPhone: phone,
    pickedUpByCin: cin,
    pickedUpByRelation: relation,
    pickedUpByRegistrationId: linkedRegistrationId,
    pickedUpByCinPhotoPath: cinPhotoPath,
  };
}

async function scannerRoutes(fastify) {
  const { prisma } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('scanner', 'admin', 'super_admin'));

  // GET /api/scan/:qrToken — lookup runner by QR
  fastify.get('/scan/:qrToken', async (request) => {
    const { qrToken } = request.params;

    const registration = await prisma.registration.findUnique({
      where: { qrToken },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, bibNumber: true, qrToken: true,
        status: true, tshirtSize: true, distributedAt: true, distributedBy: true,
        checkedInAt: true, checkedInBy: true,
        pickedUpAt: true, pickedUpByName: true, pickedUpByPhone: true,
        pickedUpByCin: true, pickedUpByRelation: true,
        pickedUpByCinPhotoPath: true, pickedUpByRegistrationId: true,
        eventId: true,
        event: { select: { name: true, slug: true } },
      },
    });

    if (!registration) {
      throw new AppError(404, 'QR code invalide ou coureur non trouvé', 'NOT_FOUND');
    }

    return { data: registration };
  });

  // POST /api/scan/:qrToken/distribute — mark as distributed
  // Optional `proxy` block in body captures who actually collected the bib.
  fastify.post('/scan/:qrToken/distribute', async (request) => {
    const { qrToken } = request.params;
    const { eventId, proxy } = request.body || {};

    const registration = await prisma.registration.findUnique({ where: { qrToken } });
    if (!registration) {
      throw new AppError(404, 'QR code invalide', 'NOT_FOUND');
    }

    // Verify registration belongs to selected event (if eventId provided)
    if (eventId && registration.eventId !== eventId) {
      throw new AppError(400,
        'Ce coureur n\'appartient pas à l\'événement sélectionné',
        'WRONG_EVENT'
      );
    }

    if (registration.status === 'distribué') {
      throw new AppError(409,
        `Dossard déjà distribué le ${new Date(registration.distributedAt).toLocaleString('fr-FR')} par ${registration.distributedBy}`,
        'ALREADY_DISTRIBUTED'
      );
    }

    const proxyData = await normalizeProxy(prisma, registration.eventId, registration.id, proxy);

    const now = new Date();
    await prisma.registration.update({
      where: { qrToken },
      data: {
        status: 'distribué',
        distributedAt: now,
        distributedBy: request.user.username,
        ...(proxyData ? { ...proxyData, pickedUpAt: now } : {}),
      },
    });

    await prisma.scannerSession.create({
      data: {
        operatorId: request.user.userId,
        operatorName: request.user.username,
        registrationId: registration.id,
        bibNumber: registration.bibNumber,
        runnerName: `${registration.firstName} ${registration.lastName}`,
        method: 'qr',
      },
    });

    await logActivity({
      action: proxyData ? 'bib_distributed_via_proxy' : 'bib_distributed',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: registration.id,
      details: {
        bibNumber: registration.bibNumber,
        method: 'qr',
        ...(proxyData ? {
          proxyName: proxyData.pickedUpByName,
          proxyPhone: proxyData.pickedUpByPhone,
          proxyRelation: proxyData.pickedUpByRelation,
          hasCinPhoto: Boolean(proxyData.pickedUpByCinPhotoPath),
          linkedRegistrationId: proxyData.pickedUpByRegistrationId,
        } : {}),
      },
    });

    return { success: true };
  });

  // POST /api/scan/:registrationId/proxy-id-photo — upload CIN photo for proxy pickup
  // Returns { path } — frontend submits this path with the distribute request.
  fastify.post('/scan/:registrationId/proxy-id-photo', async (request, reply) => {
    const { registrationId } = request.params;

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, eventId: true },
    });
    if (!registration) {
      throw new AppError(404, 'Inscription introuvable', 'NOT_FOUND');
    }

    if (!request.isMultipart()) {
      throw new AppError(400, 'Requête multipart attendue', 'VALIDATION_ERROR');
    }

    let savedPath = null;
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type !== 'file' || part.fieldname !== 'photo') continue;
      const ext = PROXY_PHOTO_ALLOWED_MIME[part.mimetype];
      if (!ext) {
        throw new AppError(400, `Format d'image non supporté: ${part.mimetype}`, 'VALIDATION_ERROR');
      }
      const dir = proxyPhotoDir(registration.eventId, registration.id);
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${randomUUID()}${ext}`;
      const onDisk = path.join(dir, filename);

      let bytes = 0;
      const writeStream = fs.createWriteStream(onDisk);
      // Manual byte counting so we can abort if the stream exceeds the limit.
      part.file.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > PROXY_PHOTO_MAX_BYTES) {
          part.file.destroy(new Error('TOO_LARGE'));
        }
      });
      try {
        await pipeline(part.file, writeStream);
      } catch (err) {
        try { fs.unlinkSync(onDisk); } catch (_) { /* ignore */ }
        if (err.message === 'TOO_LARGE' || bytes > PROXY_PHOTO_MAX_BYTES) {
          throw new AppError(400, 'Photo trop volumineuse (max 5 Mo)', 'VALIDATION_ERROR');
        }
        throw err;
      }
      savedPath = `uploads/proxy-ids/${registration.eventId}/${registration.id}/${filename}`;
      break; // accept only one file
    }

    if (!savedPath) {
      throw new AppError(400, 'Aucune photo reçue', 'VALIDATION_ERROR');
    }

    return reply.send({ path: savedPath });
  });

  // POST /api/scan/:qrToken/check-in — record event-day check-in
  // Required state: runner must already be distributed AND not yet checked-in.
  fastify.post('/scan/:qrToken/check-in', async (request) => {
    const { qrToken } = request.params;
    const { eventId } = request.body || {};

    const registration = await prisma.registration.findUnique({ where: { qrToken } });
    if (!registration) {
      throw new AppError(404, 'QR code invalide', 'NOT_FOUND');
    }

    if (eventId && registration.eventId !== eventId) {
      throw new AppError(400,
        'Ce coureur n\'appartient pas à l\'événement sélectionné',
        'WRONG_EVENT'
      );
    }

    // Must have picked up the bib first
    if (registration.status !== 'distribué') {
      throw new AppError(409,
        `Dossard non distribué — le coureur doit d'abord récupérer son dossard au stand de retrait`,
        'NOT_DISTRIBUTED'
      );
    }

    if (registration.checkedInAt) {
      throw new AppError(409,
        `Déjà enregistré le ${new Date(registration.checkedInAt).toLocaleString('fr-FR')} par ${registration.checkedInBy}`,
        'ALREADY_CHECKED_IN'
      );
    }

    // Atomic conditional update — guards against concurrent check-ins
    const now = new Date();
    const result = await prisma.registration.updateMany({
      where: { qrToken, status: 'distribué', checkedInAt: null },
      data: {
        checkedInAt: now,
        checkedInBy: request.user.username,
      },
    });
    if (result.count === 0) {
      throw new AppError(409, 'Check-in déjà enregistré par un autre opérateur', 'ALREADY_CHECKED_IN');
    }

    await prisma.scannerSession.create({
      data: {
        operatorId: request.user.userId,
        operatorName: request.user.username,
        registrationId: registration.id,
        bibNumber: registration.bibNumber,
        runnerName: `${registration.firstName} ${registration.lastName}`,
        method: 'qr-checkin',
      },
    });

    await logActivity({
      action: 'runner_checked_in',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: registration.id,
      details: { bibNumber: registration.bibNumber, method: 'qr-checkin' },
    });

    return { success: true, checkedInAt: now };
  });

  // GET /api/scan/manual/:bibNumber — lookup by bib, scoped by eventId
  fastify.get('/scan/manual/:bibNumber', async (request) => {
    const bibNumber = parseInt(request.params.bibNumber, 10);
    if (isNaN(bibNumber)) {
      throw new AppError(400, 'Numéro de dossard invalide', 'VALIDATION_ERROR');
    }

    const { eventId } = request.query;

    // If eventId provided, scope the search
    const where = { bibNumber };
    if (eventId) {
      where.eventId = eventId;
    }

    const registration = await prisma.registration.findFirst({
      where,
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, bibNumber: true, qrToken: true,
        status: true, tshirtSize: true, distributedAt: true, distributedBy: true,
        checkedInAt: true, checkedInBy: true,
        pickedUpAt: true, pickedUpByName: true, pickedUpByPhone: true,
        pickedUpByCin: true, pickedUpByRelation: true,
        pickedUpByCinPhotoPath: true, pickedUpByRegistrationId: true,
        eventId: true,
        event: { select: { name: true, slug: true } },
      },
    });

    if (!registration) {
      throw new AppError(404, 'Coureur non trouvé pour ce dossard', 'NOT_FOUND');
    }

    return { data: registration };
  });

  // GET /api/scan/session/history — distributions, optionally filtered by event.
  // Uses Prisma's `include` to join in the proxy pickup snapshot in a single
  // query; transforms the response shape so the frontend stays decoupled from
  // the underlying schema.
  fastify.get('/scan/session/history', async (request) => {
    const { eventId } = request.query;

    const sessions = await prisma.scannerSession.findMany({
      where: eventId ? { registration: { eventId } } : undefined,
      orderBy: { scannedAt: 'desc' },
      include: {
        registration: {
          select: {
            pickedUpAt: true,
            pickedUpByName: true,
            pickedUpByPhone: true,
            pickedUpByCin: true,
            pickedUpByRelation: true,
            pickedUpByCinPhotoPath: true,
            pickedUpByRegistration: {
              select: { id: true, firstName: true, lastName: true, bibNumber: true },
            },
          },
        },
      },
    });

    return {
      data: sessions.map(({ registration, ...session }) => ({
        ...session,
        proxy: registration?.pickedUpByName
          ? {
              name: registration.pickedUpByName,
              phone: registration.pickedUpByPhone,
              cin: registration.pickedUpByCin,
              relation: registration.pickedUpByRelation,
              pickedUpAt: registration.pickedUpAt,
              hasCinPhoto: Boolean(registration.pickedUpByCinPhotoPath),
              linkedRegistration: registration.pickedUpByRegistration || null,
            }
          : null,
      })),
    };
  });
}

module.exports = scannerRoutes;
