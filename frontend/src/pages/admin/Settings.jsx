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
        checked ? 'bg-emerald-600' : 'bg-slate-600'
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
    <div className="bg-slate-900 border border-white/10 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-5">{title}</h3>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/* ─── Form Field ─── */
function FormField({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed';

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
      const res = await get('/admin/settings');
      const s = res.data || res;
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Sidebar />

      {/* Main */}
      <main className="ml-60 p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">Paramètres</h2>
        <p className="text-slate-400 text-sm mb-8">Configuration de l'application</p>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-8">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition cursor-pointer ${
                tab === t.key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
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
                <p className="text-sm font-medium text-slate-200">Inscriptions ouvertes</p>
                <p className="text-xs text-slate-500 mt-0.5">Autoriser les nouvelles inscriptions</p>
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
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
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
              <p className="text-xs text-amber-400">
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
                <p className="text-sm font-medium text-slate-200">Fermeture automatique</p>
                <p className="text-xs text-slate-500 mt-0.5">Fermer les inscriptions quand tous les dossards sont attribués</p>
              </div>
              <Toggle checked={settings.autoCloseOnExhaustion || false} onChange={(v) => updateSetting('autoCloseOnExhaustion', v)} />
            </div>

            {/* Read-only stats */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Attribués</p>
                <p className="text-lg font-bold text-emerald-400">{settings.bibsAssigned ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Distribués</p>
                <p className="text-lg font-bold text-blue-400">{settings.bibsDistributed ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Restants</p>
                <p className="text-lg font-bold text-amber-400">{settings.bibsRemaining ?? '—'}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveBibs}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
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
            <hr className="border-white/10" />
            <p className="text-sm text-slate-400">Changer le mot de passe (laisser vide pour ne pas modifier)</p>
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
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
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

