/**
 * Recovery script for stuck payments
 *
 * For all registrations in `processing` or `failed` status (with transactionId)
 * in the currently active event, verify with SATIM whether they actually paid.
 * If yes: assign next available bib (gap-first, then sequential) + send email.
 * If no: skip.
 *
 * Safe to interrupt and re-run. Sequential, no parallel writes.
 * Run: node prisma/recover-stuck-payments.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const prisma = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');
const { getOrderStatus } = require('../src/services/satim');
const { sendConfirmationEmail } = require('../src/services/sendgrid');

const SATIM_DELAY_MS = 200;       // delay between SATIM API calls
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(DRY_RUN ? '\n=== DRY RUN (no changes) ===\n' : '\n=== LIVE RECOVERY ===\n');

  // 1. Get active event
  const event = await prisma.event.findFirst({ where: { active: true } });
  if (!event) { console.log('No active event'); return; }
  console.log('Event:', event.name);
  console.log('Range:', event.bibStart, '-', event.bibEnd);

  // 2. Build initial taken-bib set
  const initialTaken = await prisma.registration.findMany({
    where: { eventId: event.id, bibNumber: { not: null } },
    select: { bibNumber: true }
  });
  const taken = new Set(initialTaken.map(r => r.bibNumber));
  console.log('Bibs already assigned:', taken.size);

  // 3. Get all stuck registrations (processing or failed, with transactionId)
  const stuck = await prisma.registration.findMany({
    where: {
      eventId: event.id,
      paymentStatus: { in: ['processing', 'failed'] },
      transactionId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    include: { event: { select: { name: true, date: true, location: true, primaryColor: true } } }
  });
  console.log('Candidates to verify:', stuck.length);
  console.log('');

  let recovered = 0;
  let notPaid = 0;
  let errors = 0;

  // 4. Process one at a time
  for (let i = 0; i < stuck.length; i++) {
    const reg = stuck[i];
    const prefix = `[${i + 1}/${stuck.length}] ${reg.email}`;

    try {
      // Verify with SATIM
      const status = await getOrderStatus(reg.transactionId);
      const paid = status.orderStatus === 2 && status.actionCode === 0;

      if (!paid) {
        console.log(`${prefix} → NOT PAID (orderStatus=${status.orderStatus}, actionCode=${status.actionCode}) — skip`);
        notPaid++;
        await sleep(SATIM_DELAY_MS);
        continue;
      }

      // Find first available bib
      let bibNumber = null;
      for (let b = event.bibStart; b <= event.bibEnd; b++) {
        if (!taken.has(b)) { bibNumber = b; break; }
      }
      if (!bibNumber) {
        console.log(`${prefix} → NO BIB AVAILABLE (range exhausted)`);
        errors++;
        break;
      }

      if (DRY_RUN) {
        console.log(`${prefix} → would assign bib ${bibNumber}`);
        taken.add(bibNumber);
        recovered++;
        await sleep(SATIM_DELAY_MS);
        continue;
      }

      // Update registration
      const cardPan = status.pan ? status.pan.replace(/[^0-9]/g, '').slice(-4) : null;
      await prisma.registration.update({
        where: { id: reg.id },
        data: {
          bibNumber,
          qrToken: uuidv4(),
          paymentStatus: 'success',
          status: 'en_attente',
          paymentMethod: status.pan ? 'CIB' : 'EDAHABIA',
          transactionNumber: status.approvalCode || null,
          approvalCode: status.approvalCode || null,
          paymentAmount: reg.paymentAmount,
          paymentDate: new Date(),
          cardPan,
        },
      });
      taken.add(bibNumber);

      // Send email
      const fullReg = await prisma.registration.findUnique({
        where: { id: reg.id },
        include: { event: { select: { name: true, date: true, location: true, primaryColor: true } } }
      });
      await sendConfirmationEmail(fullReg).catch(err => {
        console.log(`  email error: ${err.message}`);
      });

      console.log(`${prefix} → bib ${bibNumber} assigned + email sent`);
      recovered++;

      await sleep(SATIM_DELAY_MS);
    } catch (err) {
      console.log(`${prefix} → ERROR: ${err.message}`);
      errors++;
      await sleep(SATIM_DELAY_MS);
    }
  }

  console.log('\n=== Summary ===');
  console.log('Total candidates:', stuck.length);
  console.log('Recovered:', recovered);
  console.log('Not paid (skipped):', notPaid);
  console.log('Errors:', errors);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
