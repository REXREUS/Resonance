import fc from 'fast-check';
import {
  detectHesitation,
  processTranscriptForReplay,
  createReplaySegment,
  validateTranscriptEntry,
  findHesitationSegments,
  getHesitationStatistics
} from '../hesitationDetector';

describe('Hesitation Detector Property Tests', () => {
  /**
   * **Feature: resonance-mobile-app, Property 15: Hesitation detection and replay**
   * **Validates: Requirements 6.4, 6.5**
   * 
   * Property: For any transcript with hesitation markers, clicking a segment should play the corresponding audio portion accurately
   */
  test('Property 15: Hesitation detection and replay', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            sender: fc.constantFrom('user', 'ai'),
            text: fc.oneof(
              // Normal text
              fc.string({ minLength: 5, maxLength: 100 }),
              // Text with hesitation patterns
              fc.string({ minLength: 5, maxLength: 50 }).map(s => s + ' um... uh... ' + s),
              fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '... ' + s + '...'),
              fc.string({ minLength: 5, maxLength: 50 }).map(s => s.split(' ').map(w => w + ' ' + w).join(' ')),
              fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '   ' + s) // Multiple spaces
            ),
            timestamp: fc.integer({ min: 0, max: 300000 }),
            audioPath: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.string({ minLength: 10, maxLength: 50 }).map(s => `/audio/${s}.wav`)
            )
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (transcript) => {
          const processed = processTranscriptForReplay(transcript);

          // Property: Processed transcript should contain all required fields
          expect(processed).toHaveProperty('entries');
          expect(processed).toHaveProperty('hesitationSummary');
          expect(processed).toHaveProperty('replaySegments');

          // Property: Entries should match input length
          expect(processed.entries).toHaveLength(transcript.length);

          // Property: Each processed entry should have hesitation data
          processed.entries.forEach((entry, index) => {
            expect(entry).toHaveProperty('hesitationData');
            expect(entry).toHaveProperty('segmentId');
            expect(entry).toHaveProperty('replayable');

            // Property: Segment ID should be unique and consistent
            expect(entry.segmentId).toBe(`segment_${index}`);

            // Property: Replayable should be true only if audioPath exists
            const hasAudioPath = Boolean(transcript[index].audioPath);
            expect(entry.replayable).toBe(hasAudioPath);

            // Property: Hesitation data should have required structure
            expect(entry.hesitationData).toHaveProperty('hasHesitation');
            expect(entry.hesitationData).toHaveProperty('patterns');
            expect(entry.hesitationData).toHaveProperty('confidence');
            expect(entry.hesitationData).toHaveProperty('markers');

            // Property: Hesitation detection should be consistent
            const directDetection = detectHesitation(transcript[index].text);
            expect(entry.hesitationData.hasHesitation).toBe(directDetection.hasHesitation);
            expect(entry.hesitationData.confidence).toBe(directDetection.confidence);
          });

          // Property: Hesitation summary should be accurate
          const summary = processed.hesitationSummary;
          expect(summary).toHaveProperty('totalHesitations');
          expect(summary).toHaveProperty('userHesitations');
          expect(summary).toHaveProperty('aiHesitations');
          expect(summary).toHaveProperty('hesitationRate');

          // Property: Hesitation counts should be non-negative
          expect(summary.totalHesitations).toBeGreaterThanOrEqual(0);
          expect(summary.userHesitations).toBeGreaterThanOrEqual(0);
          expect(summary.aiHesitations).toBeGreaterThanOrEqual(0);

          // Property: Total hesitations should equal sum of user and AI hesitations
          expect(summary.totalHesitations).toBe(summary.userHesitations + summary.aiHesitations);

          // Property: Hesitation rate should be between 0 and 1
          expect(summary.hesitationRate).toBeGreaterThanOrEqual(0);
          expect(summary.hesitationRate).toBeLessThanOrEqual(1);

          // Property: Replay segments should only include entries with hesitation and audio
          processed.replaySegments.forEach(segment => {
            expect(segment).toHaveProperty('segmentId');
            expect(segment).toHaveProperty('audioPath');
            expect(segment).toHaveProperty('hesitationData');
            expect(segment).toHaveProperty('startTime');
            expect(segment).toHaveProperty('endTime');

            // Property: Segment should have valid audio path
            expect(typeof segment.audioPath).toBe('string');
            expect(segment.audioPath.length).toBeGreaterThan(0);

            // Property: Segment should have hesitation
            expect(segment.hesitationData.hasHesitation).toBe(true);

            // Property: Start time should be before end time
            expect(segment.startTime).toBeLessThanOrEqual(segment.endTime);

            // Property: Times should be non-negative
            expect(segment.startTime).toBeGreaterThanOrEqual(0);
            expect(segment.endTime).toBeGreaterThanOrEqual(0);
          });

          // Property: Replay segments should be sorted by timestamp
          for (let i = 1; i < processed.replaySegments.length; i++) {
            expect(processed.replaySegments[i].startTime).toBeGreaterThanOrEqual(
              processed.replaySegments[i - 1].startTime
            );
          }

          // Property: Each replay segment should correspond to a processed entry
          processed.replaySegments.forEach(segment => {
            const matchingEntry = processed.entries.find(entry => 
              entry.segmentId === segment.segmentId
            );
            expect(matchingEntry).toBeDefined();
            expect(matchingEntry.hesitationData.hasHesitation).toBe(true);
            expect(matchingEntry.replayable).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hesitation detection should correctly identify hesitation patterns
   */
  test('Property: Hesitation detection accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // Text without hesitation
          fc.string({ minLength: 10, maxLength: 100 }).filter(s => 
            !s.includes('...') && !s.includes('um') && !s.includes('uh') && !/\s{3,}/.test(s)
          ),
          // Text with known hesitation patterns
          fc.string({ minLength: 5, maxLength: 50 }).map(s => s + ' um uh er ah'),
          fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '... ... ...'),
          fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '   ' + s), // Multiple spaces
          fc.string({ minLength: 5, maxLength: 50 }).map(s => s.split(' ')[0] + ' ' + s.split(' ')[0]) // Repeated words
        ),
        (text) => {
          const detection = detectHesitation(text);

          // Property: Detection should return valid structure
          expect(detection).toHaveProperty('hasHesitation');
          expect(detection).toHaveProperty('patterns');
          expect(detection).toHaveProperty('confidence');
          expect(detection).toHaveProperty('markers');
          expect(detection).toHaveProperty('totalMatches');
          expect(detection).toHaveProperty('hesitationDensity');

          // Property: Boolean fields should be boolean
          expect(typeof detection.hasHesitation).toBe('boolean');

          // Property: Arrays should be arrays
          expect(Array.isArray(detection.patterns)).toBe(true);
          expect(Array.isArray(detection.markers)).toBe(true);

          // Property: Numeric fields should be numbers
          expect(typeof detection.confidence).toBe('number');
          expect(typeof detection.totalMatches).toBe('number');
          expect(typeof detection.hesitationDensity).toBe('number');

          // Property: Confidence should be between 0 and 1
          expect(detection.confidence).toBeGreaterThanOrEqual(0);
          expect(detection.confidence).toBeLessThanOrEqual(1);

          // Property: Total matches should be non-negative
          expect(detection.totalMatches).toBeGreaterThanOrEqual(0);

          // Property: Hesitation density should be non-negative
          expect(detection.hesitationDensity).toBeGreaterThanOrEqual(0);

          // Property: Has hesitation should match total matches
          expect(detection.hasHesitation).toBe(detection.totalMatches > 0);

          // Property: Pattern count should match total matches
          const patternMatchSum = detection.patterns.reduce((sum, pattern) => sum + pattern.count, 0);
          expect(patternMatchSum).toBe(detection.totalMatches);

          // Property: Markers should match total matches
          expect(detection.markers).toHaveLength(detection.totalMatches);

          // Property: Each pattern should have valid structure
          detection.patterns.forEach(pattern => {
            expect(pattern).toHaveProperty('name');
            expect(pattern).toHaveProperty('description');
            expect(pattern).toHaveProperty('count');
            expect(pattern).toHaveProperty('matches');

            expect(typeof pattern.name).toBe('string');
            expect(typeof pattern.description).toBe('string');
            expect(typeof pattern.count).toBe('number');
            expect(Array.isArray(pattern.matches)).toBe(true);

            expect(pattern.count).toBeGreaterThan(0);
            expect(pattern.matches).toHaveLength(pattern.count);
          });

          // Property: Each marker should have valid structure
          detection.markers.forEach(marker => {
            expect(marker).toHaveProperty('position');
            expect(marker).toHaveProperty('length');
            expect(marker).toHaveProperty('type');
            expect(marker).toHaveProperty('text');

            expect(typeof marker.position).toBe('number');
            expect(typeof marker.length).toBe('number');
            expect(typeof marker.type).toBe('string');
            expect(typeof marker.text).toBe('string');

            expect(marker.position).toBeGreaterThanOrEqual(0);
            expect(marker.length).toBeGreaterThan(0);
            expect(marker.position + marker.length).toBeLessThanOrEqual(text.length);
          });

          // Property: Markers should be sorted by position
          for (let i = 1; i < detection.markers.length; i++) {
            expect(detection.markers[i].position).toBeGreaterThanOrEqual(
              detection.markers[i - 1].position
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transcript entry validation should correctly identify valid and invalid entries
   */
  test('Property: Transcript entry validation accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // Valid entries
          fc.record({
            sender: fc.constantFrom('user', 'ai'),
            text: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 0, max: 300000 }),
            audioPath: fc.string({ minLength: 5, maxLength: 50 })
          }),
          // Invalid entries - missing required fields
          fc.record({
            sender: fc.constantFrom('user', 'ai'),
            timestamp: fc.integer({ min: 0, max: 300000 })
            // Missing text
          }),
          // Invalid entries - wrong types
          fc.record({
            sender: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.string()
          }),
          // Invalid entries - invalid sender
          fc.record({
            sender: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 100 })
          }),
          // Null/undefined
          fc.constant(null),
          fc.constant(undefined)
        ),
        (entry) => {
          const isValid = validateTranscriptEntry(entry);

          // Property: Validation should return boolean
          expect(typeof isValid).toBe('boolean');

          // Property: Valid entries should pass validation
          if (entry && 
              typeof entry.text === 'string' &&
              ['user', 'ai'].includes(entry.sender) &&
              (entry.timestamp === undefined || typeof entry.timestamp === 'number') &&
              (entry.audioPath === undefined || typeof entry.audioPath === 'string')) {
            expect(isValid).toBe(true);
          }

          // Property: Invalid entries should fail validation
          if (!entry ||
              typeof entry.text !== 'string' ||
              !['user', 'ai'].includes(entry.sender) ||
              (entry.timestamp !== undefined && typeof entry.timestamp !== 'number') ||
              (entry.audioPath !== undefined && typeof entry.audioPath !== 'string')) {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Replay segment creation should produce valid segments
   */
  test('Property: Replay segment creation validity', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          sender: fc.constantFrom('user', 'ai'),
          text: fc.string({ minLength: 5, maxLength: 100 }),
          timestamp: fc.integer({ min: 0, max: 300000 }),
          audioPath: fc.string({ minLength: 5, maxLength: 50 }),
          segmentId: fc.string({ minLength: 5, maxLength: 20 })
        }),
        fc.integer({ min: 0, max: 300000 }),
        fc.integer({ min: 1000, max: 310000 }),
        (entry, startTime, endTime) => {
          // Ensure endTime > startTime
          const validEndTime = Math.max(startTime + 1000, endTime);
          
          const segment = createReplaySegment(entry, startTime, validEndTime);

          // Property: Segment should be created for valid entry
          expect(segment).not.toBeNull();
          expect(typeof segment).toBe('object');

          // Property: Segment should have all required fields
          expect(segment).toHaveProperty('segmentId');
          expect(segment).toHaveProperty('timestamp');
          expect(segment).toHaveProperty('audioPath');
          expect(segment).toHaveProperty('text');
          expect(segment).toHaveProperty('sender');
          expect(segment).toHaveProperty('hesitationData');
          expect(segment).toHaveProperty('startTime');
          expect(segment).toHaveProperty('endTime');
          expect(segment).toHaveProperty('duration');
          expect(segment).toHaveProperty('replayable');

          // Property: Segment fields should have correct types
          expect(typeof segment.segmentId).toBe('string');
          expect(typeof segment.timestamp).toBe('number');
          expect(typeof segment.audioPath).toBe('string');
          expect(typeof segment.text).toBe('string');
          expect(typeof segment.sender).toBe('string');
          expect(typeof segment.hesitationData).toBe('object');
          expect(typeof segment.startTime).toBe('number');
          expect(typeof segment.endTime).toBe('number');
          expect(typeof segment.duration).toBe('number');
          expect(typeof segment.replayable).toBe('boolean');

          // Property: Times should be consistent
          expect(segment.startTime).toBe(startTime);
          expect(segment.endTime).toBe(validEndTime);
          expect(segment.duration).toBe(validEndTime - startTime);

          // Property: Replayable should be true if audioPath exists
          expect(segment.replayable).toBe(Boolean(entry.audioPath));

          // Property: Hesitation data should be valid
          expect(segment.hesitationData).toHaveProperty('hasHesitation');
          expect(segment.hesitationData).toHaveProperty('confidence');
          expect(typeof segment.hesitationData.hasHesitation).toBe('boolean');
          expect(typeof segment.hesitationData.confidence).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hesitation segment finding should return accurate results
   */
  test('Property: Hesitation segment finding accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            sender: fc.constantFrom('user', 'ai'),
            text: fc.oneof(
              fc.string({ minLength: 5, maxLength: 50 }),
              fc.string({ minLength: 5, maxLength: 30 }).map(s => s + ' um uh er'),
              fc.string({ minLength: 5, maxLength: 30 }).map(s => s + '...')
            ),
            timestamp: fc.integer({ min: 0, max: 300000 }),
            audioPath: fc.oneof(
              fc.constant(null),
              fc.string({ minLength: 5, maxLength: 30 })
            )
          }),
          { minLength: 0, maxLength: 8 }
        ),
        fc.float({ min: 0, max: 1 }),
        (transcript, minConfidence) => {
          const hesitationSegments = findHesitationSegments(transcript, minConfidence);

          // Property: Result should be array
          expect(Array.isArray(hesitationSegments)).toBe(true);

          // Property: Each segment should have required structure
          hesitationSegments.forEach(segment => {
            expect(segment).toHaveProperty('index');
            expect(segment).toHaveProperty('entry');
            expect(segment).toHaveProperty('hesitationData');
            expect(segment).toHaveProperty('segmentId');
            expect(segment).toHaveProperty('replayable');

            expect(typeof segment.index).toBe('number');
            expect(typeof segment.entry).toBe('object');
            expect(typeof segment.hesitationData).toBe('object');
            expect(typeof segment.segmentId).toBe('string');
            expect(typeof segment.replayable).toBe('boolean');

            // Property: Index should be valid
            expect(segment.index).toBeGreaterThanOrEqual(0);
            expect(segment.index).toBeLessThan(transcript.length);

            // Property: Entry should match transcript entry
            expect(segment.entry).toBe(transcript[segment.index]);

            // Property: Should have hesitation above threshold
            expect(segment.hesitationData.hasHesitation).toBe(true);
            expect(segment.hesitationData.confidence).toBeGreaterThanOrEqual(minConfidence);

            // Property: Replayable should match audio availability
            expect(segment.replayable).toBe(Boolean(segment.entry.audioPath));
          });

          // Property: All segments should be from valid transcript entries
          hesitationSegments.forEach(segment => {
            expect(validateTranscriptEntry(segment.entry)).toBe(true);
          });

          // Property: Segments should be sorted by index
          for (let i = 1; i < hesitationSegments.length; i++) {
            expect(hesitationSegments[i].index).toBeGreaterThan(
              hesitationSegments[i - 1].index
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hesitation statistics should provide accurate analysis
   */
  test('Property: Hesitation statistics accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            sender: fc.constantFrom('user', 'ai'),
            text: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 0, max: 300000 })
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (transcript) => {
          const stats = getHesitationStatistics(transcript);

          // Property: Stats should have all required fields
          expect(stats).toHaveProperty('totalEntries');
          expect(stats).toHaveProperty('entriesWithHesitation');
          expect(stats).toHaveProperty('hesitationRate');
          expect(stats).toHaveProperty('averageConfidence');
          expect(stats).toHaveProperty('patternBreakdown');
          expect(stats).toHaveProperty('userVsAiHesitation');

          // Property: Counts should be accurate
          expect(stats.totalEntries).toBe(transcript.length);
          expect(stats.entriesWithHesitation).toBeGreaterThanOrEqual(0);
          expect(stats.entriesWithHesitation).toBeLessThanOrEqual(transcript.length);

          // Property: Rates should be between 0 and 1
          expect(stats.hesitationRate).toBeGreaterThanOrEqual(0);
          expect(stats.hesitationRate).toBeLessThanOrEqual(1);
          expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
          expect(stats.averageConfidence).toBeLessThanOrEqual(1);

          // Property: Pattern breakdown should be object with numeric values
          expect(typeof stats.patternBreakdown).toBe('object');
          Object.values(stats.patternBreakdown).forEach(count => {
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
          });

          // Property: User vs AI stats should have correct structure
          expect(stats.userVsAiHesitation).toHaveProperty('user');
          expect(stats.userVsAiHesitation).toHaveProperty('ai');
          
          ['user', 'ai'].forEach(sender => {
            const senderStats = stats.userVsAiHesitation[sender];
            expect(senderStats).toHaveProperty('count');
            expect(senderStats).toHaveProperty('rate');
            expect(typeof senderStats.count).toBe('number');
            expect(typeof senderStats.rate).toBe('number');
            expect(senderStats.count).toBeGreaterThanOrEqual(0);
            expect(senderStats.rate).toBeGreaterThanOrEqual(0);
            expect(senderStats.rate).toBeLessThanOrEqual(1);
          });

          // Property: Hesitation rate should match calculation
          const expectedRate = transcript.length > 0 ? stats.entriesWithHesitation / transcript.length : 0;
          expect(Math.abs(stats.hesitationRate - expectedRate)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid input handling should be graceful
   */
  test('Property: Invalid input handling', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.array(fc.anything())
        ),
        (invalidInput) => {
          // Property: Functions should not crash with invalid input
          expect(() => {
            const detection = detectHesitation(invalidInput);
            expect(detection).toHaveProperty('hasHesitation');
            expect(detection.hasHesitation).toBe(false);
          }).not.toThrow();

          expect(() => {
            const processed = processTranscriptForReplay(invalidInput);
            expect(processed).toHaveProperty('entries');
            // Array inputs will be processed, but invalid entries will have default hesitation data
            if (!Array.isArray(invalidInput)) {
              expect(processed.entries).toHaveLength(0);
            }
          }).not.toThrow();

          expect(() => {
            const isValid = validateTranscriptEntry(invalidInput);
            expect(isValid).toBe(false);
          }).not.toThrow();

          expect(() => {
            const segments = findHesitationSegments(invalidInput);
            expect(Array.isArray(segments)).toBe(true);
            expect(segments).toHaveLength(0);
          }).not.toThrow();

          expect(() => {
            const stats = getHesitationStatistics(invalidInput);
            expect(typeof stats.totalEntries).toBe('number');
            expect(stats.totalEntries).toBeGreaterThanOrEqual(0);
            // Array inputs will be processed, but invalid entries will be filtered
            if (!Array.isArray(invalidInput)) {
              expect(stats.totalEntries).toBe(0);
            }
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});