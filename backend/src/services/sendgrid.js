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

  const body = template.body
    .replace(/\{\{prenom\}\}/g, registration.firstName)
    .replace(/\{\{nom\}\}/g, registration.lastName)
    .replace(/\{\{dossard\}\}/g, String(registration.bibNumber))
    .replace(/\{\{email\}\}/g, registration.email);

  // Generate PDF attachment
  const pdfBuffer = await generateTicketPDF(registration);

  const msg = {
    to: registration.email,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject: template.subject,
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

module.exports = { sendConfirmationEmail, sendInvitationEmail, sendOtpEmail };
