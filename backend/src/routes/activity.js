const { authenticate, authorize } = require('../middleware/auth');

async function activityRoutes(fastify) {
  const { prisma } = fastify;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('admin', 'super_admin'));

  // GET /api/admin/activity
  fastify.get('/activity', async (request) => {
    const { page = '1', limit = '50' } = request.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count(),
    ]);

    return {
      data,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
  });
}

module.exports = activityRoutes;
