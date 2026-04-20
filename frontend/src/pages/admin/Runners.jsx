import { useState, useEffect, useCallback, useRef } from 'react';
import { get, post, put } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { useAuth } from '../../hooks/useAuth';
import { useEvent } from '../../hooks/useEvent';
import Sidebar from '../../components/ui/Sidebar';
import Select from 'react-select';
import { ChevronDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import {
  flagUrl, COUNTRIES_DATA, PHONE_CODES, WILAYAS, COMMUNES_MAP,
  TSHIRT_SIZES, selectStyles, phoneSelectStyles,
} from '../../data/formData';

/* ─── Filter Dropdown ─── */
function FilterDropdown({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm hover:bg-gray-100 transition cursor-pointer whitespace-nowrap">
        {current?.label || placeholder}
        <ChevronDown size={14} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute start-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
          {options.map((opt) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-start px-4 py-2 text-sm transition cursor-pointer ${
                opt.value === value ? 'bg-[#C42826]/5 text-[#C42826] font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}>{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sortable Table Header ─── */
function SortTh({ field, label, sortBy, sortOrder, onSort }) {
  const active = sortBy === field;
  return (
    <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-700 transition" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortOrder === 'asc'
            ? <ArrowUp size={14} className="text-[#C42826]" />
            : <ArrowDown size={14} className="text-[#C42826]" />
        ) : (
          <ArrowUpDown size={14} className="text-gray-300" />
        )}
      </span>
    </th>
  );
}

/* ─── Constants ─── */
const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#C42826] transition';
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#C42826] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] transition cursor-pointer';
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 text-gray-600 px-4 py-2.5 text-sm hover:bg-gray-50 transition cursor-pointer';

/* ─── CSV Export field groups ─── */
const CSV_FIELD_GROUPS = [
  {
    label: 'Personal',
    fields: [
      { key: 'firstName', label: 'Prénom' },
      { key: 'lastName', label: 'Nom' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Téléphone' },
      { key: 'gender', label: 'Genre' },
      { key: 'birthDate', label: 'Date naissance' },
      { key: 'nationality', label: 'Nationalité' },
    ],
  },
  {
    label: 'Residence',
    fields: [
      { key: 'countryOfResidence', label: 'Pays' },
      { key: 'wilaya', label: 'Wilaya' },
      { key: 'commune', label: 'Commune' },
      { key: 'ville', label: 'Ville' },
    ],
  },
  {
    label: 'Sport',
    fields: [
      { key: 'runnerLevel', label: 'Niveau' },
      { key: 'tshirtSize', label: 'Taille t-shirt' },
      { key: 'bibNumber', label: 'Dossard' },
    ],
  },
  {
    label: 'Payment',
    fields: [
      { key: 'paymentMethod', label: 'Méthode' },
      { key: 'paymentStatus', label: 'Statut paiement' },
      { key: 'paymentAmount', label: 'Montant' },
      { key: 'paymentDate', label: 'Date paiement' },
    ],
  },
  {
    label: 'Logistics',
    fields: [
      { key: 'status', label: 'Statut' },
      { key: 'source', label: 'Source' },
      { key: 'createdAt', label: 'Date inscription' },
      { key: 'distributedAt', label: 'Date distribution' },
    ],
  },
];

const ALL_CSV_FIELDS = CSV_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const map = {
    en_attente: 'bg-amber-50 text-amber-700',
    distribué: 'bg-emerald-50 text-emerald-700',
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    distributed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-700',
    paid: 'bg-emerald-50 text-emerald-700',
  };
  const labels = {
    en_attente: 'En attente',
    distribué: 'Distribué',
    confirmed: 'Confirmé',
    pending: 'En attente',
    distributed: 'Distribué',
    cancelled: 'Annulé',
    paid: 'Payé',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-50 text-gray-500'}`}
    >
      {labels[status] || status}
    </span>
  );
}

/* ─── Source Badge ─── */
function SourceBadge({ source }) {
  const map = {
    public: { cls: 'bg-blue-50 text-blue-700', label: 'En ligne' },
    admin: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'VIP' },
  };
  const s = map[source] || { cls: 'bg-gray-50 text-gray-500', label: source || '—' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ─── Field display ─── */
function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-700">{value || '—'}</dd>
    </div>
  );
}

/* ─── Export CSV Modal ─── */
function ExportCSVModal({ open, onClose }) {
  const [selected, setSelected] = useState(new Set(ALL_CSV_FIELDS));
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const allSelected = selected.size === ALL_CSV_FIELDS.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(ALL_CSV_FIELDS));
  };

  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const fields = [...selected].join(',');
      const token = getAccessToken();
      const res = await fetch(`/api/admin/runners/export/csv?fields=${fields}&eventId=${selectedEventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coureurs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      /* ignore */
    }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Export CSV</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-[#C42826] w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-900">Tout sélectionner</span>
          </label>

          {CSV_FIELD_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(f.key)}
                      onChange={() => toggle(f.key)}
                      className="accent-[#C42826] w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className={BTN_SECONDARY}>
            Annulér
          </button>
          <button onClick={handleExport} disabled={selected.size === 0 || exporting} className={BTN_PRIMARY + ' disabled:opacity-50'}>
            {exporting ? 'Export...' : 'Exporter'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Runner Create Modal ─── */
function RunnerCreateModal({ open, onClose, onCreated }) {
  const empty = {
    bibNumber: '', firstName: '', lastName: '', birthDate: '', gender: 'Homme',
    nationality: 'Algérie', phoneCountryCode: '+213', phoneNumber: '',
    email: '', countryOfResidence: 'Algérie', wilaya: '', commune: '', ville: '',
    emergencyPhoneCountryCode: '+213', emergencyPhoneNumber: '',
    tshirtSize: 'M', runnerLevel: 'Débutant',
    declarationFit: true, declarationRules: true, declarationImage: true,
  };

  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm(empty); setError(''); } }, [open]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => {
    const next = { ...prev, [key]: val };
    if (key === 'countryOfResidence' && val !== 'Algérie') { next.wilaya = ''; next.commune = ''; }
    if (key === 'wilaya') next.commune = '';
    return next;
  });

  const isAlgeria = form.countryOfResidence === 'Algérie';
  const communes = (COMMUNES_MAP[form.wilaya] || []).map((c) => ({ value: c, label: c }));

  const FlagLabel = ({ code, label }) => (
    <div className="flex items-center gap-2">
      <img src={flagUrl(code)} alt="" className="w-5 h-auto rounded-sm" />
      <span>{label}</span>
    </div>
  );

  const countryOptions = COUNTRIES_DATA.map((c) => ({
    value: c.value, code: c.code,
    label: <FlagLabel code={c.code} label={c.value} />,
    textLabel: c.value,
  }));

  const phoneOptions = PHONE_CODES.map((p) => ({
    value: p.value, code: p.code,
    label: <FlagLabel code={p.code} label={p.value} />,
    textLabel: `${p.value}`,
  }));

  const genderOptions = [
    { value: 'Homme', label: 'Homme' },
    { value: 'Femme', label: 'Femme' },
  ];

  const levelOptions = [
    { value: 'Débutant', label: 'Débutant' },
    { value: 'Confirmé', label: 'Confirmé' },
    { value: 'Elite', label: 'Elite' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const bib = Number(form.bibNumber);
    if (!bib || (bib >= 101 && bib <= 1500)) {
      setError('Le dossard doit etre en dehors de la plage 101-1500.');
      return;
    }
    setSaving(true);
    try {
      await post('/admin/runners', { ...form, bibNumber: bib });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la creation.');
    }
    setSaving(false);
  };

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Ajouter un coureur</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="create-runner-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

          {/* Bib */}
          <div>
            <label className={labelCls}>Numero de dossard *</label>
            <input type="number" required value={form.bibNumber} onChange={(e) => set('bibNumber', e.target.value)}
              placeholder="Ex: 50 ou 1501 (hors plage 101-1500)" className={INPUT_CLS} />
            <p className="text-xs text-gray-400 mt-1">Doit etre en dehors de la plage automatique (101-1500)</p>
          </div>

          {/* Personal info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nom *</label>
              <input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className={labelCls}>Prenom *</label>
              <input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date de naissance *</label>
              <input type="date" required value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className={labelCls}>Genre *</label>
              <Select styles={selectStyles} options={genderOptions}
                value={genderOptions.find((g) => g.value === form.gender)}
                onChange={(opt) => set('gender', opt?.value || 'Homme')}
                placeholder="— Choisir —" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Nationalite *</label>
            <Select styles={selectStyles} options={countryOptions}
              value={countryOptions.find((c) => c.value === form.nationality)}
              onChange={(opt) => set('nationality', opt?.value || '')}
              placeholder="— Choisir —"
              filterOption={(option, input) => option.data.textLabel?.toLowerCase().includes(input.toLowerCase())} />
          </div>

          {/* Contact */}
          <div>
            <label className={labelCls}>Telephone *</label>
            <div className="flex gap-2">
              <div className="w-48">
                <Select styles={phoneSelectStyles} options={phoneOptions}
                  value={phoneOptions.find((p) => p.value === form.phoneCountryCode)}
                  onChange={(opt) => set('phoneCountryCode', opt?.value || '+213')}
                  filterOption={(option, input) => option.data.textLabel?.toLowerCase().includes(input.toLowerCase())}
                  isSearchable />
              </div>
              <input required value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)}
                placeholder="770 585 909" className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} className={INPUT_CLS} />
          </div>

          {/* Residence */}
          <div>
            <label className={labelCls}>Pays de residence *</label>
            <Select styles={selectStyles} options={countryOptions}
              value={countryOptions.find((c) => c.value === form.countryOfResidence)}
              onChange={(opt) => set('countryOfResidence', opt?.value || '')}
              filterOption={(option, input) => option.data.textLabel?.toLowerCase().includes(input.toLowerCase())} />
          </div>

          {isAlgeria && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Wilaya *</label>
                <Select styles={selectStyles} options={WILAYAS}
                  value={WILAYAS.find((w) => w.value === form.wilaya)}
                  onChange={(opt) => set('wilaya', opt?.value || '')}
                  placeholder="— Choisir —" isSearchable />
              </div>
              <div>
                <label className={labelCls}>Commune *</label>
                <Select styles={selectStyles} options={communes}
                  value={communes.find((c) => c.value === form.commune)}
                  onChange={(opt) => set('commune', opt?.value || '')}
                  placeholder="— Choisir —" isSearchable
                  noOptionsMessage={() => form.wilaya ? 'Saisissez le nom' : 'Choisir une wilaya'} />
              </div>
            </div>
          )}
          {!isAlgeria && (
            <div>
              <label className={labelCls}>Ville *</label>
              <input required={!isAlgeria} value={form.ville} onChange={(e) => set('ville', e.target.value)}
                placeholder="Ville de residence" className={INPUT_CLS} />
            </div>
          )}

          {/* Emergency */}
          <div>
            <label className={labelCls}>Telephone d'urgence *</label>
            <div className="flex gap-2">
              <div className="w-48">
                <Select styles={phoneSelectStyles} options={phoneOptions}
                  value={phoneOptions.find((p) => p.value === form.emergencyPhoneCountryCode)}
                  onChange={(opt) => set('emergencyPhoneCountryCode', opt?.value || '+213')}
                  filterOption={(option, input) => option.data.textLabel?.toLowerCase().includes(input.toLowerCase())}
                  isSearchable />
              </div>
              <input required value={form.emergencyPhoneNumber} onChange={(e) => set('emergencyPhoneNumber', e.target.value)}
                placeholder="661 234 567" className={INPUT_CLS} />
            </div>
          </div>

          {/* T-shirt */}
          <div>
            <label className={labelCls}>Taille t-shirt *</label>
            <div className="flex gap-2">
              {TSHIRT_SIZES.map((sz) => (
                <button key={sz} type="button" onClick={() => set('tshirtSize', sz)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition cursor-pointer ${
                    form.tshirtSize === sz
                      ? 'bg-[#C42826] text-white border-[#C42826]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>{sz}</button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div>
            <label className={labelCls}>Niveau *</label>
            <Select styles={selectStyles} options={levelOptions}
              value={levelOptions.find((l) => l.value === form.runnerLevel)}
              onChange={(opt) => set('runnerLevel', opt?.value || 'Débutant')}
              placeholder="— Choisir —" />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Annulér</button>
          <button type="submit" form="create-runner-form" disabled={saving} className={BTN_PRIMARY + ' disabled:opacity-50'}>
            {saving ? 'Creation...' : 'Creer le coureur'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Panel (with edit mode) ─── */
function ResendEmailButton({ registrationId }) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleResend = async () => {
    setSending(true);
    setMsg(null);
    try {
      await post(`/registration/${registrationId}/send-pdf`);
      setMsg({ type: 'success', text: 'Email envoyé' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setSending(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleResend} disabled={sending}
        className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50">
        {sending ? 'Envoi...' : 'Renvoyer email'}
      </button>
      {msg && <span className={`text-xs ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>}
    </div>
  );
}

function DetailPanel({ runner, onClose, onUpdated }) {
  const [tab, setTab] = useState('profil');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (runner) {
      setEditing(false);
      setError('');
      setForm({ ...runner });
    }
  }, [runner]);

  if (!runner) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const startEdit = () => {
    setForm({ ...runner });
    setEditing(true);
    setError('');
  };

  const cancelEdit = () => {
    setForm({ ...runner });
    setEditing(false);
    setError('');
  };

  const saveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      const { id, bibNumber, createdAt, updatedAt, ...editable } = form;
      await put(`/admin/runners/${runner.id}`, editable);
      onUpdated();
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  const display = editing ? form : runner;

  const renderField = (label, key, opts = {}) => {
    if (!editing) {
      let val = display[key];
      if (opts.date && val) val = new Date(val).toLocaleString('fr-FR');
      if (opts.badge) return <Field label={label} value={opts.badge(display[key])} />;
      return <Field label={label} value={val} />;
    }

    if (opts.readOnly) {
      return <Field label={label} value={display[key]} />;
    }

    if (opts.select) {
      return (
        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
          <select value={form[key] || ''} onChange={(e) => set(key, e.target.value)} className={INPUT_CLS + ' mt-1'}>
            {opts.select.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div>
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
        <input
          type={opts.type || 'text'}
          value={form[key] || ''}
          onChange={(e) => set(key, e.target.value)}
          className={INPUT_CLS + ' mt-1'}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-gray-200 shadow-2xl overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Dossard #{display.bibNumber}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {['profil', 'paiement'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition cursor-pointer ${
                tab === t ? 'text-[#C42826] border-b-2 border-[#C42826]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t === 'profil' ? 'Profil' : 'Paiement'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

          {tab === 'profil' ? (
            <>
              {renderField('Dossard', 'bibNumber', { readOnly: true })}
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  {renderField('Prenom', 'firstName')}
                  {renderField('Nom', 'lastName')}
                </div>
              ) : (
                <Field label="Nom complet" value={`${display.firstName || ''} ${display.lastName || ''}`} />
              )}
              {renderField('Email', 'email', { type: 'email' })}
              {renderField('Telephone', 'phone')}
              {renderField('Date de naissance', 'birthDate', editing ? { type: 'date' } : { date: false })}
              {renderField('Genre', 'gender', { select: ['Homme', 'Femme'] })}
              {renderField('Nationalite', 'nationality')}
              {renderField('Pays de residence', 'countryOfResidence')}
              {renderField('Wilaya', 'wilaya')}
              {renderField('Commune', 'commune')}
              {renderField('Ville', 'ville')}
              {renderField('Taille t-shirt', 'tshirtSize', { select: ['S', 'M', 'L', 'XL', 'XXL'] })}
              {renderField('Niveau', 'runnerLevel', { select: ['Débutant', 'Confirmé', 'Elite'] })}
              {renderField('Statut', 'status', editing ? { select: ['en_attente', 'distribué'] } : { badge: (v) => <StatusBadge status={v} /> })}
              {renderField('Source', 'source', { readOnly: true })}
              {!editing && (
                <Field
                  label="Date d'inscription"
                  value={display.createdAt ? new Date(display.createdAt).toLocaleString('fr-FR') : '—'}
                />
              )}

              {/* Edit buttons */}
              <div className="pt-4 flex gap-3">
                {!editing ? (
                  <>
                    <button onClick={startEdit} className={BTN_PRIMARY}>
                      Modifier
                    </button>
                    {display.bibNumber && (
                      <ResendEmailButton registrationId={runner.id} />
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={saveEdit} disabled={saving} className={BTN_PRIMARY + ' disabled:opacity-50'}>
                      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    <button onClick={cancelEdit} className={BTN_SECONDARY}>
                      Annulér
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Field label="Statut paiement" value={<StatusBadge status={display.paymentStatus} />} />
              <Field label="Montant" value={display.paymentAmount != null ? `${(display.paymentAmount / 100).toLocaleString('fr-FR')} DZD` : '—'} />
              <Field label="Methode" value={display.paymentMethod} />
              <Field label="Carte (4 derniers)" value={display.cardPan || '—'} />
              <Field label="Transaction SATIM" value={display.transactionNumber || '—'} />
              <Field label="Date paiement" value={display.paymentDate ? new Date(display.paymentDate).toLocaleString('fr-FR') : '—'} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Runners Page ─── */
export default function Runners() {
  const { user } = useAuth();
  const { selectedEventId } = useEvent();

  const [runners, setRunners] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const limit = 20;

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const fetchRunners = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, sortBy, sortOrder, eventId: selectedEventId });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      const data = await get(`/admin/runners?${params}`);
      setRunners(data.data || []);
      setTotal(data.total || 0);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [page, search, statusFilter, sourceFilter, sortBy, sortOrder, selectedEventId]);

  useEffect(() => {
    fetchRunners();
  }, [fetchRunners]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleRefresh = () => {
    fetchRunners();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      {/* Main */}
      <main className="lg:ml-60 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Coureurs</h2>
            <p className="text-gray-500 text-sm mt-1">Gestion des coureurs inscrits</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm hover:bg-gray-100 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Actualiser
            </button>
            <button onClick={() => setShowCreateModal(true)} className={BTN_PRIMARY}>
              + Ajouter coureur
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm hover:bg-gray-100 transition cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Rechercher par nom, email, dossard..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-[240px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] transition"
          />
          <FilterDropdown
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            placeholder="Tous les statuts"
            options={[
              { value: '', label: 'Tous les statuts' },
              { value: 'en_attente', label: 'En attente' },
              { value: 'distribué', label: 'Distribué' },
            ]}
          />
          <FilterDropdown
            value={sourceFilter}
            onChange={(v) => { setSourceFilter(v); setPage(1); }}
            placeholder="Type d'inscription"
            options={[
              { value: '', label: "Type d'inscription" },
              { value: 'public', label: 'En ligne' },
              { value: 'admin', label: 'VIP' },
            ]}
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <SortTh field="bibNumber" label="Dossard" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                  <SortTh field="lastName" label="Nom" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                  <SortTh field="email" label="Email" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium">Tél</th>
                  <SortTh field="status" label="Statut" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium">Type</th>
                  <SortTh field="createdAt" label="Date" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      Chargement...
                    </td>
                  </tr>
                ) : runners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      Aucun coureur trouve.
                    </td>
                  </tr>
                ) : (
                  runners.map((r) => (
                    <tr key={r.id} onClick={() => setSelectedRunner(r)} className="hover:bg-gray-50 cursor-pointer transition">
                      <td className="px-4 py-3 font-mono text-[#C42826]">{r.bibNumber || '—'}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {r.firstName} {r.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.email}</td>
                      <td className="px-4 py-3 text-gray-600">{r.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={r.source} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
            <span className="text-sm text-gray-500">
              {total} coureur{total !== 1 ? 's' : ''} — Page {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-gray-100 transition cursor-pointer disabled:cursor-not-allowed"
              >
                Precedent
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-gray-100 transition cursor-pointer disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Detail Panel */}
      <DetailPanel
        runner={selectedRunner}
        onClose={() => setSelectedRunner(null)}
        onUpdated={() => {
          fetchRunners();
          // Re-fetch the selected runner to reflect changes
          if (selectedRunner) {
            get(`/admin/runners/${selectedRunner.id}`)
              .then((data) => setSelectedRunner(data))
              .catch(() => {});
          }
        }}
      />

      {/* Export CSV Modal */}
      <ExportCSVModal open={showExportModal} onClose={() => setShowExportModal(false)} />

      {/* Create Runner Modal */}
      <RunnerCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          fetchRunners();
        }}
      />
    </div>
  );
}
