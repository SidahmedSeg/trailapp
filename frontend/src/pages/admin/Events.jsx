import { useState, useEffect } from 'react';
import { get, post, put } from '../../lib/api';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import {
  Plus, Calendar, MapPin, Edit2, Check, Archive, ArchiveRestore, X,
  Trash2, Globe, Link2, ChevronLeft, ChevronRight,
  Ticket, DollarSign, Settings, FileText, Route,
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const EVENT_TYPES = [
  { value: 'trail', label: 'Trail' },
  { value: 'route', label: 'Route' },
  { value: 'marathon', label: 'Marathon' },
];

const OPTIONAL_FIELD_LABELS = {
  distance: 'Distance choisie',
  medicalCertificate: 'Certificat médical',
  club: 'Club / Équipe',
  licenseNumber: 'Numéro de licence',
  bestPerformance: 'Meilleure performance',
  previousParticipations: 'Participations précédentes',
  shuttle: 'Navette transport',
  bloodType: 'Groupe sanguin',
  photoPack: 'Pack photo / vidéo',
};

const STEPS = [
  { key: 'identity', label: 'Identité', icon: Calendar },
  { key: 'config', label: 'Configuration', icon: Settings },
  { key: 'distances', label: 'Distances', icon: Route },
  { key: 'pricing', label: 'Tarification', icon: DollarSign },
  { key: 'fields', label: 'Champs', icon: FileText },
];

const initialForm = {
  name: '', type: 'trail', description: '', date: '', location: 'Alger', primaryColor: '#C42826',
  facebookUrl: '', instagramUrl: '', tiktokUrl: '', websiteUrl: '',
  contactEmail: '', contactPhone: '', contactLabel: '',
  registrationOpen: true, registrationDeadline: '', maxCapacity: '',
  autoCloseOnExhaustion: true,
  bibStart: 101, bibEnd: 1500, bibPrefix: '',
  priceInCentimes: 200000, photoPackPrice: '',
  termsText: '',
  distances: [],
  runnerLevels: ['Débutant', 'Confirmé', 'Elite'],
  optionalFields: {},
};

const input = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-1 focus:ring-[#C42826] transition disabled:opacity-50 disabled:cursor-not-allowed';
const label = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function Events() {
  const { refreshEvents } = useEvent();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...initialForm });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null); // { id, name } or null
  const [activateConfirm, setActivateConfirm] = useState(null); // { id, name } or null
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);

  useEffect(() => { fetchEvents(); }, []);

  async function fetchEvents() {
    try {
      const res = await get('/admin/events');
      setEvents(res.data || []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ ...initialForm });
    setStep(0);
    setEditing('new');
    setMsg(null);
    setLogoFile(null); setCoverFile(null);
    setLogoPreview(null); setCoverPreview(null);
  }

  async function openEdit(id) {
    try {
      const res = await get(`/admin/events/${id}`);
      const e = res.data;
      setForm({
        name: e.name || '',
        type: e.type || 'trail',
        description: e.description || '',
        date: e.date ? e.date.substring(0, 16) : '',
        location: e.location || '',
        primaryColor: e.primaryColor || '#C42826',
        facebookUrl: e.facebookUrl || '',
        instagramUrl: e.instagramUrl || '',
        tiktokUrl: e.tiktokUrl || '',
        websiteUrl: e.websiteUrl || '',
        contactEmail: e.contactEmail || '',
        contactPhone: e.contactPhone || '',
        contactLabel: e.contactLabel || '',
        registrationOpen: e.registrationOpen,
        registrationDeadline: e.registrationDeadline ? e.registrationDeadline.substring(0, 16) : '',
        maxCapacity: e.maxCapacity ?? '',
        autoCloseOnExhaustion: e.autoCloseOnExhaustion,
        bibStart: e.bibStart,
        bibEnd: e.bibEnd,
        bibPrefix: e.bibPrefix || '',
        priceInCentimes: e.priceInCentimes,
        photoPackPrice: e.photoPackPrice ?? '',
        termsText: e.termsText || '',
        distances: e.distances || [],
        runnerLevels: e.runnerLevels || ['Débutant', 'Confirmé', 'Elite'],
        optionalFields: e.optionalFields || {},
        bibRangeLocked: e.bibRangeLocked,
      });
      setStep(0);
      setEditing(id);
      setMsg(null);
      setLogoFile(null); setCoverFile(null);
      setLogoPreview(e.logoPath || null);
      setCoverPreview(e.coverImagePath || null);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setMsg({ type: 'error', text: 'Le nom est requis' });
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: form.date || null,
        registrationDeadline: form.registrationDeadline || null,
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity, 10) : null,
        priceInCentimes: parseInt(form.priceInCentimes, 10) || 200000,
        photoPackPrice: form.photoPackPrice ? parseInt(form.photoPackPrice, 10) : null,
        bibStart: parseInt(form.bibStart, 10),
        bibEnd: parseInt(form.bibEnd, 10),
      };

      let eventId;
      if (editing === 'new') {
        const res = await post('/admin/events', payload);
        eventId = res.data.id;
      } else {
        await put(`/admin/events/${editing}`, payload);
        eventId = editing;
      }

      // Upload files if selected
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await fetch(`/api/admin/events/${eventId}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          body: fd,
        });
      }
      if (coverFile) {
        const fd = new FormData();
        fd.append('cover', coverFile);
        await fetch(`/api/admin/events/${eventId}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          body: fd,
        });
      }

      setMsg({ type: 'success', text: editing === 'new' ? 'Événement créé avec succès' : 'Événement mis à jour' });
      setEditing(null);
      fetchEvents();
      refreshEvents();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function handleActivate(id) {
    const evt = events.find(e => e.id === id);
    setActivateConfirm({ id, name: evt?.name || 'cet événement' });
  }

  async function confirmActivate() {
    if (!activateConfirm) return;
    try {
      await post(`/admin/events/${activateConfirm.id}/activate`);
      setMsg({ type: 'success', text: 'Événement activé' });
      fetchEvents();
      refreshEvents();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setActivateConfirm(null);
  }

  function handleArchive(id) {
    const evt = events.find(e => e.id === id);
    setArchiveConfirm({ id, name: evt?.name || 'cet événement' });
  }

  async function confirmArchive() {
    if (!archiveConfirm) return;
    try {
      await post(`/admin/events/${archiveConfirm.id}/archive`);
      setMsg({ type: 'success', text: 'Événement archivé' });
      fetchEvents();
      refreshEvents();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setArchiveConfirm(null);
  }

  async function handleUnarchive(id) {
    try {
      await post(`/admin/events/${id}/unarchive`);
      setMsg({ type: 'success', text: 'Événement désarchivé' });
      fetchEvents();
      refreshEvents();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // Distance helpers
  function addDistance() {
    setForm(f => ({ ...f, distances: [...f.distances, { name: '', elevation: '', timeLimit: '' }] }));
  }
  function updateDistance(idx, field, value) {
    setForm(f => {
      const d = [...f.distances];
      d[idx] = { ...d[idx], [field]: value };
      return { ...f, distances: d };
    });
  }
  function removeDistance(idx) {
    setForm(f => ({ ...f, distances: f.distances.filter((_, i) => i !== idx) }));
  }

  // Optional field toggle
  function cycleFieldState(key) {
    setForm(f => {
      const current = f.optionalFields[key] || 'off';
      const order = ['off', 'optional', 'required'];
      const next = order[(order.indexOf(current) + 1) % order.length];
      return { ...f, optionalFields: { ...f.optionalFields, [key]: next } };
    });
  }

  const u = (field, value) => setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Événements</h2>
            <p className="text-gray-500 text-sm mt-1">Gérer vos événements</p>
          </div>
          {!editing && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C42826] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer">
              <Plus size={16} /> Nouvel événement
            </button>
          )}
        </div>

        {msg && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${
            msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>{msg.text}</div>
        )}

        {/* ─── EVENT CARDS ─── */}
        {!editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C42826]" />
              </div>
            ) : events.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucun événement</p>
                <button onClick={openCreate} className="mt-4 text-sm text-[#C42826] hover:underline cursor-pointer">
                  Créer votre premier événement
                </button>
              </div>
            ) : events.map((evt) => (
              <div key={evt.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
                {/* Card header */}
                <div className={`px-5 py-4 ${evt.active ? 'bg-[#C42826]' : evt.status === 'archived' ? 'bg-gray-400' : 'bg-gray-600'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-sm leading-tight">{evt.name}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-1 text-white/70 text-xs">
                          <MapPin size={11} />{evt.location}
                        </span>
                        {evt.date && (
                          <span className="text-white/70 text-xs">
                            {new Date(evt.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {evt.active && (
                      <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                        Actif
                      </span>
                    )}
                    {evt.status === 'archived' && (
                      <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">
                        Archivé
                      </span>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="capitalize bg-gray-100 px-2 py-0.5 rounded">{evt.type}</span>
                    <span className={`flex items-center gap-1 ${evt.registrationOpen ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${evt.registrationOpen ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {evt.registrationOpen ? 'Inscriptions ouvertes' : 'Fermé'}
                    </span>
                  </div>

                  {/* Registration toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">Inscriptions</span>
                    <button
                      onClick={async () => {
                        try {
                          await put(`/admin/events/${evt.id}`, { registrationOpen: !evt.registrationOpen });
                          fetchEvents();
                          refreshEvents();
                        } catch (err) {
                          setMsg({ type: 'error', text: err.message });
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition cursor-pointer ${evt.registrationOpen ? 'bg-[#C42826]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${evt.registrationOpen ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                    <button onClick={() => openEdit(evt.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                      <Edit2 size={13} /> Modifier
                    </button>
                    {!evt.active && evt.status !== 'archived' && (
                      <button onClick={() => handleActivate(evt.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 hover:bg-green-100 transition cursor-pointer">
                        <Check size={13} /> Activer
                      </button>
                    )}
                    {evt.status !== 'archived' ? (
                      <button onClick={() => handleArchive(evt.id)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                        title="Archiver">
                        <Archive size={13} />
                      </button>
                    ) : (
                      <button onClick={() => handleUnarchive(evt.id)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                        title="Désarchiver">
                        <ArchiveRestore size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── MULTI-STEP FORM ─── */}
        {editing && (
          <div className="max-w-3xl mx-auto">
            {/* Back button */}
            <button onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer">
              <ChevronLeft size={16} /> Retour aux événements
            </button>

            {/* Step indicator */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = i === step;
                  const isDone = i < step;
                  return (
                    <button key={s.key} onClick={() => setStep(i)}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group flex-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                        isActive ? 'bg-[#C42826] text-white' :
                        isDone ? 'bg-[#C42826]/10 text-[#C42826]' :
                        'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <span className={`text-[11px] font-medium transition hidden sm:block ${
                        isActive ? 'text-[#C42826]' : isDone ? 'text-gray-700' : 'text-gray-400'
                      }`}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step content */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">
                {editing === 'new' ? 'Nouvel événement' : 'Modifier l\'événement'}
                <span className="text-sm font-normal text-gray-400 ml-2">— {STEPS[step].label}</span>
              </h3>

              {/* Step 0: Identity */}
              {step === 0 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label}>Nom de l'événement *</label>
                      <input className={input} value={form.name} onChange={e => u('name', e.target.value)} placeholder="Trail des Mouflons d'Or 2027" />
                    </div>
                    <div>
                      <label className={label}>Type</label>
                      <select className={input} value={form.type} onChange={e => u('type', e.target.value)}>
                        {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={label}>Date / heure</label>
                      <input type="datetime-local" className={input} value={form.date} onChange={e => u('date', e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>Lieu</label>
                      <input className={input} value={form.location} onChange={e => u('location', e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>Couleur principale</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.primaryColor}
                          onChange={e => u('primaryColor', e.target.value)}
                          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                        />
                        <input
                          className={`${input} flex-1 font-mono`}
                          value={form.primaryColor}
                          onChange={e => u('primaryColor', e.target.value)}
                          placeholder="#C42826"
                          maxLength={7}
                        />
                        <div className="w-20 h-10 rounded-lg" style={{ backgroundColor: form.primaryColor }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Boutons, en-tête, pied de page, accents</p>
                    </div>
                  </div>
                  <div>
                    <label className={label}>Description</label>
                    <textarea className={`${input} min-h-[100px]`} value={form.description} onChange={e => u('description', e.target.value)} placeholder="Décrivez votre événement..." />
                  </div>
                  <hr className="border-gray-100" />
                  <h4 className="text-sm font-semibold text-gray-700">Visuels</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label}>Logo de l'événement</label>
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#C42826]/30 transition">
                        {(logoPreview || form.logoPath) && (
                          <img src={logoFile ? logoPreview : form.logoPath} alt="Logo" className="h-16 mx-auto mb-2 object-contain" />
                        )}
                        <input type="file" accept="image/*" className="hidden" id="logo-upload"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setLogoFile(file);
                              setLogoPreview(URL.createObjectURL(file));
                            }
                          }} />
                        <label htmlFor="logo-upload" className="text-xs text-[#C42826] hover:underline cursor-pointer">
                          {logoPreview || form.logoPath ? 'Changer le logo' : 'Choisir un logo'}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className={label}>Image de couverture</label>
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#C42826]/30 transition">
                        {(coverPreview || form.coverImagePath) && (
                          <img src={coverFile ? coverPreview : form.coverImagePath} alt="Cover" className="h-16 mx-auto mb-2 object-contain rounded" />
                        )}
                        <input type="file" accept="image/*" className="hidden" id="cover-upload"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setCoverFile(file);
                              setCoverPreview(URL.createObjectURL(file));
                            }
                          }} />
                        <label htmlFor="cover-upload" className="text-xs text-[#C42826] hover:underline cursor-pointer">
                          {coverPreview || form.coverImagePath ? 'Changer la couverture' : 'Choisir une image'}
                        </label>
                      </div>
                    </div>
                  </div>
                  <hr className="border-gray-100" />
                  <h4 className="text-sm font-semibold text-gray-700">Liens & Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={label}><Link2 size={12} className="inline mr-1" />Facebook</label>
                      <input className={input} value={form.facebookUrl} onChange={e => u('facebookUrl', e.target.value)} placeholder="https://..." />
                    </div>
                    <div>
                      <label className={label}><Link2 size={12} className="inline mr-1" />Instagram</label>
                      <input className={input} value={form.instagramUrl} onChange={e => u('instagramUrl', e.target.value)} placeholder="https://..." />
                    </div>
                    <div>
                      <label className={label}><Link2 size={12} className="inline mr-1" />TikTok</label>
                      <input className={input} value={form.tiktokUrl} onChange={e => u('tiktokUrl', e.target.value)} placeholder="https://..." />
                    </div>
                    <div>
                      <label className={label}><Globe size={12} className="inline mr-1" />Site web</label>
                      <input className={input} value={form.websiteUrl} onChange={e => u('websiteUrl', e.target.value)} placeholder="https://..." />
                    </div>
                    <div>
                      <label className={label}>Email contact</label>
                      <input className={input} value={form.contactEmail} onChange={e => u('contactEmail', e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>Téléphone contact</label>
                      <input className={input} value={form.contactPhone} onChange={e => u('contactPhone', e.target.value)} />
                    </div>
                    <div>
                      <label className={label}>Label CTA</label>
                      <input className={input} value={form.contactLabel} onChange={e => u('contactLabel', e.target.value)} placeholder="Contactez-nous" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Configuration (Inscriptions + Dossards) */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Inscriptions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={label}>Date limite</label>
                        <input type="datetime-local" className={input} value={form.registrationDeadline} onChange={e => u('registrationDeadline', e.target.value)} />
                      </div>
                      <div>
                        <label className={label}>Capacité max</label>
                        <input type="number" className={input} value={form.maxCapacity} onChange={e => u('maxCapacity', e.target.value)} placeholder="Illimité" />
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={form.registrationOpen} onChange={e => u('registrationOpen', e.target.checked)} className="w-4 h-4 accent-[#C42826]" />
                        <span className="text-sm text-gray-700">Inscriptions ouvertes</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={form.autoCloseOnExhaustion} onChange={e => u('autoCloseOnExhaustion', e.target.checked)} className="w-4 h-4 accent-[#C42826]" />
                        <span className="text-sm text-gray-700">Fermer auto si dossards épuisés</span>
                      </div>
                    </div>
                  </div>
                  <hr className="border-gray-100" />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Dossards</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={label}>Début de plage</label>
                        <input type="number" className={input} value={form.bibStart} disabled={form.bibRangeLocked} onChange={e => u('bibStart', e.target.value)} />
                        {form.bibRangeLocked && <p className="text-[10px] text-amber-600 mt-1">Verrouillé</p>}
                      </div>
                      <div>
                        <label className={label}>Fin de plage</label>
                        <input type="number" className={input} value={form.bibEnd} onChange={e => u('bibEnd', e.target.value)} />
                      </div>
                      <div>
                        <label className={label}>Préfixe</label>
                        <input className={input} value={form.bibPrefix} onChange={e => u('bibPrefix', e.target.value)} placeholder="TMO" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Distances */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Définissez les distances proposées pour cet événement.</p>
                    <button onClick={addDistance}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C42826] text-[#C42826] px-3 py-1.5 text-xs font-medium hover:bg-[#C42826]/5 transition cursor-pointer">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>

                  {form.distances.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                      <Route size={32} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-sm text-gray-400">Aucune distance configurée</p>
                      <button onClick={addDistance} className="mt-3 text-xs text-[#C42826] hover:underline cursor-pointer">
                        Ajouter une distance
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.distances.map((d, i) => (
                        <div key={i} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#C42826]/10 flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-xs font-bold text-[#C42826]">{i + 1}</span>
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                                <input className={input} placeholder="16km Trail" value={d.name} onChange={e => updateDistance(i, 'name', e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Dénivelé</label>
                                <input className={input} placeholder="443m D+" value={d.elevation || ''} onChange={e => updateDistance(i, 'elevation', e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Barrière horaire</label>
                                <input className={input} placeholder="3h00" value={d.timeLimit || ''} onChange={e => updateDistance(i, 'timeLimit', e.target.value)} />
                              </div>
                            </div>
                            <button onClick={() => removeDistance(i)} className="text-gray-300 hover:text-red-500 cursor-pointer mt-6">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Runner Levels */}
                  <hr className="border-gray-100 my-6" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Niveaux coureur</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Le coureur choisira parmi ces niveaux</p>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, runnerLevels: [...f.runnerLevels, ''] }))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C42826] text-[#C42826] px-3 py-1.5 text-xs font-medium hover:bg-[#C42826]/5 transition cursor-pointer">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                  <div className="space-y-2 mt-3">
                    {form.runnerLevels.map((level, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-gray-500">{i + 1}</span>
                        </div>
                        <input
                          className={`${input} flex-1`}
                          placeholder="Nom du niveau (ex: Elite)"
                          value={level}
                          onChange={e => {
                            const updated = [...form.runnerLevels];
                            updated[i] = e.target.value;
                            setForm(f => ({ ...f, runnerLevels: updated }));
                          }}
                        />
                        {form.runnerLevels.length > 1 && (
                          <button onClick={() => setForm(f => ({ ...f, runnerLevels: f.runnerLevels.filter((_, idx) => idx !== i) }))}
                            className="text-gray-300 hover:text-red-500 cursor-pointer">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Pricing */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={label}>Prix d'inscription (DZD) *</label>
                      <input type="number" className={input}
                        value={Math.round(form.priceInCentimes / 100)}
                        onChange={e => u('priceInCentimes', (parseInt(e.target.value, 10) || 0) * 100)} />
                      <p className="text-xs text-gray-400 mt-1">{(form.priceInCentimes || 0).toLocaleString()} centimes</p>
                    </div>
                    <div>
                      <label className={label}>Prix pack photo/vidéo (DZD)</label>
                      <input type="number" className={input}
                        value={form.photoPackPrice ? Math.round(form.photoPackPrice / 100) : ''}
                        onChange={e => {
                          const v = e.target.value;
                          u('photoPackPrice', v ? parseInt(v, 10) * 100 : '');
                        }} placeholder="Laisser vide si N/A" />
                    </div>
                  </div>
                  <hr className="border-gray-100" />
                  <div>
                    <label className={label}>Règlement de l'événement</label>
                    <div className="quill-wrapper">
                      <ReactQuill
                        theme="snow"
                        value={form.termsText || ''}
                        onChange={(val) => u('termsText', val === '<p><br></p>' ? '' : val)}
                        placeholder="Texte du règlement affiché dans le formulaire. Laissez vide pour le texte par défaut."
                        modules={{
                          toolbar: [
                            [{ header: [2, 3, false] }],
                            ['bold', 'italic', 'underline'],
                            [{ list: 'ordered' }, { list: 'bullet' }],
                            ['link'],
                            ['clean'],
                          ],
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Laissez vide pour utiliser le texte par défaut</p>
                  </div>
                </div>
              )}

              {/* Step 4: Optional fields */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 mb-2">
                    Cliquez sur un champ pour changer son état : <span className="text-gray-400">Désactivé</span> → <span className="text-blue-600">Optionnel</span> → <span className="text-[#C42826]">Obligatoire</span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(OPTIONAL_FIELD_LABELS).map(([key, fieldLabel]) => {
                      const state = form.optionalFields[key] || 'off';
                      return (
                        <button key={key} onClick={() => cycleFieldState(key)}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 transition cursor-pointer text-left ${
                            state === 'off' ? 'border-gray-100 hover:border-gray-200 bg-white' :
                            state === 'optional' ? 'border-blue-200 bg-blue-50/50' :
                            'border-[#C42826]/30 bg-red-50/50'
                          }`}>
                          <span className="text-sm text-gray-700">{fieldLabel}</span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            state === 'off' ? 'bg-gray-100 text-gray-400' :
                            state === 'optional' ? 'bg-blue-100 text-blue-600' :
                            'bg-red-100 text-[#C42826]'
                          }`}>
                            {state === 'off' ? 'Désactivé' : state === 'optional' ? 'Optionnel' : 'Obligatoire'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
                <button onClick={() => step > 0 ? setStep(step - 1) : setEditing(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer">
                  <ChevronLeft size={16} /> {step === 0 ? 'Annuler' : 'Précédent'}
                </button>
                <div className="flex items-center gap-3">
                  {step < STEPS.length - 1 ? (
                    <button onClick={() => setStep(step + 1)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C42826] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer">
                      Suivant <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button onClick={handleSave} disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] transition disabled:opacity-50 cursor-pointer">
                      <Check size={16} /> {saving ? 'Enregistrement...' : editing === 'new' ? 'Créer l\'événement' : 'Enregistrer'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Archive Confirmation Modal */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setArchiveConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Archive size={20} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Archiver l'événement</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Voulez-vous archiver <strong>{archiveConfirm.name}</strong> ?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Les inscriptions seront fermées. Vous pourrez désarchiver l'événement plus tard.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setArchiveConfirm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer">
                Annuler
              </button>
              <button onClick={confirmArchive}
                className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition cursor-pointer">
                Archiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirmation Modal */}
      {activateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActivateConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check size={20} className="text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Activer l'événement</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Voulez-vous activer <strong>{activateConfirm.name}</strong> ?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Cet événement deviendra l'événement actif. Les inscriptions publiques seront dirigées vers celui-ci. Tout autre événement actif sera désactivé.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setActivateConfirm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer">
                Annuler
              </button>
              <button onClick={confirmActivate}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition cursor-pointer">
                Activer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
