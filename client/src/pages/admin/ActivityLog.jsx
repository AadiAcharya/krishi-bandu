import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, UserX, UserCheck, Trash2, EyeOff, Eye, Package, Flag } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

const ACTION_META = {
  'user.approved': { label: 'Approved registration', icon: CheckCircle2, style: 'bg-green-100 text-green-700' },
  'user.rejected': { label: 'Rejected registration', icon: XCircle, style: 'bg-red-100 text-red-700' },
  'user.suspended': { label: 'Suspended account', icon: UserX, style: 'bg-amber-100 text-amber-700' },
  'user.activated': { label: 'Activated account', icon: UserCheck, style: 'bg-primary-100 text-primary-700' },
  'user.deleted': { label: 'Deleted account', icon: Trash2, style: 'bg-gray-200 text-gray-700' },
  'listing.approved': { label: 'Approved listing', icon: CheckCircle2, style: 'bg-green-100 text-green-700' },
  'listing.rejected': { label: 'Flagged listing', icon: Flag, style: 'bg-red-100 text-red-700' },
  'listing.activated': { label: 'Unhid listing', icon: Eye, style: 'bg-primary-100 text-primary-700' },
  'listing.deactivated': { label: 'Hid listing', icon: EyeOff, style: 'bg-amber-100 text-amber-700' },
  'listing.deleted': { label: 'Removed listing', icon: Package, style: 'bg-gray-200 text-gray-700' },
};

export default function ActivityLog() {
  const { notify } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/activity-log')
      .then((res) => setEntries(res.data))
      .catch((error) => notify(error.response?.data?.message || 'Could not load activity log.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-sm text-gray-500">A record of moderation actions taken by administrators.</p>
      </div>

      {loading && <p className="py-10 text-center text-gray-400">Loading activity log...</p>}

      {!loading && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const meta = ACTION_META[entry.action] || { label: entry.action, icon: CheckCircle2, style: 'bg-gray-100 text-gray-600' };
            const Icon = meta.icon;
            return (
              <div key={entry._id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.style}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold">{entry.adminName}</span> {meta.label.toLowerCase()}
                    {entry.targetLabel && <> for <span className="font-semibold">{entry.targetLabel}</span></>}
                  </p>
                  {entry.details && <p className="mt-0.5 text-xs text-gray-500">Reason: {entry.details}</p>}
                  <p className="mt-1 text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400 shadow-sm">
              No admin actions recorded yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
