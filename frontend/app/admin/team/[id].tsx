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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Team } from '../../../src/types';

export default function TeamDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
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
  const [trainingDays, setTrainingDays] = useState('');
  const [trainingTime, setTrainingTime] = useState('');
  const [championships, setChampionships] = useState('');
  const [calendarLink, setCalendarLink] = useState('');

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
      setTrainingDays(teamData.training_days || '');
      setTrainingTime(teamData.training_time || '');
      setChampionships(teamData.championships || '');
      setCalendarLink(teamData.calendar_link || '');
    } catch (error) {
      console.error('Error loading team:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati della squadra');
    }
  };

  useEffect(() => {
    loadTeam();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeam();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Inserisci il nome della squadra');
      return;
    }

    try {
      const updateData: any = {
        name,
        description: description || null,
        training_days: trainingDays || null,
        training_time: trainingTime || null,
        championships: championships || null,
        calendar_link: calendarLink || null,
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
      await loadTeam();
      Alert.alert('Successo', 'Squadra aggiornata con successo');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    }
  };

  const handleOpenCalendar = () => {
    if (calendarLink) {
      Linking.openURL(calendarLink).catch(() => {
        Alert.alert('Errore', 'Impossibile aprire il link');
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
        <TouchableOpacity onPress={() => editing ? setEditing(false) : setEditing(true)}>
          <Ionicons name={editing ? "close" : "create"} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!editing ? (
          // View Mode
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Informazioni Generali</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Nome:</Text>
                <Text style={styles.value}>{team.name}</Text>
              </View>
              {team.description && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Descrizione:</Text>
                  <Text style={styles.value}>{team.description}</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏟️ Allenamenti</Text>
              {team.training_days ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Giorni:</Text>
                    <Text style={styles.value}>{team.training_days}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Orari:</Text>
                    <Text style={styles.value}>{team.training_time}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun orario configurato</Text>
              )}
            </View>

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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💶 Quote e Pagamenti</Text>
              <View style={styles.paymentCard}>
                <Text style={styles.totalAmount}>Quota Totale: €{team.total_amount}</Text>
                <View style={styles.installments}>
                  <View style={styles.installmentItem}>
                    <Text style={styles.installmentLabel}>Rata 1 (7 giorni)</Text>
                    <Text style={styles.installmentAmount}>€{team.installment_1_amount}</Text>
                  </View>
                  <View style={styles.installmentItem}>
                    <Text style={styles.installmentLabel}>Rata 2 ({installment2Date})</Text>
                    <Text style={styles.installmentAmount}>€{team.installment_2_amount}</Text>
                  </View>
                  <View style={styles.installmentItem}>
                    <Text style={styles.installmentLabel}>Rata 3 ({installment3Date})</Text>
                    <Text style={styles.installmentAmount}>€{team.installment_3_amount}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentInfoTitle}>Modalità di Pagamento:</Text>
                <Text style={styles.paymentInfoText}>
                  <Text style={styles.bold}>Bonifico:</Text>
                  {'\n'}{team.bank_info}
                </Text>
                <Text style={styles.paymentInfoText}>
                  <Text style={styles.bold}>PayPal:</Text> {team.paypal_email}
                </Text>
              </View>
            </View>
          </>
        ) : (
          // Edit Mode
          <>
            <Text style={styles.editTitle}>Modifica Squadra</Text>

            <Text style={styles.label}>Nome Squadra *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Descrizione</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.sectionTitleEdit}>🏟️ Sede Allenamenti</Text>

            <Text style={styles.label}>Giorni Allenamento</Text>
            <TextInput
              style={styles.input}
              value={trainingDays}
              onChangeText={setTrainingDays}
              placeholder="Es: Lunedì, Mercoledì, Venerdì"
            />

            <Text style={styles.label}>Orari Allenamento</Text>
            <TextInput
              style={styles.input}
              value={trainingTime}
              onChangeText={setTrainingTime}
              placeholder="Es: 18:00 - 20:00"
            />

            <Text style={styles.sectionTitleEdit}>🏆 Campionati</Text>

            <Text style={styles.label}>Campionati Iscritti</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={championships}
              onChangeText={setChampionships}
              multiline
              numberOfLines={2}
              placeholder="Es: Serie C, Coppa Regionale"
            />

            <Text style={styles.label}>Link Calendario</Text>
            <TextInput
              style={styles.input}
              value={calendarLink}
              onChangeText={setCalendarLink}
              placeholder="https://federazione.it/calendario"
              keyboardType="url"
              autoCapitalize="none"
            />

            <Text style={styles.sectionTitleEdit}>💶 Quote e Scadenze</Text>

            <Text style={styles.label}>Quota Totale (€)</Text>
            <TextInput
              style={styles.input}
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Rata 1 (€)</Text>
            <TextInput
              style={styles.input}
              value={installment1}
              onChangeText={setInstallment1}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Rata 2 (€)</Text>
            <TextInput
              style={styles.input}
              value={installment2}
              onChangeText={setInstallment2}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Scadenza Rata 2 (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={installment2Date}
              onChangeText={setInstallment2Date}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Rata 3 (€)</Text>
            <TextInput
              style={styles.input}
              value={installment3}
              onChangeText={setInstallment3}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Scadenza Rata 3 (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={installment3Date}
              onChangeText={setInstallment3Date}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.sectionTitleEdit}>🏦 Info Pagamento</Text>

            <Text style={styles.label}>Dati Bonifico</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bankInfo}
              onChangeText={setBankInfo}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Email PayPal</Text>
            <TextInput
              style={styles.input}
              value={paypalEmail}
              onChangeText={setPaypalEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Salva Modifiche</Text>
            </TouchableOpacity>
          </>
        )}
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
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionTitleEdit: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 16,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginHorizontal: 16,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E3F2FF',
    borderRadius: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  paymentCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
  },
  installments: {
    gap: 12,
  },
  installmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  installmentLabel: {
    fontSize: 14,
    color: '#666',
  },
  installmentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentInfo: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
  },
  paymentInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  paymentInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
  editTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Attendance Link styles
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
});
