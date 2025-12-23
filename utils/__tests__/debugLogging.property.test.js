/**
 * Property-based tests for Debug Logging Completeness
 * **Feature: resonance-mobile-app, Property 28: Debug logging completeness**
 * **Validates: Requirements 12.2**
 */

import fc from 'fast-check';
import { debugService, DebugService } from '../../services/debugService';
import { databaseService } from '../../services/databaseService';

// Mock dependencies
jest.mock('../../services/databaseService');

describe('Debug Logging Completeness Property Tests', () => {
  let testDebugService;

  beforeEach(() => {
    testDebugService = new DebugService();
    jest.clearAllMocks();
    
    // Setup database mocks
    databaseService.execute = jest.fn().mockResolvedValue();
    databaseService.get = jest.fn().mockResolvedValue(null);
    databaseService.getAll = jest.fn().mockResolvedValue([]);
  });

  /**
   * Property 28: Debug logging completeness
   * For any system operation with debug mode enabled, relevant log entries 
   * should be generated and displayed
   */
  describe('Property 28: Debug logging completeness', () => {
    test('should generate log entries for all system operations when debug mode is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
            categories: fc.array(
              fc.constantFrom('system', 'user', 'audio', 'network', 'database', 'ai'),
              { minLength: 1, maxLength: 6 }
            ),
            operations: fc.array(
              fc.record({
                category: fc.constantFrom('system', 'user', 'audio', 'network', 'database', 'ai'),
                level: fc.constantFrom('debug', 'info', 'warn', 'error'),
                message: fc.string({ minLength: 5, maxLength: 100 }),
                data: fc.option(fc.object(), { nil: null })
              }),
              { minLength: 1, maxLength: 20 }
            )
          }),
          async (config) => {
            // Initialize debug service with test configuration
            await testDebugService.initialize({
              enabled: true,
              logLevel: config.logLevel,
              categories: config.categories,
              maxBufferSize: 1000
            });

            // Clear any existing logs
            testDebugService.logBuffer = [];

            // Perform operations and log them
            const expectedLogs = [];
            for (const operation of config.operations) {
              testDebugService.log(
                operation.category,
                operation.level,
                operation.message,
                operation.data
              );

              // Check if this operation should be logged based on configuration
              const shouldLog = testDebugService._shouldLog(operation.category, operation.level);
              if (shouldLog) {
                expectedLogs.push({
                  category: operation.category,
                  level: operation.level,
                  message: operation.message,
                  data: operation.data
                });
              }
            }

            // Verify all expected logs are present
            const actualLogs = testDebugService.getRecentLogs();
            expect(actualLogs).toHaveLength(expectedLogs.length);

            // Verify each expected log is present with correct properties
            expectedLogs.forEach((expectedLog, index) => {
              const actualLog = actualLogs.find(log => 
                log.category === expectedLog.category &&
                log.level === expectedLog.level &&
                log.message === expectedLog.message
              );

              expect(actualLog).toBeDefined();
              expect(actualLog.timestamp).toBeDefined();
              expect(actualLog.sessionId).toBeDefined();
              
              if (expectedLog.data) {
                expect(actualLog.data).toBe(JSON.stringify(expectedLog.data));
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should respect log level filtering correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            configuredLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
            testMessages: fc.array(
              fc.record({
                level: fc.constantFrom('debug', 'info', 'warn', 'error'),
                message: fc.string({ minLength: 1, maxLength: 50 })
              }),
              { minLength: 5, maxLength: 15 }
            )
          }),
          async (config) => {
            await testDebugService.initialize({
              enabled: true,
              logLevel: config.configuredLevel,
              categories: ['all']
            });

            testDebugService.logBuffer = [];

            // Log all test messages
            config.testMessages.forEach(msg => {
              testDebugService.log('test', msg.level, msg.message);
            });

            const actualLogs = testDebugService.getRecentLogs();

            // Define level hierarchy
            const levelHierarchy = { debug: 0, info: 1, warn: 2, error: 3 };
            const configuredLevelIndex = levelHierarchy[config.configuredLevel];

            // Count expected logs (only those at or above configured level)
            const expectedLogCount = config.testMessages.filter(msg => 
              levelHierarchy[msg.level] >= configuredLevelIndex
            ).length;

            expect(actualLogs).toHaveLength(expectedLogCount);

            // Verify all logged messages meet the level requirement
            actualLogs.forEach(log => {
              expect(levelHierarchy[log.level]).toBeGreaterThanOrEqual(configuredLevelIndex);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should respect category filtering correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enabledCategories: fc.array(
              fc.constantFrom('system', 'user', 'audio', 'network', 'database'),
              { minLength: 1, maxLength: 5 }
            ),
            testMessages: fc.array(
              fc.record({
                category: fc.constantFrom('system', 'user', 'audio', 'network', 'database', 'other'),
                message: fc.string({ minLength: 1, maxLength: 50 })
              }),
              { minLength: 5, maxLength: 15 }
            )
          }),
          async (config) => {
            await testDebugService.initialize({
              enabled: true,
              logLevel: 'debug',
              categories: config.enabledCategories
            });

            testDebugService.logBuffer = [];

            // Log all test messages
            config.testMessages.forEach(msg => {
              testDebugService.log(msg.category, 'info', msg.message);
            });

            const actualLogs = testDebugService.getRecentLogs();

            // Count expected logs (only enabled categories)
            const expectedLogCount = config.testMessages.filter(msg => 
              config.enabledCategories.includes(msg.category)
            ).length;

            expect(actualLogs).toHaveLength(expectedLogCount);

            // Verify all logged messages are from enabled categories
            actualLogs.forEach(log => {
              expect(config.enabledCategories).toContain(log.category);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle error logging with complete stack traces and context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            errors: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 30 }),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                code: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                context: fc.option(fc.object())
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          async (config) => {
            await testDebugService.initialize({
              enabled: true,
              logLevel: 'debug',
              categories: ['all']
            });

            testDebugService.logBuffer = [];

            // Log all errors
            config.errors.forEach(errorData => {
              const error = new Error(errorData.message);
              error.name = errorData.name;
              if (errorData.code) {
                error.code = errorData.code;
              }

              testDebugService.logError(error, 'error', errorData.context);
            });

            const actualLogs = testDebugService.getRecentLogs();
            expect(actualLogs).toHaveLength(config.errors.length);

            // Verify error logs contain complete information
            actualLogs.forEach((log, index) => {
              const expectedError = config.errors[index];
              
              expect(log.level).toBe('error');
              expect(log.category).toBe('error');
              expect(log.message).toContain(expectedError.message);
              
              // Verify error data is properly structured
              const logData = JSON.parse(log.data);
              expect(logData.name).toBe(expectedError.name);
              expect(logData.message).toBe(expectedError.message);
              expect(logData.stack).toBeDefined();
              
              if (expectedError.code) {
                expect(logData.code).toBe(expectedError.code);
              }
              
              if (expectedError.context) {
                expect(logData.context).toEqual(expectedError.context);
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should maintain log buffer within configured limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maxBufferSize: fc.integer({ min: 10, max: 100 }),
            messageCount: fc.integer({ min: 50, max: 200 })
          }),
          async (config) => {
            await testDebugService.initialize({
              enabled: true,
              logLevel: 'debug',
              categories: ['all'],
              maxBufferSize: config.maxBufferSize
            });

            testDebugService.logBuffer = [];

            // Generate more messages than buffer can hold
            for (let i = 0; i < config.messageCount; i++) {
              testDebugService.log('test', 'info', `Message ${i}`);
            }

            const actualLogs = testDebugService.getRecentLogs();
            
            // Buffer should not exceed configured size
            expect(actualLogs.length).toBeLessThanOrEqual(config.maxBufferSize);
            
            if (config.messageCount > config.maxBufferSize) {
              // Should contain the most recent messages
              expect(actualLogs.length).toBe(config.maxBufferSize);
              
              // Verify we have the latest messages (highest indices)
              const expectedStartIndex = config.messageCount - config.maxBufferSize;
              actualLogs.forEach((log, bufferIndex) => {
                const expectedMessageIndex = expectedStartIndex + bufferIndex;
                expect(log.message).toBe(`Message ${expectedMessageIndex}`);
              });
            } else {
              // Should contain all messages
              expect(actualLogs.length).toBe(config.messageCount);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should provide comprehensive debug statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            logEntries: fc.array(
              fc.record({
                level: fc.constantFrom('debug', 'info', 'warn', 'error'),
                category: fc.constantFrom('system', 'user', 'network'),
                message: fc.string({ minLength: 1, maxLength: 50 })
              }),
              { minLength: 5, maxLength: 50 }
            )
          }),
          async (config) => {
            // Mock database stats
            const levelCounts = { debug: 0, info: 0, warn: 0, error: 0 };
            config.logEntries.forEach(entry => {
              levelCounts[entry.level]++;
            });

            databaseService.get.mockResolvedValue({
              totalLogs: config.logEntries.length,
              errorCount: levelCounts.error,
              warningCount: levelCounts.warn,
              infoCount: levelCounts.info,
              debugCount: levelCounts.debug,
              oldestLog: new Date(Date.now() - 86400000).toISOString(),
              newestLog: new Date().toISOString()
            });

            await testDebugService.initialize({
              enabled: true,
              logLevel: 'debug',
              categories: ['all']
            });

            // Add some entries to buffer
            config.logEntries.slice(0, 10).forEach(entry => {
              testDebugService.log(entry.category, entry.level, entry.message);
            });

            const stats = await testDebugService.getDebugStats();

            // Verify statistics completeness
            expect(stats.totalLogs).toBe(config.logEntries.length);
            expect(stats.errorCount).toBe(levelCounts.error);
            expect(stats.warningCount).toBe(levelCounts.warn);
            expect(stats.infoCount).toBe(levelCounts.info);
            expect(stats.debugCount).toBe(levelCounts.debug);
            expect(stats.bufferSize).toBeLessThanOrEqual(10);
            expect(stats.isEnabled).toBe(true);
            expect(stats.logLevel).toBe('debug');
            expect(stats.categories).toContain('all');
            expect(stats.sessionId).toBeDefined();
            expect(stats.oldestLog).toBeDefined();
            expect(stats.newestLog).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should not log when debug mode is disabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              category: fc.constantFrom('system', 'user', 'error'),
              level: fc.constantFrom('debug', 'info', 'warn', 'error'),
              message: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (logEntries) => {
            await testDebugService.initialize({
              enabled: false, // Debug disabled
              logLevel: 'debug',
              categories: ['all']
            });

            testDebugService.logBuffer = [];

            // Attempt to log entries
            logEntries.forEach(entry => {
              testDebugService.log(entry.category, entry.level, entry.message);
            });

            // No logs should be generated when disabled
            const actualLogs = testDebugService.getRecentLogs();
            expect(actualLogs).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});