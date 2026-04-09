import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReCAPTCHA from 'react-google-recaptcha';
import PublicLayout from '../../components/ui/PublicLayout';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LfGf38sAAAAABuBfyIXAxvsoNjVzU8EOmRfQ4rw';

export default function Recap() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');

  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [paying, setPaying] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    if (!id) {
      setError(t('recap.errors.noId'));
      setLoading(false);
      return;
    }

    fetch(`/api/registration/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(t('recap.errors.notFound'));
        return res.json();
      })
      .then((data) => setRegistration(data.data || data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    if (!acceptTerms) return;
    setPaying(true);
    setError('');

    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: id, termsAccepted: true, recaptchaToken }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || t('recap.errors.initFailed'));
      }

      const data = await res.json();
      if (data.satimRedirectUrl) {
        window.location.href = data.satimRedirectUrl;
      } else {
        throw new Error(t('recap.errors.noUrl'));
      }
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout title={t('recap.title')}>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-[#C42826] border-t-transparent rounded-full" />
        </div>
      </PublicLayout>
    );
  }

  if (error && !registration) {
    return (
      <PublicLayout title={t('recap.title')}>
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Link to="/" className="mt-4 inline-block text-[#C42826] hover:underline text-sm">{t('common.backHome')}</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const r = registration;
  const recaptchaLang = i18n.language === 'ar' ? 'ar' : i18n.language === 'en' ? 'en' : 'fr';

  return (
    <PublicLayout title={t('recap.title')}>
      <div className="py-10 px-4">
      <div className="max-w-4xl mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel — Summary */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">{t('recap.summary')}</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('recap.fields.fullName')}</span>
                <span className="font-medium text-gray-800">{r.firstName} {r.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('recap.fields.email')}</span>
                <span className="font-medium text-gray-800">{r.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('recap.fields.tshirt')}</span>
                <span className="font-medium text-gray-800">{r.tshirtSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('recap.fields.level')}</span>
                <span className="font-medium text-gray-800">{r.runnerLevel}</span>
              </div>
              <hr />
              <div className="flex justify-between text-base font-bold">
                <span className="text-gray-700">{t('recap.fields.amount')}</span>
                <span className="text-[#C42826]">{r.paymentAmount ? `DZD ${(r.paymentAmount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}` : 'DZD 2 000,00'}</span>
              </div>
            </div>
          </div>

          {/* Right panel — Payment */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">{t('recap.payment')}</h2>

            <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 bg-white">
              <img src="/cib_dahabia.svg" alt="CIB / Dahabia" className="h-9 w-auto" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{t('recap.paymentMethod')}</p>
                <p className="text-xs text-gray-500">{t('recap.paymentSecure')}</p>
              </div>
              <div className="w-8 h-8 bg-[#C42826]/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-[#C42826]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <span className="text-sm text-gray-700">{t('recap.terms')}</span>
            </label>

            <div className="flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={(token) => setRecaptchaToken(token)}
                onExpired={() => setRecaptchaToken(null)}
                hl={recaptchaLang}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <button
              onClick={handlePay}
              disabled={!acceptTerms || !recaptchaToken || paying}
              className="w-full bg-[#C42826] hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-base transition shadow-sm cursor-pointer"
            >
              {paying ? t('recap.paying') : t('recap.submit')}
            </button>

            <div className="text-center">
              <Link to="/" className="text-sm text-gray-500 hover:text-[#C42826] transition">
                {t('common.back')}
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PublicLayout>
  );
}
