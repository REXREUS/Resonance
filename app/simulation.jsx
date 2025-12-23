import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Mic, MicOff, Phone, Pause, Play } from 'lucide-react-native';
import LottieView from 'lottie-react-native';
import { sessionManager } from '../services/sessionManager';
import { chaosEngine } from '../services/chaosEngine';
import { speechService } from '../services/speechService';
import { soundEffects } from '../utils/soundEffects';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

// New UI Components
import { Header, Card, Badge, MetricCard } from '../components/ui';
import { CallControlFAB } from '../components/ui/FAB';
import { TimerDisplay } from '../components/ui/CountdownTimer';
import { VoiceOrb, SentimentBadge } from '../components/audio';

export default function Simulation() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  // Session config from params
  const [sessionConfig, setSessionConfig] = useState(null);
  
  const [sessionState, setSessionState] = useState('idle');
  const [metrics, setMetrics] = useState({
    pace: 0,
    confidence: 0,
    clarity: 0,
    fillerWordCount: 0,
    duration: 0,
    emotionalState: 'neutral'
  });
  const [chaosStats, setChaosStats] = useState({
    enabled: false,
    totalDisruptions: 0,
    activeDisruptions: 0,
    disruptionsByType: {},
  });
  const [activeDisruptions, setActiveDisruptions] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  
  // Conversation state
  const [transcript, setTranscript] = useState([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const transcriptScrollRef = useRef(null);
  
  // Animation refs
  const orbScale = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(null);
  const metricsInterval = useRef(null);
  const amplitudeInterval = useRef(null);

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, []);

  // Set up periodic updates when session is active
  useEffect(() => {
    if (sessionState === 'active') {
      metricsInterval.current = setInterval(updateMetrics, 1000);
      amplitudeInterval.current = setInterval(updateAudioAmplitude, 50);
    }
    
    return () => {
      if (metricsInterval.current) clearInterval(metricsInterval.current);
      if (amplitudeInterval.current) clearInterval(amplitudeInterval.current);
    };
  }, [sessionState]);

  // Set up orb pulsing animation based on audio amplitude
  useEffect(() => {
    const targetScale = calculateOrbScale(audioAmplitude);
    
    if (pulseAnimation.current) {
      pulseAnimation.current.stop();
    }
    
    pulseAnimation.current = Animated.timing(orbScale, {
      toValue: targetScale,
      duration: 100,
      useNativeDriver: true,
    });
    
    pulseAnimation.current.start();
  }, [audioAmplitude]);

  const initializeSession = async () => {
    try {
      if (!params.config) {
        Alert.alert(t.error, t.noSessionConfig || 'No session configuration provided');
        router.back();
        return;
      }

      setIsInitializing(true);
      const config = JSON.parse(params.config);
      setSessionConfig(config);
      
      // Add sessionId from params
      const fullConfig = {
        ...config,
        sessionId: params.sessionId,
      };
      
      await sessionManager.startSession(fullConfig);
      
      // Initialize speech service for STT with VAD-based continuous listening
      try {
        await speechService.initialize();
        
        // Set up callbacks for VAD-based listening
        speechService.setSpeakingStateCallback((speaking) => {
          setIsRecording(speaking);
        });
        
        speechService.setListeningStateCallback((listening) => {
          console.log('Listening state:', listening);
        });
        
        // Set up transcription callback - this fires when VAD detects silence
        speechService.setTranscriptionCallback(async (transcription) => {
          if (transcription && transcription.trim()) {
            console.log('User said:', transcription);
            
            // Add user message to transcript
            setTranscript(prev => [...prev, { sender: 'user', text: transcription, timestamp: Date.now() }]);
            
            // Auto-scroll
            setTimeout(() => {
              transcriptScrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
            
            // Process with AI
            setIsProcessing(true);
            try {
              await sessionManager.processUserInput(transcription);
            } catch (e) {
              console.error('Failed to process user input:', e);
              setIsProcessing(false);
            }
          }
        });
        
        // Start continuous listening mode
        await speechService.startListening();
        
      } catch (e) {
        console.warn('Speech service init failed, using text input fallback:', e);
      }
      
      // Set up conversation callbacks
      sessionManager.setTranscriptCallback((sender, text) => {
        // Only add user messages here - AI messages handled by AIResponseCallback
        if (sender === 'user') {
          // User transcript already added by transcription callback, skip duplicate
          return;
        }
        setTranscript(prev => [...prev, { sender, text, timestamp: Date.now() }]);
        // Auto-scroll to bottom
        setTimeout(() => {
          transcriptScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
      
      sessionManager.setAIResponseCallback((text, emotion) => {
        // Add AI response to transcript
        setTranscript(prev => [...prev, { sender: 'ai', text, emotion, timestamp: Date.now() }]);
        setIsAISpeaking(true);
        setIsProcessing(false);
        
        // Update emotional state in metrics
        setMetrics(prev => ({ ...prev, emotionalState: emotion }));
        
        // Auto-scroll to bottom
        setTimeout(() => {
          transcriptScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
      
      // Set up TTS completion callback - resume listening after AI finishes
      sessionManager.setTTSCompleteCallback(() => {
        console.log('TTS complete, resuming listening');
        setIsAISpeaking(false);
        // Resume listening after AI finishes speaking (with small delay for audio cleanup)
        setTimeout(async () => {
          if (sessionManager.getSessionState() === 'active' && !isMuted) {
            try {
              await speechService.startListening();
              console.log('Listening resumed after TTS complete');
            } catch (e) {
              console.warn('Failed to resume listening after TTS:', e);
            }
          }
        }, 300);
      });
      
      // CRITICAL: Stop listening when AI starts speaking to prevent echo/overlap
      sessionManager.setTTSStartingCallback(() => {
        console.log('TTS starting, stopping listening to prevent echo');
        setIsAISpeaking(true);
        speechService.stopListening().catch(e => {
          console.warn('Failed to stop listening for TTS:', e);
        });
      });
      
      // Initialize noise level from config if chaos engine has background noise
      if (config.chaosEngine?.backgroundNoise) {
        // Noise level handled by chaos engine
      }
      
      setSessionState('active');
      updateMetrics();
      
      console.log('Simulation session initialized with config:', config.scenario);
    } catch (error) {
      console.error('Failed to initialize simulation:', error);
      Alert.alert(t.error, t.initializationFailed);
      router.back();
    } finally {
      setIsInitializing(false);
      
      // Send initial AI greeting AFTER UI is ready (not in mock mode)
      const config = params.config ? JSON.parse(params.config) : {};
      if (!config.mockMode) {
        // Play session start beeps for realistic effect
        try {
          await soundEffects.playSessionStartBeeps();
        } catch (e) {
          console.warn('Failed to play start beeps:', e);
        }
        
        // Small delay after beeps, then send greeting
        setTimeout(async () => {
          try {
            await sessionManager.sendInitialGreeting();
          } catch (e) {
            console.warn('Failed to send initial greeting:', e);
          }
        }, 300);
      }
    }
  };

  const updateMetrics = () => {
    try {
      const currentMetrics = sessionManager.getCurrentMetrics();
      const currentChaosStats = sessionManager.getChaosStatistics();
      const currentDisruptions = chaosEngine.getActiveDisruptions();
      
      setMetrics(currentMetrics);
      setChaosStats(currentChaosStats);
      setActiveDisruptions(currentDisruptions);
      setSessionState(sessionManager.getSessionState());
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  };

  const updateAudioAmplitude = () => {
    try {
      // Use speechService metering value for amplitude visualization
      const metering = speechService.getMeteringValue();
      // Convert dB (-160 to 0) to amplitude (0 to 1)
      const amplitude = Math.max(0, Math.min(1, (metering + 160) / 160));
      setAudioAmplitude(amplitude);
    } catch (error) {
      // Ignore amplitude errors
    }
  };

  const calculateOrbScale = (amplitude) => {
    // Convert amplitude (0-1) to scale (0.8-1.5)
    const normalizedAmplitude = Math.max(0, Math.min(1, amplitude));
    return 0.8 + (normalizedAmplitude * 0.7);
  };

  const handleMuteToggle = async () => {
    try {
      if (isMuted) {
        // Unmute - resume listening
        await speechService.startListening();
        setIsMuted(false);
      } else {
        // Mute - stop listening
        await speechService.stopListening();
        setIsMuted(true);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
      Alert.alert(t.error, t.failedToToggleMic || 'Failed to toggle microphone');
    }
  };

  // Toggle continuous listening mode
  const handleToggleListening = async () => {
    if (sessionState !== 'active' || isAISpeaking || isProcessing) return;
    
    try {
      if (speechService.isCurrentlyListening()) {
        await speechService.stopListening();
      } else {
        await speechService.startListening();
      }
    } catch (error) {
      console.error('Failed to toggle listening:', error);
    }
  };

  // Note: Listening pause/resume is now handled by TTS callbacks (setTTSStartingCallback/setTTSCompleteCallback)
  // This effect is kept for additional state sync if needed
  useEffect(() => {
    if (isAISpeaking) {
      console.log('AI speaking state: true');
    } else {
      console.log('AI speaking state: false');
    }
  }, [isAISpeaking]);

  const handleEndSession = async () => {
    Alert.alert(
      t.endSession,
      t.endSessionConfirm || 'Are you sure you want to end this training session?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.endSession,
          style: 'destructive',
          onPress: async () => {
            try {
              // Play call end sound
              await soundEffects.playCallEnd();
              
              const sessionReport = await sessionManager.endSession();
              
              router.replace({
                pathname: '/report',
                params: {
                  sessionId: sessionReport.sessionId || params.sessionId,
                  sessionReport: JSON.stringify(sessionReport)
                }
              });
            } catch (error) {
              console.error('Failed to end session:', error);
              Alert.alert(t.error, t.failedToEndSession || 'Failed to end session properly');
            }
          }
        }
      ]
    );
  };

  const handlePauseResume = useCallback(() => {
    if (sessionState === 'active') {
      sessionManager.pauseSession();
      setSessionState('paused');
    } else if (sessionState === 'paused') {
      sessionManager.resumeSession();
      setSessionState('active');
    }
    updateMetrics();
  }, [sessionState]);

  const cleanup = async () => {
    try {
      if (metricsInterval.current) clearInterval(metricsInterval.current);
      if (amplitudeInterval.current) clearInterval(amplitudeInterval.current);
      
      // Cleanup speech service
      await speechService.cleanup();
      
      const currentState = sessionManager.getSessionState();
      if (currentState === 'active' || currentState === 'paused') {
        await sessionManager.endSession();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Get scenario display name
  const getScenarioDisplayName = useCallback(() => {
    if (!sessionConfig?.scenario) return t.simulation;
    const key = sessionConfig.scenario.replace(/-/g, '');
    return t[key] || sessionConfig.scenario.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [sessionConfig, t]);

  if (isInitializing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <LottieView
          source={require('../assets/animations/L-load.json')}
          autoPlay
          loop
          style={{ width: 150, height: 150 }}
        />
        <Text style={{ color: colors.TEXT, fontSize: 18, marginTop: SPACING.MD }}>
          {t.preparing}
        </Text>
        <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginTop: SPACING.XS }}>
          {t.settingUpChaos || 'Setting up chaos engine and audio systems'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
      {/* Header */}
      <Header
        title={getScenarioDisplayName().toUpperCase()}
        variant="cream"
        showBack={false}
        rightIcon={sessionState === 'active' ? 'pause' : 'play'}
        onRightPress={handlePauseResume}
      />

      {/* Main Content */}
      <ScrollView 
        ref={transcriptScrollRef}
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      >
          <View style={{ padding: SPACING.MD }}>
            {/* Sentiment Badge - Hidden in Blind Mode */}
            {!sessionConfig?.blindMode && (
              <View style={{ alignItems: 'center', marginBottom: SPACING.MD }}>
                <SentimentBadge
                  sentiment={metrics.emotionalState}
                  size="md"
                />
              </View>
            )}

            {/* Central Voice Orb */}
            <View style={{ alignItems: 'center', marginBottom: SPACING.LG }}>
              <VoiceOrb
                amplitude={isRecording ? 0.7 : (isAISpeaking ? 0.6 : audioAmplitude)}
                isActive={sessionState === 'active' && (isRecording || isAISpeaking)}
                size="lg"
                variant="pulse"
              />
              {isRecording && (
                <Text style={{ color: colors.ERROR || '#FF6B6B', fontSize: 12, marginTop: SPACING.XS, fontWeight: '600' }}>
                  🎙️ {t.listening || 'Listening...'}
                </Text>
              )}
              {isProcessing && !isAISpeaking && (
                <Text style={{ color: colors.ACCENT, fontSize: 12, marginTop: SPACING.XS }}>
                  {t.processing || 'Processing...'}
                </Text>
              )}
              {isAISpeaking && (
                <Text style={{ color: colors.ACCENT, fontSize: 12, marginTop: SPACING.XS }}>
                  {t.speaking || 'Speaking...'}
                </Text>
              )}
            </View>

            {/* Continuous Listening Toggle Button */}
            <TouchableOpacity
              onPress={handleToggleListening}
              disabled={sessionState !== 'active' || isAISpeaking || isProcessing}
              style={{
                backgroundColor: isRecording ? (colors.ERROR || '#FF6B6B') : colors.CARD,
                padding: SPACING.LG,
                borderRadius: BORDER_RADIUS.XL,
                alignItems: 'center',
                marginBottom: SPACING.MD,
                opacity: (sessionState !== 'active' || isAISpeaking || isProcessing) ? 0.5 : 1,
                borderWidth: speechService.isCurrentlyListening?.() ? 2 : 0,
                borderColor: colors.ACCENT,
              }}
            >
              <Mic size={32} color={isRecording ? '#FFF' : colors.TEXT} />
              <Text style={{ 
                color: isRecording ? '#FFF' : colors.TEXT, 
                fontSize: 14, 
                fontWeight: '600',
                marginTop: SPACING.XS 
              }}>
                {isRecording 
                  ? (t.listening || 'Listening...') 
                  : (t.tapToSpeak || 'Tap to toggle mic')}
              </Text>
              <Text style={{ 
                color: isRecording ? '#FFF' : colors.TEXT_SECONDARY, 
                fontSize: 11, 
                marginTop: 2 
              }}>
                {t.vadAutoDetect || 'Auto-detects when you stop speaking'}
              </Text>
            </TouchableOpacity>

            {/* Real-time HUD Cards - Hidden in Blind Mode */}
            {!sessionConfig?.blindMode && (
              <View style={{ flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.MD }}>
                <MetricCard
                  label={t.pace.toUpperCase()}
                  value={metrics.pace}
                  unit={t.wpm}
                  variant="light"
                  size="md"
                  style={{ flex: 1 }}
                />
                <MetricCard
                  label={t.confidence.toUpperCase()}
                  value={metrics.confidence}
                  unit="%"
                  variant="light"
                  size="md"
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* Conversation Transcript - Hidden in Blind Mode */}
            {!sessionConfig?.blindMode && transcript.length > 0 && (
              <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.TEXT, marginBottom: SPACING.SM }}>
                  {t.transcript || 'Transcript'}
                </Text>
                {transcript.map((entry, index) => (
                  <View 
                    key={index} 
                    style={{ 
                      marginBottom: SPACING.SM,
                      alignItems: entry.sender === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <View style={{
                      backgroundColor: entry.sender === 'user' ? colors.ACCENT : colors.BG,
                      padding: SPACING.SM,
                      borderRadius: BORDER_RADIUS.MD,
                      maxWidth: '80%',
                    }}>
                      <Text style={{ 
                        fontSize: 10, 
                        color: entry.sender === 'user' ? '#000' : colors.TEXT_SECONDARY,
                        marginBottom: 2,
                      }}>
                        {entry.sender === 'user' ? t.you || 'You' : 'AI'}
                        {entry.emotion && ` (${entry.emotion})`}
                      </Text>
                      <Text style={{ 
                        fontSize: 13, 
                        color: entry.sender === 'user' ? '#000' : colors.TEXT,
                      }}>
                        {entry.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {/* Active Disruptions - Hidden in Blind Mode */}
            {!sessionConfig?.blindMode && activeDisruptions.length > 0 && (
              <Card variant="light" padding="md" style={{ marginBottom: SPACING.MD, borderColor: colors.ERROR || '#FF6B6B', borderWidth: 1, backgroundColor: colors.CARD }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ERROR || '#FF6B6B', marginBottom: SPACING.SM }}>
                  {t.activeDisruptions || 'Active Disruptions'}
                </Text>
                {activeDisruptions.map((disruption, index) => (
                  <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.XS }}>
                    <Badge variant="error" size="sm">
                      {disruption.type.replace('_', ' ')}
                    </Badge>
                    <Text style={{ fontSize: 12, color: colors.ERROR || '#FF6B6B' }}>
                      {disruption.duration === -1 ? t.continuous || 'Continuous' : `${Math.round(disruption.duration / 1000)}s`}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
            
            {/* Chaos Engine Stats - Hidden in Blind Mode */}
            {!sessionConfig?.blindMode && chaosStats.enabled && chaosStats.totalDisruptions > 0 && (
              <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.TEXT, marginBottom: SPACING.SM }}>
                  ⚡ {t.chaosEngine || 'Chaos Engine'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.TEXT_SECONDARY }}>
                    {t.totalDisruptions || 'Total Disruptions'}: {chaosStats.totalDisruptions}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.TEXT_SECONDARY }}>
                    {t.active || 'Active'}: {chaosStats.activeDisruptions}
                  </Text>
                </View>
              </Card>
            )}

            {/* Blind Mode Notice */}
            {sessionConfig?.blindMode && (
              <Card variant="default" padding="lg" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.TEXT_SECONDARY, textAlign: 'center', marginBottom: SPACING.SM }}>
                  🔇 {t.blindMode || 'Blind Mode'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.TEXT_SECONDARY, textAlign: 'center' }}>
                  {t.blindModeActive || 'Visual transcripts and cues are hidden. Focus on listening and speaking.'}
                </Text>
              </Card>
            )}
          </View>
        </ScrollView>

        {/* Call Bar - Fixed at bottom */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.CARD,
            borderTopLeftRadius: BORDER_RADIUS.XL,
            borderTopRightRadius: BORDER_RADIUS.XL,
            padding: SPACING.MD,
            paddingBottom: SPACING.XL,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Timer */}
          <TimerDisplay
            seconds={metrics.duration || 0}
            isRecording={sessionState === 'active'}
            size="lg"
          />

          {/* Control Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.MD }}>
            {/* Pause/Resume Button */}
            <CallControlFAB
              icon={sessionState === 'paused' ? <Play size={20} color="#FFF" /> : <Pause size={20} color="#FFF" />}
              variant="mute"
              isActive={sessionState === 'paused'}
              onPress={handlePauseResume}
            />
            
            {/* Mute Button */}
            <CallControlFAB
              icon={isMuted ? <MicOff size={20} color="#FFF" /> : <Mic size={20} color="#FFF" />}
              variant="mute"
              isActive={isMuted}
              onPress={handleMuteToggle}
            />

            {/* End Call Button */}
            <CallControlFAB
              icon={<Phone size={24} color="#FFF" />}
              variant="endCall"
              size="lg"
              onPress={handleEndSession}
            />
          </View>
        </View>
    </SafeAreaView>
  );
}