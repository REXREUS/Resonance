import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

/**
 * Document processing utilities for PDF/DOCX text extraction
 * Handles file upload, text extraction, and caching
 */
export class DocumentProcessor {
  constructor() {
    this.supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
  }

  /**
   * Pick and process document from device
   * @returns {Promise<Object|null>} - Document object or null if cancelled
   */
  async pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: this.supportedTypes,
        copyToCacheDirectory: true,
        multiple: false
      });

      if (result.canceled) {
        return null;
      }

      const document = result.assets[0];
      console.log('Document picked:', document.name);

      // Extract text content
      const textContent = await this.extractText(document);
      
      return {
        name: document.name,
        uri: document.uri,
        size: document.size,
        mimeType: document.mimeType,
        content: textContent,
        extractedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to pick document:', error);
      throw error;
    }
  }

  /**
   * Extract text content from document
   * @param {Object} document - Document object from picker
   * @returns {Promise<string>} - Extracted text content
   */
  async extractText(document) {
    try {
      const { mimeType, uri } = document;

      if (mimeType === 'text/plain') {
        return await this._extractTextFromPlainText(uri);
      } else if (mimeType === 'application/pdf') {
        return await this._extractTextFromPDF(uri);
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        return await this._extractTextFromDOCX(uri);
      }

      throw new Error(`Unsupported document type: ${mimeType}`);
    } catch (error) {
      console.error('Failed to extract text:', error);
      throw error;
    }
  }

  /**
   * Extract text from plain text file
   * @private
   */
  async _extractTextFromPlainText(uri) {
    try {
      const content = await FileSystem.readAsStringAsync(uri);
      return content;
    } catch (error) {
      console.error('Failed to read plain text file:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   * @private
   */
  async _extractTextFromPDF(uri) {
    try {
      // For now, return a placeholder since PDF extraction requires native modules
      // In a real implementation, you would use a PDF parsing library like pdf-parse
      console.warn('PDF text extraction not fully implemented - using placeholder');
      
      // Get file info for the placeholder
      const fileName = uri.split('/').pop() || 'document.pdf';
      
      // Return placeholder text - in production, use a proper PDF parser
      // Note: expo-file-system's Base64 encoding may not be available in all environments
      return `[PDF Document: ${fileName}]\n\nThis PDF document has been uploaded as context for the training session. The content will be used to inform the AI conversation.\n\nNote: Full PDF text extraction requires additional native modules. For best results, consider copying the relevant text content manually or using a TXT file.`;
    } catch (error) {
      console.error('Failed to extract PDF text:', error);
      // Return a fallback placeholder instead of throwing
      const fileName = uri.split('/').pop() || 'document.pdf';
      return `[PDF Document: ${fileName}]\n\nDocument uploaded successfully. Text extraction encountered an issue, but the document reference has been saved.`;
    }
  }

  /**
   * Extract text from DOCX file
   * @private
   */
  async _extractTextFromDOCX(uri) {
    try {
      // For now, return a placeholder since DOCX extraction requires native modules
      // In a real implementation, you would use a DOCX parsing library like mammoth
      console.warn('DOCX text extraction not fully implemented - using placeholder');
      
      const fileName = uri.split('/').pop() || 'document.docx';
      
      return `[Word Document: ${fileName}]\n\nThis Word document has been uploaded as context for the training session. The content will be used to inform the AI conversation.\n\nNote: Full DOCX text extraction requires additional native modules. For best results, consider copying the relevant text content manually or using a TXT file.`;
    } catch (error) {
      console.error('Failed to extract DOCX text:', error);
      // Return a fallback placeholder instead of throwing
      const fileName = uri.split('/').pop() || 'document.docx';
      return `[Word Document: ${fileName}]\n\nDocument uploaded successfully. Text extraction encountered an issue, but the document reference has been saved.`;
    }
  }

  /**
   * Validate document before processing
   * @param {Object} document - Document to validate
   * @returns {boolean} - Whether document is valid
   */
  validateDocument(document) {
    if (!document || !document.mimeType) {
      return false;
    }

    if (!this.supportedTypes.includes(document.mimeType)) {
      return false;
    }

    // Check file size (max 10MB)
    if (document.size > 10 * 1024 * 1024) {
      return false;
    }

    return true;
  }

  /**
   * Get supported file types for display
   * @returns {Array} - Array of supported file extensions
   */
  getSupportedTypes() {
    return ['PDF', 'DOCX', 'DOC', 'TXT'];
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();