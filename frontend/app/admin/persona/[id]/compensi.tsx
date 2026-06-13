/**
 * 🆕 13/06/2026 — PAGINA COMPENSI UNIFICATA Doppio Ruolo
 *
 * Step 1 (questa sessione): Mostra il Riepilogo Compensi unificato Coach+Atleta
 * con la regola dei Quartili Settimanali. Riusa il componente PersonCompensationSummary.
 *
 * Step 2/3 (prossime sessioni): aggiungeremo qui:
 *  - Colori dinamici dei box (verde/arancio/viola/azzurro)
 *  - Calendario mensilità colorato
 *  - Storico quietanze unificato Atleta + Coach
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '../../../../src/components/Icon';
import PersonCompensationSummary from '../../../../src/components/admin/PersonCompensationSummary';

export default function PersonaCompensiPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

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

        <View style={styles.comingSoon}>
          <Ionicons name="construct" size={22} color="#1565C0" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.csTitle}>Calendario mensilità colorato</Text>
            <Text style={styles.csSub}>
              In arrivo: caselle verde/arancio/viola/azzurro per ogni mese del contratto
              con stato quietanza e soglie €5K / €15K.
            </Text>
          </View>
        </View>
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
