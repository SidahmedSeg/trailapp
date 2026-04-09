const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const Redis = require('ioredis');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Settings (upsert — idempotent)
  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      registrationOpen: true,
      bibStart: 101,
      bibEnd: 1500,
      autoCloseOnExhaustion: true,
      eventName: 'Trail des Mouflons d\'Or 2026',
      eventCity: 'Alger',
    },
  });
  console.log('Settings seeded:', settings.id);

  // 2. Super admin (upsert — idempotent)
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.adminUser.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      email: 'admin@trailmouflons.com',
      passwordHash,
      role: 'super_admin',
      active: true,
      inviteAccepted: true,
    },
  });
  console.log('Super admin seeded:', admin.username);

  // 3. Email templates (upsert — idempotent)
  await prisma.emailTemplate.upsert({
    where: { name: 'confirmation' },
    update: {},
    create: {
      name: 'confirmation',
      subject: 'Confirmation d\'inscription - Trail des Mouflons d\'Or 2026',
      body: `<h1>Félicitations {{prenom}} !</h1>
<p>Votre inscription au Trail des Mouflons d'Or 2026 est confirmée.</p>
<p><strong>Numéro de dossard :</strong> #{{dossard}}</p>
<p><strong>Date :</strong> 1 Mai 2026</p>
<p><strong>Ville :</strong> Alger</p>
<p>Votre QR code et votre ticket sont en pièce jointe.</p>
<p>À bientôt sur la ligne de départ !</p>`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: 'invitation' },
    update: {},
    create: {
      name: 'invitation',
      subject: 'Invitation - Trail des Mouflons d\'Or 2026',
      body: `<h1>Bienvenue {{prenom}} !</h1>
<p>Vous avez été invité comme <strong>{{role}}</strong> sur la plateforme Trail des Mouflons d'Or 2026.</p>
<p>Cliquez sur le lien ci-dessous pour créer votre mot de passe :</p>
<p><a href="{{lien}}">Créer mon mot de passe</a></p>
<p>Ce lien expire dans 48 heures.</p>`,
    },
  });
  console.log('Email templates seeded');

  // 4. Redis bib:next (SET NX — only if not exists)
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:8823';
  const redis = new Redis(redisUrl);
  const wasSet = await redis.set('bib:next', settings.bibStart, 'NX');
  if (wasSet) {
    console.log(`Redis bib:next initialized to ${settings.bibStart}`);
  } else {
    const current = await redis.get('bib:next');
    console.log(`Redis bib:next already exists: ${current}`);
  }
  redis.disconnect();

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
