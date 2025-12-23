import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { DATABASE_NAME, TABLES, SQL_SCHEMAS } from '../constants/database';

class DatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize() {
    if (this.isInitialized && this.db) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  async _initialize() {
    try {
      // Open database connection using new expo-sqlite API
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      
      // Enable foreign key constraints
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      
      // Create all tables
      await this.createTables();
      
      // Run migrations if needed
      await this.runMigrations();
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Create all database tables
   */
  async createTables() {
    const schemas = Object.values(SQL_SCHEMAS);
    
    for (const schema of schemas) {
      await this.db.execAsync(schema);
    }
    
    console.log('All database tables created successfully');
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    const version = await this.getDatabaseVersion();
    
    if (version < 1) {
      await this.migrationV1();
    }
    
    if (version < 2) {
      await this.migrationV2();
    }
    
    if (version < 3) {
      await this.migrationV3();
    }
    
    if (version < 4) {
      await this.migrationV4();
    }
    
    if (version < 5) {
      await this.migrationV5();
    }
    
    await this.setDatabaseVersion(5);
  }

  /**
   * Migration version 1 - Initial setup
   * Note: Called during initialization, so we use db directly without ensureInitialized
   */
  async migrationV1() {
    const existingSettings = await this.db.getFirstAsync(`SELECT * FROM ${TABLES.APP_SETTINGS} WHERE id = 1`);
    if (!existingSettings) {
      await this.createDefaultAppSettings();
    }
    
    console.log('Migration v1 completed');
  }

  /**
   * Migration version 2 - Add is_default column to voice_assets
   */
  async migrationV2() {
    try {
      // Check if column exists
      const tableInfo = await this.db.getAllAsync(`PRAGMA table_info(${TABLES.VOICE_ASSETS})`);
      const hasIsDefault = tableInfo.some(col => col.name === 'is_default');
      
      if (!hasIsDefault) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.VOICE_ASSETS} ADD COLUMN is_default INTEGER DEFAULT 0`);
        console.log('Added is_default column to voice_assets');
      }
      
      console.log('Migration v2 completed');
    } catch (error) {
      console.error('Migration v2 failed:', error);
    }
  }

  /**
   * Migration version 3 - Add default_voice_id column to app_settings
   */
  async migrationV3() {
    try {
      // Check if column exists in app_settings
      const tableInfo = await this.db.getAllAsync(`PRAGMA table_info(${TABLES.APP_SETTINGS})`);
      const hasDefaultVoiceId = tableInfo.some(col => col.name === 'default_voice_id');
      
      if (!hasDefaultVoiceId) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.APP_SETTINGS} ADD COLUMN default_voice_id TEXT`);
        console.log('Added default_voice_id column to app_settings');
      }
      
      console.log('Migration v3 completed');
    } catch (error) {
      console.error('Migration v3 failed:', error);
    }
  }

  /**
   * Migration version 4 - Add has_completed_onboarding column to app_settings
   */
  async migrationV4() {
    try {
      const tableInfo = await this.db.getAllAsync(`PRAGMA table_info(${TABLES.APP_SETTINGS})`);
      const hasOnboardingColumn = tableInfo.some(col => col.name === 'has_completed_onboarding');
      
      if (!hasOnboardingColumn) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.APP_SETTINGS} ADD COLUMN has_completed_onboarding INTEGER DEFAULT 0`);
        console.log('Added has_completed_onboarding column to app_settings');
      }
      
      console.log('Migration v4 completed');
    } catch (error) {
      console.error('Migration v4 failed:', error);
    }
  }

  /**
   * Migration version 5 - Add AI feedback columns to sessions and app_settings
   */
  async migrationV5() {
    try {
      // Add AI feedback columns to sessions
      const sessionsTableInfo = await this.db.getAllAsync(`PRAGMA table_info(${TABLES.SESSIONS})`);
      
      const hasPositiveAspects = sessionsTableInfo.some(col => col.name === 'ai_positive_aspects');
      if (!hasPositiveAspects) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.SESSIONS} ADD COLUMN ai_positive_aspects TEXT`);
        console.log('Added ai_positive_aspects column to sessions');
      }
      
      const hasImprovementAreas = sessionsTableInfo.some(col => col.name === 'ai_improvement_areas');
      if (!hasImprovementAreas) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.SESSIONS} ADD COLUMN ai_improvement_areas TEXT`);
        console.log('Added ai_improvement_areas column to sessions');
      }
      
      const hasNextSteps = sessionsTableInfo.some(col => col.name === 'ai_next_steps');
      if (!hasNextSteps) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.SESSIONS} ADD COLUMN ai_next_steps TEXT`);
        console.log('Added ai_next_steps column to sessions');
      }
      
      // Add AI insight columns to app_settings
      const settingsTableInfo = await this.db.getAllAsync(`PRAGMA table_info(${TABLES.APP_SETTINGS})`);
      
      const hasGlobalInsight = settingsTableInfo.some(col => col.name === 'ai_global_insight');
      if (!hasGlobalInsight) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.APP_SETTINGS} ADD COLUMN ai_global_insight TEXT`);
        console.log('Added ai_global_insight column to app_settings');
      }
      
      const hasInsightUpdatedAt = settingsTableInfo.some(col => col.name === 'ai_insight_updated_at');
      if (!hasInsightUpdatedAt) {
        await this.db.execAsync(`ALTER TABLE ${TABLES.APP_SETTINGS} ADD COLUMN ai_insight_updated_at INTEGER`);
        console.log('Added ai_insight_updated_at column to app_settings');
      }
      
      console.log('Migration v5 completed');
    } catch (error) {
      console.error('Migration v5 failed:', error);
    }
  }

  /**
   * Get current database version
   */
  async getDatabaseVersion() {
    try {
      const result = await this.db.getFirstAsync('PRAGMA user_version');
      return result?.user_version || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Set database version
   */
  async setDatabaseVersion(version) {
    await this.db.execAsync(`PRAGMA user_version = ${version}`);
  }

  /**
   * Create default app settings
   */
  async createDefaultAppSettings() {
    const now = Date.now();
    await this.db.runAsync(
      `INSERT INTO ${TABLES.APP_SETTINGS} 
       (id, daily_limit, haptic_enabled, vad_sensitivity, theme, language, created_at, updated_at) 
       VALUES (1, 50.0, 1, 'medium', 'dark', 'id', ?, ?)`,
      [now, now]
    );
  }

  // ============ APP SETTINGS CRUD ============

  async getAppSettings() {
    this.ensureInitialized();
    return await this.db.getFirstAsync(`SELECT * FROM ${TABLES.APP_SETTINGS} WHERE id = 1`);
  }

  async updateAppSettings(settings) {
    this.ensureInitialized();
    const now = Date.now();
    
    const fields = [];
    const values = [];
    
    Object.entries(settings).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(1);
    
    await this.db.runAsync(
      `UPDATE ${TABLES.APP_SETTINGS} SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async hasCompletedOnboarding() {
    this.ensureInitialized();
    const settings = await this.getAppSettings();
    return settings?.has_completed_onboarding === 1;
  }

  async setOnboardingCompleted() {
    this.ensureInitialized();
    await this.updateAppSettings({ has_completed_onboarding: 1 });
  }

  // ============ SECURE STORAGE FOR API KEYS ============

  async storeApiKey(service, apiKey) {
    const key = `api_key_${service}`;
    await SecureStore.setItemAsync(key, apiKey);
  }

  async getApiKey(service) {
    const key = `api_key_${service}`;
    return await SecureStore.getItemAsync(key);
  }

  async deleteApiKey(service) {
    const key = `api_key_${service}`;
    await SecureStore.deleteItemAsync(key);
  }

  // ============ CONTEXT FILES CRUD ============

  async createContextFile(fileName, extractedText, fileSize) {
    this.ensureInitialized();
    const now = Date.now();
    
    const result = await this.db.runAsync(
      `INSERT INTO ${TABLES.CONTEXT_FILES} 
       (file_name, extracted_text_content, file_size, uploaded_at) 
       VALUES (?, ?, ?, ?)`,
      [fileName, extractedText, fileSize, now]
    );
    
    return result.lastInsertRowId;
  }

  async getContextFiles() {
    this.ensureInitialized();
    return await this.db.getAllAsync(`SELECT * FROM ${TABLES.CONTEXT_FILES} ORDER BY uploaded_at DESC`);
  }

  async getContextFile(id) {
    this.ensureInitialized();
    return await this.db.getFirstAsync(`SELECT * FROM ${TABLES.CONTEXT_FILES} WHERE id = ?`, [id]);
  }

  async deleteContextFile(id) {
    this.ensureInitialized();
    await this.db.runAsync(`DELETE FROM ${TABLES.CONTEXT_FILES} WHERE id = ?`, [id]);
  }

  // ============ SESSIONS CRUD ============

  async createSession(sessionData) {
    this.ensureInitialized();
    const {
      timestamp,
      scenario,
      mode,
      score = null,
      duration = null,
      pace = null,
      filler_word_count = null,
      clarity_score = null,
      confidence_score = null,
      completed = 0
    } = sessionData;
    
    const result = await this.db.runAsync(
      `INSERT INTO ${TABLES.SESSIONS} 
       (timestamp, scenario, mode, score, duration, pace, filler_word_count, clarity_score, confidence_score, completed) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [timestamp, scenario, mode, score, duration, pace, filler_word_count, clarity_score, confidence_score, completed]
    );
    
    return result.lastInsertRowId;
  }

  async updateSession(id, sessionData) {
    this.ensureInitialized();
    
    const fields = [];
    const values = [];
    
    Object.entries(sessionData).forEach(([key, value]) => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    values.push(id);
    
    await this.db.runAsync(
      `UPDATE ${TABLES.SESSIONS} SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async getSessions(limit = null, offset = 0) {
    this.ensureInitialized();
    let query = `SELECT * FROM ${TABLES.SESSIONS} ORDER BY timestamp DESC`;
    
    if (limit) {
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }
    
    return await this.db.getAllAsync(query);
  }

  async getSession(id) {
    this.ensureInitialized();
    return await this.db.getFirstAsync(`SELECT * FROM ${TABLES.SESSIONS} WHERE id = ?`, [id]);
  }

  async searchSessions(searchText, category = null, startDate = null, endDate = null) {
    this.ensureInitialized();
    
    let query = `SELECT * FROM ${TABLES.SESSIONS} WHERE 1=1`;
    const params = [];
    
    if (searchText) {
      query += ` AND scenario LIKE ?`;
      params.push(`%${searchText}%`);
    }
    
    if (category) {
      query += ` AND scenario = ?`;
      params.push(category);
    }
    
    if (startDate) {
      query += ` AND timestamp >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND timestamp <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    return await this.db.getAllAsync(query, params);
  }

  async deleteSession(id) {
    this.ensureInitialized();
    
    await this.db.runAsync(`DELETE FROM ${TABLES.CHAT_LOGS} WHERE session_id = ?`, [id]);
    await this.db.runAsync(`DELETE FROM ${TABLES.EMOTIONAL_TELEMETRY} WHERE session_id = ?`, [id]);
    await this.db.runAsync(`DELETE FROM ${TABLES.SESSIONS} WHERE id = ?`, [id]);
  }

  // ============ CHAT LOGS CRUD ============

  async createChatLog(chatData) {
    this.ensureInitialized();
    const {
      session_id,
      sender,
      text,
      audio_path = null,
      sentiment_score = null,
      has_hesitation = 0,
      timestamp
    } = chatData;
    
    const result = await this.db.runAsync(
      `INSERT INTO ${TABLES.CHAT_LOGS} 
       (session_id, sender, text, audio_path, sentiment_score, has_hesitation, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [session_id, sender, text, audio_path, sentiment_score, has_hesitation, timestamp]
    );
    
    return result.lastInsertRowId;
  }

  async getChatLogs(sessionId) {
    this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM ${TABLES.CHAT_LOGS} WHERE session_id = ? ORDER BY timestamp ASC`,
      [sessionId]
    );
  }

  async updateChatLog(id, chatData) {
    this.ensureInitialized();
    
    const fields = [];
    const values = [];
    
    Object.entries(chatData).forEach(([key, value]) => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    values.push(id);
    
    await this.db.runAsync(
      `UPDATE ${TABLES.CHAT_LOGS} SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  // ============ VOICE ASSETS CRUD ============

  async createVoiceAsset(voiceData) {
    this.ensureInitialized();
    const {
      voice_id,
      name,
      is_cloned = 0,
      is_system = 0,
      stability = 0.75,
      similarity = 0.90
    } = voiceData;
    
    const now = Date.now();
    
    const result = await this.db.runAsync(
      `INSERT INTO ${TABLES.VOICE_ASSETS} 
       (voice_id, name, is_cloned, is_system, stability, similarity, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [voice_id, name, is_cloned, is_system, stability, similarity, now]
    );
    
    return result.lastInsertRowId;
  }

  async getVoiceAssets() {
    this.ensureInitialized();
    return await this.db.getAllAsync(`SELECT * FROM ${TABLES.VOICE_ASSETS} ORDER BY created_at DESC`);
  }

  async getVoiceAsset(voiceId) {
    this.ensureInitialized();
    return await this.db.getFirstAsync(`SELECT * FROM ${TABLES.VOICE_ASSETS} WHERE voice_id = ?`, [voiceId]);
  }

  async updateVoiceAsset(voiceId, voiceData) {
    this.ensureInitialized();
    
    const fields = [];
    const values = [];
    
    Object.entries(voiceData).forEach(([key, value]) => {
      if (key !== 'voice_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    values.push(voiceId);
    
    await this.db.runAsync(
      `UPDATE ${TABLES.VOICE_ASSETS} SET ${fields.join(', ')} WHERE voice_id = ?`,
      values
    );
  }

  async deleteVoiceAsset(voiceId) {
    this.ensureInitialized();
    await this.db.runAsync(`DELETE FROM ${TABLES.VOICE_ASSETS} WHERE voice_id = ?`, [voiceId]);
  }

  async getClonedVoiceCount() {
    this.ensureInitialized();
    const result = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM ${TABLES.VOICE_ASSETS} WHERE is_cloned = 1`
    );
    return result?.count || 0;
  }

  async setDefaultVoice(voiceId) {
    this.ensureInitialized();
    
    // Clear all default flags first
    await this.db.runAsync(
      `UPDATE ${TABLES.VOICE_ASSETS} SET is_default = 0`
    );
    
    // Set the new default
    if (voiceId) {
      await this.db.runAsync(
        `UPDATE ${TABLES.VOICE_ASSETS} SET is_default = 1 WHERE voice_id = ?`,
        [voiceId]
      );
      
      // Also update app_settings
      await this.updateAppSettings({ default_voice_id: voiceId });
    }
  }

  async getDefaultVoice() {
    this.ensureInitialized();
    
    // First try to get from voice_assets
    const defaultVoice = await this.db.getFirstAsync(
      `SELECT * FROM ${TABLES.VOICE_ASSETS} WHERE is_default = 1`
    );
    
    if (defaultVoice) {
      return defaultVoice;
    }
    
    // Fallback to app_settings
    const settings = await this.getAppSettings();
    if (settings?.default_voice_id) {
      return await this.getVoiceAsset(settings.default_voice_id);
    }
    
    return null;
  }

  async clearDefaultVoice() {
    this.ensureInitialized();
    
    await this.db.runAsync(
      `UPDATE ${TABLES.VOICE_ASSETS} SET is_default = 0`
    );
    
    await this.updateAppSettings({ default_voice_id: null });
  }

  // ============ EMOTIONAL TELEMETRY CRUD ============

  async createEmotionalTelemetry(telemetryData) {
    this.ensureInitialized();
    const { session_id, timestamp, emotion_state, intensity } = telemetryData;
    
    const result = await this.db.runAsync(
      `INSERT INTO ${TABLES.EMOTIONAL_TELEMETRY} 
       (session_id, timestamp, emotion_state, intensity) 
       VALUES (?, ?, ?, ?)`,
      [session_id, timestamp, emotion_state, intensity]
    );
    
    return result.lastInsertRowId;
  }

  async getEmotionalTelemetry(sessionId) {
    this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM ${TABLES.EMOTIONAL_TELEMETRY} WHERE session_id = ? ORDER BY timestamp ASC`,
      [sessionId]
    );
  }

  async batchCreateEmotionalTelemetry(sessionId, telemetryArray) {
    this.ensureInitialized();
    
    for (const telemetry of telemetryArray) {
      await this.db.runAsync(
        `INSERT INTO ${TABLES.EMOTIONAL_TELEMETRY} 
         (session_id, timestamp, emotion_state, intensity) 
         VALUES (?, ?, ?, ?)`,
        [sessionId, telemetry.timestamp, telemetry.emotion_state, telemetry.intensity]
      );
    }
  }

  // ============ ACHIEVEMENTS CRUD ============

  async createAchievement(achievementData) {
    this.ensureInitialized();
    const {
      id,
      name,
      description,
      type,
      target,
      current = 0,
      unlocked = 0,
      badge_icon = '',
      points = 0,
      unlocked_at = null
    } = achievementData;
    
    const now = Date.now();
    
    await this.db.runAsync(
      `INSERT INTO ${TABLES.ACHIEVEMENTS} 
       (id, name, description, type, target, current, unlocked, badge_icon, points, unlocked_at, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, type, target, current, unlocked, badge_icon, points, unlocked_at, now]
    );
  }

  async getAllAchievements() {
    this.ensureInitialized();
    return await this.db.getAllAsync(`SELECT * FROM ${TABLES.ACHIEVEMENTS} ORDER BY created_at ASC`);
  }

  async getAchievement(id) {
    this.ensureInitialized();
    return await this.db.getFirstAsync(`SELECT * FROM ${TABLES.ACHIEVEMENTS} WHERE id = ?`, [id]);
  }

  async updateAchievement(id, achievementData) {
    this.ensureInitialized();
    
    const fields = [];
    const values = [];
    
    Object.entries(achievementData).forEach(([key, value]) => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    values.push(id);
    
    await this.db.runAsync(
      `UPDATE ${TABLES.ACHIEVEMENTS} SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async getUnlockedAchievements() {
    this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM ${TABLES.ACHIEVEMENTS} WHERE unlocked = 1 ORDER BY unlocked_at DESC`
    );
  }

  async getAchievementsByType(type) {
    this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM ${TABLES.ACHIEVEMENTS} WHERE type = ? ORDER BY target ASC`,
      [type]
    );
  }

  // ============ QUOTA USAGE CRUD ============

  async recordQuotaUsage(usageData) {
    this.ensureInitialized();
    const {
      service,
      cost,
      timestamp = Date.now(),
      session_id = null,
      operation_type = null
    } = usageData;
    
    const result = await this.db.runAsync(
      `INSERT INTO ${TABLES.QUOTA_USAGE} 
       (service, cost, timestamp, session_id, operation_type) 
       VALUES (?, ?, ?, ?, ?)`,
      [service, cost, timestamp, session_id, operation_type]
    );
    
    return result.lastInsertRowId;
  }

  async getQuotaUsage(startDate, endDate = null) {
    this.ensureInitialized();
    
    let query = `SELECT * FROM ${TABLES.QUOTA_USAGE} WHERE timestamp >= ?`;
    const params = [startDate];
    
    if (endDate) {
      query += ` AND timestamp <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    return await this.db.getAllAsync(query, params);
  }

  async getTotalQuotaUsage(startDate, endDate = null) {
    this.ensureInitialized();
    
    let query = `SELECT SUM(cost) as total FROM ${TABLES.QUOTA_USAGE} WHERE timestamp >= ?`;
    const params = [startDate];
    
    if (endDate) {
      query += ` AND timestamp <= ?`;
      params.push(endDate);
    }
    
    const result = await this.db.getFirstAsync(query, params);
    return result?.total || 0;
  }

  async getQuotaUsageByService(service, startDate, endDate = null) {
    this.ensureInitialized();
    
    let query = `SELECT SUM(cost) as total FROM ${TABLES.QUOTA_USAGE} WHERE service = ? AND timestamp >= ?`;
    const params = [service, startDate];
    
    if (endDate) {
      query += ` AND timestamp <= ?`;
      params.push(endDate);
    }
    
    const result = await this.db.getFirstAsync(query, params);
    return result?.total || 0;
  }

  async getDailyQuotaUsage() {
    this.ensureInitialized();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();
    
    return await this.getTotalQuotaUsage(startOfDay);
  }

  async getMonthlyQuotaUsage() {
    this.ensureInitialized();
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    
    return await this.getTotalQuotaUsage(startOfMonth);
  }

  async clearOldQuotaUsage() {
    this.ensureInitialized();
    
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    
    await this.db.runAsync(
      `DELETE FROM ${TABLES.QUOTA_USAGE} WHERE timestamp < ?`,
      [ninetyDaysAgo]
    );
  }

  // ============ UTILITY METHODS ============

  async getDatabaseSize() {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      return fileInfo.exists ? fileInfo.size : 0;
    } catch (error) {
      console.error('Error getting database size:', error);
      return 0;
    }
  }

  async clearSessionData() {
    this.ensureInitialized();
    
    await this.db.runAsync(`DELETE FROM ${TABLES.EMOTIONAL_TELEMETRY}`);
    await this.db.runAsync(`DELETE FROM ${TABLES.CHAT_LOGS}`);
    await this.db.runAsync(`DELETE FROM ${TABLES.SESSIONS}`);
    
    console.log('Session data cleared successfully');
  }

  async clearAllDataExceptSettings() {
    this.ensureInitialized();
    
    try {
      // Clear all related data in correct order (child tables first due to foreign key constraints)
      // Tables with foreign keys to sessions must be deleted first
      await this.db.runAsync(`DELETE FROM ${TABLES.QUOTA_USAGE}`);
      await this.db.runAsync(`DELETE FROM ${TABLES.EMOTIONAL_TELEMETRY}`);
      await this.db.runAsync(`DELETE FROM ${TABLES.CHAT_LOGS}`);
      // Now safe to delete sessions
      await this.db.runAsync(`DELETE FROM ${TABLES.SESSIONS}`);
      // Other tables without dependencies
      await this.db.runAsync(`DELETE FROM ${TABLES.CONTEXT_FILES}`);
      await this.db.runAsync(`DELETE FROM ${TABLES.VOICE_ASSETS} WHERE is_system = 0`);
      await this.db.runAsync(`DELETE FROM ${TABLES.ACHIEVEMENTS}`);
      
      // Also clear AI insights from app_settings
      await this.db.runAsync(
        `UPDATE ${TABLES.APP_SETTINGS} SET ai_global_insight = NULL, ai_insight_updated_at = NULL WHERE id = 1`
      );
      
      console.log('All data cleared except settings');
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  async selectiveDataClear(options = {}) {
    this.ensureInitialized();
    
    const {
      clearSessions = false,
      clearDocuments = false,
      clearVoiceAssets = false,
      clearQuotaUsage = false,
      preserveSystemVoices = true
    } = options;

    const clearedData = {
      sessions: 0,
      documents: 0,
      voiceAssets: 0,
      quotaUsage: 0
    };

    if (clearSessions) {
      const sessions = await this.getSessions();
      clearedData.sessions = sessions.length;
      
      await this.db.runAsync(`DELETE FROM ${TABLES.EMOTIONAL_TELEMETRY}`);
      await this.db.runAsync(`DELETE FROM ${TABLES.CHAT_LOGS}`);
      await this.db.runAsync(`DELETE FROM ${TABLES.SESSIONS}`);
    }

    if (clearDocuments) {
      const documents = await this.getContextFiles();
      clearedData.documents = documents.length;
      
      await this.db.runAsync(`DELETE FROM ${TABLES.CONTEXT_FILES}`);
    }

    if (clearVoiceAssets) {
      let voiceQuery = `DELETE FROM ${TABLES.VOICE_ASSETS}`;
      if (preserveSystemVoices) {
        voiceQuery += ` WHERE is_system = 0`;
      }
      
      const voiceAssets = await this.getVoiceAssets();
      const assetsToDelete = preserveSystemVoices 
        ? voiceAssets.filter(v => !v.is_system)
        : voiceAssets;
      clearedData.voiceAssets = assetsToDelete.length;
      
      await this.db.runAsync(voiceQuery);
    }

    if (clearQuotaUsage) {
      const quotaUsage = await this.getQuotaUsage(0);
      clearedData.quotaUsage = quotaUsage.length;
      
      await this.db.runAsync(`DELETE FROM ${TABLES.QUOTA_USAGE}`);
    }

    return clearedData;
  }

  async getDataCounts() {
    this.ensureInitialized();
    
    const sessions = await this.getSessions();
    const documents = await this.getContextFiles();
    const voiceAssets = await this.getVoiceAssets();
    const quotaUsage = await this.getQuotaUsage(0);
    const settings = await this.getAppSettings();

    return {
      sessions: sessions.length,
      documents: documents.length,
      voiceAssets: voiceAssets.length,
      systemVoices: voiceAssets.filter(v => v.is_system).length,
      userVoices: voiceAssets.filter(v => !v.is_system).length,
      quotaUsage: quotaUsage.length,
      hasSettings: !!settings
    };
  }

  async executeQuery(query, params = []) {
    this.ensureInitialized();
    return await this.db.getAllAsync(query, params);
  }

  // ============ AI FEEDBACK METHODS ============

  async saveSessionAIFeedback(sessionId, feedback) {
    this.ensureInitialized();
    
    const positiveAspects = JSON.stringify(feedback.positiveAspects || []);
    const improvementAreas = JSON.stringify(feedback.improvementAreas || []);
    const nextSteps = JSON.stringify(feedback.nextSteps || []);
    
    await this.db.runAsync(
      `UPDATE ${TABLES.SESSIONS} SET ai_positive_aspects = ?, ai_improvement_areas = ?, ai_next_steps = ? WHERE id = ?`,
      [positiveAspects, improvementAreas, nextSteps, sessionId]
    );
  }

  async getSessionAIFeedback(sessionId) {
    this.ensureInitialized();
    
    const session = await this.db.getFirstAsync(
      `SELECT ai_positive_aspects, ai_improvement_areas, ai_next_steps FROM ${TABLES.SESSIONS} WHERE id = ?`,
      [sessionId]
    );
    
    if (!session) return null;
    
    return {
      positiveAspects: session.ai_positive_aspects ? JSON.parse(session.ai_positive_aspects) : [],
      improvementAreas: session.ai_improvement_areas ? JSON.parse(session.ai_improvement_areas) : [],
      nextSteps: session.ai_next_steps ? JSON.parse(session.ai_next_steps) : []
    };
  }

  async saveGlobalAIInsight(insight) {
    this.ensureInitialized();
    const now = Date.now();
    
    await this.db.runAsync(
      `UPDATE ${TABLES.APP_SETTINGS} SET ai_global_insight = ?, ai_insight_updated_at = ?, updated_at = ? WHERE id = 1`,
      [insight, now, now]
    );
  }

  async getGlobalAIInsight() {
    this.ensureInitialized();
    
    const settings = await this.db.getFirstAsync(
      `SELECT ai_global_insight, ai_insight_updated_at FROM ${TABLES.APP_SETTINGS} WHERE id = 1`
    );
    
    return {
      insight: settings?.ai_global_insight || null,
      updatedAt: settings?.ai_insight_updated_at || null
    };
  }

  async shouldUpdateGlobalInsight() {
    this.ensureInitialized();
    
    const { updatedAt } = await this.getGlobalAIInsight();
    
    // Update if never updated or more than 24 hours ago
    if (!updatedAt) return true;
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return updatedAt < oneDayAgo;
  }

  async close() {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
      this.initializationPromise = null;
    }
  }

  ensureInitialized() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
