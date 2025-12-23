import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FileText, Plus, X, Zap } from 'lucide-react-native';
import { documentProcessor } from '../utils/documentProcessor';
import { databaseService } from '../services/databaseService';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import { NOISE_TYPES } from '../constants/audio';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';
import useSettingsStore from '../stores/settingsStore';

// New UI Components
import { Button, Card, Header, Toggle, Slider, TabSwitch, Dropdown, Badge } from '../components/ui';

const SCENARIOS = [
  // Sales & Negotiation
  'crisis-negotiation',
  'sales-objection',
  'price-negotiation',
  'contract-negotiation',
  'closing-deal',
  
  // Customer Service
  'customer-complaint',
  'refund-request',
  'technical-support',
  'service-recovery',
  'escalation-handling',
  
  // Management & HR
  'performance-review',
  'difficult-conversation',
  'termination-meeting',
  'salary-negotiation',
  'conflict-resolution',
  
  // Presentations & Meetings
  'presentation-qa',
  'investor-pitch',
  'board-meeting',
  'team-briefing',
  
  // Other
  'job-interview',
  'media-interview',
  'cold-calling',
  'debt-collection',
  'insurance-claim',
];

const LANGUAGES = [
  { code: 'id', name: 'Indonesian' },
  { code: 'en', name: 'English' },
];

export default function SessionSetup() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  // Settings store
  const { settings, isApiConfigured } = useSettingsStore();
  
  // Configuration state
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [language, setLanguage] = useState(settings.language || 'id'); // Default to Indonesian
  const [mode, setMode] = useState('single');
  const [queueLength, setQueueLength] = useState(3);
  const [interCallDelay, setInterCallDelay] = useState(5);
  const [difficultyCurve, setDifficultyCurve] = useState(50);
  
  // Chaos Engine settings
  const [randomVoiceGen, setRandomVoiceGen] = useState(false);
  const [backgroundNoise, setBackgroundNoise] = useState(false);
  const [hardwareFailure, setHardwareFailure] = useState(false);
  const [noiseType, setNoiseType] = useState(NOISE_TYPES[0]);
  
  // Context files
  const [contextFiles, setContextFiles] = useState([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [contextTab, setContextTab] = useState('manual');
  const [manualContext, setManualContext] = useState('');
  
  // UI Preferences
  const [blindMode, setBlindMode] = useState(false);
  
  // UI state
  const [isInitializing, setIsInitializing] = useState(false);
  const [defaultVoice, setDefaultVoice] = useState(null);

  useEffect(() => {
    loadInitialData();
    
    // Handle retry config from report screen
    if (params.retryConfig) {
      try {
        const retryConfig = JSON.parse(params.retryConfig);
        console.log('Received retry config:', retryConfig);
        
        if (retryConfig.scenario) {
          // Normalize scenario to match SCENARIOS format
          const normalizedScenario = retryConfig.scenario
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          
          // Check if scenario exists in SCENARIOS list
          const matchedScenario = SCENARIOS.find(s => s === normalizedScenario);
          if (matchedScenario) {
            setScenario(matchedScenario);
          } else {
            console.warn('Scenario not found in list:', normalizedScenario);
            // Try to find partial match
            const partialMatch = SCENARIOS.find(s => 
              s.includes(normalizedScenario) || normalizedScenario.includes(s)
            );
            if (partialMatch) {
              setScenario(partialMatch);
            }
          }
        }
        if (retryConfig.mode) setMode(retryConfig.mode);
        if (retryConfig.language) setLanguage(retryConfig.language);
        
        console.log('Applied retry config, scenario:', scenario);
      } catch (e) {
        console.warn('Failed to parse retry config:', e);
      }
    }
  }, [params.retryConfig]);

  const loadInitialData = useCallback(async () => {
    try {
      // Load context files
      await loadContextFiles();
      
      // Load default voice
      const voice = await databaseService.getDefaultVoice();
      if (voice) {
        setDefaultVoice(voice);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, []);

  const loadContextFiles = async () => {
    try {
      const files = await databaseService.getContextFiles();
      setContextFiles(files || []);
    } catch (error) {
      console.error('Failed to load context files:', error);
    }
  };

  const handleFileUpload = async () => {
    if (isUploadingFile) return;
    
    setIsUploadingFile(true);
    try {
      const document = await documentProcessor.pickDocument();
      
      if (document) {
        if (!documentProcessor.validateDocument(document)) {
          Alert.alert(
            t.error,
            t.invalidDocumentMessage || 'Please select a valid PDF, DOCX, DOC, or TXT file under 10MB.'
          );
          return;
        }

        const fileId = await databaseService.createContextFile(
          document.name,
          document.content,
          document.size
        );
        console.log('Context file created with ID:', fileId);

        await loadContextFiles();

        Alert.alert(
          t.success,
          `${t.documentUploaded || 'Document uploaded'}: "${document.name}"`
        );
      }
    } catch (error) {
      console.error('File upload failed:', error);
      Alert.alert(
        t.error,
        t.uploadFailed || 'Failed to upload document. Please try again.'
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveFile = async (fileId, fileName) => {
    Alert.alert(
      t.removeFile,
      `${t.confirmRemove || 'Are you sure you want to remove'} "${fileName}"?`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteContextFile(fileId);
              await loadContextFiles();
            } catch (error) {
              console.error('Failed to remove file:', error);
              Alert.alert(t.error, t.failedToRemove || 'Failed to remove document.');
            }
          },
        },
      ]
    );
  };

  const validateConfiguration = () => {
    if (!scenario) {
      Alert.alert(t.error, t.selectScenario);
      return false;
    }

    if (mode === 'stress' && queueLength < 1) {
      Alert.alert(t.error, t.queueLengthError || 'Queue length must be at least 1 for stress test mode.');
      return false;
    }

    // Validate API keys if not in mock mode
    if (!settings.mockMode) {
      if (!isApiConfigured()) {
        Alert.alert(
          t.apiConfiguration || 'API Configuration',
          t.apiKeysRequired || 'Please configure your API keys in settings before starting a session.',
          [
            { text: t.cancel, style: 'cancel' },
            { 
              text: t.settings, 
              onPress: () => router.push('/settings')
            }
          ]
        );
        return false;
      }
    }

    return true;
  };

  const handleInitializeSession = async () => {
    if (!validateConfiguration()) {
      return;
    }

    setIsInitializing(true);
    
    try {
      // Determine if chaos engine should be enabled
      const chaosEnabled = randomVoiceGen || backgroundNoise || hardwareFailure;
      
      // Create session configuration object
      const sessionConfig = {
        scenario,
        language,
        mode,
        queueLength: mode === 'stress' ? queueLength : 1,
        interCallDelay: mode === 'stress' ? interCallDelay : 0,
        difficultyCurve: mode === 'stress' ? difficultyCurve : 50,
        chaosEngine: {
          enabled: chaosEnabled,
          randomVoiceGen,
          backgroundNoise,
          hardwareFailure,
          noiseType: backgroundNoise ? noiseType : 'office',
          intensity: 0.5, // Default intensity
          frequency: 30, // Seconds between automatic disruptions
        },
        manualContext: manualContext.trim(),
        contextFiles: contextFiles.map(file => ({
          id: file.id,
          name: file.file_name,
          content: file.extracted_text_content,
        })),
        // Voice settings
        defaultVoice: defaultVoice ? {
          voiceId: defaultVoice.voice_id,
          name: defaultVoice.name,
          stability: defaultVoice.stability,
          similarity: defaultVoice.similarity,
        } : null,
        // UI preferences
        blindMode,
        // Mock mode from settings
        mockMode: settings.mockMode,
        // VAD sensitivity from settings
        vadSensitivity: settings.vadSensitivity,
        timestamp: Date.now(),
      };

      // Create session record in database
      const sessionId = await databaseService.createSession({
        timestamp: sessionConfig.timestamp,
        scenario: sessionConfig.scenario,
        mode: sessionConfig.mode,
        completed: 0,
      });

      // Navigate to appropriate screen based on mode
      const targetScreen = mode === 'stress' ? '/stress-mode' : '/simulation';
      
      router.push({
        pathname: targetScreen,
        params: {
          sessionId,
          config: JSON.stringify(sessionConfig),
        },
      });
    } catch (error) {
      console.error('Failed to initialize session:', error);
      Alert.alert(
        t.error,
        t.initializationFailed || 'Failed to initialize session. Please try again.'
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const scenarioOptions = SCENARIOS.map(s => ({
    label: t[s.replace(/-/g, '')] || s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: s,
  }));

  const languageOptions = LANGUAGES.map(lang => ({
    label: lang.code === 'id' ? t.indonesian : t.english,
    value: lang.code,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
      {/* Header */}
      <Header
        title={t.sessionSetup}
        variant="themed"
        showBack
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.MD }}>
        {/* Scenario Context Card */}
        <Card variant="default" padding="lg" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.TEXT, marginBottom: SPACING.MD }}>
            {t.selectScenario}
          </Text>

          {/* Simulation Category */}
          <Dropdown
            label={t.scenario}
            options={scenarioOptions}
            value={scenario}
            onChange={setScenario}
            style={{ marginBottom: SPACING.MD }}
          />

          {/* Target Language */}
          <Dropdown
            label={t.selectLanguage}
            options={languageOptions}
            value={language}
            onChange={setLanguage}
            style={{ marginBottom: SPACING.MD }}
          />

          {/* Context Section with Tabs */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.TEXT_SECONDARY, marginBottom: SPACING.SM }}>
            {t.context || 'Context'}
          </Text>
          
          <TabSwitch
            tabs={[
              { key: 'manual', label: t.manualInput || 'Manual' },
              { key: 'file', label: t.fromFile || 'From File' },
            ]}
            activeTab={contextTab}
            onTabChange={setContextTab}
            fullWidth
            style={{ marginBottom: SPACING.MD }}
          />

          {/* Manual Context Input */}
          {contextTab === 'manual' && (
            <View style={{ marginBottom: SPACING.MD }}>
              <TextInput
                value={manualContext}
                onChangeText={setManualContext}
                placeholder={t.enterContextPlaceholder || "Enter scenario context, product details, customer information, or any relevant background..."}
                placeholderTextColor={colors.TEXT_SECONDARY}
                multiline
                numberOfLines={6}
                style={{
                  backgroundColor: colors.BG,
                  borderRadius: BORDER_RADIUS.MD,
                  padding: SPACING.MD,
                  color: colors.TEXT,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: colors.BORDER,
                  textAlignVertical: 'top',
                  minHeight: 120,
                }}
              />
              <Text style={{ fontSize: 12, color: colors.TEXT_SECONDARY, marginTop: SPACING.XS }}>
                {manualContext.length}/2000 {t.characters || 'characters'}
              </Text>
            </View>
          )}

          {/* File Upload Context */}
          {contextTab === 'file' && (
            <View style={{ marginBottom: SPACING.MD }}>
              <TouchableOpacity
                onPress={handleFileUpload}
                disabled={isUploadingFile}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.BG,
                  padding: SPACING.MD,
                  borderRadius: BORDER_RADIUS.LG,
                  borderWidth: 1,
                  borderColor: colors.BORDER,
                  borderStyle: 'dashed',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FileText size={20} color={colors.TEXT_SECONDARY} />
                  <View style={{ marginLeft: SPACING.SM }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.TEXT }}>
                      {t.contextFiles || 'Context Files'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.TEXT_SECONDARY }}>
                      {t.uploadPdfDocx || 'Upload PDF/DOCX for scenario context'}
                    </Text>
                  </View>
                </View>
                {isUploadingFile ? (
                  <ActivityIndicator size="small" color={colors.ACCENT} />
                ) : (
                  <Plus size={20} color={colors.ACCENT} />
                )}
              </TouchableOpacity>

              {/* Uploaded Files List */}
              {contextFiles.length > 0 && (
                <View style={{ marginTop: SPACING.SM }}>
                  {contextFiles.map((file) => (
                    <View
                      key={file.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: colors.BG,
                        padding: SPACING.SM,
                        borderRadius: BORDER_RADIUS.MD,
                        marginTop: SPACING.XS,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <FileText size={16} color={colors.ACCENT} />
                        <View style={{ marginLeft: SPACING.SM, flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.TEXT }} numberOfLines={1}>
                            {file.file_name}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.TEXT_SECONDARY }}>
                            {Math.round(file.file_size / 1024)} KB
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveFile(file.id, file.file_name)}
                        style={{ padding: SPACING.XS }}
                      >
                        <X size={18} color={colors.ERROR || '#FF6B6B'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Simulation Mode Card */}
        <Card variant="default" padding="lg" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.MD }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.TEXT }}>
              {t.mode}
            </Text>
            <Badge variant="outline" size="sm">ⓘ</Badge>
          </View>

          {/* Mode Toggle */}
          <TabSwitch
            tabs={[
              { key: 'single', label: t.standardTraining },
              { key: 'stress', label: t.stressMode },
            ]}
            activeTab={mode}
            onTabChange={setMode}
            fullWidth
            style={{ marginBottom: SPACING.MD }}
          />

          {/* Stress Test Configuration */}
          {mode === 'stress' && (
            <View>
              {/* Queue Length */}
              <Slider
                label={t.queueLength}
                value={queueLength}
                onValueChange={setQueueLength}
                min={1}
                max={50}
                step={1}
                showValue
                style={{ marginBottom: SPACING.MD }}
              />

              {/* Inter-call Delay */}
              <Slider
                label={t.interCallDelay}
                value={interCallDelay}
                onValueChange={setInterCallDelay}
                min={0}
                max={30}
                step={1}
                unit="s"
                showValue
                style={{ marginBottom: SPACING.MD }}
              />

              {/* Difficulty Curve */}
              <Slider
                label={t.difficultyCurve || 'Difficulty Curve'}
                value={difficultyCurve}
                onValueChange={setDifficultyCurve}
                min={0}
                max={100}
                step={10}
                showValue
                unit="%"
              />
            </View>
          )}

        </Card>

        {/* Initialize Button */}
        <Button
          variant="primary"
          size="xl"
          fullWidth
          onPress={handleInitializeSession}
          loading={isInitializing}
          icon={<Text style={{ fontSize: 16 }}>▶</Text>}
          style={{ marginBottom: SPACING.LG }}
        >
          {t.startSimulation}
        </Button>

        {/* Chaos Engine Section */}
        <View style={{ marginBottom: SPACING.MD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.MD }}>
            <Zap size={20} color={colors.ACCENT} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.TEXT, marginLeft: SPACING.XS }}>
              {t.chaosEngine}
            </Text>
          </View>

          {/* Random Voice Gen */}
          <Toggle
            label={t.randomVoiceGen}
            description={t.randomVoiceDesc}
            value={randomVoiceGen}
            onValueChange={setRandomVoiceGen}
            style={{ marginBottom: SPACING.MD }}
          />

          {/* Background Noise */}
          <Toggle
            label={t.backgroundNoise}
            description={t.backgroundNoiseDesc}
            value={backgroundNoise}
            onValueChange={setBackgroundNoise}
            style={{ marginBottom: SPACING.SM }}
          />

          {/* Noise Type Selector - only show when background noise is enabled */}
          {backgroundNoise && (
            <Dropdown
              label={t.noiseType || 'Noise Type'}
              options={NOISE_TYPES.map(type => ({
                label: t[type] || type.charAt(0).toUpperCase() + type.slice(1),
                value: type,
              }))}
              value={noiseType}
              onChange={setNoiseType}
              style={{ marginBottom: SPACING.MD, marginLeft: SPACING.LG }}
            />
          )}

          {!backgroundNoise && <View style={{ marginBottom: SPACING.SM }} />}

          {/* Hardware Failure */}
          <Toggle
            label={t.hardwareFailure}
            description={t.hardwareFailureDesc}
            value={hardwareFailure}
            onValueChange={setHardwareFailure}
            style={{ marginBottom: SPACING.MD }}
          />
        </View>

        {/* UI Preferences */}
        <View style={{ marginBottom: SPACING.XL }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.TEXT, marginBottom: SPACING.MD }}>
            {t.uiPreferences || 'UI Preferences'}
          </Text>

          <Toggle
            label={t.blindMode || 'Blind Mode 🔇'}
            description={t.blindModeDesc || 'Hide all visual transcripts & cues'}
            value={blindMode}
            onValueChange={setBlindMode}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}