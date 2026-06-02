const { sendGenericEmail } = require('./sendgrid');
const { renderTemplate, htmlToPlainText } = require('./templating');

const CONCURRENCY = 5;
const DB_FLUSH_EVERY = 20;        // flush counts every N emails…
const DB_FLUSH_INTERVAL_MS = 5000; // …or every 5 seconds, whichever first
const RATE_LIMIT_BACKOFFS_MS = [1000, 2000, 4000];

const AUDIENCE_TYPES = ['custom', 'all_runners', 'all_volunteers', 'volunteers_by_tlb'];

const VOLUNTEER_STATUSES = ['en_attente', 'interview_planned', 'validee', 'rejected'];

// For all_volunteers, audienceParam is a CSV of statuses (subset of VOLUNTEER_STATUSES)
// or null/empty to mean "all statuses" (backward-compat with pre-filter campaigns).
function parseVolunteerStatuses(param) {
  if (!param || typeof param !== 'string') return null;
  const parsed = param.split(',').map((s) => s.trim()).filter(Boolean);
  const valid = parsed.filter((s) => VOLUNTEER_STATUSES.includes(s));
  if (valid.length === 0 || valid.length === VOLUNTEER_STATUSES.length) return null;
  return valid;
}

const RUNNER_DISTRIBUTION_STATUSES = ['en_attente', 'distribué'];
const RUNNER_CHECKIN_BUCKETS = ['present', 'absent'];

// For all_runners, audienceParam is a JSON object:
//   { distribution?: string[], checkin?: string[], level?: string[] }
// Each dimension is optional. Empty / missing / "all values selected" → no filter
// for that dimension. Returns a normalised filter object or null if no narrowing.
function parseRunnerFilters(param) {
  if (!param || typeof param !== 'string') return null;
  let obj;
  try { obj = JSON.parse(param); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;

  const out = {};

  if (Array.isArray(obj.distribution)) {
    const valid = [...new Set(obj.distribution.filter((v) => RUNNER_DISTRIBUTION_STATUSES.includes(v)))];
    if (valid.length > 0 && valid.length < RUNNER_DISTRIBUTION_STATUSES.length) {
      out.distribution = valid;
    }
  }
  if (Array.isArray(obj.checkin)) {
    const valid = [...new Set(obj.checkin.filter((v) => RUNNER_CHECKIN_BUCKETS.includes(v)))];
    if (valid.length === 1) out.checkin = valid;
  }
  if (Array.isArray(obj.level)) {
    const valid = [...new Set(obj.level.filter((v) => typeof v === 'string' && v.trim()))];
    if (valid.length > 0) out.level = valid;
  }

  return Object.keys(out).length > 0 ? out : null;
}

const FROM_RULES = {
  all_runners:        { email: 'noreply@lassm.dz', name: 'LASSM' },
  all_volunteers:     { email: 'staff@lassm.dz',   name: 'LASSM' },
  volunteers_by_tlb:  { email: 'staff@lassm.dz',   name: 'LASSM' },
  custom:             { email: 'staff@lassm.dz',   name: 'LASSM' },
};

function fromForAudience(audienceType) {
  return FROM_RULES[audienceType] || FROM_RULES.custom;
}

function buildEventVars(event) {
  return {
    eventName: event?.name || '',
    eventDate: event?.date ? new Date(event.date).toLocaleDateString('fr-FR') : '',
    eventLocation: event?.location || '',
  };
}

function buildRunnerVars(reg, event) {
  return {
    ...buildEventVars(event),
    firstName: reg.firstName || '',
    lastName: reg.lastName || '',
    email: reg.email || '',
    bibNumber: reg.bibNumber != null ? String(reg.bibNumber) : '',
    runnerLevel: reg.runnerLevel || '',
  };
}

function buildVolunteerVars(vol, event) {
  return {
    ...buildEventVars(event),
    firstName: vol.firstName || '',
    lastName: vol.lastName || '',
    email: vol.email || '',
    volunteerId: vol.volunteerId || '',
  };
}

function parseCustomEmails(audienceParam) {
  if (!audienceParam) return [];
  return audienceParam
    .split(/[|,;\n\r]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function pipeJoinEmails(audienceParam) {
  return parseCustomEmails(audienceParam).join('|');
}

/**
 * Resolve a campaign's audience into `[{email, vars}]`.
 * Pure read — no mutation.
 */
async function resolveAudience(prisma, campaign) {
  const event = campaign.eventId
    ? await prisma.event.findUnique({ where: { id: campaign.eventId } })
    : null;

  switch (campaign.audienceType) {
    case 'all_runners': {
      if (!campaign.eventId) return [];
      const filters = parseRunnerFilters(campaign.audienceParam);
      const where = {
        eventId: campaign.eventId,
        paymentStatus: { in: ['success', 'manual'] },
        email: { not: '' },
      };
      if (filters?.distribution) where.status = { in: filters.distribution };
      if (filters?.checkin) {
        where.checkedInAt = filters.checkin[0] === 'present' ? { not: null } : null;
      }
      if (filters?.level) where.runnerLevel = { in: filters.level };
      const rows = await prisma.registration.findMany({
        where,
        select: {
          firstName: true, lastName: true, email: true,
          bibNumber: true, runnerLevel: true,
        },
      });
      return rows
        .filter((r) => r.email)
        .map((r) => ({ email: r.email, vars: buildRunnerVars(r, event) }));
    }
    case 'all_volunteers': {
      if (!campaign.eventId) return [];
      const statuses = parseVolunteerStatuses(campaign.audienceParam);
      const rows = await prisma.volunteer.findMany({
        where: {
          eventId: campaign.eventId,
          ...(statuses ? { status: { in: statuses } } : {}),
        },
        select: { firstName: true, lastName: true, email: true, volunteerId: true },
      });
      return rows
        .filter((v) => v.email)
        .map((v) => ({ email: v.email, vars: buildVolunteerVars(v, event) }));
    }
    case 'volunteers_by_tlb': {
      if (!campaign.eventId || !campaign.audienceParam) return [];
      const rows = await prisma.volunteer.findMany({
        where: {
          eventId: campaign.eventId,
          assignedToId: campaign.audienceParam,
          status: 'validee',
        },
        select: { firstName: true, lastName: true, email: true, volunteerId: true },
      });
      return rows
        .filter((v) => v.email)
        .map((v) => ({ email: v.email, vars: buildVolunteerVars(v, event) }));
    }
    case 'custom': {
      const emails = parseCustomEmails(campaign.audienceParam);
      const evtVars = buildEventVars(event);
      return emails.map((email) => ({ email, vars: { ...evtVars, email } }));
    }
    default:
      return [];
  }
}

async function getAudienceCount(prisma, audienceType, audienceParam, eventId) {
  if (!AUDIENCE_TYPES.includes(audienceType)) return 0;
  switch (audienceType) {
    case 'all_runners': {
      if (!eventId) return 0;
      const filters = parseRunnerFilters(audienceParam);
      const where = {
        eventId,
        paymentStatus: { in: ['success', 'manual'] },
        email: { not: '' },
      };
      if (filters?.distribution) where.status = { in: filters.distribution };
      if (filters?.checkin) {
        where.checkedInAt = filters.checkin[0] === 'present' ? { not: null } : null;
      }
      if (filters?.level) where.runnerLevel = { in: filters.level };
      return prisma.registration.count({ where });
    }
    case 'all_volunteers': {
      if (!eventId) return 0;
      const statuses = parseVolunteerStatuses(audienceParam);
      return prisma.volunteer.count({
        where: {
          eventId,
          email: { not: '' },
          ...(statuses ? { status: { in: statuses } } : {}),
        },
      });
    }
    case 'volunteers_by_tlb':
      if (!eventId || !audienceParam) return 0;
      return prisma.volunteer.count({
        where: {
          eventId,
          assignedToId: audienceParam,
          status: 'validee',
          email: { not: '' },
        },
      });
    case 'custom':
      return parseCustomEmails(audienceParam).length;
    default:
      return 0;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a single recipient with bounded rate-limit retries.
 * Returns `{ ok: true }` or `{ ok: false, error }`.
 */
async function sendOneWithRetry({ to, from, fromName, subject, html, text }) {
  for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFFS_MS.length; attempt++) {
    try {
      await sendGenericEmail({ to, from, fromName, subject, html, text });
      return { ok: true };
    } catch (err) {
      const code = err?.code || err?.response?.statusCode;
      if (code === 429 && attempt < RATE_LIMIT_BACKOFFS_MS.length) {
        await sleep(RATE_LIMIT_BACKOFFS_MS[attempt]);
        continue;
      }
      return {
        ok: false,
        error: err?.response?.body?.errors?.[0]?.message || err?.message || 'unknown',
      };
    }
  }
  return { ok: false, error: 'rate-limit exhausted' };
}

/**
 * Run a campaign in the background.
 * - Concurrency = 5
 * - DB counts flushed every 20 emails or every 5 seconds
 * - First 5 failures captured as errorSamples
 *
 * Caller fires-and-forgets (does NOT await). Errors are logged, never thrown.
 */
async function runCampaign(prisma, campaignId) {
  try {
    const campaign = await prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { status: 'running', startedAt: new Date() },
    });

    const recipients = await resolveAudience(prisma, campaign);
    if (recipients.length === 0) {
      await prisma.communicationCampaign.update({
        where: { id: campaignId },
        data: { status: 'done', completedAt: new Date(), totalCount: 0 },
      });
      return;
    }

    // Update totalCount in case it drifted vs. the snapshot at creation time
    if (recipients.length !== campaign.totalCount) {
      await prisma.communicationCampaign.update({
        where: { id: campaignId },
        data: { totalCount: recipients.length },
      });
    }

    let sent = 0;
    let failed = 0;
    const errorSamples = [];
    let lastFlushAt = Date.now();
    let lastFlushedSent = 0;
    let lastFlushedFailed = 0;

    const flush = async (force = false) => {
      const sentDelta = sent - lastFlushedSent;
      const failedDelta = failed - lastFlushedFailed;
      const elapsedSinceFlush = Date.now() - lastFlushAt;
      if (
        !force &&
        sentDelta + failedDelta < DB_FLUSH_EVERY &&
        elapsedSinceFlush < DB_FLUSH_INTERVAL_MS
      ) {
        return;
      }
      lastFlushedSent = sent;
      lastFlushedFailed = failed;
      lastFlushAt = Date.now();
      try {
        await prisma.communicationCampaign.update({
          where: { id: campaignId },
          data: {
            sentCount: sent,
            failedCount: failed,
            errorSamples: errorSamples.length ? errorSamples : undefined,
          },
        });
      } catch (e) {
        console.error('[communication] flush failed', e.message);
      }
    };

    // Concurrency pool
    let cursor = 0;
    async function worker() {
      while (cursor < recipients.length) {
        const idx = cursor++;
        const r = recipients[idx];
        const subject = renderTemplate(campaign.subject, r.vars);
        const html = renderTemplate(campaign.bodyHtml, r.vars);
        const text = htmlToPlainText(html);
        const result = await sendOneWithRetry({
          to: r.email,
          from: campaign.fromEmail,
          fromName: campaign.fromName,
          subject,
          html,
          text,
        });
        if (result.ok) {
          sent++;
        } else {
          failed++;
          if (errorSamples.length < 5) {
            errorSamples.push({ email: r.email, message: String(result.error).slice(0, 200) });
          }
        }
        await flush(false);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    await flush(true);

    const finalStatus = failed > 0 && sent === 0 ? 'failed' : 'done';
    await prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        sentCount: sent,
        failedCount: failed,
        errorSamples: errorSamples.length ? errorSamples : undefined,
      },
    });
  } catch (err) {
    console.error(`[communication] runCampaign(${campaignId}) failed:`, err);
    try {
      await prisma.communicationCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorSamples: [{ email: '', message: err?.message?.slice(0, 200) || 'fatal' }],
        },
      });
    } catch (_) {
      /* swallow */
    }
  }
}

/**
 * On boot, mark any `running` campaign older than 1 hour as `failed` —
 * recovers from process restarts mid-send.
 */
async function sweepStuckCampaigns(prisma) {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const result = await prisma.communicationCampaign.updateMany({
    where: { status: 'running', startedAt: { lt: cutoff } },
    data: { status: 'failed', completedAt: new Date() },
  });
  if (result.count > 0) {
    console.log(`[communication] swept ${result.count} stuck running campaign(s) at boot`);
  }
  return result.count;
}

module.exports = {
  AUDIENCE_TYPES,
  VOLUNTEER_STATUSES,
  parseVolunteerStatuses,
  RUNNER_DISTRIBUTION_STATUSES,
  RUNNER_CHECKIN_BUCKETS,
  parseRunnerFilters,
  resolveAudience,
  getAudienceCount,
  runCampaign,
  fromForAudience,
  pipeJoinEmails,
  parseCustomEmails,
  sweepStuckCampaigns,
};
