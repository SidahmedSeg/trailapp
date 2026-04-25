const { AppError } = require('../utils/errors');

/**
 * Get next sequential bib number from Redis (atomic INCR)
 * Scoped per event: uses key bib:next:{eventId}
 */
async function getNextBib(redis, eventId, bibEnd) {
  const bibNumber = await redis.incr(`bib:next:${eventId}`);

  if (bibNumber > bibEnd) {
    throw new AppError(403, 'Plus de dossards disponibles', 'NO_BIBS');
  }

  return bibNumber;
}

/**
 * Validate that a manual bib is outside the auto range
 */
async function validateManualBib(prisma, bibNumber, bibStart, bibEnd) {
  if (bibNumber >= bibStart && bibNumber <= bibEnd) {
    throw new AppError(400,
      `Ce numéro est réservé à l'attribution automatique (${bibStart}-${bibEnd})`,
      'BIB_IN_AUTO_RANGE'
    );
  }

  const existing = await prisma.registration.findUnique({
    where: { bibNumber },
  });
  if (existing) {
    throw new AppError(409, 'Ce numéro de dossard est déjà attribué', 'BIB_TAKEN');
  }
}

module.exports = { getNextBib, validateManualBib };
