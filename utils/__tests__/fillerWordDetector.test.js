import {
  detectFillerWords,
  countWords,
  getSupportedLanguages
} from '../fillerWordDetector';

describe('Filler Word Detector Unit Tests', () => {
  test('should detect Indonesian filler words', () => {
    const text = 'Saya eung mau pergi anu ke toko uhm';
    const result = detectFillerWords(text, 'id');
    
    expect(result.count).toBe(3);
    expect(result.breakdown.indonesian).toBe(3);
    expect(result.breakdown.english).toBe(0);
  });

  test('should detect English filler words', () => {
    const text = 'I um want to go uh to the store like';
    const result = detectFillerWords(text, 'en');
    
    expect(result.count).toBe(3);
    expect(result.breakdown.english).toBe(3);
    expect(result.breakdown.indonesian).toBe(0);
  });

  test('should count words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   world  ')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords('single')).toBe(1);
  });

  test('should return supported languages', () => {
    const languages = getSupportedLanguages();
    expect(languages).toHaveLength(3);
    expect(languages.map(l => l.code)).toEqual(['id', 'en', 'all']);
  });
});