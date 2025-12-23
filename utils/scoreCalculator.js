/**
 * Score calculation utilities for session reporting
 * Implements scoring system (0-100) with grade calculation
 */

/**
 * Calculate overall session score based on performance metrics
 * @param {Object} metrics - Performance metrics
 * @param {number} metrics.pace - Words per minute
 * @param {number} metrics.fillerWordCount - Number of filler words
 * @param {number} metrics.clarity - Clarity percentage (0-100)
 * @param {number} metrics.confidence - Confidence percentage (0-100)
 * @param {number} metrics.duration - Session duration in seconds
 * @returns {number} Overall score (0-100)
 */
export function calculateSessionScore(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return 0;
  }

  const {
    pace = 0,
    fillerWordCount = 0,
    clarity = 0,
    confidence = 0,
    duration = 0
  } = metrics;

  // Validate input ranges
  if (pace < 0 || clarity < 0 || clarity > 100 || confidence < 0 || confidence > 100 || duration < 0) {
    return 0;
  }

  // Calculate pace score (optimal range: 150-180 WPM)
  const paceScore = calculatePaceScore(pace);
  
  // Calculate filler word penalty
  const fillerPenalty = calculateFillerWordPenalty(fillerWordCount, duration);
  
  // Calculate base score from metrics
  const baseScore = (paceScore + clarity + confidence) / 3;
  
  // Apply filler word penalty
  const finalScore = Math.max(0, Math.min(100, baseScore - fillerPenalty));
  
  return Math.round(finalScore);
}

/**
 * Calculate pace score from words per minute
 * @param {number} pace - Words per minute
 * @returns {number} Pace score (0-100)
 */
export function calculatePaceScore(pace) {
  if (pace <= 0) return 0;
  
  const optimalMin = 150;
  const optimalMax = 180;
  
  if (pace >= optimalMin && pace <= optimalMax) {
    return 100;
  } else if (pace < optimalMin) {
    // Too slow - linear decrease
    return Math.max(0, (pace / optimalMin) * 100);
  } else {
    // Too fast - penalty increases with speed
    const excessSpeed = pace - optimalMax;
    const penalty = Math.min(50, (excessSpeed / optimalMax) * 50);
    return Math.max(0, 100 - penalty);
  }
}

/**
 * Calculate filler word penalty based on count and duration
 * @param {number} fillerWordCount - Number of filler words
 * @param {number} duration - Session duration in seconds
 * @returns {number} Penalty points to subtract from score
 */
export function calculateFillerWordPenalty(fillerWordCount, duration) {
  if (fillerWordCount <= 0 || duration <= 0) return 0;
  
  // Calculate filler words per minute
  const fillerWordsPerMinute = (fillerWordCount / duration) * 60;
  
  // Penalty increases exponentially with filler word frequency
  if (fillerWordsPerMinute <= 1) {
    return fillerWordsPerMinute * 2; // Minimal penalty for low usage
  } else if (fillerWordsPerMinute <= 3) {
    return 2 + (fillerWordsPerMinute - 1) * 5; // Moderate penalty
  } else {
    return 12 + (fillerWordsPerMinute - 3) * 8; // Heavy penalty for excessive usage
  }
}

/**
 * Calculate letter grade from numerical score
 * @param {number} score - Numerical score (0-100)
 * @returns {string} Letter grade
 */
export function calculateGrade(score) {
  if (typeof score !== 'number' || score < 0 || score > 100) {
    return 'F';
  }
  
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Validate metrics object for score calculation
 * @param {Object} metrics - Metrics to validate
 * @returns {boolean} True if metrics are valid
 */
export function validateMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }

  const { pace, fillerWordCount, clarity, confidence, duration } = metrics;

  // Check required fields exist and are numbers
  if (typeof pace !== 'number' || typeof fillerWordCount !== 'number' ||
      typeof clarity !== 'number' || typeof confidence !== 'number' ||
      typeof duration !== 'number') {
    return false;
  }

  // Check value ranges
  if (pace < 0 || fillerWordCount < 0 || clarity < 0 || clarity > 100 ||
      confidence < 0 || confidence > 100 || duration < 0) {
    return false;
  }

  return true;
}

/**
 * Calculate comprehensive session report with all scoring metrics
 * @param {Object} sessionData - Complete session data
 * @returns {Object} Comprehensive report with scores and grades
 */
export function calculateSessionReport(sessionData) {
  if (!sessionData || !sessionData.metrics) {
    return {
      score: 0,
      grade: 'F',
      paceScore: 0,
      fillerPenalty: 0,
      isValid: false
    };
  }

  const { metrics } = sessionData;
  
  if (!validateMetrics(metrics)) {
    return {
      score: 0,
      grade: 'F',
      paceScore: 0,
      fillerPenalty: 0,
      isValid: false
    };
  }

  const paceScore = calculatePaceScore(metrics.pace);
  const fillerPenalty = calculateFillerWordPenalty(metrics.fillerWordCount, metrics.duration);
  const overallScore = calculateSessionScore(metrics);
  const grade = calculateGrade(overallScore);

  return {
    score: overallScore,
    grade,
    paceScore,
    fillerPenalty,
    isValid: true,
    breakdown: {
      pace: paceScore,
      clarity: metrics.clarity,
      confidence: metrics.confidence,
      fillerWordCount: metrics.fillerWordCount,
      duration: metrics.duration
    }
  };
}