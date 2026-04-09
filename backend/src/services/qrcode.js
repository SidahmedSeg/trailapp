const QRCode = require('qrcode');

/**
 * Generate QR code as data URL (base64 PNG)
 */
async function generateQRDataURL(data) {
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

/**
 * Generate QR code as Buffer (PNG)
 */
async function generateQRBuffer(data) {
  return QRCode.toBuffer(data, {
    width: 300,
    margin: 2,
    type: 'png',
  });
}

module.exports = { generateQRDataURL, generateQRBuffer };
