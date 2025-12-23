import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Toggle from '../ui/Toggle';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Settings Section Header
 */
export function SectionHeader({ title, style }) {
  return (
    <Text
      style={[
        {
          fontSize: 12,
          fontWeight: '600',
          color: COLORS.LIGHT_TEXT_SECONDARY,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: SPACING.SM,
          marginTop: SPACING.LG,
        },
        style,
      ]}
    >
      {title}
    </Text>
  );
}

/**
 * Settings Row with various types
 * @param {string} type - 'navigation' | 'toggle' | 'value' | 'button'
 */
export function SettingsRow({
  icon,
  label,
  description,
  value,
  type = 'navigation',
  onPress,
  onToggle,
  toggleValue,
  disabled = false,
  destructive = false,
  style,
}) {
  const renderRight = () => {
    switch (type) {
      case 'toggle':
        return (
          <Toggle
            value={toggleValue}
            onValueChange={onToggle}
            disabled={disabled}
          />
        );
      case 'value':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.LIGHT_TEXT_SECONDARY,
                marginRight: SPACING.XS,
              }}
            >
              {value}
            </Text>
            {onPress && <ChevronRight size={20} color={COLORS.LIGHT_TEXT_SECONDARY} />}
          </View>
        );
      case 'button':
        return null;
      case 'navigation':
      default:
        return <ChevronRight size={20} color={COLORS.LIGHT_TEXT_SECONDARY} />;
    }
  };

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: SPACING.MD,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon && (
        <View style={{ marginRight: SPACING.SM, width: 24 }}>{icon}</View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            color: destructive ? COLORS.ERROR : COLORS.LIGHT_TEXT,
            fontWeight: type === 'button' ? '600' : '400',
            textAlign: type === 'button' ? 'center' : 'left',
          }}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={{
              fontSize: 12,
              color: COLORS.LIGHT_TEXT_SECONDARY,
              marginTop: 2,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {renderRight()}
    </View>
  );

  if (type === 'toggle' || disabled) {
    return content;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

/**
 * Settings Card (grouped rows)
 */
export function SettingsCard({ children, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: BORDER_RADIUS.LG,
          paddingHorizontal: SPACING.MD,
          borderWidth: 1,
          borderColor: COLORS.LIGHT_BORDER,
        },
        style,
      ]}
    >
      {React.Children.map(children, (child, index) => (
        <>
          {child}
          {index < React.Children.count(children) - 1 && (
            <View
              style={{
                height: 1,
                backgroundColor: COLORS.LIGHT_BORDER,
                marginLeft: child.props?.icon ? 40 : 0,
              }}
            />
          )}
        </>
      ))}
    </View>
  );
}

/**
 * Theme Selector component
 */
export function ThemeSelector({ value, onChange, style }) {
  const themes = [
    { key: 'light', label: 'Light' },
    { key: 'system', label: 'System' },
    { key: 'dark', label: 'Dark' },
  ];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: '#F0F0F0',
          borderRadius: BORDER_RADIUS.MD,
          padding: 4,
        },
        style,
      ]}
    >
      {themes.map((theme) => (
        <TouchableOpacity
          key={theme.key}
          onPress={() => onChange?.(theme.key)}
          style={{
            flex: 1,
            paddingVertical: SPACING.SM,
            paddingHorizontal: SPACING.MD,
            borderRadius: BORDER_RADIUS.MD - 2,
            backgroundColor: value === theme.key ? '#FFFFFF' : 'transparent',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: value === theme.key ? '600' : '400',
              color:
                value === theme.key
                  ? COLORS.LIGHT_TEXT
                  : COLORS.LIGHT_TEXT_SECONDARY,
            }}
          >
            {theme.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * API Key Input component
 */
export function ApiKeyInput({
  label,
  value,
  placeholder = 'Enter API Key',
  icon,
  onPress,
  style,
}) {
  const maskedValue = value ? '•'.repeat(Math.min(value.length, 12)) : '';

  return (
    <View style={style}>
      <Text
        style={{
          fontSize: 12,
          color: COLORS.LIGHT_TEXT_SECONDARY,
          marginBottom: SPACING.XS,
        }}
      >
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F5F5F5',
          borderRadius: BORDER_RADIUS.MD,
          paddingVertical: SPACING.SM,
          paddingHorizontal: SPACING.MD,
        }}
      >
        {icon && <View style={{ marginRight: SPACING.SM }}>{icon}</View>}
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            color: value ? COLORS.LIGHT_TEXT : COLORS.LIGHT_TEXT_SECONDARY,
          }}
        >
          {maskedValue || placeholder}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
