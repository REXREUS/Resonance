import { create } from 'zustand';
import { databaseService } from '../services/databaseService';
import { AUDIO_CONFIG } from '../constants/audio';

const useSettingsStore = create((set, get) => ({
  // Settings state
  settings: {
    theme: 'dark',
    language: 'en',
    dailyLimit: 50.0,
    hapticEnabled: true,
    vadSensitivity: 'medium',
    mockMode: false,
    debugLogs: false,
    audioInputDevice: 'default',
    audioOutputDevice: 'default',
  },
  
  // API keys state
  apiKeys: {
    elevenlabs: '',
    gemini: '',
  },
  
  // Quota tracking state
  quotaUsage: {
    daily: 0,
    monthly: 0,
    lastReset: Date.now(),
  },
  
  // Loading state
  isLoading: false,
  
  // Actions
  loadSettings: async () => {
    set({ isLoading: true });
    
    try {
      // Load app settings from database
      const appSettings = await databaseService.getAppSettings();
      if (appSettings) {
        set({
          settings: {
            theme: appSettings.theme || 'dark',
            language: appSettings.language || 'en',
            dailyLimit: appSettings.daily_limit || 50.0,
            hapticEnabled: appSettings.haptic_enabled === 1,
            vadSensitivity: appSettings.vad_sensitivity || 'medium',
            mockMode: appSettings.mock_mode === 1,
            debugLogs: appSettings.debug_logs === 1,
            audioInputDevice: appSettings.audio_input_device || 'default',
            audioOutputDevice: appSettings.audio_output_device || 'default',
          },
        });
      }
      
      // Load API keys from secure storage
      const elevenLabsKey = await databaseService.getApiKey('elevenlabs');
      const geminiKey = await databaseService.getApiKey('gemini');
      
      set({
        apiKeys: {
          elevenlabs: elevenLabsKey || '',
          gemini: geminiKey || '',
        },
      });
      
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  updateSetting: async (key, value) => {
    const currentSettings = get().settings;
    const newSettings = { ...currentSettings, [key]: value };
    
    // Immediately update state for reactivity
    set({ settings: newSettings });
    
    try {
      // Convert boolean values to integers for database
      const dbSettings = {
        theme: newSettings.theme,
        language: newSettings.language,
        daily_limit: newSettings.dailyLimit,
        haptic_enabled: newSettings.hapticEnabled ? 1 : 0,
        vad_sensitivity: newSettings.vadSensitivity,
        mock_mode: newSettings.mockMode ? 1 : 0,
        debug_logs: newSettings.debugLogs ? 1 : 0,
        audio_input_device: newSettings.audioInputDevice,
        audio_output_device: newSettings.audioOutputDevice,
      };
      
      await databaseService.updateAppSettings(dbSettings);
    } catch (error) {
      console.error('Error saving setting:', error);
      // Revert the change on error
      set({ settings: currentSettings });
      throw error;
    }
  },
  
  updateApiKey: async (service, apiKey) => {
    try {
      if (apiKey.trim()) {
        await databaseService.storeApiKey(service, apiKey.trim());
      } else {
        await databaseService.deleteApiKey(service);
      }
      
      set(state => ({
        apiKeys: {
          ...state.apiKeys,
          [service]: apiKey.trim(),
        },
      }));
    } catch (error) {
      console.error('Error updating API key:', error);
      throw error;
    }
  },
  
  trackApiUsage: (service, cost) => {
    const currentUsage = get().quotaUsage;
    const today = new Date().toDateString();
    const lastResetDate = new Date(currentUsage.lastReset).toDateString();
    
    // Reset daily usage if it's a new day
    let dailyUsage = currentUsage.daily;
    if (today !== lastResetDate) {
      dailyUsage = 0;
    }
    
    set({
      quotaUsage: {
        daily: dailyUsage + cost,
        monthly: currentUsage.monthly + cost,
        lastReset: today !== lastResetDate ? Date.now() : currentUsage.lastReset,
      },
    });
  },
  
  checkDailyLimit: () => {
    const { settings, quotaUsage } = get();
    return quotaUsage.daily < settings.dailyLimit;
  },
  
  getRemainingQuota: () => {
    const { settings, quotaUsage } = get();
    return Math.max(0, settings.dailyLimit - quotaUsage.daily);
  },
  
  getVadThreshold: (noiseFloor) => {
    const { settings } = get();
    const sensitivity = settings.vadSensitivity;
    const thresholdOffset = AUDIO_CONFIG.VAD_SENSITIVITY[sensitivity.toUpperCase()];
    return noiseFloor + thresholdOffset;
  },
  
  isDarkTheme: () => {
    const { settings } = get();
    if (settings.theme === 'system') {
      // For now, default to dark on system
      return true;
    }
    return settings.theme === 'dark';
  },
  
  isApiConfigured: () => {
    const { apiKeys } = get();
    return apiKeys.elevenlabs.length > 0 && apiKeys.gemini.length > 0;
  },
  
  exportSettings: () => {
    const { settings, quotaUsage } = get();
    return {
      settings,
      quotaUsage,
      exportDate: new Date().toISOString(),
    };
  },
  
  resetQuota: () => {
    set({
      quotaUsage: {
        daily: 0,
        monthly: 0,
        lastReset: Date.now(),
      },
    });
  },
}));

export default useSettingsStore;