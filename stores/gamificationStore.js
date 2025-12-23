import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { achievementService } from '../services/achievementService';
import { quotaService } from '../services/quotaService';
import { databaseService } from '../services/databaseService';

/**
 * Zustand store for gamification and achievement management
 * Manages achievements, streaks, progress tracking, and quota monitoring
 */
export const useGamificationStore = create(
  subscribeWithSelector((set, get) => ({
    // Achievement state
    achievements: [],
    unlockedAchievements: [],
    recentAchievements: [],
    achievementProgress: {
      unlocked: 0,
      total: 0,
      percentage: 0,
      totalPoints: 0
    },
    
    // Streak and progress state
    currentStreak: 0,
    longestStreak: 0,
    totalSessions: 0,
    averageScore: null,
    
    // Quota state
    quotaStatistics: {
      daily: {
        total: 0,
        elevenlabs: 0,
        gemini: 0,
        percentage: 0,
        remaining: 0,
        limit: 50.0
      },
      monthly: {
        total: 0
      },
      thresholds: {
        warning: 40.0,
        critical: 47.5,
        isWarning: false,
        isCritical: false,
        isExceeded: false
      }
    },
    usageHistory: [],
    
    // UI state
    showAchievementModal: false,
    newAchievements: [],
    isLoading: false,
    
    // Actions
    
    /**
     * Initialize gamification system
     */
    initialize: async () => {
      try {
        set({ isLoading: true });
        
        // Initialize services
        await databaseService.initialize();
        await achievementService.initialize();
        await quotaService.initialize();
        
        // Load initial data
        await get().loadAchievements();
        await get().loadQuotaStatistics();
        await get().loadProgressData();
        
        console.log('Gamification system initialized');
      } catch (error) {
        console.error('Error initializing gamification system:', error);
      } finally {
        set({ isLoading: false });
      }
    },
    
    /**
     * Load achievements data
     */
    loadAchievements: async () => {
      try {
        const achievements = achievementService.getAllAchievements();
        const unlockedAchievements = achievementService.getUnlockedAchievements();
        const recentAchievements = achievementService.getRecentAchievements();
        const achievementProgress = achievementService.getAchievementProgress();
        
        set({
          achievements,
          unlockedAchievements,
          recentAchievements,
          achievementProgress
        });
      } catch (error) {
        console.error('Error loading achievements:', error);
      }
    },
    
    /**
     * Load quota statistics
     */
    loadQuotaStatistics: async () => {
      try {
        const quotaStatistics = await quotaService.getUsageStatistics();
        const usageHistory = await quotaService.getUsageHistory(7);
        
        set({ quotaStatistics, usageHistory });
      } catch (error) {
        console.error('Error loading quota statistics:', error);
      }
    },
    
    /**
     * Load progress data
     */
    loadProgressData: async () => {
      try {
        // This would typically come from session data
        // For now, we'll calculate from achievements
        const achievements = achievementService.getAllAchievements();
        
        const streakAchievements = achievements.filter(a => a.type === 'streak');
        const currentStreak = Math.max(...streakAchievements.map(a => a.current), 0);
        const longestStreak = Math.max(...streakAchievements.filter(a => a.unlocked).map(a => a.target), 0);
        
        const sessionAchievements = achievements.filter(a => a.type === 'milestone' && a.id.includes('sessions'));
        const totalSessions = Math.max(...sessionAchievements.map(a => a.current), 0);
        
        const performanceAchievements = achievements.filter(a => a.type === 'performance');
        const highestScore = Math.max(...performanceAchievements.map(a => a.current), 0);
        const averageScore = highestScore > 0 ? highestScore : null;
        
        set({
          currentStreak,
          longestStreak,
          totalSessions,
          averageScore
        });
      } catch (error) {
        console.error('Error loading progress data:', error);
      }
    },
    
    /**
     * Check achievements after session completion
     */
    checkSessionAchievements: async (sessionData) => {
      try {
        const newAchievements = await achievementService.checkSessionAchievements(sessionData);
        
        if (newAchievements.length > 0) {
          set({ 
            newAchievements,
            showAchievementModal: true 
          });
          
          // Reload achievements data
          await get().loadAchievements();
          await get().loadProgressData();
        }
        
        return newAchievements;
      } catch (error) {
        console.error('Error checking session achievements:', error);
        return [];
      }
    },
    
    /**
     * Record API usage
     */
    recordApiUsage: async (service, cost, sessionId = null, operationType = null) => {
      try {
        await quotaService.recordUsage(service, cost, sessionId, operationType);
        
        // Reload quota statistics
        await get().loadQuotaStatistics();
        
        return true;
      } catch (error) {
        console.error('Error recording API usage:', error);
        return false;
      }
    },
    
    /**
     * Check if operation can be afforded
     */
    canAffordOperation: async (estimatedCost) => {
      try {
        return await quotaService.canAfford(estimatedCost);
      } catch (error) {
        console.error('Error checking affordability:', error);
        return false;
      }
    },
    
    /**
     * Estimate operation cost
     */
    estimateOperationCost: (service, operation, parameters = {}) => {
      return quotaService.estimateCost(service, operation, parameters);
    },
    
    /**
     * Get achievement by ID
     */
    getAchievement: (achievementId) => {
      const state = get();
      return state.achievements.find(a => a.id === achievementId);
    },
    
    /**
     * Get achievements by type
     */
    getAchievementsByType: (type) => {
      const state = get();
      return state.achievements.filter(a => a.type === type);
    },
    
    /**
     * Get progress for specific achievement type
     */
    getTypeProgress: (type) => {
      const state = get();
      const typeAchievements = state.achievements.filter(a => a.type === type);
      const unlockedCount = typeAchievements.filter(a => a.unlocked).length;
      
      return {
        unlocked: unlockedCount,
        total: typeAchievements.length,
        percentage: typeAchievements.length > 0 ? Math.round((unlockedCount / typeAchievements.length) * 100) : 0
      };
    },
    
    /**
     * Get quota status
     */
    getQuotaStatus: () => {
      const state = get();
      const { thresholds } = state.quotaStatistics;
      
      if (thresholds.isExceeded) return 'exceeded';
      if (thresholds.isCritical) return 'critical';
      if (thresholds.isWarning) return 'warning';
      return 'normal';
    },
    
    /**
     * Get motivational message based on progress
     */
    getMotivationalMessage: () => {
      const state = get();
      const { achievementProgress, currentStreak } = state;
      
      if (achievementProgress.percentage >= 80) {
        return "You're a communication master! Keep up the excellent work!";
      } else if (achievementProgress.percentage >= 60) {
        return "Great progress! You're becoming a skilled communicator.";
      } else if (currentStreak >= 7) {
        return "Impressive streak! Consistency is key to mastery.";
      } else if (currentStreak >= 3) {
        return "Nice streak going! Keep the momentum up.";
      } else if (achievementProgress.unlocked > 0) {
        return "Good start! Every achievement brings you closer to mastery.";
      } else {
        return "Welcome to your communication journey! Complete your first session to earn achievements.";
      }
    },
    
    /**
     * Close achievement modal
     */
    closeAchievementModal: () => {
      set({ 
        showAchievementModal: false,
        newAchievements: []
      });
    },
    
    /**
     * Update daily limit
     */
    updateDailyLimit: async (newLimit) => {
      try {
        await quotaService.updateDailyLimit(newLimit);
        await get().loadQuotaStatistics();
        return true;
      } catch (error) {
        console.error('Error updating daily limit:', error);
        return false;
      }
    },
    
    /**
     * Reset achievements (for testing)
     */
    resetAchievements: async () => {
      try {
        await achievementService.resetAllAchievements();
        await get().loadAchievements();
        await get().loadProgressData();
        return true;
      } catch (error) {
        console.error('Error resetting achievements:', error);
        return false;
      }
    },
    
    /**
     * Reset daily usage (for testing)
     */
    resetDailyUsage: async () => {
      try {
        await quotaService.resetDailyUsage();
        await get().loadQuotaStatistics();
        return true;
      } catch (error) {
        console.error('Error resetting daily usage:', error);
        return false;
      }
    },
    
    /**
     * Refresh all data
     */
    refresh: async () => {
      try {
        set({ isLoading: true });
        
        await get().loadAchievements();
        await get().loadQuotaStatistics();
        await get().loadProgressData();
        
        return true;
      } catch (error) {
        console.error('Error refreshing gamification data:', error);
        return false;
      } finally {
        set({ isLoading: false });
      }
    }
  }))
);

/**
 * Selector hooks for specific parts of the gamification state
 */

// Achievement selectors
export const useAchievements = () => useGamificationStore((state) => state.achievements);
export const useUnlockedAchievements = () => useGamificationStore((state) => state.unlockedAchievements);
export const useAchievementProgress = () => useGamificationStore((state) => state.achievementProgress);
export const useRecentAchievements = () => useGamificationStore((state) => state.recentAchievements);

// Progress selectors
export const useCurrentStreak = () => useGamificationStore((state) => state.currentStreak);
export const useTotalSessions = () => useGamificationStore((state) => state.totalSessions);
export const useAverageScore = () => useGamificationStore((state) => state.averageScore);

// Quota selectors
export const useQuotaStatistics = () => useGamificationStore((state) => state.quotaStatistics);
export const useUsageHistory = () => useGamificationStore((state) => state.usageHistory);
export const useQuotaStatus = () => useGamificationStore((state) => state.getQuotaStatus());

// UI selectors
export const useAchievementModal = () => useGamificationStore((state) => ({
  show: state.showAchievementModal,
  achievements: state.newAchievements,
  close: state.closeAchievementModal
}));

// Action selectors
export const useGamificationActions = () => useGamificationStore((state) => ({
  initialize: state.initialize,
  checkSessionAchievements: state.checkSessionAchievements,
  recordApiUsage: state.recordApiUsage,
  canAffordOperation: state.canAffordOperation,
  estimateOperationCost: state.estimateOperationCost,
  updateDailyLimit: state.updateDailyLimit,
  refresh: state.refresh
}));

/**
 * Custom hook for complete gamification management
 */
export const useGamification = () => {
  const achievements = useAchievements();
  const achievementProgress = useAchievementProgress();
  const currentStreak = useCurrentStreak();
  const quotaStatistics = useQuotaStatistics();
  const actions = useGamificationActions();
  
  return {
    // State
    achievements,
    achievementProgress,
    currentStreak,
    quotaStatistics,
    
    // Computed values
    hasAchievements: achievements.length > 0,
    isQuotaHealthy: quotaStatistics.thresholds.isWarning === false,
    progressPercentage: achievementProgress.percentage,
    
    // Actions
    ...actions
  };
};

export default useGamificationStore;