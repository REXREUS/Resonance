import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { BackHandler } from 'react-native';

/**
 * Enhanced navigation hook for consistent navigation state management
 * Provides navigation history, transition states, and back button handling
 */
export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [navigationState, setNavigationState] = useState({
    currentRoute: pathname,
    previousRoute: null,
    navigationHistory: [pathname],
    isTransitioning: false,
    canGoBack: false,
  });

  // Update navigation state when pathname changes
  useEffect(() => {
    setNavigationState(prev => {
      const newHistory = [...prev.navigationHistory];
      
      // Only add to history if it's a different route
      if (pathname !== prev.currentRoute) {
        newHistory.push(pathname);
        
        // Keep history limited to last 10 routes
        if (newHistory.length > 10) {
          newHistory.shift();
        }
      }

      return {
        currentRoute: pathname,
        previousRoute: prev.currentRoute,
        navigationHistory: newHistory,
        isTransitioning: prev.currentRoute !== pathname,
        canGoBack: newHistory.length > 1,
      };
    });
  }, [pathname]);

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      if (navigationState.canGoBack) {
        handleGoBack();
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior (exit app)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigationState.canGoBack]);

  /**
   * Navigate to a specific route with optional parameters
   */
  const navigateTo = useCallback((route, params = {}) => {
    setNavigationState(prev => ({ ...prev, isTransitioning: true }));
    
    if (Object.keys(params).length > 0) {
      router.push({ pathname: route, params });
    } else {
      router.push(route);
    }
    
    // Reset transition state after animation
    setTimeout(() => {
      setNavigationState(prev => ({ ...prev, isTransitioning: false }));
    }, 300);
  }, [router]);

  /**
   * Navigate back to previous route
   */
  const handleGoBack = useCallback(() => {
    if (navigationState.canGoBack) {
      setNavigationState(prev => ({ ...prev, isTransitioning: true }));
      router.back();
      
      setTimeout(() => {
        setNavigationState(prev => ({ ...prev, isTransitioning: false }));
      }, 300);
    }
  }, [router, navigationState.canGoBack]);

  /**
   * Navigate to dashboard (home)
   */
  const navigateToHome = useCallback(() => {
    navigateTo('/(tabs)');
  }, [navigateTo]);

  /**
   * Navigate to session setup
   */
  const navigateToSessionSetup = useCallback((config = {}) => {
    navigateTo('/session-setup', config);
  }, [navigateTo]);

  /**
   * Navigate to active simulation
   */
  const navigateToSimulation = useCallback((sessionConfig = {}) => {
    navigateTo('/simulation', sessionConfig);
  }, [navigateTo]);

  /**
   * Navigate to session report
   */
  const navigateToReport = useCallback((sessionId) => {
    navigateTo('/report', { sessionId });
  }, [navigateTo]);

  /**
   * Navigate to voice lab
   */
  const navigateToVoiceLab = useCallback(() => {
    navigateTo('/voice-lab');
  }, [navigateTo]);

  /**
   * Navigate to settings
   */
  const navigateToSettings = useCallback(() => {
    navigateTo('/settings');
  }, [navigateTo]);

  /**
   * Check if currently on a specific route
   */
  const isCurrentRoute = useCallback((route) => {
    return navigationState.currentRoute === route || 
           navigationState.currentRoute.endsWith(route);
  }, [navigationState.currentRoute]);

  /**
   * Check if navigating from a specific route
   */
  const isComingFrom = useCallback((route) => {
    return navigationState.previousRoute === route ||
           navigationState.previousRoute?.endsWith(route);
  }, [navigationState.previousRoute]);

  /**
   * Get navigation breadcrumb for current route
   */
  const getBreadcrumb = useCallback(() => {
    const routeNames = {
      '/': 'Home',
      '/(tabs)': 'Dashboard',
      '/(tabs)/index': 'Dashboard',
      '/(tabs)/menu': 'Menu',
      '/(tabs)/history': 'History',
      '/(tabs)/stats': 'Stats',
      '/(tabs)/profile': 'Profile',
      '/session-setup': 'Session Setup',
      '/simulation': 'Active Session',
      '/stress-mode': 'Stress Test',
      '/report': 'Session Report',
      '/voice-lab': 'Voice Lab',
      '/settings': 'Settings',
      '/splash': 'Loading',
      '/onboarding': 'Welcome',
    };

    return routeNames[navigationState.currentRoute] || 'Unknown';
  }, [navigationState.currentRoute]);

  return {
    // State
    navigationState,
    currentRoute: navigationState.currentRoute,
    previousRoute: navigationState.previousRoute,
    isTransitioning: navigationState.isTransitioning,
    canGoBack: navigationState.canGoBack,
    
    // Navigation methods
    navigateTo,
    goBack: handleGoBack,
    navigateToHome,
    navigateToSessionSetup,
    navigateToSimulation,
    navigateToReport,
    navigateToVoiceLab,
    navigateToSettings,
    
    // Utility methods
    isCurrentRoute,
    isComingFrom,
    getBreadcrumb,
  };
}