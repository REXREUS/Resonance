/**
 * Hesitation detection and transcript replay utilities
 * Handles detection of hesitation patterns and audio segment replay functionality
 */

/**
 * Detect hesitation patterns in text
 * @param {string} text - Text to analyze for hesitation
 * @returns {Object} Hesitation detection results
 */
export function detectHesitation(text) {
  if (!text || typeof text !== 'string') {
    return {
      hasHesitation: false,
      patterns: [],
      confidence: 0,
      markers: []
    };
  }

  const hesitationPatterns = [
    {
      name: 'multiple_dots',
      regex: /\.{2,}/g,
      description: 'Multiple dots indicating pause'
    },
    {
      name: 'multiple_spaces',
      regex: /\s{3,}/g,
      description: 'Multiple spaces indicating pause'
    },
    {
      name: 'filler_words',
      regex: /\b(um|uh|er|ah|eung|anu|uhm|eh|emm|hmm)\b/gi,
      description: 'Filler words'
    },
    {
      name: 'repetitive_words',
      regex: /\b(\w+)\s+\1\b/gi,
      description: 'Repeated words'
    },
    {
      name: 'incomplete_sentences',
      regex: /\b\w+\s*-{1,2}\s*\w+/g,
      description: 'Incomplete sentences with dashes'
    },
    {
      name: 'stuttering',
      regex: /\b(\w)\1{2,}\w*/gi,
      description: 'Stuttering patterns'
    }
  ];

  const detectedPatterns = [];
  const markers = [];
  let totalMatches = 0;

  hesitationPatterns.forEach(pattern => {
    let match;
    const matches = [];
    
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        pattern: pattern.name
      });
      totalMatches++;
    }

    if (matches.length > 0) {
      detectedPatterns.push({
        name: pattern.name,
        description: pattern.description,
        count: matches.length,
        matches
      });

      // Add markers for visualization
      matches.forEach(match => {
        markers.push({
          position: match.start,
          length: match.end - match.start,
          type: pattern.name,
          text: match.text
        });
      });
    }
  });

  // Calculate confidence based on pattern density
  const wordCount = text.trim().split(/\s+/).length;
  const hesitationDensity = wordCount > 0 ? totalMatches / wordCount : 0;
  
  let confidence = 0;
  if (hesitationDensity > 0.3) {
    confidence = 0.9; // High confidence
  } else if (hesitationDensity > 0.15) {
    confidence = 0.7; // Medium confidence
  } else if (hesitationDensity > 0.05) {
    confidence = 0.4; // Low confidence
  } else if (totalMatches > 0) {
    confidence = 0.2; // Very low confidence
  }

  // Sort markers by position
  markers.sort((a, b) => a.position - b.position);

  return {
    hasHesitation: totalMatches > 0,
    patterns: detectedPatterns,
    confidence: Math.round(confidence * 1000) / 1000,
    markers,
    totalMatches,
    hesitationDensity: Math.round(hesitationDensity * 1000) / 1000
  };
}

/**
 * Process transcript for hesitation detection and replay functionality
 * @param {Array} transcript - Array of transcript entries
 * @returns {Object} Processed transcript with hesitation data
 */
export function processTranscriptForReplay(transcript) {
  if (!Array.isArray(transcript)) {
    return {
      entries: [],
      hesitationSummary: {
        totalHesitations: 0,
        userHesitations: 0,
        aiHesitations: 0,
        hesitationRate: 0
      },
      replaySegments: []
    };
  }

  const processedEntries = [];
  const replaySegments = [];
  let totalHesitations = 0;
  let userHesitations = 0;
  let aiHesitations = 0;

  transcript.forEach((entry, index) => {
    if (!entry || typeof entry.text !== 'string') {
      processedEntries.push({
        ...entry,
        hesitationData: {
          hasHesitation: false,
          patterns: [],
          confidence: 0,
          markers: []
        }
      });
      return;
    }

    const hesitationData = detectHesitation(entry.text);
    
    const processedEntry = {
      ...entry,
      hesitationData,
      segmentId: `segment_${index}`,
      replayable: Boolean(entry.audioPath)
    };

    processedEntries.push(processedEntry);

    // Update counters
    if (hesitationData.hasHesitation) {
      totalHesitations++;
      if (entry.sender === 'user') {
        userHesitations++;
      } else if (entry.sender === 'ai') {
        aiHesitations++;
      }

      // Create replay segment if audio is available
      if (entry.audioPath) {
        replaySegments.push({
          segmentId: processedEntry.segmentId,
          timestamp: entry.timestamp || 0,
          audioPath: entry.audioPath,
          text: entry.text,
          sender: entry.sender,
          hesitationData,
          startTime: calculateSegmentStartTime(entry, transcript, index),
          endTime: calculateSegmentEndTime(entry, transcript, index)
        });
      }
    }
  });

  const hesitationRate = transcript.length > 0 ? totalHesitations / transcript.length : 0;

  // Sort replay segments by start time
  replaySegments.sort((a, b) => a.startTime - b.startTime);

  return {
    entries: processedEntries,
    hesitationSummary: {
      totalHesitations,
      userHesitations,
      aiHesitations,
      hesitationRate: Math.round(hesitationRate * 1000) / 1000
    },
    replaySegments
  };
}

/**
 * Calculate segment start time for replay
 * @param {Object} entry - Current transcript entry
 * @param {Array} transcript - Full transcript
 * @param {number} index - Current entry index
 * @returns {number} Start time in milliseconds
 */
function calculateSegmentStartTime(entry, transcript, index) {
  // Use entry timestamp if available
  if (typeof entry.timestamp === 'number') {
    return entry.timestamp;
  }

  // Estimate based on previous entries
  if (index > 0) {
    const prevEntry = transcript[index - 1];
    if (typeof prevEntry.timestamp === 'number') {
      return prevEntry.timestamp + estimateEntryDuration(prevEntry);
    }
  }

  // Default to index-based estimation (assuming 3 seconds per entry)
  return index * 3000;
}

/**
 * Calculate segment end time for replay
 * @param {Object} entry - Current transcript entry
 * @param {Array} transcript - Full transcript
 * @param {number} index - Current entry index
 * @returns {number} End time in milliseconds
 */
function calculateSegmentEndTime(entry, transcript, index) {
  const startTime = calculateSegmentStartTime(entry, transcript, index);
  const duration = estimateEntryDuration(entry);
  
  // Check if next entry exists and use its timestamp
  if (index < transcript.length - 1) {
    const nextEntry = transcript[index + 1];
    if (typeof nextEntry.timestamp === 'number') {
      // Ensure end time is always after start time
      return Math.max(startTime + Math.min(duration, 1000), nextEntry.timestamp);
    }
  }

  return startTime + duration;
}

/**
 * Estimate duration of a transcript entry
 * @param {Object} entry - Transcript entry
 * @returns {number} Estimated duration in milliseconds
 */
function estimateEntryDuration(entry) {
  if (!entry.text || typeof entry.text !== 'string') {
    return 1000; // Default 1 second
  }

  // Estimate based on text length (average speaking rate: 150 WPM)
  const wordCount = entry.text.trim().split(/\s+/).length;
  const estimatedSeconds = (wordCount / 150) * 60;
  
  // Add extra time for hesitations
  const hesitationData = detectHesitation(entry.text);
  const hesitationPenalty = hesitationData.totalMatches * 0.5; // 0.5 seconds per hesitation
  
  return Math.max(1000, (estimatedSeconds + hesitationPenalty) * 1000);
}

/**
 * Create replay segment from transcript entry
 * @param {Object} entry - Transcript entry
 * @param {number} startTime - Segment start time
 * @param {number} endTime - Segment end time
 * @returns {Object} Replay segment object
 */
export function createReplaySegment(entry, startTime, endTime) {
  if (!entry) {
    return null;
  }

  const hesitationData = detectHesitation(entry.text || '');

  return {
    segmentId: entry.segmentId || `segment_${Date.now()}`,
    timestamp: entry.timestamp || startTime,
    audioPath: entry.audioPath,
    text: entry.text || '',
    sender: entry.sender || 'unknown',
    hesitationData,
    startTime,
    endTime,
    duration: endTime - startTime,
    replayable: Boolean(entry.audioPath)
  };
}

/**
 * Validate transcript entry for replay functionality
 * @param {Object} entry - Transcript entry to validate
 * @returns {boolean} True if entry is valid for replay
 */
export function validateTranscriptEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  // Check required fields
  if (typeof entry.text !== 'string') {
    return false;
  }

  if (!['user', 'ai'].includes(entry.sender)) {
    return false;
  }

  // Timestamp should be number if present
  if (entry.timestamp !== undefined && typeof entry.timestamp !== 'number') {
    return false;
  }

  // Audio path should be string if present
  if (entry.audioPath !== undefined && typeof entry.audioPath !== 'string') {
    return false;
  }

  return true;
}

/**
 * Find hesitation segments in transcript
 * @param {Array} transcript - Transcript entries
 * @param {number} minConfidence - Minimum confidence threshold (0-1)
 * @returns {Array} Array of hesitation segments
 */
export function findHesitationSegments(transcript, minConfidence = 0.3) {
  if (!Array.isArray(transcript)) {
    return [];
  }

  const hesitationSegments = [];

  transcript.forEach((entry, index) => {
    if (!validateTranscriptEntry(entry)) {
      return;
    }

    const hesitationData = detectHesitation(entry.text);
    
    if (hesitationData.hasHesitation && hesitationData.confidence >= minConfidence) {
      hesitationSegments.push({
        index,
        entry,
        hesitationData,
        segmentId: `hesitation_${index}`,
        replayable: Boolean(entry.audioPath)
      });
    }
  });

  return hesitationSegments;
}

/**
 * Get hesitation statistics for transcript
 * @param {Array} transcript - Transcript entries
 * @returns {Object} Hesitation statistics
 */
export function getHesitationStatistics(transcript) {
  if (!Array.isArray(transcript)) {
    return {
      totalEntries: 0,
      entriesWithHesitation: 0,
      hesitationRate: 0,
      averageConfidence: 0,
      patternBreakdown: {},
      userVsAiHesitation: {
        user: { count: 0, rate: 0 },
        ai: { count: 0, rate: 0 }
      }
    };
  }

  let entriesWithHesitation = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;
  const patternCounts = {};
  const senderStats = { user: { total: 0, hesitation: 0 }, ai: { total: 0, hesitation: 0 } };

  transcript.forEach(entry => {
    if (!validateTranscriptEntry(entry)) {
      return;
    }

    // Count by sender
    if (entry.sender === 'user' || entry.sender === 'ai') {
      senderStats[entry.sender].total++;
    }

    const hesitationData = detectHesitation(entry.text);
    
    if (hesitationData.hasHesitation) {
      entriesWithHesitation++;
      
      if (entry.sender === 'user' || entry.sender === 'ai') {
        senderStats[entry.sender].hesitation++;
      }

      if (hesitationData.confidence > 0) {
        totalConfidence += hesitationData.confidence;
        confidenceCount++;
      }

      // Count patterns
      hesitationData.patterns.forEach(pattern => {
        patternCounts[pattern.name] = (patternCounts[pattern.name] || 0) + pattern.count;
      });
    }
  });

  const hesitationRate = transcript.length > 0 ? entriesWithHesitation / transcript.length : 0;
  const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  return {
    totalEntries: transcript.length,
    entriesWithHesitation,
    hesitationRate: Math.round(hesitationRate * 1000) / 1000,
    averageConfidence: Math.round(averageConfidence * 1000) / 1000,
    patternBreakdown: patternCounts,
    userVsAiHesitation: {
      user: {
        count: senderStats.user.hesitation,
        rate: senderStats.user.total > 0 ? 
          Math.round((senderStats.user.hesitation / senderStats.user.total) * 1000) / 1000 : 0
      },
      ai: {
        count: senderStats.ai.hesitation,
        rate: senderStats.ai.total > 0 ? 
          Math.round((senderStats.ai.hesitation / senderStats.ai.total) * 1000) / 1000 : 0
      }
    }
  };
}