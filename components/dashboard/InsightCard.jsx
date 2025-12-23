import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import Card from '../ui/Card';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * AI Insight Card component for Dashboard
 * @param {string} quote - Insight quote text
 * @param {number} currentIndex - Current quote index for pagination
 * @param {number} totalQuotes - Total number of quotes
 */
export default function InsightCard({
  quote,
  currentIndex = 0,
  totalQuotes = 1,
  style,
}) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade animation when quote changes
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [quote]);

  return (
    <Card variant="dark" padding="lg" style={style}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: SPACING.MD,
        }}
      >
        <Sparkles size={16} color={COLORS.CYBER_YELLOW} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: COLORS.CYBER_YELLOW,
            marginLeft: SPACING.XS,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          AI INSIGHT
        </Text>
      </View>

      {/* Quote */}
      <Animated.Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: COLORS.DARK_TEXT,
          lineHeight: 26,
          fontStyle: 'italic',
          opacity: fadeAnim,
        }}
      >
        "{quote}"
      </Animated.Text>

      {/* Pagination Dots */}
      {totalQuotes > 1 && (
        <View
          style={{
            flexDirection: 'row',
            marginTop: SPACING.MD,
            gap: 6,
          }}
        >
          {Array.from({ length: totalQuotes }).map((_, index) => (
            <View
              key={index}
              style={{
                width: index === currentIndex ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  index === currentIndex
                    ? COLORS.CYBER_YELLOW
                    : COLORS.DARK_BORDER,
              }}
            />
          ))}
        </View>
      )}
    </Card>
  );
}
