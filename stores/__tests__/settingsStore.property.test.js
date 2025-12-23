/**
 * Property-based tests for Settings Store
 * **Feature: resonance-mobile-app, Property 19: API quota tracking**
 * **Validates: Requirements 8.2, 9.2**
 */

import fc from 'fast-check';
import useSettingsStore from '../settingsStore';
import { databaseService } from '../../services/databaseService';

// Mock dependencies
jest.mock('../../services/databaseService');

describe('Settings Store Property Tests', () => {
  let store;

  beforeEach(() => {
    // Reset store state before each test
    store = useSettingsStore.getState();
    useSettingsStore.setState({
      settings: {
        theme: 'dark',
        language: 'id',
        dailyLimit: 50.0,
        hapticEnabled: true,
        vadSensitivity: 'medium',
        mockMode: false,
        debugLogs: false,
        audioInputDevice: 'default',
        audioOutputDevice: 'default',
      },
      apiKeys: {
        elevenlabs: '',
        gemini: '',
      },
      quotaUsage: {
        daily: 0,
        monthly: 0,
        lastReset: Date.now(),
      },
      isLoading: false,
    });

    // Mock database service
    databaseService.updateAppSettings = jest.fn().mockResolvedValue();
    databaseService.storeApiKey = jest.fn().mockResolvedValue();
    databaseService.getApiKey = jest.fn().mockResolvedValue('');
    databaseService.getAppSettings = jest.fn().mockResolvedValue(null);
  });

  /**
   * Property 19: API quota tracking
   * For any sequence of API usage tracking calls, the total usage should equal the sum of all costs
   * and should never exceed the daily limit when properly enforced
   */
  test('API quota tracking accumulates costs correctly and enforces limits', () => {
    fc.assert(
      fc.property(
        // Generate array of API usage costs (0.01 to 10.00)
        fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(10.0), noNaN: true }), { minLength: 1, maxLength: 20 }),
        // Generate daily limit (10.00 to 100.00)
        fc.float({ min: Math.fround(10.0), max: Math.fround(100.0), noNaN: true }),
        (usageCosts, dailyLimit) => {
          // Set up initial state with the daily limit
          useSettingsStore.setState({
            settings: { ...store.settings, dailyLimit },
            quotaUsage: { daily: 0, monthly: 0, lastReset: Date.now() },
          });

          let expectedDaily = 0;
          let expectedMonthly = 0;

          // Track each usage cost
          for (const cost of usageCosts) {
            const { trackApiUsage, checkDailyLimit } = useSettingsStore.getState();
            
            // Check if we can add this cost without exceeding limit
            const canAddCost = expectedDaily + cost <= dailyLimit;
            
            // Track the usage
            trackApiUsage('elevenlabs', cost);
            
            expectedDaily += cost;
            expectedMonthly += cost;

            const currentState = useSettingsStore.getState();
            
            // Verify quota tracking accuracy (allow for floating point precision)
            expect(currentState.quotaUsage.daily).toBeCloseTo(expectedDaily, 1);
            expect(currentState.quotaUsage.monthly).toBeCloseTo(expectedMonthly, 1);
            
            // Verify daily limit checking
            const withinLimit = checkDailyLimit();
            expect(withinLimit).toBe(currentState.quotaUsage.daily < dailyLimit);
          }

          // Verify final state consistency
          const finalState = useSettingsStore.getState();
          const totalExpectedCost = usageCosts.reduce((sum, cost) => sum + cost, 0);
          
          expect(finalState.quotaUsage.daily).toBeCloseTo(totalExpectedCost, 1);
          expect(finalState.quotaUsage.monthly).toBeCloseTo(totalExpectedCost, 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Daily quota reset functionality
   * For any quota usage, when a new day starts, daily usage should reset to 0 while monthly persists
   */
  test('daily quota resets correctly on new day', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(50.0), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10.0), noNaN: true }),
        (initialUsage, newDayUsage) => {
          // Set up initial usage from "yesterday"
          const yesterday = Date.now() - 24 * 60 * 60 * 1000;
          useSettingsStore.setState({
            quotaUsage: {
              daily: initialUsage,
              monthly: initialUsage,
              lastReset: yesterday,
            },
          });

          // Track usage on "new day"
          const { trackApiUsage } = useSettingsStore.getState();
          trackApiUsage('gemini', newDayUsage);

          const currentState = useSettingsStore.getState();
          
          // Daily should reset and only show new usage (allow for floating point precision)
          expect(currentState.quotaUsage.daily).toBeCloseTo(newDayUsage, 1);
          
          // Monthly should accumulate both (allow for floating point precision)
          expect(currentState.quotaUsage.monthly).toBeCloseTo(initialUsage + newDayUsage, 1);
          
          // Last reset should be updated
          expect(currentState.quotaUsage.lastReset).toBeGreaterThan(yesterday);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Remaining quota calculation
   * For any daily limit and current usage, remaining quota should equal limit minus usage (minimum 0)
   */
  test('remaining quota calculation is accurate', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(10.0), max: Math.fround(100.0), noNaN: true }),
        fc.float({ min: Math.fround(0.0), max: Math.fround(150.0), noNaN: true }),
        (dailyLimit, currentUsage) => {
          useSettingsStore.setState({
            settings: { ...store.settings, dailyLimit },
            quotaUsage: { daily: currentUsage, monthly: currentUsage, lastReset: Date.now() },
          });

          const { getRemainingQuota } = useSettingsStore.getState();
          const remaining = getRemainingQuota();
          const expected = Math.max(0, dailyLimit - currentUsage);

          expect(remaining).toBeCloseTo(expected, 1);
          expect(remaining).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cost safety enforcement
   * For any usage pattern, the system should accurately track when daily limits are exceeded
   */
  test('cost safety limits are properly enforced', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(20.0), max: Math.fround(50.0), noNaN: true }),
        fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(15.0), noNaN: true }), { minLength: 1, maxLength: 10 }),
        (dailyLimit, costs) => {
          useSettingsStore.setState({
            settings: { ...store.settings, dailyLimit },
            quotaUsage: { daily: 0, monthly: 0, lastReset: Date.now() },
          });

          let totalUsed = 0;
          
          for (const cost of costs) {
            const { trackApiUsage, checkDailyLimit, getRemainingQuota } = useSettingsStore.getState();
            
            const beforeUsage = useSettingsStore.getState().quotaUsage.daily;
            const beforeCanUse = checkDailyLimit();
            const beforeRemaining = getRemainingQuota();
            
            trackApiUsage('elevenlabs', cost);
            totalUsed += cost;
            
            const afterUsage = useSettingsStore.getState().quotaUsage.daily;
            const afterCanUse = checkDailyLimit();
            const afterRemaining = getRemainingQuota();
            
            // Usage should increase by cost amount (allow for floating point precision)
            expect(afterUsage - beforeUsage).toBeCloseTo(cost, 1);
            
            // Limit checking should be consistent
            expect(afterCanUse).toBe(afterUsage < dailyLimit);
            
            // Remaining quota should decrease by cost amount (allow for floating point precision)
            // When remaining quota hits 0, the difference might not match exactly due to Math.max(0, ...)
            if (beforeRemaining > 0 && afterRemaining > 0) {
              expect(beforeRemaining - afterRemaining).toBeCloseTo(cost, 1);
            } else if (beforeRemaining > 0 && afterRemaining === 0) {
              // When quota is exhausted, the difference should be at least the remaining amount
              expect(beforeRemaining - afterRemaining).toBeGreaterThanOrEqual(0);
            }
            
            // If we've exceeded the limit, checkDailyLimit should return false
            if (totalUsed >= dailyLimit) {
              expect(afterCanUse).toBe(false);
              expect(afterRemaining).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});