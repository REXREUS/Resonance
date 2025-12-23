export const AUDIO_CONFIG = {
  // Sample rates
  SAMPLE_RATE: 44100,
  CHANNELS: 1,
  BITS_PER_SAMPLE: 16,
  
  // VAD thresholds (relative to noise floor)
  VAD_SENSITIVITY: {
    LOW: 20, // Noise Floor + 20dB
    MEDIUM: 12, // Noise Floor + 12dB
    HIGH: 5, // Noise Floor + 5dB
  },
  
  // Timing constraints
  VAD_RESPONSE_TIME_MS: 150,
  BARGE_IN_THRESHOLD_MS: 150,
  NOISE_FLOOR_CALIBRATION_MS: 2000,
  MAX_LATENCY_MS: 800,
  
  // Audio processing
  CHUNK_SIZE: 1024,
  BUFFER_SIZE: 4096,
};

export const NOISE_TYPES = [
  'office',
  'rain', 
  'traffic',
  'cafe'
];

export const VOICE_SETTINGS = {
  DEFAULT_STABILITY: 0.75,
  DEFAULT_SIMILARITY: 0.90,
  MAX_VOICE_SLOTS: 5,
};