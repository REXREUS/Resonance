import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Badge component for status indicators and tags
 * @param {string} variant - 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {React.ReactNode} icon - Optional icon
 */
export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  style,
  textStyle,
}) {
  const getVariantStyles = () => {
    const variants = {
      default: {
        container: { backgroundColor: '#E8E8E8' },
        text: { color: COLORS.LIGHT_TEXT },
      },
      success: {
        container: { backgroundColor: '#E8F5E9' },
        text: { color: '#2E7D32' },
      },
      warning: {
        container: { backgroundColor: '#FFF8E1' },
        text: { color: '#F57C00' },
      },
      error: {
        container: { backgroundColor: '#FFEBEE' },
        text: { color: '#C62828' },
      },
      hostile: {
        container: { backgroundColor: '#FFEBEE' },
        text: { color: '#C62828' },
      },
      info: {
        container: { backgroundColor: '#E3F2FD' },
        text: { color: '#1565C0' },
      },
      outline: {
        container: { 
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: COLORS.LIGHT_BORDER,
        },
        text: { color: COLORS.LIGHT_TEXT_SECONDARY },
      },
      yellow: {
        container: { backgroundColor: COLORS.CYBER_YELLOW },
        text: { color: '#000000' },
      },
      dark: {
        container: { backgroundColor: COLORS.DARK_CARD },
        text: { color: COLORS.DARK_TEXT },
      },
      online: {
        container: { backgroundColor: '#1B5E20' },
        text: { color: '#FFFFFF' },
      },
    };
    return variants[variant] || variants.default;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        container: {
          paddingVertical: 2,
          paddingHorizontal: SPACING.XS,
          borderRadius: BORDER_RADIUS.SM,
        },
        text: { fontSize: 10 },
      },
      md: {
        container: {
          paddingVertical: SPACING.XS,
          paddingHorizontal: SPACING.SM,
          borderRadius: BORDER_RADIUS.MD,
        },
        text: { fontSize: 12 },
      },
      lg: {
        container: {
          paddingVertical: SPACING.XS + 2,
          paddingHorizontal: SPACING.SM + 2,
          borderRadius: BORDER_RADIUS.MD,
        },
        text: { fontSize: 14 },
      },
    };
    return sizes[size] || sizes.md;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
        },
        sizeStyles.container,
        variantStyles.container,
        style,
      ]}
    >
      {icon && <View style={{ marginRight: 4 }}>{icon}</View>}
      <Text
        style={[
          {
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          },
          sizeStyles.text,
          variantStyles.text,
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
