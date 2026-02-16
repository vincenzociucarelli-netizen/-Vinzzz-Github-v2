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
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../../src/services/api';
import { Ionicons } from '../../../../src/components/Icon';

interface AthleteStats {
  athlete_id: string;
  athlete_name: string;
  total_attendances: number;
  weekly_attendances: number;
  monthly_attendances: number;
  expected_weekly: number;
  expected_monthly: number;
  expected_total: number;
  total_percentage: number;
  monthly_percentage: number;
  weekly_percentage: number;
}

interface TeamAttendanceStats {
  team_name: string;
  total_athletes: number;
  trainings_per_week: number;
  week_start: string;
  month_name: string;
  expected_weekly: number;
  expected_monthly: number;
  athletes: AthleteStats[];
}

export default function TeamAttendances() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [stats, setStats] = useState<TeamAttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'total'>('weekly');

  const loadStats = async () => {
    try {
      const response = await api.get(`/teams/${id}/attendance-stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading attendance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return '#34C759';
    if (percentage >= 50) return '#FF9500';
    return '#FF3B30';
  };

  const getPercentageIcon = (percentage: number) => {
    if (percentage >= 80) return 'checkmark-circle';
    if (percentage >= 50) return 'alert-circle';
    return 'close-circle';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Errore</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Impossibile caricare i dati</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registro Presenze</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Team Info */}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName}>{stats.team_name}</Text>
          <Text style={styles.teamAthletes}>{stats.total_athletes} atleti</Text>
        </View>

        {/* View Mode Selector */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'weekly' && styles.viewModeActive]}
            onPress={() => setViewMode('weekly')}
          >
            <Ionicons name="calendar-outline" size={16} color={viewMode === 'weekly' ? '#fff' : '#007AFF'} />
            <Text style={[styles.viewModeText, viewMode === 'weekly' && styles.viewModeTextActive]}>
              Settimana
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'monthly' && styles.viewModeActive]}
            onPress={() => setViewMode('monthly')}
          >
            <Ionicons name="calendar" size={16} color={viewMode === 'monthly' ? '#fff' : '#007AFF'} />
            <Text style={[styles.viewModeText, viewMode === 'monthly' && styles.viewModeTextActive]}>
              Mese
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'total' && styles.viewModeActive]}
            onPress={() => setViewMode('total')}
          >
            <Ionicons name="stats-chart" size={16} color={viewMode === 'total' ? '#fff' : '#007AFF'} />
            <Text style={[styles.viewModeText, viewMode === 'total' && styles.viewModeTextActive]}>
              Totale
            </Text>
          </TouchableOpacity>
        </View>

        {/* Period Info */}
        <View style={styles.periodInfo}>
          {viewMode === 'weekly' && (
            <Text style={styles.periodText}>
              Settimana dal {stats.week_start} ({stats.expected_weekly} allenamenti previsti)
            </Text>
          )}
          {viewMode === 'monthly' && (
            <Text style={styles.periodText}>
              {stats.month_name} ({stats.expected_monthly} allenamenti fino ad oggi)
            </Text>
          )}
          {viewMode === 'total' && (
            <Text style={styles.periodText}>Dall'inizio della stagione</Text>
          )}
        </View>

        {/* Athletes List */}
        {stats.athletes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun atleta in questa squadra</Text>
          </View>
        ) : (
          stats.athletes.map((athlete) => {
            const percentage = viewMode === 'weekly' 
              ? athlete.weekly_percentage 
              : viewMode === 'monthly' 
                ? athlete.monthly_percentage 
                : athlete.total_percentage;
            
            const attendances = viewMode === 'weekly'
              ? athlete.weekly_attendances
              : viewMode === 'monthly'
                ? athlete.monthly_attendances
                : athlete.total_attendances;

            const expected = viewMode === 'weekly'
              ? athlete.expected_weekly
              : viewMode === 'monthly'
                ? athlete.expected_monthly
                : athlete.expected_total;

            return (
              <View key={athlete.athlete_id} style={styles.athleteCard}>
                <View style={styles.athleteInfo}>
                  <Text style={styles.athleteName}>{athlete.athlete_name}</Text>
                  <View style={styles.attendanceInfo}>
                    <Ionicons 
                      name={getPercentageIcon(percentage)} 
                      size={16} 
                      color={getPercentageColor(percentage)} 
                    />
                    <Text style={styles.attendanceCount}>
                      {attendances} su {expected} allenamenti
                    </Text>
                  </View>
                </View>
                <View style={styles.percentageContainer}>
                  <View style={[styles.percentageCircle, { borderColor: getPercentageColor(percentage) }]}>
                    <Text style={[styles.percentageText, { color: getPercentageColor(percentage) }]}>
                      {percentage}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legenda</Text>
          <View style={styles.legendItem}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.legendText}>≥80% - Eccellente</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="alert-circle" size={16} color="#FF9500" />
            <Text style={styles.legendText}>50-79% - Sufficiente</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="close-circle" size={16} color="#FF3B30" />
            <Text style={styles.legendText}>&lt;50% - Insufficiente</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#5856D6',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    backgroundColor: '#5856D6',
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 16,
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  teamAthletes: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewModeActive: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  viewModeTextActive: {
    color: '#fff',
  },
  periodInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  periodText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  athleteCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  attendanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attendanceCount: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  percentageContainer: {
    marginLeft: 12,
  },
  percentageCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  legend: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
});
