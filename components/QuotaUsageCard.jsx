import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useQuotaStatistics, useUsageHistory } from '../stores/gamificationStore';
import { COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

/**
 * Quota Usage Card Component
 * Displays current quota usage with visual indicators and trends
 */
export default function QuotaUsageCard({ onPress, showChart = true }) {
  const quotaStats = useQuotaStatistics();
  const usageHistory = useUsageHistory();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const getStatusColor = () => {
    if (quotaStats.thresholds.isExceeded) return '#ef4444';
    if (quotaStats.thresholds.isCritical) return '#f97316';
    if (quotaStats.thresholds.isWarning) return '#eab308';
    return colors.ACCENT;
  };

  const getStatusText = () => {
    if (quotaStats.thresholds.isExceeded) return t.quotaExceeded || 'Quota Exceeded';
    if (quotaStats.thresholds.isCritical) return t.criticalUsage || 'Critical Usage';
    if (quotaStats.thresholds.isWarning) return t.highUsage || 'High Usage';
    return t.normalUsage || 'Normal Usage';
  };

  const getStatusIcon = () => {
    if (quotaStats.thresholds.isExceeded) return '🚨';
    if (quotaStats.thresholds.isCritical) return '⚠️';
    if (quotaStats.thresholds.isWarning) return '⚠️';
    return '✅';
  };

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!showChart || usageHistory.length === 0) return null;

    return {
      labels: usageHistory.map((_, index) => `D${index + 1}`),
      datasets: [{
        data: usageHistory.map(day => day.percentage),
        color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
        strokeWidth: 2
      }]
    };
  }, [usageHistory, showChart]);

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
    style: {
      borderRadius: 8,
    },
    propsForDots: {
      r: "3",
      strokeWidth: "1",
      stroke: colors.ACCENT
    },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: colors.BORDER,
      strokeWidth: 1
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg p-4 border"
      style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold" style={{ color: colors.TEXT }}>{t.dailyBudget}</Text>
        <View className="flex-row items-center">
          <Text className="text-sm mr-1">{getStatusIcon()}</Text>
          <Text 
            className="text-sm font-semibold"
            style={{ color: getStatusColor() }}
          >
            {getStatusText()}
          </Text>
        </View>
      </View>

      {/* Usage Progress Bar */}
      <View className="mb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm" style={{ color: colors.TEXT_SECONDARY }}>
            ${quotaStats.daily.total.toFixed(2)} / ${quotaStats.daily.limit.toFixed(2)}
          </Text>
          <Text className="text-sm font-semibold" style={{ color: colors.TEXT }}>
            {Math.round(quotaStats.daily.percentage)}%
          </Text>
        </View>
        
        <View className="rounded-full h-3" style={{ backgroundColor: colors.BORDER }}>
          <View 
            className="rounded-full h-3"
            style={{ 
              width: `${Math.min(100, quotaStats.daily.percentage)}%`,
              backgroundColor: getStatusColor()
            }}
          />
        </View>
      </View>

      {/* Service Breakdown */}
      <View className="flex-row justify-between mb-4">
        <View className="flex-1 mr-2">
          <Text className="text-xs mb-1" style={{ color: colors.TEXT_SECONDARY }}>ElevenLabs</Text>
          <Text className="text-sm font-semibold" style={{ color: colors.TEXT }}>
            ${quotaStats.daily.elevenlabs.toFixed(3)}
          </Text>
        </View>
        <View className="flex-1 ml-2">
          <Text className="text-xs mb-1" style={{ color: colors.TEXT_SECONDARY }}>Gemini</Text>
          <Text className="text-sm font-semibold" style={{ color: colors.TEXT }}>
            ${quotaStats.daily.gemini.toFixed(3)}
          </Text>
        </View>
      </View>

      {/* Remaining Quota */}
      <View className="rounded-lg p-3 mb-4" style={{ backgroundColor: colors.BG }}>
        <View className="flex-row justify-between items-center">
          <Text className="text-sm" style={{ color: colors.TEXT_SECONDARY }}>{t.remainingToday || 'Remaining Today'}</Text>
          <Text className="text-lg font-bold" style={{ color: colors.ACCENT }}>
            ${quotaStats.daily.remaining.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Usage Trend Chart */}
      {showChart && chartData && (
        <View className="mt-2">
          <Text className="text-sm mb-2" style={{ color: colors.TEXT_SECONDARY }}>{t.usageTrend || '7-Day Usage Trend (%)'}</Text>
          <LineChart
            data={chartData}
            width={280}
            height={120}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 4,
              borderRadius: 8,
            }}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            fromZero={true}
            segments={3}
          />
        </View>
      )}

      {/* Monthly Summary */}
      <View className="border-t pt-3 mt-3" style={{ borderTopColor: colors.BORDER }}>
        <View className="flex-row justify-between items-center">
          <Text className="text-sm" style={{ color: colors.TEXT_SECONDARY }}>{t.monthly}</Text>
          <Text className="text-sm font-semibold" style={{ color: colors.TEXT }}>
            ${quotaStats.monthly.total.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}