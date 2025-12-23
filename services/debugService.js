/**
 * Debug logging service for Resonance mobile app
 * Provides comprehensive logging with different levels and categories
 */

import * as FileSystem from 'expo-file-system';
import { databaseService } from './databaseService';
import { globalErrorHandler, createStorageError } from '../utils/errorHandler';

export class DebugService {
  constructor() {
    this.isEnabled = false;
    this.logLevel = 'info';
    this.logCategories = new Set(['all']);
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.logFile = `${FileSystem.documentDirectory}debug.log`;
    this.sessionId = null;
    this.isInitialized = false;
  }

  /**
   * Initialize debug service
   */
  async initialize(options = {}) {
    try {
      const {
        enabled = false,
        logLevel = 'info',
        categories = ['all'],
        maxBufferSize = 1000
      } = options;

      this.isEnabled = enabled;
      this.logLevel = logLevel;
      this.logCategories = new Set(categories);
      this.maxBufferSize = maxBufferSize;
      this.sessionId = `session_${Date.now()}`;

      // Create debug logs table if it doesn't exist
      await this._createDebugTable();

      // Load previous settings if available
      await this._loadSettings();

      this.isInitialized = true;
      
      if (this.isEnabled) {
        this.log('system', 'info', 'Debug service initialized', { sessionId: this.sessionId });
      }

      console.log('DebugService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DebugService:', error);
      throw createStorageError(
        'Failed to initialize debug logging',
        'Debug logging may not be available'
      );
    }
  }

  /**
   * Enable debug logging
   */
  async enable(options = {}) {
    this.isEnabled = true;
    
    if (options.logLevel) {
      this.logLevel = options.logLevel;
    }
    
    if (options.categories) {
      this.logCategories = new Set(options.categories);
    }

    await this._saveSettings();
    this.log('system', 'info', 'Debug logging enabled', options);
  }

  /**
   * Disable debug logging
   */
  async disable() {
    this.log('system', 'info', 'Debug logging disabled');
    this.isEnabled = false;
    await this._saveSettings();
  }

  /**
   * Log a message with category and level
   */
  log(category, level, message, data = null) {
    if (!this.isEnabled || !this._shouldLog(category, level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      category,
      level,
      message,
      data: data ? JSON.stringify(data) : null,
      stack: level === 'error' ? new Error().stack : null
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Console output for development
    const consoleMessage = `[${category.toUpperCase()}] ${message}`;
    switch (level) {
      case 'error':
        console.error(consoleMessage, data);
        break;
      case 'warn':
        console.warn(consoleMessage, data);
        break;
      case 'debug':
        console.debug(consoleMessage, data);
        break;
      default:
        console.log(consoleMessage, data);
    }

    // Persist to database (async, non-blocking)
    this._persistLogEntry(logEntry).catch(error => {
      console.error('Failed to persist log entry:', error);
    });
  }

  /**
   * Log error with automatic categorization
   */
  logError(error, category = 'error', context = null) {
    const errorData = {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      context
    };

    this.log(category, 'error', `Error: ${error.message}`, errorData);
  }

  /**
   * Log system operation
   */
  logOperation(operation, category, data = null) {
    this.log(category, 'info', `Operation: ${operation}`, data);
  }

  /**
   * Log performance metric
   */
  logPerformance(metric, value, category = 'performance') {
    this.log(category, 'info', `Performance: ${metric}`, { 
      metric, 
      value, 
      timestamp: Date.now() 
    });
  }

  /**
   * Log user action
   */
  logUserAction(action, category = 'user', data = null) {
    this.log(category, 'info', `User Action: ${action}`, data);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit = 100, category = null, level = null) {
    let logs = [...this.logBuffer];

    if (category) {
      logs = logs.filter(log => log.category === category);
    }

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get logs from database
   */
  async getStoredLogs(options = {}) {
    try {
      const {
        limit = 1000,
        category = null,
        level = null,
        startDate = null,
        endDate = null
      } = options;

      let query = 'SELECT * FROM debug_logs WHERE 1=1';
      const params = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      if (level) {
        query += ' AND level = ?';
        params.push(level);
      }

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      return await databaseService.getAll(query, params);
    } catch (error) {
      console.error('Failed to get stored logs:', error);
      return [];
    }
  }

  /**
   * Export logs to file
   */
  async exportLogs(format = 'json') {
    try {
      const logs = await this.getStoredLogs({ limit: 10000 });
      const recentLogs = this.getRecentLogs(1000);
      
      // Combine and deduplicate logs
      const allLogs = [...logs, ...recentLogs];
      const uniqueLogs = allLogs.filter((log, index, self) => 
        index === self.findIndex(l => l.timestamp === log.timestamp && l.message === log.message)
      );

      let content;
      let fileName;

      if (format === 'json') {
        content = JSON.stringify(uniqueLogs, null, 2);
        fileName = `debug_logs_${Date.now()}.json`;
      } else {
        // CSV format
        const headers = 'timestamp,category,level,message,data\n';
        const rows = uniqueLogs.map(log => 
          `"${log.timestamp}","${log.category}","${log.level}","${log.message}","${log.data || ''}"`
        ).join('\n');
        content = headers + rows;
        fileName = `debug_logs_${Date.now()}.csv`;
      }

      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, content);

      return filePath;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw createStorageError(
        'Failed to export debug logs',
        'Unable to create log export file'
      );
    }
  }

  /**
   * Clear logs
   */
  async clearLogs(options = {}) {
    try {
      const { keepRecent = 100, olderThanDays = null } = options;

      // Clear buffer
      if (keepRecent > 0) {
        this.logBuffer = this.logBuffer.slice(-keepRecent);
      } else {
        this.logBuffer = [];
      }

      // Clear database logs
      let query = 'DELETE FROM debug_logs';
      const params = [];

      if (olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        query += ' WHERE timestamp < ?';
        params.push(cutoffDate.toISOString());
      } else if (keepRecent > 0) {
        // Keep only the most recent entries
        query = `DELETE FROM debug_logs WHERE id NOT IN (
          SELECT id FROM debug_logs ORDER BY timestamp DESC LIMIT ?
        )`;
        params.push(keepRecent);
      }

      await databaseService.execute(query, params);
      
      this.log('system', 'info', 'Debug logs cleared', options);
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw createStorageError(
        'Failed to clear debug logs',
        'Unable to clear log data'
      );
    }
  }

  /**
   * Get debug statistics
   */
  async getDebugStats() {
    try {
      const stats = await databaseService.get(`
        SELECT 
          COUNT(*) as totalLogs,
          COUNT(CASE WHEN level = 'error' THEN 1 END) as errorCount,
          COUNT(CASE WHEN level = 'warn' THEN 1 END) as warningCount,
          COUNT(CASE WHEN level = 'info' THEN 1 END) as infoCount,
          COUNT(CASE WHEN level = 'debug' THEN 1 END) as debugCount,
          MIN(timestamp) as oldestLog,
          MAX(timestamp) as newestLog
        FROM debug_logs
      `);

      return {
        ...stats,
        bufferSize: this.logBuffer.length,
        maxBufferSize: this.maxBufferSize,
        isEnabled: this.isEnabled,
        logLevel: this.logLevel,
        categories: Array.from(this.logCategories),
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('Failed to get debug stats:', error);
      return {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        bufferSize: this.logBuffer.length,
        maxBufferSize: this.maxBufferSize,
        isEnabled: this.isEnabled,
        logLevel: this.logLevel,
        categories: Array.from(this.logCategories),
        sessionId: this.sessionId
      };
    }
  }

  // Private methods

  async _createDebugTable() {
    await databaseService.execute(`
      CREATE TABLE IF NOT EXISTS debug_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        session_id TEXT,
        category TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        stack TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create index for better query performance
    await databaseService.execute(`
      CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp 
      ON debug_logs(timestamp)
    `);

    await databaseService.execute(`
      CREATE INDEX IF NOT EXISTS idx_debug_logs_category_level 
      ON debug_logs(category, level)
    `);
  }

  async _loadSettings() {
    try {
      const settings = await databaseService.get(
        'SELECT * FROM app_settings WHERE id = 1'
      );

      if (settings) {
        this.isEnabled = settings.debug_enabled || false;
        this.logLevel = settings.debug_level || 'info';
        
        if (settings.debug_categories) {
          this.logCategories = new Set(JSON.parse(settings.debug_categories));
        }
      }
    } catch (error) {
      console.warn('Failed to load debug settings:', error);
    }
  }

  async _saveSettings() {
    try {
      await databaseService.execute(`
        UPDATE app_settings 
        SET debug_enabled = ?, debug_level = ?, debug_categories = ?
        WHERE id = 1
      `, [
        this.isEnabled,
        this.logLevel,
        JSON.stringify(Array.from(this.logCategories))
      ]);
    } catch (error) {
      console.warn('Failed to save debug settings:', error);
    }
  }

  async _persistLogEntry(logEntry) {
    try {
      await databaseService.execute(`
        INSERT INTO debug_logs 
        (timestamp, session_id, category, level, message, data, stack)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        logEntry.timestamp,
        logEntry.sessionId,
        logEntry.category,
        logEntry.level,
        logEntry.message,
        logEntry.data,
        logEntry.stack
      ]);
    } catch (error) {
      // Don't throw - logging should not break the app
      console.error('Failed to persist log entry:', error);
    }
  }

  _shouldLog(category, level) {
    // Check if category is enabled
    if (!this.logCategories.has('all') && !this.logCategories.has(category)) {
      return false;
    }

    // Check log level
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }
}

// Global debug service instance
export const debugService = new DebugService();

// Utility functions for common logging patterns
export const logSystemOperation = (operation, data = null) => {
  debugService.logOperation(operation, 'system', data);
};

export const logUserInteraction = (action, data = null) => {
  debugService.logUserAction(action, 'user', data);
};

export const logPerformanceMetric = (metric, value) => {
  debugService.logPerformance(metric, value);
};

export const logError = (error, context = null) => {
  debugService.logError(error, 'error', context);
};

export default debugService;