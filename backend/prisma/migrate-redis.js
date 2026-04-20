/**
 * Post-migration script: copies Redis bib:next → bib:next:{eventId}
 * Run after prisma migrate deploy: node prisma/migrate-redis.js
 */
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

async function main() {
  const prisma = new PrismaClient();
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:8823';
  const redis = new Redis(redisUrl);

  try {
    // Get the seed event (first active)
    const event = await prisma.event.findFirst({ where: { active: true } });
    if (!event) {
      console.error('No active event found. Run migration first.');
      process.exit(1);
    }

    // Copy old key to new scoped key
    const oldValue = await redis.get('bib:next');
    const newKey = `bib:next:${event.id}`;

    if (oldValue) {
      await redis.set(newKey, oldValue);
      console.log(`Copied bib:next (${oldValue}) → ${newKey}`);
    } else {
      // No old key — initialize from event config
      await redis.set(newKey, event.bibStart - 1);
      console.log(`Initialized ${newKey} to ${event.bibStart - 1}`);
    }

    console.log('Redis migration complete');
  } finally {
    redis.disconnect();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Redis migration error:', e);
  process.exit(1);
});
