/**
 * Multilingual filler word detection utilities
 * Supports Indonesian and English filler words
 */

// Indonesian filler words
const INDONESIAN_FILLER_WORDS = [
  'eung', 'anu', 'uhm', 'eh', 'emm', 'hmm', 'ya', 'gitu', 'kan', 'sih'
];

// English filler words
const ENGLISH_FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'well', 'so', 'actually', 'basically',
  'literally', 'right', 'okay', 'alright', 'I mean', 'sort of', 'kind of'
];

// Combined list for multilingual detection
const ALL_FILLER_WORDS = [...INDONESIAN_FILLER_WORDS, ...ENGLISH_FILLER_WORDS];

/**
 * Detect and count filler words in text
 * @param {string} text - Text to analyze
 * @param {string} language - Language code ('id' for Indonesian, 'en' for English, 'all' for both)
 * @returns {Object} Detection results
 */
export function detectFillerWords(text, language = 'all') {
  if (!text || typeof text !== 'string') {
    return {
      count: 0,
      words: [],
      positions: [],
      density: 0
    };
  }

  // Normalize text - convert to lowercase and clean
  const normalizedText = text.toLowerCase().trim();
  
  // Get appropriate filler word list based on language
  let fillerWords;
  switch (language) {
    case 'id':
      fillerWords = INDONESIAN_FILLER_WORDS;
      break;
    case 'en':
      fillerWords = ENGLISH_FILLER_WORDS;
      break;
    case 'all':
    default:
      fillerWords = ALL_FILLER_WORDS;
      break;
  }

  const detectedWords = [];
  const positions = [];
  let totalCount = 0;

  // Detect each filler word
  fillerWords.forEach(fillerWord => {
    // Create regex pattern for word boundaries
    const pattern = new RegExp(`\\b${escapeRegExp(fillerWord)}\\b`, 'gi');
    let match;

    while ((match = pattern.exec(normalizedText)) !== null) {
      detectedWords.push({
        word: fillerWord,
        match: match[0],
        position: match.index,
        language: getFillerWordLanguage(fillerWord)
      });
      positions.push(match.index);
      totalCount++;
    }
  });

  // Sort by position
  detectedWords.sort((a, b) => a.position - b.position);
  positions.sort((a, b) => a - b);

  // Calculate density (filler words per 100 words)
  const wordCount = countWords(text);
  const density = wordCount > 0 ? (totalCount / wordCount) * 100 : 0;

  return {
    count: totalCount,
    words: detectedWords,
    positions,
    density: Math.round(density * 100) / 100, // Round to 2 decimal places
    wordCount,
    breakdown: getLanguageBreakdown(detectedWords)
  };
}

/**
 * Count total words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Split by whitespace and filter out empty strings
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Get language breakdown of detected filler words
 * @param {Array} detectedWords - Array of detected filler word objects
 * @returns {Object} Language breakdown
 */
function getLanguageBreakdown(detectedWords) {
  const breakdown = {
    indonesian: 0,
    english: 0
  };

  detectedWords.forEach(wordObj => {
    if (wordObj.language === 'indonesian') {
      breakdown.indonesian++;
    } else if (wordObj.language === 'english') {
      breakdown.english++;
    }
  });

  return breakdown;
}

/**
 * Determine the language of a filler word
 * @param {string} word - Filler word
 * @returns {string} Language ('indonesian' or 'english')
 */
function getFillerWordLanguage(word) {
  if (INDONESIAN_FILLER_WORDS.includes(word.toLowerCase())) {
    return 'indonesian';
  } else if (ENGLISH_FILLER_WORDS.includes(word.toLowerCase())) {
    return 'english';
  }
  return 'unknown';
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Analyze filler word patterns in conversation transcript
 * @param {Array} transcript - Array of conversation entries
 * @param {string} language - Language code for detection
 * @returns {Object} Pattern analysis
 */
export function analyzeFillerWordPatterns(transcript, language = 'all') {
  if (!Array.isArray(transcript)) {
    return {
      totalCount: 0,
      userCount: 0,
      aiCount: 0,
      userDensity: 0,
      aiDensity: 0,
      timeline: []
    };
  }

  let totalCount = 0;
  let userCount = 0;
  let aiCount = 0;
  let userWordCount = 0;
  let aiWordCount = 0;
  const timeline = [];

  transcript.forEach((entry, index) => {
    if (!entry.text || typeof entry.text !== 'string') {
      return;
    }

    const detection = detectFillerWords(entry.text, language);
    const wordCount = countWords(entry.text);

    totalCount += detection.count;

    if (entry.sender === 'user') {
      userCount += detection.count;
      userWordCount += wordCount;
    } else if (entry.sender === 'ai') {
      aiCount += detection.count;
      aiWordCount += wordCount;
    }

    if (detection.count > 0) {
      timeline.push({
        index,
        sender: entry.sender,
        timestamp: entry.timestamp || 0,
        count: detection.count,
        words: detection.words,
        density: detection.density
      });
    }
  });

  const userDensity = userWordCount > 0 ? (userCount / userWordCount) * 100 : 0;
  const aiDensity = aiWordCount > 0 ? (aiCount / aiWordCount) * 100 : 0;

  return {
    totalCount,
    userCount,
    aiCount,
    userDensity: Math.round(userDensity * 100) / 100,
    aiDensity: Math.round(aiDensity * 100) / 100,
    timeline,
    userWordCount,
    aiWordCount
  };
}

/**
 * Get supported languages for filler word detection
 * @returns {Array} Array of supported language objects
 */
export function getSupportedLanguages() {
  return [
    {
      code: 'id',
      name: 'Indonesian',
      fillerWords: INDONESIAN_FILLER_WORDS
    },
    {
      code: 'en',
      name: 'English',
      fillerWords: ENGLISH_FILLER_WORDS
    },
    {
      code: 'all',
      name: 'All Languages',
      fillerWords: ALL_FILLER_WORDS
    }
  ];
}

/**
 * Validate filler word detection input
 * @param {string} text - Text to validate
 * @param {string} language - Language code to validate
 * @returns {boolean} True if input is valid
 */
export function validateInput(text, language) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const supportedLanguages = ['id', 'en', 'all'];
  if (language && !supportedLanguages.includes(language)) {
    return false;
  }

  return true;
}

/**
 * Calculate filler word score impact on overall performance
 * @param {number} fillerCount - Number of filler words
 * @param {number} totalWords - Total word count
 * @param {number} duration - Duration in seconds
 * @returns {Object} Score impact analysis
 */
export function calculateFillerWordImpact(fillerCount, totalWords, duration) {
  if (fillerCount < 0 || totalWords < 0 || duration <= 0) {
    return {
      density: 0,
      impact: 0,
      severity: 'none',
      recommendation: 'No filler words detected',
      fillerWordsPerMinute: 0
    };
  }

  // Handle zero filler words case
  if (fillerCount === 0) {
    return {
      density: 0,
      impact: 0,
      severity: 'none',
      recommendation: 'No filler words detected',
      fillerWordsPerMinute: 0
    };
  }

  const density = totalWords > 0 ? (fillerCount / totalWords) * 100 : 0;
  const fillerWordsPerMinute = (fillerCount / duration) * 60;

  let severity;
  let impact;
  let recommendation;

  if (density <= 2) {
    severity = 'low';
    impact = Math.min(5, density * 2.5);
    recommendation = 'Excellent control of filler words. Keep it up!';
  } else if (density <= 5) {
    severity = 'moderate';
    impact = 5 + (density - 2) * 3;
    recommendation = 'Good control, but try to reduce filler words further.';
  } else if (density <= 10) {
    severity = 'high';
    impact = 14 + (density - 5) * 4;
    recommendation = 'Focus on reducing filler words to improve clarity.';
  } else {
    severity = 'critical';
    impact = Math.min(50, 34 + (density - 10) * 2);
    recommendation = 'Significant filler word usage detected. Practice pausing instead of using fillers.';
  }

  return {
    density: Math.round(density * 100) / 100,
    impact: Math.round(impact * 100) / 100,
    severity,
    recommendation,
    fillerWordsPerMinute: Math.round(fillerWordsPerMinute * 100) / 100
  };
}