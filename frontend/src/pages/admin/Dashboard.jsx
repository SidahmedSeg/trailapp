import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';
import { Users, Clock, CheckCircle, Ticket, DollarSign } from 'lucide-react';

/* ─── Stat Card ─── */
function StatCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    rose: 'bg-rose-50 text-rose-600 border-rose-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {Icon && <Icon size={20} />}
      </div>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    distributed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-700',
    paid: 'bg-emerald-50 text-emerald-700',
  };
  const labels = {
    confirmed: 'Confirmé',
    pending: 'En attente',
    distributed: 'Distribué',
    cancelled: 'Annulé',
    paid: 'Payé',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-50 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  );
}

/* ─── Detail Panel ─── */
function DetailPanel({ runner, onClose }) {
  const [tab, setTab] = useState('profil');
  if (!runner) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-gray-200 shadow-2xl overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Dossard #{runner.bib}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {['profil', 'paiement'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition cursor-pointer ${
                tab === t ? 'text-[#C42826] border-b-2 border-[#C42826]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t === 'profil' ? 'Profil' : 'Paiement'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {tab === 'profil' ? (
            <>
              <Field label="Nom complet" value={`${runner.firstName || ''} ${runner.lastName || ''}`} />
              <Field label="Email" value={runner.email} />
              <Field label="Téléphone" value={runner.phone} />
              <Field label="Date de naissance" value={runner.birthDate} />
              <Field label="Genre" value={runner.gender} />
              <Field label="Course" value={runner.race} />
              <Field label="Taille t-shirt" value={runner.tshirtSize} />
              <Field label="Club" value={runner.club} />
              <Field label="Contact d'urgence" value={runner.emergencyContact} />
              <Field label="Statut" value={<StatusBadge status={runner.status} />} />
              <Field label="Source" value={runner.source} />
              <Field label="Date d'inscription" value={runner.createdAt ? new Date(runner.createdAt).toLocaleString('fr-FR') : '—'} />
            </>
          ) : (
            <>
              <Field label="Statut paiement" value={<StatusBadge status={runner.paymentStatus} />} />
              <Field label="Montant" value={runner.amount != null ? `${runner.amount} MAD` : '—'} />
              <Field label="Méthode" value={runner.paymentMethod} />
              <Field label="Référence" value={runner.paymentRef} />
              <Field label="Date paiement" value={runner.paidAt ? new Date(runner.paidAt).toLocaleString('fr-FR') : '—'} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-700">{value || '—'}</dd>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [runners, setRunners] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const fetchStats = useCallback(async () => {
    try {
      const data = await get('/admin/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchRunners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const data = await get(`/admin/runners?${params}`);
      setRunners(data.runners || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRunners(); }, [fetchRunners]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleRefresh = () => {
    fetchStats();
    fetchRunners();
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/runners/export?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coureurs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Tableau de bord</h2>
            <p className="text-gray-500 text-sm mt-1">Vue d'ensemble des inscriptions</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm hover:bg-gray-100 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualiser
            </button>
            <button
              onClick={() => alert('Fonctionnalité à venir')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C42826] px-4 py-2 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer"
            >
              + Ajouter coureur
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm hover:bg-gray-100 transition cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total inscrits" value={stats?.total} icon={Users} color="blue" />
          <StatCard label="En attente" value={stats?.pending} icon={Clock} color="amber" />
          <StatCard label="Distribués" value={stats?.distributed} icon={CheckCircle} color="emerald" />
          <StatCard label="Dossards restants" value={stats?.bibsRemaining} icon={Ticket} color="purple" />
          <StatCard label="Revenus" value={stats?.revenue != null ? `${stats.revenue.toLocaleString('fr-FR')} DZD` : '—'} icon={DollarSign} color="rose" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Rechercher par nom, email, dossard..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-[240px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] transition"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none focus:border-[#C42826] transition cursor-pointer"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmé</option>
            <option value="distributed">Distribué</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Dossard</th>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Tél</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      Chargement...
                    </td>
                  </tr>
                ) : runners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
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
                      <td className="px-4 py-3 text-gray-600">{r.email}</td>
                      <td className="px-4 py-3 text-gray-600">{r.phone || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-500">{r.source || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
            <span className="text-sm text-gray-500">
              {total} coureur{total !== 1 ? 's' : ''} — Page {page}/{totalPages}
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
        </div>
      </main>

      {/* Detail Panel */}
      <DetailPanel runner={selectedRunner} onClose={() => setSelectedRunner(null)} />
    </div>
  );
}
