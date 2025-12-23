/**
 * Property-based tests for Gemini service document processing
 * Tests Requirements: 3.4, 13.3
 */

import fc from 'fast-check';
import { GeminiService } from '../geminiService';
import { documentProcessor } from '../../utils/documentProcessor';
import { databaseService } from '../databaseService';

// Mock dependencies
jest.mock('../../utils/documentProcessor');
jest.mock('../databaseService');
jest.mock('expo-secure-store');

describe('GeminiService - Document Processing Properties', () => {
  let geminiService;

  beforeEach(async () => {
    geminiService = new GeminiService();
    
    // Mock secure store
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValue('mock-api-key');
    
    // Mock database
    databaseService.getAll.mockResolvedValue([]);
    databaseService.execute.mockResolvedValue();
    
    await geminiService.initialize();
  });

  afterEach(() => {
    geminiService.cleanup();
    jest.clearAllMocks();
  });

  /**
   * Property 6: Document processing round trip
   * Document upload, processing, and retrieval should be consistent and reliable
   */
  test('Property 6: Document processing round trip - upload and retrieval consistency', () => {
    fc.assert(fc.property(
      fc.record({
        documentName: fc.string({ minLength: 1, maxLength: 100 }),
        documentContent: fc.string({ minLength: 10, maxLength: 5000 }),
        documentSize: fc.integer({ min: 100, max: 10000000 }),
        mimeType: fc.constantFrom(
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        )
      }),
      async ({ documentName, documentContent, documentSize, mimeType }) => {
        // Mock document picker result
        const mockDocument = {
          name: documentName,
          content: documentContent,
          size: documentSize,
          mimeType: mimeType,
          uri: `file://mock/${documentName}`,
          extractedAt: Date.now()
        };

        documentProcessor.pickDocument.mockResolvedValue(mockDocument);
        documentProcessor.validateDocument.mockReturnValue(true);

        // Upload document
        const uploadedDoc = await geminiService.uploadDocument();

        // Verify upload result
        expect(uploadedDoc).toBeTruthy();
        expect(uploadedDoc.name).toBe(documentName);
        expect(uploadedDoc.content).toBe(documentContent);

        // Verify document was added to context
        const contextDocs = geminiService.getContextDocuments();
        const addedDoc = contextDocs.find(doc => doc.name === documentName);

        // Verify database storage was called
        expect(databaseService.execute).toHaveBeenCalledWith(
          expect.stringContaining('INSERT OR REPLACE INTO context_files'),
          expect.arrayContaining([documentName, documentContent, documentSize, expect.any(Number)])
        );

        // Properties to verify:
        return (
          // Document was successfully processed
          uploadedDoc !== null &&
          uploadedDoc.name === documentName &&
          uploadedDoc.content === documentContent &&
          uploadedDoc.size === documentSize &&
          // Document was added to context
          addedDoc !== undefined &&
          addedDoc.name === documentName &&
          addedDoc.contentLength === documentContent.length &&
          // Context documents list is consistent
          contextDocs.length > 0
        );
      }
    ), { numRuns: 50 });
  });

  test('Property 6a: Document validation prevents invalid uploads', () => {
    fc.assert(fc.property(
      fc.record({
        documentName: fc.string({ minLength: 1, maxLength: 100 }),
        documentContent: fc.string({ minLength: 1, maxLength: 1000 }),
        documentSize: fc.integer({ min: 1, max: 50000000 }), // Up to 50MB
        mimeType: fc.oneof(
          fc.constantFrom(
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
          ),
          fc.string() // Invalid mime types
        ),
        isValid: fc.boolean()
      }),
      async ({ documentName, documentContent, documentSize, mimeType, isValid }) => {
        const mockDocument = {
          name: documentName,
          content: documentContent,
          size: documentSize,
          mimeType: mimeType,
          uri: `file://mock/${documentName}`,
          extractedAt: Date.now()
        };

        documentProcessor.pickDocument.mockResolvedValue(mockDocument);
        documentProcessor.validateDocument.mockReturnValue(isValid);

        try {
          const result = await geminiService.uploadDocument();
          
          // If validation passed, document should be uploaded
          if (isValid) {
            expect(result).toBeTruthy();
            expect(result.name).toBe(documentName);
            
            // Should be stored in database
            expect(databaseService.execute).toHaveBeenCalled();
            
            return true;
          } else {
            // Should not reach here if validation failed
            return false;
          }
        } catch (error) {
          // If validation failed, should throw appropriate error
          if (!isValid) {
            expect(error.code).toBe('INVALID_INPUT');
            expect(error.category).toBe('validation');
            return true;
          } else {
            // Unexpected error
            return false;
          }
        }
      }
    ), { numRuns: 50 });
  });

  test('Property 6b: Context document management is consistent', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          content: fc.string({ minLength: 10, maxLength: 1000 }),
          type: fc.constantFrom('text', 'document')
        }),
        { minLength: 1, maxLength: 10 }
      ),
      (documents) => {
        // Add documents to context
        geminiService.addContextDocuments(documents);
        
        // Get context documents
        const contextDocs = geminiService.getContextDocuments();
        
        // Properties to verify:
        // 1. All documents were added
        // 2. Document metadata is preserved
        // 3. Content length is calculated correctly
        
        const allDocumentsAdded = documents.every(doc => 
          contextDocs.some(contextDoc => 
            contextDoc.name === doc.name &&
            contextDoc.contentLength === doc.content.length
          )
        );
        
        const correctCount = contextDocs.length === documents.length;
        
        const validMetadata = contextDocs.every(doc => 
          typeof doc.name === 'string' &&
          typeof doc.contentLength === 'number' &&
          doc.contentLength >= 0 &&
          typeof doc.uploadedAt === 'number'
        );
        
        return allDocumentsAdded && correctCount && validMetadata;
      }
    ), { numRuns: 50 });
  });

  test('Property 6c: Document removal maintains consistency', () => {
    fc.assert(fc.property(
      fc.record({
        initialDocs: fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            content: fc.string({ minLength: 10, maxLength: 500 }),
            type: fc.constant('document')
          }),
          { minLength: 2, maxLength: 5 }
        ),
        removeIndex: fc.integer({ min: 0, max: 4 })
      }),
      async ({ initialDocs, removeIndex }) => {
        if (initialDocs.length === 0) return true;
        
        const actualRemoveIndex = removeIndex % initialDocs.length;
        const docToRemove = initialDocs[actualRemoveIndex];
        
        // Add initial documents
        geminiService.addContextDocuments(initialDocs);
        
        const initialCount = geminiService.getContextDocuments().length;
        
        // Remove document
        await geminiService.removeContextDocument(docToRemove.name);
        
        const finalDocs = geminiService.getContextDocuments();
        const finalCount = finalDocs.length;
        
        // Verify database deletion was called
        expect(databaseService.execute).toHaveBeenCalledWith(
          'DELETE FROM context_files WHERE name = ?',
          [docToRemove.name]
        );
        
        // Properties to verify:
        return (
          // Document count decreased by 1
          finalCount === initialCount - 1 &&
          // Removed document is not in final list
          !finalDocs.some(doc => doc.name === docToRemove.name) &&
          // Other documents are still present
          initialDocs.filter(doc => doc.name !== docToRemove.name)
            .every(doc => finalDocs.some(finalDoc => finalDoc.name === doc.name))
        );
      }
    ), { numRuns: 30 });
  });

  test('Property 6d: Context documents enhance conversation prompts', () => {
    fc.assert(fc.property(
      fc.record({
        documents: fc.array(
          fc.record({
            name: fc.string({ minLength: 5, maxLength: 30 }),
            content: fc.string({ minLength: 50, maxLength: 500 }),
            type: fc.constant('document')
          }),
          { minLength: 1, maxLength: 3 }
        ),
        scenario: fc.string({ minLength: 10, maxLength: 100 }),
        userInput: fc.string({ minLength: 5, maxLength: 200 })
      }),
      ({ documents, scenario, userInput }) => {
        // Add context documents
        geminiService.addContextDocuments(documents);
        
        // Build conversation context
        const context = {
          scenario: scenario,
          aiRole: 'Customer Service Representative',
          userRole: 'Customer',
          contextDocuments: documents,
          conversationHistory: []
        };
        
        // Build prompt (accessing private method for testing)
        const prompt = geminiService._buildConversationPrompt(context, userInput);
        
        // Properties to verify:
        // 1. Prompt includes all document content
        // 2. Document names are referenced
        // 3. Scenario and user input are included
        // 4. Prompt structure is consistent
        
        const includesAllDocuments = documents.every(doc => 
          prompt.includes(doc.name) && prompt.includes(doc.content)
        );
        
        const includesScenario = prompt.includes(scenario);
        const includesUserInput = prompt.includes(userInput);
        const hasStructure = prompt.includes('SCENARIO:') && 
                           prompt.includes('CONTEXT DOCUMENTS:') &&
                           prompt.includes('USER INPUT:');
        
        return (
          includesAllDocuments &&
          includesScenario &&
          includesUserInput &&
          hasStructure &&
          prompt.length > userInput.length + scenario.length
        );
      }
    ), { numRuns: 30 });
  });

  test('Property 6e: Document caching prevents re-processing', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          content: fc.string({ minLength: 10, maxLength: 1000 }),
          uploaded_at: fc.integer({ min: 1000000000000, max: Date.now() })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      async (cachedDocuments) => {
        // Mock database to return cached documents
        databaseService.getAll.mockResolvedValue(cachedDocuments);
        
        // Create new service instance to test loading
        const newService = new GeminiService();
        await newService.initialize();
        
        const loadedDocs = newService.getContextDocuments();
        
        // Properties to verify:
        // 1. All cached documents were loaded
        // 2. Document metadata is preserved
        // 3. Loading doesn't modify content
        
        const allDocsLoaded = cachedDocuments.every(cached => 
          loadedDocs.some(loaded => 
            loaded.name === cached.name &&
            loaded.contentLength === cached.content.length
          )
        );
        
        const correctCount = loadedDocs.length === cachedDocuments.length;
        
        const preservedMetadata = loadedDocs.every(doc => 
          cachedDocuments.some(cached => 
            cached.name === doc.name &&
            cached.uploaded_at === doc.uploadedAt
          )
        );
        
        newService.cleanup();
        
        return allDocsLoaded && correctCount && preservedMetadata;
      }
    ), { numRuns: 30 });
  });
});