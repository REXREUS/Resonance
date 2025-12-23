import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAchievements, useAchievementProgress } from '../stores/gamificationStore';
import { COLORS } from '../constants/theme';

/**
 * Achievements List Component
 * Displays all achievements with progress indicators
 */
export default function AchievementsList({ filter = 'all' }) {
  const achievements = useAchievements();
  const progress = useAchievementProgress();

  // Filter achievements based on type or status
  const filteredAchievements = React.useMemo(() => {
    switch (filter) {
      case 'unlocked':
        return achievements.filter(a => a.unlocked);
      case 'locked':
        return achievements.filter(a => !a.unlocked);
      case 'streak':
        return achievements.filter(a => a.type === 'streak');
      case 'performance':
        return achievements.filter(a => a.type === 'performance');
      case 'milestone':
        return achievements.filter(a => a.type === 'milestone');
      case 'special':
        return achievements.filter(a => a.type === 'special');
      default:
        return achievements;
    }
  }, [achievements, filter]);

  // Group achievements by type
  const groupedAchievements = React.useMemo(() => {
    const groups = {
      milestone: [],
      streak: [],
      performance: [],
      special: []
    };

    filteredAchievements.forEach(achievement => {
      if (groups[achievement.type]) {
        groups[achievement.type].push(achievement);
      }
    });

    return groups;
  }, [filteredAchievements]);

  const renderAchievement = (achievement) => {
    const progressPercentage = achievement.target > 0 
      ? Math.min(100, (achievement.current / achievement.target) * 100)
      : 0;

    return (
      <View 
        key={achievement.id}
        className={`rounded-lg p-4 mb-3 border ${
          achievement.unlocked 
            ? 'bg-cyber-yellow/10 border-cyber-yellow/30' 
            : 'bg-dark-card border-dark-border'
        }`}
      >
        <View className="flex-row items-start">
          {/* Badge Icon */}
          <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${
            achievement.unlocked ? 'bg-cyber-yellow/20' : 'bg-gray-600/20'
          }`}>
            <Text className="text-2xl">
              {achievement.unlocked ? achievement.badge_icon : '🔒'}
            </Text>
          </View>

          {/* Achievement Info */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className={`text-lg font-bold ${
                achievement.unlocked ? 'text-cyber-yellow' : 'text-white'
              }`}>
                {achievement.name}
              </Text>
              
              {achievement.unlocked && (
                <View className="bg-cyber-yellow rounded-full px-2 py-1">
                  <Text className="text-dark-bg text-xs font-bold">
                    +{achievement.points}
                  </Text>
                </View>
              )}
            </View>

            <Text className={`text-sm mb-2 ${
              achievement.unlocked ? 'text-gray-300' : 'text-gray-400'
            }`}>
              {achievement.description}
            </Text>

            {/* Progress Bar (for locked achievements) */}
            {!achievement.unlocked && achievement.target > 0 && (
              <View className="mb-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-gray-400 text-xs">
                    Progress: {achievement.current} / {achievement.target}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {Math.round(progressPercentage)}%
                  </Text>
                </View>
                
                <View className="bg-gray-600 rounded-full h-2">
                  <View 
                    className="bg-cyber-yellow rounded-full h-2"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </View>
              </View>
            )}

            {/* Achievement Type Badge */}
            <View className="flex-row items-center justify-between">
              <View className={`rounded-full px-2 py-1 ${
                achievement.unlocked 
                  ? 'bg-cyber-yellow/20' 
                  : 'bg-gray-600/20'
              }`}>
                <Text className={`text-xs font-semibold capitalize ${
                  achievement.unlocked ? 'text-cyber-yellow' : 'text-gray-400'
                }`}>
                  {achievement.type}
                </Text>
              </View>

              {achievement.unlocked && achievement.unlocked_at && (
                <Text className="text-gray-400 text-xs">
                  Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderGroup = (type, achievements) => {
    if (achievements.length === 0) return null;

    const typeNames = {
      milestone: 'Milestones',
      streak: 'Streaks',
      performance: 'Performance',
      special: 'Special'
    };

    return (
      <View key={type} className="mb-6">
        <Text className="text-white text-xl font-bold mb-3">
          {typeNames[type]}
        </Text>
        {achievements.map(renderAchievement)}
      </View>
    );
  };

  if (achievements.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-6xl mb-4">🏆</Text>
        <Text className="text-white text-xl font-bold text-center mb-2">
          No Achievements Yet
        </Text>
        <Text className="text-gray-400 text-center">
          Complete your first training session to start earning achievements!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 p-4">
      {/* Progress Summary */}
      <View className="bg-dark-card rounded-lg p-4 mb-6 border border-dark-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-lg font-bold">Achievement Progress</Text>
          <Text className="text-cyber-yellow text-lg font-bold">
            {progress.unlocked}/{progress.total}
          </Text>
        </View>
        
        <View className="bg-gray-600 rounded-full h-3 mb-2">
          <View 
            className="bg-cyber-yellow rounded-full h-3"
            style={{ width: `${progress.percentage}%` }}
          />
        </View>
        
        <View className="flex-row justify-between items-center">
          <Text className="text-gray-400 text-sm">
            {progress.percentage}% Complete
          </Text>
          <Text className="text-cyber-yellow text-sm font-semibold">
            {progress.totalPoints} points earned
          </Text>
        </View>
      </View>

      {/* Achievements by Type */}
      {filter === 'all' ? (
        Object.entries(groupedAchievements).map(([type, achievements]) =>
          renderGroup(type, achievements)
        )
      ) : (
        filteredAchievements.map(renderAchievement)
      )}
    </ScrollView>
  );
}