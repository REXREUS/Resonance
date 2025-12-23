import { databaseService } from './databaseService';

/**
 * Achievement Service for managing gamification elements
 * Handles achievement tracking, streaks, and performance badges
 */
class AchievementService {
  constructor() {
    this.achievements = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize achievement service
   */
  async initialize() {
    try {
      // Ensure database is initialized first
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      
      await this.loadAchievements();
      this.isInitialized = true;
      console.log('Achievement service initialized successfully');
      return true;
    } catch (error) {
      console.error('Achievement service initialization failed:', error);
      // Don't throw - allow app to continue with empty achievements
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Load all achievements from database
   */
  async loadAchievements() {
    try {
      // Ensure database is initialized
      if (!databaseService.isInitialized) {
        console.warn('Database not initialized, skipping achievement load');
        return;
      }
      
      const achievements = await databaseService.getAllAchievements();
      this.achievements.clear();
      
      achievements.forEach(achievement => {
        this.achievements.set(achievement.id, achievement);
      });
      
      // Initialize default achievements if none exist
      if (achievements.length === 0) {
        await this.initializeDefaultAchievements();
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
      // Don't throw - allow app to continue
    }
  }

  /**
   * Initialize default achievements
   */
  async initializeDefaultAchievements() {
    const defaultAchievements = [
      {
        id: 'first_session',
        name: 'First Steps',
        description: 'Complete your first training session',
        type: 'milestone',
        target: 1,
        current: 0,
        unlocked: false,
        badge_icon: '🎯',
        points: 10
      },
      {
        id: 'streak_3',
        name: 'Getting Started',
        description: 'Maintain a 3-day training streak',
        type: 'streak',
        target: 3,
        current: 0,
        unlocked: false,
        badge_icon: '🔥',
        points: 25
      },
      {
        id: 'streak_7',
        name: 'Week Warrior',
        description: 'Maintain a 7-day training streak',
        type: 'streak',
        target: 7,
        current: 0,
        unlocked: false,
        badge_icon: '⚡',
        points: 50
      },
      {
        id: 'streak_30',
        name: 'Monthly Master',
        description: 'Maintain a 30-day training streak',
        type: 'streak',
        target: 30,
        current: 0,
        unlocked: false,
        badge_icon: '👑',
        points: 200
      },
      {
        id: 'score_80',
        name: 'Excellence',
        description: 'Achieve a score of 80 or higher',
        type: 'performance',
        target: 80,
        current: 0,
        unlocked: false,
        badge_icon: '⭐',
        points: 30
      },
      {
        id: 'score_90',
        name: 'Near Perfect',
        description: 'Achieve a score of 90 or higher',
        type: 'performance',
        target: 90,
        current: 0,
        unlocked: false,
        badge_icon: '💎',
        points: 75
      },
      {
        id: 'score_95',
        name: 'Perfection',
        description: 'Achieve a score of 95 or higher',
        type: 'performance',
        target: 95,
        current: 0,
        unlocked: false,
        badge_icon: '🏆',
        points: 150
      },
      {
        id: 'sessions_10',
        name: 'Dedicated Learner',
        description: 'Complete 10 training sessions',
        type: 'milestone',
        target: 10,
        current: 0,
        unlocked: false,
        badge_icon: '📚',
        points: 40
      },
      {
        id: 'sessions_50',
        name: 'Experienced Trainer',
        description: 'Complete 50 training sessions',
        type: 'milestone',
        target: 50,
        current: 0,
        unlocked: false,
        badge_icon: '🎓',
        points: 100
      },
      {
        id: 'sessions_100',
        name: 'Master Communicator',
        description: 'Complete 100 training sessions',
        type: 'milestone',
        target: 100,
        current: 0,
        unlocked: false,
        badge_icon: '🌟',
        points: 250
      },
      {
        id: 'stress_survivor',
        name: 'Stress Survivor',
        description: 'Complete a stress test with 5+ callers',
        type: 'special',
        target: 1,
        current: 0,
        unlocked: false,
        badge_icon: '💪',
        points: 60
      },
      {
        id: 'chaos_master',
        name: 'Chaos Master',
        description: 'Complete a session with all chaos effects enabled',
        type: 'special',
        target: 1,
        current: 0,
        unlocked: false,
        badge_icon: '🌪️',
        points: 80
      }
    ];

    for (const achievement of defaultAchievements) {
      await databaseService.createAchievement(achievement);
      this.achievements.set(achievement.id, achievement);
    }
  }

  /**
   * Check and update achievements based on session completion
   */
  async checkSessionAchievements(sessionData) {
    this.ensureInitialized();
    
    const unlockedAchievements = [];
    
    try {
      // Get current session count (including the current session being completed)
      const sessions = await databaseService.getSessions();
      const completedSessions = sessions.filter(s => s.completed === 1);
      const sessionCount = completedSessions.length + 1; // +1 for the current session
      
      // Check milestone achievements
      await this.checkMilestoneAchievement('first_session', sessionCount, unlockedAchievements);
      await this.checkMilestoneAchievement('sessions_10', sessionCount, unlockedAchievements);
      await this.checkMilestoneAchievement('sessions_50', sessionCount, unlockedAchievements);
      await this.checkMilestoneAchievement('sessions_100', sessionCount, unlockedAchievements);
      
      // Check performance achievements
      if (sessionData.score) {
        await this.checkPerformanceAchievement('score_80', sessionData.score, unlockedAchievements);
        await this.checkPerformanceAchievement('score_90', sessionData.score, unlockedAchievements);
        await this.checkPerformanceAchievement('score_95', sessionData.score, unlockedAchievements);
      }
      
      // Check streak achievements (include current session in streak calculation)
      const sessionsWithCurrent = [...completedSessions, { timestamp: sessionData.timestamp || Date.now(), completed: 1 }];
      const currentStreak = this.calculateStreak(sessionsWithCurrent);
      await this.checkStreakAchievement('streak_3', currentStreak, unlockedAchievements);
      await this.checkStreakAchievement('streak_7', currentStreak, unlockedAchievements);
      await this.checkStreakAchievement('streak_30', currentStreak, unlockedAchievements);
      
      // Check special achievements
      if (sessionData.mode === 'stress' && sessionData.queueLength >= 5) {
        await this.checkSpecialAchievement('stress_survivor', unlockedAchievements);
      }
      
      if (sessionData.chaosEffectsEnabled && sessionData.chaosEffectsEnabled.length >= 3) {
        await this.checkSpecialAchievement('chaos_master', unlockedAchievements);
      }
      
      return unlockedAchievements;
    } catch (error) {
      console.error('Error checking session achievements:', error);
      return [];
    }
  }

  /**
   * Check milestone achievement
   */
  async checkMilestoneAchievement(achievementId, currentValue, unlockedAchievements) {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;
    
    // Update progress to current value
    achievement.current = currentValue;
    
    if (currentValue >= achievement.target) {
      await this.unlockAchievement(achievementId);
      unlockedAchievements.push(achievement);
    } else {
      await databaseService.updateAchievement(achievementId, { current: currentValue });
    }
  }

  /**
   * Check performance achievement
   */
  async checkPerformanceAchievement(achievementId, score, unlockedAchievements) {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;
    
    // Update current to highest score achieved
    if (score > achievement.current) {
      achievement.current = score;
    }
    
    if (achievement.current >= achievement.target) {
      await this.unlockAchievement(achievementId);
      unlockedAchievements.push(achievement);
    } else {
      await databaseService.updateAchievement(achievementId, { current: achievement.current });
    }
  }

  /**
   * Check streak achievement
   */
  async checkStreakAchievement(achievementId, currentStreak, unlockedAchievements) {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;
    
    // Update progress to current streak
    achievement.current = currentStreak;
    
    if (currentStreak >= achievement.target) {
      await this.unlockAchievement(achievementId);
      unlockedAchievements.push(achievement);
    } else {
      await databaseService.updateAchievement(achievementId, { current: currentStreak });
    }
  }

  /**
   * Check special achievement
   */
  async checkSpecialAchievement(achievementId, unlockedAchievements) {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;
    
    await this.unlockAchievement(achievementId);
    unlockedAchievements.push(achievement);
  }

  /**
   * Unlock achievement
   */
  async unlockAchievement(achievementId) {
    const achievement = this.achievements.get(achievementId);
    if (!achievement || achievement.unlocked) return;
    
    achievement.unlocked = true;
    achievement.unlocked_at = Date.now();
    
    await databaseService.updateAchievement(achievementId, {
      unlocked: true,
      unlocked_at: achievement.unlocked_at
    });
    
    console.log(`Achievement unlocked: ${achievement.name}`);
  }

  /**
   * Calculate current streak
   */
  calculateStreak(sessions) {
    if (sessions.length === 0) return 0;
    
    // Sort sessions by timestamp (newest first)
    const sortedSessions = sessions.sort((a, b) => b.timestamp - a.timestamp);
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const session of sortedSessions) {
      const sessionDate = new Date(session.timestamp);
      sessionDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
      } else if (daysDiff > streak) {
        break;
      }
    }
    
    return streak;
  }

  /**
   * Get all achievements
   */
  getAllAchievements() {
    if (!this.ensureInitialized()) return [];
    return Array.from(this.achievements.values());
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements() {
    if (!this.ensureInitialized()) return [];
    return Array.from(this.achievements.values()).filter(a => a.unlocked);
  }

  /**
   * Get achievement progress
   */
  getAchievementProgress() {
    if (!this.ensureInitialized()) {
      return { unlocked: 0, total: 0, percentage: 0, totalPoints: 0 };
    }
    const achievements = Array.from(this.achievements.values());
    const unlocked = achievements.filter(a => a.unlocked).length;
    const total = achievements.length;
    const totalPoints = achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0);
    
    return {
      unlocked,
      total,
      percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
      totalPoints
    };
  }

  /**
   * Get recent achievements (last 7 days)
   */
  getRecentAchievements() {
    if (!this.ensureInitialized()) return [];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    return Array.from(this.achievements.values())
      .filter(a => a.unlocked && a.unlocked_at && a.unlocked_at > sevenDaysAgo)
      .sort((a, b) => b.unlocked_at - a.unlocked_at);
  }

  /**
   * Get achievement by ID
   */
  getAchievement(achievementId) {
    if (!this.ensureInitialized()) return null;
    return this.achievements.get(achievementId);
  }

  /**
   * Get achievements by type
   */
  getAchievementsByType(type) {
    if (!this.ensureInitialized()) return [];
    return Array.from(this.achievements.values()).filter(a => a.type === type);
  }

  /**
   * Reset all achievements (for testing)
   */
  async resetAllAchievements() {
    this.ensureInitialized();
    
    for (const achievement of this.achievements.values()) {
      achievement.unlocked = false;
      achievement.current = 0;
      achievement.unlocked_at = null;
      
      await databaseService.updateAchievement(achievement.id, {
        unlocked: false,
        current: 0,
        unlocked_at: null
      });
    }
    
    console.log('All achievements reset');
  }

  /**
   * Ensure service is initialized
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      // Return empty data instead of throwing
      console.warn('Achievement service not initialized yet');
      return false;
    }
    return true;
  }
}

// Export singleton instance
export const achievementService = new AchievementService();
export default achievementService;