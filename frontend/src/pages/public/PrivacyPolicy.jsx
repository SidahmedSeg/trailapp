import { useTranslation } from 'react-i18next';
import PublicLayout from '../../components/ui/PublicLayout';

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <PublicLayout title={t('privacy.title')}>
      <div className="py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 md:p-10 space-y-8">

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.dataCollected.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.dataCollected.text')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.websiteData.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.websiteData.text')}</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ps-2">
              <li>{t('privacy.websiteData.items.session')}</li>
              <li>{t('privacy.websiteData.items.analytics')}</li>
              <li>{t('privacy.websiteData.items.performance')}</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.websiteData.note')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.dataUsage.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.dataUsage.text')}</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ps-2">
              <li>{t('privacy.dataUsage.items.registration')}</li>
              <li>{t('privacy.dataUsage.items.bib')}</li>
              <li>{t('privacy.dataUsage.items.communication')}</li>
              <li>{t('privacy.dataUsage.items.medical')}</li>
              <li>{t('privacy.dataUsage.items.results')}</li>
              <li>{t('privacy.dataUsage.items.payment')}</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.dataUsage.noMarketing')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.dataSharing.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.dataSharing.text')}</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ps-2">
              <li>{t('privacy.dataSharing.items.satim')}</li>
              <li>{t('privacy.dataSharing.items.officials')}</li>
              <li>{t('privacy.dataSharing.items.authorities')}</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed font-medium">{t('privacy.dataSharing.noSale')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.dataSecurity.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.dataSecurity.text')}</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ps-2">
              <li>{t('privacy.dataSecurity.items.ssl')}</li>
              <li>{t('privacy.dataSecurity.items.satim')}</li>
              <li>{t('privacy.dataSecurity.items.access')}</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.dataSecurity.note')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.changes.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.changes.text')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.thirdParty.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.thirdParty.text')}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">{t('privacy.contact.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.contact.rights')}</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p className="font-semibold">{t('privacy.contact.org')}</p>
              <p>{t('privacy.contact.address')}</p>
              <p>Email : <a href="mailto:contact@lassm.dz" className="text-[#C42826] hover:underline">contact@lassm.dz</a></p>
            </div>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t">{t('privacy.lastUpdate')}</p>
        </div>
      </div>
    </PublicLayout>
  );
}
