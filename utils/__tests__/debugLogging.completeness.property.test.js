/**
 * Property-based tests for debug logging completeness
 * Tests Requirements: 12.2
 */

import fc from 'fast-check';
import { DebugService, debugService, logSystemOperation, logUserInteraction, logPerformanceMetric, logError } from '../../services/debugService';
import { databaseService } from '../../services/databaseService';

// Mock dependencies
jest.mock('../../services/databaseService');
jest.mock('expo-file-system');

describe('DebugService - Logging Completeness Properties', () => {
  let testDebugService;

  beforeEach(async () => {
    testDebugService = new DebugService();
    jest.clearAllMocks();
    
    // Mock database operations
    databaseService.execute = jest.fn().mockResolvedValue();
    databaseService.get = jest.fn().mockResolvedValue(null);
    databaseService.getAll = jest.fn().mockResolvedValue([]);
    
    // Mock FileSystem
    const FileSystem = require('expo-file-system');
    FileSystem.documentDirectory = 'file://mock/';
    FileSystem.writeAsStringAsync = jest.fn().mockResolvedValue();
    
    await testDebugService.initialize({ enabled: true });
  });

  afterEach(() => {
    testDebugService = null;
  });

  /**
   * Property 28: Debug logging completeness
   * All system operations should be properly logged with appropriate levels and categories
   */
  test('Property 28: Debug logging completeness - all log levels and categories work correctly', () => {
    fc.assert(fc.property(
      fc.record({
        category: fc.oneof(
          fc.constantFrom('system', 'user', 'performance', 'error', 'network', 'audio', 'ai'),
          fc.string({ minLength: 1, maxLength: 20 })
        ),
        level: fc.constantFrom('debug', 'info', 'warn', 'error'),
        message: fc.string({ minLength: 1, maxLength: 200 }),
        data: fc.oneof(
          fc.constant(null),
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.oneof(fc.string(), fc.integer(), fc.boolean())
          })
        ),
        logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
        enabledCategories: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
      }),
      ({ category, level, message, data, logLevel, enabledCategories }) => {
        // Configure debug service
        testDebugService.logLevel = logLevel;
        testDebugService.logCategories = new Set([...enabledCategories, 'all']);
        
        const initialBufferSize = testDebugService.logBuffer.length;
        
        // Log the message
        testDebugService.log(category, level, message, data);
        
        const finalBufferSize = testDebugService.logBuffer.length;
        
        // Determine if message should have been logged
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(logLevel);
        const messageLevelIndex = levels.indexOf(level);
        const shouldLog = messageLevelIndex >= currentLevelIndex && 
                         (testDebugService.logCategories.has('all') || testDebugService.logCategories.has(category));
        
        if (shouldLog) {
          // Properties to verify when logging should occur:
          // 1. Buffer size should increase
          expect(finalBufferSize).toBe(initialBufferSize + 1);
          
          // 2. Latest log entry should match input
          const latestLog = testDebugService.logBuffer[testDebugService.logBuffer.length - 1];
          expect(latestLog.category).toBe(category);
          expect(latestLog.level).toBe(level);
          expect(latestLog.message).toBe(message);
          
          // 3. Log entry should have required fields
          expect(latestLog.timestamp).toBeDefined();
          expect(latestLog.sessionId).toBeDefined();
          expect(typeof latestLog.timestamp).toBe('string');
          expect(typeof latestLog.sessionId).toBe('string');
          
          // 4. Data should be properly serialized
          if (data) {
            expect(latestLog.data).toBe(JSON.stringify(data));
          } else {
            expect(latestLog.data).toBeNull();
          }
          
          // 5. Error logs should have stack trace
          if (level === 'error') {
            expect(latestLog.stack).toBeDefined();
            expect(typeof latestLog.stack).toBe('string');
          }
          
          return true;
        } else {
          // Properties to verify when logging should not occur:
          // 1. Buffer size should not change
          expect(finalBufferSize).toBe(initialBufferSize);
          
          return true;
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 28a: Log buffer management maintains size limits', () => {
    fc.assert(fc.property(
      fc.record({
        maxBufferSize: fc.integer({ min: 5, max: 50 }),
        logCount: fc.integer({ min: 1, max: 100 }),
        category: fc.constantFrom('system', 'user', 'test'),
        level: fc.constantFrom('info', 'warn', 'error')
      }),
      ({ maxBufferSize, logCount, category, level }) => {
        // Configure buffer size
        testDebugService.maxBufferSize = maxBufferSize;
        testDebugService.logBuffer = []; // Clear buffer
        
        // Generate multiple log entries
        for (let i = 0; i < logCount; i++) {
          testDebugService.log(category, level, `Test message ${i}`, { index: i });
        }
        
        // Properties to verify:
        // 1. Buffer should not exceed max size
        expect(testDebugService.logBuffer.length).toBeLessThanOrEqual(maxBufferSize);
        
        // 2. If more logs than buffer size, should keep most recent
        if (logCount > maxBufferSize) {
          expect(testDebugService.logBuffer.length).toBe(maxBufferSize);
          
          // Check that we have the most recent entries
          const lastLog = testDebugService.logBuffer[testDebugService.logBuffer.length - 1];
          expect(lastLog.message).toBe(`Test message ${logCount - 1}`);
          
          const firstLog = testDebugService.logBuffer[0];
          const expectedFirstIndex = logCount - maxBufferSize;
          expect(firstLog.message).toBe(`Test message ${expectedFirstIndex}`);
        } else {
          expect(testDebugService.logBuffer.length).toBe(logCount);
        }
        
        // 3. All entries should be properly formatted
        const allEntriesValid = testDebugService.logBuffer.every(entry => 
          entry.timestamp &&
          entry.sessionId &&
          entry.category === category &&
          entry.level === level &&
          entry.message &&
          typeof entry.data === 'string'
        );
        
        return allEntriesValid;
      }
    ), { numRuns: 50 });
  });

  test('Property 28b: Utility functions provide consistent logging', () => {
    fc.assert(fc.property(
      fc.record({
        operation: fc.string({ minLength: 1, maxLength: 100 }),
        userAction: fc.string({ minLength: 1, maxLength: 100 }),
        metric: fc.string({ minLength: 1, maxLength: 50 }),
        metricValue: fc.float({ min: 0, max: Math.fround(10000) }),
        errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
        contextData: fc.record({
          key: fc.string({ minLength: 1, maxLength: 20 }),
          value: fc.string({ minLength: 1, maxLength: 50 })
        })
      }),
      ({ operation, userAction, metric, metricValue, errorMessage, contextData }) => {
        const initialBufferSize = testDebugService.logBuffer.length;
        
        // Test system operation logging
        logSystemOperation(operation, contextData);
        
        // Test user interaction logging
        logUserInteraction(userAction, contextData);
        
        // Test performance metric logging
        logPerformanceMetric(metric, metricValue);
        
        // Test error logging
        const testError = new Error(errorMessage);
        testError.code = 'TEST_ERROR';
        logError(testError, contextData);
        
        const finalBufferSize = testDebugService.logBuffer.length;
        
        // Properties to verify:
        // 1. All utility functions should have logged
        expect(finalBufferSize).toBe(initialBufferSize + 4);
        
        // 2. Each log should have appropriate category and level
        const recentLogs = testDebugService.logBuffer.slice(-4);
        
        const systemLog = recentLogs.find(log => log.message.includes(`Operation: ${operation}`));
        expect(systemLog).toBeDefined();
        expect(systemLog.category).toBe('system');
        expect(systemLog.level).toBe('info');
        
        const userLog = recentLogs.find(log => log.message.includes(`User Action: ${userAction}`));
        expect(userLog).toBeDefined();
        expect(userLog.category).toBe('user');
        expect(userLog.level).toBe('info');
        
        const perfLog = recentLogs.find(log => log.message.includes(`Performance: ${metric}`));
        expect(perfLog).toBeDefined();
        expect(perfLog.category).toBe('performance');
        expect(perfLog.level).toBe('info');
        
        const errorLog = recentLogs.find(log => log.message.includes(`Error: ${errorMessage}`));
        expect(errorLog).toBeDefined();
        expect(errorLog.category).toBe('error');
        expect(errorLog.level).toBe('error');
        
        // 3. Data should be properly attached
        expect(systemLog.data).toBe(JSON.stringify(contextData));
        expect(userLog.data).toBe(JSON.stringify(contextData));
        
        const perfData = JSON.parse(perfLog.data);
        expect(perfData.metric).toBe(metric);
        expect(perfData.value).toBe(metricValue);
        expect(perfData.timestamp).toBeDefined();
        
        const errorData = JSON.parse(errorLog.data);
        expect(errorData.name).toBe('Error');
        expect(errorData.message).toBe(errorMessage);
        expect(errorData.code).toBe('TEST_ERROR');
        expect(errorData.context).toEqual(contextData);
        
        return true;
      }
    ), { numRuns: 30 });
  });

  test('Property 28c: Log filtering and retrieval work correctly', () => {
    fc.assert(fc.property(
      fc.record({
        logs: fc.array(
          fc.record({
            category: fc.constantFrom('system', 'user', 'performance', 'error'),
            level: fc.constantFrom('debug', 'info', 'warn', 'error'),
            message: fc.string({ minLength: 1, maxLength: 100 })
          }),
          { minLength: 5, maxLength: 20 }
        ),
        filterCategory: fc.oneof(
          fc.constant(null),
          fc.constantFrom('system', 'user', 'performance', 'error')
        ),
        filterLevel: fc.oneof(
          fc.constant(null),
          fc.constantFrom('debug', 'info', 'warn', 'error')
        ),
        limit: fc.integer({ min: 1, max: 50 })
      }),
      ({ logs, filterCategory, filterLevel, limit }) => {
        // Clear buffer and add test logs
        testDebugService.logBuffer = [];
        
        logs.forEach((logData, index) => {
          testDebugService.log(logData.category, logData.level, `${logData.message} ${index}`);
        });
        
        // Retrieve filtered logs
        const retrievedLogs = testDebugService.getRecentLogs(limit, filterCategory, filterLevel);
        
        // Properties to verify:
        // 1. Should not exceed limit
        expect(retrievedLogs.length).toBeLessThanOrEqual(limit);
        
        // 2. Should be filtered correctly
        if (filterCategory) {
          expect(retrievedLogs.every(log => log.category === filterCategory)).toBe(true);
        }
        
        if (filterLevel) {
          expect(retrievedLogs.every(log => log.level === filterLevel)).toBe(true);
        }
        
        // 3. Should be sorted by timestamp (newest first)
        if (retrievedLogs.length > 1) {
          const timestamps = retrievedLogs.map(log => new Date(log.timestamp).getTime());
          const isSorted = timestamps.every((timestamp, index) => 
            index === 0 || timestamp <= timestamps[index - 1]
          );
          expect(isSorted).toBe(true);
        }
        
        // 4. Count should match expected filtered count
        const expectedCount = logs.filter(log => 
          (!filterCategory || log.category === filterCategory) &&
          (!filterLevel || log.level === filterLevel)
        ).length;
        
        const actualCount = Math.min(expectedCount, limit);
        expect(retrievedLogs.length).toBe(actualCount);
        
        return true;
      }
    ), { numRuns: 30 });
  });

  test('Property 28d: Debug statistics are accurate', () => {
    fc.assert(fc.property(
      fc.record({
        errorLogs: fc.integer({ min: 0, max: 10 }),
        warnLogs: fc.integer({ min: 0, max: 10 }),
        infoLogs: fc.integer({ min: 0, max: 10 }),
        debugLogs: fc.integer({ min: 0, max: 10 })
      }),
      async ({ errorLogs, warnLogs, infoLogs, debugLogs }) => {
        // Mock database stats
        const totalLogs = errorLogs + warnLogs + infoLogs + debugLogs;
        databaseService.get.mockResolvedValue({
          totalLogs,
          errorCount: errorLogs,
          warningCount: warnLogs,
          infoCount: infoLogs,
          debugCount: debugLogs,
          oldestLog: '2024-01-01T00:00:00.000Z',
          newestLog: new Date().toISOString()
        });
        
        // Clear buffer and add test logs
        testDebugService.logBuffer = [];
        
        // Add logs to buffer
        for (let i = 0; i < errorLogs; i++) {
          testDebugService.log('test', 'error', `Error ${i}`);
        }
        for (let i = 0; i < warnLogs; i++) {
          testDebugService.log('test', 'warn', `Warning ${i}`);
        }
        for (let i = 0; i < infoLogs; i++) {
          testDebugService.log('test', 'info', `Info ${i}`);
        }
        for (let i = 0; i < debugLogs; i++) {
          testDebugService.log('test', 'debug', `Debug ${i}`);
        }
        
        const stats = await testDebugService.getDebugStats();
        
        // Properties to verify:
        // 1. Database stats should match mock
        expect(stats.totalLogs).toBe(totalLogs);
        expect(stats.errorCount).toBe(errorLogs);
        expect(stats.warningCount).toBe(warnLogs);
        expect(stats.infoCount).toBe(infoLogs);
        expect(stats.debugCount).toBe(debugLogs);
        
        // 2. Buffer stats should match actual buffer
        expect(stats.bufferSize).toBe(testDebugService.logBuffer.length);
        expect(stats.maxBufferSize).toBe(testDebugService.maxBufferSize);
        
        // 3. Configuration should be included
        expect(stats.isEnabled).toBe(testDebugService.isEnabled);
        expect(stats.logLevel).toBe(testDebugService.logLevel);
        expect(Array.isArray(stats.categories)).toBe(true);
        expect(stats.sessionId).toBe(testDebugService.sessionId);
        
        // 4. Timestamps should be valid
        if (totalLogs > 0) {
          expect(stats.oldestLog).toBeDefined();
          expect(stats.newestLog).toBeDefined();
        }
        
        return true;
      }
    ), { numRuns: 30 });
  });

  test('Property 28e: Log persistence and database operations are consistent', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          category: fc.constantFrom('system', 'user', 'error'),
          level: fc.constantFrom('info', 'warn', 'error'),
          message: fc.string({ minLength: 1, maxLength: 100 }),
          hasData: fc.boolean()
        }),
        { minLength: 1, maxLength: 10 }
      ),
      async (logEntries) => {
        // Clear any previous calls
        databaseService.execute.mockClear();
        
        // Log all entries
        logEntries.forEach((entry, index) => {
          const data = entry.hasData ? { index, test: true } : null;
          testDebugService.log(entry.category, entry.level, `${entry.message} ${index}`, data);
        });
        
        // Wait for async persistence (simulate)
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Properties to verify:
        // 1. Database execute should be called for each log entry
        expect(databaseService.execute).toHaveBeenCalledTimes(logEntries.length);
        
        // 2. Each call should have correct parameters
        const calls = databaseService.execute.mock.calls;
        calls.forEach((call, index) => {
          const [query, params] = call;
          const logEntry = logEntries[index];
          
          expect(query).toContain('INSERT INTO debug_logs');
          expect(Array.isArray(params)).toBe(true);
          expect(params.length).toBe(7); // timestamp, session_id, category, level, message, data, stack
          
          // Verify parameter values
          expect(params[1]).toBe(testDebugService.sessionId); // session_id
          expect(params[2]).toBe(logEntry.category); // category
          expect(params[3]).toBe(logEntry.level); // level
          expect(params[4]).toBe(`${logEntry.message} ${index}`); // message
          
          // Data should be JSON string or null
          if (logEntry.hasData) {
            expect(typeof params[5]).toBe('string');
            const parsedData = JSON.parse(params[5]);
            expect(parsedData.index).toBe(index);
            expect(parsedData.test).toBe(true);
          } else {
            expect(params[5]).toBeNull();
          }
          
          // Stack should be present for error logs
          if (logEntry.level === 'error') {
            expect(typeof params[6]).toBe('string');
            expect(params[6]).toContain('Error');
          } else {
            expect(params[6]).toBeNull();
          }
        });
        
        return true;
      }
    ), { numRuns: 20 });
  });
});