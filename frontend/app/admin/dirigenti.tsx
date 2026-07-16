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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { exportToExcel } from '../../src/utils/excelExport';

interface Dirigente {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
  approved_at?: string;
  is_scorekeeper?: boolean;  // Segnapunti
  qualification?: string;  // Carica nella società
  coordinator_permissions?: string[];  // 🆕 16/07/2026
}

// 🆕 16/07/2026 — Mapping fisso permessi Coordinatore (mirror di COORDINATOR_PERMISSIONS backend)
const COORDINATOR_PERM_LABELS: { key: string; label: string }[] = [
  { key: 'teams', label: 'Squadre e roster' },
  { key: 'athletes', label: 'Atleti (anagrafica)' },
  { key: 'trainings', label: 'Allenamenti' },
  { key: 'matches', label: 'Convocazioni e partite' },
  { key: 'attendance', label: 'Presenze e QR scanner' },
  { key: 'communications', label: 'Comunicazioni / Broadcast' },
  { key: 'events', label: 'Eventi in programma (pre-iscrizioni)' },
  { key: 'certificates', label: 'Certificati medici' },
  { key: 'gdpr_view', label: 'Documenti GDPR (solo lettura)' },
];

export default function DirigentiScreen() {
  const router = useRouter();
  const [dirigenti, setDirigenti] = useState<Dirigente[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Dirigente[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Dirigente | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [societyName, setSocietyName] = useState('Società');
  // 🆕 01/07/2026 — Riconferma per nuova stagione
  const [currentSeason, setCurrentSeason] = useState<string>('');
  const [renewToggleBusy, setRenewToggleBusy] = useState<string | null>(null);
  // 🆕 16/07/2026 — Modale conversione in Coordinatore con permessi granulari
  const [coordinatorModalVisible, setCoordinatorModalVisible] = useState(false);
  const [coordinatorTargetUser, setCoordinatorTargetUser] = useState<Dirigente | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [savingCoordinator, setSavingCoordinator] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/dirigenti');
      await exportToExcel(response.data, 'Dirigenti');
      showAlert('Successo', 'File Excel esportato con successo');
    } catch (error: any) {
      showAlert('Errore', error.message || 'Errore durante l\'esportazione');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      const [dirigentiRes, pendingRes, societyRes, seasonRes] = await Promise.all([
        api.get('/users/dirigenti'),
        api.get('/users/pending'),
        api.get('/settings/society'),
        api.get('/seasons/current-name').catch(() => ({ data: { season: '' } })),
      ]);
      setDirigenti(dirigentiRes.data);
      setSocietyName(societyRes.data.name || 'Società');
      setCurrentSeason(seasonRes.data?.season || '');
      // Filter pending users for staff roles (admin, viewer, dirigente, coordinatore)
      const pendingDirigenti = pendingRes.data.filter(
        (u: Dirigente) => ['admin', 'viewer', 'dirigente', 'coordinatore'].includes(u.role)
      );
      setPendingUsers(pendingDirigenti);
    } catch (error) {
      console.error('Error loading dirigenti:', error);
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

  const handleApprove = async (user: Dirigente) => {
    try {
      await api.patch(`/users/${user.id}/status`, { status: 'approved' });
      showAlert('Successo', `${user.full_name} è stato approvato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'approvazione');
    }
    setActionModalVisible(false);
  };

  const handleReject = async (user: Dirigente) => {
    try {
      await api.patch(`/users/${user.id}/status`, { status: 'rejected' });
      showAlert('Successo', `${user.full_name} è stato rifiutato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il rifiuto');
    }
    setActionModalVisible(false);
  };

  const handleChangeRole = async (user: Dirigente, newRole: string) => {
    try {
      await api.patch(`/users/${user.id}/role`, { role: newRole });
      const label = newRole === 'admin' ? 'Admin' :
                    newRole === 'coordinatore' ? 'Coordinatore' :
                    newRole === 'dirigente' ? 'Dirigente' : 'Dirigente';
      showAlert('Successo', `Ruolo aggiornato a ${label}`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    }
    setActionModalVisible(false);
  };

  // 🆕 16/07/2026 — Apertura modale conversione a Coordinatore
  const openConvertToCoordinator = (user: Dirigente) => {
    setCoordinatorTargetUser(user);
    setSelectedPerms(user.coordinator_permissions && user.coordinator_permissions.length > 0
      ? [...user.coordinator_permissions]
      // Preset di default per una prima conversione: sezioni "leggere" abilitate
      : ['teams', 'athletes', 'communications', 'events']);
    setCoordinatorModalVisible(true);
    setActionModalVisible(false);
  };

  const togglePerm = (key: string) => {
    setSelectedPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const handleSaveCoordinator = async () => {
    if (!coordinatorTargetUser) return;
    setSavingCoordinator(true);
    try {
      await api.patch(`/users/${coordinatorTargetUser.id}/role`, {
        role: 'coordinatore',
        coordinator_permissions: selectedPerms,
      });
      showAlert('Successo', `${coordinatorTargetUser.full_name} è ora Coordinatore con ${selectedPerms.length} permessi`);
      setCoordinatorModalVisible(false);
      setCoordinatorTargetUser(null);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la conversione');
    } finally {
      setSavingCoordinator(false);
    }
  };

  const handleSuspend = async (user: Dirigente) => {
    try {
      await api.patch(`/users/${user.id}/status`, { status: 'suspended' });
      showAlert('Successo', `${user.full_name} è stato sospeso`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la sospensione');
    }
    setActionModalVisible(false);
  };

  const handleDelete = async (user: Dirigente) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm(`Sei sicuro di voler eliminare ${user.full_name}?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Conferma Eliminazione',
            `Sei sicuro di voler eliminare ${user.full_name}?`,
            [
              { text: 'Annulla', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Elimina', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });
    
    if (confirmed) {
      try {
        await api.delete(`/users/${user.id}`);
        showAlert('Successo', 'Utente eliminato con successo');
        await loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
      }
    }
    setActionModalVisible(false);
  };

  const openActionModal = (user: Dirigente) => {
    setSelectedUser(user);
    setActionModalVisible(true);
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Admin';
    if (role === 'coordinatore') return 'Coordinatore';
    return 'Dirigente';
  };

  const getRoleColor = (role: string) => {
    if (role === 'admin') return '#007AFF';
    if (role === 'coordinatore') return '#F9A825';
    return '#8E44AD';
  };

  const getRoleIcon = (role: string): any => {
    if (role === 'admin') return 'shield-checkmark';
    if (role === 'coordinatore') return 'school';
    return 'briefcase';
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

  const renderPendingItem = ({ item }: { item: Dirigente }) => (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingName}>{item.full_name}</Text>
        <Text style={styles.pendingEmail}>{item.email}</Text>
        <Text style={styles.pendingRole}>Richiede: {getRoleLabel(item.role)}</Text>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => handleApprove(item)}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleReject(item)}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDirigenteItem = ({ item }: { item: Dirigente }) => {
    return (
      <TouchableOpacity 
        style={styles.userCard} 
        onPress={() => router.push(`/admin/dirigente/${item.id}`)}
        onLongPress={() => openActionModal(item)}
      >
        <View style={styles.userAvatar}>
          <Ionicons 
            name={getRoleIcon(item.role)} 
            size={24} 
            color={getRoleColor(item.role)} 
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.full_name}</Text>
          {item.qualification && (
            <Text style={styles.userQualification}>🏅 {item.qualification}</Text>
          )}
          <Text style={styles.userEmail}>{item.email}</Text>
          {/* 🆕 04/07/2026 — Snapshot post-riconferma bulk */}
          {(item as any).assignment_pending_review && (
            <Text style={{ fontSize: 11, color: '#9E9E9E', fontStyle: 'italic', marginTop: 2 }} numberOfLines={2}
              data-testid={`dirig-prev-teams-${item.id}`}>
              Prec.: {(((item as any).assigned_teams_previous_season) || []).length} squadre · da riconfermare
            </Text>
          )}
          <View style={styles.userMeta}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '22' }]}>
              <Text style={[styles.roleBadgeText, { color: getRoleColor(item.role) }]}>
                {getRoleLabel(item.role).toUpperCase()}
              </Text>
            </View>
            {item.role === 'coordinatore' && (item.coordinator_permissions?.length || 0) > 0 && (
              <View style={{ marginLeft: 6, backgroundColor: '#FFF8E1', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}
                data-testid={`coord-perms-count-${item.id}`}>
                <Text style={{ fontSize: 10, color: '#7A5D00', fontWeight: '700' }}>
                  {item.coordinator_permissions?.length}/9 sezioni
                </Text>
              </View>
            )}
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            {(item as any).pro_data_pending_review && (
              <View
                style={{ marginLeft: 6, backgroundColor: '#FFEBEE', borderColor: '#C62828', borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                data-testid={`dirig-pro-pending-review-${item.id}`}
              >
                <Ionicons name="warning" size={11} color="#C62828" />
                <Text style={{ fontSize: 10, color: '#C62828', fontWeight: '700' }}>
                  Compenso da riconfermare
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.moreBtn}
          onPress={() => openActionModal(item)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{societyName}</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...pendingUsers, ...dirigenti]}
        keyExtractor={(item, index) => `${index < pendingUsers.length ? 'pending' : 'approved'}-${item.id}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          pendingUsers.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color="#FF9500" />
              <Text style={styles.sectionTitle}>In attesa di approvazione ({pendingUsers.length})</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          if (index < pendingUsers.length) {
            return renderPendingItem({ item });
          }
          if (index === pendingUsers.length && dirigenti.length > 0) {
            return (
              <View>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={18} color="#007AFF" />
                  <Text style={styles.sectionTitle}>Dirigenti attivi ({dirigenti.length})</Text>
                </View>
                {renderDirigenteItem({ item })}
              </View>
            );
          }
          return renderDirigenteItem({ item });
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun dirigente registrato</Text>
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
            <Text style={styles.modalTitle}>{selectedUser?.full_name}</Text>
            <Text style={styles.modalSubtitle}>{selectedUser?.email}</Text>
            
            <View style={styles.modalActions}>
              {/* 🆕 16/07/2026 — Conversione tra ruoli staff: Admin ↔ Dirigente ↔ Coordinatore */}
              {selectedUser?.role !== 'admin' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && handleChangeRole(selectedUser, 'admin')}
                  data-testid="btn-make-admin"
                >
                  <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
                  <Text style={styles.modalBtnText}>Rendi Admin</Text>
                </TouchableOpacity>
              )}
              {selectedUser?.role !== 'viewer' && selectedUser?.role !== 'dirigente' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && handleChangeRole(selectedUser, 'viewer')}
                  data-testid="btn-make-dirigente"
                >
                  <Ionicons name="briefcase" size={20} color="#8E44AD" />
                  <Text style={styles.modalBtnText}>Rendi Dirigente</Text>
                </TouchableOpacity>
              )}
              {selectedUser?.role !== 'coordinatore' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && openConvertToCoordinator(selectedUser)}
                  data-testid="btn-make-coordinator"
                >
                  <Ionicons name="school" size={20} color="#F9A825" />
                  <Text style={styles.modalBtnText}>Trasforma in Coordinatore</Text>
                </TouchableOpacity>
              )}
              {selectedUser?.role === 'coordinatore' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && openConvertToCoordinator(selectedUser)}
                  data-testid="btn-edit-coordinator-perms"
                >
                  <Ionicons name="options" size={20} color="#F9A825" />
                  <Text style={styles.modalBtnText}>Modifica Permessi</Text>
                </TouchableOpacity>
              )}
              
              {selectedUser?.status === 'approved' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && handleSuspend(selectedUser)}
                >
                  <Ionicons name="pause-circle" size={20} color="#FF9500" />
                  <Text style={styles.modalBtnText}>Sospendi</Text>
                </TouchableOpacity>
              )}
              
              {selectedUser?.status === 'suspended' && (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && handleApprove(selectedUser)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                  <Text style={styles.modalBtnText}>Riattiva</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => selectedUser && handleDelete(selectedUser)}
              >
                <Ionicons name="trash" size={20} color="#FF3B30" />
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

      {/* 🆕 16/07/2026 — Modale conversione in Coordinatore con permessi granulari */}
      <Modal
        visible={coordinatorModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCoordinatorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%', width: '92%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="school" size={20} color="#F9A825" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Coordinatore · Permessi</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>{coordinatorTargetUser?.full_name}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 17 }}>
              Seleziona le sezioni organizzative a cui questo Coordinatore avrà accesso in modifica. Le sezioni amministrative (compensi, IBAN, sponsor, bilanci) restano SEMPRE riservate all&apos;Admin.
            </Text>
            <View style={{ maxHeight: 340 }}>
              <FlatList
                data={COORDINATOR_PERM_LABELS}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => {
                  const checked = selectedPerms.includes(item.key);
                  return (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingVertical: 10, paddingHorizontal: 8,
                        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
                      }}
                      onPress={() => togglePerm(item.key)}
                      data-testid={`coord-perm-${item.key}`}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 5,
                        borderWidth: 2, borderColor: checked ? '#F9A825' : '#ccc',
                        backgroundColor: checked ? '#F9A825' : '#fff',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
              {selectedPerms.length} / {COORDINATOR_PERM_LABELS.length} sezioni selezionate
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, justifyContent: 'center', backgroundColor: '#F5F5F5' }]}
                onPress={() => setCoordinatorModalVisible(false)}
                disabled={savingCoordinator}
              >
                <Text style={[styles.modalBtnText, { color: '#666' }]}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, justifyContent: 'center', backgroundColor: '#F9A825' }]}
                onPress={handleSaveCoordinator}
                disabled={savingCoordinator}
                data-testid="btn-save-coordinator"
              >
                {savingCoordinator ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff', fontWeight: '700' }]}>Salva</Text>
                )}
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
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
  userQualification: {
    fontSize: 13,
    color: '#8E44AD',
    fontWeight: '500',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  roleBadge: {
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadge: {
    backgroundColor: '#E8F4FD',
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  adminBadgeText: {
    color: '#007AFF',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  moreBtn: {
    padding: 8,
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
});
