/**
 * Utility functions for calculating score colors and formatting
 */

import { COLORS } from '../constants/theme';

/**
 * Get color based on session score
 * @param {number} score - Score from 0-100
 * @returns {string} Hex color code
 */
export const getScoreColor = (score) => {
  if (score >= 90) return COLORS.SUCCESS;     // Green - Excellent (90-100)
  if (score >= 80) return COLORS.INFO;        // Blue - Good (80-89)
  if (score >= 70) return COLORS.WARNING;     // Yellow - Average (70-79)
  if (score >= 60) return '#fd7e14';          // Orange - Below Average (60-69)
  return COLORS.ERROR;                        // Red - Poor (0-59)
};

/**
 * Get grade letter based on score
 * @param {number} score - Score from 0-100
 * @returns {string} Grade letter
 */
export const getScoreGrade = (score) => {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
};

/**
 * Get score description based on score range
 * @param {number} score - Score from 0-100
 * @returns {string} Score description
 */
export const getScoreDescription = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Average';
  if (score >= 60) return 'Below Average';
  return 'Needs Improvement';
};

/**
 * Format session mode for display
 * @param {string} mode - Session mode ('single' or 'stress')
 * @returns {string} Formatted mode
 */
export const formatSessionMode = (mode) => {
  return mode === 'stress' ? 'Stress Test' : 'Single Call';
};

/**
 * Get session type badge info
 * @param {string} mode - Session mode
 * @returns {object} Badge info with text and color
 */
export const getSessionBadge = (mode) => {
  if (mode === 'stress') {
    return {
      text: 'STRESS',
      color: COLORS.ERROR,
      bgColor: `${COLORS.ERROR}20` // 20% opacity
    };
  }
  
  return {
    text: 'VOICE',
    color: COLORS.INFO,
    bgColor: `${COLORS.INFO}20` // 20% opacity
  };
};