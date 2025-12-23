import { View, Text, TouchableOpacity } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { getScoreColor, getScoreGrade, formatSessionMode, getSessionBadge } from '../utils/scoreColorCalculator';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

const RotateCcw = LucideIcons.RotateCcw;
import { COLORS } from '../constants/theme';

/**
 * SessionCard component for displaying session information in history
 */
export const SessionCard = ({ 
  session, 
  onPress, 
  onRetry,
  showRetryButton = true 
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const scoreColor = getScoreColor(session.score || 0);
  const grade = getScoreGrade(session.score || 0);
  const badge = getSessionBadge(session.mode);
  
  // Format timestamp
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-dark-card border border-dark-border rounded-lg p-4 mb-3"
      style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}
      activeOpacity={0.7}
    >
      {/* Header with scenario and badge */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-semibold" style={{ color: colors.TEXT }} numberOfLines={2}>
            {session.scenario}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.TEXT_SECONDARY }}>
            {formatDate(session.timestamp)}
          </Text>
        </View>
        
        {/* Session type badge */}
        <View 
          className="px-2 py-1 rounded-md"
          style={{ backgroundColor: badge.bgColor }}
        >
          <Text 
            className="text-xs font-bold"
            style={{ color: badge.color }}
          >
            {badge.text}
          </Text>
        </View>
      </View>

      {/* Score and metrics */}
      <View className="flex-row justify-between items-center mb-3">
        {/* Score circle */}
        <View className="flex-row items-center">
          <View 
            className="w-12 h-12 rounded-full border-2 items-center justify-center"
            style={{ borderColor: scoreColor }}
          >
            <Text 
              className="text-sm font-bold"
              style={{ color: scoreColor }}
            >
              {grade}
            </Text>
          </View>
          
          <View className="ml-3">
            <Text 
              className="text-lg font-bold"
              style={{ color: scoreColor }}
            >
              {session.score || '--'}
            </Text>
            <Text className="text-xs" style={{ color: colors.TEXT_SECONDARY }}>
              {t.score}
            </Text>
          </View>
        </View>

        {/* Quick metrics */}
        <View className="flex-row space-x-4">
          {/* Duration */}
          <View className="items-center">
            <Text className="text-sm font-medium" style={{ color: colors.TEXT }}>
              {formatDuration(session.duration)}
            </Text>
            <Text className="text-xs" style={{ color: colors.TEXT_SECONDARY }}>{t.duration}</Text>
          </View>
          
          {/* Pace */}
          <View className="items-center">
            <Text className="text-sm font-medium" style={{ color: colors.TEXT }}>
              {session.pace || '--'}
            </Text>
            <Text className="text-xs" style={{ color: colors.TEXT_SECONDARY }}>{t.wpm}</Text>
          </View>
          
          {/* Filler words */}
          <View className="items-center">
            <Text className="text-sm font-medium" style={{ color: colors.TEXT }}>
              {session.filler_word_count || '--'}
            </Text>
            <Text className="text-xs" style={{ color: colors.TEXT_SECONDARY }}>{t.fillerWords}</Text>
          </View>
        </View>
      </View>

      {/* Bottom actions */}
      <View className="flex-row justify-between items-center pt-2 border-t" style={{ borderTopColor: colors.BORDER }}>
        <Text className="text-sm" style={{ color: colors.TEXT_SECONDARY }}>
          {formatSessionMode(session.mode)} • {session.completed ? t.completed : t.inProgress}
        </Text>
        
        {showRetryButton && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onRetry?.(session);
            }}
            className="flex-row items-center px-3 py-1 rounded-md"
            style={{ backgroundColor: `${colors.ACCENT}20` }}
          >
            <RotateCcw 
              size={14} 
              color={colors.ACCENT} 
            />
            <Text 
              className="ml-1 text-xs font-medium"
              style={{ color: colors.ACCENT }}
            >
              {t.retry}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default SessionCard;