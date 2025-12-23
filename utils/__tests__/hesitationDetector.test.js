import {
  detectHesitation,
  validateTranscriptEntry,
  getHesitationStatistics
} from '../hesitationDetector';

describe('Hesitation Detector Unit Tests', () => {
  test('should detect hesitation patterns', () => {
    const textWithHesitation = 'I um... think that uh... this is good';
    const result = detectHesitation(textWithHesitation);
    
    expect(result.hasHesitation).toBe(true);
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('should not detect hesitation in normal text', () => {
    const normalText = 'This is a normal sentence without hesitation';
    const result = detectHesitation(normalText);
    
    expect(result.hasHesitation).toBe(false);
    expect(result.totalMatches).toBe(0);
    expect(result.confidence).toBe(0);
  });

  test('should validate transcript entries correctly', () => {
    const validEntry = {
      sender: 'user',
      text: 'Hello world',
      timestamp: 1000
    };
    
    const invalidEntry = {
      sender: 'invalid',
      text: 123
    };
    
    expect(validateTranscriptEntry(validEntry)).toBe(true);
    expect(validateTranscriptEntry(invalidEntry)).toBe(false);
  });

  test('should calculate hesitation statistics', () => {
    const transcript = [
      { sender: 'user', text: 'Hello um world' },
      { sender: 'ai', text: 'Normal response' },
      { sender: 'user', text: 'Another uh... response' }
    ];
    
    const stats = getHesitationStatistics(transcript);
    expect(stats.totalEntries).toBe(3);
    expect(stats.entriesWithHesitation).toBeGreaterThan(0);
  });
});