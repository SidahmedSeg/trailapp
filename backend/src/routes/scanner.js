const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');

async function scannerRoutes(fastify) {
  const { prisma } = fastify;

  // All scanner routes require auth (any role can scan)
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('scanner', 'admin', 'super_admin'));

  // GET /api/scan/:qrToken — lookup runner (read-only)
  fastify.get('/scan/:qrToken', async (request) => {
    const { qrToken } = request.params;

    const registration = await prisma.registration.findUnique({
      where: { qrToken },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, bibNumber: true, qrToken: true,
        status: true, tshirtSize: true, distributedAt: true,
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

    const registration = await prisma.registration.findUnique({ where: { qrToken } });
    if (!registration) {
      throw new AppError(404, 'QR code invalide', 'NOT_FOUND');
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

    // Create scanner session entry
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

  // GET /api/scan/manual/:bibNumber — lookup by bib
  fastify.get('/scan/manual/:bibNumber', async (request) => {
    const bibNumber = parseInt(request.params.bibNumber, 10);
    if (isNaN(bibNumber)) {
      throw new AppError(400, 'Numéro de dossard invalide', 'VALIDATION_ERROR');
    }

    const registration = await prisma.registration.findUnique({
      where: { bibNumber },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, bibNumber: true, qrToken: true,
        status: true, tshirtSize: true, distributedAt: true,
      },
    });

    if (!registration) {
      throw new AppError(404, 'Coureur non trouvé pour ce dossard', 'NOT_FOUND');
    }

    return { data: registration };
  });

  // GET /api/scan/session/history — all distributions
  fastify.get('/scan/session/history', async (request) => {
    const sessions = await prisma.scannerSession.findMany({
      orderBy: { scannedAt: 'desc' },
    });

    return { data: sessions };
  });
}

module.exports = scannerRoutes;
