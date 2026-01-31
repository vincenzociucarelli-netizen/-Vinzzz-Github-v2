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
import { Ionicons } from '@expo/vector-icons';
import { exportToExcel } from '../../src/utils/excelExport';

interface Dirigente {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
  approved_at?: string;
}

export default function DirigentiScreen() {
  const router = useRouter();
  const [dirigenti, setDirigenti] = useState<Dirigente[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Dirigente[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Dirigente | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      const [dirigentiRes, pendingRes] = await Promise.all([
        api.get('/users/dirigenti'),
        api.get('/users/pending'),
      ]);
      setDirigenti(dirigentiRes.data);
      // Filter pending users for dirigenti only
      const pendingDirigenti = pendingRes.data.filter(
        (u: Dirigente) => u.role === 'admin' || u.role === 'viewer'
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
      showAlert('Successo', `Ruolo aggiornato a ${newRole === 'admin' ? 'Admin' : 'Visualizzatore'}`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    }
    setActionModalVisible(false);
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
    return role === 'admin' ? 'Admin' : 'Visualizzatore';
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

  const renderDirigenteItem = ({ item }: { item: Dirigente }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => openActionModal(item)}>
      <View style={styles.userAvatar}>
        <Ionicons 
          name={item.role === 'admin' ? 'shield-checkmark' : 'eye'} 
          size={24} 
          color={item.role === 'admin' ? '#007AFF' : '#8E8E93'} 
        />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.userMeta}>
          <View style={[styles.roleBadge, item.role === 'admin' && styles.adminBadge]}>
            <Text style={[styles.roleBadgeText, item.role === 'admin' && styles.adminBadgeText]}>
              {getRoleLabel(item.role)}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Ionicons name="ellipsis-vertical" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dirigenti</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...pendingUsers, ...dirigenti]}
        keyExtractor={(item) => item.id}
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
              {selectedUser?.role === 'admin' ? (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && handleChangeRole(selectedUser, 'viewer')}
                >
                  <Ionicons name="eye" size={20} color="#007AFF" />
                  <Text style={styles.modalBtnText}>Rendi Visualizzatore</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => selectedUser && handleChangeRole(selectedUser, 'admin')}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
                  <Text style={styles.modalBtnText}>Rendi Admin</Text>
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
