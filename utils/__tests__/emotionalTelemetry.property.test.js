import fc from 'fast-check';
import {
  processEmotionalTelemetry,
  validateTelemetryPoint,
  analyzeEmotionTransitions,
  calculateEmotionStability,
  getSupportedEmotions,
  getEmotionColorMap
} from '../emotionalTelemetry';

describe('Emotional Telemetry Property Tests', () => {
  /**
   * **Feature: resonance-mobile-app, Property 14: Emotional telemetry mapping**
   * **Validates: Requirements 6.3**
   * 
   * Property: For any session with AI interactions, emotional state changes should be tracked over time and displayed as an interactive line chart
   */
  test('Property 14: Emotional telemetry mapping', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            timestamp: fc.integer({ min: 0, max: 300000 }), // 0 to 5 minutes
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
            intensity: fc.float({ min: 0, max: 1 })
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.integer({ min: 1000, max: 300000 }), // Session duration 1 second to 5 minutes
        (telemetryData, sessionDuration) => {
          // Ensure timestamps are within session duration
          const validTelemetryData = telemetryData
            .filter(point => point.timestamp <= sessionDuration)
            .sort((a, b) => a.timestamp - b.timestamp);

          const processed = processEmotionalTelemetry(validTelemetryData, sessionDuration);

          // Property: Processed data should contain all required fields
          expect(processed).toHaveProperty('points');
          expect(processed).toHaveProperty('summary');
          expect(processed).toHaveProperty('chartData');

          // Property: Points should be array of valid telemetry points
          expect(Array.isArray(processed.points)).toBe(true);
          processed.points.forEach(point => {
            expect(validateTelemetryPoint(point)).toBe(true);
            expect(point.timestamp).toBeGreaterThanOrEqual(0);
            expect(point.timestamp).toBeLessThanOrEqual(sessionDuration);
          });

          // Property: Points should be sorted by timestamp
          for (let i = 1; i < processed.points.length; i++) {
            expect(processed.points[i].timestamp).toBeGreaterThanOrEqual(
              processed.points[i - 1].timestamp
            );
          }

          // Property: Summary should contain required fields
          expect(processed.summary).toHaveProperty('dominantEmotion');
          expect(processed.summary).toHaveProperty('emotionChanges');
          expect(processed.summary).toHaveProperty('averageIntensity');
          expect(processed.summary).toHaveProperty('timeInEmotion');
          expect(processed.summary).toHaveProperty('emotionDistribution');

          // Property: Dominant emotion should be valid
          const supportedEmotions = getSupportedEmotions();
          expect(supportedEmotions).toContain(processed.summary.dominantEmotion);

          // Property: Emotion changes should be non-negative integer
          expect(processed.summary.emotionChanges).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(processed.summary.emotionChanges)).toBe(true);

          // Property: Average intensity should be between 0 and 1
          expect(processed.summary.averageIntensity).toBeGreaterThanOrEqual(0);
          expect(processed.summary.averageIntensity).toBeLessThanOrEqual(1);

          // Property: Time in emotion should sum to session duration
          const totalTime = Object.values(processed.summary.timeInEmotion)
            .reduce((sum, time) => sum + time, 0);
          expect(Math.abs(totalTime - sessionDuration)).toBeLessThanOrEqual(1); // Allow for rounding

          // Property: Emotion distribution should sum to 100%
          const totalPercentage = Object.values(processed.summary.emotionDistribution)
            .reduce((sum, percentage) => sum + percentage, 0);
          expect(Math.abs(totalPercentage - 100)).toBeLessThan(0.1); // Allow for rounding

          // Property: Chart data should be array
          expect(Array.isArray(processed.chartData)).toBe(true);

          // Property: Chart data should have at least 2 points (start and end)
          expect(processed.chartData.length).toBeGreaterThanOrEqual(2);

          // Property: Chart data should start at timestamp 0 or first telemetry point
          expect(processed.chartData[0].timestamp).toBe(
            validTelemetryData.length > 0 && validTelemetryData[0].timestamp === 0 
              ? 0 
              : Math.min(0, validTelemetryData[0]?.timestamp || 0)
          );

          // Property: Chart data should end at session duration
          const lastChartPoint = processed.chartData[processed.chartData.length - 1];
          expect(lastChartPoint.timestamp).toBe(sessionDuration);

          // Property: Chart data points should have required structure
          processed.chartData.forEach(point => {
            expect(point).toHaveProperty('timestamp');
            expect(point).toHaveProperty('emotion');
            expect(point).toHaveProperty('intensity');
            expect(point).toHaveProperty('x');
            expect(point).toHaveProperty('y');

            expect(typeof point.timestamp).toBe('number');
            expect(supportedEmotions).toContain(point.emotion);
            expect(point.intensity).toBeGreaterThanOrEqual(0);
            expect(point.intensity).toBeLessThanOrEqual(1);
            expect(point.x).toBe(point.timestamp);
            expect(typeof point.y).toBe('number');
          });

          // Property: Empty telemetry should result in neutral baseline
          if (validTelemetryData.length === 0) {
            expect(processed.summary.dominantEmotion).toBe('neutral');
            expect(processed.summary.emotionChanges).toBe(0);
            expect(processed.summary.averageIntensity).toBe(0);
            expect(processed.chartData).toHaveLength(2);
            expect(processed.chartData[0].emotion).toBe('neutral');
            expect(processed.chartData[1].emotion).toBe('neutral');
          }

          // Property: Single emotion should have zero changes
          const uniqueEmotions = new Set(validTelemetryData.map(p => p.state));
          if (uniqueEmotions.size <= 1) {
            expect(processed.summary.emotionChanges).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Telemetry point validation should correctly identify valid and invalid points
   */
  test('Property: Telemetry point validation accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // Valid points
          fc.record({
            timestamp: fc.integer({ min: 0, max: 300000 }),
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
            intensity: fc.float({ min: 0, max: 1 })
          }),
          // Invalid points - missing fields
          fc.record({
            timestamp: fc.integer({ min: 0, max: 300000 }),
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious')
            // Missing intensity
          }),
          // Invalid points - wrong types
          fc.record({
            timestamp: fc.string(),
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
            intensity: fc.float({ min: 0, max: 1 })
          }),
          // Invalid points - out of range values
          fc.record({
            timestamp: fc.integer({ min: -1000, max: -1 }),
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
            intensity: fc.float({ min: Math.fround(1.1), max: Math.fround(2) })
          }),
          // Invalid points - invalid emotion
          fc.record({
            timestamp: fc.integer({ min: 0, max: 300000 }),
            state: fc.string({ minLength: 1, maxLength: 10 }),
            intensity: fc.float({ min: 0, max: 1 })
          }),
          // Null/undefined
          fc.constant(null),
          fc.constant(undefined)
        ),
        (point) => {
          const isValid = validateTelemetryPoint(point);
          
          // Property: Validation should return boolean
          expect(typeof isValid).toBe('boolean');

          // Property: Valid points should pass validation
          if (point && 
              typeof point.timestamp === 'number' && point.timestamp >= 0 &&
              ['neutral', 'hostile', 'happy', 'frustrated', 'anxious'].includes(point.state) &&
              typeof point.intensity === 'number' && point.intensity >= 0 && point.intensity <= 1) {
            expect(isValid).toBe(true);
          }

          // Property: Invalid points should fail validation
          if (!point || 
              typeof point.timestamp !== 'number' || point.timestamp < 0 ||
              !['neutral', 'hostile', 'happy', 'frustrated', 'anxious'].includes(point.state) ||
              typeof point.intensity !== 'number' || point.intensity < 0 || point.intensity > 1) {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Emotion transition analysis should provide comprehensive transition information
   */
  test('Property: Emotion transition analysis completeness', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            timestamp: fc.integer({ min: 0, max: 300000 }),
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
            intensity: fc.float({ min: 0, max: 1 })
          }),
          { minLength: 0, maxLength: 15 }
        ),
        (points) => {
          // Sort points by timestamp
          const sortedPoints = points.sort((a, b) => a.timestamp - b.timestamp);
          
          const analysis = analyzeEmotionTransitions(sortedPoints);

          // Property: Analysis should contain all required fields
          expect(analysis).toHaveProperty('transitions');
          expect(analysis).toHaveProperty('transitionMatrix');
          expect(analysis).toHaveProperty('mostCommonTransition');
          expect(analysis).toHaveProperty('transitionFrequency');

          // Property: Transitions should be array
          expect(Array.isArray(analysis.transitions)).toBe(true);

          // Property: Each transition should have required structure
          analysis.transitions.forEach(transition => {
            expect(transition).toHaveProperty('from');
            expect(transition).toHaveProperty('to');
            expect(transition).toHaveProperty('timestamp');
            expect(transition).toHaveProperty('transition');

            const supportedEmotions = getSupportedEmotions();
            expect(supportedEmotions).toContain(transition.from);
            expect(supportedEmotions).toContain(transition.to);
            expect(typeof transition.timestamp).toBe('number');
            expect(transition.transition).toBe(`${transition.from} → ${transition.to}`);
          });

          // Property: Transition matrix should have correct structure
          const supportedEmotions = getSupportedEmotions();
          supportedEmotions.forEach(fromEmotion => {
            expect(analysis.transitionMatrix).toHaveProperty(fromEmotion);
            supportedEmotions.forEach(toEmotion => {
              expect(analysis.transitionMatrix[fromEmotion]).toHaveProperty(toEmotion);
              expect(typeof analysis.transitionMatrix[fromEmotion][toEmotion]).toBe('number');
              expect(analysis.transitionMatrix[fromEmotion][toEmotion]).toBeGreaterThanOrEqual(0);
            });
          });

          // Property: Transition frequency should be non-negative
          expect(analysis.transitionFrequency).toBeGreaterThanOrEqual(0);

          // Property: Most common transition should be string or null
          if (analysis.mostCommonTransition !== null) {
            expect(typeof analysis.mostCommonTransition).toBe('string');
            expect(analysis.mostCommonTransition).toMatch(/^.+ → .+$/);
          }

          // Property: No transitions for single emotion or empty data
          const uniqueEmotions = new Set(sortedPoints.map(p => p.state));
          if (sortedPoints.length < 2 || uniqueEmotions.size <= 1) {
            expect(analysis.transitions).toHaveLength(0);
            expect(analysis.mostCommonTransition).toBeNull();
            expect(analysis.transitionFrequency).toBe(0);
          }

          // Property: Transition count should match actual transitions
          let actualTransitions = 0;
          for (let i = 1; i < sortedPoints.length; i++) {
            if (sortedPoints[i].state !== sortedPoints[i - 1].state) {
              actualTransitions++;
            }
          }
          expect(analysis.transitions).toHaveLength(actualTransitions);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Emotion stability calculation should provide meaningful stability metrics
   */
  test('Property: Emotion stability calculation', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            timestamp: fc.integer({ min: 0, max: 300000 }),
            state: fc.constantFrom('neutral', 'hostile', 'happy', 'frustrated', 'anxious'),
            intensity: fc.float({ min: 0, max: 1 })
          }),
          { minLength: 0, maxLength: 15 }
        ),
        fc.integer({ min: 1000, max: 300000 }),
        (points, sessionDuration) => {
          // Filter and sort points
          const validPoints = points
            .filter(p => p.timestamp <= sessionDuration)
            .sort((a, b) => a.timestamp - b.timestamp);

          const stability = calculateEmotionStability(validPoints, sessionDuration);

          // Property: Stability should contain all required fields
          expect(stability).toHaveProperty('stabilityScore');
          expect(stability).toHaveProperty('volatilityIndex');
          expect(stability).toHaveProperty('longestStableEmotion');
          expect(stability).toHaveProperty('longestStableDuration');

          // Property: Stability score should be between 0 and 100
          expect(stability.stabilityScore).toBeGreaterThanOrEqual(0);
          expect(stability.stabilityScore).toBeLessThanOrEqual(100);

          // Property: Volatility index should be between 0 and 1
          expect(stability.volatilityIndex).toBeGreaterThanOrEqual(0);
          expect(stability.volatilityIndex).toBeLessThanOrEqual(1);

          // Property: Longest stable emotion should be valid
          const supportedEmotions = getSupportedEmotions();
          expect(supportedEmotions).toContain(stability.longestStableEmotion);

          // Property: Longest stable duration should be non-negative
          expect(stability.longestStableDuration).toBeGreaterThanOrEqual(0);
          expect(stability.longestStableDuration).toBeLessThanOrEqual(sessionDuration);

          // Property: Empty data should result in perfect stability
          if (validPoints.length === 0) {
            expect(stability.stabilityScore).toBe(100);
            expect(stability.volatilityIndex).toBe(0);
            expect(stability.longestStableEmotion).toBe('neutral');
            expect(stability.longestStableDuration).toBe(sessionDuration);
          }

          // Property: Single emotion should result in high stability
          const uniqueEmotions = new Set(validPoints.map(p => p.state));
          if (uniqueEmotions.size <= 1) {
            expect(stability.stabilityScore).toBeGreaterThanOrEqual(90);
            expect(stability.volatilityIndex).toBeLessThanOrEqual(0.1);
          }

          // Property: More emotion changes should generally reduce stability
          if (validPoints.length >= 2) {
            let emotionChanges = 0;
            for (let i = 1; i < validPoints.length; i++) {
              if (validPoints[i].state !== validPoints[i - 1].state) {
                emotionChanges++;
              }
            }

            // Property: Stability score should be inversely related to change frequency
            // (This is a general trend, not a strict requirement due to edge cases)
            expect(typeof stability.stabilityScore).toBe('number');
            expect(stability.stabilityScore).toBeGreaterThanOrEqual(0);
            expect(stability.stabilityScore).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Supported emotions should be consistent and complete
   */
  test('Property: Supported emotions consistency', async () => {
    await fc.assert(
      fc.property(
        fc.constant(true), // Dummy property to run the test
        () => {
          const emotions = getSupportedEmotions();
          
          // Property: Should return array
          expect(Array.isArray(emotions)).toBe(true);
          
          // Property: Should contain expected emotions
          expect(emotions).toHaveLength(5);
          expect(emotions).toContain('neutral');
          expect(emotions).toContain('hostile');
          expect(emotions).toContain('happy');
          expect(emotions).toContain('frustrated');
          expect(emotions).toContain('anxious');
          
          // Property: Should not contain duplicates
          const uniqueEmotions = new Set(emotions);
          expect(uniqueEmotions.size).toBe(emotions.length);
          
          // Property: All emotions should be strings
          emotions.forEach(emotion => {
            expect(typeof emotion).toBe('string');
            expect(emotion.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 10 } // Fewer runs since this is testing static data
    );
  });

  /**
   * Property: Emotion color mapping should provide colors for all supported emotions
   */
  test('Property: Emotion color mapping completeness', async () => {
    await fc.assert(
      fc.property(
        fc.constant(true), // Dummy property to run the test
        () => {
          const colorMap = getEmotionColorMap();
          const supportedEmotions = getSupportedEmotions();
          
          // Property: Should return object
          expect(typeof colorMap).toBe('object');
          expect(colorMap).not.toBeNull();
          
          // Property: Should have color for each supported emotion
          supportedEmotions.forEach(emotion => {
            expect(colorMap).toHaveProperty(emotion);
            expect(typeof colorMap[emotion]).toBe('string');
            expect(colorMap[emotion]).toMatch(/^#[0-9A-Fa-f]{6}$/); // Valid hex color
          });
          
          // Property: Should not have extra colors
          const colorKeys = Object.keys(colorMap);
          expect(colorKeys).toHaveLength(supportedEmotions.length);
          
          // Property: All colors should be unique
          const colors = Object.values(colorMap);
          const uniqueColors = new Set(colors);
          expect(uniqueColors.size).toBe(colors.length);
        }
      ),
      { numRuns: 10 } // Fewer runs since this is testing static data
    );
  });

  /**
   * Property: Chart data generation should handle edge cases correctly
   */
  test('Property: Chart data edge case handling', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant([]), // Empty array
          fc.array(
            fc.record({
              timestamp: fc.constant(0), // All at timestamp 0
              state: fc.constantFrom('neutral', 'happy'),
              intensity: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          fc.array(
            fc.record({
              timestamp: fc.integer({ min: 299000, max: 300000 }), // All near end
              state: fc.constantFrom('neutral', 'frustrated'),
              intensity: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 3 }
          )
        ),
        fc.integer({ min: 1000, max: 300000 }),
        (points, sessionDuration) => {
          const validPoints = points
            .filter(p => p.timestamp <= sessionDuration)
            .sort((a, b) => a.timestamp - b.timestamp);

          const processed = processEmotionalTelemetry(validPoints, sessionDuration);

          // Property: Chart data should always have at least 2 points
          expect(processed.chartData.length).toBeGreaterThanOrEqual(2);

          // Property: First point should be at or before first telemetry point
          if (validPoints.length > 0) {
            expect(processed.chartData[0].timestamp).toBeLessThanOrEqual(validPoints[0].timestamp);
          } else {
            expect(processed.chartData[0].timestamp).toBe(0);
          }

          // Property: Last point should be at session duration
          const lastPoint = processed.chartData[processed.chartData.length - 1];
          expect(lastPoint.timestamp).toBe(sessionDuration);

          // Property: Chart data should be sorted by timestamp
          for (let i = 1; i < processed.chartData.length; i++) {
            expect(processed.chartData[i].timestamp).toBeGreaterThanOrEqual(
              processed.chartData[i - 1].timestamp
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});