const { validateRegistration, buildE164 } = require('../schemas/registration');
const registrationGuard = require('../middleware/registrationGuard');
const { generateTicketPDF } = require('../services/pdf');
const { AppError } = require('../utils/errors');

async function registrationRoutes(fastify) {
  const { prisma, redis } = fastify;

  // POST /api/register
  fastify.post('/register', {
    preHandler: [registrationGuard],
  }, async (request) => {
    const body = request.body || {};

    // Validate
    const errors = validateRegistration(body);
    if (errors.length > 0) {
      throw new AppError(400, 'Erreurs de validation', 'VALIDATION_ERROR');
    }

    // Check email uniqueness — only block if there's a successful/manual registration
    const existingEmail = await prisma.registration.findFirst({
      where: {
        email: body.email.toLowerCase().trim(),
        paymentStatus: { in: ['success', 'manual', 'processing'] },
      },
    });
    if (existingEmail) {
      throw new AppError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
    }

    // Delete any previous failed/pending registrations with this email
    await prisma.registration.deleteMany({
      where: {
        email: body.email.toLowerCase().trim(),
        paymentStatus: { in: ['pending', 'failed'] },
      },
    });

    // Build E.164 phone numbers
    const phone = buildE164(body.phoneCountryCode, body.phoneNumber);
    const emergencyPhone = buildE164(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber);

    // Bib NOT assigned here — assigned on payment success (Phase 7)
    // Create registration with pending status
    const registration = await prisma.registration.create({
      data: {
        lastName: body.lastName.trim(),
        firstName: body.firstName.trim(),
        birthDate: new Date(body.birthDate),
        gender: body.gender,
        nationality: body.nationality,
        phoneCountryCode: body.phoneCountryCode,
        phoneNumber: body.phoneNumber,
        phone,
        email: body.email.toLowerCase().trim(),
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
        source: 'public',
      },
    });

    return {
      registrationId: registration.id,
      summary: {
        name: `${registration.firstName} ${registration.lastName}`,
        email: registration.email,
        tshirtSize: registration.tshirtSize,
        runnerLevel: registration.runnerLevel,
      },
    };
  });

  // GET /api/check-email
  fastify.get('/check-email', async (request) => {
    const { email } = request.query;
    if (!email) {
      throw new AppError(400, 'Email requis', 'VALIDATION_ERROR');
    }

    const existing = await prisma.registration.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        paymentStatus: { in: ['success', 'manual', 'processing'] },
      },
    });

    return { available: !existing };
  });

  // GET /api/registration/:id
  fastify.get('/registration/:id', async (request) => {
    const { id } = request.params;

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) {
      throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');
    }

    return { data: registration };
  });

  // GET /api/registration/:id/pdf
  fastify.get('/registration/:id/pdf', async (request, reply) => {
    const registration = await prisma.registration.findUnique({ where: { id: request.params.id } });
    if (!registration) throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');
    if (!registration.bibNumber || !registration.qrToken) {
      throw new AppError(400, 'Inscription incomplète (pas de dossard)', 'INCOMPLETE');
    }

    const pdf = await generateTicketPDF(registration);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="ticket-${registration.bibNumber}.pdf"`);
    return reply.send(pdf);
  });

  // GET /api/admin/settings/public (registration open status for frontend guard)
  fastify.get('/settings/public', async () => {
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    return {
      registrationOpen: settings?.registrationOpen ?? false,
      eventName: settings?.eventName,
      eventDate: settings?.eventDate,
      eventCity: settings?.eventCity,
    };
  });
}

module.exports = registrationRoutes;
