import React, { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import api from '../../src/services/api';

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      await loadAuth();
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!user || user.role !== 'admin') {
        router.replace('/login');
      } else {
        // Check terms status
        checkTerms();
      }
    }
  }, [user, isLoading, isChecking]);

  const checkTerms = async () => {
    try {
      const res = await api.get('/societies/terms-status');
      setTermsAccepted(res.data.terms_accepted || false);
    } catch {
      setTermsAccepted(false);
    }
  };

  // Show loading while checking auth or terms
  if (isChecking || isLoading || termsAccepted === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect to terms acceptance if not accepted (except if already on terms page)
  if (!termsAccepted && !pathname.includes('terms-acceptance')) {
    router.replace('/admin/terms-acceptance');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="terms-acceptance" />
      <Stack.Screen name="index" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="athletes" />
      <Stack.Screen name="athlete-search" />
      <Stack.Screen name="attendances" />
      <Stack.Screen name="prime-squadre" />
      <Stack.Screen name="prime-squadre/[id]" />
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
