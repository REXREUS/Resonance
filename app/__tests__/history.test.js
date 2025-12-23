/**
 * Unit tests for session history functionality
 */

import { getScoreColor, getScoreGrade, formatSessionMode, getSessionBadge } from '../../utils/scoreColorCalculator';
import { COLORS } from '../../constants/theme';

describe('Session History Utilities', () => {
  describe('getScoreColor', () => {
    it('should return correct colors for score ranges', () => {
      expect(getScoreColor(95)).toBe(COLORS.SUCCESS); // Excellent
      expect(getScoreColor(85)).toBe(COLORS.INFO);    // Good
      expect(getScoreColor(75)).toBe(COLORS.WARNING); // Average
      expect(getScoreColor(65)).toBe('#fd7e14');      // Below Average
      expect(getScoreColor(45)).toBe(COLORS.ERROR);   // Poor
    });

    it('should handle edge cases correctly', () => {
      expect(getScoreColor(0)).toBe(COLORS.ERROR);
      expect(getScoreColor(100)).toBe(COLORS.SUCCESS);
      expect(getScoreColor(90)).toBe(COLORS.SUCCESS);
      expect(getScoreColor(89)).toBe(COLORS.INFO);
    });
  });

  describe('getScoreGrade', () => {
    it('should return correct grades for scores', () => {
      expect(getScoreGrade(98)).toBe('A+');
      expect(getScoreGrade(95)).toBe('A');
      expect(getScoreGrade(85)).toBe('B');
      expect(getScoreGrade(75)).toBe('C');
      expect(getScoreGrade(65)).toBe('D');
      expect(getScoreGrade(45)).toBe('F');
    });
  });

  describe('formatSessionMode', () => {
    it('should format session modes correctly', () => {
      expect(formatSessionMode('stress')).toBe('Stress Test');
      expect(formatSessionMode('single')).toBe('Single Call');
    });
  });

  describe('getSessionBadge', () => {
    it('should return correct badge info for modes', () => {
      const stressBadge = getSessionBadge('stress');
      expect(stressBadge.text).toBe('STRESS');
      expect(stressBadge.color).toBe(COLORS.ERROR);

      const singleBadge = getSessionBadge('single');
      expect(singleBadge.text).toBe('VOICE');
      expect(singleBadge.color).toBe(COLORS.INFO);
    });
  });
});