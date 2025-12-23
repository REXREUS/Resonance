import React from 'react';
import { View, Image, Text } from 'react-native';
import { User } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS } from '../../constants/theme';

/**
 * Reusable Avatar component
 * @param {string} source - Image source URI
 * @param {string} name - Name for initials fallback
 * @param {string} size - 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} showStatus - Show online/offline status
 * @param {string} status - 'online' | 'offline' | 'busy'
 */
export default function Avatar({
  source,
  name,
  size = 'md',
  showStatus = false,
  status = 'offline',
  variant = 'circle',
  backgroundColor = '#E8E8E8',
  style,
}) {
  const getSizeStyles = () => {
    const sizes = {
      xs: { container: 24, text: 10, icon: 12, status: 8 },
      sm: { container: 32, text: 12, icon: 16, status: 10 },
      md: { container: 48, text: 16, icon: 24, status: 12 },
      lg: { container: 64, text: 20, icon: 32, status: 14 },
      xl: { container: 96, text: 32, icon: 48, status: 18 },
    };
    return sizes[size] || sizes.md;
  };

  const getStatusColor = () => {
    const colors = {
      online: '#4CAF50',
      offline: '#9E9E9E',
      busy: '#F44336',
    };
    return colors[status] || colors.offline;
  };

  const getInitials = () => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const sizeStyles = getSizeStyles();
  const borderRadius = variant === 'circle' ? BORDER_RADIUS.FULL : BORDER_RADIUS.LG;

  return (
    <View
      style={[
        {
          width: sizeStyles.container,
          height: sizeStyles.container,
          borderRadius,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={{
            width: sizeStyles.container,
            height: sizeStyles.container,
            borderRadius,
          }}
          resizeMode="cover"
        />
      ) : name ? (
        <Text
          style={{
            fontSize: sizeStyles.text,
            fontWeight: '600',
            color: COLORS.LIGHT_TEXT_SECONDARY,
          }}
        >
          {getInitials()}
        </Text>
      ) : (
        <User size={sizeStyles.icon} color={COLORS.LIGHT_TEXT_SECONDARY} />
      )}

      {showStatus && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: sizeStyles.status,
            height: sizeStyles.status,
            borderRadius: BORDER_RADIUS.FULL,
            backgroundColor: getStatusColor(),
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
      )}
    </View>
  );
}
