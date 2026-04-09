const prisma = require('../config/database');
const redis = require('../config/redis');
const env = require('../config/env');

const PAYMENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function checkPaymentFailureRate(log) {
  try {
    const since = new Date(Date.now() - PAYMENT_WINDOW_MS);

    const [total, failed] = await Promise.all([
      prisma.registration.count({
        where: { updatedAt: { gte: since }, paymentStatus: { in: ['success', 'failed'] } },
      }),
      prisma.registration.count({
        where: { updatedAt: { gte: since }, paymentStatus: 'failed' },
      }),
    ]);

    if (total > 5) { // Only alert if enough volume
      const rate = Math.round((failed / total) * 100);
      const threshold = parseInt(env.PAYMENT_FAILURE_THRESHOLD, 10) || 20;

      if (rate > threshold) {
        log.error({
          alert: 'HIGH_PAYMENT_FAILURE_RATE',
          rate: `${rate}%`,
          threshold: `${threshold}%`,
          failed,
          total,
          window: '30 minutes',
        }, `Payment failure rate ${rate}% exceeds threshold ${threshold}%`);
      }
    }
  } catch (err) {
    log.error(err, 'Payment monitoring error');
  }
}

async function checkInfrastructure(log) {
  try {
    // Redis memory
    const info = await redis.info('memory');
    const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0', 10);
    const usedMB = Math.round(usedMemory / 1024 / 1024);

    if (usedMB > 500) {
      log.warn({ alert: 'HIGH_REDIS_MEMORY', usedMB }, `Redis memory: ${usedMB}MB`);
    }

    // DB connection check
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    log.error({ alert: 'INFRA_CHECK_FAILED' }, err.message);
  }
}

function startMonitoring(fastify) {
  const log = fastify.log;

  const interval = setInterval(async () => {
    await checkPaymentFailureRate(log);
    await checkInfrastructure(log);
  }, CHECK_INTERVAL_MS);

  // Store reference for cleanup
  fastify._monitoringInterval = interval;
  log.info('Monitoring started (interval: 5 min)');
}

module.exports = { startMonitoring };
