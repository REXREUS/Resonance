import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Phone, Mic, MicOff, Pause, Play, SkipForward } from 'lucide-react-native';
import { sessionManager } from '../services/sessionManager';
import { speechService } from '../services/speechService';
import { soundEffects } from '../utils/soundEffects';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';
import { Header, Card } from '../components/ui';
import { VoiceOrb } from '../components/audio';

export default function StressMode() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const [sessionConfig, setSessionConfig] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [currentCaller, setCurrentCaller] = useState(null);
  const [stamina, setStamina] = useState(100);
  const [countdown, setCountdown] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [metrics, setMetrics] = useState({
    pace: 0,
    confidence: 0,
    clarity: 0,
    emotionalState: 'neutral',
    duration: 0,
  });

  // Animation values
  const staminaAnimation = useRef(new Animated.Value(100)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const countdownAnimation = useRef(new Animated.Value(1)).current;
  const metricsInterval = useRef(null);

  // Initialize stress test from session config
  useEffect(() => {
    initializeStressTest();
    
    return () => {
      cleanup();
    };
  }, []);

  // Update metrics periodically
  useEffect(() => {
    if (!sessionActive || isPaused) return;

    metricsInterval.current = setInterval(() => {
      const currentMetrics = sessionManager.getCurrentMetrics();
      const status = sessionManager.getStressTestStatus();
      
      setMetrics(currentMetrics);
      
      if (status) {
        setStamina(status.stamina);
        setQueueStatus(status);
        
        // Animate stamina bar
        Animated.timing(staminaAnimation, {
          toValue: status.stamina,
          duration: 500,
          useNativeDriver: false,
        }).start();
      }
    }, 1000);

    return () => {
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
    };
  }, [sessionActive, isPaused]);

  // Pulse animation for active state
  useEffect(() => {
    if (sessionActive && !isTransitioning && !isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [sessionActive, isTransitioning, isPaused]);

  const initializeStressTest = async () => {
    try {
      if (!params.config) {
        console.error('No session config provided');
        router.replace('/session-setup');
        return;
      }

      setIsInitializing(true);
      const config = JSON.parse(params.config);
      setSessionConfig(config);
      
      // Verify stress mode
      if (config.mode !== 'stress') {
        console.error('Not in stress mode');
        router.replace('/session-setup');
        return;
      }

      // Add sessionId from params
      const fullConfig = {
        ...config,
        sessionId: params.sessionId,
      };

      // Start session via sessionManager
      await sessionManager.startSession(fullConfig);
      
      // Initialize speech service
      try {
        await speechService.initialize();
        
        speechService.setSpeakingStateCallback((speaking) => {
          setIsRecording(speaking);
        });
        
        speechService.setTranscriptionCallback(async (transcription) => {
          if (transcription && transcription.trim()) {
            setTranscript(prev => [...prev, { sender: 'user', text: transcription, timestamp: Date.now() }]);
            await sessionManager.processUserInput(transcription);
          }
        });
        
        await speechService.startListening();
      } catch (e) {
        console.warn('Speech service init failed:', e);
      }
      
      // Set up AI response callback
      sessionManager.setAIResponseCallback((text, emotion) => {
        setTranscript(prev => [...prev, { sender: 'ai', text, emotion, timestamp: Date.now() }]);
        setIsAISpeaking(true);
        setMetrics(prev => ({ ...prev, emotionalState: emotion }));
      });
      
      sessionManager.setTTSCompleteCallback(() => {
        setIsAISpeaking(false);
        // Resume listening after AI finishes speaking
        if (!isPaused && !isMuted) {
          speechService.startListening().catch(e => {
            console.warn('Failed to resume listening after TTS:', e);
          });
        }
      });
      
      // CRITICAL: Stop listening when AI starts speaking to prevent echo/overlap
      sessionManager.setTTSStartingCallback(() => {
        setIsAISpeaking(true);
        speechService.stopListening().catch(e => {
          console.warn('Failed to stop listening for TTS:', e);
        });
      });

      // Get initial status and caller
      const status = sessionManager.getStressTestStatus();
      const caller = sessionManager.getCurrentCaller();
      
      setQueueStatus(status);
      setCurrentCaller(caller);
      setStamina(status?.stamina || 100);
      setSessionActive(true);
      
      // Start call timer
      sessionManager.startCallTimer();
      
      // Send initial greeting after UI is ready
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

      console.log('Stress test initialized:', {
        queueLength: status?.queueLength,
        interCallDelay: status?.interCallDelay,
        difficultyCurve: status?.difficultyCurve,
      });
    } catch (error) {
      console.error('Failed to initialize stress test:', error);
      router.replace('/session-setup');
    } finally {
      setIsInitializing(false);
    }
  };

  const transitionToNextCaller = async () => {
    if (!queueStatus || isTransitioning) return;
    
    // Check if queue is completed
    if (queueStatus.currentPosition >= queueStatus.queueLength) {
      await endStressTest();
      return;
    }

    setIsTransitioning(true);
    setTranscript([]); // Clear transcript for new caller
    
    // Stop listening during transition
    await speechService.stopListening();
    
    // Play next caller beep
    try {
      await soundEffects.playNextCallerBeep();
    } catch (e) {
      console.warn('Failed to play next caller beep:', e);
    }
    
    // Transition with countdown callback and beeps
    const nextCaller = await sessionManager.transitionToNextCaller(async (secondsRemaining) => {
      setCountdown(secondsRemaining);
      
      // Play beep for each countdown second
      if (secondsRemaining > 0) {
        try {
          const frequency = 600 + (queueStatus.interCallDelay - secondsRemaining) * 50;
          await soundEffects.playBeep(frequency, 150, 0.4);
        } catch (e) {
          // Ignore beep errors
        }
        
        // Animate countdown
        Animated.sequence([
          Animated.timing(countdownAnimation, {
            toValue: 1.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(countdownAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
    
    setCountdown(null);
    
    if (nextCaller) {
      setCurrentCaller(nextCaller);
      const status = sessionManager.getStressTestStatus();
      setQueueStatus(status);
      
      // Play call connect sound
      try {
        await soundEffects.playCallConnect();
      } catch (e) {
        console.warn('Failed to play call connect:', e);
      }
      
      // Resume listening
      await speechService.startListening();
      
      // Send greeting for new caller
      if (!sessionConfig?.mockMode) {
        setTimeout(async () => {
          try {
            await sessionManager.sendInitialGreeting();
          } catch (e) {
            console.warn('Failed to send greeting for new caller:', e);
          }
        }, 300);
      }
    } else {
      // Queue completed
      await endStressTest();
    }
    
    setIsTransitioning(false);
  };

  const endStressTest = async () => {
    setSessionActive(false);
    
    try {
      // Play call end sound
      await soundEffects.playCallEnd();
      
      // Stop listening safely
      try {
        await speechService.stopListening();
      } catch (e) {
        console.log('Speech service already stopped');
      }
      
      // Play success beep for completing stress test
      await soundEffects.playSuccessBeep();
      
      const sessionReport = await sessionManager.endSession();
      
      router.replace({
        pathname: '/report',
        params: {
          sessionId: sessionReport.sessionId || params.sessionId,
          sessionReport: JSON.stringify(sessionReport),
        }
      });
    } catch (error) {
      console.error('Error ending stress test:', error);
      router.replace('/');
    }
  };

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      sessionManager.resumeSession();
      setIsPaused(false);
      speechService.startListening();
    } else {
      sessionManager.pauseSession();
      setIsPaused(true);
      speechService.stopListening();
    }
  }, [isPaused]);

  const handleMuteToggle = async () => {
    if (isMuted) {
      await speechService.startListening();
      setIsMuted(false);
    } else {
      await speechService.stopListening();
      setIsMuted(true);
    }
  };

  const handleEmergencyExit = async () => {
    setSessionActive(false);
    
    // Play call end sound
    try {
      await soundEffects.playCallEnd();
    } catch (e) {
      // Ignore sound errors
    }
    
    // Stop listening safely
    try {
      await speechService.stopListening();
    } catch (e) {
      console.log('Speech service already stopped');
    }
    
    // End session safely
    try {
      await sessionManager.endSession();
    } catch (e) {
      console.log('Session already ended or error:', e.message);
    }
    
    router.replace('/');
  };

  const cleanup = async () => {
    if (metricsInterval.current) {
      clearInterval(metricsInterval.current);
      metricsInterval.current = null;
    }
    
    // Cleanup speech service safely
    try {
      await speechService.cleanup();
    } catch (e) {
      console.log('Speech service cleanup completed');
    }
  };

  const getMoodColor = (mood) => {
    const moodColors = {
      neutral: colors.TEXT_SECONDARY,
      hostile: '#FF6B6B',
      frustrated: '#FFA94D',
      anxious: '#FFD43B',
      demanding: '#9775FA',
      happy: '#69DB7C',
    };
    return moodColors[mood] || colors.TEXT_SECONDARY;
  };

  const getDifficultyStars = (difficulty) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < difficulty ? 'star' : 'star-outline'}
        size={14}
        color={i < difficulty ? colors.ACCENT : colors.TEXT_SECONDARY}
      />
    ));
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.TEXT, fontSize: 18 }}>{t.preparing || 'Initializing Stress Test...'}</Text>
      </SafeAreaView>
    );
  }

  if (!queueStatus || !currentCaller) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.TEXT, fontSize: 18 }}>{t.loading || 'Loading...'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
      {/* Header with Queue Status */}
      <Header
        title={t.stressModeTitle || 'STRESS TEST'}
        variant="themed"
        showBack={false}
        rightIcon={isPaused ? 'play' : 'pause'}
        onRightPress={handlePauseResume}
      />

      <View style={{ paddingHorizontal: SPACING.MD, paddingTop: SPACING.SM }}>
        {/* Queue Progress */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.SM }}>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12 }}>
            {t.callerQueue || 'Caller Queue'}: {queueStatus.currentPosition}/{queueStatus.queueLength}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, marginRight: SPACING.XS }}>
              {t.interCallDelay || 'Delay'}: {queueStatus.interCallDelay}s
            </Text>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12 }}>
              | {t.difficultyCurve || 'Curve'}: {queueStatus.difficultyCurve}%
            </Text>
          </View>
        </View>
        
        {/* Progress Bar */}
        <View style={{ width: '100%', height: 6, backgroundColor: colors.BORDER, borderRadius: 3, marginBottom: SPACING.MD }}>
          <View
            style={{
              height: '100%',
              backgroundColor: colors.ACCENT,
              borderRadius: 3,
              width: `${queueStatus.progress}%`,
            }}
          />
        </View>

        {/* Stamina Bar */}
        <View style={{ marginBottom: SPACING.MD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.XS }}>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12 }}>{t.staminaBar || 'STAMINA'}</Text>
            <Text style={{ color: colors.TEXT, fontSize: 12, fontWeight: '700' }}>{Math.round(stamina)}%</Text>
          </View>
          <View style={{ width: '100%', height: 8, backgroundColor: colors.BORDER, borderRadius: 4, overflow: 'hidden' }}>
            <Animated.View
              style={{
                height: '100%',
                borderRadius: 4,
                backgroundColor: stamina > 60 ? '#69DB7C' : stamina > 30 ? '#FFD43B' : '#FF6B6B',
                width: staminaAnimation.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              }}
            />
          </View>
        </View>
      </View>

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <Animated.View style={{ transform: [{ scale: countdownAnimation }] }}>
            <Text style={{ color: colors.ACCENT, fontSize: 96, fontWeight: '900' }}>{countdown}</Text>
          </Animated.View>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 18, marginTop: SPACING.MD }}>
            {t.nextCaller || 'Next caller incoming...'}
          </Text>
        </View>
      )}

      {/* Main Content */}
      <ScrollView style={{ flex: 1, paddingHorizontal: SPACING.MD }}>
        {/* Caller Profile Card */}
        <Card variant="default" padding="lg" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.MD }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '700' }}>{currentCaller.name}</Text>
                {currentCaller.gender && (
                  <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginLeft: SPACING.XS }}>
                    {currentCaller.gender === 'female' ? '👩' : '👨'}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getMoodColor(currentCaller.mood), marginRight: SPACING.XS }} />
                <Text style={{ color: colors.TEXT_SECONDARY, textTransform: 'capitalize' }}>{currentCaller.mood}</Text>
              </View>
              {currentCaller.voiceName && (
                <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 10, marginTop: 2 }}>
                  🎤 {currentCaller.voiceName}
                </Text>
              )}
            </View>
            
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 11, marginBottom: 4 }}>{t.difficulty || 'Difficulty'}</Text>
              <View style={{ flexDirection: 'row' }}>
                {getDifficultyStars(currentCaller.difficulty)}
              </View>
            </View>
          </View>

          <View style={{ marginBottom: SPACING.MD }}>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 11, marginBottom: 4 }}>{t.scenario?.toUpperCase() || 'SCENARIO'}</Text>
            <Text style={{ color: colors.TEXT, fontSize: 16, textTransform: 'capitalize' }}>{currentCaller.scenario}</Text>
          </View>

          <View style={{ marginBottom: SPACING.MD }}>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 11, marginBottom: 4 }}>{t.missionObjective || 'MISSION OBJECTIVE'}</Text>
            <Text style={{ color: colors.TEXT, fontSize: 14, lineHeight: 20 }}>{currentCaller.objective}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 11 }}>{t.estDuration || 'Est. Duration'}</Text>
              <Text style={{ color: colors.TEXT, fontSize: 14 }}>
                {Math.floor(currentCaller.estimatedDuration / 60)}:{(currentCaller.estimatedDuration % 60).toString().padStart(2, '0')}
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={transitionToNextCaller}
              disabled={isTransitioning || isPaused}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isTransitioning || isPaused ? colors.BORDER : colors.ACCENT,
                paddingHorizontal: SPACING.LG,
                paddingVertical: SPACING.SM,
                borderRadius: BORDER_RADIUS.LG,
              }}
            >
              <SkipForward size={18} color={isTransitioning || isPaused ? colors.TEXT_SECONDARY : '#000'} />
              <Text style={{
                color: isTransitioning || isPaused ? colors.TEXT_SECONDARY : '#000',
                fontWeight: '700',
                marginLeft: SPACING.XS,
              }}>
                {queueStatus.remaining > 0 ? (t.nextCaller || 'NEXT CALLER') : (t.completeTest || 'COMPLETE TEST')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Voice Orb */}
        <View style={{ alignItems: 'center', marginBottom: SPACING.MD }}>
          <VoiceOrb
            amplitude={isRecording ? 0.7 : (isAISpeaking ? 0.6 : 0.2)}
            isActive={sessionActive && !isPaused && (isRecording || isAISpeaking)}
            size="md"
            variant="pulse"
          />
          {isRecording && (
            <Text style={{ color: '#FF6B6B', fontSize: 12, marginTop: SPACING.XS, fontWeight: '600' }}>
              🎙️ {t.listening || 'Listening...'}
            </Text>
          )}
          {isAISpeaking && (
            <Text style={{ color: colors.ACCENT, fontSize: 12, marginTop: SPACING.XS }}>
              {t.speaking || 'Speaking...'}
            </Text>
          )}
        </View>

        {/* Transcript (if not blind mode) */}
        {!sessionConfig?.blindMode && transcript.length > 0 && (
          <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD, maxHeight: 200 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.TEXT_SECONDARY, marginBottom: SPACING.SM }}>
              {t.transcript || 'Transcript'}
            </Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {transcript.slice(-5).map((entry, index) => (
                <View key={index} style={{ marginBottom: SPACING.XS }}>
                  <Text style={{ fontSize: 10, color: colors.TEXT_SECONDARY }}>
                    {entry.sender === 'user' ? t.you || 'You' : 'AI'}:
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.TEXT }}>{entry.text}</Text>
                </View>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Real-time Metrics */}
        <Card variant="default" padding="md" style={{ marginBottom: SPACING.XL, backgroundColor: colors.CARD }}>
          <Text style={{ color: colors.TEXT, fontSize: 14, fontWeight: '700', marginBottom: SPACING.SM }}>
            {t.metrics || 'PERFORMANCE METRICS'}
          </Text>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <View style={{ backgroundColor: colors.BG, borderRadius: BORDER_RADIUS.MD, padding: SPACING.SM, width: '48%', marginBottom: SPACING.SM }}>
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 10 }}>{t.pace?.toUpperCase() || 'PACE'}</Text>
              <Text style={{ color: colors.TEXT, fontSize: 18, fontWeight: '700' }}>{metrics.pace} {t.wpm || 'WPM'}</Text>
            </View>
            
            <View style={{ backgroundColor: colors.BG, borderRadius: BORDER_RADIUS.MD, padding: SPACING.SM, width: '48%', marginBottom: SPACING.SM }}>
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 10 }}>{t.confidence?.toUpperCase() || 'CONFIDENCE'}</Text>
              <Text style={{ color: colors.TEXT, fontSize: 18, fontWeight: '700' }}>{metrics.confidence}%</Text>
            </View>
            
            <View style={{ backgroundColor: colors.BG, borderRadius: BORDER_RADIUS.MD, padding: SPACING.SM, width: '48%' }}>
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 10 }}>{t.clarity?.toUpperCase() || 'CLARITY'}</Text>
              <Text style={{ color: colors.TEXT, fontSize: 18, fontWeight: '700' }}>{metrics.clarity}%</Text>
            </View>
            
            <View style={{ backgroundColor: colors.BG, borderRadius: BORDER_RADIUS.MD, padding: SPACING.SM, width: '48%' }}>
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 10 }}>{t.aiMood || 'AI MOOD'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getMoodColor(metrics.emotionalState), marginRight: 6 }} />
                <Text style={{ color: colors.TEXT, textTransform: 'capitalize' }}>{metrics.emotionalState}</Text>
              </View>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Bottom Control Bar */}
      <View style={{
        backgroundColor: colors.CARD,
        borderTopLeftRadius: BORDER_RADIUS.XL,
        borderTopRightRadius: BORDER_RADIUS.XL,
        padding: SPACING.MD,
        paddingBottom: SPACING.XL,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}>
        {/* Pause/Resume */}
        <TouchableOpacity
          onPress={handlePauseResume}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: isPaused ? colors.ACCENT : colors.BG,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isPaused ? <Play size={24} color="#000" /> : <Pause size={24} color={colors.TEXT} />}
        </TouchableOpacity>

        {/* Mute */}
        <TouchableOpacity
          onPress={handleMuteToggle}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: isMuted ? '#FF6B6B' : colors.BG,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isMuted ? <MicOff size={24} color="#FFF" /> : <Mic size={24} color={colors.TEXT} />}
        </TouchableOpacity>

        {/* End Call */}
        <TouchableOpacity
          onPress={handleEmergencyExit}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#FF6B6B',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Phone size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}