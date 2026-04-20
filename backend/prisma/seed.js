const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const Redis = require('ioredis');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Default Event (upsert by slug — idempotent)
  const event = await prisma.event.upsert({
    where: { slug: 'trail-mouflons-2026' },
    update: {},
    create: {
      slug: 'trail-mouflons-2026',
      name: 'Trail des Mouflons d\'Or 2026',
      type: 'trail',
      location: 'Alger',
      facebookUrl: 'https://www.facebook.com/p/Ligue-Algeroise-de-ski-et-des-sports-de-montagne-LASSM-100081974797044/',
      instagramUrl: 'https://www.instagram.com/lassm.dz/',
      websiteUrl: 'https://lassm.dz/',
      registrationOpen: true,
      bibStart: 101,
      bibEnd: 1500,
      autoCloseOnExhaustion: true,
      priceInCentimes: 200000,
      optionalFields: {},
      active: true,
      status: 'active',
    },
  });
  console.log('Event seeded:', event.slug);

  // 2. Super admin (upsert — idempotent)
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.adminUser.upsert({
    where: { username: 'superadmin' },
    update: { email: 'sidahmed.segh@gmail.com' },
    create: {
      username: 'superadmin',
      email: 'sidahmed.segh@gmail.com',
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
      subject: 'Confirmation d\'inscription - {{eventName}}',
      body: `<h1>Félicitations {{prenom}} !</h1>
<p>Votre inscription au {{eventName}} est confirmée.</p>
<p><strong>Numéro de dossard :</strong> #{{dossard}}</p>
<p><strong>Date :</strong> {{eventDate}}</p>
<p><strong>Lieu :</strong> {{eventLocation}}</p>
<p>Votre QR code et votre ticket sont en pièce jointe.</p>
<p>À bientôt sur la ligne de départ !</p>`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: 'invitation' },
    update: {},
    create: {
      name: 'invitation',
      subject: 'Invitation - Plateforme d\'inscription',
      body: `<h1>Bienvenue {{prenom}} !</h1>
<p>Vous avez été invité comme <strong>{{role}}</strong> sur la plateforme d'inscription.</p>
<p>Votre nom d'utilisateur : <strong>{{username}}</strong></p>
<p>Cliquez sur le lien ci-dessous pour créer votre mot de passe :</p>
<p><a href="{{lien}}">Créer mon mot de passe</a></p>
<p>Ce lien expire dans 48 heures.</p>`,
    },
  });
  console.log('Email templates seeded');

  // 4. Redis bib:next:{eventId} (SET NX — only if not exists)
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:8823';
  const redis = new Redis(redisUrl);
  const bibKey = `bib:next:${event.id}`;
  const wasSet = await redis.set(bibKey, event.bibStart - 1, 'NX');
  if (wasSet) {
    console.log(`Redis ${bibKey} initialized to ${event.bibStart - 1}`);
  } else {
    const current = await redis.get(bibKey);
    console.log(`Redis ${bibKey} already exists: ${current}`);
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
