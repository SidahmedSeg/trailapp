const sgMail = require('@sendgrid/mail');
const env = require('../config/env');
const { generateTicketPDF } = require('../services/pdf');
const { AppError } = require('../utils/errors');

sgMail.setApiKey(env.SENDGRID_API_KEY);

async function emailRoutes(fastify) {
  const { prisma } = fastify;

  // POST /api/registration/:id/send-pdf
  fastify.post('/registration/:id/send-pdf', async (request) => {
    const registration = await prisma.registration.findUnique({
      where: { id: request.params.id },
      include: { event: { select: { name: true, date: true, location: true } } },
    });
    if (!registration) throw new AppError(404, 'Inscription non trouvée', 'NOT_FOUND');
    if (!registration.bibNumber) {
      throw new AppError(400, 'Inscription incomplète', 'INCOMPLETE');
    }

    const eventName = registration.event?.name || 'Événement';
    const pdfBuffer = await generateTicketPDF(registration);

    const msg = {
      to: registration.email,
      from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
      subject: `Votre ticket - ${eventName} - Dossard #${registration.bibNumber}`,
      html: `<p>Bonjour ${registration.firstName},</p>
<p>Vous trouverez ci-joint votre ticket de confirmation pour ${eventName}.</p>
<p>Votre numéro de dossard : <strong>#${registration.bibNumber}</strong></p>
<p>À bientôt !</p>`,
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
    } catch (err) {
      console.error('SendGrid error:', err.response?.body?.errors || err.message);
      throw new AppError(500, 'Erreur lors de l\'envoi de l\'email', 'EMAIL_ERROR');
    }

    // Log the email
    await prisma.emailLog.create({
      data: {
        registrationId: registration.id,
        templateName: 'confirmation',
        sentBy: request.user?.username || 'system',
      },
    });

    return { success: true, message: `PDF envoyé à ${registration.email}` };
  });
}

module.exports = emailRoutes;
