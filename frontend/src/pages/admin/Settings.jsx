import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

/* ─── Toggle Switch ─── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-[#C42826]' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/* ─── Section Card ─── */
function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-5">{title}</h3>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/* ─── Form Field ─── */
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

/* ─── Main Settings ─── */
export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Security form
  const [secForm, setSecForm] = useState({ displayName: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, bibStatsRes] = await Promise.all([
        get('/admin/settings'),
        get('/admin/settings/bib-stats').catch(() => null),
      ]);
      const s = settingsRes.data || settingsRes;
      if (bibStatsRes) {
        s.bibsAssigned = bibStatsRes.bibsAttribues ?? 0;
        s.bibsAutoUsed = bibStatsRes.bibsAutoRange ?? 0;
        s.bibsRemaining = bibStatsRes.bibsRestants ?? 0;
        s.bibsOccupation = bibStatsRes.tauxOccupation ?? 0;
        s.bibsManualTotal = bibStatsRes.bibsManualTotal ?? 0;
        s.bibsManualUsed = bibStatsRes.bibsManualUsed ?? 0;
        s.bibsManualRestants = bibStatsRes.bibsManualRestants ?? 0;
        s.prochainNumero = bibStatsRes.prochainNumero;
      }
      setSettings(s);
      setSecForm((prev) => ({
        ...prev,
        displayName: user?.username || '',
        email: '',
      }));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await put('/admin/settings', {
        registrationOpen: settings.registrationOpen,
        registrationDeadline: settings.registrationDeadline || null,
        maxCapacity: settings.maxCapacity || null,
      });
      showMessage('success', 'Paramètres généraux sauvegardés.');
    } catch (err) {
      showMessage('error', err.message || 'Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  const handleSaveBibs = async () => {
    setSaving(true);
    try {
      await put('/admin/settings', {
        bibStart: settings.bibStart,
        bibEnd: settings.bibEnd,
        bibPrefix: settings.bibPrefix || null,
        autoCloseOnExhaustion: settings.autoCloseOnExhaustion,
      });
      showMessage('success', 'Paramètres dossards sauvegardés.');
    } catch (err) {
      showMessage('error', err.message || 'Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  const handleSaveSecurity = async () => {
    if (secForm.newPassword && secForm.newPassword !== secForm.confirmPassword) {
      showMessage('error', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        displayName: secForm.displayName,
        email: secForm.email,
      };
      if (secForm.newPassword) {
        body.currentPassword = secForm.currentPassword;
        body.newPassword = secForm.newPassword;
      }
      await put('/admin/settings/security', body);
      showMessage('success', 'Informations de sécurité mises à jour.');
      setSecForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      showMessage('error', err.message || 'Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const tabs = [
    { key: 'general', label: 'Général' },
    { key: 'bibs', label: 'Dossards' },
    { key: 'security', label: 'Sécurité' },
  ];

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

      {/* Main */}
      <main className="ml-60 p-8">
        <h2 className="text-2xl font-bold mb-1">Paramètres</h2>
        <p className="text-gray-500 text-sm mb-8">Configuration de l'application</p>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-8">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition cursor-pointer ${
                tab === t.key ? 'bg-[#C42826] text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Général */}
        {tab === 'general' && settings && (
          <Section title="Paramètres généraux">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Inscriptions ouvertes</p>
                <p className="text-xs text-gray-400 mt-0.5">Autoriser les nouvelles inscriptions</p>
              </div>
              <Toggle checked={settings.registrationOpen} onChange={(v) => updateSetting('registrationOpen', v)} />
            </div>
            <FormField label="Date limite d'inscription">
              <input
                type="date"
                value={settings.registrationDeadline ? settings.registrationDeadline.substring(0, 10) : ''}
                onChange={(e) => updateSetting('registrationDeadline', e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Capacité maximale">
              <input
                type="number"
                value={settings.maxCapacity || ''}
                onChange={(e) => updateSetting('maxCapacity', parseInt(e.target.value) || 0)}
                className={inputClass}
              />
            </FormField>
            <div className="pt-2">
              <button
                onClick={handleSaveGeneral}
                disabled={saving}
                className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </Section>
        )}

        {/* Dossards */}
        {tab === 'bibs' && settings && (
          <Section title="Configuration des dossards">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Début de la plage">
                <input
                  type="number"
                  value={settings.bibStart || ''}
                  onChange={(e) => updateSetting('bibStart', parseInt(e.target.value) || 0)}
                  disabled={settings.bibRangeLocked}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Fin de la plage">
                <input
                  type="number"
                  value={settings.bibEnd || ''}
                  onChange={(e) => updateSetting('bibEnd', parseInt(e.target.value) || 0)}
                  disabled={settings.bibRangeLocked}
                  className={inputClass}
                />
              </FormField>
            </div>
            {settings.bibRangeLocked && (
              <p className="text-xs text-amber-600">
                La plage de dossards est verrouillée car des dossards ont déjà été attribués.
              </p>
            )}
            <FormField label="Préfixe dossard" hint="Ex: TR pour TR-001">
              <input
                type="text"
                value={settings.bibPrefix || ''}
                onChange={(e) => updateSetting('bibPrefix', e.target.value)}
                className={inputClass}
              />
            </FormField>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Fermeture automatique</p>
                <p className="text-xs text-gray-400 mt-0.5">Fermer les inscriptions quand tous les dossards sont attribués</p>
              </div>
              <Toggle checked={settings.autoCloseOnExhaustion || false} onChange={(v) => updateSetting('autoCloseOnExhaustion', v)} />
            </div>

            {/* Read-only stats */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2">Plage automatique ({settings.bibStart}–{settings.bibEnd})</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Attribués</p>
                <p className="text-lg font-bold text-emerald-700">{settings.bibsAssigned ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Restants</p>
                <p className="text-lg font-bold text-amber-700">{settings.bibsRemaining ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Occupation</p>
                <p className="text-lg font-bold text-blue-700">{settings.bibsOccupation ?? 0}%</p>
              </div>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Utilisés</p>
                <p className="text-lg font-bold text-rose-700">{settings.bibsAutoUsed ?? '—'}</p>
              </div>
            </div>

            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plage manuelle (1–{(settings.bibStart || 101) - 1})</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Total</p>
                <p className="text-lg font-bold text-purple-700">{settings.bibsManualTotal ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Utilisés</p>
                <p className="text-lg font-bold text-purple-700">{settings.bibsManualUsed ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Restants</p>
                <p className="text-lg font-bold text-purple-700">{settings.bibsManualRestants ?? '—'}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveBibs}
                disabled={saving}
                className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </Section>
        )}

        {/* Sécurité */}
        {tab === 'security' && (
          <Section title="Sécurité du compte">
            <FormField label="Nom d'affichage">
              <input
                type="text"
                value={secForm.displayName}
                onChange={(e) => setSecForm((p) => ({ ...p, displayName: e.target.value }))}
                className={inputClass}
              />
            </FormField>
            <FormField label="Adresse email">
              <input
                type="email"
                value={secForm.email}
                onChange={(e) => setSecForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
              />
            </FormField>
            <hr className="border-gray-200" />
            <p className="text-sm text-gray-500">Changer le mot de passe (laisser vide pour ne pas modifier)</p>
            <FormField label="Mot de passe actuel">
              <input
                type="password"
                value={secForm.currentPassword}
                onChange={(e) => setSecForm((p) => ({ ...p, currentPassword: e.target.value }))}
                className={inputClass}
              />
            </FormField>
            <FormField label="Nouveau mot de passe">
              <input
                type="password"
                value={secForm.newPassword}
                onChange={(e) => setSecForm((p) => ({ ...p, newPassword: e.target.value }))}
                className={inputClass}
              />
            </FormField>
            <FormField label="Confirmer le mot de passe">
              <input
                type="password"
                value={secForm.confirmPassword}
                onChange={(e) => setSecForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className={inputClass}
              />
            </FormField>
            <div className="pt-2">
              <button
                onClick={handleSaveSecurity}
                disabled={saving}
                className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? 'Sauvegarde...' : 'Mettre à jour'}
              </button>
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}
