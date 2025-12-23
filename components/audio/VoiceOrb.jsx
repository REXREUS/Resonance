import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { COLORS } from '../../constants/theme';

/**
 * Voice Orb Visualizer - Central "Sun" orb for simulation
 * @param {number} amplitude - Audio amplitude (0-1)
 * @param {boolean} isActive - Whether voice is active
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} variant - 'default' | 'pulse' | 'ripple'
 */
export default function VoiceOrb({
  amplitude = 0,
  isActive = false,
  size = 'lg',
  variant = 'default',
  color = COLORS.CYBER_YELLOW,
  style,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isActive) {
      // Pulse animation based on amplitude
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1 + amplitude * 0.2,
            duration: 150,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 150,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
    }
  }, [isActive, amplitude]);

  const getSizeStyles = () => {
    const sizes = {
      sm: { orb: 80, ring1: 100, ring2: 120, ring3: 140 },
      md: { orb: 120, ring1: 150, ring2: 180, ring3: 210 },
      lg: { orb: 160, ring1: 200, ring2: 240, ring3: 280 },
      xl: { orb: 200, ring1: 250, ring2: 300, ring3: 350 },
    };
    return sizes[size] || sizes.lg;
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        {
          width: sizeStyles.ring3,
          height: sizeStyles.ring3,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* Outer rings */}
      {variant !== 'default' && (
        <>
          <Animated.View
            style={{
              position: 'absolute',
              width: sizeStyles.ring3,
              height: sizeStyles.ring3,
              borderRadius: sizeStyles.ring3 / 2,
              borderWidth: 1,
              borderColor: color,
              opacity: glowAnim,
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: sizeStyles.ring2,
              height: sizeStyles.ring2,
              borderRadius: sizeStyles.ring2 / 2,
              borderWidth: 1,
              borderColor: color,
              opacity: Animated.multiply(glowAnim, 1.5),
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: sizeStyles.ring1,
              height: sizeStyles.ring1,
              borderRadius: sizeStyles.ring1 / 2,
              borderWidth: 1,
              borderColor: color,
              opacity: Animated.multiply(glowAnim, 2),
            }}
          />
        </>
      )}

      {/* Main orb */}
      <Animated.View
        style={{
          width: sizeStyles.orb,
          height: sizeStyles.orb,
          borderRadius: sizeStyles.orb / 2,
          backgroundColor: color,
          transform: [{ scale: pulseAnim }],
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isActive ? 0.8 : 0.4,
          shadowRadius: isActive ? 30 : 15,
          elevation: 10,
        }}
      />
    </View>
  );
}

/**
 * Waveform Visualizer (horizontal bars)
 */
export function WaveformVisualizer({
  amplitude = 0,
  bars = 5,
  isActive = false,
  color = COLORS.CYBER_YELLOW,
  style,
}) {
  const barAnims = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isActive) {
      barAnims.forEach((anim, index) => {
        const delay = index * 50;
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 0.3 + Math.random() * 0.7 * amplitude,
              duration: 100 + Math.random() * 100,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 100 + Math.random() * 100,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      barAnims.forEach((anim) => anim.setValue(0.3));
    }
  }, [isActive, amplitude]);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 40,
          gap: 4,
        },
        style,
      ]}
    >
      {barAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={{
            width: 4,
            height: 30,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ scaleY: anim }],
          }}
        />
      ))}
    </View>
  );
}
