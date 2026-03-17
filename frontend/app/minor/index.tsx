import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

const DAYS_IT: { [key: string]: string } = {
  'monday': 'Lunedi',
  'tuesday': 'Martedi',
  'wednesday': 'Mercoledi',
  'thursday': 'Giovedi',
  'friday': 'Venerdi',
  'saturday': 'Sabato',
  'sunday': 'Domenica',
};

interface DashboardData {
  athlete: {
    id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    team_id: string;
    qr_code: string;
    qr_identifier: string;
    athlete_code: string;
    profile_photo: string | null;
    status: string;
  };
  team: { id: string; name: string } | null;
  schedule: {
    training_sessions: Array<{
      day: string;
      timeStart?: string;
      timeEnd?: string;
      start_time?: string;
      end_time?: string;
      venue?: string;
    }>;
    match_day?: { day: string; time?: string; venue?: string };
    warmup_session?: any;
  } | null;
  society: { name: string; logo: string | null; sport_type: string | null } | null;
  stats: {
    total_attendances: number;
    weekly_attendances: number;
    monthly_attendances: number;
  };
  recent_attendances: Array<{ id: string; date: string; check_in_time: string; training_slot?: string }>;
  upcoming_matches: Array<{ id: string; date: string; time?: string; opponent?: string; venue?: string; home_away?: string }>;
  trial_info: { is_trial: boolean; trial_start_date?: string; trial_end_date?: string; trial_days_remaining?: number } | null;
}

export default function MinorDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [showQR, setShowQR] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/minor/dashboard');
      setData(res.data);
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#34C759" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#999" />
        <Text style={styles.errorText}>Impossibile caricare i dati</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadDashboard}>
          <Text style={styles.retryText}>Riprova</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} colors={['#34C759']} />}
    >
      {/* Header */}
      <View style={styles.header} data-testid="minor-dashboard-header">
        <View style={styles.headerLeft}>
          {data.society?.logo && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${data.society.logo}` }}
              style={styles.societyLogo}
              resizeMode="contain"
            />
          )}
          <View>
            <Text style={styles.welcomeText}>Ciao,</Text>
            <Text style={styles.athleteName}>{data.athlete.first_name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} data-testid="minor-logout-button">
          <Ionicons name="log-out" size={22} color="#ff3b30" />
        </TouchableOpacity>
      </View>

      {/* Society & Team */}
      {data.society && (
        <Text style={styles.societyName}>{data.society.name}</Text>
      )}

      {/* Trial Banner */}
      {data.trial_info?.is_trial && (
        <View style={styles.trialBanner} data-testid="minor-trial-banner">
          <Ionicons name="time" size={20} color="#FF9500" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.trialTitle}>Periodo di Prova</Text>
            {data.trial_info.trial_days_remaining !== null && data.trial_info.trial_days_remaining !== undefined && (
              <Text style={styles.trialDays}>
                {data.trial_info.trial_days_remaining > 0
                  ? `${data.trial_info.trial_days_remaining} giorni rimanenti`
                  : 'Periodo di prova terminato'}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* QR Code Card */}
      <TouchableOpacity
        style={styles.qrCard}
        onPress={() => setShowQR(!showQR)}
        activeOpacity={0.7}
        data-testid="minor-qr-card"
      >
        <View style={styles.qrHeader}>
          <Ionicons name="qr-code" size={24} color="#34C759" />
          <Text style={styles.qrTitle}>Il Mio QR Code</Text>
          <Ionicons name={showQR ? "chevron-up" : "chevron-down"} size={20} color="#666" />
        </View>
        {showQR && data.athlete.qr_code && (
          <View style={styles.qrImageContainer}>
            <Image
              source={{ uri: data.athlete.qr_code }}
              style={styles.qrImage}
              resizeMode="contain"
            />
            <Text style={styles.qrCode}>{data.athlete.athlete_code}</Text>
            <Text style={styles.qrHint}>Mostra al coach per registrare la presenza</Text>
          </View>
        )}
        {!showQR && (
          <Text style={styles.qrHintSmall}>Tocca per mostrare il QR code</Text>
        )}
      </TouchableOpacity>

      {/* Team & Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={22} color="#007AFF" />
          <Text style={styles.statLabel}>Squadra</Text>
          <Text style={styles.statValue}>{data.team?.name || '-'}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={22} color="#34C759" />
          <Text style={styles.statLabel}>Presenze Totali</Text>
          <Text style={styles.statValue}>{data.stats.total_attendances}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar" size={22} color="#FF9500" />
          <Text style={styles.statLabel}>Questo Mese</Text>
          <Text style={styles.statValue}>{data.stats.monthly_attendances}</Text>
        </View>
      </View>

      {/* Training Schedule */}
      {data.schedule && data.schedule.training_sessions.length > 0 && (
        <View style={styles.section} data-testid="minor-schedule-section">
          <Text style={styles.sectionTitle}>
            <Ionicons name="fitness" size={18} color="#333" /> Orario Allenamenti
          </Text>
          {data.schedule.training_sessions.map((session, idx) => (
            <View key={idx} style={styles.scheduleRow}>
              <View style={styles.scheduleDayBadge}>
                <Text style={styles.scheduleDayText}>
                  {session.day}
                </Text>
              </View>
              <View style={styles.scheduleDetails}>
                <Text style={styles.scheduleTime}>
                  {session.timeStart || session.start_time} - {session.timeEnd || session.end_time}
                </Text>
                {session.venue && (
                  <Text style={styles.scheduleVenue}>{session.venue}</Text>
                )}
              </View>
            </View>
          ))}
          {data.schedule.match_day && (
            <View style={[styles.scheduleRow, styles.matchDayRow]}>
              <View style={[styles.scheduleDayBadge, styles.matchDayBadge]}>
                <Text style={[styles.scheduleDayText, styles.matchDayText]}>
                  {data.schedule.match_day.day}
                </Text>
              </View>
              <View style={styles.scheduleDetails}>
                <Text style={[styles.scheduleTime, { color: '#FF3B30' }]}>
                  Partita: {data.schedule.match_day.time || ''}
                </Text>
                {data.schedule.match_day.venue && (
                  <Text style={styles.scheduleVenue}>{data.schedule.match_day.venue}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Upcoming Matches */}
      {data.upcoming_matches.length > 0 && (
        <View style={styles.section} data-testid="minor-matches-section">
          <Text style={styles.sectionTitle}>
            <Ionicons name="trophy" size={18} color="#333" /> Prossime Partite
          </Text>
          {data.upcoming_matches.map((match) => (
            <View key={match.id} style={styles.matchRow}>
              <View style={styles.matchDate}>
                <Text style={styles.matchDateText}>{formatDate(match.date)}</Text>
                {match.time && <Text style={styles.matchTimeText}>{match.time}</Text>}
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.matchOpponent}>
                  {match.home_away === 'home' ? 'Casa' : match.home_away === 'away' ? 'Trasferta' : ''}{' '}
                  vs {match.opponent || 'Da definire'}
                </Text>
                {match.venue && <Text style={styles.matchVenue}>{match.venue}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Attendances */}
      {data.recent_attendances.length > 0 && (
        <View style={styles.section} data-testid="minor-attendances-section">
          <Text style={styles.sectionTitle}>
            <Ionicons name="time" size={18} color="#333" /> Ultime Presenze
          </Text>
          {data.recent_attendances.map((att) => (
            <View key={att.id} style={styles.attendanceRow}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.attendanceDate}>{formatDate(att.date)}</Text>
              <Text style={styles.attendanceTime}>{formatTime(att.check_in_time)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#34C759',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  societyLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#888',
  },
  athleteName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  logoutButton: {
    padding: 8,
  },
  societyName: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  trialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
  trialDays: {
    fontSize: 12,
    color: '#FF6D00',
    marginTop: 2,
  },
  qrCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  qrImageContainer: {
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 8,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  qrCode: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 2,
  },
  qrHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  qrHintSmall: {
    marginTop: 6,
    fontSize: 12,
    color: '#aaa',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 14,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  scheduleDayBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  scheduleDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  matchDayRow: {
    borderBottomWidth: 0,
  },
  matchDayBadge: {
    backgroundColor: '#FFEBEE',
  },
  matchDayText: {
    color: '#C62828',
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scheduleVenue: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  matchRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
    alignItems: 'center',
  },
  matchDate: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  matchDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
  },
  matchTimeText: {
    fontSize: 11,
    color: '#FF6D00',
  },
  matchInfo: {
    flex: 1,
  },
  matchOpponent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  matchVenue: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  attendanceDate: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  attendanceTime: {
    fontSize: 13,
    color: '#888',
  },
});
