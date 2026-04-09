import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { CircleCheck, Download, Send } from 'lucide-react';
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
    setSendingPdf(true);
    try {
      const res = await fetch(`/api/registration/${id}/send-pdf`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || t('success.sendError', 'Erreur lors de l\'envoi.'));
      }
      setPdfSent(true);
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
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Link to="/" className="mt-4 inline-block text-[#C42826] hover:underline text-sm">{t('common.backHome')}</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const r = registration;
  const scanUrl = `${window.location.origin}/verify/${id}`;

  return (
    <PublicLayout title={t('success.title')}>
      <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success banner */}
        <div className="bg-green-600 text-white rounded-2xl p-6 text-center shadow-sm">
          <CircleCheck size={48} className="mb-2 text-green-400" />
          <h1 className="text-2xl font-bold">{t('success.banner')}</h1>
          <p className="text-green-100 mt-1 text-sm">{t('success.message')}</p>
        </div>

        {/* Bib number + QR */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center flex-1">
            <p className="text-sm text-gray-500 mb-1">{t('success.bib')}</p>
            <div className="text-6xl font-black text-[#C42826]">{r.bibNumber || '—'}</div>
          </div>
          <div className="flex-shrink-0">
            <QRCodeSVG value={scanUrl} size={140} level="M" />
            <p className="text-xs text-gray-400 text-center mt-2">{t('success.scanToVerify')}</p>
          </div>
        </div>

        {/* Participant info */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">{t('success.participant')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">{t('success.fields.fullName')}</span>
              <p className="font-medium text-gray-800">{r.firstName} {r.lastName}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('success.fields.email')}</span>
              <p className="font-medium text-gray-800">{r.email}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('success.fields.phone')}</span>
              <p className="font-medium text-gray-800">{r.phone}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('success.fields.tshirt')}</span>
              <p className="font-medium text-gray-800">{r.tshirtSize}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('success.fields.level')}</span>
              <p className="font-medium text-gray-800 capitalize">{r.level}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('success.fields.gender')}</span>
              <p className="font-medium text-gray-800">{r.gender === 'male' ? t('register.genders.male') : r.gender === 'female' ? t('register.genders.female') : r.gender}</p>
            </div>
          </div>
        </div>

        {/* Event info */}
        {(r.eventName || r.eventDate || r.eventCity) && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">{t('success.event')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {r.eventName && (
                <div>
                  <span className="text-gray-500">{t('success.event')}</span>
                  <p className="font-medium text-gray-800">{r.eventName}</p>
                </div>
              )}
              {r.eventDate && (
                <div>
                  <span className="text-gray-500">{t('success.fields.date')}</span>
                  <p className="font-medium text-gray-800">{r.eventDate}</p>
                </div>
              )}
              {r.eventCity && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500">{t('success.fields.location')}</span>
                  <p className="font-medium text-gray-800">{r.eventCity}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction details */}
        {(r.transactionId || r.paymentDate || r.amount) && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">{t('success.transaction')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {r.transactionId && (
                    <tr>
                      <td className="py-2 text-gray-500">{t('success.fields.transactionId')}</td>
                      <td className="py-2 text-right font-medium text-gray-800 font-mono">{r.transactionId}</td>
                    </tr>
                  )}
                  {r.transactionNumber && (
                    <tr>
                      <td className="py-2 text-gray-500">{t('success.fields.orderId')}</td>
                      <td className="py-2 text-right font-medium text-gray-800 font-mono">{r.transactionNumber}</td>
                    </tr>
                  )}
                  {r.paymentDate && (
                    <tr>
                      <td className="py-2 text-gray-500">{t('success.fields.paymentDate')}</td>
                      <td className="py-2 text-right font-medium text-gray-800">{r.paymentDate}</td>
                    </tr>
                  )}
                  {r.payment_method && (
                    <tr>
                      <td className="py-2 text-gray-500">{t('success.fields.method')}</td>
                      <td className="py-2 text-right font-medium text-gray-800">{r.payment_method}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-gray-500 font-semibold">{t('success.fields.amountPaid')}</td>
                    <td className="py-2 text-right font-bold text-[#C42826]">
                      DZD {r.amount ? Number(r.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : '2 000,00'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500">{t('success.fields.status')}</td>
                    <td className="py-2 text-right">
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {r.payment_status || t('success.paid')}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownloadPdf}
            className="flex-1 bg-[#C42826] hover:bg-[#a82220] text-white font-semibold py-3 rounded-xl text-sm transition shadow-sm text-center"
          >
            {t('success.downloadPdf')}
          </button>
          <button
            onClick={handleSendPdf}
            disabled={sendingPdf || pdfSent}
            className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl text-sm transition shadow-sm disabled:opacity-50 text-center"
          >
            {pdfSent ? t('success.emailSent') : sendingPdf ? t('common.sending') : t('success.sendEmail')}
          </button>
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-[#C42826] transition">{t('common.backHome')}</Link>
        </div>
      </div>
      </div>
    </PublicLayout>
  );
}
