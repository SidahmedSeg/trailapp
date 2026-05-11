import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReCAPTCHA from 'react-google-recaptcha';
import { Loader2, AlertCircle, Clock, ArrowLeft, ShieldCheck, CreditCard, User, Shirt, Trophy, Lock } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LfGf38sAAAAABuBfyIXAxvsoNjVzU8EOmRfQ4rw';

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  );
}

export default function LateRecap() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [tokenData, setTokenData] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [form, setForm] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const recaptchaRef = useRef(null);

  useEffect(() => {
    fetch(`/api/late-registration/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message || 'Lien invalide');
        return json;
      })
      .then((d) => setTokenData(d))
      .catch((err) => setTokenError(err.message));

    const stashed = sessionStorage.getItem(`late_register_form_${token}`);
    if (stashed) {
      try { setForm(JSON.parse(stashed)); } catch { /* ignore */ }
    }
  }, [token]);

  // If no form data, send back to the form page
  useEffect(() => {
    if (tokenData && !form) {
      navigate(`/late-register/${token}`, { replace: true });
    }
  }, [tokenData, form, navigate, token]);

  async function handlePay() {
    if (!form || !acceptTerms || !recaptchaToken) return;
    setError('');
    setSubmitting(true);

    try {
      // Step 1: Create the Registration (consumes the token, links it)
      const submitData = {
        ...form,
        phoneNumber: form.phoneNumber.replace(/^0+/, ''),
        emergencyPhoneNumber: form.emergencyPhoneNumber.replace(/^0+/, ''),
      };
      const regRes = await fetch(`/api/late-registration/${token}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      const regJson = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regJson?.message || 'Erreur lors de la création de l\'inscription');
      }
      const registrationId = regJson.registrationId;

      // Step 2: Initiate payment (token is consumed; pass registrationId as fallback)
      const payRes = await fetch(`/api/late-registration/${token}/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termsAccepted: true, registrationId, recaptchaToken }),
      });
      const payJson = await payRes.json();
      if (!payRes.ok) {
        throw new Error(payJson?.message || 'Erreur de paiement');
      }
      if (!payJson.satimRedirectUrl) {
        throw new Error('URL de paiement manquante');
      }

      sessionStorage.removeItem(`late_register_form_${token}`);
      window.location.href = payJson.satimRedirectUrl;
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      // Reset reCAPTCHA so the user can re-validate
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken(null);
      }
    }
  }

  const event = tokenData?.event;
  const recaptchaLang = i18n.language === 'ar' ? 'ar' : i18n.language === 'en' ? 'en' : 'fr';

  if (tokenError) {
    return (
      <PublicLayout title="Inscription tardive" event={null}>
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Lien invalide</h1>
            <p className="text-gray-600">{tokenError}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!tokenData || !form) {
    return (
      <PublicLayout title="Récapitulatif" event={null}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#C42826]" size={32} />
        </div>
      </PublicLayout>
    );
  }

  const brand = event?.primaryColor || '#C42826';
  const paymentAmount = event?.priceInCentimes || 0;

  return (
    <PublicLayout title="Récapitulatif" event={event}>
      <div className="py-10 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Late banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
            <Clock className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
            <div>
              <p className="font-semibold text-amber-900 mb-1">
                Inscription tardive — Dossard #{tokenData.bibNumber}
              </p>
              <p className="text-sm text-amber-800">
                Vérifiez vos informations puis procédez au paiement pour finaliser votre inscription.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left — Summary */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-lg bg-[#C42826]/10 flex items-center justify-center">
                    <User size={18} className="text-[#C42826]" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Récapitulatif</h2>
                </div>

                <Row label="Nom complet" value={`${form.firstName} ${form.lastName}`} />
                <Row label="Date de naissance" value={form.birthDate} />
                <Row label="Genre" value={form.gender} />
                <Row label="Nationalité" value={form.nationality} />
                <Row label="Email" value={form.email} />
                <Row label="Téléphone" value={`${form.phoneCountryCode} ${form.phoneNumber}`} />
                <Row label="Pays de résidence" value={form.countryOfResidence} />
                {form.countryOfResidence === 'Algérie' ? (
                  <>
                    <Row label="Wilaya" value={form.wilaya} />
                    <Row label="Commune" value={form.commune} />
                  </>
                ) : (
                  <Row label="Ville" value={form.ville} />
                )}
                <Row label="Urgence" value={`${form.emergencyPhoneCountryCode} ${form.emergencyPhoneNumber}`} />
                <Row label="Taille T-shirt" value={form.tshirtSize} />
                <Row label="Niveau" value={form.runnerLevel} />
                <Row label="Dossard réservé" value={<span className="font-mono text-[#C42826] font-bold">#{tokenData.bibNumber}</span>} />
                <Row label="Événement" value={event?.name} />
              </div>

              {/* Amount card */}
              <div className="rounded-2xl p-6 text-white" style={{ backgroundColor: brand }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Montant à payer</p>
                    <p className="text-3xl font-bold mt-1">
                      {`${(paymentAmount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`}
                      <span className="text-lg font-normal text-white/80 ms-2">DZD</span>
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center">
                    <CreditCard size={28} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Payment */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-[#C42826]/10 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-[#C42826]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Paiement</h2>
              </div>

              {/* Payment method */}
              <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 bg-gray-50/50">
                <img src="/cib_dahabia.svg" alt="CIB / EDAHABIA" className="h-9 w-auto" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">CIB / EDAHABIA</p>
                  <p className="text-xs text-gray-500">Paiement sécurisé via SATIM</p>
                </div>
                <Shirt className="hidden" size={0} />
              </div>

              <div className="flex items-center gap-2 bg-blue-50/70 rounded-lg px-3 py-2">
                <Lock size={13} className="text-blue-400 flex-shrink-0" />
                <p className="text-[11px] text-blue-600 leading-snug">
                  Vous serez dirigé vers un site de paiement sécurisé pour finaliser votre paiement.
                </p>
              </div>

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

              <div className="flex justify-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={(t) => setRecaptchaToken(t)}
                  onExpired={() => setRecaptchaToken(null)}
                  hl={recaptchaLang}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}

              <button
                onClick={handlePay}
                disabled={!acceptTerms || !recaptchaToken || submitting}
                style={{ backgroundColor: brand }}
                className="w-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Trophy size={16} />}
                {submitting ? 'Redirection...' : 'Procéder au paiement'}
              </button>

              <div className="text-center">
                <button
                  onClick={() => navigate(`/late-register/${token}`)}
                  disabled={submitting}
                  className="text-sm text-gray-400 hover:text-[#C42826] transition inline-flex items-center gap-1"
                >
                  <ArrowLeft size={14} />
                  Modifier mes informations
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
