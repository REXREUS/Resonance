import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import Card from '../ui/Card';
import { COLORS, SPACING } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Trend Chart component for Dashboard
 * @param {string} title - Chart title
 * @param {string} subtitle - Chart subtitle
 * @param {Array} data - Array of data points
 * @param {Array} labels - X-axis labels
 */
export default function TrendChart({
  title = 'Vocal Clarity Trend',
  subtitle = 'Last 7 Sessions',
  data = [],
  labels = [],
  onMorePress,
  style,
}) {
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 120;
  const paddingLeft = 0;
  const paddingRight = 0;
  const paddingTop = 10;
  const paddingBottom = 30;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Calculate points
  const maxValue = Math.max(...data, 100);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => ({
    x: paddingLeft + (index / (data.length - 1 || 1)) * graphWidth,
    y: paddingTop + graphHeight - ((value - minValue) / range) * graphHeight,
  }));

  // Create smooth path
  const createSmoothPath = () => {
    if (points.length < 2) return '';

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const midX = (current.x + next.x) / 2;

      path += ` Q ${current.x} ${current.y} ${midX} ${(current.y + next.y) / 2}`;
    }

    const last = points[points.length - 1];
    path += ` T ${last.x} ${last.y}`;

    return path;
  };

  return (
    <Card variant="dark" padding="md" style={style}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: SPACING.MD,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: COLORS.DARK_TEXT,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.DARK_TEXT_SECONDARY,
            }}
          >
            {subtitle}
          </Text>
        </View>
        {onMorePress && (
          <TouchableOpacity onPress={onMorePress}>
            <MoreHorizontal size={20} color={COLORS.DARK_TEXT_SECONDARY} />
          </TouchableOpacity>
        )}
      </View>

      {/* Chart */}
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio, index) => (
          <Line
            key={index}
            x1={paddingLeft}
            y1={paddingTop + graphHeight * ratio}
            x2={chartWidth - paddingRight}
            y2={paddingTop + graphHeight * ratio}
            stroke={COLORS.DARK_BORDER}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Line path */}
        <Path
          d={createSmoothPath()}
          stroke={COLORS.CYBER_YELLOW}
          strokeWidth={2}
          fill="none"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={COLORS.CYBER_YELLOW}
          />
        ))}

        {/* X-axis labels */}
        {labels.map((label, index) => (
          <SvgText
            key={index}
            x={paddingLeft + (index / (labels.length - 1 || 1)) * graphWidth}
            y={chartHeight - 5}
            fontSize={10}
            fill={COLORS.DARK_TEXT_SECONDARY}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </Svg>
    </Card>
  );
}
