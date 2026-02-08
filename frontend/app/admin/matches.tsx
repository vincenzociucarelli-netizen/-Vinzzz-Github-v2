import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';

interface Match {
  id: string;
  team_id: string;
  team_name: string;
  date: string;
  opponent: string;
  venue: string;
  home_away: string;
  meeting_time?: string;
  notes?: string;
  result?: string;
}

interface Team {
  id: string;
  name: string;
}

export default function AdminMatches() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    team_id: '',
    date: '',
    time: '',
    opponent: '',
    venue: '',
    city: '',
    home_away: 'home',
    meeting_time: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [matchesRes, teamsRes] = await Promise.all([
        api.get('/matches'),
        api.get('/teams'),
      ]);
      setMatches(matchesRes.data);
      setTeams(teamsRes.data);
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

  const resetForm = () => {
    setFormData({
      team_id: '',
      date: '',
      time: '',
      opponent: '',
      venue: '',
      city: '',
      home_away: 'home',
      meeting_time: '',
      notes: '',
    });
    setEditingMatch(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (match: Match) => {
    const matchDate = new Date(match.date);
    setEditingMatch(match);
    setFormData({
      team_id: match.team_id,
      date: matchDate.toISOString().split('T')[0],
      time: matchDate.toTimeString().slice(0, 5),
      opponent: match.opponent,
      venue: match.venue,
      city: (match as any).city || '',
      home_away: match.home_away,
      meeting_time: match.meeting_time || '',
      notes: match.notes || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.team_id || !formData.date || !formData.opponent) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    setSaving(true);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time || '00:00'}`);
      
      const payload = {
        team_id: formData.team_id,
        date: dateTime.toISOString(),
        opponent: formData.opponent,
        venue: formData.venue,
        city: formData.home_away === 'away' ? formData.city : null,
        home_away: formData.home_away,
        meeting_time: formData.meeting_time || null,
        notes: formData.notes || null,
      };

      if (editingMatch) {
        await api.patch(`/matches/${editingMatch.id}`, payload);
      } else {
        await api.post('/matches', payload);
      }

      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (matchId: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Eliminare questa gara?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Elimina Gara',
            'Sei sicuro di voler eliminare questa gara?',
            [
              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Elimina', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      await api.delete(`/matches/${matchId}`);
      loadData();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile eliminare la gara');
    }
  };

  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
      });

      if (result.canceled) return;

      setImporting(true);

      const file = result.assets[0];
      let fileContent;
      
      if (Platform.OS === 'web') {
        // Web: fetch the file and read as array buffer
        const response = await fetch(file.uri);
        fileContent = await response.arrayBuffer();
      } else {
        // Mobile: read as base64 and convert
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileContent = bytes.buffer;
      }

      // Parse Excel
      const workbook = XLSX.read(fileContent, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Show preview modal
      setImportModalVisible(true);
      
      // Map Excel data to matches format
      // Supporto per formato Federazione: CAMPIONATONOME, DATA (con ora), SQUADRAOSPITENOME, IMPIANTO, IMPIANTO INDIRIZZO
      const matchesData = jsonData.map((row: any) => {
        // CAMPIONATONOME contiene l'identificativo della squadra (es. "U14 Maschile Campionato")
        const campionato = row['CAMPIONATONOME'] || row['Campionato'] || row['campionato'] || '';
        
        // Fallback al vecchio formato per compatibilità
        const teamNameLegacy = row['Squadra'] || row['squadra'] || row['Team'] || row['team'] || '';
        const teamSearchKey = campionato || teamNameLegacy;
        
        // Cerca la squadra che contiene l'identificativo del campionato nel nome
        const team = teams.find(t => {
          const tName = t.name.toLowerCase();
          const searchLower = teamSearchKey.toLowerCase();
          // Match esatto o parziale
          return tName === searchLower || 
                 tName.includes(searchLower) || 
                 searchLower.includes(tName);
        });
        
        // DATA - può contenere data e ora insieme (es. "15/06/2025 18:30:00")
        let dateTimeStr = row['DATA'] || row['Data'] || row['data'] || '';
        // Fallback al vecchio formato con colonne separate
        if (!dateTimeStr && (row['Data e Ora'] || row['Ora'])) {
          dateTimeStr = row['Data e Ora'] || `${row['Data'] || ''} ${row['Ora'] || '00:00'}`;
        }
        // Rimuovi secondi se presenti (HH:MM:SS → HH:MM)
        if (dateTimeStr && typeof dateTimeStr === 'string') {
          // Se contiene :SS alla fine, rimuovilo per la visualizzazione ma tienilo per il parsing
          dateTimeStr = dateTimeStr.trim();
        }
        
        // SQUADRAOSPITENOME - avversario
        const opponent = row['SQUADRAOSPITENOME'] || row['Avversario'] || row['avversario'] || row['Opponent'] || '';
        
        // IMPIANTO - nome palestra (può contenere anche la città)
        const impianto = row['IMPIANTO'] || row['Impianto'] || row['Luogo'] || row['luogo'] || row['Venue'] || '';
        
        // IMPIANTO INDIRIZZO - indirizzo completo
        const indirizzo = row['IMPIANTO INDIRIZZO'] || row['Indirizzo'] || row['indirizzo'] || '';
        
        // Estrai città dall'impianto se contiene un trattino o virgola (es. "Palestra XYZ - Perugia")
        let venue = impianto;
        let city = '';
        if (impianto.includes(' - ')) {
          const parts = impianto.split(' - ');
          venue = parts[0].trim();
          city = parts.slice(1).join(' - ').trim();
        } else if (impianto.includes(', ')) {
          const parts = impianto.split(', ');
          venue = parts[0].trim();
          city = parts.slice(1).join(', ').trim();
        }
        
        // Casa/Trasferta - default "away" per gare federazione
        const homeAway = (row['Casa/Trasferta'] || row['home_away'] || 'away').toLowerCase().includes('casa') ? 'home' : 'away';
        
        return {
          team_id: team?.id || '',
          team_name: team?.name || teamSearchKey,
          date: dateTimeStr,
          opponent: opponent,
          venue: venue,
          address: indirizzo,
          city: city,
          home_away: homeAway,
          meeting_time: row['Ritrovo'] || row['meeting_time'] || '',
          notes: row['Note'] || row['notes'] || '',
        };
      });

      // Filter out invalid rows
      const validMatches = matchesData.filter((m: any) => m.team_id && m.opponent);
      
      if (validMatches.length === 0) {
        Alert.alert('Errore', 'Nessuna gara valida trovata nel file. Assicurati che le colonne siano: Squadra, Data, Ora, Avversario, Luogo, Casa/Trasferta, Ritrovo, Note');
        setImporting(false);
        return;
      }

      // Import matches
      const response = await api.post('/matches/import', { matches: validMatches });
      
      Alert.alert(
        'Import Completato',
        `Importate ${response.data.imported} gare${response.data.errors?.length > 0 ? `\n\nErrori: ${response.data.errors.join('\n')}` : ''}`
      );
      
      loadData();
    } catch (error: any) {
      console.error('Import error:', error);
      Alert.alert('Errore', 'Errore durante l\'importazione del file');
    } finally {
      setImporting(false);
      setImportModalVisible(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupMatchesByMonth = () => {
    const grouped: { [key: string]: Match[] } = {};
    matches.forEach(match => {
      const date = new Date(match.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      if (!grouped[monthName]) {
        grouped[monthName] = [];
      }
      grouped[monthName].push(match);
    });
    return grouped;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Caricamento gare...</Text>
      </View>
    );
  }

  const groupedMatches = groupMatchesByMonth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏐 Calendario Gare</Text>
        <TouchableOpacity onPress={handleImportExcel} style={styles.importBtn}>
          <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Instructions Card */}
      <View style={styles.instructionCard}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.instructionText}>
          Usa il pulsante ☁️ per importare gare da Excel. Colonne richieste: Squadra, Data, Ora, Avversario, Luogo
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna gara in calendario</Text>
            <Text style={styles.emptySubtext}>Aggiungi gare manualmente o importa da Excel</Text>
          </View>
        ) : (
          Object.entries(groupedMatches).map(([month, monthMatches]) => (
            <View key={month}>
              <Text style={styles.monthHeader}>{month.charAt(0).toUpperCase() + month.slice(1)}</Text>
              {monthMatches.map(match => {
                // Formatta il luogo: Casa = solo palestra, Trasferta = palestra - città
                const venueDisplay = match.home_away === 'away' && (match as any).city
                  ? `${match.venue || 'Da definire'} - ${(match as any).city}`
                  : match.venue || 'Da definire';
                  
                return (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchCard}
                  onPress={() => openEditModal(match)}
                >
                  <View style={styles.matchHeader}>
                    <View style={[styles.homeAwayBadge, match.home_away === 'away' && styles.awayBadge]}>
                      <Text style={styles.homeAwayText}>
                        {match.home_away === 'home' ? '🏠 Casa' : '✈️ Trasferta'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(match.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.matchTeam}>{match.team_name}</Text>
                  <Text style={styles.matchVs}>vs {match.opponent}</Text>
                  <View style={styles.matchDetails}>
                    <View style={styles.matchDetailItem}>
                      <Ionicons name="calendar-outline" size={14} color="#666" />
                      <Text style={styles.matchDetailText}>{formatDate(match.date)}</Text>
                    </View>
                    <View style={styles.matchDetailItem}>
                      <Ionicons name="location-outline" size={14} color="#666" />
                      <Text style={styles.matchDetailText}>{venueDisplay}</Text>
                    </View>
                    {match.meeting_time && (
                      <View style={styles.matchDetailItem}>
                        <Ionicons name="time-outline" size={14} color="#FF9500" />
                        <Text style={[styles.matchDetailText, { color: '#FF9500' }]}>
                          Ritrovo: {match.meeting_time}
                        </Text>
                      </View>
                    )}
                  </View>
                  {match.notes && (
                    <Text style={styles.matchNotes}>📝 {match.notes}</Text>
                  )}
                </TouchableOpacity>
              );
              })}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMatch ? 'Modifica Gara' : 'Nuova Gara'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Squadra *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.team_id}
                  onValueChange={(v) => setFormData({ ...formData, team_id: v })}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleziona squadra..." value="" />
                  {teams.map(team => (
                    <Picker.Item key={team.id} label={team.name} value={team.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Data *</Text>
              <TextInput
                style={styles.input}
                value={formData.date}
                onChangeText={(v) => setFormData({ ...formData, date: v })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.label}>Ora</Text>
              <TextInput
                style={styles.input}
                value={formData.time}
                onChangeText={(v) => setFormData({ ...formData, time: v })}
                placeholder="HH:MM"
              />

              <Text style={styles.label}>Avversario *</Text>
              <TextInput
                style={styles.input}
                value={formData.opponent}
                onChangeText={(v) => setFormData({ ...formData, opponent: v })}
                placeholder="Nome squadra avversaria"
              />

              <Text style={styles.label}>Luogo</Text>
              <TextInput
                style={styles.input}
                value={formData.venue}
                onChangeText={(v) => setFormData({ ...formData, venue: v })}
                placeholder="Palestra / Campo"
              />

              <Text style={styles.label}>Casa / Trasferta</Text>
              <View style={styles.homeAwaySelector}>
                <TouchableOpacity
                  style={[styles.homeAwayOption, formData.home_away === 'home' && styles.homeAwaySelected]}
                  onPress={() => setFormData({ ...formData, home_away: 'home' })}
                >
                  <Text style={[styles.homeAwayOptionText, formData.home_away === 'home' && styles.homeAwaySelectedText]}>
                    🏠 Casa
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.homeAwayOption, formData.home_away === 'away' && styles.homeAwaySelected]}
                  onPress={() => setFormData({ ...formData, home_away: 'away' })}
                >
                  <Text style={[styles.homeAwayOptionText, formData.home_away === 'away' && styles.homeAwaySelectedText]}>
                    ✈️ Trasferta
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Campo Città visibile solo per trasferte */}
              {formData.home_away === 'away' && (
                <>
                  <Text style={styles.label}>Città (trasferta)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.city}
                    onChangeText={(v) => setFormData({ ...formData, city: v })}
                    placeholder="es: Terni, Foligno, Città di Castello..."
                  />
                </>
              )}

              <Text style={styles.label}>Orario Ritrovo</Text>
              <TextInput
                style={styles.input}
                value={formData.meeting_time}
                onChangeText={(v) => setFormData({ ...formData, meeting_time: v })}
                placeholder="es: 1 ora prima"
              />

              <Text style={styles.label}>Note</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(v) => setFormData({ ...formData, notes: v })}
                placeholder="Note aggiuntive..."
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {editingMatch ? 'Salva Modifiche' : 'Aggiungi Gara'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Import Loading Overlay */}
      {importing && (
        <View style={styles.importOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.importText}>Importazione in corso...</Text>
        </View>
      )}
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  importBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    marginRight: 8,
  },
  addBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    gap: 8,
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeAwayBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  awayBadge: {
    backgroundColor: '#FFF5EB',
  },
  homeAwayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
  matchTeam: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  matchVs: {
    fontSize: 14,
    color: '#333',
    marginVertical: 4,
  },
  matchDetails: {
    marginTop: 8,
    gap: 4,
  },
  matchDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchDetailText: {
    fontSize: 13,
    color: '#666',
  },
  matchNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  homeAwaySelector: {
    flexDirection: 'row',
    gap: 12,
  },
  homeAwayOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  homeAwaySelected: {
    backgroundColor: '#007AFF',
  },
  homeAwayOptionText: {
    fontSize: 14,
    color: '#333',
  },
  homeAwaySelectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 40,
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
});
