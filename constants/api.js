export const API_ENDPOINTS = {
  ELEVENLABS: {
    BASE_URL: 'https://api.elevenlabs.io/v1',
    WEBSOCKET_URL: 'wss://api.elevenlabs.io/v1/text-to-speech',
    VOICES: '/voices',
    VOICE_CLONE: '/voices/add',
    TTS: '/text-to-speech',
  },
  
  GEMINI: {
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    GENERATE: '/models/gemini-2.5-flash:generateContent',
  },
};

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  
  GEMINI: {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
  },
  
  ELEVENLABS: {
    MODEL_ID: 'eleven_turbo_v2_5',
    VOICE_SETTINGS: {
      stability: 0.75,
      similarity_boost: 0.90,
      style: 0.0,
      use_speaker_boost: true,
    },
  },
};