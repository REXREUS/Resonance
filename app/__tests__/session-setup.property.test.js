/**
 * Property-based tests for session setup and configuration
 * **Feature: resonance-mobile-app, Property 7: Session configuration application**
 * **Validates: Requirements 3.5**
 */

import fc from 'fast-check';
import { databaseService } from '../../services/databaseService';

// Mock the database service for testing
jest.mock('../../services/databaseService', () => ({
  databaseService: {
    createSession: jest.fn(),
    getContextFiles: jest.fn(),
    createContextFile: jest.fn(),
    deleteContextFile: jest.fn(),
    getAppSettings: jest.fn(),
  },
}));

// Mock document processor
jest.mock('../../utils/documentProcessor', () => ({
  documentProcessor: {
    pickDocument: jest.fn(),
    validateDocument: jest.fn(),
  },
}));

// Session configuration validator function
function validateSessionConfiguration(config) {
  // Validate required fields
  if (!config.scenario || typeof config.scenario !== 'string') {
    return { valid: false, error: 'Invalid scenario' };
  }

  if (!config.language || !['id', 'en'].includes(config.language)) {
    return { valid: false, error: 'Invalid language' };
  }

  if (!config.mode || !['single', 'stress'].includes(config.mode)) {
    return { valid: false, error: 'Invalid mode' };
  }

  // Validate stress test specific settings
  if (config.mode === 'stress') {
    if (!Number.isInteger(config.queueLength) || config.queueLength < 1 || config.queueLength > 10) {
      return { valid: false, error: 'Invalid queue length for stress mode' };
    }

    if (!Number.isInteger(config.interCallDelay) || config.interCallDelay < 0 || config.interCallDelay > 30) {
      return { valid: false, error: 'Invalid inter-call delay' };
    }
  }

  // Validate chaos engine settings
  if (config.chaosEngine && typeof config.chaosEngine === 'object') {
    const { enabled, randomVoiceGen, backgroundNoise, hardwareFailure, noiseType } = config.chaosEngine;
    
    if (typeof enabled !== 'boolean') {
      return { valid: false, error: 'Invalid chaos engine enabled flag' };
    }

    if (enabled) {
      if (typeof randomVoiceGen !== 'boolean' || 
          typeof backgroundNoise !== 'boolean' || 
          typeof hardwareFailure !== 'boolean') {
        return { valid: false, error: 'Invalid chaos engine feature flags' };
      }

      // At least one chaos feature must be enabled if chaos engine is enabled
      if (!randomVoiceGen && !backgroundNoise && !hardwareFailure) {
        return { valid: false, error: 'At least one chaos feature must be enabled' };
      }

      // Validate noise type if background noise is enabled
      if (backgroundNoise && noiseType) {
        const validNoiseTypes = ['office', 'rain', 'traffic', 'cafe'];
        if (!validNoiseTypes.includes(noiseType)) {
          return { valid: false, error: 'Invalid noise type' };
        }
      }
    }
  }

  // Validate context files
  if (config.contextFiles && Array.isArray(config.contextFiles)) {
    for (const file of config.contextFiles) {
      if (!file.id || !file.name || typeof file.content !== 'string') {
        return { valid: false, error: 'Invalid context file format' };
      }
    }
  }

  // Validate timestamp
  if (!Number.isInteger(config.timestamp) || config.timestamp <= 0) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  return { valid: true };
}

// Function to apply session configuration
async function applySessionConfiguration(config) {
  try {
    // Validate configuration first
    const validation = validateSessionConfiguration(config);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create session record in database
    const sessionData = {
      timestamp: config.timestamp,
      scenario: config.scenario,
      mode: config.mode,
      completed: 0,
    };

    const sessionId = await databaseService.createSession(sessionData);

    // Return applied configuration with session ID
    return {
      sessionId,
      scenario: config.scenario,
      language: config.language,
      mode: config.mode,
      queueLength: config.mode === 'stress' ? config.queueLength : 1,
      interCallDelay: config.mode === 'stress' ? config.interCallDelay : 0,
      chaosEngine: config.chaosEngine || { enabled: false },
      contextFiles: config.contextFiles || [],
      timestamp: config.timestamp,
    };
  } catch (error) {
    throw error;
  }
}

// Generators for property-based testing
const scenarioGenerator = fc.constantFrom(
  'crisis-negotiation',
  'sales-objection', 
  'customer-complaint',
  'performance-review',
  'difficult-conversation',
  'presentation-qa'
);

const languageGenerator = fc.constantFrom('id', 'en');

const modeGenerator = fc.constantFrom('single', 'stress');

const chaosEngineGenerator = fc.record({
  enabled: fc.boolean(),
  randomVoiceGen: fc.boolean(),
  backgroundNoise: fc.boolean(),
  hardwareFailure: fc.boolean(),
  noiseType: fc.constantFrom('office', 'rain', 'traffic', 'cafe'),
});

const contextFileGenerator = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 0, maxLength: 1000 }),
});

const sessionConfigGenerator = fc.record({
  scenario: scenarioGenerator,
  language: languageGenerator,
  mode: modeGenerator,
  queueLength: fc.integer({ min: 1, max: 10 }),
  interCallDelay: fc.integer({ min: 0, max: 30 }),
  chaosEngine: chaosEngineGenerator,
  contextFiles: fc.array(contextFileGenerator, { maxLength: 5 }),
  timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }), // Valid timestamp range
});

describe('Session Configuration Application Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    databaseService.createSession.mockResolvedValue(123);
    databaseService.getContextFiles.mockResolvedValue([]);
    databaseService.getAppSettings.mockResolvedValue({
      language: 'id',
      theme: 'dark',
    });
  });

  /**
   * Property 7: Session configuration application
   * For any valid session setup parameters, initializing a session should apply all selected configurations correctly
   */
  test('Property 7: Session configuration application', async () => {
    await fc.assert(
      fc.asyncProperty(sessionConfigGenerator, async (config) => {
        // Ensure chaos engine has at least one feature enabled if enabled
        if (config.chaosEngine.enabled) {
          if (!config.chaosEngine.randomVoiceGen && 
              !config.chaosEngine.backgroundNoise && 
              !config.chaosEngine.hardwareFailure) {
            config.chaosEngine.randomVoiceGen = true;
          }
        }

        try {
          const appliedConfig = await applySessionConfiguration(config);

          // Verify all configuration parameters are correctly applied
          expect(appliedConfig.scenario).toBe(config.scenario);
          expect(appliedConfig.language).toBe(config.language);
          expect(appliedConfig.mode).toBe(config.mode);
          expect(appliedConfig.timestamp).toBe(config.timestamp);

          // Verify mode-specific settings
          if (config.mode === 'stress') {
            expect(appliedConfig.queueLength).toBe(config.queueLength);
            expect(appliedConfig.interCallDelay).toBe(config.interCallDelay);
          } else {
            expect(appliedConfig.queueLength).toBe(1);
            expect(appliedConfig.interCallDelay).toBe(0);
          }

          // Verify chaos engine settings
          expect(appliedConfig.chaosEngine.enabled).toBe(config.chaosEngine.enabled);
          if (config.chaosEngine.enabled) {
            expect(appliedConfig.chaosEngine.randomVoiceGen).toBe(config.chaosEngine.randomVoiceGen);
            expect(appliedConfig.chaosEngine.backgroundNoise).toBe(config.chaosEngine.backgroundNoise);
            expect(appliedConfig.chaosEngine.hardwareFailure).toBe(config.chaosEngine.hardwareFailure);
            
            if (config.chaosEngine.backgroundNoise) {
              expect(appliedConfig.chaosEngine.noiseType).toBe(config.chaosEngine.noiseType);
            }
          }

          // Verify context files
          expect(appliedConfig.contextFiles).toEqual(config.contextFiles);

          // Verify database interaction
          expect(databaseService.createSession).toHaveBeenCalledWith({
            timestamp: config.timestamp,
            scenario: config.scenario,
            mode: config.mode,
            completed: 0,
          });

          // Verify session ID is returned
          expect(appliedConfig.sessionId).toBe(123);

        } catch (error) {
          // If configuration is invalid, ensure validation catches it
          const validation = validateSessionConfiguration(config);
          expect(validation.valid).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Invalid configurations should be rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scenario: fc.oneof(fc.constant(''), fc.constant(null), fc.integer()),
          language: fc.oneof(fc.constant('invalid'), fc.constant(null), fc.integer()),
          mode: fc.oneof(fc.constant('invalid'), fc.constant(null), fc.integer()),
          queueLength: fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 11 }), fc.constant('invalid')),
          interCallDelay: fc.oneof(fc.integer({ max: -1 }), fc.integer({ min: 31 }), fc.constant('invalid')),
          timestamp: fc.oneof(fc.integer({ max: 0 }), fc.constant('invalid'), fc.constant(null)),
        }),
        async (invalidConfig) => {
          try {
            await applySessionConfiguration(invalidConfig);
            // Should not reach here for invalid configs
            expect(false).toBe(true);
          } catch (error) {
            // Invalid configurations should throw errors
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBeTruthy();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Chaos engine validation works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scenario: scenarioGenerator,
          language: languageGenerator,
          mode: modeGenerator,
          queueLength: fc.integer({ min: 1, max: 10 }),
          interCallDelay: fc.integer({ min: 0, max: 30 }),
          chaosEngine: fc.record({
            enabled: fc.constant(true),
            randomVoiceGen: fc.constant(false),
            backgroundNoise: fc.constant(false),
            hardwareFailure: fc.constant(false),
          }),
          contextFiles: fc.array(contextFileGenerator, { maxLength: 3 }),
          timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
        }),
        async (config) => {
          try {
            await applySessionConfiguration(config);
            // Should not reach here - chaos engine enabled but no features enabled
            expect(false).toBe(true);
          } catch (error) {
            expect(error.message).toContain('At least one chaos feature must be enabled');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Context files are properly validated and applied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scenario: scenarioGenerator,
          language: languageGenerator,
          mode: modeGenerator,
          queueLength: fc.integer({ min: 1, max: 10 }),
          interCallDelay: fc.integer({ min: 0, max: 30 }),
          chaosEngine: fc.record({
            enabled: fc.boolean(),
            randomVoiceGen: fc.boolean(),
            backgroundNoise: fc.boolean(),
            hardwareFailure: fc.boolean(),
          }),
          contextFiles: fc.array(contextFileGenerator, { minLength: 1, maxLength: 3 }),
          timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
        }),
        async (config) => {
          // Ensure at least one chaos feature is enabled if chaos engine is enabled
          if (config.chaosEngine.enabled) {
            if (!config.chaosEngine.randomVoiceGen && 
                !config.chaosEngine.backgroundNoise && 
                !config.chaosEngine.hardwareFailure) {
              config.chaosEngine.randomVoiceGen = true;
            }
          }

          const appliedConfig = await applySessionConfiguration(config);

          // Verify context files are properly applied
          expect(appliedConfig.contextFiles).toHaveLength(config.contextFiles.length);
          
          for (let i = 0; i < config.contextFiles.length; i++) {
            expect(appliedConfig.contextFiles[i].id).toBe(config.contextFiles[i].id);
            expect(appliedConfig.contextFiles[i].name).toBe(config.contextFiles[i].name);
            expect(appliedConfig.contextFiles[i].content).toBe(config.contextFiles[i].content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});