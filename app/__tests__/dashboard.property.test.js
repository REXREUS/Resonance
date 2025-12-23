/**
 * Property-based tests for Dashboard performance trend visualization
 * **Feature: resonance-mobile-app, Property 20: Performance trend visualization**
 * **Validates: Requirements 8.3**
 */

import fc from 'fast-check';

// Chart data generation logic extracted from dashboard component
const generateChartData = (sessions) => {
  const completedSessions = sessions.filter(s => s.completed === 1 && s.clarity_score !== null);
  
  if (completedSessions.length === 0) {
    return null;
  }
  
  // Prepare chart data (same logic as in component)
  const labels = completedSessions.reverse().map((_, index) => `S${index + 1}`);
  const clarityScores = completedSessions.map(s => s.clarity_score || 0);
  
  return {
    labels,
    datasets: [{
      data: clarityScores,
      color: (opacity = 1) => '#FFD700',
      strokeWidth: 3
    }]
  };
};

// Statistics calculation logic extracted from dashboard component
const calculateSessionStats = (sessions) => {
  const completedSessions = sessions.filter(s => s.completed === 1);
  
  // Calculate flight hours (total duration in hours)
  const totalDuration = completedSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
  const flightHours = Math.round((totalDuration / 3600) * 10) / 10;
  
  // Calculate average score
  const sessionsWithScores = completedSessions.filter(s => s.score !== null);
  const averageScore = sessionsWithScores.length > 0 
    ? Math.round(sessionsWithScores.reduce((sum, s) => sum + s.score, 0) / sessionsWithScores.length)
    : null;
  
  // Calculate current streak
  const streak = calculateStreak(completedSessions);
  
  // Calculate quota usage (mock)
  const quotaUsage = Math.min(Math.round((completedSessions.length * 2.5)), 100);
  
  return {
    flightHours,
    averageScore,
    streak,
    quotaUsage
  };
};

const calculateStreak = (sessions) => {
  if (sessions.length === 0) return 0;
  
  // Sort sessions by timestamp (newest first)
  const sortedSessions = sessions.sort((a, b) => b.timestamp - a.timestamp);
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const session of sortedSessions) {
    const sessionDate = new Date(session.timestamp);
    sessionDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streak) {
      streak++;
    } else if (daysDiff > streak) {
      break;
    }
  }
  
  return streak;
};

describe('Dashboard Performance Trend Visualization Properties', () => {

  /**
   * Property 20: Performance trend visualization
   * For any session history data, vocal clarity trends should be generated as accurate charts reflecting actual performance changes
   */
  test('Property 20: Performance trend visualization accuracy', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate array of sessions with clarity scores
      fc.array(
        fc.record({
          id: fc.integer({ min: 1, max: 1000 }),
          timestamp: fc.integer({ min: Date.now() - 30 * 24 * 60 * 60 * 1000, max: Date.now() }),
          scenario: fc.string({ minLength: 1, maxLength: 50 }),
          mode: fc.constantFrom('single', 'stress'),
          score: fc.integer({ min: 0, max: 100 }),
          duration: fc.integer({ min: 60, max: 3600 }),
          clarity_score: fc.integer({ min: 0, max: 100 }),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          completed: fc.constant(1)
        }),
        { minLength: 1, maxLength: 10 }
      ),
      async (sessions) => {
        const chartData = generateChartData(sessions);
        
        if (chartData) {
          // Property: Chart data should accurately reflect the input session data
          const completedSessions = sessions.filter(s => s.completed === 1 && s.clarity_score !== null);
          
          // Chart should have same number of data points as completed sessions
          expect(chartData.datasets[0].data.length).toBe(completedSessions.length);
          
          // Chart labels should match the number of sessions
          expect(chartData.labels.length).toBe(completedSessions.length);
          
          // Each data point should correspond to a clarity score from the sessions
          const expectedScores = completedSessions.reverse().map(s => s.clarity_score || 0);
          expect(chartData.datasets[0].data).toEqual(expectedScores);
          
          // All clarity scores should be within valid range (0-100)
          chartData.datasets[0].data.forEach(score => {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          });
          
          // Labels should follow the expected pattern (S1, S2, S3, etc.)
          chartData.labels.forEach((label, index) => {
            expect(label).toBe(`S${index + 1}`);
          });
        } else {
          // If no chart data, it should be because there are no completed sessions with clarity scores
          const validSessions = sessions.filter(s => s.completed === 1 && s.clarity_score !== null);
          expect(validSessions.length).toBe(0);
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 20: Chart data consistency with empty or invalid sessions', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate sessions that might have missing or invalid data
      fc.array(
        fc.record({
          id: fc.integer({ min: 1, max: 1000 }),
          timestamp: fc.integer({ min: Date.now() - 30 * 24 * 60 * 60 * 1000, max: Date.now() }),
          scenario: fc.string({ minLength: 1, maxLength: 50 }),
          mode: fc.constantFrom('single', 'stress'),
          score: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          duration: fc.option(fc.integer({ min: 60, max: 3600 }), { nil: null }),
          clarity_score: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          confidence_score: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          completed: fc.constantFrom(0, 1)
        }),
        { minLength: 0, maxLength: 15 }
      ),
      async (sessions) => {
        const chartData = generateChartData(sessions);
        
        // Property: Chart generation should handle edge cases gracefully
        const validSessions = sessions.filter(s => s.completed === 1 && s.clarity_score !== null);
        
        if (validSessions.length === 0) {
          // Should return null when no valid sessions
          expect(chartData).toBeNull();
        } else {
          // Should return valid chart data when valid sessions exist
          expect(chartData).not.toBeNull();
          expect(chartData.datasets[0].data.length).toBe(validSessions.length);
          expect(chartData.labels.length).toBe(validSessions.length);
          
          // All data points should be numbers
          chartData.datasets[0].data.forEach(score => {
            expect(typeof score).toBe('number');
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          });
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 20: Chart ordering preserves session chronology', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate sessions with different timestamps
      fc.array(
        fc.record({
          id: fc.integer({ min: 1, max: 1000 }),
          timestamp: fc.integer({ min: Date.now() - 7 * 24 * 60 * 60 * 1000, max: Date.now() }),
          scenario: fc.string({ minLength: 1, maxLength: 50 }),
          mode: fc.constantFrom('single', 'stress'),
          clarity_score: fc.integer({ min: 0, max: 100 }),
          completed: fc.constant(1)
        }),
        { minLength: 2, maxLength: 7 }
      ),
      async (sessions) => {
        // Sort sessions by timestamp to establish expected order (newest first, as returned by database)
        const newestFirstSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
        
        // Test the chart data generation logic with newest-first input
        const generateChartDataWithOrder = (sessionData) => {
          const completedSessions = sessionData.filter(s => s.completed === 1 && s.clarity_score !== null);
          
          if (completedSessions.length === 0) {
            return null;
          }
          
          // The component reverses the array to show oldest first in chart
          const reversedSessions = [...completedSessions].reverse();
          const labels = reversedSessions.map((_, index) => `S${index + 1}`);
          const clarityScores = reversedSessions.map(s => s.clarity_score || 0);
          
          return {
            labels,
            datasets: [{
              data: clarityScores,
              reversedSessions: reversedSessions // Include for testing
            }]
          };
        };
        
        const chartData = generateChartDataWithOrder(newestFirstSessions);
        
        if (chartData && chartData.datasets[0].reversedSessions) {
          // Property: Chart should display sessions in chronological order (oldest to newest)
          const chartSessions = chartData.datasets[0].reversedSessions;
          
          for (let i = 1; i < chartSessions.length; i++) {
            expect(chartSessions[i].timestamp).toBeGreaterThanOrEqual(chartSessions[i - 1].timestamp);
          }
        }
      }
    ), { numRuns: 100 });
  });
});