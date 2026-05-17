import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

export default function VolunteerCard() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/benevole/card/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.message || `Erreur ${r.status}`);
        return j;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function downloadPDF() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/benevole/card/${token}/pdf`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benevole-${data?.volunteerId || 'card'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Téléchargement impossible');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout title="Carte bénévole">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#C42826]" size={32} />
        </div>
      </PublicLayout>
    );
  }

  if (error || !data) {
    return (
      <PublicLayout title="Carte bénévole">
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Carte introuvable</h1>
            <p className="text-gray-600">{error || 'Aucune carte correspondante.'}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const brand = data.event?.primaryColor || '#C42826';
  const eventName = data.event?.name || 'Événement';
  const eventDate = data.event?.date
    ? new Date(data.event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const eventLocation = data.event?.location || '';
  const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  const cardUrl = `${window.location.origin}/benevole/card/${token}`;
  const skills = data.skills || [];

  return (
    <PublicLayout title="Carte bénévole" event={data.event}>
      <div className="py-10 px-4 flex flex-col items-center">
        {/* Badge card — same proportions as the PDF (~A6 portrait, scaled up for screen) */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header band */}
          <div className="px-5 py-4 text-center" style={{ backgroundColor: brand }}>
            <h2 className="text-white text-base font-bold uppercase tracking-wide truncate">{eventName}</h2>
            {(eventDate || eventLocation) && (
              <p className="text-white/85 text-xs mt-1">
                {[eventDate, eventLocation].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <div className="p-6 text-center">
            <p className="text-[11px] tracking-[0.2em] font-bold text-gray-400">BÉNÉVOLE</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-3">{fullName || '—'}</h1>

            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              {data.email && <p>{data.email}</p>}
              {data.phone && <p>{data.phone}</p>}
            </div>

            {/* ID pill */}
            <div className="mt-5 inline-block rounded-lg px-6 py-2.5"
              style={{ backgroundColor: brand }}>
              <span className="text-white text-xl font-bold font-mono tracking-wider">
                {data.volunteerId || '----'}
              </span>
            </div>

            {/* Skills */}
            {(skills.length > 0 || data.otherSkills) && (
              <div className="mt-5">
                <p className="text-[10px] tracking-[0.15em] font-bold text-gray-600 mb-2">COMPÉTENCES</p>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {skills.map((s) => (
                      <span key={s} className="text-[11px] font-medium rounded-full border px-2.5 py-0.5"
                        style={{ borderColor: brand, color: brand }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {data.otherSkills && (
                  <p className="text-xs italic text-gray-500 mt-2">Autres : {data.otherSkills}</p>
                )}
              </div>
            )}

            {/* QR */}
            <div className="mt-6 inline-block rounded-lg border border-gray-200 p-3 bg-white">
              <QRCodeSVG value={cardUrl} size={140} level="M" />
            </div>

            <p className="text-[10px] text-gray-400 mt-3">Scannable pour vérification</p>
          </div>
        </div>

        {/* Download button */}
        <button onClick={downloadPDF} disabled={downloading}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#C42826] text-white px-6 py-3 text-sm font-semibold hover:bg-[#a82220] transition cursor-pointer disabled:opacity-60">
          {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          {downloading ? 'Téléchargement…' : 'Télécharger PDF'}
        </button>
      </div>
    </PublicLayout>
  );
}
