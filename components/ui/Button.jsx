import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Button component with multiple variants
 * @param {string} variant - 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} fullWidth - Whether button takes full width
 * @param {boolean} loading - Show loading spinner
 * @param {boolean} disabled - Disable button
 * @param {React.ReactNode} icon - Icon component to show
 * @param {string} iconPosition - 'left' | 'right'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  onPress,
  style,
  textStyle,
  ...props
}) {
  const getVariantStyles = () => {
    const variants = {
      primary: {
        container: {
          backgroundColor: COLORS.CYBER_YELLOW,
        },
        text: {
          color: '#000000',
          fontWeight: '700',
        },
      },
      secondary: {
        container: {
          backgroundColor: COLORS.DARK_CARD,
        },
        text: {
          color: COLORS.DARK_TEXT,
          fontWeight: '600',
        },
      },
      outline: {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: COLORS.CYBER_YELLOW,
        },
        text: {
          color: COLORS.CYBER_YELLOW,
          fontWeight: '600',
        },
      },
      ghost: {
        container: {
          backgroundColor: 'transparent',
        },
        text: {
          color: COLORS.CYBER_YELLOW,
          fontWeight: '600',
        },
      },
      danger: {
        container: {
          backgroundColor: COLORS.ERROR,
        },
        text: {
          color: '#ffffff',
          fontWeight: '600',
        },
      },
    };
    return variants[variant] || variants.primary;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        container: {
          paddingVertical: SPACING.XS,
          paddingHorizontal: SPACING.SM,
          borderRadius: BORDER_RADIUS.MD,
        },
        text: { fontSize: 12 },
      },
      md: {
        container: {
          paddingVertical: SPACING.SM + 2,
          paddingHorizontal: SPACING.MD,
          borderRadius: BORDER_RADIUS.LG,
        },
        text: { fontSize: 14 },
      },
      lg: {
        container: {
          paddingVertical: SPACING.MD - 2,
          paddingHorizontal: SPACING.LG,
          borderRadius: BORDER_RADIUS.LG,
        },
        text: { fontSize: 16 },
      },
      xl: {
        container: {
          paddingVertical: SPACING.MD,
          paddingHorizontal: SPACING.XL,
          borderRadius: BORDER_RADIUS.XL,
        },
        text: { fontSize: 18 },
      },
    };
    return sizes[size] || sizes.md;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        sizeStyles.container,
        variantStyles.container,
        fullWidth && { width: '100%' },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variantStyles.text.color} 
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View style={{ marginRight: SPACING.XS }}>{icon}</View>
          )}
          <Text style={[sizeStyles.text, variantStyles.text, textStyle]}>
            {children}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={{ marginLeft: SPACING.XS }}>{icon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}
