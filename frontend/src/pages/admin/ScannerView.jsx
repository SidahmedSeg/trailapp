import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { get, post } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import { Camera, StopCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

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

  // Reset state when runner changes
  useEffect(() => {
    setDistributing(false);
    setError('');
    setSuccess(false);
  }, [runner?.id]);

  if (!runner) return null;

  const handleDistribute = async () => {
    setDistributing(true);
    setError('');
    try {
      await post(`/scan/${runner.qrToken}/distribute`, { eventId: runner.eventId });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Erreur lors de la distribution.');
    }
    setDistributing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Coureur - Dossard #{runner.bibNumber}</h3>
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
          <InfoRow label="Statut" value={<StatusBadge status={runner.status} />} />

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
        <div className="px-6 py-4 border-t border-gray-200 space-y-3">
          {!success && runner.status !== 'distribué' && runner.status !== 'distributed' && (
            <SlideToDistribute onConfirm={handleDistribute} distributing={distributing} />
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

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value || '—'}</span>
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
function SlideToDistribute({ onConfirm, distributing }) {
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
        confirmed ? 'bg-emerald-500' : 'bg-gray-100'
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
