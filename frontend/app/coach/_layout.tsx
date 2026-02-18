import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function CoachLayout() {
  const router = useRouter();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isLoading) {
        await loadAuth();
      }
      setIsChecking(false);
    };
    checkAuth();
  }, [isLoading]);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!user || user.role !== 'coach') {
        router.replace('/login');
      }
    }
  }, [user, isLoading, isChecking]);

  if (isChecking || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user || user.role !== 'coach') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="athlete/[id]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
