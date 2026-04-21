import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { Check, X, Loader2, Ban, User, Mail, MapPin, Phone, Shirt, Trophy, FileCheck, Route, Heart, Users, Bus, Camera } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';
import { COUNTRIES_DATA, PHONE_CODES, WILAYAS, COMMUNES_MAP } from '../../data/formData';

// --- Data ---
const flagUrl = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// --- react-select custom styles ---
const phoneSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none',
    padding: '4px 0',
    backgroundColor: state.isFocused ? '#ffffff' : '#f9fafb80',
    '&:hover': { borderColor: '#C42826' },
  }),
  option: (base, state) => ({
    ...base,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
  }),
  singleValue: (base) => ({
    ...base,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }),
};

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none',
    padding: '4px 0',
    backgroundColor: state.isFocused ? '#ffffff' : undefined,
    '&:hover': { borderColor: '#C42826' },
  }),
  option: (base, state) => ({
    ...base,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
  }),
  singleValue: (base) => ({
    ...base,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }),
};

function FlagLabel({ code, label }) {
  return (
    <div className="flex items-center gap-2">
      <img src={flagUrl(code)} alt="" className="w-5 h-auto rounded-sm" />
      <span>{label}</span>
    </div>
  );
}

// --- Section header helper ---
function SectionHeader({ icon: Icon, title, color }) {
  const c = color || 'var(--brand, #C42826)';
  return (
    <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${c} 10%, transparent)` }}>
        <Icon size={18} style={{ color: c }} />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </div>
  );
}

// --- Component ---
export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);
  const emailTimeout = useRef(null);
  const [showConditions, setShowConditions] = useState(false);
  const [eventConfig, setEventConfig] = useState(null);

  const [form, setForm] = useState({
    lastName: '', firstName: '', birthDate: '', gender: '',
    nationality: '', phoneCountryCode: '+213', phoneNumber: '',
    email: '', confirmEmail: '',
    countryOfResidence: '', wilaya: '', commune: '', ville: '',
    emergencyPhoneCountryCode: '+213', emergencyPhoneNumber: '',
    tshirtSize: '', runnerLevel: '',
    declarationFit: false, declarationRules: false, declarationImage: false,
    // Optional fields
    selectedDistance: '', medicalCertificateFile: null, club: '', licenseNumber: '', bestPerformance: '',
    previousParticipations: '', shuttle: null, bloodType: '', photoPack: null,
  });
  const [fieldErrors, setFieldErrors] = useState({});

  // Build translated options inside the component so t() is available
  const genderOptions = [
    { value: 'Homme', label: t('register.genders.male') },
    { value: 'Femme', label: t('register.genders.female') },
  ];

  const eventLevels = eventConfig?.runnerLevels || ['Débutant', 'Confirmé', 'Elite'];
  const levelOptions = eventLevels.map(l => ({ value: l, label: l }));

  const countryOptions = COUNTRIES_DATA.map((c) => ({
    value: c.value,
    code: c.code,
    label: <FlagLabel code={c.code} label={t(c.i18nKey)} />,
    textLabel: t(c.i18nKey),
  }));

  const phoneOptions = PHONE_CODES.map((p) => ({
    value: p.value,
    code: p.code,
    label: <FlagLabel code={p.code} label={p.value} />,
    textLabel: `${t(p.i18nKey)} ${p.value}`,
  }));

  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((d) => {
        setEventConfig(d);
        if (!d.registrationOpen) setClosed(true);
      })
      .catch(() => setClosed(true))
      .finally(() => setLoading(false));
  }, []);

  const optFields = eventConfig?.optionalFields || {};

  const LATIN_REGEX = /^[a-zA-ZÀ-ÿ\s\-']*$/;
  const UPPERCASE_FIELDS = ['lastName', 'firstName', 'ville'];

  function update(field, value) {
    // Auto-uppercase + Latin-only for name/city fields
    if (UPPERCASE_FIELDS.includes(field)) {
      value = value.toUpperCase();
      if (value && !LATIN_REGEX.test(value)) {
        setFieldErrors((prev) => ({ ...prev, [field]: 'Lettres latines uniquement (pas d\'arabe ni de caractères spéciaux)' }));
        return;
      } else {
        setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
      }
    }
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'countryOfResidence' && value !== 'Algérie') {
        next.wilaya = ''; next.commune = '';
      }
      if (field === 'wilaya') next.commune = '';
      return next;
    });
  }

  function checkEmail(email) {
    if (!email || !email.includes('@')) { setEmailStatus(null); return; }
    setEmailStatus('checking');
    if (emailTimeout.current) clearTimeout(emailTimeout.current);
    emailTimeout.current = setTimeout(() => {
      fetch(`/api/check-email?email=${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((d) => setEmailStatus(d.available ? 'available' : 'taken'))
        .catch(() => setEmailStatus(null));
    }, 400);
  }

  function validateForm() {
    const errors = {};

    // Phone format: if +213 and starts with 0, strip it; must be 9 digits starting with 5/6/7
    if (form.phoneCountryCode === '+213') {
      const num = form.phoneNumber.replace(/^0+/, '');
      if (!/^[567]\d{8}$/.test(num)) {
        errors.phoneNumber = 'Le numéro doit contenir 9 chiffres et commencer par 5, 6 ou 7 (sans le 0)';
      }
    } else if (!form.phoneNumber || !/^\d+$/.test(form.phoneNumber)) {
      errors.phoneNumber = 'Numéro de téléphone invalide';
    }

    // Emergency phone format
    if (form.emergencyPhoneCountryCode === '+213') {
      const num = form.emergencyPhoneNumber.replace(/^0+/, '');
      if (!/^[567]\d{8}$/.test(num)) {
        errors.emergencyPhoneNumber = 'Le numéro doit contenir 9 chiffres et commencer par 5, 6 ou 7 (sans le 0)';
      }
    } else if (!form.emergencyPhoneNumber || !/^\d+$/.test(form.emergencyPhoneNumber)) {
      errors.emergencyPhoneNumber = 'Numéro de téléphone invalide';
    }

    // Emergency phone != mobile phone
    const fullPhone = form.phoneCountryCode + form.phoneNumber.replace(/^0+/, '');
    const fullEmergency = form.emergencyPhoneCountryCode + form.emergencyPhoneNumber.replace(/^0+/, '');
    if (fullPhone && fullEmergency && fullPhone === fullEmergency) {
      errors.emergencyPhoneNumber = "Le numéro d'urgence ne peut pas être identique au numéro mobile";
    }

    // Birthdate check
    if (!form.birthDate) {
      errors.birthDate = 'Date de naissance requise';
    } else {
      const birth = new Date(form.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 19) {
        errors.birthDate = 'Vous devez avoir au moins 19 ans pour participer';
      }
    }

    // Required fields
    if (!form.lastName) errors.lastName = 'Nom requis';
    if (!form.firstName) errors.firstName = 'Prénom requis';

    // Required dropdowns
    if (!form.nationality) errors.nationality = 'Veuillez choisir votre nationalité';
    if (!form.gender) errors.gender = 'Veuillez choisir votre genre';
    if (!form.countryOfResidence) errors.countryOfResidence = 'Veuillez choisir votre pays de résidence';
    if (!form.tshirtSize) errors.tshirtSize = 'Veuillez choisir une taille';
    if (!form.runnerLevel) errors.runnerLevel = 'Veuillez choisir votre niveau';

    if (form.email !== form.confirmEmail) {
      errors.confirmEmail = t('register.errors.emailMismatch');
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Client-side validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Veuillez corriger les erreurs ci-dessous');
      return;
    }

    if (!form.declarationFit || !form.declarationRules || !form.declarationImage) {
      setError(t('register.errors.declarationsRequired')); return;
    }
    if (emailStatus === 'taken') {
      setError(t('register.errors.emailTaken')); return;
    }

    // Strip leading 0 from phone numbers before submitting
    const submitData = {
      ...form,
      phoneNumber: form.phoneNumber.replace(/^0+/, ''),
      emergencyPhoneNumber: form.emergencyPhoneNumber.replace(/^0+/, ''),
    };
    // Remove file object from JSON payload (uploaded separately)
    const medicalFile = submitData.medicalCertificateFile;
    delete submitData.medicalCertificateFile;

    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || t('register.errors.generic'));
      }
      const data = await res.json();

      // Upload medical certificate if present
      if (medicalFile) {
        const fd = new FormData();
        fd.append('medicalCertificate', medicalFile);
        await fetch(`/api/registration/${data.registrationId}/upload-certificate`, {
          method: 'POST',
          body: fd,
        }).catch(() => {}); // non-blocking
      }

      navigate(`/recap?id=${data.registrationId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout title={t('register.title')}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#C42826]" size={32} />
        </div>
      </PublicLayout>
    );
  }

  if (closed) {
    return (
      <PublicLayout title={t('register.title')}>
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <Ban size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('register.closedTitle')}</h1>
            <p className="text-gray-600">{t('register.closedMessage')}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const communes = (COMMUNES_MAP[form.wilaya] || []).map((c) => ({ value: c, label: c }));
  const isAlgeria = form.countryOfResidence === 'Algérie';

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 focus:bg-white transition';
  const inputErrCls = 'w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const FieldError = ({ name }) => fieldErrors[name] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[name]}</p> : null;

  return (
    <PublicLayout title={t('register.title')}>
      <div className="py-10 px-4">
      <div className="max-w-3xl mx-auto">

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={User} title={t('register.sections.personal')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('register.fields.lastName')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <input className={fieldErrors.lastName ? inputErrCls : inputCls} required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                <FieldError name="lastName" />
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.firstName')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <input className={fieldErrors.firstName ? inputErrCls : inputCls} required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                <FieldError name="firstName" />
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.birthDate')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <BirthDatePicker
                  value={form.birthDate}
                  onChange={(v) => update('birthDate', v)}
                  error={fieldErrors.birthDate}
                />
                <FieldError name="birthDate" />
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.gender')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <Select
                  styles={selectStyles}
                  options={genderOptions}
                  value={genderOptions.find((g) => g.value === form.gender) || null}
                  onChange={(opt) => update('gender', opt?.value || '')}
                  placeholder={t('common.choose')}
                  isClearable
                />
                <FieldError name="gender" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>{t('register.fields.nationality')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <Select
                  styles={selectStyles}
                  options={countryOptions}
                  value={countryOptions.find((c) => c.value === form.nationality) || null}
                  onChange={(opt) => update('nationality', opt?.value || '')}
                  placeholder={t('common.choose')}
                  filterOption={(option, input) => option.data.textLabel.toLowerCase().includes(input.toLowerCase())}
                />
                <FieldError name="nationality" />
              </div>
            </div>
          </section>

          {/* Contact & E-mail */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={Mail} title={t('register.sections.contact')} />
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{t('register.fields.phone')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <div className="flex gap-2">
                  <div className="w-52">
                    <Select
                      styles={phoneSelectStyles}
                      options={phoneOptions}
                      value={phoneOptions.find((p) => p.value === form.phoneCountryCode) || null}
                      onChange={(opt) => update('phoneCountryCode', opt?.value || '+213')}
                      filterOption={(option, input) => option.data.textLabel.toLowerCase().includes(input.toLowerCase())}
                      isSearchable
                    />
                  </div>
                  <input type="tel" className={fieldErrors.phoneNumber ? inputErrCls : inputCls} required placeholder={t('register.placeholders.phone')} value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} />
                  <FieldError name="phoneNumber" />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.email')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <div className="relative">
                  <input type="email" className={inputCls} required value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    onBlur={() => checkEmail(form.email)}
                  />
                  {emailStatus === 'checking' && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={18} />}
                  {emailStatus === 'available' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={20} />}
                  {emailStatus === 'taken' && <X className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={20} />}
                </div>
                {emailStatus === 'taken' && <p className="text-red-500 text-xs mt-1">{t('register.errors.emailTaken')}</p>}
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.confirmEmail')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <input type="email" className={inputCls} required value={form.confirmEmail}
                  onChange={(e) => update('confirmEmail', e.target.value)}
                />
                {form.confirmEmail && form.email !== form.confirmEmail && (
                  <p className="text-red-500 text-xs mt-1">{t('register.errors.emailMismatch')}</p>
                )}
              </div>
            </div>
          </section>

          {/* Residence */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={MapPin} title={t('register.sections.residence')} />
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{t('register.fields.country')}<span className="text-[#C42826] ms-0.5">*</span></label>
                <Select
                  styles={selectStyles}
                  options={countryOptions}
                  value={countryOptions.find((c) => c.value === form.countryOfResidence) || null}
                  onChange={(opt) => update('countryOfResidence', opt?.value || '')}
                  placeholder={t('common.choose')}
                  filterOption={(option, input) => option.data.textLabel.toLowerCase().includes(input.toLowerCase())}
                />
                <FieldError name="countryOfResidence" />
              </div>
              {isAlgeria && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t('register.fields.wilaya')}<span className="text-[#C42826] ms-0.5">*</span></label>
                    <Select
                      styles={selectStyles}
                      options={WILAYAS}
                      value={WILAYAS.find((w) => w.value === form.wilaya) || null}
                      onChange={(opt) => update('wilaya', opt?.value || '')}
                      placeholder={t('common.choose')}
                      isSearchable
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('register.fields.commune')}<span className="text-[#C42826] ms-0.5">*</span></label>
                    <Select
                      styles={selectStyles}
                      options={communes}
                      value={communes.find((c) => c.value === form.commune) || null}
                      onChange={(opt) => update('commune', opt?.value || '')}
                      placeholder={t('common.choose')}
                      isSearchable
                      noOptionsMessage={() => form.wilaya ? t('register.placeholders.enterName') : t('register.placeholders.selectWilaya')}
                    />
                  </div>
                </div>
              )}
              {!isAlgeria && (
                <div>
                  <label className={labelCls}>{t('register.fields.city')}<span className="text-[#C42826] ms-0.5">*</span></label>
                  <input className={fieldErrors.ville ? inputErrCls : inputCls} required={!isAlgeria} value={form.ville} onChange={(e) => update('ville', e.target.value)} placeholder={t('register.placeholders.city')} />
                  <FieldError name="ville" />
                </div>
              )}
            </div>
          </section>

          {/* Emergency */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={Phone} title={t('register.sections.emergency')} />
            <div>
              <label className={labelCls}>{t('register.fields.emergencyPhone')}<span className="text-[#C42826] ms-0.5">*</span></label>
              <div className="flex gap-2">
                <div className="w-52">
                  <Select
                    styles={phoneSelectStyles}
                    options={phoneOptions}
                    value={phoneOptions.find((p) => p.value === form.emergencyPhoneCountryCode) || null}
                    onChange={(opt) => update('emergencyPhoneCountryCode', opt?.value || '+213')}
                    filterOption={(option, input) => option.data.textLabel.toLowerCase().includes(input.toLowerCase())}
                    isSearchable
                  />
                </div>
                <input type="tel" className={fieldErrors.emergencyPhoneNumber ? inputErrCls : inputCls} required placeholder={t('register.placeholders.emergencyPhone')} value={form.emergencyPhoneNumber} onChange={(e) => update('emergencyPhoneNumber', e.target.value)} />
                <FieldError name="emergencyPhoneNumber" />
              </div>
            </div>
          </section>

          {/* T-shirt */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={Shirt} title={t('register.sections.tshirt')} />
            <div>
              <label className={labelCls}>{t('register.fields.tshirtSize')}<span className="text-[#C42826] ms-0.5">*</span></label>
              <div className="flex flex-wrap gap-3 mt-1">
                {TSHIRT_SIZES.map((size) => (
                  <button type="button" key={size} onClick={() => update('tshirtSize', size)}
                    className={`px-5 py-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                      form.tshirtSize === size
                        ? 'bg-[#C42826] text-white border-[#C42826] shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#C42826]/30 hover:bg-[#C42826]/5'
                    }`}
                  >{size}</button>
                ))}
              </div>
              <FieldError name="tshirtSize" />
            </div>
          </section>

          {/* Level */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={Trophy} title={t('register.sections.level')} />
            <div>
              <label className={labelCls}>{t('register.fields.level')}<span className="text-[#C42826] ms-0.5">*</span></label>
              <Select
                styles={selectStyles}
                options={levelOptions}
                value={levelOptions.find((l) => l.value === form.runnerLevel) || null}
                onChange={(opt) => update('runnerLevel', opt?.value || '')}
                placeholder={t('common.choose')}
              />
              <FieldError name="runnerLevel" />
            </div>
          </section>

          {/* Dynamic Optional Fields */}
          {Object.values(optFields).some(v => v && v !== 'off') && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={Route} title="Informations complémentaires" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Distance */}
                {optFields.distance && optFields.distance !== 'off' && eventConfig?.distances?.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distance {optFields.distance === 'required' && <span className="text-red-500">*</span>}
                      {optFields.distance === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <Select
                      options={eventConfig.distances.map(d => ({
                        value: d.name,
                        label: `${d.name}${d.elevation ? ` — ${d.elevation}` : ''}${d.timeLimit ? ` (${d.timeLimit})` : ''}`,
                      }))}
                      value={form.selectedDistance ? { value: form.selectedDistance, label: form.selectedDistance } : null}
                      onChange={(opt) => update('selectedDistance', opt?.value || '')}
                      placeholder="Choisir une distance..."
                      isClearable
                    />
                  </div>
                )}

                {/* Medical Certificate */}
                {optFields.medicalCertificate && optFields.medicalCertificate !== 'off' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Certificat médical {optFields.medicalCertificate === 'required' && <span className="text-red-500">*</span>}
                      {optFields.medicalCertificate === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-[#C42826]/30 transition">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="medical-cert-upload"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            update('medicalCertificateFile', file);
                          }
                        }}
                      />
                      {form.medicalCertificateFile ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FileCheck size={16} className="text-green-600" />
                            <span>{form.medicalCertificateFile.name}</span>
                            <span className="text-xs text-gray-400">({(form.medicalCertificateFile.size / 1024).toFixed(0)} Ko)</span>
                          </div>
                          <button type="button" onClick={() => update('medicalCertificateFile', null)} className="text-xs text-red-500 hover:underline cursor-pointer">
                            Supprimer
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="medical-cert-upload" className="flex flex-col items-center gap-1 cursor-pointer">
                          <FileCheck size={24} className="text-gray-300" />
                          <span className="text-xs text-[#C42826]">Choisir un fichier</span>
                          <span className="text-[10px] text-gray-400">PDF, JPG ou PNG (max 5 Mo)</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Club */}
                {optFields.club && optFields.club !== 'off' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Club / Équipe {optFields.club === 'required' && <span className="text-red-500">*</span>}
                      {optFields.club === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/80 focus:bg-white focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 outline-none transition"
                      value={form.club} onChange={(e) => update('club', e.target.value.toUpperCase())} />
                  </div>
                )}

                {/* License Number */}
                {optFields.licenseNumber && optFields.licenseNumber !== 'off' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro de licence {optFields.licenseNumber === 'required' && <span className="text-red-500">*</span>}
                      {optFields.licenseNumber === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/80 focus:bg-white focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 outline-none transition"
                      value={form.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} />
                  </div>
                )}

                {/* Best Performance */}
                {optFields.bestPerformance && optFields.bestPerformance !== 'off' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meilleure performance {optFields.bestPerformance === 'required' && <span className="text-red-500">*</span>}
                      {optFields.bestPerformance === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <input type="text" placeholder="H:MM:SS" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/80 focus:bg-white focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 outline-none transition"
                      value={form.bestPerformance} onChange={(e) => update('bestPerformance', e.target.value)} />
                  </div>
                )}

                {/* Previous Participations */}
                {optFields.previousParticipations && optFields.previousParticipations !== 'off' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Participations précédentes {optFields.previousParticipations === 'required' && <span className="text-red-500">*</span>}
                      {optFields.previousParticipations === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <input type="number" min="0" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/80 focus:bg-white focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/10 outline-none transition"
                      value={form.previousParticipations} onChange={(e) => update('previousParticipations', e.target.value)} />
                  </div>
                )}

                {/* Blood Type */}
                {optFields.bloodType && optFields.bloodType !== 'off' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Groupe sanguin {optFields.bloodType === 'required' && <span className="text-red-500">*</span>}
                      {optFields.bloodType === 'optional' && <span className="text-gray-400 text-xs ml-1">(optionnel)</span>}
                    </label>
                    <Select
                      options={['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => ({ value: v, label: v }))}
                      value={form.bloodType ? { value: form.bloodType, label: form.bloodType } : null}
                      onChange={(opt) => update('bloodType', opt?.value || '')}
                      placeholder="Choisir..."
                      isClearable
                    />
                  </div>
                )}

                {/* Shuttle Transport */}
                {optFields.shuttle && optFields.shuttle !== 'off' && (
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]"
                      checked={form.shuttle === true}
                      onChange={(e) => update('shuttle', e.target.checked)} />
                    <label className="text-sm text-gray-700">
                      Navette transport
                      {optFields.shuttle === 'required' && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>
                )}

                {/* Photo Pack */}
                {optFields.photoPack && optFields.photoPack !== 'off' && (
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]"
                      checked={form.photoPack === true}
                      onChange={(e) => update('photoPack', e.target.checked)} />
                    <label className="text-sm text-gray-700">
                      Pack photo / vidéo
                      {optFields.photoPack === 'required' && <span className="text-red-500 ml-1">*</span>}
                      {eventConfig?.photoPackPrice && (
                        <span className="text-xs text-gray-500 ml-1">(+{(eventConfig.photoPackPrice / 100).toLocaleString('fr-FR')} DZD)</span>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Declarations */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <SectionHeader icon={FileCheck} title={t('register.sections.declarations')} />
            <div className="space-y-3">
              <div
                className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer"
                onClick={() => { if (!form.declarationFit) setShowConditions(true); else update('declarationFit', false); }}
              >
                <input type="checkbox" readOnly className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826] pointer-events-none" checked={form.declarationFit} />
                <span className="text-sm text-gray-700">{t('register.declarations.fit')}<span className="text-[#C42826] ms-0.5">*</span></span>
              </div>
              <label className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]" checked={form.declarationRules} onChange={(e) => update('declarationRules', e.target.checked)} />
                <span className="text-sm text-gray-700">{t('register.declarations.rules')}<span className="text-[#C42826] ms-0.5">*</span></span>
              </label>
              <label className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]" checked={form.declarationImage} onChange={(e) => update('declarationImage', e.target.checked)} />
                <span className="text-sm text-gray-700">{t('register.declarations.image')}<span className="text-[#C42826] ms-0.5">*</span></span>
              </label>
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {/* Submit */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <button type="submit" disabled={submitting}
              style={{ backgroundColor: eventConfig?.primaryColor || '#C42826' }}
              className="w-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition shadow-md hover:shadow-lg cursor-pointer"
            >
              {submitting ? t('register.submitting') : t('register.submit')}
            </button>
          </section>
        </form>
      </div>
      </div>

      {/* Conditions Modal */}
      {showConditions && (
        <ConditionsModal
          termsHtml={eventConfig?.termsText}
          onAccept={() => { update('declarationFit', true); setShowConditions(false); }}
          onDecline={() => setShowConditions(false)}
        />
      )}
    </PublicLayout>
  );
}

/* --- Conditions de Participation Modal --- */
function ConditionsModal({ termsHtml, onAccept, onDecline }) {
  const [canAccept, setCanAccept] = useState(false);
  const contentRef = useRef(null);

  const handleScroll = () => {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setCanAccept(true);
    }
  };

  // If termsText is short or no scroll needed, enable accept immediately
  useEffect(() => {
    const el = contentRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 20) {
      setCanAccept(true);
    }
  }, [termsHtml]);

  const hasCustomTerms = termsHtml && termsHtml.trim() && termsHtml !== '<p><br></p>';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDecline} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 text-center">
          <h3 className="text-xl font-bold text-gray-900">Règlement de l'événement</h3>
          <p className="text-sm text-gray-500 mt-1">Lisez jusqu'en bas pour activer le bouton Accepter</p>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 text-sm text-gray-700 leading-relaxed space-y-5"
        >
          {hasCustomTerms ? (
            /* Admin-defined rich text rules */
            <div className="prose prose-sm max-w-none break-words prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-a:text-[#C42826]"
              dangerouslySetInnerHTML={{ __html: termsHtml }} />
          ) : (
            /* Fallback: hardcoded TMO rules */
            <>
              <Article title="Article 1 -- Informations generales">
                <p>La Ligue Algéroise de Ski et des Sports de Montagne (LASSM) a le plaisir de vous inviter à la 3ᵉ édition du Trail des Mouflons d'Or, organisée sous le parrainage de Monsieur le Ministre Wali d'Alger et sous l'égide de la Direction de la Jeunesse, des Sports et des Loisirs de la Wilaya d'Alger, à l'occasion du Festival d'Alger des Sports.</p>
                <p>Le Trail des Mouflons d'Or est une épreuve de course nature se déroulant en milieu naturel, sur un parcours exigeant et vallonné au cœur du Parc Zoologique de Ben Aknoun (entrée Village Africain).</p>
                <p className="font-medium">Informations principales :</p>
                <ul className="list-disc list-inside space-y-1 ps-2">
                  <li>Date : 1er mai 2026</li>
                  <li>Accueil des participants : à partir de 06h00</li>
                  <li>Départ de la course : 08h00</li>
                  <li>Distance : 16,57 km</li>
                  <li>Dénivelé positif : 443 m D+</li>
                </ul>
              </Article>

              <Article title="Article 2 -- Inscriptions / Tarifs / Annulation / Dossard">
                <p><strong>2.1 – Inscriptions</strong><br/>Les inscriptions sont ouvertes dès la publication officielle de l'événement. L'inscription se fait exclusivement en ligne via la plateforme officielle : www.tmo.lassm.dz</p>
                <p><strong>2.2 – Procédure d'inscription</strong><br/>Pour valider son inscription, chaque participant doit :</p>
                <ol className="list-decimal list-inside space-y-1 ps-2">
                  <li>Remplir le formulaire d'inscription en renseignant ses informations personnelles ;</li>
                  <li>Déclarer sur l'honneur être physiquement apte à participer ;</li>
                  <li>Lire et accepter intégralement le présent règlement ;</li>
                  <li>Confirmer son inscription ;</li>
                  <li>Procéder au paiement en ligne par carte CIB.</li>
                </ol>
                <p><strong>2.3 – Informations de paiement</strong><br/>Titulaire : Ligue Algéroise de Ski et des Sports de Montagne<br/>Domiciliation : Agence Belahdjel, 24 Rue Hocine Belahdjel, Alger</p>
                <p><strong>2.4 – Tarif</strong><br/>2 000 DA par participant</p>
                <p><strong>2.5 – Conditions d'annulation</strong><br/>Toute inscription est ferme, définitive et non remboursable. Aucun remboursement ne sera effectué, quel qu'en soit le motif.</p>
                <p><strong>2.6 – Conditions obligatoires</strong><br/>La participation sans inscription est strictement interdite. Il est interdit de céder ou prêter son dossard. Toute usurpation entraîne une disqualification immédiate.</p>
                <p><strong>2.7 – Dossard</strong><br/>Le dossard doit être porté de manière visible sur la poitrine, fixé avec 4 épingles, et conservé en bon état.</p>
              </Article>

              <Article title="Article 3 -- Remise des dossards">
                <p>Le lieu et les horaires de retrait seront communiqués sur www.lassm.dz et les réseaux sociaux. Le retrait se fait sur présentation d'une pièce d'identité. Aucun dossard ne sera remis le jour de la course, sauf décision exceptionnelle.</p>
              </Article>

              <Article title="Article 4 -- L'epreuve sportive">
                <p>Distance : 16,57 km — 443 m D+<br/>Départ et arrivée : Parc Zoologique de Ben Aknoun – entrée Village Africain<br/>Regroupement : 06h00 — Départ : 08h00<br/>Âge minimum : 19 ans</p>
                <p>L'organisation se réserve le droit de modifier la date, le lieu, le parcours, l'horaire, ou d'annuler l'événement. Ces situations ne donnent lieu à aucune indemnisation.</p>
              </Article>

              <Article title="Article 5 -- Respect de l'environnement">
                <p>Il est strictement interdit de jeter des bouteilles d'eau, emballages, mégots ou tout autre déchet sur le parcours. Sanction : disqualification immédiate.</p>
              </Article>

              <Article title="Article 6 -- Materiel obligatoire">
                <ul className="list-disc list-inside space-y-1 ps-2">
                  <li>Téléphone portable chargé et opérationnel</li>
                  <li>Réserve d'eau d'au moins 1 litre</li>
                  <li>Chaussures adaptées au trail</li>
                  <li>Dossard officiel correctement porté</li>
                </ul>
              </Article>

              <Article title="Article 7 -- Parcours et signalisation">
                <p>2 points de ravitaillement (km 6,30 et km 10,70), des points de contrôle obligatoires. Barrière horaire : 3h00 à l'arrivée.</p>
              </Article>

              <Article title="Article 8 -- Securite et assistance">
                <p>Chaque participant est responsable de sa propre sécurité. Tout participant a l'obligation de porter assistance à une personne en difficulté. Ne jamais laisser une personne blessée seule.</p>
              </Article>

              <Article title="Article 9 -- Droit a l'image">
                <p>Chaque participant autorise la LASSM à photographier, filmer, enregistrer et diffuser son image dans le cadre de l'événement, à titre gratuit.</p>
              </Article>

              <Article title="Article 10 -- Donnees personnelles">
                <p>Les données collectées sont utilisées exclusivement pour la gestion des inscriptions, l'organisation et la communication liée à la course.</p>
              </Article>

              <Article title="Article 11 -- Service consigne">
                <p>Un service de consigne sera disponible à partir de 06h00. L'organisation ne peut être tenue responsable en cas de perte, vol ou détérioration.</p>
              </Article>

              <Article title="Article 12 -- Aptitude physique et acceptation des risques">
                <p>En validant son inscription, chaque participant reconnaît et accepte :</p>
                <ol className="list-decimal list-inside space-y-1 ps-2">
                  <li>Être en bonne condition physique et apte à participer ;</li>
                  <li>Participer sous sa propre responsabilité ;</li>
                  <li>Assumer l'entière responsabilité de son état de santé et de sa préparation ;</li>
                  <li>Attester qu'aucune contre-indication médicale ne l'empêche de participer ;</li>
                  <li>Reconnaître qu'il lui appartient de consulter un médecin si nécessaire ;</li>
                  <li>Reconnaître que l'organisateur ne pourra être tenu responsable d'un incident résultant d'une pathologie préexistante ;</li>
                  <li>Accepter que l'organisation puisse refuser le départ de tout participant présentant un risque.</li>
                </ol>
              </Article>

              <Article title="Article 13 -- Assurance">
                <p>L'organisation est couverte par une assurance responsabilité civile. Il appartient à chaque participant de vérifier sa couverture personnelle. L'organisation recommande vivement de souscrire une assurance individuelle accident.</p>
              </Article>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onDecline}
            className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            Décliner
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            style={{ backgroundColor: 'var(--brand, #C42826)' }}
            className="rounded-xl px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}

function Article({ title, children }) {
  return (
    <div>
      <h4 className="font-bold text-gray-900 mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

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
  }, []);

  const updateDate = (d, m, y) => {
    if (d?.value && m?.value && y?.value) {
      onChange(`${y.value}-${m.value.padStart(2, '0')}-${d.value.padStart(2, '0')}`);
    }
  };

  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 80 }, (_, i) => {
    const y = currentYear - 19 - i;
    return { value: String(y), label: String(y) };
  });

  const dateSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: '0.75rem',
      borderColor: error ? '#fca5a5' : state.isFocused ? '#C42826' : '#e5e7eb',
      backgroundColor: error ? 'rgba(254,242,242,0.3)' : '#fafafa',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none',
      padding: '4px 0',
      '&:hover': { borderColor: '#C42826' },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
      color: state.isSelected ? 'white' : '#1f2937',
      fontSize: '0.875rem',
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

const monthOptions = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' }, { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];
