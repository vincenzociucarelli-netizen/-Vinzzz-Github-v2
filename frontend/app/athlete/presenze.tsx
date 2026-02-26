import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { useAuthStore } from '../../src/store/authStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Attendance {
  id: string;
  check_in_time: string;
  athlete_id: string;
  event_type?: string;
}

interface AttendanceStats {
  total_attendances: number;
  weekly_attendances: number;
  monthly_attendances: number;
  total_percentage: number;
  weekly_percentage: number;
  monthly_percentage: number;
}

export default function AthletePresenze() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const loadData = async () => {
    try {
      // Get athlete profile
      const meRes = await api.get('/auth/me');
      const athleteId = meRes.data.athlete_id;
      
      if (athleteId) {
        setProfile(meRes.data);
        
        // Get attendance history
        try {
          const attendanceRes = await api.get(`/attendance/${athleteId}`);
          setAttendances(attendanceRes.data || []);
        } catch (e) {
          console.log('No attendance data');
          setAttendances([]);
        }
        
        // Get stats if team exists
        if (meRes.data.team_id) {
          try {
            const statsRes = await api.get(`/teams/${meRes.data.team_id}/attendance-stats`);
            const myStats = statsRes.data?.find((s: any) => s.athlete_id === athleteId);
            if (myStats) {
              setStats(myStats);
            }
          } catch (e) {
            console.log('No stats available');
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "EEEE d MMMM yyyy", { locale: it });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "HH:mm", { locale: it });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Presenze e Statistiche</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />}
      >
        {/* Statistics Section */}
        <Text style={styles.sectionTitle}>Le Tue Statistiche</Text>
        
        {stats ? (
          <View style={styles.statsContainer}>
            {/* Main percentage */}
            <View style={styles.mainStatCard}>
              <View style={styles.percentageCircle}>
                <Text style={styles.percentageText}>{stats.total_percentage}%</Text>
              </View>
              <Text style={styles.mainStatLabel}>Presenze Totali</Text>
              <Text style={styles.mainStatSubtext}>{stats.total_attendances} allenamenti</Text>
            </View>
            
            {/* Secondary stats */}
            <View style={styles.secondaryStatsRow}>
              <View style={styles.secondaryStatCard}>
                <Ionicons name="calendar" size={24} color="#4CAF50" />
                <Text style={styles.secondaryStatValue}>{stats.weekly_percentage}%</Text>
                <Text style={styles.secondaryStatLabel}>Questa settimana</Text>
                <Text style={styles.secondaryStatSubtext}>{stats.weekly_attendances} presenze</Text>
              </View>
              
              <View style={styles.secondaryStatCard}>
                <Ionicons name="calendar-outline" size={24} color="#2196F3" />
                <Text style={styles.secondaryStatValue}>{stats.monthly_percentage}%</Text>
                <Text style={styles.secondaryStatLabel}>Questo mese</Text>
                <Text style={styles.secondaryStatSubtext}>{stats.monthly_attendances} presenze</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="stats-chart-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Statistiche non disponibili</Text>
            <Text style={styles.emptySubtext}>Le statistiche appariranno quando ci saranno presenze registrate</Text>
          </View>
        )}

        {/* Attendance History */}
        <Text style={styles.sectionTitle}>Storico Presenze</Text>
        
        {attendances.length > 0 ? (
          <View style={styles.historyContainer}>
            {attendances.slice(0, 20).map((att, index) => (
              <View key={att.id || index} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyDate}>{formatDate(att.check_in_time)}</Text>
                  <Text style={styles.historyTime}>Check-in: {formatTime(att.check_in_time)}</Text>
                </View>
                <View style={styles.presentBadge}>
                  <Text style={styles.presentBadgeText}>Presente</Text>
                </View>
              </View>
            ))}
            
            {attendances.length > 20 && (
              <Text style={styles.moreText}>...e altre {attendances.length - 20} presenze</Text>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna presenza registrata</Text>
            <Text style={styles.emptySubtext}>Le tue presenze appariranno qui quando il coach registrerà i check-in</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  statsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  mainStatCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  percentageCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    borderWidth: 4,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4CAF50',
  },
  mainStatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  mainStatSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  secondaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  secondaryStatSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  historyContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyIcon: {
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  presentBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  moreText: {
    textAlign: 'center',
    padding: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
});
