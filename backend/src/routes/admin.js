const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { validateManualBib } = require('../services/bib');
const { getActiveEvent } = require('../services/event');
const { validateRegistration, validateOptionalFields, buildE164 } = require('../schemas/registration');
const { generateCSV } = require('../services/csv');
const { sendConfirmationEmail } = require('../services/sendgrid');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

async function adminRoutes(fastify) {
  const { prisma } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('scanner', 'admin', 'super_admin'));

  /**
   * Helper: resolve eventId from query param or default to active event
   */
  async function resolveEventId(query) {
    if (query.eventId) return query.eventId;
    const event = await getActiveEvent(prisma);
    return event.id;
  }

  // GET /api/admin/runners
  fastify.get('/runners', async (request) => {
    const {
      page = '1', limit = '20',
      status, search, source, paymentFilter = 'paid',
      sortBy = 'createdAt', sortOrder = 'desc',
    } = request.query;

    const eventId = await resolveEventId(request.query);

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = { eventId };

    if (paymentFilter === 'paid') {
      where.paymentStatus = { in: ['success', 'manual'] };
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (source && source !== 'all') {
      where.source = source;
    }

    if (search) {
      const s = search.trim();
      const bibNum = parseInt(s, 10);
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        ...(isNaN(bibNum) ? [] : [{ bibNumber: bibNum }]),
      ];
    }

    const validSortFields = ['lastName', 'email', 'bibNumber', 'status', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [orderField]: orderDir },
      }),
      prisma.registration.count({ where }),
    ]);

    return {
      data,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
  });

  // GET /api/admin/runners/:id
  fastify.get('/runners/:id', async (request) => {
    const reg = await prisma.registration.findUnique({
      where: { id: request.params.id },
      include: { emailsSent: true, event: { select: { name: true, slug: true } } },
    });
    if (!reg) throw new AppError(404, 'Coureur non trouvé', 'NOT_FOUND');
    return { data: reg };
  });

  // POST /api/admin/runners (manual creation) — admin only
  fastify.post('/runners', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const body = request.body || {};
    const { bibNumber } = body;

    if (!bibNumber && bibNumber !== 0) {
      throw new AppError(400, 'Numéro de dossard requis', 'VALIDATION_ERROR');
    }

    // Resolve event first (needed for validation)
    const eventId = body.eventId || (await getActiveEvent(prisma)).id;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError(404, 'Événement non trouvé', 'NOT_FOUND');

    const errors = validateRegistration(body, event.runnerLevels);
    if (errors.length > 0) {
      throw new AppError(400, errors[0].message, 'VALIDATION_ERROR');
    }

    // Validate optional fields if event has them
    const optErrors = validateOptionalFields(body, event.optionalFields, event.distances);
    if (optErrors.length > 0) {
      throw new AppError(400, optErrors[0].message, 'VALIDATION_ERROR');
    }

    // Validate manual bib
    await validateManualBib(prisma, bibNumber, event.bibStart, event.bibEnd);

    const phone = buildE164(body.phoneCountryCode, body.phoneNumber);
    const emergencyPhone = buildE164(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber);
    const qrToken = uuidv4();

    // Build optional fields data
    const of = event.optionalFields || {};
    const optionalData = {};
    if (of.distance !== 'off' && body.selectedDistance) optionalData.selectedDistance = body.selectedDistance;
    if (of.club !== 'off' && body.club) optionalData.club = body.club.trim();
    if (of.licenseNumber !== 'off' && body.licenseNumber) optionalData.licenseNumber = body.licenseNumber.trim();
    if (of.bestPerformance !== 'off' && body.bestPerformance) optionalData.bestPerformance = body.bestPerformance;
    if (of.previousParticipations !== 'off' && body.previousParticipations != null) optionalData.previousParticipations = parseInt(body.previousParticipations, 10);
    if (of.shuttle !== 'off' && body.shuttle != null) optionalData.shuttle = Boolean(body.shuttle);
    if (of.bloodType !== 'off' && body.bloodType) optionalData.bloodType = body.bloodType;
    if (of.photoPack !== 'off' && body.photoPack != null) optionalData.photoPack = Boolean(body.photoPack);

    const registration = await prisma.registration.create({
      data: {
        eventId,
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
        termsAccepted: true,
        bibNumber,
        qrToken,
        paymentStatus: 'manual',
        status: 'en_attente',
        source: 'admin',
        createdBy: request.user.username,
        ...optionalData,
      },
    });

    await logActivity({
      action: 'registration_created_manual',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: registration.id,
      details: { bibNumber, name: `${body.firstName} ${body.lastName}`, eventId },
    });

    // Fetch with event for email template
    const fullReg = await prisma.registration.findUnique({
      where: { id: registration.id },
      include: { event: { select: { name: true, date: true, location: true, primaryColor: true } } },
    });
    sendConfirmationEmail(fullReg).catch(console.error);

    return { data: registration };
  });

  // PUT /api/admin/runners/:id — admin only
  fastify.put('/runners/:id', { preHandler: authorize('admin', 'super_admin') }, async (request) => {
    const { id } = request.params;
    const body = request.body || {};

    const existing = await prisma.registration.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Coureur non trouvé', 'NOT_FOUND');

    const editable = [
      'firstName', 'lastName', 'email', 'phoneCountryCode', 'phoneNumber',
      'gender', 'birthDate', 'nationality', 'countryOfResidence',
      'wilaya', 'commune', 'ville',
      'emergencyPhoneCountryCode', 'emergencyPhoneNumber',
      'tshirtSize', 'runnerLevel',
      // Optional fields
      'selectedDistance', 'club', 'licenseNumber', 'bestPerformance',
      'previousParticipations', 'shuttle', 'bloodType', 'photoPack',
    ];

    const updateData = {};
    const changes = {};

    for (const field of editable) {
      if (body[field] !== undefined && body[field] !== existing[field]) {
        changes[field] = { before: existing[field], after: body[field] };
        if (field === 'birthDate') {
          updateData[field] = new Date(body[field]);
        } else if (field === 'previousParticipations') {
          updateData[field] = body[field] != null ? parseInt(body[field], 10) : null;
        } else if (field === 'shuttle' || field === 'photoPack') {
          updateData[field] = body[field] != null ? Boolean(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (updateData.phoneCountryCode || updateData.phoneNumber) {
      updateData.phone = buildE164(
        updateData.phoneCountryCode || existing.phoneCountryCode,
        updateData.phoneNumber || existing.phoneNumber
      );
    }
    if (updateData.emergencyPhoneCountryCode || updateData.emergencyPhoneNumber) {
      updateData.emergencyPhone = buildE164(
        updateData.emergencyPhoneCountryCode || existing.emergencyPhoneCountryCode,
        updateData.emergencyPhoneNumber || existing.emergencyPhoneNumber
      );
    }

    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: updateData,
    });

    if (Object.keys(changes).length > 0) {
      await logActivity({
        action: 'registration_edited',
        adminUsername: request.user.username,
        targetType: 'registration',
        targetId: id,
        details: changes,
      });
    }

    return { data: updated };
  });

  // GET /api/admin/runners/export/csv — admin only
  fastify.get('/runners/export/csv', { preHandler: authorize('admin', 'super_admin') }, async (request, reply) => {
    const { fields } = request.query;
    if (!fields) throw new AppError(400, 'Champs requis', 'VALIDATION_ERROR');

    const eventId = await resolveEventId(request.query);
    const fieldList = fields.split(',').map((f) => f.trim());

    const registrations = await prisma.registration.findMany({
      where: { eventId, paymentStatus: { in: ['success', 'manual'] } },
      orderBy: { bibNumber: 'asc' },
    });

    const csv = generateCSV(registrations, fieldList);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="coureurs.csv"');
    return csv;
  });

  // GET /api/admin/stats
  fastify.get('/stats', async (request) => {
    const eventId = await resolveEventId(request.query);
    const where = { eventId, paymentStatus: { in: ['success', 'manual'] } };

    const event = await prisma.event.findUnique({ where: { id: eventId } });

    const [total, enAttente, distribues, revenue] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.count({ where: { ...where, status: 'en_attente' } }),
      prisma.registration.count({ where: { ...where, status: 'distribué' } }),
      prisma.registration.aggregate({
        where: { eventId, paymentStatus: 'success' },
        _sum: { paymentAmount: true },
      }),
    ]);

    const stockTotal = event.bibEnd - event.bibStart + 1;
    const bibsAuto = await prisma.registration.count({
      where: { eventId, bibNumber: { gte: event.bibStart, lte: event.bibEnd } },
    });

    return {
      totalInscrits: total,
      totalEnAttente: enAttente,
      totalDistribues: distribues,
      dossardsRestants: stockTotal - bibsAuto,
      revenuTotal: revenue._sum.paymentAmount || 0,
      stockTotal,
      bibsAttribues: bibsAuto,
    };
  });

  // GET /api/admin/stats/charts
  fastify.get('/stats/charts', async (request) => {
    const eventId = await resolveEventId(request.query);
    const where = { eventId, paymentStatus: { in: ['success', 'manual'] } };

    const [
      genderGroups,
      categoryGroups,
      tshirtGroups,
      wilayaGroups,
      allRegistrations,
    ] = await Promise.all([
      prisma.registration.groupBy({ by: ['gender'], where, _count: true }),
      prisma.registration.groupBy({ by: ['runnerLevel'], where, _count: true }),
      prisma.registration.groupBy({ by: ['tshirtSize'], where, _count: true }),
      prisma.registration.groupBy({ by: ['wilaya'], where, _count: true, orderBy: { _count: { wilaya: 'desc' } }, take: 15 }),
      prisma.registration.findMany({ where, select: { birthDate: true, countryOfResidence: true, createdAt: true, selectedDistance: true } }),
    ]);

    const gender = {};
    genderGroups.forEach((g) => { gender[g.gender || 'Autre'] = g._count; });

    let local = 0, international = 0;
    allRegistrations.forEach((r) => {
      if (r.countryOfResidence === 'Algérie') local++;
      else international++;
    });
    const nationality = { 'Local (DZ)': local, 'International': international };

    const now = new Date();
    const ageRanges = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0 };
    allRegistrations.forEach((r) => {
      if (!r.birthDate) return;
      const age = Math.floor((now - new Date(r.birthDate)) / (365.25 * 24 * 3600 * 1000));
      if (age <= 25) ageRanges['18-25']++;
      else if (age <= 35) ageRanges['26-35']++;
      else if (age <= 45) ageRanges['36-45']++;
      else if (age <= 55) ageRanges['46-55']++;
      else if (age <= 65) ageRanges['56-65']++;
      else ageRanges['65+']++;
    });

    const levelMap = {
      'Intermédiaire': 'Confirmé',
      'Intermediaire': 'Confirmé',
      'Avancé': 'Elite',
      'Avance': 'Elite',
    };
    const categories = {};
    categoryGroups.forEach((g) => {
      const raw = (g.runnerLevel || 'Autre').trim();
      const key = levelMap[raw] || raw;
      categories[key] = (categories[key] || 0) + g._count;
    });

    const tshirtSizes = {};
    tshirtGroups.forEach((g) => { tshirtSizes[g.tshirtSize || 'Autre'] = g._count; });

    const dailyGrowth = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = allRegistrations.filter((r) => {
        const d = new Date(r.createdAt);
        return d >= dayStart && d < dayEnd;
      }).length;

      dailyGrowth.push({ date: dayStart.toISOString().split('T')[0], count });
    }

    const topWilayas = wilayaGroups
      .filter((g) => g.wilaya)
      .map((g) => ({ wilaya: g.wilaya, count: g._count }));

    // Distance distribution (if event has distances enabled)
    const distanceDistribution = {};
    allRegistrations.forEach((r) => {
      if (r.selectedDistance) {
        distanceDistribution[r.selectedDistance] = (distanceDistribution[r.selectedDistance] || 0) + 1;
      }
    });

    return { gender, nationality, ageRanges, categories, tshirtSizes, dailyGrowth, topWilayas, distanceDistribution };
  });
}

module.exports = adminRoutes;
