const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const { authenticate, authorize } = require('../middleware/auth');
const { sendInvitationEmail } = require('../services/sendgrid');
const { AppError } = require('../utils/errors');

async function authRoutes(fastify) {
  const { prisma, redis } = fastify;

  // POST /api/admin/login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      throw new AppError(400, 'Nom d\'utilisateur et mot de passe requis', 'VALIDATION_ERROR');
    }

    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (!user || !user.inviteAccepted || !user.active || !user.passwordHash) {
      throw new AppError(401, 'Identifiants invalides', 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Identifiants invalides', 'INVALID_CREDENTIALS');
    }

    const tokenId = uuidv4();
    const payload = { userId: user.id, username: user.username, role: user.role, tokenId };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ userId: user.id, tokenId });

    // Store refresh token in Redis whitelist (TTL 7 days)
    await redis.set(`refresh:${user.id}:${tokenId}`, 'valid', 'EX', 7 * 24 * 3600);

    return { accessToken, refreshToken, role: user.role, username: user.username };
  });

  // POST /api/admin/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      throw new AppError(400, 'Refresh token requis', 'VALIDATION_ERROR');
    }

    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch {
      throw new AppError(401, 'Refresh token invalide', 'INVALID_TOKEN');
    }

    // Check whitelist
    const key = `refresh:${decoded.userId}:${decoded.tokenId}`;
    const exists = await redis.get(key);
    if (!exists) {
      throw new AppError(401, 'Refresh token révoqué', 'TOKEN_REVOKED');
    }

    // Delete old token (rotation)
    await redis.del(key);

    // Check user still active
    const user = await prisma.adminUser.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.active) {
      throw new AppError(401, 'Compte désactivé', 'ACCOUNT_DISABLED');
    }

    // Issue new tokens
    const newTokenId = uuidv4();
    const payload = { userId: user.id, username: user.username, role: user.role, tokenId: newTokenId };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken({ userId: user.id, tokenId: newTokenId });

    await redis.set(`refresh:${user.id}:${newTokenId}`, 'valid', 'EX', 7 * 24 * 3600);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  });

  // POST /api/admin/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request) => {
    const { userId, tokenId } = request.user;
    await redis.del(`refresh:${userId}:${tokenId}`);
    return { success: true };
  });

  // POST /api/admin/logout-all (super_admin)
  fastify.post('/logout-all', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const { userId } = request.body || {};
    if (!userId) {
      throw new AppError(400, 'userId requis', 'VALIDATION_ERROR');
    }

    // Delete all refresh tokens for user
    const keys = await redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return { success: true, tokensRevoked: keys.length };
  });

  // GET /api/admin/users (super_admin)
  fastify.get('/users', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const users = await prisma.adminUser.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        active: true,
        inviteAccepted: true,
        inviteExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: users };
  });

  // POST /api/admin/users/invite (super_admin)
  fastify.post('/users/invite', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const { username, email, role } = request.body || {};

    if (!username || !email || !role) {
      throw new AppError(400, 'username, email et role requis', 'VALIDATION_ERROR');
    }

    if (!['super_admin', 'admin', 'scanner'].includes(role)) {
      throw new AppError(400, 'Rôle invalide', 'VALIDATION_ERROR');
    }

    const inviteToken = crypto.randomBytes(24).toString('hex'); // 48 chars
    const inviteExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

    const user = await prisma.adminUser.create({
      data: {
        username,
        email,
        role,
        inviteToken,
        inviteExpiresAt,
        passwordHash: null,
        inviteAccepted: false,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'user_invited',
        adminUsername: request.user.username,
        targetType: 'admin_user',
        targetId: user.id,
        details: { username, email, role },
      },
    });

    const inviteLink = `${require('../config/env').APP_URL}/set-password?token=${inviteToken}`;
    sendInvitationEmail(user, inviteLink).catch(console.error);

    return {
      success: true,
      user: { id: user.id, username, email, role },
      inviteLink, // Temporary: return link until email is implemented
    };
  });

  // POST /api/admin/users/set-password (public, no auth)
  fastify.post('/users/set-password', async (request) => {
    const { token, password } = request.body || {};

    if (!token || !password) {
      throw new AppError(400, 'Token et mot de passe requis', 'VALIDATION_ERROR');
    }

    if (password.length < 8) {
      throw new AppError(400, 'Le mot de passe doit contenir au moins 8 caractères', 'VALIDATION_ERROR');
    }

    const user = await prisma.adminUser.findUnique({ where: { inviteToken: token } });
    if (!user) {
      throw new AppError(400, 'Token d\'invitation invalide', 'INVALID_TOKEN');
    }

    if (user.inviteExpiresAt && new Date() > user.inviteExpiresAt) {
      throw new AppError(400, 'Invitation expirée, contactez l\'administrateur', 'TOKEN_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteAccepted: true,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return { success: true };
  });

  // POST /api/admin/users/:id/reinvite (super_admin)
  fastify.post('/users/:id/reinvite', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const { id } = request.params;

    const user = await prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      throw new AppError(404, 'Utilisateur non trouvé', 'NOT_FOUND');
    }

    const inviteToken = crypto.randomBytes(24).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

    await prisma.adminUser.update({
      where: { id },
      data: {
        inviteToken,
        inviteExpiresAt,
        inviteAccepted: false,
        passwordHash: null,
      },
    });

    const inviteLink = `${require('../config/env').APP_URL}/set-password?token=${inviteToken}`;

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'user_reinvited',
        adminUsername: request.user.username,
        targetType: 'admin_user',
        targetId: id,
        details: { username: user.username },
      },
    });

    return { success: true, inviteLink };
  });

  // PUT /api/admin/users/:id (super_admin)
  fastify.put('/users/:id', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const { id } = request.params;
    const { active, role } = request.body || {};

    const user = await prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      throw new AppError(404, 'Utilisateur non trouvé', 'NOT_FOUND');
    }

    const updateData = {};
    if (typeof active === 'boolean') updateData.active = active;
    if (role && ['super_admin', 'admin', 'scanner'].includes(role)) updateData.role = role;

    const updated = await prisma.adminUser.update({
      where: { id },
      data: updateData,
    });

    // If deactivated, revoke all tokens
    if (active === false) {
      const keys = await redis.keys(`refresh:${id}:*`);
      if (keys.length > 0) await redis.del(...keys);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'user_updated',
        adminUsername: request.user.username,
        targetType: 'admin_user',
        targetId: id,
        details: { changes: updateData },
      },
    });

    return {
      success: true,
      user: { id: updated.id, username: updated.username, role: updated.role, active: updated.active },
    };
  });

  // DELETE /api/admin/users/:id (super_admin)
  fastify.delete('/users/:id', {
    preHandler: [authenticate, authorize('super_admin')],
  }, async (request) => {
    const { id } = request.params;

    const user = await prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      throw new AppError(404, 'Utilisateur non trouvé', 'NOT_FOUND');
    }

    // Prevent self-deletion
    if (id === request.user.userId) {
      throw new AppError(400, 'Vous ne pouvez pas supprimer votre propre compte', 'SELF_DELETE');
    }

    // Revoke all tokens
    const keys = await redis.keys(`refresh:${id}:*`);
    if (keys.length > 0) await redis.del(...keys);

    await prisma.adminUser.delete({ where: { id } });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'user_deleted',
        adminUsername: request.user.username,
        targetType: 'admin_user',
        targetId: id,
        details: { username: user.username },
      },
    });

    return { success: true };
  });
}

module.exports = authRoutes;
