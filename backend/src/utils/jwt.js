const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ADMIN_SECRET, {
    expiresIn: env.JWT_ADMIN_ACCESS_TTL,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_ADMIN_SECRET, {
    expiresIn: env.JWT_ADMIN_REFRESH_TTL,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_ADMIN_SECRET);
}

module.exports = { signAccessToken, signRefreshToken, verifyToken };
