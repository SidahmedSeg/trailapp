import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleX } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

export default function Failed() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const message = searchParams.get('message');

  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  async function handleRetry() {
    if (!id) return;
    setRetrying(true);
    setError('');

    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: id, termsAccepted: true }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || t('failed.errors.initFailed'));
      }

      const data = await res.json();
      if (data.satimRedirectUrl) {
        window.location.href = data.satimRedirectUrl;
      } else {
        throw new Error(t('failed.errors.noUrl'));
      }
    } catch (err) {
      setError(err.message);
      setRetrying(false);
    }
  }

  return (
    <PublicLayout title={t('failed.title')}>
      <div className="flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full space-y-6">
          <div className="bg-red-600 text-white rounded-2xl p-6 text-center shadow-sm">
            <CircleX size={48} className="mx-auto mb-2 text-red-300" />
            <h1 className="text-2xl font-bold">{t('failed.banner')}</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
            <p className="text-gray-600 text-sm">
              {message || t('failed.message')}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            {id && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full bg-[#C42826] hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-base transition shadow-sm cursor-pointer"
              >
                {retrying ? t('common.redirecting') : t('failed.retry')}
              </button>
            )}

            <Link to="/" className="inline-block text-sm text-gray-500 hover:text-[#C42826] transition">
              {t('common.backHome')}
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
