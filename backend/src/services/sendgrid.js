const sgMail = require('@sendgrid/mail');
const env = require('../config/env');
const prisma = require('../config/database');
const { generateTicketPDF } = require('./pdf');
const { generateQRDataURL } = require('./qrcode');

sgMail.setApiKey(env.SENDGRID_API_KEY);

/**
 * Send confirmation email after successful registration/payment
 */
async function sendConfirmationEmail(registration) {
  const template = await prisma.emailTemplate.findUnique({ where: { name: 'confirmation' } });
  if (!template) {
    console.error('Confirmation email template not found');
    return;
  }

  const eventName = registration.event?.name || 'Événement';
  const eventDate = registration.event?.date
    ? new Date(registration.event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const eventLocation = registration.event?.location || '';

  const body = template.body
    .replace(/\{\{prenom\}\}/g, registration.firstName)
    .replace(/\{\{nom\}\}/g, registration.lastName)
    .replace(/\{\{dossard\}\}/g, String(registration.bibNumber))
    .replace(/\{\{email\}\}/g, registration.email)
    .replace(/\{\{eventName\}\}/g, eventName)
    .replace(/\{\{eventDate\}\}/g, eventDate)
    .replace(/\{\{eventLocation\}\}/g, eventLocation);

  const subject = template.subject
    .replace(/\{\{eventName\}\}/g, eventName);

  // Generate PDF attachment
  const pdfBuffer = await generateTicketPDF(registration);

  const msg = {
    to: registration.email,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject,
    html: body,
    attachments: [
      {
        content: pdfBuffer.toString('base64'),
        filename: `ticket-${registration.bibNumber}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  };

  try {
    await sgMail.send(msg);

    // Log email
    await prisma.emailLog.create({
      data: {
        registrationId: registration.id,
        templateName: 'confirmation',
        sentBy: 'system',
      },
    });

    console.log(`Confirmation email sent to ${registration.email}`);
  } catch (err) {
    console.error('SendGrid error (confirmation):', err.response?.body?.errors || err.message);
  }
}

/**
 * Send invitation email to new admin/scanner user
 */
async function sendInvitationEmail(user, inviteLink) {
  const template = await prisma.emailTemplate.findUnique({ where: { name: 'invitation' } });
  if (!template) {
    console.error('Invitation email template not found');
    return;
  }

  const body = template.body
    .replace(/\{\{prenom\}\}/g, user.username)
    .replace(/\{\{username\}\}/g, user.username)
    .replace(/\{\{role\}\}/g, user.role)
    .replace(/\{\{lien\}\}/g, inviteLink);

  const msg = {
    to: user.email,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject: template.subject,
    html: body,
  };

  try {
    await sgMail.send(msg);
    console.log(`Invitation email sent to ${user.email}`);
  } catch (err) {
    console.error('SendGrid error (invitation):', err.response?.body?.errors || err.message);
  }
}

/**
 * Send OTP code for admin login verification
 */
async function sendOtpEmail(email, username, otpCode) {
  const msg = {
    to: email,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject: 'Code de vérification - Trail des Mouflons d\'Or',
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #C42826; margin-bottom: 8px;">Code de vérification</h2>
      <p style="color: #555;">Bonjour ${username},</p>
      <p style="color: #555;">Voici votre code de connexion :</p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C42826;">${otpCode}</span>
      </div>
      <p style="color: #555; font-size: 14px;">Ce code expire dans <strong>5 minutes</strong>.</p>
      <p style="color: #999; font-size: 12px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    </div>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`OTP email sent to ${email}`);
  } catch (err) {
    console.error('SendGrid error (OTP):', err.response?.body?.errors || err.message);
    throw new Error('Erreur lors de l\'envoi du code de vérification');
  }
}

/**
 * Send a reconciliation invitation email — runner clicks the link to complete
 * registration without paying again (their SATIM payment is on file).
 */
async function sendReconciliationInvitation({ toEmail, cardholderName, cardPan, eventName, link, expiresAt }) {
  const template = await prisma.emailTemplate.findUnique({ where: { name: 'reconciliation_invitation' } });

  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  let subject;
  let body;

  if (template) {
    subject = template.subject.replace(/\{\{eventName\}\}/g, eventName || 'Événement');
    body = template.body
      .replace(/\{\{prenom\}\}/g, cardholderName || '')
      .replace(/\{\{titulaire\}\}/g, cardholderName || '')
      .replace(/\{\{eventName\}\}/g, eventName || 'Événement')
      .replace(/\{\{lien\}\}/g, link)
      .replace(/\{\{link\}\}/g, link)
      .replace(/\{\{expiry\}\}/g, expiryStr);
  } else {
    // Fallback if the seed hasn't run yet
    subject = `Finalisez votre inscription — ${eventName || 'Événement'}`;
    body = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #C42826; margin-bottom: 8px;">Finalisez votre inscription</h2>
      <p style="color: #444;">Bonjour ${cardholderName || ''},</p>
      <p style="color: #444;">Nous avons retrouvé votre paiement pour <strong>${eventName || 'l\'événement'}</strong>,
        mais votre inscription n'a pas pu être finalisée.</p>
      <p style="color: #444;">Cliquez sur le bouton ci-dessous pour compléter votre inscription. Aucun nouveau paiement ne sera demandé.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${link}" style="background:#C42826;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;display:inline-block;">Finaliser mon inscription</a>
      </p>
      <p style="color: #777; font-size: 13px;">Ce lien est valable jusqu'au <strong>${expiryStr}</strong>.</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">Si ce n'est pas vous, ignorez simplement cet email.</p>
    </div>`;
  }

  const msg = {
    to: toEmail,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject,
    html: body,
    // Disable SendGrid click-tracking so the runner sees the real URL
    // (otherwise links get rewritten through url3118.lassm.dz/ls/click?...)
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Reconciliation invitation sent to ${toEmail}`);
  } catch (err) {
    console.error('SendGrid error (reconciliation):', err.response?.body?.errors || err.message);
    throw new Error('Erreur lors de l\'envoi de l\'invitation');
  }
}

/**
 * Late registration invitation — admin pre-reserved a bib for a runner.
 * Unlike reconciliation (no payment needed), late registration requires the
 * runner to complete payment via SATIM. Email copy reflects that.
 */
async function sendLateRegistrationInvitation({ toEmail, eventName, bibNumber, link, expiresAt }) {
  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const subject = `Inscription tardive — ${eventName || 'Événement'} (Dossard #${bibNumber})`;
  const body = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #C42826; margin-bottom: 8px;">Inscription tardive</h2>
    <p style="color: #444;">Bonjour,</p>
    <p style="color: #444;">L'organisation de <strong>${eventName || 'l\'événement'}</strong> vous propose une inscription tardive avec le dossard <strong>#${bibNumber}</strong>.</p>
    <p style="color: #444;">Cliquez sur le bouton ci-dessous pour compléter votre inscription et procéder au paiement :</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${link}" style="background:#C42826;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;display:inline-block;">Finaliser mon inscription</a>
    </p>
    <p style="color: #777; font-size: 13px;">Ce lien est valable jusqu'au <strong>${expiryStr}</strong> et ne peut être utilisé qu'une seule fois.</p>
    <p style="color: #999; font-size: 12px; margin-top: 24px;">Si ce n'est pas vous, ignorez simplement cet email.</p>
  </div>`;

  const msg = {
    to: toEmail,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject,
    html: body,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Late registration invitation sent to ${toEmail}`);
  } catch (err) {
    console.error('SendGrid error (late registration):', err.response?.body?.errors || err.message);
    throw new Error('Erreur lors de l\'envoi de l\'invitation');
  }
}

/**
 * Volunteer interview proposal — admin sends 3 datetime slots; runner replies
 * by email (reply-to staff@lassm.dz) to coordinate outside the app.
 */
async function sendVolunteerInterviewProposal({ toEmail, firstName, eventName, slots, adminNote }) {
  const fmt = (iso) => new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const slotItems = (slots || [])
    .filter(Boolean)
    .map((s) => `<li style="margin-bottom: 6px;">${fmt(s)}</li>`)
    .join('');

  const eventLabel = eventName || 'l\'événement';
  const subject = `Entretien bénévole — ${eventName || 'Événement'}`;
  const body = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #444; line-height: 1.55;">
    <p>Bonjour ${firstName || ''},</p>
    <p>Merci pour votre candidature pour rejoindre l'équipe des bénévoles de <strong>${eventLabel}</strong>.</p>
    <p>Nous avons bien étudié votre profil et serions ravis d'échanger avec vous lors d'un court entretien afin de mieux faire connaissance et de vous présenter l'aventure bénévole.</p>
    <p>Nous vous proposons les créneaux suivants :</p>
    <ul style="padding-left: 24px;">${slotItems}</ul>
    ${adminNote ? `<p style="background: #fff7ed; border-left: 3px solid #f59e0b; padding: 10px 14px;">${adminNote}</p>` : ''}
    <p>Il vous suffit de répondre à cet email en indiquant le créneau qui vous convient le mieux.</p>
    <p>Au plaisir d'échanger prochainement avec vous.</p>
    <p>L'équipe ${eventLabel}</p>
  </div>`;

  const msg = {
    to: toEmail,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    replyTo: { email: 'staff@lassm.dz', name: 'Staff LASSM' },
    subject,
    html: body,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Volunteer interview proposal sent to ${toEmail}`);
  } catch (err) {
    console.error('SendGrid error (volunteer interview):', err.response?.body?.errors || err.message);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

/**
 * Volunteer validation — sent when admin approves the candidate. Includes their
 * unique volunteer ID.
 */
async function sendVolunteerValidated({ toEmail, firstName, lastName, eventName, volunteerId }) {
  const eventLabel = eventName || 'l\'événement';
  const subject = `Bienvenue dans l'équipe — ${eventName || 'Événement'}`;
  const body = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #444; line-height: 1.55;">
    <p>Bonjour ${firstName || ''},</p>
    <p>Nous avons le plaisir de vous confirmer que votre candidature a été retenue : vous faites désormais officiellement partie de l'équipe des bénévoles de <strong>${eventLabel}</strong>.</p>
    <p>Bienvenue dans l'aventure.</p>
    <div style="text-align: center; margin: 28px 0;">
      <p style="color: #666; font-size: 13px; margin: 0 0 6px;">Votre identifiant bénévole</p>
      <p style="font-family: monospace; font-size: 28px; font-weight: bold; color: #C42826; margin: 0; letter-spacing: 2px;">${volunteerId}</p>
    </div>
    <p>Merci de le conserver précieusement, il vous sera demandé lors des briefings ainsi que le jour de l'événement.</p>
    <p>Toutes les informations relatives à l'organisation et aux prochaines étapes vous seront communiquées prochainement.</p>
    <p>Pour toute question, vous pouvez simplement répondre à cet email.</p>
    <p>À très bientôt,</p>
    <p>L'équipe ${eventLabel}</p>
  </div>`;

  const msg = {
    to: toEmail,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    replyTo: { email: 'staff@lassm.dz', name: 'Staff LASSM' },
    subject,
    html: body,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Volunteer validation sent to ${toEmail} (id=${volunteerId})`);
  } catch (err) {
    console.error('SendGrid error (volunteer validated):', err.response?.body?.errors || err.message);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

/**
 * Volunteer rejection — sent when admin declines the candidate.
 */
async function sendVolunteerRejected({ toEmail, firstName, eventName }) {
  const eventLabel = eventName || 'l\'événement';
  const subject = `Candidature bénévole — ${eventName || 'Événement'}`;
  const body = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #444; line-height: 1.55;">
    <p>Bonjour ${firstName || ''},</p>
    <p>Merci pour l'intérêt porté à <strong>${eventLabel}</strong> ainsi que pour le temps consacré à votre candidature.</p>
    <p>Après étude de votre profil, nous ne sommes malheureusement pas en mesure de donner une suite favorable à votre demande pour cette édition.</p>
    <p>Ce choix ne remet pas en cause votre motivation ou votre intérêt pour l'événement, mais résulte principalement des besoins actuels de l'organisation et du nombre limité de places disponibles au sein de l'équipe bénévole.</p>
    <p>Nous vous remercions sincèrement pour votre démarche et espérons avoir l'occasion de vous compter parmi nous lors d'une prochaine édition ou sur de futurs projets.</p>
    <p>Nous vous souhaitons une excellente continuation.</p>
    <p>L'équipe ${eventLabel}</p>
  </div>`;

  const msg = {
    to: toEmail,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    replyTo: { email: 'staff@lassm.dz', name: 'Staff LASSM' },
    subject,
    html: body,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`Volunteer rejection sent to ${toEmail}`);
  } catch (err) {
    console.error('SendGrid error (volunteer rejected):', err.response?.body?.errors || err.message);
    throw new Error('Erreur lors de l\'envoi de l\'email');
  }
}

module.exports = {
  sendConfirmationEmail,
  sendInvitationEmail,
  sendOtpEmail,
  sendReconciliationInvitation,
  sendLateRegistrationInvitation,
  sendVolunteerInterviewProposal,
  sendVolunteerValidated,
  sendVolunteerRejected,
};
