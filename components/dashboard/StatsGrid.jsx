import React from 'react';
import { View, Text } from 'react-native';
import { Clock, Target, Flame, DollarSign } from 'lucide-react-native';
import Card from '../ui/Card';
import { SPACING } from '../../constants/theme';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';

/**
 * Stats Grid component for Dashboard
 * @param {object} stats - Stats data object
 */
export default function StatsGrid({
  flightHours = 0,
  avgScore = 0,
  streak = 0,
  quota = 0,
  flightHoursTrend,
  avgScoreTrend,
  style,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[{ gap: SPACING.SM }, style]}>
      {/* Top Row */}
      <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
        <StatCard
          icon={<Clock size={16} color={colors.TEXT_SECONDARY} />}
          label={t.flightHours || 'Flight Hours'}
          value={flightHours}
          unit="h"
          trend={flightHoursTrend}
          style={{ flex: 1 }}
          colors={colors}
        />
        <StatCard
          icon={<Target size={16} color={colors.TEXT_SECONDARY} />}
          label={t.averageScore || 'Avg Score'}
          value={avgScore}
          trend={avgScoreTrend}
          style={{ flex: 1 }}
          colors={colors}
        />
      </View>

      {/* Bottom Row */}
      <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
        <StreakCard streak={streak} style={{ flex: 1 }} t={t} />
        <QuotaCard quota={quota} style={{ flex: 1 }} colors={colors} t={t} />
      </View>
    </View>
  );
}

/**
 * Individual Stat Card
 */
function StatCard({ icon, label, value, unit, trend, style, colors }) {
  return (
    <Card variant="default" padding="md" style={[{ backgroundColor: colors.CARD }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS }}>
        {icon}
        {trend && (
          <View
            style={{
              marginLeft: 'auto',
              backgroundColor: trend.startsWith('+') ? '#1B5E20' : '#B71C1C',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF' }}>
              {trend}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{
          fontSize: 10,
          color: colors.TEXT_SECONDARY,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.TEXT }}>
          {value}
        </Text>
        {unit && (
          <Text style={{ fontSize: 14, color: colors.TEXT_SECONDARY, marginLeft: 2 }}>
            {unit}
          </Text>
        )}
      </View>
    </Card>
  );
}

/**
 * Streak Card with highlight
 */
function StreakCard({ streak, style, t }) {
  return (
    <Card
      variant="default"
      padding="md"
      style={[{ backgroundColor: '#FFD700' }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS }}>
        <Flame size={16} color="#000000" />
      </View>
      <Text
        style={{
          fontSize: 10,
          color: 'rgba(0,0,0,0.6)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {t.streak || 'Streak'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#000000' }}>
          {streak}
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)', marginLeft: 4 }}>
          {t.days || 'Days'}
        </Text>
      </View>
    </Card>
  );
}

/**
 * Quota Card - Shows daily budget usage percentage
 */
function QuotaCard({ quota, style, colors, t }) {
  const getQuotaColor = () => {
    if (quota >= 90) return '#ef4444';
    if (quota >= 70) return '#f97316';
    if (quota >= 50) return '#eab308';
    return '#22c55e';
  };

  return (
    <Card variant="default" padding="md" style={[{ backgroundColor: colors.CARD }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS }}>
        <DollarSign size={16} color={colors.TEXT_SECONDARY} />
        <View
          style={{
            marginLeft: 'auto',
            backgroundColor: getQuotaColor() + '20',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '600', color: getQuotaColor() }}>
            {t.daily || 'Daily'}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 10,
          color: colors.TEXT_SECONDARY,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {t.quotaUsage || 'Quota'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.TEXT }}>
          {quota}
        </Text>
        <Text style={{ fontSize: 14, color: colors.TEXT_SECONDARY, marginLeft: 2 }}>
          %
        </Text>
      </View>
    </Card>
  );
}
