import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  RefreshControl,
  Platform,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';
import { Team } from '../../src/types';
import { exportToExcel } from '../../src/utils/excelExport';

interface Coach {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  assigned_teams: string[];
  created_at: string;
  approved_at?: string;
  // Coach specific fields
  first_name?: string;
  last_name?: string;
  fiscal_code?: string;
  coach_license_number?: string;
  phone?: string;
  monthly_compensation?: number;
  compensation_accepted?: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  // Photo
  profile_photo?: string;
  profile_photo_artistic?: string;
}

export default function CoachesScreen() {
  const router = useRouter();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [pendingCoaches, setPendingCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [teamsModalVisible, setTeamsModalVisible] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  
  // Compensation modal state
  const [compensationModalVisible, setCompensationModalVisible] = useState(false);
  const [compensationAmount, setCompensationAmount] = useState('');
  const [savingCompensation, setSavingCompensation] = useState(false);
  
  // Onboarding checklist modal state
  const [onboardingModalVisible, setOnboardingModalVisible] = useState(false);
  const [coachToApprove, setCoachToApprove] = useState<Coach | null>(null);
  const [checklistItems, setChecklistItems] = useState({
    contract_signed: false,
    ras_registered: false,
    id_acquired: false,
    fiscal_code_acquired: false,
    criminal_record: false,
  });
  const [priorCompensation, setPriorCompensation] = useState('');
  const [proposedCompensation, setProposedCompensation] = useState('');
  const [approvingCoach, setApprovingCoach] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/coaches');
      await exportToExcel(response.data, 'Coaches');
      showAlert('Successo', 'File Excel esportato con successo');
    } catch (error: any) {
      showAlert('Errore', error.message || 'Errore durante l\'esportazione');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      const [coachesRes, pendingRes, teamsRes] = await Promise.all([
        api.get('/users/coaches'),
        api.get('/users/pending'),
        api.get('/teams'),
      ]);
      setCoaches(coachesRes.data);
      setTeams(teamsRes.data);
      // Filter pending users for coaches only
      const pendingCoachesList = pendingRes.data.filter(
        (u: Coach) => u.role === 'coach'
      );
      setPendingCoaches(pendingCoachesList);
    } catch (error) {
      console.error('Error loading coaches:', error);
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

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Open onboarding checklist modal before approval
  const openOnboardingModal = (coach: Coach) => {
    setCoachToApprove(coach);
    setChecklistItems({
      contract_signed: false,
      ras_registered: false,
      id_acquired: false,
      fiscal_code_acquired: false,
      criminal_record: false,
    });
    setPriorCompensation('');
    setProposedCompensation('');
    setOnboardingModalVisible(true);
    setActionModalVisible(false);
  };

  const handleApproveWithChecklist = async () => {
    if (!coachToApprove) return;
    
    setApprovingCoach(true);
    try {
      // Save checklist, compensation data
      await api.patch(`/users/${coachToApprove.id}/onboarding`, {
        onboarding_checklist: checklistItems,
        prior_compensation: parseFloat(priorCompensation) || 0,
        monthly_compensation: parseFloat(proposedCompensation) || 0,
        onboarding_completed: true,
        onboarding_date: new Date().toISOString(),
      });
      
      // Then approve the coach
      await api.patch(`/users/${coachToApprove.id}/status`, { status: 'approved' });
      
      showAlert('Successo', `${coachToApprove.full_name} è stato approvato!\n\nRicorda di completare le pratiche burocratiche se non ancora fatte.`);
      setOnboardingModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'approvazione');
    } finally {
      setApprovingCoach(false);
    }
  };

  const handleApprove = async (coach: Coach) => {
    // For pending coaches, show onboarding checklist
    if (coach.status === 'pending') {
      openOnboardingModal(coach);
      return;
    }
    
    // For reactivating suspended coaches, approve directly
    try {
      await api.patch(`/users/${coach.id}/status`, { status: 'approved' });
      showAlert('Successo', `${coach.full_name} è stato approvato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'approvazione');
    }
    setActionModalVisible(false);
  };

  const handleReject = async (coach: Coach) => {
    try {
      await api.patch(`/users/${coach.id}/status`, { status: 'rejected' });
      showAlert('Successo', `${coach.full_name} è stato rifiutato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il rifiuto');
    }
    setActionModalVisible(false);
  };

  const handleSuspend = async (coach: Coach) => {
    try {
      await api.patch(`/users/${coach.id}/status`, { status: 'suspended' });
      showAlert('Successo', `${coach.full_name} è stato sospeso`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la sospensione');
    }
    setActionModalVisible(false);
  };

  const handleDelete = async (coach: Coach) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm(`Sei sicuro di voler eliminare ${coach.full_name}?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Conferma Eliminazione',
            `Sei sicuro di voler eliminare ${coach.full_name}?`,
            [
              { text: 'Annulla', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Elimina', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });
    
    if (confirmed) {
      try {
        await api.delete(`/users/${coach.id}`);
        showAlert('Successo', 'Coach eliminato con successo');
        await loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
      }
    }
    setActionModalVisible(false);
  };

  const openTeamsModal = (coach: Coach) => {
    setSelectedCoach(coach);
    setSelectedTeamIds(coach.assigned_teams || []);
    setTeamsModalVisible(true);
    setActionModalVisible(false);
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleSaveTeams = async () => {
    if (!selectedCoach) return;
    
    try {
      await api.patch(`/users/${selectedCoach.id}/teams`, { team_ids: selectedTeamIds });
      showAlert('Successo', 'Squadre assegnate con successo');
      setTeamsModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'assegnazione');
    }
  };

  const openActionModal = (coach: Coach) => {
    setSelectedCoach(coach);
    setActionModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#34C759';
      case 'pending': return '#FF9500';
      case 'rejected': return '#FF3B30';
      case 'suspended': return '#8E8E93';
      default: return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Attivo';
      case 'pending': return 'In attesa';
      case 'rejected': return 'Rifiutato';
      case 'suspended': return 'Sospeso';
      default: return status;
    }
  };

  const getTeamNames = (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'Nessuna squadra assegnata';
    const teamNames = teamIds.map(id => teams.find(t => t.id === id)?.name || '').filter(Boolean);
    return teamNames.join(', ');
  };

  const renderPendingItem = ({ item }: { item: Coach }) => (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingName}>{item.full_name}</Text>
        <Text style={styles.pendingEmail}>{item.email}</Text>
        <Text style={styles.pendingRole}>Richiede ruolo: Coach</Text>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => handleApprove(item)}
        >
          <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleReject(item)}
        >
          <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Helper function to get compensation badge based on TOTAL (this club + others)
  const getCompensationBadge = (monthlyComp: number | undefined, otherAnnual: number | undefined) => {
    const thisClubAnnual = (monthlyComp || 0) * 12;
    const otherAnnualComp = otherAnnual || 0;
    const totalAnnual = thisClubAnnual + otherAnnualComp;
    
    if (totalAnnual <= 0) return null;
    
    if (totalAnnual < 5000) {
      return { text: '<5K', color: '#34C759', bg: '#E8F5E9' };
    } else if (totalAnnual < 15000) {
      return { text: '<15K', color: '#FF9500', bg: '#FFF3E0' };
    } else {
      return { text: '>15K', color: '#FF3B30', bg: '#FFEBEE' };
    }
  };

  const renderCoachItem = ({ item }: { item: Coach }) => {
    const compBadge = getCompensationBadge(item.monthly_compensation, (item as any).other_annual_compensation);
    
    return (
      <TouchableOpacity 
        style={styles.userCard} 
        onPress={() => router.push(`/admin/coach/${item.id}`)}
        onLongPress={() => openActionModal(item)}
      >
        <View style={styles.userAvatar}>
          <Text style={{ fontSize: 22 }}>🏋️</Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{item.full_name}</Text>
            {compBadge && (
              <View style={[styles.compBadge, { backgroundColor: compBadge.bg }]}>
                <Text style={[styles.compBadgeText, { color: compBadge.color }]}>{compBadge.text}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userTeams} numberOfLines={1}>
            {getTeamNames(item.assigned_teams)}
          </Text>
          <View style={styles.userMeta}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            {item.monthly_compensation && item.monthly_compensation > 0 && (
              <Text style={styles.compensationText}> • €{item.monthly_compensation}/mese</Text>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={(e) => {
            e.stopPropagation();
            openActionModal(item);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 18, color: '#666' }}>⋮</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coach</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...pendingCoaches, ...coaches]}
        keyExtractor={(item, index) => `${item.status}-${item.id}-${index}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          pendingCoaches.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 16 }}>⏳</Text>
              <Text style={styles.sectionTitle}>In attesa di approvazione ({pendingCoaches.length})</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          if (index < pendingCoaches.length) {
            return renderPendingItem({ item });
          }
          if (index === pendingCoaches.length && coaches.length > 0) {
            return (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={{ fontSize: 16 }}>🏋️</Text>
                  <Text style={styles.sectionTitle}>Coach attivi ({coaches.length})</Text>
                </View>
                {renderCoachItem({ item })}
              </View>
            );
          }
          return renderCoachItem({ item });
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>🏋️</Text>
            <Text style={styles.emptyText}>Nessun coach registrato</Text>
          </View>
        }
      />

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedCoach?.full_name}</Text>
            <Text style={styles.modalSubtitle}>{selectedCoach?.email}</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => selectedCoach && openTeamsModal(selectedCoach)}
              >
                <Text style={{ fontSize: 18 }}>👥</Text>
                <Text style={styles.modalBtnText}>Assegna Squadre</Text>
              </TouchableOpacity>
              
              {selectedCoach?.status === 'approved' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedCoach && handleSuspend(selectedCoach)}
                >
                  <Text style={{ fontSize: 18 }}>⏸️</Text>
                  <Text style={styles.modalBtnText}>Sospendi</Text>
                </TouchableOpacity>
              )}
              
              {selectedCoach?.status === 'suspended' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedCoach && handleApprove(selectedCoach)}
                >
                  <Text style={{ fontSize: 18 }}>✅</Text>
                  <Text style={styles.modalBtnText}>Riattiva</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => selectedCoach && handleDelete(selectedCoach)}
              >
                <Text style={{ fontSize: 18 }}>🗑️</Text>
                <Text style={[styles.modalBtnText, styles.modalBtnTextDanger]}>Elimina</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActionModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Teams Assignment Modal */}
      <Modal
        visible={teamsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTeamsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.teamsModalContent}>
            <Text style={styles.modalTitle}>Assegna Squadre</Text>
            <Text style={styles.modalSubtitle}>{selectedCoach?.full_name}</Text>
            
            <ScrollView style={styles.teamsList}>
              {teams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.teamItem,
                    selectedTeamIds.includes(team.id) && styles.teamItemSelected
                  ]}
                  onPress={() => toggleTeamSelection(team.id)}
                >
                  <View style={styles.teamItemContent}>
                    <Text style={{ fontSize: 20 }}>
                      {selectedTeamIds.includes(team.id) ? '☑️' : '⬜'}
                    </Text>
                    <Text style={styles.teamItemName}>{team.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.teamsModalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setTeamsModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveTeams}
              >
                <Text style={styles.saveBtnText}>Salva</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Onboarding Checklist Modal */}
      <Modal
        visible={onboardingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setOnboardingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.onboardingModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>📋 Checklist Onboarding Coach</Text>
              <Text style={styles.modalSubtitle}>{coachToApprove?.full_name}</Text>
              
              <Text style={styles.checklistHeader}>Pratiche burocratiche da completare:</Text>
              
              <TouchableOpacity
                style={[styles.checklistItem, checklistItems.contract_signed && styles.checklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, contract_signed: !checklistItems.contract_signed})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.contract_signed ? '☑️' : '⬜'}</Text>
                <Text style={styles.checklistText}>Contratto/Lettera d'incarico firmata</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.checklistItem, checklistItems.ras_registered && styles.checklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, ras_registered: !checklistItems.ras_registered})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.ras_registered ? '☑️' : '⬜'}</Text>
                <Text style={styles.checklistText}>Iscrizione RAS (Registro Attività Sportive)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.checklistItem, checklistItems.id_acquired && styles.checklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, id_acquired: !checklistItems.id_acquired})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.id_acquired ? '☑️' : '⬜'}</Text>
                <Text style={styles.checklistText}>Documento d'identità acquisito</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.checklistItem, checklistItems.fiscal_code_acquired && styles.checklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, fiscal_code_acquired: !checklistItems.fiscal_code_acquired})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.fiscal_code_acquired ? '☑️' : '⬜'}</Text>
                <Text style={styles.checklistText}>Codice fiscale acquisito</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.checklistItem, checklistItems.criminal_record && styles.checklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, criminal_record: !checklistItems.criminal_record})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.criminal_record ? '☑️' : '⬜'}</Text>
                <Text style={styles.checklistText}>Certificato casellario giudiziale (se richiesto)</Text>
              </TouchableOpacity>
              
              <View style={styles.compensationSection}>
                <Text style={styles.compensationLabel}>💰 Compenso Mensile Proposto (€)</Text>
                <Text style={styles.compensationHint}>
                  Importo mensile che la società propone al coach
                </Text>
                <TextInput
                  style={styles.compensationInput}
                  value={proposedCompensation}
                  onChangeText={setProposedCompensation}
                  onFocus={() => { if (proposedCompensation === '0') setProposedCompensation(''); }}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                  selectTextOnFocus={true}
                />
              </View>
              
              <View style={styles.compensationSection}>
                <Text style={styles.compensationLabel}>📋 Compensi Pregressi Dichiarati (€)</Text>
                <Text style={styles.compensationHint}>
                  Importo dichiarato dal coach dei compensi sportivi già ricevuti nel corrente anno fiscale da altre società
                </Text>
                <TextInput
                  style={styles.compensationInput}
                  value={priorCompensation}
                  onChangeText={setPriorCompensation}
                  onFocus={() => { if (priorCompensation === '0') setPriorCompensation(''); }}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                  selectTextOnFocus={true}
                />
              </View>
              
              <View style={styles.checklistNote}>
                <Text style={styles.checklistNoteText}>
                  ⚠️ Puoi approvare il coach anche senza completare tutte le voci. 
                  Un promemoria apparirà nella sua scheda finché non saranno complete.
                </Text>
              </View>
              
              <View style={styles.onboardingButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setOnboardingModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn2, approvingCoach && styles.disabledBtn]}
                  onPress={handleApproveWithChecklist}
                  disabled={approvingCoach}
                >
                  {approvingCoach ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveBtnText}>✓ Approva Coach</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    backgroundColor: '#FF9500',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  pendingCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pendingEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  pendingRole: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#34C759',
  },
  rejectBtn: {
    backgroundColor: '#FF3B30',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coachPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  userTeams: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  compBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  compensationText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  menuButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
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
    width: '85%',
    maxWidth: 400,
  },
  teamsModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  modalActions: {
    gap: 8,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  modalBtnText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  modalBtnDanger: {
    backgroundColor: '#FFF0F0',
  },
  modalBtnTextDanger: {
    color: '#FF3B30',
  },
  modalCloseBtn: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  teamsList: {
    maxHeight: 300,
  },
  teamItem: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  teamItemSelected: {
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  teamItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamItemName: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  teamsModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
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
  // Onboarding checklist styles
  onboardingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '92%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  checklistHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  checklistItemChecked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#34C759',
  },
  checklistText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  compensationSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  compensationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  compensationHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  compensationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  checklistNote: {
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  checklistNoteText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  onboardingButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  approveBtn2: {
    flex: 1.5,
    padding: 14,
    backgroundColor: '#34C759',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
