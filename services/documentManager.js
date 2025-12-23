import * as FileSystem from 'expo-file-system';
import { databaseService } from './databaseService';
import { documentProcessor } from '../utils/documentProcessor';

/**
 * Document Manager for handling SOP document operations
 */
class DocumentManager {
  constructor() {
    this.documentsDirectory = `${FileSystem.documentDirectory}documents/`;
  }

  /**
   * Initialize documents directory
   */
  async initialize() {
    const dirInfo = await FileSystem.getInfoAsync(this.documentsDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.documentsDirectory, { intermediates: true });
    }
  }

  /**
   * Upload and process a document
   */
  async uploadDocument(fileUri, fileName) {
    await this.initialize();

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error(`File not found: ${fileUri}`);
    }

    // Copy file to documents directory
    const destinationPath = `${this.documentsDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: fileUri,
      to: destinationPath
    });

    // Extract text content
    let extractedText = '';
    try {
      extractedText = await documentProcessor.extractText(destinationPath);
    } catch (error) {
      console.warn('Failed to extract text from document:', error);
      extractedText = '';
    }

    // Store in database
    const documentId = await databaseService.createContextFile(
      fileName,
      extractedText,
      fileInfo.size
    );

    return {
      id: documentId,
      fileName,
      filePath: destinationPath,
      extractedText,
      fileSize: fileInfo.size,
      uploadedAt: Date.now()
    };
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    const documents = await databaseService.getContextFiles();
    
    // Add file path information
    return documents.map(doc => ({
      ...doc,
      filePath: `${this.documentsDirectory}${doc.file_name}`,
      exists: false // Will be checked if needed
    }));
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId) {
    const document = await databaseService.getContextFile(documentId);
    if (!document) {
      return null;
    }

    const filePath = `${this.documentsDirectory}${document.file_name}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    return {
      ...document,
      filePath,
      exists: fileInfo.exists
    };
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId) {
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Delete file from filesystem
    if (document.exists) {
      await FileSystem.deleteAsync(document.filePath);
    }

    // Delete from database
    await databaseService.deleteContextFile(documentId);

    return true;
  }

  /**
   * Organize documents by moving to a subfolder
   */
  async organizeDocument(documentId, category) {
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Create category directory if it doesn't exist
    const categoryDir = `${this.documentsDirectory}${category}/`;
    const categoryDirInfo = await FileSystem.getInfoAsync(categoryDir);
    if (!categoryDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(categoryDir, { intermediates: true });
    }

    // Move file to category directory
    const newPath = `${categoryDir}${document.file_name}`;
    if (document.exists) {
      await FileSystem.moveAsync({
        from: document.filePath,
        to: newPath
      });
    }

    // Update database with new file name (including category)
    await databaseService.updateContextFile(documentId, {
      file_name: `${category}/${document.file_name}`
    });

    return {
      ...document,
      file_name: `${category}/${document.file_name}`,
      filePath: newPath,
      category
    };
  }

  /**
   * View document content
   */
  async viewDocument(documentId) {
    const document = await databaseService.getContextFile(documentId);
    if (!document) {
      return null;
    }

    const filePath = `${this.documentsDirectory}${document.file_name}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    return {
      id: document.id,
      fileName: document.file_name,
      extractedText: document.extracted_text_content,
      fileSize: document.file_size,
      uploadedAt: document.uploaded_at,
      exists: fileInfo.exists
    };
  }

  /**
   * Search documents by content
   */
  async searchDocuments(searchTerm) {
    const allDocuments = await this.getAllDocuments();
    
    if (!searchTerm || searchTerm.trim() === '') {
      return allDocuments;
    }

    const searchTermLower = searchTerm.toLowerCase();
    
    return allDocuments.filter(doc => {
      const fileName = (doc.file_name || '').toLowerCase();
      const extractedText = (doc.extracted_text_content || '').toLowerCase();
      
      return fileName.includes(searchTermLower) || 
             extractedText.includes(searchTermLower);
    });
  }

  /**
   * Get documents by category
   */
  async getDocumentsByCategory(category) {
    const allDocuments = await this.getAllDocuments();
    
    return allDocuments.filter(doc => {
      const fileName = doc.file_name || '';
      return fileName.startsWith(`${category}/`);
    });
  }

  /**
   * Get document statistics
   */
  async getDocumentStats() {
    const documents = await this.getAllDocuments();
    
    const stats = {
      totalDocuments: documents.length,
      totalSize: 0,
      categories: {},
      fileTypes: {}
    };

    documents.forEach(doc => {
      // Add to total size
      stats.totalSize += doc.file_size || 0;

      // Count categories
      const fileName = doc.file_name || '';
      if (fileName.includes('/')) {
        const category = fileName.split('/')[0];
        stats.categories[category] = (stats.categories[category] || 0) + 1;
      } else {
        stats.categories['uncategorized'] = (stats.categories['uncategorized'] || 0) + 1;
      }

      // Count file types
      const extension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1;
    });

    return stats;
  }

  /**
   * Validate document operations
   */
  validateDocumentOperation(operation, documentId, additionalData = {}) {
    const validOperations = ['view', 'delete', 'organize', 'search'];
    
    if (!validOperations.includes(operation)) {
      throw new Error(`Invalid operation: ${operation}`);
    }

    if (operation !== 'search' && (!documentId || typeof documentId !== 'number')) {
      throw new Error(`Invalid document ID: ${documentId}`);
    }

    if (operation === 'organize') {
      if (!additionalData.category || typeof additionalData.category !== 'string') {
        throw new Error('Category is required for organize operation');
      }
      
      // Validate category name (no special characters)
      if (!/^[a-zA-Z0-9_-]+$/.test(additionalData.category)) {
        throw new Error('Invalid category name. Use only letters, numbers, hyphens, and underscores.');
      }
    }

    return true;
  }

  /**
   * Cleanup orphaned files (files in filesystem but not in database)
   */
  async cleanupOrphanedFiles() {
    await this.initialize();
    
    const documents = await this.getAllDocuments();
    const dbFileNames = new Set(documents.map(doc => doc.file_name));
    
    // Get all files in documents directory
    const allFiles = await this.getAllFilesRecursive(this.documentsDirectory);
    const orphanedFiles = [];

    for (const filePath of allFiles) {
      const relativePath = filePath.replace(this.documentsDirectory, '');
      if (!dbFileNames.has(relativePath)) {
        orphanedFiles.push(filePath);
        await FileSystem.deleteAsync(filePath);
      }
    }

    return orphanedFiles;
  }

  /**
   * Get all files recursively from a directory
   */
  async getAllFilesRecursive(directory) {
    const files = [];
    
    try {
      const items = await FileSystem.readDirectoryAsync(directory);
      
      for (const item of items) {
        const itemPath = `${directory}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);
        
        if (itemInfo.isDirectory) {
          const subFiles = await this.getAllFilesRecursive(`${itemPath}/`);
          files.push(...subFiles);
        } else {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
      console.warn('Error reading directory:', directory, error);
    }
    
    return files;
  }
}

export const documentManager = new DocumentManager();
export default documentManager;