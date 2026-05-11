import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function IscrizioniPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const api = axios.create({ baseURL: `${API_URL}/api`, headers: { Authorization: `Bearer ${token}` } });
      const res = await api.get('/athletes/registrations-history');
      const regs = res.data?.registrations || [];
      setRegistrations(regs);
      
      // Auto-expand today's date
      const today = new Date().toISOString().split('T')[0];
      const dates: Record<string, boolean> = {};
      const uniqueDates = [...new Set(regs.map((r: any) => r.date))];
      uniqueDates.forEach((d: any) => { dates[d] = d === today; });
      setExpandedDates(dates);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Oggi';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Ieri';
    
    const days = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'];
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Group by date
  const grouped: Record<string, any[]> = {};
  registrations.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Iscrizioni Atleti</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{registrations.length}</Text>
            <Text style={styles.summaryLabel}>Totali</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#FF9800' }]}>{registrations.filter(r => !r.has_team).length}</Text>
            <Text style={styles.summaryLabel}>Da assegnare</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>{registrations.filter(r => r.has_team).length}</Text>
            <Text style={styles.summaryLabel}>Assegnati</Text>
          </View>
        </View>

        {/* Toggle all button */}
        {sortedDates.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              const anyExpanded = Object.values(expandedDates).some(v => v);
              const newState: Record<string, boolean> = {};
              sortedDates.forEach(d => { newState[d] = !anyExpanded; });
              setExpandedDates(newState);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginBottom: 10 }}
          >
            <Ionicons name={Object.values(expandedDates).some(v => v) ? "contract-outline" : "expand-outline"} size={16} color="#1565C0" />
            <Text style={{ fontSize: 13, color: '#1565C0', fontWeight: '600' }}>
              {Object.values(expandedDates).some(v => v) ? 'Chiudi tutti' : 'Espandi tutti'}
            </Text>
          </TouchableOpacity>
        )}

        {sortedDates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna iscrizione registrata</Text>
          </View>
        ) : (
          sortedDates.map(date => {
            const athletes = grouped[date];
            const isExpanded = expandedDates[date] ?? false;
            const unassigned = athletes.filter(a => !a.has_team).length;
            
            return (
              <View key={date} style={styles.dateCard}>
                <TouchableOpacity style={styles.dateHeader} onPress={() => toggleDate(date)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateTitle}>{formatDate(date)}</Text>
                    <Text style={styles.dateSubtitle}>
                      {athletes.length} iscrizioni{unassigned > 0 ? ` - ${unassigned} da assegnare` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{athletes.length}</Text>
                    </View>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                  </View>
                </TouchableOpacity>

                {isExpanded && athletes.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => router.push(`/admin/athlete/${a.id}`)}
                    style={styles.athleteRow}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.athleteName}>{a.full_name}</Text>
                        {a.is_minor && (
                          <View style={styles.minorBadge}>
                            <Text style={styles.minorBadgeText}>18-</Text>
                          </View>
                        )}
                      </View>
                      {a.parent_name && (
                        <Text style={styles.parentText}>
                          Iscritto da: {a.parent_name}
                          {a.second_parent_name ? ` / ${a.second_parent_name}` : ''}
                        </Text>
                      )}
                    </View>
                    {a.has_team ? (
                      <View style={styles.teamAssigned}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.teamAssignedText}>{a.team_name || 'Assegnato'}</Text>
                      </View>
                    ) : (
                      <View style={styles.teamPending}>
                        <Ionicons name="alert-circle-outline" size={16} color="#FF9800" />
                        <Text style={styles.teamPendingText}>Da assegnare</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1565C0',
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  content: { flex: 1, padding: 16 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  summaryItem: { alignItems: 'center' },
  summaryNumber: { fontSize: 24, fontWeight: '800', color: '#1565C0' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#E0E0E0' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#999', marginTop: 10 },
  dateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  dateTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  dateSubtitle: { fontSize: 11, color: '#888', marginTop: 2 },
  countBadge: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  athleteName: { fontSize: 14, fontWeight: '600', color: '#333' },
  minorBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  minorBadgeText: { color: '#1565C0', fontSize: 9, fontWeight: '700' },
  parentText: { fontSize: 11, color: '#888', marginTop: 2 },
  teamAssigned: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamAssignedText: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },
  teamPending: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamPendingText: { fontSize: 11, color: '#FF9800', fontWeight: '600' },
});
