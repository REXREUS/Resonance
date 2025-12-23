import React from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import Button from '../ui/Button';
import { COLORS, SPACING } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Onboarding Slide component
 * @param {string} image - Image source
 * @param {string} title - Slide title
 * @param {string} description - Slide description
 * @param {string} lottieSource - Lottie animation source (URL or require)
 */
export default function OnboardingSlide({
  image,
  title,
  description,
  lottieSource,
  style,
}) {
  return (
    <View
      style={[
        {
          width: SCREEN_WIDTH,
          alignItems: 'center',
          paddingHorizontal: SPACING.LG,
        },
        style,
      ]}
    >
      {/* Image/Animation Container */}
      <View
        style={{
          width: SCREEN_WIDTH - SPACING.LG * 2,
          height: SCREEN_HEIGHT * 0.4,
          backgroundColor: '#1a1a1a',
          borderRadius: 24,
          overflow: 'hidden',
          marginBottom: SPACING.XL,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {lottieSource ? (
          // Lottie Animation
          <LottieView
            source={lottieSource}
            autoPlay
            loop
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        ) : image ? (
          <Image
            source={typeof image === 'string' ? { uri: image } : image}
            style={{
              width: '100%',
              height: '100%',
            }}
            resizeMode="cover"
          />
        ) : (
          // Fallback placeholder waveform visualization
          <View
            style={{
              width: '100%',
              height: 100,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {Array.from({ length: 50 }).map((_, index) => {
              const height = Math.sin((index / 50) * Math.PI) * 60 + 10;
              return (
                <View
                  key={index}
                  style={{
                    width: 2,
                    height,
                    backgroundColor: `rgba(0, 255, 255, ${0.3 + Math.sin((index / 50) * Math.PI) * 0.7})`,
                    borderRadius: 1,
                  }}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: COLORS.DARK_TEXT,
          textAlign: 'center',
          marginBottom: SPACING.MD,
        }}
      >
        {title}
      </Text>

      {/* Description */}
      <Text
        style={{
          fontSize: 16,
          color: COLORS.DARK_TEXT_SECONDARY,
          textAlign: 'center',
          lineHeight: 24,
          paddingHorizontal: SPACING.MD,
        }}
      >
        {description}
      </Text>
    </View>
  );
}

/**
 * Onboarding Pagination Dots
 */
export function OnboardingPagination({
  total,
  current,
  style,
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              index === current ? COLORS.CYBER_YELLOW : COLORS.DARK_BORDER,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Onboarding Footer with buttons
 */
export function OnboardingFooter({
  onNext,
  onSkip,
  isLast = false,
  nextLabel = 'Next',
  skipLabel = 'Skip',
  style,
}) {
  return (
    <View
      style={[
        {
          paddingHorizontal: SPACING.LG,
          paddingBottom: SPACING.XL,
        },
        style,
      ]}
    >
      <Button
        variant="primary"
        size="xl"
        fullWidth
        onPress={onNext}
        icon={
          !isLast && (
            <Text style={{ fontSize: 18 }}>→</Text>
          )
        }
        iconPosition="right"
      >
        {isLast ? 'Get Started' : nextLabel}
      </Button>
    </View>
  );
}
