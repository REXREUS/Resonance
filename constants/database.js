export const DATABASE_NAME = 'resonansi.db';

export const TABLES = {
  APP_SETTINGS: 'app_settings',
  CONTEXT_FILES: 'context_files',
  SESSIONS: 'sessions',
  CHAT_LOGS: 'chat_logs',
  VOICE_ASSETS: 'voice_assets',
  EMOTIONAL_TELEMETRY: 'emotional_telemetry',
  ACHIEVEMENTS: 'achievements',
  QUOTA_USAGE: 'quota_usage',
};

export const SQL_SCHEMAS = {
  APP_SETTINGS: `
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY,
      api_key_elevenlabs TEXT,
      api_key_gemini TEXT,
      daily_limit REAL DEFAULT 50.0,
      haptic_enabled INTEGER DEFAULT 1,
      vad_sensitivity TEXT DEFAULT 'medium',
      theme TEXT DEFAULT 'dark',
      language TEXT DEFAULT 'id',
      mock_mode INTEGER DEFAULT 0,
      debug_logs INTEGER DEFAULT 0,
      audio_input_device TEXT DEFAULT 'default',
      audio_output_device TEXT DEFAULT 'default',
      default_voice_id TEXT,
      has_completed_onboarding INTEGER DEFAULT 0,
      ai_global_insight TEXT,
      ai_insight_updated_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )
  `,
  
  CONTEXT_FILES: `
    CREATE TABLE IF NOT EXISTS context_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      extracted_text_content TEXT,
      file_size INTEGER,
      uploaded_at INTEGER
    )
  `,
  
  SESSIONS: `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      scenario TEXT NOT NULL,
      mode TEXT NOT NULL,
      score INTEGER,
      duration INTEGER,
      pace INTEGER,
      filler_word_count INTEGER,
      clarity_score INTEGER,
      confidence_score INTEGER,
      completed INTEGER DEFAULT 0,
      ai_positive_aspects TEXT,
      ai_improvement_areas TEXT,
      ai_next_steps TEXT
    )
  `,
  
  CHAT_LOGS: `
    CREATE TABLE IF NOT EXISTS chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      audio_path TEXT,
      sentiment_score REAL,
      has_hesitation INTEGER DEFAULT 0,
      timestamp INTEGER
    )
  `,
  
  VOICE_ASSETS: `
    CREATE TABLE IF NOT EXISTS voice_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_cloned INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      stability REAL DEFAULT 0.75,
      similarity REAL DEFAULT 0.90,
      created_at INTEGER
    )
  `,
  
  EMOTIONAL_TELEMETRY: `
    CREATE TABLE IF NOT EXISTS emotional_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      timestamp INTEGER,
      emotion_state TEXT,
      intensity REAL
    )
  `,
  
  ACHIEVEMENTS: `
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      target INTEGER NOT NULL,
      current INTEGER DEFAULT 0,
      unlocked INTEGER DEFAULT 0,
      badge_icon TEXT,
      points INTEGER DEFAULT 0,
      unlocked_at INTEGER,
      created_at INTEGER
    )
  `,
  
  QUOTA_USAGE: `
    CREATE TABLE IF NOT EXISTS quota_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      cost REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      session_id INTEGER REFERENCES sessions(id),
      operation_type TEXT
    )
  `,
};