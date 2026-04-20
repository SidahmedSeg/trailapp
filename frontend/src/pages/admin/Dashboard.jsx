import { useState, useEffect, useCallback } from 'react';
import { get } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import { Users, Clock, CheckCircle, Ticket, DollarSign } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, ResponsiveContainer, Legend,
} from 'recharts';

const BRAND = '#C42826';
const COLORS = ['#C42826', '#F2B800', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#6366F1'];

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

/* ─── Chart Card wrapper ─── */
function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

/* ─── Custom Tooltip ─── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="text-gray-500 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

/* ─── Donut center label ─── */
function DonutLabel({ viewBox, total }) {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-8" className="text-2xl font-bold fill-gray-900">{total}</tspan>
      <tspan x={cx} dy="20" className="text-xs fill-gray-400">Total</tspan>
    </text>
  );
}

/* ─── Ranking card ─── */
function RankingCard({ data }) {
  if (!data?.length) return <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>;
  const max = data[0]?.count || 1;
  return (
    <div className="space-y-2">
      {data.slice(0, 8).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            i === 0 ? 'bg-[#F2B800] text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'
          }`}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 truncate">{item.wilaya}</span>
              <span className="text-sm font-bold text-gray-900 ms-2">{item.count}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { user } = useAuth();
  const { selectedEventId } = useEvent();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);

  const fetchData = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const q = `?eventId=${selectedEventId}`;
      const [statsData, chartsData] = await Promise.all([
        get(`/admin/stats${q}`),
        get(`/admin/stats/charts${q}`),
      ]);
      setStats(statsData);
      setCharts(chartsData);
    } catch { /* ignore */ }
  }, [selectedEventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const revenueDisplay = stats?.revenuTotal
    ? (stats.revenuTotal / 100).toLocaleString('fr-FR') + ' DZD' : '—';

  // Transform chart data for Recharts
  const genderData = charts?.gender ? Object.entries(charts.gender).map(([name, value]) => ({ name, value })) : [];
  const nationalityData = charts?.nationality ? Object.entries(charts.nationality).map(([name, value]) => ({ name, value })) : [];
  const ageData = charts?.ageRanges ? Object.entries(charts.ageRanges).map(([name, value]) => ({ name, value })) : [];
  const categoryData = charts?.categories ? Object.entries(charts.categories).map(([name, value]) => ({ name: name.trim(), value })) : [];
  // Force T-shirt order: S, M, L, XL, XXL
  const TSHIRT_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];
  const tshirtRaw = charts?.tshirtSizes || {};
  const tshirtData = TSHIRT_ORDER.map((size) => ({ name: size, value: tshirtRaw[size] || 0 })).filter((d) => d.value > 0 || Object.keys(tshirtRaw).length > 0);
  const growthData = charts?.dailyGrowth || [];
  const wilayaData = charts?.topWilayas || [];

  const genderTotal = genderData.reduce((s, d) => s + d.value, 0);
  const nationalityTotal = nationalityData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Tableau de bord</h2>
            <p className="text-gray-500 text-sm mt-1">Vue d'ensemble des inscriptions</p>
          </div>
          <button onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total inscrits" value={stats?.totalInscrits} icon={Users} color="blue" />
          <StatCard label="En attente" value={stats?.totalEnAttente} icon={Clock} color="amber" />
          <StatCard label="Distribués" value={stats?.totalDistribues} icon={CheckCircle} color="emerald" />
          <StatCard label="Dossards restants" value={stats?.dossardsRestants} icon={Ticket} color="purple" />
          <StatCard label="Revenus" value={revenueDisplay} icon={DollarSign} color="rose" />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Genre — Donut */}
          <ChartCard title="Répartition par genre">
            {genderData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {genderData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    <DonutLabel viewBox={{ cx: 0, cy: 0 }} total={genderTotal} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Nationalité — Donut */}
          <ChartCard title="Nationalité (Local vs International)">
            {nationalityData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={nationalityData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {nationalityData.map((_, i) => <Cell key={i} fill={[BRAND, '#3B82F6'][i]} />)}
                    <DonutLabel viewBox={{ cx: 0, cy: 0 }} total={nationalityTotal} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Tranches d'âge — Horizontal Bars */}
          <ChartCard title="Tranches d'âge">
            {ageData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ageData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Coureurs" fill={BRAND} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Catégories — Vertical Bars */}
          <ChartCard title="Catégories de course">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Coureurs" radius={[4, 4, 0, 0]} barSize={40}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Tailles T-shirt — Vertical Bars */}
          <ChartCard title="Tailles T-shirt">
            {tshirtData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tshirtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Coureurs" fill="#F2B800" radius={[4, 4, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Croissance 7 jours — Area Chart */}
          <ChartCard title="Inscriptions (7 derniers jours)">
            {growthData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Inscriptions" stroke={BRAND} strokeWidth={2} fill="url(#growthGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Wilayas Top 15 — Horizontal Bars (full width) */}
          <ChartCard title="Top 15 Wilayas" className="lg:col-span-1">
            {wilayaData.length ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={wilayaData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <YAxis type="category" dataKey="wilaya" tick={{ fontSize: 11, fill: '#6B7280' }} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Coureurs" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-12">Aucune donnée</p>}
          </ChartCard>

          {/* Leaders Wilayas — Ranking (full width) */}
          <ChartCard title="Classement des Wilayas (Top 8)" className="lg:col-span-1">
            <RankingCard data={wilayaData} />
          </ChartCard>

        </div>
      </main>
    </div>
  );
}
