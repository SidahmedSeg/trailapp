const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');

async function settingsRoutes(fastify) {
  const { prisma, redis } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('admin', 'super_admin'));

  // GET /api/admin/settings
  fastify.get('/settings', async () => {
    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return { data: settings };
  });

  // PUT /api/admin/settings
  fastify.put('/settings', async (request) => {
    const body = request.body || {};

    const current = await prisma.settings.findUnique({ where: { id: 'default' } });

    // Check bibRange lock
    if (current.bibRangeLocked) {
      if (body.bibStart !== undefined && body.bibStart !== current.bibStart) {
        throw new AppError(400,
          'La plage de dossards ne peut plus être modifiée (des dossards ont déjà été attribués)',
          'BIB_RANGE_LOCKED'
        );
      }
      if (body.bibEnd !== undefined && body.bibEnd !== current.bibEnd) {
        throw new AppError(400,
          'La plage de dossards ne peut plus être modifiée (des dossards ont déjà été attribués)',
          'BIB_RANGE_LOCKED'
        );
      }
    }

    const allowedFields = [
      'registrationOpen', 'registrationDeadline', 'maxCapacity',
      'bibStart', 'bibEnd', 'bibPrefix', 'autoCloseOnExhaustion',
      'eventName', 'eventDate', 'eventCity',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'registrationDeadline' || field === 'eventDate') {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const settings = await prisma.settings.update({
      where: { id: 'default' },
      data: updateData,
    });

    await logActivity({
      action: 'settings_updated',
      adminUsername: request.user.username,
      targetType: 'settings',
      targetId: 'default',
      details: updateData,
    });

    return { data: settings };
  });

  // GET /api/admin/settings/bib-stats
  fastify.get('/settings/bib-stats', async () => {
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    const stockTotal = settings.bibEnd - settings.bibStart + 1;

    const bibsAttribues = await prisma.registration.count({
      where: { bibNumber: { gte: settings.bibStart, lte: settings.bibEnd } },
    });

    const prochainNumero = await redis.get('bib:next');

    return {
      stockTotal,
      bibsAttribues,
      bibsRestants: stockTotal - bibsAttribues,
      tauxOccupation: Math.round((bibsAttribues / stockTotal) * 100),
      prochainNumero: parseInt(prochainNumero, 10) || settings.bibStart,
      bibRangeLocked: settings.bibRangeLocked,
    };
  });
}

module.exports = settingsRoutes;
