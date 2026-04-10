import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, MapPin, Mail, Calendar, Route, Users, Shirt, Package, HelpCircle } from 'lucide-react';
import PublicLayout from '../../components/ui/PublicLayout';

const FAQ_DATA = [
  {
    icon: Users,
    question: 'Qui peut participer ?',
    answer: 'Toute personne âgée de 19 ans et plus peut participer à la course.',
  },
  {
    icon: HelpCircle,
    question: "Comment s'inscrire ?",
    answer: "L'inscription se fait en ligne via notre plateforme, avec des frais de participation de 2000 DZD.",
  },
  {
    icon: Calendar,
    question: "Quelle est la date et l'heure de la course ?",
    answer: "La course aura lieu le 1er mai 2026 à 08h00.",
    extra: 'Rassemblement des participants à partir de 07h00',
    extraIcon: 'pin',
  },
  {
    icon: MapPin,
    question: 'Quel est le lieu de départ de la course ?',
    answer: 'Le départ sera donné depuis le Parc Zoologique de Ben Aknoun (Entrée Village Africain)',
    link: { label: 'Voir sur Google Maps', url: 'https://maps.app.goo.gl/LjAke1ZfZoGNb5pH7?g_st=ac' },
  },
  {
    icon: Route,
    question: 'Quelle est la distance du parcours ?',
    answer: 'Le parcours s\'étend sur 16,57 km.',
  },
  {
    icon: Shirt,
    question: "Que comprennent les frais d'inscription ?",
    answer: "Les frais d'inscription comprennent :",
    list: [
      "Un t-shirt officiel de l'événement",
      'Un dossard avec puce de chronométrage',
      "Une médaille finisher à l'arrivée",
    ],
  },
  {
    icon: Package,
    question: "Y aura-t-il une consigne ?",
    answer: 'Oui, un espace dédié sera mis à disposition des participants pour la consigne.',
  },
  {
    icon: Mail,
    question: 'Besoin d\'aide ou vous avez des questions ?',
    answer: 'Pour toute information complémentaire, vous pouvez nous contacter à l\'adresse suivante :',
    contact: 'contact@lassm.dz',
  },
];

function AccordionItem({ item, isOpen, onToggle }) {
  const Icon = item.icon;

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden transition-all ${isOpen ? 'bg-white shadow-sm' : 'bg-white hover:bg-gray-50'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-start cursor-pointer"
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition ${isOpen ? 'bg-[#C42826] text-white' : 'bg-gray-100 text-gray-500'}`}>
          <Icon size={20} />
        </div>
        <span className={`flex-1 text-sm font-semibold transition ${isOpen ? 'text-[#C42826]' : 'text-gray-800'}`}>
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#C42826]' : ''}`}
        />
      </button>

      <div className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 ps-[4.25rem]">
            <div className="bg-[#C42826]/5 border-s-4 border-[#C42826] rounded-e-lg px-4 py-3 space-y-2">
              <p className="text-sm text-gray-700 leading-relaxed">{item.answer}</p>

              {item.extra && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="text-[#C42826]" />
                  <span>{item.extra}</span>
                </div>
              )}

              {item.list && (
                <ul className="space-y-1.5 pt-1">
                  {item.list.map((li, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C42826] flex-shrink-0" />
                      {li}
                    </li>
                  ))}
                </ul>
              )}

              {item.link && (
                <a
                  href={item.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#C42826] hover:underline mt-1"
                >
                  <MapPin size={14} />
                  {item.link.label}
                </a>
              )}

              {item.contact && (
                <a
                  href={`mailto:${item.contact}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#C42826] hover:underline mt-1"
                >
                  <Mail size={14} />
                  {item.contact}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <PublicLayout title="FAQ">
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-gray-500">Trouvez les réponses à vos questions</p>
          </div>

          <div className="space-y-3">
            {FAQ_DATA.map((item, i) => (
              <AccordionItem
                key={i}
                item={item}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
