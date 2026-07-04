/**
 * 🆕 03/07/2026 — Diagnostica active_seasons
 *
 * Pagina admin-only che chiama /api/seasons/diagnose e mostra:
 * - Come sono distribuiti gli `active_seasons` fra atleti, teams e users.
 * - Utile per capire perché le liste operative o gli archivi possono apparire vuoti.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';

interface Bucket { total: number; by_active_seasons: Record<string, number>; }
interface DiagnoseResp {
  society_id: string;
  current_season: string;
  athletes: Bucket;
  teams: Bucket;
  users_by_role: Record<string, Bucket>;
}

function BucketBox({ title, data, currentSeason }: { title: string; data: Bucket; currentSeason: string }) {
  const keys = Object.keys(data.by_active_seasons || {}).sort();
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{title}</Text>
      <Text style={styles.boxTotal}>Totale: <Text style={{ fontWeight: '700' }}>{data.total}</Text></Text>
      {keys.length === 0 && <Text style={styles.empty}>(nessun elemento)</Text>}
      {keys.map(k => {
        const isCurrent = k === currentSeason || k.split('|').includes(currentSeason);
        const isMissing = k === 'MISSING' || k === 'EMPTY_LIST' || k.startsWith('NOT_LIST');
        return (
          <View key={k} style={styles.row}>
            <View style={[styles.pill, isMissing ? styles.pillMissing : (isCurrent ? styles.pillCurrent : styles.pillPast)]}>
              <Text style={[styles.pillText, isMissing ? styles.pillTextMissing : (isCurrent ? styles.pillTextCurrent : styles.pillTextPast)]}>
                {k === 'MISSING' ? 'CAMPO ASSENTE' : k === 'EMPTY_LIST' ? 'ARRAY VUOTO' : k}
              </Text>
            </View>
            <Text style={styles.rowCount}>{data.by_active_seasons[k]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function DiagnoseScreen() {
  const router = useRouter();
  const [data, setData] = useState<DiagnoseResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get('/seasons/diagnose');
      setData(r.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Errore');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
          <View style={styles.roundBtn}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔬 Diagnostica active_seasons</Text>
        <TouchableOpacity onPress={load}>
          <View style={styles.roundBtn}><Ionicons name="refresh" size={22} color="#007AFF" /></View>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
        {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />}
        {error && <Text style={styles.errorText}>❌ {error}</Text>}
        {data && (
          <>
            <View style={styles.currentSeasonBox}>
              <Text style={styles.currentSeasonLabel}>Stagione corrente:</Text>
              <Text style={styles.currentSeasonValue}>{data.current_season}</Text>
            </View>
            <Text style={styles.legend}>
              🟢 verde = utenti nella stagione corrente · 🟡 giallo = altre stagioni · 🔴 rosso = campo mancante/vuoto (da fixare)
            </Text>
            <BucketBox title="🏐 Atleti" data={data.athletes} currentSeason={data.current_season} />
            <BucketBox title="👥 Squadre" data={data.teams} currentSeason={data.current_season} />
            {Object.keys(data.users_by_role).map(role => (
              <BucketBox
                key={role}
                title={`👤 Utenti — ${role}`}
                data={data.users_by_role[role]}
                currentSeason={data.current_season}
              />
            ))}
            <Text style={styles.footerNote}>
              🆔 Society ID: {data.society_id}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1, textAlign: 'center' },
  roundBtn: { backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  content: { flex: 1 },
  currentSeasonBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 12 },
  currentSeasonLabel: { fontSize: 13, color: '#1B5E20', marginRight: 8 },
  currentSeasonValue: { fontSize: 15, fontWeight: '700', color: '#1B5E20' },
  legend: { fontSize: 11, color: '#666', fontStyle: 'italic', marginBottom: 10 },
  box: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10 },
  boxTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  boxTotal: { fontSize: 12, color: '#666', marginBottom: 8 },
  empty: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flex: 1, marginRight: 8 },
  pillCurrent: { backgroundColor: '#E8F5E9' },
  pillPast: { backgroundColor: '#FFF8E1' },
  pillMissing: { backgroundColor: '#FFEBEE' },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillTextCurrent: { color: '#1B5E20' },
  pillTextPast: { color: '#F57C00' },
  pillTextMissing: { color: '#C62828' },
  rowCount: { fontSize: 14, fontWeight: '700', color: '#333', minWidth: 30, textAlign: 'right' },
  errorText: { color: '#C62828', fontSize: 14, textAlign: 'center', marginTop: 20 },
  footerNote: { fontSize: 10, color: '#999', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
});
