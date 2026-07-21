import mongoose from 'mongoose';

const ACTIONS = [
  'user.approved',
  'user.rejected',
  'user.suspended',
  'user.activated',
  'user.deleted',
  'listing.approved',
  'listing.rejected',
  'listing.activated',
  'listing.deactivated',
  'listing.deleted',
];

const activityLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, required: true },
    action: { type: String, enum: ACTIONS, required: true },
    targetType: { type: String, enum: ['User', 'Product'], default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Snapshot of the target's name/email (or listing name) so the log stays
    // readable even if the record is later deleted (a populated ref would
    // just return null).
    targetLabel: { type: String, default: '' },
    details: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export { ACTIONS };
export default mongoose.model('ActivityLog', activityLogSchema);
