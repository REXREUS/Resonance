import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThumbsUp, AlertCircle, ArrowRight, Zap, Volume2 } from 'lucide-react-native';
import Card from '../ui/Card';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * AI Coach Feedback component for Report screen
 * @param {Array} feedback - Array of feedback items
 */
export default function CoachFeedback({ feedback = [], style }) {
  return (
    <View style={style}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: COLORS.LIGHT_TEXT,
          marginBottom: SPACING.MD,
        }}
      >
        AI Coach Feedback
      </Text>

      <View style={{ gap: SPACING.SM }}>
        {feedback.map((item, index) => (
          <FeedbackItem key={index} {...item} />
        ))}
      </View>
    </View>
  );
}

/**
 * Individual Feedback Item
 */
function FeedbackItem({
  type = 'positive',
  title,
  description,
  actionLabel,
  onAction,
}) {
  const getTypeConfig = () => {
    const configs = {
      positive: {
        icon: ThumbsUp,
        iconColor: '#4CAF50',
        backgroundColor: '#E8F5E9',
      },
      improvement: {
        icon: AlertCircle,
        iconColor: '#FF9800',
        backgroundColor: '#FFF3E0',
      },
      nextSteps: {
        icon: ArrowRight,
        iconColor: '#2196F3',
        backgroundColor: '#E3F2FD',
      },
    };
    return configs[type] || configs.positive;
  };

  const config = getTypeConfig();
  const IconComponent = config.icon;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.LG,
        padding: SPACING.MD,
        borderWidth: 1,
        borderColor: COLORS.LIGHT_BORDER,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: config.backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: SPACING.SM,
        }}
      >
        <IconComponent size={18} color={config.iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: COLORS.LIGHT_TEXT,
            marginBottom: 4,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: COLORS.LIGHT_TEXT_SECONDARY,
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} style={{ marginTop: SPACING.SM }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: COLORS.CYBER_YELLOW,
              }}
            >
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Coach Tips component for Dashboard
 */
export function CoachTips({ tips = [], style }) {
  return (
    <View style={style}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: COLORS.DARK_TEXT,
          marginBottom: SPACING.MD,
        }}
      >
        AI Coach Tips
      </Text>

      <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
        {tips.map((tip, index) => (
          <TipCard key={index} {...tip} />
        ))}
      </View>
    </View>
  );
}

function TipCard({ type, title, description, actionLabel, onAction }) {
  const getTypeConfig = () => {
    const configs = {
      pacing: {
        icon: Zap,
        iconColor: COLORS.CYBER_YELLOW,
        label: 'PACING',
      },
      tone: {
        icon: Volume2,
        iconColor: '#FF5722',
        label: 'TONE',
      },
    };
    return configs[type] || configs.pacing;
  };

  const config = getTypeConfig();
  const IconComponent = config.icon;

  return (
    <Card variant="dark" padding="md" style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.SM }}>
        <IconComponent size={14} color={config.iconColor} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: config.iconColor,
            marginLeft: 4,
            textTransform: 'uppercase',
          }}
        >
          {config.label}
        </Text>
      </View>

      <Text
        style={{
          fontSize: 12,
          color: COLORS.DARK_TEXT_SECONDARY,
          lineHeight: 16,
          marginBottom: SPACING.SM,
        }}
        numberOfLines={3}
      >
        {description}
      </Text>

      {actionLabel && (
        <TouchableOpacity onPress={onAction}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: COLORS.CYBER_YELLOW,
            }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}
