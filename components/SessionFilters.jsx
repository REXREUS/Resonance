import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import useTranslation from '../hooks/useTranslation';

const Search = LucideIcons.Search;
const X = LucideIcons.X;
const ChevronDown = LucideIcons.ChevronDown;
const Calendar = LucideIcons.Calendar;
const FilterX = LucideIcons.FilterX;

/**
 * SessionFilters component for search and filtering functionality
 */
export const SessionFilters = ({ 
  searchText, 
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  dateRange,
  onDateRangeChange,
  onClearFilters
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  const categories = [
    { label: t.allCategories, value: null },
    { label: t.crisisNegotiation, value: 'Crisis Negotiation' },
    { label: t.customerComplaint, value: 'Customer Service' }, 
    { label: t.salesObjection, value: 'Sales Call' },
    { label: t.performanceReview, value: 'Team Meeting' }
  ];

  const dateRanges = [
    { label: t.allTime, value: null },
    { label: t.today, value: 'today' },
    { label: t.thisWeek, value: 'week' },
    { label: t.thisMonth, value: 'month' },
    { label: t.lastMonth, value: '3months' }
  ];

  const hasActiveFilters = searchText || 
    selectedCategory || 
    dateRange;

  return (
    <View className="rounded-lg p-4 mb-4 border" style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}>
      {/* Search Input */}
      <View className="flex-row items-center rounded-lg px-3 py-2 mb-3 border" style={{ backgroundColor: colors.BG, borderColor: colors.BORDER }}>
        <Search size={20} color={colors.TEXT_SECONDARY} />
        <TextInput
          value={searchText}
          onChangeText={onSearchChange}
          placeholder={t.searchSessions}
          placeholderTextColor={colors.TEXT_SECONDARY}
          className="flex-1 ml-2"
          style={{ color: colors.TEXT }}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <X size={20} color={colors.TEXT_SECONDARY} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Buttons */}
      <View className="flex-row space-x-2 mb-3">
        {/* Category Filter */}
        <TouchableOpacity
          onPress={() => setShowCategoryModal(true)}
          className="flex-1 flex-row items-center justify-between rounded-lg px-3 py-2 border"
          style={{ backgroundColor: colors.BG, borderColor: colors.BORDER }}
        >
          <Text className="text-sm" style={{ color: colors.TEXT }}>
            {categories.find(c => c.value === selectedCategory)?.label || t.allCategories}
          </Text>
          <ChevronDown size={16} color={colors.TEXT_SECONDARY} />
        </TouchableOpacity>

        {/* Date Range Filter */}
        <TouchableOpacity
          onPress={() => setShowDateModal(true)}
          className="flex-1 flex-row items-center justify-between rounded-lg px-3 py-2 border"
          style={{ backgroundColor: colors.BG, borderColor: colors.BORDER }}
        >
          <Text className="text-sm" style={{ color: colors.TEXT }}>
            {dateRanges.find(d => d.value === dateRange)?.label || t.allTime}
          </Text>
          <Calendar size={16} color={colors.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <TouchableOpacity
          onPress={onClearFilters}
          className="flex-row items-center justify-center py-2"
        >
          <FilterX size={16} color={colors.ACCENT} />
          <Text 
            className="ml-1 text-sm font-medium"
            style={{ color: colors.ACCENT }}
          >
            {t.clearFilters}
          </Text>
        </TouchableOpacity>
      )}

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="rounded-lg p-4 border" style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}>
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.TEXT }}>
              {t.filterByCategory}
            </Text>
            
            {categories.map((category) => (
              <TouchableOpacity
                key={category.value || 'all'}
                onPress={() => {
                  onCategoryChange(category.value);
                  setShowCategoryModal(false);
                }}
                className="py-3 border-b"
                style={{ borderBottomColor: colors.BORDER }}
              >
                <Text 
                  style={{ 
                    color: selectedCategory === category.value ? colors.ACCENT : colors.TEXT 
                  }}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              className="mt-4 py-2"
            >
              <Text 
                className="text-center font-medium"
                style={{ color: colors.ACCENT }}
              >
                {t.cancel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Range Modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="rounded-lg p-4 border" style={{ backgroundColor: colors.CARD, borderColor: colors.BORDER }}>
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.TEXT }}>
              {t.filterByDate}
            </Text>
            
            {dateRanges.map((range) => (
              <TouchableOpacity
                key={range.value || 'all'}
                onPress={() => {
                  onDateRangeChange(range.value);
                  setShowDateModal(false);
                }}
                className="py-3 border-b"
                style={{ borderBottomColor: colors.BORDER }}
              >
                <Text 
                  style={{ 
                    color: dateRange === range.value ? colors.ACCENT : colors.TEXT 
                  }}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              onPress={() => setShowDateModal(false)}
              className="mt-4 py-2"
            >
              <Text 
                className="text-center font-medium"
                style={{ color: colors.ACCENT }}
              >
                {t.cancel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SessionFilters;