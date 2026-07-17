import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * 🆕 26/07/2026 — Staff Zaino Genitore layout.
 * Accessibile a tutti gli utenti autenticati con ruolo staff (dual-role).
 */
const STAFF_ROLES = ['admin', 'viewer', 'dirigente', 'coordinatore', 'coach', 'collaboratore', 'parent'];

export default function StaffLayout() {
  const router = useRouter();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    (async () => {
      await loadAuth();
      setIsChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!user || !STAFF_ROLES.includes(user.role)) {
        router.replace('/login');
      }
    }
  }, [user, isLoading, isChecking]);

  if (isChecking || isLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E24AA" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="link-or-register-child" />
      <Stack.Screen name="register-child" />
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
