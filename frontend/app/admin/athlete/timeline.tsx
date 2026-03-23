import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';

interface TimelineEvent {
  type: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  date: string;
  detail?: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.substring(0, 10);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr.substring(0, 10);
  }
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function AdminAthleteTimeline() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [athleteName, setAthleteName] = useState('');
  const [athleteStatus, setAthleteStatus] = useState('');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const loadTimeline = async () => {
    try {
      setError('');
      const res = await api.get(`/athletes/${id}/timeline`);
      setAthleteName(res.data.athlete_name || '');
      setAthleteStatus(res.data.athlete_status || '');
      setEvents(res.data.events || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Errore nel caricamento della cronologia');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) loadTimeline();
  }, [id]);

  const statusLabel: Record<string, string> = { active: 'Attivo', trial: 'In Prova', inactive: 'Inattivo', deletion_requested: 'Cancellazione Richiesta' };
  const statusColor: Record<string, string> = { active: '#34C759', trial: '#FF9500', inactive: '#8E8E93', deletion_requested: '#FF3B30' };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Caricamento cronologia...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadTimeline}>
          <Text style={styles.retryText}>Riprova</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const groupedEvents: { date: string; items: TimelineEvent[] }[] = [];
  let lastDate = '';
  for (const ev of events) {
    const evDate = ev.date ? ev.date.substring(0, 10) : '';
    if (evDate !== lastDate) {
      groupedEvents.push({ date: evDate, items: [ev] });
      lastDate = evDate;
    } else {
      groupedEvents[groupedEvents.length - 1].items.push(ev);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="timeline-back-btn">
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSubtitle}>Cronologia</Text>
          <Text style={styles.headerTitle}>{athleteName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: (statusColor[athleteStatus] || '#8E8E93') + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor[athleteStatus] || '#8E8E93' }]} />
          <Text style={[styles.statusText, { color: statusColor[athleteStatus] || '#8E8E93' }]}>
            {statusLabel[athleteStatus] || athleteStatus}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTimeline(); }} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{events.length}</Text>
          <Text style={styles.summaryLabel}>eventi registrati</Text>
        </View>

        {groupedEvents.map((group, gi) => (
          <View key={gi}>
            <View style={styles.dateHeader}>
              <View style={styles.dateLine} />
              <Text style={styles.dateText}>{formatDate(group.date)}</Text>
              <View style={styles.dateLine} />
            </View>
            {group.items.map((ev, ei) => {
              const eventKey = `${gi}-${ei}`;
              const isExpanded = expandedEvents.has(eventKey);
              const toggleExpand = () => {
                setExpandedEvents(prev => {
                  const next = new Set(prev);
                  if (next.has(eventKey)) next.delete(eventKey); else next.add(eventKey);
                  return next;
                });
              };
              return (
                <TouchableOpacity key={eventKey} style={styles.eventRow} onPress={toggleExpand} activeOpacity={0.7}>
                  <View style={styles.timelineColumn}>
                    {(gi > 0 || ei > 0) && <View style={styles.lineUp} />}
                    <View style={[styles.iconCircle, { backgroundColor: ev.color + '18', borderColor: ev.color }]}>
                      <Ionicons name={ev.icon as any} size={18} color={ev.color} />
                    </View>
                    {(gi < groupedEvents.length - 1 || ei < group.items.length - 1) && <View style={[styles.lineDown, !isExpanded && { minHeight: 6 }]} />}
                  </View>
                  <View style={[styles.eventContent, !isExpanded && styles.eventContentCollapsed]}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventTitle} numberOfLines={isExpanded ? undefined : 1}>{ev.title}</Text>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#bbb" />
                    </View>
                    {isExpanded && (
                      <>
                        <Text style={styles.eventDesc}>{ev.description}</Text>
                        {ev.detail && <Text style={styles.eventDetail}>{ev.detail}</Text>}
                        {formatTime(ev.date) ? <Text style={styles.eventTime}>{formatTime(ev.date)}</Text> : null}
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="time" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun evento registrato</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { marginTop: 12, fontSize: 16, color: '#FF3B30', textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 10 },
  backBtn: { padding: 8 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  summaryNumber: { fontSize: 32, fontWeight: '800', color: '#007AFF' },
  summaryLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 8, gap: 10 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dateText: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase' },
  eventRow: { flexDirection: 'row', marginBottom: 0 },
  timelineColumn: { width: 44, alignItems: 'center' },
  lineUp: { width: 2, height: 12, backgroundColor: '#ddd' },
  lineDown: { width: 2, flex: 1, backgroundColor: '#ddd', minHeight: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  eventContent: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginLeft: 8, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  eventContentCollapsed: { paddingVertical: 8, paddingHorizontal: 12, marginBottom: 4 },
  eventTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  eventDesc: { fontSize: 12, color: '#666', marginTop: 3, lineHeight: 17 },
  eventDetail: { fontSize: 11, color: '#007AFF', marginTop: 4, fontWeight: '600' },
  eventTime: { fontSize: 11, color: '#aaa', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#ccc', marginTop: 12 },
});
