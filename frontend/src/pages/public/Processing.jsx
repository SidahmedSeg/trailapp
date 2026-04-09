import { useTranslation } from 'react-i18next';
import PublicLayout from '../../components/ui/PublicLayout';

export default function Processing() {
  const { t } = useTranslation();

  return (
    <PublicLayout title={t('processing.title')}>
      <div className="flex items-center justify-center px-4 py-20">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 border-4 border-[#C42826]/30 border-t-[#C42826] rounded-full animate-spin" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{t('processing.heading')}</h1>
            <p className="text-gray-500 mt-2 text-sm">{t('processing.message')}</p>
            <p className="text-gray-400 mt-1 text-xs">{t('processing.doNotClose')}</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
