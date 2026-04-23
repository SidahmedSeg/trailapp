import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, HelpCircle } from 'lucide-react';
import PublicLayout, { usePublicEvent } from '../../components/ui/PublicLayout';

function AccordionItem({ item, isOpen, onToggle }) {
  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden transition-all ${isOpen ? 'bg-white shadow-sm' : 'bg-white hover:bg-gray-50'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-start cursor-pointer"
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition ${isOpen ? 'bg-[#C42826] text-white' : 'bg-gray-100 text-gray-500'}`}
          style={isOpen ? { backgroundColor: 'var(--brand, #C42826)' } : undefined}>
          <HelpCircle size={20} />
        </div>
        <span className={`flex-1 text-sm font-semibold transition ${isOpen ? 'text-gray-900' : 'text-gray-800'}`}>
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={isOpen ? { color: 'var(--brand, #C42826)' } : undefined}
        />
      </button>

      <div className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 ps-[4.25rem]">
            <div className="border-s-4 rounded-e-lg px-4 py-3"
              style={{ backgroundColor: 'color-mix(in srgb, var(--brand, #C42826) 5%, transparent)', borderColor: 'var(--brand, #C42826)' }}>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{item.answer}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQContent() {
  const event = usePublicEvent();
  const [openIndex, setOpenIndex] = useState(null);

  const eventFaq = event?.faq || [];
  const hasFaq = eventFaq.length > 0;

  if (!hasFaq) {
    return (
      <div className="text-center py-12">
        <HelpCircle size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Aucune FAQ disponible pour cet événement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eventFaq.map((item, i) => (
        <AccordionItem
          key={i}
          item={item}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}

export default function FAQ() {
  return (
    <PublicLayout title="FAQ">
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-gray-500">Trouvez les réponses à vos questions</p>
          </div>
          <FAQContent />
        </div>
      </div>
    </PublicLayout>
  );
}
