/**
 * 🆕 Igiene Dati (Admin)
 * Pannello di sola lettura che elenca le anomalie anagrafiche della società
 * (CF mancante/duplicato, orfani, minorenni senza genitore, ecc.). Toccando
 * un atleta si apre la sua scheda per correggere il dato.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface Item {
  athlete_id: string | null;
  user_id?: string;
  name: string;
  team_name: string;
  status: string;
  detail: string;
}
interface Check {
  key: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  items: Item[];
}

const SEV: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  high: { label: 'Critico', color: '#C62828', bg: '#FFEBEE', icon: 'alert-circle' },
  medium: { label: 'Da verificare', color: '#EF6C00', bg: '#FFF3E0', icon: 'warning' },
  low: { label: 'Minore', color: '#546E7A', bg: '#ECEFF1', icon: 'information-circle' },
};

export default function DataHygieneScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ summary: any; checks: Check[]; generated_at: string } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get('/admin/data-hygiene');
      setData(res.data);
    } catch (e: any) {
      console.error('Errore igiene dati:', e);
      setError(e?.response?.data?.detail || 'Impossibile analizzare i dati');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const summary = data?.summary;
  const withIssues = (data?.checks || []).filter((c) => c.count > 0);
  const clean = (data?.checks || []).filter((c) => c.count === 0);

  return (
    <View style={styles.container} data-testid="data-hygiene-page">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Igiene Dati</Text>
          <Text style={styles.headerSubtitle}>Anomalie anagrafiche da correggere</Text>
        </View>
        <Ionicons name="search" size={24} color="#fff" />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#AD1457" size="large" />
          <Text style={styles.muted}>Analisi in corso…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={40} color="#C62828" />
          <Text style={[styles.muted, { marginTop: 8 }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }} testID="retry-btn">
            <Text style={styles.retryText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Riepilogo */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard} testID="summary-athletes">
              <Text style={styles.summaryNum}>{summary?.total_athletes ?? 0}</Text>
              <Text style={styles.summaryLbl}>Atleti analizzati</Text>
            </View>
            <View style={[styles.summaryCard, (summary?.total_issues ?? 0) > 0 ? styles.summaryBad : styles.summaryGood]} testID="summary-issues">
              <Text style={[styles.summaryNum, { color: (summary?.total_issues ?? 0) > 0 ? '#C62828' : '#2E7D32' }]}>
                {summary?.total_issues ?? 0}
              </Text>
              <Text style={styles.summaryLbl}>Anomalie trovate</Text>
            </View>
          </View>

          {withIssues.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>Tutto in ordine</Text>
              <Text style={styles.muted}>Nessuna anomalia negli anagrafici della società.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Da sistemare</Text>
              {withIssues.map((c) => {
                const sev = SEV[c.severity];
                const isOpen = !!open[c.key];
                return (
                  <View key={c.key} style={[styles.card, { borderLeftColor: sev.color }]} testID={`check-${c.key}`}>
                    <TouchableOpacity style={styles.cardHead} onPress={() => toggle(c.key)} activeOpacity={0.7} testID={`toggle-${c.key}`}>
                      <View style={[styles.sevIcon, { backgroundColor: sev.bg }]}>
                        <Ionicons name={sev.icon} size={20} color={sev.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{c.title}</Text>
                        <Text style={styles.cardDesc}>{c.description}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: sev.color }]}>
                        <Text style={styles.countText}>{c.count}</Text>
                      </View>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#90A4AE" />
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={styles.items}>
                        {c.items.map((it, idx) => (
                          <TouchableOpacity
                            key={`${c.key}-${it.athlete_id || it.user_id || idx}`}
                            style={styles.itemRow}
                            disabled={!it.athlete_id}
                            onPress={() => it.athlete_id && router.push(`/admin/athlete/${it.athlete_id}` as any)}
                            testID={`item-${c.key}-${idx}`}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemName}>{it.name}</Text>
                              <Text style={styles.itemMeta}>
                                {[it.team_name, it.detail].filter(Boolean).join(' · ')}
                              </Text>
                            </View>
                            {it.athlete_id ? <Ionicons name="chevron-forward" size={16} color="#B0BEC5" /> : null}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {clean.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Controlli superati</Text>
              <View style={styles.cleanBox}>
                {clean.map((c) => (
                  <View key={c.key} style={styles.cleanRow} testID={`clean-${c.key}`}>
                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                    <Text style={styles.cleanText}>{c.title}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#AD1457',
    paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 16, paddingHorizontal: 14, gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#F8BBD0', fontSize: 12, marginTop: 2 },
  center: { padding: 40, alignItems: 'center' },
  muted: { marginTop: 10, color: '#666', fontSize: 13, textAlign: 'center' },
  retryBtn: { marginTop: 14, backgroundColor: '#AD1457', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  summaryBad: { borderColor: '#FFCDD2', backgroundColor: '#FFF8F8' },
  summaryGood: { borderColor: '#C8E6C9', backgroundColor: '#F6FFF7' },
  summaryNum: { fontSize: 28, fontWeight: '800', color: '#263238' },
  summaryLbl: { fontSize: 12, color: '#607D8B', marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#78909C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee', borderLeftWidth: 4, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  sevIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#263238' },
  cardDesc: { fontSize: 12, color: '#607D8B', marginTop: 2, lineHeight: 16 },
  countBadge: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  items: { borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 8, minHeight: 48 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#333' },
  itemMeta: { fontSize: 12, color: '#777', marginTop: 2 },
  emptyBox: { alignItems: 'center', padding: 36, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#C8E6C9' },
  emptyEmoji: { fontSize: 44, marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#2E7D32' },
  cleanBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', paddingVertical: 4 },
  cleanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  cleanText: { fontSize: 13, color: '#455A64' },
});
