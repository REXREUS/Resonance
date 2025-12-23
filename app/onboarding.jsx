import { useState, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';
import useTranslation from '../hooks/useTranslation';
import { databaseService } from '../services/databaseService';

// New UI Components
import { Button } from '../components/ui';
import { OnboardingSlide, OnboardingPagination } from '../components/onboarding';

const { width } = Dimensions.get('window');

// Import Lottie animations
const waveAnimation = require('../assets/animations/L-wave.json');
const csAnimation = require('../assets/animations/L-cs.json'); 
const latencyAnimation = require('../assets/animations/L-latency.json');
const privacyAnimation = require('../assets/animations/L-privacy.json');

const getOnboardingData = (t) => [
  {
    id: 1,
    title: t.masterYourVoice || 'Master Your Voice',
    subtitle: t.highStakesTraining || 'High-Stakes Communication Training',
    description: t.trainForCritical || 'Train for critical conversations with AI-powered simulations that adapt to your performance.',
    lottieSource: waveAnimation,
  },
  {
    id: 2,
    title: t.ultraLowLatency || 'Ultra-Low Latency',
    subtitle: t.naturalConversation || 'Natural Conversation Flow',
    description: t.experienceRealistic || 'Experience realistic interactions with voice activity detection and natural interruption capabilities.',
    lottieSource: latencyAnimation,
  },
  {
    id: 3,
    title: t.chaosEngine,
    subtitle: t.realWorldDisruptions || 'Real-World Disruptions',
    description: t.practiceHandling || 'Practice handling unexpected challenges with background noise, voice variations, and hardware failures.',
    lottieSource: csAnimation,
  },
  {
    id: 4,
    title: t.offlineFirst || 'Offline-First',
    subtitle: t.trainAnywhere || 'Train Anywhere, Anytime',
    description: t.fullFunctionality || 'Full functionality without internet dependency. Your progress stays private and secure on your device.',
    lottieSource: privacyAnimation,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef(null);
  const { t } = useTranslation();
  
  const onboardingData = getOnboardingData(t);

  const handleNext = async () => {
    if (currentPage < onboardingData.length - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      scrollViewRef.current?.scrollTo({
        x: nextPage * width,
        animated: true,
      });
    } else {
      await databaseService.setOnboardingCompleted();
      router.replace('/(tabs)');
    }
  };

  const handleSkip = async () => {
    await databaseService.setOnboardingCompleted();
    router.replace('/(tabs)');
  };

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(contentOffsetX / width);
    setCurrentPage(page);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.DARK_BG }}>
      {/* Skip Button */}
      <View style={{ position: 'absolute', top: 50, right: SPACING.MD, zIndex: 10 }}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={{ fontSize: 16, color: COLORS.DARK_TEXT_SECONDARY }}>
            {t.skip}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {onboardingData.map((item) => (
          <OnboardingSlide
            key={item.id}
            title={item.title}
            description={item.description}
            lottieSource={item.lottieSource}
          />
        ))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={{ paddingHorizontal: SPACING.LG, paddingBottom: SPACING.XL }}>
        {/* Pagination */}
        <OnboardingPagination
          total={onboardingData.length}
          current={currentPage}
          style={{ marginBottom: SPACING.LG }}
        />

        {/* Next Button */}
        <Button
          variant="primary"
          size="xl"
          fullWidth
          onPress={handleNext}
          icon={currentPage < onboardingData.length - 1 ? <Text style={{ fontSize: 18 }}>→</Text> : null}
          iconPosition="right"
        >
          {currentPage === onboardingData.length - 1 ? t.getStarted : t.next}
        </Button>
      </View>
    </SafeAreaView>
  );
}