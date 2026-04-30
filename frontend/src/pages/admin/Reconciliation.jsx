import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../../lib/api';
import { getAccessToken, refreshAccessToken } from '../../lib/auth';
import { useEvent } from '../../hooks/useEvent';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';
import { Upload, Link2, Copy, Mail, X, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';

const ALLOWED_ROLES = ['super_admin', 'reconciliation_specialist'];

function StatusBadge({ status }) {
  const map = {
    pending:              { label: 'En attente',     cls: 'bg-gray-100 text-gray-700',     Icon: Clock },
    link_generated:       { label: 'Lien généré',    cls: 'bg-blue-100 text-blue-700',     Icon: Link2 },
    submitted_matched:    { label: 'Validé',         cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
    submitted_unmatched:  { label: 'Non concordant', cls: 'bg-red-100 text-red-700',       Icon: AlertCircle },
    expired:              { label: 'Expiré',         cls: 'bg-amber-100 text-amber-700',   Icon: Clock },
    cancelled:            { label: 'Annulé',         cls: 'bg-gray-100 text-gray-500',     Icon: X },
  };
  const def = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700', Icon: Clock };
  const I = def.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${def.cls}`}>
      <I size={12} />
      {def.label}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function formatAmount(centimes) {
  if (!centimes) return '—';
  return `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`;
}

export default function Reconciliation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedEventId, selectedEvent } = useEvent();

  const [tab, setTab] = useState('satim');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState(null); // { row, link, expiresAt, emailValue, sending, copied }
  const fileInputRef = useRef(null);

  // Role guard
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const fetchRows = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const data = await get(`/admin/reconciliation?eventId=${selectedEventId}&tab=${tab}`);
      setRows(data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, tab]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }

  async function handleUpload(file) {
    if (!file || !selectedEventId) return;
    setUploading(true);
    try {
      const doUpload = async (token) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('eventId', selectedEventId);
        return fetch('/api/admin/reconciliation/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      };
      let res = await doUpload(getAccessToken());
      if (res.status === 401) {
        // Refresh token then retry once
        const newToken = await refreshAccessToken();
        res = await doUpload(newToken);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `Erreur ${res.status}`);
      flash('success', `${json.inserted} ligne(s) ajoutée(s) — ${json.skipped} ignorée(s) (non Déposé) — ${json.duplicates} doublon(s)`);
      await fetchRows();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Open the link modal for a row. If the row has no token yet OR a fresh
  // generation is requested, hit the API to issue a new one.
  async function openLinkModal(row, regenerate = false) {
    try {
      let link, expiresAt;
      if (!row.linkToken || regenerate) {
        const data = await post(`/admin/reconciliation/${row.id}/generate-link`);
        link = data.link;
        expiresAt = data.expiresAt;
        await fetchRows();
      } else {
        link = `${window.location.origin}/reconciliation/${row.linkToken}`;
        expiresAt = row.linkExpiresAt;
      }
      setModal({
        row,
        link,
        expiresAt,
        emailValue: row.linkSentToEmail || '',
        sending: false,
        copied: false,
      });
    } catch (err) {
      flash('error', err.message);
    }
  }

  async function copyModalLink() {
    if (!modal?.link) return;
    try {
      await navigator.clipboard.writeText(modal.link);
      setModal((m) => ({ ...m, copied: true }));
      setTimeout(() => setModal((m) => m && { ...m, copied: false }), 2000);
    } catch {
      flash('error', 'Impossible de copier — copiez manuellement');
    }
  }

  async function sendModalEmail() {
    if (!modal) return;
    const email = modal.emailValue.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return flash('error', 'Email invalide');
    }
    setModal((m) => ({ ...m, sending: true }));
    try {
      await post(`/admin/reconciliation/${modal.row.id}/send-email`, { email });
      flash('success', `Email envoyé à ${email}`);
      setModal(null);
      await fetchRows();
    } catch (err) {
      flash('error', err.message);
      setModal((m) => m && { ...m, sending: false });
    }
  }

  async function regenerateModalLink() {
    if (!modal) return;
    if (!window.confirm('Régénérer un nouveau lien ? L\'ancien sera invalidé immédiatement.')) return;
    await openLinkModal(modal.row, true);
  }

  async function cancelRow(id) {
    if (!window.confirm('Annuler cette ligne ? Le lien actif sera invalidé.')) return;
    try {
      await post(`/admin/reconciliation/${id}/cancel`);
      flash('success', 'Ligne annulée');
      await fetchRows();
    } catch (err) {
      flash('error', err.message);
    }
  }

  if (!user) return null;
  if (!ALLOWED_ROLES.includes(user.role)) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Réconciliation</h2>
            <p className="text-gray-500 text-sm">
              Gérer les paiements SATIM orphelins — {selectedEvent?.name || 'Aucun événement sélectionné'}
            </p>
          </div>
        </div>

        {message.text && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>{message.text}</div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1">
            <button onClick={() => setTab('satim')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition cursor-pointer ${
                tab === 'satim' ? 'border-[#C42826] text-[#C42826]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              SATIM Réconciliations
            </button>
            <button onClick={() => setTab('validations')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition cursor-pointer ${
                tab === 'validations' ? 'border-[#C42826] text-[#C42826]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              Validations
            </button>
          </div>
        </div>

        {/* Upload bar — SATIM tab only */}
        {tab === 'satim' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-3 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => handleUpload(e.target.files?.[0])}
              disabled={uploading || !selectedEventId} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !selectedEventId}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C42826] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#a82220] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <Upload size={16} />
              {uploading ? 'Téléchargement...' : 'Charger un fichier SATIM (.xlsx, .csv)'}
            </button>
            <p className="text-xs text-gray-500">
              Seules les lignes avec <strong>Etat du paiement = Déposé</strong> seront gardées.
            </p>
          </div>
        )}

        {/* Data table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Chargement...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              {tab === 'satim' ? 'Aucune ligne SATIM — chargez un fichier pour commencer.' : 'Aucune validation soumise pour le moment.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Titulaire</th>
                    <th className="px-4 py-3 text-left">N° commande</th>
                    <th className="px-4 py-3 text-left">PAN</th>
                    <th className="px-4 py-3 text-left">Date paiement</th>
                    <th className="px-4 py-3 text-left">Montant</th>
                    {tab === 'validations' && <th className="px-4 py-3 text-left">Coureur soumis</th>}
                    {tab === 'validations' && <th className="px-4 py-3 text-left">Dossard</th>}
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.cardholderName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.orderNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs">****{r.cardPan}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(r.paymentDate)}</td>
                      <td className="px-4 py-3">{formatAmount(r.approvedAmount)}</td>
                      {tab === 'validations' && (
                        <td className="px-4 py-3">
                          {r.registration ? (
                            <div>
                              <div>{r.registration.firstName} {r.registration.lastName}</div>
                              <div className="text-xs text-gray-500">{r.registration.email}</div>
                              {r.enteredCardPan && r.enteredCardPan !== r.cardPan && (
                                <div className="text-xs text-red-600">PAN saisi: ****{r.enteredCardPan}</div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                      )}
                      {tab === 'validations' && (
                        <td className="px-4 py-3 font-bold">
                          {r.registration?.bibNumber || '—'}
                        </td>
                      )}
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {tab === 'satim' && r.status !== 'cancelled' && r.status !== 'submitted_matched' && r.status !== 'submitted_unmatched' && (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button onClick={() => openLinkModal(r)} title="Générer / voir le lien"
                              className="inline-flex items-center gap-1 rounded-md bg-[#C42826] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#a82220] cursor-pointer">
                              <Link2 size={12} />
                              {r.linkToken ? 'Voir le lien' : 'Générer un lien'}
                            </button>
                            <button onClick={() => cancelRow(r.id)} title="Annuler la ligne"
                              className="inline-flex items-center gap-1 rounded-md text-red-600 hover:bg-red-50 px-2 py-1 text-xs cursor-pointer">
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        {tab === 'validations' && r.registration && (
                          <button onClick={() => navigate(`/admin/runners?search=${encodeURIComponent(r.registration.email)}`)}
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-[#C42826] cursor-pointer">
                            Voir <ChevronRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {tab === 'satim' && rows.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Total : {rows.length} ligne(s). Astuce : régénérer un lien invalide automatiquement le précédent.
          </p>
        )}
      </main>

      {/* Link Modal */}
      {modal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
          onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lien de réconciliation</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {modal.row.cardholderName} — carte ****{modal.row.cardPan}
                </p>
              </div>
              <button onClick={() => setModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X size={20} />
              </button>
            </div>

            {/* URL + Copy */}
            <label className="block text-xs font-medium text-gray-600 mb-1.5">URL d'inscription</label>
            <div className="flex gap-2 mb-1">
              <input type="text" readOnly value={modal.link}
                onClick={(e) => e.target.select()}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-[#C42826]" />
              <button onClick={copyModalLink}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition ${
                  modal.copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {modal.copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {modal.copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            {modal.expiresAt && (
              <p className="text-xs text-gray-400 mb-5">
                Expire le {new Date(modal.expiresAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            <div className="border-t border-gray-100 my-4"></div>

            {/* Email send */}
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Envoyer par email (optionnel)</label>
            <div className="flex gap-2">
              <input type="email" placeholder="email@example.com"
                value={modal.emailValue}
                onChange={(e) => setModal((m) => m && { ...m, emailValue: e.target.value })}
                disabled={modal.sending}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:bg-white" />
              <button onClick={sendModalEmail} disabled={modal.sending || !modal.emailValue}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C42826] text-white px-4 py-2 text-sm font-medium hover:bg-[#a82220] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Mail size={14} />
                {modal.sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
            {modal.row.linkSentToEmail && (
              <p className="text-xs text-gray-400 mt-1.5">
                Dernier envoi : {modal.row.linkSentToEmail}
              </p>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <button onClick={regenerateModalLink}
                className="text-xs text-gray-500 hover:text-[#C42826] cursor-pointer flex items-center gap-1">
                <Link2 size={12} /> Régénérer un nouveau lien
              </button>
              <button onClick={() => setModal(null)}
                className="rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
