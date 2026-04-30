/**
 * Reconciliation routes — admin tooling to register paid orphans
 * (runners who paid SATIM but never made it to the Coureurs list)
 * without requiring a second payment.
 */

const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');
const env = require('../config/env');
const { parseSatimWorkbook, pickGapFirstBib } = require('../services/reconciliation');
const { sendConfirmationEmail, sendReconciliationInvitation } = require('../services/sendgrid');
const { validateRegistration, validateOptionalFields, buildE164 } = require('../schemas/registration');

const TOKEN_TTL_DAYS = 7;
const RECONCILIATION_ROLES = ['super_admin', 'reconciliation_specialist'];

function buildReconciliationLink(token, request) {
  // Prefer the admin's actual browser origin (so links generated locally point to
  // localhost, on staging point to staging, etc). Fall back to env.APP_URL.
  let base = '';
  const origin = request?.headers?.origin;
  if (origin && /^https?:\/\//.test(origin)) {
    base = origin;
  } else {
    const referer = request?.headers?.referer;
    if (referer) {
      try { base = new URL(referer).origin; } catch { /* ignore */ }
    }
  }
  if (!base) base = env.APP_URL || '';
  return `${base.replace(/\/$/, '')}/reconciliation/${token}`;
}

async function reconciliationRoutes(fastify) {
  const { prisma } = fastify;

  // ────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS (auth-gated)
  // ────────────────────────────────────────────────────────────────────

  // POST /api/admin/reconciliation/upload
  // Multipart: file (.xlsx/.xls/.csv) + eventId
  fastify.post(
    '/admin/reconciliation/upload',
    { preHandler: [authenticate, authorize(...RECONCILIATION_ROLES)] },
    async (request) => {
      const parts = request.parts();
      let buffer = null;
      let eventId = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks = [];
          for await (const chunk of part.file) chunks.push(chunk);
          buffer = Buffer.concat(chunks);
        } else if (part.fieldname === 'eventId') {
          eventId = String(part.value);
        }
      }

      if (!eventId) throw new AppError(400, 'eventId requis', 'VALIDATION_ERROR');
      if (!buffer) throw new AppError(400, 'Fichier requis', 'VALIDATION_ERROR');

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) throw new AppError(404, 'Événement introuvable', 'NOT_FOUND');

      let parsed;
      try {
        parsed = parseSatimWorkbook(buffer);
      } catch (err) {
        throw new AppError(400, `Erreur d'analyse du fichier: ${err.message}`, 'PARSE_ERROR');
      }

      let inserted = 0;
      let duplicates = 0;
      const errors = [];

      for (const row of parsed.rows) {
        try {
          await prisma.satimReconciliation.create({
            data: {
              eventId,
              paymentStatus: row.paymentStatus,
              orderNumber: row.orderNumber,
              paymentDate: row.paymentDate,
              depositDate: row.depositDate,
              approvedAmount: row.approvedAmount || 0,
              cardholderName: row.cardholderName,
              cardPan: row.cardPan,
              uploadedBy: request.user.username,
            },
          });
          inserted++;
        } catch (err) {
          if (err.code === 'P2002') {
            duplicates++;
          } else {
            errors.push({ orderNumber: row.orderNumber, error: err.message });
          }
        }
      }

      await logActivity({
        action: 'reconciliation_uploaded',
        adminUsername: request.user.username,
        targetType: 'satim_reconciliation',
        targetId: null,
        details: {
          eventId,
          parsed: parsed.parsed,
          skipped: parsed.skipped,
          inserted,
          duplicates,
          errorCount: errors.length,
        },
      });

      return {
        parsed: parsed.parsed,
        kept: parsed.rows.length,
        skipped: parsed.skipped,
        inserted,
        duplicates,
        errors,
      };
    }
  );

  // GET /api/admin/reconciliation?eventId=X&tab=satim|validations
  fastify.get(
    '/admin/reconciliation',
    { preHandler: [authenticate, authorize(...RECONCILIATION_ROLES)] },
    async (request) => {
      const { eventId, tab = 'satim' } = request.query;
      if (!eventId) throw new AppError(400, 'eventId requis', 'VALIDATION_ERROR');

      const where = { eventId };
      if (tab === 'satim') {
        where.status = { in: ['pending', 'link_generated', 'expired', 'cancelled'] };
      } else if (tab === 'validations') {
        where.status = { in: ['submitted_matched', 'submitted_unmatched'] };
      }

      const rows = await prisma.satimReconciliation.findMany({
        where,
        include: {
          registration: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              bibNumber: true,
              paymentStatus: true,
              cardPan: true,
              createdAt: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      return rows;
    }
  );

  // GET /api/admin/reconciliation/:id — full detail of one row
  fastify.get(
    '/admin/reconciliation/:id',
    { preHandler: [authenticate, authorize(...RECONCILIATION_ROLES)] },
    async (request) => {
      const row = await prisma.satimReconciliation.findUnique({
        where: { id: request.params.id },
        include: { registration: true, event: { select: { name: true, bibStart: true, bibEnd: true } } },
      });
      if (!row) throw new AppError(404, 'Ligne introuvable', 'NOT_FOUND');
      return row;
    }
  );

  // POST /api/admin/reconciliation/:id/generate-link
  // Creates a fresh token (invalidates any previous one).
  fastify.post(
    '/admin/reconciliation/:id/generate-link',
    { preHandler: [authenticate, authorize(...RECONCILIATION_ROLES)] },
    async (request) => {
      const row = await prisma.satimReconciliation.findUnique({ where: { id: request.params.id } });
      if (!row) throw new AppError(404, 'Ligne introuvable', 'NOT_FOUND');
      if (['submitted_matched', 'submitted_unmatched'].includes(row.status)) {
        throw new AppError(409, 'Inscription déjà soumise', 'ALREADY_SUBMITTED');
      }

      const token = uuidv4();
      const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

      const updated = await prisma.satimReconciliation.update({
        where: { id: row.id },
        data: { linkToken: token, linkExpiresAt: expires, status: 'link_generated' },
      });

      await logActivity({
        action: 'reconciliation_link_generated',
        adminUsername: request.user.username,
        targetType: 'satim_reconciliation',
        targetId: row.id,
        details: { orderNumber: row.orderNumber, expiresAt: expires.toISOString() },
      });

      return {
        token,
        link: buildReconciliationLink(token, request),
        expiresAt: expires.toISOString(),
        status: updated.status,
      };
    }
  );

  // POST /api/admin/reconciliation/:id/send-email
  // Body: { email }
  fastify.post(
    '/admin/reconciliation/:id/send-email',
    { preHandler: [authenticate, authorize(...RECONCILIATION_ROLES)] },
    async (request) => {
      const { email } = request.body || {};
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new AppError(400, 'Email invalide', 'VALIDATION_ERROR');
      }

      const row = await prisma.satimReconciliation.findUnique({
        where: { id: request.params.id },
        include: { event: { select: { name: true } } },
      });
      if (!row) throw new AppError(404, 'Ligne introuvable', 'NOT_FOUND');
      if (['submitted_matched', 'submitted_unmatched'].includes(row.status)) {
        throw new AppError(409, 'Inscription déjà soumise', 'ALREADY_SUBMITTED');
      }

      // Generate a fresh token if missing or expired
      let token = row.linkToken;
      let expires = row.linkExpiresAt;
      if (!token || !expires || expires < new Date()) {
        token = uuidv4();
        expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
        await prisma.satimReconciliation.update({
          where: { id: row.id },
          data: { linkToken: token, linkExpiresAt: expires, status: 'link_generated' },
        });
      }

      const link = buildReconciliationLink(token, request);
      await sendReconciliationInvitation({
        toEmail: email,
        cardholderName: row.cardholderName,
        cardPan: row.cardPan,
        eventName: row.event?.name,
        link,
        expiresAt: expires,
      });

      await prisma.satimReconciliation.update({
        where: { id: row.id },
        data: { linkSentToEmail: email, linkSentAt: new Date() },
      });

      await logActivity({
        action: 'reconciliation_link_sent',
        adminUsername: request.user.username,
        targetType: 'satim_reconciliation',
        targetId: row.id,
        details: { orderNumber: row.orderNumber, email },
      });

      return { sent: true, link, expiresAt: expires.toISOString() };
    }
  );

  // POST /api/admin/reconciliation/:id/cancel
  fastify.post(
    '/admin/reconciliation/:id/cancel',
    { preHandler: [authenticate, authorize(...RECONCILIATION_ROLES)] },
    async (request) => {
      const row = await prisma.satimReconciliation.findUnique({ where: { id: request.params.id } });
      if (!row) throw new AppError(404, 'Ligne introuvable', 'NOT_FOUND');
      if (['submitted_matched', 'submitted_unmatched'].includes(row.status)) {
        throw new AppError(409, 'Inscription déjà soumise — impossible d\'annuler', 'ALREADY_SUBMITTED');
      }

      await prisma.satimReconciliation.update({
        where: { id: row.id },
        data: { status: 'cancelled', linkToken: null, linkExpiresAt: null },
      });

      await logActivity({
        action: 'reconciliation_cancelled',
        adminUsername: request.user.username,
        targetType: 'satim_reconciliation',
        targetId: row.id,
        details: { orderNumber: row.orderNumber },
      });

      return { cancelled: true };
    }
  );

  // ────────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS (token-gated, no auth)
  // ────────────────────────────────────────────────────────────────────

  // GET /api/reconciliation/:token — validate token, return form metadata
  fastify.get('/reconciliation/:token', async (request) => {
    const row = await prisma.satimReconciliation.findUnique({
      where: { linkToken: request.params.token },
      include: { event: true },
    });
    if (!row) throw new AppError(404, 'Lien introuvable ou invalide', 'TOKEN_NOT_FOUND');
    if (row.status !== 'link_generated') {
      throw new AppError(410, 'Ce lien a déjà été utilisé', 'TOKEN_USED');
    }
    if (!row.linkExpiresAt || row.linkExpiresAt < new Date()) {
      throw new AppError(410, 'Ce lien a expiré', 'TOKEN_EXPIRED');
    }

    return {
      cardholderName: row.cardholderName,
      cardPan: row.cardPan,
      orderNumber: row.orderNumber,
      paymentDate: row.paymentDate,
      event: {
        id: row.event.id,
        name: row.event.name,
        slug: row.event.slug,
        date: row.event.date,
        location: row.event.location,
        primaryColor: row.event.primaryColor,
        logoPath: row.event.logoPath,
        coverImagePath: row.event.coverImagePath,
        distances: row.event.distances,
        runnerLevels: row.event.runnerLevels,
        optionalFields: row.event.optionalFields,
        photoPackPrice: row.event.photoPackPrice,
        priceInCentimes: row.event.priceInCentimes,
        contactEmail: row.event.contactEmail,
        contactPhone: row.event.contactPhone,
        contactLabel: row.event.contactLabel,
      },
      expiresAt: row.linkExpiresAt,
    };
  });

  // POST /api/reconciliation/:token/register — submit form, run match check
  fastify.post('/reconciliation/:token/register', async (request) => {
    const body = request.body || {};
    const enteredCardPan = String(body.enteredCardPan || '').replace(/\D/g, '').slice(-4);
    if (!enteredCardPan || enteredCardPan.length !== 4) {
      throw new AppError(400, 'Card PAN requis (4 chiffres)', 'VALIDATION_ERROR');
    }

    const row = await prisma.satimReconciliation.findUnique({
      where: { linkToken: request.params.token },
      include: { event: true },
    });
    if (!row) throw new AppError(404, 'Lien introuvable', 'TOKEN_NOT_FOUND');
    if (row.status !== 'link_generated') {
      throw new AppError(410, 'Ce lien a déjà été utilisé', 'TOKEN_USED');
    }
    if (!row.linkExpiresAt || row.linkExpiresAt < new Date()) {
      throw new AppError(410, 'Ce lien a expiré', 'TOKEN_EXPIRED');
    }

    const event = row.event;

    // Validate base + optional fields (same rules as the public form)
    const errors = validateRegistration(body, event.runnerLevels);
    if (errors.length > 0) throw new AppError(400, 'Erreurs de validation', 'VALIDATION_ERROR');
    const optErrors = validateOptionalFields(body, event.optionalFields, event.distances);
    if (optErrors.length > 0) throw new AppError(400, optErrors[0].message, 'VALIDATION_ERROR');

    const emailLower = body.email.toLowerCase().trim();
    const phone = buildE164(body.phoneCountryCode, body.phoneNumber);
    const emergencyPhone = buildE164(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber);

    // Optional fields
    const of = event.optionalFields || {};
    const optionalData = {};
    if (of.distance && of.distance !== 'off' && body.selectedDistance) optionalData.selectedDistance = body.selectedDistance;
    if (of.club && of.club !== 'off' && body.club) optionalData.club = body.club.trim();
    if (of.licenseNumber && of.licenseNumber !== 'off' && body.licenseNumber) optionalData.licenseNumber = body.licenseNumber.trim();
    if (of.bestPerformance && of.bestPerformance !== 'off' && body.bestPerformance) optionalData.bestPerformance = body.bestPerformance;
    if (of.previousParticipations && of.previousParticipations !== 'off' && body.previousParticipations != null) {
      optionalData.previousParticipations = parseInt(body.previousParticipations, 10);
    }
    if (of.shuttle && of.shuttle !== 'off' && body.shuttle != null) optionalData.shuttle = Boolean(body.shuttle);
    if (of.bloodType && of.bloodType !== 'off' && body.bloodType) optionalData.bloodType = body.bloodType;
    if (of.photoPack && of.photoPack !== 'off' && body.photoPack != null) optionalData.photoPack = Boolean(body.photoPack);

    // Match decision
    const isMatch = enteredCardPan === row.cardPan;

    let bibNumber = null;
    let qrToken = null;
    let paymentStatus = 'pending';
    if (isMatch) {
      bibNumber = await pickGapFirstBib(prisma, event);
      if (bibNumber === null) throw new AppError(409, 'Aucun dossard disponible', 'BIB_EXHAUSTED');
      qrToken = uuidv4();
      paymentStatus = 'manual';
    }

    // Build registration row
    const registrationData = {
      eventId: event.id,
      lastName: body.lastName.trim(),
      firstName: body.firstName.trim(),
      birthDate: new Date(body.birthDate),
      gender: body.gender,
      nationality: body.nationality,
      phoneCountryCode: body.phoneCountryCode,
      phoneNumber: body.phoneNumber,
      phone,
      email: emailLower,
      countryOfResidence: body.countryOfResidence,
      wilaya: body.wilaya || null,
      commune: body.commune || null,
      ville: body.ville || null,
      emergencyPhoneCountryCode: body.emergencyPhoneCountryCode,
      emergencyPhoneNumber: body.emergencyPhoneNumber,
      emergencyPhone,
      tshirtSize: body.tshirtSize,
      runnerLevel: body.runnerLevel,
      declarationFit: !!body.declarationFit,
      declarationRules: !!body.declarationRules,
      declarationImage: !!body.declarationImage,
      termsAccepted: true,
      bibNumber,
      qrToken,
      paymentStatus,
      paymentMethod: 'reconciliation',
      orderNumber: row.orderNumber,
      transactionId: null, // SATIM transactionId may not be in our row; preserve if present
      approvalCode: null,
      paymentAmount: row.approvedAmount || event.priceInCentimes,
      paymentDate: row.paymentDate || new Date(),
      cardPan: row.cardPan,
      source: 'reconciliation',
      ...optionalData,
    };

    // Atomic-enough: create registration, link, mark token consumed
    let registration;
    try {
      registration = await prisma.registration.create({ data: registrationData });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError(409, 'Un coureur existe déjà avec ces informations', 'DUPLICATE');
      }
      throw err;
    }

    const newStatus = isMatch ? 'submitted_matched' : 'submitted_unmatched';
    await prisma.satimReconciliation.update({
      where: { id: row.id },
      data: {
        status: newStatus,
        registrationId: registration.id,
        enteredCardPan,
        // consume token
        linkToken: null,
        linkExpiresAt: null,
      },
    });

    await logActivity({
      action: isMatch ? 'reconciliation_submitted_matched' : 'reconciliation_submitted_unmatched',
      adminUsername: 'public',
      targetType: 'satim_reconciliation',
      targetId: row.id,
      details: {
        orderNumber: row.orderNumber,
        cardPanExpected: row.cardPan,
        cardPanEntered: enteredCardPan,
        registrationId: registration.id,
        bibNumber: registration.bibNumber,
      },
    });

    // Send confirmation email + PDF only on match
    if (isMatch) {
      const fullReg = await prisma.registration.findUnique({
        where: { id: registration.id },
        include: { event: { select: { name: true, date: true, location: true, primaryColor: true } } },
      });
      sendConfirmationEmail(fullReg).catch((err) => {
        console.error('Reconciliation confirmation email failed:', err.message);
      });
    }

    return {
      matched: isMatch,
      registrationId: registration.id,
      bibNumber: registration.bibNumber,
      message: isMatch
        ? 'Inscription validée. Vous allez recevoir un email de confirmation avec votre dossard.'
        : 'Inscription enregistrée. Notre équipe vous contactera pour finaliser la vérification de votre paiement.',
    };
  });
}

module.exports = reconciliationRoutes;
