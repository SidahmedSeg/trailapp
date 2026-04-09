import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

/* ─── Action Type Badge ─── */
function ActionBadge({ action }) {
  const map = {
    create: 'bg-emerald-500/15 text-emerald-400',
    update: 'bg-blue-500/15 text-blue-400',
    delete: 'bg-red-500/15 text-red-400',
    login: 'bg-purple-500/15 text-purple-400',
    distribute: 'bg-amber-500/15 text-amber-400',
    invite: 'bg-cyan-500/15 text-cyan-400',
    export: 'bg-indigo-500/15 text-indigo-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[action] || 'bg-slate-500/15 text-slate-400'}`}>
      {action}
    </span>
  );
}

/* ─── Main Activity Log ─── */
export default function Activity() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 30;

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      const data = await get(`/admin/activity?${params}`);
      setEntries(data.entries || data.activities || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Sidebar />

      {/* Main */}
      <main className="ml-60 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Journal d'activité</h2>
            <p className="text-slate-400 text-sm mt-1">Historique des actions administratives</p>
          </div>
          <button
            onClick={fetchActivity}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>

        {/* Activity List */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-500">Chargement...</div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500">Aucune activité enregistrée.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {entries.map((entry, i) => (
                <li key={entry.id || i} className="px-5 py-4 hover:bg-white/[.02] transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <ActionBadge action={entry.action} />
                        <span className="text-sm font-medium text-slate-200">{entry.admin || entry.username || '—'}</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {entry.description || entry.details || `${entry.action} sur ${entry.target || '—'}`}
                      </p>
                      {entry.target && (
                        <p className="text-xs text-slate-600 mt-1">Cible : {entry.target}</p>
                      )}
                    </div>
                    <time className="text-xs text-slate-600 whitespace-nowrap">
                      {entry.timestamp || entry.createdAt
                        ? new Date(entry.timestamp || entry.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 bg-white/5">
              <span className="text-sm text-slate-400">
                {total} entrée{total !== 1 ? 's' : ''} — Page {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-white/10 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-white/10 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

