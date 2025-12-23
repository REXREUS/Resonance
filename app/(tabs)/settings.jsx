import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import {
  Volume2,
  Vibrate,
  Globe,
  Moon,
  Key,
  Trash2,
  Info,
  ChevronRight,
  X,
  Check,
  Eye,
  EyeOff,
  DollarSign,
  RefreshCw,
  Database,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';
import { SPACING } from '../../constants/theme';
import { Card } from '../../components/ui';
import { databaseService } from '../../services/databaseService';
import useSettingsStore from '../../stores/settingsStore';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';
import { geminiService } from '../../services/geminiService';
import { elevenLabsService } from '../../services/elevenLabsService';

export default function Settings() {
  // Theme and translation hooks
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Use Zustand store for global state
  const {
    quotaUsage,
    loadSettings: loadStoreSettings,
    updateSetting: updateStoreSetting,
    updateApiKey,
    resetQuota,
  } = useSettingsStore();

  const [settings, setSettings] = useState({
    haptic_enabled: true,
    vad_sensitivity: 'medium',
    theme: 'dark',
    language: 'id',
    daily_limit: 50.0,
  });
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showVADModal, setShowVADModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);

  // API Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [validatingKeys, setValidatingKeys] = useState(false);
  const [keyValidation, setKeyValidation] = useState({ gemini: null, elevenlabs: null });

  // Budget state
  const [budgetInput, setBudgetInput] = useState('');

  // Data counts state
  const [dataCounts, setDataCounts] = useState(null);

  useEffect(() => {
    initializeSettings();
  }, []);

  const initializeSettings = async () => {
    try {
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      await loadSettings();
      await loadAPIKeys();
      await loadDataCounts();
      await loadStoreSettings();
    } catch (error) {
      console.error('Error initializing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const appSettings = await databaseService.getAppSettings();
      if (appSettings) {
        setSettings({
          haptic_enabled: appSettings.haptic_enabled === 1,
          vad_sensitivity: appSettings.vad_sensitivity || 'medium',
          theme: appSettings.theme || 'dark',
          language: appSettings.language || 'id',
          daily_limit: appSettings.daily_limit || 50.0,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadAPIKeys = async () => {
    try {
      const gemini = await databaseService.getApiKey('gemini');
      const elevenlabs = await databaseService.getApiKey('elevenlabs');
      if (gemini) setGeminiKey(gemini);
      if (elevenlabs) setElevenLabsKey(elevenlabs);
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const loadDataCounts = async () => {
    try {
      const counts = await databaseService.getDataCounts();
      setDataCounts(counts);
    } catch (error) {
      console.error('Error loading data counts:', error);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      const dbValue = key === 'haptic_enabled' ? (value ? 1 : 0) : value;
      await databaseService.updateAppSettings({ [key]: dbValue });
      
      // Map local key to store key and update global state
      const storeKeyMap = {
        'haptic_enabled': 'hapticEnabled',
        'vad_sensitivity': 'vadSensitivity',
        'daily_limit': 'dailyLimit',
        'theme': 'theme',
        'language': 'language',
      };
      const storeKey = storeKeyMap[key] || key;
      
      // Force immediate update to store for theme/language changes
      await updateStoreSetting(storeKey, value);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const validateApiKeys = async () => {
    setValidatingKeys(true);
    const validation = { gemini: null, elevenlabs: null };

    try {
      // Validate Gemini key
      if (geminiKey.trim()) {
        try {
          const isValid = await geminiService.validateApiKey(geminiKey.trim());
          validation.gemini = isValid;
        } catch {
          validation.gemini = false;
        }
      }

      // Validate ElevenLabs key
      if (elevenLabsKey.trim()) {
        try {
          const isValid = await elevenLabsService.validateApiKey(elevenLabsKey.trim());
          validation.elevenlabs = isValid;
        } catch {
          validation.elevenlabs = false;
        }
      }
    } catch (error) {
      console.error('Error validating keys:', error);
    } finally {
      setKeyValidation(validation);
      setValidatingKeys(false);
    }
  };

  const saveAPIKeys = async () => {
    setSavingKeys(true);
    try {
      if (geminiKey.trim()) {
        await databaseService.storeApiKey('gemini', geminiKey.trim());
        await updateApiKey('gemini', geminiKey.trim());
        // Initialize Gemini service with new key
        geminiService.initialize(geminiKey.trim());
      }
      if (elevenLabsKey.trim()) {
        await databaseService.storeApiKey('elevenlabs', elevenLabsKey.trim());
        await updateApiKey('elevenlabs', elevenLabsKey.trim());
        // Initialize ElevenLabs service with new key
        elevenLabsService.initialize(elevenLabsKey.trim());
      }
      Alert.alert('Success', 'API keys saved securely');
      setShowAPIModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save API keys');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      t.clearAllData || 'Clear All Data',
      t.clearAllDataWarning || 'This will delete all sessions, documents, voice assets, achievements, and quota usage. This action cannot be undone.',
      [
        { text: t.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.clear || 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Ensure database is initialized
              if (!databaseService.isInitialized) {
                await databaseService.initialize();
              }
              
              await databaseService.clearAllDataExceptSettings();
              await loadDataCounts();
              
              // Also reset quota in store
              resetQuota();
              
              Alert.alert(t.success || 'Success', t.allDataCleared || 'All data has been cleared.');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert(t.error || 'Error', 'Failed to clear data: ' + (error.message || 'Unknown error'));
            }
          },
        },
      ]
    );
  };

  const handleSelectiveClear = async (options) => {
    try {
      const result = await databaseService.selectiveDataClear(options);
      await loadDataCounts();
      
      const clearedItems = [];
      if (result.sessions > 0) clearedItems.push(`${result.sessions} sessions`);
      if (result.documents > 0) clearedItems.push(`${result.documents} documents`);
      if (result.voiceAssets > 0) clearedItems.push(`${result.voiceAssets} voice assets`);
      if (result.quotaUsage > 0) clearedItems.push(`${result.quotaUsage} quota records`);
      
      if (clearedItems.length > 0) {
        Alert.alert('Success', `Cleared: ${clearedItems.join(', ')}`);
      } else {
        Alert.alert('Info', 'No data to clear');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to clear data');
    }
  };

  const handleResetQuota = () => {
    Alert.alert(
      'Reset Quota',
      'This will reset your daily and monthly quota usage tracking. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              resetQuota();
              Alert.alert('Success', 'Quota usage has been reset');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset quota');
            }
          },
        },
      ]
    );
  };

  const handleSaveBudget = async () => {
    const value = parseFloat(budgetInput);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount greater than 0');
      return;
    }
    try {
      await updateSetting('daily_limit', value);
      setShowBudgetModal(false);
      Alert.alert('Success', `Daily budget set to $${value.toFixed(2)}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget');
    }
  };

  const SettingRow = ({ icon: Icon, title, subtitle, right, onPress, danger }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.MD,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: danger ? '#FF6B6B20' : colors.ACCENT + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: SPACING.MD,
        }}
      >
        <Icon size={20} color={danger ? '#FF6B6B' : colors.ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '500' }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </TouchableOpacity>
  );

  const OptionModal = ({ visible, onClose, title, options, selectedValue, onSelect }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          padding: SPACING.LG,
        }}
      >
        <View
          style={{
            backgroundColor: colors.CARD,
            borderRadius: 16,
            padding: SPACING.MD,
            borderWidth: 1,
            borderColor: colors.BORDER,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: SPACING.MD,
            }}
          >
            <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '700' }}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>

          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: SPACING.MD,
                borderBottomWidth: 1,
                borderBottomColor: colors.BORDER,
              }}
            >
              <View>
                <Text style={{ color: colors.TEXT, fontSize: 16 }}>{option.label}</Text>
                {option.description && (
                  <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginTop: 2 }}>
                    {option.description}
                  </Text>
                )}
              </View>
              {selectedValue === option.value && <Check size={20} color={colors.ACCENT} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.BG,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.BG }}>
      <View style={{ padding: SPACING.MD, paddingBottom: 100 }}>
        <Text
          style={{
            color: colors.TEXT,
            fontSize: 28,
            fontWeight: '700',
            marginBottom: SPACING.LG,
          }}
        >
          {t.settings}
        </Text>

        {/* Audio & Feedback */}
        <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <Text
            style={{
              color: colors.TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: SPACING.SM,
            }}
          >
            {t.audioFeedback}
          </Text>

          <SettingRow
            icon={Vibrate}
            title={t.hapticFeedback}
            subtitle={t.hapticDescription}
            right={
              <Switch
                value={settings.haptic_enabled}
                onValueChange={(value) => updateSetting('haptic_enabled', value)}
                trackColor={{ false: colors.BORDER, true: colors.ACCENT }}
                thumbColor="#fff"
              />
            }
          />

          <SettingRow
            icon={Volume2}
            title="VAD Sensitivity"
            subtitle={
              settings.vad_sensitivity === 'low'
                ? 'Low (Noise Floor + 20dB)'
                : settings.vad_sensitivity === 'high'
                  ? 'High (Noise Floor + 5dB)'
                  : 'Medium (Noise Floor + 12dB)'
            }
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => setShowVADModal(true)}
          />
        </Card>

        {/* Appearance */}
        <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <Text
            style={{
              color: colors.TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: SPACING.SM,
            }}
          >
            {t.appearance.toUpperCase()}
          </Text>

          <SettingRow
            icon={Globe}
            title={t.language}
            subtitle={settings.language === 'id' ? t.indonesian : t.english}
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => setShowLanguageModal(true)}
          />

          <SettingRow
            icon={Moon}
            title={t.theme}
            subtitle={settings.theme === 'dark' ? t.darkMode : t.lightMode}
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => setShowThemeModal(true)}
          />
        </Card>

        {/* API & Security */}
        <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <Text
            style={{
              color: colors.TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: SPACING.SM,
            }}
          >
            API & SECURITY
          </Text>

          <SettingRow
            icon={Key}
            title="API Keys"
            subtitle={
              geminiKey || elevenLabsKey ? 'Keys configured' : 'Tap to add your API keys'
            }
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => setShowAPIModal(true)}
          />

          <SettingRow
            icon={DollarSign}
            title="Daily Budget"
            subtitle={`$${settings.daily_limit.toFixed(2)} per day`}
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => {
              setBudgetInput(settings.daily_limit.toString());
              setShowBudgetModal(true);
            }}
          />
        </Card>

        {/* Data Management */}
        <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <Text
            style={{
              color: colors.TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: SPACING.SM,
            }}
          >
            DATA MANAGEMENT
          </Text>

          <SettingRow
            icon={Database}
            title="Storage Info"
            subtitle={dataCounts ? `${dataCounts.sessions} sessions, ${dataCounts.documents} docs` : 'Loading...'}
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => setShowDataModal(true)}
          />

          <SettingRow
            icon={RefreshCw}
            title="Reset Quota"
            subtitle={`Daily: $${quotaUsage.daily.toFixed(2)} used`}
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={handleResetQuota}
          />

          <SettingRow
            icon={Trash2}
            title="Clear All Data"
            subtitle="Delete sessions, documents, and voices"
            right={<ChevronRight size={20} color="#FF6B6B" />}
            onPress={handleClearData}
            danger
          />
        </Card>

        {/* About */}
        <Card variant="default" padding="md" style={{ marginBottom: SPACING.XL, backgroundColor: colors.CARD }}>
          <SettingRow
            icon={Info}
            title="About Resonance"
            subtitle="Version 1.0.0"
            right={<ChevronRight size={20} color={colors.TEXT_SECONDARY} />}
            onPress={() => setShowAboutModal(true)}
          />
        </Card>
      </View>

      {/* VAD Sensitivity Modal */}
      <OptionModal
        visible={showVADModal}
        onClose={() => setShowVADModal(false)}
        title="VAD Sensitivity"
        selectedValue={settings.vad_sensitivity}
        onSelect={(value) => updateSetting('vad_sensitivity', value)}
        options={[
          { value: 'low', label: 'Low', description: 'Noise Floor + 20dB - Less sensitive' },
          { value: 'medium', label: 'Medium', description: 'Noise Floor + 12dB - Balanced' },
          { value: 'high', label: 'High', description: 'Noise Floor + 5dB - More sensitive' },
        ]}
      />

      {/* Language Modal */}
      <OptionModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title="Language"
        selectedValue={settings.language}
        onSelect={(value) => updateSetting('language', value)}
        options={[
          { value: 'id', label: 'Indonesian', description: 'Bahasa Indonesia' },
          { value: 'en', label: 'English', description: 'English (US)' },
        ]}
      />

      {/* Theme Modal */}
      <OptionModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title="Theme"
        selectedValue={settings.theme}
        onSelect={(value) => updateSetting('theme', value)}
        options={[
          { value: 'dark', label: 'Dark Mode', description: 'Cyber-professional dark theme' },
          { value: 'light', label: 'Light Mode', description: 'Clean light theme' },
        ]}
      />

      {/* API Keys Modal */}
      <Modal
        visible={showAPIModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAPIModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: SPACING.LG,
          }}
        >
          <View
            style={{
              backgroundColor: colors.CARD,
              borderRadius: 16,
              padding: SPACING.MD,
              borderWidth: 1,
              borderColor: colors.BORDER,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: SPACING.MD,
              }}
            >
              <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '700' }}>
                API Keys
              </Text>
              <TouchableOpacity onPress={() => setShowAPIModal(false)}>
                <X size={24} color={colors.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <Text
              style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginBottom: SPACING.MD }}
            >
              Your API keys are stored securely on your device using encrypted storage.
            </Text>

            {/* Gemini API Key */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: colors.TEXT, fontSize: 14, fontWeight: '600', flex: 1 }}>
                Gemini API Key
              </Text>
              {keyValidation.gemini !== null && (
                keyValidation.gemini ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CheckCircle size={16} color="#4CAF50" />
                    <Text style={{ color: '#4CAF50', fontSize: 12, marginLeft: 4 }}>Valid</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AlertCircle size={16} color="#FF6B6B" />
                    <Text style={{ color: '#FF6B6B', fontSize: 12, marginLeft: 4 }}>Invalid</Text>
                  </View>
                )
              )}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.BG,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: keyValidation.gemini === false ? '#FF6B6B' : colors.BORDER,
                marginBottom: SPACING.MD,
              }}
            >
              <TextInput
                value={geminiKey}
                onChangeText={(text) => {
                  setGeminiKey(text);
                  setKeyValidation(prev => ({ ...prev, gemini: null }));
                }}
                placeholder="Enter Gemini API key"
                placeholderTextColor={colors.TEXT_SECONDARY}
                secureTextEntry={!showGeminiKey}
                style={{ flex: 1, color: colors.TEXT, padding: 12 }}
              />
              <TouchableOpacity
                onPress={() => setShowGeminiKey(!showGeminiKey)}
                style={{ padding: 12 }}
              >
                {showGeminiKey ? (
                  <EyeOff size={20} color={colors.TEXT_SECONDARY} />
                ) : (
                  <Eye size={20} color={colors.TEXT_SECONDARY} />
                )}
              </TouchableOpacity>
            </View>

            {/* ElevenLabs API Key */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: colors.TEXT, fontSize: 14, fontWeight: '600', flex: 1 }}>
                ElevenLabs API Key
              </Text>
              {keyValidation.elevenlabs !== null && (
                keyValidation.elevenlabs ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CheckCircle size={16} color="#4CAF50" />
                    <Text style={{ color: '#4CAF50', fontSize: 12, marginLeft: 4 }}>Valid</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AlertCircle size={16} color="#FF6B6B" />
                    <Text style={{ color: '#FF6B6B', fontSize: 12, marginLeft: 4 }}>Invalid</Text>
                  </View>
                )
              )}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.BG,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: keyValidation.elevenlabs === false ? '#FF6B6B' : colors.BORDER,
                marginBottom: SPACING.MD,
              }}
            >
              <TextInput
                value={elevenLabsKey}
                onChangeText={(text) => {
                  setElevenLabsKey(text);
                  setKeyValidation(prev => ({ ...prev, elevenlabs: null }));
                }}
                placeholder="Enter ElevenLabs API key"
                placeholderTextColor={colors.TEXT_SECONDARY}
                secureTextEntry={!showElevenLabsKey}
                style={{ flex: 1, color: colors.TEXT, padding: 12 }}
              />
              <TouchableOpacity
                onPress={() => setShowElevenLabsKey(!showElevenLabsKey)}
                style={{ padding: 12 }}
              >
                {showElevenLabsKey ? (
                  <EyeOff size={20} color={colors.TEXT_SECONDARY} />
                ) : (
                  <Eye size={20} color={colors.TEXT_SECONDARY} />
                )}
              </TouchableOpacity>
            </View>

            {/* Validate Button */}
            <TouchableOpacity
              onPress={validateApiKeys}
              disabled={validatingKeys || (!geminiKey.trim() && !elevenLabsKey.trim())}
              style={{
                backgroundColor: 'transparent',
                borderRadius: 8,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.ACCENT,
                marginBottom: SPACING.SM,
                opacity: (!geminiKey.trim() && !elevenLabsKey.trim()) ? 0.5 : 1,
              }}
            >
              {validatingKeys ? (
                <ActivityIndicator color={colors.ACCENT} />
              ) : (
                <Text style={{ color: colors.ACCENT, fontSize: 14, fontWeight: '600' }}>
                  Validate Keys
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={saveAPIKeys}
              disabled={savingKeys}
              style={{
                backgroundColor: colors.ACCENT,
                borderRadius: 8,
                padding: 14,
                alignItems: 'center',
              }}
            >
              {savingKeys ? (
                <ActivityIndicator color={colors.BG} />
              ) : (
                <Text style={{ color: colors.BG, fontSize: 16, fontWeight: '600' }}>
                  Save Keys
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Budget Modal */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: SPACING.LG,
          }}
        >
          <View
            style={{
              backgroundColor: colors.CARD,
              borderRadius: 16,
              padding: SPACING.MD,
              borderWidth: 1,
              borderColor: colors.BORDER,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: SPACING.MD,
              }}
            >
              <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '700' }}>
                Daily Budget
              </Text>
              <TouchableOpacity onPress={() => setShowBudgetModal(false)}>
                <X size={24} color={colors.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <Text
              style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginBottom: SPACING.MD }}
            >
              Set your daily spending limit for API usage. You'll be warned when approaching this limit.
            </Text>

            <Text style={{ color: colors.TEXT, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Amount (USD)
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.BG,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.BORDER,
                marginBottom: SPACING.MD,
              }}
            >
              <Text style={{ color: colors.ACCENT, fontSize: 18, paddingLeft: 12 }}>$</Text>
              <TextInput
                value={budgetInput}
                onChangeText={setBudgetInput}
                placeholder="50.00"
                placeholderTextColor={colors.TEXT_SECONDARY}
                keyboardType="decimal-pad"
                style={{ flex: 1, color: colors.TEXT, padding: 12, fontSize: 18 }}
              />
            </View>

            {/* Quick select buttons */}
            <View style={{ flexDirection: 'row', marginBottom: SPACING.LG, gap: 8 }}>
              {[10, 25, 50, 100].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setBudgetInput(amount.toString())}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: budgetInput === amount.toString() ? colors.ACCENT : colors.BORDER,
                    backgroundColor: budgetInput === amount.toString() ? colors.ACCENT + '20' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: budgetInput === amount.toString() ? colors.ACCENT : colors.TEXT,
                      fontWeight: '600',
                    }}
                  >
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSaveBudget}
              style={{
                backgroundColor: colors.ACCENT,
                borderRadius: 8,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.BG, fontSize: 16, fontWeight: '600' }}>
                Save Budget
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: SPACING.LG,
          }}
        >
          <View
            style={{
              backgroundColor: colors.CARD,
              borderRadius: 16,
              padding: SPACING.LG,
              borderWidth: 1,
              borderColor: colors.BORDER,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: colors.ACCENT,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: SPACING.MD,
              }}
            >
              <Text style={{ fontSize: 40 }}>🎯</Text>
            </View>

            <Text style={{ color: colors.TEXT, fontSize: 24, fontWeight: '700' }}>
              Resonance
            </Text>
            <Text style={{ color: colors.ACCENT, fontSize: 14, marginTop: 4 }}>
              Version 1.0.0
            </Text>

            <Text
              style={{
                color: colors.TEXT_SECONDARY,
                fontSize: 14,
                textAlign: 'center',
                marginTop: SPACING.MD,
                lineHeight: 22,
              }}
            >
              High-stakes communication training through real-time AI voice interactions.
            </Text>

            <View
              style={{
                marginTop: SPACING.LG,
                paddingTop: SPACING.MD,
                borderTopWidth: 1,
                borderTopColor: colors.BORDER,
                width: '100%',
              }}
            >
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, textAlign: 'center' }}>
                Powered by
              </Text>
              <Text style={{ color: colors.TEXT, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                Gemini 2.5 Flash • ElevenLabs
              </Text>
               <Text style={{ color: colors.TEXT, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                @rexreus
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowAboutModal(false)}
              style={{
                marginTop: SPACING.LG,
                paddingVertical: 12,
                paddingHorizontal: 32,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.ACCENT,
              }}
            >
              <Text style={{ color: colors.ACCENT, fontSize: 16, fontWeight: '600' }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Data Management Modal */}
      <Modal
        visible={showDataModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDataModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: SPACING.LG,
          }}
        >
          <View
            style={{
              backgroundColor: colors.CARD,
              borderRadius: 16,
              padding: SPACING.MD,
              borderWidth: 1,
              borderColor: colors.BORDER,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: SPACING.MD,
              }}
            >
              <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '700' }}>
                Storage Info
              </Text>
              <TouchableOpacity onPress={() => setShowDataModal(false)}>
                <X size={24} color={colors.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            {dataCounts && (
              <View style={{ marginBottom: SPACING.MD }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.BORDER }}>
                  <Text style={{ color: colors.TEXT_SECONDARY }}>Sessions</Text>
                  <Text style={{ color: colors.TEXT, fontWeight: '600' }}>{dataCounts.sessions}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.BORDER }}>
                  <Text style={{ color: colors.TEXT_SECONDARY }}>Documents</Text>
                  <Text style={{ color: colors.TEXT, fontWeight: '600' }}>{dataCounts.documents}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.BORDER }}>
                  <Text style={{ color: colors.TEXT_SECONDARY }}>Voice Assets</Text>
                  <Text style={{ color: colors.TEXT, fontWeight: '600' }}>{dataCounts.voiceAssets} ({dataCounts.userVoices} custom)</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: colors.TEXT_SECONDARY }}>Quota Records</Text>
                  <Text style={{ color: colors.TEXT, fontWeight: '600' }}>{dataCounts.quotaUsage}</Text>
                </View>
              </View>
            )}

            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginBottom: SPACING.MD }}>
              Selective Clear Options
            </Text>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Clear Sessions', 'Delete all training sessions and transcripts?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => handleSelectiveClear({ clearSessions: true }) }
                ]);
              }}
              style={{
                backgroundColor: colors.BG,
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Trash2 size={18} color="#FF6B6B" style={{ marginRight: 12 }} />
              <Text style={{ color: colors.TEXT, flex: 1 }}>Clear Sessions Only</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Clear Documents', 'Delete all uploaded documents?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => handleSelectiveClear({ clearDocuments: true }) }
                ]);
              }}
              style={{
                backgroundColor: colors.BG,
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Trash2 size={18} color="#FF6B6B" style={{ marginRight: 12 }} />
              <Text style={{ color: colors.TEXT, flex: 1 }}>Clear Documents Only</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Clear Voice Assets', 'Delete custom voice clones? System voices will be preserved.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => handleSelectiveClear({ clearVoiceAssets: true, preserveSystemVoices: true }) }
                ]);
              }}
              style={{
                backgroundColor: colors.BG,
                borderRadius: 8,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Trash2 size={18} color="#FF6B6B" style={{ marginRight: 12 }} />
              <Text style={{ color: colors.TEXT, flex: 1 }}>Clear Custom Voices</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDataModal(false)}
              style={{
                marginTop: SPACING.MD,
                paddingVertical: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.ACCENT,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.ACCENT, fontSize: 16, fontWeight: '600' }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}



