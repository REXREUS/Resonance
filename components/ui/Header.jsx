import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Settings, Share2, MoreVertical } from 'lucide-react-native';
import { COLORS, SPACING } from '../../constants/theme';
import useTheme from '../../hooks/useTheme';

/**
 * Reusable Header component
 * @param {string} title - Header title
 * @param {string} variant - 'default' | 'transparent' | 'dark' | 'light' | 'themed'
 * @param {boolean} showBack - Show back button
 * @param {React.ReactNode} rightAction - Right side action component
 */
export default function Header({
  title,
  subtitle,
  variant = 'default',
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  rightIcon,
  onRightPress,
  centerContent,
  style,
}) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const getVariantStyles = () => {
    const variants = {
      default: {
        container: { backgroundColor: 'transparent' },
        text: { color: colors.TEXT },
        icon: colors.TEXT,
      },
      transparent: {
        container: { backgroundColor: 'transparent' },
        text: { color: colors.TEXT },
        icon: colors.TEXT,
      },
      dark: {
        container: { backgroundColor: COLORS.DARK_BG },
        text: { color: COLORS.DARK_TEXT },
        icon: COLORS.DARK_TEXT,
      },
      light: {
        container: { backgroundColor: COLORS.LIGHT_BG },
        text: { color: COLORS.LIGHT_TEXT },
        icon: COLORS.LIGHT_TEXT,
      },
      cream: {
        container: { backgroundColor: isDark ? colors.BG : '#FAF8F5' },
        text: { color: colors.TEXT },
        icon: colors.TEXT,
      },
      themed: {
        container: { backgroundColor: colors.BG },
        text: { color: colors.TEXT },
        icon: colors.TEXT,
      },
    };
    return variants[variant] || variants.default;
  };

  const variantStyles = getVariantStyles();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const getRightIcon = () => {
    if (rightAction) return rightAction;
    
    const iconProps = { size: 24, color: variantStyles.icon };
    
    switch (rightIcon) {
      case 'settings':
        return (
          <TouchableOpacity onPress={onRightPress}>
            <Settings {...iconProps} />
          </TouchableOpacity>
        );
      case 'share':
        return (
          <TouchableOpacity onPress={onRightPress}>
            <Share2 {...iconProps} />
          </TouchableOpacity>
        );
      case 'more':
        return (
          <TouchableOpacity onPress={onRightPress}>
            <MoreVertical {...iconProps} />
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.MD,
          paddingVertical: SPACING.MD,
          minHeight: 56,
        },
        variantStyles.container,
        style,
      ]}
    >
      {/* Left Section */}
      <View style={{ width: 40, alignItems: 'flex-start' }}>
        {showBack ? (
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={28} color={variantStyles.icon} />
          </TouchableOpacity>
        ) : leftAction ? (
          leftAction
        ) : null}
      </View>

      {/* Center Section */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {centerContent ? (
          centerContent
        ) : (
          <>
            {title && (
              <Text
                style={[
                  {
                    fontSize: 16,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  },
                  variantStyles.text,
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.TEXT_SECONDARY,
                  marginTop: 2,
                }}
              >
                {subtitle}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Right Section */}
      <View style={{ width: 40, alignItems: 'flex-end' }}>
        {getRightIcon()}
      </View>
    </View>
  );
}
