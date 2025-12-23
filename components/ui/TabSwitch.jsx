import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Tab Switch component (like Single Call / Stress Test toggle)
 * @param {Array} tabs - Array of { key, label } objects
 * @param {string} activeTab - Currently active tab key
 * @param {function} onTabChange - Callback when tab changes
 */
export default function TabSwitch({
  tabs = [],
  activeTab,
  onTabChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  style,
}) {
  const getVariantStyles = () => {
    const variants = {
      default: {
        container: { backgroundColor: '#F0F0F0' },
        active: { backgroundColor: '#FFFFFF' },
        activeText: { color: COLORS.LIGHT_TEXT },
        inactiveText: { color: COLORS.LIGHT_TEXT_SECONDARY },
      },
      dark: {
        container: { backgroundColor: COLORS.DARK_CARD },
        active: { backgroundColor: COLORS.CYBER_YELLOW },
        activeText: { color: '#000000' },
        inactiveText: { color: COLORS.DARK_TEXT_SECONDARY },
      },
      yellow: {
        container: { backgroundColor: '#F5F5F5' },
        active: { backgroundColor: COLORS.CYBER_YELLOW },
        activeText: { color: '#000000' },
        inactiveText: { color: COLORS.LIGHT_TEXT_SECONDARY },
      },
    };
    return variants[variant] || variants.default;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        container: { padding: 2, borderRadius: BORDER_RADIUS.MD },
        tab: { paddingVertical: SPACING.XS, paddingHorizontal: SPACING.SM },
        text: { fontSize: 12 },
      },
      md: {
        container: { padding: 4, borderRadius: BORDER_RADIUS.LG },
        tab: { paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD },
        text: { fontSize: 14 },
      },
      lg: {
        container: { padding: 4, borderRadius: BORDER_RADIUS.LG },
        tab: { paddingVertical: SPACING.SM + 2, paddingHorizontal: SPACING.LG },
        text: { fontSize: 16 },
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
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        sizeStyles.container,
        variantStyles.container,
        style,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange?.(tab.key)}
            activeOpacity={0.7}
            style={[
              {
                flex: fullWidth ? 1 : undefined,
                alignItems: 'center',
                borderRadius: sizeStyles.container.borderRadius - 2,
              },
              sizeStyles.tab,
              isActive && variantStyles.active,
            ]}
          >
            <Text
              style={[
                {
                  fontWeight: isActive ? '600' : '500',
                },
                sizeStyles.text,
                isActive ? variantStyles.activeText : variantStyles.inactiveText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
