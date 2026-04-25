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
