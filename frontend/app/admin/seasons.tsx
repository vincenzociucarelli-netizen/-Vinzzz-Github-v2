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
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface TeamArchive {
  id: string;
  name: string;
  total_athletes: number;
  athlete_names: string[];
  championships: string[];
  coach_names: string[];
}

interface SeasonData {
  season: string;
  is_current: boolean;
  total_teams: number;
  total_athletes: number;
  total_coaches: number;
  teams: TeamArchive[];
}

interface ArchivedSeason {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  total_teams: number;
  total_athletes: number;
  teams: TeamArchive[];
  archived_at: string;
}

export default function SeasonsArchive() {
  const router = useRouter();
  const [currentSeason, setCurrentSeason] = useState<SeasonData | null>(null);
  const [archivedSeasons, setArchivedSeasons] = useState<ArchivedSeason[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamArchive | null>(null);
  const [teamModalVisible, setTeamModalVisible] = useState(false);

  const loadData = async () => {
    try {
      const [currentRes, archivedRes] = await Promise.all([
        api.get('/seasons/current'),
        api.get('/seasons'),
      ]);
      setCurrentSeason(currentRes.data);
      setArchivedSeasons(archivedRes.data);
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const confirmArchive = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler archiviare la stagione corrente?\n\nQuesto salverà uno snapshot di tutti gli atleti, coach, squadre e campionati.')) {
        handleArchiveSeason();
      }
    } else {
      Alert.alert(
        'Archivia Stagione',
        'Sei sicuro di voler archiviare la stagione corrente?\n\nQuesto salverà uno snapshot di tutti gli atleti, coach, squadre e campionati.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Archivia', onPress: handleArchiveSeason },
        ]
      );
    }
  };

  const handleArchiveSeason = async () => {
    setArchiving(true);
    try {
      await api.post('/seasons/archive');
      showAlert('Successo', 'Stagione archiviata con successo!');
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'archiviazione');
    } finally {
      setArchiving(false);
    }
  };

  const openTeamDetail = (team: TeamArchive) => {
    setSelectedTeam(team);
    setTeamModalVisible(true);
  };

  const renderTeamCard = (team: TeamArchive) => (
    <TouchableOpacity 
      key={team.id || team.name} 
      style={styles.teamCard}
      onPress={() => openTeamDetail(team)}
    >
      <View style={styles.teamHeader}>
        <View style={styles.teamIcon}>
          <Ionicons name="people" size={20} color="#007AFF" />
        </View>
        <Text style={styles.teamName}>{team.name}</Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </View>
      <View style={styles.teamStats}>
        <View style={styles.teamStat}>
          <Ionicons name="person" size={14} color="#666" />
          <Text style={styles.teamStatText}>{team.total_athletes} atleti</Text>
        </View>
        {team.championships?.length > 0 && (
          <View style={styles.teamStat}>
            <Ionicons name="trophy" size={14} color="#FF9500" />
            <Text style={styles.teamStatText}>{team.championships.length} campionati</Text>
          </View>
        )}
        {team.coach_names?.length > 0 && (
          <View style={styles.teamStat}>
            <Ionicons name="fitness" size={14} color="#34C759" />
            <Text style={styles.teamStatText}>{team.coach_names.join(', ')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderArchivedSeason = (season: ArchivedSeason) => (
    <View key={season.id} style={styles.archivedSeasonCard}>
      <View style={styles.archivedSeasonHeader}>
        <View style={styles.archivedSeasonIcon}>
          <Ionicons name="archive" size={24} color="#FF5722" />
        </View>
        <View style={styles.archivedSeasonInfo}>
          <Text style={styles.archivedSeasonName}>Stagione {season.season_name}</Text>
          <Text style={styles.archivedSeasonDate}>
            Archiviata il {new Date(season.archived_at).toLocaleDateString('it-IT')}
          </Text>
        </View>
      </View>
      <View style={styles.archivedSeasonStats}>
        <View style={styles.archivedStat}>
          <Text style={styles.archivedStatNumber}>{season.total_teams}</Text>
          <Text style={styles.archivedStatLabel}>Squadre</Text>
        </View>
        <View style={styles.archivedStatDivider} />
        <View style={styles.archivedStat}>
          <Text style={styles.archivedStatNumber}>{season.total_athletes}</Text>
          <Text style={styles.archivedStatLabel}>Atleti</Text>
        </View>
      </View>
      
      {/* Teams in archived season */}
      {season.teams?.map((team, index) => (
        <View key={index} style={styles.archivedTeamRow}>
          <Text style={styles.archivedTeamName}>• {team.name || team.team_name}</Text>
          <Text style={styles.archivedTeamAthletes}>{team.total_athletes} atleti</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 20, padding: 6 }}><Ionicons name="chevron-back" size={24} color="#fff" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archivio Stagioni</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Current Season */}
        {currentSeason && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Stagione Corrente</Text>
              <Text style={styles.seasonName}>{currentSeason.season}</Text>
            </View>

            <View style={styles.currentStats}>
              <View style={styles.currentStat}>
                <Text style={styles.currentStatNumber}>{currentSeason.total_teams}</Text>
                <Text style={styles.currentStatLabel}>Squadre</Text>
              </View>
              <View style={styles.currentStatDivider} />
              <View style={styles.currentStat}>
                <Text style={styles.currentStatNumber}>{currentSeason.total_athletes}</Text>
                <Text style={styles.currentStatLabel}>Atleti</Text>
              </View>
              <View style={styles.currentStatDivider} />
              <View style={styles.currentStat}>
                <Text style={styles.currentStatNumber}>{currentSeason.total_coaches}</Text>
                <Text style={styles.currentStatLabel}>Coach</Text>
              </View>
            </View>

            <Text style={styles.teamsSectionTitle}>Squadre della stagione:</Text>
            {currentSeason.teams?.map(renderTeamCard)}

            <TouchableOpacity
              style={[styles.archiveButton, archiving && styles.buttonDisabled]}
              onPress={confirmArchive}
              disabled={archiving}
            >
              <Ionicons name="archive" size={20} color="#fff" />
              <Text style={styles.archiveButtonText}>
                {archiving ? 'Archiviazione...' : 'Archivia Stagione'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.archiveNote}>
              💡 L'archiviazione salva uno snapshot della stagione corrente. Può essere eseguita più volte.
            </Text>
          </View>
        )}

        {/* Archived Seasons */}
        {archivedSeasons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📚 Stagioni Archiviate</Text>
            {archivedSeasons.map(renderArchivedSeason)}
          </View>
        )}

        {archivedSeasons.length === 0 && !loading && (
          <View style={styles.emptyArchive}>
            <Ionicons name="folder-open-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna stagione archiviata</Text>
            <Text style={styles.emptySubtext}>
              Archivia la stagione corrente per conservare lo storico
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Team Detail Modal */}
      <Modal
        visible={teamModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTeamModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedTeam?.name}</Text>
              <TouchableOpacity onPress={() => setTeamModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedTeam && (
              <ScrollView style={styles.modalBody}>
                {/* Championships */}
                {selectedTeam.championships?.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>🏆 Campionati</Text>
                    {selectedTeam.championships.map((champ, idx) => (
                      <Text key={idx} style={styles.modalListItem}>• {champ}</Text>
                    ))}
                  </View>
                )}

                {/* Coaches */}
                {selectedTeam.coach_names?.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>🏃 Coach</Text>
                    {selectedTeam.coach_names.map((coach, idx) => (
                      <Text key={idx} style={styles.modalListItem}>• {coach}</Text>
                    ))}
                  </View>
                )}

                {/* Athletes */}
                {selectedTeam.athlete_names?.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>👥 Atleti ({selectedTeam.total_athletes})</Text>
                    {selectedTeam.athlete_names.map((athlete, idx) => (
                      <Text key={idx} style={styles.modalListItem}>• {athlete}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF5722',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seasonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentStats: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  currentStat: {
    flex: 1,
    alignItems: 'center',
  },
  currentStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  currentStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  currentStatDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  teamsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  teamCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teamStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  teamStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamStatText: {
    fontSize: 12,
    color: '#666',
  },
  archiveButton: {
    backgroundColor: '#FF5722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  archiveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  archiveNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  archivedSeasonCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  archivedSeasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  archivedSeasonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBE9E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  archivedSeasonInfo: {
    flex: 1,
  },
  archivedSeasonName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  archivedSeasonDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  archivedSeasonStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  archivedStat: {
    flex: 1,
    alignItems: 'center',
  },
  archivedStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  archivedStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  archivedStatDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  archivedTeamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  archivedTeamName: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  archivedTeamAthletes: {
    fontSize: 12,
    color: '#666',
  },
  emptyArchive: {
    alignItems: 'center',
    padding: 40,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  modalListItem: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 4,
  },
});
