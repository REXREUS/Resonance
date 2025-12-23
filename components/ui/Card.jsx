import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Card component
 * @param {string} variant - 'default' | 'elevated' | 'outlined' | 'dark' | 'light'
 * @param {string} padding - 'none' | 'sm' | 'md' | 'lg'
 * @param {boolean} pressable - Whether card is pressable
 */
export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  pressable = false,
  onPress,
  style,
  ...props
}) {
  const getVariantStyles = () => {
    const variants = {
      default: {
        backgroundColor: COLORS.DARK_CARD,
        borderWidth: 0,
      },
      elevated: {
        backgroundColor: COLORS.DARK_CARD,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
      outlined: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.DARK_BORDER,
      },
      dark: {
        backgroundColor: COLORS.DARK_BG,
        borderWidth: 1,
        borderColor: COLORS.DARK_BORDER,
      },
      light: {
        backgroundColor: COLORS.LIGHT_CARD,
        borderWidth: 1,
        borderColor: COLORS.LIGHT_BORDER,
      },
      cream: {
        backgroundColor: '#FAF8F5',
        borderWidth: 0,
      },
    };
    return variants[variant] || variants.default;
  };

  const getPaddingStyles = () => {
    const paddings = {
      none: 0,
      sm: SPACING.SM,
      md: SPACING.MD,
      lg: SPACING.LG,
    };
    return paddings[padding] ?? SPACING.MD;
  };

  const variantStyles = getVariantStyles();
  const paddingValue = getPaddingStyles();

  const cardStyle = [
    {
      borderRadius: BORDER_RADIUS.LG,
      padding: paddingValue,
    },
    variantStyles,
    style,
  ];

  if (pressable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={cardStyle}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}
