import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

/* ─── Role Badge ─── */
function RoleBadge({ role }) {
  const map = {
    super_admin: 'bg-purple-50 text-purple-700',
    admin: 'bg-blue-50 text-blue-700',
    scanner: 'bg-amber-50 text-amber-700',
  };
  const labels = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    scanner: 'Scanner',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[role] || 'bg-gray-50 text-gray-500'}`}>
      {labels[role] || role}
    </span>
  );
}

/* ─── Status Dot ─── */
function StatusDot({ active }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Inviter un utilisateur</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
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
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Nom d'utilisateur</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-[#C42826] transition"
              placeholder="johndoe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Adresse email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-[#C42826] transition"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Rôle</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#C42826] focus:ring-[#C42826] transition cursor-pointer"
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
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#C42826] px-6 py-2 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
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
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      {/* Main */}
      <main className="ml-60 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Gestion des utilisateurs</h2>
            <p className="text-gray-500 text-sm mt-1">Gérer les comptes administrateurs</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C42826] px-4 py-2 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer"
          >
            + Inviter
          </button>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Utilisateur</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{u.username}</span>
                        {u.displayName && (
                          <span className="ml-2 text-gray-500 text-xs">({u.displayName})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3"><StatusDot active={u.active} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReinvite(u.id)}
                            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                            title="Renvoyer l'invitation"
                          >
                            Réinviter
                          </button>
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`rounded-md border px-2.5 py-1 text-xs transition cursor-pointer ${
                              u.active
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                : 'border-emerald-500/30 text-[#C42826] hover:bg-emerald-500/10'
                            }`}
                          >
                            {u.active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition cursor-pointer"
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
