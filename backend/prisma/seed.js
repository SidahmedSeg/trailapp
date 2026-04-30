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
    update: {
      subject: 'Confirmation d\'inscription - {{eventName}}',
      body: `<p>Bonjour {{prenom}},</p>
<p>Nous vous remercions pour votre inscription à {{eventName}}.</p>
<p>Votre numéro de dossard est le <strong>#{{dossard}}</strong>.</p>
<p>Vous trouverez en pièce jointe votre ticket de confirmation incluant votre QR code personnel.</p>
<p>Merci de le présenter lors de la remise des dossards (sur téléphone ou imprimé).</p>
<p>Bonne préparation et à très bientôt sur la ligne de départ !</p>
<p>Sportivement,<br/>L'équipe {{eventName}}</p>`,
    },
    create: {
      name: 'confirmation',
      subject: 'Confirmation d\'inscription - {{eventName}}',
      body: `<p>Bonjour {{prenom}},</p>
<p>Nous vous remercions pour votre inscription à {{eventName}}.</p>
<p>Votre numéro de dossard est le <strong>#{{dossard}}</strong>.</p>
<p>Vous trouverez en pièce jointe votre ticket de confirmation incluant votre QR code personnel.</p>
<p>Merci de le présenter lors de la remise des dossards (sur téléphone ou imprimé).</p>
<p>Bonne préparation et à très bientôt sur la ligne de départ !</p>
<p>Sportivement,<br/>L'équipe {{eventName}}</p>`,
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
  const reconciliationTemplate = {
    subject: 'Finalisez votre inscription — {{eventName}}',
    body: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #C42826; margin-bottom: 8px;">Finalisez votre inscription</h2>
  <p style="color: #444;">Bonjour {{titulaire}},</p>
  <p style="color: #444;">Nous avons retrouvé votre paiement pour <strong>{{eventName}}</strong>, mais votre inscription n'a pas pu être finalisée.</p>
  <p style="color: #444;">Cliquez sur le bouton ci-dessous pour compléter votre inscription. <strong>Aucun nouveau paiement ne sera demandé.</strong></p>
  <p style="text-align: center; margin: 28px 0;">
    <a href="{{lien}}" style="background:#C42826;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;display:inline-block;">Finaliser mon inscription</a>
  </p>
  <p style="color: #777; font-size: 13px;">Ce lien est valable jusqu'au <strong>{{expiry}}</strong>.</p>
  <p style="color: #999; font-size: 12px; margin-top: 24px;">Si ce n'est pas vous, ignorez simplement cet email.</p>
</div>`,
  };
  await prisma.emailTemplate.upsert({
    where: { name: 'reconciliation_invitation' },
    update: reconciliationTemplate,
    create: { name: 'reconciliation_invitation', ...reconciliationTemplate },
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
