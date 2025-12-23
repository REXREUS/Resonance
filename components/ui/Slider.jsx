import React from 'react';
import { View, Text, PanResponder } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Reusable Slider component
 * @param {number} value - Current value (0-100)
 * @param {function} onValueChange - Callback when value changes
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} label - Label text
 * @param {boolean} showValue - Show current value
 * @param {string} unit - Unit suffix (e.g., '%', 'ms')
 */
export default function Slider({
  value = 50,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  unit = '',
  disabled = false,
  trackColor = '#E0E0E0',
  activeColor = COLORS.CYBER_YELLOW,
  style,
}) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  
  const percentage = ((value - min) / (max - min)) * 100;
  
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt) => {
          handleTouch(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          handleTouch(evt.nativeEvent.locationX);
        },
      }),
    [trackWidth, disabled, min, max, step]
  );

  const handleTouch = (locationX) => {
    if (trackWidth === 0) return;
    
    let newPercentage = (locationX / trackWidth) * 100;
    newPercentage = Math.max(0, Math.min(100, newPercentage));
    
    let newValue = min + (newPercentage / 100) * (max - min);
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));
    
    onValueChange?.(newValue);
  };

  return (
    <View style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      {(label || showValue) && (
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: SPACING.SM,
        }}>
          {label && (
            <Text style={{ 
              fontSize: 14, 
              fontWeight: '500',
              color: COLORS.LIGHT_TEXT_SECONDARY,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {label}
            </Text>
          )}
          {showValue && (
            <Text style={{ 
              fontSize: 14, 
              fontWeight: '600',
              color: COLORS.LIGHT_TEXT,
            }}>
              {value}{unit}
            </Text>
          )}
        </View>
      )}
      
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
        style={{
          height: 24,
          justifyContent: 'center',
        }}
      >
        {/* Track background */}
        <View
          style={{
            height: 6,
            backgroundColor: trackColor,
            borderRadius: BORDER_RADIUS.FULL,
            overflow: 'hidden',
          }}
        >
          {/* Active track */}
          <View
            style={{
              height: '100%',
              width: `${percentage}%`,
              backgroundColor: activeColor,
              borderRadius: BORDER_RADIUS.FULL,
            }}
          />
        </View>
        
        {/* Thumb */}
        <View
          style={{
            position: 'absolute',
            left: `${percentage}%`,
            marginLeft: -10,
            width: 20,
            height: 20,
            borderRadius: BORDER_RADIUS.FULL,
            backgroundColor: activeColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 4,
          }}
        />
      </View>
    </View>
  );
}
