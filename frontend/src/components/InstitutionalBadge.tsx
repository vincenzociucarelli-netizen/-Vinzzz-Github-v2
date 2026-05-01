/**
 * InstitutionalBadge
 *
 * Small inline badge to render next to the name of an account intestato alla
 * società (NOT a physical person). Used to make it visually obvious that
 * "Pallavolo Perugia" is the society's email-account, not a real dirigente
 * or LR.
 *
 * Two ways to use:
 *   <InstitutionalBadge />             -> renders if the *current logged-in*
 *                                        user is institutional (auto)
 *   <InstitutionalBadge fullName=".." email=".." societyEmail=".." />
 *                                       -> evaluates the heuristic against
 *                                        any user (e.g., row in a list)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import { useAuthStore } from '../store/authStore';

const SOCIETY_PATTERNS = [
  'SSD', 'S.S.D', 'SRL', 'S.R.L', 'SPA', 'S.P.A', 'ASD', 'A.S.D',
  'APS', 'A.P.S', 'APD', 'A.P.D', 'ONLUS', 'ETS', 'E.T.S',
  'COOPERATIVA', 'SOCIETA', 'SOCIETÀ', 'ASSOCIAZIONE', 'A RL',
];

export function looksLikeInstitutional(
  fullName?: string,
  email?: string,
  societyEmail?: string,
  societyPec?: string,
): boolean {
  const n = (fullName || '').toUpperCase();
  if (n && SOCIETY_PATTERNS.some(p => n.includes(p))) return true;
  const e = (email || '').toLowerCase().trim();
  const se = (societyEmail || '').toLowerCase().trim();
  const sp = (societyPec || '').toLowerCase().trim();
  if (e && (e === se || e === sp)) return true;
  return false;
}

interface Props {
  fullName?: string;
  email?: string;
  societyEmail?: string;
  societyPec?: string;
  size?: 'sm' | 'md';
}

export default function InstitutionalBadge({
  fullName,
  email,
  societyEmail,
  societyPec,
  size = 'sm',
}: Props) {
  const { user } = useAuthStore();
  // If no overrides given, check the current logged-in user
  const isInstitutional =
    fullName === undefined && email === undefined
      ? Boolean((user as any)?.is_institutional_account)
      : looksLikeInstitutional(fullName, email, societyEmail, societyPec);
  if (!isInstitutional) return null;
  const isMd = size === 'md';
  return (
    <View style={[styles.badge, isMd && styles.badgeMd]} data-testid="institutional-badge-inline">
      <Ionicons name="business" size={isMd ? 12 : 10} color="#C62828" />
      <Text style={[styles.text, isMd && styles.textMd]}>ACC. ISTITUZIONALE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#EF9A9A',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  text: {
    color: '#C62828',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  textMd: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
