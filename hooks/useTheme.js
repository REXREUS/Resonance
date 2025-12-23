import useSettingsStore from '../stores/settingsStore';
import { COLORS } from '../constants/theme';

/**
 * Hook to get theme colors based on user settings
 * @returns {Object} Theme colors object
 */
export function useTheme() {
  // Subscribe to theme specifically for better reactivity
  const theme = useSettingsStore((state) => state.settings?.theme) || 'dark';

  // Get colors based on current theme
  const colors =
    theme === 'light'
      ? {
          BG: COLORS.LIGHT_BG,
          CARD: COLORS.LIGHT_CARD,
          BORDER: COLORS.LIGHT_BORDER,
          TEXT: COLORS.LIGHT_TEXT,
          TEXT_SECONDARY: COLORS.LIGHT_TEXT_SECONDARY,
          ACCENT: COLORS.CYBER_YELLOW,
          SUCCESS: COLORS.SUCCESS,
          WARNING: COLORS.WARNING,
          ERROR: COLORS.ERROR,
          INFO: COLORS.INFO,
        }
      : {
          BG: COLORS.DARK_BG,
          CARD: COLORS.DARK_CARD,
          BORDER: COLORS.DARK_BORDER,
          TEXT: COLORS.DARK_TEXT,
          TEXT_SECONDARY: COLORS.DARK_TEXT_SECONDARY,
          ACCENT: COLORS.CYBER_YELLOW,
          SUCCESS: COLORS.SUCCESS,
          WARNING: COLORS.WARNING,
          ERROR: COLORS.ERROR,
          INFO: COLORS.INFO,
        };

  return {
    colors,
    isDark: theme === 'dark',
    theme,
  };
}

export default useTheme;
