import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header({ title, event }) {
  const { t } = useTranslation();

  const logoSrc = event?.logoPath || '/logo_mouflon.svg';
  const logoAlt = event?.eventName || 'Trail des Mouflons d\'Or';
  const brand = event?.primaryColor || '#C42826';

  return (
    <header>
      {/* Top nav bar */}
      <div className="bg-[#f5f5f5] relative z-20 pb-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/faq"
            style={{ backgroundColor: brand }}
            className="text-white text-xs sm:text-sm font-bold px-3 sm:px-5 py-2 rounded uppercase tracking-wide hover:opacity-90 transition"
          >
            {t('header.faq')}
          </Link>

          <div className="w-16 sm:w-32 flex-shrink-0" />

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/register"
              style={{ backgroundColor: brand }}
              className="text-white text-xs sm:text-sm font-bold px-3 sm:px-5 py-2 rounded uppercase tracking-wide hover:opacity-90 transition"
            >
              {t('header.signUp')}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>

        <Link to="/register" className="absolute left-1/2 -translate-x-1/2 top-2 z-30">
          <img src={logoSrc} alt={logoAlt} className="h-14 sm:h-20 md:h-24" />
        </Link>
      </div>

      {/* Red banner with title + shapes */}
      <div className="relative overflow-hidden" style={{ backgroundColor: brand }}>
        <div className="relative z-10 pt-16 pb-16 text-center">
          <h1 className="text-white text-2xl md:text-3xl font-extrabold uppercase tracking-wide">
            {title || 'PAGE TITLE HERE'}
          </h1>
          {event?.eventName && (
            <p className="text-white/70 text-sm mt-2 font-medium tracking-wide">{event.eventName}</p>
          )}
        </div>
      </div>
    </header>
  );
}
