/**
 * Late Registration routes — admin-issued links with a pre-reserved bib.
 *
 * Admin picks a gap bib + generates a single-use link (7-day expiry).
 * Public runner clicks the link → fills the same form as normal registration →
 * pays via SATIM → bib (the one admin reserved) is assigned on payment success.
 *
 * Bib eligibility: only "gaps" (holes inside [bibStart..maxAssigned]) are
 * pickable. Sequential tail bibs are excluded so Redis INCR (used by normal
 * registration) can't collide.
 */

const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');
const env = require('../config/env');
const { registerPayment } = require('../services/satim');
const { sendLateRegistrationInvitation } = require('../services/sendgrid');
const { validateRegistration, validateOptionalFields, buildE164 } = require('../schemas/registration');

const TOKEN_TTL_DAYS = 7;
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min — same as normal flow
const LATE_REG_ROLES = ['super_admin', 'reconciliation_specialist'];

function buildLateRegisterLink(token, request) {
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
  return `${base.replace(/\/$/, '')}/late-register/${token}`;
}

// Compute the gap bibs for an event (holes in [bibStart..maxAssigned]).
// Mirrors the logic in events.js bib-stats endpoint.
async function computeGapBibs(prisma, event) {
  const taken = new Set(
    (await prisma.registration.findMany({
      where: { eventId: event.id, bibNumber: { gte: event.bibStart, lte: event.bibEnd } },
      select: { bibNumber: true },
    })).map(r => r.bibNumber)
  );
  if (taken.size === 0) return [];
  let maxAssigned = -Infinity;
  for (const b of taken) if (b > maxAssigned) maxAssigned = b;
  const gaps = [];
  for (let b = event.bibStart; b <= maxAssigned; b++) {
    if (!taken.has(b)) gaps.push(b);
  }
  return gaps;
}

async function lateRegistrationRoutes(fastify) {
  const { prisma } = fastify;

  // ────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ────────────────────────────────────────────────────────────────────

  // GET /api/admin/late-registration?eventId=&status=
  fastify.get(
    '/admin/late-registration',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const { eventId, status } = request.query;
      if (!eventId) throw new AppError(400, 'eventId requis', 'VALIDATION_ERROR');

      const where = { eventId };
      if (status && status !== 'all') {
        where.status = status;
      }

      const rows = await prisma.lateRegistrationLink.findMany({
        where,
        include: {
          registration: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              paymentStatus: true,
              bibNumber: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return rows;
    }
  );

  // GET /api/admin/late-registration/eligible-bibs?eventId=
  // Returns gap bibs minus those already reserved by another pending link.
  fastify.get(
    '/admin/late-registration/eligible-bibs',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const { eventId } = request.query;
      if (!eventId) throw new AppError(400, 'eventId requis', 'VALIDATION_ERROR');

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) throw new AppError(404, 'Événement introuvable', 'NOT_FOUND');

      const gaps = await computeGapBibs(prisma, event);

      const reserved = await prisma.lateRegistrationLink.findMany({
        where: { eventId, status: 'pending' },
        select: { bibNumber: true },
      });
      const reservedSet = new Set(reserved.map(r => r.bibNumber));

      const eligible = gaps.filter(b => !reservedSet.has(b));
      return {
        eligible,
        totalGaps: gaps.length,
        reservedCount: reservedSet.size,
        bibStart: event.bibStart,
        bibEnd: event.bibEnd,
      };
    }
  );

  // POST /api/admin/late-registration
  // Body: { eventId, bibNumber }
  fastify.post(
    '/admin/late-registration',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const { eventId, bibNumber } = request.body || {};
      if (!eventId) throw new AppError(400, 'eventId requis', 'VALIDATION_ERROR');
      if (!Number.isInteger(bibNumber)) {
        throw new AppError(400, 'bibNumber invalide', 'VALIDATION_ERROR');
      }

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) throw new AppError(404, 'Événement introuvable', 'NOT_FOUND');

      // (a) Bib must be in the auto range
      if (bibNumber < event.bibStart || bibNumber > event.bibEnd) {
        throw new AppError(400,
          `Le dossard doit être dans la plage automatique (${event.bibStart}-${event.bibEnd})`,
          'BIB_OUT_OF_AUTO_RANGE'
        );
      }

      // (b) Bib must be a gap (not currently assigned)
      const taken = await prisma.registration.findFirst({
        where: { eventId, bibNumber },
        select: { id: true },
      });
      if (taken) {
        throw new AppError(409, 'Ce dossard est déjà attribué à un coureur', 'BIB_TAKEN');
      }

      // (c) Bib must be in the gaps list (not in the sequential tail)
      const gaps = await computeGapBibs(prisma, event);
      if (!gaps.includes(bibNumber)) {
        throw new AppError(400,
          'Ce dossard n\'est pas un trou dans la séquence — seuls les trous sont éligibles à l\'inscription tardive',
          'BIB_NOT_GAP'
        );
      }

      // (d) No existing pending reservation for this bib
      const existing = await prisma.lateRegistrationLink.findFirst({
        where: { eventId, bibNumber, status: 'pending' },
      });
      if (existing) {
        throw new AppError(409, 'Un lien actif existe déjà pour ce dossard', 'BIB_ALREADY_RESERVED');
      }

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

      const link = await prisma.lateRegistrationLink.create({
        data: {
          eventId,
          bibNumber,
          token,
          expiresAt,
          status: 'pending',
          createdBy: request.user.username,
        },
      });

      await logActivity({
        action: 'late_registration_link_created',
        adminUsername: request.user.username,
        targetType: 'late_registration_link',
        targetId: link.id,
        details: { bibNumber, eventId, expiresAt: expiresAt.toISOString() },
      });

      return {
        id: link.id,
        token,
        link: buildLateRegisterLink(token, request),
        expiresAt: expiresAt.toISOString(),
        bibNumber,
      };
    }
  );

  // POST /api/admin/late-registration/:id/send-email
  // Body: { email }
  fastify.post(
    '/admin/late-registration/:id/send-email',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const { email } = request.body || {};
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new AppError(400, 'Email invalide', 'VALIDATION_ERROR');
      }

      const row = await prisma.lateRegistrationLink.findUnique({
        where: { id: request.params.id },
        include: { event: { select: { name: true } } },
      });
      if (!row) throw new AppError(404, 'Lien introuvable', 'NOT_FOUND');
      if (row.status !== 'pending') {
        throw new AppError(409, 'Ce lien n\'est plus actif', 'NOT_PENDING');
      }

      // Refresh token if missing or expired
      let token = row.token;
      let expiresAt = row.expiresAt;
      if (!token || !expiresAt || expiresAt < new Date()) {
        token = uuidv4();
        expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
        await prisma.lateRegistrationLink.update({
          where: { id: row.id },
          data: { token, expiresAt },
        });
      }

      const link = buildLateRegisterLink(token, request);

      try {
        await sendLateRegistrationInvitation({
          toEmail: email,
          eventName: row.event?.name || 'Événement',
          bibNumber: row.bibNumber,
          link,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (err) {
        request.log.error(err, 'Late registration invitation email failed');
        throw new AppError(502, 'Erreur lors de l\'envoi de l\'email', 'EMAIL_FAILED');
      }

      await prisma.lateRegistrationLink.update({
        where: { id: row.id },
        data: { sentToEmail: email, sentAt: new Date() },
      });

      await logActivity({
        action: 'late_registration_link_sent',
        adminUsername: request.user.username,
        targetType: 'late_registration_link',
        targetId: row.id,
        details: { email, bibNumber: row.bibNumber },
      });

      return { sent: true, sentToEmail: email };
    }
  );

  // POST /api/admin/late-registration/:id/cancel
  fastify.post(
    '/admin/late-registration/:id/cancel',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const row = await prisma.lateRegistrationLink.findUnique({
        where: { id: request.params.id },
      });
      if (!row) throw new AppError(404, 'Lien introuvable', 'NOT_FOUND');
      if (row.status !== 'pending') {
        throw new AppError(409, 'Seuls les liens en attente peuvent être annulés', 'NOT_PENDING');
      }

      await prisma.lateRegistrationLink.update({
        where: { id: row.id },
        // We keep the token string but flip status to 'cancelled' — the GET
        // handler rejects any non-pending status, so the link is dead.
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      await logActivity({
        action: 'late_registration_link_cancelled',
        adminUsername: request.user.username,
        targetType: 'late_registration_link',
        targetId: row.id,
        details: { bibNumber: row.bibNumber, eventId: row.eventId },
      });

      return { cancelled: true };
    }
  );

  // POST /api/admin/late-registration/:id/regenerate
  // Allowed when status is expired/cancelled/used (with linked failed registration).
  fastify.post(
    '/admin/late-registration/:id/regenerate',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const row = await prisma.lateRegistrationLink.findUnique({
        where: { id: request.params.id },
        include: { registration: { select: { paymentStatus: true } } },
      });
      if (!row) throw new AppError(404, 'Lien introuvable', 'NOT_FOUND');

      // If used + linked registration was successful, refuse — runner already paid.
      if (row.status === 'used') {
        const ps = row.registration?.paymentStatus;
        if (ps === 'success' || ps === 'manual') {
          throw new AppError(409, 'Ce coureur a déjà payé — pas besoin de régénérer', 'ALREADY_PAID');
        }
      }
      if (row.status === 'pending') {
        throw new AppError(409, 'Ce lien est déjà actif', 'ALREADY_PENDING');
      }

      // Verify the bib is still free (not assigned to another runner now)
      const taken = await prisma.registration.findFirst({
        where: { eventId: row.eventId, bibNumber: row.bibNumber, paymentStatus: { in: ['success', 'manual'] } },
        select: { id: true },
      });
      if (taken) {
        throw new AppError(409, 'Ce dossard est désormais attribué à un coureur — choisissez un autre dossard', 'BIB_TAKEN');
      }

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

      // Reset to pending; clear linkage to any prior failed registration
      const updated = await prisma.lateRegistrationLink.update({
        where: { id: row.id },
        data: {
          status: 'pending',
          token,
          expiresAt,
          cancelledAt: null,
          usedAt: null,
          registrationId: null,
        },
      });

      await logActivity({
        action: 'late_registration_link_regenerated',
        adminUsername: request.user.username,
        targetType: 'late_registration_link',
        targetId: row.id,
        details: { bibNumber: row.bibNumber, eventId: row.eventId },
      });

      return {
        id: updated.id,
        token,
        link: buildLateRegisterLink(token, request),
        expiresAt: expiresAt.toISOString(),
        bibNumber: updated.bibNumber,
      };
    }
  );

  // POST /api/admin/late-registration/:id/delete
  // Removes a terminal-state link from the list. Snapshots to ActivityLog first.
  // Only allowed for cancelled / expired / released, or used+failed.
  fastify.post(
    '/admin/late-registration/:id/delete',
    { preHandler: [authenticate, authorize(...LATE_REG_ROLES)] },
    async (request) => {
      const row = await prisma.lateRegistrationLink.findUnique({
        where: { id: request.params.id },
        include: { registration: { select: { paymentStatus: true } } },
      });
      if (!row) throw new AppError(404, 'Lien introuvable', 'NOT_FOUND');

      const ps = row.registration?.paymentStatus;
      const terminal =
        row.status === 'cancelled' ||
        row.status === 'expired' ||
        row.status === 'released' ||
        (row.status === 'used' && ps && ps !== 'success' && ps !== 'manual');

      if (!terminal) {
        throw new AppError(409,
          'Seuls les liens annulés, expirés, libérés ou abandonnés peuvent être supprimés',
          'NOT_TERMINAL'
        );
      }

      await logActivity({
        action: 'late_registration_link_deleted',
        adminUsername: request.user.username,
        targetType: 'late_registration_link',
        targetId: row.id,
        details: {
          bibNumber: row.bibNumber,
          eventId: row.eventId,
          previousStatus: row.status,
          linkedPaymentStatus: ps || null,
          createdBy: row.createdBy,
          sentToEmail: row.sentToEmail,
        },
      });

      await prisma.lateRegistrationLink.delete({ where: { id: row.id } });

      return { deleted: true };
    }
  );

  // ────────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS (no auth, gated by token)
  // ────────────────────────────────────────────────────────────────────

  // GET /api/late-registration/:token
  // Returns the event + reserved bib for the runner-facing form.
  fastify.get('/late-registration/:token', async (request) => {
    const row = await prisma.lateRegistrationLink.findUnique({
      where: { token: request.params.token },
      include: { event: true },
    });
    if (!row) throw new AppError(404, 'Lien introuvable', 'INVALID_TOKEN');

    if (row.status === 'cancelled') {
      throw new AppError(410, 'Ce lien a été annulé', 'LINK_CANCELLED');
    }
    if (row.status === 'expired' || row.expiresAt < new Date()) {
      // Auto-flip to expired if time elapsed but status not yet updated
      if (row.status === 'pending') {
        await prisma.lateRegistrationLink.update({
          where: { id: row.id },
          data: { status: 'expired' },
        });
      }
      throw new AppError(410, 'Ce lien a expiré', 'LINK_EXPIRED');
    }
    if (row.status === 'used') {
      throw new AppError(410, 'Ce lien a déjà été utilisé', 'LINK_USED');
    }

    // Sanitize event payload (mirror /api/settings/public shape)
    const event = row.event;
    return {
      bibNumber: row.bibNumber,
      expiresAt: row.expiresAt.toISOString(),
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        type: event.type,
        date: event.date,
        location: event.location,
        primaryColor: event.primaryColor,
        logoPath: event.logoPath,
        coverImagePath: event.coverImagePath,
        distances: event.distances,
        runnerLevels: event.runnerLevels,
        priceInCentimes: event.priceInCentimes,
        photoPackPrice: event.photoPackPrice,
        optionalFields: event.optionalFields,
        contactEmail: event.contactEmail,
        contactPhone: event.contactPhone,
        contactLabel: event.contactLabel,
        termsText: event.termsText,
      },
    };
  });

  // POST /api/late-registration/:token/register
  // Body: same shape as POST /api/register
  fastify.post('/late-registration/:token/register', async (request) => {
    const body = request.body || {};

    const row = await prisma.lateRegistrationLink.findUnique({
      where: { token: request.params.token },
      include: { event: true },
    });
    if (!row) throw new AppError(404, 'Lien introuvable', 'INVALID_TOKEN');
    if (row.status === 'cancelled') throw new AppError(410, 'Ce lien a été annulé', 'LINK_CANCELLED');
    if (row.status === 'used') throw new AppError(410, 'Ce lien a déjà été utilisé', 'LINK_USED');
    if (row.expiresAt < new Date()) {
      await prisma.lateRegistrationLink.update({
        where: { id: row.id },
        data: { status: 'expired' },
      });
      throw new AppError(410, 'Ce lien a expiré', 'LINK_EXPIRED');
    }

    const event = row.event;

    // Same validation as normal registration
    const errors = validateRegistration(body, event.runnerLevels);
    if (errors.length > 0) {
      throw new AppError(400, errors[0].message, 'VALIDATION_ERROR');
    }
    const optErrors = validateOptionalFields(body, event.optionalFields, event.distances);
    if (optErrors.length > 0) {
      throw new AppError(400, optErrors[0].message, 'VALIDATION_ERROR');
    }

    const emailLower = body.email.toLowerCase().trim();

    // Block if same email already has success/manual on this event
    const existingSuccess = await prisma.registration.findFirst({
      where: {
        email: emailLower,
        eventId: event.id,
        paymentStatus: { in: ['success', 'manual'] },
      },
    });
    if (existingSuccess) {
      throw new AppError(409, 'Cet email est déjà inscrit à cet événement', 'EMAIL_TAKEN');
    }

    // Block live in-flight SATIM payment (< 30 min old)
    const processingReg = await prisma.registration.findFirst({
      where: {
        email: emailLower,
        eventId: event.id,
        paymentStatus: 'processing',
        updatedAt: { gt: new Date(Date.now() - STALE_THRESHOLD_MS) },
      },
    });
    if (processingReg) {
      throw new AppError(409, 'Un paiement est déjà en cours pour cet email', 'PAYMENT_PROCESSING');
    }

    // Snapshot + purge any previous pending/failed/stale-processing rows on this
    // email+event pair. Mirrors the normal /api/register flow so the @@unique
    // ([email, eventId]) constraint doesn't trip the create below. ActivityLog
    // snapshot first preserves forensic data (hard-delete-audit pattern).
    const purgeWhere = {
      email: emailLower,
      eventId: event.id,
      OR: [
        { paymentStatus: { in: ['pending', 'failed'] } },
        { paymentStatus: 'processing', updatedAt: { lt: new Date(Date.now() - STALE_THRESHOLD_MS) } },
      ],
    };
    const toPurge = await prisma.registration.findMany({ where: purgeWhere });
    if (toPurge.length > 0) {
      await prisma.activityLog.createMany({
        data: toPurge.map((r) => ({
          action: 'registration_purged_on_late_re_registration',
          adminUsername: 'system',
          targetType: 'registration',
          targetId: r.id,
          details: {
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            phone: r.phone,
            paymentStatus: r.paymentStatus,
            bibNumber: r.bibNumber,
            orderNumber: r.orderNumber,
            transactionId: r.transactionId,
            paymentMethod: r.paymentMethod,
            paymentDate: r.paymentDate,
            cardPan: r.cardPan,
            approvalCode: r.approvalCode,
            eventId: r.eventId,
            createdAt: r.createdAt,
            purgedAt: new Date().toISOString(),
            lateRegistrationLinkId: row.id,
            lateRegistrationBibNumber: row.bibNumber,
          },
        })),
      });
      await prisma.registration.deleteMany({ where: purgeWhere });
    }

    // Verify the reserved bib is still free
    const bibTaken = await prisma.registration.findFirst({
      where: { eventId: event.id, bibNumber: row.bibNumber },
      select: { id: true, paymentStatus: true },
    });
    if (bibTaken) {
      throw new AppError(409, 'Ce dossard a été attribué entre-temps. Merci de contacter l\'organisation.', 'BIB_TAKEN');
    }

    // Build E.164 phones
    const phone = buildE164(body.phoneCountryCode, body.phoneNumber);
    const emergencyPhone = buildE164(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber);

    // Compute payment amount (same logic as normal register)
    const of = event.optionalFields || {};
    let paymentAmount = event.priceInCentimes;
    if (of.photoPack && of.photoPack !== 'off' && body.photoPack && event.photoPackPrice) {
      paymentAmount += event.photoPackPrice;
    }

    const optionalData = {};
    if (of.distance && of.distance !== 'off' && body.selectedDistance) optionalData.selectedDistance = body.selectedDistance;
    if (of.club && of.club !== 'off' && body.club) optionalData.club = body.club.trim();
    if (of.licenseNumber && of.licenseNumber !== 'off' && body.licenseNumber) optionalData.licenseNumber = body.licenseNumber.trim();
    if (of.bestPerformance && of.bestPerformance !== 'off' && body.bestPerformance) optionalData.bestPerformance = body.bestPerformance;
    if (of.previousParticipations && of.previousParticipations !== 'off' && body.previousParticipations != null) optionalData.previousParticipations = parseInt(body.previousParticipations, 10);
    if (of.shuttle && of.shuttle !== 'off' && body.shuttle != null) optionalData.shuttle = Boolean(body.shuttle);
    if (of.bloodType && of.bloodType !== 'off' && body.bloodType) optionalData.bloodType = body.bloodType;
    if (of.photoPack && of.photoPack !== 'off' && body.photoPack != null) optionalData.photoPack = Boolean(body.photoPack);

    // Atomic create + link in a single Prisma call. The nested `registration: { create: ... }`
    // creates the Registration AND links it via the relation operator. Both halves use
    // Prisma's checked relation API (no FK-scalar ambiguity), and Prisma wraps the two
    // writes in an implicit DB transaction. No $transaction wrapper needed.
    const updated = await prisma.lateRegistrationLink.update({
      where: { id: row.id },
      data: {
        status: 'used',
        usedAt: new Date(),
        // Keep the existing token value (Prisma rejects null on non-nullable
        // String). status='used' alone prevents reuse — GET handler checks it.
        registration: {
          create: {
            event: { connect: { id: event.id } },
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
            declarationFit: body.declarationFit,
            declarationRules: body.declarationRules,
            declarationImage: body.declarationImage,
            termsAccepted: false,
            paymentStatus: 'pending',
            paymentAmount,
            source: 'public',
            ...optionalData,
          },
        },
      },
      include: { registration: true },
    });

    const registration = updated.registration;

    return {
      registrationId: registration.id,
      summary: {
        name: `${registration.firstName} ${registration.lastName}`,
        email: registration.email,
        tshirtSize: registration.tshirtSize,
        runnerLevel: registration.runnerLevel,
        paymentAmount,
        bibNumber: row.bibNumber,
      },
    };
  });

  // POST /api/late-registration/:token/payment/initiate
  // Body: { termsAccepted }
  fastify.post('/late-registration/:token/payment/initiate', async (request) => {
    const { termsAccepted } = request.body || {};
    if (!termsAccepted) {
      throw new AppError(400, 'Vous devez accepter les conditions générales', 'TERMS_REQUIRED');
    }

    // Find the link via either token (still set) OR by registrationId via separate query.
    // After /register, the token was nulled, so find by registrationId path: we need to resolve
    // through the recap call. Easier: resolve through linkId stored on registration —
    // but our schema has the relation only one-way. We'll resolve via the token first;
    // if it's been nulled (post-register), the frontend should pass the registrationId
    // separately. We support both paths below.
    let row = await prisma.lateRegistrationLink.findUnique({
      where: { token: request.params.token },
      include: { registration: true },
    });

    if (!row) {
      // Token consumed (POST /register cleared it). The frontend should call this
      // immediately after /register; in that window, find by recent registrationId.
      // Allow client to pass registrationId in the body as a fallback.
      const { registrationId } = request.body || {};
      if (!registrationId) {
        throw new AppError(404, 'Lien introuvable', 'INVALID_TOKEN');
      }
      row = await prisma.lateRegistrationLink.findFirst({
        where: { registrationId },
        include: { registration: true },
      });
      if (!row) throw new AppError(404, 'Lien introuvable', 'INVALID_TOKEN');
    }

    if (row.status !== 'used' || !row.registration) {
      throw new AppError(409, 'Veuillez d\'abord remplir le formulaire d\'inscription', 'NOT_REGISTERED');
    }

    const registration = row.registration;
    if (registration.paymentStatus === 'success') {
      throw new AppError(400, 'Paiement déjà effectué', 'ALREADY_PAID');
    }
    if (registration.paymentStatus === 'processing') {
      throw new AppError(400, 'Paiement déjà en cours', 'PAYMENT_PROCESSING');
    }

    const paymentAmount = registration.paymentAmount;

    await prisma.registration.update({
      where: { id: registration.id },
      data: { paymentStatus: 'processing', termsAccepted: true },
    });

    // Build orderId (same alphabet as normal flow)
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = letters + digits;
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    const base = [pick(letters), pick(letters), pick(digits), pick(digits), pick(all), pick(all), pick(all), pick(all)];
    for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
    const orderId = base.join('');

    // SATIM redirects to the SAME callback as normal flow — the callback
    // detects the late link via registrationId and uses the reserved bib.
    const returnUrl = `${env.SATIM_CALLBACK_URL}?registrationId=${registration.id}`;
    const failUrl = `${env.APP_URL}/failed?id=${registration.id}`;

    try {
      const satimResult = await registerPayment({
        orderId,
        amount: paymentAmount,
        returnUrl,
        failUrl,
      });
      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          transactionId: satimResult.orderId,
          orderNumber: orderId,
        },
      });
      return { satimRedirectUrl: satimResult.formUrl };
    } catch (err) {
      await prisma.registration.update({
        where: { id: registration.id },
        data: { paymentStatus: 'failed' },
      });
      request.log.error(err, 'SATIM register failed for late registration');
      throw new AppError(502, 'Erreur de connexion au service de paiement', 'SATIM_ERROR');
    }
  });
}

module.exports = lateRegistrationRoutes;
