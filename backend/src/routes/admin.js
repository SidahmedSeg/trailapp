const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { validateManualBib } = require('../services/bib');
const { getActiveEvent } = require('../services/event');
const { validateRegistration, validateOptionalFields, buildE164 } = require('../schemas/registration');
const { generateCSV } = require('../services/csv');
const { generateBibsWorkbook } = require('../services/excel');
const { sendConfirmationEmail } = require('../services/sendgrid');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

async function adminRoutes(fastify) {
  const { prisma } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('scanner', 'admin', 'super_admin', 'reconciliation_specialist'));

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
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { transactionId: { contains: s, mode: 'insensitive' } },
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

    // Validate manual bib (lower or upper manual band)
    await validateManualBib(prisma, bibNumber, event);

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

  // POST /api/admin/runners/:id/cancel-distribution — super_admin only
  fastify.post('/runners/:id/cancel-distribution', { preHandler: authorize('super_admin') }, async (request) => {
    const { id } = request.params;

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) throw new AppError(404, 'Coureur non trouvé', 'NOT_FOUND');
    if (registration.status !== 'distribué') {
      throw new AppError(400, 'Ce dossard n\'a pas été distribué', 'NOT_DISTRIBUTED');
    }

    const originalDistributedAt = registration.distributedAt;
    const originalDistributedBy = registration.distributedBy;

    // Revert distribution
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        status: 'en_attente',
        distributedAt: null,
        distributedBy: null,
      },
    });

    // Remove the scanner session(s) for this registration
    await prisma.scannerSession.deleteMany({
      where: { registrationId: id },
    });

    await logActivity({
      action: 'bib_distribution_cancelled',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: id,
      details: {
        bibNumber: registration.bibNumber,
        originalDistributedBy,
        originalDistributedAt,
      },
    });

    return { data: updated };
  });

  // POST /api/admin/runners/:id/refund — super_admin + reconciliation_specialist
  // Frees the bib + qrToken, marks the registration paymentStatus='refunded',
  // and creates/updates a SatimReconciliation row with status='refund_pending'.
  // The row then appears in Réconciliation → Validations tab where another admin
  // confirms the SATIM portal refund was processed (→ status='refunded' → Remboursés tab).
  // No email is sent at any step — actual SATIM refund happens externally on the merchant portal.
  fastify.post('/runners/:id/refund', { preHandler: authorize('super_admin', 'reconciliation_specialist') }, async (request) => {
    const { id } = request.params;

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { satimReconciliation: true, event: { select: { id: true, name: true } } },
    });
    if (!registration) throw new AppError(404, 'Coureur non trouvé', 'NOT_FOUND');
    if (registration.bibNumber == null) {
      throw new AppError(400, 'Ce coureur n\'a pas de dossard à libérer', 'NO_BIB');
    }
    if (registration.paymentStatus === 'refunded') {
      throw new AppError(400, 'Ce coureur a déjà été remboursé', 'ALREADY_REFUNDED');
    }

    const freedBib = registration.bibNumber;
    const cardholderName = `${registration.firstName} ${registration.lastName}`.trim().toUpperCase();

    // Resolve existing SatimReconciliation row: first by FK link, then by (eventId, orderNumber)
    // — guards against the case where a SATIM CSV upload created an unlinked row for this orderNumber
    let existingRecon = registration.satimReconciliation;
    if (!existingRecon && registration.orderNumber) {
      existingRecon = await prisma.satimReconciliation.findUnique({
        where: { eventId_orderNumber: { eventId: registration.eventId, orderNumber: registration.orderNumber } },
      });
    }

    const txOps = [
      prisma.registration.update({
        where: { id },
        data: {
          bibNumber: null,
          qrToken: null,
          paymentStatus: 'refunded',
        },
      }),
    ];

    if (existingRecon) {
      // Flip existing row to refund_pending; ensure it links to this registration
      // and clear any active outreach token (no public submission allowed once refund is in flight)
      txOps.push(prisma.satimReconciliation.update({
        where: { id: existingRecon.id },
        data: {
          status: 'refund_pending',
          registrationId: registration.id,
          linkToken: null,
          linkExpiresAt: null,
        },
      }));
    } else {
      // No existing row → create a Validations-tab entry awaiting refund confirmation
      // Fall back to synthetic orderNumber for manual VIPs that never had a SATIM order
      const orderNumber = registration.orderNumber || `MANUAL-${registration.id.slice(0, 8)}`;
      txOps.push(prisma.satimReconciliation.create({
        data: {
          eventId: registration.eventId,
          paymentStatus: 'Déposé',
          orderNumber,
          paymentDate: registration.paymentDate || null,
          depositDate: null,
          approvedAmount: registration.paymentAmount || 0,
          cardholderName,
          cardPan: registration.cardPan || '0000',
          cardFirst4: null,
          status: 'refund_pending',
          registrationId: registration.id,
          uploadedBy: 'admin-coureur-refund',
        },
      }));
    }

    await prisma.$transaction(txOps);

    await logActivity({
      action: 'coureur_refunded',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: id,
      details: {
        orderNumber: registration.orderNumber || null,
        bibNumber: freedBib,
        runnerEmail: registration.email,
        eventId: registration.eventId,
      },
    });

    return { refunded: true, freedBib };
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

  // GET /api/admin/runners/export/bibs-xlsx — admin only
  // Exports a .xlsx with embedded QR PNGs, scoped to current Coureurs filters.
  fastify.get('/runners/export/bibs-xlsx', { preHandler: authorize('admin', 'super_admin') }, async (request, reply) => {
    const { status, search, source, paymentFilter = 'paid' } = request.query;
    const eventId = await resolveEventId(request.query);

    const where = {
      eventId,
      bibNumber: { not: null },
      qrToken: { not: null },
    };

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
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { transactionId: { contains: s, mode: 'insensitive' } },
        ...(isNaN(bibNum) ? [] : [{ bibNumber: bibNum }]),
      ];
    }

    const registrations = await prisma.registration.findMany({
      where,
      orderBy: { bibNumber: 'asc' },
      select: {
        firstName: true,
        lastName: true,
        bibNumber: true,
        runnerLevel: true,
        qrToken: true,
      },
    });

    const workbook = await generateBibsWorkbook(registrations);

    const dateStr = new Date().toISOString().slice(0, 10);
    reply.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    reply.header(
      'Content-Disposition',
      `attachment; filename="coureurs-bibs-${dateStr}.xlsx"`
    );

    await workbook.xlsx.write(reply.raw);
    reply.raw.end();
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
