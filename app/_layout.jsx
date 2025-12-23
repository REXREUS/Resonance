import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

export default function RootLayout() {
  // Common screen options with smooth transitions
  const screenOptions = {
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 300,
    gestureEnabled: true,
    gestureDirection: 'horizontal',
  };

  // Modal screen options for overlays
  const modalOptions = {
    headerShown: false,
    animation: 'fade',
    animationDuration: 200,
    presentation: 'transparentModal',
  };

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={screenOptions}>
        {/* Initial screens */}
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            animation: 'none',
          }}
        />
        <Stack.Screen
          name="splash"
          options={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 500,
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />

        {/* Main tab navigation */}
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />

        {/* Session flow screens */}
        <Stack.Screen
          name="session-setup"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="simulation"
          options={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 400,
            gestureEnabled: false, // Prevent accidental swipe during session
          }}
        />
        <Stack.Screen
          name="stress-mode"
          options={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 400,
            gestureEnabled: false, // Prevent accidental swipe during session
          }}
        />
        <Stack.Screen
          name="report"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />

        {/* Utility screens */}
        <Stack.Screen
          name="voice-lab"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}