const prisma = require('../config/database');

async function logActivity({ action, adminUsername, targetType, targetId, details }) {
  await prisma.activityLog.create({
    data: { action, adminUsername, targetType, targetId, details },
  });
}

module.exports = { logActivity };
