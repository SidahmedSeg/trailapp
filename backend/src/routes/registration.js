const { validateRegistration, validateOptionalFields, buildE164 } = require('../schemas/registration');
const registrationGuard = require('../middleware/registrationGuard');
const { getActiveEvent } = require('../services/event');
const { generateTicketPDF } = require('../services/pdf');
const { AppError } = require('../utils/errors');

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

async function registrationRoutes(fastify) {
  const { prisma } = fastify;

  // POST /api/register
  fastify.post('/register', {
    preHandler: [registrationGuard],
  }, async (request) => {
    const body = request.body || {};
    const event = request.event; // set by registrationGuard

    // Validate base fields
    const errors = validateRegistration(body, event.runnerLevels);
    if (errors.length > 0) {
      throw new AppError(400, 'Erreurs de validation', 'VALIDATION_ERROR');
    }

    // Validate optional fields
    const optErrors = validateOptionalFields(body, event.optionalFields, event.distances);
    if (optErrors.length > 0) {
      throw new AppError(400, optErrors[0].message, 'VALIDATION_ERROR');
    }

    const emailLower = body.email.toLowerCase().trim();

    // Check email uniqueness — only block if success or manual
    const existingSuccess = await prisma.registration.findFirst({
      where: {
        email: emailLower,
        eventId: event.id,
        paymentStatus: { in: ['success', 'manual'] },
      },
    });
    if (existingSuccess) {
      throw new AppError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
    }

    // Check for active processing (< 30 min old) — block to prevent double payment
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

    // Delete any previous failed/pending/stale-processing registrations
    await prisma.registration.deleteMany({
      where: {
        email: emailLower,
        eventId: event.id,
        OR: [
          { paymentStatus: { in: ['pending', 'failed'] } },
          { paymentStatus: 'processing', updatedAt: { lt: new Date(Date.now() - STALE_THRESHOLD_MS) } },
        ],
      },
    });

    // Build E.164 phone numbers
    const phone = buildE164(body.phoneCountryCode, body.phoneNumber);
    const emergencyPhone = buildE164(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber);

    // Compute payment amount
    const of = event.optionalFields || {};
    let paymentAmount = event.priceInCentimes;
    if (of.photoPack && of.photoPack !== 'off' && body.photoPack && event.photoPackPrice) {
      paymentAmount += event.photoPackPrice;
    }

    // Build optional fields data
    const optionalData = {};
    if (of.distance && of.distance !== 'off' && body.selectedDistance) {
      optionalData.selectedDistance = body.selectedDistance;
    }
    if (of.club && of.club !== 'off' && body.club) {
      optionalData.club = body.club.trim();
    }
    if (of.licenseNumber && of.licenseNumber !== 'off' && body.licenseNumber) {
      optionalData.licenseNumber = body.licenseNumber.trim();
    }
    if (of.bestPerformance && of.bestPerformance !== 'off' && body.bestPerformance) {
      optionalData.bestPerformance = body.bestPerformance;
    }
    if (of.previousParticipations && of.previousParticipations !== 'off' && body.previousParticipations != null) {
      optionalData.previousParticipations = parseInt(body.previousParticipations, 10);
    }
    if (of.shuttle && of.shuttle !== 'off' && body.shuttle != null) {
      optionalData.shuttle = Boolean(body.shuttle);
    }
    if (of.bloodType && of.bloodType !== 'off' && body.bloodType) {
      optionalData.bloodType = body.bloodType;
    }
    if (of.photoPack && of.photoPack !== 'off' && body.photoPack != null) {
      optionalData.photoPack = Boolean(body.photoPack);
    }

    const registration = await prisma.registration.create({
      data: {
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
        declarationFit: body.declarationFit,
        declarationRules: body.declarationRules,
        declarationImage: body.declarationImage,
        termsAccepted: false,
        paymentStatus: 'pending',
        paymentAmount,
        source: 'public',
        ...optionalData,
      },
    });

    return {
      registrationId: registration.id,
      summary: {
        name: `${registration.firstName} ${registration.lastName}`,
        email: registration.email,
        tshirtSize: registration.tshirtSize,
        runnerLevel: registration.runnerLevel,
        paymentAmount,
      },
    };
  });

  // GET /api/check-email
  fastify.get('/check-email', async (request) => {
    const { email } = request.query;
    if (!email) {
      throw new AppError(400, 'Email requis', 'VALIDATION_ERROR');
    }

    const event = await getActiveEvent(prisma);
    const emailLower = email.toLowerCase().trim();

    // Block success/manual
    const existingSuccess = await prisma.registration.findFirst({
      where: {
        email: emailLower,
        eventId: event.id,
        paymentStatus: { in: ['success', 'manual'] },
      },
    });
    if (existingSuccess) {
      return { available: false, reason: 'paid' };
    }

    // Check active processing (< 30 min)
    const processingReg = await prisma.registration.findFirst({
      where: {
        email: emailLower,
        eventId: event.id,
        paymentStatus: 'processing',
        updatedAt: { gt: new Date(Date.now() - STALE_THRESHOLD_MS) },
      },
    });
    if (processingReg) {
      return { available: false, reason: 'processing' };
    }

    // Check pending registration (< 1 hour old)
    const pendingReg = await prisma.registration.findFirst({
      where: {
        email: emailLower,
        eventId: event.id,
        paymentStatus: 'pending',
        createdAt: { gt: new Date(Date.now() - STALE_THRESHOLD_MS) },
      },
    });
    if (pendingReg) {
      return { available: false, reason: 'pending', registrationId: pendingReg.id };
    }

    return { available: true };
  });

  // GET /api/registration/:id
  fastify.get('/registration/:id', async (request) => {
    const { id } = request.params;

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { event: { select: { name: true, date: true, location: true, slug: true, primaryColor: true } } },
    });
    if (!registration) {
      throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');
    }

    return { data: registration };
  });

  // GET /api/registration/:id/pdf
  fastify.get('/registration/:id/pdf', async (request, reply) => {
    const registration = await prisma.registration.findUnique({
      where: { id: request.params.id },
      include: { event: { select: { name: true, date: true, location: true } } },
    });
    if (!registration) throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');
    if (!registration.bibNumber || !registration.qrToken) {
      throw new AppError(400, 'Inscription incomplète (pas de dossard)', 'INCOMPLETE');
    }

    const pdf = await generateTicketPDF(registration);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="ticket-${registration.bibNumber}.pdf"`);
    return reply.send(pdf);
  });

  // GET /api/settings/public — active event config for frontend
  fastify.get('/settings/public', async () => {
    const event = await getActiveEvent(prisma);
    return {
      registrationOpen: event.registrationOpen,
      primaryColor: event.primaryColor,
      eventName: event.name,
      eventDate: event.date,
      eventCity: event.location,
      eventType: event.type,
      eventDescription: event.description,
      eventSlug: event.slug,
      logoPath: event.logoPath,
      coverImagePath: event.coverImagePath,
      facebookUrl: event.facebookUrl,
      instagramUrl: event.instagramUrl,
      tiktokUrl: event.tiktokUrl,
      websiteUrl: event.websiteUrl,
      contactEmail: event.contactEmail,
      contactPhone: event.contactPhone,
      contactLabel: event.contactLabel,
      distances: event.distances,
      runnerLevels: event.runnerLevels,
      optionalFields: event.optionalFields,
      priceInCentimes: event.priceInCentimes,
      photoPackPrice: event.photoPackPrice,
      termsText: event.termsText,
    };
  });

  // POST /api/registration/:id/upload-certificate
  fastify.post('/registration/:id/upload-certificate', async (request) => {
    const registration = await prisma.registration.findUnique({ where: { id: request.params.id } });
    if (!registration) throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');

    const fs = require('fs');
    const path = require('path');
    const { pipeline } = require('stream/promises');

    const data = await request.file();
    if (!data) throw new AppError(400, 'Fichier requis', 'NO_FILE');

    const dir = path.resolve(__dirname, '../../uploads/certificates');
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(data.filename) || '.pdf';
    const filePath = path.join(dir, `${registration.id}${ext}`);
    await pipeline(data.file, fs.createWriteStream(filePath));

    const storedPath = `/uploads/certificates/${registration.id}${ext}`;
    await prisma.registration.update({
      where: { id: registration.id },
      data: { medicalCertificatePath: storedPath },
    });

    return { success: true, path: storedPath };
  });
}

module.exports = registrationRoutes;
