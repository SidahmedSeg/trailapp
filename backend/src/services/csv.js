const FIELD_MAP = {
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  gender: 'Genre',
  birthDate: 'Date de naissance',
  nationality: 'Nationalité',
  countryOfResidence: 'Pays de résidence',
  wilaya: 'Wilaya',
  commune: 'Commune',
  ville: 'Ville',
  runnerLevel: 'Niveau coureur',
  tshirtSize: 'Taille t-shirt',
  bibNumber: 'Numéro de dossard',
  paymentMethod: 'Méthode paiement',
  paymentStatus: 'Statut paiement',
  paymentAmount: 'Montant',
  paymentDate: 'Date paiement',
  status: 'Statut',
  source: 'Source',
  createdAt: 'Date inscription',
  distributedAt: 'Date distribution',
};

function generateCSV(registrations, fields) {
  const selectedFields = fields.filter((f) => FIELD_MAP[f]);

  // Header
  const header = selectedFields.map((f) => FIELD_MAP[f]).join(',');

  // Rows
  const rows = registrations.map((reg) =>
    selectedFields.map((f) => {
      let val = reg[f];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (f === 'paymentAmount') return (val / 100).toFixed(2);
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val}"`;
      }
      return val;
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

module.exports = { generateCSV, FIELD_MAP };
