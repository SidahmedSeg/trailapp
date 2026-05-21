const archiver = require('archiver');
const env = require('../config/env');
const { generateQRBuffer } = require('./qrcode');

/**
 * Stream a ZIP archive of the runners bibs export:
 *
 *   coureurs-bibs-YYYY-MM-DD.csv
 *   qr-codes/<bibNumber>.png   (one per row)
 *
 * The CSV uses 5 columns: Prénom | Nom | Dossard | Niveau | QR
 * The QR column is just the image filename (e.g. "6.png"); the file lives
 * inside the qr-codes/ folder of the archive.
 *
 * Caller is responsible for setting Content-Type / Content-Disposition
 * and piping `archive` into the response. Returns the archiver instance.
 */
function buildBibsArchive(registrations, replyStream) {
  const archive = archiver('zip', { zlib: { level: 6 } });

  // Forward errors to the caller stream
  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') throw err;
  });
  archive.pipe(replyStream);

  // CSV header + rows (UTF-8 BOM so Excel renders accents correctly)
  const csvLines = ['﻿Prénom,Nom,Dossard,Niveau,QR'];
  for (const r of registrations) {
    const bib = String(r.bibNumber);
    csvLines.push([
      csvCell(r.firstName),
      csvCell(r.lastName),
      bib,
      csvCell(r.runnerLevel),
      `${bib}.png`,
    ].join(','));
  }
  archive.append(csvLines.join('\n'), { name: 'coureurs-bibs.csv' });

  // Append the QR PNGs — generate sequentially and feed straight to the
  // archive stream (no buffering of the whole set in memory).
  const appendQRs = async () => {
    for (const r of registrations) {
      const scanUrl = `${env.APP_URL}/api/scan/${r.qrToken}`;
      const buf = await generateQRBuffer(scanUrl);
      archive.append(buf, { name: `qr-codes/${r.bibNumber}.png` });
    }
    await archive.finalize();
  };
  appendQRs().catch((err) => {
    archive.emit('error', err);
  });

  return archive;
}

// Quote a CSV cell only when needed and escape embedded quotes.
function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

module.exports = { buildBibsArchive };
