import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../services/databaseService';

/**
 * Custom hook for managing session history functionality
 */
export const useSessionHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  /**
   * Calculate date range boundaries
   */
  const getDateRangeBounds = useCallback((range) => {
    if (!range) return { startDate: null, endDate: null };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case 'today':
        return {
          startDate: today.getTime(),
          endDate: today.getTime() + 24 * 60 * 60 * 1000 - 1
        };
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return {
          startDate: weekStart.getTime(),
          endDate: null
        };
      
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: monthStart.getTime(),
          endDate: null
        };
      
      case '3months':
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        return {
          startDate: threeMonthsAgo.getTime(),
          endDate: null
        };
      
      default:
        return { startDate: null, endDate: null };
    }
  }, []);

  /**
   * Load sessions with current filters
   */
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRangeBounds(dateRange);
      
      const results = await databaseService.searchSessions(
        searchText || null,
        selectedCategory,
        startDate,
        endDate
      );

      setSessions(results);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [searchText, selectedCategory, dateRange, getDateRangeBounds]);

  /**
   * Load all sessions (no filters)
   */
  const loadAllSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const results = await databaseService.getSessions();
      setSessions(results);
    } catch (err) {
      console.error('Error loading all sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Retry a session by loading its configuration
   */
  const retrySession = useCallback(async (sessionId) => {
    try {
      const session = await databaseService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Get associated context files
      const allContextFiles = await databaseService.getContextFiles();
      const sessionContextFiles = allContextFiles.filter(file => 
        // Assuming we store context file IDs in session metadata
        session.contextFileIds?.includes(file.id)
      );

      return {
        scenario: session.scenario,
        mode: session.mode,
        queueLength: session.queueLength || 1,
        interCallDelay: session.interCallDelay || 0,
        chaosEngineEnabled: session.chaosEngineEnabled || false,
        contextFiles: sessionContextFiles,
        voiceId: session.voiceId,
        language: session.language || 'id',
        // Preserve any other configuration
        originalSessionId: sessionId
      };
    } catch (err) {
      console.error('Error retrying session:', err);
      throw new Error('Failed to load session configuration');
    }
  }, []);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessionId) => {
    try {
      await databaseService.deleteSession(sessionId);
      // Reload sessions after deletion
      await loadSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      throw new Error('Failed to delete session');
    }
  }, [loadSessions]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setSearchText('');
    setSelectedCategory(null);
    setDateRange(null);
  }, []);

  /**
   * Update search text
   */
  const updateSearchText = useCallback((text) => {
    setSearchText(text);
  }, []);

  /**
   * Update selected category
   */
  const updateCategory = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  /**
   * Update date range
   */
  const updateDateRange = useCallback((range) => {
    setDateRange(range);
  }, []);

  // Load sessions when filters change
  useEffect(() => {
    if (searchText || selectedCategory || dateRange) {
      loadSessions();
    } else {
      loadAllSessions();
    }
  }, [searchText, selectedCategory, dateRange, loadSessions, loadAllSessions]);

  // Initial load
  useEffect(() => {
    loadAllSessions();
  }, []);

  return {
    // Data
    sessions,
    loading,
    error,
    
    // Filters
    searchText,
    selectedCategory,
    dateRange,
    
    // Filter actions
    updateSearchText,
    updateCategory,
    updateDateRange,
    clearFilters,
    
    // Session actions
    retrySession,
    deleteSession,
    refreshSessions: loadSessions,
    
    // Computed values
    hasActiveFilters: !!(searchText || selectedCategory || dateRange),
    sessionCount: sessions.length
  };
};

export default useSessionHistory;