import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ProgressBar from '../ui/ProgressBar';
import Card from '../ui/Card';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * API Token Usage component for Dashboard
 * @param {number} used - Tokens used
 * @param {number} total - Total token allowance
 * @param {string} resetIn - Time until reset (e.g., "3d")
 */
export default function TokenUsage({
  used = 0,
  total = 10000,
  resetIn,
  onPress,
  style,
}) {
  const percentage = (used / total) * 100;
  const isWarning = percentage >= 80;

  return (
    <Card variant="dark" padding="md" style={style}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.SM,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: COLORS.DARK_TEXT,
            }}
          >
            API Token Usage
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.DARK_TEXT_SECONDARY,
            }}
          >
            Monthly Allowance
          </Text>
        </View>
        {resetIn && (
          <TouchableOpacity
            onPress={onPress}
            style={{
              backgroundColor: COLORS.DARK_BORDER,
              paddingHorizontal: SPACING.SM,
              paddingVertical: SPACING.XS,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: COLORS.DARK_TEXT_SECONDARY,
              }}
            >
              Reset in {resetIn}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Usage Stats */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: SPACING.SM,
        }}
      >
        <Text style={{ fontSize: 12, color: COLORS.DARK_TEXT_SECONDARY }}>
          Used:{' '}
          <Text style={{ fontWeight: '600', color: COLORS.DARK_TEXT }}>
            {used.toLocaleString()}
          </Text>
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.DARK_TEXT_SECONDARY }}>
          Total:{' '}
          <Text style={{ fontWeight: '600', color: COLORS.DARK_TEXT }}>
            {total.toLocaleString()}
          </Text>
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.SM }}>
        <View style={{ flex: 1 }}>
          <ProgressBar
            value={used}
            max={total}
            variant={isWarning ? 'warning' : 'default'}
            size="md"
            trackColor={COLORS.DARK_BORDER}
          />
        </View>
      </View>

      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: SPACING.SM,
          gap: SPACING.MD,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: COLORS.DARK_CARD,
              marginRight: 6,
            }}
          />
          <Text style={{ fontSize: 10, color: COLORS.DARK_TEXT_SECONDARY }}>
            Historical
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: COLORS.DARK_TEXT_SECONDARY,
              marginRight: 6,
            }}
          />
          <Text style={{ fontSize: 10, color: COLORS.DARK_TEXT_SECONDARY }}>
            Projected
          </Text>
        </View>
      </View>
    </Card>
  );
}
