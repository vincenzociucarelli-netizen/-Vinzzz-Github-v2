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

interface Collaboratore {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  assigned_teams: string[];
  created_at: string;
  approved_at?: string;
  // Collaboratore specific fields
  first_name?: string;
  last_name?: string;
  fiscal_code?: string;
  collaboratore_license_number?: string;
  phone?: string;
  monthly_compensation?: number;
  compensation_accepted?: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  // Photo
  profile_photo?: string;
  profile_photo_artistic?: string;
}

export default function CollaboratoreesScreen() {
  const router = useRouter();
  const [collaboratorees, setCollaboratorees] = useState<Collaboratore[]>([]);
  const [pendingCollaboratorees, setPendingCollaboratorees] = useState<Collaboratore[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCollaboratore, setSelectedCollaboratore] = useState<Collaboratore | null>(null);
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
  const [collaboratoreToApprove, setCollaboratoreToApprove] = useState<Collaboratore | null>(null);
  const [checklistItems, setChecklistItems] = useState({
    contract_signed: false,
    ras_registered: false,
    id_acquired: false,
    fiscal_code_acquired: false,
    criminal_record: false,
  });
  const [priorCompensation, setPriorCompensation] = useState('');
  const [proposedCompensation, setProposedCompensation] = useState('');
  const [approvingCollaboratore, setApprovingCollaboratore] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/collaboratorees');
      await exportToExcel(response.data, 'Collaboratorees');
      showAlert('Successo', 'File Excel esportato con successo');
    } catch (error: any) {
      showAlert('Errore', error.message || 'Errore durante l\'esportazione');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      const [collaboratoreesRes, pendingRes, teamsRes] = await Promise.all([
        api.get('/users/collaboratorees'),
        api.get('/users/pending'),
        api.get('/teams'),
      ]);
      setCollaboratorees(collaboratoreesRes.data);
      setTeams(teamsRes.data);
      // Filter pending users for collaboratorees only
      const pendingCollaboratoreesList = pendingRes.data.filter(
        (u: Collaboratore) => u.role === 'collaboratore'
      );
      setPendingCollaboratorees(pendingCollaboratoreesList);
    } catch (error) {
      console.error('Error loading collaboratorees:', error);
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
  const openOnboardingModal = (collaboratore: Collaboratore) => {
    setCollaboratoreToApprove(collaboratore);
    setChecklistItems({
      contract_signed: false,
      ras_registered: false,
      id_acquired: false,
      fiscal_code_acquired: false,
      criminal_record: false,
    });
    setPriorCompensation('');
    setOnboardingModalVisible(true);
    setActionModalVisible(false);
  };

  const handleApproveWithChecklist = async () => {
    if (!collaboratoreToApprove) return;
    
    setApprovingCollaboratore(true);
    try {
      // Save checklist and prior compensation data
      await api.patch(`/users/${collaboratoreToApprove.id}/onboarding`, {
        onboarding_checklist: checklistItems,
        prior_compensation: parseFloat(priorCompensation) || 0,
        onboarding_completed: true,
        onboarding_date: new Date().toISOString(),
      });
      
      // Then approve the collaboratore
      await api.patch(`/users/${collaboratoreToApprove.id}/status`, { status: 'approved' });
      
      showAlert('Successo', `${collaboratoreToApprove.full_name} è stato approvato!\n\nRicorda di completare le pratiche burocratiche se non ancora fatte.`);
      setOnboardingModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'approvazione');
    } finally {
      setApprovingCollaboratore(false);
    }
  };

  const handleApprove = async (collaboratore: Collaboratore) => {
    // For pending collaboratorees, show onboarding checklist
    if (collaboratore.status === 'pending') {
      openOnboardingModal(collaboratore);
      return;
    }
    
    // For reactivating suspended collaboratorees, approve directly
    try {
      await api.patch(`/users/${collaboratore.id}/status`, { status: 'approved' });
      showAlert('Successo', `${collaboratore.full_name} è stato approvato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'approvazione');
    }
    setActionModalVisible(false);
  };

  const handleReject = async (collaboratore: Collaboratore) => {
    try {
      await api.patch(`/users/${collaboratore.id}/status`, { status: 'rejected' });
      showAlert('Successo', `${collaboratore.full_name} è stato rifiutato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il rifiuto');
    }
    setActionModalVisible(false);
  };

  const handleSuspend = async (collaboratore: Collaboratore) => {
    try {
      await api.patch(`/users/${collaboratore.id}/status`, { status: 'suspended' });
      showAlert('Successo', `${collaboratore.full_name} è stato sospeso`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la sospensione');
    }
    setActionModalVisible(false);
  };

  const handleDelete = async (collaboratore: Collaboratore) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm(`Sei sicuro di voler eliminare ${collaboratore.full_name}?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Conferma Eliminazione',
            `Sei sicuro di voler eliminare ${collaboratore.full_name}?`,
            [
              { text: 'Annulla', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Elimina', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });
    
    if (confirmed) {
      try {
        await api.delete(`/users/${collaboratore.id}`);
        showAlert('Successo', 'Collaboratore eliminato con successo');
        await loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
      }
    }
    setActionModalVisible(false);
  };

  const openTeamsModal = (collaboratore: Collaboratore) => {
    setSelectedCollaboratore(collaboratore);
    setSelectedTeamIds(collaboratore.assigned_teams || []);
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
    if (!selectedCollaboratore) return;
    
    try {
      await api.patch(`/users/${selectedCollaboratore.id}/teams`, { team_ids: selectedTeamIds });
      showAlert('Successo', 'Squadre assegnate con successo');
      setTeamsModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'assegnazione');
    }
  };

  const openActionModal = (collaboratore: Collaboratore) => {
    setSelectedCollaboratore(collaboratore);
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

  const getVenueNames = (venueNames: string[]) => {
    if (!venueNames || venueNames.length === 0) return null;
    return venueNames.join(', ');
  };

  const renderPendingItem = ({ item }: { item: Collaboratore }) => (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingName}>{item.full_name}</Text>
        <Text style={styles.pendingEmail}>{item.email}</Text>
        <Text style={styles.pendingRole}>Richiede ruolo: Collaboratore</Text>
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

  const renderCollaboratoreItem = ({ item }: { item: Collaboratore }) => {
    const compBadge = getCompensationBadge(item.monthly_compensation, (item as any).other_annual_compensation);
    
    return (
      <TouchableOpacity 
        style={styles.userCard} 
        onPress={() => router.push(`/admin/collaboratore/${item.id}`)}
        onLongPress={() => openActionModal(item)}
      >
        <View style={styles.userAvatar}>
          {item.profile_photo_artistic || item.profile_photo ? (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${item.profile_photo_artistic || item.profile_photo}` }}
              style={styles.collaboratorePhoto}
            />
          ) : (
            <Text style={{ fontSize: 22 }}>👷</Text>
          )}
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
            🏐 {getTeamNames(item.assigned_teams)}
          </Text>
          {item.assigned_venues && item.assigned_venues.length > 0 && (
            <Text style={[styles.userTeams, { color: '#7B1FA2' }]} numberOfLines={1}>
              🏢 {getVenueNames(item.assigned_venues)}
            </Text>
          )}
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
        <Text style={styles.headerTitle}>Collaboratore</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...pendingCollaboratorees, ...collaboratorees]}
        keyExtractor={(item, index) => `${item.status}-${item.id}-${index}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          pendingCollaboratorees.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 16 }}>⏳</Text>
              <Text style={styles.sectionTitle}>In attesa di approvazione ({pendingCollaboratorees.length})</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          if (index < pendingCollaboratorees.length) {
            return renderPendingItem({ item });
          }
          if (index === pendingCollaboratorees.length && collaboratorees.length > 0) {
            return (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={{ fontSize: 16 }}>👷</Text>
                  <Text style={styles.sectionTitle}>Collaboratore attivi ({collaboratorees.length})</Text>
                </View>
                {renderCollaboratoreItem({ item })}
              </View>
            );
          }
          return renderCollaboratoreItem({ item });
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>👷</Text>
            <Text style={styles.emptyText}>Nessun collaboratore registrato</Text>
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
            <Text style={styles.modalTitle}>{selectedCollaboratore?.full_name}</Text>
            <Text style={styles.modalSubtitle}>{selectedCollaboratore?.email}</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => selectedCollaboratore && openTeamsModal(selectedCollaboratore)}
              >
                <Text style={{ fontSize: 18 }}>👥</Text>
                <Text style={styles.modalBtnText}>Assegna Squadre</Text>
              </TouchableOpacity>
              
              {selectedCollaboratore?.status === 'approved' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedCollaboratore && handleSuspend(selectedCollaboratore)}
                >
                  <Text style={{ fontSize: 18 }}>⏸️</Text>
                  <Text style={styles.modalBtnText}>Sospendi</Text>
                </TouchableOpacity>
              )}
              
              {selectedCollaboratore?.status === 'suspended' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedCollaboratore && handleApprove(selectedCollaboratore)}
                >
                  <Text style={{ fontSize: 18 }}>✅</Text>
                  <Text style={styles.modalBtnText}>Riattiva</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => selectedCollaboratore && handleDelete(selectedCollaboratore)}
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
            <Text style={styles.modalSubtitle}>{selectedCollaboratore?.full_name}</Text>
            
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
              <Text style={styles.modalTitle}>📋 Checklist Onboarding Collaboratore</Text>
              <Text style={styles.modalSubtitle}>{collaboratoreToApprove?.full_name}</Text>
              
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
              
              <View style={styles.checklistNote}>
                <Text style={styles.checklistNoteText}>
                  ⚠️ Puoi approvare il collaboratore anche senza completare tutte le voci. 
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
                  style={[styles.approveBtn2, approvingCollaboratore && styles.disabledBtn]}
                  onPress={handleApproveWithChecklist}
                  disabled={approvingCollaboratore}
                >
                  {approvingCollaboratore ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveBtnText}>✓ Approva Collaboratore</Text>
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
  collaboratorePhoto: {
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
