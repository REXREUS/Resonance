import { Audio } from 'expo-av';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { chaosEngine } from './chaosEngine';
import { databaseService } from './databaseService';

/**
 * SpeechService for continuous Speech-to-Text using Gemini
 * Uses VAD-like silence detection for natural conversation flow
 */
class SpeechService {
  constructor() {
    this.recording = null;
    this.isRecording = false;
    this.isListening = false;
    this.genAI = null;
    this.model = null;
    this.onTranscription = null;
    this.onListeningStateChange = null;
    this.onSpeakingStateChange = null;
    
    // VAD-like settings - optimized for faster response
    this.silenceThreshold = 1200; // ms of silence before processing (reduced for faster response)
    this.minRecordingDuration = 500; // minimum recording duration (reduced)
    this.maxRecordingDuration = 30000; // max 30 seconds
    this.silenceTimer = null;
    this.recordingStartTime = null;
    this.isProcessing = false;
    this.isSpeaking = false; // User is speaking
    
    // Metering for silence detection - optimized thresholds
    this.meteringInterval = null;
    this.lastMeteringValue = -160;
    this.speakingThreshold = -40; // dB threshold for speech detection (more sensitive)
    this.silenceCount = 0;
    this.silenceCountThreshold = 12; // ~1.2 seconds at 100ms interval (faster)
    this.speakingCount = 0; // Track consecutive speaking frames
    this.minSpeakingFrames = 2; // Minimum frames to confirm speaking (faster)
  }

  /**
   * Initialize the speech service
   */
  async initialize() {
    try {
      // Get Gemini API key
      const apiKey = await SecureStore.getItemAsync('api_key_gemini');
      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
      });

      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio permission not granted');
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('SpeechService initialized');
      return true;
    } catch (error) {
      console.error('SpeechService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start continuous listening mode (VAD-based)
   */
  async startListening() {
    if (this.isListening) {
      console.log('Already listening, skipping start');
      return;
    }

    // If currently processing, wait a bit
    if (this.isProcessing) {
      console.log('Currently processing, waiting before starting listening...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      this.isListening = true;
      this.silenceCount = 0;
      this.speakingCount = 0;
      this.isSpeaking = false;
      
      if (this.onListeningStateChange) {
        this.onListeningStateChange(true);
      }

      // Start recording
      await this.startRecording();
      
      console.log('Started listening mode');
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.isListening = false;
      throw error;
    }
  }

  /**
   * Stop listening mode
   */
  async stopListening() {
    this.isListening = false;
    
    // Clear timers
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }

    // Stop recording if active
    if (this.isRecording) {
      await this.cancelRecording();
    }

    if (this.onListeningStateChange) {
      this.onListeningStateChange(false);
    }

    console.log('Stopped listening mode');
  }

  /**
   * Start recording audio with metering
   */
  async startRecording() {
    try {
      if (this.isRecording) {
        return;
      }

      // Make sure any existing recording is cleaned up first
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch (e) {
          // Ignore - recording might already be stopped
        }
        this.recording = null;
      }

      // Create recording with metering enabled
      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        }
      );

      this.recording = recording;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.silenceCount = 0;

      // Start metering for VAD
      this.startMetering();

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      // Reset state on error
      this.isRecording = false;
      this.recording = null;
      throw error;
    }
  }

  /**
   * Start metering interval for silence detection
   */
  startMetering() {
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
    }

    this.meteringInterval = setInterval(async () => {
      if (!this.recording || !this.isRecording) {
        return;
      }

      try {
        // Check if chaos engine has muted the mic (hardware failure simulation)
        if (chaosEngine.isMicMuted()) {
          // Simulate muted mic - don't process any speech
          this.lastMeteringValue = -160;
          return;
        }

        // Check if connection is dropped (hardware failure simulation)
        if (chaosEngine.isConnectionDropped()) {
          // Simulate connection drop - don't process any speech
          this.lastMeteringValue = -160;
          return;
        }

        const status = await this.recording.getStatusAsync();
        
        if (status.isRecording && status.metering !== undefined) {
          const metering = status.metering;
          this.lastMeteringValue = metering;

          // Check if user is speaking (above threshold)
          if (metering > this.speakingThreshold) {
            // Increment speaking count
            this.speakingCount++;
            
            // Only confirm speaking after minimum frames
            if (this.speakingCount >= this.minSpeakingFrames && !this.isSpeaking) {
              this.isSpeaking = true;
              console.log('User started speaking, metering:', metering);
              
              // Trigger haptic feedback for barge-in if enabled
              this.triggerBargeInHaptic();
              
              if (this.onSpeakingStateChange) {
                this.onSpeakingStateChange(true);
              }
            }
            this.silenceCount = 0;
          } else {
            // Silence detected
            this.speakingCount = 0;
            
            if (this.isSpeaking) {
              this.silenceCount++;
              
              // Check if silence duration exceeded threshold
              if (this.silenceCount >= this.silenceCountThreshold) {
                console.log('Silence detected, processing recording...');
                this.isSpeaking = false;
                if (this.onSpeakingStateChange) {
                  this.onSpeakingStateChange(false);
                }
                
                // Process the recording
                await this.processRecording();
              }
            }
          }

          // Check max recording duration
          const duration = Date.now() - this.recordingStartTime;
          if (duration >= this.maxRecordingDuration) {
            console.log('Max recording duration reached');
            await this.processRecording();
          }
        }
      } catch (error) {
        // Ignore metering errors
      }
    }, 100); // Check every 100ms
  }

  /**
   * Process current recording (stop, transcribe, restart)
   */
  async processRecording() {
    if (this.isProcessing || !this.isRecording) {
      return;
    }

    const duration = Date.now() - this.recordingStartTime;
    
    // Skip if recording too short
    if (duration < this.minRecordingDuration) {
      console.log('Recording too short, skipping. Duration:', duration, 'ms');
      // Reset speaking state and continue listening
      this.silenceCount = 0;
      this.speakingCount = 0;
      return;
    }

    try {
      this.isProcessing = true;

      // Stop metering temporarily
      if (this.meteringInterval) {
        clearInterval(this.meteringInterval);
        this.meteringInterval = null;
      }

      // Stop and get recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      this.recording = null;

      console.log('Processing recording, duration:', duration, 'ms');

      if (uri) {
        // Transcribe in background
        this.transcribeAndCallback(uri);
      }

      // Restart recording if still listening
      if (this.isListening) {
        // Small delay before restarting
        await new Promise(resolve => setTimeout(resolve, 200));
        await this.startRecording();
      }

    } catch (error) {
      console.error('Failed to process recording:', error);
      // Try to restart recording on error
      if (this.isListening) {
        try {
          await this.startRecording();
        } catch (e) {
          console.error('Failed to restart recording:', e);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Transcribe audio and call callback
   */
  async transcribeAndCallback(uri) {
    try {
      const transcription = await this.transcribeAudio(uri);
      
      // Clean up file
      try {
        await LegacyFileSystem.deleteAsync(uri);
      } catch (e) {
        // Ignore
      }

      if (transcription && transcription.trim() && this.onTranscription) {
        this.onTranscription(transcription);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
    }
  }

  /**
   * Trigger haptic feedback for barge-in (if enabled in settings)
   */
  async triggerBargeInHaptic() {
    try {
      // Check if haptic feedback is enabled in settings
      let hapticEnabled = true;
      try {
        const settings = await databaseService.getAppSettings();
        hapticEnabled = settings?.haptic_enabled === 1;
      } catch (e) {
        // Default to enabled if can't read settings
      }

      if (hapticEnabled) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        console.log('Barge-in haptic feedback triggered');
      }
    } catch (error) {
      console.warn('Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * Transcribe audio file using Gemini
   */
  async transcribeAudio(audioUri) {
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      // Read audio file as base64 using legacy API
      const audioBase64 = await LegacyFileSystem.readAsStringAsync(audioUri, {
        encoding: LegacyFileSystem.EncodingType.Base64,
      });

      // Determine mime type
      const mimeType = audioUri.endsWith('.m4a') ? 'audio/mp4' : 
                       audioUri.endsWith('.wav') ? 'audio/wav' :
                       audioUri.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4';

      // Create content with audio
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64,
          },
        },
        { text: 'Transcribe this audio exactly as spoken. Only output the transcription text, nothing else. If the audio is silent, empty, or unclear, respond with exactly: [SILENCE]' },
      ]);

      const transcription = result.response.text().trim();
      
      // Filter out silence/empty markers
      if (transcription === '[SILENCE]' || 
          transcription.toLowerCase().includes('[silence]') ||
          transcription.length < 2) {
        return null;
      }

      console.log('Transcription:', transcription);
      return transcription;
    } catch (error) {
      console.error('Transcription failed:', error);
      return null;
    }
  }

  /**
   * Set callback for transcription results
   */
  setTranscriptionCallback(callback) {
    this.onTranscription = callback;
  }

  /**
   * Set callback for listening state changes
   */
  setListeningStateCallback(callback) {
    this.onListeningStateChange = callback;
  }

  /**
   * Set callback for speaking state changes (VAD)
   */
  setSpeakingStateCallback(callback) {
    this.onSpeakingStateChange = callback;
  }

  /**
   * Get current metering value
   */
  getMeteringValue() {
    return this.lastMeteringValue;
  }

  /**
   * Check if currently listening
   */
  isCurrentlyListening() {
    return this.isListening;
  }

  /**
   * Check if user is currently speaking
   */
  isUserSpeaking() {
    return this.isSpeaking;
  }

  /**
   * Cancel current recording without processing
   */
  async cancelRecording() {
    try {
      if (this.meteringInterval) {
        clearInterval(this.meteringInterval);
        this.meteringInterval = null;
      }

      // Only try to stop if we have a recording and it's active
      if (this.recording && this.isRecording) {
        try {
          const status = await this.recording.getStatusAsync();
          if (status.isRecording || status.canRecord) {
            await this.recording.stopAndUnloadAsync();
          }
        } catch (e) {
          // Recording might already be stopped, ignore
          console.log('Recording already stopped or not available');
        }
        
        const uri = this.recording.getURI();
        if (uri) {
          try {
            await LegacyFileSystem.deleteAsync(uri);
          } catch (e) {
            // Ignore file deletion errors
          }
        }
      }
      
      this.isRecording = false;
      this.recording = null;
      this.isSpeaking = false;
      this.silenceCount = 0;
      this.speakingCount = 0;

      console.log('Recording cancelled');
    } catch (error) {
      // Reset state even on error
      this.isRecording = false;
      this.recording = null;
      this.isSpeaking = false;
      console.log('Recording cancel completed with cleanup');
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.stopListening();
    this.onTranscription = null;
    this.onListeningStateChange = null;
    this.onSpeakingStateChange = null;
    console.log('SpeechService cleaned up');
  }
}

// Export singleton
export const speechService = new SpeechService();
export default speechService;
