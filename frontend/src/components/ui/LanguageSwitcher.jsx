import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ar', label: 'AR', name: 'العربية' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchLang(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
      >
        <Globe size={14} />
        <span className="font-medium">{current.label}</span>
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLang(lang.code)}
              className={`w-full text-start px-4 py-2 text-sm transition cursor-pointer flex items-center justify-between ${
                lang.code === current.code
                  ? 'bg-[#C42826]/5 text-[#C42826] font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{lang.name}</span>
              <span className="text-xs text-gray-400">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
