import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Team, TrainingSession, MatchDay } from '../../../src/types';
import { Picker } from '@react-native-picker/picker';

const DAYS_OF_WEEK = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function TeamDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Form fields - basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [championships, setChampionships] = useState('');
  const [calendarLink, setCalendarLink] = useState('');
  
  // Form fields - payments
  const [totalAmount, setTotalAmount] = useState('');
  const [installment1, setInstallment1] = useState('');
  const [installment2, setInstallment2] = useState('');
  const [installment2Date, setInstallment2Date] = useState('');
  const [installment3, setInstallment3] = useState('');
  const [installment3Date, setInstallment3Date] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  
  // Training sessions (2-4)
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([
    { day: 'Lunedì', timeStart: '', timeEnd: '', venue: '' },
    { day: 'Mercoledì', timeStart: '', timeEnd: '', venue: '' },
  ]);
  
  // Match day
  const [matchDay, setMatchDay] = useState<MatchDay>({
    day: 'Sabato',
    time: '',
    venue: '',
  });

  // Training modal
  const [trainingModalVisible, setTrainingModalVisible] = useState(false);

  const loadTeam = async () => {
    try {
      const response = await api.get(`/teams/${id}`);
      const teamData = response.data;
      setTeam(teamData);
      
      // Populate form
      setName(teamData.name);
      setDescription(teamData.description || '');
      setTotalAmount(teamData.total_amount?.toString() || '');
      setInstallment1(teamData.installment_1_amount?.toString() || '');
      setInstallment2(teamData.installment_2_amount?.toString() || '');
      setInstallment2Date(teamData.installment_2_due_date?.split('T')[0] || '');
      setInstallment3(teamData.installment_3_amount?.toString() || '');
      setInstallment3Date(teamData.installment_3_due_date?.split('T')[0] || '');
      setBankInfo(teamData.bank_info || '');
      setPaypalEmail(teamData.paypal_email || '');
      setChampionships(teamData.championships || '');
      setCalendarLink(teamData.calendar_link || '');
      
      // Load training sessions
      if (teamData.training_sessions && teamData.training_sessions.length > 0) {
        setTrainingSessions(teamData.training_sessions);
      }
      
      // Load match day
      if (teamData.match_day) {
        setMatchDay(teamData.match_day);
      }
    } catch (error) {
      console.error('Error loading team:', error);
      showAlert('Errore', 'Impossibile caricare i dati della squadra');
    }
  };

  useEffect(() => {
    loadTeam();
  }, [id]);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeam();
    setRefreshing(false);
  };

  const addTrainingSession = () => {
    if (trainingSessions.length >= 4) {
      showAlert('Limite raggiunto', 'Massimo 4 allenamenti settimanali');
      return;
    }
    setTrainingSessions([...trainingSessions, { day: 'Giovedì', timeStart: '', timeEnd: '', venue: '' }]);
  };

  const removeTrainingSession = (index: number) => {
    if (trainingSessions.length <= 2) {
      showAlert('Limite minimo', 'Minimo 2 allenamenti settimanali');
      return;
    }
    const newSessions = trainingSessions.filter((_, i) => i !== index);
    setTrainingSessions(newSessions);
  };

  const updateTrainingSession = (index: number, field: keyof TrainingSession, value: string) => {
    const newSessions = [...trainingSessions];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setTrainingSessions(newSessions);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Errore', 'Inserisci il nome della squadra');
      return;
    }

    try {
      const updateData: any = {
        name,
        description: description || null,
        championships: championships || null,
        calendar_link: calendarLink || null,
        training_sessions: trainingSessions,
        match_day: matchDay,
      };

      // Only include payment fields if they are provided
      if (totalAmount) updateData.total_amount = parseFloat(totalAmount);
      if (installment1) updateData.installment_1_amount = parseFloat(installment1);
      if (installment2) updateData.installment_2_amount = parseFloat(installment2);
      if (installment2Date) updateData.installment_2_due_date = installment2Date;
      if (installment3) updateData.installment_3_amount = parseFloat(installment3);
      if (installment3Date) updateData.installment_3_due_date = installment3Date;
      if (bankInfo) updateData.bank_info = bankInfo;
      if (paypalEmail) updateData.paypal_email = paypalEmail;

      await api.patch(`/teams/${id}`, updateData);
      
      setEditing(false);
      setTrainingModalVisible(false);
      await loadTeam();
      showAlert('Successo', 'Squadra aggiornata con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    }
  };

  const handleOpenCalendar = () => {
    if (calendarLink) {
      Linking.openURL(calendarLink).catch(() => {
        showAlert('Errore', 'Impossibile aprire il link');
      });
    }
  };

  if (!team) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{team.name}</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Ionicons name={editing ? "close" : "create"} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {editing ? (
          // EDIT MODE
          <View style={styles.editForm}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 Informazioni Base</Text>
              <Text style={styles.inputLabel}>Nome Squadra *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nome squadra"
              />

              <Text style={styles.inputLabel}>Descrizione</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Descrizione opzionale"
                multiline
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Quote e Pagamenti</Text>
              <Text style={styles.inputLabel}>Quota Totale (€)</Text>
              <TextInput
                style={styles.input}
                value={totalAmount}
                onChangeText={setTotalAmount}
                keyboardType="decimal-pad"
                placeholder="Es: 450"
              />

              <Text style={styles.inputLabel}>Prima Rata (€)</Text>
              <TextInput
                style={styles.input}
                value={installment1}
                onChangeText={setInstallment1}
                keyboardType="decimal-pad"
                placeholder="Es: 150"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Seconda Rata (€)</Text>
                  <TextInput
                    style={styles.input}
                    value={installment2}
                    onChangeText={setInstallment2}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Scadenza</Text>
                  <TextInput
                    style={styles.input}
                    value={installment2Date}
                    onChangeText={setInstallment2Date}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Terza Rata (€)</Text>
                  <TextInput
                    style={styles.input}
                    value={installment3}
                    onChangeText={setInstallment3}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Scadenza</Text>
                  <TextInput
                    style={styles.input}
                    value={installment3Date}
                    onChangeText={setInstallment3Date}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Coordinate Bancarie</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bankInfo}
                onChangeText={setBankInfo}
                multiline
                placeholder="IBAN e intestatario"
              />

              <Text style={styles.inputLabel}>Email PayPal</Text>
              <TextInput
                style={styles.input}
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                keyboardType="email-address"
                placeholder="paypal@email.com"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏆 Campionati</Text>
              <TextInput
                style={styles.input}
                value={championships}
                onChangeText={setChampionships}
                placeholder="Es: Serie C, Coppa Italia"
              />
              <Text style={styles.inputLabel}>Link Calendario Federazione</Text>
              <TextInput
                style={styles.input}
                value={calendarLink}
                onChangeText={setCalendarLink}
                placeholder="https://..."
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Salva Modifiche</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // VIEW MODE
          <>
            {/* Training Schedule Card */}
            <View style={styles.trainingCard}>
              <View style={styles.trainingHeader}>
                <Text style={styles.trainingTitle}>🏋️ Allenamenti Settimanali</Text>
                <TouchableOpacity 
                  style={styles.editTrainingBtn}
                  onPress={() => setTrainingModalVisible(true)}
                >
                  <Ionicons name="pencil" size={18} color="#007AFF" />
                  <Text style={styles.editTrainingText}>Modifica</Text>
                </TouchableOpacity>
              </View>
              
              {/* Training Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.dayCell]}>GIORNO</Text>
                <Text style={[styles.tableHeaderCell, styles.timeCell]}>ORARIO</Text>
                <Text style={[styles.tableHeaderCell, styles.venueCell]}>PALESTRA</Text>
              </View>
              
              {/* Training Rows */}
              {trainingSessions.map((session, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.dayCell]}>{session.day}</Text>
                  <Text style={[styles.tableCell, styles.timeCell]}>{session.time || '-'}</Text>
                  <Text style={[styles.tableCell, styles.venueCell]}>{session.venue || '-'}</Text>
                </View>
              ))}
              
              {/* Match Day Section */}
              <View style={styles.matchDayHeader}>
                <Ionicons name="trophy" size={18} color="#FF9500" />
                <Text style={styles.matchDayTitle}>GARA IN CASA</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.dayCell]}>{matchDay.day}</Text>
                <Text style={[styles.tableCell, styles.timeCell]}>{matchDay.time || '-'}</Text>
                <Text style={[styles.tableCell, styles.venueCell]}>{matchDay.venue || '-'}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Quote</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Quota Totale:</Text>
                <Text style={styles.value}>€{team.total_amount}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>1ª Rata (iscrizione):</Text>
                <Text style={styles.value}>€{team.installment_1_amount}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>2ª Rata:</Text>
                <Text style={styles.value}>€{team.installment_2_amount}</Text>
              </View>
              {team.installment_2_due_date && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Scadenza 2ª Rata:</Text>
                  <Text style={styles.value}>{new Date(team.installment_2_due_date).toLocaleDateString('it-IT')}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.label}>3ª Rata:</Text>
                <Text style={styles.value}>€{team.installment_3_amount}</Text>
              </View>
              {team.installment_3_due_date && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Scadenza 3ª Rata:</Text>
                  <Text style={styles.value}>{new Date(team.installment_3_due_date).toLocaleDateString('it-IT')}</Text>
                </View>
              )}
            </View>

            {/* Bank Info Section */}
            {(team.bank_info || team.paypal_email) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏦 Dati per il Pagamento</Text>
                {team.bank_info && (
                  <View style={styles.bankInfoBox}>
                    <Text style={styles.bankInfoLabel}>Bonifico Bancario:</Text>
                    <Text style={styles.bankInfoText}>{team.bank_info}</Text>
                  </View>
                )}
                {team.paypal_email && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>PayPal:</Text>
                    <Text style={styles.value}>{team.paypal_email}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏆 Campionati</Text>
              {team.championships ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Campionati:</Text>
                    <Text style={styles.value}>{team.championships}</Text>
                  </View>
                  {team.calendar_link && (
                    <TouchableOpacity style={styles.linkButton} onPress={handleOpenCalendar}>
                      <Ionicons name="link" size={20} color="#007AFF" />
                      <Text style={styles.linkText}>Calendario Federazione</Text>
                      <Ionicons name="open-outline" size={16} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun campionato configurato</Text>
              )}
            </View>

            {/* Link to Team Attendances */}
            <TouchableOpacity 
              style={styles.attendanceLink}
              onPress={() => router.push(`/admin/team/${id}/attendances`)}
            >
              <View style={styles.attendanceLinkContent}>
                <View style={styles.attendanceLinkIcon}>
                  <Ionicons name="calendar-outline" size={28} color="#5856D6" />
                </View>
                <View style={styles.attendanceLinkText}>
                  <Text style={styles.attendanceLinkTitle}>Registro Presenze</Text>
                  <Text style={styles.attendanceLinkSubtitle}>Statistiche settimanali e mensili</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Training Edit Modal */}
      <Modal
        visible={trainingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTrainingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.trainingModalContent}>
            <Text style={styles.modalTitle}>Modifica Allenamenti</Text>
            
            <ScrollView style={styles.trainingModalScroll}>
              {/* Training Sessions */}
              <Text style={styles.modalSectionTitle}>Allenamenti Settimanali (2-4)</Text>
              
              {trainingSessions.map((session, index) => (
                <View key={index} style={styles.trainingFormRow}>
                  <View style={styles.trainingFormHeader}>
                    <Text style={styles.trainingFormLabel}>Allenamento {index + 1}</Text>
                    {trainingSessions.length > 2 && (
                      <TouchableOpacity onPress={() => removeTrainingSession(index)}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.trainingInputRow}>
                    <View style={styles.pickerWrapper}>
                      <Text style={styles.miniLabel}>Giorno</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={session.day}
                          onValueChange={(value) => updateTrainingSession(index, 'day', value)}
                          style={styles.picker}
                        >
                          {DAYS_OF_WEEK.map((day) => (
                            <Picker.Item key={day} label={day} value={day} />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.trainingInputRow}>
                    <View style={styles.timeInputWrapper}>
                      <Text style={styles.miniLabel}>Orario</Text>
                      <TextInput
                        style={styles.input}
                        value={session.time}
                        onChangeText={(value) => updateTrainingSession(index, 'time', value)}
                        placeholder="Es: 18:00 / 20:00"
                      />
                    </View>
                    <View style={styles.venueInputWrapper}>
                      <Text style={styles.miniLabel}>Palestra</Text>
                      <TextInput
                        style={styles.input}
                        value={session.venue}
                        onChangeText={(value) => updateTrainingSession(index, 'venue', value)}
                        placeholder="Es: Palestra Liceo"
                      />
                    </View>
                  </View>
                </View>
              ))}
              
              {trainingSessions.length < 4 && (
                <TouchableOpacity style={styles.addTrainingBtn} onPress={addTrainingSession}>
                  <Ionicons name="add-circle" size={20} color="#007AFF" />
                  <Text style={styles.addTrainingText}>Aggiungi Allenamento</Text>
                </TouchableOpacity>
              )}
              
              {/* Match Day */}
              <Text style={styles.modalSectionTitle}>Gara in Casa</Text>
              <View style={styles.trainingFormRow}>
                <View style={styles.trainingInputRow}>
                  <View style={styles.pickerWrapper}>
                    <Text style={styles.miniLabel}>Giorno Gara</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={matchDay.day}
                        onValueChange={(value) => setMatchDay({...matchDay, day: value})}
                        style={styles.picker}
                      >
                        {DAYS_OF_WEEK.map((day) => (
                          <Picker.Item key={day} label={day} value={day} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
                
                <View style={styles.trainingInputRow}>
                  <View style={styles.timeInputWrapper}>
                    <Text style={styles.miniLabel}>Orario</Text>
                    <TextInput
                      style={styles.input}
                      value={matchDay.time}
                      onChangeText={(value) => setMatchDay({...matchDay, time: value})}
                      placeholder="Es: 18:00"
                    />
                  </View>
                  <View style={styles.venueInputWrapper}>
                    <Text style={styles.miniLabel}>Palestra</Text>
                    <TextInput
                      style={styles.input}
                      value={matchDay.venue}
                      onChangeText={(value) => setMatchDay({...matchDay, venue: value})}
                      placeholder="Es: Palestra Liceo"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setTrainingModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>Salva</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  bankInfoBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  bankInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  bankInfoText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    marginTop: 8,
  },
  linkText: {
    flex: 1,
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 14,
  },
  // Training Card
  trainingCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  trainingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  editTrainingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editTrainingText: {
    color: '#007AFF',
    fontSize: 14,
    marginLeft: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    fontSize: 13,
    color: '#333',
  },
  dayCell: {
    flex: 2,
  },
  timeCell: {
    flex: 2,
    textAlign: 'center',
  },
  venueCell: {
    flex: 3,
  },
  matchDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  matchDayTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9500',
    marginLeft: 8,
  },
  // Edit Form
  editForm: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Attendance Link
  attendanceLink: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
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
  attendanceLinkContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendanceLinkIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#F0EFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceLinkText: {
    marginLeft: 12,
    flex: 1,
  },
  attendanceLinkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  attendanceLinkSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  // Training Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  trainingModalScroll: {
    padding: 16,
    maxHeight: 500,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
    marginTop: 8,
  },
  trainingFormRow: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  trainingFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trainingFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  trainingInputRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timeInputWrapper: {
    flex: 1,
    marginRight: 16,
  },
  venueInputWrapper: {
    flex: 1.5,
  },
  pickerWrapper: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    minHeight: 60,
  },
  picker: {
    height: 60,
    width: '100%',
  },
  addTrainingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    marginBottom: 16,
  },
  addTrainingText: {
    color: '#007AFF',
    fontSize: 14,
    marginLeft: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
