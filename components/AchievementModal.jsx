import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useAchievementModal } from '../stores/gamificationStore';
import { COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Achievement Modal Component
 * Displays newly unlocked achievements with celebration animation
 */
export default function AchievementModal() {
  const { show, achievements, close } = useAchievementModal();
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!show || achievements.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={show}
      transparent={true}
      animationType="fade"
      onRequestClose={close}
    >
      <View className="flex-1 bg-black/80 items-center justify-center p-6">
        <View 
          className="rounded-2xl p-6 border-2 max-w-sm w-full"
          style={{ maxWidth: screenWidth - 48, backgroundColor: colors.CARD, borderColor: colors.ACCENT }}
        >
          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-4xl mb-2">🏆</Text>
            <Text className="text-2xl font-bold text-center" style={{ color: colors.ACCENT }}>
              {achievements.length === 1 ? t.newAchievement : `${t.achievements} ${t.unlocked}!`}
            </Text>
          </View>

          {/* Achievement List */}
          <ScrollView className="max-h-80 mb-6">
            {achievements.map((achievement, index) => (
              <View 
                key={achievement.id}
                className="rounded-lg p-4 mb-3 border"
                style={{ backgroundColor: colors.BG, borderColor: colors.BORDER }}
              >
                <View className="flex-row items-center mb-2">
                  <Text className="text-3xl mr-3">{achievement.badge_icon}</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold" style={{ color: colors.TEXT }}>
                      {achievement.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.TEXT_SECONDARY }}>
                      {achievement.description}
                    </Text>
                  </View>
                </View>
                
                {/* Points */}
                <View className="flex-row items-center justify-between mt-2">
                  <View className="flex-row items-center">
                    <Text className="text-sm font-semibold" style={{ color: colors.ACCENT }}>
                      +{achievement.points} {t.points}
                    </Text>
                  </View>
                  
                  {/* Achievement Type Badge */}
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: colors.ACCENT + '20' }}>
                    <Text className="text-xs font-semibold capitalize" style={{ color: colors.ACCENT }}>
                      {achievement.type}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Total Points */}
          {achievements.length > 1 && (
            <View className="rounded-lg p-3 mb-4" style={{ backgroundColor: colors.ACCENT + '10' }}>
              <Text className="text-center font-bold" style={{ color: colors.ACCENT }}>
                Total: +{achievements.reduce((sum, a) => sum + a.points, 0)} {t.points}
              </Text>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity
            onPress={close}
            className="rounded-lg py-3 px-6"
            style={{ backgroundColor: colors.ACCENT }}
            activeOpacity={0.8}
          >
            <Text className="text-center font-bold text-lg" style={{ color: colors.BG }}>
              {t.continueSetup || 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}