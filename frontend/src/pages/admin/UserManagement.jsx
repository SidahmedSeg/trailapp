import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

/* ─── Role Badge ─── */
function RoleBadge({ role }) {
  const map = {
    super_admin: 'bg-purple-500/15 text-purple-400',
    admin: 'bg-blue-500/15 text-blue-400',
    scanner: 'bg-amber-500/15 text-amber-400',
  };
  const labels = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    scanner: 'Scanner',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[role] || 'bg-slate-500/15 text-slate-400'}`}>
      {labels[role] || role}
    </span>
  );
}

/* ─── Status Dot ─── */
function StatusDot({ active }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <span className="text-sm">{active ? 'Actif' : 'Inactif'}</span>
    </span>
  );
}

/* ─── Invite Modal ─── */
function InviteModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ username: '', email: '', role: 'admin' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/admin/users/invite', form);
      onInvited();
    } catch (err) {
      setError(err.message || "Erreur lors de l'invitation.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Inviter un utilisateur</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom d'utilisateur</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
              placeholder="johndoe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Adresse email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Rôle</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value="admin">Admin</option>
              <option value="scanner">Scanner</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? 'Envoi...' : 'Inviter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ─── */
function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? '...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main User Management ─── */
export default function UserManagement() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type, user }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get('/admin/users');
      setUsers(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleReinvite = async (userId) => {
    try {
      await post(`/admin/users/${userId}/reinvite`);
      fetchUsers();
    } catch { /* ignore */ }
  };

  const handleToggleActive = async (u) => {
    setConfirmAction({
      type: u.active ? 'deactivate' : 'activate',
      user: u,
    });
  };

  const handleDelete = (u) => {
    setConfirmAction({ type: 'delete', user: u });
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { type, user: target } = confirmAction;
      if (type === 'activate' || type === 'deactivate') {
        await put(`/admin/users/${target.id}`, { active: type === 'activate' });
      } else if (type === 'delete') {
        await del(`/admin/users/${target.id}`);
      }
      fetchUsers();
    } catch { /* ignore */ }
    setActionLoading(false);
    setConfirmAction(null);
  };

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
            <h2 className="text-2xl font-bold">Gestion des utilisateurs</h2>
            <p className="text-slate-400 text-sm mt-1">Gérer les comptes administrateurs</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition cursor-pointer"
          >
            + Inviter
          </button>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Utilisateur</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      Chargement...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[.02] transition">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{u.username}</span>
                        {u.displayName && (
                          <span className="ml-2 text-slate-500 text-xs">({u.displayName})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{u.email || '—'}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3"><StatusDot active={u.active} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReinvite(u.id)}
                            className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5 transition cursor-pointer"
                            title="Renvoyer l'invitation"
                          >
                            Réinviter
                          </button>
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`rounded-md border px-2.5 py-1 text-xs transition cursor-pointer ${
                              u.active
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {u.active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            fetchUsers();
          }}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === 'delete'
              ? 'Supprimer l\'utilisateur'
              : confirmAction.type === 'deactivate'
              ? 'Désactiver l\'utilisateur'
              : 'Activer l\'utilisateur'
          }
          message={`Êtes-vous sûr de vouloir ${
            confirmAction.type === 'delete'
              ? 'supprimer'
              : confirmAction.type === 'deactivate'
              ? 'désactiver'
              : 'activer'
          } "${confirmAction.user.username}" ?`}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

