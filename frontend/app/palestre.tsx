import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SocietyBranding from '../src/components/SocietyBranding';

/**
 * Pagina pubblica (autenticati) con la mappa Google My Maps delle palestre
 * utilizzate per i campionati della società.
 *
 * Mappa gestita centralmente su Google My Maps (vincenzo.ciucarelli@gmail.com)
 * — si aggiorna live senza dover deployare l'app.
 */
const MAP_EMBED_URL =
  'https://www.google.com/maps/d/embed?mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c&ehbc=2E312F';
const MAP_OPEN_URL =
  'https://www.google.com/maps/d/viewer?mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c';

export default function PalestrePage() {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isNarrow = width < 600;
  const mapHeight = isNarrow ? 460 : 620;

  const openOnGoogle = () => {
    Linking.openURL(MAP_OPEN_URL).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            data-testid="palestre-back-btn"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>🏟️ Palestre</Text>
            <Text style={styles.headerSubtitle}>
              Mappa dei palazzetti utilizzati per i campionati
            </Text>
          </View>
        </View>
        <SocietyBranding light logoSize={28} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#C62828" />
          <Text style={styles.infoText}>
            Mappa centralizzata di tutte le palestre dove giocano le nostre
            squadre. Tocca un pin per vedere indirizzo e dettagli, oppure apri
            la mappa su Google per la navigazione GPS.
          </Text>
        </View>

        {/* Map embed */}
        <View style={[styles.mapCard, { height: mapHeight }]}>
          {Platform.OS === 'web' ? (
            // @ts-ignore — iframe è un elemento HTML, non React Native
            <iframe
              src={MAP_EMBED_URL}
              style={{
                width: '100%',
                height: '100%',
                border: 0,
                borderRadius: 12,
              }}
              loading="lazy"
              title="Mappa Palestre"
              data-testid="palestre-map-iframe"
            />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name="map-outline" size={48} color="#999" />
              <Text style={styles.fallbackText}>
                Per visualizzare la mappa, apri RegistraTEAM nel browser oppure
                tocca il pulsante qui sotto.
              </Text>
            </View>
          )}
        </View>

        {/* CTA Apri in Google Maps */}
        <TouchableOpacity
          style={styles.ctaPrimary}
          onPress={openOnGoogle}
          data-testid="palestre-open-google-maps"
        >
          <Ionicons name="open-outline" size={20} color="#fff" />
          <Text style={styles.ctaPrimaryText}>Apri in Google Maps</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Mappa gestita dalla società. Per aggiungere o modificare una palestra,
          contatta il dirigente referente.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    backgroundColor: '#C62828',
    paddingTop: Platform.OS === 'web' ? 24 : 50,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: { padding: 16, paddingBottom: 48 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  infoText: { flex: 1, fontSize: 13, color: '#5a1a1a', lineHeight: 18 },
  mapCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  fallbackText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C62828',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  ctaPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
