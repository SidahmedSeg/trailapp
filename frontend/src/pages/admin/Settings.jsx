import { useState } from 'react';
import { put } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-1 focus:ring-[#C42826] transition';

function FormField({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [secForm, setSecForm] = useState({
    displayName: user?.username || '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleSaveSecurity = async () => {
    if (secForm.newPassword && secForm.newPassword !== secForm.confirmPassword) {
      showMessage('error', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      const body = { displayName: secForm.displayName, email: secForm.email };
      if (secForm.newPassword) {
        body.currentPassword = secForm.currentPassword;
        body.newPassword = secForm.newPassword;
      }
      await put('/admin/settings/security', body);
      showMessage('success', 'Informations mises à jour.');
      setSecForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      showMessage('error', err.message || 'Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-bold mb-1">Mon compte</h2>
        <p className="text-gray-500 text-sm mb-8">Gérer vos informations personnelles</p>

        {message.text && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>{message.text}</div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-5">Sécurité</h3>
          <div className="space-y-5">
            <FormField label="Nom d'utilisateur">
              <input type="text" value={secForm.displayName}
                onChange={(e) => setSecForm((p) => ({ ...p, displayName: e.target.value }))}
                className={inputClass} />
            </FormField>
            <FormField label="Adresse email">
              <input type="email" value={secForm.email}
                onChange={(e) => setSecForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass} />
            </FormField>
            <hr className="border-gray-200" />
            <p className="text-sm text-gray-500">Changer le mot de passe (laisser vide pour ne pas modifier)</p>
            <FormField label="Mot de passe actuel">
              <input type="password" value={secForm.currentPassword}
                onChange={(e) => setSecForm((p) => ({ ...p, currentPassword: e.target.value }))}
                className={inputClass} />
            </FormField>
            <FormField label="Nouveau mot de passe">
              <input type="password" value={secForm.newPassword}
                onChange={(e) => setSecForm((p) => ({ ...p, newPassword: e.target.value }))}
                className={inputClass} />
            </FormField>
            <FormField label="Confirmer le mot de passe">
              <input type="password" value={secForm.confirmPassword}
                onChange={(e) => setSecForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className={inputClass} />
            </FormField>
            <div className="pt-2">
              <button onClick={handleSaveSecurity} disabled={saving}
                className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer">
                {saving ? 'Sauvegarde...' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
