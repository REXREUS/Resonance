const fc = require('fast-check');
const { exportGenerator } = require('../exportGenerator');
const { databaseService } = require('../../services/databaseService');
const { TRANSLATIONS } = require('../../constants/languages');

// Mock the database service
jest.mock('../../services/databaseService', () => ({
  databaseService: {
    getSession: jest.fn(),
    getChatLogs: jest.fn(),
    getEmotionalTelemetry: jest.fn(),
    getSessions: jest.fn(),
  },
}));

// Mock expo modules
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(),
}));

/**
 * **Feature: resonance-mobile-app, Property 22: Multi-language export consistency**
 * **Validates: Requirements 9.5, 11.5, 16.3**
 */
describe('Property 22: Multi-language export consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate consistent export data across different languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.integer({ min: 1, max: 1000 }),
          sessionData: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            scenario: fc.string({ minLength: 1, maxLength: 100 }),
            mode: fc.constantFrom('single', 'stress'),
            score: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 60, max: 7200 }),
            pace: fc.integer({ min: 50, max: 300 }),
            filler_word_count: fc.integer({ min: 0, max: 50 }),
            clarity_score: fc.integer({ min: 0, max: 100 }),
            confidence_score: fc.integer({ min: 0, max: 100 }),
            completed: fc.constantFrom(0, 1),
          }),
          chatLogs: fc.array(
            fc.record({
              sender: fc.constantFrom('user', 'ai'),
              text: fc.string({ minLength: 1, maxLength: 200 }),
              timestamp: fc.integer({ min: 0, max: 7200000 }),
              has_hesitation: fc.constantFrom(0, 1),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          emotionalTelemetry: fc.array(
            fc.record({
              timestamp: fc.integer({ min: 0, max: 7200000 }),
              emotion_state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
              intensity: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
        }),
        async ({ sessionId, sessionData, chatLogs, emotionalTelemetry }) => {
          // Mock database responses
          databaseService.getSession.mockResolvedValue(sessionData);
          databaseService.getChatLogs.mockResolvedValue(chatLogs);
          databaseService.getEmotionalTelemetry.mockResolvedValue(emotionalTelemetry);

          // Generate exports in both supported languages
          const exportIndonesian = await exportGenerator.generateSessionAnalytics(sessionId, 'id');
          const exportEnglish = await exportGenerator.generateSessionAnalytics(sessionId, 'en');

          // Verify both exports are generated successfully
          expect(exportIndonesian).toBeDefined();
          expect(exportEnglish).toBeDefined();

          // Verify language fields are set correctly
          expect(exportIndonesian.language).toBe('id');
          expect(exportEnglish.language).toBe('en');

          // Verify translations are included and different
          expect(exportIndonesian.translations).toBe(TRANSLATIONS.id);
          expect(exportEnglish.translations).toBe(TRANSLATIONS.en);
          expect(exportIndonesian.translations).not.toEqual(exportEnglish.translations);

          // Verify core session data is identical across languages
          expect(exportIndonesian.sessionInfo).toEqual(exportEnglish.sessionInfo);
          expect(exportIndonesian.metrics).toEqual(exportEnglish.metrics);
          expect(exportIndonesian.transcript).toEqual(exportEnglish.transcript);
          expect(exportIndonesian.emotionalTelemetry).toEqual(exportEnglish.emotionalTelemetry);

          // Verify data structure consistency
          expect(Object.keys(exportIndonesian)).toEqual(Object.keys(exportEnglish));
          expect(Object.keys(exportIndonesian.sessionInfo)).toEqual(Object.keys(exportEnglish.sessionInfo));
          expect(Object.keys(exportIndonesian.metrics)).toEqual(Object.keys(exportEnglish.metrics));

          // Verify transcript structure is consistent
          expect(exportIndonesian.transcript.length).toBe(exportEnglish.transcript.length);
          exportIndonesian.transcript.forEach((entry, index) => {
            const englishEntry = exportEnglish.transcript[index];
            expect(Object.keys(entry)).toEqual(Object.keys(englishEntry));
            expect(entry.sender).toBe(englishEntry.sender);
            expect(entry.text).toBe(englishEntry.text);
            expect(entry.timestamp).toBe(englishEntry.timestamp);
            expect(entry.hasHesitation).toBe(englishEntry.hasHesitation);
          });

          // Verify emotional telemetry structure is consistent
          expect(exportIndonesian.emotionalTelemetry.length).toBe(exportEnglish.emotionalTelemetry.length);
          exportIndonesian.emotionalTelemetry.forEach((entry, index) => {
            const englishEntry = exportEnglish.emotionalTelemetry[index];
            expect(Object.keys(entry)).toEqual(Object.keys(englishEntry));
            expect(entry.timestamp).toBe(englishEntry.timestamp);
            expect(entry.emotionState).toBe(englishEntry.emotionState);
            expect(entry.intensity).toBe(englishEntry.intensity);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should generate consistent PDF reports across different languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.integer({ min: 1, max: 1000 }),
          sessionData: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            scenario: fc.string({ minLength: 1, maxLength: 100 }),
            mode: fc.constantFrom('single', 'stress'),
            score: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 60, max: 7200 }),
            pace: fc.integer({ min: 50, max: 300 }),
            filler_word_count: fc.integer({ min: 0, max: 50 }),
            clarity_score: fc.integer({ min: 0, max: 100 }),
            confidence_score: fc.integer({ min: 0, max: 100 }),
            completed: fc.constantFrom(0, 1),
          }),
          chatLogs: fc.array(
            fc.record({
              sender: fc.constantFrom('user', 'ai'),
              text: fc.string({ minLength: 1, maxLength: 200 }),
              timestamp: fc.integer({ min: 0, max: 7200000 }),
              has_hesitation: fc.constantFrom(0, 1),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          emotionalTelemetry: fc.array(
            fc.record({
              timestamp: fc.integer({ min: 0, max: 7200000 }),
              emotion_state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
              intensity: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ sessionId, sessionData, chatLogs, emotionalTelemetry }) => {
          // Mock database responses
          databaseService.getSession.mockResolvedValue(sessionData);
          databaseService.getChatLogs.mockResolvedValue(chatLogs);
          databaseService.getEmotionalTelemetry.mockResolvedValue(emotionalTelemetry);

          // Generate PDF reports in both languages
          const pdfIndonesian = await exportGenerator.generatePDFReport(sessionId, 'id');
          const pdfEnglish = await exportGenerator.generatePDFReport(sessionId, 'en');

          // Verify both PDFs are generated successfully
          expect(pdfIndonesian).toBeDefined();
          expect(pdfEnglish).toBeDefined();

          // Verify language is set correctly
          expect(pdfIndonesian.language).toBe('id');
          expect(pdfEnglish.language).toBe('en');

          // Verify PDF structure is consistent
          expect(Object.keys(pdfIndonesian)).toEqual(Object.keys(pdfEnglish));
          expect(pdfIndonesian.sections.length).toBe(pdfEnglish.sections.length);

          // Verify each section has consistent structure
          pdfIndonesian.sections.forEach((section, index) => {
            const englishSection = pdfEnglish.sections[index];
            expect(Object.keys(section)).toEqual(Object.keys(englishSection));
            expect(section.content.length).toBe(englishSection.content.length);
          });

          // Verify titles are different (translated) but structure is same
          expect(pdfIndonesian.title).not.toBe(pdfEnglish.title);
          expect(typeof pdfIndonesian.title).toBe('string');
          expect(typeof pdfEnglish.title).toBe('string');

          // Verify generation timestamps are close (within 1 second)
          expect(Math.abs(pdfIndonesian.generatedAt - pdfEnglish.generatedAt)).toBeLessThan(1000);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should generate consistent CSV exports across different languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            scenario: fc.string({ minLength: 1, maxLength: 100 }),
            mode: fc.constantFrom('single', 'stress'),
            score: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 60, max: 7200 }),
            pace: fc.integer({ min: 50, max: 300 }),
            filler_word_count: fc.integer({ min: 0, max: 50 }),
            clarity_score: fc.integer({ min: 0, max: 100 }),
            confidence_score: fc.integer({ min: 0, max: 100 }),
            completed: fc.constantFrom(0, 1),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sessions) => {
          // Mock database response
          databaseService.getSessions.mockResolvedValue(sessions);

          // Generate CSV exports in both languages
          const csvIndonesian = await exportGenerator.generateCSVExport('id');
          const csvEnglish = await exportGenerator.generateCSVExport('en');

          // Verify both CSVs are generated successfully
          expect(csvIndonesian).toBeDefined();
          expect(csvEnglish).toBeDefined();

          // Verify language is set correctly
          expect(csvIndonesian.language).toBe('id');
          expect(csvEnglish.language).toBe('en');

          // Verify row count is consistent
          expect(csvIndonesian.rowCount).toBe(csvEnglish.rowCount);
          expect(csvIndonesian.rowCount).toBe(sessions.length);

          // Verify header count is consistent
          expect(csvIndonesian.headers.length).toBe(csvEnglish.headers.length);

          // Verify content structure is consistent (same number of lines)
          const indonesianLines = csvIndonesian.content.split('\n');
          const englishLines = csvEnglish.content.split('\n');
          expect(indonesianLines.length).toBe(englishLines.length);
          expect(indonesianLines.length).toBe(sessions.length + 1); // +1 for header

          // Verify each data row has same number of columns (simple check for non-empty lines)
          for (let i = 1; i < indonesianLines.length; i++) {
            if (indonesianLines[i].trim() && englishLines[i].trim()) {
              // For CSV with quoted fields, we need a more sophisticated parser
              // But for this test, we'll verify the basic structure
              const indonesianRow = indonesianLines[i];
              const englishRow = englishLines[i];
              
              // Count commas outside of quotes to determine column count
              const countColumns = (row) => {
                let count = 1;
                let inQuotes = false;
                for (let k = 0; k < row.length; k++) {
                  if (row[k] === '"') inQuotes = !inQuotes;
                  if (row[k] === ',' && !inQuotes) count++;
                }
                return count;
              };

              const indonesianColCount = countColumns(indonesianRow);
              const englishColCount = countColumns(englishRow);
              
              expect(indonesianColCount).toBe(englishColCount);
              expect(indonesianColCount).toBe(csvIndonesian.headers.length);
            }
          }

          // Verify headers are different (translated)
          expect(csvIndonesian.headers).not.toEqual(csvEnglish.headers);
          csvIndonesian.headers.forEach((header, index) => {
            expect(typeof header).toBe('string');
            expect(typeof csvEnglish.headers[index]).toBe('string');
            expect(header.length).toBeGreaterThan(0);
            expect(csvEnglish.headers[index].length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate export consistency using built-in validator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            scenario: fc.string({ minLength: 1, maxLength: 100 }),
            mode: fc.constantFrom('single', 'stress'),
            score: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 60, max: 7200 }),
            pace: fc.integer({ min: 50, max: 300 }),
            filler_word_count: fc.integer({ min: 0, max: 50 }),
            clarity_score: fc.integer({ min: 0, max: 100 }),
            confidence_score: fc.integer({ min: 0, max: 100 }),
            completed: fc.constantFrom(0, 1),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (sessions) => {
          // Mock database responses for each session
          databaseService.getSessions.mockResolvedValue(sessions);
          
          // Mock each session call twice (once for each language export)
          sessions.forEach(session => {
            databaseService.getSession.mockResolvedValue(session);
            databaseService.getChatLogs.mockResolvedValue([]);
            databaseService.getEmotionalTelemetry.mockResolvedValue([]);
          });

          // Generate exports in both languages
          const exportIndonesian = await exportGenerator.exportAllSessionData('id');
          const exportEnglish = await exportGenerator.exportAllSessionData('en');

          // Use built-in validator to check consistency
          const isConsistent = exportGenerator.validateExportConsistency(exportIndonesian, exportEnglish);

          // Verify consistency validation passes
          expect(isConsistent).toBe(true);

          // Verify metadata consistency
          expect(exportIndonesian.metadata.totalSessions).toBe(exportEnglish.metadata.totalSessions);
          expect(exportIndonesian.metadata.totalSessions).toBe(sessions.length);
          expect(exportIndonesian.metadata.appVersion).toBe(exportEnglish.metadata.appVersion);

          // Verify language-specific metadata
          expect(exportIndonesian.metadata.language).toBe('id');
          expect(exportEnglish.metadata.language).toBe('en');
          expect(exportIndonesian.translations).toBe(TRANSLATIONS.id);
          expect(exportEnglish.translations).toBe(TRANSLATIONS.en);

          // Verify export timestamps are close (within 1 second)
          expect(Math.abs(exportIndonesian.metadata.exportDate - exportEnglish.metadata.exportDate)).toBeLessThan(1000);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should reject unsupported languages consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).filter(lang => !['id', 'en'].includes(lang)),
        fc.integer({ min: 1, max: 1000 }),
        async (unsupportedLanguage, sessionId) => {
          // Mock session data
          databaseService.getSession.mockResolvedValue({
            id: sessionId,
            timestamp: Date.now(),
            scenario: 'test',
            mode: 'single',
            score: 85,
            duration: 300,
            completed: 1
          });

          // Verify all export methods reject unsupported languages
          await expect(exportGenerator.generateSessionAnalytics(sessionId, unsupportedLanguage))
            .rejects.toThrow(`Unsupported language: ${unsupportedLanguage}`);

          await expect(exportGenerator.generatePDFReport(sessionId, unsupportedLanguage))
            .rejects.toThrow(`Unsupported language: ${unsupportedLanguage}`);

          await expect(exportGenerator.generateCSVExport(unsupportedLanguage))
            .rejects.toThrow(`Unsupported language: ${unsupportedLanguage}`);

          await expect(exportGenerator.exportAllSessionData(unsupportedLanguage))
            .rejects.toThrow(`Unsupported language: ${unsupportedLanguage}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});