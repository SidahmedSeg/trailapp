import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Footer({ event }) {
  const { t } = useTranslation();

  const facebookUrl = event?.facebookUrl || 'https://www.facebook.com/p/Ligue-Algeroise-de-ski-et-des-sports-de-montagne-LASSM-100081974797044/';
  const instagramUrl = event?.instagramUrl || 'https://www.instagram.com/lassm.dz/';
  const tiktokUrl = event?.tiktokUrl || '';
  const websiteUrl = event?.websiteUrl || 'https://lassm.dz/';
  const logoSrc = event?.logoPath
    ? event.logoPath  // Event-specific logo
    : '/logo_mouflon_white.svg'; // Default

  const brand = event?.primaryColor || '#C42826';

  return (
    <footer style={{ backgroundColor: brand }}>
      <div className="py-12 flex flex-col items-center gap-6">
        <img src={logoSrc} alt={event?.eventName || 'Trail des Mouflons d\'Or'} className="h-24" />
        <div className="flex items-center gap-5">
          {facebookUrl && (
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="Facebook">
              <img src="/facebook.svg" alt="Facebook" className="h-7 w-7 brightness-0 invert" />
            </a>
          )}
          {instagramUrl && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="Instagram">
              <img src="/insta.svg" alt="Instagram" className="h-7 w-7 brightness-0 invert" />
            </a>
          )}
          {tiktokUrl && (
            <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="TikTok">
              <img src="/tiktok.svg" alt="TikTok" className="h-7 w-7 brightness-0 invert" />
            </a>
          )}
          {websiteUrl && (
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="Site web">
              <img src="/web.svg" alt="Site web" className="h-7 w-7 brightness-0 invert" />
            </a>
          )}
        </div>

        {/* Contact CTA */}
        {event?.contactEmail && (
          <div className="text-white/80 text-sm text-center">
            {event.contactLabel && <span className="font-medium">{event.contactLabel}: </span>}
            <a href={`mailto:${event.contactEmail}`} className="hover:text-white transition underline">
              {event.contactEmail}
            </a>
            {event.contactPhone && <span className="mx-2">|</span>}
            {event.contactPhone && (
              <a href={`tel:${event.contactPhone}`} className="hover:text-white transition">
                {event.contactPhone}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-white/80 text-xs uppercase tracking-wider">
            {t('footer.copyright', { eventName: event?.eventName || 'Trail des Mouflons d\'Or 2026' })}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-white/80 text-xs uppercase tracking-wider hover:text-white transition">
              {t('footer.privacy')}
            </Link>
            <Link to="/terms-conditions" className="text-white/80 text-xs uppercase tracking-wider hover:text-white transition">
              {t('footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
