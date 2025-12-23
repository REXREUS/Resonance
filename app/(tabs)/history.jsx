import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { History as HistoryIcon, RefreshCw, AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessionHistory } from '../../hooks/useSessionHistory';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';
import SessionCard from '../../components/SessionCard';
import SessionFilters from '../../components/SessionFilters';
import SessionDetailModal from '../../components/SessionDetailModal';
import { SPACING } from '../../constants/theme';

export default function History() {
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Theme and translation hooks
  const { colors } = useTheme();
  const { t } = useTranslation();

  const {
    sessions,
    loading,
    error,
    searchText,
    selectedCategory,
    dateRange,
    updateSearchText,
    updateCategory,
    updateDateRange,
    clearFilters,
    retrySession,
    refreshSessions,
    hasActiveFilters,
    sessionCount
  } = useSessionHistory();

  /**
   * Handle session card press - show detail modal
   */
  const handleSessionPress = (session) => {
    setSelectedSession(session);
    setShowDetailModal(true);
  };

  /**
   * Handle retry session
   */
  const handleRetrySession = async (session) => {
    try {
      const config = await retrySession(session.id);
      
      // Navigate to session setup with pre-filled configuration
      router.push({
        pathname: '/session-setup',
        params: {
          retryConfig: JSON.stringify(config)
        }
      });
    } catch (err) {
      Alert.alert(
        t.failed,
        err.message || t.failedToLoadHistory,
        [{ text: t.ok }]
      );
    }
  };

  /**
   * Handle view full report
   */
  const handleViewReport = (session) => {
    router.push({
      pathname: '/report',
      params: {
        sessionId: session.id
      }
    });
  };

  /**
   * Render session item
   */
  const renderSessionItem = ({ item }) => (
    <SessionCard
      session={item}
      onPress={() => handleSessionPress(item)}
      onRetry={() => handleRetrySession(item)}
    />
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <HistoryIcon size={64} color={colors.TEXT_SECONDARY} />
      <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
        {hasActiveFilters ? t.noMatchingSessions : t.noTrainingSessionsYet}
      </Text>
      <Text style={{ color: colors.TEXT_SECONDARY, textAlign: 'center', marginTop: 8, lineHeight: 24 }}>
        {hasActiveFilters ? t.adjustFilters : t.startFirstSession}
      </Text>

      {hasActiveFilters ? (
        <TouchableOpacity
          onPress={clearFilters}
          style={{
            marginTop: 24,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.ACCENT,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.ACCENT, fontWeight: '600' }}>{t.clearFilters}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => router.push('/session-setup')}
          style={{
            marginTop: 24,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: colors.ACCENT,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.BG, fontWeight: '600' }}>{t.startTraining}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <AlertCircle size={64} color={colors.ERROR} />
      <Text style={{ color: colors.TEXT, fontSize: 20, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
        {t.somethingWentWrong}
      </Text>
      <Text style={{ color: colors.TEXT_SECONDARY, textAlign: 'center', marginTop: 8 }}>
        {error || t.failedToLoadHistory}
      </Text>
      <TouchableOpacity
        onPress={refreshSessions}
        style={{
          marginTop: 24,
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: colors.ACCENT,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: colors.BG, fontWeight: '600' }}>{t.tryAgain}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.BG }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.BORDER,
        }}
      >
        <View>
          <Text style={{ color: colors.TEXT, fontSize: 24, fontWeight: '700' }}>{t.trainingHistory}</Text>
          <Text style={{ color: colors.TEXT_SECONDARY, fontSize: 14 }}>
            {sessionCount} {t.sessionsFound}
          </Text>
        </View>

        <TouchableOpacity onPress={refreshSessions} disabled={loading}>
          <RefreshCw size={24} color={loading ? colors.TEXT_SECONDARY : colors.ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {error ? (
          renderErrorState()
        ) : (
          <>
            {/* Filters */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <SessionFilters
                searchText={searchText}
                onSearchChange={updateSearchText}
                selectedCategory={selectedCategory}
                onCategoryChange={updateCategory}
                dateRange={dateRange}
                onDateRangeChange={updateDateRange}
                onClearFilters={clearFilters}
              />
            </View>

            {/* Sessions List */}
            <FlatList
              data={sessions}
              renderItem={renderSessionItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 100,
                flexGrow: 1,
              }}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={refreshSessions} tintColor={colors.ACCENT} />
              }
              ListEmptyComponent={renderEmptyState}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>

      {/* Session Detail Modal */}
      <SessionDetailModal
        visible={showDetailModal}
        session={selectedSession}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSession(null);
        }}
        onRetry={handleRetrySession}
        onViewReport={handleViewReport}
      />
    </SafeAreaView>
  );
}