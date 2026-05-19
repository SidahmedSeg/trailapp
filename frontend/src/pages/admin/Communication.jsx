import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { get, post } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import EmojiPicker from 'emoji-picker-react';
import {
  Mail, Send, Eye, Users as UsersIcon, Heart, User, AtSign, Check,
  AlertCircle, Loader2, ChevronRight, X, Smile, Variable, Clock,
} from 'lucide-react';

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#C42826] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 text-gray-700 px-4 py-2.5 text-sm hover:bg-gray-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-lg text-gray-600 px-3 py-1.5 text-sm hover:bg-gray-100 transition cursor-pointer';

const AUDIENCE_LABEL = {
  custom: 'Emails personnalisés',
  all_runners: 'Tous les Coureurs',
  all_volunteers: 'Tous les Bénévoles',
  volunteers_by_tlb: 'Bénévoles par TLB',
};

const VARS_BY_AUDIENCE = {
  all_runners: [
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'bibNumber', label: 'Dossard' },
    { key: 'runnerLevel', label: 'Niveau' },
    { key: 'eventName', label: 'Événement' },
  ],
  all_volunteers: [
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'volunteerId', label: 'ID bénévole' },
    { key: 'eventName', label: 'Événement' },
  ],
  volunteers_by_tlb: [
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'volunteerId', label: 'ID bénévole' },
    { key: 'eventName', label: 'Événement' },
  ],
  custom: [
    { key: 'eventName', label: 'Événement' },
  ],
};

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const STATUS_BADGE = {
  pending: { cls: 'bg-amber-50 text-amber-700', label: 'En attente' },
  running: { cls: 'bg-blue-50 text-blue-700', label: 'En cours' },
  done: { cls: 'bg-emerald-50 text-emerald-700', label: 'Terminé' },
  failed: { cls: 'bg-red-50 text-red-700', label: 'Échoué' },
};

function renderTemplate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const v = vars?.[key];
    return v != null && v !== '' ? String(v) : match;
  });
}

/* ─── Slide to confirm ─── */
function SlideToConfirm({ onConfirm, label = 'Glisser pour envoyer', confirmedLabel = 'Envoyé', color = 'red' }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const thumbWidth = 48;

  const getMaxOffset = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - thumbWidth - 8;
  }, []);

  const handleStart = () => {
    if (confirmed) return;
    setDragging(true);
  };

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
      setTimeout(() => onConfirm(), 250);
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
  const trackBg = confirmed
    ? color === 'red' ? 'bg-red-500' : 'bg-emerald-500'
    : 'bg-gray-100';
  const thumbBg = color === 'red' ? 'bg-[#C42826]' : 'bg-emerald-500';

  return (
    <div ref={trackRef} className={`relative h-14 rounded-xl select-none overflow-hidden transition-colors ${trackBg}`}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`text-sm font-medium transition-opacity ${confirmed ? 'text-white opacity-100' : 'text-gray-500'}`}
          style={{ opacity: confirmed ? 1 : Math.max(0, 1 - progress * 2) }}
        >
          {confirmed ? confirmedLabel : label}
        </span>
      </div>
      {!confirmed && (
        <div
          className={`absolute top-1 left-1 w-12 h-12 rounded-lg ${thumbBg} flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg`}
          style={{ transform: `translateX(${offset}px)` }}
          onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
          onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        >
          <ChevronRight size={20} className="text-white" />
          <ChevronRight size={20} className="text-white -ml-3" />
        </div>
      )}
    </div>
  );
}

/* ─── Variable picker dropdown ─── */
function VarPicker({ vars, onInsert }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className={BTN_GHOST + ' border border-gray-200 bg-gray-50'} title="Insérer une variable">
        <Variable size={14} />
        <span className="hidden sm:inline">Variable</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[220px]">
          {vars.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="font-mono text-xs text-[#C42826]">{`{{${v.key}}}`}</span>
              <span className="text-xs text-gray-500">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Emoji button + picker popover ─── */
function EmojiBtn({ onInsert }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className={BTN_GHOST + ' border border-gray-200 bg-gray-50'} title="Insérer un emoji">
        <Smile size={14} />
        <span className="hidden sm:inline">Emoji</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 shadow-xl">
          <EmojiPicker
            onEmojiClick={(d) => { onInsert(d.emoji); setOpen(false); }}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            searchPlaceholder="Rechercher…"
            width={320}
            height={400}
          />
        </div>
      )}
    </div>
  );
}

/* ─── History row drawer ─── */
function HistoryDetailModal({ campaign, onClose }) {
  if (!campaign) return null;
  const statusInfo = STATUS_BADGE[campaign.status] || STATUS_BADGE.pending;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Campagne</p>
            <h3 className="text-lg font-semibold text-gray-900">{campaign.subject}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-gray-400 uppercase">Date</p><p className="text-gray-700">{new Date(campaign.createdAt).toLocaleString('fr-FR')}</p></div>
            <div><p className="text-xs text-gray-400 uppercase">Audience</p><p className="text-gray-700">{AUDIENCE_LABEL[campaign.audienceType] || campaign.audienceType}</p></div>
            <div><p className="text-xs text-gray-400 uppercase">Expéditeur</p><p className="text-gray-700">{campaign.fromEmail}</p></div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Statut</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
            </div>
            <div><p className="text-xs text-gray-400 uppercase">Total</p><p className="text-gray-700">{campaign.totalCount}</p></div>
            <div><p className="text-xs text-gray-400 uppercase">Envoyés</p><p className="text-emerald-700 font-medium">{campaign.sentCount}</p></div>
            <div><p className="text-xs text-gray-400 uppercase">Échec</p><p className={campaign.failedCount > 0 ? 'text-red-700 font-medium' : 'text-gray-700'}>{campaign.failedCount}</p></div>
            <div><p className="text-xs text-gray-400 uppercase">Créée par</p><p className="text-gray-700">{campaign.createdBy}</p></div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contenu</p>
            <div className="border border-gray-200 rounded-lg p-4 prose prose-sm max-w-none bg-gray-50" dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }} />
          </div>

          {campaign.errorSamples && Array.isArray(campaign.errorSamples) && campaign.errorSamples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Échantillon d'erreurs (5 premiers)</p>
              <div className="border border-red-200 rounded-lg p-3 bg-red-50 space-y-2 text-xs font-mono">
                {campaign.errorSamples.map((e, i) => (
                  <div key={i}>
                    <span className="text-red-900">{e.email}</span>
                    <span className="text-red-700"> — {e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export default function Communication() {
  const { user } = useAuth();
  const { selectedEventId, selectedEvent } = useEvent();
  const isTlb = user?.role === 'team_leader_volunteers';
  const isPrivileged = ['super_admin', 'admin_volunteers'].includes(user?.role);

  const [tab, setTab] = useState('composer'); // composer | history
  const [audienceType, setAudienceType] = useState(isTlb ? 'volunteers_by_tlb' : 'all_runners');
  const [audienceParam, setAudienceParam] = useState('');
  const [customEmailsRaw, setCustomEmailsRaw] = useState('');
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [audienceCount, setAudienceCount] = useState(0);
  const [audienceCountLoading, setAudienceCountLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null); // {type, text}

  const subjectInputRef = useRef(null);
  const quillRef = useRef(null);

  const availableVars = VARS_BY_AUDIENCE[audienceType] || [];

  /* ── Load TLB list once ── */
  useEffect(() => {
    if (!isPrivileged) return;
    get('/admin/communication/team-leaders').then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [isPrivileged]);

  /* ── Live audience count ── */
  useEffect(() => {
    if (!selectedEventId) return;
    const params = new URLSearchParams({ audienceType, eventId: selectedEventId });
    if (audienceType === 'volunteers_by_tlb' && audienceParam) {
      params.set('audienceParam', audienceParam);
    } else if (audienceType === 'custom') {
      params.set('audienceParam', customEmailsRaw);
    }
    setAudienceCountLoading(true);
    let cancelled = false;
    get(`/admin/communication/audience-count?${params}`)
      .then((res) => { if (!cancelled) setAudienceCount(res.count || 0); })
      .catch(() => { if (!cancelled) setAudienceCount(0); })
      .finally(() => { if (!cancelled) setAudienceCountLoading(false); });
    return () => { cancelled = true; };
  }, [audienceType, audienceParam, customEmailsRaw, selectedEventId]);

  /* ── Build sample vars for preview from a tiny synthetic record ── */
  const sampleVars = useMemo(() => {
    const evt = { eventName: selectedEvent?.name || '' };
    if (audienceType === 'all_runners') {
      return { ...evt, firstName: 'PRÉNOM', lastName: 'NOM', email: 'email@exemple.dz', bibNumber: '1234', runnerLevel: 'Confirmé' };
    }
    if (audienceType === 'all_volunteers' || audienceType === 'volunteers_by_tlb') {
      return { ...evt, firstName: 'PRÉNOM', lastName: 'NOM', email: 'email@exemple.dz', volunteerId: 'TMO1234' };
    }
    return { ...evt, email: 'email@exemple.dz' };
  }, [audienceType, selectedEvent]);

  const previewHtml = useMemo(() => renderTemplate(bodyHtml, sampleVars), [bodyHtml, sampleVars]);
  const previewSubject = useMemo(() => renderTemplate(subject, sampleVars), [subject, sampleVars]);

  const fromEmail = useMemo(() => (
    audienceType === 'all_runners' ? 'noreply@lassm.dz' : 'staff@lassm.dz'
  ), [audienceType]);

  /* ── Insert helpers ── */
  function insertIntoSubject(text) {
    const input = subjectInputRef.current;
    if (!input) { setSubject((s) => s + text); return; }
    const start = input.selectionStart ?? subject.length;
    const end = input.selectionEnd ?? subject.length;
    const next = subject.slice(0, start) + text + subject.slice(end);
    setSubject(next);
    queueMicrotask(() => {
      input.focus();
      const pos = start + text.length;
      input.setSelectionRange(pos, pos);
    });
  }

  function insertIntoBody(text) {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) { setBodyHtml((h) => h + text); return; }
    const range = editor.getSelection(true);
    const idx = range ? range.index : editor.getLength();
    editor.insertText(idx, text, 'user');
    editor.setSelection(idx + text.length, 0, 'user');
  }

  /* ── Validation ── */
  function canSend() {
    if (!subject.trim() || !bodyHtml || bodyHtml === '<p><br></p>') return false;
    if (audienceCount === 0) return false;
    if (audienceType === 'volunteers_by_tlb' && !isTlb && !audienceParam) return false;
    return true;
  }

  /* ── Send ── */
  async function doSend() {
    if (!canSend()) return;
    setSending(true);
    setMessage(null);
    try {
      const body = {
        audienceType,
        audienceParam: audienceType === 'custom' ? customEmailsRaw
          : audienceType === 'volunteers_by_tlb' ? (isTlb ? undefined : audienceParam)
          : undefined,
        subject,
        bodyHtml,
        eventId: selectedEventId,
      };
      const res = await post('/admin/communication/campaigns', body);
      setMessage({ type: 'success', text: `Campagne créée — envoi en cours à ${res.totalCount} destinataires.` });
      setConfirmModal(false);
      setTab('history');
      setSubject('');
      setBodyHtml('');
      if (audienceType === 'custom') setCustomEmailsRaw('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de l\'envoi' });
      setConfirmModal(false);
    }
    setSending(false);
  }

  /* ── Test send ── */
  async function doTestSend() {
    if (!subject.trim() || !bodyHtml || bodyHtml === '<p><br></p>') {
      setMessage({ type: 'error', text: 'Sujet et corps requis pour un test' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const body = {
        audienceType,
        audienceParam: audienceType === 'custom' ? customEmailsRaw
          : audienceType === 'volunteers_by_tlb' ? (isTlb ? undefined : audienceParam)
          : undefined,
        subject,
        bodyHtml,
        eventId: selectedEventId,
      };
      const res = await post('/admin/communication/campaigns/test', body);
      setMessage({ type: 'success', text: `Test envoyé à ${res.to}` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de l\'envoi du test' });
    }
    setTesting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Mail size={24} className="text-[#C42826]" /> Communication</h2>
            <p className="text-gray-500 text-sm mt-1">
              {isTlb ? 'Envoyez un email à votre équipe de bénévoles.' : 'Composez et envoyez un email aux coureurs ou bénévoles.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
          <button onClick={() => setTab('composer')} className={`px-4 py-2 text-sm font-medium border-b-2 transition cursor-pointer ${tab === 'composer' ? 'border-[#C42826] text-[#C42826]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Composer</button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 text-sm font-medium border-b-2 transition cursor-pointer ${tab === 'history' ? 'border-[#C42826] text-[#C42826]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Historique</button>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border flex items-start gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <Check size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-current opacity-60 hover:opacity-100"><X size={14} /></button>
          </div>
        )}

        {tab === 'composer' ? (
          <Composer
            user={user}
            isTlb={isTlb}
            isPrivileged={isPrivileged}
            audienceType={audienceType}
            setAudienceType={setAudienceType}
            audienceParam={audienceParam}
            setAudienceParam={setAudienceParam}
            customEmailsRaw={customEmailsRaw}
            setCustomEmailsRaw={setCustomEmailsRaw}
            teamLeaders={teamLeaders}
            audienceCount={audienceCount}
            audienceCountLoading={audienceCountLoading}
            availableVars={availableVars}
            subject={subject}
            setSubject={setSubject}
            subjectInputRef={subjectInputRef}
            insertIntoSubject={insertIntoSubject}
            bodyHtml={bodyHtml}
            setBodyHtml={setBodyHtml}
            insertIntoBody={insertIntoBody}
            quillRef={quillRef}
            previewHtml={previewHtml}
            previewSubject={previewSubject}
            fromEmail={fromEmail}
            canSend={canSend()}
            onTest={doTestSend}
            onSend={() => setConfirmModal(true)}
            testing={testing}
          />
        ) : (
          <History isTlb={isTlb} />
        )}

        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Send size={18} className="text-[#C42826]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmer l'envoi</h3>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-5">
                <p>Vous allez envoyer à <strong>{audienceCount}</strong> destinataire{audienceCount > 1 ? 's' : ''}.</p>
                <p>Audience : <strong>{AUDIENCE_LABEL[audienceType]}</strong></p>
                <p>Expéditeur : <strong>{fromEmail}</strong></p>
                <p>Sujet : <strong>{subject}</strong></p>
              </div>
              <p className="text-xs text-red-600 mb-4">Cette action est irréversible.</p>
              <SlideToConfirm onConfirm={doSend} label="Glisser pour envoyer" confirmedLabel={sending ? 'Envoi…' : 'Envoyé'} />
              <button onClick={() => setConfirmModal(false)} className="w-full mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer">Annuler</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Composer subcomponent ─── */
function Composer({
  user, isTlb, isPrivileged,
  audienceType, setAudienceType, audienceParam, setAudienceParam,
  customEmailsRaw, setCustomEmailsRaw, teamLeaders,
  audienceCount, audienceCountLoading, availableVars,
  subject, setSubject, subjectInputRef, insertIntoSubject,
  bodyHtml, setBodyHtml, insertIntoBody, quillRef,
  previewHtml, previewSubject, fromEmail, canSend, onTest, onSend, testing,
}) {
  const audienceOptions = isPrivileged
    ? [
        { value: 'all_runners', label: 'Tous les Coureurs', Icon: UsersIcon },
        { value: 'all_volunteers', label: 'Tous les Bénévoles', Icon: Heart },
        { value: 'volunteers_by_tlb', label: 'Bénévoles par TLB', Icon: User },
        { value: 'custom', label: 'Emails personnalisés', Icon: AtSign },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Audience */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Destinataires</h3>

        {isTlb ? (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-[#C42826]/10 flex items-center justify-center">
              <Heart size={18} className="text-[#C42826]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Mes bénévoles</p>
              <p className="text-xs text-gray-500">Bénévoles validés assignés à votre équipe</p>
            </div>
            <span className="text-sm font-semibold text-[#C42826]">
              {audienceCountLoading ? '…' : audienceCount}
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {audienceOptions.map((opt) => {
                const active = audienceType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setAudienceType(opt.value); setAudienceParam(''); }}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition cursor-pointer ${
                      active ? 'border-[#C42826] bg-[#C42826]/5' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <opt.Icon size={16} className={active ? 'text-[#C42826]' : 'text-gray-500'} />
                    <span className={active ? 'text-[#C42826] font-medium' : 'text-gray-700'}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {audienceType === 'volunteers_by_tlb' && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Sélectionner un TLB</label>
                <select
                  value={audienceParam}
                  onChange={(e) => setAudienceParam(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] outline-none"
                >
                  <option value="">— Choisir un Team Leader —</option>
                  {teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.username} ({tl.email})</option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'custom' && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Adresses email (virgule, point-virgule ou retour à la ligne)</label>
                <textarea
                  value={customEmailsRaw}
                  onChange={(e) => setCustomEmailsRaw(e.target.value)}
                  placeholder="alice@example.com, bob@example.com"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] outline-none min-h-[80px]"
                />
                <p className="text-xs text-gray-400 mt-1">Les variables ne sont pas substituées pour les adresses personnalisées (seul <code className="font-mono">{'{{eventName}}'}</code> est disponible).</p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Destinataires :</span>
              <span className="font-semibold text-gray-900">
                {audienceCountLoading ? <Loader2 size={14} className="inline animate-spin" /> : audienceCount}
              </span>
            </div>
          </>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
          <span>Expéditeur</span>
          <span className="font-mono text-gray-700">{fromEmail}</span>
        </div>
      </section>

      {/* Subject */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sujet</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={subjectInputRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Sujet de l'email"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C42826] outline-none"
          />
          <div className="flex gap-2">
            <EmojiBtn onInsert={insertIntoSubject} />
            <VarPicker vars={availableVars} onInsert={insertIntoSubject} />
          </div>
        </div>
      </section>

      {/* Body + Preview */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Corps du message</h3>
          <div className="flex gap-2">
            <EmojiBtn onInsert={insertIntoBody} />
            <VarPicker vars={availableVars} onInsert={insertIntoBody} />
          </div>
        </div>

        {/* Inline variable chips — click to insert at cursor */}
        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
          <p className="text-xs text-gray-600 mb-1.5 flex items-center gap-1"><Variable size={12} /> Variables disponibles pour cette audience — cliquez pour insérer :</p>
          <div className="flex flex-wrap gap-1.5">
            {availableVars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertIntoBody(`{{${v.key}}}`)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-0.5 text-xs hover:bg-blue-100 transition cursor-pointer"
                title={`Insère {{${v.key}}} (= ${v.label})`}
              >
                <span className="font-mono text-[#C42826]">{`{{${v.key}}}`}</span>
                <span className="text-gray-500">{v.label}</span>
              </button>
            ))}
          </div>
          {audienceType === 'custom' && (
            <p className="text-xs text-amber-700 mt-2">⚠ Pour les emails personnalisés, seul <code className="font-mono">{'{{eventName}}'}</code> est substitué (aucune donnée par destinataire).</p>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Édition</p>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={bodyHtml}
              onChange={setBodyHtml}
              modules={QUILL_MODULES}
              placeholder="Bonjour {{firstName}}, …"
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Eye size={12} /> Aperçu — données factices à des fins de prévisualisation uniquement</p>
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 min-h-[300px]">
              <p className="text-xs text-gray-400 uppercase mb-1">Sujet</p>
              <p className="text-sm font-semibold text-gray-900 mb-3">{previewSubject || <span className="text-gray-300">—</span>}</p>
              <p className="text-xs text-gray-400 uppercase mb-1">Message</p>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-gray-300">—</p>' }} />
              <p className="mt-3 text-xs text-gray-400 italic">À l'envoi, chaque destinataire reçoit l'email avec ses propres valeurs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button onClick={onTest} disabled={testing} className={BTN_SECONDARY}>
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Envoyer un test à mon email
        </button>
        <button onClick={onSend} disabled={!canSend} className={BTN_PRIMARY}>
          <Send size={14} />
          Envoyer ({audienceCount})
        </button>
      </section>
    </div>
  );
}

/* ─── History subcomponent ─── */
function History({ isTlb }) {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [detail, setDetail] = useState(null);
  const pollingIds = useMemo(() => campaigns.filter((c) => c.status === 'pending' || c.status === 'running').map((c) => c.id), [campaigns]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/admin/communication/campaigns?page=1&limit=50');
      setCampaigns(res.data || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* Poll running/pending campaigns */
  useEffect(() => {
    if (pollingIds.length === 0) return;
    const tick = async () => {
      const updates = await Promise.all(
        pollingIds.map((id) => get(`/admin/communication/campaigns/${id}`).catch(() => null))
      );
      const map = new Map(updates.filter(Boolean).map((c) => [c.id, c]));
      setCampaigns((prev) => prev.map((c) => map.get(c.id) || c));
    };
    const i = setInterval(tick, 3000);
    return () => clearInterval(i);
  }, [pollingIds]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Campagnes récentes</h3>
        <button onClick={fetchList} className={BTN_GHOST + ' text-xs'}>
          <Clock size={12} />Actualiser
        </button>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500"><Loader2 size={16} className="animate-spin inline mr-2" />Chargement…</div>
      ) : campaigns.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">Aucune campagne envoyée pour le moment.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-400 border-b border-gray-200">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Sujet</th>
                <th className="px-5 py-3 font-medium">Audience</th>
                <th className="px-5 py-3 font-medium text-right">Envoyés</th>
                <th className="px-5 py-3 font-medium text-right">Échec</th>
                <th className="px-5 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const s = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
                return (
                  <tr key={c.id} onClick={() => setDetail(c)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{new Date(c.createdAt).toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium max-w-xs truncate">{c.subject}</td>
                    <td className="px-5 py-3 text-gray-600">{AUDIENCE_LABEL[c.audienceType] || c.audienceType}</td>
                    <td className="px-5 py-3 text-emerald-700 text-right font-medium">{c.sentCount} / {c.totalCount}</td>
                    <td className={`px-5 py-3 text-right ${c.failedCount > 0 ? 'text-red-700 font-medium' : 'text-gray-500'}`}>{c.failedCount}</td>
                    <td className="px-5 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                      {(c.status === 'pending' || c.status === 'running') && <Loader2 size={10} className="animate-spin mr-1" />}
                      {s.label}
                    </span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <HistoryDetailModal campaign={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
