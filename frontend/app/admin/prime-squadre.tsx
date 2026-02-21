import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../src/services/api';

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  team_name?: string;
  monthly_compensation?: number;
  other_annual_compensation?: number;
  contract_start_date?: string;
  contract_end_date?: string;
  fees_waived?: boolean;
  compensation_accepted?: boolean;
  compensation_accepted_date?: string;
  compensation_summary?: {
    yearly_total: number;
    months_received: number;
    monthly_amount: number;
  };
}

interface PrimeSquadreStats {
  pro_enabled: boolean;
  total_members: number;
  max_members: number;
  available_slots: number;
  current_year: number;
  yearly_stats: {
    total_compensations: number;
    total_receipts: number;
  };
}

interface ConfigFormData {
  monthly_compensation: string;
  other_annual_compensation: string;
  contract_start_date: string;
  contract_end_date: string;
  fees_waived: boolean;
}

// Helper functions for date conversion
const isoToItalian = (isoDate: string): string => {
  if (!isoDate) return '';
  // Convert YYYY-MM-DD to DD/MM/YYYY
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
};

const italianToIso = (italianDate: string): string => {
  if (!italianDate) return '';
  // Convert DD/MM/YYYY to YYYY-MM-DD
  const parts = italianDate.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return italianDate;
};

export default function PrimeSquadrePage() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [stats, setStats] = useState<PrimeSquadreStats | null>(null);
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [athleteToAdd, setAthleteToAdd] = useState<Athlete | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [configForm, setConfigForm] = useState<ConfigFormData>({
    monthly_compensation: '',
    other_annual_compensation: '',
    contract_start_date: '01/09/2025',
    contract_end_date: '31/05/2026',
    fees_waived: false,
  });

  // Handle focus on amount fields - clear if zero
  const handleAmountFocus = (field: 'monthly_compensation' | 'other_annual_compensation') => {
    if (configForm[field] === '0' || configForm[field] === '') {
      setConfigForm({...configForm, [field]: ''});
    }
  };

  // Handle blur on amount fields - set to 0 if empty
  const handleAmountBlur = (field: 'monthly_compensation' | 'other_annual_compensation') => {
    if (configForm[field] === '') {
      setConfigForm({...configForm, [field]: '0'});
    }
  };

  const loadData = async () => {
    try {
      const [statsRes, athletesRes] = await Promise.all([
        api.get('/prime-squadre/stats'),
        api.get('/prime-squadre/athletes'),
      ]);
      setStats(statsRes.data);
      setAthletes(athletesRes.data);
    } catch (error: any) {
      console.error('Error loading Prime Squadre data:', error);
      if (error.response?.status === 403) {
        showAlert('Accesso Negato', 'Il modulo Prime Squadre non è attivo per questa società.');
        router.back();
      }
    }
  };

  const loadAllAthletes = async () => {
    try {
      const res = await api.get('/athletes');
      // Filter out athletes already in Prime Squadre
      const primeSquadreIds = athletes.map(a => a.id);
      const available = res.data.filter((a: Athlete) => !primeSquadreIds.includes(a.id) && !a.is_compensated);
      setAllAthletes(available);
    } catch (error) {
      console.error('Error loading athletes:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    if (showAddModal) {
      loadAllAthletes();
    }
  }, [showAddModal, athletes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleAddAthlete = async (athlete: Athlete) => {
    // Instead of immediately adding, show config modal
    setAthleteToAdd(athlete);
    setShowAddModal(false);
    setConfigForm({
      monthly_compensation: '',
      other_annual_compensation: '',
      contract_start_date: '01/09/2025',
      contract_end_date: '31/05/2026',
      fees_waived: false,
    });
    setShowConfigModal(true);
  };

  const handleConfirmAddAthlete = async () => {
    if (!athleteToAdd) return;
    
    try {
      // First enable the athlete in Prime Squadre
      await api.post(`/prime-squadre/athletes/${athleteToAdd.id}/enable`);
      
      // Then update their configuration (convert dates to ISO format)
      await api.patch(`/prime-squadre/athletes/${athleteToAdd.id}`, {
        monthly_compensation: parseFloat(configForm.monthly_compensation) || 0,
        other_annual_compensation: parseFloat(configForm.other_annual_compensation) || 0,
        contract_start_date: italianToIso(configForm.contract_start_date),
        contract_end_date: italianToIso(configForm.contract_end_date),
        fees_waived: configForm.fees_waived,
      });
      
      showAlert('Successo', `${athleteToAdd.first_name} ${athleteToAdd.last_name} aggiunto a Prime Squadre`);
      setShowConfigModal(false);
      setAthleteToAdd(null);
      loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile aggiungere atleta');
    }
  };

  const handleRemoveAthlete = async (athlete: Athlete) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Rimuovere ${athlete.first_name} ${athlete.last_name} da Prime Squadre?`)
      : await new Promise(resolve => {
          Alert.alert(
            'Conferma Rimozione',
            `Rimuovere ${athlete.first_name} ${athlete.last_name} da Prime Squadre?`,
            [
              { text: 'Annulla', onPress: () => resolve(false) },
              { text: 'Rimuovi', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (confirm) {
      try {
        await api.post(`/prime-squadre/athletes/${athlete.id}/disable`);
        showAlert('Successo', 'Atleta rimosso da Prime Squadre');
        loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Impossibile rimuovere atleta');
      }
    }
  };

  const handleSetCompensation = async () => {
    if (!selectedAthlete) return;
    
    try {
      await api.patch(`/prime-squadre/athletes/${selectedAthlete.id}`, {
        monthly_compensation: parseFloat(configForm.monthly_compensation) || 0,
        other_annual_compensation: parseFloat(configForm.other_annual_compensation) || 0,
        contract_start_date: italianToIso(configForm.contract_start_date),
        contract_end_date: italianToIso(configForm.contract_end_date),
        fees_waived: configForm.fees_waived,
      });
      showAlert('Successo', 'Configurazione aggiornata');
      setSelectedAthlete(null);
      setShowConfigModal(false);
      loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile aggiornare configurazione');
    }
  };

  const openEditConfig = (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setConfigForm({
      monthly_compensation: String(athlete.monthly_compensation || 0),
      other_annual_compensation: String(athlete.other_annual_compensation || 0),
      contract_start_date: isoToItalian(athlete.contract_start_date || '2025-09-01'),
      contract_end_date: isoToItalian(athlete.contract_end_date || '2026-05-31'),
      fees_waived: athlete.fees_waived || false,
    });
    setShowConfigModal(true);
  };

  const filteredAllAthletes = allAthletes.filter(a =>
    `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 Prime Squadre</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Card */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Statistiche {stats.current_year}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_members}</Text>
                <Text style={styles.statLabel}>Membri</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.available_slots}</Text>
                <Text style={styles.statLabel}>Posti liberi</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>€{stats.yearly_stats.total_compensations.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Tot. Compensi</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.yearly_stats.total_receipts}</Text>
                <Text style={styles.statLabel}>Quietanze</Text>
              </View>
            </View>
          </View>
        )}

        {/* Add Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          disabled={stats?.available_slots === 0}
        >
          <Text style={styles.addButtonText}>+ Aggiungi Atleta/Collaboratore</Text>
        </TouchableOpacity>

        {/* Athletes List */}
        <Text style={styles.sectionTitle}>Membri Prime Squadre ({athletes.length})</Text>
        
        {athletes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nessun membro ancora.</Text>
            <Text style={styles.emptySubtext}>Aggiungi atleti o collaboratori per iniziare.</Text>
          </View>
        ) : (
          athletes.map(athlete => (
            <View key={athlete.id} style={styles.athleteCard}>
              <View style={styles.athleteInfo}>
                <Text style={styles.athleteName}>
                  {athlete.last_name} {athlete.first_name}
                </Text>
                {athlete.team_name && (
                  <Text style={styles.athleteTeam}>{athlete.team_name}</Text>
                )}
                <View style={styles.compensationInfo}>
                  <Text style={styles.compensationText}>
                    Compenso: €{athlete.monthly_compensation || 0}/mese
                    {athlete.fees_waived && ' • Quote esenti'}
                  </Text>
                  {athlete.compensation_summary && (
                    <Text style={styles.yearlyText}>
                      Anno: €{athlete.compensation_summary.yearly_total.toLocaleString()} ({athlete.compensation_summary.months_received} mesi)
                    </Text>
                  )}
                  {athlete.contract_start_date && athlete.contract_end_date && (
                    <Text style={styles.contractText}>
                      Contratto: {athlete.contract_start_date.substring(5)} → {athlete.contract_end_date.substring(5)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.athleteActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openEditConfig(athlete)}
                >
                  <Text style={styles.actionButtonText}>⚙️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/admin/prime-squadre/${athlete.id}`)}
                >
                  <Text style={styles.actionButtonText}>📋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#FFEBEE' }]}
                  onPress={() => handleRemoveAthlete(athlete)}
                >
                  <Text style={styles.actionButtonText}>❌</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Athlete Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Aggiungi a Prime Squadre</Text>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca atleta..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            
            <ScrollView style={styles.athletesList}>
              {filteredAllAthletes.map(athlete => (
                <TouchableOpacity
                  key={athlete.id}
                  style={styles.athleteListItem}
                  onPress={() => handleAddAthlete(athlete)}
                >
                  <Text style={styles.athleteListName}>
                    {athlete.last_name} {athlete.first_name}
                  </Text>
                  {athlete.team_name && (
                    <Text style={styles.athleteListTeam}>{athlete.team_name}</Text>
                  )}
                </TouchableOpacity>
              ))}
              {filteredAllAthletes.length === 0 && (
                <Text style={styles.noResults}>Nessun atleta trovato</Text>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowAddModal(false);
                setSearchQuery('');
              }}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Configuration Modal (for both add and edit) */}
      <Modal visible={showConfigModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ maxHeight: '90%' }}>
            <View style={[styles.modalContent, { marginVertical: 40 }]}>
              <Text style={styles.modalTitle}>
                {athleteToAdd ? 'Configura Atleta Prime Squadre' : 'Modifica Configurazione'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {athleteToAdd 
                  ? `${athleteToAdd.last_name} ${athleteToAdd.first_name}`
                  : `${selectedAthlete?.last_name} ${selectedAthlete?.first_name}`
                }
              </Text>
              
              {/* Compenso Mensile */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>💰 Compenso Mensile</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputPrefix}>€</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Inserisci importo"
                    keyboardType="numeric"
                    value={configForm.monthly_compensation}
                    onChangeText={(v) => setConfigForm({...configForm, monthly_compensation: v})}
                    onFocus={() => handleAmountFocus('monthly_compensation')}
                    onBlur={() => handleAmountBlur('monthly_compensation')}
                  />
                  <Text style={styles.inputSuffix}>/mese</Text>
                </View>
                <Text style={styles.formHint}>Lascia vuoto se l'atleta non percepisce compensi</Text>
              </View>

              {/* Compensi Pregressi */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>📊 Compensi già percepiti nell'anno</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputPrefix}>€</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Inserisci importo"
                    keyboardType="numeric"
                    value={configForm.other_annual_compensation}
                    onChangeText={(v) => setConfigForm({...configForm, other_annual_compensation: v})}
                    onFocus={() => handleAmountFocus('other_annual_compensation')}
                    onBlur={() => handleAmountBlur('other_annual_compensation')}
                  />
                </View>
                <Text style={styles.formHint}>Compensi da altre ASD nell'anno corrente (per calcolo soglie €5K/€15K)</Text>
              </View>

              {/* Date Contratto */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>📅 Periodo Contrattuale</Text>
                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <Text style={styles.dateLabel}>Inizio</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="gg/mm/aaaa"
                      value={configForm.contract_start_date}
                      onChangeText={(v) => setConfigForm({...configForm, contract_start_date: v})}
                    />
                  </View>
                  <View style={styles.dateField}>
                    <Text style={styles.dateLabel}>Fine</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="gg/mm/aaaa"
                      value={configForm.contract_end_date}
                      onChangeText={(v) => setConfigForm({...configForm, contract_end_date: v})}
                    />
                  </View>
                </View>
                <Text style={styles.formHint}>Formato: gg/mm/aaaa</Text>
              </View>

              {/* Quote Esenti */}
              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>💳 Esenzione Quote</Text>
                    <Text style={styles.formHint}>
                      {configForm.fees_waived 
                        ? 'L\'atleta NON pagherà più le quote (professionista)'
                        : 'L\'atleta continuerà a pagare le quote'}
                    </Text>
                  </View>
                  <Switch
                    value={configForm.fees_waived}
                    onValueChange={(v) => setConfigForm({...configForm, fees_waived: v})}
                    trackColor={{ false: '#ddd', true: '#B8860B' }}
                    thumbColor={configForm.fees_waived ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowConfigModal(false);
                    setAthleteToAdd(null);
                    setSelectedAthlete(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={athleteToAdd ? handleConfirmAddAthlete : handleSetCompensation}
                >
                  <Text style={styles.confirmButtonText}>
                    {athleteToAdd ? 'Aggiungi' : 'Salva'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    backgroundColor: '#B8860B',
    padding: 16,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#B8860B',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#B8860B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  athleteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  athleteTeam: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  compensationInfo: {
    marginTop: 8,
  },
  compensationText: {
    fontSize: 14,
    color: '#B8860B',
    fontWeight: '500',
  },
  yearlyText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  athleteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  athletesList: {
    maxHeight: 300,
  },
  athleteListItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  athleteListName: {
    fontSize: 16,
    color: '#333',
  },
  athleteListTeam: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  noResults: {
    textAlign: 'center',
    color: '#999',
    padding: 16,
  },
  closeButton: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  inputLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#B8860B',
    marginRight: 8,
  },
  compensationInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#B8860B',
    width: 120,
    textAlign: 'center',
    padding: 8,
  },
  inputSuffix: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#B8860B',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    textAlign: 'center',
  },
  formHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  inputPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#B8860B',
    marginRight: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateInput: {
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  contractText: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
