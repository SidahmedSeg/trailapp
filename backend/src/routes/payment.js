const { registerPayment, confirmOrder, getOrderStatus } = require('../services/satim');
const { sendConfirmationEmail } = require('../services/sendgrid');
const { getNextBib } = require('../services/bib');
const registrationGuard = require('../middleware/registrationGuard');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

async function paymentRoutes(fastify) {
  const { prisma, redis } = fastify;

  // POST /api/payment/initiate
  fastify.post('/payment/initiate', {
    preHandler: [registrationGuard],
  }, async (request) => {
    const { registrationId, termsAccepted } = request.body || {};

    if (!registrationId) {
      throw new AppError(400, 'registrationId requis', 'VALIDATION_ERROR');
    }
    if (!termsAccepted) {
      throw new AppError(400, 'Vous devez accepter les conditions générales', 'TERMS_REQUIRED');
    }

    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');
    }

    if (registration.paymentStatus === 'success') {
      throw new AppError(400, 'Paiement déjà effectué', 'ALREADY_PAID');
    }
    if (registration.paymentStatus === 'processing') {
      throw new AppError(400, 'Paiement déjà en cours', 'PAYMENT_PROCESSING');
    }

    // Dynamic pricing from registration (computed at register time from event config)
    const paymentAmount = registration.paymentAmount;

    // Update registration to processing
    await prisma.registration.update({
      where: { id: registrationId },
      data: { paymentStatus: 'processing', termsAccepted: true },
    });

    // Register payment with SATIM — 8-char alphanumeric order ID (guaranteed mix of letters + digits)
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = letters + digits;
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    const base = [pick(letters), pick(letters), pick(digits), pick(digits), pick(all), pick(all), pick(all), pick(all)];
    for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
    const orderId = base.join('');
    const returnUrl = `${env.SATIM_CALLBACK_URL}?registrationId=${registrationId}`;
    const failUrl = `${env.APP_URL}/failed?id=${registrationId}`;

    try {
      const satimResult = await registerPayment({
        orderId,
        amount: paymentAmount,
        returnUrl,
        failUrl,
      });

      // Store our order number + SATIM's order ID
      await prisma.registration.update({
        where: { id: registrationId },
        data: {
          transactionId: satimResult.orderId,
          orderNumber: orderId,
        },
      });

      return { satimRedirectUrl: satimResult.formUrl };
    } catch (err) {
      await prisma.registration.update({
        where: { id: registrationId },
        data: { paymentStatus: 'failed' },
      });
      throw new AppError(502, 'Erreur de connexion au service de paiement', 'SATIM_ERROR');
    }
  });

  // GET /api/payment/callback
  fastify.get('/payment/callback', async (request, reply) => {
    const { orderId, registrationId } = request.query;

    if (!orderId || !registrationId) {
      return reply.redirect(`${env.APP_URL}/failed?error=missing_params`);
    }

    // Idempotency check (24h TTL)
    const idempKey = `idempotency:${orderId}`;
    const alreadyProcessed = await redis.set(idempKey, 'processing', 'EX', 86400, 'NX');
    if (!alreadyProcessed) {
      const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
      if (reg?.paymentStatus === 'success') {
        return reply.redirect(`${env.APP_URL}/success?id=${registrationId}`);
      }
      return reply.redirect(`${env.APP_URL}/failed?id=${registrationId}`);
    }

    try {
      // Server-to-server verification
      await confirmOrder(orderId).catch((err) => {
        request.log.warn(err, 'confirmOrder failed (may already be confirmed)');
      });

      const satimStatus = await getOrderStatus(orderId);

      if (satimStatus.orderStatus === 2 && satimStatus.actionCode === 0) {
        // SUCCESS — assign bib and store card info
        const registration = await prisma.registration.findUnique({
          where: { id: registrationId },
          include: { event: true },
        });

        const event = registration.event;
        const bibNumber = await getNextBib(redis, event.id, event.bibEnd);
        const qrToken = uuidv4();

        // Extract last 4 digits of card PAN
        const cardPan = satimStatus.pan ? satimStatus.pan.replace(/\D/g, '').slice(-4) : null;

        // Transaction: update registration + lock bib range
        await prisma.$transaction([
          prisma.registration.update({
            where: { id: registrationId },
            data: {
              bibNumber,
              qrToken,
              paymentStatus: 'success',
              status: 'en_attente',
              paymentMethod: satimStatus.pan ? 'CIB' : 'EDAHABIA',
              transactionNumber: satimStatus.approvalCode || null,
              approvalCode: satimStatus.approvalCode || null,
              paymentAmount: registration.paymentAmount,
              paymentDate: new Date(),
              cardPan,
            },
          }),
          prisma.event.update({
            where: { id: event.id },
            data: { bibRangeLocked: true },
          }),
        ]);

        // Check auto-close on exhaustion
        if (event.autoCloseOnExhaustion) {
          const nextBib = await redis.get(`bib:next:${event.id}`);
          if (parseInt(nextBib, 10) > event.bibEnd) {
            await prisma.event.update({
              where: { id: event.id },
              data: { registrationOpen: false },
            });
            request.log.info('Auto-closed registrations: bibs exhausted');
          }
        }

        // Send confirmation email (async)
        const fullReg = await prisma.registration.findUnique({
          where: { id: registrationId },
          include: { event: { select: { name: true, date: true, location: true, primaryColor: true } } },
        });
        sendConfirmationEmail(fullReg).catch(console.error);

        return reply.redirect(`${env.APP_URL}/success?id=${registrationId}`);
      } else {
        // FAILURE
        await prisma.registration.update({
          where: { id: registrationId },
          data: { paymentStatus: 'failed' },
        });

        const reason = encodeURIComponent(
          satimStatus.actionCodeDescription || satimStatus.errorMessage || `Code erreur: ${satimStatus.actionCode || satimStatus.errorCode || 'inconnu'}`
        );
        return reply.redirect(`${env.APP_URL}/failed?id=${registrationId}&reason=${reason}`);
      }
    } catch (err) {
      request.log.error(err, 'Payment callback error');
      return reply.redirect(`${env.APP_URL}/failed?id=${registrationId}&error=internal`);
    }
  });

  // Cleanup job: mark stale "processing" as "failed" after 30 min
  const CLEANUP_INTERVAL = 10 * 60 * 1000;
  const STALE_THRESHOLD = 30 * 60 * 1000;

  const cleanupJob = setInterval(async () => {
    try {
      const threshold = new Date(Date.now() - STALE_THRESHOLD);
      const result = await prisma.registration.updateMany({
        where: {
          paymentStatus: 'processing',
          updatedAt: { lt: threshold },
        },
        data: { paymentStatus: 'failed' },
      });
      if (result.count > 0) {
        fastify.log.info(`Cleanup: marked ${result.count} stale processing payments as failed`);
      }
    } catch (err) {
      fastify.log.error(err, 'Cleanup job error');
    }
  }, CLEANUP_INTERVAL);

  fastify.addHook('onClose', () => clearInterval(cleanupJob));
}

module.exports = paymentRoutes;
