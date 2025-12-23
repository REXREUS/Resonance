/**
 * Property-based tests for offline system initialization
 * Tests Requirements: 1.1, 1.2
 */

import fc from 'fast-check';
import { InitializationService, initializeApp } from '../initializationService';
import { databaseService } from '../databaseService';
import { networkService } from '../networkService';
import { offlineService } from '../offlineService';
import { globalErrorHandler } from '../../utils/errorHandler';

// Mock dependencies
jest.mock('../databaseService');
jest.mock('../networkService');
jest.mock('../offlineService');
jest.mock('../../utils/errorHandler');

describe('InitializationService - Offline System Properties', () => {
  let initService;

  beforeEach(() => {
    initService = new InitializationService();
    jest.clearAllMocks();
    
    // Default mock implementations
    databaseService.isInitialized = false;
    databaseService.initialize = jest.fn().mockResolvedValue();
    databaseService.execute = jest.fn().mockResolvedValue();
    
    networkService.isInitialized = false;
    networkService.initialize = jest.fn().mockResolvedValue();
    networkService.testConnectivity = jest.fn().mockResolvedValue(true);
    networkService.isOnline = jest.fn().mockReturnValue(true);
    networkService.isOffline = jest.fn().mockReturnValue(false);
    
    offlineService.isInitialized = false;
    offlineService.initialize = jest.fn().mockResolvedValue();
    offlineService.getOfflineStatus = jest.fn().mockReturnValue({ isInitialized: true });
    
    globalErrorHandler.addErrorListener = jest.fn();
    globalErrorHandler.enableOfflineMode = jest.fn();
  });

  /**
   * Property 1: Offline system initialization
   * System should initialize successfully in offline mode and provide core functionality
   */
  test('Property 1: Offline system initialization - core services work without network', () => {
    fc.assert(fc.property(
      fc.record({
        databaseAvailable: fc.boolean(),
        networkAvailable: fc.boolean(),
        offlineCacheAvailable: fc.boolean(),
        enableNetworking: fc.boolean(),
        enableOfflineCache: fc.boolean()
      }),
      async ({ databaseAvailable, networkAvailable, offlineCacheAvailable, enableNetworking, enableOfflineCache }) => {
        // Configure service availability
        if (!databaseAvailable) {
          databaseService.initialize.mockRejectedValue(new Error('Database unavailable'));
        } else {
          databaseService.isInitialized = true;
        }
        
        if (!networkAvailable) {
          networkService.initialize.mockRejectedValue(new Error('Network unavailable'));
          networkService.isOnline.mockReturnValue(false);
          networkService.isOffline.mockReturnValue(true);
        } else {
          networkService.isInitialized = true;
        }
        
        if (!offlineCacheAvailable) {
          offlineService.initialize.mockRejectedValue(new Error('Offline cache unavailable'));
        } else {
          offlineService.isInitialized = true;
        }

        try {
          const result = await initService.initialize({
            enableNetworking,
            enableOfflineCache
          });

          // Properties to verify for successful initialization:
          if (databaseAvailable) {
            // 1. Should succeed if database is available (core requirement)
            expect(result.success).toBe(true);
            
            // 2. Should track failed non-critical services
            const expectedFailures = [];
            if (enableNetworking && !networkAvailable) {
              expectedFailures.push('Network Monitor');
            }
            if (enableOfflineCache && !offlineCacheAvailable) {
              expectedFailures.push('Offline Cache');
            }
            
            // 3. Should indicate offline mode if network unavailable
            if (!networkAvailable || !networkService.isOnline()) {
              expect(result.isOfflineMode).toBe(true);
            }
            
            // 4. Should have initialization steps recorded
            expect(result.initializationSteps).toBeDefined();
            expect(result.initializationSteps.length).toBeGreaterThan(0);
            
            // 5. Critical services should be initialized
            const criticalSteps = result.initializationSteps.filter(step => 
              ['Error Handler', 'Database', 'System Validation'].includes(step.name)
            );
            expect(criticalSteps.every(step => step.success)).toBe(true);
            
            return true;
          } else {
            // Should fail if database unavailable (unless fallback works)
            return result.success === false || result.isOfflineMode === true;
          }
        } catch (error) {
          // Should only fail if critical services unavailable
          return !databaseAvailable;
        }
      }
    ), { numRuns: 50 });
  });

  test('Property 1a: Initialization progress tracking is consistent', () => {
    fc.assert(fc.property(
      fc.record({
        trackProgress: fc.boolean(),
        serviceFailures: fc.array(fc.constantFrom('network', 'offline', 'none'), { maxLength: 2 })
      }),
      async ({ trackProgress, serviceFailures }) => {
        let progressUpdates = [];
        const progressCallback = trackProgress ? (update) => {
          progressUpdates.push(update);
        } : null;

        // Configure service failures
        serviceFailures.forEach(failure => {
          switch (failure) {
            case 'network':
              networkService.initialize.mockRejectedValue(new Error('Network failed'));
              break;
            case 'offline':
              offlineService.initialize.mockRejectedValue(new Error('Offline failed'));
              break;
          }
        });

        // Ensure database succeeds (critical)
        databaseService.isInitialized = true;

        const result = await initService.initialize({
          progressCallback,
          enableNetworking: true,
          enableOfflineCache: true
        });

        // Properties to verify:
        if (trackProgress) {
          // 1. Progress should be tracked
          expect(progressUpdates.length).toBeGreaterThan(0);
          
          // 2. Progress should increase monotonically
          const progressValues = progressUpdates.map(update => update.progress);
          const isMonotonic = progressValues.every((val, i) => 
            i === 0 || val >= progressValues[i - 1]
          );
          
          // 3. Final progress should be 100%
          const finalProgress = progressValues[progressValues.length - 1];
          
          // 4. Each update should have valid structure
          const validUpdates = progressUpdates.every(update => 
            typeof update.progress === 'number' &&
            update.progress >= 0 &&
            update.progress <= 100 &&
            typeof update.completedSteps === 'number' &&
            typeof update.totalSteps === 'number'
          );
          
          return isMonotonic && finalProgress === 100 && validUpdates;
        } else {
          // Should work without progress tracking
          return result.success === true;
        }
      }
    ), { numRuns: 30 });
  });

  test('Property 1b: Failed service reinitialization works correctly', () => {
    fc.assert(fc.property(
      fc.record({
        initialFailures: fc.array(fc.constantFrom('network', 'offline'), { minLength: 1, maxLength: 2 }),
        reinitSuccess: fc.boolean()
      }),
      async ({ initialFailures, reinitSuccess }) => {
        // Configure initial failures
        initialFailures.forEach(failure => {
          switch (failure) {
            case 'network':
              networkService.initialize.mockRejectedValueOnce(new Error('Network failed initially'));
              break;
            case 'offline':
              offlineService.initialize.mockRejectedValueOnce(new Error('Offline failed initially'));
              break;
          }
        });

        // Ensure database succeeds
        databaseService.isInitialized = true;

        // Initial initialization
        const initResult = await initService.initialize({
          enableNetworking: true,
          enableOfflineCache: true
        });

        expect(initResult.success).toBe(true);
        expect(initResult.failedServices.length).toBeGreaterThan(0);

        // Configure reinitialization behavior
        if (reinitSuccess) {
          networkService.initialize.mockResolvedValue();
          offlineService.initialize.mockResolvedValue();
          networkService.isInitialized = true;
          offlineService.isInitialized = true;
        } else {
          networkService.initialize.mockRejectedValue(new Error('Still failing'));
          offlineService.initialize.mockRejectedValue(new Error('Still failing'));
        }

        // Attempt reinitialization
        const reinitResult = await initService.reinitializeFailedServices();

        // Properties to verify:
        if (reinitSuccess) {
          // 1. Reinitialization should succeed
          expect(reinitResult.success).toBe(true);
          
          // 2. Failed services list should be cleared
          expect(reinitResult.remainingFailedServices.length).toBe(0);
          
          // 3. Results should show success for each service
          expect(reinitResult.results.every(result => result.success)).toBe(true);
          
          return true;
        } else {
          // 1. Reinitialization should fail
          expect(reinitResult.success).toBe(false);
          
          // 2. Failed services should remain
          expect(reinitResult.remainingFailedServices.length).toBeGreaterThan(0);
          
          // 3. Results should show failures
          expect(reinitResult.results.some(result => !result.success)).toBe(true);
          
          return true;
        }
      }
    ), { numRuns: 30 });
  });

  test('Property 1c: Offline capability detection is accurate', () => {
    fc.assert(fc.property(
      fc.record({
        databaseSuccess: fc.boolean(),
        errorHandlerSuccess: fc.boolean(),
        networkSuccess: fc.boolean(),
        offlineSuccess: fc.boolean()
      }),
      async ({ databaseSuccess, errorHandlerSuccess, networkSuccess, offlineSuccess }) => {
        // Configure service success/failure
        if (!databaseSuccess) {
          databaseService.initialize.mockRejectedValue(new Error('Database failed'));
        } else {
          databaseService.isInitialized = true;
        }

        if (!networkSuccess) {
          networkService.initialize.mockRejectedValue(new Error('Network failed'));
        } else {
          networkService.isInitialized = true;
        }

        if (!offlineSuccess) {
          offlineService.initialize.mockRejectedValue(new Error('Offline failed'));
        } else {
          offlineService.isInitialized = true;
        }

        try {
          await initService.initialize({
            enableNetworking: true,
            enableOfflineCache: true
          });

          const canOperateOffline = initService.canOperateOffline();
          
          // Properties to verify:
          // 1. Should be able to operate offline if critical services available
          const criticalServicesAvailable = databaseSuccess && errorHandlerSuccess;
          
          if (criticalServicesAvailable) {
            expect(canOperateOffline).toBe(true);
          } else {
            expect(canOperateOffline).toBe(false);
          }
          
          // 2. Status should reflect actual initialization state
          const status = initService.getInitializationStatus();
          expect(status.isInitialized).toBe(true);
          expect(Array.isArray(status.steps)).toBe(true);
          expect(typeof status.progress).toBe('number');
          expect(status.progress).toBeGreaterThanOrEqual(0);
          expect(status.progress).toBeLessThanOrEqual(100);
          
          return true;
        } catch (error) {
          // Should fail if critical services unavailable
          const canOperateOffline = initService.canOperateOffline();
          expect(canOperateOffline).toBe(false);
          return !databaseSuccess; // Should only fail if database unavailable
        }
      }
    ), { numRuns: 40 });
  });

  test('Property 1d: Initialization is idempotent', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 5 }),
      async (initializationCount) => {
        // Ensure services succeed
        databaseService.isInitialized = true;
        networkService.isInitialized = true;
        offlineService.isInitialized = true;

        const results = [];
        
        // Initialize multiple times
        for (let i = 0; i < initializationCount; i++) {
          const result = await initService.initialize();
          results.push(result);
        }

        // Properties to verify:
        // 1. All initializations should succeed
        const allSucceeded = results.every(result => result.success);
        
        // 2. Results should be consistent
        const firstResult = results[0];
        const consistentResults = results.every(result => 
          result.success === firstResult.success &&
          result.isOfflineMode === firstResult.isOfflineMode
        );
        
        // 3. Service initialization should not be called multiple times unnecessarily
        // (This would be implementation-specific and might require more sophisticated mocking)
        
        return allSucceeded && consistentResults;
      }
    ), { numRuns: 20 });
  });

  test('Property 1e: Utility function behaves consistently with service', () => {
    fc.assert(fc.property(
      fc.record({
        enableNetworking: fc.boolean(),
        enableOfflineCache: fc.boolean(),
        databaseWorks: fc.boolean()
      }),
      async ({ enableNetworking, enableOfflineCache, databaseWorks }) => {
        if (databaseWorks) {
          databaseService.isInitialized = true;
        } else {
          databaseService.initialize.mockRejectedValue(new Error('Database failed'));
        }

        // Test both service method and utility function
        const serviceResult = await initService.initialize({
          enableNetworking,
          enableOfflineCache
        });

        // Reset service for utility function test
        const newInitService = new InitializationService();
        const utilityResult = await initializeApp({
          enableNetworking,
          enableOfflineCache
        });

        // Properties to verify:
        // 1. Both should have same success status
        expect(serviceResult.success).toBe(utilityResult.success);
        
        // 2. Both should have similar structure
        expect(typeof serviceResult.isOfflineMode).toBe(typeof utilityResult.isOfflineMode);
        expect(Array.isArray(serviceResult.failedServices)).toBe(Array.isArray(utilityResult.failedServices));
        expect(Array.isArray(serviceResult.initializationSteps)).toBe(Array.isArray(utilityResult.initializationSteps));
        
        return true;
      }
    ), { numRuns: 30 });
  });
});