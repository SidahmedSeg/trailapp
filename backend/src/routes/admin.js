const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { validateManualBib } = require('../services/bib');
const { validateRegistration, buildE164 } = require('../schemas/registration');
const { generateCSV } = require('../services/csv');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

async function adminRoutes(fastify) {
  const { prisma } = fastify;

  // All admin routes require auth (admin or super_admin)
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('admin', 'super_admin'));

  // GET /api/admin/runners
  fastify.get('/runners', async (request) => {
    const {
      page = '1', limit = '20',
      status, search, paymentFilter = 'paid',
      sortBy = 'createdAt', sortOrder = 'desc',
    } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Payment filter
    if (paymentFilter === 'paid') {
      where.paymentStatus = { in: ['success', 'manual'] };
    }

    // Status filter
    if (status && status !== 'all') {
      where.status = status;
    }

    // Search
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

    // Sorting
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
      include: { emailsSent: true },
    });
    if (!reg) throw new AppError(404, 'Coureur non trouvé', 'NOT_FOUND');
    return { data: reg };
  });

  // POST /api/admin/runners (manual creation)
  fastify.post('/runners', async (request) => {
    const body = request.body || {};
    const { bibNumber } = body;

    if (!bibNumber && bibNumber !== 0) {
      throw new AppError(400, 'Numéro de dossard requis', 'VALIDATION_ERROR');
    }

    // Validate fields
    const errors = validateRegistration(body);
    if (errors.length > 0) {
      throw new AppError(400, errors[0].message, 'VALIDATION_ERROR');
    }

    // Validate manual bib (must be outside auto range)
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    await validateManualBib(prisma, bibNumber, settings.bibStart, settings.bibEnd);

    const phone = buildE164(body.phoneCountryCode, body.phoneNumber);
    const emergencyPhone = buildE164(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber);
    const qrToken = uuidv4();

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
        termsAccepted: true,
        bibNumber,
        qrToken,
        paymentStatus: 'manual',
        status: 'en_attente',
        source: 'admin',
        createdBy: request.user.username,
      },
    });

    await logActivity({
      action: 'registration_created_manual',
      adminUsername: request.user.username,
      targetType: 'registration',
      targetId: registration.id,
      details: { bibNumber, name: `${body.firstName} ${body.lastName}` },
    });

    return { data: registration };
  });

  // PUT /api/admin/runners/:id
  fastify.put('/runners/:id', async (request) => {
    const { id } = request.params;
    const body = request.body || {};

    const existing = await prisma.registration.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Coureur non trouvé', 'NOT_FOUND');

    // Editable fields (bib is read-only)
    const editable = [
      'firstName', 'lastName', 'email', 'phoneCountryCode', 'phoneNumber',
      'gender', 'birthDate', 'nationality', 'countryOfResidence',
      'wilaya', 'commune', 'ville',
      'emergencyPhoneCountryCode', 'emergencyPhoneNumber',
      'tshirtSize', 'runnerLevel',
    ];

    const updateData = {};
    const changes = {};

    for (const field of editable) {
      if (body[field] !== undefined && body[field] !== existing[field]) {
        changes[field] = { before: existing[field], after: body[field] };
        updateData[field] = field === 'birthDate' ? new Date(body[field]) : body[field];
      }
    }

    // Rebuild E.164 if phone fields changed
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

  // GET /api/admin/runners/export/csv
  fastify.get('/runners/export/csv', async (request, reply) => {
    const { fields } = request.query;
    if (!fields) throw new AppError(400, 'Champs requis', 'VALIDATION_ERROR');

    const fieldList = fields.split(',').map((f) => f.trim());

    const registrations = await prisma.registration.findMany({
      where: { paymentStatus: { in: ['success', 'manual'] } },
      orderBy: { bibNumber: 'asc' },
    });

    const csv = generateCSV(registrations, fieldList);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="coureurs.csv"');
    return csv;
  });

  // GET /api/admin/stats
  fastify.get('/stats', async () => {
    const where = { paymentStatus: { in: ['success', 'manual'] } };

    const [total, enAttente, distribues, revenue] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.count({ where: { ...where, status: 'en_attente' } }),
      prisma.registration.count({ where: { ...where, status: 'distribué' } }),
      prisma.registration.aggregate({
        where: { paymentStatus: 'success' },
        _sum: { paymentAmount: true },
      }),
    ]);

    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    const stockTotal = settings.bibEnd - settings.bibStart + 1;
    const bibsAuto = await prisma.registration.count({
      where: { bibNumber: { gte: settings.bibStart, lte: settings.bibEnd } },
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
}

module.exports = adminRoutes;
