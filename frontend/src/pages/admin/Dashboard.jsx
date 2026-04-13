import { useState, useEffect, useCallback } from 'react';
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

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await get('/admin/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const revenueDisplay = stats?.revenuTotal
    ? (stats.revenuTotal / 100).toLocaleString('fr-FR') + ' DZD'
    : '—';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <main className="ml-60 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Tableau de bord</h2>
            <p className="text-gray-500 text-sm mt-1">Vue d'ensemble des inscriptions</p>
          </div>
          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total inscrits" value={stats?.totalInscrits} icon={Users} color="blue" />
          <StatCard label="En attente" value={stats?.totalEnAttente} icon={Clock} color="amber" />
          <StatCard label="Distribués" value={stats?.totalDistribues} icon={CheckCircle} color="emerald" />
          <StatCard label="Dossards restants" value={stats?.dossardsRestants} icon={Ticket} color="purple" />
          <StatCard label="Revenus" value={revenueDisplay} icon={DollarSign} color="rose" />
        </div>

        {/* Placeholder for future graphs */}
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Graphiques à venir</p>
        </div>
      </main>
    </div>
  );
}
