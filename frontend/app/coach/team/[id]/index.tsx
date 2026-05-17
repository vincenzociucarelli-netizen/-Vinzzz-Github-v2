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
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../../src/services/api';
import { Ionicons } from '../../../../src/components/Icon';
import { SportIcon } from '../../../../src/components/SportIcon';
import SocietyBranding from '../../../../src/components/SocietyBranding';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import PhotoViewer from '../../../../src/components/PhotoViewer';

interface AthleteWithCert {
  id: string;
  full_name: string;
  certificate_expiry?: string;
  is_expired?: boolean;
  athlete_role?: string;
  status?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  team_photo?: string;
}

export default function CoachTeamAthletes() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [athletes, setAthletes] = useState<AthleteWithCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTeamPhoto, setShowTeamPhoto] = useState(false);

  const loadTeam = async () => {
    try {
      const teamsResponse = await api.get('/coach/my-teams');
      const foundTeam = teamsResponse.data.find((t: Team) => t.id === id);
      setTeam(foundTeam || null);
    } catch (error) {
      console.error('Error loading team:', error);
    }
  };

  const loadAthletes = async () => {
    try {
      const response = await api.get(`/coach/team/${id}/athletes`);
      setAthletes(response.data);
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
    loadAthletes();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeam();
    await loadAthletes();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const renderAthleteItem = ({ item }: { item: AthleteWithCert }) => {
    const isTrial = item.status === 'trial';
    const today = new Date();
    const expiryDate = item.certificate_expiry ? new Date(item.certificate_expiry) : null;
    const isExpired = item.is_expired || (expiryDate && expiryDate < today);
    
    let isExpiringSoon = false;
    if (expiryDate && !isExpired) {
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      isExpiringSoon = daysUntilExpiry <= 30;
    }
    
    let statusColor = '#34C759';
    let statusIcon = 'checkmark-circle';
    let statusText = '';
    
    if (!item.certificate_expiry) {
      statusColor = '#FF3B30';
      statusIcon = 'close-circle';
      statusText = 'Nessun certificato';
    } else if (isExpired) {
      statusColor = '#FF3B30';
      statusIcon = 'close-circle';
      statusText = `Scadenza: ${formatDate(item.certificate_expiry)} (SCADUTO)`;
    } else if (isExpiringSoon) {
      statusColor = '#FF9500';
      statusIcon = 'warning';
      statusText = `Scadenza: ${formatDate(item.certificate_expiry)} (IN SCADENZA)`;
    } else {
      statusText = `Scadenza: ${formatDate(item.certificate_expiry)}`;
    }
    
    return (
      <TouchableOpacity 
        style={styles.athleteItem}
        onPress={() => router.push(`/coach/athlete/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.athleteInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.athleteName}>{item.full_name}</Text>
            {isTrial && (
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>In prova</Text>
              </View>
            )}
          </View>
          {!isTrial && (
            <View style={styles.certRow}>
              <Ionicons 
                name={statusIcon as any} 
                size={18} 
                color={statusColor} 
              />
              <Text style={[styles.certText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
          )}
          {item.athlete_role && (
            <View style={styles.roleTag}>
              <Ionicons name="person" size={12} color="#5856D6" />
              <Text style={styles.roleText}>{item.athlete_role}</Text>
            </View>
          )}
        </View>
        <View style={styles.athleteActions}>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  };

  // Sort: trial athletes first, then alphabetically
  const sortedAthletes = [...athletes].sort((a, b) => {
    const aIsTrial = a.status === 'trial' ? 0 : 1;
    const bIsTrial = b.status === 'trial' ? 0 : 1;
    if (aIsTrial !== bIsTrial) return aIsTrial - bIsTrial;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/coach'))} style={{ padding: 8 }}>
            <View style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/coach'))} style={{ padding: 8 }}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>{team?.name || 'Squadra'}</Text>
          <SocietyBranding />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Team Info */}
        {team && (
          <View style={styles.teamInfo}>
            {team.team_photo ? (
              <TouchableOpacity onPress={() => setShowTeamPhoto(true)} data-testid="coach-team-photo">
              <Image 
                source={{ uri: `data:image/jpeg;base64,${team.team_photo}` }}
                style={{ width: 80, height: 80, borderRadius: 12, alignSelf: 'center', marginBottom: 8 }}
              />
              </TouchableOpacity>
            ) : null}
            <View style={styles.teamInfoHeader}>
              <SportIcon size={24} />
              <Text style={styles.teamInfoName}>{team.name}</Text>
            </View>
            {team.description && (
              <Text style={styles.teamInfoDescription}>{team.description}</Text>
            )}
            <Text style={styles.teamInfoCount}>{athletes.length} atleti</Text>
          </View>
        )}

        {/* Attendance Button */}
        <TouchableOpacity 
          style={styles.attendanceBtn}
          onPress={() => router.push(`/coach/team/${id}/attendances`)}
        >
          <Ionicons name="calendar" size={20} color="#007AFF" />
          <Text style={styles.attendanceBtnText}>Registro Presenze</Text>
          <Ionicons name="chevron-forward" size={20} color="#007AFF" />
        </TouchableOpacity>

        {/* Athletes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Atleti</Text>
          
          {athletes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessun atleta in questa squadra</Text>
            </View>
          ) : (
            <>
              {/* Certificate Legend */}
              <View style={styles.legendContainer}>
                <Text style={styles.legendTitle}>📋 Certificato Medico:</Text>
                <View style={styles.legendItems}>
                  <View style={styles.legendItem}>
                    <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                    <Text style={styles.legendText}>Valido</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <Ionicons name="warning" size={14} color="#FF9500" />
                    <Text style={styles.legendText}>In scadenza</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <Ionicons name="close-circle" size={14} color="#FF3B30" />
                    <Text style={styles.legendText}>Scaduto/Mancante</Text>
                  </View>
                </View>
              </View>
              {sortedAthletes.map((item) => (
                <React.Fragment key={item.id}>
                  {renderAthleteItem({ item })}
                </React.Fragment>
              ))}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Team Photo Viewer */}
      <PhotoViewer
        visible={showTeamPhoto}
        photo={team?.team_photo || null}
        title={`Foto Squadra - ${team?.name || ''}`}
        onClose={() => setShowTeamPhoto(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
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
    flex: 1,
    textAlign: 'center',
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamInfoName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  teamInfoDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  teamInfoCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  attendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  attendanceBtnText: {
    flex: 1,
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  legendContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  athleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  certText: {
    fontSize: 13,
    marginLeft: 6,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    color: '#5856D6',
    fontWeight: '600',
  },
  athleteActions: {
    justifyContent: 'center',
    paddingLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  trialBadge: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trialBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9C27B0',
  },
});
