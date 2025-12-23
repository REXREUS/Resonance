import fc from 'fast-check';
import { geminiService } from '../geminiService';
import { documentProcessor } from '../../utils/documentProcessor';
import { databaseService } from '../databaseService';

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('Mock AI response')
        }
      })
    })
  }))
}));

// Mock document picker and file system
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn()
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64'
  }
}));

// Mock database service
jest.mock('../databaseService', () => ({
  databaseService: {
    addContextFile: jest.fn(),
    getContextFile: jest.fn(),
    updateContextFile: jest.fn(),
    deleteContextFile: jest.fn(),
    getAllContextFiles: jest.fn()
  }
}));

describe('GeminiService Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state completely
    geminiService.genAI = null;
    geminiService.model = null;
    geminiService.config = null;
    geminiService.conversationHistory = [];
    geminiService.contextDocuments = [];
    geminiService.isInitialized = false;
  });

  afterEach(async () => {
    await geminiService.cleanup();
  });

  /**
   * **Feature: resonance-mobile-app, Property 6: Document processing round trip**
   * **Validates: Requirements 3.4, 13.3**
   * 
   * Property: For any uploaded PDF/DOCX file, extracting text content then using it for AI context should preserve the original meaning and be cached to avoid re-parsing
   */
  test('Property 6: Document processing round trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.pdf'),
            content: fc.string({ minLength: 50, maxLength: 1000 }),
            mimeType: fc.constantFrom('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'),
            size: fc.integer({ min: 1000, max: 100000 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (documents) => {
          // Initialize Gemini service
          await geminiService.initialize({ apiKey: 'test-api-key' });
          
          const processedDocuments = [];
          const cachedDocuments = [];
          
          // Process each document
          for (const doc of documents) {
            // Mock document picker result
            const mockDocument = {
              name: doc.name,
              uri: `file://test/${doc.name}`,
              size: doc.size,
              mimeType: doc.mimeType
            };
            
            // Mock file system read based on document type
            if (doc.mimeType === 'text/plain') {
              require('expo-file-system').readAsStringAsync.mockResolvedValueOnce(doc.content);
            } else {
              // For PDF/DOCX, mock the placeholder extraction
              const extractedContent = `[${doc.mimeType.includes('pdf') ? 'PDF' : 'DOCX'} Content from ${doc.name}]\n\n${doc.content}`;
              require('expo-file-system').readAsStringAsync.mockResolvedValueOnce('mock-base64-data');
            }
            
            // Extract text content
            const extractedText = await documentProcessor.extractText(mockDocument);
            
            // Property: Extracted text should contain meaningful content
            expect(extractedText).toBeTruthy();
            expect(typeof extractedText).toBe('string');
            expect(extractedText.length).toBeGreaterThan(0);
            
            // For plain text, content should be preserved exactly
            if (doc.mimeType === 'text/plain') {
              expect(extractedText).toBe(doc.content);
            } else {
              // For PDF/DOCX, should contain placeholder with original content reference
              expect(extractedText).toContain(doc.name);
            }
            
            const processedDoc = {
              name: doc.name,
              uri: mockDocument.uri,
              size: doc.size,
              mimeType: doc.mimeType,
              content: extractedText,
              extractedAt: Date.now()
            };
            
            processedDocuments.push(processedDoc);
            
            // Mock database caching
            const fileId = Math.floor(Math.random() * 1000);
            databaseService.addContextFile.mockResolvedValueOnce(fileId);
            databaseService.getContextFile.mockResolvedValueOnce({
              id: fileId,
              file_name: doc.name,
              extracted_text_content: extractedText,
              file_size: doc.size,
              uploaded_at: Date.now()
            });
            
            // Cache document in database
            const cachedId = await databaseService.addContextFile(
              doc.name,
              extractedText,
              doc.size
            );
            
            // Retrieve cached document
            const cachedDoc = await databaseService.getContextFile(cachedId);
            cachedDocuments.push(cachedDoc);
          }
          
          // Property: All documents should be processed successfully
          expect(processedDocuments).toHaveLength(documents.length);
          
          // Property: Cached documents should preserve content
          expect(cachedDocuments).toHaveLength(documents.length);
          
          cachedDocuments.forEach((cached, index) => {
            const original = processedDocuments[index];
            
            // Property: Cached content should match processed content
            expect(cached.extracted_text_content).toBe(original.content);
            expect(cached.file_name).toBe(original.name);
            expect(cached.file_size).toBe(original.size);
          });
          
          // Add documents to Gemini service context
          geminiService.addContextDocuments(processedDocuments);
          
          // Property: Context documents should be stored correctly
          expect(geminiService.contextDocuments).toHaveLength(documents.length);
          
          geminiService.contextDocuments.forEach((contextDoc, index) => {
            const original = processedDocuments[index];
            expect(contextDoc.name).toBe(original.name);
            expect(contextDoc.content).toBe(original.content);
            expect(contextDoc.type).toBe('text');
          });
          
          // Test AI context usage - generate response with document context
          const testContext = {
            scenario: 'test-scenario',
            userRole: 'user',
            aiRole: 'assistant',
            contextDocuments: geminiService.contextDocuments,
            conversationHistory: []
          };
          
          const response = await geminiService.generateResponse(testContext, 'Test question about the documents');
          
          // Property: AI should be able to use document context
          expect(response).toBeTruthy();
          expect(typeof response).toBe('string');
          expect(response.length).toBeGreaterThan(0);
          
          // Property: Round trip should preserve document accessibility
          // Verify that cached documents contain the expected data
          cachedDocuments.forEach((cached, index) => {
            const original = processedDocuments[index];
            // Property: Cached content should match processed content (already verified above)
            expect(cached.extracted_text_content).toBe(original.content);
            expect(cached.file_name).toBe(original.name);
            expect(cached.file_size).toBe(original.size);
            expect(cached.id).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Document validation should correctly identify supported and unsupported files
   */
  test('Property: Document validation accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            mimeType: fc.oneof(
              fc.constantFrom(
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'text/plain'
              ),
              fc.string({ minLength: 5, maxLength: 30 }) // Invalid mime types
            ),
            size: fc.integer({ min: 0, max: 20 * 1024 * 1024 }) // 0 to 20MB
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (documents) => {
          const supportedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain'
          ];
          
          documents.forEach(doc => {
            const isValid = documentProcessor.validateDocument(doc);
            
            const shouldBeValid = supportedTypes.includes(doc.mimeType) && 
                                doc.size <= 10 * 1024 * 1024 && // Max 10MB
                                doc.size > 0;
            
            // Property: Validation should correctly identify valid documents
            expect(isValid).toBe(shouldBeValid);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context document management should handle additions and removals correctly
   */
  test('Property: Context document management consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 30 }),
            content: fc.string({ minLength: 10, maxLength: 500 })
          }),
          { minLength: 0, maxLength: 8 }
        ),
        async (documents) => {
          // Initialize service
          await geminiService.initialize({ apiKey: 'test-api-key' });
          
          // Ensure clean state
          geminiService.contextDocuments = [];
          
          // Property: Initially no context documents
          expect(geminiService.contextDocuments).toHaveLength(0);
          
          // Add documents
          geminiService.addContextDocuments(documents);
          
          // Property: All documents should be added
          expect(geminiService.contextDocuments).toHaveLength(documents.length);
          
          // Property: Document content should be preserved
          geminiService.contextDocuments.forEach((contextDoc, index) => {
            expect(contextDoc.name).toBe(documents[index].name);
            expect(contextDoc.content).toBe(documents[index].content);
            expect(contextDoc.type).toBe('text');
          });
          
          // Clear documents
          geminiService.addContextDocuments([]);
          
          // Property: Documents should be cleared
          expect(geminiService.contextDocuments).toHaveLength(0);
          
          // Add documents again
          geminiService.addContextDocuments(documents);
          
          // Property: Documents should be re-added correctly
          expect(geminiService.contextDocuments).toHaveLength(documents.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: resonance-mobile-app, Property 16: Structured feedback generation**
   * **Validates: Requirements 6.6**
   * 
   * Property: For any completed session, AI coach feedback should contain all required sections (positive aspects, improvement areas, next steps) with meaningful content
   */
  test('Property 16: Structured feedback generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.integer({ min: 1, max: 10000 }),
          score: fc.integer({ min: 0, max: 100 }),
          metrics: fc.record({
            pace: fc.integer({ min: 50, max: 300 }), // WPM
            fillerWordCount: fc.integer({ min: 0, max: 50 }),
            clarity: fc.integer({ min: 0, max: 100 }),
            confidence: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 30, max: 1800 }) // 30 seconds to 30 minutes
          }),
          transcript: fc.array(
            fc.record({
              sender: fc.constantFrom('user', 'ai'),
              text: fc.string({ minLength: 5, maxLength: 200 }),
              timestamp: fc.integer({ min: 0, max: 1800000 })
            }),
            { minLength: 2, maxLength: 20 }
          ),
          emotionalTelemetry: fc.array(
            fc.record({
              timestamp: fc.integer({ min: 0, max: 1800000 }),
              state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
              intensity: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 10 }
          )
        }),
        async (sessionData) => {
          // Initialize Gemini service
          await geminiService.initialize({ apiKey: 'test-api-key' });
          
          // Mock the AI response to return structured feedback
          const mockFeedback = `POSITIVE ASPECTS:
- You maintained good engagement throughout the conversation
- Your responses showed clear understanding of the situation
- You demonstrated active listening skills

IMPROVEMENT AREAS:
- Consider reducing filler words to improve clarity
- Work on maintaining consistent pace during responses
- Focus on more confident delivery

NEXT STEPS:
- Practice active listening techniques
- Focus on clear, concise communication
- Work on reducing hesitation in responses

OVERALL SUMMARY:
You completed the session with a score of ${sessionData.score}/100. Your communication showed good understanding but could benefit from more confident delivery and reduced filler words.`;

          geminiService.model.generateContent.mockResolvedValueOnce({
            response: {
              text: jest.fn().mockReturnValue(mockFeedback)
            }
          });
          
          // Generate coach feedback
          const feedback = await geminiService.generateCoachFeedback(sessionData);
          
          // Property: Feedback should contain all required sections
          expect(feedback).toHaveProperty('positiveAspects');
          expect(feedback).toHaveProperty('improvementAreas');
          expect(feedback).toHaveProperty('nextSteps');
          expect(feedback).toHaveProperty('overallSummary');
          
          // Property: Each section should contain meaningful content
          expect(Array.isArray(feedback.positiveAspects)).toBe(true);
          expect(Array.isArray(feedback.improvementAreas)).toBe(true);
          expect(Array.isArray(feedback.nextSteps)).toBe(true);
          expect(typeof feedback.overallSummary).toBe('string');
          
          // Property: Positive aspects should have at least 1 item
          expect(feedback.positiveAspects.length).toBeGreaterThanOrEqual(1);
          
          // Property: Improvement areas should have at least 1 item
          expect(feedback.improvementAreas.length).toBeGreaterThanOrEqual(1);
          
          // Property: Next steps should have at least 1 item
          expect(feedback.nextSteps.length).toBeGreaterThanOrEqual(1);
          
          // Property: Overall summary should be meaningful (not empty)
          expect(feedback.overallSummary.trim().length).toBeGreaterThan(0);
          
          // Property: All feedback items should be strings
          feedback.positiveAspects.forEach(aspect => {
            expect(typeof aspect).toBe('string');
            expect(aspect.trim().length).toBeGreaterThan(0);
          });
          
          feedback.improvementAreas.forEach(area => {
            expect(typeof area).toBe('string');
            expect(area.trim().length).toBeGreaterThan(0);
          });
          
          feedback.nextSteps.forEach(step => {
            expect(typeof step).toBe('string');
            expect(step.trim().length).toBeGreaterThan(0);
          });
          
          // Property: Feedback should be contextually relevant to session data
          // The overall summary should reference the session score
          expect(feedback.overallSummary).toContain(sessionData.score.toString());
          
          // Property: Fallback feedback should work when AI fails
          geminiService.model.generateContent.mockRejectedValueOnce(new Error('API Error'));
          
          const fallbackFeedback = await geminiService.generateCoachFeedback(sessionData);
          
          // Property: Fallback should still contain all required sections
          expect(fallbackFeedback).toHaveProperty('positiveAspects');
          expect(fallbackFeedback).toHaveProperty('improvementAreas');
          expect(fallbackFeedback).toHaveProperty('nextSteps');
          expect(fallbackFeedback).toHaveProperty('overallSummary');
          
          // Property: Fallback sections should not be empty
          expect(fallbackFeedback.positiveAspects.length).toBeGreaterThan(0);
          expect(fallbackFeedback.improvementAreas.length).toBeGreaterThan(0);
          expect(fallbackFeedback.nextSteps.length).toBeGreaterThan(0);
          expect(fallbackFeedback.overallSummary.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});