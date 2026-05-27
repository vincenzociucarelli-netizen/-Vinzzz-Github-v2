import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocietyBranding from '../src/components/SocietyBranding';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Palestra = {
  name: string;
  address: string;
  description: string;
  lat: number;
  lng: number;
  google_maps_url: string;
};

const MAP_EMBED_URL =
  'https://www.google.com/maps/d/embed?mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c&ehbc=2E312F';
const MAP_OPEN_URL =
  'https://www.google.com/maps/d/viewer?mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c';

export default function PalestrePage() {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isNarrow = width < 600;
  const mapHeight = isNarrow ? 380 : 520;

  const [palestre, setPalestre] = useState<Palestra[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const r = await fetch(`${API}/api/palestre/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        setPalestre(data.palestre || []);
      } catch (e) {
        console.warn('palestre list error', e);
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return palestre;
    return palestre.filter((p) =>
      `${p.name} ${p.address} ${p.description}`.toLowerCase().includes(q),
    );
  }, [palestre, search]);

  const openOnGoogle = () => {
    Linking.openURL(MAP_OPEN_URL).catch(() => {});
  };

  const openPalestra = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
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
              {palestre.length > 0
                ? `${palestre.length} palestre disponibili`
                : 'Mappa dei palazzetti dei campionati'}
            </Text>
          </View>
        </View>
        <SocietyBranding light logoSize={28} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#888" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca per nome o località (es. spoleto, palasport, foligno…)"
            placeholderTextColor="#999"
            data-testid="palestre-search-input"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} data-testid="palestre-search-clear">
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Map embed */}
        <View style={[styles.mapCard, { height: mapHeight }]}>
          {Platform.OS === 'web' ? (
            // @ts-ignore — iframe è un elemento HTML
            <iframe
              src={MAP_EMBED_URL}
              style={{ width: '100%', height: '100%', border: 0, borderRadius: 12 }}
              loading="lazy"
              title="Mappa Palestre"
              data-testid="palestre-map-iframe"
            />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name="map-outline" size={48} color="#999" />
              <Text style={styles.fallbackText}>
                Per visualizzare la mappa interattiva, apri RegistraTEAM nel browser oppure
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
          <Text style={styles.ctaPrimaryText}>Apri mappa in Google Maps</Text>
        </TouchableOpacity>

        {/* Lista palestre */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            📍 Lista palestre {search ? `(${filtered.length})` : `(${palestre.length})`}
          </Text>
          {search && filtered.length !== palestre.length && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearText}>Mostra tutte</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingList ? (
          <ActivityIndicator color="#C62828" style={{ marginVertical: 30 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={36} color="#aaa" />
            <Text style={styles.emptyText}>
              {search
                ? `Nessuna palestra trovata per "${search}"`
                : 'Nessuna palestra disponibile al momento.'}
            </Text>
          </View>
        ) : (
          filtered.map((p, idx) => (
            <TouchableOpacity
              key={`${p.lat}-${p.lng}-${idx}`}
              style={styles.palestraCard}
              onPress={() => openPalestra(p.google_maps_url)}
              data-testid={`palestra-card-${idx}`}
            >
              <View style={styles.palestraIcon}>
                <Ionicons name="location" size={22} color="#C62828" />
              </View>
              <View style={styles.palestraInfo}>
                <Text style={styles.palestraName} numberOfLines={2}>
                  {p.name}
                </Text>
                {!!p.address && (
                  <Text style={styles.palestraAddress} numberOfLines={2}>
                    {p.address}
                  </Text>
                )}
                {!p.address && !!p.description && (
                  <Text style={styles.palestraAddress} numberOfLines={2}>
                    {p.description}
                  </Text>
                )}
              </View>
              <View style={styles.palestraAction}>
                <Ionicons name="navigate" size={18} color="#1976D2" />
                <Text style={styles.palestraActionText}>Naviga</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.disclaimer}>
          Mappa centralizzata Umbria. Per aggiungere o modificare una palestra, contatta il
          dirigente referente della Pallavolo Perugia (gestore della mappa condivisa).
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#222', padding: 0 },
  mapCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginBottom: 14,
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  fallbackText: { textAlign: 'center', color: '#666', fontSize: 14, lineHeight: 20 },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C62828',
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 18,
  },
  ctaPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  clearText: { color: '#1976D2', fontSize: 13, fontWeight: '600' },
  emptyCard: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  palestraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  palestraIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  palestraInfo: { flex: 1 },
  palestraName: { fontSize: 14, fontWeight: '700', color: '#222' },
  palestraAddress: { fontSize: 12, color: '#666', marginTop: 3, lineHeight: 16 },
  palestraAction: { alignItems: 'center', paddingLeft: 8 },
  palestraActionText: { fontSize: 11, color: '#1976D2', fontWeight: '600', marginTop: 2 },
  disclaimer: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
