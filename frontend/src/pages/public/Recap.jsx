import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReCAPTCHA from 'react-google-recaptcha';
import { ShieldCheck, CreditCard, User, Shirt, Trophy, Lock } from 'lucide-react';
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Link to="/" className="mt-4 inline-block text-[#C42826] hover:underline text-sm">{t('common.backHome')}</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const r = registration;
  const brand = r?.event?.primaryColor || '#C42826';
  const recaptchaLang = i18n.language === 'ar' ? 'ar' : i18n.language === 'en' ? 'en' : 'fr';

  return (
    <PublicLayout title={t('recap.title')}>
      <div className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left panel — Summary */}
            <div className="space-y-6">
              {/* Registration summary card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-lg bg-[#C42826]/10 flex items-center justify-center">
                    <User size={18} className="text-[#C42826]" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('recap.summary')}</h2>
                </div>

                <div className="space-y-4">
                  <SummaryRow label={t('recap.fields.fullName')} value={`${r.firstName} ${r.lastName}`} />
                  <SummaryRow label={t('recap.fields.email')} value={r.email} />
                  <div className="grid grid-cols-2 gap-4">
                    <SummaryItem icon={Shirt} label={t('recap.fields.tshirt')} value={r.tshirtSize} />
                    <SummaryItem icon={Trophy} label={t('recap.fields.level')} value={r.runnerLevel} />
                  </div>
                </div>
              </div>

              {/* Amount card */}
              <div className="rounded-2xl p-6 text-white" style={{ backgroundColor: brand }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">{t('recap.fields.amount')}</p>
                    <p className="text-3xl font-bold mt-1">
                      {r.paymentAmount ? `${(r.paymentAmount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}` : '2 000,00'}
                      <span className="text-lg font-normal text-white/80 ms-2">DZD</span>
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center">
                    <CreditCard size={28} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel — Payment */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-[#C42826]/10 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-[#C42826]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('recap.payment')}</h2>
              </div>

              {/* Payment method card */}
              <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 bg-gray-50/50">
                <img src="/cib_dahabia.svg" alt="CIB / EDAHABIA" className="h-9 w-auto" />
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

              {/* Secure redirect notice */}
              <div className="flex items-center gap-2 bg-blue-50/70 rounded-lg px-3 py-2">
                <Lock size={13} className="text-blue-400 flex-shrink-0" />
                <p className="text-[11px] text-blue-600 leading-snug">
                  Vous serez dirigé vers un site de paiement sécurisé pour finaliser votre paiement.
                </p>
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 cursor-pointer bg-gray-50 rounded-xl px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  J'ai lu et accepté les{' '}
                  <Link to="/terms-conditions" target="_blank" className="text-[#C42826] font-medium hover:underline">
                    conditions générales
                  </Link>
                </span>
              </label>

              {/* reCAPTCHA */}
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

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={!acceptTerms || !recaptchaToken || paying}
                style={{ backgroundColor: brand }}
                className="w-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock size={16} />
                {paying ? t('recap.paying') : t('recap.submit')}
              </button>

              <div className="text-center">
                <Link to="/register" className="text-sm text-gray-400 hover:text-[#C42826] transition">
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

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
      <Icon size={18} className="text-[#C42826] mx-auto mb-1" />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
