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

// Sport avatar options with image URLs
const AVATAR_OPTIONS: { id: string; label: string; url: string }[] = [
  { id: 'calcio', label: 'Calcio', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/0adaebd663c95bc47b31433529b418b94b99365d8666be05c2c16d7ac13f09e6.png' },
  { id: 'pallavolo', label: 'Pallavolo', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/6b707e9ad1e5c0507635ba16adb3a04ddff03e49664effccb7c240796ee1d7a8.png' },
  { id: 'basket', label: 'Basket', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/08e7e37215505ce8dd5cd2e6335b937d0b145670bca2e1c81f73b8167450c075.png' },
  { id: 'baseball', label: 'Baseball', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/02959162b8d23fa6e402b8a4899cd0d44ee582a422f17c0789eb4780ba32a6a3.png' },
  { id: 'tennis', label: 'Tennis', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/d53dd0726506b462a19ed495d8ec73c0e02e1461b787f66206e407b5f12c95fe.png' },
  { id: 'nuoto', label: 'Nuoto', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/085e2f2f62b0eab003c850a336624a2ffc6243f6817dd6d23e416b548e99bdef.png' },
  { id: 'atletica', label: 'Atletica', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/d022ad7db40f74a11a42e79f964b6f88846f0133103899deadcaa76907d58f46.png' },
  { id: 'rugby', label: 'Rugby', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/2f784ec96431295bb13f62108742ecb6916513e23213923337c4e5d2bea6df9b.png' },
  { id: 'ciclismo', label: 'Ciclismo', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/3187f90cd83f8f09522e1bdfd95d76c1e4169ef3a15b80d77a0bfde18f6f86dd.png' },
  { id: 'ginnastica', label: 'Ginnastica', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/c9054efa432c0d992b0d0365d9c69c16634fdbc422050b20148adbd1dcf32dd2.png' },
  { id: 'arti_marziali', label: 'Arti Marziali', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/444ee332e9481eb6f3a0242e020c9ccaf1a8b213d868f061746d609334fa0c7e.png' },
  { id: 'hockey', label: 'Hockey', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/e8642f2a89d8485b9d19b28fb44b430ce4e79e1bfb407d244e70e5944968b55e.png' },
  { id: 'sci', label: 'Sci', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/0fe5c4656c823c45ef2c171d0acae1109323145709f60efa868eb76fbb474820.png' },
  { id: 'danza', label: 'Danza', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/250b48de6eb85003f2b8b5efcaee6f1616ec344d82287c89cad814d09c974bcc.png' },
  { id: 'scherma', label: 'Scherma', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/b9bf5de10b378d54cc995f65eefe8d073a40283448dc14b3d3bf8aa4794eec8a.png' },
  { id: 'pallanuoto', label: 'Pallanuoto', url: 'https://static.prod-images.emergentagent.com/jobs/f093d578-f9e7-471f-903b-d42fff393ae6/images/8464e869ffc4a3420a7982077c944dd72067de6052fe88713d28ace23a88aeb6.png' },
];

const COLOR_OPTIONS = ['#E91E63', '#9C27B0', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#FF9800', '#FF5722', '#795548', '#607D8B', '#F44336'];

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
    certificate_expiry?: string;
    certificate_verified?: boolean;
    nome_lite?: string;
    lite_color?: string;
    lite_emoji?: string;
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
  society: { name: string; logo: string | null; sport_type: string | null; sport?: string; sport_image?: string } | null;
  stats: {
    total_attendances: number;
    weekly_attendances: number;
    monthly_attendances: number;
  };
  recent_attendances: Array<{ id: string; date: string; check_in_time: string; training_slot?: string; team_name?: string }>;
  upcoming_matches: Array<{ id: string; date: string; time?: string; opponent?: string; venue?: string; home_away?: string }>;
  trial_info: { is_trial: boolean; trial_start_date?: string; trial_end_date?: string; trial_days_remaining?: number; waiting_first_attendance?: boolean } | null;
}

// Helper: get avatar URL from lite_emoji (supports both old emoji and new avatar IDs)
function getAvatarUrl(lite_emoji?: string): string | null {
  if (!lite_emoji) return null;
  const found = AVATAR_OPTIONS.find(a => a.id === lite_emoji);
  return found ? found.url : null;
}

export default function MinorDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [savingPersonalization, setSavingPersonalization] = useState(false);

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

  const handleSavePersonalization = async (color?: string, avatarId?: string) => {
    if (!data) return;
    setSavingPersonalization(true);
    try {
      const payload: any = {};
      if (color !== undefined) payload.lite_color = color;
      if (avatarId !== undefined) payload.lite_emoji = avatarId;
      await api.post(`/athletes/${data.athlete.id}/set-lite-personalization`, payload);
      setData(prev => prev ? {
        ...prev,
        athlete: {
          ...prev.athlete,
          ...(color !== undefined && { lite_color: color }),
          ...(avatarId !== undefined && { lite_emoji: avatarId }),
        }
      } : null);
    } catch (e) {
      console.error('Error saving personalization:', e);
    } finally {
      setSavingPersonalization(false);
    }
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
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || '-';
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr || '-'; }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const avatarUrl = getAvatarUrl(data.athlete.lite_emoji);
  const accentColor = data.athlete.lite_color || '#007AFF';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} colors={['#34C759']} />}
    >
      {/* Header */}
      <View style={styles.header} data-testid="minor-dashboard-header">
        {/* Row 1: Society Name - top center */}
        {data.society?.name && (
          <Text style={styles.societyNameTop} data-testid="society-name-top">{data.society.name.toUpperCase()}</Text>
        )}

        {/* Row 2: Logo left - AVATAR center - Sport right */}
        <View style={styles.headerCenterRow}>
          {/* Left: Society Logo (small) */}
          <View style={styles.headerSideIcon}>
            {data.society?.logo ? (
              <Image
                source={{ uri: data.society.logo.startsWith('data:') ? data.society.logo : `data:image/png;base64,${data.society.logo}` }}
                style={styles.sideIconImage}
                resizeMode="contain"
              />
            ) : <View style={styles.sideIconImage} />}
          </View>

          {/* Center: Avatar (big) */}
          <TouchableOpacity
            style={[styles.avatarCenter, { borderColor: accentColor }]}
            onPress={() => setShowPersonalize(!showPersonalize)}
            activeOpacity={0.8}
            data-testid="avatar-center"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="contain" />
            ) : (
              <Ionicons name="person" size={40} color={accentColor} />
            )}
          </TouchableOpacity>

          {/* Right: Sport Image/Badge (small) */}
          <View style={styles.headerSideIcon}>
            {data.society?.sport_image ? (
              <Image
                source={{ uri: data.society.sport_image.startsWith('data:') ? data.society.sport_image : `data:image/png;base64,${data.society.sport_image}` }}
                style={styles.sideIconImage}
                resizeMode="contain"
              />
            ) : data.society?.sport ? (
              <View style={styles.sportBadgeSmall}>
                <Ionicons name="fitness" size={16} color="#1565C0" />
              </View>
            ) : <View style={styles.sideIconImage} />}
          </View>
        </View>

        {/* Row 3: Welcome with color + Logout + Personalize */}
        <View style={styles.welcomeRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={styles.welcomeText}>Ciao, <Text style={[styles.athleteName, { color: accentColor }]}>
              {(data.athlete.first_name || '').charAt(0).toUpperCase() + (data.athlete.first_name || '').slice(1).toLowerCase()}{data.athlete.last_name ? ` ${data.athlete.last_name.charAt(0).toUpperCase()}.` : ''}
            </Text></Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => setShowPersonalize(!showPersonalize)} style={{ padding: 4 }} data-testid="personalize-btn">
              <Ionicons name="color-palette" size={22} color={accentColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} data-testid="minor-logout-button">
              <Ionicons name="log-out" size={22} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Personalization Panel */}
        {showPersonalize && (
          <View style={styles.personalizePanel} data-testid="personalize-panel">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: '#333' }}>Personalizza il tuo Avatar</Text>
              <TouchableOpacity onPress={() => setShowPersonalize(false)} style={{ padding: 4 }} data-testid="close-personalize-btn">
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Color selection */}
            <Text style={styles.personalizeLabel}>Scegli il tuo colore</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {COLOR_OPTIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => handleSavePersonalization(c, undefined)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    data.athlete.lite_color === c && { borderWidth: 3, borderColor: '#fff', shadowColor: c, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 4 },
                  ]}
                  data-testid={`color-${c}`}
                />
              ))}
            </View>

            {/* Avatar selection */}
            <Text style={styles.personalizeLabel}>Scegli il tuo avatar</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {AVATAR_OPTIONS.map(av => {
                const isSelected = data.athlete.lite_emoji === av.id;
                return (
                  <TouchableOpacity
                    key={av.id}
                    onPress={() => handleSavePersonalization(undefined, av.id)}
                    style={[
                      styles.avatarOption,
                      isSelected && { borderColor: accentColor, borderWidth: 2, backgroundColor: accentColor + '15' },
                    ]}
                    data-testid={`avatar-${av.id}`}
                  >
                    <Image source={{ uri: av.url }} style={styles.avatarOptionImage} resizeMode="contain" />
                    <Text style={[styles.avatarOptionLabel, isSelected && { color: accentColor, fontWeight: '700' }]}>{av.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Status Banners Row */}
      <View style={styles.statusBannersRow}>
        {data.trial_info?.is_trial && (
          <View style={[styles.statusBanner, styles.trialBanner]} data-testid="minor-trial-banner">
            <Ionicons name="time" size={20} color="#FF9500" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.trialTitle}>
                {data.trial_info.waiting_first_attendance
                  ? 'In Attesa Periodo di Prova'
                  : 'Periodo di Prova'}
              </Text>
              {data.trial_info.trial_days_remaining !== null && data.trial_info.trial_days_remaining !== undefined && (
                <Text style={styles.trialDays}>
                  {data.trial_info.trial_days_remaining > 0
                    ? `${data.trial_info.trial_days_remaining} giorni rimanenti`
                    : 'Periodo terminato'}
                </Text>
              )}
            </View>
          </View>
        )}

        {(() => {
          const cert = data.athlete.certificate_expiry;
          if (!cert) {
            return (
              <View style={[styles.statusBanner, styles.certBannerExpired]} data-testid="minor-cert-banner">
                <Ionicons name="document-text" size={20} color="#FF3B30" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.certTitle}>Certificato Medico</Text>
                  <Text style={styles.certExpired}>Non presente</Text>
                </View>
              </View>
            );
          }
          const expDate = new Date(cert);
          const today = new Date();
          const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const isExpired = daysLeft < 0;
          const isExpiringSoon = !isExpired && daysLeft <= 30;
          const isVerified = data.athlete.certificate_verified;

          return (
            <View style={[styles.statusBanner, isExpired ? styles.certBannerExpired : isExpiringSoon ? styles.certBannerWarning : styles.certBannerOk]} data-testid="minor-cert-banner">
              <Ionicons name={isVerified ? "shield-checkmark" : "document-text"} size={20} color={isExpired ? '#FF3B30' : isExpiringSoon ? '#FF9500' : '#34C759'} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.certTitle}>Certificato Medico</Text>
                <Text style={[styles.certDate, { color: isExpired ? '#FF3B30' : isExpiringSoon ? '#FF6D00' : '#2E7D32', fontSize: 14, fontWeight: '700' }]}>
                  {isExpired ? `Scaduto il ${formatDate(cert)}` : `Scadenza: ${formatDate(cert)}`}
                </Text>
                {isVerified && !isExpired && (
                  <Text style={{ fontSize: 11, color: '#4CAF50', fontWeight: '500', marginTop: 2 }}>Convalidato</Text>
                )}
              </View>
            </View>
          );
        })()}
      </View>

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
                <Text style={styles.scheduleDayText}>{session.day}</Text>
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
                <Text style={[styles.scheduleDayText, styles.matchDayText]}>{data.schedule.match_day.day}</Text>
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
            <View key={att.id} style={styles.attendanceRow} data-testid={`attendance-${att.id}`}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <View style={{ flex: 1 }}>
                <Text style={styles.attendanceDate}>{formatDate(att.date)}</Text>
                {att.team_name ? (
                  <Text style={styles.attendanceTeam}>Squadra: {att.team_name}</Text>
                ) : null}
              </View>
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
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { marginTop: 12, fontSize: 16, color: '#999' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#34C759', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  // Society name at top
  societyNameTop: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1565C0',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // Center row: logo - avatar - sport
  headerCenterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  headerSideIcon: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideIconImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  sportBadgeSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Avatar center
  avatarCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  // Welcome row
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  welcomeText: { fontSize: 16, color: '#888' },
  athleteName: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  logoutButton: { padding: 8 },
  // Personalize panel
  personalizePanel: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  personalizeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarOption: {
    width: 72,
    alignItems: 'center',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  avatarOptionImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f4f8',
  },
  avatarOptionLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  // Status banners
  statusBannersRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 10 },
  statusBanner: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderLeftWidth: 4 },
  trialBanner: { backgroundColor: '#FFF3E0', borderLeftColor: '#FF9500' },
  trialTitle: { fontSize: 13, fontWeight: '700', color: '#E65100' },
  trialDays: { fontSize: 11, color: '#FF6D00', marginTop: 2 },
  certBannerOk: { backgroundColor: '#E8F5E9', borderLeftColor: '#34C759' },
  certBannerWarning: { backgroundColor: '#FFF3E0', borderLeftColor: '#FF9500' },
  certBannerExpired: { backgroundColor: '#FFEBEE', borderLeftColor: '#FF3B30' },
  certTitle: { fontSize: 13, fontWeight: '700', color: '#333' },
  certDate: { fontSize: 14, marginTop: 2, fontWeight: '700' },
  certExpired: { fontSize: 11, color: '#FF3B30', marginTop: 2 },
  // QR card
  qrCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  qrImageContainer: { alignItems: 'center', marginTop: 16, paddingBottom: 8 },
  qrImage: { width: 200, height: 200, borderRadius: 8 },
  qrCode: { marginTop: 8, fontSize: 18, fontWeight: '700', color: '#333', letterSpacing: 2 },
  qrHint: { marginTop: 6, fontSize: 12, color: '#888', fontStyle: 'italic' },
  qrHintSmall: { marginTop: 6, fontSize: 12, color: '#aaa' },
  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statLabel: { fontSize: 11, color: '#888', marginTop: 6, textAlign: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 2 },
  // Sections
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 14 },
  // Schedule
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  scheduleDayBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  scheduleDayText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  matchDayRow: { borderBottomWidth: 0 },
  matchDayBadge: { backgroundColor: '#FFEBEE' },
  matchDayText: { color: '#C62828' },
  scheduleDetails: { flex: 1 },
  scheduleTime: { fontSize: 14, fontWeight: '600', color: '#333' },
  scheduleVenue: { fontSize: 12, color: '#888', marginTop: 2 },
  // Matches
  matchRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12, alignItems: 'center' },
  matchDate: { backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', minWidth: 80 },
  matchDateText: { fontSize: 12, fontWeight: '600', color: '#E65100' },
  matchTimeText: { fontSize: 11, color: '#FF6D00' },
  matchInfo: { flex: 1 },
  matchOpponent: { fontSize: 14, fontWeight: '600', color: '#333' },
  matchVenue: { fontSize: 12, color: '#888', marginTop: 2 },
  // Attendances
  attendanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  attendanceDate: { fontSize: 14, color: '#333' },
  attendanceTeam: { fontSize: 13, color: '#1565C0', marginTop: 2, fontWeight: '600' },
  attendanceTime: { fontSize: 13, color: '#888' },
});
