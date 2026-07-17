import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import SocietyBranding from '../../src/components/SocietyBranding';

/**
 * 🆕 26/07/2026 — Hub Zaino Genitore per Staff (dirigente/coach/collab/admin)
 * Due flussi:
 *   A) Ho un figlio GIÀ iscritto in questa società → /parent/link-athlete
 *   B) Iscrivi un figlio NUOVO → /staff/register-child (wizard)
 */
export default function LinkOrRegisterChildPage() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} data-testid="lorc-back-btn">
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#8E24AA" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <SocietyBranding />
          <Text style={styles.headerTitle}>I miei figli</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.intro}>
          <Ionicons name="people" size={32} color="#8E24AA" />
          <Text style={styles.introTitle}>Sei anche genitore di un atleta?</Text>
          <Text style={styles.introSubtitle}>
            Collega il tuo profilo staff al tuo bambino per accedere alle sue informazioni,
            pagamenti, presenze e certificati.
          </Text>
        </View>

        {/* Opzione A: figlio già iscritto */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/parent/link-athlete')}
          data-testid="lorc-link-existing-btn"
        >
          <View style={[styles.iconWrap, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="search" size={28} color="#1565C0" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Ho un figlio già iscritto</Text>
            <Text style={styles.cardDesc}>
              Cerca tuo/a figlio/a nella lista atleti della società. Se ha già un genitore
              collegato (es. il coniuge) verrà inviata una richiesta di conferma.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        {/* Opzione B: figlio nuovo */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/staff/register-child')}
          data-testid="lorc-register-new-btn"
        >
          <View style={[styles.iconWrap, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="person-add" size={28} color="#EF6C00" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Iscrivi un figlio nuovo</Text>
            <Text style={styles.cardDesc}>
              Il tuo bambino non è ancora nella società? Compila una scheda anagrafica
              completa e verrà collegato subito al tuo account come genitore.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <View style={styles.hintBox}>
            <Ionicons name="information-circle" size={18} color="#1565C0" />
            <Text style={styles.hintText}>
              Puoi passare tra la modalità Staff e la modalità Genitore in qualunque momento
              dalla dashboard principale.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#F3E5F5', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#4A148C' },
  content: { flex: 1 },
  intro: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  introTitle: { fontSize: 20, fontWeight: '700', color: '#4A148C', textAlign: 'center' },
  introSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: '#eee',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  hintBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginTop: 12,
  },
  hintText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 17 },
});
