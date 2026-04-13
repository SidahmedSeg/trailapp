const PDFDocument = require('pdfkit');
const { generateQRBuffer } = require('./qrcode');
const env = require('../config/env');

const BRAND_RED = '#C42826';
const GRAY_900 = '#111827';
const GRAY_600 = '#4B5563';
const GRAY_400 = '#9CA3AF';
const GRAY_200 = '#E5E7EB';
const GRAY_50 = '#F9FAFB';

/**
 * Generate PDF ticket as a Buffer — modern design matching Success page
 */
async function generateTicketPDF(registration) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pw = doc.page.width;   // 595
      const mx = 50;               // margin x
      const cw = pw - mx * 2;      // content width

      // ═══════════════════════════════════════
      // RED HEADER BAR
      // ═══════════════════════════════════════
      doc.rect(0, 0, pw, 100).fill(BRAND_RED);
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('TRAIL DES MOUFLONS D\'OR', 0, 30, { align: 'center' });
      doc.fontSize(11).font('Helvetica').fillColor('rgba(255,255,255,0.8)')
        .text('3ème Édition — 1 Mai 2026 — Alger', 0, 58, { align: 'center' });

      // ═══════════════════════════════════════
      // SUCCESS BADGE
      // ═══════════════════════════════════════
      doc.fillColor(GRAY_900);
      doc.fontSize(12).font('Helvetica-Bold')
        .text('✓  INSCRIPTION CONFIRMÉE', 0, 120, { align: 'center' });

      // ═══════════════════════════════════════
      // BIB NUMBER + QR CODE (side by side)
      // ═══════════════════════════════════════
      const bibQrY = 155;

      // Bib box (left)
      const bibBoxW = 250;
      const bibBoxH = 140;
      doc.roundedRect(mx, bibQrY, bibBoxW, bibBoxH, 12).fill(BRAND_RED);
      doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
        .text('NUMÉRO DE DOSSARD', mx, bibQrY + 20, { width: bibBoxW, align: 'center' });
      doc.fontSize(56).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text(`${registration.bibNumber || '—'}`, mx, bibQrY + 45, { width: bibBoxW, align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
        .text('Trail des Mouflons d\'Or 2026', mx, bibQrY + 110, { width: bibBoxW, align: 'center' });

      // QR code (right)
      const qrX = mx + bibBoxW + 20;
      const qrBoxW = cw - bibBoxW - 20;
      doc.roundedRect(qrX, bibQrY, qrBoxW, bibBoxH, 12).lineWidth(1).strokeColor(GRAY_200).stroke();
      const scanUrl = `${env.APP_URL}/api/scan/${registration.qrToken}`;
      const qrBuffer = await generateQRBuffer(scanUrl);
      const qrSize = 100;
      doc.image(qrBuffer, qrX + (qrBoxW - qrSize) / 2, bibQrY + 10, { width: qrSize });
      doc.fontSize(8).font('Helvetica').fillColor(GRAY_400)
        .text('Scanner pour vérifier', qrX, bibQrY + qrSize + 15, { width: qrBoxW, align: 'center' });

      // ═══════════════════════════════════════
      // PARTICIPANT INFO
      // ═══════════════════════════════════════
      let y = bibQrY + bibBoxH + 30;

      y = drawSectionHeader(doc, mx, y, 'INFORMATIONS DU PARTICIPANT');
      y += 5;

      const colW = cw / 2;
      y = drawInfoRow(doc, mx, y, 'Nom complet', `${registration.firstName} ${registration.lastName}`, colW);
      y = drawInfoRow(doc, mx + colW, y - 20, 'Email', registration.email, colW);
      y += 5;
      y = drawInfoRow(doc, mx, y, 'Téléphone', registration.phone || '—', colW);
      y = drawInfoRow(doc, mx + colW, y - 20, 'Genre', registration.gender || '—', colW);
      y += 5;
      y = drawInfoRow(doc, mx, y, 'Taille T-shirt', registration.tshirtSize || '—', colW);
      y = drawInfoRow(doc, mx + colW, y - 20, 'Niveau', registration.runnerLevel || '—', colW);

      // ═══════════════════════════════════════
      // EVENT INFO
      // ═══════════════════════════════════════
      y += 15;
      y = drawSectionHeader(doc, mx, y, 'INFORMATIONS DE L\'ÉVÉNEMENT');
      y += 5;

      // 3 mini cards
      const cardW = (cw - 20) / 3;
      const cardH = 55;
      const cards = [
        { label: 'Date', value: '1 Mai 2026' },
        { label: 'Lieu', value: 'Ben Aknoun, Alger' },
        { label: 'Distance', value: '16,57 km' },
      ];
      cards.forEach((card, i) => {
        const cx = mx + i * (cardW + 10);
        doc.roundedRect(cx, y, cardW, cardH, 8).fill(GRAY_50);
        doc.fontSize(8).font('Helvetica').fillColor(GRAY_400)
          .text(card.label, cx + 10, y + 10, { width: cardW - 20 });
        doc.fontSize(11).font('Helvetica-Bold').fillColor(GRAY_900)
          .text(card.value, cx + 10, y + 25, { width: cardW - 20 });
      });
      y += cardH + 15;

      // ═══════════════════════════════════════
      // PAYMENT INFO
      // ═══════════════════════════════════════
      if (registration.paymentStatus === 'success' || registration.paymentStatus === 'manual') {
        y = drawSectionHeader(doc, mx, y, 'DÉTAILS DU PAIEMENT');
        y += 5;

        if (registration.transactionId) {
          y = drawPaymentRow(doc, mx, y, cw, 'N° de transaction', registration.transactionId);
        }
        if (registration.paymentMethod) {
          y = drawPaymentRow(doc, mx, y, cw, 'Méthode', registration.paymentMethod);
        }
        y = drawPaymentRow(doc, mx, y, cw, 'Montant',
          `${(registration.paymentAmount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD`);

        const statusText = registration.paymentStatus === 'success' ? 'Payé' : 'Manuel';
        y = drawPaymentRow(doc, mx, y, cw, 'Statut', statusText);
        y += 10;
      }

      // ═══════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════
      doc.moveTo(mx, y).lineTo(pw - mx, y).lineWidth(0.5).strokeColor(GRAY_200).stroke();
      y += 15;
      doc.fontSize(8).font('Helvetica').fillColor(GRAY_400)
        .text('Ce document fait office de confirmation d\'inscription.', mx, y, { width: cw, align: 'center' });
      y += 12;
      doc.text('Présentez le QR code le jour de la course pour le retrait de votre dossard.', mx, y, { width: cw, align: 'center' });
      y += 20;
      doc.fontSize(7).fillColor(GRAY_400)
        .text('Ligue Algéroise de Ski et des Sports de Montagne (LASSM) — contact@lassm.dz', mx, y, { width: cw, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawSectionHeader(doc, x, y, title) {
  doc.roundedRect(x, y, 4, 16, 2).fill(BRAND_RED);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY_900)
    .text(title, x + 12, y + 2);
  return y + 25;
}

function drawInfoRow(doc, x, y, label, value, width) {
  doc.fontSize(8).font('Helvetica').fillColor(GRAY_400)
    .text(label, x, y, { width });
  doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY_900)
    .text(value || '—', x, y + 10, { width });
  return y + 25;
}

function drawPaymentRow(doc, x, y, width, label, value) {
  doc.fontSize(9).font('Helvetica').fillColor(GRAY_600)
    .text(label, x, y, { width: width / 2 });
  doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY_900)
    .text(value, x + width / 2, y, { width: width / 2, align: 'right' });
  return y + 18;
}

module.exports = { generateTicketPDF };
