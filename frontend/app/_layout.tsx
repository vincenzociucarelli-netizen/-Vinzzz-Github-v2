import React, { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, Platform } from 'react-native';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadAuth = useAuthStore((state) => state.loadAuth);
  const [appIsReady, setAppIsReady] = useState(false);

  // Load Ionicons font from local assets for reliable web support
  const [fontsLoaded] = useFonts({
    'Ionicons': require('../assets/fonts/Ionicons.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      try {
        await loadAuth();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded]);

  if (!appIsReady || !fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="minor" />
        <Stack.Screen name="preseason" />
      </Stack>
    </View>
  );
}
