/**
 * Communication module — admin email composer + async send + history.
 *
 * Access:
 *   - super_admin, admin_volunteers (AB)  → any audience type
 *   - team_leader_volunteers (TLB)        → server-forced to volunteers_by_tlb
 *                                           with audienceParam = own userId
 *
 * Send mode:
 *   POST /campaigns creates the row and fires runCampaign(id) WITHOUT awaiting.
 *   UI polls GET /campaigns/:id every few seconds for status + counts.
 */

const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');
const { getActiveEvent } = require('../services/event');
const {
  AUDIENCE_TYPES,
  VOLUNTEER_STATUSES,
  resolveAudience,
  getAudienceCount,
  runCampaign,
  fromForAudience,
  pipeJoinEmails,
  parseCustomEmails,
} = require('../services/communication');
const { renderTemplate, htmlToPlainText } = require('../services/templating');
const { sendGenericEmail } = require('../services/sendgrid');

const ALL_ROLES = ['super_admin', 'admin_volunteers', 'team_leader_volunteers'];

const PRIVILEGED_ROLES = ['super_admin', 'admin_volunteers'];

function isTlb(user) {
  return user?.role === 'team_leader_volunteers';
}

function isAB(user) {
  return user?.role === 'admin_volunteers';
}

// AB is restricted to bénévole audiences only. No coureurs, no custom emails.
const AB_ALLOWED_AUDIENCES = new Set(['all_volunteers', 'volunteers_by_tlb']);

async function communicationRoutes(fastify) {
  const { prisma } = fastify;

  async function resolveEventId(query) {
    if (query?.eventId) return query.eventId;
    const event = await getActiveEvent(prisma);
    return event?.id || null;
  }

  /**
   * For TLB users, server-force the audience scope no matter what they sent.
   * For privileged users, validate the shape they sent.
   * Returns { audienceType, audienceParam }.
   */
  function normalizeAudience(user, audienceType, audienceParam) {
    if (isTlb(user)) {
      return { audienceType: 'volunteers_by_tlb', audienceParam: user.userId };
    }
    if (!AUDIENCE_TYPES.includes(audienceType)) {
      throw new AppError(400, 'Audience invalide', 'VALIDATION_ERROR');
    }
    // AB is locked to bénévole audiences — block coureurs and custom emails.
    if (isAB(user) && !AB_ALLOWED_AUDIENCES.has(audienceType)) {
      throw new AppError(403, 'Audience non autorisée pour ce rôle', 'FORBIDDEN');
    }
    if (audienceType === 'volunteers_by_tlb' && !audienceParam) {
      throw new AppError(400, 'TLB id requis', 'VALIDATION_ERROR');
    }
    if (audienceType === 'custom') {
      const normalized = pipeJoinEmails(audienceParam || '');
      if (!normalized) throw new AppError(400, 'Au moins un email valide requis', 'VALIDATION_ERROR');
      return { audienceType, audienceParam: normalized };
    }
    if (audienceType === 'all_volunteers' && audienceParam) {
      // Optional comma-separated whitelist of Volunteer.status values. Empty → all.
      const parts = String(audienceParam).split(',').map((s) => s.trim()).filter(Boolean);
      const unknown = parts.filter((s) => !VOLUNTEER_STATUSES.includes(s));
      if (unknown.length > 0) {
        throw new AppError(400, `Statut bénévole inconnu : ${unknown.join(', ')}`, 'VALIDATION_ERROR');
      }
      const normalized = [...new Set(parts)].sort().join(',');
      // All four selected → equivalent to "no filter" → drop the param to keep the
      // backward-compat semantics (audienceParam=null means "send to all").
      return {
        audienceType,
        audienceParam: normalized && normalized.split(',').length < VOLUNTEER_STATUSES.length ? normalized : null,
      };
    }
    return { audienceType, audienceParam: audienceParam || null };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/communication/audience-count?audienceType=&audienceParam=&eventId=
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get(
    '/admin/communication/audience-count',
    { preHandler: [authenticate, authorize(...ALL_ROLES)] },
    async (request) => {
      const { audienceType, audienceParam } = normalizeAudience(
        request.user,
        request.query.audienceType,
        request.query.audienceParam
      );
      const eventId = await resolveEventId(request.query);
      const count = await getAudienceCount(prisma, audienceType, audienceParam, eventId);
      return { count, audienceType, audienceParam, eventId };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/communication/team-leaders — dropdown for "Bénévole par TLB"
  // (privileged roles only — TLBs don't choose, they ARE the scope)
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get(
    '/admin/communication/team-leaders',
    { preHandler: [authenticate, authorize(...PRIVILEGED_ROLES)] },
    async () => {
      const users = await prisma.adminUser.findMany({
        where: { role: 'team_leader_volunteers', active: true },
        select: { id: true, username: true, email: true },
        orderBy: { username: 'asc' },
      });
      return users;
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // POST /admin/communication/campaigns
  // Body: { audienceType, audienceParam?, subject, bodyHtml, eventId? }
  // Returns: { id, totalCount } immediately. runCampaign() is fire-and-forget.
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post(
    '/admin/communication/campaigns',
    { preHandler: [authenticate, authorize(...ALL_ROLES)] },
    async (request) => {
      const body = request.body || {};
      const { audienceType, audienceParam } = normalizeAudience(
        request.user,
        body.audienceType,
        body.audienceParam
      );

      const subject = (body.subject || '').trim();
      const bodyHtml = body.bodyHtml || '';
      if (!subject) throw new AppError(400, 'Sujet requis', 'VALIDATION_ERROR');
      if (!bodyHtml || !bodyHtml.trim()) throw new AppError(400, 'Corps requis', 'VALIDATION_ERROR');

      const eventId = await resolveEventId(body);
      const totalCount = await getAudienceCount(prisma, audienceType, audienceParam, eventId);
      if (totalCount === 0) {
        throw new AppError(400, 'Aucun destinataire pour cette audience', 'EMPTY_AUDIENCE');
      }

      const from = fromForAudience(audienceType);
      const bodyText = htmlToPlainText(bodyHtml);

      const campaign = await prisma.communicationCampaign.create({
        data: {
          eventId,
          audienceType,
          audienceParam,
          subject,
          bodyHtml,
          bodyText,
          fromEmail: from.email,
          fromName: from.name,
          totalCount,
          status: 'pending',
          createdBy: request.user.username,
        },
      });

      await logActivity({
        action: 'communication_campaign_sent',
        adminUsername: request.user.username,
        targetType: 'communication_campaign',
        targetId: campaign.id,
        details: { audienceType, audienceParam, totalCount, subject, eventId },
      });

      // Fire-and-forget. Errors are caught inside runCampaign.
      runCampaign(prisma, campaign.id);

      return { id: campaign.id, totalCount };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // POST /admin/communication/campaigns/test
  // Body: { audienceType, audienceParam?, subject, bodyHtml, eventId? }
  // Sends ONE email to the admin's own address using the first resolved
  // recipient's variables (or just event vars). Does NOT create a campaign row.
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post(
    '/admin/communication/campaigns/test',
    { preHandler: [authenticate, authorize(...ALL_ROLES)] },
    async (request) => {
      const body = request.body || {};
      const { audienceType, audienceParam } = normalizeAudience(
        request.user,
        body.audienceType,
        body.audienceParam
      );

      const subject = (body.subject || '').trim();
      const bodyHtml = body.bodyHtml || '';
      if (!subject) throw new AppError(400, 'Sujet requis', 'VALIDATION_ERROR');
      if (!bodyHtml || !bodyHtml.trim()) throw new AppError(400, 'Corps requis', 'VALIDATION_ERROR');

      const me = await prisma.adminUser.findUnique({
        where: { id: request.user.userId },
        select: { email: true, username: true },
      });
      if (!me?.email) throw new AppError(400, 'Aucune adresse email sur votre compte', 'NO_EMAIL');

      const eventId = await resolveEventId(body);
      const recipients = await resolveAudience(prisma, {
        eventId,
        audienceType,
        audienceParam,
      });
      const sampleVars = recipients[0]?.vars || {};
      const from = fromForAudience(audienceType);

      const renderedSubject = `[TEST] ${renderTemplate(subject, sampleVars)}`;
      const renderedHtml = renderTemplate(bodyHtml, sampleVars);
      const renderedText = htmlToPlainText(renderedHtml);

      await sendGenericEmail({
        to: me.email,
        from: from.email,
        fromName: from.name,
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
      });

      return { ok: true, to: me.email };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/communication/campaigns?page=&limit=&eventId=
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get(
    '/admin/communication/campaigns',
    { preHandler: [authenticate, authorize(...ALL_ROLES)] },
    async (request) => {
      const { page = '1', limit = '20', eventId } = request.query;
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const where = {};
      if (eventId) where.eventId = eventId;
      if (isTlb(request.user)) where.createdBy = request.user.username;

      const [data, total] = await Promise.all([
        prisma.communicationCampaign.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.communicationCampaign.count({ where }),
      ]);
      return { data, total, page: pageNum, pages: Math.ceil(total / limitNum) };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/communication/campaigns/:id — used by polling
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get(
    '/admin/communication/campaigns/:id',
    { preHandler: [authenticate, authorize(...ALL_ROLES)] },
    async (request) => {
      const campaign = await prisma.communicationCampaign.findUnique({
        where: { id: request.params.id },
      });
      if (!campaign) throw new AppError(404, 'Campagne introuvable', 'NOT_FOUND');
      if (isTlb(request.user) && campaign.createdBy !== request.user.username) {
        throw new AppError(403, 'Accès refusé', 'FORBIDDEN');
      }
      return campaign;
    }
  );
}

module.exports = communicationRoutes;
module.exports.parseCustomEmails = parseCustomEmails;
