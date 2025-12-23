import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import useTheme from '../../hooks/useTheme';

/**
 * Reusable Toggle/Switch component
 * @param {boolean} value - Current toggle state
 * @param {function} onValueChange - Callback when toggled
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} disabled - Disable toggle
 */
export default function Toggle({
  value = false,
  onValueChange,
  size = 'md',
  disabled = false,
  label,
  description,
  style,
}) {
  const { colors } = useTheme();

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        track: { width: 36, height: 20 },
        thumb: { width: 16, height: 16 },
        thumbOffset: 2,
      },
      md: {
        track: { width: 48, height: 26 },
        thumb: { width: 22, height: 22 },
        thumbOffset: 2,
      },
      lg: {
        track: { width: 56, height: 30 },
        thumb: { width: 26, height: 26 },
        thumbOffset: 2,
      },
    };
    return sizes[size] || sizes.md;
  };

  const sizeStyles = getSizeStyles();
  const thumbPosition = value 
    ? sizeStyles.track.width - sizeStyles.thumb.width - sizeStyles.thumbOffset 
    : sizeStyles.thumbOffset;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
      {(label || description) && (
        <View style={{ flex: 1, marginRight: SPACING.MD }}>
          {label && (
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '500', 
              color: colors.TEXT,
              marginBottom: description ? 2 : 0,
            }}>
              {label}
            </Text>
          )}
          {description && (
            <Text style={{ 
              fontSize: 12, 
              color: colors.TEXT_SECONDARY,
            }}>
              {description}
            </Text>
          )}
        </View>
      )}
      <TouchableOpacity
        onPress={() => !disabled && onValueChange?.(!value)}
        activeOpacity={0.8}
        disabled={disabled}
        style={{
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View
          style={[
            sizeStyles.track,
            {
              borderRadius: BORDER_RADIUS.FULL,
              backgroundColor: value ? colors.ACCENT : colors.BORDER,
              justifyContent: 'center',
            },
          ]}
        >
          <View
            style={[
              sizeStyles.thumb,
              {
                borderRadius: BORDER_RADIUS.FULL,
                backgroundColor: '#FFFFFF',
                position: 'absolute',
                left: thumbPosition,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}
