import React from 'react';
import { View, Text } from 'react-native';
import { SegmentedProgressBar } from '../ui/ProgressBar';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Queue Status component for Stress Mode header
 * @param {number} current - Current queue position
 * @param {number} total - Total queue size
 * @param {number} stamina - Stamina percentage (0-100)
 */
export default function QueueStatus({
  current = 0,
  total = 20,
  stamina = 100,
  style,
}) {
  const queuePercentage = (current / total) * 100;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: SPACING.MD,
        },
        style,
      ]}
    >
      {/* Queue Progress */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#F5F5F5',
          borderRadius: BORDER_RADIUS.FULL,
          padding: SPACING.SM,
          paddingHorizontal: SPACING.MD,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: SPACING.XS,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: COLORS.LIGHT_TEXT_SECONDARY,
              textTransform: 'uppercase',
            }}
          >
            QUEUE
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: COLORS.LIGHT_TEXT,
            }}
          >
            {current}/{total}
          </Text>
        </View>
        <View
          style={{
            height: 6,
            backgroundColor: '#E0E0E0',
            borderRadius: BORDER_RADIUS.FULL,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${queuePercentage}%`,
              backgroundColor: COLORS.CYBER_YELLOW,
              borderRadius: BORDER_RADIUS.FULL,
            }}
          />
        </View>
      </View>

      {/* Stamina */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#F5F5F5',
          borderRadius: BORDER_RADIUS.FULL,
          padding: SPACING.SM,
          paddingHorizontal: SPACING.MD,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: SPACING.XS,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: COLORS.LIGHT_TEXT_SECONDARY,
              textTransform: 'uppercase',
            }}
          >
            STAMINA
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ marginRight: 4 }}>❤️</Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: stamina <= 30 ? COLORS.ERROR : COLORS.LIGHT_TEXT,
              }}
            >
              {stamina}%
            </Text>
          </View>
        </View>
        <SegmentedProgressBar
          value={stamina}
          max={100}
          segments={5}
          activeColor={COLORS.DARK_CARD}
          inactiveColor="#E0E0E0"
          warningThreshold={30}
        />
      </View>
    </View>
  );
}
