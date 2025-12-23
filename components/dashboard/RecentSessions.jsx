import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Mic, Video, ChevronRight } from 'lucide-react-native';
import ScoreCircle from '../ui/ScoreCircle';
import Badge from '../ui/Badge';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Recent Sessions component for Dashboard
 * @param {Array} sessions - Array of recent session objects
 * @param {function} onViewAll - Callback for View All button
 * @param {function} onSessionPress - Callback when session is pressed
 */
export default function RecentSessions({
  sessions = [],
  onViewAll,
  onSessionPress,
  style,
}) {
  return (
    <View style={style}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.MD,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: COLORS.DARK_TEXT,
          }}
        >
          Recent Sessions
        </Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: COLORS.CYBER_YELLOW,
              }}
            >
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sessions List */}
      <View style={{ gap: SPACING.SM }}>
        {sessions.map((session, index) => (
          <SessionItem
            key={session.id || index}
            {...session}
            onPress={() => onSessionPress?.(session)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Individual Session Item
 */
function SessionItem({
  title,
  timestamp,
  duration,
  score,
  type = 'voice',
  onPress,
}) {
  const getScoreLabel = () => {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 80) return 'GOOD';
    if (score >= 70) return 'AVERAGE';
    return 'NEEDS WORK';
  };

  const getScoreColor = () => {
    if (score >= 90) return COLORS.SUCCESS;
    if (score >= 80) return COLORS.CYBER_YELLOW;
    if (score >= 70) return '#FFA500';
    return COLORS.ERROR;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.DARK_CARD,
        borderRadius: BORDER_RADIUS.LG,
        padding: SPACING.MD,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: COLORS.DARK_BORDER,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: SPACING.SM,
        }}
      >
        {type === 'voice' ? (
          <Mic size={18} color={COLORS.DARK_TEXT} />
        ) : (
          <Video size={18} color={COLORS.DARK_TEXT} />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: COLORS.DARK_TEXT,
            marginBottom: 4,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: COLORS.DARK_TEXT_SECONDARY,
          }}
        >
          {timestamp} • {duration}
        </Text>
      </View>

      {/* Score */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: COLORS.DARK_TEXT,
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: getScoreColor(),
            textTransform: 'uppercase',
          }}
        >
          {getScoreLabel()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
