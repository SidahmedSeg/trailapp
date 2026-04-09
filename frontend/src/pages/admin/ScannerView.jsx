import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-emerald-500/15 text-emerald-400',
    pending: 'bg-amber-500/15 text-amber-400',
    distributed: 'bg-blue-500/15 text-blue-400',
    cancelled: 'bg-red-500/15 text-red-400',
  };
  const labels = {
    confirmed: 'Confirmé',
    pending: 'En attente',
    distributed: 'Distribué',
    cancelled: 'Annulé',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-slate-500/15 text-slate-400'}`}>
      {labels[status] || status}
    </span>
  );
}

/* ─── Runner Modal ─── */
function RunnerModal({ runner, onClose, onDistribute }) {
  const [distributing, setDistributing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!runner) return null;

  const handleDistribute = async () => {
    setDistributing(true);
    setError('');
    try {
      await post(`/scan/${runner.qrToken}/distribute`);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Erreur lors de la distribution.');
    }
    setDistributing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Coureur - Dossard #{runner.bib}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <InfoRow label="Nom" value={`${runner.firstName || ''} ${runner.lastName || ''}`} />
          <InfoRow label="Email" value={runner.email} />
          <InfoRow label="Téléphone" value={runner.phone} />
          <InfoRow label="Course" value={runner.race} />
          <InfoRow label="Taille t-shirt" value={runner.tshirtSize} />
          <InfoRow label="Statut" value={<StatusBadge status={runner.status} />} />

          {success && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
              Dossard distribué avec succès !
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 transition cursor-pointer"
          >
            Fermer
          </button>
          {!success && runner.status !== 'distributed' && (
            <button
              onClick={handleDistribute}
              disabled={distributing}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
            >
              {distributing ? 'Distribution...' : 'Confirmer la distribution'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm text-white">{value || '—'}</span>
    </div>
  );
}

/* ─── Main Scanner View ─── */
export default function ScannerView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [runners, setRunners] = useState([]);
  const [search, setSearch] = useState('');
  const [bibInput, setBibInput] = useState('');
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch runners
  const fetchRunners = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (search) params.set('search', search);
      const data = await get(`/admin/runners?${params}`);
      setRunners(data.runners || []);
    } catch { /* ignore */ }
  }, [search]);

  // Fetch session history
  const fetchHistory = useCallback(async () => {
    try {
      const data = await get('/scan/session/history');
      setHistory(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRunners(); }, [fetchRunners]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleManualSearch = async () => {
    if (!bibInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await get(`/scan/manual/${bibInput.trim()}`);
      setSelectedRunner(data);
    } catch (err) {
      setError(err.message || 'Coureur introuvable.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleManualSearch();
  };

  const handleModalClose = () => {
    setSelectedRunner(null);
    fetchHistory();
    fetchRunners();
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold text-lg">Scanner</span>
            <span className="text-slate-500 text-sm">|</span>
            <span className="text-slate-400 text-sm">{user?.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-red-400 hover:text-red-300 transition cursor-pointer"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Manual Bib Search */}
        <section className="bg-slate-900 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recherche manuelle par dossard</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Numéro de dossard..."
              value={bibInput}
              onChange={(e) => setBibInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
            />
            <button
              onClick={handleManualSearch}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? '...' : 'Rechercher'}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}
        </section>

        {/* Runner Table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Coureurs</h2>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
            />
          </div>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Dossard</th>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {runners.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Aucun coureur trouvé.
                    </td>
                  </tr>
                ) : (
                  runners.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRunner(r)}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-mono text-emerald-400">{r.bib || '—'}</td>
                      <td className="px-4 py-3 text-white">{r.firstName} {r.lastName}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Session History */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Historique de session</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Aucune distribution enregistrée pour cette session.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {history.map((h, i) => (
                  <li key={i} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-emerald-400">#{h.bib}</span>
                      <span className="ml-3 text-white">{h.firstName} {h.lastName}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {h.distributedAt ? new Date(h.distributedAt).toLocaleTimeString('fr-FR') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Modal */}
      <RunnerModal
        runner={selectedRunner}
        onClose={handleModalClose}
        onDistribute={handleModalClose}
      />
    </div>
  );
}
