import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import { Home, History, Mic2, Settings, Mic } from 'lucide-react-native';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';

const { width } = Dimensions.get('window');

export default function TabLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Calculate bottom padding for navigation bar
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 0);

  // Animation values
  const fabScale = useRef(new Animated.Value(1)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  const handleFABPress = () => {
    // Animate FAB press
    Animated.parallel([
      Animated.spring(fabScale, {
        toValue: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(iconRotate, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(fabScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(iconRotate, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      router.push('/session-setup');
    }, 150);
  };

  // Enhanced tab bar configuration
  const tabBarOptions = {
    tabBarStyle: {
      backgroundColor: colors.CARD,
      borderTopColor: colors.BORDER,
      borderTopWidth: 1,
      height: 70 + bottomPadding,
      paddingBottom: bottomPadding + 8,
      paddingTop: 10,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    tabBarActiveTintColor: colors.ACCENT,
    tabBarInactiveTintColor: colors.TEXT_SECONDARY,
    headerShown: false,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },
    tabBarIconStyle: {
      marginBottom: 2,
    },
  };

  // Simple icon renderer
  const renderTabIcon = (IconComponent, focused, color, size) => (
    <View style={{ opacity: focused ? 1 : 0.7 }}>
      <IconComponent size={size} color={color} />
    </View>
  );

  const rotateInterpolate = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.BG }}>
      <Tabs screenOptions={tabBarOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: t.dashboard,
            tabBarIcon: ({ focused, color, size }) => renderTabIcon(Home, focused, color, size),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t.history,
            tabBarIcon: ({ focused, color, size }) => renderTabIcon(History, focused, color, size),
          }}
        />
        {/* Placeholder for FAB spacing */}
        <Tabs.Screen
          name="simulation"
          options={{
            title: '',
            tabBarIcon: () => <View style={{ width: 60 }} />,
            tabBarLabel: () => null,
            tabBarButton: () => <View style={{ width: 70 }} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: t.voiceLab,
            tabBarIcon: ({ focused, color, size }) => renderTabIcon(Mic2, focused, color, size),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t.settings,
            tabBarIcon: ({ focused, color, size }) => renderTabIcon(Settings, focused, color, size),
          }}
        />
      </Tabs>

      {/* Floating Action Button */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 25 + bottomPadding,
          left: width / 2 - 32,
          width: 64,
          height: 64,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: fabScale }],
          zIndex: 100,
        }}
      >
        <TouchableOpacity
          style={{
            width: 64,
            height: 64,
            backgroundColor: colors.ACCENT,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.ACCENT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
          }}
          onPress={handleFABPress}
          activeOpacity={0.8}
        >
          <Animated.View
            style={{
              transform: [{ rotate: rotateInterpolate }],
            }}
          >
            <Mic size={28} color={colors.BG} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
