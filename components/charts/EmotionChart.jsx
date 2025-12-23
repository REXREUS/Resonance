import { View, Text, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Badge from '../ui/Badge';
import { COLORS, SPACING } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Emotional Telemetry Chart for Report screen
 * @param {Array} data - Array of emotion data points from processEmotionalTelemetry
 * @param {string} duration - Total duration string
 * @param {string} overallSentiment - Overall sentiment label
 */
export default function EmotionChart({
  data = [],
  duration = '00:00',
  overallSentiment = 'Stable',
  style,
}) {
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 80;
  const paddingLeft = 0;
  const paddingRight = 0;
  const paddingTop = 5;
  const paddingBottom = 20;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Normalize data - handle both formats:
  // 1. { value: number } format
  // 2. { y: number, intensity: number } format from processEmotionalTelemetry
  const normalizedData = (data || [])
    .filter((d) => d && (typeof d.value === 'number' || typeof d.y === 'number' || typeof d.intensity === 'number'))
    .map((d) => {
      // Get value from different possible formats
      let value = d.value;
      if (value === undefined) {
        // Use intensity if available (0-1 range)
        if (typeof d.intensity === 'number') {
          value = d.intensity;
        } else if (typeof d.y === 'number') {
          // y is in range -2 to 2, normalize to 0-1
          value = (d.y + 2) / 4;
        } else {
          value = 0.5;
        }
      }
      return {
        ...d,
        value: Math.max(0, Math.min(1, value || 0)),
      };
    });

  // Create area path
  const createAreaPath = () => {
    if (normalizedData.length < 2) return '';

    const points = normalizedData.map((d, index) => {
      const x = paddingLeft + (index / Math.max(1, normalizedData.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - (d.value || 0) * graphHeight;
      return {
        x: isNaN(x) ? 0 : x,
        y: isNaN(y) ? paddingTop + graphHeight : y,
      };
    });

    let path = `M ${points[0].x} ${paddingTop + graphHeight}`;
    path += ` L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    path += ` L ${points[points.length - 1].x} ${paddingTop + graphHeight}`;
    path += ' Z';

    return path;
  };

  // Create line path
  const createLinePath = () => {
    if (normalizedData.length < 2) return '';

    const points = normalizedData.map((d, index) => {
      const x = paddingLeft + (index / Math.max(1, normalizedData.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - (d.value || 0) * graphHeight;
      return {
        x: isNaN(x) ? 0 : x,
        y: isNaN(y) ? paddingTop + graphHeight : y,
      };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  // Don't render chart if no valid data
  const hasValidData = normalizedData.length >= 2;

  return (
    <View style={style}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.SM,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: COLORS.LIGHT_TEXT,
          }}
        >
          Emotional Telemetry
        </Text>
        <Badge variant="outline" size="sm">
          {overallSentiment}
        </Badge>
      </View>

      {/* Chart */}
      <View
        style={{
          backgroundColor: '#F5F5F5',
          borderRadius: 8,
          padding: SPACING.SM,
        }}
      >
        {hasValidData ? (
          <Svg width={chartWidth - SPACING.MD * 2} height={chartHeight}>
            {/* Area fill */}
            <Path
              d={createAreaPath()}
              fill={COLORS.CYBER_YELLOW + '30'}
            />

            {/* Line */}
            <Path
              d={createLinePath()}
              stroke={COLORS.CYBER_YELLOW}
              strokeWidth={2}
              fill="none"
            />
          </Svg>
        ) : (
          <View style={{ height: chartHeight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: COLORS.LIGHT_TEXT_SECONDARY, fontSize: 12 }}>
              No emotion data available
            </Text>
          </View>
        )}

        {/* Duration label */}
        <Text
          style={{
            position: 'absolute',
            bottom: SPACING.SM,
            right: SPACING.SM,
            fontSize: 10,
            color: COLORS.LIGHT_TEXT_SECONDARY,
          }}
        >
          {duration}
        </Text>
      </View>
    </View>
  );
}

/**
 * Simple Bar Chart for metrics comparison
 */
export function MetricsBarChart({
  metrics = [],
  style,
}) {
  return (
    <View style={[{ gap: SPACING.SM }, style]}>
      {metrics.map((metric, index) => (
        <View key={index}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: COLORS.LIGHT_TEXT_SECONDARY,
              }}
            >
              {metric.label}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: COLORS.LIGHT_TEXT,
              }}
            >
              {metric.value}
            </Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: '#E8E8E8',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${metric.percentage}%`,
                backgroundColor: metric.color || COLORS.CYBER_YELLOW,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
