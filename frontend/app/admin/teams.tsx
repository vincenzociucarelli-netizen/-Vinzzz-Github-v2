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

export default function TeamsScreen() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
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
  const [venue, setVenue] = useState('');
  const [trainingSchedule, setTrainingSchedule] = useState('');
  const [championships, setChampionships] = useState('');
  const [calendarLink, setCalendarLink] = useState('');

  const loadTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
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
    setVenue('');
    setTrainingSchedule('');
    setChampionships('');
    setCalendarLink('');
  };

  const handleCreateTeam = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Inserisci il nome della squadra');
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

    setLoading(true);
    try {
      await api.post('/teams', {
        name,
        description,
        total_amount: parseFloat(totalAmount),
        installment_1_amount: parseFloat(installment1),
        installment_2_amount: parseFloat(installment2),
        installment_2_due_date: installment2Date,
        installment_3_amount: parseFloat(installment3),
        installment_3_due_date: installment3Date,
        bank_info: bankInfo,
        paypal_email: paypalEmail,
        venue: venue || null,
        training_schedule: trainingSchedule || null,
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

  const renderTeamItem = ({ item }: { item: Team }) => (
    <TouchableOpacity 
      style={styles.teamCard}
      onPress={() => router.push(`/admin/team/${item.id}`)}
    >
      <View style={styles.teamIcon}>
        <Ionicons name="basketball" size={24} color="#007AFF" />
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.teamDesc}>{item.description}</Text>
        )}
        <Text style={styles.teamAmount}>
          Quota: €{item.total_amount} (€{item.installment_1_amount}/€{item.installment_2_amount}/€{item.installment_3_amount})
        </Text>
        {item.training_days && (
          <Text style={styles.teamTraining}>
            <Ionicons name="calendar" size={10} /> {item.training_days} - {item.training_time}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

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

              <Text style={styles.sectionTitle}>🏟️ Sede Allenamenti</Text>

              <Text style={styles.label}>Palestra/Campo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Palestra Liceo Alessi"
                value={venue}
                onChangeText={setVenue}
              />

              <Text style={styles.label}>Orari Allenamenti</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Es: Lunedì 18:00-20:00, Mercoledì 19:00-21:00, Venerdì 18:00-20:00"
                value={trainingSchedule}
                onChangeText={setTrainingSchedule}
                multiline
                numberOfLines={3}
              />

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

              <Text style={styles.label}>Scadenza Rata 2 (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 2025-03-31"
                value={installment2Date}
                onChangeText={setInstallment2Date}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>Rata 3 (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 200"
                value={installment3}
                onChangeText={setInstallment3}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Scadenza Rata 3 (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 2025-06-30"
                value={installment3Date}
                onChangeText={setInstallment3Date}
                keyboardType="numbers-and-punctuation"
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
  teamCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
});
