import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Metric Card component for displaying stats (like Pace, Filler Words, etc.)
 * @param {string} label - Metric label
 * @param {string|number} value - Metric value
 * @param {string} unit - Unit suffix (wpm, %, count)
 * @param {React.ReactNode} icon - Icon component
 * @param {string} trend - '+2.1%' or '-5%' for trend indicator
 * @param {string} variant - 'default' | 'dark' | 'light' | 'highlight'
 */
export default function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendDirection,
  variant = 'default',
  size = 'md',
  style,
}) {
  const getVariantStyles = () => {
    const variants = {
      default: {
        container: { backgroundColor: COLORS.DARK_CARD },
        label: { color: COLORS.DARK_TEXT_SECONDARY },
        value: { color: COLORS.DARK_TEXT },
        unit: { color: COLORS.DARK_TEXT_SECONDARY },
      },
      dark: {
        container: { backgroundColor: COLORS.DARK_BG },
        label: { color: COLORS.DARK_TEXT_SECONDARY },
        value: { color: COLORS.DARK_TEXT },
        unit: { color: COLORS.DARK_TEXT_SECONDARY },
      },
      light: {
        container: { backgroundColor: '#F8F8F8' },
        label: { color: COLORS.LIGHT_TEXT_SECONDARY },
        value: { color: COLORS.LIGHT_TEXT },
        unit: { color: COLORS.LIGHT_TEXT_SECONDARY },
      },
      highlight: {
        container: { backgroundColor: COLORS.CYBER_YELLOW },
        label: { color: 'rgba(0,0,0,0.6)' },
        value: { color: '#000000' },
        unit: { color: 'rgba(0,0,0,0.6)' },
      },
    };
    return variants[variant] || variants.default;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        container: { padding: SPACING.SM },
        label: { fontSize: 10 },
        value: { fontSize: 20 },
        unit: { fontSize: 12 },
      },
      md: {
        container: { padding: SPACING.MD },
        label: { fontSize: 12 },
        value: { fontSize: 28 },
        unit: { fontSize: 14 },
      },
      lg: {
        container: { padding: SPACING.LG },
        label: { fontSize: 14 },
        value: { fontSize: 36 },
        unit: { fontSize: 16 },
      },
    };
    return sizes[size] || sizes.md;
  };

  const getTrendColor = () => {
    if (trendDirection === 'up') return COLORS.SUCCESS;
    if (trendDirection === 'down') return COLORS.ERROR;
    return COLORS.LIGHT_TEXT_SECONDARY;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        {
          borderRadius: BORDER_RADIUS.LG,
        },
        sizeStyles.container,
        variantStyles.container,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS }}>
        {icon && <View style={{ marginRight: SPACING.XS }}>{icon}</View>}
        <Text
          style={[
            {
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            },
            sizeStyles.label,
            variantStyles.label,
          ]}
        >
          {label}
        </Text>
        {trend && (
          <View
            style={{
              marginLeft: 'auto',
              backgroundColor: getTrendColor() + '20',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: BORDER_RADIUS.SM,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: getTrendColor(),
              }}
            >
              {trend}
            </Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={[
            { fontWeight: '700' },
            sizeStyles.value,
            variantStyles.value,
          ]}
        >
          {value}
        </Text>
        {unit && (
          <Text
            style={[
              { fontWeight: '500', marginLeft: 4 },
              sizeStyles.unit,
              variantStyles.unit,
            ]}
          >
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}
