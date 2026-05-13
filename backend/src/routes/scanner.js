const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');

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
  fastify.post('/scan/:qrToken/distribute', async (request) => {
    const { qrToken } = request.params;
    const { eventId } = request.body || {};

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

    const now = new Date();
    await prisma.registration.update({
      where: { qrToken },
      data: {
        status: 'distribué',
        distributedAt: now,
        distributedBy: request.user.username,
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
      action: 'bib_distributed',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: registration.id,
      details: { bibNumber: registration.bibNumber, method: 'qr' },
    });

    return { success: true };
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
        eventId: true,
        event: { select: { name: true, slug: true } },
      },
    });

    if (!registration) {
      throw new AppError(404, 'Coureur non trouvé pour ce dossard', 'NOT_FOUND');
    }

    return { data: registration };
  });

  // GET /api/scan/session/history — distributions, optionally filtered by event
  fastify.get('/scan/session/history', async (request) => {
    const { eventId } = request.query;

    let where = {};
    if (eventId) {
      // Get registration IDs for this event, then filter sessions
      const regIds = await prisma.registration.findMany({
        where: { eventId },
        select: { id: true },
      });
      where = { registrationId: { in: regIds.map(r => r.id) } };
    }

    const sessions = await prisma.scannerSession.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
    });

    return { data: sessions };
  });
}

module.exports = scannerRoutes;
