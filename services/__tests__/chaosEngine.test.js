import { chaosEngine } from '../chaosEngine';
import { NOISE_TYPES } from '../../constants/audio';

describe('Chaos Engine Unit Tests', () => {
  beforeEach(() => {
    chaosEngine.reset();
  });

  afterEach(async () => {
    await chaosEngine.cleanup();
  });

  test('should initialize with correct configuration', () => {
    const config = {
      enabled: true,
      randomVoiceGen: true,
      backgroundNoise: true,
      hardwareFailure: true,
      noiseType: 'office',
      intensity: 0.5,
      frequency: 30
    };

    chaosEngine.initialize(config);
    const currentConfig = chaosEngine.getConfiguration();

    expect(currentConfig.enabled).toBe(true);
    expect(currentConfig.randomVoiceGen).toBe(true);
    expect(currentConfig.backgroundNoise).toBe(true);
    expect(currentConfig.hardwareFailure).toBe(true);
    expect(currentConfig.noiseType).toBe('office');
    expect(currentConfig.intensity).toBe(0.5);
    expect(currentConfig.frequency).toBe(30);
  });

  test('should apply voice variation when enabled', () => {
    chaosEngine.initialize({
      enabled: true,
      randomVoiceGen: true,
      backgroundNoise: false,
      hardwareFailure: false
    });

    const audioData = new ArrayBuffer(1024);
    const result = chaosEngine.applyVoiceVariation(audioData);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(audioData.byteLength);

    const disruptionLog = chaosEngine.getDisruptionLog();
    const voiceVariations = disruptionLog.filter(d => d.type === 'voice_variation');
    expect(voiceVariations.length).toBeGreaterThan(0);
  });

  test('should inject background noise when enabled', () => {
    chaosEngine.initialize({
      enabled: true,
      randomVoiceGen: false,
      backgroundNoise: true,
      hardwareFailure: false,
      noiseType: 'office'
    });

    const audioData = new ArrayBuffer(1024);
    const result = chaosEngine.injectBackgroundNoise(audioData);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(audioData.byteLength);

    const disruptionLog = chaosEngine.getDisruptionLog();
    const noiseInjections = disruptionLog.filter(d => d.type === 'background_noise');
    expect(noiseInjections.length).toBeGreaterThan(0);
  });

  test('should simulate hardware failure when enabled', () => {
    chaosEngine.initialize({
      enabled: true,
      randomVoiceGen: false,
      backgroundNoise: false,
      hardwareFailure: true
    });

    expect(chaosEngine.isMicMuted()).toBe(false);
    
    chaosEngine.simulateHardwareFailure('mic_mute', 1000);
    
    expect(chaosEngine.isMicMuted()).toBe(true);

    const activeDisruptions = chaosEngine.getActiveDisruptions();
    const micMuteDisruptions = activeDisruptions.filter(d => d.type === 'mic_mute');
    expect(micMuteDisruptions.length).toBeGreaterThan(0);
  });

  test('should not apply effects when disabled', () => {
    chaosEngine.initialize({
      enabled: false,
      randomVoiceGen: true,
      backgroundNoise: true,
      hardwareFailure: true
    });

    const audioData = new ArrayBuffer(1024);
    
    // Voice variation should return original data
    const voiceResult = chaosEngine.applyVoiceVariation(audioData);
    expect(voiceResult).toBe(audioData);

    // Background noise should return original data
    const noiseResult = chaosEngine.injectBackgroundNoise(audioData);
    expect(noiseResult).toBe(audioData);

    // Hardware failure should not change state
    chaosEngine.simulateHardwareFailure('mic_mute', 1000);
    expect(chaosEngine.isMicMuted()).toBe(false);

    // No disruptions should be logged
    const disruptionLog = chaosEngine.getDisruptionLog();
    expect(disruptionLog.length).toBe(0);
  });

  test('should update configuration correctly', () => {
    chaosEngine.initialize({
      enabled: false,
      intensity: 0.3
    });

    chaosEngine.updateConfiguration({
      enabled: true,
      intensity: 0.8
    });

    const config = chaosEngine.getConfiguration();
    expect(config.enabled).toBe(true);
    expect(config.intensity).toBe(0.8);
  });

  test('should track statistics correctly', () => {
    chaosEngine.initialize({
      enabled: true,
      randomVoiceGen: true,
      backgroundNoise: false,
      hardwareFailure: false
    });

    const audioData = new ArrayBuffer(512);
    chaosEngine.applyVoiceVariation(audioData);

    const stats = chaosEngine.getStatistics();
    expect(stats.enabled).toBe(true);
    expect(stats.totalDisruptions).toBeGreaterThan(0);
    expect(stats.disruptionsByType).toHaveProperty('voice_variation');
  });
});