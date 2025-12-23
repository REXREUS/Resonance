import * as FileSystem from 'expo-file-system';
import { databaseService } from './databaseService';

/**
 * Storage Manager for handling database size display and cleanup operations
 */
class StorageManager {
  constructor() {
    this.documentsDirectory = `${FileSystem.documentDirectory}documents/`;
    this.cacheDirectory = `${FileSystem.cacheDirectory}`;
  }

  /**
   * Get current database size
   */
  async getDatabaseSize() {
    return await databaseService.getDatabaseSize();
  }

  /**
   * Get total storage usage
   */
  async getTotalStorageUsage() {
    const dbSize = await this.getDatabaseSize();
    const documentsSize = await this.getDirectorySize(this.documentsDirectory);
    const cacheSize = await this.getDirectorySize(this.cacheDirectory);

    return {
      database: dbSize,
      documents: documentsSize,
      cache: cacheSize,
      total: dbSize + documentsSize + cacheSize
    };
  }

  /**
   * Get directory size recursively
   */
  async getDirectorySize(directoryPath) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(directoryPath);
      if (!dirInfo.exists || !dirInfo.isDirectory) {
        return 0;
      }

      let totalSize = 0;
      const items = await FileSystem.readDirectoryAsync(directoryPath);

      for (const item of items) {
        const itemPath = `${directoryPath}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);

        if (itemInfo.isDirectory) {
          totalSize += await this.getDirectorySize(`${itemPath}/`);
        } else {
          totalSize += itemInfo.size || 0;
        }
      }

      return totalSize;
    } catch (error) {
      console.warn('Error calculating directory size:', directoryPath, error);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const usage = await this.getTotalStorageUsage();
    const sessionCount = await this.getSessionCount();
    const documentCount = await this.getDocumentCount();
    const voiceAssetCount = await this.getVoiceAssetCount();

    return {
      usage,
      counts: {
        sessions: sessionCount,
        documents: documentCount,
        voiceAssets: voiceAssetCount
      },
      breakdown: {
        avgSessionSize: sessionCount > 0 ? Math.round(usage.database / sessionCount) : 0,
        avgDocumentSize: documentCount > 0 ? Math.round(usage.documents / documentCount) : 0
      }
    };
  }

  /**
   * Get session count
   */
  async getSessionCount() {
    const sessions = await databaseService.getSessions();
    return sessions.length;
  }

  /**
   * Get document count
   */
  async getDocumentCount() {
    const documents = await databaseService.getContextFiles();
    return documents.length;
  }

  /**
   * Get voice asset count
   */
  async getVoiceAssetCount() {
    const voiceAssets = await databaseService.getVoiceAssets();
    return voiceAssets.length;
  }

  /**
   * Clean up old data based on age
   */
  async cleanupOldData(options = {}) {
    const {
      olderThanDays = 30,
      keepRecentSessions = 10,
      clearCache = true
    } = options;

    const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const cleanupResults = {
      sessionsDeleted: 0,
      documentsDeleted: 0,
      cacheCleared: false,
      spaceSaved: 0
    };

    // Get initial storage usage
    const initialUsage = await this.getTotalStorageUsage();

    // Clean up old sessions (keep recent ones)
    const sessions = await databaseService.getSessions();
    const oldSessions = sessions
      .filter(session => session.timestamp < cutoffDate)
      .slice(keepRecentSessions); // Keep at least keepRecentSessions recent ones

    for (const session of oldSessions) {
      await databaseService.deleteSession(session.id);
      cleanupResults.sessionsDeleted++;
    }

    // Clean up orphaned documents
    const documents = await databaseService.getContextFiles();
    const oldDocuments = documents.filter(doc => doc.uploaded_at < cutoffDate);

    for (const document of oldDocuments) {
      const filePath = `${this.documentsDirectory}${document.file_name}`;
      try {
        await FileSystem.deleteAsync(filePath);
      } catch (error) {
        console.warn('Failed to delete document file:', filePath, error);
      }
      await databaseService.deleteContextFile(document.id);
      cleanupResults.documentsDeleted++;
    }

    // Clear cache if requested
    if (clearCache) {
      try {
        const cacheItems = await FileSystem.readDirectoryAsync(this.cacheDirectory);
        for (const item of cacheItems) {
          await FileSystem.deleteAsync(`${this.cacheDirectory}${item}`);
        }
        cleanupResults.cacheCleared = true;
      } catch (error) {
        console.warn('Failed to clear cache:', error);
      }
    }

    // Clean up old quota usage records
    await databaseService.clearOldQuotaUsage();

    // Calculate space saved
    const finalUsage = await this.getTotalStorageUsage();
    cleanupResults.spaceSaved = initialUsage.total - finalUsage.total;

    return cleanupResults;
  }

  /**
   * Validate storage cleanup options
   */
  validateCleanupOptions(options) {
    const validatedOptions = {
      olderThanDays: 30,
      keepRecentSessions: 10,
      clearCache: true,
      ...options
    };

    // Validate olderThanDays
    if (typeof validatedOptions.olderThanDays !== 'number' || 
        validatedOptions.olderThanDays < 1 || 
        validatedOptions.olderThanDays > 365) {
      throw new Error('olderThanDays must be a number between 1 and 365');
    }

    // Validate keepRecentSessions
    if (typeof validatedOptions.keepRecentSessions !== 'number' || 
        validatedOptions.keepRecentSessions < 0 || 
        validatedOptions.keepRecentSessions > 1000) {
      throw new Error('keepRecentSessions must be a number between 0 and 1000');
    }

    // Validate clearCache
    if (typeof validatedOptions.clearCache !== 'boolean') {
      throw new Error('clearCache must be a boolean');
    }

    return validatedOptions;
  }

  /**
   * Format storage size for display
   */
  formatStorageSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Get storage usage by category
   */
  async getStorageBreakdown() {
    const sessions = await databaseService.getSessions();
    const documents = await databaseService.getContextFiles();
    const voiceAssets = await databaseService.getVoiceAssets();
    const quotaUsage = await databaseService.getQuotaUsage(0); // All quota usage

    const breakdown = {
      sessions: {
        count: sessions.length,
        estimatedSize: sessions.length * 1024 // Rough estimate
      },
      documents: {
        count: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0)
      },
      voiceAssets: {
        count: voiceAssets.length,
        estimatedSize: voiceAssets.length * 512 // Rough estimate
      },
      quotaUsage: {
        count: quotaUsage.length,
        estimatedSize: quotaUsage.length * 128 // Rough estimate
      }
    };

    return breakdown;
  }

  /**
   * Check if storage cleanup is recommended
   */
  async isCleanupRecommended() {
    const stats = await this.getStorageStats();
    const breakdown = await this.getStorageBreakdown();

    // Recommend cleanup if:
    // 1. Total storage > 100MB
    // 2. More than 100 sessions
    // 3. More than 50 documents
    const recommendations = {
      recommended: false,
      reasons: []
    };

    if (stats.usage.total > 100 * 1024 * 1024) { // 100MB
      recommendations.recommended = true;
      recommendations.reasons.push('Total storage exceeds 100MB');
    }

    if (breakdown.sessions.count > 100) {
      recommendations.recommended = true;
      recommendations.reasons.push('More than 100 sessions stored');
    }

    if (breakdown.documents.count > 50) {
      recommendations.recommended = true;
      recommendations.reasons.push('More than 50 documents stored');
    }

    return recommendations;
  }

  /**
   * Estimate cleanup impact
   */
  async estimateCleanupImpact(options = {}) {
    const validatedOptions = this.validateCleanupOptions(options);
    const cutoffDate = Date.now() - (validatedOptions.olderThanDays * 24 * 60 * 60 * 1000);

    const sessions = await databaseService.getSessions();
    const documents = await databaseService.getContextFiles();
    const cacheSize = await this.getDirectorySize(this.cacheDirectory);

    const oldSessions = sessions
      .filter(session => session.timestamp < cutoffDate)
      .slice(validatedOptions.keepRecentSessions);

    const oldDocuments = documents.filter(doc => doc.uploaded_at < cutoffDate);
    const documentsSize = oldDocuments.reduce((sum, doc) => sum + (doc.file_size || 0), 0);

    const estimate = {
      sessionsToDelete: oldSessions.length,
      documentsToDelete: oldDocuments.length,
      estimatedSpaceSaved: documentsSize + (validatedOptions.clearCache ? cacheSize : 0),
      cacheToDelete: validatedOptions.clearCache ? cacheSize : 0
    };

    return estimate;
  }
}

export const storageManager = new StorageManager();
export default storageManager;