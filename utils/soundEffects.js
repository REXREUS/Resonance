import { Audio } from 'expo-av';

/**
 * Sound Effects utility for playing beep sounds and other audio cues
 * Uses programmatically generated tones for realistic call center effects
 */
class SoundEffects {
  constructor() {
    this.sounds = {};
    this.isInitialized = false;
  }

  /**
   * Initialize sound effects
   */
  async initialize() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.isInitialized = true;
      console.log('SoundEffects initialized');
    } catch (error) {
      console.warn('SoundEffects initialization failed:', error);
    }
  }

  /**
   * Generate a beep tone as WAV data
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in milliseconds
   * @param {number} volume - Volume (0-1)
   * @returns {string} Base64 encoded WAV data
   */
  generateBeepTone(frequency = 800, duration = 200, volume = 0.5) {
    const sampleRate = 44100;
    const numSamples = Math.floor((sampleRate * duration) / 1000);
    const numChannels = 1;
    const bitsPerSample = 16;
    
    // Create WAV header
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const fileSize = 36 + dataSize;
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    
    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Generate sine wave with fade in/out
    const fadeLength = Math.floor(numSamples * 0.1); // 10% fade
    
    for (let i = 0; i < numSamples; i++) {
      let amplitude = volume;
      
      // Fade in
      if (i < fadeLength) {
        amplitude *= i / fadeLength;
      }
      // Fade out
      else if (i > numSamples - fadeLength) {
        amplitude *= (numSamples - i) / fadeLength;
      }
      
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(44 + i * 2, intSample, true);
    }
    
    // Convert to base64
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Write string to DataView
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Play a single beep sound
   * @param {number} frequency - Frequency in Hz (default: 800)
   * @param {number} duration - Duration in ms (default: 200)
   * @param {number} volume - Volume 0-1 (default: 0.5)
   */
  async playBeep(frequency = 800, duration = 200, volume = 0.5) {
    try {
      const base64Audio = this.generateBeepTone(frequency, duration, volume);
      const uri = `data:audio/wav;base64,${base64Audio}`;
      
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: volume }
      );
      
      // Unload after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
      
      return sound;
    } catch (error) {
      console.warn('Failed to play beep:', error);
    }
  }

  /**
   * Play countdown beeps (3-2-1-GO pattern)
   * @param {Function} onCountdown - Callback for each countdown number
   * @param {number} startFrom - Start countdown from (default: 3)
   */
  async playCountdownBeeps(onCountdown = null, startFrom = 3) {
    try {
      for (let i = startFrom; i > 0; i--) {
        // Notify callback
        if (onCountdown) {
          onCountdown(i);
        }
        
        // Play beep - higher pitch for lower numbers
        const frequency = 600 + (startFrom - i) * 100;
        await this.playBeep(frequency, 150, 0.4);
        
        // Wait for the rest of the second
        await this.delay(850);
      }
      
      // Final "GO" beep - higher pitch, longer duration
      if (onCountdown) {
        onCountdown(0);
      }
      await this.playBeep(1000, 300, 0.6);
      
    } catch (error) {
      console.warn('Countdown beeps failed:', error);
    }
  }

  /**
   * Play session start beeps (phone ringing effect)
   * Pattern: beep-beep, pause, beep-beep
   */
  async playSessionStartBeeps() {
    try {
      // First ring
      await this.playBeep(440, 150, 0.4);
      await this.delay(100);
      await this.playBeep(440, 150, 0.4);
      
      // Pause
      await this.delay(300);
      
      // Second ring
      await this.playBeep(440, 150, 0.4);
      await this.delay(100);
      await this.playBeep(440, 150, 0.4);
      
      // Short pause before session starts
      await this.delay(200);
      
      // Connection tone (higher pitch)
      await this.playBeep(880, 200, 0.5);
      
    } catch (error) {
      console.warn('Session start beeps failed:', error);
    }
  }

  /**
   * Play call connect sound (single rising tone)
   */
  async playCallConnect() {
    try {
      await this.playBeep(600, 100, 0.3);
      await this.delay(50);
      await this.playBeep(800, 100, 0.4);
      await this.delay(50);
      await this.playBeep(1000, 150, 0.5);
    } catch (error) {
      console.warn('Call connect sound failed:', error);
    }
  }

  /**
   * Play call end sound (descending tone)
   */
  async playCallEnd() {
    try {
      await this.playBeep(800, 100, 0.4);
      await this.delay(50);
      await this.playBeep(600, 100, 0.3);
      await this.delay(50);
      await this.playBeep(400, 200, 0.3);
    } catch (error) {
      console.warn('Call end sound failed:', error);
    }
  }

  /**
   * Play next caller beep (for stress mode transitions)
   */
  async playNextCallerBeep() {
    try {
      // Alert tone
      await this.playBeep(700, 100, 0.4);
      await this.delay(100);
      await this.playBeep(700, 100, 0.4);
      await this.delay(200);
      await this.playBeep(900, 200, 0.5);
    } catch (error) {
      console.warn('Next caller beep failed:', error);
    }
  }

  /**
   * Play error/warning beep
   */
  async playErrorBeep() {
    try {
      await this.playBeep(300, 200, 0.5);
      await this.delay(100);
      await this.playBeep(300, 200, 0.5);
    } catch (error) {
      console.warn('Error beep failed:', error);
    }
  }

  /**
   * Play success beep
   */
  async playSuccessBeep() {
    try {
      await this.playBeep(523, 100, 0.4); // C5
      await this.delay(50);
      await this.playBeep(659, 100, 0.4); // E5
      await this.delay(50);
      await this.playBeep(784, 150, 0.5); // G5
    } catch (error) {
      console.warn('Success beep failed:', error);
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Unload any cached sounds
      for (const key in this.sounds) {
        if (this.sounds[key]) {
          await this.sounds[key].unloadAsync();
        }
      }
      this.sounds = {};
      console.log('SoundEffects cleaned up');
    } catch (error) {
      console.warn('SoundEffects cleanup error:', error);
    }
  }
}

// Export singleton instance
export const soundEffects = new SoundEffects();
export default soundEffects;
