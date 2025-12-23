import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Services
import { databaseService } from '../services/databaseService';
import { geminiService } from '../services/geminiService';
import { exportGenerator } from '../utils/exportGenerator';

// Import our utility functions
import { calculateSessionReport } from '../utils/scoreCalculator';
import { analyzeFillerWordPatterns } from '../utils/fillerWordDetector';
import { processEmotionalTelemetry } from '../utils/emotionalTelemetry';
import { processTranscriptForReplay } from '../utils/hesitationDetector';
import { SPACING } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

// UI Components
import { Button, Header, ScoreCircle, MetricCard } from '../components/ui';
import { CoachFeedback, TranscriptBubble } from '../components/session';
import { EmotionChart } from '../components/charts';

export default function Report() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  
  const { colors } = useTheme();
  const { t, language } = useTranslation();

  useEffect(() => {
    loadReportData();
  }, [params.sessionId]);

  /**
   * Load report data from database or use passed session data
   */
  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Check if we have a sessionId to load from database
      if (params.sessionId) {
        await loadFromDatabase(params.sessionId);
      } else if (params.sessionReport) {
        // Use passed session report (from simulation end)
        const sessionReport = JSON.parse(params.sessionReport);
        processSessionReport(sessionReport);
      } else if (params.sessionData) {
        // Use passed session data (from simulation end)
        const sessionData = JSON.parse(params.sessionData);
        processSessionData(sessionData);
      } else {
        // No data available - show error
        setReportData(null);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Process session report from simulation end
   */
  const processSessionReport = (sessionReport) => {
    // Build session data from report
    const sessionData = {
      sessionId: sessionReport.sessionId,
      scenario: sessionReport.scenario || 'Training Session',
      mode: sessionReport.mode || 'single',
      language: sessionReport.language || 'id',
      startTime: sessionReport.startTime,
      endTime: sessionReport.endTime,
      metrics: {
        pace: sessionReport.metrics?.pace || 0,
        fillerWordCount: sessionReport.metrics?.fillerWordCount || 0,
        clarity: sessionReport.metrics?.clarity || 0,
        confidence: sessionReport.metrics?.confidence || 0,
        duration: sessionReport.metrics?.duration || 0
      },
      transcript: sessionReport.conversationHistory || [],
      emotionalTelemetry: sessionReport.emotionalTelemetry || [],
      score: sessionReport.score,
      completed: true
    };

    processSessionData(sessionData);
  };

  /**
   * Load session data from database
   */
  const loadFromDatabase = async (sessionId) => {
    try {
      // Initialize database if needed
      await databaseService.initialize();
      
      // Get session data
      const session = await databaseService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Get chat logs
      const chatLogs = await databaseService.getChatLogs(sessionId);
      
      // Get emotional telemetry
      const emotionalTelemetry = await databaseService.getEmotionalTelemetry(sessionId);

      // Build session data object
      const sessionData = {
        sessionId: session.id,
        scenario: session.scenario || 'Training Session',
        mode: session.mode || 'single',
        language: 'id', // Default language
        startTime: session.timestamp,
        endTime: session.timestamp + (session.duration * 1000),
        metrics: {
          pace: session.pace || 0,
          fillerWordCount: session.filler_word_count || 0,
          clarity: session.clarity_score || 0,
          confidence: session.confidence_score || 0,
          duration: session.duration || 0
        },
        transcript: chatLogs.map(log => ({
          sender: log.sender,
          text: log.text,
          timestamp: log.timestamp,
          audioPath: log.audio_path,
          hasHesitation: log.has_hesitation === 1
        })),
        emotionalTelemetry: emotionalTelemetry.map(tel => ({
          timestamp: tel.timestamp,
          state: tel.emotion_state,
          intensity: tel.intensity
        })),
        score: session.score,
        completed: session.completed === 1
      };

      processSessionData(sessionData);
    } catch (error) {
      console.error('Error loading from database:', error);
      throw error;
    }
  };

  /**
   * Process session data and generate report
   */
  const processSessionData = async (sessionData) => {
    // Calculate score report
    const scoreReport = calculateSessionReport(sessionData);
    
    // Use existing score if available
    if (sessionData.score !== undefined && sessionData.score !== null) {
      scoreReport.score = sessionData.score;
      scoreReport.grade = getGradeFromScore(sessionData.score);
    }

    // Analyze filler word patterns
    const fillerAnalysis = analyzeFillerWordPatterns(sessionData.transcript || [], 'all');
    
    // Process emotional telemetry
    const emotionalData = processEmotionalTelemetry(
      sessionData.emotionalTelemetry || [],
      (sessionData.metrics?.duration || 0) * 1000
    );
    
    // Process transcript for replay
    const transcriptData = processTranscriptForReplay(sessionData.transcript || []);

    // Set initial report data without coach feedback
    setReportData({
      ...sessionData,
      scoreReport,
      fillerAnalysis,
      emotionalData,
      transcriptData,
      coachFeedback: []
    });

    // Generate AI coach feedback asynchronously
    const coachFeedback = await generateCoachFeedback(sessionData, scoreReport, fillerAnalysis);

    // Update report data with coach feedback
    setReportData(prev => ({
      ...prev,
      coachFeedback
    }));
  };

  /**
   * Get letter grade from score
   */
  const getGradeFromScore = (score) => {
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
  };

  /**
   * Generate AI coach feedback based on performance
   * First check database for cached feedback, if not exists, generate with AI
   */
  const generateCoachFeedback = async (sessionData, scoreReport, fillerAnalysis) => {
    const sessionId = sessionData.sessionId;
    
    // Check if we have cached AI feedback in database
    if (sessionId) {
      try {
        const cachedFeedback = await databaseService.getSessionAIFeedback(sessionId);
        if (cachedFeedback && cachedFeedback.positiveAspects.length > 0) {
          // Use cached feedback
          return formatFeedbackForDisplay(cachedFeedback);
        }
      } catch (error) {
        console.log('No cached feedback found, will generate new');
      }
    }
    
    // Try to generate AI feedback
    try {
      setGeneratingFeedback(true);
      
      // Check if Gemini is initialized
      if (!geminiService.isInitialized) {
        await geminiService.initialize();
      }
      
      // Generate AI feedback from conversation
      const aiFeedback = await geminiService.generateCoachFeedback({
        sessionId: sessionData.sessionId,
        score: sessionData.score || scoreReport.score,
        metrics: sessionData.metrics || {},
        transcript: sessionData.transcript || [],
        emotionalTelemetry: sessionData.emotionalTelemetry || [],
        language: language
      });
      
      // Save to database for future use (cost saving)
      if (sessionId && aiFeedback.positiveAspects.length > 0) {
        await databaseService.saveSessionAIFeedback(sessionId, aiFeedback);
      }
      
      return formatFeedbackForDisplay(aiFeedback);
    } catch (error) {
      console.error('Failed to generate AI feedback:', error);
      // Fallback to rule-based feedback
      return generateRuleBasedFeedback(sessionData, fillerAnalysis);
    } finally {
      setGeneratingFeedback(false);
    }
  };

  /**
   * Format AI feedback for display in CoachFeedback component
   */
  const formatFeedbackForDisplay = (aiFeedback) => {
    const feedback = [];
    
    if (aiFeedback.positiveAspects && aiFeedback.positiveAspects.length > 0) {
      feedback.push({
        type: 'positive',
        title: t.positiveAspects || 'Positive Aspects',
        description: aiFeedback.positiveAspects.join('. ') + '.'
      });
    }
    
    if (aiFeedback.improvementAreas && aiFeedback.improvementAreas.length > 0) {
      feedback.push({
        type: 'improvement',
        title: t.improvementAreas || 'Improvement Areas',
        description: aiFeedback.improvementAreas.join('. ') + '.'
      });
    }
    
    if (aiFeedback.nextSteps && aiFeedback.nextSteps.length > 0) {
      feedback.push({
        type: 'nextSteps',
        title: t.nextSteps || 'Next Steps',
        description: aiFeedback.nextSteps.join('. ') + '.'
      });
    }
    
    return feedback;
  };

  /**
   * Generate rule-based feedback as fallback
   */
  const generateRuleBasedFeedback = (sessionData, fillerAnalysis) => {
    const feedback = [];
    const metrics = sessionData.metrics || {};

    // Positive feedback
    const positives = [];
    if (metrics.confidence >= 80) positives.push(t.highConfidence || 'High confidence level maintained');
    if (metrics.clarity >= 80) positives.push(t.goodClarity || 'Clear and articulate speech');
    if (metrics.pace >= 150 && metrics.pace <= 180) positives.push(t.optimalPace || 'Optimal speaking pace');
    if (fillerAnalysis.userCount <= 3) positives.push(t.minimalFillers || 'Minimal use of filler words');

    if (positives.length > 0) {
      feedback.push({
        type: 'positive',
        title: t.positiveAspects || 'Positive Aspects',
        description: positives.join('. ') + '.'
      });
    }

    // Areas for improvement
    const improvements = [];
    if (metrics.confidence < 70) improvements.push(t.improveConfidence || 'Work on projecting more confidence');
    if (metrics.clarity < 70) improvements.push(t.improveClarity || 'Focus on clearer articulation');
    if (metrics.pace < 140) improvements.push(t.speedUp || 'Try to speak a bit faster');
    if (metrics.pace > 190) improvements.push(t.slowDown || 'Consider slowing down your pace');
    if (fillerAnalysis.userCount > 5) improvements.push(t.reduceFillers || 'Reduce filler words for better clarity');

    if (improvements.length > 0) {
      feedback.push({
        type: 'improvement',
        title: t.improvementAreas || 'Improvement Areas',
        description: improvements.join('. ') + '.'
      });
    }

    // Next steps
    feedback.push({
      type: 'nextSteps',
      title: t.nextSteps || 'Next Steps',
      description: t.nextStepsDesc || 'Practice pausing instead of using filler words. Record yourself and review for patterns.'
    });

    return feedback;
  };

  /**
   * Play audio segment
   */
  const playSegment = (segmentId) => {
    Alert.alert(t.playing || 'Audio Playback', `${t.playingSegment || 'Playing segment'}: ${segmentId}`);
  };

  /**
   * Retry session with same configuration
   */
  const retrySession = () => {
    // Get scenario from report data and normalize it
    let scenarioValue = reportData?.scenario || 'customer-complaint';
    
    // Convert scenario to kebab-case format expected by session-setup
    // Handle cases like "Price Negotiation" -> "price-negotiation"
    // or "price-negotiation" stays as is
    scenarioValue = scenarioValue
      .toLowerCase()
      .replace(/\s+/g, '-')  // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, ''); // Remove special characters
    
    // Build retry config from report data
    const retryConfig = {
      scenario: scenarioValue,
      mode: reportData?.mode || 'single',
      language: reportData?.language || language || 'id',
    };

    console.log('Retry config:', retryConfig);

    // For retry, go to session-setup with pre-filled config
    router.push({
      pathname: '/session-setup',
      params: {
        retryConfig: JSON.stringify(retryConfig),
      }
    });
  };

  /**
   * Export report as PDF
   */
  const exportPDF = async () => {
    if (!reportData?.sessionId) {
      Alert.alert(t.error || 'Error', t.noSessionToExport || 'No session data to export');
      return;
    }

    try {
      setExporting(true);

      // Get app settings for language
      const settings = await databaseService.getAppSettings();
      const language = settings?.language || 'id';

      // Generate PDF file directly
      const pdfUri = await exportGenerator.generatePDFReport(reportData.sessionId, language);

      // Share the PDF file
      await exportGenerator.shareExportFile(pdfUri);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        t.exportFailed || 'Export Failed',
        error.message || t.failedToExport || 'Failed to export report'
      );
    } finally {
      setExporting(false);
    }
  };

  /**
   * Export report as CSV
   */
  const exportCSV = async () => {
    if (!reportData?.sessionId) {
      Alert.alert(t.error || 'Error', t.noSessionToExport || 'No session data to export');
      return;
    }

    try {
      setExporting(true);

      // Get app settings for language
      const settings = await databaseService.getAppSettings();
      const language = settings?.language || 'id';

      // Generate CSV content
      const csvData = await exportGenerator.generateCSVExport(language);

      // Save to file
      const filename = `resonance_sessions_${Date.now()}`;
      const filePath = await exportGenerator.saveCSVToFile(csvData, filename);

      // Share the file
      await exportGenerator.shareExportFile(filePath);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        t.exportFailed || 'Export Failed',
        error.message || t.failedToExport || 'Failed to export report'
      );
    } finally {
      setExporting(false);
    }
  };

  /**
   * Share report
   */
  const shareReport = () => {
    Alert.alert(
      t.shareReport || 'Share Report',
      t.selectExportFormat || 'Select export format',
      [
        { text: 'PDF', onPress: exportPDF },
        { text: 'CSV', onPress: exportCSV },
        { text: t.cancel || 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.ACCENT} />
        <Text style={{ color: colors.TEXT, fontSize: 16, marginTop: SPACING.MD }}>{t.loading || 'Loading...'}</Text>
      </SafeAreaView>
    );
  }

  // No data state
  if (!reportData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.TEXT, fontSize: 18, marginBottom: SPACING.MD }}>{t.noResults || 'No report data available'}</Text>
        <Button variant="primary" onPress={() => router.back()}>
          {t.back || 'Go Back'}
        </Button>
      </SafeAreaView>
    );
  }

  const { scoreReport, emotionalData, transcriptData, coachFeedback } = reportData;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
      {/* Header - removed share icon since export buttons are below */}
      <Header
        title={(reportData.scenario || 'Session Report').toUpperCase()}
        variant="cream"
        showBack
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.MD }}>
        {/* Score Circle */}
        <View style={{ alignItems: 'center', marginBottom: SPACING.XL }}>
          <ScoreCircle
            score={scoreReport.score}
            maxScore={100}
            grade={scoreReport.grade}
            label={t.score || 'Score'}
            size="xl"
          />
        </View>

        {/* Metrics Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginBottom: SPACING.LG }}>
          <MetricCard
            label={(t.pace || 'Pace').toUpperCase()}
            value={reportData.metrics?.pace || 0}
            unit={(t.wpm || 'WPM').toLowerCase()}
            variant="light"
            size="sm"
            style={{ flex: 1, minWidth: '45%' }}
          />
          <MetricCard
            label={(t.fillerWords || 'Filler Words').toUpperCase()}
            value={reportData.metrics?.fillerWordCount || 0}
            unit=""
            variant="light"
            size="sm"
            style={{ flex: 1, minWidth: '45%' }}
          />
          <MetricCard
            label={(t.clarity || 'Clarity').toUpperCase()}
            value={reportData.metrics?.clarity || 0}
            unit="%"
            variant="light"
            size="sm"
            style={{ flex: 1, minWidth: '45%' }}
          />
          <MetricCard
            label={(t.confidence || 'Confidence').toUpperCase()}
            value={reportData.metrics?.confidence || 0}
            unit="%"
            variant="light"
            size="sm"
            style={{ flex: 1, minWidth: '45%' }}
          />
        </View>

        {/* Duration Info */}
        <View style={{ 
          backgroundColor: colors.CARD, 
          borderRadius: 12, 
          padding: SPACING.MD, 
          marginBottom: SPACING.LG,
          borderWidth: 1,
          borderColor: colors.BORDER
        }}>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14 }}>
            {t.duration || 'Duration'}: {formatDuration(reportData.metrics?.duration || 0)}
          </Text>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginTop: 4 }}>
            {t.mode || 'Mode'}: {reportData.mode === 'stress' ? (t.stressMode || 'Stress Mode') : (t.singleMode || 'Single Mode')}
          </Text>
        </View>

        {/* Emotional Telemetry */}
        <EmotionChart
          data={emotionalData?.chartData || []}
          duration={formatDuration(reportData.metrics?.duration || 0)}
          overallSentiment={emotionalData?.summary?.dominantEmotion || 'Stable'}
          style={{ marginBottom: SPACING.LG }}
        />

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.LG }}>
          <Button
            variant="outline"
            size="md"
            onPress={shareReport}
            style={{ flex: 1 }}
            icon={<Text>📄</Text>}
            disabled={exporting}
          >
            {exporting ? (t.exporting || 'Exporting...') : (t.exportPDF || 'Export')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onPress={retrySession}
            style={{ flex: 1 }}
            icon={<Text>🔄</Text>}
          >
            {t.retry || 'Retry'}
          </Button>
        </View>

        {/* Interactive Transcript */}
        {transcriptData?.entries?.length > 0 && (
          <View style={{ marginBottom: SPACING.LG }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.TEXT, marginBottom: SPACING.MD }}>
              {t.transcript || 'Transcript'}
            </Text>
            {transcriptData.entries.map((entry, index) => (
              <TranscriptBubble
                key={index}
                message={entry.text}
                isUser={entry.sender === 'user'}
                fillerWords={entry.hesitationData?.patterns?.filter(p => p.name === 'filler_words')?.flatMap(p => p.matches) || []}
                hasHesitation={entry.hesitationData?.hasHesitation}
                hesitationTip={entry.hesitationData?.hasHesitation ? (t.fillerWordTip || 'Filler word detected. Try pausing silently.') : null}
                onPlaySegment={entry.replayable ? () => playSegment(entry.segmentId) : null}
              />
            ))}
          </View>
        )}

        {/* AI Coach Feedback */}
        {generatingFeedback ? (
          <View style={{ 
            backgroundColor: colors.CARD, 
            borderRadius: 12, 
            padding: SPACING.LG, 
            marginBottom: SPACING.LG,
            alignItems: 'center'
          }}>
            <ActivityIndicator size="small" color={colors.ACCENT} />
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginTop: SPACING.SM }}>
              {t.generatingFeedback || 'Generating AI feedback...'}
            </Text>
          </View>
        ) : coachFeedback && coachFeedback.length > 0 ? (
          <CoachFeedback feedback={coachFeedback} />
        ) : null}

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
