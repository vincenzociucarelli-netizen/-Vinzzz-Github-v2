import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function AdminLayout() {
  const router = useRouter();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Ensure auth is loaded
      if (isLoading) {
        await loadAuth();
      }
      setIsChecking(false);
    };
    checkAuth();
  }, [isLoading]);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      // Redirect to login if not authenticated or not admin
      if (!user || user.role !== 'admin') {
        router.replace('/login');
      }
    }
  }, [user, isLoading, isChecking]);

  // Show loading while checking auth
  if (isChecking || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Don't render children if not authenticated
  if (!user || user.role !== 'admin') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="athletes" />
      <Stack.Screen name="athlete-search" />
      <Stack.Screen name="attendances" />
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
