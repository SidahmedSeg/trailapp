const ExcelJS = require('exceljs');
const env = require('../config/env');
const { generateQRBuffer } = require('./qrcode');

/**
 * Build an .xlsx workbook listing runners with their QR codes embedded in column E.
 * Columns: Prénom | Nom | Dossard | Niveau | QR
 *
 * Caller should stream the result via `workbook.xlsx.write(reply.raw)`.
 */
async function generateBibsWorkbook(registrations) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LASSM';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Coureurs', {
    properties: { defaultRowHeight: 85 },
  });

  sheet.columns = [
    { header: 'Prénom', key: 'firstName', width: 22 },
    { header: 'Nom', key: 'lastName', width: 22 },
    { header: 'Dossard', key: 'bibNumber', width: 12 },
    { header: 'Niveau', key: 'runnerLevel', width: 14 },
    { header: 'QR', key: 'qr', width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  for (const reg of registrations) {
    const row = sheet.addRow({
      firstName: reg.firstName || '',
      lastName: reg.lastName || '',
      bibNumber: reg.bibNumber,
      runnerLevel: reg.runnerLevel || '',
      qr: '',
    });
    row.height = 85;
    row.alignment = { vertical: 'middle', horizontal: 'left' };

    const scanUrl = `${env.APP_URL}/api/scan/${reg.qrToken}`;
    const qrBuffer = await generateQRBuffer(scanUrl);
    const imageId = workbook.addImage({ buffer: qrBuffer, extension: 'png' });
    const rowIdx = row.number - 1;
    sheet.addImage(imageId, {
      tl: { col: 4.1, row: rowIdx + 0.05 },
      ext: { width: 80, height: 80 },
      editAs: 'oneCell',
    });
  }

  return workbook;
}

module.exports = { generateBibsWorkbook };
