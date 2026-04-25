const { getActiveEvent } = require('../services/event');
const { AppError } = require('../utils/errors');

async function registrationGuard(request) {
  const { prisma, redis } = request.server;

  const event = await getActiveEvent(prisma);

  if (!event.registrationOpen) {
    throw new AppError(403, 'Les inscriptions sont fermées', 'REGISTRATION_CLOSED');
  }

  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    throw new AppError(403, 'La date limite d\'inscription est dépassée', 'REGISTRATION_DEADLINE');
  }

  if (event.maxCapacity) {
    const count = await prisma.registration.count({
      where: { eventId: event.id, paymentStatus: { in: ['success', 'manual'] } },
    });
    if (count >= event.maxCapacity) {
      throw new AppError(403, 'Capacité maximale atteinte', 'MAX_CAPACITY');
    }
  }

  // Check bib stock
  const bibNext = await redis.get(`bib:next:${event.id}`);
  if (bibNext && parseInt(bibNext, 10) > event.bibEnd) {
    throw new AppError(403, 'Plus de dossards disponibles', 'NO_BIBS');
  }

  request.event = event;
}

module.exports = registrationGuard;
