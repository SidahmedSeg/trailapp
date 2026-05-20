/**
 * Proxy ID photo retention sweep.
 *
 * On race-day bib distribution, the operator can capture a photo of the
 * proxy's CIN as accountability evidence. This is sensitive PII, so we
 * hard-delete the photo file from disk + null the DB path after 90 days.
 *
 * Boot wiring (server.js):
 *   - runs once 30s after boot (covers crash-restart cases)
 *   - then runs every 24h
 */

const fs = require('fs');
const path = require('path');
const { logActivity } = require('../middleware/activityLogger');

const RETENTION_DAYS = 90;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SWEEP_FIRST_DELAY_MS = 30 * 1000;

async function purgeStaleProxyPhotos(prisma) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const stale = await prisma.registration.findMany({
    where: {
      pickedUpAt: { lt: cutoff },
      pickedUpByCinPhotoPath: { not: null },
    },
    select: { id: true, bibNumber: true, pickedUpByCinPhotoPath: true },
  });

  let deleted = 0;
  let missing = 0;
  for (const r of stale) {
    const rel = String(r.pickedUpByCinPhotoPath).replace(/^\/+/, '');
    const abs = path.resolve(__dirname, '../..', rel);
    try {
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
        deleted += 1;
      } else {
        missing += 1;
      }
    } catch (err) {
      console.error(`[proxyIdRetention] failed to unlink ${abs}:`, err.message);
      continue;
    }
    try {
      await prisma.registration.update({
        where: { id: r.id },
        data: { pickedUpByCinPhotoPath: null },
      });
      await logActivity({
        action: 'proxy_id_photo_purged',
        adminUsername: 'system',
        targetType: 'registration',
        targetId: r.id,
        details: {
          bibNumber: r.bibNumber,
          photoPath: r.pickedUpByCinPhotoPath,
          retentionDays: RETENTION_DAYS,
        },
      });
    } catch (err) {
      console.error(`[proxyIdRetention] failed to clear DB path for ${r.id}:`, err.message);
    }
  }

  if (stale.length > 0) {
    console.log(`[proxyIdRetention] swept ${deleted} file(s), ${missing} already missing, ${stale.length} DB rows updated`);
  }

  return { scanned: stale.length, deleted, missing };
}

function startRetentionSweep(prisma) {
  setTimeout(() => {
    purgeStaleProxyPhotos(prisma).catch((err) => {
      console.error('[proxyIdRetention] initial sweep failed:', err);
    });
  }, SWEEP_FIRST_DELAY_MS);

  setInterval(() => {
    purgeStaleProxyPhotos(prisma).catch((err) => {
      console.error('[proxyIdRetention] periodic sweep failed:', err);
    });
  }, SWEEP_INTERVAL_MS);
}

module.exports = { purgeStaleProxyPhotos, startRetentionSweep, RETENTION_DAYS };
