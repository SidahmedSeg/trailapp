import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    distributed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  const labels = {
    confirmed: 'Confirmé',
    pending: 'En attente',
    distributed: 'Distribué',
    cancelled: 'Annulé',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-500'}`}>
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Coureur - Dossard #{runner.bibNumber}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
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
          <InfoRow label="Taille t-shirt" value={runner.tshirtSize} />
          <InfoRow label="Statut" value={<StatusBadge status={runner.status} />} />

          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Dossard distribué avec succès !
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            Fermer
          </button>
          {!success && runner.status !== 'distributed' && (
            <button
              onClick={handleDistribute}
              disabled={distributing}
              className="rounded-lg bg-[#C42826] px-4 py-2 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
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
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value || '—'}</span>
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
      setSelectedRunner(data.data || data);
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <main className="ml-60 p-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Scanner</h2>
          <p className="text-gray-500 text-sm mt-1">Distribution des dossards</p>
        </div>
        {/* Manual Bib Search */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recherche manuelle par dossard</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Numéro de dossard..."
              value={bibInput}
              onChange={(e) => setBibInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] transition"
            />
            <button
              onClick={handleManualSearch}
              disabled={loading}
              className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? '...' : 'Rechercher'}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
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
              className="w-64 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] transition"
            />
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Dossard</th>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runners.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      Aucun coureur trouvé.
                    </td>
                  </tr>
                ) : (
                  runners.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRunner(r)}
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-mono text-[#C42826]">{r.bib || '—'}</td>
                      <td className="px-4 py-3 text-gray-900">{r.firstName} {r.lastName}</td>
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
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                Aucune distribution enregistrée pour cette session.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {history.map((h, i) => (
                  <li key={i} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[#C42826]">#{h.bibNumber}</span>
                      <span className="ml-3 text-gray-900">{h.runnerName}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {h.scannedAt ? new Date(h.scannedAt).toLocaleTimeString('fr-FR') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      {/* Modal */}
      <RunnerModal
        runner={selectedRunner}
        onClose={handleModalClose}
        onDistribute={handleModalClose}
      />
    </div>
  );
}
