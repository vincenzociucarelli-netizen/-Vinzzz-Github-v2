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

interface TrainingSession {
  day: string;
  timeStart?: string;
  timeEnd?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
}

interface TeamSchedule {
  training_sessions: TrainingSession[];
  match_day?: {
    day: string;
    time?: string;
    venue?: string;
  };
  warmup_session?: {
    timeStart?: string;
    timeEnd?: string;
    start_time?: string;
    end_time?: string;
    venue?: string;
  };
}

interface Attendance {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'justified';
  type?: string;
}

const DAYS_IT: { [key: string]: string } = {
  'monday': 'Lunedì',
  'tuesday': 'Martedì',
  'wednesday': 'Mercoledì',
  'thursday': 'Giovedì',
  'friday': 'Venerdì',
  'saturday': 'Sabato',
  'sunday': 'Domenica',
};

export default function AthleteSchedule() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [schedule, setSchedule] = useState<TeamSchedule | null>(null);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      // Get athlete data
      const meRes = await api.get('/auth/me');
      const aid = meRes.data.athlete_id;
      setAthleteId(aid);
      
      if (aid) {
        const athleteRes = await api.get(`/athletes/${aid}`);
        const teamId = athleteRes.data.team_id;
        
        if (teamId) {
          const teamRes = await api.get(`/teams/${teamId}`);
          setTeamName(teamRes.data.name || 'La mia squadra');
          setSchedule({
            training_sessions: teamRes.data.training_sessions || [],
            match_day: teamRes.data.match_day,
            warmup_session: teamRes.data.warmup_session,
          });
          
          // Load attendance history
          try {
            const attRes = await api.get(`/attendance/athlete/${aid}`);
            setAttendances(attRes.data || []);
          } catch (e) {
            // Attendance endpoint might not exist, ignore
            setAttendances([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orari e Presenze</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Calendario Squadra Header */}
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarEmoji}>🏐</Text>
          <Text style={styles.calendarTitle}>Calendario Squadra</Text>
        </View>

        {/* Allenamenti Settimanali */}
        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>📅</Text>
            <Text style={styles.sectionTitleNew}>Allenamenti Settimanali</Text>
          </View>
          
          {!schedule || schedule.training_sessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nessun allenamento programmato</Text>
            </View>
          ) : (
            <View style={styles.trainingList}>
              {schedule.training_sessions.map((session, index) => (
                <View key={index} style={styles.trainingItem}>
                  <View style={styles.trainingDayIcon}>
                    <Text style={styles.dayIconEmoji}>📅</Text>
                  </View>
                  <View style={styles.trainingDetails}>
                    <Text style={styles.trainingDay}>
                      {DAYS_IT[session.day?.toLowerCase()] || session.day}
                    </Text>
                    <View style={styles.trainingTimeRow}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.trainingTime}>
                        {session.timeStart || session.start_time} - {session.timeEnd || session.end_time}
                      </Text>
                    </View>
                    <View style={styles.trainingVenueRow}>
                      <Ionicons name="location" size={16} color="#E91E63" />
                      <Text style={styles.trainingVenue}>{session.venue || '-'}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Gare / Partite */}
        {schedule?.match_day && (
          <View style={styles.scheduleSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>🏆</Text>
              <Text style={styles.sectionTitleNew}>Gare</Text>
            </View>
            <View style={styles.trainingList}>
              <View style={styles.trainingItem}>
                <View style={styles.trainingDayIcon}>
                  <Text style={styles.dayIconEmoji}>🏆</Text>
                </View>
                <View style={styles.trainingDetails}>
                  <Text style={[styles.trainingDay, { color: '#FF9800' }]}>
                    {DAYS_IT[schedule.match_day.day?.toLowerCase()] || schedule.match_day.day}
                  </Text>
                  <View style={styles.trainingTimeRow}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.trainingTime}>{schedule.match_day.time || 'TBD'}</Text>
                  </View>
                  <View style={styles.trainingVenueRow}>
                    <Ionicons name="location" size={16} color="#E91E63" />
                    <Text style={styles.trainingVenue}>{schedule.match_day.venue || '-'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Rifinitura */}
        {schedule?.warmup_session && (
          <View style={styles.scheduleSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>⚡</Text>
              <Text style={styles.sectionTitleNew}>Rifinitura</Text>
            </View>
            <View style={styles.trainingList}>
              <View style={styles.trainingItem}>
                <View style={styles.trainingDayIcon}>
                  <Text style={styles.dayIconEmoji}>⚡</Text>
                </View>
                <View style={styles.trainingDetails}>
                  <View style={styles.trainingTimeRow}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.trainingTime}>
                      {schedule.warmup_session.timeStart || schedule.warmup_session.start_time} - {schedule.warmup_session.timeEnd || schedule.warmup_session.end_time}
                    </Text>
                  </View>
                  <View style={styles.trainingVenueRow}>
                    <Ionicons name="location" size={16} color="#E91E63" />
                    <Text style={styles.trainingVenue}>{schedule.warmup_session.venue || '-'}</Text>
                  </View>
                </View>
              </View>
            </View>
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
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sessionDay: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  sessionDayText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sessionDetails: {
    flex: 1,
  },
  sessionTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sessionTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionVenueText: {
    fontSize: 14,
    color: '#666',
  },
});
