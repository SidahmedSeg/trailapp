import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { Loader2, AlertCircle, CreditCard, User, Mail, MapPin, Phone, Shirt, Trophy, FileCheck, ShieldCheck } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';
import { COUNTRIES_DATA, PHONE_CODES, WILAYAS, COMMUNES_MAP } from '../../data/formData';

const flagUrl = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const phoneSelectStyles = {
  control: (base, state) => ({ ...base, borderRadius: '0.75rem', borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none', padding: '4px 0',
    backgroundColor: state.isFocused ? '#ffffff' : '#f9fafb80', '&:hover': { borderColor: '#C42826' } }),
  option: (base, state) => ({ ...base, display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937' }),
  singleValue: (base) => ({ ...base, display: 'flex', alignItems: 'center', gap: '8px' }),
};

const selectStyles = {
  control: (base, state) => ({ ...base, borderRadius: '0.75rem', borderColor: state.isFocused ? '#C42826' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none', padding: '4px 0',
    '&:hover': { borderColor: '#C42826' } }),
  option: (base, state) => ({ ...base, display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
    color: state.isSelected ? 'white' : '#1f2937' }),
  singleValue: (base) => ({ ...base, display: 'flex', alignItems: 'center', gap: '8px' }),
};

function FlagLabel({ code, label }) {
  return (<div className="flex items-center gap-2">
    <img src={flagUrl(code)} alt="" className="w-5 h-auto rounded-sm" /><span>{label}</span>
  </div>);
}

function SectionHeader({ icon: Icon, title }) {
  return (<div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#C42826]/10">
      <Icon size={18} className="text-[#C42826]" />
    </div>
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
  </div>);
}

const monthOptions = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' }, { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

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
    control: (base, state) => ({ ...base, borderRadius: '0.75rem',
      borderColor: error ? '#fca5a5' : state.isFocused ? '#C42826' : '#e5e7eb',
      backgroundColor: error ? 'rgba(254,242,242,0.3)' : '#fafafa',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.1)' : 'none', padding: '4px 0' }),
    option: (base, state) => ({ ...base, backgroundColor: state.isSelected ? '#C42826' : state.isFocused ? '#fde8e8' : 'white',
      color: state.isSelected ? 'white' : '#1f2937', fontSize: '0.875rem' }),
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

export default function ReconciliationRegister() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    lastName: '', firstName: '', birthDate: '', gender: '',
    nationality: '', phoneCountryCode: '+213', phoneNumber: '',
    email: '',
    countryOfResidence: '', wilaya: '', commune: '', ville: '',
    emergencyPhoneCountryCode: '+213', emergencyPhoneNumber: '',
    tshirtSize: '', runnerLevel: '',
    declarationFit: false, declarationRules: false, declarationImage: false,
    enteredCardPan: '',
  });

  useEffect(() => {
    fetch(`/api/reconciliation/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message || 'Lien invalide');
        return json;
      })
      .then((d) => { setTokenData(d); })
      .catch((err) => { setTokenError(err.message); })
      .finally(() => setLoading(false));
  }, [token]);

  const event = tokenData?.event;
  const eventLevels = event?.runnerLevels || ['Débutant', 'Confirmé', 'Elite'];

  const genderOptions = [
    { value: 'Homme', label: 'Homme' }, { value: 'Femme', label: 'Femme' },
  ];
  const levelOptions = eventLevels.map((l) => ({ value: l, label: l }));
  const countryOptions = COUNTRIES_DATA.map((c) => ({
    value: c.value, code: c.code,
    label: <FlagLabel code={c.code} label={c.value} />, textLabel: c.value,
  }));
  const phoneOptions = PHONE_CODES.map((p) => ({
    value: p.value, code: p.code,
    label: <FlagLabel code={p.code} label={p.value} />, textLabel: `${p.value}`,
  }));

  const LATIN_REGEX = /^[a-zA-ZÀ-ÿ\s\-']*$/;
  const UPPERCASE_FIELDS = ['lastName', 'firstName', 'ville'];

  function update(field, value) {
    if (UPPERCASE_FIELDS.includes(field)) {
      value = (value || '').toUpperCase();
      if (value && !LATIN_REGEX.test(value)) {
        setFieldErrors((p) => ({ ...p, [field]: "Lettres latines uniquement" }));
        return;
      } else {
        setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
      }
    }
    if (field === 'enteredCardPan') {
      value = String(value).replace(/\D/g, '').slice(0, 4);
    }
    setForm((p) => {
      const n = { ...p, [field]: value };
      if (field === 'countryOfResidence' && value !== 'Algérie') { n.wilaya = ''; n.commune = ''; }
      if (field === 'wilaya') n.commune = '';
      return n;
    });
  }

  function validateForm() {
    const errs = {};
    if (!form.lastName) errs.lastName = 'Nom requis';
    if (!form.firstName) errs.firstName = 'Prénom requis';
    if (!form.gender) errs.gender = 'Genre requis';
    if (!form.nationality) errs.nationality = 'Nationalité requise';
    if (!form.countryOfResidence) errs.countryOfResidence = 'Pays de résidence requis';
    if (!form.tshirtSize) errs.tshirtSize = 'Taille requise';
    if (!form.runnerLevel) errs.runnerLevel = 'Niveau requis';
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Email invalide';

    if (!form.birthDate) {
      errs.birthDate = 'Date de naissance requise';
    } else {
      const birth = new Date(form.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) errs.birthDate = "Vous devez avoir au moins 18 ans";
    }

    if (form.phoneCountryCode === '+213') {
      const num = form.phoneNumber.replace(/^0+/, '');
      if (!/^[567]\d{8}$/.test(num)) errs.phoneNumber = '9 chiffres, démarrant par 5/6/7 (sans le 0)';
    } else if (!form.phoneNumber || !/^\d+$/.test(form.phoneNumber)) {
      errs.phoneNumber = 'Numéro invalide';
    }
    if (form.emergencyPhoneCountryCode === '+213') {
      const num = form.emergencyPhoneNumber.replace(/^0+/, '');
      if (!/^[567]\d{8}$/.test(num)) errs.emergencyPhoneNumber = '9 chiffres, démarrant par 5/6/7 (sans le 0)';
    } else if (!form.emergencyPhoneNumber || !/^\d+$/.test(form.emergencyPhoneNumber)) {
      errs.emergencyPhoneNumber = 'Numéro invalide';
    }

    const fullPhone = form.phoneCountryCode + form.phoneNumber.replace(/^0+/, '');
    const fullEmer = form.emergencyPhoneCountryCode + form.emergencyPhoneNumber.replace(/^0+/, '');
    if (fullPhone === fullEmer) errs.emergencyPhoneNumber = "Le numéro d'urgence ne peut pas être identique au mobile";

    if (form.countryOfResidence === 'Algérie') {
      if (!form.wilaya) errs.wilaya = 'Wilaya requise';
      if (!form.commune) errs.commune = 'Commune requise';
    } else if (!form.ville) {
      errs.ville = 'Ville requise';
    }

    if (!form.enteredCardPan || form.enteredCardPan.length !== 4) {
      errs.enteredCardPan = 'Les 4 derniers chiffres de votre carte';
    }

    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Veuillez corriger les champs en rouge');
      return;
    }
    if (!form.declarationFit || !form.declarationRules || !form.declarationImage) {
      setError('Vous devez accepter toutes les déclarations');
      return;
    }

    // Stash form for the recap page
    sessionStorage.setItem(`reconciliation_form_${token}`, JSON.stringify(form));
    navigate(`/reconciliation/${token}/recap`);
  }

  if (loading) {
    return (
      <PublicLayout title="Réconciliation" event={null}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#C42826]" size={32} />
        </div>
      </PublicLayout>
    );
  }

  if (tokenError) {
    return (
      <PublicLayout title="Réconciliation" event={null}>
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Lien invalide</h1>
            <p className="text-gray-600 mb-1">{tokenError}</p>
            <p className="text-gray-500 text-sm mt-4">Contactez l'organisation pour obtenir un nouveau lien.</p>
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
    <PublicLayout title="Finalisation d'inscription" event={event}>
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Reconciliation banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
            <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={22} />
            <div>
              <p className="font-semibold text-emerald-800 mb-1">
                Paiement confirmé — finalisez votre inscription
              </p>
              <p className="text-sm text-emerald-700">
                Nous avons retrouvé votre paiement avec la carte se terminant par <strong>****{tokenData.cardPan}</strong>.
                Aucun nouveau paiement n'est nécessaire — remplissez simplement le formulaire ci-dessous pour recevoir votre dossard.
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
                  <label className={labelCls}>Date de naissance<span className="text-[#C42826] ms-0.5">*</span></label>
                  <BirthDatePicker value={form.birthDate} onChange={(v) => update('birthDate', v)} error={fieldErrors.birthDate} />
                  <FieldError name="birthDate" />
                </div>
                <div>
                  <label className={labelCls}>Genre<span className="text-[#C42826] ms-0.5">*</span></label>
                  <Select styles={selectStyles} options={genderOptions}
                    value={genderOptions.find((g) => g.value === form.gender) || null}
                    onChange={(opt) => update('gender', opt?.value || '')} placeholder="Choisir" isClearable />
                  <FieldError name="gender" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nationalité<span className="text-[#C42826] ms-0.5">*</span></label>
                  <Select styles={selectStyles} options={countryOptions}
                    value={countryOptions.find((c) => c.value === form.nationality) || null}
                    onChange={(opt) => update('nationality', opt?.value || '')} placeholder="Choisir"
                    filterOption={(opt, input) => opt.data.textLabel.toLowerCase().includes(input.toLowerCase())} />
                  <FieldError name="nationality" />
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
                      <Select styles={phoneSelectStyles} options={phoneOptions}
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

            {/* Residence */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={MapPin} title="Lieu de résidence" />
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Pays<span className="text-[#C42826] ms-0.5">*</span></label>
                  <Select styles={selectStyles} options={countryOptions}
                    value={countryOptions.find((c) => c.value === form.countryOfResidence) || null}
                    onChange={(opt) => update('countryOfResidence', opt?.value || '')} placeholder="Choisir"
                    filterOption={(opt, input) => opt.data.textLabel.toLowerCase().includes(input.toLowerCase())} />
                  <FieldError name="countryOfResidence" />
                </div>
                {isAlgeria ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Wilaya<span className="text-[#C42826] ms-0.5">*</span></label>
                      <Select styles={selectStyles} options={WILAYAS}
                        value={WILAYAS.find((w) => w.value === form.wilaya) || null}
                        onChange={(opt) => update('wilaya', opt?.value || '')} placeholder="Choisir" isSearchable />
                      <FieldError name="wilaya" />
                    </div>
                    <div>
                      <label className={labelCls}>Commune<span className="text-[#C42826] ms-0.5">*</span></label>
                      <Select styles={selectStyles} options={communes}
                        value={communes.find((c) => c.value === form.commune) || null}
                        onChange={(opt) => update('commune', opt?.value || '')} placeholder="Choisir" isSearchable
                        noOptionsMessage={() => form.wilaya ? 'Aucune commune' : 'Choisissez une wilaya d\'abord'} />
                      <FieldError name="commune" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Ville<span className="text-[#C42826] ms-0.5">*</span></label>
                    <input className={fieldErrors.ville ? inputErrCls : inputCls} required
                      value={form.ville} onChange={(e) => update('ville', e.target.value)} placeholder="Votre ville" />
                    <FieldError name="ville" />
                  </div>
                )}
              </div>
            </section>

            {/* Emergency */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={Phone} title="Contact d'urgence" />
              <div>
                <label className={labelCls}>Numéro d'urgence<span className="text-[#C42826] ms-0.5">*</span></label>
                <div className="flex gap-2">
                  <div className="w-52">
                    <Select styles={phoneSelectStyles} options={phoneOptions}
                      value={phoneOptions.find((p) => p.value === form.emergencyPhoneCountryCode) || null}
                      onChange={(opt) => update('emergencyPhoneCountryCode', opt?.value || '+213')} isSearchable
                      filterOption={(opt, input) => opt.data.textLabel.toLowerCase().includes(input.toLowerCase())} />
                  </div>
                  <input type="tel" className={fieldErrors.emergencyPhoneNumber ? inputErrCls : inputCls} required
                    placeholder="5XX XXX XXX" value={form.emergencyPhoneNumber}
                    onChange={(e) => update('emergencyPhoneNumber', e.target.value)} />
                </div>
                <FieldError name="emergencyPhoneNumber" />
              </div>
            </section>

            {/* T-shirt + level */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={Shirt} title="Préférences" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Taille T-shirt<span className="text-[#C42826] ms-0.5">*</span></label>
                  <Select styles={selectStyles}
                    options={TSHIRT_SIZES.map((s) => ({ value: s, label: s }))}
                    value={form.tshirtSize ? { value: form.tshirtSize, label: form.tshirtSize } : null}
                    onChange={(opt) => update('tshirtSize', opt?.value || '')} placeholder="Choisir" isClearable />
                  <FieldError name="tshirtSize" />
                </div>
                <div>
                  <label className={labelCls}>Niveau<span className="text-[#C42826] ms-0.5">*</span></label>
                  <Select styles={selectStyles} options={levelOptions}
                    value={levelOptions.find((l) => l.value === form.runnerLevel) || null}
                    onChange={(opt) => update('runnerLevel', opt?.value || '')} placeholder="Choisir" isClearable />
                  <FieldError name="runnerLevel" />
                </div>
              </div>
            </section>

            {/* Card PAN verification */}
            <section className="bg-white rounded-2xl border-2 border-[#C42826]/30 shadow-sm p-6 md:p-8">
              <SectionHeader icon={CreditCard} title="Vérification du paiement" />
              <p className="text-sm text-gray-600 mb-4">
                Pour confirmer votre identité, saisissez les <strong>4 derniers chiffres</strong> de la carte
                que vous avez utilisée lors du paiement SATIM.
              </p>
              <div>
                <label className={labelCls}>4 derniers chiffres de votre carte<span className="text-[#C42826] ms-0.5">*</span></label>
                <input type="tel" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                  className={fieldErrors.enteredCardPan ? inputErrCls : inputCls}
                  required value={form.enteredCardPan} onChange={(e) => update('enteredCardPan', e.target.value)}
                  placeholder="••••" autoComplete="off" />
                <FieldError name="enteredCardPan" />
              </div>
            </section>

            {/* Declarations */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
              <SectionHeader icon={FileCheck} title="Déclarations" />
              <div className="space-y-3">
                <label className="flex gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-[#C42826]"
                    checked={form.declarationFit} onChange={(e) => update('declarationFit', e.target.checked)} />
                  <span>Je déclare être en bonne condition physique pour participer.</span>
                </label>
                <label className="flex gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-[#C42826]"
                    checked={form.declarationRules} onChange={(e) => update('declarationRules', e.target.checked)} />
                  <span>J'accepte le règlement de l'événement.</span>
                </label>
                <label className="flex gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-[#C42826]"
                    checked={form.declarationImage} onChange={(e) => update('declarationImage', e.target.checked)} />
                  <span>J'autorise l'utilisation de mon image pour l'événement.</span>
                </label>
              </div>
            </section>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <div className="text-center">
              <button type="submit" disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C42826] text-white px-8 py-3.5 font-semibold hover:bg-[#a82220] transition cursor-pointer disabled:opacity-60">
                <Trophy size={18} />
                Continuer vers le récapitulatif
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
