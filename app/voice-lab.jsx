import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Zap, Type, ArrowLeft, Save, Key, Star, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import elevenLabsService from '../services/elevenLabsService';
import databaseService from '../services/databaseService';
import { quotaService } from '../services/quotaService';
import useSettingsStore from '../stores/settingsStore';
import useTheme from '../hooks/useTheme';
import { SPACING, BORDER_RADIUS } from '../constants/theme';

// UI Components
import { Badge, TabSwitch, Slider, Card } from '../components/ui';
import { VoiceCard, AddVoiceCard, VoiceTestInput } from '../components/voice';

const MAX_CLONED_VOICES = 5;
const DEFAULT_CHARACTER_QUOTA = 20000;

export default function VoiceLab() {
  const router = useRouter();
  const { apiKeys, trackApiUsage } = useSettingsStore();
  const { colors } = useTheme();
  
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [defaultVoiceId, setDefaultVoiceId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clonedVoiceCount, setClonedVoiceCount] = useState(0);
  const [characterQuota, setCharacterQuota] = useState(DEFAULT_CHARACTER_QUOTA);
  const [testText, setTestText] = useState('Hello, this is a test of the voice synthesis system.');
  const [stability, setStability] = useState(0.75);
  const [similarity, setSimilarity] = useState(0.90);
  const [sound, setSound] = useState(null);
  const [activeTab, setActiveTab] = useState('cloned');
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Voice name input modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState(null);
  const [voiceNameInput, setVoiceNameInput] = useState('');

  useEffect(() => {
    initializeVoiceLab();
    
    return () => {
      cleanupAudio();
    };
  }, []);

  // Re-initialize when apiKeys change (e.g., after saving in settings)
  useEffect(() => {
    if (apiKeys.elevenlabs && apiKeys.elevenlabs.trim() !== '') {
      initializeVoiceLab();
    }
  }, [apiKeys.elevenlabs]);

  const initializeVoiceLab = async () => {
    try {
      setIsLoading(true);
      
      // Initialize database if needed
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      
      // Check for API key first - check both store and secure storage
      let apiKey = apiKeys.elevenlabs;
      if (!apiKey || apiKey.trim() === '') {
        apiKey = await databaseService.getApiKey('elevenlabs');
      }
      
      const hasKey = apiKey && apiKey.trim().length > 0;
      setHasApiKey(hasKey);
      
      if (hasKey) {
        // Initialize ElevenLabs service
        await initializeElevenLabsService(apiKey);
      }
      
      // Load voices, counts, and default voice
      await loadVoices();
      await loadClonedVoiceCount();
      await loadDefaultVoice();
      
      // Setup audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      
    } catch (error) {
      console.error('Failed to initialize Voice Lab:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeElevenLabsService = async (providedApiKey = null) => {
    try {
      let apiKey = providedApiKey || apiKeys.elevenlabs;
      if (!apiKey || apiKey.trim() === '') {
        apiKey = await databaseService.getApiKey('elevenlabs');
      }
      
      if (!apiKey || apiKey.trim() === '') {
        setIsServiceReady(false);
        setHasApiKey(false);
        console.log('No ElevenLabs API key found');
        return;
      }
      
      setHasApiKey(true);
      await elevenLabsService.initialize({ apiKey: apiKey.trim() });
      setIsServiceReady(true);
      console.log('ElevenLabs service initialized successfully');
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

  const cleanupAudio = async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error cleaning up audio:', error);
      }
    }
  };


  const loadVoices = async () => {
    try {
      if (!isServiceReady && !elevenLabsService.apiKey) {
        const localVoices = await databaseService.getVoiceAssets();
        setVoices(localVoices.map(v => ({
          id: v.voice_id,
          name: v.name,
          isCloned: v.is_cloned === 1,
          isSystem: v.is_system === 1,
          stability: v.stability,
          similarity: v.similarity,
          isProcessing: false,
          isOffline: true,
        })));
        return;
      }
      
      const apiVoices = await elevenLabsService.listVoices();
      const localVoices = await databaseService.getVoiceAssets();
      const voiceMap = new Map();
      
      apiVoices.forEach(voice => {
        voiceMap.set(voice.id, { ...voice, isProcessing: false });
      });
      
      localVoices.forEach(localVoice => {
        if (voiceMap.has(localVoice.voice_id)) {
          const existing = voiceMap.get(localVoice.voice_id);
          voiceMap.set(localVoice.voice_id, {
            ...existing,
            stability: localVoice.stability,
            similarity: localVoice.similarity,
          });
        } else {
          voiceMap.set(localVoice.voice_id, {
            id: localVoice.voice_id,
            name: localVoice.name,
            isCloned: localVoice.is_cloned === 1,
            isSystem: localVoice.is_system === 1,
            stability: localVoice.stability,
            similarity: localVoice.similarity,
            isProcessing: false,
            isDeleted: true,
          });
        }
      });
      
      // Sync new API voices to local database
      for (const voice of apiVoices) {
        const existingLocal = localVoices.find(v => v.voice_id === voice.id);
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
      
      setVoices(Array.from(voiceMap.values()));
    } catch (error) {
      console.error('Failed to load voices:', error);
      try {
        const localVoices = await databaseService.getVoiceAssets();
        setVoices(localVoices.map(v => ({
          id: v.voice_id,
          name: v.name,
          isCloned: v.is_cloned === 1,
          isSystem: v.is_system === 1,
          stability: v.stability,
          similarity: v.similarity,
          isProcessing: false,
          isOffline: true,
        })));
      } catch (dbError) {
        console.error('Failed to load local voices:', dbError);
      }
      Alert.alert('Warning', 'Could not load voices from server. Showing cached voices.');
    }
  };

  const loadClonedVoiceCount = async () => {
    try {
      const count = await databaseService.getClonedVoiceCount();
      setClonedVoiceCount(count);
    } catch (error) {
      console.error('Failed to load cloned voice count:', error);
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

  const onPlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  };


  const handleCloneVoice = async () => {
    try {
      if (!isServiceReady) {
        Alert.alert('Error', 'ElevenLabs service not ready. Please check your API key in settings.');
        return;
      }

      if (clonedVoiceCount >= MAX_CLONED_VOICES) {
        Alert.alert('Limit Reached', `Maximum ${MAX_CLONED_VOICES} voice slots. Delete a voice first.`);
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert('Error', 'Audio file too large. Maximum 10MB.');
        return;
      }

      // Store the file and show name input modal
      setPendingAudioFile(file);
      setVoiceNameInput('');
      setShowNameModal(true);
    } catch (error) {
      console.error('Error selecting audio file:', error);
      Alert.alert('Error', 'Failed to select audio file.');
    }
  };

  const handleConfirmClone = async () => {
    if (!voiceNameInput?.trim()) {
      Alert.alert('Error', 'Please enter a valid name.');
      return;
    }
    
    if (!pendingAudioFile) {
      Alert.alert('Error', 'No audio file selected.');
      return;
    }
    
    setShowNameModal(false);
    await cloneVoice(pendingAudioFile.uri, voiceNameInput.trim());
    setPendingAudioFile(null);
    setVoiceNameInput('');
  };

  const handleCancelClone = () => {
    setShowNameModal(false);
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
      await loadClonedVoiceCount();
      
      Alert.alert('Success', `Voice "${name}" cloned successfully!`);
    } catch (error) {
      console.error('Voice cloning failed:', error);
      Alert.alert('Error', `Failed to clone voice: ${error.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleDeleteVoice = async (voice) => {
    if (!voice.isCloned) {
      Alert.alert('Error', 'Only cloned voices can be deleted.');
      return;
    }

    Alert.alert(
      'Delete Voice',
      `Delete "${voice.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!voice.isDeleted && !voice.isOffline) {
                await elevenLabsService.deleteVoice(voice.id);
              }
              await databaseService.deleteVoiceAsset(voice.id);
              await loadVoices();
              await loadClonedVoiceCount();
              
              if (selectedVoice?.id === voice.id) {
                setSelectedVoice(null);
              }
              Alert.alert('Success', 'Voice deleted.');
            } catch (error) {
              Alert.alert('Error', `Failed to delete: ${error.message}`);
            }
          },
        },
      ]
    );
  };


  const handleTestVoice = async (voice) => {
    try {
      if (!testText.trim()) {
        Alert.alert('Error', 'Please enter text to test in the TTS Playground below.');
        return;
      }

      if (!isServiceReady) {
        Alert.alert('Error', 'ElevenLabs not ready. Check API key in settings.');
        return;
      }

      // Stop any currently playing sound
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }

      // Check quota before TTS
      const characterCount = testText.length;
      const ttsCost = quotaService.estimateCost('elevenlabs', 'tts', { textLength: characterCount });
      const canAfford = await quotaService.canAfford(ttsCost);
      if (!canAfford) {
        Alert.alert('Quota Exceeded', 'Daily budget limit reached. Please try again tomorrow or increase your limit in settings.');
        return;
      }

      setIsTesting(true);
      setSelectedVoice(voice);

      // Use voice's own settings or current slider settings
      const voiceStability = voice.stability || stability;
      const voiceSimilarity = voice.similarity || similarity;

      const audioData = await elevenLabsService.testTTS(testText, voice.id, {
        stability: voiceStability,
        similarity_boost: voiceSimilarity,
      });

      // Track API usage in database
      await quotaService.recordUsage('elevenlabs', ttsCost, null, 'voice_test');
      setCharacterQuota((prev) => Math.max(0, prev - characterCount));

      const base64Audio = arrayBufferToBase64(audioData);
      const tempFile = `${FileSystem.cacheDirectory}voice_test_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(tempFile, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: tempFile },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      setIsPlaying(true);
      
      // Update sliders to match voice settings
      setStability(voiceStability);
      setSimilarity(voiceSimilarity);
      
    } catch (error) {
      console.error('TTS test failed:', error);
      Alert.alert('Error', `Test failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleStopPlayback = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        setIsPlaying(false);
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    }
  };

  const handleSelectVoice = (voice) => {
    setSelectedVoice(voice);
    setStability(voice.stability || 0.75);
    setSimilarity(voice.similarity || 0.90);
  };

  const handleUpdateVoiceSettings = async () => {
    if (!selectedVoice) {
      Alert.alert('Error', 'Select a voice first.');
      return;
    }

    try {
      if (!selectedVoice.isOffline && !selectedVoice.isDeleted) {
        await elevenLabsService.updateVoiceSettings(selectedVoice.id, {
          stability: stability,
          similarity_boost: similarity,
        });
      }

      await databaseService.updateVoiceAsset(selectedVoice.id, {
        stability: stability,
        similarity: similarity,
      });

      await loadVoices();
      Alert.alert('Success', 'Voice settings updated.');
    } catch (error) {
      Alert.alert('Error', `Failed to update: ${error.message}`);
    }
  };

  const handleSetDefaultVoice = async (voice) => {
    try {
      if (defaultVoiceId === voice.id) {
        // Clear default if already default
        await databaseService.clearDefaultVoice();
        setDefaultVoiceId(null);
        Alert.alert('Success', `"${voice.name}" is no longer the default voice.`);
      } else {
        // Set as default
        await databaseService.setDefaultVoice(voice.id);
        setDefaultVoiceId(voice.id);
        Alert.alert('Success', `"${voice.name}" set as default voice for simulations.`);
      }
      await loadVoices();
    } catch (error) {
      Alert.alert('Error', `Failed to set default: ${error.message}`);
    }
  };

  const handleGoToSettings = () => {
    router.push('/(tabs)/settings');
  };

  // Filter voices by type
  const clonedVoices = voices.filter(v => v.isCloned);
  const systemVoices = voices.filter(v => v.isSystem || !v.isCloned);

  // Empty state when no API key
  const renderNoApiKeyState = () => (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: SPACING.XL,
      marginTop: 60,
    }}>
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.ACCENT + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.LG,
      }}>
        <Key size={40} color={colors.ACCENT} />
      </View>
      <Text style={{ 
        fontSize: 20, 
        fontWeight: '700', 
        color: colors.TEXT, 
        textAlign: 'center',
        marginBottom: SPACING.SM,
      }}>
        No API Key Configured
      </Text>
      <Text style={{ 
        fontSize: 14, 
        color: colors.TEXT_SECONDARY, 
        textAlign: 'center',
        marginBottom: SPACING.LG,
        lineHeight: 22,
      }}>
        Add your ElevenLabs API key in Settings to access voice cloning and text-to-speech features.
      </Text>
      <TouchableOpacity
        onPress={handleGoToSettings}
        style={{
          backgroundColor: colors.ACCENT,
          paddingHorizontal: SPACING.XL,
          paddingVertical: SPACING.MD,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: colors.BG, fontWeight: '600', fontSize: 16 }}>
          Go to Settings
        </Text>
      </TouchableOpacity>
    </View>
  );


  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.ACCENT} />
        <Text style={{ color: colors.TEXT, marginTop: SPACING.MD }}>Loading Voice Lab...</Text>
      </SafeAreaView>
    );
  }

  // Show empty state if no API key
  if (!hasApiKey) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
        <View style={{ padding: SPACING.MD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.MD }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: SPACING.SM }}>
              <ArrowLeft size={24} color={colors.TEXT} />
            </TouchableOpacity>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.TEXT }}>Voice Lab</Text>
          </View>
        </View>
        {renderNoApiKeyState()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
      {/* Header */}
      <View style={{ padding: SPACING.MD, paddingBottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.MD }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: SPACING.SM }}>
            <ArrowLeft size={24} color={colors.TEXT} />
          </TouchableOpacity>
          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.TEXT, flex: 1 }}>Voice Lab</Text>
          <TouchableOpacity onPress={handleUpdateVoiceSettings}>
            <Save size={24} color={selectedVoice ? colors.ACCENT : colors.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {/* Stats Badges */}
        <View style={{ flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.MD, flexWrap: 'wrap' }}>
          <Badge variant="outline" size="md" icon={<Zap size={12} color={colors.TEXT} />}>
            {clonedVoiceCount}/{MAX_CLONED_VOICES} Slots
          </Badge>
          <Badge variant="outline" size="md" icon={<Type size={12} color={colors.TEXT} />}>
            {Math.round(characterQuota / 1000)}k Chars Left
          </Badge>
          {defaultVoiceId && (
            <Badge variant="yellow" size="md" icon={<Star size={12} color={colors.BG} />}>
              Default Set
            </Badge>
          )}
          {isCloning && (
            <Badge variant="yellow" size="md">
              Cloning...
            </Badge>
          )}
        </View>

        {/* Tab Switch */}
        <TabSwitch
          tabs={[
            { key: 'cloned', label: 'My Voices' },
            { key: 'system', label: 'System Library' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          variant="yellow"
          fullWidth
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.MD }}>
        {/* Voice Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginBottom: SPACING.LG }}>
          {activeTab === 'cloned' && (
            <>
              <AddVoiceCard onPress={handleCloneVoice} style={{ width: '48%' }} />
              {clonedVoices.length === 0 ? (
                <View style={{ width: '48%', padding: SPACING.MD, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 13, textAlign: 'center' }}>
                    No cloned voices yet. Tap + to add one.
                  </Text>
                </View>
              ) : (
                clonedVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    name={voice.name}
                    tags={[
                      voice.isDeleted ? 'DELETED' : 'CLONED',
                      ...(defaultVoiceId === voice.id ? ['DEFAULT'] : [])
                    ]}
                    isPlaying={selectedVoice?.id === voice.id && isPlaying}
                    isProcessing={isTesting && selectedVoice?.id === voice.id}
                    isSelected={selectedVoice?.id === voice.id}
                    isDefault={defaultVoiceId === voice.id}
                    onPlay={() => handleTestVoice(voice)}
                    onPause={handleStopPlayback}
                    onSelect={() => handleSelectVoice(voice)}
                    onSetDefault={() => handleSetDefaultVoice(voice)}
                    onMore={() => handleDeleteVoice(voice)}
                    style={{ width: '48%' }}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'system' && (
            <>
              {systemVoices.length === 0 ? (
                <View style={{ flex: 1, padding: SPACING.LG, alignItems: 'center' }}>
                  <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14 }}>
                    No system voices available.
                  </Text>
                </View>
              ) : (
                systemVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    name={voice.name}
                    tags={[
                      'SYSTEM',
                      ...(defaultVoiceId === voice.id ? ['DEFAULT'] : [])
                    ]}
                    isPlaying={selectedVoice?.id === voice.id && isPlaying}
                    isProcessing={isTesting && selectedVoice?.id === voice.id}
                    isSelected={selectedVoice?.id === voice.id}
                    isDefault={defaultVoiceId === voice.id}
                    onPlay={() => handleTestVoice(voice)}
                    onPause={handleStopPlayback}
                    onSelect={() => handleSelectVoice(voice)}
                    onSetDefault={() => handleSetDefaultVoice(voice)}
                    onMore={() => {}}
                    style={{ width: '48%' }}
                  />
                ))
              )}
            </>
          )}
        </View>

        {/* Test & Preview Section */}
        <Card variant="default" padding="lg" style={{ backgroundColor: colors.CARD }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.MD }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.TEXT }}>
              TEST & PREVIEW
            </Text>
            {selectedVoice && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {defaultVoiceId === selectedVoice.id && (
                  <Star size={14} color={colors.ACCENT} fill={colors.ACCENT} />
                )}
                <Text style={{ fontSize: 14, color: colors.ACCENT }}>
                  {selectedVoice.name}
                </Text>
              </View>
            )}
          </View>

          <VoiceTestInput
            value={testText}
            onChangeText={setTestText}
            onTest={() => selectedVoice && handleTestVoice(selectedVoice)}
            placeholder="Type here to test voice..."
            disabled={!selectedVoice || isTesting}
            style={{ marginBottom: SPACING.MD }}
          />

          <Slider
            label="STABILITY"
            value={stability * 100}
            onValueChange={(v) => setStability(v / 100)}
            min={0}
            max={100}
            unit="%"
            showValue
            style={{ marginBottom: SPACING.MD }}
          />

          <Slider
            label="SIMILARITY"
            value={similarity * 100}
            onValueChange={(v) => setSimilarity(v / 100)}
            min={0}
            max={100}
            unit="%"
            showValue
            style={{ marginBottom: SPACING.MD }}
          />

          {/* Set as Default Button */}
          {selectedVoice && (
            <TouchableOpacity
              onPress={() => handleSetDefaultVoice(selectedVoice)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: defaultVoiceId === selectedVoice.id ? colors.ACCENT : 'transparent',
                borderWidth: 1,
                borderColor: colors.ACCENT,
                borderRadius: 8,
                paddingVertical: SPACING.SM,
                gap: 8,
              }}
            >
              <Star 
                size={18} 
                color={defaultVoiceId === selectedVoice.id ? colors.BG : colors.ACCENT}
                fill={defaultVoiceId === selectedVoice.id ? colors.BG : 'transparent'}
              />
              <Text style={{ 
                color: defaultVoiceId === selectedVoice.id ? colors.BG : colors.ACCENT,
                fontWeight: '600',
              }}>
                {defaultVoiceId === selectedVoice.id ? 'Default Voice' : 'Set as Default'}
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      </ScrollView>

      {/* Voice Name Input Modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelClone}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: SPACING.LG,
        }}>
          <View style={{
            backgroundColor: colors.CARD,
            borderRadius: BORDER_RADIUS.LG,
            padding: SPACING.LG,
            width: '100%',
            maxWidth: 340,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: SPACING.MD,
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: colors.TEXT,
              }}>
                Voice Name
              </Text>
              <TouchableOpacity onPress={handleCancelClone}>
                <X size={24} color={colors.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            
            <Text style={{
              fontSize: 14,
              color: colors.TEXT_SECONDARY,
              marginBottom: SPACING.MD,
            }}>
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
                borderRadius: BORDER_RADIUS.MD,
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
                  paddingVertical: SPACING.SM,
                  borderRadius: BORDER_RADIUS.MD,
                  borderWidth: 1,
                  borderColor: colors.BORDER,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.TEXT, fontWeight: '600' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleConfirmClone}
                disabled={!voiceNameInput?.trim() || isCloning}
                style={{
                  flex: 1,
                  paddingVertical: SPACING.SM,
                  borderRadius: BORDER_RADIUS.MD,
                  backgroundColor: voiceNameInput?.trim() ? colors.ACCENT : colors.BORDER,
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: voiceNameInput?.trim() ? colors.BG : colors.TEXT_SECONDARY, 
                  fontWeight: '600' 
                }}>
                  {isCloning ? 'Cloning...' : 'Clone'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
