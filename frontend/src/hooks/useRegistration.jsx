import { useState, useCallback } from 'react';

const INITIAL_STATE = {
  // Identité
  nom: '',
  prenom: '',
  date_naissance: '',
  sexe: '',
  nationalite: '',

  // Coordonnées
  email: '',
  telephone: '',
  adresse: '',
  code_postal: '',
  ville: '',
  pays: 'France',

  // Course
  course_id: '',

  // Informations sportives
  club: '',
  licence_ffa: '',

  // Contact d'urgence
  contact_urgence_nom: '',
  contact_urgence_telephone: '',

  // Santé
  certificat_medical: null,
  accepte_reglement: false,

  // Navigation
  step: 0,
};

export function useRegistration() {
  const [form, setForm] = useState({ ...INITIAL_STATE });

  const updateField = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_STATE });
  }, []);

  const nextStep = useCallback(() => {
    setForm((prev) => ({ ...prev, step: prev.step + 1 }));
  }, []);

  const prevStep = useCallback(() => {
    setForm((prev) => ({ ...prev, step: Math.max(0, prev.step - 1) }));
  }, []);

  const goToStep = useCallback((step) => {
    setForm((prev) => ({ ...prev, step }));
  }, []);

  return {
    form,
    updateField,
    resetForm,
    nextStep,
    prevStep,
    goToStep,
  };
}

export default useRegistration;
