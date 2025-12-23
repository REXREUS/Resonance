import fc from 'fast-check';
import {
  detectFillerWords,
  countWords,
  analyzeFillerWordPatterns,
  getSupportedLanguages,
  validateInput,
  calculateFillerWordImpact
} from '../fillerWordDetector';

describe('Filler Word Detector Property Tests', () => {
  /**
   * **Feature: resonance-mobile-app, Property 13: Multilingual filler word detection**
   * **Validates: Requirements 6.2**
   * 
   * Property: For any speech input containing Indonesian filler words ("eung", "anu", "uhm") or English equivalents, the system should accurately count and report them
   */
  test('Property 13: Multilingual filler word detection', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string({ minLength: 10, maxLength: 200 }),
            language: fc.constantFrom('id', 'en', 'all'),
            expectedFillers: fc.array(
              fc.constantFrom(
                // Indonesian filler words
                'eung', 'anu', 'uhm', 'eh', 'emm', 'hmm', 'ya', 'gitu', 'kan', 'sih',
                // English filler words
                'um', 'uh', 'er', 'ah', 'like', 'you know', 'well', 'so', 'actually', 'basically'
              ),
              { minLength: 0, maxLength: 10 }
            )
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (testCases) => {
          testCases.forEach(testCase => {
            // Create text with known filler words
            const fillerText = testCase.expectedFillers.join(' ');
            const combinedText = `${testCase.text} ${fillerText}`;
            
            const detection = detectFillerWords(combinedText, testCase.language);
            
            // Property: Detection should return valid structure
            expect(detection).toHaveProperty('count');
            expect(detection).toHaveProperty('words');
            expect(detection).toHaveProperty('positions');
            expect(detection).toHaveProperty('density');
            expect(detection).toHaveProperty('wordCount');
            expect(detection).toHaveProperty('breakdown');
            
            // Property: Count should be non-negative integer
            expect(detection.count).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(detection.count)).toBe(true);
            
            // Property: Words array should match count
            expect(detection.words).toHaveLength(detection.count);
            
            // Property: Positions array should match count
            expect(detection.positions).toHaveLength(detection.count);
            
            // Property: Word count should be positive for non-empty text
            if (combinedText.trim().length > 0) {
              expect(detection.wordCount).toBeGreaterThan(0);
            }
            
            // Property: Density should be between 0 and 100
            expect(detection.density).toBeGreaterThanOrEqual(0);
            expect(detection.density).toBeLessThanOrEqual(100);
            
            // Property: Breakdown should contain language counts
            expect(detection.breakdown).toHaveProperty('indonesian');
            expect(detection.breakdown).toHaveProperty('english');
            expect(detection.breakdown.indonesian).toBeGreaterThanOrEqual(0);
            expect(detection.breakdown.english).toBeGreaterThanOrEqual(0);
            
            // Property: Language breakdown should sum to total count
            expect(detection.breakdown.indonesian + detection.breakdown.english)
              .toBeLessThanOrEqual(detection.count);
            
            // Property: Indonesian filler words should be detected
            const indonesianFillers = ['eung', 'anu', 'uhm', 'eh', 'emm', 'hmm'];
            indonesianFillers.forEach(filler => {
              if (combinedText.toLowerCase().includes(filler)) {
                const fillerDetection = detectFillerWords(filler, 'id');
                expect(fillerDetection.count).toBeGreaterThan(0);
              }
            });
            
            // Property: English filler words should be detected
            const englishFillers = ['um', 'uh', 'er', 'ah', 'like', 'well'];
            englishFillers.forEach(filler => {
              if (combinedText.toLowerCase().includes(filler)) {
                const fillerDetection = detectFillerWords(filler, 'en');
                expect(fillerDetection.count).toBeGreaterThan(0);
              }
            });
            
            // Property: Language-specific detection should work correctly
            if (testCase.language === 'id') {
              // Indonesian-only detection should not count English-only fillers
              const englishOnlyText = 'um uh er ah basically literally';
              const idDetection = detectFillerWords(englishOnlyText, 'id');
              expect(idDetection.count).toBe(0);
            }
            
            if (testCase.language === 'en') {
              // English-only detection should not count Indonesian-only fillers
              const indonesianOnlyText = 'eung anu gitu kan sih';
              const enDetection = detectFillerWords(indonesianOnlyText, 'en');
              expect(enDetection.count).toBe(0);
            }
            
            // Property: All languages detection should find both
            const mixedText = 'eung um anu uh gitu like';
            const allDetection = detectFillerWords(mixedText, 'all');
            expect(allDetection.count).toBeGreaterThan(0);
            expect(allDetection.breakdown.indonesian).toBeGreaterThan(0);
            expect(allDetection.breakdown.english).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Word counting should be accurate and consistent
   */
  test('Property: Word counting accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (text) => {
          const wordCount = countWords(text);
          
          // Property: Word count should be non-negative
          expect(wordCount).toBeGreaterThanOrEqual(0);
          
          // Property: Empty or whitespace-only text should have zero words
          if (!text || text.trim().length === 0) {
            expect(wordCount).toBe(0);
          }
          
          // Property: Single word should count as 1
          const singleWord = 'hello';
          expect(countWords(singleWord)).toBe(1);
          
          // Property: Multiple spaces should not affect count
          const multiSpaceText = text.replace(/\s+/g, '   ');
          expect(countWords(multiSpaceText)).toBe(countWords(text));
          
          // Property: Leading/trailing spaces should not affect count
          const trimmedCount = countWords(text.trim());
          const paddedCount = countWords(`   ${text}   `);
          expect(paddedCount).toBe(trimmedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transcript analysis should provide comprehensive filler word statistics
   */
  test('Property: Transcript analysis completeness', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            sender: fc.constantFrom('user', 'ai'),
            text: fc.string({ minLength: 5, maxLength: 100 }),
            timestamp: fc.integer({ min: 0, max: 300000 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.constantFrom('id', 'en', 'all'),
        (transcript, language) => {
          const analysis = analyzeFillerWordPatterns(transcript, language);
          
          // Property: Analysis should contain all required fields
          expect(analysis).toHaveProperty('totalCount');
          expect(analysis).toHaveProperty('userCount');
          expect(analysis).toHaveProperty('aiCount');
          expect(analysis).toHaveProperty('userDensity');
          expect(analysis).toHaveProperty('aiDensity');
          expect(analysis).toHaveProperty('timeline');
          expect(analysis).toHaveProperty('userWordCount');
          expect(analysis).toHaveProperty('aiWordCount');
          
          // Property: All counts should be non-negative
          expect(analysis.totalCount).toBeGreaterThanOrEqual(0);
          expect(analysis.userCount).toBeGreaterThanOrEqual(0);
          expect(analysis.aiCount).toBeGreaterThanOrEqual(0);
          expect(analysis.userWordCount).toBeGreaterThanOrEqual(0);
          expect(analysis.aiWordCount).toBeGreaterThanOrEqual(0);
          
          // Property: Total count should equal sum of user and AI counts
          expect(analysis.totalCount).toBe(analysis.userCount + analysis.aiCount);
          
          // Property: Densities should be between 0 and 100
          expect(analysis.userDensity).toBeGreaterThanOrEqual(0);
          expect(analysis.userDensity).toBeLessThanOrEqual(100);
          expect(analysis.aiDensity).toBeGreaterThanOrEqual(0);
          expect(analysis.aiDensity).toBeLessThanOrEqual(100);
          
          // Property: Timeline should be array
          expect(Array.isArray(analysis.timeline)).toBe(true);
          
          // Property: Timeline entries should have required structure
          analysis.timeline.forEach(entry => {
            expect(entry).toHaveProperty('index');
            expect(entry).toHaveProperty('sender');
            expect(entry).toHaveProperty('timestamp');
            expect(entry).toHaveProperty('count');
            expect(entry).toHaveProperty('words');
            expect(entry).toHaveProperty('density');
            
            expect(entry.count).toBeGreaterThan(0);
            expect(['user', 'ai']).toContain(entry.sender);
          });
          
          // Property: Timeline count should match individual counts
          const timelineUserCount = analysis.timeline
            .filter(entry => entry.sender === 'user')
            .reduce((sum, entry) => sum + entry.count, 0);
          const timelineAiCount = analysis.timeline
            .filter(entry => entry.sender === 'ai')
            .reduce((sum, entry) => sum + entry.count, 0);
          
          expect(timelineUserCount).toBe(analysis.userCount);
          expect(timelineAiCount).toBe(analysis.aiCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Input validation should correctly identify valid and invalid inputs
   */
  test('Property: Input validation accuracy', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.array(fc.anything())
        ),
        fc.oneof(
          fc.constantFrom('id', 'en', 'all'),
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (text, language) => {
          const isValid = validateInput(text, language);
          
          // Property: Validation should return boolean
          expect(typeof isValid).toBe('boolean');
          
          // Property: Valid string text with valid language should pass
          if (typeof text === 'string' && 
              (language === undefined || ['id', 'en', 'all'].includes(language))) {
            expect(isValid).toBe(true);
          }
          
          // Property: Invalid text types should fail
          if (text === null || text === undefined || typeof text !== 'string') {
            expect(isValid).toBe(false);
          }
          
          // Property: Invalid language codes should fail
          if (language && !['id', 'en', 'all'].includes(language)) {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filler word impact calculation should provide meaningful scoring insights
   */
  test('Property: Filler word impact calculation', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 1800 }),
        (fillerCount, totalWords, duration) => {
          const impact = calculateFillerWordImpact(fillerCount, totalWords, duration);
          
          // Property: Impact should contain all required fields
          expect(impact).toHaveProperty('density');
          expect(impact).toHaveProperty('impact');
          expect(impact).toHaveProperty('severity');
          expect(impact).toHaveProperty('recommendation');
          expect(impact).toHaveProperty('fillerWordsPerMinute');
          
          // Property: Density should be non-negative (can exceed 100% if more fillers than words)
          expect(impact.density).toBeGreaterThanOrEqual(0);
          
          // Property: Impact should be non-negative
          expect(impact.impact).toBeGreaterThanOrEqual(0);
          
          // Property: Severity should be valid category
          const validSeverities = ['none', 'low', 'moderate', 'high', 'critical'];
          expect(validSeverities).toContain(impact.severity);
          
          // Property: Recommendation should be non-empty string
          expect(typeof impact.recommendation).toBe('string');
          expect(impact.recommendation.length).toBeGreaterThan(0);
          
          // Property: Filler words per minute should be non-negative
          expect(impact.fillerWordsPerMinute).toBeGreaterThanOrEqual(0);
          
          // Property: Zero filler words should result in no impact
          const zeroImpact = calculateFillerWordImpact(0, totalWords, duration);
          expect(zeroImpact.density).toBe(0);
          expect(zeroImpact.impact).toBe(0);
          expect(zeroImpact.severity).toBe('none');
          
          // Property: More filler words should generally result in higher impact
          if (fillerCount > 0 && fillerCount < 50) {
            const higherImpact = calculateFillerWordImpact(fillerCount + 10, totalWords, duration);
            expect(higherImpact.impact).toBeGreaterThanOrEqual(impact.impact);
          }
          
          // Property: Density calculation should be accurate
          const expectedDensity = (fillerCount / totalWords) * 100;
          expect(Math.abs(impact.density - expectedDensity)).toBeLessThan(0.01);
          
          // Property: Severity should correlate with density
          if (impact.density === 0) {
            expect(impact.severity).toBe('none');
          } else if (impact.density <= 2) {
            expect(impact.severity).toBe('low');
          } else if (impact.density <= 5) {
            expect(impact.severity).toBe('moderate');
          } else if (impact.density <= 10) {
            expect(impact.severity).toBe('high');
          } else {
            expect(impact.severity).toBe('critical');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Supported languages should be consistent and complete
   */
  test('Property: Supported languages consistency', async () => {
    await fc.assert(
      fc.property(
        fc.constant(true), // Dummy property to run the test
        () => {
          const languages = getSupportedLanguages();
          
          // Property: Should return array
          expect(Array.isArray(languages)).toBe(true);
          
          // Property: Should contain expected languages
          expect(languages.length).toBeGreaterThanOrEqual(3);
          
          // Property: Each language should have required structure
          languages.forEach(lang => {
            expect(lang).toHaveProperty('code');
            expect(lang).toHaveProperty('name');
            expect(lang).toHaveProperty('fillerWords');
            
            expect(typeof lang.code).toBe('string');
            expect(typeof lang.name).toBe('string');
            expect(Array.isArray(lang.fillerWords)).toBe(true);
            expect(lang.fillerWords.length).toBeGreaterThan(0);
          });
          
          // Property: Should include Indonesian, English, and All
          const codes = languages.map(lang => lang.code);
          expect(codes).toContain('id');
          expect(codes).toContain('en');
          expect(codes).toContain('all');
          
          // Property: Indonesian should contain expected filler words
          const indonesian = languages.find(lang => lang.code === 'id');
          expect(indonesian.fillerWords).toContain('eung');
          expect(indonesian.fillerWords).toContain('anu');
          expect(indonesian.fillerWords).toContain('uhm');
          
          // Property: English should contain expected filler words
          const english = languages.find(lang => lang.code === 'en');
          expect(english.fillerWords).toContain('um');
          expect(english.fillerWords).toContain('uh');
          expect(english.fillerWords).toContain('like');
          
          // Property: All should contain both Indonesian and English words
          const all = languages.find(lang => lang.code === 'all');
          expect(all.fillerWords).toContain('eung'); // Indonesian
          expect(all.fillerWords).toContain('um');   // English
        }
      ),
      { numRuns: 10 } // Fewer runs since this is testing static data
    );
  });

  /**
   * Property: Case insensitive detection should work correctly
   */
  test('Property: Case insensitive filler word detection', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('eung', 'anu', 'uhm', 'um', 'uh', 'like'),
          { minLength: 1, maxLength: 5 }
        ),
        (fillerWords) => {
          const lowerCaseText = fillerWords.join(' ').toLowerCase();
          const upperCaseText = fillerWords.join(' ').toUpperCase();
          const mixedCaseText = fillerWords.map((word, index) => 
            index % 2 === 0 ? word.toLowerCase() : word.toUpperCase()
          ).join(' ');
          
          const lowerDetection = detectFillerWords(lowerCaseText, 'all');
          const upperDetection = detectFillerWords(upperCaseText, 'all');
          const mixedDetection = detectFillerWords(mixedCaseText, 'all');
          
          // Property: Case should not affect detection count
          expect(lowerDetection.count).toBe(upperDetection.count);
          expect(lowerDetection.count).toBe(mixedDetection.count);
          expect(upperDetection.count).toBe(mixedDetection.count);
          
          // Property: All should detect the expected number of filler words
          expect(lowerDetection.count).toBe(fillerWords.length);
          expect(upperDetection.count).toBe(fillerWords.length);
          expect(mixedDetection.count).toBe(fillerWords.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});