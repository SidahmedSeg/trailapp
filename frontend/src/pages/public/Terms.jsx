import { useTranslation } from 'react-i18next';
import PublicLayout from '../../components/ui/PublicLayout';

export default function Terms() {
  const { t } = useTranslation();

  const sections = [
    { key: 'identification', numeral: 'I' },
    { key: 'object', numeral: 'II' },
    { key: 'paymentMethods', numeral: 'III' },
    { key: 'withdrawal', numeral: 'IV' },
    { key: 'validation', numeral: 'V' },
    { key: 'amount', numeral: 'VI' },
    { key: 'proof', numeral: 'VII' },
    { key: 'refund', numeral: 'VIII' },
    { key: 'dispute', numeral: 'IX' },
    { key: 'dataProtection', numeral: 'X' },
    { key: 'acceptance', numeral: 'XI' },
  ];

  return (
    <PublicLayout title={t('terms.title')}>
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 md:p-10 space-y-8">

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">{t('terms.subtitle')}</h2>
            <div className="flex flex-col sm:flex-row sm:gap-8 text-sm text-gray-600">
              <p><span className="font-medium text-gray-700">{t('terms.bank')}:</span> Banque Nationale d'Algérie (BNA)</p>
              <p><span className="font-medium text-gray-700">{t('terms.gateway')}:</span> SATIM (CIB / EDAHABIA)</p>
            </div>
          </div>

          {sections.map(({ key, numeral }) => (
            <section key={key} className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">
                {numeral}. {t(`terms.sections.${key}.title`)}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {t(`terms.sections.${key}.text`)}
              </p>
            </section>
          ))}

          <p className="text-xs text-gray-400 pt-4 border-t">{t('terms.lastUpdate')}</p>
        </div>
      </div>
    </PublicLayout>
  );
}
