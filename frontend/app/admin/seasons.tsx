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
  total_athletes_minor?: number;   // 🆕 02/07/2026
  total_athletes_adult?: number;   // 🆕 02/07/2026
  total_coaches?: number;          // 🆕 02/07/2026
  total_collaboratori?: number;    // 🆕 02/07/2026
  total_dirigenti?: number;        // 🆕 02/07/2026
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
    // 🆕 06/07/2026 — Auto-trigger silenzioso del backfill per applicare il reset esteso
    // (compensi/contratti/pregresso/onboarding) a Coach/Collab/Dirigenti riconfermati con il
    // codice vecchio. Idempotente: rifiltra ogni volta solo chi ha ancora dati residui.
    (async () => {
      try {
        await api.post('/seasons/backfill-reset-assignments');
      } catch {
        // Silenzioso: eventuali errori non devono bloccare la pagina
      }
    })();
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

  const getPreviousSeasonLabel = () => {
    // Calcola l'etichetta della stagione APPENA CONCLUSA (start_year - 1) - (start_year)
    const cur = currentSeason?.season || '';
    const parts = cur.split('-');
    if (parts.length === 2 && !isNaN(Number(parts[0]))) {
      const s = Number(parts[0]);
      return `${s - 1}-${s}`;
    }
    return cur;
  };

  const confirmArchive = () => {
    const prev = getPreviousSeasonLabel();
    const msg = `Sei sicuro di voler archiviare la stagione appena conclusa ${prev}?\n\nQuesto salverà uno snapshot di tutti gli atleti, coach, squadre e campionati.`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        handleArchiveSeason();
      }
    } else {
      Alert.alert(
        'Archivia Stagione',
        msg,
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
      const r = await api.post('/seasons/archive');
      showAlert('Successo', `Stagione ${r.data?.season_name || ''} archiviata con successo!`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'archiviazione');
    } finally {
      setArchiving(false);
    }
  };

  // 🆕 04/07/2026 — Backfill reset assegnazioni (per riconferme vecchie senza svuotamento)
  const handleBackfillReset = async () => {
    const msg = `Reset delle assegnazioni per Atleti + Coach + Collab + Dirigenti già riconfermati SENZA lo svuotamento automatico.\n\nEffetti:\n- squadre / palestre azzerate\n- snapshot precedente salvato\n- appariranno "Da riassegnare" nelle liste\n- gli atleti passano a status "In attesa" + privacy da rifirmare\n\nNessun dato viene perso.\n\nProcedere?`;
    const ok = Platform.OS === 'web' ? window.confirm(msg) : await new Promise<boolean>(res => {
      Alert.alert('Reset assegnazioni', msg, [
        { text: 'Annulla', style: 'cancel', onPress: () => res(false) },
        { text: 'Procedi', onPress: () => res(true) },
      ]);
    });
    if (!ok) return;
    try {
      const r = await api.post('/seasons/backfill-reset-assignments');
      const users = r.data?.reset_count || 0;
      const athletes = r.data?.athletes_reset || 0;
      showAlert('Fatto', `${users} tra Coach/Collab/Dir + ${athletes} atleti resettati per la stagione ${r.data?.current_season || ''}`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Reset non riuscito');
    }
  };

  // 🆕 01/07/2026 — Elimina archivio erroneo
  const handleDeleteArchive = async (seasonName: string) => {
    const msg = `Eliminare l'archivio della stagione ${seasonName}?\n\nQuesto rimuove solo lo snapshot archiviato, NON i dati operativi.`;
    const ok = Platform.OS === 'web' ? window.confirm(msg) : await new Promise<boolean>((resolve) => {
      Alert.alert('Elimina archivio', msg, [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Elimina', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    try {
      await api.delete(`/seasons/${encodeURIComponent(seasonName)}`);
      showAlert('Eliminato', `Archivio ${seasonName} rimosso.`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Eliminazione non riuscita');
    }
  };

  // 🆕 01/07/2026 — Riconferma & import nella nuova stagione
  const [importPreview, setImportPreview] = useState<{to_import: number; to_inactivate: number; season: string} | null>(null);
  const [importing, setImporting] = useState(false);
  const loadImportPreview = async () => {
    try {
      const r = await api.get('/seasons/import-renewed/preview');
      setImportPreview(r.data);
    } catch {
      setImportPreview(null);
    }
  };
  useEffect(() => { loadImportPreview(); }, [currentSeason?.season]);

  const handleImportRenewed = async () => {
    if (!importPreview) return;
    const msg = `Importerai ${importPreview.to_import} atleti riconfermati nella stagione ${importPreview.season}.\n${importPreview.to_inactivate} atleti NON riconfermati verranno marcati 'inactive' (recuperabili manualmente).\n\nProcedere?`;
    const ok = Platform.OS === 'web' ? window.confirm(msg) : await new Promise<boolean>((resolve) => {
      Alert.alert('Conferma import', msg, [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Importa', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    setImporting(true);
    try {
      const r = await api.post('/seasons/import-renewed');
      showAlert('Import completato', `${r.data.imported} importati. ${r.data.inactivated} resi inactive.`);
      await loadImportPreview();
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Import non riuscito');
    } finally {
      setImporting(false);
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
        {/* 🆕 01/07/2026 — Pulsante elimina archivio (utile per correggere archivi errati) */}
        <TouchableOpacity
          onPress={() => handleDeleteArchive(season.season_name)}
          style={{ padding: 8, borderRadius: 8, backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#EF9A9A' }}
          data-testid={`delete-archive-${season.season_name}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="trash-outline" size={18} color="#C62828" />
        </TouchableOpacity>
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
          {(season.total_athletes_minor !== undefined || season.total_athletes_adult !== undefined) && (
            <Text style={styles.archivedStatSublabel}>
              U18: {season.total_athletes_minor ?? 0} · 18+: {season.total_athletes_adult ?? 0}
            </Text>
          )}
        </View>
      </View>
      {/* 🆕 02/07/2026 — Seconda riga: Coach / Collaboratori / Dirigenti */}
      <View style={[styles.archivedSeasonStats, { marginTop: 8 }]}>
        <View style={styles.archivedStat}>
          <Text style={styles.archivedStatNumber}>
            {season.total_coaches !== undefined ? season.total_coaches : '—'}
          </Text>
          <Text style={styles.archivedStatLabel}>🏋️ Coach</Text>
        </View>
        <View style={styles.archivedStatDivider} />
        <View style={styles.archivedStat}>
          <Text style={styles.archivedStatNumber}>
            {season.total_collaboratori !== undefined ? season.total_collaboratori : '—'}
          </Text>
          <Text style={styles.archivedStatLabel}>👷 Collaboratori</Text>
        </View>
        <View style={styles.archivedStatDivider} />
        <View style={styles.archivedStat}>
          <Text style={styles.archivedStatNumber}>
            {season.total_dirigenti !== undefined ? season.total_dirigenti : '—'}
          </Text>
          <Text style={styles.archivedStatLabel}>💼 Dirigenti</Text>
        </View>
      </View>
      {(season.total_coaches === undefined && season.total_collaboratori === undefined && season.total_dirigenti === undefined) && (
        <Text style={styles.legacyArchiveNote}>
          ℹ️ Archivio creato prima dell&apos;aggiornamento. Elimina e riarchivia per vedere i conteggi Coach/Collaboratori/Dirigenti.
        </Text>
      )}
      
      {/* Teams in archived season */}
      {season.teams?.map((team, index) => (
        <View key={index} style={styles.archivedTeamRow}>
          <Text style={styles.archivedTeamName}>• {team.name || team.team_name}</Text>
          <Text style={styles.archivedTeamAthletes}>{team.total_athletes} atleti</Text>
        </View>
      ))}

      {/* 🆕 01/07/2026 — Pulsante "Riconferma da archivio" */}
      <TouchableOpacity
        onPress={() => router.push(`/admin/season-reconfirm?season=${encodeURIComponent(season.season_name)}` as any)}
        style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B5E20', paddingVertical: 12, borderRadius: 10 }}
        data-testid={`reconfirm-from-archive-${season.season_name}`}
      >
        <Ionicons name="checkmark-done" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
          Riconferma da {season.season_name} → stagione corrente
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
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
              data-testid="archive-season-btn"
            >
              <Ionicons name="archive" size={20} color="#fff" />
              <Text style={styles.archiveButtonText}>
                {archiving ? 'Archiviazione...' : `Archivia stagione ${getPreviousSeasonLabel()}`}
              </Text>
            </TouchableOpacity>

            <Text style={styles.archiveNote}>
              💡 L&apos;archiviazione salva uno snapshot della stagione corrente. Può essere eseguita più volte.
            </Text>

            {/* 🆕 04/07/2026 — Backfill reset assegnazioni (per riconferme vecchie senza svuotamento) */}
            <TouchableOpacity
              onPress={handleBackfillReset}
              style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F57C00', paddingVertical: 12, borderRadius: 8, gap: 8 }}
              data-testid="backfill-reset-btn"
            >
              <Ionicons name="refresh-circle" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                🔄 Reset assegnazioni Atleti + Coach + Collab + Dir (riconferme vecchie)
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
              Applica lo &quot;svuota squadre + snapshot&quot; anche a chi era stato riconfermato prima del fix.
            </Text>

            {/* 🆕 01/07/2026 — Import riconfermati nella stagione corrente */}
            {importPreview && (importPreview.to_import > 0 || importPreview.to_inactivate > 0) && (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#2E7D32' }}>
                <Text style={{ fontWeight: '700', color: '#1B5E20', marginBottom: 6 }}>
                  🔄 Importa riconfermati ({importPreview.season})
                </Text>
                <Text style={{ fontSize: 13, color: '#2E7D32', marginBottom: 10 }}>
                  Pronti per l&apos;import: <Text style={{ fontWeight: '700' }}>{importPreview.to_import}</Text> tra atleti, coach, collaboratori e dirigenti riconfermati.{'\n'}
                  Verranno marcati &quot;inactive&quot;: <Text style={{ fontWeight: '700' }}>{importPreview.to_inactivate}</Text> non riconfermati.
                </Text>
                <TouchableOpacity
                  onPress={handleImportRenewed}
                  disabled={importing || importPreview.to_import === 0}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2E7D32', paddingVertical: 12, borderRadius: 8, gap: 8, opacity: importing || importPreview.to_import === 0 ? 0.6 : 1 }}
                  data-testid="import-renewed-btn"
                >
                  <Ionicons name="download" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {importing ? 'Importazione...' : `Importa ${importPreview.to_import} riconfermati`}
                  </Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 11, color: '#558B2F', marginTop: 6, fontStyle: 'italic' }}>
                  💡 Per riconfermare, vai sulle liste Atleti/Coach/Collaboratori/Dirigenti e clicca il flag &quot;Riconferma&quot; su ognuno.
                </Text>
              </View>
            )}
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
  archivedStatSublabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  legacyArchiveNote: {
    fontSize: 11,
    color: '#F57C00',
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center',
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
