import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Select from 'react-select';
import { Loader2, AlertCircle, CheckCircle, User, Mail, Phone, FileText, IdCard, Heart, Upload, Shirt, Clock, Globe, Award, FileCheck, AlertTriangle } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';
import { COUNTRIES_DATA, PHONE_CODES } from '../../data/formData';

const flagUrl = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const LANGUAGE_OPTIONS = [
  { value: 'Arabe', label: 'Arabe' },
  { value: 'Arabe algérien (Darija)', label: 'Arabe algérien (Darija)' },
  { value: 'Tamazight (Kabyle)', label: 'Tamazight (Kabyle)' },
  { value: 'Français', label: 'Français' },
  { value: 'Anglais', label: 'Anglais' },
  { value: 'Espagnol', label: 'Espagnol' },
  { value: 'Italien', label: 'Italien' },
  { value: 'Allemand', label: 'Allemand' },
  { value: 'Portugais', label: 'Portugais' },
  { value: 'Turc', label: 'Turc' },
  { value: 'Chinois', label: 'Chinois' },
  { value: 'Russe', label: 'Russe' },
];

const selectStyles = {
  control: (base, state) => ({
    ...base, borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none',
    padding: '4px 0',
    '&:hover': { borderColor: '#C42826' },
  }),
  option: (base, state) => ({
    ...base, display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
  }),
  singleValue: (base) => ({ ...base, display: 'flex', alignItems: 'center', gap: '8px' }),
};

function FlagLabel({ code, label }) {
  return (
    <div className="flex items-center gap-2">
      <img src={flagUrl(code)} alt="" className="w-5 h-auto rounded-sm" /><span>{label}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#C42826]/10">
        <Icon size={18} className="text-[#C42826]" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </div>
  );
}

const monthOptions = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' },     { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },{ value: '08', label: 'Août' },    { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },{ value: '11', label: 'Novembre' },{ value: '12', label: 'Décembre' },
];

// Three Select dropdowns (Jour / Mois / Année). Outputs YYYY-MM-DD.
// Matches the BirthDatePicker used in Register / ReconciliationRegister.
function BirthDatePicker({ value, onChange, error }) {
  const [day, setDay] = useState(null);
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(null);

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      if (y) setYear({ value: y, label: y });
      if (m) setMonth(monthOptions.find((o) => o.value === m) || null);
      if (d) setDay({ value: String(parseInt(d, 10)), label: String(parseInt(d, 10)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDate = (d, m, y) => {
    if (d?.value && m?.value && y?.value) {
      onChange(`${y.value}-${m.value.padStart(2, '0')}-${d.value.padStart(2, '0')}`);
    }
  };

  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 80 }, (_, i) => {
    const y = currentYear - 18 - i;
    return { value: String(y), label: String(y) };
  });

  const dateSelectStyles = {
    control: (base, state) => ({
      ...base, borderRadius: '0.75rem',
      borderColor: error ? '#fca5a5' : state.isFocused ? '#C42826' : '#e5e7eb',
      backgroundColor: error ? 'rgba(254,242,242,0.3)' : '#fafafa',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none', padding: '4px 0',
    }),
    option: (base, state) => ({ ...base,
      backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
      color: state.isSelected ? 'white' : '#1f2937', fontSize: '0.875rem',
    }),
    singleValue: (base) => ({ ...base, fontSize: '0.875rem' }),
    placeholder: (base) => ({ ...base, fontSize: '0.875rem', color: '#9ca3af' }),
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select styles={dateSelectStyles} options={dayOptions} value={day} placeholder="Jour"
        onChange={(v) => { setDay(v); updateDate(v, month, year); }} />
      <Select styles={dateSelectStyles} options={monthOptions} value={month} placeholder="Mois"
        onChange={(v) => { setMonth(v); updateDate(day, v, year); }} />
      <Select styles={dateSelectStyles} options={yearOptions} value={year} placeholder="Année"
        onChange={(v) => { setYear(v); updateDate(day, month, v); }} isSearchable />
    </div>
  );
}

function FileInput({ id, label, accept, file, onChange, error, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-[#C42826] ms-0.5">*</span>}
      </label>
      <label htmlFor={id}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition ${
          error ? 'border-red-300 bg-red-50/30'
          : file ? 'border-emerald-300 bg-emerald-50/30'
          : 'border-gray-200 bg-gray-50/50 hover:border-[#C42826] hover:bg-[#C42826]/5'
        }`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${file ? 'bg-emerald-100' : 'bg-white'}`}>
          {file ? <CheckCircle size={20} className="text-emerald-600" /> : <Upload size={20} className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko — Cliquer pour changer</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">Sélectionner un fichier</p>
              <p className="text-xs text-gray-500">PDF, JPG, PNG — 5 Mo max</p>
            </>
          )}
        </div>
        <input id={id} type="file" accept={accept} className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function VolunteerRegister() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(null);

  const [form, setForm] = useState({
    lastName: '', firstName: '', email: '',
    phoneCountryCode: '+213', phoneNumber: '',
    birthDate: '', gender: '', nationality: '',
    motivation: '',
    // Availability & skills
    availableRaceDay: false,
    canArriveEarly: false,
    previousExperience: '',
    languagesSpoken: [], // array of language values (joined to comma-separated string on submit)
    canStandLongTime: '', // tri-state: '' / 'yes' / 'no' (required)
    tshirtSize: '',
    // Emergency contact
    emergencyContactName: '',
    emergencyContactPhoneCountryCode: '+213',
    emergencyContactPhoneNumber: '',
    // Agreements
    agreedInstructions: false,
    agreedBriefing: false,
  });
  const [cvFile, setCvFile] = useState(null);
  const [idFile, setIdFile] = useState(null);

  useEffect(() => {
    fetch(`/api/volunteer/check/${slug}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message || 'Indisponible');
        return json;
      })
      .then((d) => setEvent(d.event))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const countryOptions = COUNTRIES_DATA.map((c) => ({
    value: c.value, code: c.code,
    label: <FlagLabel code={c.code} label={c.value} />, textLabel: c.value,
  }));
  const phoneOptions = PHONE_CODES.map((p) => ({
    value: p.value, code: p.code,
    label: <FlagLabel code={p.code} label={p.value} />, textLabel: `${p.value}`,
  }));
  const genderOptions = [
    { value: 'Homme', label: 'Homme' }, { value: 'Femme', label: 'Femme' },
  ];

  const LATIN_REGEX = /^[a-zA-ZÀ-ÿ\s\-']*$/;
  const UPPERCASE_FIELDS = ['lastName', 'firstName'];

  function update(field, value) {
    if (UPPERCASE_FIELDS.includes(field)) {
      value = (value || '').toUpperCase();
      if (value && !LATIN_REGEX.test(value)) {
        setFieldErrors((p) => ({ ...p, [field]: 'Lettres latines uniquement' }));
        return;
      } else {
        setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
      }
    }
    setForm((p) => ({ ...p, [field]: value }));
  }

  function setCv(f) {
    setFieldErrors((p) => { const n = { ...p }; delete n.cv; return n; });
    if (f && f.size > MAX_FILE_BYTES) {
      setFieldErrors((p) => ({ ...p, cv: 'Fichier trop volumineux (5 Mo max)' }));
      return;
    }
    setCvFile(f);
  }

  function setId(f) {
    setFieldErrors((p) => { const n = { ...p }; delete n.id; return n; });
    if (f && f.size > MAX_FILE_BYTES) {
      setFieldErrors((p) => ({ ...p, id: 'Fichier trop volumineux (5 Mo max)' }));
      return;
    }
    setIdFile(f);
  }

  function validateForm() {
    const errs = {};
    if (!form.lastName) errs.lastName = 'Nom requis';
    if (!form.firstName) errs.firstName = 'Prénom requis';
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Email invalide';
    if (form.phoneCountryCode === '+213') {
      const num = form.phoneNumber.replace(/^0+/, '');
      if (!/^[567]\d{8}$/.test(num)) errs.phoneNumber = '9 chiffres, démarrant par 5/6/7 (sans le 0)';
    } else if (!form.phoneNumber || !/^\d+$/.test(form.phoneNumber)) {
      errs.phoneNumber = 'Numéro invalide';
    }
    if (!cvFile) errs.cv = 'CV requis (PDF, JPG ou PNG)';
    if (!idFile) errs.id = 'Pièce d\'identité requise (PDF, JPG ou PNG)';

    // Availability & skills
    if (!form.tshirtSize) errs.tshirtSize = 'Taille requise';
    if (!form.canStandLongTime) errs.canStandLongTime = 'Veuillez répondre';

    // Emergency contact
    if (!form.emergencyContactName?.trim()) errs.emergencyContactName = 'Nom du contact requis';
    if (form.emergencyContactPhoneCountryCode === '+213') {
      const num = form.emergencyContactPhoneNumber.replace(/^0+/, '');
      if (!/^[567]\d{8}$/.test(num)) errs.emergencyContactPhoneNumber = '9 chiffres, démarrant par 5/6/7 (sans le 0)';
    } else if (!form.emergencyContactPhoneNumber || !/^\d+$/.test(form.emergencyContactPhoneNumber)) {
      errs.emergencyContactPhoneNumber = 'Numéro invalide';
    }

    // Agreements (also required)
    if (!form.agreedInstructions) errs.agreedInstructions = 'Acceptation requise';
    if (!form.agreedBriefing) errs.agreedBriefing = 'Acceptation requise';

    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const errs = validateForm();
    setFieldErrors((p) => ({ ...p, ...errs }));
    if (Object.keys(errs).length > 0) {
      setError('Veuillez corriger les champs en rouge');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('lastName', form.lastName);
      fd.append('firstName', form.firstName);
      fd.append('email', form.email.toLowerCase().trim());
      const phone = form.phoneCountryCode + form.phoneNumber.replace(/^0+/, '');
      fd.append('phone', phone);
      if (form.birthDate) fd.append('birthDate', form.birthDate);
      if (form.gender) fd.append('gender', form.gender);
      if (form.nationality) fd.append('nationality', form.nationality);
      if (form.motivation) fd.append('motivation', form.motivation);

      // Availability & skills
      fd.append('availableRaceDay', form.availableRaceDay ? 'true' : 'false');
      fd.append('canArriveEarly', form.canArriveEarly ? 'true' : 'false');
      if (form.previousExperience) fd.append('previousExperience', form.previousExperience);
      if (Array.isArray(form.languagesSpoken) && form.languagesSpoken.length > 0) {
        fd.append('languagesSpoken', form.languagesSpoken.join(', '));
      }
      fd.append('canStandLongTime', form.canStandLongTime === 'yes' ? 'true' : 'false');
      if (form.tshirtSize) fd.append('tshirtSize', form.tshirtSize);

      // Emergency contact (E.164)
      const emergencyPhone = form.emergencyContactPhoneCountryCode + form.emergencyContactPhoneNumber.replace(/^0+/, '');
      fd.append('emergencyContactName', form.emergencyContactName);
      fd.append('emergencyContactPhone', emergencyPhone);

      // Agreements
      fd.append('agreedInstructions', form.agreedInstructions ? 'true' : 'false');
      fd.append('agreedBriefing', form.agreedBriefing ? 'true' : 'false');

      fd.append('cv', cvFile);
      fd.append('idDoc', idFile);

      const res = await fetch(`/api/volunteer/${slug}/register`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || `Erreur ${res.status}`);
      setDone(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout title="Candidature bénévole" event={null}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#C42826]" size={32} />
        </div>
      </PublicLayout>
    );
  }

  if (loadError) {
    return (
      <PublicLayout title="Candidature bénévole" event={null}>
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Indisponible</h1>
            <p className="text-gray-600">{loadError}</p>
            <p className="text-gray-500 text-sm mt-4">Contactez l'organisation pour plus d'informations.</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (done) {
    return (
      <PublicLayout title="Candidature enregistrée" event={event}>
        <div className="flex items-center justify-center px-4 py-16">
          <div className="bg-emerald-50 rounded-2xl shadow-lg border border-emerald-200 p-10 max-w-lg text-center">
            <CheckCircle size={56} className="mx-auto mb-4 text-emerald-600" />
            <h1 className="text-2xl font-bold mb-3 text-emerald-800">Candidature reçue</h1>
            <p className="text-sm text-emerald-700">{done.message}</p>
            <p className="text-xs text-emerald-700 mt-4">Vous recevrez un email lorsque l'équipe vous proposera un entretien.</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 focus:bg-white transition';
  const inputErrCls = 'w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const FieldError = ({ name }) => fieldErrors[name] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[name]}</p> : null;

  return (
    <PublicLayout title="Candidature bénévole" event={event}>
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Banner */}
          <div className="bg-[#C42826]/5 border border-[#C42826]/20 rounded-2xl p-5 mb-6 flex items-start gap-3">
            <Heart className="text-[#C42826] flex-shrink-0 mt-0.5" size={22} />
            <div>
              <p className="font-semibold text-gray-900 mb-1">
                Rejoignez l'équipe des bénévoles de L'{event?.name}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Remplissez le formulaire ci-dessous en joignant votre CV et votre pièce d'identité.
              </p>
              <p className="text-sm text-gray-600">
                Si votre candidature est pré-sélectionnée, l'équipe d'organisation vous contactera pour un entretien.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={User} title="Informations personnelles" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nom<span className="text-[#C42826] ms-0.5">*</span></label>
                  <input className={fieldErrors.lastName ? inputErrCls : inputCls} required
                    value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                  <FieldError name="lastName" />
                </div>
                <div>
                  <label className={labelCls}>Prénom<span className="text-[#C42826] ms-0.5">*</span></label>
                  <input className={fieldErrors.firstName ? inputErrCls : inputCls} required
                    value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                  <FieldError name="firstName" />
                </div>
                <div>
                  <label className={labelCls}>Date de naissance</label>
                  <BirthDatePicker value={form.birthDate} onChange={(v) => update('birthDate', v)} error={fieldErrors.birthDate} />
                  <FieldError name="birthDate" />
                </div>
                <div>
                  <label className={labelCls}>Genre</label>
                  <Select styles={selectStyles} options={genderOptions}
                    value={genderOptions.find((g) => g.value === form.gender) || null}
                    onChange={(opt) => update('gender', opt?.value || '')} placeholder="Choisir" isClearable />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nationalité</label>
                  <Select styles={selectStyles} options={countryOptions}
                    value={countryOptions.find((c) => c.value === form.nationality) || null}
                    onChange={(opt) => update('nationality', opt?.value || '')} placeholder="Choisir"
                    isClearable
                    filterOption={(opt, input) => opt.data.textLabel.toLowerCase().includes(input.toLowerCase())} />
                </div>
              </div>
            </section>

            {/* Contact */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={Mail} title="Contact" />
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Téléphone<span className="text-[#C42826] ms-0.5">*</span></label>
                  <div className="flex gap-2">
                    <div className="w-52">
                      <Select styles={selectStyles} options={phoneOptions}
                        value={phoneOptions.find((p) => p.value === form.phoneCountryCode) || null}
                        onChange={(opt) => update('phoneCountryCode', opt?.value || '+213')}
                        filterOption={(opt, input) => opt.data.textLabel.toLowerCase().includes(input.toLowerCase())} isSearchable />
                    </div>
                    <input type="tel" className={fieldErrors.phoneNumber ? inputErrCls : inputCls} required
                      placeholder="6XX XXX XXX" value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} />
                  </div>
                  <FieldError name="phoneNumber" />
                </div>
                <div>
                  <label className={labelCls}>Email<span className="text-[#C42826] ms-0.5">*</span></label>
                  <input type="email" className={fieldErrors.email ? inputErrCls : inputCls} required
                    value={form.email} onChange={(e) => update('email', e.target.value)} />
                  <FieldError name="email" />
                </div>
              </div>
            </section>

            {/* Documents */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={FileText} title="Documents" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileInput id="vol-cv" label="CV" accept={ACCEPT} file={cvFile} onChange={setCv} error={fieldErrors.cv} required />
                <FileInput id="vol-id" label="Pièce d'identité" accept={ACCEPT} file={idFile} onChange={setId} error={fieldErrors.id} required />
              </div>
            </section>

            {/* Availability & skills */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={Clock} title="Disponibilité et profil" />
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 hover:bg-gray-50">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#C42826]"
                    checked={form.availableRaceDay} onChange={(e) => update('availableRaceDay', e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Disponible le jour de la course</p>
                    <p className="text-xs text-gray-500 mt-0.5">Je confirme être présent(e) pour l'événement</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 hover:bg-gray-50">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#C42826]"
                    checked={form.canArriveEarly} onChange={(e) => update('canArriveEarly', e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Capable d'arriver tôt</p>
                    <p className="text-xs text-gray-500 mt-0.5">Le briefing matinal et l'installation démarrent avant l'aube</p>
                  </div>
                </label>

                <div>
                  <label className={labelCls}>Capacité à rester debout longtemps<span className="text-[#C42826] ms-0.5">*</span></label>
                  <div className="flex gap-2">
                    {[{ v: 'yes', l: 'Oui' }, { v: 'no', l: 'Non' }].map((o) => (
                      <button key={o.v} type="button"
                        onClick={() => update('canStandLongTime', o.v)}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium border transition ${
                          form.canStandLongTime === o.v
                            ? 'bg-[#C42826] text-white border-[#C42826]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}>{o.l}</button>
                    ))}
                  </div>
                  <FieldError name="canStandLongTime" />
                </div>

                <div>
                  <label className={labelCls}>Langues parlées</label>
                  <Select
                    isMulti
                    styles={selectStyles}
                    options={LANGUAGE_OPTIONS}
                    value={LANGUAGE_OPTIONS.filter((o) => form.languagesSpoken.includes(o.value))}
                    onChange={(opts) => update('languagesSpoken', (opts || []).map((o) => o.value))}
                    placeholder="Sélectionnez une ou plusieurs langues…"
                    closeMenuOnSelect={false}
                    noOptionsMessage={() => 'Aucune langue'}
                  />
                </div>

                <div>
                  <label className={labelCls}>Expérience de bénévolat précédente</label>
                  <textarea rows={3} className={`${inputCls} resize-none`} value={form.previousExperience}
                    onChange={(e) => update('previousExperience', e.target.value)}
                    placeholder="Si oui, citez les événements auxquels vous avez participé. Laissez vide si aucune." />
                </div>

                <div>
                  <label className={labelCls}>Taille T-shirt<span className="text-[#C42826] ms-0.5">*</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {TSHIRT_SIZES.map((sz) => (
                      <button key={sz} type="button"
                        onClick={() => update('tshirtSize', sz)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition cursor-pointer ${
                          form.tshirtSize === sz
                            ? 'bg-[#C42826] text-white border-[#C42826]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}>{sz}</button>
                    ))}
                  </div>
                  <FieldError name="tshirtSize" />
                </div>
              </div>
            </section>

            {/* Emergency contact */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={AlertTriangle} title="Contact d'urgence" />
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Nom et lien (parent, conjoint…)<span className="text-[#C42826] ms-0.5">*</span></label>
                  <input className={fieldErrors.emergencyContactName ? inputErrCls : inputCls} required
                    placeholder="Ex : Karim BENALI — Frère"
                    value={form.emergencyContactName}
                    onChange={(e) => update('emergencyContactName', e.target.value)} />
                  <FieldError name="emergencyContactName" />
                </div>
                <div>
                  <label className={labelCls}>Téléphone d'urgence<span className="text-[#C42826] ms-0.5">*</span></label>
                  <div className="flex gap-2">
                    <div className="w-52">
                      <Select styles={selectStyles} options={phoneOptions}
                        value={phoneOptions.find((p) => p.value === form.emergencyContactPhoneCountryCode) || null}
                        onChange={(opt) => update('emergencyContactPhoneCountryCode', opt?.value || '+213')}
                        filterOption={(opt, input) => opt.data.textLabel.toLowerCase().includes(input.toLowerCase())} isSearchable />
                    </div>
                    <input type="tel" className={fieldErrors.emergencyContactPhoneNumber ? inputErrCls : inputCls} required
                      placeholder="6XX XXX XXX" value={form.emergencyContactPhoneNumber}
                      onChange={(e) => update('emergencyContactPhoneNumber', e.target.value)} />
                  </div>
                  <FieldError name="emergencyContactPhoneNumber" />
                </div>
              </div>
            </section>

            {/* Motivation */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={Heart} title="Motivation" />
              <textarea value={form.motivation} onChange={(e) => update('motivation', e.target.value)} rows={5}
                placeholder="Quelques mots sur votre motivation, vos disponibilités, votre expérience…"
                className={`${inputCls} resize-none`} />
            </section>

            {/* Agreements */}
            <section className="bg-white rounded-2xl border-2 border-[#C42826]/30 shadow-sm p-6 md:p-8">
              <SectionHeader icon={FileCheck} title="Engagements" />
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer rounded-lg p-3 hover:bg-gray-50">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#C42826]"
                    checked={form.agreedInstructions}
                    onChange={(e) => update('agreedInstructions', e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Je m'engage à suivre les instructions des responsables<span className="text-[#C42826] ms-0.5">*</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Respect des consignes de sécurité et d'organisation tout au long de l'événement</p>
                  </div>
                </label>
                <FieldError name="agreedInstructions" />

                <label className="flex items-start gap-3 cursor-pointer rounded-lg p-3 hover:bg-gray-50">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#C42826]"
                    checked={form.agreedBriefing}
                    onChange={(e) => update('agreedBriefing', e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Je m'engage à assister au briefing bénévole<span className="text-[#C42826] ms-0.5">*</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Présence obligatoire à la réunion d'information avant le jour de la course</p>
                  </div>
                </label>
                <FieldError name="agreedBriefing" />
              </div>
            </section>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <div className="text-center">
              <button type="submit" disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C42826] text-white px-8 py-3.5 font-semibold hover:bg-[#a82220] transition cursor-pointer disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Heart size={18} />}
                {submitting ? 'Envoi…' : 'Envoyer ma candidature'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
