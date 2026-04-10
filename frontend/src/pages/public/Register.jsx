import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { Check, X, Loader2, Ban } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

// --- Data ---
const flagUrl = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const COUNTRIES_DATA = [
  { value: 'Algérie', code: 'dz', i18nKey: 'countries.DZ' },
  { value: 'France', code: 'fr', i18nKey: 'countries.FR' },
  { value: 'Tunisie', code: 'tn', i18nKey: 'countries.TN' },
  { value: 'Maroc', code: 'ma', i18nKey: 'countries.MA' },
  { value: 'Libye', code: 'ly', i18nKey: 'countries.LY' },
  { value: 'Égypte', code: 'eg', i18nKey: 'countries.EG' },
  { value: 'Espagne', code: 'es', i18nKey: 'countries.ES' },
  { value: 'Allemagne', code: 'de', i18nKey: 'countries.DE' },
  { value: 'Royaume-Uni', code: 'gb', i18nKey: 'countries.GB' },
  { value: 'États-Unis', code: 'us', i18nKey: 'countries.US' },
  { value: 'Canada', code: 'ca', i18nKey: 'countries.CA' },
  { value: 'Italie', code: 'it', i18nKey: 'countries.IT' },
  { value: 'Turquie', code: 'tr', i18nKey: 'countries.TR' },
];

const PHONE_CODES = [
  { value: '+213', code: 'dz', i18nKey: 'countries.DZ' },
  { value: '+33', code: 'fr', i18nKey: 'countries.FR' },
  { value: '+216', code: 'tn', i18nKey: 'countries.TN' },
  { value: '+212', code: 'ma', i18nKey: 'countries.MA' },
  { value: '+44', code: 'gb', i18nKey: 'countries.GB' },
  { value: '+1', code: 'us', i18nKey: 'countries.US' },
  { value: '+49', code: 'de', i18nKey: 'countries.DE' },
  { value: '+34', code: 'es', i18nKey: 'countries.ES' },
  { value: '+39', code: 'it', i18nKey: 'countries.IT' },
  { value: '+90', code: 'tr', i18nKey: 'countries.TR' },
];

const WILAYAS = [
  '01 - Adrar', '02 - Chlef', '03 - Laghouat', '04 - Oum El Bouaghi', '05 - Batna',
  '06 - Béjaïa', '07 - Biskra', '08 - Béchar', '09 - Blida', '10 - Bouira',
  '11 - Tamanrasset', '12 - Tébessa', '13 - Tlemcen', '14 - Tiaret', '15 - Tizi Ouzou',
  '16 - Alger', '17 - Djelfa', '18 - Jijel', '19 - Sétif', '20 - Saïda',
  '21 - Skikda', '22 - Sidi Bel Abbès', '23 - Annaba', '24 - Guelma', '25 - Constantine',
  '26 - Médéa', '27 - Mostaganem', '28 - M\'Sila', '29 - Mascara', '30 - Ouargla',
  '31 - Oran', '32 - El Bayadh', '33 - Illizi', '34 - BBA', '35 - Boumerdès',
  '36 - El Tarf', '37 - Tindouf', '38 - Tissemsilt', '39 - El Oued', '40 - Khenchela',
  '41 - Souk Ahras', '42 - Tipaza', '43 - Mila', '44 - Aïn Defla', '45 - Naâma',
  '46 - Aïn Témouchent', '47 - Ghardaïa', '48 - Relizane',
  '49 - El M\'Ghair', '50 - El Meniaa', '51 - Ouled Djellal', '52 - Bordj Baji Mokhtar',
  '53 - Béni Abbès', '54 - Timimoun', '55 - Touggourt', '56 - Djanet',
  '57 - In Salah', '58 - In Guezzam',
].map((w) => ({ value: w, label: w }));

const COMMUNES_MAP = {
  '16 - Alger': ['Alger Centre', 'Bab El Oued', 'Bir Mourad Raïs', 'El Biar', 'Hussein Dey', 'Kouba', 'Bab Ezzouar', 'Dar El Beïda', 'Rouiba', 'Reghaia'],
  '31 - Oran': ['Oran', 'Bir El Djir', 'Es Sénia', 'Aïn El Turk', 'Arzew'],
  '25 - Constantine': ['Constantine', 'El Khroub', 'Aïn Smara', 'Hamma Bouziane'],
  '09 - Blida': ['Blida', 'Boufarik', 'Bougara', 'Mouzaia'],
  '06 - Béjaïa': ['Béjaïa', 'Akbou', 'Amizour', 'El Kseur'],
  '15 - Tizi Ouzou': ['Tizi Ouzou', 'Azazga', 'Draâ El Mizan', 'Larbaâ Nath Irathen'],
  '35 - Boumerdès': ['Boumerdès', 'Bordj Menaïel', 'Dellys', 'Khemis El Khechna'],
  '42 - Tipaza': ['Tipaza', 'Cherchell', 'Koléa', 'Hadjout'],
  '05 - Batna': ['Batna', 'Barika', 'Merouana', 'Aïn Touta'],
  '19 - Sétif': ['Sétif', 'El Eulma', 'Aïn Oulmène', 'Bougaa'],
  '23 - Annaba': ['Annaba', 'El Bouni', 'El Hadjar', 'Berrahal'],
};

const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// --- react-select custom styles ---
const phoneSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#C42826' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
    padding: '2px 0',
    backgroundColor: '#f9fafb',
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
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#C42826' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
    padding: '2px 0',
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

  const [form, setForm] = useState({
    lastName: '', firstName: '', birthDate: '', gender: '',
    nationality: 'Algérie', phoneCountryCode: '+213', phoneNumber: '',
    email: '', confirmEmail: '',
    countryOfResidence: 'Algérie', wilaya: '', commune: '', ville: '',
    emergencyPhoneCountryCode: '+213', emergencyPhoneNumber: '',
    tshirtSize: '', runnerLevel: '',
    declarationFit: false, declarationRules: false, declarationImage: false,
  });

  // Build translated options inside the component so t() is available
  const genderOptions = [
    { value: 'Homme', label: t('register.genders.male') },
    { value: 'Femme', label: t('register.genders.female') },
  ];

  const levelOptions = [
    { value: 'Débutant', label: t('register.levels.beginner') },
    { value: 'Intermédiaire', label: t('register.levels.intermediate') },
    { value: 'Avancé', label: t('register.levels.advanced') },
  ];

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
      .then((d) => { if (!d.registrationOpen) setClosed(true); })
      .catch(() => setClosed(true))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.email !== form.confirmEmail) {
      setError(t('register.errors.emailMismatch')); return;
    }
    if (!form.declarationFit || !form.declarationRules || !form.declarationImage) {
      setError(t('register.errors.declarationsRequired')); return;
    }
    if (emailStatus === 'taken') {
      setError(t('register.errors.emailTaken')); return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || t('register.errors.generic'));
      }
      const data = await res.json();
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

  const inputCls = 'w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C42826] focus:border-[#C42826] transition';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <PublicLayout title={t('register.title')}>
      <div className="py-10 px-4">
      <div className="max-w-3xl mx-auto">

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informations personnelles */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.personal')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('register.fields.lastName')} *</label>
                <input className={inputCls} required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.firstName')} *</label>
                <input className={inputCls} required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.birthDate')} *</label>
                <input type="date" className={inputCls} required value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t('register.fields.gender')} *</label>
                <Select
                  styles={selectStyles}
                  options={genderOptions}
                  value={genderOptions.find((g) => g.value === form.gender) || null}
                  onChange={(opt) => update('gender', opt?.value || '')}
                  placeholder={t('common.choose')}
                  isClearable
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>{t('register.fields.nationality')} *</label>
                <Select
                  styles={selectStyles}
                  options={countryOptions}
                  value={countryOptions.find((c) => c.value === form.nationality) || null}
                  onChange={(opt) => update('nationality', opt?.value || '')}
                  placeholder={t('common.choose')}
                  filterOption={(option, input) => option.data.textLabel.toLowerCase().includes(input.toLowerCase())}
                />
              </div>
            </div>
          </section>

          {/* Contact & E-mail */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.contact')}</h2>
            <div>
              <label className={labelCls}>{t('register.fields.phone')} *</label>
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
                <input type="tel" className={inputCls} required placeholder={t('register.placeholders.phone')} value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('register.fields.email')} *</label>
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
              <label className={labelCls}>{t('register.fields.confirmEmail')} *</label>
              <input type="email" className={inputCls} required value={form.confirmEmail}
                onChange={(e) => update('confirmEmail', e.target.value)}
              />
              {form.confirmEmail && form.email !== form.confirmEmail && (
                <p className="text-red-500 text-xs mt-1">{t('register.errors.emailMismatch')}</p>
              )}
            </div>
          </section>

          {/* Residence */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.residence')}</h2>
            <div>
              <label className={labelCls}>{t('register.fields.country')} *</label>
              <Select
                styles={selectStyles}
                options={countryOptions}
                value={countryOptions.find((c) => c.value === form.countryOfResidence) || null}
                onChange={(opt) => update('countryOfResidence', opt?.value || '')}
                filterOption={(option, input) => option.data.textLabel.toLowerCase().includes(input.toLowerCase())}
              />
            </div>
            {isAlgeria && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('register.fields.wilaya')} *</label>
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
                  <label className={labelCls}>{t('register.fields.commune')} *</label>
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
                <label className={labelCls}>{t('register.fields.city')} *</label>
                <input className={inputCls} required={!isAlgeria} value={form.ville} onChange={(e) => update('ville', e.target.value)} placeholder={t('register.placeholders.city')} />
              </div>
            )}
          </section>

          {/* Emergency */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.emergency')}</h2>
            <div>
              <label className={labelCls}>{t('register.fields.emergencyPhone')} *</label>
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
                <input type="tel" className={inputCls} required placeholder={t('register.placeholders.emergencyPhone')} value={form.emergencyPhoneNumber} onChange={(e) => update('emergencyPhoneNumber', e.target.value)} />
              </div>
            </div>
          </section>

          {/* T-shirt */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.tshirt')}</h2>
            <div>
              <label className={labelCls}>{t('register.fields.tshirtSize')} *</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {TSHIRT_SIZES.map((size) => (
                  <button type="button" key={size} onClick={() => update('tshirtSize', size)}
                    className={`px-5 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer ${
                      form.tshirtSize === size
                        ? 'bg-[#C42826] text-white border-[#C42826]'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#C42826]/70'
                    }`}
                  >{size}</button>
                ))}
              </div>
            </div>
          </section>

          {/* Level */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.level')}</h2>
            <Select
              styles={selectStyles}
              options={levelOptions}
              value={levelOptions.find((l) => l.value === form.runnerLevel) || null}
              onChange={(opt) => update('runnerLevel', opt?.value || '')}
              placeholder={t('common.choose')}
            />
          </section>

          {/* Declarations */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">{t('register.sections.declarations')}</h2>
            <div
              className="flex items-start gap-3 cursor-pointer"
              onClick={() => { if (!form.declarationFit) setShowConditions(true); else update('declarationFit', false); }}
            >
              <input type="checkbox" readOnly className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826] pointer-events-none" checked={form.declarationFit} />
              <span className="text-sm text-gray-700">{t('register.declarations.fit')} *</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]" checked={form.declarationRules} onChange={(e) => update('declarationRules', e.target.checked)} />
              <span className="text-sm text-gray-700">{t('register.declarations.rules')} *</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C42826] accent-[#C42826]" checked={form.declarationImage} onChange={(e) => update('declarationImage', e.target.checked)} />
              <span className="text-sm text-gray-700">{t('register.declarations.image')} *</span>
            </label>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex justify-center">
            <button type="submit" disabled={submitting}
              className="bg-[#C42826] hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-10 py-3 rounded-xl text-base transition shadow-sm cursor-pointer"
            >
              {submitting ? t('register.submitting') : t('register.submit')}
            </button>
          </div>
        </form>
      </div>
      </div>

      {/* Conditions Modal */}
      {showConditions && (
        <ConditionsModal
          onAccept={() => { update('declarationFit', true); setShowConditions(false); }}
          onDecline={() => setShowConditions(false)}
        />
      )}
    </PublicLayout>
  );
}

/* ─── Conditions de Participation Modal ─── */
function ConditionsModal({ onAccept, onDecline }) {
  const [canAccept, setCanAccept] = useState(false);
  const contentRef = useRef(null);

  const handleScroll = () => {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setCanAccept(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDecline} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 text-center">
          <h3 className="text-xl font-bold text-gray-900">Conditions de Participation</h3>
          <p className="text-sm text-gray-500 mt-1">Lisez jusqu'en bas pour activer le bouton Accepter</p>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 text-sm text-gray-700 leading-relaxed space-y-5"
        >
          <Article title="Article 1 – Informations générales">
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

          <Article title="Article 2 – Inscriptions / Tarifs / Annulation / Dossard">
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

          <Article title="Article 3 – Remise des dossards">
            <p>Le lieu et les horaires de retrait seront communiqués sur www.lassm.dz et les réseaux sociaux. Le retrait se fait sur présentation d'une pièce d'identité. Aucun dossard ne sera remis le jour de la course, sauf décision exceptionnelle.</p>
          </Article>

          <Article title="Article 4 – L'épreuve sportive">
            <p>Distance : 16,57 km — 443 m D+<br/>Départ et arrivée : Parc Zoologique de Ben Aknoun – entrée Village Africain<br/>Regroupement : 06h00 — Départ : 08h00<br/>Âge minimum : 19 ans</p>
            <p>L'organisation se réserve le droit de modifier la date, le lieu, le parcours, l'horaire, ou d'annuler l'événement. Ces situations ne donnent lieu à aucune indemnisation.</p>
          </Article>

          <Article title="Article 5 – Respect de l'environnement">
            <p>Il est strictement interdit de jeter des bouteilles d'eau, emballages, mégots ou tout autre déchet sur le parcours. Sanction : disqualification immédiate.</p>
          </Article>

          <Article title="Article 6 – Matériel obligatoire">
            <ul className="list-disc list-inside space-y-1 ps-2">
              <li>Téléphone portable chargé et opérationnel</li>
              <li>Réserve d'eau d'au moins 1 litre</li>
              <li>Chaussures adaptées au trail</li>
              <li>Dossard officiel correctement porté</li>
            </ul>
          </Article>

          <Article title="Article 7 – Parcours et signalisation">
            <p>2 points de ravitaillement (km 6,30 et km 10,70), des points de contrôle obligatoires. Barrière horaire : 3h00 à l'arrivée.</p>
          </Article>

          <Article title="Article 8 – Sécurité et assistance">
            <p>Chaque participant est responsable de sa propre sécurité. Tout participant a l'obligation de porter assistance à une personne en difficulté. Ne jamais laisser une personne blessée seule.</p>
          </Article>

          <Article title="Article 9 – Droit à l'image">
            <p>Chaque participant autorise la LASSM à photographier, filmer, enregistrer et diffuser son image dans le cadre de l'événement, à titre gratuit.</p>
          </Article>

          <Article title="Article 10 – Données personnelles">
            <p>Les données collectées sont utilisées exclusivement pour la gestion des inscriptions, l'organisation et la communication liée à la course.</p>
          </Article>

          <Article title="Article 11 – Service consigne">
            <p>Un service de consigne sera disponible à partir de 06h00. L'organisation ne peut être tenue responsable en cas de perte, vol ou détérioration.</p>
          </Article>

          <Article title="Article 12 – Aptitude physique et acceptation des risques">
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

          <Article title="Article 13 – Assurance">
            <p>L'organisation est couverte par une assurance responsabilité civile. Il appartient à chaque participant de vérifier sa couverture personnelle. L'organisation recommande vivement de souscrire une assurance individuelle accident.</p>
          </Article>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onDecline}
            className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            Décliner
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className="rounded-lg bg-[#C42826] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a82220] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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
