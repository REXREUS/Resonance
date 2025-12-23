import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { databaseService } from '../../services/databaseService';
import { geminiService } from '../../services/geminiService';
import { useGamification, useRecentAchievements, useQuotaStatistics } from '../../stores/gamificationStore';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';
import { SPACING } from '../../constants/theme';
import LottieView from 'lottie-react-native';

// New UI Components
import { Card, Badge, ProgressBar } from '../../components/ui';
import { StatsGrid, InsightCard } from '../../components/dashboard';
import AchievementModal from '../../components/AchievementModal';
import QuotaUsageCard from '../../components/QuotaUsageCard';
const csAnimation = require('../../assets/animations/L-cs.json');

const screenWidth = Dimensions.get('window').width - 32;

export default function Dashboard() {
  const [stats, setStats] = useState({
    flightHours: 0,
    averageScore: null,
    streak: 0,
    quotaUsage: 0
  });
  const [chartData, setChartData] = useState(null);
  const [scoreChartData, setScoreChartData] = useState(null);
  const [metricsChartData, setMetricsChartData] = useState(null);
  const [aiInsight, setAiInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Theme and translation hooks
  const { colors } = useTheme();
  const { t, language } = useTranslation();

  // Gamification hooks - always called at top level
  const gamification = useGamification();
  const recentAchievements = useRecentAchievements();
  const quotaStats = useQuotaStatistics();

  // Initialize database and load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (!databaseService.isInitialized) {
          await databaseService.initialize();
        }
        await loadDashboardData();
        await initializeGamification();
      } catch (error) {
        console.error('Error during initial data load:', error);
      } finally {
        setLoading(false);
        setDbInitialized(true);
      }
    };
    loadData();
  }, []);

  // Reload data on focus
  useFocusEffect(
    useCallback(() => {
      if (dbInitialized) {
        loadDashboardData();
        initializeGamification();
      }
    }, [dbInitialized])
  );

  const initializeGamification = async () => {
    try {
      await gamification.initialize();
    } catch (error) {
      console.error('Error initializing gamification:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Ensure database is initialized before any queries
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }

      // Load session statistics
      await loadSessionStats();

      // Load chart data
      await loadChartData();

      // Load AI insight (from database or generate new)
      await loadAIInsight();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load AI insight from database or generate new one
   * Cost-saving: Only generate new insight if data changed or 24h passed
   */
  const loadAIInsight = async () => {
    try {
      // Get cached insight from database
      const { insight, updatedAt } = await databaseService.getGlobalAIInsight();
      
      // Check if we should update the insight
      const shouldUpdate = await databaseService.shouldUpdateGlobalInsight();
      
      // Get sessions to check if there's new data
      const sessions = await databaseService.getSessions();
      const completedSessions = sessions.filter(s => s.completed === 1);
      
      // If no sessions, show default message
      if (completedSessions.length === 0) {
        const defaultInsight = language === 'id' 
          ? 'Mulai sesi latihan pertama Anda untuk mendapatkan saran AI yang dipersonalisasi.'
          : 'Start your first training session to get personalized AI advice.';
        setAiInsight(defaultInsight);
        return;
      }
      
      // Use cached insight if available and not stale
      if (insight && !shouldUpdate) {
        setAiInsight(insight);
        return;
      }
      
      // Generate new insight with AI
      setLoadingInsight(true);
      
      try {
        // Initialize Gemini if needed
        if (!geminiService.isInitialized) {
          await geminiService.initialize();
        }
        
        // Generate new insight based on all sessions
        const newInsight = await geminiService.generateGlobalInsight(sessions, language);
        
        // Save to database for future use (cost saving)
        await databaseService.saveGlobalAIInsight(newInsight);
        
        setAiInsight(newInsight);
      } catch (error) {
        console.error('Failed to generate AI insight:', error);
        // Use cached insight if available, otherwise use fallback
        if (insight) {
          setAiInsight(insight);
        } else {
          const fallbackInsight = language === 'id'
            ? 'Terus berlatih untuk meningkatkan kemampuan komunikasi Anda.'
            : 'Keep practicing to improve your communication skills.';
          setAiInsight(fallbackInsight);
        }
      } finally {
        setLoadingInsight(false);
      }
    } catch (error) {
      console.error('Error loading AI insight:', error);
      const fallbackInsight = language === 'id'
        ? 'Terus berlatih untuk meningkatkan kemampuan komunikasi Anda.'
        : 'Keep practicing to improve your communication skills.';
      setAiInsight(fallbackInsight);
    }
  };

  const loadSessionStats = async () => {
    try {
      // Ensure database is initialized before querying
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      
      const sessions = await databaseService.getSessions();
      const completedSessions = sessions.filter(s => s.completed === 1);
      
      // Calculate flight hours (total duration in hours)
      const totalDuration = completedSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const flightHours = Math.round((totalDuration / 3600) * 10) / 10; // Convert seconds to hours, round to 1 decimal
      
      // Calculate average score
      const sessionsWithScores = completedSessions.filter(s => s.score !== null);
      const averageScore = sessionsWithScores.length > 0 
        ? Math.round(sessionsWithScores.reduce((sum, s) => sum + s.score, 0) / sessionsWithScores.length)
        : null;
      
      // Calculate current streak (consecutive days with sessions)
      const streak = calculateStreak(completedSessions);
      
      // Calculate quota usage (mock for now - would be based on API usage)
      const quotaUsage = Math.min(Math.round((completedSessions.length * 2.5)), 100); // Rough estimate
      
      setStats({
        flightHours,
        averageScore,
        streak,
        quotaUsage
      });
    } catch (error) {
      console.error('Error loading session stats:', error);
    }
  };

  const loadChartData = async () => {
    try {
      // Ensure database is initialized before querying
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      
      const sessions = await databaseService.getSessions(10); // Last 10 sessions
      const completedSessions = sessions.filter(s => s.completed === 1);
      
      if (completedSessions.length === 0) {
        setChartData(null);
        setScoreChartData(null);
        setMetricsChartData(null);
        return;
      }
      
      // Reverse to show oldest to newest
      const orderedSessions = [...completedSessions].reverse();
      
      // Prepare clarity trend chart data
      const clarityLabels = orderedSessions.slice(-7).map((_, index) => `S${index + 1}`);
      const clarityScores = orderedSessions.slice(-7).map(s => s.clarity_score || 0);
      
      if (clarityScores.some(s => s > 0)) {
        setChartData({
          labels: clarityLabels,
          datasets: [{ data: clarityScores.map(s => s || 0) }]
        });
      }
      
      // Prepare overall score chart data
      const scoreLabels = orderedSessions.slice(-7).map((_, index) => `S${index + 1}`);
      const scores = orderedSessions.slice(-7).map(s => s.score || 0);
      
      if (scores.some(s => s > 0)) {
        setScoreChartData({
          labels: scoreLabels,
          datasets: [{ data: scores.map(s => s || 0) }]
        });
      }
      
      // Prepare metrics comparison (bar chart)
      const latestSession = orderedSessions[orderedSessions.length - 1];
      if (latestSession) {
        setMetricsChartData({
          labels: ['Clarity', 'Confidence', 'Pace'],
          datasets: [{
            data: [
              latestSession.clarity_score || 0,
              latestSession.confidence_score || 0,
              Math.min(100, (latestSession.pace || 0) / 2) // Normalize pace to 0-100
            ]
          }]
        });
      }
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      setChartData(null);
      setScoreChartData(null);
      setMetricsChartData(null);
    }
  };

  const calculateStreak = (sessions) => {
    if (sessions.length === 0) return 0;
    
    // Sort sessions by timestamp (newest first)
    const sortedSessions = sessions.sort((a, b) => b.timestamp - a.timestamp);
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const session of sortedSessions) {
      const sessionDate = new Date(session.timestamp);
      sessionDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
      } else if (daysDiff > streak) {
        break;
      }
    }
    
    return streak;
  };

  if (loading && !dbInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.ACCENT} />
        <Text style={{ color: colors.TEXT, marginTop: 16 }}>{t.loading}</Text>
      </View>
    );
  }


 
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.BG }}>
      <View style={{ padding: SPACING.MD }}>
        {/* Agent Alex Profile - Using new components */}
        <Card variant="default" padding="lg" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
             <LottieView
               source={csAnimation}
               autoPlay
               loop
               style={{ width: 100, height: 100, marginRight: SPACING.MD }}
             />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.TEXT, fontSize: 24, fontWeight: '700' }}>
                {t.agent}
              </Text>
              <Badge variant="online" size="sm" style={{ marginTop: SPACING.XS }}>
                {t.systemTeks}
              </Badge>
            </View>
          </View>
        </Card>

        {/* Quick Stats Grid - Using new StatsGrid component */}
        <StatsGrid
          flightHours={stats.flightHours > 0 ? stats.flightHours : 0}
          avgScore={stats.averageScore !== null ? stats.averageScore : (gamification.averageScore !== null ? gamification.averageScore : 0)}
          streak={stats.streak > 0 ? stats.streak : gamification.currentStreak}
          quota={Math.round(quotaStats.daily.percentage)}
          style={{ marginBottom: SPACING.MD }}
        />

        {/* Achievement Progress - Using new Card and ProgressBar */}
        {gamification.achievementProgress.total > 0 && (
          <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.SM }}>
              <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '700' }}>
                {t.achievementProgress}
              </Text>
              <Badge variant="yellow" size="sm">
                {gamification.achievementProgress.totalPoints} {t.points}
              </Badge>
            </View>
            
            <ProgressBar
              value={gamification.achievementProgress.percentage}
              max={100}
              size="md"
              trackColor={colors.BORDER}
              showLabel
            />
          </Card>
        )}

        {/* Recent Achievements - Using new Card component */}
        {recentAchievements.length > 0 && (
          <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '700', marginBottom: SPACING.SM }}>
              {t.recentAchievements}
            </Text>
            {recentAchievements.slice(0, 3).map((achievement) => (
              <View key={achievement.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.SM }}>
                <Text style={{ fontSize: 24, marginRight: SPACING.SM }}>{achievement.badge_icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ACCENT, fontWeight: '600' }}>{achievement.name}</Text>
                  <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12 }}>{achievement.description}</Text>
                </View>
                <Badge variant="yellow" size="sm">+{achievement.points}</Badge>
              </View>
            ))}
          </Card>
        )}

        {/* Quota Usage Card */}
        <View style={{ marginBottom: SPACING.MD }}>
          <QuotaUsageCard showChart={false} />
        </View>

        {/* Overall Score Trend Chart */}
        {scoreChartData && scoreChartData.datasets[0].data.some(d => d > 0) && (
          <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
              {t.overallScoreTrend}
            </Text>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, marginBottom: SPACING.MD }}>
              {t.yourPerformance} {t.lastSessions}
            </Text>
            <LineChart
              data={scoreChartData}
              width={screenWidth - 32}
              height={180}
              chartConfig={{
                backgroundColor: colors.CARD,
                backgroundGradientFrom: colors.CARD,
                backgroundGradientTo: colors.CARD,
                decimalPlaces: 0,
                color: () => colors.ACCENT,
                labelColor: () => colors.TEXT_SECONDARY,
                style: { borderRadius: 8 },
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: colors.ACCENT,
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: colors.BORDER,
                },
              }}
              bezier
              style={{ borderRadius: 8 }}
              fromZero
              yAxisSuffix="%"
            />
          </Card>
        )}

        {/* Vocal Clarity Trend Chart */}
        {chartData && chartData.datasets[0].data.some(d => d > 0) && (
          <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
              {t.vocalClarityTrend}
            </Text>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, marginBottom: SPACING.MD }}>
              {t.lastSessions} {t.clarity.toLowerCase()}
            </Text>
            <LineChart
              data={chartData}
              width={screenWidth - 32}
              height={180}
              chartConfig={{
                backgroundColor: colors.CARD,
                backgroundGradientFrom: colors.CARD,
                backgroundGradientTo: colors.CARD,
                decimalPlaces: 0,
                color: () => '#4ECDC4',
                labelColor: () => colors.TEXT_SECONDARY,
                style: { borderRadius: 8 },
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: '#4ECDC4',
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: colors.BORDER,
                },
              }}
              bezier
              style={{ borderRadius: 8 }}
              fromZero
              yAxisSuffix="%"
            />
          </Card>
        )}

        {/* Latest Session Metrics Bar Chart */}
        {metricsChartData && metricsChartData.datasets[0].data.some(d => d > 0) && (
          <Card variant="default" padding="md" style={{ marginBottom: SPACING.MD, backgroundColor: colors.CARD }}>
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
              {t.latestSessionMetrics}
            </Text>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 12, marginBottom: SPACING.MD }}>
              {t.performanceBreakdown}
            </Text>
            <BarChart
              data={metricsChartData}
              width={screenWidth - 32}
              height={180}
              chartConfig={{
                backgroundColor: colors.CARD,
                backgroundGradientFrom: colors.CARD,
                backgroundGradientTo: colors.CARD,
                decimalPlaces: 0,
                color: () => colors.ACCENT,
                labelColor: () => colors.TEXT_SECONDARY,
                style: { borderRadius: 8 },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: colors.BORDER,
                },
                barPercentage: 0.6,
              }}
              style={{ borderRadius: 8 }}
              fromZero
              showValuesOnTopOfBars
              yAxisSuffix="%"
            />
          </Card>
        )}

        {/* Empty State for Charts */}
        {!chartData && !scoreChartData && (
          <Card variant="outlined" padding="lg" style={{ marginBottom: SPACING.MD, alignItems: 'center', backgroundColor: colors.CARD }}>
            <Text style={{ color: colors.TEXT, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              No Training Data Yet
            </Text>
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, textAlign: 'center' }}>
              Complete your first training session to see your progress charts here.
            </Text>
          </Card>
        )}

        {/* Daily AI Insight - Using personalized AI insight from sessions */}
        {loadingInsight ? (
          <Card variant="dark" padding="lg" style={{ marginBottom: SPACING.MD, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.ACCENT} />
            <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14, marginTop: SPACING.SM }}>
              {t.generatingInsight || 'Generating AI insight...'}
            </Text>
          </Card>
        ) : (
          <InsightCard
            quote={aiInsight}
            currentIndex={0}
            totalQuotes={1}
            style={{ marginBottom: SPACING.MD }}
          />
        )}

        {/* Motivational Message */}
        {gamification.hasAchievements && (
          <Card 
            variant="outlined" 
            padding="md" 
            style={{ 
              marginTop: SPACING.MD,
              borderColor: colors.ACCENT + '50',
              backgroundColor: colors.ACCENT + '10',
            }}
          >
            <Text style={{ color: colors.ACCENT, textAlign: 'center', fontWeight: '600' }}>
              {gamification.getMotivationalMessage ? gamification.getMotivationalMessage() : 'Keep up the great work!'}
            </Text>
          </Card>
        )}
      </View>

      {/* Achievement Modal */}
      <AchievementModal />
    </ScrollView>
  );
}