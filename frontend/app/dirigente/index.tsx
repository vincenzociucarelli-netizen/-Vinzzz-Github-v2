import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { SportIcon } from '../../src/components/SportIcon';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard Dirigente</Text>
          <Text style={styles.headerSubtitle}>Benvenuto, {user?.full_name}</Text>
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
          <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

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

        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push('/dirigente/profile')}
        >
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={28} color="#8E44AD" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileTitle}>Il Mio Profilo</Text>
            <Text style={styles.profileDescription}>
              Gestisci dati personali e documento
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#8E44AD" />
        </TouchableOpacity>

        {/* Compensation Card */}
        <TouchableOpacity
          style={[styles.profileCard, { marginTop: 12, borderColor: '#27AE60', backgroundColor: '#F0FFF4' }]}
          onPress={() => router.push('/dirigente/compensation')}
          data-testid="compensation-card"
        >
          <View style={[styles.profileIcon, { backgroundColor: '#E8F8F0' }]}>
            <Ionicons name="receipt" size={28} color="#27AE60" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileTitle, { color: '#27AE60' }]}>Compensi Sportivi</Text>
            <Text style={styles.profileDescription}>
              Firma quietanze mensili e gestisci soglie fiscali
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#27AE60" />
        </TouchableOpacity>

        {/* Teams Section with inline Athletes */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SportIcon size={20} />
            <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>Squadre ({teams.length})</Text>
          </View>
          {teams.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessuna squadra registrata</Text>
            </View>
          ) : (
            teams.map((item) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={[styles.teamCard, selectedTeam?.id === item.id && styles.teamCardSelected]}
                  onPress={() => {
                    console.log('Team selected:', item.name);
                    setSelectedTeam(selectedTeam?.id === item.id ? null : item);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.teamIcon}>
                    <Ionicons name="people" size={24} color={selectedTeam?.id === item.id ? '#fff' : '#8E44AD'} />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={[styles.teamName, selectedTeam?.id === item.id && styles.teamNameSelected]}>
                      {item.name}
                    </Text>
                    {item.category && (
                      <Text style={[styles.teamCategory, selectedTeam?.id === item.id && styles.teamCategorySelected]}>
                        {item.category}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {selectedTeam?.id === item.id && (
                      <Text style={{ color: '#fff', fontSize: 12, marginRight: 8 }}>
                        {athletes.length} atleti
                      </Text>
                    )}
                    <Ionicons 
                      name={selectedTeam?.id === item.id ? "chevron-down" : "chevron-forward"}
                      size={20} 
                      color={selectedTeam?.id === item.id ? '#fff' : '#999'} 
                    />
                  </View>
                </TouchableOpacity>
                
                {/* Athletes list shown inline when team is selected */}
                {selectedTeam?.id === item.id && (
                  <View style={styles.inlineAthletesContainer}>
                    {/* Certificate Legend - compact */}
                    <View style={[styles.legendContainer, { marginBottom: 8, paddingVertical: 6 }]}>
                      <View style={styles.legendItems}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                          <Text style={[styles.legendText, { fontSize: 11 }]}>Valido</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
                          <Text style={[styles.legendText, { fontSize: 11 }]}>In scadenza</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                          <Text style={[styles.legendText, { fontSize: 11 }]}>Mancante</Text>
                        </View>
                      </View>
                    </View>
                    
                    {athletes.length === 0 ? (
                      <View style={[styles.emptyCard, { marginVertical: 8 }]}>
                        <Text style={styles.emptyText}>Nessun atleta in questa squadra</Text>
                      </View>
                    ) : (
                      athletes.map((athlete) => {
                        const certStatus = getCertificateStatus(athlete);
                        return (
                          <View key={athlete.id} style={[styles.athleteCard, athlete.is_withdrawn && styles.athleteCardWithdrawn]}>
                            <View style={styles.athleteInfo}>
                              <Text style={[styles.athleteName, athlete.is_withdrawn && styles.athleteNameWithdrawn]}>
                                {athlete.full_name}
                              </Text>
                              <View style={styles.athleteMeta}>
                                <View style={[styles.statusBadge, { backgroundColor: athlete.is_withdrawn ? '#FF3B30' : (athlete.status === 'trial' ? '#FF9500' : '#34C759') }]}>
                                  <Text style={styles.statusBadgeText}>
                                    {athlete.is_withdrawn ? 'RITIRATO' : (athlete.status === 'trial' ? 'IN PROVA' : 'ATTIVO')}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.certificateInfo}>
                              <View style={[styles.certBadge, { backgroundColor: certStatus.color + '20' }]}>
                                <Ionicons name={certStatus.icon as any} size={16} color={certStatus.color} />
                                <Text style={[styles.certText, { color: certStatus.color }]}>{certStatus.text}</Text>
                              </View>
                              <Text style={styles.certDate}>{formatExpiryDate(athlete.certificate_expiry)}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

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
