import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import api from '../../src/services/api';

/**
 * Parent layout.
 * 🆕 17/07/2026 — Dual-role: consente accesso anche a staff (admin/dirigente/coordinatore/coach)
 * se sono `parent_id` di almeno un atleta (verificato via /users/me/parent-of).
 * 🆕 26/07/2026 — Consente comunque l'accesso a /parent/link-athlete a qualsiasi staff
 * (anche senza figli linkati) perché è la pagina usata per creare il primo collegamento.
 */
const STAFF_ROLES_WITH_PARENT_DUAL = ['admin', 'viewer', 'dirigente', 'coordinatore', 'coach', 'collaboratore'];

export default function ParentLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [linkedOk, setLinkedOk] = useState<boolean | null>(null);

  // Pagina "link-athlete" accessibile a tutti gli staff (bypassa il check figli linkati)
  const currentPage = segments[segments.length - 1] || '';
  const isLinkOnboarding = currentPage === 'link-athlete';

  useEffect(() => {
    const checkAuth = async () => {
      await loadAuth();
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    // Se lo staff-user prova ad entrare qui, controllo se è genitore di almeno un atleta
    if (!isChecking && !isLoading && user) {
      if (user.role === 'parent') {
        setLinkedOk(true);
        return;
      }
      if (STAFF_ROLES_WITH_PARENT_DUAL.includes(user.role)) {
        // Bypass check per la pagina di collegamento (staff sta cercando di linkare il primo figlio)
        if (isLinkOnboarding) {
          setLinkedOk(true);
          return;
        }
        (async () => {
          try {
            const r = await api.get('/users/me/parent-of');
            setLinkedOk((r.data?.count || 0) > 0);
          } catch {
            setLinkedOk(false);
          }
        })();
      } else {
        setLinkedOk(false);
      }
    }
  }, [user, isLoading, isChecking, isLinkOnboarding]);

  useEffect(() => {
    if (linkedOk === false) {
      router.replace('/login');
    }
  }, [linkedOk]);

  if (isChecking || isLoading || linkedOk === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!linkedOk) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register-athlete" />
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
