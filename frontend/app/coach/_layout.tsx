import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLegalCheck } from '../../src/hooks/useLegalCheck';
import { LegalAcceptanceScreen } from '../../src/components/LegalAcceptanceScreen';

export default function CoachLayout() {
  const router = useRouter();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const isAuthenticated = !isChecking && !isLoading && !!user && user.role === 'coach';
  const { legalAccepted, legalChecking, markLegalAccepted } = useLegalCheck(isAuthenticated);

  useEffect(() => {
    const checkAuth = async () => {
      await loadAuth();
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!user || user.role !== 'coach') {
        router.replace('/login');
      }
    }
  }, [user, isLoading, isChecking]);

  if (isChecking || isLoading || legalChecking) {
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

  if (legalAccepted === false) {
    return <LegalAcceptanceScreen onAccepted={markLegalAccepted} userName={user.full_name} />;
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
