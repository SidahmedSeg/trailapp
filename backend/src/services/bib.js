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
 * Validate that a manual bib falls inside one of the manual bands:
 *   - Lower band: 1..bibStart-1
 *   - Upper band: bibEnd+1..bibManualUpperEnd  (only when bibManualUpperEnd is set)
 *
 * Rejects values inside the auto range and any number outside both bands
 * (e.g. accidentally typing 99999 with no upper ceiling configured).
 */
async function validateManualBib(prisma, bibNumber, event) {
  const { id: eventId, bibStart, bibEnd, bibManualUpperEnd } = event;

  if (!Number.isInteger(bibNumber) || bibNumber < 1) {
    throw new AppError(400, 'Numéro de dossard invalide', 'VALIDATION_ERROR');
  }

  if (bibNumber >= bibStart && bibNumber <= bibEnd) {
    throw new AppError(400,
      `Ce numéro est réservé à l'attribution automatique (${bibStart}-${bibEnd})`,
      'BIB_IN_AUTO_RANGE'
    );
  }

  const inLower = bibNumber < bibStart;
  const inUpper = bibManualUpperEnd != null && bibNumber > bibEnd && bibNumber <= bibManualUpperEnd;

  if (!inLower && !inUpper) {
    const ranges = bibManualUpperEnd != null
      ? `1-${bibStart - 1} ou ${bibEnd + 1}-${bibManualUpperEnd}`
      : `1-${bibStart - 1}`;
    throw new AppError(400,
      `Ce numéro est hors des plages manuelles autorisées (${ranges})`,
      'BIB_OUT_OF_MANUAL_RANGE'
    );
  }

  // Composite uniqueness on [bibNumber, eventId]
  const existing = await prisma.registration.findFirst({
    where: { bibNumber, eventId },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'Ce numéro de dossard est déjà attribué', 'BIB_TAKEN');
  }
}

module.exports = { getNextBib, validateManualBib };
