/**
 * Reconciliation service — Excel parsing + bib gap-first helper.
 *
 * Excel layout expected (case-insensitive, accent-tolerant column matching):
 *   - Etat du paiement       (filter: must be "Déposé" or "D?pos?")
 *   - Numéro de commande     -> orderNumber
 *   - Date de paiement       -> paymentDate
 *   - Date de dépôt          -> depositDate
 *   - Montant approuvé       -> approvedAmount (centimes, DZD * 100)
 *   - Nom du titulaire de la carte -> cardholderName
 *   - Card PAN               -> cardPan (last 4)
 */

const xlsx = require('xlsx');

// Strip diacritics, collapse '?' (SATIM mangling), uppercase, normalize whitespace.
function normalizeHeader(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\?/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

// Map of normalized header -> canonical field name
const HEADER_ALIASES = {
  'ETAT DU PAIEMENT': 'paymentStatus',
  'PAYMENT STATUS': 'paymentStatus',
  'NUMERO DE COMMANDE': 'orderNumber',
  'ORDER NUMBER': 'orderNumber',
  'DATE DE PAIEMENT': 'paymentDate',
  'PAYMENT DATE': 'paymentDate',
  'DATE DE DEPOT': 'depositDate',
  'DEPOSIT DATE': 'depositDate',
  'MONTANT APPROUVE': 'approvedAmount',
  'APPROVED AMOUNT': 'approvedAmount',
  'MONTANT DEPOSE': 'approvedAmount', // fallback if "Montant déposé" is provided
  'NOM DU TITULAIRE DE LA CARTE': 'cardholderName',
  'CARDHOLDER NAME': 'cardholderName',
  // The SATIM merchant export uses "Numéro de carte" for the masked PAN like "639379**2514".
  'NUMERO DE CARTE': 'cardPan',
  'CARD NUMBER': 'cardPan',
  'CARD PAN': 'cardPan',
  'PAN': 'cardPan',
};

// Match "Déposé" tolerant to accents being mangled to '?' (e.g., "D?pos?").
function isDeposeStatus(s) {
  if (!s) return false;
  return /^d.pos.$/i.test(String(s).trim());
}

// Parse a date cell which may be:
//  - JS Date (xlsx auto-parses)
//  - String "YYYY.MM.DD HH:MM:SS" (SATIM format)
//  - String "YYYY-MM-DD HH:MM:SS"
//  - Excel serial number
function parseDateCell(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Excel serial date: days since 1899-12-30
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms);
  }
  const s = String(v).trim();
  // SATIM "2026.04.27 19:14:16"
  let m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+01:00`);
  // ISO-ish "YYYY-MM-DD HH:MM:SS"
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+01:00`);
  // Date-only fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Parse amount cell: "2500.00" or "2,500.00" or "250000" or numeric -> always in centimes (DZD * 100)
function parseAmountCentimes(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // If integer >= 100000 we assume already in centimes; otherwise treat as DZD
    return v >= 100000 ? Math.round(v) : Math.round(v * 100);
  }
  const cleaned = String(v).replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return n >= 100000 ? Math.round(n) : Math.round(n * 100);
}

// Extract last 4 digits from a string like "628070**5733" or "5733" or "5733  "
function last4(v) {
  if (v == null) return null;
  const digits = String(v).replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-4);
}

/**
 * Parse an uploaded buffer (xlsx/xls/csv) and return:
 *   { rows: [{orderNumber, paymentDate, depositDate, approvedAmount, cardholderName, cardPan, paymentStatus}],
 *     parsed: total rows seen,
 *     skipped: rows excluded (not Déposé or missing required fields),
 *     headerMap: headers detected }
 *
 * Throws if no rows or required headers can't be matched.
 */
function parseSatimWorkbook(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  if (!wb.SheetNames.length) throw new Error('Fichier vide ou non lisible');

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (!json.length) throw new Error('Aucune ligne trouvée');

  // Build a header map: normalize each column to a canonical field name
  const sample = json[0];
  const headerMap = {};
  for (const colName of Object.keys(sample)) {
    const norm = normalizeHeader(colName);
    if (HEADER_ALIASES[norm]) {
      headerMap[HEADER_ALIASES[norm]] = colName;
    }
  }

  // Required columns
  const required = ['paymentStatus', 'orderNumber', 'cardholderName', 'cardPan'];
  for (const f of required) {
    if (!headerMap[f]) {
      throw new Error(`Colonne manquante: ${f}`);
    }
  }

  const rows = [];
  let skipped = 0;
  for (const r of json) {
    const status = r[headerMap.paymentStatus];
    if (!isDeposeStatus(status)) { skipped++; continue; }

    const orderNumber = String(r[headerMap.orderNumber] || '').trim();
    const cardholderName = String(r[headerMap.cardholderName] || '').trim();
    const cardPan = last4(r[headerMap.cardPan]);

    if (!orderNumber || !cardholderName || !cardPan || cardPan.length !== 4) {
      skipped++;
      continue;
    }

    rows.push({
      paymentStatus: 'Déposé',
      orderNumber,
      paymentDate: headerMap.paymentDate ? parseDateCell(r[headerMap.paymentDate]) : null,
      depositDate: headerMap.depositDate ? parseDateCell(r[headerMap.depositDate]) : null,
      approvedAmount: headerMap.approvedAmount ? parseAmountCentimes(r[headerMap.approvedAmount]) : null,
      cardholderName,
      cardPan,
    });
  }

  return { rows, parsed: json.length, skipped, headerMap };
}

/**
 * Find the first available bib in [bibStart..bibEnd] for an event,
 * skipping numbers already taken by another registration.
 */
async function pickGapFirstBib(prisma, event) {
  const taken = new Set(
    (await prisma.registration.findMany({
      where: { eventId: event.id, bibNumber: { not: null } },
      select: { bibNumber: true },
    })).map(r => r.bibNumber)
  );
  for (let b = event.bibStart; b <= event.bibEnd; b++) {
    if (!taken.has(b)) return b;
  }
  return null;
}

module.exports = { parseSatimWorkbook, pickGapFirstBib };
