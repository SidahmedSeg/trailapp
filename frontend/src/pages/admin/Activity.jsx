import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

/* ─── Action Type Badge ─── */
function ActionBadge({ action }) {
  const map = {
    create: 'bg-emerald-50 text-emerald-700',
    update: 'bg-blue-50 text-blue-700',
    delete: 'bg-red-50 text-red-700',
    login: 'bg-purple-50 text-purple-700',
    distribute: 'bg-amber-50 text-amber-700',
    invite: 'bg-cyan-50 text-cyan-700',
    export: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[action] || 'bg-gray-100 text-gray-500'}`}>
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
  const [actionFilter, setActionFilter] = useState('');

  const limit = 30;

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      const data = await get(`/admin/activity?${params}`);
      setEntries(data.data || data.entries || data.activities || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      {/* Main */}
      <main className="ml-60 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Journal d'activité</h2>
            <p className="text-gray-500 text-sm mt-1">Historique des actions administratives</p>
          </div>
          <button
            onClick={fetchActivity}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-[#C42826] transition cursor-pointer"
          >
            <option value="">Toutes les actions</option>
            <option value="registration_created_manual">Création coureur</option>
            <option value="registration_edited">Modification coureur</option>
            <option value="bib_distributed">Distribution dossard</option>
            <option value="settings_updated">Paramètres modifiés</option>
            <option value="user_invited">Invitation utilisateur</option>
            <option value="user_reinvited">Réinvitation</option>
            <option value="user_updated">Modification utilisateur</option>
            <option value="user_deleted">Suppression utilisateur</option>
          </select>
        </div>

        {/* Activity List */}
        {(() => {
          const filtered = actionFilter ? entries.filter((e) => e.action === actionFilter) : entries;
          return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-400">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">Aucune activité enregistrée.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((entry, i) => (
                <li key={entry.id || i} className="px-5 py-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <ActionBadge action={entry.action} />
                        <span className="text-sm font-medium text-gray-700">{entry.adminUsername || entry.admin || entry.username || '—'}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {entry.description || (entry.details && typeof entry.details === 'object' ? JSON.stringify(entry.details) : entry.details) || `${entry.action} sur ${entry.targetType || '—'}`}
                      </p>
                      {entry.targetType && (
                        <p className="text-xs text-gray-400 mt-1">Cible : {entry.targetType}{entry.targetId ? ` (${entry.targetId.substring(0, 8)}...)` : ''}</p>
                      )}
                    </div>
                    <time className="text-xs text-gray-400 whitespace-nowrap">
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
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
              <span className="text-sm text-gray-500">
                {total} entrée{total !== 1 ? 's' : ''} — Page {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-gray-100 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-gray-100 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
          );
        })()}
      </main>
    </div>
  );
}
