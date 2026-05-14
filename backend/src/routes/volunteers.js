/**
 * Volunteer ("Bénévoles") module — admin tools + public registration form.
 *
 * Flow:
 *  1. Admin toggles event.volunteersOpen=true via PUT /admin/events/:id
 *  2. Public visits /benevoles/<eventSlug> and submits the multipart form
 *     (personal info + CV file + ID file). Status starts as "en_attente".
 *  3. Admin reviews CV/ID in the admin drawer, clicks "Plan interview" → modal
 *     with 3 datetime slots → email sent (reply-to staff@lassm.dz).
 *  4. Admin/volunteer coordinate outside the app via email.
 *  5. Admin clicks "Valider candidat" → status flips to "validee", a unique
 *     volunteer ID is generated (event initials + 4 random digits), email
 *     sent with that ID.
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { randomUUID } = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');
const { AppError } = require('../utils/errors');
const { sendVolunteerInterviewProposal, sendVolunteerValidated, sendVolunteerRejected } = require('../services/sendgrid');

const VOLUNTEER_ROLES = ['super_admin', 'admin', 'volunteers_manager'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB per file
const ALLOWED_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
};

/**
 * Generate a volunteer ID prefix from an event name.
 * Strategy: split on whitespace, drop French elisions ("d'Or" → "Or"), keep
 * only words that start with an uppercase letter, take their first letter.
 *   "Trail des Mouflons d'Or 2026"  →  "TMO"
 *   "ALGIERS URBAN TRAIL 2026"      →  "AUT"
 * Falls back to first 3 uppercase letters of the name if heuristics yield none.
 */
function buildVolunteerPrefix(eventName) {
  const name = String(eventName || '').trim();
  if (!name) return 'VOL';

  const prefix = name
    .split(/\s+/)
    .map((word) => {
      // Handle French elisions like "d'Or" → keep the part after the apostrophe
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts[parts.length - 1] || word;
      }
      return word;
    })
    .filter((w) => /^[A-Z]/.test(w)) // word starts with an uppercase letter (post-elision)
    .map((w) => w[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();

  if (prefix.length >= 2) return prefix;

  // Fallback — first 3 alphabetic chars uppercased
  const fallback = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return fallback || 'VOL';
}

async function generateUniqueVolunteerId(prisma, eventId, prefix) {
  // 4 random digits → 10 000 possibilities per event. Retry on collision.
  for (let attempt = 0; attempt < 25; attempt++) {
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const candidate = `${prefix}${digits}`;
    const existing = await prisma.volunteer.findFirst({
      where: { eventId, volunteerId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new AppError(500, 'Impossible de générer un identifiant unique', 'ID_EXHAUSTED');
}

async function volunteerRoutes(fastify) {
  const { prisma } = fastify;

  // ────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ────────────────────────────────────────────────────────────────────

  // GET /api/admin/volunteers?eventId=&status=
  fastify.get(
    '/admin/volunteers',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request) => {
      const { eventId, status, search } = request.query;
      if (!eventId) throw new AppError(400, 'eventId requis', 'VALIDATION_ERROR');

      const where = { eventId };
      if (status && status !== 'all') where.status = status;
      if (search) {
        const s = search.trim();
        if (s) {
          where.OR = [
            { firstName: { contains: s, mode: 'insensitive' } },
            { lastName: { contains: s, mode: 'insensitive' } },
            { email: { contains: s, mode: 'insensitive' } },
            { volunteerId: { contains: s, mode: 'insensitive' } },
            { phone: { contains: s } },
          ];
        }
      }

      const rows = await prisma.volunteer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return rows;
    }
  );

  // GET /api/admin/volunteers/:id
  fastify.get(
    '/admin/volunteers/:id',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request) => {
      const row = await prisma.volunteer.findUnique({
        where: { id: request.params.id },
        include: { event: { select: { name: true, slug: true, primaryColor: true } } },
      });
      if (!row) throw new AppError(404, 'Bénévole introuvable', 'NOT_FOUND');
      return row;
    }
  );

  // POST /api/admin/volunteers/:id/plan-interview
  // Body: { slots: [iso, iso, iso], adminNote? }
  fastify.post(
    '/admin/volunteers/:id/plan-interview',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request) => {
      const { slots, adminNote } = request.body || {};
      if (!Array.isArray(slots) || slots.filter(Boolean).length === 0) {
        throw new AppError(400, 'Au moins un créneau requis', 'VALIDATION_ERROR');
      }
      const cleanSlots = slots.filter(Boolean).slice(0, 3);
      // Validate each slot is a parseable date
      for (const s of cleanSlots) {
        if (Number.isNaN(new Date(s).getTime())) {
          throw new AppError(400, 'Créneau invalide', 'VALIDATION_ERROR');
        }
      }

      const row = await prisma.volunteer.findUnique({
        where: { id: request.params.id },
        include: { event: { select: { name: true } } },
      });
      if (!row) throw new AppError(404, 'Bénévole introuvable', 'NOT_FOUND');
      if (row.status === 'validee') {
        throw new AppError(409, 'Ce candidat est déjà validé', 'ALREADY_VALIDATED');
      }

      try {
        await sendVolunteerInterviewProposal({
          toEmail: row.email,
          firstName: row.firstName,
          eventName: row.event?.name || 'Événement',
          slots: cleanSlots,
          adminNote: adminNote || null,
        });
      } catch (err) {
        request.log.error(err, 'Volunteer interview email failed');
        throw new AppError(502, 'Erreur lors de l\'envoi de l\'email', 'EMAIL_FAILED');
      }

      // Move the status forward to `interview_planned` (unless already validated;
      // we guard against that earlier). Allow re-planning on an already-planned
      // row without status change — it'll already be 'interview_planned'.
      const updated = await prisma.volunteer.update({
        where: { id: row.id },
        data: {
          status: 'interview_planned',
          interviewSlots: cleanSlots,
          interviewSentAt: new Date(),
          interviewSentTo: row.email,
        },
      });

      await logActivity({
        action: 'volunteer_interview_proposed',
        adminUsername: request.user.username,
        targetType: 'volunteer',
        targetId: row.id,
        details: {
          eventId: row.eventId,
          email: row.email,
          slots: cleanSlots,
          slotCount: cleanSlots.length,
        },
      });

      return { sent: true, slots: cleanSlots, sentTo: row.email };
    }
  );

  // POST /api/admin/volunteers/:id/validate
  fastify.post(
    '/admin/volunteers/:id/validate',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request) => {
      const row = await prisma.volunteer.findUnique({
        where: { id: request.params.id },
        include: { event: { select: { name: true } } },
      });
      if (!row) throw new AppError(404, 'Bénévole introuvable', 'NOT_FOUND');
      if (row.status === 'validee' && row.volunteerId) {
        throw new AppError(409, 'Ce candidat est déjà validé', 'ALREADY_VALIDATED');
      }

      // Generate volunteer ID if not already assigned
      const prefix = buildVolunteerPrefix(row.event?.name);
      const volunteerId = row.volunteerId || (await generateUniqueVolunteerId(prisma, row.eventId, prefix));

      const updated = await prisma.volunteer.update({
        where: { id: row.id },
        data: {
          status: 'validee',
          volunteerId,
          validatedAt: new Date(),
          validatedBy: request.user.username,
        },
      });

      try {
        await sendVolunteerValidated({
          toEmail: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          eventName: row.event?.name || 'Événement',
          volunteerId,
        });
      } catch (err) {
        request.log.error(err, 'Volunteer validation email failed');
        // Don't block the validation if email fails — admin can resend
      }

      await logActivity({
        action: 'volunteer_validated',
        adminUsername: request.user.username,
        targetType: 'volunteer',
        targetId: row.id,
        details: {
          eventId: row.eventId,
          email: row.email,
          volunteerId,
        },
      });

      return { validated: true, volunteerId };
    }
  );

  // POST /api/admin/volunteers/:id/reject
  // Marks the candidate as rejected and sends a rejection email.
  fastify.post(
    '/admin/volunteers/:id/reject',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request) => {
      const row = await prisma.volunteer.findUnique({
        where: { id: request.params.id },
        include: { event: { select: { name: true } } },
      });
      if (!row) throw new AppError(404, 'Bénévole introuvable', 'NOT_FOUND');
      if (row.status === 'validee') {
        throw new AppError(409, 'Ce candidat est déjà validé, impossible de le rejeter', 'ALREADY_VALIDATED');
      }
      if (row.status === 'rejected') {
        throw new AppError(409, 'Ce candidat est déjà rejeté', 'ALREADY_REJECTED');
      }

      await prisma.volunteer.update({
        where: { id: row.id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: request.user.username,
        },
      });

      try {
        await sendVolunteerRejected({
          toEmail: row.email,
          firstName: row.firstName,
          eventName: row.event?.name || 'Événement',
        });
      } catch (err) {
        request.log.error(err, 'Volunteer rejection email failed');
        // Don't block status change if email fails — admin can manually contact the candidate
      }

      await logActivity({
        action: 'volunteer_rejected',
        adminUsername: request.user.username,
        targetType: 'volunteer',
        targetId: row.id,
        details: {
          eventId: row.eventId,
          email: row.email,
        },
      });

      return { rejected: true };
    }
  );

  // PUT /api/admin/volunteers/:id — admin notes only (light edit)
  fastify.put(
    '/admin/volunteers/:id',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request) => {
      const { notes } = request.body || {};
      const updated = await prisma.volunteer.update({
        where: { id: request.params.id },
        data: { notes: notes ?? null },
      });
      return updated;
    }
  );

  // GET /api/admin/volunteers/:id/file?which=cv|id
  // Serves the uploaded file. Auth-required so files don't leak.
  fastify.get(
    '/admin/volunteers/:id/file',
    { preHandler: [authenticate, authorize(...VOLUNTEER_ROLES)] },
    async (request, reply) => {
      const which = request.query.which === 'id' ? 'id' : 'cv';
      const row = await prisma.volunteer.findUnique({
        where: { id: request.params.id },
        select: { cvPath: true, idPath: true },
      });
      if (!row) throw new AppError(404, 'Bénévole introuvable', 'NOT_FOUND');
      const relPath = which === 'cv' ? row.cvPath : row.idPath;
      if (!relPath) throw new AppError(404, 'Fichier non disponible', 'NO_FILE');

      const absPath = path.resolve(__dirname, '../..', relPath.replace(/^\/+/, ''));
      const uploadsRoot = path.resolve(__dirname, '../../uploads');
      if (!absPath.startsWith(uploadsRoot)) {
        throw new AppError(403, 'Chemin invalide', 'FORBIDDEN');
      }
      if (!fs.existsSync(absPath)) throw new AppError(404, 'Fichier introuvable', 'NO_FILE');

      const ext = path.extname(absPath).toLowerCase();
      const mime =
        ext === '.pdf'  ? 'application/pdf' :
        ext === '.jpg'  ? 'image/jpeg' :
        ext === '.jpeg' ? 'image/jpeg' :
        ext === '.png'  ? 'image/png' :
        'application/octet-stream';
      reply.header('Content-Type', mime);
      reply.header('Content-Disposition', `inline; filename="${which}${ext}"`);
      return reply.send(fs.createReadStream(absPath));
    }
  );

  // ────────────────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS
  // ────────────────────────────────────────────────────────────────────

  // GET /api/volunteer/check/:slug — returns whether the event accepts volunteers + event display info
  fastify.get('/volunteer/check/:slug', async (request) => {
    const event = await prisma.event.findUnique({
      where: { slug: request.params.slug },
      select: {
        id: true, slug: true, name: true, type: true, date: true, location: true,
        primaryColor: true, logoPath: true, coverImagePath: true,
        volunteersOpen: true, status: true, contactEmail: true, contactPhone: true,
      },
    });
    if (!event) throw new AppError(404, 'Événement introuvable', 'NOT_FOUND');
    if (!event.volunteersOpen) {
      throw new AppError(403, 'Les inscriptions bénévoles ne sont pas ouvertes pour cet événement', 'VOLUNTEERS_CLOSED');
    }
    return { event };
  });

  // POST /api/volunteer/:slug/register — multipart: fields + cv + idDoc
  fastify.post('/volunteer/:slug/register', async (request, reply) => {
    const event = await prisma.event.findUnique({
      where: { slug: request.params.slug },
      select: { id: true, slug: true, name: true, volunteersOpen: true },
    });
    if (!event) throw new AppError(404, 'Événement introuvable', 'NOT_FOUND');
    if (!event.volunteersOpen) {
      throw new AppError(403, 'Les inscriptions bénévoles ne sont pas ouvertes', 'VOLUNTEERS_CLOSED');
    }

    // Parse multipart parts
    const fields = {};
    const files = {};

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = ALLOWED_MIME[part.mimetype];
        if (!ext) {
          throw new AppError(400, `Type de fichier non autorisé pour ${part.fieldname} (PDF/JPG/PNG uniquement)`, 'INVALID_FILE_TYPE');
        }
        // Buffer up while enforcing the size cap
        const chunks = [];
        let size = 0;
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > MAX_UPLOAD_BYTES) {
            throw new AppError(400, `Fichier trop volumineux (5 Mo max)`, 'FILE_TOO_LARGE');
          }
          chunks.push(chunk);
        }
        files[part.fieldname] = { buffer: Buffer.concat(chunks), ext };
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    // Validate required fields
    const required = ['firstName', 'lastName', 'email', 'phone'];
    for (const f of required) {
      if (!fields[f] || !String(fields[f]).trim()) {
        throw new AppError(400, `Champ requis manquant : ${f}`, 'VALIDATION_ERROR');
      }
    }
    if (!/^\S+@\S+\.\S+$/.test(fields.email)) {
      throw new AppError(400, 'Email invalide', 'VALIDATION_ERROR');
    }
    if (!files.idDoc) throw new AppError(400, 'Pièce d\'identité requise (PDF, JPG ou PNG)', 'ID_REQUIRED');

    // Single consolidated règlement acknowledgment — submitted as 'true' string
    // (FormData has no real booleans). Older accepted-engagements are kept on
    // existing rows but the current form only requires this one.
    const asBool = (v) => v === true || v === 'true' || v === '1' || v === 'on';
    const agreedRules = asBool(fields.agreedRules);
    if (!agreedRules) {
      throw new AppError(400, 'Vous devez accepter le règlement et les engagements du bénévole', 'AGREEMENTS_REQUIRED');
    }

    // Parse skills JSON if present (frontend sends a JSON-encoded array)
    let skills = null;
    if (fields.skills) {
      try {
        const parsed = JSON.parse(fields.skills);
        if (Array.isArray(parsed)) skills = parsed.filter((s) => typeof s === 'string').slice(0, 20);
      } catch { /* ignore malformed input */ }
    }

    const emailLower = fields.email.toLowerCase().trim();

    // Reject duplicate email for this event
    const existing = await prisma.volunteer.findFirst({
      where: { eventId: event.id, email: emailLower },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, 'Une candidature existe déjà avec cet email', 'EMAIL_TAKEN');
    }

    // Create the row first (so we have an id for the file path)
    const volunteerRowId = randomUUID();
    const dir = path.resolve(__dirname, `../../uploads/volunteers/${event.id}/${volunteerRowId}`);
    fs.mkdirSync(dir, { recursive: true });

    const idFilename = `id${files.idDoc.ext}`;
    fs.writeFileSync(path.join(dir, idFilename), files.idDoc.buffer);

    const idPath = `/uploads/volunteers/${event.id}/${volunteerRowId}/${idFilename}`;

    const volunteer = await prisma.volunteer.create({
      data: {
        id: volunteerRowId,
        eventId: event.id,
        lastName: String(fields.lastName).trim(),
        firstName: String(fields.firstName).trim(),
        email: emailLower,
        phone: String(fields.phone).trim(),
        birthDate: fields.birthDate ? new Date(fields.birthDate) : null,
        gender: fields.gender ? String(fields.gender) : null,
        nationality: fields.nationality ? String(fields.nationality) : null,
        wilaya: fields.wilaya ? String(fields.wilaya).trim() : null,
        commune: fields.commune ? String(fields.commune).trim() : null,
        motivation: fields.motivation ? String(fields.motivation) : null,
        // Availability & skills
        availableRaceDay: asBool(fields.availableRaceDay),
        canArriveEarly: asBool(fields.canArriveEarly),
        previousExperience: fields.previousExperience ? String(fields.previousExperience).trim() : null,
        languagesSpoken: fields.languagesSpoken ? String(fields.languagesSpoken).trim() : null,
        canStandLongTime: asBool(fields.canStandLongTime),
        tshirtSize: fields.tshirtSize ? String(fields.tshirtSize) : null,
        skills,
        otherSkills: fields.otherSkills ? String(fields.otherSkills).trim() : null,
        // Emergency contact
        emergencyContactName: fields.emergencyContactName ? String(fields.emergencyContactName).trim() : null,
        emergencyContactPhone: fields.emergencyContactPhone ? String(fields.emergencyContactPhone).trim() : null,
        // Agreements (single consolidated règlement)
        agreedRules,
        idPath,
        status: 'en_attente',
      },
    });

    return {
      id: volunteer.id,
      message: 'Candidature reçue. L\'équipe vous contactera prochainement.',
    };
  });
}

module.exports = volunteerRoutes;
