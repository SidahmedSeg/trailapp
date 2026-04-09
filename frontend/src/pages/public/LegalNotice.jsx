import { useTranslation } from 'react-i18next';
import PublicLayout from '../../components/ui/PublicLayout';

export default function LegalNotice() {
  const { t } = useTranslation();

  return (
    <PublicLayout title={t('legal.title')}>
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 md:p-10 space-y-8">

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">{t('legal.editor.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('legal.editor.text')}</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p>{t('legal.editor.address')}</p>
              <p>{t('legal.editor.director')}</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">{t('legal.hosting.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('legal.hosting.text')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">{t('legal.ip.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('legal.ip.text')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">{t('legal.cookies.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('legal.cookies.text')}</p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t">{t('legal.lastUpdate')}</p>
        </div>
      </div>
    </PublicLayout>
  );
}
