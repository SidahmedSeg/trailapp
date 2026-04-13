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

    // TODO: Verify reCAPTCHA in production

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

    // Get next bib number (new bib even on retry — old one becomes a gap)
    const bibNumber = await getNextBib(redis, request.settings.bibEnd);

    // Reserve bib in Redis (TTL 15 min)
    await redis.set(
      `bib:reservation:${registrationId}`,
      bibNumber,
      'EX',
      env.BIB_RESERVATION_TTL_SECONDS
    );

    // Update registration to processing
    await prisma.registration.update({
      where: { id: registrationId },
      data: { paymentStatus: 'processing', termsAccepted: true },
    });

    // Register payment with SATIM
    const orderId = `TM-${Date.now()}-${registrationId.substring(0, 8)}`;
    const returnUrl = `${env.SATIM_CALLBACK_URL}?registrationId=${registrationId}`;
    const failUrl = `${env.APP_URL}/failed?id=${registrationId}`;

    try {
      const satimResult = await registerPayment({
        orderId,
        amount: env.PAYMENT_AMOUNT_CENTIMES,
        returnUrl,
        failUrl,
      });

      // Store SATIM order ID
      await prisma.registration.update({
        where: { id: registrationId },
        data: { transactionId: satimResult.orderId },
      });

      return { satimRedirectUrl: satimResult.formUrl };
    } catch (err) {
      // Roll back to failed if SATIM registration fails
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
      // Already processed — redirect to success page
      const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
      if (reg?.paymentStatus === 'success') {
        return reply.redirect(`${env.APP_URL}/success?id=${registrationId}`);
      }
      return reply.redirect(`${env.APP_URL}/failed?id=${registrationId}`);
    }

    try {
      // IMPORTANT: Never trust query params — call SATIM server-to-server
      // Step 1: Confirm the order (triggers capture)
      await confirmOrder(orderId).catch((err) => {
        request.log.warn(err, 'confirmOrder failed (may already be confirmed)');
      });

      // Step 2: Get actual payment status
      const satimStatus = await getOrderStatus(orderId);

      if (satimStatus.orderStatus === 2 && satimStatus.actionCode === 0) {
        // SUCCESS
        const reservedBib = await redis.get(`bib:reservation:${registrationId}`);
        const bibNumber = reservedBib ? parseInt(reservedBib, 10) : null;

        if (!bibNumber) {
          request.log.error(`No bib reservation found for ${registrationId}`);
          return reply.redirect(`${env.APP_URL}/failed?id=${registrationId}&error=no_bib`);
        }

        const qrToken = uuidv4();

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
              paymentAmount: env.PAYMENT_AMOUNT_CENTIMES,
              paymentDate: new Date(),
            },
          }),
          prisma.settings.update({
            where: { id: 'default' },
            data: { bibRangeLocked: true },
          }),
        ]);

        // Clean up reservation
        await redis.del(`bib:reservation:${registrationId}`);

        // Check auto-close on exhaustion
        const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
        if (settings.autoCloseOnExhaustion) {
          const nextBib = await redis.get('bib:next');
          if (parseInt(nextBib, 10) > settings.bibEnd) {
            await prisma.settings.update({
              where: { id: 'default' },
              data: { registrationOpen: false },
            });
            request.log.info('Auto-closed registrations: bibs exhausted');
          }
        }

        // Send confirmation email (async, don't block redirect)
        const fullReg = await prisma.registration.findUnique({ where: { id: registrationId } });
        sendConfirmationEmail(fullReg).catch(console.error);

        return reply.redirect(`${env.APP_URL}/success?id=${registrationId}`);
      } else {
        // FAILURE
        await redis.del(`bib:reservation:${registrationId}`);
        // Do NOT DECR bib:next — accept the gap

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
  const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes

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
