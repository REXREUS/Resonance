import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import { Eye, EyeOff, Search, X } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Input component
 * @param {string} variant - 'default' | 'filled' | 'outlined'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} isPassword - Show password toggle
 * @param {boolean} isSearch - Show search icon
 */
export default function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  helperText,
  variant = 'default',
  size = 'md',
  isPassword = false,
  isSearch = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const getVariantStyles = () => {
    const variants = {
      default: {
        container: {
          backgroundColor: '#F5F5F5',
          borderWidth: 1,
          borderColor: isFocused ? COLORS.CYBER_YELLOW : 'transparent',
        },
      },
      filled: {
        container: {
          backgroundColor: '#EEEEEE',
          borderWidth: 0,
        },
      },
      outlined: {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: isFocused ? COLORS.CYBER_YELLOW : COLORS.LIGHT_BORDER,
        },
      },
    };
    return variants[variant] || variants.default;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: {
        container: {
          paddingVertical: SPACING.XS,
          paddingHorizontal: SPACING.SM,
          borderRadius: BORDER_RADIUS.MD,
        },
        text: { fontSize: 14 },
      },
      md: {
        container: {
          paddingVertical: SPACING.SM + 2,
          paddingHorizontal: SPACING.MD,
          borderRadius: BORDER_RADIUS.LG,
        },
        text: { fontSize: 16 },
      },
      lg: {
        container: {
          paddingVertical: SPACING.MD,
          paddingHorizontal: SPACING.MD,
          borderRadius: BORDER_RADIUS.LG,
        },
        text: { fontSize: 18 },
      },
    };
    return sizes[size] || sizes.md;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const renderLeftIcon = () => {
    if (isSearch) {
      return <Search size={20} color={COLORS.LIGHT_TEXT_SECONDARY} style={{ marginRight: SPACING.SM }} />;
    }
    if (leftIcon) {
      return <View style={{ marginRight: SPACING.SM }}>{leftIcon}</View>;
    }
    return null;
  };

  const renderRightIcon = () => {
    if (isPassword) {
      return (
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? (
            <EyeOff size={20} color={COLORS.LIGHT_TEXT_SECONDARY} />
          ) : (
            <Eye size={20} color={COLORS.LIGHT_TEXT_SECONDARY} />
          )}
        </TouchableOpacity>
      );
    }
    if (isSearch && value) {
      return (
        <TouchableOpacity onPress={() => onChangeText?.('')}>
          <X size={20} color={COLORS.LIGHT_TEXT_SECONDARY} />
        </TouchableOpacity>
      );
    }
    if (rightIcon) {
      return (
        <TouchableOpacity onPress={onRightIconPress}>
          {rightIcon}
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <View style={style}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: COLORS.LIGHT_TEXT,
            marginBottom: SPACING.XS,
          }}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            opacity: disabled ? 0.5 : 1,
          },
          sizeStyles.container,
          variantStyles.container,
          error && { borderColor: COLORS.ERROR },
        ]}
      >
        {renderLeftIcon()}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.LIGHT_TEXT_SECONDARY}
          secureTextEntry={isPassword && !showPassword}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            {
              flex: 1,
              color: COLORS.LIGHT_TEXT,
              padding: 0,
            },
            sizeStyles.text,
            multiline && { textAlignVertical: 'top', minHeight: numberOfLines * 24 },
            inputStyle,
          ]}
          {...props}
        />

        {renderRightIcon()}
      </View>

      {(error || helperText) && (
        <Text
          style={{
            fontSize: 12,
            color: error ? COLORS.ERROR : COLORS.LIGHT_TEXT_SECONDARY,
            marginTop: SPACING.XS,
          }}
        >
          {error || helperText}
        </Text>
      )}
    </View>
  );
}
