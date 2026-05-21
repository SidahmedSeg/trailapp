import { useState } from 'react';
import { User, Phone, IdCard, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { relationLabel, canViewCinPhoto } from '../../lib/pickup';
import PickupPhotoModal from './PickupPhotoModal';

/**
 * Read-only display of the proxy pickup info for a Registration.
 *
 * Props:
 *   pickup: {
 *     name, phone, cin, relation, pickedUpAt,
 *     hasCinPhoto?: boolean,           // history snapshot uses this flag
 *     cinPhotoPath?: string,           // registration row uses this column
 *     linkedRegistration?: { bibNumber, firstName, lastName },
 *   }
 *   registrationId: string             // owning Registration.id — needed for the photo endpoint
 *   distributedBy?: string             // operator name (optional surfacing)
 *   variant?: 'card' | 'rows'          // 'card' = framed block (drawer), 'rows' = bare InfoRows (modal)
 *   showHeader?: boolean               // print "Récupération du dossard" header (default: true for 'card')
 */
export default function PickupDetails({
  pickup,
  registrationId,
  distributedBy,
  variant = 'card',
  showHeader,
}) {
  const { user } = useAuth();
  const [photoOpen, setPhotoOpen] = useState(false);

  if (!pickup || !pickup.name) return null;

  const hasPhoto = Boolean(pickup.hasCinPhoto || pickup.cinPhotoPath);
  const showPhotoButton = hasPhoto && canViewCinPhoto(user?.role);
  const headerVisible = showHeader ?? variant === 'card';

  const body = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <User size={12} className="text-gray-400" />
        <span className="text-gray-900 font-medium">{pickup.name}</span>
      </div>
      {pickup.phone && (
        <div className="flex items-center gap-2">
          <Phone size={12} className="text-gray-400" />
          <span className="text-gray-700">{pickup.phone}</span>
        </div>
      )}
      {pickup.cin && (
        <div className="flex items-center gap-2">
          <IdCard size={12} className="text-gray-400" />
          <span className="text-gray-700 font-mono">{pickup.cin}</span>
        </div>
      )}
      {pickup.relation && (
        <div className="text-xs text-gray-500">
          Relation : <span className="text-gray-700">{relationLabel(pickup.relation)}</span>
        </div>
      )}
      {pickup.linkedRegistration && (
        <div className="text-xs text-gray-500">
          Coureur lié :{' '}
          <span className="text-gray-700">
            #{pickup.linkedRegistration.bibNumber} {pickup.linkedRegistration.firstName} {pickup.linkedRegistration.lastName}
          </span>
        </div>
      )}
      {pickup.pickedUpAt && (
        <div className="text-xs text-gray-500">
          Récupéré le : <span className="text-gray-700">{new Date(pickup.pickedUpAt).toLocaleString('fr-FR')}</span>
        </div>
      )}
      {distributedBy && (
        <div className="text-xs text-gray-500">
          Opérateur : <span className="text-gray-700">{distributedBy}</span>
        </div>
      )}
      {showPhotoButton && (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer"
        >
          <ImageIcon size={12} />
          Voir photo CIN
        </button>
      )}
      {hasPhoto && !showPhotoButton && (
        <p className="text-xs text-gray-400 italic">Photo CIN disponible — réservée aux administrateurs.</p>
      )}
    </div>
  );

  return (
    <>
      {variant === 'card' ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
          {headerVisible && (
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-[#C42826]" />
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Récupération du dossard</p>
            </div>
          )}
          {body}
        </div>
      ) : (
        body
      )}

      {photoOpen && (
        <PickupPhotoModal registrationId={registrationId} onClose={() => setPhotoOpen(false)} />
      )}
    </>
  );
}
