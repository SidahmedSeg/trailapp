import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { get, post } from '../../lib/api';
import { useEvent } from '../../hooks/useEvent';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';
import {
  Link2, Copy, Mail, X, CheckCircle, AlertCircle, Clock, Search, RefreshCcw, Plus, Ban,
} from 'lucide-react';

const ALLOWED_ROLES = ['super_admin', 'reconciliation_specialist'];

const statusSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none',
    minHeight: 38,
    minWidth: 200,
    backgroundColor: '#ffffff',
    fontSize: '0.875rem',
    '&:hover': { borderColor: '#C42826' },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
    fontSize: '0.875rem',
    padding: '8px 12px',
  }),
  singleValue: (base) => ({ ...base, fontSize: '0.875rem', color: '#1f2937' }),
  placeholder: (base) => ({ ...base, fontSize: '0.875rem', color: '#9ca3af' }),
  menu: (base) => ({ ...base, zIndex: 50 }),
};

const bibSelectStyles = { ...statusSelectStyles, control: (base, state) => ({
  ...statusSelectStyles.control(base, state), minWidth: 240,
})};

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'En attente',  cls: 'bg-blue-100 text-blue-700',     Icon: Clock },
    used:      { label: 'Inscrit',     cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
    expired:   { label: 'Expiré',      cls: 'bg-amber-100 text-amber-700',   Icon: Clock },
    cancelled: { label: 'Annulé',      cls: 'bg-gray-100 text-gray-500',     Icon: X },
  };
  const def = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700', Icon: Clock };
  const I = def.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${def.cls}`}>
      <I size={12} /> {def.label}
    </span>
  );
}

// Secondary badge for a used link's actual payment status, so admin can see
// "Inscrit + Payé" vs "Inscrit + Paiement abandonné".
function PaymentStatusBadge({ paymentStatus }) {
  if (!paymentStatus) return null;
  const map = {
    success:    { label: 'Payé',                cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    manual:     { label: 'Payé (manuel)',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending:    { label: 'Paiement en attente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    processing: { label: 'Paiement en cours',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    failed:     { label: 'Paiement abandonné',  cls: 'bg-red-50 text-red-700 border-red-200' },
    refunded:   { label: 'Remboursé',           cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  };
  const def = map[paymentStatus] || { label: paymentStatus, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${def.cls}`}>
      {def.label}
    </span>
  );
}

// Returns true when a `used` link's runner hasn't actually paid yet —
// so admin can regenerate to free the bib.
function isUsedButUnpaid(r) {
  if (r.status !== 'used') return false;
  const ps = r.registration?.paymentStatus;
  return !!ps && !['success', 'manual'].includes(ps);
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function LateRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedEventId, selectedEvent } = useEvent();

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [linkModal, setLinkModal] = useState(null); // { row, link, expiresAt, emailValue, sending, copied }
  const [confirmModal, setConfirmModal] = useState(null); // { row, action: 'cancel' | 'regenerate', submitting }

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

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
      const params = new URLSearchParams({ eventId: selectedEventId });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      const data = await get(`/admin/late-registration?${params.toString()}`);
      setRows(data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, statusFilter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filteredRows = useMemo(() => {
    if (!debouncedSearch) return rows;
    const q = debouncedSearch.toLowerCase();
    return rows.filter((r) => {
      if (String(r.bibNumber).includes(q)) return true;
      if (r.sentToEmail?.toLowerCase().includes(q)) return true;
      if (r.registration?.email?.toLowerCase().includes(q)) return true;
      const fullName = `${r.registration?.firstName || ''} ${r.registration?.lastName || ''}`.toLowerCase();
      if (fullName.includes(q)) return true;
      return false;
    });
  }, [rows, debouncedSearch]);

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }

  async function openLinkModal(row, regenerate = false) {
    try {
      let link, expiresAt, freshRow = row;
      if (regenerate || !row.token) {
        // Generate or regenerate
        const endpoint = row.status === 'pending'
          ? null // pending links already have a token; just open modal with existing data
          : `/admin/late-registration/${row.id}/regenerate`;
        if (endpoint) {
          const data = await post(endpoint);
          link = data.link;
          expiresAt = data.expiresAt;
          await fetchRows();
        } else {
          link = `${window.location.origin}/late-register/${row.token}`;
          expiresAt = row.expiresAt;
        }
      } else {
        link = `${window.location.origin}/late-register/${row.token}`;
        expiresAt = row.expiresAt;
      }
      setLinkModal({
        row: freshRow,
        link,
        expiresAt,
        emailValue: row.sentToEmail || '',
        sending: false,
        copied: false,
      });
    } catch (err) {
      flash('error', err.message);
    }
  }

  async function copyModalLink() {
    if (!linkModal?.link) return;
    try {
      await navigator.clipboard.writeText(linkModal.link);
      setLinkModal((m) => m && ({ ...m, copied: true }));
      setTimeout(() => setLinkModal((m) => m && { ...m, copied: false }), 2000);
    } catch {
      flash('error', 'Impossible de copier — copiez manuellement');
    }
  }

  async function sendModalEmail() {
    if (!linkModal) return;
    const email = linkModal.emailValue.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return flash('error', 'Email invalide');
    }
    setLinkModal((m) => ({ ...m, sending: true }));
    try {
      await post(`/admin/late-registration/${linkModal.row.id}/send-email`, { email });
      flash('success', `Email envoyé à ${email}`);
      setLinkModal(null);
      await fetchRows();
    } catch (err) {
      flash('error', err.message);
      setLinkModal((m) => m && { ...m, sending: false });
    }
  }

  async function confirmAction() {
    if (!confirmModal) return;
    const { row, action } = confirmModal;
    setConfirmModal((m) => m && { ...m, submitting: true });
    try {
      if (action === 'cancel') {
        await post(`/admin/late-registration/${row.id}/cancel`);
        flash('success', 'Lien annulé');
      } else if (action === 'regenerate') {
        await post(`/admin/late-registration/${row.id}/regenerate`);
        flash('success', 'Lien régénéré');
      }
      setConfirmModal(null);
      await fetchRows();
    } catch (err) {
      flash('error', err.message);
      setConfirmModal((m) => m && { ...m, submitting: false });
    }
  }

  if (!user) return null;
  if (!ALLOWED_ROLES.includes(user.role)) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold mb-1">Inscriptions tardives</h2>
            <p className="text-gray-500 text-sm">
              Liens à usage unique avec dossard pré-réservé — {selectedEvent?.name || 'Aucun événement sélectionné'}
            </p>
          </div>
          <button
            onClick={() => setGenerateModalOpen(true)}
            disabled={!selectedEventId}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C42826] text-white px-4 py-2 text-sm font-medium hover:bg-[#a82220] transition cursor-pointer disabled:opacity-50"
          >
            <Plus size={16} />
            Générer un lien
          </button>
        </div>

        {message.text && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>{message.text}</div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input type="text" placeholder="Rechercher par dossard, email ou nom…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 transition" />
          </div>
          <Select
            styles={statusSelectStyles}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'pending', label: 'En attente' },
              { value: 'used', label: 'Inscrit' },
              { value: 'expired', label: 'Expiré' },
              { value: 'cancelled', label: 'Annulé' },
            ]}
            value={(() => {
              const opts = [
                { value: 'all', label: 'Tous les statuts' },
                { value: 'pending', label: 'En attente' },
                { value: 'used', label: 'Inscrit' },
                { value: 'expired', label: 'Expiré' },
                { value: 'cancelled', label: 'Annulé' },
              ];
              return opts.find((o) => o.value === statusFilter);
            })()}
            onChange={(opt) => setStatusFilter(opt?.value || 'all')}
            isSearchable={false}
          />
          {(search || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="text-xs text-gray-500 hover:text-[#C42826] cursor-pointer flex items-center gap-1">
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Chargement…</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              {search || statusFilter !== 'all'
                ? 'Aucun lien ne correspond aux critères.'
                : 'Aucun lien d\'inscription tardive — cliquez sur "Générer un lien" pour commencer.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Dossard</th>
                    <th className="px-4 py-3 text-left">Coureur / Email</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Expire</th>
                    <th className="px-4 py-3 text-left">Créé par</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-[#C42826] font-bold">#{r.bibNumber}</td>
                      <td className="px-4 py-3">
                        {r.registration ? (
                          <div>
                            <div>{r.registration.firstName} {r.registration.lastName}</div>
                            <div className="text-xs text-gray-500">{r.registration.email}</div>
                          </div>
                        ) : r.sentToEmail ? (
                          <div className="text-gray-600 text-xs">Envoyé à <span className="font-medium">{r.sentToEmail}</span></div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={r.status} />
                          {r.status === 'used' && r.registration?.paymentStatus && (
                            <PaymentStatusBadge paymentStatus={r.registration.paymentStatus} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(r.expiresAt)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.createdBy}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {r.status === 'pending' && (
                            <>
                              <button onClick={() => openLinkModal(r, false)}
                                className="inline-flex items-center gap-1 rounded-md bg-[#C42826] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#a82220] cursor-pointer">
                                <Link2 size={12} /> Voir le lien
                              </button>
                              <button onClick={() => setConfirmModal({ row: r, action: 'cancel', submitting: false })}
                                className="inline-flex items-center gap-1 rounded-md text-red-600 hover:bg-red-50 px-2 py-1 text-xs cursor-pointer"
                                title="Annuler le lien">
                                <Ban size={12} />
                              </button>
                            </>
                          )}
                          {(r.status === 'expired' || r.status === 'cancelled' || isUsedButUnpaid(r)) && (
                            <button onClick={() => setConfirmModal({ row: r, action: 'regenerate', submitting: false })}
                              title={isUsedButUnpaid(r) ? 'Le coureur n\'a pas finalisé son paiement — régénérer libère le dossard' : undefined}
                              className="inline-flex items-center gap-1 rounded-md bg-[#C42826] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#a82220] cursor-pointer">
                              <RefreshCcw size={12} /> Régénérer
                            </button>
                          )}
                          {r.status === 'used' && r.registration && !isUsedButUnpaid(r) && (
                            <button onClick={() => navigate(`/admin/runners?search=${encodeURIComponent(r.registration.email)}`)}
                              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-[#C42826] cursor-pointer">
                              Voir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Generate Modal */}
      {generateModalOpen && (
        <GenerateLinkModal
          eventId={selectedEventId}
          onClose={() => setGenerateModalOpen(false)}
          onGenerated={(payload) => {
            setGenerateModalOpen(false);
            setLinkModal({
              row: { id: payload.id, bibNumber: payload.bibNumber, sentToEmail: '' },
              link: payload.link,
              expiresAt: payload.expiresAt,
              emailValue: '',
              sending: false,
              copied: false,
            });
            fetchRows();
          }}
          onError={(msg) => flash('error', msg)}
        />
      )}

      {/* Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
          onClick={() => setLinkModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lien d'inscription tardive</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Dossard <span className="font-mono text-[#C42826] font-bold">#{linkModal.row.bibNumber}</span>
                </p>
              </div>
              <button onClick={() => setLinkModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X size={20} />
              </button>
            </div>

            <label className="block text-xs font-medium text-gray-600 mb-1.5">URL d'inscription</label>
            <div className="flex gap-2 mb-1">
              <input type="text" readOnly value={linkModal.link}
                onClick={(e) => e.target.select()}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-[#C42826]" />
              <button onClick={copyModalLink}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition ${
                  linkModal.copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {linkModal.copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {linkModal.copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            {linkModal.expiresAt && (
              <p className="text-xs text-gray-400 mb-5">
                Expire le {new Date(linkModal.expiresAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            <div className="border-t border-gray-100 my-4"></div>

            <label className="block text-xs font-medium text-gray-600 mb-1.5">Envoyer par email (optionnel)</label>
            <div className="flex gap-2">
              <input type="email" placeholder="email@example.com"
                value={linkModal.emailValue}
                onChange={(e) => setLinkModal((m) => m && { ...m, emailValue: e.target.value })}
                disabled={linkModal.sending}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:bg-white" />
              <button onClick={sendModalEmail} disabled={linkModal.sending || !linkModal.emailValue}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C42826] text-white px-4 py-2 text-sm font-medium hover:bg-[#a82220] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Mail size={14} />
                {linkModal.sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setLinkModal(null)}
                className="rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal (cancel / regenerate) */}
      {confirmModal && (() => {
        const isCancel = confirmModal.action === 'cancel';
        const palette = isCancel
          ? { iconBg: 'bg-red-100', iconColor: 'text-red-600', btn: 'bg-red-600 hover:bg-red-700', Icon: Ban }
          : { iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', Icon: RefreshCcw };
        const I = palette.Icon;
        return (
          <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
            onClick={() => !confirmModal.submitting && setConfirmModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${palette.iconBg}`}>
                  <I size={20} className={palette.iconColor} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isCancel ? 'Annuler ce lien' : 'Régénérer ce lien'}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {isCancel
                  ? 'Le lien deviendra inactif. Le dossard pourra être réutilisé pour un nouveau lien.'
                  : 'Un nouveau lien sera généré (valide 7 jours). L\'ancien lien sera invalidé.'}
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5">
                <p className="text-sm">Dossard <span className="font-mono text-[#C42826] font-bold">#{confirmModal.row.bibNumber}</span></p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setConfirmModal(null)} disabled={confirmModal.submitting}
                  className="rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={confirmAction} disabled={confirmModal.submitting}
                  className={`inline-flex items-center gap-1.5 rounded-lg text-white px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-60 ${palette.btn}`}>
                  <I size={14} />
                  {confirmModal.submitting ? 'Traitement…' : (isCancel ? 'Confirmer l\'annulation' : 'Régénérer')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Generate Link Modal
// ────────────────────────────────────────────────────────────────────────────
function GenerateLinkModal({ eventId, onClose, onGenerated, onError }) {
  const [eligibleData, setEligibleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBib, setSelectedBib] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    get(`/admin/late-registration/eligible-bibs?eventId=${eventId}`)
      .then((d) => setEligibleData(d))
      .catch((err) => onError(err.message))
      .finally(() => setLoading(false));
  }, [eventId, onError]);

  async function handleGenerate() {
    if (!selectedBib) return;
    setSubmitting(true);
    try {
      const res = await post('/admin/late-registration', {
        eventId,
        bibNumber: selectedBib.value,
      });
      onGenerated(res);
    } catch (err) {
      onError(err.message);
      setSubmitting(false);
    }
  }

  const bibOptions = (eligibleData?.eligible || []).map((b) => ({ value: b, label: `#${b}` }));

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Générer un lien d'inscription tardive</h3>
            <p className="text-sm text-gray-500 mt-0.5">Choisissez un dossard libre (trou) à pré-réserver</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Chargement…</div>
        ) : !eligibleData || eligibleData.eligible.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle size={16} className="inline mr-1.5 -mt-0.5" />
            Aucun dossard libre disponible pour ce moment.
            {eligibleData && eligibleData.totalGaps === 0 && ' La plage automatique n\'a pas encore de trous (aucun dossard libéré).'}
            {eligibleData && eligibleData.reservedCount > 0 && ` ${eligibleData.reservedCount} dossard(s) sont déjà réservés par d'autres liens en attente.`}
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Dossard à réserver</label>
            <Select
              styles={bibSelectStyles}
              options={bibOptions}
              value={selectedBib}
              onChange={(opt) => setSelectedBib(opt)}
              placeholder={`Choisir parmi ${eligibleData.eligible.length} dossards libres…`}
              isSearchable
              isClearable
            />
            <p className="text-xs text-gray-400 mt-2">
              Plage automatique {eligibleData.bibStart}–{eligibleData.bibEnd}.
              {' '}{eligibleData.totalGaps} trou(s){eligibleData.reservedCount > 0 ? `, ${eligibleData.reservedCount} déjà réservé(s)` : ''}.
            </p>

            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100">
              <button onClick={onClose} disabled={submitting}
                className="rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleGenerate} disabled={!selectedBib || submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C42826] text-white px-4 py-2 text-sm font-medium hover:bg-[#a82220] cursor-pointer disabled:opacity-50">
                <Link2 size={14} />
                {submitting ? 'Génération…' : 'Générer le lien'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
