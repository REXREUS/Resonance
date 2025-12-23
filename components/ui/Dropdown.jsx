import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { BORDER_RADIUS, SPACING } from '../../constants/theme';
import useTheme from '../../hooks/useTheme';

/**
 * Reusable Dropdown/Select component
 * @param {Array} options - Array of { label, value } objects
 * @param {any} value - Currently selected value
 * @param {function} onChange - Callback when selection changes
 * @param {string} placeholder - Placeholder text
 */
export default function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  label,
  disabled = false,
  error,
  style,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useTheme();

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (option) => {
    onChange?.(option.value);
    setIsOpen(false);
  };

  return (
    <View style={style}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: colors.TEXT,
            marginBottom: SPACING.XS,
          }}
        >
          {label}
        </Text>
      )}

      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        activeOpacity={0.7}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.BG,
            paddingVertical: SPACING.SM + 4,
            paddingHorizontal: SPACING.MD,
            borderRadius: BORDER_RADIUS.LG,
            borderWidth: 1,
            borderColor: error ? colors.ERROR : colors.BORDER,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={{
            fontSize: 16,
            color: selectedOption ? colors.TEXT : colors.TEXT_SECONDARY,
          }}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown size={20} color={colors.TEXT_SECONDARY} />
      </TouchableOpacity>

      {error && (
        <Text
          style={{
            fontSize: 12,
            color: colors.ERROR,
            marginTop: SPACING.XS,
          }}
        >
          {error}
        </Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            paddingHorizontal: SPACING.LG,
          }}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={{
              backgroundColor: colors.CARD,
              borderRadius: BORDER_RADIUS.LG,
              maxHeight: 400,
              overflow: 'hidden',
            }}
          >
            {label && (
              <View
                style={{
                  paddingVertical: SPACING.MD,
                  paddingHorizontal: SPACING.MD,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.BORDER,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: colors.TEXT,
                  }}
                >
                  {label}
                </Text>
              </View>
            )}

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: SPACING.MD,
                    paddingHorizontal: SPACING.MD,
                    backgroundColor: item.value === value ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: item.value === value ? colors.ACCENT : colors.TEXT,
                      fontWeight: item.value === value ? '600' : '400',
                    }}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Check size={20} color={colors.ACCENT} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: colors.BORDER }} />
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
