import React, { useEffect, useState, useCallback } from 'react';
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

  const fetchTermsStatus = useCallback(async () => {
    try {
      const res = await api.get('/societies/terms-status');
      setTermsAccepted(res.data.terms_accepted || false);
    } catch {
      setTermsAccepted(false);
    }
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!user || user.role !== 'admin') {
        router.replace('/login');
      } else {
        fetchTermsStatus();
      }
    }
  }, [user, isLoading, isChecking]);

  // Re-check terms when navigating back from terms-acceptance page
  useEffect(() => {
    if (user && user.role === 'admin' && !pathname.includes('terms-acceptance')) {
      fetchTermsStatus();
    }
  }, [pathname]);

  useEffect(() => {
    if (termsAccepted === false && !pathname.includes('terms-acceptance')) {
      router.replace('/admin/terms-acceptance');
    }
  }, [termsAccepted, pathname]);

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

  if (termsAccepted === false && !pathname.includes('terms-acceptance')) {
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
