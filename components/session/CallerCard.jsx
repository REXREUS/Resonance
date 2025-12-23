import React from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle, Target } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * Caller Card component for Stress Mode
 * @param {string} name - Caller name
 * @param {string} waitTime - Wait time string (e.g., "04:12")
 * @param {string} mood - 'hostile' | 'neutral' | 'friendly'
 * @param {string} issue - Issue description
 * @param {string} missionGoal - Mission goal text
 */
export default function CallerCard({
  name,
  avatar,
  waitTime,
  mood = 'neutral',
  issue,
  missionGoal,
  style,
}) {
  const getMoodConfig = () => {
    const configs = {
      hostile: { variant: 'hostile', label: 'HOSTILE' },
      neutral: { variant: 'warning', label: 'NEUTRAL' },
      friendly: { variant: 'success', label: 'FRIENDLY' },
      frustrated: { variant: 'error', label: 'FRUSTRATED' },
    };
    return configs[mood] || configs.neutral;
  };

  const moodConfig = getMoodConfig();

  return (
    <Card variant="cream" padding="lg" style={style}>
      {/* Avatar and Mood */}
      <View style={{ alignItems: 'center', marginBottom: SPACING.MD }}>
        <Avatar
          source={avatar}
          name={name}
          size="xl"
          style={{ marginBottom: SPACING.SM }}
        />
        <Badge variant={moodConfig.variant} size="sm">
          {moodConfig.label}
        </Badge>
      </View>

      {/* Caller Info */}
      <View style={{ alignItems: 'center', marginBottom: SPACING.MD }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: COLORS.LIGHT_TEXT,
            marginBottom: 4,
          }}
        >
          Caller: {name}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: COLORS.LIGHT_TEXT_SECONDARY,
          }}
        >
          Wait time: {waitTime}
        </Text>
      </View>

      {/* Issue Section */}
      {issue && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: SPACING.MD,
            paddingVertical: SPACING.SM,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#FFF3E0',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: SPACING.SM,
            }}
          >
            <AlertTriangle size={16} color="#FF9800" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#FF9800',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              ISSUE
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.LIGHT_TEXT,
                lineHeight: 20,
              }}
            >
              {issue}
            </Text>
          </View>
        </View>
      )}

      {/* Mission Goal Section */}
      {missionGoal && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#FCE4EC',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: SPACING.SM,
            }}
          >
            <Target size={16} color="#E91E63" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#E91E63',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              MISSION GOAL
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.LIGHT_TEXT,
                lineHeight: 20,
              }}
            >
              {missionGoal}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}
