import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ShieldCheck, CheckCircle, ArrowLeft, Trophy } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  );
}

export default function ReconciliationRecap() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [tokenData, setTokenData] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { matched: bool, registrationId, bibNumber, message }
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/reconciliation/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message || 'Lien invalide');
        return json;
      })
      .then((d) => setTokenData(d))
      .catch((err) => setTokenError(err.message));

    const stashed = sessionStorage.getItem(`reconciliation_form_${token}`);
    if (stashed) {
      try { setForm(JSON.parse(stashed)); } catch { /* ignore */ }
    }
  }, [token]);

  // If no form data in session, send back to the form
  useEffect(() => {
    if (tokenData && !form) {
      navigate(`/reconciliation/${token}`, { replace: true });
    }
  }, [tokenData, form, navigate, token]);

  async function handleValidate() {
    if (!form) return;
    setError('');
    setSubmitting(true);
    try {
      const submitData = {
        ...form,
        phoneNumber: form.phoneNumber.replace(/^0+/, ''),
        emergencyPhoneNumber: form.emergencyPhoneNumber.replace(/^0+/, ''),
      };
      const res = await fetch(`/api/reconciliation/${token}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Erreur lors de la soumission');
      sessionStorage.removeItem(`reconciliation_form_${token}`);
      setDone(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const event = tokenData?.event;

  if (tokenError) {
    return (
      <PublicLayout title="Réconciliation" event={null}>
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

  // Done states
  if (done) {
    const matched = done.matched;
    return (
      <PublicLayout title="Inscription validée" event={event}>
        <div className="flex items-center justify-center px-4 py-16">
          <div className={`rounded-2xl shadow-lg p-10 max-w-lg text-center ${matched ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
            {matched ? (
              <CheckCircle size={56} className="mx-auto mb-4 text-emerald-600" />
            ) : (
              <AlertCircle size={56} className="mx-auto mb-4 text-amber-600" />
            )}
            <h1 className={`text-2xl font-bold mb-3 ${matched ? 'text-emerald-800' : 'text-amber-800'}`}>
              {matched ? 'Inscription validée !' : 'Inscription enregistrée'}
            </h1>
            {matched && done.bibNumber && (
              <p className="text-emerald-700 mb-3">
                Votre dossard : <strong className="text-3xl">{done.bibNumber}</strong>
              </p>
            )}
            <p className={`text-sm ${matched ? 'text-emerald-700' : 'text-amber-700'}`}>
              {done.message}
            </p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="Récapitulatif" event={event}>
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Reconciliation banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
            <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={22} />
            <div>
              <p className="font-semibold text-emerald-800 mb-1">Paiement déjà confirmé</p>
              <p className="text-sm text-emerald-700">
                Carte ****{tokenData.cardPan} — votre paiement SATIM est sur notre dossier. Cliquez sur
                <strong> "Valider mon inscription"</strong> pour finaliser.
              </p>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif de votre inscription</h2>
            <Row label="Nom complet" value={`${form.lastName} ${form.firstName}`} />
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
            <Row label="Contact d'urgence" value={`${form.emergencyPhoneCountryCode} ${form.emergencyPhoneNumber}`} />
            <Row label="Taille T-shirt" value={form.tshirtSize} />
            <Row label="Niveau" value={form.runnerLevel} />
            <Row label="Carte (4 derniers chiffres)" value={`****${form.enteredCardPan}`} />
            <Row label="Événement" value={event?.name} />
          </div>

          {error && <p className="text-sm text-red-500 text-center mb-3">{error}</p>}

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
            <button onClick={() => navigate(`/reconciliation/${token}`)}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-gray-700 px-6 py-3 font-medium hover:bg-gray-50 transition cursor-pointer">
              <ArrowLeft size={16} />
              Modifier
            </button>
            <button onClick={handleValidate} disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C42826] text-white px-8 py-3 font-semibold hover:bg-[#a82220] transition cursor-pointer disabled:opacity-60">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} />}
              {submitting ? 'Validation...' : 'Valider mon inscription'}
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
