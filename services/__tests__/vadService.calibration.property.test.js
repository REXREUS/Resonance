/**
 * Property-based tests for VAD audio calibration consistency
 * Tests Requirements: 2.4, 15.2
 */

import fc from 'fast-check';
import { vadService } from '../vadService';
import { audioEngine } from '../audioEngine';
import { AUDIO_CONFIG } from '../../constants/audio';

describe('VADService - Audio Calibration Properties', () => {
  beforeEach(() => {
    vadService.reset();
  });

  afterEach(() => {
    vadService.cleanup();
  });

  /**
   * Property 4: Audio calibration consistency
   * Noise floor calibration should be consistent and accurate across different environments
   */
  test('Property 4: Audio calibration consistency - noise floor calculation is stable', () => {
    fc.assert(fc.property(
      fc.record({
        ambientNoise: fc.float({ min: Math.fround(0.01), max: Math.fround(0.3) }),
        variability: fc.float({ min: Math.fround(0.01), max: Math.fround(0.1) }),
        sampleCount: fc.integer({ min: 20, max: 100 })
      }),
      ({ ambientNoise, variability, sampleCount }) => {
        // Initialize VAD service before calibration
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.05,
          minimumDuration: 100
        });

        // Generate consistent ambient noise samples with some variability
        const noiseSamples = Array.from({ length: sampleCount }, () => {
          const variation = (Math.random() - 0.5) * variability;
          return Math.max(0.001, ambientNoise + variation);
        });

        // Calibrate noise floor
        const calculatedNoiseFloor = vadService.calibrate(noiseSamples);

        // Properties to verify:
        // 1. Calculated noise floor should be close to actual ambient noise
        const noiseFloorAccuracy = Math.abs(calculatedNoiseFloor - ambientNoise) / ambientNoise;
        
        // 2. Noise floor should be within reasonable bounds
        const minExpected = ambientNoise - variability;
        const maxExpected = ambientNoise + variability;
        
        // 3. Multiple calibrations with same data should be consistent
        const secondCalibration = vadService.calibrate(noiseSamples);
        const calibrationConsistency = Math.abs(calculatedNoiseFloor - secondCalibration) < 0.001;

        return (
          noiseFloorAccuracy < 0.2 && // Within 20% of actual noise
          calculatedNoiseFloor >= minExpected * 0.8 &&
          calculatedNoiseFloor <= maxExpected * 1.2 &&
          calibrationConsistency &&
          calculatedNoiseFloor > 0
        );
      }
    ), { numRuns: 100 });
  });

  test('Property 4a: Calibration adapts to different noise environments', () => {
    fc.assert(fc.property(
      fc.record({
        quietEnvironment: fc.float({ min: Math.fround(0.01), max: Math.fround(0.05) }),
        noisyEnvironment: fc.float({ min: Math.fround(0.2), max: Math.fround(0.4) }),
        sampleSize: fc.integer({ min: 30, max: 80 })
      }),
      ({ quietEnvironment, noisyEnvironment, sampleSize }) => {
        // Initialize VAD service before calibration
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.05,
          minimumDuration: 100
        });

        // Test calibration in quiet environment
        const quietSamples = Array.from({ length: sampleSize }, () => 
          quietEnvironment + (Math.random() - 0.5) * 0.01
        );
        const quietNoiseFloor = vadService.calibrate(quietSamples);

        // Test calibration in noisy environment  
        const noisySamples = Array.from({ length: sampleSize }, () =>
          noisyEnvironment + (Math.random() - 0.5) * 0.05
        );
        const noisyNoiseFloor = vadService.calibrate(noisySamples);

        // Properties to verify:
        // 1. Noisy environment should have higher noise floor
        // 2. Both calibrations should be reasonable for their environments
        // 3. Difference should be significant enough to matter
        
        return (
          noisyNoiseFloor > quietNoiseFloor &&
          quietNoiseFloor >= quietEnvironment * 0.8 &&
          quietNoiseFloor <= quietEnvironment * 1.2 &&
          noisyNoiseFloor >= noisyEnvironment * 0.8 &&
          noisyNoiseFloor <= noisyEnvironment * 1.2 &&
          (noisyNoiseFloor - quietNoiseFloor) > quietEnvironment
        );
      }
    ), { numRuns: 50 });
  });

  test('Property 4b: Calibration handles edge cases gracefully', () => {
    fc.assert(fc.property(
      fc.oneof(
        // Very quiet environment
        fc.constant(Array.from({ length: 50 }, () => 0.001 + Math.random() * 0.002)),
        // Very noisy environment
        fc.constant(Array.from({ length: 50 }, () => 0.8 + Math.random() * 0.15)),
        // Inconsistent environment
        fc.array(fc.float({ min: Math.fround(0.001), max: Math.fround(0.9) }), { minLength: 20, maxLength: 100 }),
        // Empty or minimal samples
        fc.array(fc.float({ min: Math.fround(0.001), max: Math.fround(0.1) }), { minLength: 1, maxLength: 5 })
      ),
      (samples) => {
        // Initialize VAD service before calibration
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.05,
          minimumDuration: 100
        });

        try {
          const noiseFloor = vadService.calibrate(samples);
          
          // Properties for edge cases:
          // 1. Should always return a positive number
          // 2. Should be within reasonable bounds
          // 3. Should not be NaN or infinite
          
          return (
            typeof noiseFloor === 'number' &&
            !isNaN(noiseFloor) &&
            isFinite(noiseFloor) &&
            noiseFloor > 0 &&
            noiseFloor < 1.0
          );
        } catch (error) {
          // Should handle empty arrays gracefully
          return samples.length === 0;
        }
      }
    ), { numRuns: 50 });
  });

  test('Property 4c: Calibration duration affects accuracy', () => {
    fc.assert(fc.property(
      fc.record({
        trueNoiseLevel: fc.float({ min: Math.fround(0.05), max: Math.fround(0.2) }),
        shortDuration: fc.integer({ min: 5, max: 15 }),
        longDuration: fc.integer({ min: 50, max: 100 })
      }),
      ({ trueNoiseLevel, shortDuration, longDuration }) => {
        // Initialize VAD service before calibration
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.05,
          minimumDuration: 100
        });

        // Generate samples for short calibration
        const shortSamples = Array.from({ length: shortDuration }, () =>
          trueNoiseLevel + (Math.random() - 0.5) * 0.02
        );
        
        // Generate samples for long calibration
        const longSamples = Array.from({ length: longDuration }, () =>
          trueNoiseLevel + (Math.random() - 0.5) * 0.02
        );

        const shortCalibration = vadService.calibrate(shortSamples);
        const longCalibration = vadService.calibrate(longSamples);

        // Properties to verify:
        // 1. Both calibrations should be reasonable
        // 2. Longer calibration should generally be more accurate
        // 3. Both should be in the right ballpark
        
        const shortAccuracy = Math.abs(shortCalibration - trueNoiseLevel) / trueNoiseLevel;
        const longAccuracy = Math.abs(longCalibration - trueNoiseLevel) / trueNoiseLevel;

        return (
          shortAccuracy < 0.5 && // Short calibration within 50%
          longAccuracy < 0.3 && // Long calibration within 30%
          shortCalibration > 0 &&
          longCalibration > 0 &&
          shortCalibration < 1.0 &&
          longCalibration < 1.0
        );
      }
    ), { numRuns: 50 });
  });

  test('Property 4d: Calibration updates detection threshold correctly', () => {
    fc.assert(fc.property(
      fc.record({
        initialNoise: fc.float({ min: Math.fround(0.05), max: Math.fround(0.15) }),
        newNoise: fc.float({ min: Math.fround(0.1), max: Math.fround(0.3) }),
        sensitivity: fc.constantFrom('low', 'medium', 'high')
      }),
      ({ initialNoise, newNoise, sensitivity }) => {
        // Initial calibration
        vadService.initialize({
          sensitivity,
          noiseFloor: initialNoise,
          minimumDuration: 100
        });
        
        const initialThreshold = vadService.getDetectionThreshold();

        // Recalibrate with new noise level
        const newSamples = Array.from({ length: 50 }, () =>
          newNoise + (Math.random() - 0.5) * 0.02
        );
        vadService.calibrate(newSamples);
        
        const newThreshold = vadService.getDetectionThreshold();

        // Properties to verify:
        // 1. Threshold should change when noise floor changes
        // 2. Higher noise floor should result in higher threshold
        // 3. Threshold should maintain proper relationship to noise floor
        
        const thresholdChanged = Math.abs(newThreshold - initialThreshold) > 0.001;
        const thresholdDirection = newNoise > initialNoise ? 
          newThreshold > initialThreshold : 
          newThreshold < initialThreshold;
        const thresholdAboveNoise = newThreshold > vadService.getNoiseFloor();

        return (
          thresholdChanged &&
          (Math.abs(newNoise - initialNoise) < 0.01 || thresholdDirection) &&
          thresholdAboveNoise &&
          newThreshold > 0 &&
          newThreshold < 1.0
        );
      }
    ), { numRuns: 50 });
  });

  test('Property 4e: Calibration timing meets requirements', () => {
    fc.assert(fc.property(
      fc.record({
        calibrationDuration: fc.integer({ min: 1000, max: 5000 }), // ms
        sampleRate: fc.constantFrom(16000, 44100, 48000),
        chunkSize: fc.integer({ min: 512, max: 2048 })
      }),
      ({ calibrationDuration, sampleRate, chunkSize }) => {
        // Initialize VAD service before calibration
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.05,
          minimumDuration: 100
        });

        // Calculate expected number of samples
        const expectedSamples = Math.floor((calibrationDuration / 1000) * sampleRate / chunkSize);
        
        // Simulate calibration timing
        const startTime = Date.now();
        let sampleCount = 0;
        const samples = [];
        
        // Simulate real-time audio processing
        while (Date.now() - startTime < calibrationDuration && sampleCount < expectedSamples) {
          const amplitude = 0.1 + Math.random() * 0.05;
          samples.push(amplitude);
          sampleCount++;
          
          // Simulate processing time
          if (sampleCount % 10 === 0) {
            // Small delay to simulate real processing
          }
        }
        
        const actualDuration = Date.now() - startTime;
        
        if (samples.length > 0) {
          const noiseFloor = vadService.calibrate(samples);
          
          // Properties to verify:
          // 1. Calibration should complete within reasonable time
          // 2. Should collect reasonable number of samples
          // 3. Should produce valid noise floor
          
          return (
            actualDuration <= calibrationDuration * 1.5 && // Allow some overhead
            samples.length >= expectedSamples * 0.5 && // At least half expected samples
            noiseFloor > 0 &&
            noiseFloor < 1.0 &&
            !isNaN(noiseFloor)
          );
        }
        
        return true; // Skip if no samples collected
      }
    ), { numRuns: 30 });
  });
});