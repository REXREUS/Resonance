/**
 * Offline service for Resonance mobile app
 * Manages cached voice assets, local responses, and offline functionality
 */

import * as FileSystem from 'expo-file-system';
import { databaseService } from './databaseService';
import { globalErrorHandler, createStorageError } from '../utils/errorHandler';

export class OfflineService {
  constructor() {
    this.isInitialized = false;
    this.cacheDirectory = `${FileSystem.documentDirectory}cache/`;
    this.voiceAssetsDirectory = `${this.cacheDirectory}voices/`;
    this.responseTemplatesDirectory = `${this.cacheDirectory}responses/`;
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB
    this.fallbackResponses = new Map();
    this.cachedVoiceAssets = new Map();
  }

  /**
   * Initialize offline service
   */
  async initialize() {
    try {
      await this._createCacheDirectories();
      await this._loadFallbackResponses();
      await this._loadCachedVoiceAssets();
      await this._cleanupOldCache();
      
      this.isInitialized = true;
      console.log('OfflineService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineService:', error);
      throw createStorageError(
        'Failed to initialize offline cache',
        'Unable to set up offline functionality'
      );
    }
  }

  /**
   * Cache voice asset for offline use
   */
  async cacheVoiceAsset(voiceId, audioData, metadata = {}) {
    try {
      this._ensureInitialized();
      
      const fileName = `voice_${voiceId}_${Date.now()}.wav`;
      const filePath = `${this.voiceAssetsDirectory}${fileName}`;
      
      // Save audio data to file
      await FileSystem.writeAsStringAsync(filePath, audioData, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Store metadata in database
      await databaseService.execute(
        `INSERT OR REPLACE INTO cached_voice_assets 
         (voice_id, file_path, metadata, cached_at, file_size) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          voiceId,
          filePath,
          JSON.stringify(metadata),
          Date.now(),
          audioData.length
        ]
      );
      
      // Update in-memory cache
      this.cachedVoiceAssets.set(voiceId, {
        filePath,
        metadata,
        cachedAt: Date.now()
      });
      
      console.log(`Cached voice asset for ${voiceId}`);
      return filePath;
    } catch (error) {
      console.error('Failed to cache voice asset:', error);
      throw createStorageError(
        'Failed to cache voice asset',
        'Unable to save voice for offline use'
      );
    }
  }

  /**
   * Get cached voice asset
   */
  async getCachedVoiceAsset(voiceId) {
    try {
      this._ensureInitialized();
      
      const cached = this.cachedVoiceAssets.get(voiceId);
      if (!cached) {
        return null;
      }
      
      // Check if file still exists
      const fileInfo = await FileSystem.getInfoAsync(cached.filePath);
      if (!fileInfo.exists) {
        // Remove from cache if file doesn't exist
        this.cachedVoiceAssets.delete(voiceId);
        await this._removeCachedVoiceAsset(voiceId);
        return null;
      }
      
      return cached;
    } catch (error) {
      console.error('Failed to get cached voice asset:', error);
      return null;
    }
  }

  /**
   * Cache AI response template
   */
  async cacheResponseTemplate(scenario, responses) {
    try {
      this._ensureInitialized();
      
      const fileName = `responses_${scenario}_${Date.now()}.json`;
      const filePath = `${this.responseTemplatesDirectory}${fileName}`;
      
      const responseData = {
        scenario,
        responses,
        cachedAt: Date.now()
      };
      
      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(responseData),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      // Store in database
      await databaseService.execute(
        `INSERT OR REPLACE INTO cached_responses 
         (scenario, file_path, cached_at) 
         VALUES (?, ?, ?)`,
        [scenario, filePath, Date.now()]
      );
      
      // Update fallback responses
      this.fallbackResponses.set(scenario, responses);
      
      console.log(`Cached response template for ${scenario}`);
    } catch (error) {
      console.error('Failed to cache response template:', error);
      throw createStorageError(
        'Failed to cache responses',
        'Unable to save responses for offline use'
      );
    }
  }

  /**
   * Get fallback response for offline mode
   */
  getFallbackResponse(scenario, context = {}) {
    const responses = this.fallbackResponses.get(scenario) || this._getDefaultResponses();
    
    // Select appropriate response based on context
    if (context.userInput) {
      return this._selectContextualResponse(responses, context.userInput);
    }
    
    // Return random response
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex] || this._getDefaultResponse();
  }

  /**
   * Generate mock AI feedback for offline mode
   */
  generateMockFeedback(sessionData) {
    const { score = 75, metrics = {} } = sessionData;
    
    return {
      positiveAspects: [
        'Good pace and rhythm in your speech',
        'Clear articulation throughout the conversation',
        'Maintained professional tone'
      ],
      improvementAreas: [
        'Consider reducing filler words for better clarity',
        'Work on maintaining consistent confidence levels',
        'Practice handling interruptions more smoothly'
      ],
      nextSteps: [
        'Practice with more challenging scenarios',
        'Focus on reducing hesitation patterns',
        'Continue building conversation stamina'
      ],
      overallSummary: `You achieved a score of ${score}%. ${
        score >= 80 ? 'Excellent performance!' : 
        score >= 60 ? 'Good progress, keep practicing!' : 
        'Keep working on the fundamentals.'
      } This feedback was generated in offline mode.`
    };
  }

  /**
   * Get offline system status
   */
  getOfflineStatus() {
    return {
      isInitialized: this.isInitialized,
      cachedVoices: this.cachedVoiceAssets.size,
      cachedScenarios: this.fallbackResponses.size,
      cacheDirectory: this.cacheDirectory,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Clear offline cache
   */
  async clearCache(options = {}) {
    try {
      const { keepVoices = false, keepResponses = false } = options;
      
      if (!keepVoices) {
        await this._clearVoiceCache();
      }
      
      if (!keepResponses) {
        await this._clearResponseCache();
      }
      
      console.log('Offline cache cleared');
    } catch (error) {
      console.error('Failed to clear offline cache:', error);
      throw createStorageError(
        'Failed to clear cache',
        'Unable to clear offline data'
      );
    }
  }

  /**
   * Get cache size information
   */
  async getCacheSize() {
    try {
      const voicesInfo = await FileSystem.getInfoAsync(this.voiceAssetsDirectory);
      const responsesInfo = await FileSystem.getInfoAsync(this.responseTemplatesDirectory);
      
      return {
        totalSize: (voicesInfo.size || 0) + (responsesInfo.size || 0),
        voicesSize: voicesInfo.size || 0,
        responsesSize: responsesInfo.size || 0,
        maxSize: this.maxCacheSize
      };
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return { totalSize: 0, voicesSize: 0, responsesSize: 0, maxSize: this.maxCacheSize };
    }
  }

  // Private methods

  _ensureInitialized() {
    if (!this.isInitialized) {
      throw createStorageError(
        'OfflineService not initialized',
        'Offline functionality not available'
      );
    }
  }

  async _createCacheDirectories() {
    const directories = [
      this.cacheDirectory,
      this.voiceAssetsDirectory,
      this.responseTemplatesDirectory
    ];
    
    for (const dir of directories) {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    }
  }

  async _loadFallbackResponses() {
    try {
      // Load cached responses from database
      const cachedResponses = await databaseService.getAll(
        'SELECT * FROM cached_responses ORDER BY cached_at DESC'
      );
      
      for (const cached of cachedResponses) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(cached.file_path);
          if (fileInfo.exists) {
            const content = await FileSystem.readAsStringAsync(cached.file_path);
            const responseData = JSON.parse(content);
            this.fallbackResponses.set(cached.scenario, responseData.responses);
          }
        } catch (error) {
          console.warn(`Failed to load cached response for ${cached.scenario}:`, error);
        }
      }
      
      // Add default responses if none cached
      if (this.fallbackResponses.size === 0) {
        this._loadDefaultResponses();
      }
    } catch (error) {
      console.warn('Failed to load cached responses, using defaults:', error);
      this._loadDefaultResponses();
    }
  }

  async _loadCachedVoiceAssets() {
    try {
      // Create table if it doesn't exist
      await databaseService.execute(`
        CREATE TABLE IF NOT EXISTS cached_voice_assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voice_id TEXT UNIQUE,
          file_path TEXT,
          metadata TEXT,
          cached_at INTEGER,
          file_size INTEGER
        )
      `);
      
      await databaseService.execute(`
        CREATE TABLE IF NOT EXISTS cached_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scenario TEXT UNIQUE,
          file_path TEXT,
          cached_at INTEGER
        )
      `);
      
      // Load cached voice assets
      const cachedVoices = await databaseService.getAll(
        'SELECT * FROM cached_voice_assets ORDER BY cached_at DESC'
      );
      
      for (const cached of cachedVoices) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(cached.file_path);
          if (fileInfo.exists) {
            this.cachedVoiceAssets.set(cached.voice_id, {
              filePath: cached.file_path,
              metadata: JSON.parse(cached.metadata || '{}'),
              cachedAt: cached.cached_at
            });
          } else {
            // Remove from database if file doesn't exist
            await this._removeCachedVoiceAsset(cached.voice_id);
          }
        } catch (error) {
          console.warn(`Failed to load cached voice ${cached.voice_id}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load cached voice assets:', error);
    }
  }

  async _cleanupOldCache() {
    try {
      const cacheSize = await this.getCacheSize();
      
      if (cacheSize.totalSize > this.maxCacheSize) {
        console.log('Cache size exceeded, cleaning up old files...');
        
        // Remove oldest cached items
        const oldVoices = await databaseService.getAll(
          'SELECT * FROM cached_voice_assets ORDER BY cached_at ASC LIMIT 10'
        );
        
        for (const voice of oldVoices) {
          await this._removeCachedVoiceAsset(voice.voice_id);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old cache:', error);
    }
  }

  async _removeCachedVoiceAsset(voiceId) {
    try {
      const cached = this.cachedVoiceAssets.get(voiceId);
      if (cached) {
        await FileSystem.deleteAsync(cached.filePath, { idempotent: true });
        this.cachedVoiceAssets.delete(voiceId);
      }
      
      await databaseService.execute(
        'DELETE FROM cached_voice_assets WHERE voice_id = ?',
        [voiceId]
      );
    } catch (error) {
      console.warn(`Failed to remove cached voice asset ${voiceId}:`, error);
    }
  }

  async _clearVoiceCache() {
    try {
      await FileSystem.deleteAsync(this.voiceAssetsDirectory, { idempotent: true });
      await FileSystem.makeDirectoryAsync(this.voiceAssetsDirectory, { intermediates: true });
      await databaseService.execute('DELETE FROM cached_voice_assets');
      this.cachedVoiceAssets.clear();
    } catch (error) {
      console.error('Failed to clear voice cache:', error);
    }
  }

  async _clearResponseCache() {
    try {
      await FileSystem.deleteAsync(this.responseTemplatesDirectory, { idempotent: true });
      await FileSystem.makeDirectoryAsync(this.responseTemplatesDirectory, { intermediates: true });
      await databaseService.execute('DELETE FROM cached_responses');
      this.fallbackResponses.clear();
      this._loadDefaultResponses();
    } catch (error) {
      console.error('Failed to clear response cache:', error);
    }
  }

  _loadDefaultResponses() {
    const defaultResponses = [
      "I understand your concern. Let me help you with that.",
      "That's a great question. Here's what I think...",
      "I appreciate you bringing this to my attention.",
      "Let me clarify that point for you.",
      "I can see why that would be important to you.",
      "Thank you for your patience while we work through this.",
      "I want to make sure I understand your needs correctly.",
      "That's definitely something we can address together."
    ];
    
    this.fallbackResponses.set('default', defaultResponses);
    this.fallbackResponses.set('crisis_negotiation', [
      "I hear what you're saying, and I want to help.",
      "Let's work together to find a solution.",
      "Your concerns are valid, and we can address them.",
      "I'm here to listen and understand your perspective."
    ]);
  }

  _getDefaultResponses() {
    return this.fallbackResponses.get('default') || [
      "I'm currently in offline mode, but I'm here to help.",
      "Let me assist you with that to the best of my ability.",
      "I understand your request and will do my best to help."
    ];
  }

  _getDefaultResponse() {
    return "I'm currently operating in offline mode. Some features may be limited, but I'm here to help you practice your communication skills.";
  }

  _selectContextualResponse(responses, userInput) {
    const input = userInput.toLowerCase();
    
    // Simple keyword matching for contextual responses
    if (input.includes('help') || input.includes('assist')) {
      return responses.find(r => r.includes('help')) || responses[0];
    }
    
    if (input.includes('problem') || input.includes('issue')) {
      return responses.find(r => r.includes('concern') || r.includes('address')) || responses[0];
    }
    
    if (input.includes('question')) {
      return responses.find(r => r.includes('question')) || responses[0];
    }
    
    // Return random response if no context match
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }
}

// Global offline service instance
export const offlineService = new OfflineService();

export default offlineService;