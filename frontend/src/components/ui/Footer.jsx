import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-[#C42826]">
      <div className="py-12 flex flex-col items-center gap-6">
        <img src="/logo_mouflon_white.svg" alt="Trail des Mouflons d'Or" className="h-24" />
        <div className="flex items-center gap-5">
          <a href="https://www.facebook.com/p/Ligue-Algeroise-de-ski-et-des-sports-de-montagne-LASSM-100081974797044/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="Facebook">
            <img src="/facebook.svg" alt="Facebook" className="h-7 w-7 brightness-0 invert" />
          </a>
          <a href="https://www.instagram.com/lassm.dz/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="Instagram">
            <img src="/insta.svg" alt="Instagram" className="h-7 w-7 brightness-0 invert" />
          </a>
          <a href="https://lassm.dz/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition" aria-label="Site web">
            <img src="/web.svg" alt="Site web" className="h-7 w-7 brightness-0 invert" />
          </a>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-white/80 text-xs uppercase tracking-wider">
            {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-white/80 text-xs uppercase tracking-wider hover:text-white transition">
              {t('footer.privacy')}
            </Link>
            <Link to="/terms-conditions" className="text-white/80 text-xs uppercase tracking-wider hover:text-white transition">
              {t('footer.terms')}
            </Link>
            <Link to="/mentions-legales" className="text-white/80 text-xs uppercase tracking-wider hover:text-white transition">
              {t('footer.legal')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
