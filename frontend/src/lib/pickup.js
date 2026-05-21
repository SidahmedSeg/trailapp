/**
 * Shared constants for the bib-pickup-by-proxy feature.
 *
 * Consumed by:
 *   - pages/admin/Runners.jsx (Coureur drawer)
 *   - pages/admin/ScannerView.jsx (scanner modal + history modal)
 *   - components/pickup/PickupDetails.jsx
 */

export const PROXY_RELATIONS = [
  { value: 'conjoint', label: 'Conjoint·e' },
  { value: 'ami', label: 'Ami·e' },
  { value: 'famille', label: 'Famille' },
  { value: 'autre', label: 'Autre' },
];

export const RELATION_LABEL = PROXY_RELATIONS.reduce((acc, r) => {
  acc[r.value] = r.label;
  return acc;
}, {});

/** Resolve a stored relation key to a display label (falls back to the raw key). */
export function relationLabel(value) {
  if (!value) return '';
  return RELATION_LABEL[value] || value;
}

/** Roles allowed to view the CIN photo (write side is broader). */
export const CAN_VIEW_CIN_PHOTO_ROLES = ['admin', 'super_admin'];

export function canViewCinPhoto(role) {
  return CAN_VIEW_CIN_PHOTO_ROLES.includes(role);
}
