import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { audioEngine } from '../services/audioEngine';
import { vadService } from '../services/vadService';
import { databaseService } from '../services/databaseService';
import { quotaService } from '../services/quotaService';
import { TRANSLATIONS } from '../constants/languages';

// New UI Components
import { ProgressBar } from '../components/ui';
import { VoiceOrb, WaveformVisualizer } from '../components/audio';

export default function Splash() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [calibrationStatus, setCalibrationStatus] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [language, setLanguage] = useState('id');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Get translations based on language
  const t = TRANSLATIONS[language] || TRANSLATIONS.id;

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Step 1: Initialize database and load settings (20% progress)
      setCalibrationStatus(t.loadingSettings || 'Loading settings...');
      let vadSensitivity = 'medium';
      let userLanguage = 'id';
      let onboardingCompleted = false;
      try {
        await databaseService.initialize();
        await quotaService.initialize(); // Initialize quota tracking
        const appSettings = await databaseService.getAppSettings();
        if (appSettings?.vad_sensitivity) {
          vadSensitivity = appSettings.vad_sensitivity;
        }
        if (appSettings?.language) {
          userLanguage = appSettings.language;
          setLanguage(userLanguage);
        }
        onboardingCompleted = await databaseService.hasCompletedOnboarding();
        setHasCompletedOnboarding(onboardingCompleted);
      } catch (dbError) {
        console.warn('Failed to load settings, using defaults:', dbError);
      }
      setProgress(20);

      // Get updated translations
      const currentT = TRANSLATIONS[userLanguage] || TRANSLATIONS.id;

      // Step 2: Initialize audio engine (40% progress)
      setCalibrationStatus(currentT.initializingAudio || 'Initializing audio engine...');
      try {
        await audioEngine.initialize();
      } catch (audioError) {
        console.warn('Audio engine initialization failed, continuing without audio:', audioError);
      }
      setProgress(40);

      // Step 3: Initialize VAD service with user's sensitivity setting (60% progress)
      setCalibrationStatus(currentT.settingUpVoice || 'Setting up voice detection...');
      try {
        vadService.initialize({ sensitivity: vadSensitivity });
      } catch (vadError) {
        console.warn('VAD service initialization failed, continuing with defaults:', vadError);
      }
      setProgress(60);

      // Step 4: Start VAD calibration (80% progress)
      setCalibrationStatus(currentT.calibratingMic || 'Calibrating microphone...');
      setIsCalibrating(true);

      // Perform 2-second noise floor calibration
      try {
        const noiseFloor = await audioEngine.calibrateNoiseFloor(2000);
        vadService.calibrate([noiseFloor]);
      } catch (calibrationError) {
        console.warn('Calibration failed, using default noise floor:', calibrationError);
        vadService.calibrate([0.1]); // Default noise floor
      }

      setProgress(80);
      setCalibrationStatus(currentT.finalizingSetup || 'Finalizing setup...');

      // Step 5: Complete initialization (100% progress)
      await new Promise((resolve) => setTimeout(resolve, 500)); // Brief pause
      setProgress(100);
      setCalibrationStatus(currentT.ready || 'Ready!');
      setIsCalibrating(false);

      // Navigate based on onboarding status
      setTimeout(() => {
        if (onboardingCompleted) {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      }, 1000);
    } catch (error) {
      console.error('Splash initialization error:', error);
      setCalibrationStatus(t.ready || 'Ready!');
      setProgress(100);
      setIsCalibrating(false);

      // Navigate to onboarding on error (first time user)
      setTimeout(() => {
        router.replace('/onboarding');
      }, 2000);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: COLORS.DARK_BG,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.XL,
      }}
    >
      {/* Pulsing Voice Orb */}
      <View style={{ marginBottom: SPACING.XL }}>
        <VoiceOrb amplitude={isCalibrating ? 0.5 : 0.2} isActive={isCalibrating} size="lg" variant="pulse" />
      </View>

      {/* Calibration Status */}
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          color: COLORS.DARK_TEXT,
          marginBottom: SPACING.XS,
        }}
      >
        {calibrationStatus}
      </Text>

      {/* Progress Bar */}
      <View style={{ width: '60%', marginBottom: SPACING.MD, marginTop: SPACING.LG }}>
        <ProgressBar value={progress} max={100} size="md" trackColor={COLORS.DARK_CARD} />
      </View>

      {/* Waveform Indicator */}
      {isCalibrating && <WaveformVisualizer amplitude={0.6} isActive={true} bars={5} color={COLORS.CYBER_YELLOW} />}

      {/* Version at bottom */}
      <View
        style={{
          position: 'absolute',
          bottom: SPACING.XL,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.MD,
        }}
      >
        <WaveformVisualizer amplitude={0.3} isActive={isCalibrating} bars={3} />
        <Text style={{ fontSize: 12, color: COLORS.DARK_TEXT_SECONDARY }}>v1.0.4</Text>
      </View>
    </SafeAreaView>
  );
}