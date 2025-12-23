const fc = require('fast-check');
const { documentManager } = require('../documentManager');
const { databaseService } = require('../databaseService');

// Mock the database service
jest.mock('../databaseService', () => ({
  databaseService: {
    createContextFile: jest.fn(),
    getContextFiles: jest.fn(),
    getContextFile: jest.fn(),
    deleteContextFile: jest.fn(),
    updateContextFile: jest.fn(),
  },
}));

// Mock the document processor
jest.mock('../../utils/documentProcessor', () => ({
  documentProcessor: {
    extractText: jest.fn(),
  },
}));

// Mock expo modules
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

const FileSystem = require('expo-file-system');

/**
 * **Feature: resonance-mobile-app, Property 30: Document management operations**
 * **Validates: Requirements 16.2**
 */
describe('Property 30: Document management operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Default mock implementations
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024, isDirectory: false });
    FileSystem.makeDirectoryAsync.mockResolvedValue();
    FileSystem.copyAsync.mockResolvedValue();
    FileSystem.deleteAsync.mockResolvedValue();
    FileSystem.moveAsync.mockResolvedValue();
    FileSystem.readDirectoryAsync.mockResolvedValue([]);
  });

  test('should handle document view operations consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentId: fc.integer({ min: 1, max: 1000 }),
          documentData: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            file_name: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.replace(/[\/\\]/g, '_')),
            extracted_text_content: fc.string({ minLength: 0, maxLength: 1000 }),
            file_size: fc.integer({ min: 0, max: 10000000 }),
            uploaded_at: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          }),
        }),
        async ({ documentId, documentData }) => {
          // Mock database response
          databaseService.getContextFile.mockResolvedValue(documentData);

          // Validate operation before execution
          const isValid = documentManager.validateDocumentOperation('view', documentId);
          expect(isValid).toBe(true);

          // Execute view operation
          const result = await documentManager.viewDocument(documentId);

          // Verify result structure and data consistency
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          expect(result.id).toBe(documentData.id);
          expect(result.fileName).toBe(documentData.file_name);
          expect(result.extractedText).toBe(documentData.extracted_text_content);
          expect(result.fileSize).toBe(documentData.file_size);
          expect(result.uploadedAt).toBe(documentData.uploaded_at);
          expect(typeof result.exists).toBe('boolean');

          // Verify database was called correctly (viewDocument calls getDocument which calls getContextFile)
          expect(databaseService.getContextFile).toHaveBeenCalledWith(documentId);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle document delete operations consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentId: fc.integer({ min: 1, max: 1000 }),
          documentData: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            file_name: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.replace(/[\/\\]/g, '_')),
            extracted_text_content: fc.string({ minLength: 0, maxLength: 1000 }),
            file_size: fc.integer({ min: 0, max: 10000000 }),
            uploaded_at: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          }),
          fileExists: fc.boolean(),
        }),
        async ({ documentId, documentData, fileExists }) => {
          // Mock database and filesystem responses
          databaseService.getContextFile.mockResolvedValue(documentData);
          FileSystem.getInfoAsync.mockResolvedValue({ exists: fileExists });

          // Validate operation before execution
          const isValid = documentManager.validateDocumentOperation('delete', documentId);
          expect(isValid).toBe(true);

          // Execute delete operation
          const result = await documentManager.deleteDocument(documentId);

          // Verify operation completed successfully
          expect(result).toBe(true);

          // Verify database operations were called
          expect(databaseService.getContextFile).toHaveBeenCalledWith(documentId);
          expect(databaseService.deleteContextFile).toHaveBeenCalledWith(documentId);

          // Verify file deletion was called only if file existed
          if (fileExists) {
            expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
              expect.stringContaining(documentData.file_name)
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle document organize operations consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentId: fc.integer({ min: 1, max: 1000 }),
          documentData: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            file_name: fc.string({ minLength: 1, maxLength: 100 }).map(s => s.replace(/[\/\\]/g, '_')),
            extracted_text_content: fc.string({ minLength: 0, maxLength: 1000 }),
            file_size: fc.integer({ min: 0, max: 10000000 }),
            uploaded_at: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          }),
          category: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          fileExists: fc.boolean(),
        }),
        async ({ documentId, documentData, category, fileExists }) => {
          // Mock database and filesystem responses
          databaseService.getContextFile.mockResolvedValue(documentData);
          FileSystem.getInfoAsync
            .mockResolvedValueOnce({ exists: fileExists }) // For document file
            .mockResolvedValueOnce({ exists: false }); // For category directory

          // Validate operation before execution
          const isValid = documentManager.validateDocumentOperation('organize', documentId, { category });
          expect(isValid).toBe(true);

          // Execute organize operation
          const result = await documentManager.organizeDocument(documentId, category);

          // Verify result structure and data consistency
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          expect(result.id).toBe(documentData.id);
          expect(result.file_name).toBe(`${category}/${documentData.file_name}`);
          expect(result.category).toBe(category);
          expect(result.filePath).toContain(category);
          expect(result.filePath).toContain(documentData.file_name);

          // Verify database operations were called
          expect(databaseService.getContextFile).toHaveBeenCalledWith(documentId);
          expect(databaseService.updateContextFile).toHaveBeenCalledWith(documentId, {
            file_name: `${category}/${documentData.file_name}`
          });

          // Verify filesystem operations
          expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
            expect.stringContaining(category),
            { intermediates: true }
          );

          if (fileExists) {
            expect(FileSystem.moveAsync).toHaveBeenCalledWith({
              from: expect.stringContaining(documentData.file_name),
              to: expect.stringContaining(`${category}/${documentData.file_name}`)
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle document search operations consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          searchTerm: fc.string({ minLength: 0, maxLength: 50 }),
          documents: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              file_name: fc.string({ minLength: 1, maxLength: 100 }),
              extracted_text_content: fc.string({ minLength: 0, maxLength: 500 }),
              file_size: fc.integer({ min: 0, max: 10000000 }),
              uploaded_at: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 0, maxLength: 10 }
          ),
        }),
        async ({ searchTerm, documents }) => {
          // Mock database response
          databaseService.getContextFiles.mockResolvedValue(documents);

          // Validate operation (search doesn't require document ID)
          const isValid = documentManager.validateDocumentOperation('search', null);
          expect(isValid).toBe(true);

          // Execute search operation
          const results = await documentManager.searchDocuments(searchTerm);

          // Verify results structure
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeLessThanOrEqual(documents.length);

          // If search term is empty, should return all documents
          if (!searchTerm || searchTerm.trim() === '') {
            expect(results.length).toBe(documents.length);
          }

          // Verify each result has correct structure
          results.forEach(result => {
            expect(typeof result).toBe('object');
            expect(typeof result.id).toBe('number');
            expect(typeof result.file_name).toBe('string');
            expect(typeof result.filePath).toBe('string');
            expect(typeof result.exists).toBe('boolean');
            
            // Verify result is from original documents
            const originalDoc = documents.find(doc => doc.id === result.id);
            expect(originalDoc).toBeDefined();
          });

          // If search term is provided, verify results match search criteria
          if (searchTerm && searchTerm.trim() !== '') {
            const searchTermLower = searchTerm.toLowerCase();
            results.forEach(result => {
              const fileName = (result.file_name || '').toLowerCase();
              const extractedText = (result.extracted_text_content || '').toLowerCase();
              
              const matchesFileName = fileName.includes(searchTermLower);
              const matchesContent = extractedText.includes(searchTermLower);
              
              expect(matchesFileName || matchesContent).toBe(true);
            });
          }

          // Verify database was called correctly
          expect(databaseService.getContextFiles).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate document operations correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          operation: fc.constantFrom('view', 'delete', 'organize', 'search'),
          documentId: fc.option(fc.integer({ min: 1, max: 1000 })),
          category: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
        }),
        async ({ operation, documentId, category }) => {
          let shouldThrow = false;
          let expectedError = '';

          // Determine if operation should throw based on validation rules
          // Check document ID first (except for search)
          if (operation !== 'search' && (!documentId || typeof documentId !== 'number')) {
            shouldThrow = true;
            expectedError = 'Invalid document ID';
          }
          // Only check category if document ID is valid (for organize operation)
          else if (operation === 'organize') {
            if (!category || typeof category !== 'string') {
              shouldThrow = true;
              expectedError = 'Category is required for organize operation';
            } else if (!/^[a-zA-Z0-9_-]+$/.test(category)) {
              shouldThrow = true;
              expectedError = 'Invalid category name';
            }
          }

          // Test validation
          if (shouldThrow) {
            expect(() => {
              documentManager.validateDocumentOperation(operation, documentId, { category });
            }).toThrow(expectedError);
          } else {
            const result = documentManager.validateDocumentOperation(operation, documentId, { category });
            expect(result).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle invalid operations consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !['view', 'delete', 'organize', 'search'].includes(s)),
        fc.integer({ min: 1, max: 1000 }),
        async (invalidOperation, documentId) => {
          // Test that invalid operations are rejected
          expect(() => {
            documentManager.validateDocumentOperation(invalidOperation, documentId);
          }).toThrow(`Invalid operation: ${invalidOperation}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle document statistics consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            file_name: fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}.pdf`),
              fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}.docx`),
              fc.string({ minLength: 1, maxLength: 30 }).map(s => `category/${s}.pdf`),
              fc.string({ minLength: 1, maxLength: 30 }).map(s => `category/${s}.docx`)
            ),
            extracted_text_content: fc.string({ minLength: 0, maxLength: 500 }),
            file_size: fc.integer({ min: 0, max: 10000000 }),
            uploaded_at: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (documents) => {
          // Mock database response
          databaseService.getContextFiles.mockResolvedValue(documents);

          // Execute statistics operation
          const stats = await documentManager.getDocumentStats();

          // Verify statistics structure
          expect(typeof stats).toBe('object');
          expect(typeof stats.totalDocuments).toBe('number');
          expect(typeof stats.totalSize).toBe('number');
          expect(typeof stats.categories).toBe('object');
          expect(typeof stats.fileTypes).toBe('object');

          // Verify total documents count
          expect(stats.totalDocuments).toBe(documents.length);

          // Verify total size calculation
          const expectedTotalSize = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
          expect(stats.totalSize).toBe(expectedTotalSize);

          // Verify categories count
          const expectedCategories = {};
          documents.forEach(doc => {
            const fileName = doc.file_name || '';
            if (fileName.includes('/')) {
              const category = fileName.split('/')[0];
              expectedCategories[category] = (expectedCategories[category] || 0) + 1;
            } else {
              expectedCategories['uncategorized'] = (expectedCategories['uncategorized'] || 0) + 1;
            }
          });
          expect(stats.categories).toEqual(expectedCategories);

          // Verify file types count
          const expectedFileTypes = {};
          documents.forEach(doc => {
            const fileName = doc.file_name || '';
            const extension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
            expectedFileTypes[extension] = (expectedFileTypes[extension] || 0) + 1;
          });
          expect(stats.fileTypes).toEqual(expectedFileTypes);

          // Verify database was called correctly
          expect(databaseService.getContextFiles).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle non-existent documents consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        async (nonExistentDocumentId) => {
          // Mock database to return null (document not found)
          databaseService.getContextFile.mockResolvedValue(null);

          // Test view operation with non-existent document
          const viewResult = await documentManager.viewDocument(nonExistentDocumentId);
          expect(viewResult).toBeNull();

          // Test delete operation with non-existent document
          await expect(documentManager.deleteDocument(nonExistentDocumentId))
            .rejects.toThrow(`Document not found: ${nonExistentDocumentId}`);

          // Test organize operation with non-existent document
          await expect(documentManager.organizeDocument(nonExistentDocumentId, 'test'))
            .rejects.toThrow(`Document not found: ${nonExistentDocumentId}`);

          // Verify database was called correctly
          expect(databaseService.getContextFile).toHaveBeenCalledWith(nonExistentDocumentId);
        }
      ),
      { numRuns: 100 }
    );
  });
});