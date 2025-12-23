import React from 'react';
import { View, Text } from 'react-native';
import { Smile, Meh, Frown, AlertCircle } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Sentiment Badge component for displaying AI emotion state
 * @param {string} sentiment - 'positive' | 'neutral' | 'negative' | 'hostile'
 * @param {string} label - Custom label text
 */
export default function SentimentBadge({
  sentiment = 'neutral',
  label,
  size = 'md',
  style,
}) {
  const getSentimentConfig = () => {
    const configs = {
      positive: {
        icon: Smile,
        label: 'Positive',
        backgroundColor: '#E8F5E9',
        textColor: '#2E7D32',
        iconColor: '#4CAF50',
      },
      neutral: {
        icon: Meh,
        label: 'Neutral',
        backgroundColor: '#FFF8E1',
        textColor: '#F57C00',
        iconColor: COLORS.CYBER_YELLOW,
      },
      negative: {
        icon: Frown,
        label: 'Negative',
        backgroundColor: '#FFEBEE',
        textColor: '#C62828',
        iconColor: '#F44336',
      },
      hostile: {
        icon: AlertCircle,
        label: 'Hostile',
        backgroundColor: '#FFEBEE',
        textColor: '#C62828',
        iconColor: '#F44336',
      },
      stable: {
        icon: Meh,
        label: 'Stable',
        backgroundColor: '#E3F2FD',
        textColor: '#1565C0',
        iconColor: '#2196F3',
      },
    };
    return configs[sentiment] || configs.neutral;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        padding: { paddingVertical: 4, paddingHorizontal: 8 },
        icon: 12,
        text: 10,
      },
      md: {
        padding: { paddingVertical: 6, paddingHorizontal: 12 },
        icon: 16,
        text: 12,
      },
      lg: {
        padding: { paddingVertical: 8, paddingHorizontal: 16 },
        icon: 20,
        text: 14,
      },
    };
    return sizes[size] || sizes.md;
  };

  const config = getSentimentConfig();
  const sizeStyles = getSizeStyles();
  const IconComponent = config.icon;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: config.backgroundColor,
          borderRadius: BORDER_RADIUS.FULL,
          alignSelf: 'flex-start',
        },
        sizeStyles.padding,
        style,
      ]}
    >
      <IconComponent
        size={sizeStyles.icon}
        color={config.iconColor}
        style={{ marginRight: SPACING.XS }}
      />
      <Text
        style={{
          fontSize: sizeStyles.text,
          fontWeight: '600',
          color: config.textColor,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label || config.label}
      </Text>
    </View>
  );
}
