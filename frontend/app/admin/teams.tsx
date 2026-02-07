import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Team } from '../../src/types';
import { useAuthStore } from '../../src/store/authStore';

export default function TeamsScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [athletesCounts, setAthletesCounts] = useState<{[key: string]: number}>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installment1, setInstallment1] = useState('');
  const [installment2, setInstallment2] = useState('');
  const [installment2Date, setInstallment2Date] = useState('');
  const [installment3, setInstallment3] = useState('');
  const [installment3Date, setInstallment3Date] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [championships, setChampionships] = useState('');
  const [calendarLink, setCalendarLink] = useState('');
  
  // Training schedule - structured format
  const [trainings, setTrainings] = useState([
    { day: '', timeStart: '', timeEnd: '', venue: '' },
    { day: '', timeStart: '', timeEnd: '', venue: '' },
  ]);
  const [matchDay, setMatchDay] = useState({ day: '', time: '', venue: '' });
  
  const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  
  const addTraining = () => {
    if (trainings.length < 4) {
      setTrainings([...trainings, { day: '', timeStart: '', timeEnd: '', venue: '' }]);
    }
  };
  
  const removeTraining = (index: number) => {
    if (trainings.length > 2) {
      const newTrainings = trainings.filter((_, i) => i !== index);
      setTrainings(newTrainings);
    }
  };
  
  // Helper function to format time as HH:mm
  const formatTimeInput = (text: string): string => {
    // Remove all non-numeric characters
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // Limit to 4 digits
    cleaned = cleaned.slice(0, 4);
    
    // Add : after first 2 digits if we have more than 2
    if (cleaned.length > 2) {
      cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
    }
    
    return cleaned;
  };

  const updateTraining = (index: number, field: string, value: string) => {
    const newTrainings = [...trainings];
    // Apply time formatting for time fields
    if (field === 'timeStart' || field === 'timeEnd') {
      value = formatTimeInput(value);
    }
    newTrainings[index] = { ...newTrainings[index], [field]: value };
    setTrainings(newTrainings);
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

  const loadTeams = async () => {
    try {
      const [teamsRes, countsRes] = await Promise.all([
        api.get('/teams'),
        api.get('/teams/athletes-count/all'),
      ]);
      setTeams(teamsRes.data);
      setAthletesCounts(countsRes.data);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setTotalAmount('');
    setInstallment1('');
    setInstallment2('');
    setInstallment2Date('');
    setInstallment3('');
    setInstallment3Date('');
    setBankInfo('');
    setPaypalEmail('');
    setTrainings([
      { day: '', timeStart: '', timeEnd: '', venue: '' },
      { day: '', timeStart: '', timeEnd: '', venue: '' },
    ]);
    setMatchDay({ day: '', time: '', venue: '' });
    setChampionships('');
    setCalendarLink('');
  };

  const handleCreateTeam = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Inserisci il nome della squadra');
      return;
    }

    // Validate trainings (at least 2 complete)
    const validTrainings = trainings.filter(t => t.day && t.timeStart && t.timeEnd && t.venue);
    if (validTrainings.length < 2) {
      Alert.alert('Errore', 'Inserisci almeno 2 allenamenti completi');
      return;
    }

    // Match day is optional - only validate if partially filled
    const hasPartialMatchDay = matchDay.day || matchDay.time || matchDay.venue;
    const hasCompleteMatchDay = matchDay.day && matchDay.time && matchDay.venue;
    if (hasPartialMatchDay && !hasCompleteMatchDay) {
      Alert.alert('Errore', 'Completa tutti i campi del giorno gara oppure lasciali tutti vuoti');
      return;
    }

    if (!totalAmount || !installment1 || !installment2 || !installment3) {
      Alert.alert('Errore', 'Inserisci tutti gli importi delle rate');
      return;
    }

    if (!installment2Date || !installment3Date) {
      Alert.alert('Errore', 'Inserisci le date di scadenza');
      return;
    }

    if (!bankInfo || !paypalEmail) {
      Alert.alert('Errore', 'Inserisci le informazioni di pagamento');
      return;
    }

    // Convert date from DD/MM/YYYY to YYYY-MM-DD
    const convertDate = (dateStr: string): string => {
      if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
        // Already in YYYY-MM-DD format
        return dateStr;
      }
      // Convert from DD/MM/YYYY to YYYY-MM-DD
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return dateStr;
    };

    // Build training schedule string from structured data
    let trainingScheduleStr = '';
    validTrainings.forEach((t, idx) => {
      trainingScheduleStr += `${t.day.toUpperCase()}: ${t.venue} dalle ${t.timeStart} alle ${t.timeEnd}\n`;
    });
    if (hasCompleteMatchDay) {
      trainingScheduleStr += `GIORNO GARA: ${matchDay.day.toUpperCase()} alle ${matchDay.time} - ${matchDay.venue}`;
    }

    setLoading(true);
    try {
      await api.post('/teams', {
        name,
        description,
        total_amount: parseFloat(totalAmount),
        installment_1_amount: parseFloat(installment1),
        installment_2_amount: parseFloat(installment2),
        installment_2_due_date: convertDate(installment2Date),
        installment_3_amount: parseFloat(installment3),
        installment_3_due_date: convertDate(installment3Date),
        bank_info: bankInfo,
        paypal_email: paypalEmail,
        training_schedule: trainingScheduleStr,
        trainings: validTrainings,
        match_day: hasCompleteMatchDay ? matchDay : null,
        championships: championships || null,
        calendar_link: calendarLink || null,
      });
      
      setModalVisible(false);
      resetForm();
      await loadTeams();
      Alert.alert('Successo', 'Squadra creata con successo');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    const athletesCount = athletesCounts[team.id] || 0;
    
    if (athletesCount > 0) {
      if (Platform.OS === 'web') {
        window.alert(`La squadra "${team.name}" ha ${athletesCount} atleti iscritti.\n\nTrasferire o eliminare gli atleti prima di poter eliminare la squadra.`);
      } else {
        Alert.alert(
          'Impossibile Eliminare',
          `La squadra "${team.name}" ha ${athletesCount} atleti iscritti.\n\nTrasferire o eliminare gli atleti prima di poter eliminare la squadra.`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Sei sicuro di voler eliminare la squadra "${team.name}"?\n\nQuesta azione è irreversibile.`);
      if (confirmed) {
        confirmDeleteTeam(team.id);
      }
    } else {
      Alert.alert(
        'Elimina Squadra',
        `Sei sicuro di voler eliminare la squadra "${team.name}"?\n\nQuesta azione è irreversibile.`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: () => confirmDeleteTeam(team.id),
          },
        ]
      );
    }
  };

  const confirmDeleteTeam = async (teamId: string) => {
    try {
      await api.delete(`/teams/${teamId}`);
      if (Platform.OS === 'web') {
        window.alert('Squadra eliminata con successo');
      } else {
        Alert.alert('Successo', 'Squadra eliminata con successo');
      }
      await loadTeams();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore durante l\'eliminazione';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
    }
  };

  const renderTeamItem = ({ item }: { item: Team }) => {
    const athletesCount = athletesCounts[item.id] || 0;
    
    return (
      <View style={styles.teamCardContainer}>
        <TouchableOpacity 
          style={styles.teamCard}
          onPress={() => router.push(`/admin/team/${item.id}`)}
        >
          <View style={styles.teamIcon}>
            <Ionicons name="people" size={24} color="#007AFF" />
          </View>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{item.name}</Text>
            <View style={styles.teamStats}>
              <View style={styles.statBadge}>
                <Ionicons name="person" size={12} color="#666" />
                <Text style={styles.statText}>{athletesCount} atleti</Text>
              </View>
            </View>
            <Text style={styles.teamAmount}>
              Quota: €{item.total_amount} (€{item.installment_1_amount}/€{item.installment_2_amount}/€{item.installment_3_amount})
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteTeamButton}
          onPress={() => handleDeleteTeam(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Squadre</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={teams}
        renderItem={renderTeamItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="basketball-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna squadra</Text>
            <Text style={styles.emptySubtext}>Tocca + per creare una squadra</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuova Squadra</Text>

              <Text style={styles.label}>Nome Squadra *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Under 15"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Descrizione</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descrizione squadra (opzionale)"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.sectionTitle}>🏟️ Allenamenti Settimanali</Text>
              <Text style={styles.hint}>Minimo 2, massimo 4 allenamenti</Text>

              {trainings.map((training, index) => (
                <View key={index} style={styles.trainingRow}>
                  <View style={styles.trainingHeader}>
                    <Text style={styles.trainingLabel}>Allenamento {index + 1}</Text>
                    {trainings.length > 2 && (
                      <TouchableOpacity onPress={() => removeTraining(index)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.trainingFields}>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Giorno</Text>
                        <View style={styles.pickerContainer}>
                          <TouchableOpacity 
                            style={styles.pickerButton}
                            onPress={() => {
                              if (Platform.OS === 'web') {
                                // For web, use a simple prompt or cycle through days
                                const currentIdx = daysOfWeek.indexOf(training.day);
                                const nextIdx = (currentIdx + 1) % daysOfWeek.length;
                                updateTraining(index, 'day', daysOfWeek[nextIdx]);
                              }
                            }}
                          >
                            <Text style={training.day ? styles.pickerText : styles.pickerPlaceholder}>
                              {training.day || 'Seleziona'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#666" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Palestra</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="Es: Liceo Alessi"
                          value={training.venue}
                          onChangeText={(v) => updateTraining(index, 'venue', v)}
                        />
                      </View>
                    </View>
                    
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Dalle</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="18:00"
                          value={training.timeStart}
                          onChangeText={(v) => updateTraining(index, 'timeStart', v)}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Alle</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="20:00"
                          value={training.timeEnd}
                          onChangeText={(v) => updateTraining(index, 'timeEnd', v)}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {trainings.length < 4 && (
                <TouchableOpacity style={styles.addButton} onPress={addTraining}>
                  <Ionicons name="add-circle" size={20} color="#007AFF" />
                  <Text style={styles.addButtonText}>Aggiungi Allenamento</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.sectionTitle}>🏆 Giorno Gara</Text>
              
              <View style={styles.trainingFields}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.miniLabel}>Giorno</Text>
                    <View style={styles.pickerContainer}>
                      <TouchableOpacity 
                        style={styles.pickerButton}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            const currentIdx = daysOfWeek.indexOf(matchDay.day);
                            const nextIdx = (currentIdx + 1) % daysOfWeek.length;
                            setMatchDay({...matchDay, day: daysOfWeek[nextIdx]});
                          }
                        }}
                      >
                        <Text style={matchDay.day ? styles.pickerText : styles.pickerPlaceholder}>
                          {matchDay.day || 'Seleziona'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.miniLabel}>Orario</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="17:00"
                      value={matchDay.time}
                      onChangeText={(v) => setMatchDay({...matchDay, time: formatTimeInput(v)})}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldFull}>
                    <Text style={styles.miniLabel}>Palestra Gare Casalinghe</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="Es: Palasport Perugia"
                      value={matchDay.venue}
                      onChangeText={(v) => setMatchDay({...matchDay, venue: v})}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>🏆 Campionati</Text>

              <Text style={styles.label}>Campionati Iscritti</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Es: Serie C, Coppa Regionale"
                value={championships}
                onChangeText={setChampionships}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.label}>Link Calendario Federazione</Text>
              <TextInput
                style={styles.input}
                placeholder="https://federazione.it/calendario"
                value={calendarLink}
                onChangeText={setCalendarLink}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={styles.sectionTitle}>💶 Pagamenti</Text>

              <Text style={styles.label}>Quota Totale Annuale (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 600"
                value={totalAmount}
                onChangeText={setTotalAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Rata 1 - Dopo 7 giorni di prova (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 250"
                value={installment1}
                onChangeText={setInstallment1}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Rata 2 (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 150"
                value={installment2}
                onChangeText={setInstallment2}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Scadenza Rata 2 *</Text>
              <TextInput
                style={styles.input}
                placeholder="GG/MM/AAAA"
                value={installment2Date}
                onChangeText={(text) => {
                  // Auto-format: add / after day and month
                  let formatted = text.replace(/[^0-9]/g, '');
                  if (formatted.length > 2) {
                    formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                  }
                  if (formatted.length > 5) {
                    formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                  }
                  setInstallment2Date(formatted);
                }}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <Text style={styles.label}>Rata 3 (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 200"
                value={installment3}
                onChangeText={setInstallment3}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Scadenza Rata 3 *</Text>
              <TextInput
                style={styles.input}
                placeholder="GG/MM/AAAA"
                value={installment3Date}
                onChangeText={(text) => {
                  // Auto-format: add / after day and month
                  let formatted = text.replace(/[^0-9]/g, '');
                  if (formatted.length > 2) {
                    formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                  }
                  if (formatted.length > 5) {
                    formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                  }
                  setInstallment3Date(formatted);
                }}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <Text style={styles.sectionTitle}>🏦 Info Pagamento</Text>

              <Text style={styles.label}>Dati Bonifico Bancario *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="IBAN: IT00..."
                value={bankInfo}
                onChangeText={setBankInfo}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Email PayPal *</Text>
              <TextInput
                style={styles.input}
                placeholder="paypal@societa.it"
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.buttonSecondaryText}>Annulla</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleCreateTeam}
                  disabled={loading}
                >
                  <Text style={styles.buttonPrimaryText}>
                    {loading ? 'Creazione...' : 'Crea Squadra'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  },
  list: {
    padding: 16,
  },
  teamCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteTeamButton: {
    backgroundColor: '#fff',
    padding: 12,
    marginLeft: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FF',
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
  teamDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  teamAmount: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '500',
  },
  teamStats: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 2,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  teamVenue: {
    fontSize: 10,
    color: '#FF9500',
    marginTop: 2,
  },
  teamTraining: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    height: 120,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  trainingRow: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trainingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  trainingFields: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldFull: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  miniInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  trainingContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trainingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
  },
  pickerContainer: {
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  trainingRow: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  trainingFields: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldFull: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  miniInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  trainingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
