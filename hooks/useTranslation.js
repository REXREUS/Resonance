import useSettingsStore from '../stores/settingsStore';
import { TRANSLATIONS } from '../constants/languages';

/**
 * Hook to get translations based on user language settings
 * @returns {Object} Translation object and language code
 */
export function useTranslation() {
  // Subscribe to the entire settings object to ensure re-render on any change
  const settings = useSettingsStore((state) => state.settings);
  const language = settings?.language || 'id';

  // Get translations based on current language
  const t = TRANSLATIONS[language] || TRANSLATIONS.id;

  return {
    t,
    language,
    isIndonesian: language === 'id',
    isEnglish: language === 'en',
  };
}

export default useTranslation;
