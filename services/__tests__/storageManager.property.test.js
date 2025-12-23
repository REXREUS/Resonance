const fc = require('fast-check');
const { storageManager } = require('../storageManager');
const { databaseService } = require('../databaseService');

// Mock the database service
jest.mock('../databaseService', () => ({
  databaseService: {
    getDatabaseSize: jest.fn(),
    getSessions: jest.fn(),
    getContextFiles: jest.fn(),
    getVoiceAssets: jest.fn(),
    getQuotaUsage: jest.fn(),
    deleteSession: jest.fn(),
    deleteContextFile: jest.fn(),
    clearOldQuotaUsage: jest.fn(),
  },
}));

// Mock expo modules
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

const FileSystem = require('expo-file-system');

/**
 * **Feature: resonance-mobile-app, Property 31: Storage management accuracy**
 * **Validates: Requirements 16.4**
 */
describe('Property 31: Storage management accuracy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Reset any method mocks on storageManager
    if (storageManager.getDirectorySize && storageManager.getDirectorySize.mockRestore) {
      storageManager.getDirectorySize.mockRestore();
    }
    if (storageManager.getTotalStorageUsage && storageManager.getTotalStorageUsage.mockRestore) {
      storageManager.getTotalStorageUsage.mockRestore();
    }
    if (storageManager.getStorageStats && storageManager.getStorageStats.mockRestore) {
      storageManager.getStorageStats.mockRestore();
    }
    if (storageManager.getStorageBreakdown && storageManager.getStorageBreakdown.mockRestore) {
      storageManager.getStorageBreakdown.mockRestore();
    }
    
    // Default mock implementations
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024, isDirectory: false });
    FileSystem.readDirectoryAsync.mockResolvedValue([]);
    FileSystem.deleteAsync.mockResolvedValue();
  });

  test('should calculate storage usage accurately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          databaseSize: fc.integer({ min: 0, max: 100000000 }),
          documentFiles: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              size: fc.integer({ min: 0, max: 10000000 }),
              isDirectory: fc.boolean(),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          cacheFiles: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              size: fc.integer({ min: 0, max: 5000000 }),
              isDirectory: fc.boolean(),
            }),
            { minLength: 0, maxLength: 10 }
          ),
        }),
        async ({ databaseSize, documentFiles, cacheFiles }) => {
          // Mock database size
          databaseService.getDatabaseSize.mockResolvedValue(databaseSize);

          // Calculate expected sizes
          const expectedDocumentsSize = documentFiles
            .filter(f => !f.isDirectory)
            .reduce((sum, f) => sum + f.size, 0);
          
          const expectedCacheSize = cacheFiles
            .filter(f => !f.isDirectory)
            .reduce((sum, f) => sum + f.size, 0);

          // Mock getDirectorySize method directly to avoid complex FileSystem mocking
          storageManager.getDirectorySize = jest.fn()
            .mockResolvedValueOnce(expectedDocumentsSize) // documents directory
            .mockResolvedValueOnce(expectedCacheSize); // cache directory

          // Execute storage usage calculation
          const usage = await storageManager.getTotalStorageUsage();

          // Verify usage structure
          expect(typeof usage).toBe('object');
          expect(typeof usage.database).toBe('number');
          expect(typeof usage.documents).toBe('number');
          expect(typeof usage.cache).toBe('number');
          expect(typeof usage.total).toBe('number');

          // Verify database size accuracy
          expect(usage.database).toBe(databaseSize);

          // Verify total calculation accuracy
          expect(usage.total).toBe(usage.database + usage.documents + usage.cache);

          // Verify non-negative values
          expect(usage.database).toBeGreaterThanOrEqual(0);
          expect(usage.documents).toBeGreaterThanOrEqual(0);
          expect(usage.cache).toBeGreaterThanOrEqual(0);
          expect(usage.total).toBeGreaterThanOrEqual(0);

          // Verify documents and cache size calculations
          expect(usage.documents).toBe(expectedDocumentsSize);
          expect(usage.cache).toBe(expectedCacheSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should provide accurate storage statistics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          databaseSize: fc.integer({ min: 0, max: 50000000 }),
          sessions: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          documents: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              file_size: fc.integer({ min: 0, max: 10000000 }),
            }),
            { minLength: 0, maxLength: 30 }
          ),
          voiceAssets: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              voice_id: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
        }),
        async ({ databaseSize, sessions, documents, voiceAssets }) => {
          // Mock database responses
          databaseService.getDatabaseSize.mockResolvedValue(databaseSize);
          databaseService.getSessions.mockResolvedValue(sessions);
          databaseService.getContextFiles.mockResolvedValue(documents);
          databaseService.getVoiceAssets.mockResolvedValue(voiceAssets);

          // Mock getTotalStorageUsage method
          const mockUsage = {
            database: databaseSize,
            documents: 0,
            cache: 0,
            total: databaseSize
          };
          storageManager.getTotalStorageUsage = jest.fn().mockResolvedValue(mockUsage);

          // Execute storage statistics calculation
          const stats = await storageManager.getStorageStats();

          // Verify statistics structure
          expect(typeof stats).toBe('object');
          expect(typeof stats.usage).toBe('object');
          expect(typeof stats.counts).toBe('object');
          expect(typeof stats.breakdown).toBe('object');

          // Verify usage structure
          expect(typeof stats.usage.database).toBe('number');
          expect(typeof stats.usage.documents).toBe('number');
          expect(typeof stats.usage.cache).toBe('number');
          expect(typeof stats.usage.total).toBe('number');

          // Verify counts accuracy
          expect(stats.counts.sessions).toBe(sessions.length);
          expect(stats.counts.documents).toBe(documents.length);
          expect(stats.counts.voiceAssets).toBe(voiceAssets.length);

          // Verify breakdown calculations
          if (sessions.length > 0) {
            expect(stats.breakdown.avgSessionSize).toBe(Math.round(stats.usage.database / sessions.length));
          } else {
            expect(stats.breakdown.avgSessionSize).toBe(0);
          }

          if (documents.length > 0) {
            expect(stats.breakdown.avgDocumentSize).toBe(Math.round(stats.usage.documents / documents.length));
          } else {
            expect(stats.breakdown.avgDocumentSize).toBe(0);
          }

          // Verify all counts are non-negative
          expect(stats.counts.sessions).toBeGreaterThanOrEqual(0);
          expect(stats.counts.documents).toBeGreaterThanOrEqual(0);
          expect(stats.counts.voiceAssets).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate cleanup options correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          olderThanDays: fc.option(fc.integer({ min: -10, max: 400 })),
          keepRecentSessions: fc.option(fc.integer({ min: -5, max: 1100 })),
          clearCache: fc.option(fc.oneof(fc.boolean(), fc.string(), fc.integer())),
        }),
        async ({ olderThanDays, keepRecentSessions, clearCache }) => {
          const options = {};
          if (olderThanDays !== null) options.olderThanDays = olderThanDays;
          if (keepRecentSessions !== null) options.keepRecentSessions = keepRecentSessions;
          if (clearCache !== null) options.clearCache = clearCache;

          let shouldThrow = false;
          let expectedError = '';

          // Determine if validation should throw
          if (olderThanDays !== null && (typeof olderThanDays !== 'number' || olderThanDays < 1 || olderThanDays > 365)) {
            shouldThrow = true;
            expectedError = 'olderThanDays must be a number between 1 and 365';
          } else if (keepRecentSessions !== null && (typeof keepRecentSessions !== 'number' || keepRecentSessions < 0 || keepRecentSessions > 1000)) {
            shouldThrow = true;
            expectedError = 'keepRecentSessions must be a number between 0 and 1000';
          } else if (clearCache !== null && typeof clearCache !== 'boolean') {
            shouldThrow = true;
            expectedError = 'clearCache must be a boolean';
          }

          // Test validation
          if (shouldThrow) {
            expect(() => {
              storageManager.validateCleanupOptions(options);
            }).toThrow(expectedError);
          } else {
            const result = storageManager.validateCleanupOptions(options);
            
            // Verify result structure and defaults
            expect(typeof result).toBe('object');
            expect(typeof result.olderThanDays).toBe('number');
            expect(typeof result.keepRecentSessions).toBe('number');
            expect(typeof result.clearCache).toBe('boolean');

            // Verify valid ranges
            expect(result.olderThanDays).toBeGreaterThanOrEqual(1);
            expect(result.olderThanDays).toBeLessThanOrEqual(365);
            expect(result.keepRecentSessions).toBeGreaterThanOrEqual(0);
            expect(result.keepRecentSessions).toBeLessThanOrEqual(1000);

            // Verify provided values are used or defaults are applied
            if (olderThanDays !== null) {
              expect(result.olderThanDays).toBe(olderThanDays);
            } else {
              expect(result.olderThanDays).toBe(30); // Default
            }

            if (keepRecentSessions !== null) {
              expect(result.keepRecentSessions).toBe(keepRecentSessions);
            } else {
              expect(result.keepRecentSessions).toBe(10); // Default
            }

            if (clearCache !== null && typeof clearCache === 'boolean') {
              expect(result.clearCache).toBe(clearCache);
            } else {
              expect(result.clearCache).toBe(true); // Default
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should estimate cleanup impact accurately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          olderThanDays: fc.integer({ min: 1, max: 365 }),
          keepRecentSessions: fc.integer({ min: 0, max: 50 }),
          clearCache: fc.boolean(),
          sessions: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
            }),
            { minLength: 0, maxLength: 100 }
          ),
          documents: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              uploaded_at: fc.integer({ min: 1000000000000, max: Date.now() }),
              file_size: fc.integer({ min: 0, max: 10000000 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          cacheSize: fc.integer({ min: 0, max: 50000000 }),
        }),
        async ({ olderThanDays, keepRecentSessions, clearCache, sessions, documents, cacheSize }) => {
          const options = { olderThanDays, keepRecentSessions, clearCache };
          const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

          // Mock database responses
          databaseService.getSessions.mockResolvedValue(sessions);
          databaseService.getContextFiles.mockResolvedValue(documents);

          // Mock cache directory size calculation
          storageManager.getDirectorySize = jest.fn().mockResolvedValue(cacheSize);

          // Execute cleanup impact estimation
          const estimate = await storageManager.estimateCleanupImpact(options);

          // Verify estimate structure
          expect(typeof estimate).toBe('object');
          expect(typeof estimate.sessionsToDelete).toBe('number');
          expect(typeof estimate.documentsToDelete).toBe('number');
          expect(typeof estimate.estimatedSpaceSaved).toBe('number');
          expect(typeof estimate.cacheToDelete).toBe('number');

          // Calculate expected values
          const oldSessions = sessions
            .filter(session => session.timestamp < cutoffDate)
            .slice(keepRecentSessions);

          const oldDocuments = documents.filter(doc => doc.uploaded_at < cutoffDate);
          const documentsSize = oldDocuments.reduce((sum, doc) => sum + (doc.file_size || 0), 0);

          // Verify accuracy of estimates
          expect(estimate.sessionsToDelete).toBe(oldSessions.length);
          expect(estimate.documentsToDelete).toBe(oldDocuments.length);
          expect(estimate.cacheToDelete).toBe(clearCache ? cacheSize : 0);
          expect(estimate.estimatedSpaceSaved).toBe(documentsSize + (clearCache ? cacheSize : 0));

          // Verify non-negative values
          expect(estimate.sessionsToDelete).toBeGreaterThanOrEqual(0);
          expect(estimate.documentsToDelete).toBeGreaterThanOrEqual(0);
          expect(estimate.estimatedSpaceSaved).toBeGreaterThanOrEqual(0);
          expect(estimate.cacheToDelete).toBeGreaterThanOrEqual(0);

          // Verify logical constraints
          expect(estimate.sessionsToDelete).toBeLessThanOrEqual(sessions.length);
          expect(estimate.documentsToDelete).toBeLessThanOrEqual(documents.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should format storage sizes correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000000000000 }), // Up to 1TB
        async (bytes) => {
          const formatted = storageManager.formatStorageSize(bytes);

          // Verify format structure
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);

          // Verify format pattern (number + space + unit)
          const pattern = /^(\d+\.?\d*)\s+(B|KB|MB|GB)$/;
          expect(pattern.test(formatted)).toBe(true);

          // Verify specific cases
          if (bytes === 0) {
            expect(formatted).toBe('0 B');
          } else {
            // Extract number and unit
            const match = formatted.match(pattern);
            const number = parseFloat(match[1]);
            const unit = match[2];

            // Verify number is reasonable (between 0 and 1024 for non-B units)
            if (unit !== 'B') {
              expect(number).toBeGreaterThan(0);
              expect(number).toBeLessThan(1024);
            }

            // Verify unit progression
            const units = ['B', 'KB', 'MB', 'GB'];
            expect(units).toContain(unit);

            // Verify the conversion is approximately correct
            const unitIndex = units.indexOf(unit);
            const expectedBytes = number * Math.pow(1024, unitIndex);
            const tolerance = Math.pow(1024, unitIndex) * 0.1; // 10% tolerance for rounding
            expect(Math.abs(expectedBytes - bytes)).toBeLessThanOrEqual(tolerance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should provide accurate cleanup recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          totalStorage: fc.integer({ min: 0, max: 200000000 }), // Up to 200MB
          sessionCount: fc.integer({ min: 0, max: 200 }),
          documentCount: fc.integer({ min: 0, max: 100 }),
        }),
        async ({ totalStorage, sessionCount, documentCount }) => {
          // Mock storage stats
          const mockStats = {
            usage: { total: totalStorage },
            counts: { sessions: sessionCount, documents: documentCount }
          };
          storageManager.getStorageStats = jest.fn().mockResolvedValue(mockStats);

          // Mock storage breakdown
          const mockBreakdown = {
            sessions: { count: sessionCount },
            documents: { count: documentCount }
          };
          storageManager.getStorageBreakdown = jest.fn().mockResolvedValue(mockBreakdown);

          // Execute cleanup recommendation check
          const recommendation = await storageManager.isCleanupRecommended();

          // Verify recommendation structure
          expect(typeof recommendation).toBe('object');
          expect(typeof recommendation.recommended).toBe('boolean');
          expect(Array.isArray(recommendation.reasons)).toBe(true);

          // Verify recommendation logic
          let shouldRecommend = false;
          const expectedReasons = [];

          if (totalStorage > 100 * 1024 * 1024) { // 100MB
            shouldRecommend = true;
            expectedReasons.push('Total storage exceeds 100MB');
          }

          if (sessionCount > 100) {
            shouldRecommend = true;
            expectedReasons.push('More than 100 sessions stored');
          }

          if (documentCount > 50) {
            shouldRecommend = true;
            expectedReasons.push('More than 50 documents stored');
          }

          expect(recommendation.recommended).toBe(shouldRecommend);
          expect(recommendation.reasons).toEqual(expectedReasons);

          // Verify reasons are strings
          recommendation.reasons.forEach(reason => {
            expect(typeof reason).toBe('string');
            expect(reason.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle storage breakdown calculations accurately', async () => {
    // Test with empty arrays first
    const emptyTestData = {
      sessions: [],
      documents: [],
      voiceAssets: [],
      quotaUsage: []
    };

    // Mock database responses
    databaseService.getSessions.mockResolvedValue(emptyTestData.sessions);
    databaseService.getContextFiles.mockResolvedValue(emptyTestData.documents);
    databaseService.getVoiceAssets.mockResolvedValue(emptyTestData.voiceAssets);
    databaseService.getQuotaUsage.mockResolvedValue(emptyTestData.quotaUsage);

    // Execute storage breakdown calculation
    const breakdown = await storageManager.getStorageBreakdown();

    // Debug: Check if method exists
    expect(typeof storageManager.getStorageBreakdown).toBe('function');
    
    // Verify breakdown exists and is an object
    expect(breakdown).toBeDefined();
    expect(breakdown).not.toBeNull();
    expect(typeof breakdown).toBe('object');

    // Verify structure exists
    expect(breakdown.sessions).toBeDefined();
    expect(breakdown.documents).toBeDefined();
    expect(breakdown.voiceAssets).toBeDefined();
    expect(breakdown.quotaUsage).toBeDefined();

    // Verify counts are zero for empty arrays
    expect(breakdown.sessions.count).toBe(0);
    expect(breakdown.documents.count).toBe(0);
    expect(breakdown.voiceAssets.count).toBe(0);
    expect(breakdown.quotaUsage.count).toBe(0);

    // Now test with property-based testing for non-empty cases
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessions: fc.array(
            fc.record({ id: fc.integer({ min: 1, max: 1000 }) }),
            { minLength: 1, maxLength: 5 }
          ),
          documents: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 1000 }),
              file_size: fc.integer({ min: 0, max: 100000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          voiceAssets: fc.array(
            fc.record({ id: fc.integer({ min: 1, max: 1000 }) }),
            { minLength: 1, maxLength: 5 }
          ),
          quotaUsage: fc.array(
            fc.record({ id: fc.integer({ min: 1, max: 1000 }) }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ sessions, documents, voiceAssets, quotaUsage }) => {
          // Mock database responses
          databaseService.getSessions.mockResolvedValue(sessions);
          databaseService.getContextFiles.mockResolvedValue(documents);
          databaseService.getVoiceAssets.mockResolvedValue(voiceAssets);
          databaseService.getQuotaUsage.mockResolvedValue(quotaUsage);

          // Execute storage breakdown calculation
          const breakdown = await storageManager.getStorageBreakdown();

          // Verify breakdown structure and calculations
          expect(breakdown.sessions.count).toBe(sessions.length);
          expect(breakdown.documents.count).toBe(documents.length);
          expect(breakdown.voiceAssets.count).toBe(voiceAssets.length);
          expect(breakdown.quotaUsage.count).toBe(quotaUsage.length);

          expect(breakdown.sessions.estimatedSize).toBe(sessions.length * 1024);
          expect(breakdown.voiceAssets.estimatedSize).toBe(voiceAssets.length * 512);
          expect(breakdown.quotaUsage.estimatedSize).toBe(quotaUsage.length * 128);

          const expectedDocumentsSize = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
          expect(breakdown.documents.totalSize).toBe(expectedDocumentsSize);
        }
      ),
      { numRuns: 20 }
    );
  });
});