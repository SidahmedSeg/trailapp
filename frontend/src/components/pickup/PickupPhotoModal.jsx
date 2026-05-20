import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getAccessToken } from '../../lib/auth';

/**
 * Auth-gated viewer for the CIN photo of a proxy pickup. Fetches the photo as
 * a blob (so the auth header is sent) and renders it inside a modal overlay.
 *
 * Caller controls visibility — render conditionally with `{open && <PickupPhotoModal …/>}`.
 */
export default function PickupPhotoModal({ registrationId, onClose }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let url = '';
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`/api/admin/registrations/${registrationId}/proxy-id-photo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || `Erreur ${res.status}`);
        }
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        if (!cancelled) setSrc(url);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Erreur de chargement');
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [registrationId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">Photo CIN du récupérateur</h4>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center bg-gray-50 overflow-auto">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !src ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : (
            <img src={src} alt="Photo CIN" className="max-w-full max-h-[75vh] object-contain rounded-md" />
          )}
        </div>
      </div>
    </div>
  );
}
