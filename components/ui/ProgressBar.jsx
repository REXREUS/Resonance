import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Progress Bar component
 * @param {number} value - Current progress (0-100)
 * @param {string} variant - 'default' | 'success' | 'warning' | 'error' | 'gradient'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} showLabel - Show percentage label
 * @param {boolean} animated - Enable animation
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  labelRight,
  trackColor = '#E0E0E0',
  style,
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const getVariantColor = () => {
    const variants = {
      default: COLORS.CYBER_YELLOW,
      success: COLORS.SUCCESS,
      warning: COLORS.WARNING,
      error: COLORS.ERROR,
      info: COLORS.INFO,
    };
    return variants[variant] || variants.default;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: { height: 4 },
      md: { height: 8 },
      lg: { height: 12 },
    };
    return sizes[size] || sizes.md;
  };

  const activeColor = getVariantColor();
  const sizeStyles = getSizeStyles();

  return (
    <View style={style}>
      {(label || labelRight || showLabel) && (
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between',
          marginBottom: SPACING.XS,
        }}>
          {label && (
            <Text style={{ 
              fontSize: 12, 
              color: COLORS.LIGHT_TEXT_SECONDARY,
            }}>
              {label}
            </Text>
          )}
          {(labelRight || showLabel) && (
            <Text style={{ 
              fontSize: 12, 
              fontWeight: '600',
              color: COLORS.LIGHT_TEXT,
            }}>
              {labelRight || `${Math.round(percentage)}%`}
            </Text>
          )}
        </View>
      )}
      
      <View
        style={[
          sizeStyles,
          {
            backgroundColor: trackColor,
            borderRadius: BORDER_RADIUS.FULL,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={[
            sizeStyles,
            {
              width: `${percentage}%`,
              backgroundColor: activeColor,
              borderRadius: BORDER_RADIUS.FULL,
            },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Segmented Progress Bar (like stamina bar)
 */
export function SegmentedProgressBar({
  value = 0,
  max = 100,
  segments = 5,
  activeColor = COLORS.CYBER_YELLOW,
  inactiveColor = '#E0E0E0',
  warningThreshold = 30,
  warningColor = COLORS.ERROR,
  style,
}) {
  const percentage = (value / max) * 100;
  const activeSegments = Math.ceil((percentage / 100) * segments);
  const isWarning = percentage <= warningThreshold;

  return (
    <View style={[{ flexDirection: 'row', gap: 4 }, style]}>
      {Array.from({ length: segments }).map((_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 8,
            borderRadius: BORDER_RADIUS.SM,
            backgroundColor: index < activeSegments 
              ? (isWarning ? warningColor : activeColor)
              : inactiveColor,
          }}
        />
      ))}
    </View>
  );
}
