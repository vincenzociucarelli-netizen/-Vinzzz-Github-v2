/**
 * GlobalReadOnlyBanner
 *
 * Fixed banner that sticks at the top of the viewport for institutional
 * accounts (society email-account). Renders only on web and only when the
 * current user is institutional.
 *
 * Strategy: rather than retrofit every single page, this floating banner
 * guarantees the user always sees the read-only status, regardless of the
 * route they navigate to.
 */
import React from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import { useAuthStore } from '../store/authStore';

export default function GlobalReadOnlyBanner() {
  const { user } = useAuthStore();
  const isInstitutional = Boolean((user as any)?.is_institutional_account);
  if (!isInstitutional) return null;
  if (Platform.OS !== 'web') return null;

  // Hide banner on public/onboarding pages where the user is NOT operating on data.
  // Banner is meant for protected /admin pages, not for login/register/terms/privacy.
  if (typeof window !== 'undefined') {
    const path = window.location?.pathname || '';
    const publicPaths = [
      '/login',
      '/register',
      '/register-society',
      '/terms-of-use',
      '/privacy-policy',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
    ];
    if (publicPaths.some(p => path === p || path.startsWith(p + '/'))) return null;
  }

  return (
    <View style={styles.wrap as any} data-testid="global-readonly-banner">
      <Ionicons name="lock-closed" size={14} color="#fff" />
      <Text style={styles.text}>
        🔒 SOLA LETTURA — Account istituzionale (Società). Le modifiche sono bloccate per garantire la tracciabilità.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#C62828',
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)' as any,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
