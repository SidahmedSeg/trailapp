import { useState, useEffect, useCallback, useRef } from 'react';
import Select from 'react-select';
import { Camera, StopCircle, AlertCircle, CheckCircle2, Loader2, X, Search, ChevronRight } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { get, post } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { useAuth } from '../../hooks/useAuth';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import { selectStyles } from '../../data/formData';
import PickupDetails from '../../components/pickup/PickupDetails';
import { PROXY_RELATIONS } from '../../lib/pickup';

// react-select inside a fixed/modal — portal the menu to body and stack above
// the modal overlay (which sits at z-50).
const PROXY_RELATION_SELECT_STYLES = {
  ...selectStyles,
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

/**
 * Resize+re-encode a File via canvas (strips EXIF/GPS, shrinks 5-10MB phone
 * photos to ~300KB). Returns a Blob in JPEG.
 */
async function compressImage(file, maxWidth = 1600, quality = 0.8) {
  const bitmap = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  URL.revokeObjectURL(bitmap.src);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Conversion image échouée'));
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    distributed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  const labels = {
    confirmed: 'Confirmé',
    pending: 'En attente',
    distributed: 'Distribué',
    cancelled: 'Annulé',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  );
}

/* ─── Runner Modal ─── */
function RunnerModal({ runner, onClose, onDistribute }) {
  const [distributing, setDistributing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Proxy pickup state
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [isLinkedRunner, setIsLinkedRunner] = useState(false);
  const [linked, setLinked] = useState(null);           // { id, firstName, lastName, phone, bibNumber }
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pCin, setPCin] = useState('');
  const [pRelation, setPRelation] = useState('');
  const [photoPath, setPhotoPath] = useState('');        // set after upload succeeds
  const [photoPreview, setPhotoPreview] = useState('');  // local object URL
  const [photoStatus, setPhotoStatus] = useState('idle'); // idle | uploading | uploaded | failed
  const [photoError, setPhotoError] = useState('');

  // Reset state when runner changes
  useEffect(() => {
    setDistributing(false);
    setError('');
    setSuccess(false);
    setProxyEnabled(false);
    setIsLinkedRunner(false);
    setLinked(null);
    setPName('');
    setPPhone('');
    setPCin('');
    setPRelation('');
    setPhotoPath('');
    setPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    setPhotoStatus('idle');
    setPhotoError('');
  }, [runner?.id]);

  if (!runner) return null;

  const alreadyDistributed = runner.status === 'distribué' || runner.status === 'distributed';

  const proxyReady =
    !proxyEnabled ||
    (isLinkedRunner ? Boolean(linked) : (pName.trim().length > 0 && pPhone.trim().length > 0));

  // Block slide-to-distribute if photo is still uploading
  const canSubmit = proxyReady && photoStatus !== 'uploading';

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file
    if (!file) return;
    setPhotoError('');
    setPhotoStatus('uploading');
    try {
      const blob = await compressImage(file);
      // Preview from compressed blob
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      const previewUrl = URL.createObjectURL(blob);
      setPhotoPreview(previewUrl);

      const fd = new FormData();
      fd.append('photo', blob, 'cin.jpg');
      const token = getAccessToken();
      const res = await fetch(`/api/scan/${runner.id}/proxy-id-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setPhotoPath(data.path);
      setPhotoStatus('uploaded');
    } catch (err) {
      setPhotoStatus('failed');
      setPhotoError(err.message || 'Erreur lors de l\'envoi de la photo');
    }
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview('');
    setPhotoPath('');
    setPhotoStatus('idle');
    setPhotoError('');
  }

  const handleDistribute = async () => {
    setDistributing(true);
    setError('');
    try {
      const body = { eventId: runner.eventId };
      if (proxyEnabled) {
        body.proxy = isLinkedRunner && linked
          ? {
              name: `${linked.firstName || ''} ${linked.lastName || ''}`.trim(),
              phone: linked.phone || '',
              relation: pRelation || undefined,
              cin: pCin.trim() || undefined,
              cinPhotoPath: photoPath || undefined,
              linkedRegistrationId: linked.id,
            }
          : {
              name: pName.trim(),
              phone: pPhone.trim(),
              cin: pCin.trim() || undefined,
              relation: pRelation || undefined,
              cinPhotoPath: photoPath || undefined,
            };
      }
      await post(`/scan/${runner.qrToken}/distribute`, body);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Erreur lors de la distribution.');
    }
    setDistributing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Coureur — Dossard #{runner.bibNumber}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 overflow-y-auto">
          <InfoRow label="Nom" value={`${runner.firstName || ''} ${runner.lastName || ''}`} />
          <InfoRow label="Email" value={runner.email} />
          <InfoRow label="Téléphone" value={runner.phone} />
          <InfoRow label="Taille t-shirt" value={runner.tshirtSize} />
          <InfoRow label="Statut" value={<StatusBadge status={runner.status} />} />

          {alreadyDistributed && runner.pickedUpByName && (
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Déjà récupéré par</p>
              <p className="text-gray-900 font-medium">{runner.pickedUpByName}</p>
              {runner.pickedUpByPhone && <p className="text-gray-600">{runner.pickedUpByPhone}</p>}
            </div>
          )}

          {!alreadyDistributed && (
            <ProxySection
              eventId={runner.eventId}
              runnerId={runner.id}
              enabled={proxyEnabled}
              setEnabled={setProxyEnabled}
              isLinkedRunner={isLinkedRunner}
              setIsLinkedRunner={(v) => { setIsLinkedRunner(v); setLinked(null); setPName(''); setPPhone(''); }}
              linked={linked}
              setLinked={setLinked}
              pName={pName} setPName={setPName}
              pPhone={pPhone} setPPhone={setPPhone}
              pCin={pCin} setPCin={setPCin}
              pRelation={pRelation} setPRelation={setPRelation}
              photoStatus={photoStatus}
              photoPreview={photoPreview}
              photoError={photoError}
              onPhotoChange={handlePhotoChange}
              onPhotoClear={clearPhoto}
            />
          )}

          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Dossard distribué avec succès !
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 space-y-3 flex-shrink-0">
          {!success && !alreadyDistributed && (
            <>
              {proxyEnabled && !proxyReady && (
                <p className="text-xs text-amber-600">Renseignez nom + téléphone du récupérateur.</p>
              )}
              {proxyEnabled && photoStatus === 'uploading' && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Envoi de la photo…
                </p>
              )}
              <SlideToDistribute
                onConfirm={handleDistribute}
                distributing={distributing}
                disabled={!canSubmit}
              />
            </>
          )}
          <button
            onClick={success ? () => { onDistribute(); onClose(); } : onClose}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer text-center"
          >
            {success ? 'Fermer' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Proxy section subcomponent ─── */
function ProxySection({
  eventId, runnerId,
  enabled, setEnabled,
  isLinkedRunner, setIsLinkedRunner,
  linked, setLinked,
  pName, setPName, pPhone, setPPhone, pCin, setPCin, pRelation, setPRelation,
  photoStatus, photoPreview, photoError, onPhotoChange, onPhotoClear,
}) {
  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-gray-900">Récupéré par un tiers ?</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${enabled ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>Non</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-[#C42826]' : 'bg-gray-300'}`}
            aria-pressed={enabled}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
          <span className={`text-xs ${enabled ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>Oui</span>
        </div>
      </label>

      {enabled && (
        <>
          {/* Sub-toggle: registered runner or not */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Le récupérateur est-il un coureur inscrit ?</span>
            <button
              type="button"
              onClick={() => setIsLinkedRunner(false)}
              className={`px-2.5 py-1 rounded-md border transition cursor-pointer ${!isLinkedRunner ? 'border-[#C42826] bg-[#C42826]/5 text-[#C42826] font-medium' : 'border-gray-200 bg-white text-gray-600'}`}
            >
              Non
            </button>
            <button
              type="button"
              onClick={() => setIsLinkedRunner(true)}
              className={`px-2.5 py-1 rounded-md border transition cursor-pointer ${isLinkedRunner ? 'border-[#C42826] bg-[#C42826]/5 text-[#C42826] font-medium' : 'border-gray-200 bg-white text-gray-600'}`}
            >
              Oui
            </button>
          </div>

          {isLinkedRunner ? (
            // Linked-runner mode: the FK gives us full accountability — identity
            // capture (name/phone/CIN/relation/photo) is redundant and hidden.
            <RunnerSearch
              eventId={eventId}
              excludeId={runnerId}
              selected={linked}
              onSelect={setLinked}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Nom complet *"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] outline-none"
                />
                <input
                  type="tel"
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  placeholder="Téléphone *"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={pCin}
                  onChange={(e) => setPCin(e.target.value)}
                  placeholder="N° CIN (optionnel)"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] outline-none"
                />
                <Select
                  value={PROXY_RELATIONS.find((r) => r.value === pRelation) || null}
                  onChange={(opt) => setPRelation(opt ? opt.value : '')}
                  options={PROXY_RELATIONS}
                  placeholder="Relation (optionnel)"
                  isClearable
                  styles={PROXY_RELATION_SELECT_STYLES}
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  menuPosition="fixed"
                />
              </div>

              {/* Photo CIN — prominent CTA, opens device camera on mobile */}
              {photoPreview ? (
                <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-start gap-3">
                  <img src={photoPreview} alt="Aperçu CIN" className="w-20 h-20 rounded-md object-cover border border-gray-200" />
                  <div className="flex-1 text-xs space-y-1">
                    {photoStatus === 'uploading' && (
                      <p className="flex items-center gap-1 text-blue-700"><Loader2 size={12} className="animate-spin" /> Envoi en cours…</p>
                    )}
                    {photoStatus === 'uploaded' && (
                      <p className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> Photo enregistrée</p>
                    )}
                    {photoStatus === 'failed' && (
                      <p className="flex items-center gap-1 text-red-700"><AlertCircle size={12} /> {photoError || 'Échec'}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <label className="text-[#C42826] hover:underline cursor-pointer">
                        Refaire
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoChange} />
                      </label>
                      <button type="button" onClick={onPhotoClear} className="text-gray-500 hover:underline cursor-pointer">Supprimer</button>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="proxy-cin-photo-input"
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#C42826]/40 bg-white px-4 py-3 text-sm font-medium text-[#C42826] hover:bg-[#C42826]/5 transition cursor-pointer"
                >
                  <Camera size={18} />
                  <span>Prendre photo CIN</span>
                  <span className="text-xs text-gray-400">(recommandé)</span>
                  <input
                    id="proxy-cin-photo-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onPhotoChange}
                  />
                </label>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Runner autocomplete search ─── */
function RunnerSearch({ eventId, excludeId, selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (selected) return;
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '10', search: query, eventId });
    const t = setTimeout(() => {
      get(`/admin/runners?${params}`)
        .then((data) => setResults((data.data || []).filter((r) => r.id !== excludeId)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, eventId, excludeId, selected]);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2">
        <div className="text-sm">
          <span className="font-mono text-[#C42826]">#{selected.bibNumber}</span>
          <span className="ml-2 text-gray-900">{selected.firstName} {selected.lastName}</span>
          {selected.phone && <p className="text-xs text-gray-500 mt-0.5">{selected.phone}</p>}
        </div>
        <button type="button" onClick={() => { onSelect(null); setQuery(''); }} className="text-xs text-gray-500 hover:underline cursor-pointer">Changer</button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher par nom ou dossard…"
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-[#C42826] outline-none"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-500"><Loader2 size={12} className="animate-spin inline mr-1" />Recherche…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">Aucun résultat.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onSelect({ id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone, bibNumber: r.bibNumber }); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2"
              >
                <span className="font-mono text-[#C42826]">#{r.bibNumber}</span>
                <span className="text-gray-900">{r.firstName} {r.lastName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value || '—'}</span>
    </div>
  );
}

/* ─── History proxy detail modal ─── */
// Thin wrapper around the shared <PickupDetails/> — only adds the session
// header (bib + runner + distribute timestamp + operator) on top of the block.
function HistoryProxyModal({ session, onClose }) {
  const p = session.proxy || {};
  const pickup = {
    name: p.name,
    phone: p.phone,
    cin: p.cin,
    relation: p.relation,
    pickedUpAt: p.pickedUpAt,
    hasCinPhoto: p.hasCinPhoto,
    linkedRegistration: p.linkedRegistration,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Récupération du dossard</p>
            <h3 className="text-lg font-semibold text-gray-900">#{session.bibNumber} — {session.runnerName}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 cursor-pointer"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
            <InfoRow label="Distribué le" value={session.scannedAt ? new Date(session.scannedAt).toLocaleString('fr-FR') : '—'} />
            <InfoRow label="Opérateur" value={session.operatorName} />
          </div>

          <PickupDetails
            pickup={pickup}
            registrationId={session.registrationId}
            variant="rows"
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Scanner View ─── */
export default function ScannerView() {
  const { user, logout } = useAuth();
  const { events, selectedEventId, switchEvent, selectedEvent } = useEvent();

  const [bibInput, setBibInput] = useState('');
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDetail, setHistoryDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // QR Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerRef = useRef(null);

  // Fetch session history
  const fetchHistory = useCallback(async () => {
    try {
      const q = selectedEventId ? `?eventId=${selectedEventId}` : '';
      const data = await get(`/scan/session/history${q}`);
      setHistory(data.data || []);
    } catch { /* ignore */ }
  }, [selectedEventId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // QR Scanner setup & cleanup
  useEffect(() => {
    if (!scannerActive) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    const onScanSuccess = async (decodedText) => {
      // Extract qrToken from the URL (format: http://domain/api/scan/{qrToken})
      let qrToken = decodedText;
      try {
        const url = new URL(decodedText);
        const parts = url.pathname.split('/');
        // Find "scan" in the path and take the next segment as the token
        const scanIndex = parts.indexOf('scan');
        if (scanIndex !== -1 && parts[scanIndex + 1]) {
          qrToken = parts[scanIndex + 1];
        }
      } catch {
        // If it's not a URL, treat the entire decoded text as the token
        qrToken = decodedText;
      }

      // Stop scanner immediately after successful scan
      try {
        await scanner.clear();
      } catch { /* ignore */ }
      setScannerActive(false);
      scannerRef.current = null;

      // Fetch runner info
      try {
        const data = await get(`/scan/${qrToken}`);
        setSelectedRunner(data.data || data);
      } catch (err) {
        setScannerError(err.message || 'Coureur introuvable pour ce QR code.');
      }
    };

    const onScanFailure = () => {
      // Silence continuous scan failures (expected while searching)
    };

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      try {
        scanner.clear();
      } catch { /* ignore cleanup errors */ }
      scannerRef.current = null;
    };
  }, [scannerActive]);

  const startScanner = () => {
    setScannerError('');
    setScannerActive(true);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  const handleManualSearch = async () => {
    if (!bibInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const q = selectedEventId ? `?eventId=${selectedEventId}` : '';
      const data = await get(`/scan/manual/${bibInput.trim()}${q}`);
      setSelectedRunner(data.data || data);
    } catch (err) {
      setError(err.message || 'Coureur introuvable.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleManualSearch();
  };

  const handleModalClose = () => {
    setSelectedRunner(null);
    fetchHistory();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Scanner</h2>
            <p className="text-gray-500 text-sm mt-1">Distribution des dossards</p>
          </div>
          {events.length > 1 && (
            <select
              value={selectedEventId || ''}
              onChange={(e) => switchEvent(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] focus:ring-1 focus:ring-[#C42826] outline-none"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>{evt.name}{evt.active ? ' (actif)' : ''}</option>
              ))}
            </select>
          )}
        </div>

        {/* QR Camera Scanner */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Scanner QR</h2>

          {!scannerActive ? (
            <button
              onClick={startScanner}
              className="flex items-center gap-2 rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Scanner QR
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex items-center gap-2 rounded-lg bg-gray-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              Arrêter le scanner
            </button>
          )}

          {scannerActive && (
            <div className="mt-4 w-full max-w-lg mx-auto">
              <div id="qr-reader" className="rounded-lg overflow-hidden" />
            </div>
          )}

          {scannerError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
              {scannerError}
            </div>
          )}
        </section>

        {/* Manual Bib Search */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Recherche manuelle par dossard</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Numéro de dossard..."
              value={bibInput}
              onChange={(e) => setBibInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] transition"
            />
            <button
              onClick={handleManualSearch}
              disabled={loading}
              className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? '...' : 'Rechercher'}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}
        </section>

        {/* Session History */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Historique de session</h2>
            <input
              type="text"
              placeholder="Rechercher par nom ou dossard..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full sm:w-72 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] transition"
            />
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            {(() => {
              const filtered = historySearch.trim()
                ? history.filter((h) => {
                    const q = historySearch.toLowerCase();
                    return (h.runnerName || '').toLowerCase().includes(q) || String(h.bibNumber).includes(q);
                  })
                : history;
              return filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  {historySearch ? 'Aucun résultat.' : 'Aucune distribution enregistrée pour cette session.'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((h, i) => {
                    const hasProxy = Boolean(h.proxy && h.proxy.name);
                    const innerContent = (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[#C42826]">#{h.bibNumber}</span>
                            <span className="text-gray-900">{h.runnerName}</span>
                            {hasProxy && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-medium">
                                Tiers
                              </span>
                            )}
                          </div>
                          {hasProxy && (
                            <p className="mt-0.5 text-xs text-gray-500 truncate">
                              Récupéré par <span className="text-gray-700 font-medium">{h.proxy.name}</span>
                              {h.proxy.linkedRegistration && (
                                <> · #{h.proxy.linkedRegistration.bibNumber} {h.proxy.linkedRegistration.firstName} {h.proxy.linkedRegistration.lastName}</>
                              )}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">
                          {h.scannedAt ? new Date(h.scannedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </>
                    );
                    return (
                      <li key={i}>
                        {hasProxy ? (
                          <button
                            type="button"
                            onClick={() => setHistoryDetail(h)}
                            className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 transition cursor-pointer"
                          >
                            {innerContent}
                          </button>
                        ) : (
                          <div className="px-4 py-3 flex items-start justify-between gap-3">
                            {innerContent}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
        </section>
      </main>

      {/* Proxy pickup detail modal (from history list) */}
      {historyDetail && (
        <HistoryProxyModal session={historyDetail} onClose={() => setHistoryDetail(null)} />
      )}

      {/* Modal */}
      <RunnerModal
        runner={selectedRunner}
        onClose={handleModalClose}
        onDistribute={handleModalClose}
      />
    </div>
  );
}

/* ─── Slide to Distribute ─── */
function SlideToDistribute({ onConfirm, distributing, disabled }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const thumbWidth = 48;

  const getMaxOffset = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - thumbWidth - 8;
  }, []);

  const handleMove = useCallback((clientX) => {
    if (!dragging || confirmed || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const newOffset = Math.max(0, Math.min(clientX - rect.left - thumbWidth / 2 - 4, getMaxOffset()));
    setOffset(newOffset);
  }, [dragging, confirmed, getMaxOffset]);

  const handleEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const max = getMaxOffset();
    if (offset >= max * 0.9) {
      setOffset(max);
      setConfirmed(true);
      onConfirm();
    } else {
      setOffset(0);
    }
  }, [dragging, offset, getMaxOffset, onConfirm]);

  // Reset offset whenever the disabled state changes back to enabled
  useEffect(() => { if (disabled) setOffset(0); }, [disabled]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e) => handleMove(e.clientX);
    const onTouchMove = (e) => handleMove(e.touches[0].clientX);
    const onEnd = () => handleEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging, handleMove, handleEnd]);

  const max = getMaxOffset();
  const progress = max > 0 ? offset / max : 0;

  if (distributing) {
    return (
      <div className="h-14 rounded-xl bg-emerald-500 flex items-center justify-center">
        <span className="text-sm font-medium text-white">Distribution en cours...</span>
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-xl select-none overflow-hidden transition-colors ${
        confirmed ? 'bg-emerald-500' : disabled ? 'bg-gray-100 opacity-50' : 'bg-gray-100'
      }`}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-sm font-medium transition-opacity ${confirmed ? 'text-white' : 'text-gray-400'}`}
          style={{ opacity: confirmed ? 1 : Math.max(0, 1 - progress * 2) }}>
          {confirmed ? 'Distribué !' : 'Glisser pour distribuer'}
        </span>
      </div>

      {!confirmed && (
        <div
          className={`absolute top-1 left-1 w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
          style={{ transform: `translateX(${offset}px)` }}
          onMouseDown={(e) => { if (disabled) return; e.preventDefault(); setDragging(true); }}
          onTouchStart={() => { if (disabled) return; setDragging(true); }}
        >
          <ChevronRight size={20} className="text-white" />
          <ChevronRight size={20} className="text-white -ml-3" />
        </div>
      )}
    </div>
  );
}
