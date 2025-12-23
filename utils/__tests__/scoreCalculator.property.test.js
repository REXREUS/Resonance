import fc from 'fast-check';
import {
  calculateSessionScore,
  calculatePaceScore,
  calculateFillerWordPenalty,
  calculateGrade,
  validateMetrics,
  calculateSessionReport
} from '../scoreCalculator';

describe('Score Calculator Property Tests', () => {
  /**
   * **Feature: resonance-mobile-app, Property 12: Score calculation validity**
   * **Validates: Requirements 6.1**
   * 
   * Property: For any completed session, the generated score should be between 0-100 and reflect the actual performance metrics (pace, filler words, clarity, confidence)
   */
  test('Property 12: Score calculation validity', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          pace: fc.integer({ min: 0, max: 500 }), // WPM range
          fillerWordCount: fc.integer({ min: 0, max: 100 }),
          clarity: fc.integer({ min: 0, max: 100 }),
          confidence: fc.integer({ min: 0, max: 100 }),
          duration: fc.integer({ min: 1, max: 3600 }) // 1 second to 1 hour
        }),
        (metrics) => {
          // Property: Score should always be between 0 and 100
          const score = calculateSessionScore(metrics);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isInteger(score)).toBe(true);

          // Property: Score should reflect performance metrics
          // Higher clarity and confidence should generally lead to higher scores
          const highPerformanceMetrics = {
            ...metrics,
            clarity: 95,
            confidence: 95,
            fillerWordCount: 0
          };
          const highScore = calculateSessionScore(highPerformanceMetrics);

          const lowPerformanceMetrics = {
            ...metrics,
            clarity: 20,
            confidence: 20,
            fillerWordCount: Math.max(10, metrics.fillerWordCount)
          };
          const lowScore = calculateSessionScore(lowPerformanceMetrics);

          // Property: High performance should score better than low performance
          expect(highScore).toBeGreaterThanOrEqual(lowScore);

          // Property: Filler words should negatively impact score
          const noFillerMetrics = { ...metrics, fillerWordCount: 0 };
          const withFillerMetrics = { ...metrics, fillerWordCount: Math.max(5, metrics.fillerWordCount) };
          
          const noFillerScore = calculateSessionScore(noFillerMetrics);
          const withFillerScore = calculateSessionScore(withFillerMetrics);
          
          expect(noFillerScore).toBeGreaterThanOrEqual(withFillerScore);

          // Property: Grade should correspond to score ranges
          const grade = calculateGrade(score);
          expect(typeof grade).toBe('string');
          expect(grade.length).toBeGreaterThan(0);

          // Verify grade boundaries
          if (score >= 95) expect(grade).toBe('A+');
          else if (score >= 90) expect(grade).toBe('A');
          else if (score >= 85) expect(grade).toBe('A-');
          else if (score >= 80) expect(grade).toBe('B+');
          else if (score >= 75) expect(grade).toBe('B');
          else if (score >= 70) expect(grade).toBe('B-');
          else if (score >= 65) expect(grade).toBe('C+');
          else if (score >= 60) expect(grade).toBe('C');
          else if (score >= 55) expect(grade).toBe('C-');
          else if (score >= 50) expect(grade).toBe('D');
          else expect(grade).toBe('F');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pace score should follow optimal range logic
   */
  test('Property: Pace score calculation consistency', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        (pace) => {
          const paceScore = calculatePaceScore(pace);
          
          // Property: Pace score should be between 0 and 100
          expect(paceScore).toBeGreaterThanOrEqual(0);
          expect(paceScore).toBeLessThanOrEqual(100);

          // Property: Optimal range (150-180 WPM) should get perfect score
          if (pace >= 150 && pace <= 180) {
            expect(paceScore).toBe(100);
          }

          // Property: Zero pace should get zero score
          if (pace === 0) {
            expect(paceScore).toBe(0);
          }

          // Property: Pace score should be monotonic in optimal ranges
          if (pace > 0 && pace < 150) {
            const lowerPaceScore = calculatePaceScore(Math.max(1, pace - 10));
            expect(paceScore).toBeGreaterThanOrEqual(lowerPaceScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filler word penalty should increase with count and frequency
   */
  test('Property: Filler word penalty calculation', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 1800 }),
        (fillerWordCount, duration) => {
          const penalty = calculateFillerWordPenalty(fillerWordCount, duration);
          
          // Property: Penalty should be non-negative
          expect(penalty).toBeGreaterThanOrEqual(0);

          // Property: More filler words should result in higher penalty
          if (fillerWordCount > 0) {
            const higherFillerPenalty = calculateFillerWordPenalty(fillerWordCount + 5, duration);
            expect(higherFillerPenalty).toBeGreaterThanOrEqual(penalty);
          }

          // Property: Zero filler words should result in zero penalty
          const zeroPenalty = calculateFillerWordPenalty(0, duration);
          expect(zeroPenalty).toBe(0);

          // Property: Longer duration should reduce penalty rate
          if (fillerWordCount > 0 && duration < 1800) {
            const longerDurationPenalty = calculateFillerWordPenalty(fillerWordCount, duration * 2);
            expect(longerDurationPenalty).toBeLessThanOrEqual(penalty);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metrics validation should correctly identify valid/invalid inputs
   */
  test('Property: Metrics validation accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // Valid metrics
          fc.record({
            pace: fc.integer({ min: 0, max: 500 }),
            fillerWordCount: fc.integer({ min: 0, max: 100 }),
            clarity: fc.integer({ min: 0, max: 100 }),
            confidence: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 1, max: 3600 })
          }),
          // Invalid metrics - missing fields
          fc.record({
            pace: fc.integer({ min: 0, max: 500 }),
            clarity: fc.integer({ min: 0, max: 100 })
            // Missing other required fields
          }),
          // Invalid metrics - wrong types
          fc.record({
            pace: fc.string(),
            fillerWordCount: fc.integer({ min: 0, max: 100 }),
            clarity: fc.integer({ min: 0, max: 100 }),
            confidence: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 1, max: 3600 })
          }),
          // Invalid metrics - out of range values
          fc.record({
            pace: fc.integer({ min: -100, max: -1 }),
            fillerWordCount: fc.integer({ min: 0, max: 100 }),
            clarity: fc.integer({ min: 101, max: 200 }),
            confidence: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 1, max: 3600 })
          })
        ),
        (metrics) => {
          const isValid = validateMetrics(metrics);
          
          // Property: Validation should return boolean
          expect(typeof isValid).toBe('boolean');

          // Property: Valid metrics should pass validation
          if (metrics && 
              typeof metrics.pace === 'number' && metrics.pace >= 0 &&
              typeof metrics.fillerWordCount === 'number' && metrics.fillerWordCount >= 0 &&
              typeof metrics.clarity === 'number' && metrics.clarity >= 0 && metrics.clarity <= 100 &&
              typeof metrics.confidence === 'number' && metrics.confidence >= 0 && metrics.confidence <= 100 &&
              typeof metrics.duration === 'number' && metrics.duration > 0) {
            expect(isValid).toBe(true);
          }

          // Property: Invalid metrics should fail validation
          if (!metrics || 
              typeof metrics.pace !== 'number' || metrics.pace < 0 ||
              typeof metrics.fillerWordCount !== 'number' || metrics.fillerWordCount < 0 ||
              typeof metrics.clarity !== 'number' || metrics.clarity < 0 || metrics.clarity > 100 ||
              typeof metrics.confidence !== 'number' || metrics.confidence < 0 || metrics.confidence > 100 ||
              typeof metrics.duration !== 'number' || metrics.duration <= 0) {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Session report should provide comprehensive scoring information
   */
  test('Property: Session report completeness', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          metrics: fc.record({
            pace: fc.integer({ min: 0, max: 500 }),
            fillerWordCount: fc.integer({ min: 0, max: 100 }),
            clarity: fc.integer({ min: 0, max: 100 }),
            confidence: fc.integer({ min: 0, max: 100 }),
            duration: fc.integer({ min: 1, max: 3600 })
          })
        }),
        (sessionData) => {
          const report = calculateSessionReport(sessionData);
          
          // Property: Report should contain all required fields
          expect(report).toHaveProperty('score');
          expect(report).toHaveProperty('grade');
          expect(report).toHaveProperty('paceScore');
          expect(report).toHaveProperty('fillerPenalty');
          expect(report).toHaveProperty('isValid');
          expect(report).toHaveProperty('breakdown');

          // Property: Score should be valid range
          expect(report.score).toBeGreaterThanOrEqual(0);
          expect(report.score).toBeLessThanOrEqual(100);

          // Property: Grade should be valid
          const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
          expect(validGrades).toContain(report.grade);

          // Property: Pace score should be valid range
          expect(report.paceScore).toBeGreaterThanOrEqual(0);
          expect(report.paceScore).toBeLessThanOrEqual(100);

          // Property: Filler penalty should be non-negative
          expect(report.fillerPenalty).toBeGreaterThanOrEqual(0);

          // Property: Breakdown should contain original metrics
          expect(report.breakdown.pace).toBe(report.paceScore);
          expect(report.breakdown.clarity).toBe(sessionData.metrics.clarity);
          expect(report.breakdown.confidence).toBe(sessionData.metrics.confidence);
          expect(report.breakdown.fillerWordCount).toBe(sessionData.metrics.fillerWordCount);
          expect(report.breakdown.duration).toBe(sessionData.metrics.duration);

          // Property: Valid metrics should result in valid report
          if (validateMetrics(sessionData.metrics)) {
            expect(report.isValid).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Grade calculation should be deterministic and consistent
   */
  test('Property: Grade calculation consistency', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const grade1 = calculateGrade(score);
          const grade2 = calculateGrade(score);
          
          // Property: Same score should always produce same grade
          expect(grade1).toBe(grade2);

          // Property: Grade should be appropriate for score
          if (score >= 95) expect(grade1).toBe('A+');
          else if (score >= 90) expect(grade1).toBe('A');
          else if (score >= 85) expect(grade1).toBe('A-');
          else if (score >= 80) expect(grade1).toBe('B+');
          else if (score >= 75) expect(grade1).toBe('B');
          else if (score >= 70) expect(grade1).toBe('B-');
          else if (score >= 65) expect(grade1).toBe('C+');
          else if (score >= 60) expect(grade1).toBe('C');
          else if (score >= 55) expect(grade1).toBe('C-');
          else if (score >= 50) expect(grade1).toBe('D');
          else expect(grade1).toBe('F');

          // Property: Higher scores should have better or equal grades
          if (score < 100) {
            const higherGrade = calculateGrade(score + 1);
            const gradeOrder = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
            const currentIndex = gradeOrder.indexOf(grade1);
            const higherIndex = gradeOrder.indexOf(higherGrade);
            expect(higherIndex).toBeGreaterThanOrEqual(currentIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid inputs should be handled gracefully
   */
  test('Property: Invalid input handling', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.array(fc.anything()),
          fc.record({
            invalidField: fc.anything()
          })
        ),
        (invalidInput) => {
          // Property: Invalid inputs should not crash and should return safe defaults
          expect(() => {
            const score = calculateSessionScore(invalidInput);
            expect(score).toBe(0);
          }).not.toThrow();

          expect(() => {
            const grade = calculateGrade(invalidInput);
            expect(grade).toBe('F');
          }).not.toThrow();

          expect(() => {
            const isValid = validateMetrics(invalidInput);
            expect(isValid).toBe(false);
          }).not.toThrow();

          expect(() => {
            const report = calculateSessionReport({ metrics: invalidInput });
            expect(report.score).toBe(0);
            expect(report.grade).toBe('F');
            expect(report.isValid).toBe(false);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});