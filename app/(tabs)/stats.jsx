import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Mic2,
  Plus,
  Play,
  Pause,
  Trash2,
  Volume2,
  X,
  Upload,
  Sliders,
  Star,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Card } from '../../components/ui';
import { databaseService } from '../../services/databaseService';
import elevenLabsService from '../../services/elevenLabsService';
import useSettingsStore from '../../stores/settingsStore';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';

const MAX_VOICE_SLOTS = 5;

export default function VoiceLab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { apiKeys, trackApiUsage } = useSettingsStore();

  const [voices, setVoices] = useState([]);
  const [systemVoices, setSystemVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [defaultVoiceId, setDefaultVoiceId] = useState(null);
  const [sound, setSound] = useState(null);
  const [isServiceReady, setIsServiceReady] = useState(false);

  // Clone voice modal
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState(null);
  const [voiceNameInput, setVoiceNameInput] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // TTS Test
  const [testText, setTestText] = useState('Hello, this is a test of the voice synthesis system.');

  // Voice settings
  const [stability, setStability] = useState(0.75);
  const [similarity, setSimilarity] = useState(0.9);

  useEffect(() => {
    initializeVoiceLab();
    return () => {
      cleanupAudio();
    };
  }, []);

  // Re-initialize when apiKeys change (e.g., after saving in settings)
  useEffect(() => {
    if (apiKeys?.elevenlabs && apiKeys.elevenlabs.trim() !== '') {
      initializeElevenLabsService();
    }
  }, [apiKeys?.elevenlabs]);

  const cleanupAudio = async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error cleaning up audio:', error);
      }
    }
  };

  const initializeVoiceLab = async () => {
    try {
      setLoading(true);
      
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      
      // Initialize ElevenLabs service
      await initializeElevenLabsService();
      
      // Load voices
      await loadVoices();
      await loadDefaultVoice();
      
      // Setup audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Error initializing Voice Lab:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeElevenLabsService = async () => {
    try {
      let apiKey = apiKeys?.elevenlabs;
      if (!apiKey) {
        apiKey = await databaseService.getApiKey('elevenlabs');
      }
      
      if (!apiKey) {
        setIsServiceReady(false);
        return;
      }
      
      await elevenLabsService.initialize({ apiKey });
      setIsServiceReady(true);
    } catch (error) {
      console.error('Failed to initialize ElevenLabs service:', error);
      setIsServiceReady(false);
    }
  };

  const loadDefaultVoice = async () => {
    try {
      const defaultVoice = await databaseService.getDefaultVoice();
      if (defaultVoice) {
        setDefaultVoiceId(defaultVoice.voice_id);
      }
    } catch (error) {
      console.error('Failed to load default voice:', error);
    }
  };

  const loadVoices = async () => {
    try {
      // Load local voices from database
      const savedVoices = await databaseService.getVoiceAssets();
      
      // Try to load from API if service is ready
      if (isServiceReady || elevenLabsService.apiKey) {
        try {
          const apiVoices = await elevenLabsService.listVoices();
          
          // Separate system and cloned voices from API
          const apiSystemVoices = apiVoices.filter(v => v.isSystem || !v.isCloned);
          const apiClonedVoices = apiVoices.filter(v => v.isCloned);
          
          // Sync API voices to local database
          for (const voice of apiVoices) {
            const existingLocal = savedVoices.find(v => v.voice_id === voice.id);
            if (!existingLocal) {
              await databaseService.createVoiceAsset({
                voice_id: voice.id,
                name: voice.name,
                is_cloned: voice.isCloned ? 1 : 0,
                is_system: voice.isSystem ? 1 : 0,
                stability: voice.stability || 0.75,
                similarity: voice.similarity || 0.90,
              });
            }
          }
          
          // Set system voices from API
          setSystemVoices(apiSystemVoices.map(v => ({
            voice_id: v.id,
            name: v.name,
            is_system: 1,
            is_cloned: 0,
            stability: v.stability || 0.75,
            similarity: v.similarity || 0.90,
          })));
          
          // Set cloned voices
          setVoices(apiClonedVoices.map(v => ({
            voice_id: v.id,
            name: v.name,
            is_system: 0,
            is_cloned: 1,
            stability: v.stability || 0.75,
            similarity: v.similarity || 0.90,
          })));
          
          return;
        } catch (apiError) {
          console.error('Failed to load voices from API:', apiError);
        }
      }
      
      // Fallback to local database
      const localSystemVoices = savedVoices.filter(v => v.is_system === 1);
      const localClonedVoices = savedVoices.filter(v => v.is_cloned === 1);
      
      // If no system voices in DB, use defaults
      if (localSystemVoices.length === 0) {
        setSystemVoices([
          { voice_id: 'alex_default', name: 'Alex (Default)', is_system: 1, is_cloned: 0, stability: 0.75, similarity: 0.9 },
          { voice_id: 'sarah_professional', name: 'Sarah (Professional)', is_system: 1, is_cloned: 0, stability: 0.75, similarity: 0.9 },
          { voice_id: 'james_calm', name: 'James (Calm)', is_system: 1, is_cloned: 0, stability: 0.75, similarity: 0.9 },
        ]);
      } else {
        setSystemVoices(localSystemVoices);
      }
      
      setVoices(localClonedVoices);
    } catch (error) {
      console.error('Error loading voices:', error);
      // Set default system voices on error
      setSystemVoices([
        { voice_id: 'alex_default', name: 'Alex (Default)', is_system: 1, is_cloned: 0, stability: 0.75, similarity: 0.9 },
      ]);
    }
  };

  const getClonedVoiceCount = () => {
    return voices.filter((v) => v.is_cloned === 1).length;
  };

  const handleAddVoice = async () => {
    if (getClonedVoiceCount() >= MAX_VOICE_SLOTS) {
      Alert.alert(
        t.error,
        `You can only have ${MAX_VOICE_SLOTS} cloned voices. Delete an existing voice to add a new one.`
      );
      return;
    }

    if (!isServiceReady) {
      Alert.alert(t.error, 'ElevenLabs API key not configured. Please add your API key in Settings.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert(t.error, 'Audio file too large. Maximum 10MB.');
        return;
      }

      // Store file and show name input modal
      setPendingAudioFile(file);
      setVoiceNameInput('');
      setShowCloneModal(true);
    } catch (error) {
      console.error('Error selecting audio file:', error);
      Alert.alert(t.error, 'Failed to select audio file.');
    }
  };

  const handleConfirmClone = async () => {
    if (!voiceNameInput?.trim()) {
      Alert.alert(t.error, 'Please enter a valid name.');
      return;
    }
    
    if (!pendingAudioFile) {
      Alert.alert(t.error, 'No audio file selected.');
      return;
    }
    
    setShowCloneModal(false);
    await cloneVoice(pendingAudioFile.uri, voiceNameInput.trim());
    setPendingAudioFile(null);
    setVoiceNameInput('');
  };

  const handleCancelClone = () => {
    setShowCloneModal(false);
    setPendingAudioFile(null);
    setVoiceNameInput('');
  };

  const cloneVoice = async (audioUri, name) => {
    try {
      setIsCloning(true);
      
      const voiceId = await elevenLabsService.cloneVoice(audioUri, name, `Cloned voice: ${name}`);
      trackApiUsage('elevenlabs', 0.50);
      
      await databaseService.createVoiceAsset({
        voice_id: voiceId,
        name: name,
        is_cloned: 1,
        is_system: 0,
        stability: 0.75,
        similarity: 0.90,
      });
      
      await loadVoices();
      Alert.alert(t.success, `Voice "${name}" cloned successfully!`);
    } catch (error) {
      console.error('Voice cloning failed:', error);
      Alert.alert(t.error, `Failed to clone voice: ${error.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handlePlayVoice = async (voice) => {
    try {
      // Stop current playback if any
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      // If same voice is playing, just stop
      if (playingVoice === voice.voice_id) {
        setPlayingVoice(null);
        return;
      }

      if (!isServiceReady) {
        Alert.alert(t.error, 'ElevenLabs API key not configured. Please add your API key in Settings.');
        return;
      }

      if (!testText.trim()) {
        Alert.alert(t.error, 'Please enter text to test in the TTS Playground below.');
        return;
      }

      setPlayingVoice(voice.voice_id);

      const audioData = await elevenLabsService.testTTS(testText, voice.voice_id, {
        stability: voice.stability || 0.75,
        similarity_boost: voice.similarity || 0.90,
      });

      // Track API usage
      const characterCount = testText.length;
      trackApiUsage('elevenlabs', (characterCount / 1000) * 0.03);

      const base64Audio = arrayBufferToBase64(audioData);
      const tempFile = `${cacheDirectory}voice_test_${Date.now()}.mp3`;
      await writeAsStringAsync(tempFile, base64Audio, {
        encoding: EncodingType.Base64,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: tempFile },
        { shouldPlay: true },
        (status) => {
          if (status.didJustFinish) {
            setPlayingVoice(null);
          }
        }
      );
      
      setSound(newSound);
    } catch (error) {
      console.error('TTS playback failed:', error);
      Alert.alert(t.error, `Playback failed: ${error.message}`);
      setPlayingVoice(null);
    }
  };

  const handleSetDefaultVoice = async (voice) => {
    try {
      if (defaultVoiceId === voice.voice_id) {
        // Clear default if already default
        await databaseService.clearDefaultVoice();
        setDefaultVoiceId(null);
        Alert.alert(t.success, `"${voice.name}" is no longer the default voice.`);
      } else {
        // Set as default
        await databaseService.setDefaultVoice(voice.voice_id);
        setDefaultVoiceId(voice.voice_id);
        Alert.alert(t.success, `"${voice.name}" set as default voice for simulations.`);
      }
    } catch (error) {
      Alert.alert(t.error, `Failed to set default: ${error.message}`);
    }
  };

  const handleDeleteVoice = (voice) => {
    if (voice.is_system === 1 || voice.is_system === true) {
      Alert.alert(t.error, 'System voices cannot be deleted.');
      return;
    }

    Alert.alert(t.delete, `Are you sure you want to delete "${voice.name}"?`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete from ElevenLabs API if service is ready
            if (isServiceReady && voice.is_cloned === 1) {
              try {
                await elevenLabsService.deleteVoice(voice.voice_id);
                console.log('Voice deleted from ElevenLabs:', voice.voice_id);
              } catch (apiError) {
                console.warn('Failed to delete from API (may already be deleted):', apiError);
                // Continue to delete from local DB even if API fails
              }
            }
            
            // Delete from local database
            await databaseService.deleteVoiceAsset(voice.voice_id);
            
            // Reload voices
            await loadVoices();
            
            Alert.alert(t.success, 'Voice deleted successfully.');
          } catch (error) {
            console.error('Delete voice error:', error);
            Alert.alert(t.error, `Failed to delete voice: ${error.message}`);
          }
        },
      },
    ]);
  };

  const handleVoiceSettings = (voice) => {
    setSelectedVoice(voice);
    setStability(voice.stability || 0.75);
    setSimilarity(voice.similarity || 0.9);
    setShowVoiceModal(true);
  };

  const handleSaveVoiceSettings = async () => {
    if (!selectedVoice) return;

    try {
      await databaseService.updateVoiceAsset(selectedVoice.voice_id, {
        stability,
        similarity,
      });
      loadVoices();
      setShowVoiceModal(false);
      Alert.alert(t.success, 'Voice settings saved');
    } catch (error) {
      Alert.alert(t.error, 'Failed to save voice settings');
    }
  };

  const VoiceCard = ({ voice, isSystem = false }) => {
    const isDefault = defaultVoiceId === voice.voice_id;
    const isCurrentlyPlaying = playingVoice === voice.voice_id;
    
    return (
      <Card variant="default" padding="md" style={{ marginBottom: SPACING.SM, backgroundColor: colors.CARD }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ position: 'relative' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: isSystem ? colors.BORDER : colors.ACCENT + '30',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: SPACING.MD,
              }}
            >
              <Mic2 size={24} color={isSystem ? colors.TEXT_SECONDARY : colors.ACCENT} />
            </View>
            {isDefault && (
              <View style={{
                position: 'absolute',
                bottom: -2,
                right: SPACING.MD - 4,
                backgroundColor: colors.ACCENT,
                borderRadius: 10,
                width: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Star size={12} color={colors.BG} fill={colors.BG} />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '600' }}>{voice.name}</Text>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginTop: 2 }}>
              {isSystem ? t.systemVoice : t.clonedVoice}
              {isDefault ? ' • Default' : ''}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Set Default Button */}
            <TouchableOpacity
              onPress={() => handleSetDefaultVoice(voice)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDefault ? colors.ACCENT + '20' : colors.BG,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Star 
                size={18} 
                color={isDefault ? colors.ACCENT : colors.TEXT_SECONDARY}
                fill={isDefault ? colors.ACCENT : 'transparent'}
              />
            </TouchableOpacity>

            {/* Play/Pause Button */}
            <TouchableOpacity
              onPress={() => handlePlayVoice(voice)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.BG,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCurrentlyPlaying ? (
                <Pause size={18} color={colors.ACCENT} fill={colors.ACCENT} />
              ) : (
                <Play size={18} color={colors.ACCENT} fill={colors.ACCENT} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleVoiceSettings(voice)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.BG,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={18} color={colors.TEXT_SECONDARY} />
            </TouchableOpacity>

            {!isSystem && (
              <TouchableOpacity
                onPress={() => handleDeleteVoice(voice)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FF6B6B20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={18} color="#FF6B6B" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.BG, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.ACCENT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.BG }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={{ flex: 1, backgroundColor: colors.BG }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.BG }}
      >
        <View style={{ padding: SPACING.MD, paddingBottom: 100, backgroundColor: colors.BG }}>
          <Text style={{ color: colors.TEXT, fontSize: 28, fontWeight: '700' }}>{t.voiceLab}</Text>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginTop: 4, marginBottom: SPACING.LG }}>
            {t.testVoicesDescription}
          </Text>

          {/* Voice Slots Indicator */}
          <Card variant="outlined" padding="md" style={{ marginBottom: SPACING.LG, backgroundColor: colors.CARD }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '600' }}>{t.voiceSlots}</Text>
                <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 13, marginTop: 2 }}>
                  {getClonedVoiceCount()} / {MAX_VOICE_SLOTS} {t.clonedVoices}
                </Text>
            </View>
            <TouchableOpacity
              onPress={handleAddVoice}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.ACCENT,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                gap: 6,
              }}
            >
              <Plus size={18} color={colors.BG} />
              <Text style={{ color: colors.BG, fontWeight: '600' }}>{t.cloneVoice}</Text>
            </TouchableOpacity>
          </View>

          {/* Slot indicators */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACING.MD }}>
            {[...Array(MAX_VOICE_SLOTS)].map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i < getClonedVoiceCount() ? colors.ACCENT : colors.BORDER,
                }}
              />
            ))}
          </View>
        </Card>

        {/* System Voices */}
        <Text
          style={{
            color: colors.TEXT_SECONDARY,
            fontSize: 13,
            fontWeight: '600',
            marginBottom: SPACING.SM,
          }}
        >
          {t.systemVoices}
        </Text>
        {systemVoices.map((voice) => (
          <VoiceCard key={voice.voice_id} voice={voice} isSystem />
        ))}

        {/* Cloned Voices */}
        {voices.filter((v) => v.is_cloned === 1).length > 0 && (
          <>
            <Text
              style={{
                color: colors.TEXT_SECONDARY,
                fontSize: 13,
                fontWeight: '600',
                marginTop: SPACING.LG,
                marginBottom: SPACING.SM,
              }}
            >
              {t.yourClonedVoices}
            </Text>
            {voices
              .filter((v) => v.is_cloned === 1)
              .map((voice) => (
                <VoiceCard key={voice.voice_id} voice={voice} />
              ))}
          </>
        )}

        {/* TTS Playground */}
        <Card variant="default" padding="md" style={{ marginTop: SPACING.LG, backgroundColor: colors.CARD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.MD }}>
            <Volume2 size={20} color={colors.ACCENT} />
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              {t.ttsPlayground}
            </Text>
          </View>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginBottom: SPACING.MD }}>
            {t.testVoicesDescription}
          </Text>
          <TextInput
            value={testText}
            onChangeText={setTestText}
            placeholder="Type text to test voice..."
            placeholderTextColor={colors.TEXT_SECONDARY}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: colors.BG,
              borderRadius: 8,
              padding: 16,
              color: colors.TEXT,
              fontSize: 14,
              borderWidth: 1,
              borderColor: colors.BORDER,
              textAlignVertical: 'top',
              minHeight: 80,
            }}
          />
        </Card>
      </View>

      {/* Clone Voice Modal */}
      <Modal
        visible={showCloneModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelClone}
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
                {t.cloneVoice}
              </Text>
              <TouchableOpacity onPress={handleCancelClone}>
                <X size={24} color={colors.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginBottom: SPACING.MD }}>
              Enter a name for this cloned voice:
            </Text>

            <TextInput
              value={voiceNameInput}
              onChangeText={setVoiceNameInput}
              placeholder="e.g., My Voice, Customer Service"
              placeholderTextColor={colors.TEXT_SECONDARY}
              autoFocus
              style={{
                backgroundColor: colors.BG,
                borderRadius: 8,
                paddingHorizontal: SPACING.MD,
                paddingVertical: SPACING.SM,
                fontSize: 16,
                color: colors.TEXT,
                marginBottom: SPACING.LG,
                borderWidth: 1,
                borderColor: colors.BORDER,
              }}
            />

            <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
              <TouchableOpacity
                onPress={handleCancelClone}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.BORDER,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.TEXT, fontWeight: '600' }}>{t.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmClone}
                disabled={!voiceNameInput?.trim() || isCloning}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 8,
                  backgroundColor: voiceNameInput?.trim() ? colors.ACCENT : colors.BORDER,
                  alignItems: 'center',
                }}
              >
                {isCloning ? (
                  <ActivityIndicator size="small" color={colors.BG} />
                ) : (
                  <Text style={{ 
                    color: voiceNameInput?.trim() ? colors.BG : colors.TEXT_SECONDARY, 
                    fontWeight: '600' 
                  }}>
                    Clone
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Voice Settings Modal */}
      <Modal
        visible={showVoiceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVoiceModal(false)}
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
              <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '700' }}>{t.voiceSettings}</Text>
              <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                <X size={24} color={colors.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            {selectedVoice && (
              <Text style={{ color: colors.ACCENT, fontSize: 16, marginBottom: SPACING.LG }}>
                {selectedVoice.name}
              </Text>
            )}

            {/* Stability Slider */}
            <View style={{ marginBottom: SPACING.LG }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.TEXT, fontSize: 14, fontWeight: '600' }}>{t.stability}</Text>
                <Text style={{ color: colors.ACCENT, fontSize: 14 }}>{Math.round(stability * 100)}%</Text>
              </View>
              <Slider
                value={stability}
                onValueChange={setStability}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                minimumTrackTintColor={colors.ACCENT}
                maximumTrackTintColor={colors.BORDER}
                thumbTintColor={colors.ACCENT}
              />
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}>
                {t.stabilityDescription}
              </Text>
            </View>

            {/* Similarity Slider */}
            <View style={{ marginBottom: SPACING.LG }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.TEXT, fontSize: 14, fontWeight: '600' }}>{t.similarity}</Text>
                <Text style={{ color: colors.ACCENT, fontSize: 14 }}>{Math.round(similarity * 100)}%</Text>
              </View>
              <Slider
                value={similarity}
                onValueChange={setSimilarity}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                minimumTrackTintColor={colors.ACCENT}
                maximumTrackTintColor={colors.BORDER}
                thumbTintColor={colors.ACCENT}
              />
              <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}>
                {t.similarityDescription}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSaveVoiceSettings}
              style={{
                backgroundColor: colors.ACCENT,
                borderRadius: 8,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.BG, fontSize: 16, fontWeight: '600' }}>{t.save}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
