const path = require('path');
const env = require('./config/env');
const prisma = require('./config/database');
const redis = require('./config/redis');
const { errorHandler } = require('./utils/errors');

const fastify = require('fastify')({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Plugins
fastify.register(require('@fastify/cors'), {
  origin: [env.APP_URL],
  credentials: true,
});

fastify.register(require('@fastify/helmet'));

// Multipart file uploads (5MB limit)
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Serve uploaded files
fastify.register(require('@fastify/static'), {
  root: path.resolve(__dirname, '../uploads'),
  prefix: '/uploads/',
  decorateReply: false,
});

// Serve the built frontend SPA when present (Railway combined-service deploy).
// Local dev (Vite on :3820) and the VPS (Nginx in front) skip this — Vite/Nginx
// already handle SPA serving in those environments. Block is dormant if dist
// folder is absent, so it's safe to ship to prod as a no-op.
{
  const fs = require('fs');
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    fastify.register(require('@fastify/static'), {
      root: frontendDist,
      prefix: '/',
      decorateReply: false,
    });

    fastify.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET') {
        return reply.status(404).send({ error: true, message: 'Not found' });
      }
      if (
        request.url.startsWith('/api/') ||
        request.url.startsWith('/uploads/') ||
        request.url === '/health'
      ) {
        return reply.status(404).send({ error: true, message: 'Not found' });
      }
      return reply.type('text/html').send(fs.readFileSync(path.join(frontendDist, 'index.html')));
    });
  }
}

// Decorate with shared instances
fastify.decorate('prisma', prisma);
fastify.decorate('redis', redis);

// Global error handler
fastify.setErrorHandler(errorHandler);

// Health check
fastify.get('/health', async () => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  const redisOk = await redis.ping().then(() => true).catch(() => false);
  return {
    status: 'ok',
    api: true,
    db: dbOk,
    redis: redisOk,
    timestamp: new Date().toISOString(),
  };
});

// Routes
fastify.register(require('./routes/registration'), { prefix: '/api' });
fastify.register(require('./routes/auth'), { prefix: '/api/admin' });
fastify.register(require('./routes/admin'), { prefix: '/api/admin' });
fastify.register(require('./routes/events'), { prefix: '/api/admin' });
fastify.register(require('./routes/scanner'), { prefix: '/api' });
fastify.register(require('./routes/activity'), { prefix: '/api/admin' });
fastify.register(require('./routes/payment'), { prefix: '/api' });
fastify.register(require('./routes/emails'), { prefix: '/api' });
fastify.register(require('./routes/reconciliation'), { prefix: '/api' });
fastify.register(require('./routes/lateRegistration'), { prefix: '/api' });
fastify.register(require('./routes/volunteers'), { prefix: '/api' });

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Shutting down...');
  if (fastify._monitoringInterval) clearInterval(fastify._monitoringInterval);
  await fastify.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start
const start = async () => {
  try {
    // Ensure upload directories exist
    const fs = require('fs');
    const uploadsDir = path.resolve(__dirname, '../uploads');
    fs.mkdirSync(path.join(uploadsDir, 'events'), { recursive: true });
    fs.mkdirSync(path.join(uploadsDir, 'certificates'), { recursive: true });

    await fastify.listen({ port: env.PORT, host: env.HOST });
    fastify.log.info(`Server running on port ${env.PORT}`);

    // Start monitoring
    const { startMonitoring } = require('./services/monitoring');
    startMonitoring(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
