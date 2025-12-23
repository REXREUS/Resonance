/**
 * Emotional telemetry utilities for session reporting
 * Handles emotion analysis and visualization data processing
 */

// Valid emotional states
const VALID_EMOTIONS = ['neutral', 'hostile', 'happy', 'frustrated', 'anxious'];

/**
 * Process emotional telemetry data for visualization
 * @param {Array} telemetryData - Array of emotion points
 * @param {number} sessionDuration - Session duration in milliseconds
 * @returns {Object} Processed telemetry data
 */
export function processEmotionalTelemetry(telemetryData, sessionDuration) {
  if (!Array.isArray(telemetryData) || sessionDuration <= 0) {
    return {
      points: [],
      summary: {
        dominantEmotion: 'neutral',
        emotionChanges: 0,
        averageIntensity: 0,
        timeInEmotion: {},
        emotionDistribution: {}
      },
      chartData: []
    };
  }

  // Validate and sort telemetry data
  const validPoints = telemetryData
    .filter(point => 
      point && 
      typeof point.timestamp === 'number' && 
      point.timestamp >= 0 && 
      point.timestamp <= sessionDuration &&
      VALID_EMOTIONS.includes(point.state) &&
      typeof point.intensity === 'number' &&
      point.intensity >= 0 && 
      point.intensity <= 1
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  // Calculate emotion summary
  const summary = calculateEmotionSummary(validPoints, sessionDuration);

  // Generate chart data points
  const chartData = generateChartData(validPoints, sessionDuration);

  return {
    points: validPoints,
    summary,
    chartData
  };
}

/**
 * Calculate emotion summary statistics
 * @param {Array} points - Valid emotion points
 * @param {number} sessionDuration - Session duration in milliseconds
 * @returns {Object} Emotion summary
 */
function calculateEmotionSummary(points, sessionDuration) {
  if (points.length === 0) {
    return {
      dominantEmotion: 'neutral',
      emotionChanges: 0,
      averageIntensity: 0,
      timeInEmotion: { neutral: sessionDuration },
      emotionDistribution: { neutral: 100 }
    };
  }

  // Calculate time spent in each emotion
  const timeInEmotion = {};
  const emotionCounts = {};
  
  // Initialize counters
  VALID_EMOTIONS.forEach(emotion => {
    timeInEmotion[emotion] = 0;
    emotionCounts[emotion] = 0;
  });

  // Handle time before first emotion point (assume neutral)
  if (points.length > 0 && points[0].timestamp > 0) {
    timeInEmotion['neutral'] += points[0].timestamp;
  }

  // Calculate time intervals between emotion changes
  for (let i = 0; i < points.length; i++) {
    const currentPoint = points[i];
    const nextPoint = points[i + 1];
    
    const startTime = currentPoint.timestamp;
    const endTime = nextPoint ? nextPoint.timestamp : sessionDuration;
    const duration = endTime - startTime;
    
    timeInEmotion[currentPoint.state] += duration;
    emotionCounts[currentPoint.state]++;
  }

  // Find dominant emotion (most time spent)
  const dominantEmotion = Object.keys(timeInEmotion).reduce((a, b) => 
    timeInEmotion[a] > timeInEmotion[b] ? a : b
  );

  // Calculate emotion distribution percentages
  const emotionDistribution = {};
  Object.keys(timeInEmotion).forEach(emotion => {
    emotionDistribution[emotion] = (timeInEmotion[emotion] / sessionDuration) * 100;
  });

  // Count emotion changes (transitions between different emotions)
  let emotionChanges = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].state !== points[i - 1].state) {
      emotionChanges++;
    }
  }

  // Calculate average intensity
  const totalIntensity = points.reduce((sum, point) => sum + point.intensity, 0);
  const averageIntensity = points.length > 0 ? totalIntensity / points.length : 0;

  return {
    dominantEmotion,
    emotionChanges,
    averageIntensity: Math.round(averageIntensity * 1000) / 1000, // Round to 3 decimal places
    timeInEmotion,
    emotionDistribution: Object.fromEntries(
      Object.entries(emotionDistribution).map(([emotion, percentage]) => [
        emotion, 
        Math.round(percentage * 100) / 100
      ])
    )
  };
}

/**
 * Generate chart data for visualization
 * @param {Array} points - Valid emotion points
 * @param {number} sessionDuration - Session duration in milliseconds
 * @returns {Array} Chart data points
 */
function generateChartData(points, sessionDuration) {
  if (points.length === 0) {
    return [
      { timestamp: 0, emotion: 'neutral', intensity: 0, x: 0, y: 0 },
      { timestamp: sessionDuration, emotion: 'neutral', intensity: 0, x: sessionDuration, y: 0 }
    ];
  }

  const chartData = [];

  // Add starting point if first point is not at timestamp 0
  if (points[0].timestamp > 0) {
    chartData.push({
      timestamp: 0,
      emotion: 'neutral',
      intensity: 0,
      x: 0,
      y: 0
    });
  }

  // Convert emotion points to chart format
  points.forEach((point, index) => {
    chartData.push({
      timestamp: point.timestamp,
      emotion: point.state,
      intensity: point.intensity,
      x: point.timestamp,
      y: mapEmotionToYValue(point.state, point.intensity)
    });
  });

  // Add ending point if last point is not at session end
  const lastPoint = points[points.length - 1];
  if (lastPoint.timestamp < sessionDuration) {
    chartData.push({
      timestamp: sessionDuration,
      emotion: lastPoint.state,
      intensity: lastPoint.intensity,
      x: sessionDuration,
      y: mapEmotionToYValue(lastPoint.state, lastPoint.intensity)
    });
  }

  return chartData;
}

/**
 * Map emotion state and intensity to Y-axis value for charting
 * @param {string} emotion - Emotion state
 * @param {number} intensity - Intensity value (0-1)
 * @returns {number} Y-axis value
 */
function mapEmotionToYValue(emotion, intensity) {
  const emotionBaseValues = {
    'hostile': -2,
    'frustrated': -1,
    'neutral': 0,
    'anxious': 1,
    'happy': 2
  };

  const baseValue = emotionBaseValues[emotion] || 0;
  
  // Scale intensity to affect the Y position within the emotion band
  const intensityOffset = (intensity - 0.5) * 0.8; // Scale to ±0.4 range
  
  return baseValue + intensityOffset;
}

/**
 * Validate emotional telemetry point
 * @param {Object} point - Telemetry point to validate
 * @returns {boolean} True if point is valid
 */
export function validateTelemetryPoint(point) {
  if (!point || typeof point !== 'object') {
    return false;
  }

  const { timestamp, state, intensity } = point;

  // Check required fields
  if (typeof timestamp !== 'number' || timestamp < 0) {
    return false;
  }

  if (!VALID_EMOTIONS.includes(state)) {
    return false;
  }

  if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
    return false;
  }

  return true;
}

/**
 * Create emotion transition analysis
 * @param {Array} points - Emotion points
 * @returns {Object} Transition analysis
 */
export function analyzeEmotionTransitions(points) {
  // Initialize transition matrix for all cases
  const transitionMatrix = {};
  VALID_EMOTIONS.forEach(fromEmotion => {
    transitionMatrix[fromEmotion] = {};
    VALID_EMOTIONS.forEach(toEmotion => {
      transitionMatrix[fromEmotion][toEmotion] = 0;
    });
  });

  if (!Array.isArray(points) || points.length < 2) {
    return {
      transitions: [],
      transitionMatrix,
      mostCommonTransition: null,
      transitionFrequency: 0
    };
  }

  const transitions = [];
  const transitionCounts = {};

  // Analyze transitions between consecutive points
  for (let i = 1; i < points.length; i++) {
    const fromEmotion = points[i - 1].state;
    const toEmotion = points[i].state;
    
    if (fromEmotion !== toEmotion) {
      const transition = `${fromEmotion} → ${toEmotion}`;
      transitions.push({
        from: fromEmotion,
        to: toEmotion,
        timestamp: points[i].timestamp,
        transition
      });

      transitionCounts[transition] = (transitionCounts[transition] || 0) + 1;
    }
  }

  // Find most common transition
  let mostCommonTransition = null;
  let maxCount = 0;
  
  Object.entries(transitionCounts).forEach(([transition, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonTransition = transition;
    }
  });

  // Update transition matrix with counts
  VALID_EMOTIONS.forEach(fromEmotion => {
    VALID_EMOTIONS.forEach(toEmotion => {
      const transitionKey = `${fromEmotion} → ${toEmotion}`;
      transitionMatrix[fromEmotion][toEmotion] = transitionCounts[transitionKey] || 0;
    });
  });

  return {
    transitions,
    transitionMatrix,
    mostCommonTransition,
    transitionFrequency: maxCount
  };
}

/**
 * Calculate emotion stability score
 * @param {Array} points - Emotion points
 * @param {number} sessionDuration - Session duration in milliseconds
 * @returns {Object} Stability analysis
 */
export function calculateEmotionStability(points, sessionDuration) {
  if (!Array.isArray(points) || points.length === 0 || sessionDuration <= 0) {
    return {
      stabilityScore: 100, // Perfect stability if no data
      volatilityIndex: 0,
      longestStableEmotion: 'neutral',
      longestStableDuration: sessionDuration
    };
  }

  // Calculate emotion changes
  let emotionChanges = 0;
  let longestStableDuration = 0;
  let longestStableEmotion = points[0].state;
  let currentStableDuration = 0;
  let currentStableEmotion = points[0].state;

  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    if (currentPoint.state === prevPoint.state) {
      // Same emotion, continue stable period
      currentStableDuration += currentPoint.timestamp - prevPoint.timestamp;
    } else {
      // Emotion changed
      emotionChanges++;
      
      // Check if this was the longest stable period
      if (currentStableDuration > longestStableDuration) {
        longestStableDuration = currentStableDuration;
        longestStableEmotion = currentStableEmotion;
      }
      
      // Start new stable period
      currentStableEmotion = currentPoint.state;
      currentStableDuration = 0;
    }
  }

  // Check final stable period
  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    currentStableDuration += sessionDuration - lastPoint.timestamp;
    
    if (currentStableDuration > longestStableDuration) {
      longestStableDuration = currentStableDuration;
      longestStableEmotion = currentStableEmotion;
    }
  }

  // Calculate stability score (0-100, higher is more stable)
  const changeRate = emotionChanges / (sessionDuration / 60000); // Changes per minute
  const stabilityScore = Math.max(0, Math.min(100, 100 - (changeRate * 20)));

  // Calculate volatility index (0-1, higher is more volatile)
  const volatilityIndex = Math.min(1, changeRate / 5);

  return {
    stabilityScore: Math.round(stabilityScore * 100) / 100,
    volatilityIndex: Math.round(volatilityIndex * 1000) / 1000,
    longestStableEmotion,
    longestStableDuration: Math.round(longestStableDuration)
  };
}

/**
 * Get supported emotions list
 * @returns {Array} Array of valid emotion states
 */
export function getSupportedEmotions() {
  return [...VALID_EMOTIONS];
}

/**
 * Create emotion color mapping for visualization
 * @returns {Object} Emotion to color mapping
 */
export function getEmotionColorMap() {
  return {
    'neutral': '#6B7280',    // Gray
    'happy': '#10B981',      // Green
    'frustrated': '#F59E0B', // Amber
    'hostile': '#EF4444',    // Red
    'anxious': '#8B5CF6'     // Purple
  };
}