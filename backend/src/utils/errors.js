class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
  }
}

/**
 * Produce a single readable line from a verbose error (Prisma, etc.) so logs
 * don't drown in JSON walls. The full stack is still logged afterwards by Pino.
 */
function summarizeError(err) {
  if (!err) return 'unknown error';

  const name = err.name || err.type || '';

  // Prisma validation errors — usually 6 KB of help text. Pull the key bits.
  if (name === 'PrismaClientValidationError' || /PrismaClientValidationError/.test(String(err.message || ''))) {
    const msg = String(err.message || '');
    const loc = msg.match(/`prisma\.(\w+)\.(\w+)\(\)` invocation in\s+(\S+):(\d+)/);
    const op = loc ? `prisma.${loc[1]}.${loc[2]}() @ ${loc[3]}:${loc[4]}` : 'prisma call';
    const unknownArg = msg.match(/Unknown argument `([^`]+)`\.(?:\s+Did you mean `([^`]+)`\?)?/);
    if (unknownArg) {
      const hint = unknownArg[2] ? ` (did you mean \`${unknownArg[2]}\`?)` : '';
      return `[Prisma] ${op} → unknown arg \`${unknownArg[1]}\`${hint}`;
    }
    const argMissing = msg.match(/Argument `([^`]+)` is missing/);
    if (argMissing) return `[Prisma] ${op} → missing required arg \`${argMissing[1]}\``;
    const firstLine = msg.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('?'));
    return `[Prisma] ${op} → ${firstLine || 'validation failed'}`;
  }

  // Prisma known request errors (P2xxx)
  if (err.code && /^P\d+$/.test(err.code)) {
    const target = err.meta?.target ? ` on ${JSON.stringify(err.meta.target)}` : '';
    return `[Prisma ${err.code}]${target} ${err.message?.split('\n')[0] || ''}`.trim();
  }

  return err.message ? `[${name || 'Error'}] ${err.message.split('\n')[0]}` : `[${name || 'Error'}]`;
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

  // One-line summary so the dev sees the issue at a glance,
  // then the full error blob right after for deep debugging.
  const summary = summarizeError(error);
  request.log.error(`ERR ${request.method} ${request.url} reqId=${request.id} — ${summary}`);
  request.log.error(error);

  return reply.status(500).send({
    error: true,
    code: 'INTERNAL_ERROR',
    message: 'Erreur interne du serveur',
  });
}

module.exports = { AppError, errorHandler, summarizeError };
