/**
 * Property-based tests for Achievement Service
 * **Feature: resonance-mobile-app, Property 21: Achievement tracking consistency**
 * **Validates: Requirements 8.5**
 */

import fc from 'fast-check';
import { achievementService } from '../achievementService';
import { databaseService } from '../databaseService';

// Mock database service
jest.mock('../databaseService', () => ({
  databaseService: {
    getAllAchievements: jest.fn(),
    createAchievement: jest.fn(),
    updateAchievement: jest.fn(),
    getSessions: jest.fn(),
    initialize: jest.fn().mockResolvedValue(true),
  }
}));

describe('Achievement Service Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    achievementService.achievements.clear();
    achievementService.isInitialized = false;
  });

  /**
   * Property 21: Achievement tracking consistency
   * For any session completion, achievement progress should be updated consistently
   * and unlocked achievements should remain unlocked permanently
   */
  test('Property 21: Achievement tracking consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate session data
        fc.record({
          score: fc.integer({ min: 0, max: 100 }),
          mode: fc.constantFrom('single', 'stress'),
          queueLength: fc.integer({ min: 1, max: 10 }),
          chaosEffectsEnabled: fc.array(fc.constantFrom('voice', 'noise', 'hardware'), { maxLength: 3 }),
          timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() })
        }),
        // Generate existing sessions for streak calculation
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            timestamp: fc.integer({ min: Date.now() - 2592000000, max: Date.now() }), // Last 30 days
            completed: fc.constant(1),
            score: fc.integer({ min: 0, max: 100 })
          }),
          { maxLength: 50 }
        ),
        async (sessionData, existingSessions) => {
          // Setup: Initialize service with mock achievements
          const mockAchievements = [
            {
              id: 'first_session',
              name: 'First Steps',
              type: 'milestone',
              target: 1,
              current: 0,
              unlocked: false,
              points: 10
            },
            {
              id: 'score_80',
              name: 'Excellence',
              type: 'performance',
              target: 80,
              current: 0,
              unlocked: false,
              points: 30
            },
            {
              id: 'streak_3',
              name: 'Getting Started',
              type: 'streak',
              target: 3,
              current: 0,
              unlocked: false,
              points: 25
            },
            {
              id: 'sessions_10',
              name: 'Dedicated Learner',
              type: 'milestone',
              target: 10,
              current: 0,
              unlocked: false,
              points: 40
            }
          ];

          databaseService.getAllAchievements.mockResolvedValue([...mockAchievements]);
          databaseService.getSessions.mockResolvedValue(existingSessions);
          databaseService.createAchievement.mockResolvedValue();
          databaseService.updateAchievement.mockResolvedValue();

          await achievementService.initialize();

          // Record initial state
          const initialAchievements = achievementService.getAllAchievements();
          const initialUnlocked = initialAchievements.filter(a => a.unlocked);

          // Action: Check achievements for session
          const unlockedAchievements = await achievementService.checkSessionAchievements(sessionData);

          // Get final state
          const finalAchievements = achievementService.getAllAchievements();
          const finalUnlocked = finalAchievements.filter(a => a.unlocked);

          // Property 1: Previously unlocked achievements remain unlocked
          for (const initialAchievement of initialUnlocked) {
            const finalAchievement = finalAchievements.find(a => a.id === initialAchievement.id);
            expect(finalAchievement?.unlocked).toBe(true);
          }

          // Property 2: Achievement progress never decreases
          for (const initialAchievement of initialAchievements) {
            const finalAchievement = finalAchievements.find(a => a.id === initialAchievement.id);
            if (finalAchievement && !finalAchievement.unlocked) {
              expect(finalAchievement.current).toBeGreaterThanOrEqual(initialAchievement.current);
            }
          }

          // Property 3: Newly unlocked achievements are in the returned array
          const newlyUnlocked = finalUnlocked.filter(
            final => !initialUnlocked.some(initial => initial.id === final.id)
          );
          expect(unlockedAchievements).toHaveLength(newlyUnlocked.length);
          
          for (const achievement of newlyUnlocked) {
            expect(unlockedAchievements.some(a => a.id === achievement.id)).toBe(true);
          }

          // Property 4: Achievement conditions are correctly evaluated
          const sessionCount = existingSessions.length + 1; // +1 for current session
          
          // Check milestone achievements
          const firstSessionAchievement = finalAchievements.find(a => a.id === 'first_session');
          // First session achievement should always be unlocked since sessionCount is always >= 1
          expect(firstSessionAchievement?.unlocked).toBe(true);

          const sessions10Achievement = finalAchievements.find(a => a.id === 'sessions_10');
          if (sessionCount >= 10) {
            expect(sessions10Achievement?.unlocked).toBe(true);
          } else {
            expect(sessions10Achievement?.current).toBe(sessionCount);
          }

          // Check performance achievements
          const score80Achievement = finalAchievements.find(a => a.id === 'score_80');
          if (sessionData.score >= 80) {
            expect(score80Achievement?.unlocked).toBe(true);
          }
          // Current should be at least the session score (highest score achieved)
          expect(score80Achievement?.current).toBeGreaterThanOrEqual(sessionData.score);

          // Property 5: Streak calculation is consistent
          const streak3Achievement = finalAchievements.find(a => a.id === 'streak_3');
          const sessionsWithCurrent = [...existingSessions, { timestamp: sessionData.timestamp, completed: 1 }];
          const calculatedStreak = achievementService.calculateStreak(sessionsWithCurrent);
          
          if (calculatedStreak >= 3) {
            expect(streak3Achievement?.unlocked).toBe(true);
          } else {
            expect(streak3Achievement?.current).toBe(calculatedStreak);
          }

          // Property 6: All achievements maintain valid state
          for (const achievement of finalAchievements) {
            // Achievement has required properties
            expect(achievement).toHaveProperty('id');
            expect(achievement).toHaveProperty('name');
            expect(achievement).toHaveProperty('type');
            expect(achievement).toHaveProperty('target');
            expect(achievement).toHaveProperty('current');
            expect(achievement).toHaveProperty('unlocked');

            // Current progress is within valid range
            expect(achievement.current).toBeGreaterThanOrEqual(0);
            if (!achievement.unlocked) {
              expect(achievement.current).toBeLessThanOrEqual(achievement.target);
            }

            // Unlocked achievements have unlock timestamp
            if (achievement.unlocked && achievement.unlocked_at) {
              expect(achievement.unlocked_at).toBeGreaterThan(0);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('streak calculation consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            timestamp: fc.integer({ min: Date.now() - 2592000000, max: Date.now() }),
            completed: fc.constant(1)
          }),
          { maxLength: 30 }
        ),
        async (sessions) => {
          // Setup
          databaseService.getAllAchievements.mockResolvedValue([]);
          await achievementService.initialize();

          // Calculate streak
          const streak = achievementService.calculateStreak(sessions);

          // Property: Streak is non-negative
          expect(streak).toBeGreaterThanOrEqual(0);

          // Property: Streak cannot exceed total sessions
          expect(streak).toBeLessThanOrEqual(sessions.length);

          // Property: If no sessions, streak is 0
          if (sessions.length === 0) {
            expect(streak).toBe(0);
          }

          // Property: Streak calculation is deterministic
          const streak2 = achievementService.calculateStreak(sessions);
          expect(streak).toBe(streak2);

          // Property: Adding a session today should not decrease streak
          const today = Date.now();
          const sessionsWithToday = [...sessions, { timestamp: today, completed: 1 }];
          const streakWithToday = achievementService.calculateStreak(sessionsWithToday);
          expect(streakWithToday).toBeGreaterThanOrEqual(streak);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('achievement progress updates are monotonic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            score: fc.integer({ min: 0, max: 100 }),
            timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sessionSequence) => {
          // Setup
          const mockAchievement = {
            id: 'test_performance',
            name: 'Test Performance',
            type: 'performance',
            target: 90,
            current: 0,
            unlocked: false,
            points: 50
          };

          databaseService.getAllAchievements.mockResolvedValue([mockAchievement]);
          databaseService.getSessions.mockResolvedValue([]);
          await achievementService.initialize();

          let previousProgress = 0;

          // Process sessions in sequence
          for (const session of sessionSequence) {
            await achievementService.checkSessionAchievements(session);
            
            const achievement = achievementService.getAchievement('test_performance');
            
            // Property: Progress never decreases
            expect(achievement.current).toBeGreaterThanOrEqual(previousProgress);
            
            // Property: Progress reflects highest score achieved so far
            const expectedMinimum = Math.max(session.score, previousProgress);
            expect(achievement.current).toBeGreaterThanOrEqual(expectedMinimum);
            
            previousProgress = achievement.current;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('achievement unlocking is permanent and consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialProgress: fc.integer({ min: 0, max: 9 }),
          sessionScore: fc.integer({ min: 0, max: 100 })
        }),
        async ({ initialProgress, sessionScore }) => {
          // Setup achievement close to unlocking
          const mockAchievement = {
            id: 'test_milestone',
            name: 'Test Milestone',
            type: 'milestone',
            target: 10,
            current: initialProgress,
            unlocked: false,
            points: 25
          };

          databaseService.getAllAchievements.mockResolvedValue([mockAchievement]);
          databaseService.getSessions.mockResolvedValue(
            Array(initialProgress).fill().map((_, i) => ({
              id: i + 1,
              timestamp: Date.now() - (i * 86400000),
              completed: 1,
              score: 75
            }))
          );
          
          await achievementService.initialize();

          // Process session that might unlock achievement
          await achievementService.checkSessionAchievements({ score: sessionScore });

          const achievement = achievementService.getAchievement('test_milestone');
          const shouldBeUnlocked = (initialProgress + 1) >= 10;

          // Property: Achievement unlocks when target is reached
          expect(achievement.unlocked).toBe(shouldBeUnlocked);

          // Property: If unlocked, it has unlock timestamp
          if (achievement.unlocked) {
            expect(achievement.unlocked_at).toBeDefined();
            expect(achievement.unlocked_at).toBeGreaterThan(0);
          }

          // Process another session - achievement should remain unlocked if it was unlocked
          await achievementService.checkSessionAchievements({ score: sessionScore });
          const achievementAfter = achievementService.getAchievement('test_milestone');

          // Property: Once unlocked, achievement stays unlocked
          if (achievement.unlocked) {
            expect(achievementAfter.unlocked).toBe(true);
            expect(achievementAfter.unlocked_at).toBe(achievement.unlocked_at);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});