import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { CircleCheck, Download, Send, User, Shirt, Trophy, Phone, Mail, Calendar, MapPin, CreditCard, ArrowLeft, CheckCircle, Printer } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

export default function Success() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingPdf, setSendingPdf] = useState(false);
  const [pdfSent, setPdfSent] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [sendToEmail, setSendToEmail] = useState('');

  useEffect(() => {
    if (!id) {
      setError(t('success.noId', 'Aucun identifiant d\'inscription trouvé.'));
      setLoading(false);
      return;
    }

    fetch(`/api/registration/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(t('success.notFound', 'Inscription introuvable.'));
        return res.json();
      })
      .then((data) => setRegistration(data.data || data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleDownloadPdf() {
    window.open(`/api/registration/${id}/pdf`, '_blank');
  }

  async function handleSendPdf() {
    const targetEmail = sendToEmail.trim() || null;
    setSendingPdf(true);
    try {
      const res = await fetch(`/api/registration/${id}/send-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Erreur lors de l\'envoi.');
      }
      setPdfSent(true);
      setShowEmailInput(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingPdf(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout title={t('success.title')}>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-[#C42826] border-t-transparent rounded-full" />
        </div>
      </PublicLayout>
    );
  }

  if (error) {
    return (
      <PublicLayout title={t('success.title')}>
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
  const brand = r.event?.primaryColor || '#C42826';
  const scanUrl = `${window.location.origin}/api/scan/${r.qrToken}`;

  return (
    <PublicLayout title={t('success.title')}>
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Success banner */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-b from-emerald-50 to-white pt-8 pb-6 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CircleCheck size={40} className="text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{t('success.banner')}</h1>
              <p className="text-sm text-gray-500 mt-2">{t('success.message')}</p>
            </div>
          </div>

          {/* Bib number + QR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bib card */}
            <div className="rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{ backgroundColor: brand }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
              <div className="relative">
                <p className="text-sm text-white/70 uppercase tracking-wider mb-2">{t('success.bib')}</p>
                <div className="text-7xl font-black">{r.bibNumber || '—'}</div>
                <p className="text-sm text-white/60 mt-2">{r.event?.name || 'Trail des Mouflons d\'Or 2026'}</p>
              </div>
            </div>

            {/* QR Code card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center">
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <QRCodeSVG value={scanUrl} size={160} level="M" />
              </div>
              <p className="text-xs text-gray-400 mt-3">{t('success.scanToVerify')}</p>
            </div>
          </div>

          {/* Participant info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brand}15` }}>
                <User size={18} style={{ color: brand }} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t('success.participant')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField icon={User} label={t('success.fields.fullName')} value={`${r.firstName} ${r.lastName}`} color={brand} />
              <InfoField icon={Mail} label={t('success.fields.email')} value={r.email} color={brand} />
              <InfoField icon={Phone} label={t('success.fields.phone')} value={r.phone} color={brand} />
              <InfoField icon={Shirt} label={t('success.fields.tshirt')} value={r.tshirtSize} color={brand} />
              <InfoField icon={Trophy} label={t('success.fields.level')} value={r.runnerLevel} color={brand} />
              <InfoField icon={User} label={t('success.fields.gender')} value={r.gender} color={brand} />
            </div>
          </div>

          {/* Event info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brand}15` }}>
                <Calendar size={18} style={{ color: brand }} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t('success.event')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <EventCard icon={Calendar} label={t('success.fields.date')} value={r.event?.date ? new Date(r.event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} color={brand} />
              <EventCard icon={MapPin} label={t('success.fields.location')} value={r.event?.location || '—'} color={brand} />
              <EventCard icon={CreditCard} label={t('success.fields.amountPaid')} value={r.paymentAmount ? `${(r.paymentAmount / 100).toLocaleString('fr-FR')} DZD` : '—'} color={brand} />
            </div>
          </div>

          {/* Transaction details */}
          {(r.transactionId || r.paymentStatus) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brand}15` }}>
                  <CreditCard size={18} style={{ color: brand }} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('success.transaction')}</h2>
              </div>
              <div className="space-y-3">
                {r.orderNumber && <TransactionRow label="N° de commande" value={r.orderNumber} mono />}
                {r.transactionId && <TransactionRow label={t('success.fields.transactionId')} value={r.transactionId} mono />}
                {r.approvalCode && <TransactionRow label="N° d'approbation" value={r.approvalCode} mono />}
                {r.paymentMethod && <TransactionRow label={t('success.fields.method')} value={r.paymentMethod} />}
                {r.paymentDate && <TransactionRow label={t('success.fields.paymentDate')} value={new Date(r.paymentDate).toLocaleString('fr-FR')} />}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{t('success.fields.status')}</span>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">
                    <CheckCircle size={12} />
                    {r.paymentStatus === 'success' ? t('success.paid') : r.paymentStatus === 'manual' ? 'Manuel' : r.paymentStatus || t('success.paid')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SATIM 3020 support — compact */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <img src="/3020.svg" alt="3020" className="h-10 flex-shrink-0" />
            <p className="text-xs font-bold text-emerald-900">
              EN CAS DE PROBLEME DE PAIEMENT, CONTACTEZ NOTRE SERVICE CLIENT : 3020
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={handleDownloadPdf}
              style={{ backgroundColor: brand }}
              className="hover:opacity-90 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {t('success.downloadPdf')}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl text-sm transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Printer size={18} />
              Imprimer
            </button>
            <button
              onClick={() => {
                if (pdfSent) return;
                if (!showEmailInput) {
                  setSendToEmail(r.email || '');
                  setShowEmailInput(true);
                } else {
                  handleSendPdf();
                }
              }}
              disabled={sendingPdf || pdfSent}
              className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl text-sm transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {pdfSent ? <CheckCircle size={18} className="text-emerald-500" /> : <Send size={18} />}
              {pdfSent ? t('success.emailSent') : sendingPdf ? t('common.sending') : t('success.sendEmail')}
            </button>
          </div>

          {/* Email input */}
          {showEmailInput && !pdfSent && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Envoyer le ticket à :</label>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={sendToEmail}
                  onChange={(e) => setSendToEmail(e.target.value)}
                  placeholder="adresse@email.com"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50/80 focus:bg-white focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 outline-none transition"
                />
                <button
                  onClick={handleSendPdf}
                  disabled={sendingPdf || !sendToEmail.trim()}
                  style={{ backgroundColor: brand }}
                  className="hover:opacity-90 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition cursor-pointer flex items-center gap-2"
                >
                  <Send size={16} />
                  {sendingPdf ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Par défaut : {r.email}</p>
            </div>
          )}

          {/* Back */}
          <div className="text-center pb-4">
            <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#C42826] transition">
              <ArrowLeft size={14} />
              {t('common.backHome')}
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function InfoField({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-start gap-3 bg-gray-50/70 rounded-xl px-4 py-3">
      <Icon size={16} style={color ? { color } : undefined} className={color ? 'mt-0.5 flex-shrink-0' : 'text-gray-400 mt-0.5 flex-shrink-0'} />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function EventCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-4 text-center">
      <Icon size={20} style={{ color: color || '#C42826' }} className="mx-auto mb-2" />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function TransactionRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
