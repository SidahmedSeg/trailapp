import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Camera, StopCircle, Flag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { get, post } from '../../lib/api';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import { Html5QrcodeScanner } from 'html5-qrcode';

/* ─── Runner Modal — Check-in flavor ─── */
function CheckInModal({ runner, onClose, onSuccess }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setChecking(false);
    setError('');
    setSuccess(false);
  }, [runner?.id]);

  if (!runner) return null;

  const isDistributed = runner.status === 'distribué' || runner.status === 'distributed';
  const isAlreadyCheckedIn = !!runner.checkedInAt;

  const handleCheckIn = async () => {
    setChecking(true);
    setError('');
    try {
      await post(`/scan/${runner.qrToken}/check-in`, { eventId: runner.eventId });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Erreur lors du check-in.');
    }
    setChecking(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Coureur — Dossard #{runner.bibNumber}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <InfoRow label="Nom" value={`${runner.firstName || ''} ${runner.lastName || ''}`} />
          <InfoRow label="Email" value={runner.email} />
          <InfoRow label="Téléphone" value={runner.phone} />
          <InfoRow label="Taille t-shirt" value={runner.tshirtSize} />

          {/* State panels */}
          {!isDistributed && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Dossard non distribué</p>
                <p className="mt-0.5">Le coureur doit d'abord récupérer son dossard au stand de retrait.</p>
              </div>
            </div>
          )}

          {isDistributed && isAlreadyCheckedIn && !success && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">Déjà enregistré</p>
                <p className="mt-0.5">
                  Le {new Date(runner.checkedInAt).toLocaleString('fr-FR')} par {runner.checkedInBy || '—'}
                </p>
              </div>
            </div>
          )}

          {isDistributed && !isAlreadyCheckedIn && !success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-2">
              <Flag className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-700">
                <p className="font-medium">Prêt pour le check-in</p>
                <p className="mt-0.5">Glissez ci-dessous pour confirmer la présence du coureur.</p>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Check-in enregistré avec succès !
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 space-y-3">
          {!success && isDistributed && !isAlreadyCheckedIn && (
            <SlideToCheckIn onConfirm={handleCheckIn} checking={checking} />
          )}
          <button
            onClick={success ? () => { onSuccess(); onClose(); } : onClose}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer text-center"
          >
            {success ? 'Fermer' : 'Annuler'}
          </button>
        </div>
      </div>
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

/* ─── Main Check-In View ─── */
export default function CheckIn() {
  const { events, selectedEventId, switchEvent } = useEvent();

  const [bibInput, setBibInput] = useState('');
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerRef = useRef(null);

  // Fetch check-in session history (filter to qr-checkin method)
  const fetchHistory = useCallback(async () => {
    try {
      const q = selectedEventId ? `?eventId=${selectedEventId}` : '';
      const data = await get(`/scan/session/history${q}`);
      const all = data.data || [];
      setHistory(all.filter((h) => h.method === 'qr-checkin'));
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
      false
    );

    scannerRef.current = scanner;

    const onScanSuccess = async (decodedText) => {
      let qrToken = decodedText;
      try {
        const url = new URL(decodedText);
        const parts = url.pathname.split('/');
        const scanIndex = parts.indexOf('scan');
        if (scanIndex !== -1 && parts[scanIndex + 1]) {
          qrToken = parts[scanIndex + 1];
        }
      } catch {
        qrToken = decodedText;
      }

      try { await scanner.clear(); } catch { /* ignore */ }
      setScannerActive(false);
      scannerRef.current = null;

      try {
        const data = await get(`/scan/${qrToken}`);
        setSelectedRunner(data.data || data);
      } catch (err) {
        setScannerError(err.message || 'Coureur introuvable pour ce QR code.');
      }
    };

    const onScanFailure = () => { /* silence */ };

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      try { scanner.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    };
  }, [scannerActive]);

  const startScanner = () => {
    setScannerError('');
    setScannerActive(true);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.clear(); } catch { /* ignore */ }
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
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Flag size={24} className="text-[#C42826]" />
              Check-in
            </h2>
            <p className="text-gray-500 text-sm mt-1">Enregistrement des coureurs le jour de l'événement</p>
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

        {/* Check-in History */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Historique des check-ins</h2>
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
                  {historySearch ? 'Aucun résultat.' : 'Aucun check-in enregistré pour cette session.'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((h, i) => (
                    <li key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[#C42826]">#{h.bibNumber}</span>
                        <span className="ml-3 text-gray-900">{h.runnerName}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {h.scannedAt ? new Date(h.scannedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </section>
      </main>

      <CheckInModal
        runner={selectedRunner}
        onClose={handleModalClose}
        onSuccess={handleModalClose}
      />
    </div>
  );
}

/* ─── Slide to Check-in ─── */
function SlideToCheckIn({ onConfirm, checking }) {
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

  if (checking) {
    return (
      <div className="h-14 rounded-xl bg-emerald-500 flex items-center justify-center">
        <span className="text-sm font-medium text-white">Check-in en cours...</span>
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-xl select-none overflow-hidden transition-colors ${
        confirmed ? 'bg-emerald-500' : 'bg-gray-100'
      }`}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-sm font-medium transition-opacity ${confirmed ? 'text-white' : 'text-gray-400'}`}
          style={{ opacity: confirmed ? 1 : Math.max(0, 1 - progress * 2) }}>
          {confirmed ? 'Check-in confirmé !' : 'Glisser pour confirmer le check-in'}
        </span>
      </div>

      {!confirmed && (
        <div
          className="absolute top-1 left-1 w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
          style={{ transform: `translateX(${offset}px)` }}
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
          onTouchStart={() => setDragging(true)}
        >
          <ChevronRight size={20} className="text-white" />
          <ChevronRight size={20} className="text-white -ml-3" />
        </div>
      )}
    </div>
  );
}
