const PDFDocument = require('pdfkit');
const { generateQRBuffer } = require('./qrcode');
const env = require('../config/env');

/**
 * Generate PDF ticket as a Buffer
 */
async function generateTicketPDF(registration) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(24).font('Helvetica-Bold')
        .text('Trail des Mouflons d\'Or 2026', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica')
        .text('Ticket de confirmation', { align: 'center' });
      doc.moveDown(1);

      // Divider
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
      doc.moveDown(1);

      // Bib number (large)
      doc.fontSize(48).font('Helvetica-Bold')
        .text(`#${registration.bibNumber}`, { align: 'center' });
      doc.moveDown(0.5);

      // QR Code
      const scanUrl = `${env.APP_URL}/api/scan/${registration.qrToken}`;
      const qrBuffer = await generateQRBuffer(scanUrl);
      doc.image(qrBuffer, (doc.page.width - 150) / 2, doc.y, { width: 150 });
      doc.moveDown(8);

      // Participant info
      doc.fontSize(12).font('Helvetica-Bold').text('Participant');
      doc.font('Helvetica')
        .text(`Nom: ${registration.firstName} ${registration.lastName}`)
        .text(`Email: ${registration.email}`)
        .text(`Taille t-shirt: ${registration.tshirtSize}`)
        .text(`Niveau: ${registration.runnerLevel}`);
      doc.moveDown(1);

      // Event info
      doc.font('Helvetica-Bold').text('Événement');
      doc.font('Helvetica')
        .text('Date: 1 Mai 2026')
        .text('Ville: Alger');
      doc.moveDown(1);

      // Payment info
      if (registration.paymentStatus === 'success') {
        doc.font('Helvetica-Bold').text('Paiement');
        doc.font('Helvetica')
          .text(`Méthode: ${registration.paymentMethod || 'N/A'}`)
          .text(`Montant: ${(registration.paymentAmount / 100).toFixed(2)} DZD`)
          .text(`Transaction: ${registration.transactionId || 'N/A'}`)
          .text(`Date: ${registration.paymentDate ? new Date(registration.paymentDate).toLocaleDateString('fr-FR') : 'N/A'}`);
      } else if (registration.paymentStatus === 'manual') {
        doc.font('Helvetica-Bold').text('Paiement');
        doc.font('Helvetica').text('Mode: Manuel (admin)');
      }

      doc.moveDown(2);

      // Footer
      doc.fontSize(8).font('Helvetica')
        .text('Ce document fait office de confirmation d\'inscription. Présentez le QR code le jour de la course.',
          { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateTicketPDF };
