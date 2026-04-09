import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PublicLayout from '../../components/ui/PublicLayout';

export default function SetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('setPassword.errors.minLength'));
      return;
    }
    if (password !== confirm) {
      setError(t('setPassword.errors.mismatch'));
      return;
    }
    if (!token) {
      setError(t('setPassword.errors.invalidToken'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || t('setPassword.errors.generic'));
      }

      navigate('/admin/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <PublicLayout title={t('setPassword.title')}>
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <p className="text-red-600 font-medium">{t('setPassword.errors.expired')}</p>
            <p className="text-gray-500 mt-2 text-sm">{t('setPassword.errors.expiredDetail')}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title={t('setPassword.title')}>
      <div className="flex items-center justify-center px-4 py-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{t('setPassword.heading')}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('setPassword.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('setPassword.fields.password')}</label>
              <input
                type="password" required minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C42826] focus:border-[#C42826] transition"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t('setPassword.placeholders.password')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('setPassword.fields.confirm')}</label>
              <input
                type="password" required minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C42826] focus:border-[#C42826] transition"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('setPassword.placeholders.confirm')}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full bg-[#C42826] hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-base transition shadow-sm cursor-pointer"
            >
              {submitting ? t('setPassword.submitting') : t('setPassword.submit')}
            </button>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
