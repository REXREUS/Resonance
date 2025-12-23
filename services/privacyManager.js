import { databaseService } from './databaseService';
import { documentManager } from './documentManager';
import { storageManager } from './storageManager';
import { exportGenerator } from '../utils/exportGenerator';
import * as FileSystem from 'expo-file-system';

/**
 * Privacy Manager for handling data export and privacy controls
 */
class PrivacyManager {
  constructor() {
    this.supportedLanguages = ['id', 'en'];
  }

  /**
   * Export all user data in selected language
   */
  async exportAllData(language = 'id', format = 'json') {
    if (!this.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const exportData = await exportGenerator.exportAllSessionData(language);
    
    // Add additional privacy-related data
    const documents = await documentManager.getAllDocuments();
    const storageStats = await storageManager.getStorageStats();
    
    const completeExport = {
      ...exportData,
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        fileSize: doc.file_size,
        uploadedAt: doc.uploaded_at,
        // Don't include extracted text for privacy
        hasExtractedText: !!doc.extracted_text_content
      })),
      storageStats,
      exportInfo: {
        exportedAt: Date.now(),
        language,
        format,
        version: '1.0.0'
      }
    };

    return completeExport;
  }

  /**
   * Generate PDF report in user's selected language
   */
  async generatePDFReport(sessionId, language = 'id') {
    const pdfContent = await exportGenerator.generatePDFReport(sessionId, language);
    
    // Save PDF to file system
    const fileName = `session_report_${sessionId}_${Date.now()}`;
    const filePath = await exportGenerator.saveExportToFile(pdfContent, fileName, 'json');
    
    return {
      filePath,
      content: pdfContent,
      language,
      sessionId
    };
  }

  /**
   * Clear session history while preserving preferences
   */
  async clearSessionHistory() {
    const options = {
      clearSessions: true,
      clearDocuments: false,
      clearVoiceAssets: false,
      clearQuotaUsage: false,
      preserveSettings: true,
      preserveSystemVoices: true
    };

    const result = await databaseService.selectiveDataClear(options);
    
    return {
      cleared: result,
      message: 'Session history cleared successfully',
      preservedSettings: true
    };
  }

  /**
   * Clear all data except settings
   */
  async clearAllDataExceptSettings() {
    const options = {
      clearSessions: true,
      clearDocuments: true,
      clearVoiceAssets: true,
      clearQuotaUsage: true,
      preserveSettings: true,
      preserveSystemVoices: true
    };

    const result = await databaseService.selectiveDataClear(options);
    
    // Also clean up document files
    await documentManager.cleanupOrphanedFiles();
    
    return {
      cleared: result,
      message: 'All data cleared except settings',
      preservedSettings: true
    };
  }

  /**
   * Get data overview for privacy dashboard
   */
  async getDataOverview() {
    const counts = await databaseService.getDataCounts();
    const storageStats = await storageManager.getStorageStats();
    const documents = await documentManager.getAllDocuments();
    
    return {
      counts,
      storage: {
        total: storageStats.usage.total,
        formatted: storageManager.formatStorageSize(storageStats.usage.total),
        breakdown: storageStats.usage
      },
      documents: {
        total: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0),
        categories: this.categorizeDocuments(documents)
      },
      lastUpdated: Date.now()
    };
  }

  /**
   * Manage SOP documents (view, delete, organize)
   */
  async manageDocument(operation, documentId, additionalData = {}) {
    // Validate operation
    documentManager.validateDocumentOperation(operation, documentId, additionalData);
    
    switch (operation) {
      case 'view':
        return await documentManager.viewDocument(documentId);
      
      case 'delete':
        const deleteResult = await documentManager.deleteDocument(documentId);
        return {
          success: deleteResult,
          message: 'Document deleted successfully',
          documentId
        };
      
      case 'organize':
        const organizeResult = await documentManager.organizeDocument(documentId, additionalData.category);
        return {
          success: true,
          message: 'Document organized successfully',
          document: organizeResult
        };
      
      case 'search':
        return await documentManager.searchDocuments(additionalData.searchTerm);
      
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Get storage management information
   */
  async getStorageManagement() {
    const stats = await storageManager.getStorageStats();
    const breakdown = await storageManager.getStorageBreakdown();
    const recommendations = await storageManager.isCleanupRecommended();
    
    return {
      stats,
      breakdown,
      recommendations,
      formatted: {
        totalSize: storageManager.formatStorageSize(stats.usage.total),
        databaseSize: storageManager.formatStorageSize(stats.usage.database),
        documentsSize: storageManager.formatStorageSize(stats.usage.documents),
        cacheSize: storageManager.formatStorageSize(stats.usage.cache)
      }
    };
  }

  /**
   * Perform storage cleanup with options
   */
  async performCleanup(options = {}) {
    const validatedOptions = storageManager.validateCleanupOptions(options);
    const estimate = await storageManager.estimateCleanupImpact(validatedOptions);
    
    // Perform the actual cleanup
    const result = await storageManager.cleanupOldData(validatedOptions);
    
    return {
      estimate,
      result,
      options: validatedOptions,
      message: 'Cleanup completed successfully'
    };
  }

  /**
   * Selective data clearing with preview
   */
  async selectiveDataClear(options = {}) {
    // Get preview of what will be cleared
    const counts = await databaseService.getDataCounts();
    
    // Perform selective clearing
    const result = await databaseService.selectiveDataClear(options);
    
    return {
      before: counts,
      cleared: result,
      options,
      message: 'Selective data clearing completed'
    };
  }

  /**
   * Categorize documents by type/category
   */
  categorizeDocuments(documents) {
    const categories = {};
    
    documents.forEach(doc => {
      const fileName = doc.file_name || '';
      let category = 'uncategorized';
      
      if (fileName.includes('/')) {
        category = fileName.split('/')[0];
      } else {
        const extension = fileName.split('.').pop()?.toLowerCase();
        if (extension) {
          category = extension;
        }
      }
      
      if (!categories[category]) {
        categories[category] = {
          count: 0,
          totalSize: 0,
          documents: []
        };
      }
      
      categories[category].count++;
      categories[category].totalSize += doc.file_size || 0;
      categories[category].documents.push({
        id: doc.id,
        fileName: doc.file_name,
        fileSize: doc.file_size
      });
    });
    
    return categories;
  }

  /**
   * Validate privacy operation
   */
  validatePrivacyOperation(operation, data = {}) {
    const validOperations = [
      'export_all',
      'export_pdf',
      'clear_sessions',
      'clear_all',
      'manage_document',
      'cleanup_storage',
      'selective_clear'
    ];
    
    if (!validOperations.includes(operation)) {
      throw new Error(`Invalid privacy operation: ${operation}`);
    }
    
    // Validate language for export operations
    if ((operation === 'export_all' || operation === 'export_pdf') && data.language) {
      if (!this.supportedLanguages.includes(data.language)) {
        throw new Error(`Unsupported language: ${data.language}`);
      }
    }
    
    return true;
  }

  /**
   * Get privacy compliance information
   */
  async getPrivacyCompliance() {
    const dataOverview = await this.getDataOverview();
    
    return {
      dataRetention: {
        sessions: dataOverview.counts.sessions,
        documents: dataOverview.counts.documents,
        voiceAssets: dataOverview.counts.voiceAssets,
        totalStorage: dataOverview.storage.formatted
      },
      userRights: {
        canExportData: true,
        canDeleteData: true,
        canViewData: true,
        canCorrectData: true
      },
      dataProcessing: {
        localOnly: true,
        noCloudSync: true,
        encryptedStorage: true,
        userControlled: true
      },
      lastUpdated: Date.now()
    };
  }
}

export const privacyManager = new PrivacyManager();
export default privacyManager;