/**
 * InstitutionalBanner
 *
 * Red banner shown at the top of sensitive admin settings pages when the
 * current user is an Account Istituzionale (society account).
 *
 * Reminds them that some actions are reserved to the Responsabile Admin
 * (physical legal representative), not to institutional accounts.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import { useAuthStore } from '../store/authStore';

interface Props {
  /** Custom text override (default fits most settings pages) */
  text?: string;
  /** Optional secondary line (e.g., page-specific note) */
  detail?: string;
}

export default function InstitutionalBanner({ text, detail }: Props) {
  const { user } = useAuthStore();
  const isInstitutional = Boolean((user as any)?.is_institutional_account);
  if (!isInstitutional) return null;

  return (
    <View style={styles.banner} data-testid="institutional-banner">
      <Ionicons name="business" size={18} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>ACCOUNT ISTITUZIONALE</Text>
        <Text style={styles.text}>
          {text || 'Alcune azioni sono riservate al Responsabile Admin persona fisica.'}
        </Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#C62828',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#8E1A1A',
  },
  title: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  detail: {
    color: '#FFCDD2',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
