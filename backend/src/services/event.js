const { AppError } = require('../utils/errors');

/**
 * Get the currently active event or throw.
 */
async function getActiveEvent(prisma) {
  const event = await prisma.event.findFirst({ where: { active: true } });
  if (!event) {
    throw new AppError(500, 'Aucun événement actif configuré', 'NO_ACTIVE_EVENT');
  }
  return event;
}

module.exports = { getActiveEvent };
