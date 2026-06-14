/**
 * 🆕 13/06/2026 — PAGINA COMPENSI UNIFICATA Doppio Ruolo
 *
 * Step 1 (13/06): Riepilogo Compensi unificato Coach+Atleta con quartili.
 * Step 2 (14/06): + Calendario mensile colorato (verde/arancio/viola) + Box "Già Percepito" coach.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '../../../../src/components/Icon';
import api from '../../../../src/services/api';
import PersonCompensationSummary from '../../../../src/components/admin/PersonCompensationSummary';
import CoachReceiptsSummary from '../../../../src/components/admin/CoachReceiptsSummary';

export default function PersonaCompensiPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<{ user_id: string | null; has_coach_role: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/persons/${id}/profile`)
      .then(res => setProfile({
        user_id: res.data?.user_id || null,
        has_coach_role: !!res.data?.has_coach_role,
      }))
      .catch(() => setProfile(null));
  }, [id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow} testID="back-button">
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💰 Compensi Doppio Ruolo</Text>
        <Text style={styles.headerSubtitle}>Riepilogo unificato Atleta PRO + Coach</Text>
      </View>

      <View style={styles.body}>
        {id && (
          <PersonCompensationSummary
            personId={id}
            initialYear={new Date().getFullYear()}
          />
        )}

        {/* 🆕 14/06/2026 — Riepilogo "Già Percepito" Coach con modal quietanze */}
        {profile?.has_coach_role && profile.user_id && (
          <CoachReceiptsSummary coachUserId={profile.user_id} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  header: {
    backgroundColor: '#2E7D32',
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 30 : 50,
    paddingBottom: 22,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  backArrow: { position: 'absolute', top: Platform.OS === 'web' ? 22 : 42, left: 10, padding: 8, zIndex: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 6 },
  headerSubtitle: { fontSize: 12, color: '#E8F5E9', textAlign: 'center', marginTop: 4 },
  body: { padding: 12 },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  csTitle: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  csSub: { fontSize: 12, color: '#1A5276', marginTop: 4, lineHeight: 17 },
});
