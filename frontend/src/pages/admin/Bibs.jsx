import { useState, useEffect, useCallback } from 'react';
import { get, put } from '../../lib/api';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-[#C42826]' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function FormField({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-1 focus:ring-[#C42826] transition disabled:opacity-50 disabled:cursor-not-allowed';

export default function Bibs() {
  const { selectedEventId } = useEvent();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const [eventRes, bibStatsRes] = await Promise.all([
        get(`/admin/events/${selectedEventId}`),
        get(`/admin/events/${selectedEventId}/bib-stats`).catch(() => null),
      ]);
      const e = eventRes.data || eventRes;
      if (bibStatsRes) {
        e.bibsAssigned = bibStatsRes.bibsAttribues ?? 0;
        e.bibsAutoUsed = bibStatsRes.bibsAutoRange ?? 0;
        e.bibsRemaining = bibStatsRes.bibsRestants ?? 0;
        e.bibsOccupation = bibStatsRes.tauxOccupation ?? 0;
        e.bibsManualTotal = bibStatsRes.bibsManualTotal ?? 0;
        e.bibsManualUsed = bibStatsRes.bibsManualUsed ?? 0;
        e.bibsManualRestants = bibStatsRes.bibsManualRestants ?? 0;
        e.prochainNumero = bibStatsRes.prochainNumero;
      }
      setEventData(e);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedEventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const updateField = (key, value) => {
    setEventData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await put(`/admin/events/${selectedEventId}`, {
        bibStart: eventData.bibStart,
        bibEnd: eventData.bibEnd,
        bibPrefix: eventData.bibPrefix || null,
        autoCloseOnExhaustion: eventData.autoCloseOnExhaustion,
      });
      showMessage('success', 'Configuration des dossards sauvegardée.');
    } catch (err) {
      showMessage('error', err.message || 'Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C42826]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-bold mb-1">Dossards</h2>
        <p className="text-gray-500 text-sm mb-8">Configuration et suivi des dossards</p>

        {message.text && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>{message.text}</div>
        )}

        {eventData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — Configuration */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-100">Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Début de la plage">
                  <input type="number" value={eventData.bibStart || ''} disabled={eventData.bibRangeLocked}
                    onChange={(e) => updateField('bibStart', parseInt(e.target.value) || 0)} className={inputClass} />
                </FormField>
                <FormField label="Fin de la plage">
                  <input type="number" value={eventData.bibEnd || ''}
                    onChange={(e) => updateField('bibEnd', parseInt(e.target.value) || 0)} className={inputClass} />
                </FormField>
              </div>

              {eventData.bibRangeLocked && (
                <p className="text-xs text-amber-600">Le début de plage est verrouillé. Vous pouvez augmenter la fin de plage.</p>
              )}

              <FormField label="Préfixe dossard" hint="Ex: TR pour TR-001">
                <input type="text" value={eventData.bibPrefix || ''}
                  onChange={(e) => updateField('bibPrefix', e.target.value)} className={inputClass} />
              </FormField>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Fermeture automatique</p>
                  <p className="text-xs text-gray-400 mt-0.5">Fermer les inscriptions à épuisement des dossards</p>
                </div>
                <Toggle checked={eventData.autoCloseOnExhaustion || false} onChange={(v) => updateField('autoCloseOnExhaustion', v)} />
              </div>

              <div className="pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer">
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>

            {/* Right — Stats */}
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100">
                  Plage automatique
                  <span className="text-sm font-normal text-gray-400 ms-2">({eventData.bibStart}–{eventData.bibEnd})</span>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <BibStatCard label="Utilisés" value={eventData.bibsAutoUsed ?? '—'} color="emerald" />
                  <BibStatCard label="Restants" value={eventData.bibsRemaining ?? '—'} color="amber" />
                  <BibStatCard label="Occupation" value={`${eventData.bibsOccupation ?? 0}%`} color="blue" />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100">
                  Plage manuelle
                  <span className="text-sm font-normal text-gray-400 ms-2">(1–{(eventData.bibStart || 101) - 1})</span>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <BibStatCard label="Total" value={eventData.bibsManualTotal ?? '—'} color="purple" />
                  <BibStatCard label="Utilisés" value={eventData.bibsManualUsed ?? '—'} color="purple" />
                  <BibStatCard label="Restants" value={eventData.bibsManualRestants ?? '—'} color="purple" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BibStatCard({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
