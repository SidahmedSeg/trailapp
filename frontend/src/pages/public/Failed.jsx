import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle, RefreshCw, ShieldAlert, Mail } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

export default function Failed() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const message = searchParams.get('message');
  const reason = searchParams.get('reason');
  const errorCode = searchParams.get('error');

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
      <div className="flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Top icon section */}
            <div className="bg-gradient-to-b from-red-50 to-white pt-10 pb-6 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={40} className="text-[#C42826]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{t('failed.banner')}</h1>
              <p className="text-sm text-gray-500 mt-2 px-8">
                {message || t('failed.message')}
              </p>
            </div>

            <div className="px-8 pb-8 space-y-4">
              {/* SATIM error reason */}
              {reason && (
                <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
                  <ShieldAlert size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">Motif du refus</p>
                    <p className="text-sm text-red-700">{reason}</p>
                  </div>
                </div>
              )}

              {/* Error code */}
              {!reason && errorCode && (
                <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
                  <ShieldAlert size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">Code erreur</p>
                    <p className="text-sm text-red-700 font-mono">{errorCode}</p>
                  </div>
                </div>
              )}

              {/* Generic hints if no reason and no error code */}
              {!reason && !errorCode && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Causes possibles</p>
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Transaction refusée par votre banque ou carte expirée</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <RefreshCw size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">Délai de connexion dépassé ou session expirée</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}

              {/* Retry button */}
              {id && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="w-full bg-[#C42826] hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} className={retrying ? 'animate-spin' : ''} />
                  {retrying ? t('common.redirecting') : t('failed.retry')}
                </button>
              )}

              {/* Contact support */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Mail size={12} />
                <span>Besoin d'aide ? <a href="mailto:contact@lassm.dz" className="text-[#C42826] hover:underline">contact@lassm.dz</a></span>
              </div>

              {/* Back link */}
              <div className="text-center pt-2">
                <Link to="/register" className="text-sm text-gray-400 hover:text-[#C42826] transition">
                  {t('common.backHome')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
