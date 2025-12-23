import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Floating Action Button component
 * @param {React.ReactNode} icon - Icon component
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} variant - 'primary' | 'secondary'
 * @param {boolean} disabled - Disable button
 */
export default function FAB({
  icon,
  onPress,
  size = 'md',
  variant = 'primary',
  disabled = false,
  style,
}) {
  const getSizeStyles = () => {
    const sizes = {
      sm: { container: 48, icon: 20 },
      md: { container: 56, icon: 24 },
      lg: { container: 64, icon: 28 },
    };
    return sizes[size] || sizes.md;
  };

  const getVariantStyles = () => {
    const variants = {
      primary: {
        backgroundColor: COLORS.CYBER_YELLOW,
        iconColor: '#000000',
      },
      secondary: {
        backgroundColor: COLORS.DARK_CARD,
        iconColor: COLORS.DARK_TEXT,
      },
      danger: {
        backgroundColor: COLORS.ERROR,
        iconColor: '#FFFFFF',
      },
    };
    return variants[variant] || variants.primary;
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        {
          width: sizeStyles.container,
          height: sizeStyles.container,
          borderRadius: BORDER_RADIUS.FULL,
          backgroundColor: variantStyles.backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon || <Mic size={sizeStyles.icon} color={variantStyles.iconColor} />}
    </TouchableOpacity>
  );
}

/**
 * Call Control FAB (like end call button)
 */
export function CallControlFAB({
  icon,
  onPress,
  variant = 'mute',
  size = 'md',
  isActive = false,
  style,
}) {
  const getSizeStyles = () => {
    const sizes = {
      sm: { container: 44, icon: 20 },
      md: { container: 52, icon: 24 },
      lg: { container: 60, icon: 28 },
    };
    return sizes[size] || sizes.md;
  };

  const getVariantStyles = () => {
    const variants = {
      mute: {
        backgroundColor: isActive ? COLORS.DARK_CARD : '#E8E8E8',
        iconColor: isActive ? COLORS.DARK_TEXT : COLORS.LIGHT_TEXT,
      },
      endCall: {
        backgroundColor: COLORS.ERROR,
        iconColor: '#FFFFFF',
      },
    };
    return variants[variant] || variants.mute;
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        {
          width: sizeStyles.container,
          height: sizeStyles.container,
          borderRadius: BORDER_RADIUS.FULL,
          backgroundColor: variantStyles.backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {icon && React.cloneElement(icon, { 
        size: sizeStyles.icon, 
        color: variantStyles.iconColor 
      })}
    </TouchableOpacity>
  );
}
