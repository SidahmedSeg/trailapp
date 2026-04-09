const { verifyToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');

function authenticate(request, reply, done) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Token manquant', 'UNAUTHORIZED');
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    request.user = decoded;
    done();
  } catch (err) {
    throw new AppError(401, 'Token invalide ou expiré', 'UNAUTHORIZED');
  }
}

function authorize(...roles) {
  return function (request, reply, done) {
    if (!request.user) {
      throw new AppError(401, 'Non authentifié', 'UNAUTHORIZED');
    }
    if (!roles.includes(request.user.role)) {
      throw new AppError(403, 'Accès refusé', 'FORBIDDEN');
    }
    done();
  };
}

module.exports = { authenticate, authorize };
