export const flagUrl = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

export const COUNTRIES_DATA = [
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

export const PHONE_CODES = [
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

export const WILAYAS = [
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

export const COMMUNES_MAP = {
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

export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#C42826' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(196,40,38,0.15)' : 'none',
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

export const phoneSelectStyles = {
  ...selectStyles,
  control: (base, state) => ({
    ...selectStyles.control(base, state),
    backgroundColor: '#f9fafb',
  }),
};
