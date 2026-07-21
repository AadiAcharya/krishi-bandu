import ActivityLog from '../models/ActivityLog.js';

function labelFor(target, targetType) {
  if (!target) return '';
  if (targetType === 'User') return `${target.name} (${target.email})`;
  if (targetType === 'Product') return target.name;
  return '';
}

// Logging an admin action must never break the action itself, so failures
// here are swallowed (and reported to the server console) rather than thrown.
export async function logActivity({ admin, action, target, targetType, details }) {
  try {
    await ActivityLog.create({
      admin: admin._id,
      adminName: admin.name,
      action,
      targetType: targetType || null,
      targetId: target?._id || null,
      targetLabel: labelFor(target, targetType),
      details: details || '',
    });
  } catch (err) {
    console.error('Failed to record activity log:', err);
  }
}
