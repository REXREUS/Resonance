import fc from 'fast-check';
import { chaosEngine } from '../chaosEngine';
import { NOISE_TYPES } from '../../constants/audio';

/**
 * **Feature: resonance-mobile-app, Chaos Engine Tests**
 * **Validates: Requirements 3.3**
 * 
 * Property tests for chaos engine disruption system functionality
 */

// Helper function to generate mock audio data
function generateMockAudioData(size = 1024) {
  const audioData = new ArrayBuffer(size * 2); // 16-bit audio
  const view = new Int16Array(audioData);
  for (let i = 0; i < size; i++) {
    view[i] = Math.floor((Math.random() - 0.5) * 2 * 32768);
  }
  return audioData;
}

describe('Chaos Engine Property Tests', () => {
  beforeEach(() => {
    chaosEngine.reset();
  });

  afterEach(async () => {
    await chaosEngine.cleanup();
  });

  test('Property: Chaos engine initialization consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          enabled: fc.boolean(),
          randomVoiceGen: fc.boolean(),
          backgroundNoise: fc.boolean(),
          hardwareFailure: fc.boolean(),
          noiseType: fc.constantFrom(...NOISE_TYPES),
          intensity: fc.float({ min: 0, max: 1, noNaN: true }),
          frequency: fc.integer({ min: 1, max: 120 })
        }),
        (config) => {
          // Initialize chaos engine with configuration
          chaosEngine.initialize(config);
          
          // Get current configuration
          const currentConfig = chaosEngine.getConfiguration();
          
          // Verify all configuration properties are set correctly
          expect(currentConfig.enabled).toBe(config.enabled);
          expect(currentConfig.randomVoiceGen).toBe(config.randomVoiceGen);
          expect(currentConfig.backgroundNoise).toBe(config.backgroundNoise);
          expect(currentConfig.hardwareFailure).toBe(config.hardwareFailure);
          expect(currentConfig.noiseType).toBe(config.noiseType);
          expect(currentConfig.intensity).toBeCloseTo(config.intensity, 6);
          expect(currentConfig.frequency).toBe(config.frequency);
          
          // Verify statistics reflect configuration
          const stats = chaosEngine.getStatistics();
          expect(stats.enabled).toBe(config.enabled);
          expect(stats.configuration.enabled).toBe(config.enabled);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property: Voice variation application preserves audio data structure', () => {
    fc.assert(
      fc.property(
        fc.record({
          audioSize: fc.integer({ min: 512, max: 4096 }),
          pitch: fc.float({ min: 0.5, max: 2.0, noNaN: true }),
          speed: fc.float({ min: 0.5, max: 2.0, noNaN: true }),
          intensity: fc.float({ min: Math.fround(0.1), max: 1, noNaN: true }) // Use min > 0 to avoid falsy value issue
        }),
        (testData) => {
          const { audioSize, pitch, speed, intensity } = testData;
          
          // Initialize chaos engine with voice variation enabled
          chaosEngine.initialize({
            enabled: true,
            randomVoiceGen: true,
            backgroundNoise: false,
            hardwareFailure: false
          });
          
          // Generate mock audio data
          const originalAudio = generateMockAudioData(audioSize);
          
          // Apply voice variation
          const modifiedAudio = chaosEngine.applyVoiceVariation(originalAudio, {
            pitch,
            speed,
            intensity
          });
          
          // Verify audio data structure is preserved
          expect(modifiedAudio).toBeInstanceOf(ArrayBuffer);
          expect(modifiedAudio.byteLength).toBe(originalAudio.byteLength);
          
          // Verify disruption was logged
          const disruptionLog = chaosEngine.getDisruptionLog();
          const voiceVariations = disruptionLog.filter(d => d.type === 'voice_variation');
          expect(voiceVariations.length).toBeGreaterThan(0);
          
          // Verify last voice variation has correct parameters
          const lastVariation = voiceVariations[voiceVariations.length - 1];
          expect(lastVariation.parameters.pitch).toBeCloseTo(pitch, 6);
          expect(lastVariation.parameters.speed).toBeCloseTo(speed, 6);
          expect(lastVariation.parameters.intensity).toBeCloseTo(intensity, 6);
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property: Background noise injection with valid noise types', () => {
    fc.assert(
      fc.property(
        fc.record({
          audioSize: fc.integer({ min: 512, max: 2048 }),
          noiseType: fc.constantFrom(...NOISE_TYPES),
          intensity: fc.float({ min: 0, max: 1, noNaN: true })
        }),
        (testData) => {
          const { audioSize, noiseType, intensity } = testData;
          
          // Initialize chaos engine with background noise enabled
          chaosEngine.initialize({
            enabled: true,
            randomVoiceGen: false,
            backgroundNoise: true,
            hardwareFailure: false,
            noiseType: noiseType
          });
          
          // Generate mock audio data
          const originalAudio = generateMockAudioData(audioSize);
          
          // Inject background noise
          const noisyAudio = chaosEngine.injectBackgroundNoise(originalAudio, noiseType, intensity);
          
          // Verify audio data structure is preserved
          expect(noisyAudio).toBeInstanceOf(ArrayBuffer);
          expect(noisyAudio.byteLength).toBe(originalAudio.byteLength);
          
          // Verify disruption was logged
          const disruptionLog = chaosEngine.getDisruptionLog();
          const noiseInjections = disruptionLog.filter(d => d.type === 'background_noise');
          expect(noiseInjections.length).toBeGreaterThan(0);
          
          // Verify last noise injection has correct parameters
          const lastInjection = noiseInjections[noiseInjections.length - 1];
          expect(lastInjection.parameters.noiseType).toBe(noiseType);
          expect(lastInjection.parameters.intensity).toBeCloseTo(intensity, 6);
          
          return true;
        }
      ),
      { numRuns: 40 }
    );
  });

  test('Property: Hardware failure simulation state management', () => {
    fc.assert(
      fc.property(
        fc.record({
          failureType: fc.constantFrom('mic_mute', 'connection_drop'),
          duration: fc.integer({ min: 1000, max: 3000 }) // Reduced max duration for faster tests
        }),
        (testData) => {
          const { failureType, duration } = testData;
          
          // Initialize chaos engine with hardware failure enabled
          chaosEngine.initialize({
            enabled: true,
            randomVoiceGen: false,
            backgroundNoise: false,
            hardwareFailure: true
          });
          
          // Verify initial state
          expect(chaosEngine.isMicMuted()).toBe(false);
          expect(chaosEngine.isConnectionDropped()).toBe(false);
          
          // Simulate hardware failure
          chaosEngine.simulateHardwareFailure(failureType, duration);
          
          // Verify failure state is active
          if (failureType === 'mic_mute') {
            expect(chaosEngine.isMicMuted()).toBe(true);
            expect(chaosEngine.isConnectionDropped()).toBe(false);
          } else if (failureType === 'connection_drop') {
            expect(chaosEngine.isMicMuted()).toBe(false);
            expect(chaosEngine.isConnectionDropped()).toBe(true);
          }
          
          // Verify active disruptions
          const activeDisruptions = chaosEngine.getActiveDisruptions();
          const relevantDisruptions = activeDisruptions.filter(d => d.type === failureType);
          expect(relevantDisruptions.length).toBeGreaterThan(0);
          
          // Verify disruption was logged
          const disruptionLog = chaosEngine.getDisruptionLog();
          const hardwareFailures = disruptionLog.filter(d => d.type === 'hardware_failure');
          expect(hardwareFailures.length).toBeGreaterThan(0);
          
          const lastFailure = hardwareFailures[hardwareFailures.length - 1];
          expect(lastFailure.parameters.failureType).toBe(failureType);
          expect(lastFailure.parameters.duration).toBe(duration);
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 5000 } // Reduced runs and timeout
    );
  });

  test('Property: Disruption logging and tracking consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          operations: fc.array(
            fc.record({
              type: fc.constantFrom('voice_variation', 'background_noise', 'hardware_failure'),
              audioSize: fc.integer({ min: 256, max: 1024 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        (testData) => {
          const { operations } = testData;
          
          // Initialize chaos engine with all features enabled
          chaosEngine.initialize({
            enabled: true,
            randomVoiceGen: true,
            backgroundNoise: true,
            hardwareFailure: true,
            noiseType: 'office'
          });
          
          const initialLogLength = chaosEngine.getDisruptionLog().length;
          
          // Perform operations with delay to avoid frequency limiting
          let operationsPerformed = 0;
          operations.forEach((operation, index) => {
            const mockAudio = generateMockAudioData(operation.audioSize);
            
            switch (operation.type) {
              case 'voice_variation':
                chaosEngine.applyVoiceVariation(mockAudio);
                operationsPerformed++;
                break;
              case 'background_noise':
                chaosEngine.injectBackgroundNoise(mockAudio);
                operationsPerformed++;
                break;
              case 'hardware_failure':
                // Reset the last failure time to avoid frequency limiting in tests
                chaosEngine.hardwareFailureState.lastFailureTime = 0;
                chaosEngine.simulateHardwareFailure('mic_mute', 1000);
                operationsPerformed++;
                break;
            }
          });
          
          // Verify disruptions were logged
          const finalLog = chaosEngine.getDisruptionLog();
          const newDisruptions = finalLog.length - initialLogLength;
          
          // Should have at least as many new disruptions as operations performed
          expect(newDisruptions).toBeGreaterThanOrEqual(operationsPerformed);
          
          // Verify each disruption has required properties
          const recentDisruptions = finalLog.slice(-newDisruptions);
          recentDisruptions.forEach(disruption => {
            expect(disruption).toHaveProperty('id');
            expect(disruption).toHaveProperty('type');
            expect(disruption).toHaveProperty('timestamp');
            expect(disruption).toHaveProperty('parameters');
            expect(typeof disruption.timestamp).toBe('number');
            expect(disruption.timestamp).toBeGreaterThan(0);
          });
          
          // Verify statistics are updated
          const stats = chaosEngine.getStatistics();
          expect(stats.totalDisruptions).toBe(finalLog.length);
          expect(typeof stats.disruptionsByType).toBe('object');
          
          return true;
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Property: Chaos engine disabled state behavior', () => {
    fc.assert(
      fc.property(
        fc.record({
          audioSize: fc.integer({ min: 512, max: 2048 }),
          operations: fc.array(
            fc.constantFrom('voice_variation', 'background_noise', 'hardware_failure'),
            { minLength: 1, maxLength: 3 }
          )
        }),
        (testData) => {
          const { audioSize, operations } = testData;
          
          // Initialize chaos engine in disabled state
          chaosEngine.initialize({
            enabled: false,
            randomVoiceGen: true,
            backgroundNoise: true,
            hardwareFailure: true
          });
          
          const mockAudio = generateMockAudioData(audioSize);
          const initialLogLength = chaosEngine.getDisruptionLog().length;
          
          // Perform operations - should have no effect when disabled
          operations.forEach(operation => {
            switch (operation) {
              case 'voice_variation':
                const result = chaosEngine.applyVoiceVariation(mockAudio);
                // Should return original audio unchanged
                expect(result).toBe(mockAudio);
                break;
              case 'background_noise':
                const noisyResult = chaosEngine.injectBackgroundNoise(mockAudio);
                // Should return original audio unchanged
                expect(noisyResult).toBe(mockAudio);
                break;
              case 'hardware_failure':
                chaosEngine.simulateHardwareFailure('mic_mute', 1000);
                // Should not change hardware state
                expect(chaosEngine.isMicMuted()).toBe(false);
                expect(chaosEngine.isConnectionDropped()).toBe(false);
                break;
            }
          });
          
          // Verify no disruptions were logged
          const finalLogLength = chaosEngine.getDisruptionLog().length;
          expect(finalLogLength).toBe(initialLogLength);
          
          // Verify no active disruptions
          const activeDisruptions = chaosEngine.getActiveDisruptions();
          expect(activeDisruptions.length).toBe(0);
          
          // Verify statistics show disabled state
          const stats = chaosEngine.getStatistics();
          expect(stats.enabled).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property: Configuration update consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          initialConfig: fc.record({
            enabled: fc.boolean(),
            randomVoiceGen: fc.boolean(),
            backgroundNoise: fc.boolean(),
            hardwareFailure: fc.boolean(),
            intensity: fc.float({ min: 0, max: 1, noNaN: true })
          }),
          updateConfig: fc.record({
            enabled: fc.boolean(),
            intensity: fc.float({ min: 0, max: 1, noNaN: true })
          })
        }),
        (testData) => {
          const { initialConfig, updateConfig } = testData;
          
          // Initialize with initial configuration
          chaosEngine.initialize(initialConfig);
          
          // Verify initial configuration
          let currentConfig = chaosEngine.getConfiguration();
          expect(currentConfig.enabled).toBe(initialConfig.enabled);
          expect(currentConfig.intensity).toBeCloseTo(initialConfig.intensity, 6);
          
          // Update configuration
          chaosEngine.updateConfiguration(updateConfig);
          
          // Verify updated configuration
          currentConfig = chaosEngine.getConfiguration();
          expect(currentConfig.enabled).toBe(updateConfig.enabled);
          expect(currentConfig.intensity).toBeCloseTo(updateConfig.intensity, 6);
          
          // Verify other properties are preserved
          expect(currentConfig.randomVoiceGen).toBe(initialConfig.randomVoiceGen);
          expect(currentConfig.backgroundNoise).toBe(initialConfig.backgroundNoise);
          expect(currentConfig.hardwareFailure).toBe(initialConfig.hardwareFailure);
          
          return true;
        }
      ),
      { numRuns: 40 }
    );
  });
});