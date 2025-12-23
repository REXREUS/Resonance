import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { TRANSLATIONS } from '../constants/languages';
import { databaseService } from '../services/databaseService';

/**
 * Export Generator for creating PDF reports and data exports
 * Uses expo-print for PDF generation and expo-file-system/next for file operations
 */
class ExportGenerator {
  constructor() {
    this.supportedLanguages = ['id', 'en'];
  }

  /**
   * Generate comprehensive session analytics export
   */
  async generateSessionAnalytics(sessionId, language = 'id') {
    if (!this.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const session = await databaseService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const chatLogs = await databaseService.getChatLogs(sessionId);
    const emotionalTelemetry = await databaseService.getEmotionalTelemetry(sessionId);
    const translations = TRANSLATIONS[language];
    
    // Get AI feedback if available
    let aiFeedback = null;
    try {
      aiFeedback = await databaseService.getSessionAIFeedback(sessionId);
    } catch (e) {
      console.log('No AI feedback found for session');
    }

    const analytics = {
      sessionInfo: {
        id: session.id,
        timestamp: session.timestamp,
        scenario: session.scenario,
        mode: session.mode,
        duration: session.duration,
        completed: session.completed
      },
      metrics: {
        score: session.score,
        pace: session.pace,
        fillerWordCount: session.filler_word_count,
        clarityScore: session.clarity_score,
        confidenceScore: session.confidence_score
      },
      transcript: chatLogs.map(log => ({
        sender: log.sender,
        text: log.text,
        timestamp: log.timestamp,
        hasHesitation: log.has_hesitation
      })),
      emotionalTelemetry: emotionalTelemetry.map(telemetry => ({
        timestamp: telemetry.timestamp,
        emotionState: telemetry.emotion_state,
        intensity: telemetry.intensity
      })),
      aiFeedback,
      language,
      translations
    };

    return analytics;
  }

  /**
   * Generate SVG chart for emotional telemetry
   */
  generateEmotionChartSvg(emotionalTelemetry, duration) {
    if (!emotionalTelemetry || emotionalTelemetry.length === 0) {
      return '';
    }

    const width = 500;
    const height = 120;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Emotion to color and Y position mapping
    const emotionConfig = {
      'hostile': { color: '#EF4444', y: 0, label: 'Hostile' },
      'frustrated': { color: '#F59E0B', y: 0.25, label: 'Frustrated' },
      'anxious': { color: '#8B5CF6', y: 0.5, label: 'Anxious' },
      'neutral': { color: '#6B7280', y: 0.75, label: 'Neutral' },
      'happy': { color: '#10B981', y: 1, label: 'Happy' }
    };

    // Generate path points
    const points = emotionalTelemetry.map((point, index) => {
      const x = padding.left + (point.timestamp / (duration * 1000)) * chartWidth;
      const emotionY = emotionConfig[point.emotionState]?.y || 0.5;
      const y = padding.top + chartHeight - (emotionY * chartHeight);
      return { x, y, emotion: point.emotionState, intensity: point.intensity };
    });

    // Create SVG path
    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }
    }

    // Create area path (filled)
    let areaD = '';
    if (points.length > 0) {
      areaD = `M ${points[0].x} ${padding.top + chartHeight}`;
      areaD += ` L ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        areaD += ` L ${points[i].x} ${points[i].y}`;
      }
      areaD += ` L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;
    }

    // Generate emotion labels on Y axis
    const yLabels = Object.entries(emotionConfig).map(([emotion, config]) => {
      const y = padding.top + chartHeight - (config.y * chartHeight);
      return `<text x="${padding.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">${config.label}</text>`;
    }).join('');

    // Generate emotion dots
    const dots = points.map((point, i) => {
      const config = emotionConfig[point.emotion] || emotionConfig['neutral'];
      return `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${config.color}" />`;
    }).join('');

    return `
      <div class="emotion-chart">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <!-- Background -->
          <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#f8f8f8" rx="4"/>
          
          <!-- Grid lines -->
          ${[0, 0.25, 0.5, 0.75, 1].map(y => {
            const yPos = padding.top + chartHeight - (y * chartHeight);
            return `<line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="#e0e0e0" stroke-width="1"/>`;
          }).join('')}
          
          <!-- Y axis labels -->
          ${yLabels}
          
          <!-- Area fill -->
          <path d="${areaD}" fill="rgba(255, 215, 0, 0.2)" />
          
          <!-- Line -->
          <path d="${pathD}" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          
          <!-- Dots -->
          ${dots}
          
          <!-- X axis label -->
          <text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#999">Time</text>
        </svg>
      </div>
    `;
  }

  /**
   * Generate performance bar chart SVG
   */
  generatePerformanceBarsSvg(metrics) {
    const bars = [
      { label: 'Clarity', value: metrics.clarityScore || 0, color: '#10B981' },
      { label: 'Confidence', value: metrics.confidenceScore || 0, color: '#3B82F6' },
      { label: 'Pace Score', value: this.calculatePaceScore(metrics.pace || 0), color: '#8B5CF6' }
    ];

    const width = 500;
    const barHeight = 24;
    const gap = 12;
    const height = bars.length * (barHeight + gap) + 20;
    const labelWidth = 80;
    const barMaxWidth = width - labelWidth - 60;

    const barsHtml = bars.map((bar, index) => {
      const y = index * (barHeight + gap) + 10;
      const barWidth = (bar.value / 100) * barMaxWidth;
      return `
        <g>
          <text x="0" y="${y + barHeight / 2 + 4}" font-size="12" fill="#666">${bar.label}</text>
          <rect x="${labelWidth}" y="${y}" width="${barMaxWidth}" height="${barHeight}" fill="#e8e8e8" rx="4"/>
          <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${bar.color}" rx="4"/>
          <text x="${labelWidth + barMaxWidth + 8}" y="${y + barHeight / 2 + 4}" font-size="12" fill="#1a1a1a" font-weight="600">${bar.value}%</text>
        </g>
      `;
    }).join('');

    return `
      <div class="performance-bars">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${barsHtml}
        </svg>
      </div>
    `;
  }

  /**
   * Calculate pace score (0-100)
   */
  calculatePaceScore(pace) {
    if (pace <= 0) return 0;
    const optimalMin = 150;
    const optimalMax = 180;
    
    if (pace >= optimalMin && pace <= optimalMax) {
      return 100;
    } else if (pace < optimalMin) {
      return Math.max(0, Math.round((pace / optimalMin) * 100));
    } else {
      return Math.max(0, Math.round(100 - ((pace - optimalMax) / optimalMax) * 50));
    }
  }

  /**
   * Generate HTML content for PDF report
   */
  generatePDFHtml(analytics, translations) {
    const { sessionInfo, metrics, transcript, emotionalTelemetry, aiFeedback } = analytics;
    
    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatDuration = (seconds) => {
      if (!seconds) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const getGrade = (score) => {
      if (score >= 95) return 'A+';
      if (score >= 90) return 'A';
      if (score >= 85) return 'A-';
      if (score >= 80) return 'B+';
      if (score >= 75) return 'B';
      if (score >= 70) return 'B-';
      if (score >= 65) return 'C+';
      if (score >= 60) return 'C';
      return 'D';
    };

    const transcriptHtml = transcript.map(entry => `
      <div class="transcript-entry ${entry.sender}">
        <span class="sender">${entry.sender === 'user' ? 'You' : 'AI'}:</span>
        <span class="text">${entry.text}</span>
        ${entry.hasHesitation ? '<span class="hesitation">⚠️</span>' : ''}
      </div>
    `).join('');

    // Generate AI Feedback HTML
    let aiFeedbackHtml = '';
    if (aiFeedback && (aiFeedback.positiveAspects?.length > 0 || aiFeedback.improvementAreas?.length > 0 || aiFeedback.nextSteps?.length > 0)) {
      aiFeedbackHtml = `
        <div class="section ai-feedback-section">
          <div class="section-title">🤖 ${translations.coachFeedback || 'AI Coach Feedback'}</div>
          
          ${aiFeedback.positiveAspects?.length > 0 ? `
          <div class="feedback-card positive">
            <div class="feedback-header">
              <span class="feedback-icon">✅</span>
              <span class="feedback-title">${translations.positiveAspects || 'Positive Aspects'}</span>
            </div>
            <ul class="feedback-list">
              ${aiFeedback.positiveAspects.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${aiFeedback.improvementAreas?.length > 0 ? `
          <div class="feedback-card improvement">
            <div class="feedback-header">
              <span class="feedback-icon">💡</span>
              <span class="feedback-title">${translations.improvementAreas || 'Areas for Improvement'}</span>
            </div>
            <ul class="feedback-list">
              ${aiFeedback.improvementAreas.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${aiFeedback.nextSteps?.length > 0 ? `
          <div class="feedback-card next-steps">
            <div class="feedback-header">
              <span class="feedback-icon">🎯</span>
              <span class="feedback-title">${translations.nextSteps || 'Next Steps'}</span>
            </div>
            <ul class="feedback-list">
              ${aiFeedback.nextSteps.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${translations.sessionReport || 'Session Report'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            color: #1a1a1a;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #FFD700;
          }
          .header h1 {
            color: #1a1a1a;
            font-size: 28px;
            margin-bottom: 8px;
          }
          .header .subtitle {
            color: #666;
            font-size: 14px;
          }
          .score-section {
            text-align: center;
            margin: 30px 0;
            padding: 30px;
            background: linear-gradient(135deg, #FFF9E6 0%, #FFF5CC 100%);
            border-radius: 16px;
          }
          .score-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 6px solid #FFD700;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            background: white;
          }
          .score-value {
            font-size: 36px;
            font-weight: bold;
            color: #1a1a1a;
          }
          .score-grade {
            font-size: 18px;
            color: #FFD700;
            font-weight: 600;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin: 30px 0;
          }
          .metric-card {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
          }
          .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a1a;
            margin-top: 8px;
          }
          .metric-unit {
            font-size: 14px;
            color: #999;
          }
          .section {
            margin: 30px 0;
          }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #eee;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label { color: #666; }
          .info-value { font-weight: 500; }
          .transcript-entry {
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 12px;
            background: #f0f0f0;
          }
          .transcript-entry.user {
            background: #FFF9E6;
            margin-left: 40px;
          }
          .transcript-entry.ai {
            background: #f0f0f0;
            margin-right: 40px;
          }
          .sender {
            font-weight: 600;
            margin-right: 8px;
          }
          .hesitation {
            margin-left: 8px;
          }
          .emotion-chart {
            margin: 20px 0;
            background: #fff;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #eee;
          }
          .performance-bars {
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          .ai-feedback-section {
            page-break-inside: avoid;
          }
          .feedback-card {
            background: #f8f8f8;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border-left: 4px solid #ccc;
          }
          .feedback-card.positive {
            background: #F0FDF4;
            border-left-color: #10B981;
          }
          .feedback-card.improvement {
            background: #FFF7ED;
            border-left-color: #F59E0B;
          }
          .feedback-card.next-steps {
            background: #EFF6FF;
            border-left-color: #3B82F6;
          }
          .feedback-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }
          .feedback-icon {
            font-size: 18px;
            margin-right: 8px;
          }
          .feedback-title {
            font-weight: 600;
            font-size: 14px;
            color: #1a1a1a;
          }
          .feedback-list {
            margin: 0;
            padding-left: 20px;
          }
          .feedback-list li {
            margin-bottom: 6px;
            font-size: 13px;
            color: #444;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎯 ${sessionInfo.scenario || 'Training Session'}</h1>
          <div class="subtitle">${formatDate(sessionInfo.timestamp)}</div>
        </div>

        <div class="score-section">
          <div class="score-circle">
            <div class="score-value">${metrics.score || 0}</div>
            <div class="score-grade">${getGrade(metrics.score || 0)}</div>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">${translations.pace || 'Pace'}</div>
            <div class="metric-value">${metrics.pace || 0}<span class="metric-unit"> WPM</span></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">${translations.fillerWords || 'Filler Words'}</div>
            <div class="metric-value">${metrics.fillerWordCount || 0}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">${translations.clarity || 'Clarity'}</div>
            <div class="metric-value">${metrics.clarityScore || 0}<span class="metric-unit">%</span></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">${translations.confidence || 'Confidence'}</div>
            <div class="metric-value">${metrics.confidenceScore || 0}<span class="metric-unit">%</span></div>
          </div>
        </div>

        <!-- Performance Breakdown -->
        <div class="section">
          <div class="section-title">${translations.performanceBreakdown || 'Performance Breakdown'}</div>
          ${this.generatePerformanceBarsSvg(metrics)}
        </div>

        <!-- Emotional Telemetry Chart -->
        ${emotionalTelemetry && emotionalTelemetry.length > 0 ? `
        <div class="section">
          <div class="section-title">${translations.emotionalTelemetry || 'Emotional Telemetry'}</div>
          ${this.generateEmotionChartSvg(emotionalTelemetry, sessionInfo.duration || 60)}
        </div>
        ` : ''}

        <div class="section">
          <div class="section-title">${translations.sessionInfo || 'Session Information'}</div>
          <div class="info-row">
            <span class="info-label">${translations.mode || 'Mode'}</span>
            <span class="info-value">${sessionInfo.mode === 'stress' ? 'Stress Mode' : 'Single Mode'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${translations.duration || 'Duration'}</span>
            <span class="info-value">${formatDuration(sessionInfo.duration)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${translations.completed || 'Status'}</span>
            <span class="info-value">${sessionInfo.completed ? '✅ Completed' : '⏸️ In Progress'}</span>
          </div>
        </div>

        <!-- AI Coach Feedback -->
        ${aiFeedbackHtml}

        ${transcript.length > 0 ? `
        <div class="section">
          <div class="section-title">${translations.transcript || 'Transcript'}</div>
          ${transcriptHtml}
        </div>
        ` : ''}

        <div class="footer">
          <p>Generated by Resonance • ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate and save PDF report
   */
  async generatePDFReport(sessionId, language = 'id') {
    if (!this.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const analytics = await this.generateSessionAnalytics(sessionId, language);
    const translations = TRANSLATIONS[language];
    const html = this.generatePDFHtml(analytics, translations);

    // Generate PDF using expo-print
    const { uri } = await Print.printToFileAsync({ html });
    
    return uri;
  }

  /**
   * Export all session data
   */
  async exportAllSessionData(language = 'id') {
    if (!this.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const sessions = await databaseService.getSessions();
    const translations = TRANSLATIONS[language];

    const exportData = {
      metadata: {
        exportDate: Date.now(),
        language,
        totalSessions: sessions.length,
        appVersion: '1.0.0'
      },
      sessions: [],
      translations
    };

    for (const session of sessions) {
      const sessionAnalytics = await this.generateSessionAnalytics(session.id, language);
      exportData.sessions.push(sessionAnalytics);
    }

    return exportData;
  }

  /**
   * Create CSV export for session data
   */
  async generateCSVExport(language = 'id') {
    if (!this.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const sessions = await databaseService.getSessions();
    const translations = TRANSLATIONS[language];

    const headers = [
      translations.sessionId || 'Session ID',
      translations.date || 'Date',
      translations.scenario || 'Scenario',
      translations.mode || 'Mode',
      translations.score || 'Score',
      translations.duration || 'Duration',
      translations.pace || 'Pace',
      translations.fillerWords || 'Filler Words',
      translations.clarity || 'Clarity',
      translations.confidence || 'Confidence'
    ];

    const csvRows = [headers.join(',')];

    sessions.forEach(session => {
      const row = [
        session.id,
        new Date(session.timestamp).toLocaleDateString(),
        `"${(session.scenario || '').replace(/"/g, '""')}"`,
        session.mode,
        session.score || 0,
        session.duration || 0,
        session.pace || 0,
        session.filler_word_count || 0,
        session.clarity_score || 0,
        session.confidence_score || 0
      ];
      csvRows.push(row.join(','));
    });

    return {
      content: csvRows.join('\n'),
      language,
      headers,
      rowCount: sessions.length
    };
  }

  /**
   * Save CSV to file system
   */
  async saveCSVToFile(csvData, filename) {
    try {
      const content = csvData.content || String(csvData);
      const cacheDir = Paths.cache;
      const file = new File(cacheDir, `${filename}.csv`);
      file.write(content);
      return file.uri;
    } catch (error) {
      console.error('Error saving CSV file:', error);
      throw error;
    }
  }

  /**
   * Validate export data consistency across languages
   */
  validateExportConsistency(exportData1, exportData2) {
    if (!exportData1 || !exportData2 || !exportData1.sessions || !exportData2.sessions) {
      return false;
    }

    if (exportData1.sessions.length !== exportData2.sessions.length) {
      return false;
    }

    if (exportData1.sessions.length === 0) {
      return true;
    }

    for (let i = 0; i < exportData1.sessions.length; i++) {
      const session1 = exportData1.sessions[i];
      const session2 = exportData2.sessions[i];

      if (
        !session1 || !session2 ||
        !session1.sessionInfo || !session2.sessionInfo ||
        !session1.metrics || !session2.metrics
      ) {
        return false;
      }

      if (
        session1.sessionInfo.id !== session2.sessionInfo.id ||
        session1.sessionInfo.timestamp !== session2.sessionInfo.timestamp ||
        session1.sessionInfo.scenario !== session2.sessionInfo.scenario ||
        session1.metrics.score !== session2.metrics.score
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Share export file
   */
  async shareExportFile(filePath) {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath);
    } else {
      throw new Error('Sharing is not available on this platform');
    }
  }
}

export const exportGenerator = new ExportGenerator();
export default exportGenerator;
