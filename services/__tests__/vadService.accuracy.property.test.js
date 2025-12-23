/**
 * Property-based tests for VAD detection accuracy
 * Tests Requirements: 2.1, 2.2, 2.3, 15.1, 15.3, 15.4, 15.5
 */

import fc from 'fast-check';
import { vadService } from '../vadService';
import { AUDIO_CONFIG } from '../../constants/audio';

describe('VADService - Detection Accuracy Properties', () => {
  beforeEach(() => {
    vadService.initialize({
      sensitivity: 'medium',
      noiseFloor: 0.1,
      minimumDuration: 150
    });
  });

  afterEach(() => {
    vadService.cleanup();
  });

  /**
   * Property 3: VAD detection accuracy
   * Voice activity detection should be consistent and accurate across different audio conditions
   */
  test('Property 3: VAD detection accuracy - voice activity detection is consistent', () => {
    fc.assert(fc.property(
      fc.record({
        amplitudes: fc.array(fc.float({ min: 0, max: 1 }), { minLength: 10, maxLength: 100 }),
        noiseFloor: fc.float({ min: Math.fround(0.01), max: Math.fround(0.3) }),
        sensitivity: fc.constantFrom('low', 'medium', 'high'),
        signalToNoiseRatio: fc.float({ min: Math.fround(1.5), max: Math.fround(10) })
      }),
      ({ amplitudes, noiseFloor, sensitivity, signalToNoiseRatio }) => {
        // Initialize VAD with test parameters
        vadService.initialize({
          sensitivity,
          noiseFloor,
          minimumDuration: 100
        });

        // Generate voice signal above noise floor
        const voiceAmplitudes = amplitudes.map(amp => 
          amp < 0.5 ? noiseFloor * 0.8 : noiseFloor * signalToNoiseRatio
        );

        let voiceDetectedCount = 0;
        let silenceDetectedCount = 0;

        // Process audio chunks
        voiceAmplitudes.forEach(amplitude => {
          const audioData = new Float32Array(1024).fill(amplitude);
          const isVoiceDetected = vadService.processAudioChunk(audioData, amplitude);
          
          if (isVoiceDetected) {
            voiceDetectedCount++;
          } else {
            silenceDetectedCount++;
          }
        });

        // Properties to verify:
        // 1. VAD should detect voice when amplitude is significantly above noise floor
        const strongVoiceSignals = voiceAmplitudes.filter(amp => 
          amp > noiseFloor * 2
        ).length;
        
        // 2. Detection threshold should be consistent with sensitivity setting
        const threshold = vadService.getDetectionThreshold();
        const expectedThresholdRange = {
          low: noiseFloor * Math.pow(10, 20/20),
          medium: noiseFloor * Math.pow(10, 12/20), 
          high: noiseFloor * Math.pow(10, 5/20)
        };
        
        // 3. Voice activity should correlate with signal strength
        const averageAmplitude = voiceAmplitudes.reduce((sum, amp) => sum + amp, 0) / voiceAmplitudes.length;
        const shouldDetectVoice = averageAmplitude > threshold;

        return (
          // Threshold should be within expected range for sensitivity
          threshold >= expectedThresholdRange[sensitivity] * 0.8 &&
          threshold <= expectedThresholdRange[sensitivity] * 1.2 &&
          // Strong signals should be detected more often than weak ones
          (strongVoiceSignals === 0 || voiceDetectedCount > 0) &&
          // Detection should be consistent with signal strength
          (shouldDetectVoice ? voiceDetectedCount >= silenceDetectedCount * 0.5 : true)
        );
      }
    ), { numRuns: 100 });
  });

  test('Property 3a: VAD sensitivity levels produce different thresholds', () => {
    fc.assert(fc.property(
      fc.float({ min: Math.fround(0.05), max: Math.fround(0.2) }),
      (noiseFloor) => {
        const sensitivities = ['low', 'medium', 'high'];
        const thresholds = [];

        sensitivities.forEach(sensitivity => {
          vadService.initialize({
            sensitivity,
            noiseFloor,
            minimumDuration: 100
          });
          thresholds.push(vadService.getDetectionThreshold());
        });

        // High sensitivity should have lower threshold than medium
        // Medium sensitivity should have lower threshold than low
        return (
          thresholds[2] < thresholds[1] && // high < medium
          thresholds[1] < thresholds[0] && // medium < low
          thresholds.every(t => t > noiseFloor) // all thresholds above noise floor
        );
      }
    ), { numRuns: 50 });
  });

  test('Property 3b: VAD responds within required time window', () => {
    fc.assert(fc.property(
      fc.record({
        voiceAmplitude: fc.float({ min: Math.fround(0.3), max: Math.fround(1.0) }),
        noiseFloor: fc.float({ min: Math.fround(0.01), max: Math.fround(0.1) }),
        chunkDuration: fc.integer({ min: 10, max: 30 }) // ms per chunk
      }),
      ({ voiceAmplitude, noiseFloor, chunkDuration }) => {
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor,
          minimumDuration: AUDIO_CONFIG.VAD_RESPONSE_TIME_MS
        });

        let detectionChunk = null;
        
        // Simulate voice activity detection
        // Start with silence, then voice signal
        for (let i = 0; i < 20; i++) {
          // First 2 chunks are silence, rest are voice
          const amplitude = i < 2 ? noiseFloor * 0.5 : voiceAmplitude;
          const audioData = new Float32Array(1024).fill(amplitude);
          
          const isDetected = vadService.processAudioChunk(audioData, amplitude);
          
          if (isDetected && detectionChunk === null) {
            detectionChunk = i;
            break;
          }
        }

        // Voice should be detected within reasonable time
        // Calculate detection time based on chunk number and duration
        const detectionTime = detectionChunk !== null ? detectionChunk * chunkDuration : null;
        
        // Account for VAD buffering (buffer size is 5) and allow reasonable detection time
        // Detection should occur within 150ms + buffer fill time
        const maxAllowedTime = AUDIO_CONFIG.VAD_RESPONSE_TIME_MS + (5 * chunkDuration);
        
        return detectionTime !== null && detectionTime <= maxAllowedTime;
      }
    ), { numRuns: 50 });
  });

  test('Property 3c: VAD smoothing reduces false positives', () => {
    fc.assert(fc.property(
      fc.record({
        noiseFloor: fc.float({ min: Math.fround(0.05), max: Math.fround(0.15) }),
        spikiness: fc.float({ min: Math.fround(0.1), max: Math.fround(0.5) }) // How much noise spikes
      }),
      ({ noiseFloor, spikiness }) => {
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor,
          minimumDuration: 100
        });

        let falsePositives = 0;
        let totalChunks = 50;

        // Generate noisy signal with occasional spikes
        for (let i = 0; i < totalChunks; i++) {
          const baseAmplitude = noiseFloor * 0.8;
          const spike = Math.random() < 0.1 ? noiseFloor * (1 + spikiness) : 0;
          const amplitude = baseAmplitude + spike;
          
          const audioData = new Float32Array(1024).fill(amplitude);
          const isDetected = vadService.processAudioChunk(audioData, amplitude);
          
          // Count as false positive if detected but amplitude is close to noise floor
          if (isDetected && amplitude < noiseFloor * 1.5) {
            falsePositives++;
          }
        }

        // Smoothing should keep false positives low
        const falsePositiveRate = falsePositives / totalChunks;
        return falsePositiveRate < 0.2; // Less than 20% false positive rate
      }
    ), { numRuns: 30 });
  });

  test('Property 3d: VAD maintains state consistency', () => {
    fc.assert(fc.property(
      fc.array(fc.float({ min: 0, max: 1 }), { minLength: 20, maxLength: 50 }),
      (amplitudes) => {
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.1,
          minimumDuration: 100
        });

        let previousState = false;
        let stateChanges = 0;
        let inconsistentTransitions = 0;

        amplitudes.forEach(amplitude => {
          const audioData = new Float32Array(1024).fill(amplitude);
          const currentState = vadService.processAudioChunk(audioData, amplitude);
          
          if (currentState !== previousState) {
            stateChanges++;
            
            // Check for inconsistent transitions
            const threshold = vadService.getDetectionThreshold();
            if (currentState && amplitude < threshold * 0.8) {
              inconsistentTransitions++;
            } else if (!currentState && amplitude > threshold * 1.2) {
              inconsistentTransitions++;
            }
          }
          
          previousState = currentState;
        });

        // State changes should be reasonable and consistent
        return (
          stateChanges < amplitudes.length * 0.5 && // Not too many state changes
          inconsistentTransitions < stateChanges * 0.3 // Most transitions should be consistent
        );
      }
    ), { numRuns: 50 });
  });
});