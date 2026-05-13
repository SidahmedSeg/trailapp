import { useState, useEffect, useCallback, useMemo } from 'react';
import Select from 'react-select';
import { get, post, put } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { useEvent } from '../../hooks/useEvent';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/ui/Sidebar';
import {
  CalendarClock, CheckCircle, X, Clock, Search, FileText, IdCard,
  Mail, Phone, AlertCircle, Power, ExternalLink, Copy, CalendarCheck,
} from 'lucide-react';

const ALLOWED_ROLES = ['super_admin', 'admin', 'volunteers_manager'];

const selectStyles = {
  control: (base, state) => ({
    ...base, borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none',
    minHeight: 38, minWidth: 200, backgroundColor: '#fff', fontSize: '0.875rem',
    '&:hover': { borderColor: '#C42826' },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
    fontSize: '0.875rem', padding: '8px 12px',
  }),
  singleValue: (base) => ({ ...base, fontSize: '0.875rem', color: '#1f2937' }),
  placeholder: (base) => ({ ...base, fontSize: '0.875rem', color: '#9ca3af' }),
  menu: (base) => ({ ...base, zIndex: 50 }),
};

function StatusBadge({ status }) {
  const map = {
    en_attente:         { label: 'En attente',          cls: 'bg-amber-100 text-amber-700',   Icon: Clock },
    interview_planned:  { label: 'Entretien planifié',  cls: 'bg-blue-100 text-blue-700',     Icon: CalendarCheck },
    validee:            { label: 'Validée',             cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
  };
  const def = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700', Icon: Clock };
  const I = def.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${def.cls}`}>
      <I size={12} /> {def.label}
    </span>
  );
}

function formatDate(d, opts = {}) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: opts.year ? 'numeric' : undefined,
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

export default function Volunteers() {
  const { user } = useAuth();
  const { selectedEvent, selectedEventId, refreshEvents } = useEvent();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [detail, setDetail] = useState(null); // selected volunteer row
  const [interviewModal, setInterviewModal] = useState(null);
  const [validateModal, setValidateModal] = useState(null);
  const [togglingOpen, setTogglingOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchRows = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ eventId: selectedEventId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await get(`/admin/volunteers?${params}`);
      setRows(data || []);
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, statusFilter, debouncedSearch]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }

  async function toggleVolunteersOpen() {
    if (!selectedEvent) return;
    setTogglingOpen(true);
    try {
      await put(`/admin/events/${selectedEvent.id}`, {
        volunteersOpen: !selectedEvent.volunteersOpen,
      });
      flash('success', selectedEvent.volunteersOpen ? 'Inscriptions bénévoles fermées' : 'Inscriptions bénévoles ouvertes');
      refreshEvents();
    } catch (err) {
      flash('error', err.message);
    }
    setTogglingOpen(false);
  }

  const stats = useMemo(() => ({
    total: rows.length,
    en_attente: rows.filter((r) => r.status === 'en_attente').length,
    interview_planned: rows.filter((r) => r.status === 'interview_planned').length,
    validee: rows.filter((r) => r.status === 'validee').length,
  }), [rows]);

  if (!user) return null;
  if (!ALLOWED_ROLES.includes(user.role)) return null;

  const publicLink = selectedEvent ? `${window.location.origin}/benevoles/${selectedEvent.slug}` : '';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold mb-1">Bénévoles</h2>
            <p className="text-gray-500 text-sm">
              Candidatures bénévoles — {selectedEvent?.name || 'Aucun événement sélectionné'}
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

        {/* Activation + public link */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div className="flex-1 min-w-[260px]">
              <p className="text-sm font-medium text-gray-900">
                Inscriptions bénévoles {selectedEvent?.volunteersOpen ? <span className="text-emerald-600">ouvertes</span> : <span className="text-gray-400">fermées</span>}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Lorsqu'activées, le formulaire public est accessible à l'URL ci-dessous. Les candidats remplissent leur dossier (CV + pièce d'identité) et apparaissent dans la liste.
              </p>
            </div>
            {user?.role !== 'volunteers_manager' && (
              <button
                onClick={toggleVolunteersOpen}
                disabled={togglingOpen || !selectedEvent}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition cursor-pointer disabled:opacity-50 ${
                  selectedEvent?.volunteersOpen
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-[#C42826] text-white hover:bg-[#a82220]'
                }`}
              >
                <Power size={14} />
                {selectedEvent?.volunteersOpen ? 'Désactiver' : 'Activer'}
              </button>
            )}
          </div>

          {selectedEvent?.volunteersOpen && (
            <div className="mt-4 flex gap-2 items-center">
              <input type="text" readOnly value={publicLink}
                onClick={(e) => e.target.select()}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-[#C42826]" />
              <button
                onClick={() => { navigator.clipboard.writeText(publicLink).then(() => flash('success', 'Lien copié')); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 text-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer">
                <Copy size={14} /> Copier
              </button>
              <a href={publicLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 cursor-pointer">
                <ExternalLink size={14} /> Ouvrir
              </a>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Total candidats</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-xs text-amber-700">En attente</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{stats.en_attente}</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <p className="text-xs text-blue-700">Entretien planifié</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{stats.interview_planned}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <p className="text-xs text-emerald-700">Validés</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.validee}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input type="text" placeholder="Rechercher par nom, email ou ID…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 transition" />
          </div>
          <Select
            styles={selectStyles}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'en_attente', label: 'En attente' },
              { value: 'interview_planned', label: 'Entretien planifié' },
              { value: 'validee', label: 'Validés' },
            ]}
            value={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'en_attente', label: 'En attente' },
              { value: 'interview_planned', label: 'Entretien planifié' },
              { value: 'validee', label: 'Validés' },
            ].find((o) => o.value === statusFilter)}
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
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              {selectedEvent?.volunteersOpen
                ? 'Aucune candidature pour le moment.'
                : 'Activez les inscriptions bénévoles pour recevoir des candidatures.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Candidat</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">ID bénévole</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Reçu le</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(r)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.firstName} {r.lastName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div>{r.email}</div>
                        <div className="text-gray-400">{r.phone}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#C42826] font-bold">
                        {r.volunteerId || '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(r.createdAt, { year: true })}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setDetail(r); }}
                          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-[#C42826] cursor-pointer">
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          volunteer={detail}
          onClose={() => setDetail(null)}
          onPlanInterview={() => setInterviewModal(detail)}
          onValidate={() => setValidateModal(detail)}
          onRefresh={async () => {
            await fetchRows();
            // Reload selected detail
            const fresh = await get(`/admin/volunteers/${detail.id}`).catch(() => null);
            if (fresh) setDetail(fresh);
          }}
        />
      )}

      {/* Plan interview modal */}
      {interviewModal && (
        <InterviewModal
          volunteer={interviewModal}
          onClose={() => setInterviewModal(null)}
          onDone={async () => {
            setInterviewModal(null);
            flash('success', `Email envoyé à ${interviewModal.email}`);
            await fetchRows();
            const fresh = await get(`/admin/volunteers/${interviewModal.id}`).catch(() => null);
            if (fresh && detail?.id === interviewModal.id) setDetail(fresh);
          }}
          onError={(m) => flash('error', m)}
        />
      )}

      {/* Validate modal */}
      {validateModal && (
        <ValidateModal
          volunteer={validateModal}
          onClose={() => setValidateModal(null)}
          onDone={async (res) => {
            setValidateModal(null);
            flash('success', `Candidat validé — ID ${res.volunteerId} envoyé par email`);
            await fetchRows();
            const fresh = await get(`/admin/volunteers/${validateModal.id}`).catch(() => null);
            if (fresh && detail?.id === validateModal.id) setDetail(fresh);
          }}
          onError={(m) => flash('error', m)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Detail Drawer
// ────────────────────────────────────────────────────────────────────────────
function DetailDrawer({ volunteer, onClose, onPlanInterview, onValidate, onRefresh }) {
  const [notes, setNotes] = useState(volunteer.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const fileUrl = (which) => {
    const token = getAccessToken();
    return `/api/admin/volunteers/${volunteer.id}/file?which=${which}&_t=${token?.slice(-12) || ''}`;
  };

  async function openFile(which) {
    // Use fetch + blob so the auth header gets through; then open the blob URL in a new tab.
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/admin/volunteers/${volunteer.id}/file?which=${which}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await put(`/admin/volunteers/${volunteer.id}`, { notes });
      await onRefresh();
    } catch (err) {
      alert(err.message);
    }
    setSavingNotes(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-gray-200 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{volunteer.firstName} {volunteer.lastName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ID + status */}
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge status={volunteer.status} />
            {volunteer.volunteerId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C42826]/10 text-[#C42826] px-2.5 py-0.5 text-xs font-mono font-bold">
                {volunteer.volunteerId}
              </span>
            )}
          </div>

          {/* Contact */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <Mail size={14} className="text-gray-400" /> {volunteer.email}
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Phone size={14} className="text-gray-400" /> {volunteer.phone}
            </div>
            {volunteer.birthDate && (
              <div className="text-xs text-gray-500">Né(e) le {formatDate(volunteer.birthDate, { year: true })}</div>
            )}
            {volunteer.gender && <div className="text-xs text-gray-500">Genre : {volunteer.gender}</div>}
            {volunteer.nationality && <div className="text-xs text-gray-500">Nationalité : {volunteer.nationality}</div>}
          </div>

          {/* Documents */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Documents</h4>
            <div className="flex gap-2">
              {volunteer.cvPath ? (
                <button onClick={() => openFile('cv')}
                  className="flex-1 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white text-gray-700 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  <FileText size={14} className="text-[#C42826]" /> CV
                </button>
              ) : <div className="flex-1 text-xs text-gray-400 italic">CV non fourni</div>}
              {volunteer.idPath ? (
                <button onClick={() => openFile('id')}
                  className="flex-1 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white text-gray-700 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  <IdCard size={14} className="text-[#C42826]" /> Pièce d'identité
                </button>
              ) : <div className="flex-1 text-xs text-gray-400 italic">Pièce non fournie</div>}
            </div>
          </div>

          {/* Profile / availability */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Profil et disponibilité</h4>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className={volunteer.availableRaceDay ? 'text-emerald-600' : 'text-gray-400'}>{volunteer.availableRaceDay ? '✓' : '✗'}</span>
                <span>Disponible jour de la course</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={volunteer.canArriveEarly ? 'text-emerald-600' : 'text-gray-400'}>{volunteer.canArriveEarly ? '✓' : '✗'}</span>
                <span>Peut arriver tôt</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={volunteer.canStandLongTime ? 'text-emerald-600' : 'text-gray-400'}>{volunteer.canStandLongTime ? '✓' : '✗'}</span>
                <span>Peut rester debout longtemps</span>
              </li>
              {volunteer.tshirtSize && (
                <li className="text-xs text-gray-500">Taille T-shirt : <span className="font-medium text-gray-900">{volunteer.tshirtSize}</span></li>
              )}
              {volunteer.languagesSpoken && (
                <li className="text-xs text-gray-500">Langues : <span className="font-medium text-gray-900">{volunteer.languagesSpoken}</span></li>
              )}
            </ul>
            {volunteer.previousExperience && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Expérience précédente</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">{volunteer.previousExperience}</p>
              </div>
            )}
          </div>

          {/* Emergency contact */}
          {(volunteer.emergencyContactName || volunteer.emergencyContactPhone) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact d'urgence</h4>
              <div className="text-sm text-gray-700 space-y-0.5">
                {volunteer.emergencyContactName && <p>{volunteer.emergencyContactName}</p>}
                {volunteer.emergencyContactPhone && <p className="text-gray-600 font-mono text-xs">{volunteer.emergencyContactPhone}</p>}
              </div>
            </div>
          )}

          {/* Motivation */}
          {volunteer.motivation && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motivation</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{volunteer.motivation}</p>
            </div>
          )}

          {/* Agreements */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Engagements</h4>
            <ul className="text-xs text-gray-700 space-y-1">
              <li className="flex items-center gap-2">
                <span className={volunteer.agreedInstructions ? 'text-emerald-600' : 'text-red-600'}>{volunteer.agreedInstructions ? '✓' : '✗'}</span>
                <span>Suivre les instructions des responsables</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={volunteer.agreedBriefing ? 'text-emerald-600' : 'text-red-600'}>{volunteer.agreedBriefing ? '✓' : '✗'}</span>
                <span>Assister au briefing bénévole</span>
              </li>
            </ul>
          </div>

          {/* Interview history */}
          {volunteer.interviewSentAt && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-medium text-gray-700 mb-1">Entretien proposé le {formatDate(volunteer.interviewSentAt)}</p>
              <p className="text-gray-500">Email envoyé à {volunteer.interviewSentTo}</p>
              {Array.isArray(volunteer.interviewSlots) && (
                <ul className="list-disc list-inside mt-2 text-gray-600">
                  {volunteer.interviewSlots.map((s, i) => (
                    <li key={i}>{formatDate(s, { year: true })}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes admin</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes internes (non envoyées au candidat)"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 transition resize-none"
            />
            <div className="flex justify-end mt-2">
              <button onClick={saveNotes} disabled={savingNotes || notes === (volunteer.notes || '')}
                className="text-xs rounded-md bg-gray-100 text-gray-700 px-3 py-1.5 font-medium hover:bg-gray-200 cursor-pointer disabled:opacity-50">
                {savingNotes ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
            {volunteer.status !== 'validee' && (
              <button onClick={onPlanInterview}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-gray-200 text-gray-700 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 cursor-pointer">
                <CalendarClock size={16} /> Planifier un entretien
              </button>
            )}
            {volunteer.status !== 'validee' && (
              <button onClick={onValidate}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-700 cursor-pointer">
                <CheckCircle size={16} /> Valider le candidat
              </button>
            )}
            {volunteer.status === 'validee' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-medium mb-1">Candidat validé</p>
                <p>ID envoyé : <span className="font-mono font-bold">{volunteer.volunteerId}</span></p>
                <p className="mt-1 text-emerald-700">Validé le {formatDate(volunteer.validatedAt)} par {volunteer.validatedBy}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Interview Modal — admin enters 3 datetime slots + optional note → sends email
// ────────────────────────────────────────────────────────────────────────────
function InterviewModal({ volunteer, onClose, onDone, onError }) {
  const [slots, setSlots] = useState(['', '', '']);
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateSlot(i, val) {
    setSlots((p) => { const n = [...p]; n[i] = val; return n; });
  }

  async function handleSubmit() {
    const filled = slots.filter(Boolean);
    if (filled.length === 0) return;
    setSubmitting(true);
    try {
      await post(`/admin/volunteers/${volunteer.id}/plan-interview`, {
        slots: filled.map((s) => new Date(s).toISOString()),
        adminNote: adminNote.trim() || undefined,
      });
      onDone();
    } catch (err) {
      onError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#C42826]/10 flex items-center justify-center flex-shrink-0">
            <CalendarClock size={20} className="text-[#C42826]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Planifier un entretien</h3>
            <p className="text-xs text-gray-500 mt-0.5">{volunteer.firstName} {volunteer.lastName} — {volunteer.email}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Proposez jusqu'à 3 créneaux. Un email sera envoyé au candidat avec une adresse de réponse <span className="font-mono">staff@lassm.dz</span>.
        </p>

        <div className="space-y-2 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Créneau {i + 1} {i === 0 && <span className="text-[#C42826]">*</span>}</label>
              <input type="datetime-local" value={slots[i]} onChange={(e) => updateSlot(i, e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 transition" />
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">Note (optionnelle)</label>
          <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
            placeholder="Information complémentaire à inclure dans l'email…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 transition resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting}
            className="rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={submitting || !slots.some(Boolean)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C42826] text-white px-4 py-2 text-sm font-medium hover:bg-[#a82220] cursor-pointer disabled:opacity-60">
            <Mail size={14} />
            {submitting ? 'Envoi…' : 'Envoyer l\'email'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Validate Modal — confirms, assigns volunteer ID, sends email
// ────────────────────────────────────────────────────────────────────────────
function ValidateModal({ volunteer, onClose, onDone, onError }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await post(`/admin/volunteers/${volunteer.id}/validate`);
      onDone(res);
    } catch (err) {
      onError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={20} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Valider le candidat</h3>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4">
          <p className="font-medium text-gray-900">{volunteer.firstName} {volunteer.lastName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{volunteer.email}</p>
        </div>

        <div className="space-y-1.5 text-xs text-gray-600 mb-4">
          <p>• Le statut passera à <strong>Validée</strong>.</p>
          <p>• Un identifiant bénévole unique sera généré (ex. <span className="font-mono">TMO4827</span>).</p>
          <p>• Un email de bienvenue sera envoyé au candidat avec son identifiant.</p>
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          Action confirmée — le candidat sera intégré à l'équipe bénévole.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting}
            className="rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 cursor-pointer disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 cursor-pointer disabled:opacity-60">
            <CheckCircle size={14} />
            {submitting ? 'Validation…' : 'Valider et envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
