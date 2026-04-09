const { AppError } = require('../utils/errors');

async function registrationGuard(request, reply) {
  const { prisma, redis } = request.server;

  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    throw new AppError(500, 'Configuration manquante', 'CONFIG_ERROR');
  }

  if (!settings.registrationOpen) {
    throw new AppError(403, 'Les inscriptions sont fermées', 'REGISTRATION_CLOSED');
  }

  if (settings.registrationDeadline && new Date() > settings.registrationDeadline) {
    throw new AppError(403, 'La date limite d\'inscription est dépassée', 'REGISTRATION_DEADLINE');
  }

  if (settings.maxCapacity) {
    const count = await prisma.registration.count({
      where: { paymentStatus: { in: ['success', 'manual'] } },
    });
    if (count >= settings.maxCapacity) {
      throw new AppError(403, 'Capacité maximale atteinte', 'MAX_CAPACITY');
    }
  }

  // Check bib stock
  const bibNext = await redis.get('bib:next');
  if (bibNext && parseInt(bibNext, 10) > settings.bibEnd) {
    throw new AppError(403, 'Plus de dossards disponibles', 'NO_BIBS');
  }

  request.settings = settings;
}

module.exports = registrationGuard;
