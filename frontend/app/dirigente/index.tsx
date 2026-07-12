import React, { useState, useEffect } from 'react';
import SocietyBranding from '../../src/components/SocietyBranding';
import SocietyContactsSection from '../../src/components/SocietyContactsSection';
import AdminCoachCommitments from '../../src/components/admin/AdminCoachCommitments';
import DirigenteTabBar from '../../src/components/dirigente/DirigenteTabBar';
import GuideButton from '../../src/components/GuideButton';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { SportIcon } from '../../src/components/SportIcon';
import { OnboardingTutorial, DIRIGENTE_STEPS } from '../../src/components/OnboardingTutorial';

interface Team {
  id: string;
  name: string;
  category: string;
}

interface Athlete {
  id: string;
  full_name: string;
  team_id: string;
  status: string;
  medical_certificate_expiry?: string;
  is_withdrawn?: boolean;
}

interface AthleteWithCert extends Athlete {
  certificate_expiry?: string;
  is_expired?: boolean;
  days_to_expiry?: number;
}

export default function DirigenteIndex() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [athletes, setAthletes] = useState<AthleteWithCert[]>([]);
  const [assignedVenues, setAssignedVenues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 🆕 24/02/2026 — Dashboard stats Dirigente (certificati scadenza + rate non pagate)
  const [dashStats, setDashStats] = useState<{
    expiring_certificates: { count: number; athletes: any[] };
    unpaid_payments: { count: number; athletes: any[] };
  } | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<null | 'certificates' | 'payments'>(null);

  const loadTeams = async () => {
    try {
      // Load user profile to get assigned teams + venues
      const meRes = await api.get('/auth/me');
      const assignedTeamIds = meRes.data.assigned_teams || [];
      setAssignedVenues(meRes.data.assigned_venues || []);
      
      const response = await api.get('/teams');
      // Filter to only show assigned teams (if any are assigned)
      if (assignedTeamIds.length > 0) {
        setTeams(response.data.filter((t: Team) => assignedTeamIds.includes(t.id)));
      } else {
        setTeams([]);
      }
      // 🆕 24/02/2026 — Carica dashboard stats (certificati scadenza + rate non pagate)
      try {
        const statsRes = await api.get('/dirigente/dashboard-stats');
        setDashStats(statsRes.data);
      } catch {
        setDashStats(null);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAthletes = async (teamId: string) => {
    try {
      const response = await api.get(`/teams/${teamId}/athletes`);
      // Process athletes to add certificate status
      const processedAthletes = response.data.map((athlete: Athlete) => {
        let isExpired = false;
        let daysToExpiry = null;
        
        if (athlete.medical_certificate_expiry) {
          const expiryDate = new Date(athlete.medical_certificate_expiry);
          const today = new Date();
          daysToExpiry = differenceInDays(expiryDate, today);
          isExpired = daysToExpiry < 0;
        }
        
        return {
          ...athlete,
          certificate_expiry: athlete.medical_certificate_expiry,
          is_expired: isExpired,
          days_to_expiry: daysToExpiry,
        };
      });
      setAthletes(processedAthletes);
    } catch (error) {
      console.error('Error loading athletes:', error);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadAthletes(selectedTeam.id);
    }
  }, [selectedTeam]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeams();
    if (selectedTeam) {
      await loadAthletes(selectedTeam.id);
    }
    setRefreshing(false);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', onPress: async () => { await logout(); router.replace('/login'); } },
      ]);
    }
  };

  const formatExpiryDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Non presente';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const getCertificateStatus = (athlete: AthleteWithCert) => {
    if (!athlete.certificate_expiry) {
      return { color: '#FF3B30', text: 'MANCANTE', icon: 'close-circle' };
    }
    if (athlete.is_expired) {
      return { color: '#FF3B30', text: 'SCADUTO', icon: 'close-circle' };
    }
    if (athlete.days_to_expiry !== null && athlete.days_to_expiry <= 30) {
      return { color: '#FF9500', text: `SCADE TRA ${athlete.days_to_expiry}g`, icon: 'warning' };
    }
    return { color: '#34C759', text: 'VALIDO', icon: 'checkmark-circle' };
  };

  const renderTeamItem = ({ item }: { item: Team }) => (
    <TouchableOpacity
      style={[styles.teamCard, selectedTeam?.id === item.id && styles.teamCardSelected]}
      onPress={() => setSelectedTeam(item)}
    >
      <View style={styles.teamIcon}>
        <Ionicons name="people" size={24} color={selectedTeam?.id === item.id ? '#fff' : '#8E44AD'} />
      </View>
      <View style={styles.teamInfo}>
        <Text style={[styles.teamName, selectedTeam?.id === item.id && styles.teamNameSelected]}>
          {item.name}
        </Text>
        <Text style={[styles.teamCategory, selectedTeam?.id === item.id && styles.teamCategorySelected]}>
          {item.category}
        </Text>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={selectedTeam?.id === item.id ? '#fff' : '#999'} 
      />
    </TouchableOpacity>
  );

  const renderAthleteItem = ({ item }: { item: AthleteWithCert }) => {
    const certStatus = getCertificateStatus(item);
    
    return (
      <View style={[styles.athleteCard, item.is_withdrawn && styles.athleteCardWithdrawn]}>
        <View style={styles.athleteInfo}>
          <Text style={[styles.athleteName, item.is_withdrawn && styles.athleteNameWithdrawn]}>
            {item.full_name}
          </Text>
          <View style={styles.athleteMeta}>
            <View style={[styles.statusBadge, { backgroundColor: item.is_withdrawn ? '#FF3B30' : (item.status === 'trial' ? '#FF9500' : '#34C759') }]}>
              <Text style={styles.statusBadgeText}>
                {item.is_withdrawn ? 'RITIRATO' : (item.status === 'trial' ? 'IN PROVA' : 'ATTIVO')}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.certificateInfo}>
          <View style={[styles.certBadge, { backgroundColor: certStatus.color + '20' }]}>
            <Ionicons name={certStatus.icon as any} size={16} color={certStatus.color} />
            <Text style={[styles.certText, { color: certStatus.color }]}>{certStatus.text}</Text>
          </View>
          <Text style={styles.certDate}>{formatExpiryDate(item.certificate_expiry)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <OnboardingTutorial role="dirigente" steps={DIRIGENTE_STEPS} />
      <View style={styles.header}>
        <View>
          {/* BRANDING_WRAPPED */}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <SocietyBranding />
            <Text style={styles.headerTitle}>Dashboard Dirigente</Text>
          </View>
          <Text style={styles.headerSubtitle}>Benvenuto, {user?.first_name || user?.full_name?.split(' ')[0]}</Text>
        </View>
        <View style={styles.headerButtons}>
          {/* Switch to Admin button - only for admin users */}
          {user?.role === 'admin' && (
            <TouchableOpacity 
              onPress={() => router.replace('/admin')} 
              style={[styles.headerBtn, styles.adminSwitchBtn]}
            >
              <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/dirigente/profile')} style={styles.headerBtn}>
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <GuideButton role="dirigente" compact />
          <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🆕 24/02/2026 — DirigenteTabBar componente riusabile */}
      <DirigenteTabBar active="dafare" />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Admin Switch Card - only for admin users */}
        {user?.role === 'admin' && (
          <TouchableOpacity
            style={styles.adminSwitchCard}
            onPress={() => router.replace('/admin')}
          >
            <View style={styles.adminSwitchIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
            </View>
            <View style={styles.adminSwitchInfo}>
              <Text style={styles.adminSwitchTitle}>Passa a Modalità Admin</Text>
              <Text style={styles.adminSwitchDescription}>
                Gestisci società, atleti e impostazioni
              </Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color="#007AFF" />
          </TouchableOpacity>
        )}

        {/* 🆕 23/02/2026 — Tab bar spostata FUORI dalla ScrollView (sticky in cima) */}

        {/* Impegni del dirigente (riusa AdminCoachCommitments senza userId = current user) */}
        <AdminCoachCommitments roleLabel="dirigente" />

        {/* 🆕 08/07/2026 — Sezione Società (logo + contatti collassabili) */}
        <SocietyContactsSection currentUserId={user?.id} />

        {/* Mappa Palestre */}
        <TouchableOpacity
          style={[styles.profileCard, { marginTop: 12, borderColor: '#43A047', backgroundColor: '#F1F8E9' }]}
          onPress={() => router.push('/palestre')}
          data-testid="dirigente-palestre-btn"
        >
          <View style={[styles.profileIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="map" size={28} color="#43A047" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileTitle, { color: '#43A047' }]}>🏟️ Mappa Palestre</Text>
            <Text style={styles.profileDescription}>
              Palazzetti utilizzati per i campionati
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#43A047" />
        </TouchableOpacity>

        {/* 🆕 24/02/2026 — Card "🏆 Stagione" (replica Anagrafica ma con pill cliccabili → team detail) */}
        {(teams.length > 0 || assignedVenues.length > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>🏆 Stagione</Text>

            {/* Squadre Assegnate - pill cliccabili */}
            {teams.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="people" size={18} color="#007AFF" />
                  <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#333' }}>Squadre Assegnate</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {teams.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => router.push({ pathname: '/dirigente/team/[id]', params: { id: t.id, name: t.name } })}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#007AFF', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      data-testid={`dirigente-team-pill-${t.id}`}
                    >
                      <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 13 }}>{t.name}</Text>
                      <Ionicons name="chevron-forward" size={14} color="#007AFF" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Palestre */}
            {assignedVenues.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="location" size={18} color="#FF9500" />
                  <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#333' }}>Palestre</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {assignedVenues.map((venue, idx) => (
                    <View key={idx} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FF9500' }}>
                      <Text style={{ color: '#E65100', fontWeight: '500', fontSize: 13 }}>{venue}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Text style={{ color: '#666', fontSize: 12, lineHeight: 18, marginTop: 14, marginBottom: 6, fontWeight: '600' }}>
              Statistiche Stagione
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Certificati medici */}
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#FFF4F4', borderWidth: 1, borderColor: '#E53935', alignItems: 'center' }}
                onPress={() => setShowStatsModal('certificates')}
                disabled={!dashStats || dashStats.expiring_certificates.count === 0}
                data-testid="dirigente-stat-certificates"
              >
                <Ionicons name="medical" size={20} color="#E53935" />
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#E53935', marginTop: 2 }} data-testid="dirigente-stat-certificates-count">
                  {dashStats?.expiring_certificates.count ?? '—'}
                </Text>
                <Text style={{ fontSize: 11, color: '#C62828', textAlign: 'center', marginTop: 2 }}>Certificati in scadenza</Text>
              </TouchableOpacity>
              {/* Rate non pagate */}
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FF8F00', alignItems: 'center' }}
                onPress={() => setShowStatsModal('payments')}
                disabled={!dashStats || dashStats.unpaid_payments.count === 0}
                data-testid="dirigente-stat-payments"
              >
                <Ionicons name="card" size={20} color="#FF8F00" />
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#FF8F00', marginTop: 2 }} data-testid="dirigente-stat-payments-count">
                  {dashStats?.unpaid_payments.count ?? '—'}
                </Text>
                <Text style={{ fontSize: 11, color: '#E65100', textAlign: 'center', marginTop: 2 }}>Rate non pagate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {teams.length === 0 && assignedVenues.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna squadra assegnata</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 🆕 24/02/2026 — Modal elenco certificati/rate non pagate (per click su statistiche) */}
      {showStatsModal && dashStats && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setShowStatsModal(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#333' }}>
                  {showStatsModal === 'certificates'
                    ? `🩺 Certificati in scadenza (${dashStats.expiring_certificates.count})`
                    : `💳 Rate non pagate (${dashStats.unpaid_payments.count})`}
                </Text>
                <TouchableOpacity onPress={() => setShowStatsModal(null)} data-testid="dirigente-stats-modal-close">
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 500 }}>
                {showStatsModal === 'certificates' && dashStats.expiring_certificates.athletes.map((a: any) => (
                  <TouchableOpacity
                    key={a.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                    onPress={() => {
                      setShowStatsModal(null);
                      router.push({ pathname: '/dirigente/team/[id]', params: { id: a.team_id, name: a.team_name } });
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{a.full_name}</Text>
                      <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{a.team_name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: a.expired ? '#C62828' : '#FF8F00' }}>
                        {a.expired ? `Scaduto ${Math.abs(a.days_left)}g fa` : `Scade in ${a.days_left}g`}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {new Date(a.expiry_date).toLocaleDateString('it-IT')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {showStatsModal === 'payments' && dashStats.unpaid_payments.athletes.map((a: any) => (
                  <TouchableOpacity
                    key={a.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                    onPress={() => {
                      setShowStatsModal(null);
                      router.push({ pathname: '/dirigente/team/[id]', params: { id: a.team_id, name: a.team_name } });
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{a.full_name}</Text>
                      <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{a.team_name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF8F00' }}>
                        € {(a.total_unpaid || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{a.installments_count} rate</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {showStatsModal === 'certificates' && dashStats.expiring_certificates.count === 0 && (
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>Nessun certificato in scadenza ✅</Text>
                )}
                {showStatsModal === 'payments' && dashStats.unpaid_payments.count === 0 && (
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>Tutte le rate sono pagate ✅</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#8E44AD',
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
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
  },
  adminSwitchBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
  },
  content: {
    flex: 1,
  },
  adminSwitchCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  adminSwitchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminSwitchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  adminSwitchTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  adminSwitchDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
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
  profileIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  profileDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  teamCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  teamCardSelected: {
    backgroundColor: '#8E44AD',
  },
  inlineAthletesContainer: {
    backgroundColor: '#F8F4FC',
    marginTop: -8,
    marginBottom: 10,
    marginLeft: 20,
    marginRight: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#8E44AD',
  },
  teamIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    flex: 1,
    marginLeft: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teamNameSelected: {
    color: '#fff',
  },
  teamCategory: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  teamCategorySelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  legendContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  athleteCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  athleteCardWithdrawn: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  athleteNameWithdrawn: {
    color: '#FF3B30',
    textDecorationLine: 'line-through',
  },
  athleteMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  certificateInfo: {
    alignItems: 'flex-end',
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  certText: {
    fontSize: 10,
    fontWeight: '600',
  },
  certDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});
