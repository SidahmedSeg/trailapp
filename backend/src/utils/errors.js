class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
  }
}

function errorHandler(error, request, reply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: true,
      code: error.code,
      message: error.message,
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: true,
      code: 'VALIDATION_ERROR',
      message: error.message,
    });
  }

  // Prisma unique constraint
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field';
    return reply.status(409).send({
      error: true,
      code: 'DUPLICATE',
      message: `Cette valeur de ${field} est déjà utilisée`,
    });
  }

  request.log.error(error);
  return reply.status(500).send({
    error: true,
    code: 'INTERNAL_ERROR',
    message: 'Erreur interne du serveur',
  });
}

module.exports = { AppError, errorHandler };
