import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, BORDER_RADIUS } from '../../constants/theme';

/**
 * Countdown Timer component with circular progress
 * @param {number} seconds - Initial countdown seconds
 * @param {function} onComplete - Callback when countdown completes
 * @param {boolean} autoStart - Start countdown automatically
 */
export default function CountdownTimer({
  seconds = 10,
  onComplete,
  autoStart = true,
  size = 'md',
  showProgress = true,
  style,
}) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft <= 0) {
        onComplete?.();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const getSizeStyles = () => {
    const sizes = {
      sm: { container: 60, text: 20, stroke: 3 },
      md: { container: 100, text: 36, stroke: 4 },
      lg: { container: 140, text: 48, stroke: 5 },
    };
    return sizes[size] || sizes.md;
  };

  const sizeStyles = getSizeStyles();
  const radius = (sizeStyles.container - sizeStyles.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / seconds) * circumference;

  const formatTime = (secs) => {
    if (secs < 60) {
      return String(secs).padStart(2, '0');
    }
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${String(remainingSecs).padStart(2, '0')}`;
  };

  return (
    <View
      style={[
        {
          width: sizeStyles.container,
          height: sizeStyles.container,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {showProgress && (
        <Svg
          width={sizeStyles.container}
          height={sizeStyles.container}
          style={{ position: 'absolute' }}
        >
          {/* Background circle */}
          <Circle
            cx={sizeStyles.container / 2}
            cy={sizeStyles.container / 2}
            r={radius}
            stroke="#E8E8E8"
            strokeWidth={sizeStyles.stroke}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={sizeStyles.container / 2}
            cy={sizeStyles.container / 2}
            r={radius}
            stroke={COLORS.CYBER_YELLOW}
            strokeWidth={sizeStyles.stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            transform={`rotate(-90 ${sizeStyles.container / 2} ${sizeStyles.container / 2})`}
          />
        </Svg>
      )}

      <Text
        style={{
          fontSize: sizeStyles.text,
          fontWeight: '700',
          color: COLORS.LIGHT_TEXT,
        }}
      >
        {formatTime(timeLeft)}
      </Text>
    </View>
  );
}

/**
 * Simple Timer Display (like 04:12 in simulation)
 */
export function TimerDisplay({
  seconds = 0,
  isRecording = false,
  size = 'md',
  style,
}) {
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const getSizeStyles = () => {
    const sizes = {
      sm: { text: 14 },
      md: { text: 18 },
      lg: { text: 24 },
    };
    return sizes[size] || sizes.md;
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {isRecording && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: COLORS.ERROR,
            marginRight: 8,
          }}
        />
      )}
      <Text
        style={{
          fontSize: sizeStyles.text,
          fontWeight: '600',
          color: COLORS.LIGHT_TEXT,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatTime(seconds)}
      </Text>
    </View>
  );
}
