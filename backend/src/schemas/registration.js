const LATIN_REGEX = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/;
const PHONE_DZ_REGEX = /^[567]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDERS = ['Homme', 'Femme'];
const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const RUNNER_LEVELS = ['Débutant', 'Intermédiaire', 'Avancé'];

function validateRegistration(body) {
  const errors = [];

  // Required fields
  const required = [
    'lastName', 'firstName', 'birthDate', 'gender', 'nationality',
    'phoneCountryCode', 'phoneNumber', 'email',
    'countryOfResidence',
    'emergencyPhoneCountryCode', 'emergencyPhoneNumber',
    'tshirtSize', 'runnerLevel',
  ];

  for (const field of required) {
    if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
      errors.push({ field, message: `${field} est requis` });
    }
  }

  if (errors.length > 0) return errors;

  // Latin names
  if (!LATIN_REGEX.test(body.lastName)) {
    errors.push({ field: 'lastName', message: 'Le nom doit contenir uniquement des lettres latines (2-50 caractères)' });
  }
  if (!LATIN_REGEX.test(body.firstName)) {
    errors.push({ field: 'firstName', message: 'Le prénom doit contenir uniquement des lettres latines (2-50 caractères)' });
  }

  // Age 19+
  const birthDate = new Date(body.birthDate);
  if (isNaN(birthDate.getTime())) {
    errors.push({ field: 'birthDate', message: 'Date de naissance invalide' });
  } else {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 19) {
      errors.push({ field: 'birthDate', message: 'Vous devez avoir au moins 19 ans' });
    }
  }

  // Gender
  if (!GENDERS.includes(body.gender)) {
    errors.push({ field: 'gender', message: 'Genre invalide' });
  }

  // Email
  if (!EMAIL_REGEX.test(body.email)) {
    errors.push({ field: 'email', message: 'Format email invalide' });
  }

  // Phone validation
  validatePhone(body.phoneCountryCode, body.phoneNumber, 'phone', errors);
  validatePhone(body.emergencyPhoneCountryCode, body.emergencyPhoneNumber, 'emergencyPhone', errors);

  // Residence
  if (body.countryOfResidence === 'Algérie') {
    if (!body.wilaya) errors.push({ field: 'wilaya', message: 'Wilaya requise pour l\'Algérie' });
    if (!body.commune) errors.push({ field: 'commune', message: 'Commune requise pour l\'Algérie' });
  } else {
    if (!body.ville) errors.push({ field: 'ville', message: 'Ville requise' });
    if (body.ville && !LATIN_REGEX.test(body.ville)) {
      errors.push({ field: 'ville', message: 'La ville doit contenir uniquement des lettres latines' });
    }
  }

  // T-shirt
  if (!TSHIRT_SIZES.includes(body.tshirtSize)) {
    errors.push({ field: 'tshirtSize', message: 'Taille invalide' });
  }

  // Runner level
  if (!RUNNER_LEVELS.includes(body.runnerLevel)) {
    errors.push({ field: 'runnerLevel', message: 'Niveau invalide' });
  }

  // Declarations
  if (!body.declarationFit) errors.push({ field: 'declarationFit', message: 'Déclaration d\'aptitude requise' });
  if (!body.declarationRules) errors.push({ field: 'declarationRules', message: 'Acceptation du règlement requise' });
  if (!body.declarationImage) errors.push({ field: 'declarationImage', message: 'Autorisation image requise' });

  return errors;
}

function validatePhone(countryCode, number, prefix, errors) {
  if (countryCode === '+213') {
    if (!PHONE_DZ_REGEX.test(number)) {
      errors.push({
        field: prefix + 'Number',
        message: 'Numéro algérien invalide (9 chiffres, commence par 5, 6 ou 7)',
      });
    }
  } else {
    if (!number || !/^\d+$/.test(number)) {
      errors.push({ field: prefix + 'Number', message: 'Numéro de téléphone invalide' });
    }
  }
}

function buildE164(countryCode, number) {
  return `${countryCode}${number}`;
}

module.exports = { validateRegistration, buildE164 };
