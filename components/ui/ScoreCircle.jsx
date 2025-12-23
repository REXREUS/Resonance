import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, BORDER_RADIUS } from '../../constants/theme';

/**
 * Circular Score Display component (like in Report screen)
 * @param {number} score - Score value (0-100)
 * @param {string} grade - Letter grade (A+, B, etc.)
 * @param {string} label - Label below score
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 */
export default function ScoreCircle({
  score = 0,
  maxScore = 100,
  grade,
  label,
  size = 'md',
  showProgress = true,
  strokeWidth,
  style,
}) {
  const getSizeStyles = () => {
    const sizes = {
      sm: { 
        container: 60, 
        scoreText: 20, 
        gradeText: 10, 
        labelText: 8,
        stroke: 4,
      },
      md: { 
        container: 100, 
        scoreText: 32, 
        gradeText: 14, 
        labelText: 10,
        stroke: 6,
      },
      lg: { 
        container: 140, 
        scoreText: 48, 
        gradeText: 18, 
        labelText: 12,
        stroke: 8,
      },
      xl: { 
        container: 180, 
        scoreText: 56, 
        gradeText: 24, 
        labelText: 14,
        stroke: 10,
      },
    };
    return sizes[size] || sizes.md;
  };

  const getScoreColor = () => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return COLORS.SUCCESS;
    if (percentage >= 80) return COLORS.CYBER_YELLOW;
    if (percentage >= 70) return '#FFA500';
    if (percentage >= 60) return COLORS.WARNING;
    return COLORS.ERROR;
  };

  const sizeStyles = getSizeStyles();
  const actualStrokeWidth = strokeWidth || sizeStyles.stroke;
  const radius = (sizeStyles.container - actualStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / maxScore) * circumference;
  const scoreColor = getScoreColor();

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
            strokeWidth={actualStrokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={sizeStyles.container / 2}
            cy={sizeStyles.container / 2}
            r={radius}
            stroke={scoreColor}
            strokeWidth={actualStrokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            transform={`rotate(-90 ${sizeStyles.container / 2} ${sizeStyles.container / 2})`}
          />
        </Svg>
      )}

      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              fontSize: sizeStyles.scoreText,
              fontWeight: '700',
              color: scoreColor,
            }}
          >
            {score}
          </Text>
          <Text
            style={{
              fontSize: sizeStyles.scoreText * 0.4,
              fontWeight: '500',
              color: COLORS.LIGHT_TEXT_SECONDARY,
            }}
          >
            /{maxScore}
          </Text>
        </View>

        {grade && (
          <View
            style={{
              backgroundColor: scoreColor,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: BORDER_RADIUS.SM,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontSize: sizeStyles.gradeText,
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            >
              {grade}
            </Text>
          </View>
        )}

        {label && (
          <Text
            style={{
              fontSize: sizeStyles.labelText,
              fontWeight: '600',
              color: scoreColor,
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}
