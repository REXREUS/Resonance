import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { X, Calendar, Clock, Settings, FileText, RotateCcw } from 'lucide-react-native';
import { getScoreColor, getScoreGrade, formatSessionMode } from '../utils/scoreColorCalculator';
import { COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

/**
 * SessionDetailModal component for displaying comprehensive session information
 */
export const SessionDetailModal = ({ 
  visible, 
  session, 
  onClose, 
  onRetry,
  onViewReport 
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  if (!session) return null;

  const scoreColor = getScoreColor(session.score || 0);
  const grade = getScoreGrade(session.score || 0);

  // Format timestamp
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return t.notRecorded || 'Not recorded';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}${t.hours?.charAt(0) || 'h'} ${mins}${t.minutes?.charAt(0) || 'm'} ${secs}${t.seconds?.charAt(0) || 's'}`;
    }
    return `${mins}${t.minutes?.charAt(0) || 'm'} ${secs}${t.seconds?.charAt(0) || 's'}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: colors.BG }}>
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b" style={{ borderBottomColor: colors.BORDER }}>
          <Text className="text-xl font-bold" style={{ color: colors.TEXT }}>{t.viewDetails}</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.TEXT} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Session Info Card */}
          <View className="rounded-lg p-4 mb-4 border" style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}>
            <Text className="text-lg font-semibold mb-2" style={{ color: colors.TEXT }}>
              {session.scenario}
            </Text>
            
            <View className="flex-row items-center mb-3">
              <Calendar size={16} color={colors.TEXT_SECONDARY} />
              <Text className="ml-2" style={{ color: colors.TEXT_SECONDARY }}>
                {formatDate(session.timestamp)}
              </Text>
            </View>

            <View className="flex-row items-center mb-3">
              <Clock size={16} color={colors.TEXT_SECONDARY} />
              <Text className="ml-2" style={{ color: colors.TEXT_SECONDARY }}>
                {t.duration}: {formatDuration(session.duration)}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Settings size={16} color={colors.TEXT_SECONDARY} />
              <Text className="ml-2" style={{ color: colors.TEXT_SECONDARY }}>
                {t.mode}: {formatSessionMode(session.mode)}
              </Text>
            </View>
          </View>

          {/* Score Card */}
          <View className="rounded-lg p-4 mb-4 border" style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}>
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.TEXT }}>{t.score}</Text>
            
            <View className="flex-row items-center justify-between">
              <View className="items-center">
                <View 
                  className="w-20 h-20 rounded-full border-4 items-center justify-center mb-2"
                  style={{ borderColor: scoreColor }}
                >
                  <Text 
                    className="text-2xl font-bold"
                    style={{ color: scoreColor }}
                  >
                    {session.score || '--'}
                  </Text>
                </View>
                <Text 
                  className="text-lg font-bold"
                  style={{ color: scoreColor }}
                >
                  {t.grade || 'Grade'} {grade}
                </Text>
              </View>

              <View className="flex-1 ml-6">
                <View className="flex-row justify-between mb-2">
                  <Text style={{ color: colors.TEXT_SECONDARY }}>{t.clarity}</Text>
                  <Text className="font-medium" style={{ color: colors.TEXT }}>
                    {session.clarity_score || '--'}%
                  </Text>
                </View>
                
                <View className="flex-row justify-between mb-2">
                  <Text style={{ color: colors.TEXT_SECONDARY }}>{t.confidence}</Text>
                  <Text className="font-medium" style={{ color: colors.TEXT }}>
                    {session.confidence_score || '--'}%
                  </Text>
                </View>
                
                <View className="flex-row justify-between mb-2">
                  <Text style={{ color: colors.TEXT_SECONDARY }}>{t.pace}</Text>
                  <Text className="font-medium" style={{ color: colors.TEXT }}>
                    {session.pace || '--'} {t.wpm}
                  </Text>
                </View>
                
                <View className="flex-row justify-between">
                  <Text style={{ color: colors.TEXT_SECONDARY }}>{t.fillerWords}</Text>
                  <Text className="font-medium" style={{ color: colors.TEXT }}>
                    {session.filler_word_count || '--'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Status Card */}
          <View className="rounded-lg p-4 mb-4 border" style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}>
            <Text className="text-lg font-semibold mb-3" style={{ color: colors.TEXT }}>{t.sessionStatus || 'Session Status'}</Text>
            
            <View className="flex-row items-center justify-between">
              <Text style={{ color: colors.TEXT_SECONDARY }}>{t.completionStatus || 'Completion Status'}</Text>
              <View className="flex-row items-center">
                <View 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ 
                    backgroundColor: session.completed ? COLORS.SUCCESS : COLORS.WARNING 
                  }}
                />
                <Text 
                  className="font-medium"
                  style={{ 
                    color: session.completed ? COLORS.SUCCESS : COLORS.WARNING 
                  }}
                >
                  {session.completed ? t.completed : t.inProgress}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="space-y-3 mb-6">
            {/* View Full Report */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onViewReport?.(session);
              }}
              className="rounded-lg py-3 px-4 flex-row items-center justify-center"
              style={{ backgroundColor: colors.ACCENT }}
            >
              <FileText size={20} color={colors.BG} />
              <Text className="font-semibold ml-2" style={{ color: colors.BG }}>
                {t.viewReport}
              </Text>
            </TouchableOpacity>

            {/* Retry Session */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onRetry?.(session);
              }}
              className="border rounded-lg py-3 px-4 flex-row items-center justify-center"
              style={{ borderColor: colors.ACCENT }}
            >
              <RotateCcw size={20} color={colors.ACCENT} />
              <Text 
                className="font-semibold ml-2"
                style={{ color: colors.ACCENT }}
              >
                {t.retrySession || 'Retry This Session'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default SessionDetailModal;