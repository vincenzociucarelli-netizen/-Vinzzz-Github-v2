import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

const MONTH_NAMES = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'coach': return '🏐 Coach';
    case 'dirigente': return '🏅 Dirigente';
    case 'collaboratore': return '👤 Collaboratore';
    default: return role;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'coach': return '#2196F3';
    case 'dirigente': return '#8E44AD';
    case 'collaboratore': return '#FF9800';
    default: return '#666';
  }
};

export default function QuietanzePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'report' | 'gestione'>('gestione');
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, custom_pending: 0, custom_signed: 0 });
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'signed'>('all');
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'gestione') {
      loadReceipts();
    }
  }, [activeTab]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/quietanze/all');
      setReceipts(response.data.receipts || []);
      setStats({
        total: response.data.total || 0,
        pending: response.data.pending || 0,
        custom_pending: response.data.custom_pending || 0,
        custom_signed: response.data.custom_signed || 0
      });
    } catch (error) {
      console.error('Error loading receipts:', error);
      Alert.alert('Errore', 'Impossibile caricare le quietanze');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (receipt: any) => {
    const endpoint = `/admin/${receipt.user_role}/${receipt.user_id}/compensation/${receipt.year}/${receipt.month}`;
    const msg = `Eliminare la quietanza di ${receipt.user_name} per ${MONTH_NAMES[receipt.month]} ${receipt.year}?`;
    
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      try {
        await api.delete(endpoint);
        alert('Quietanza eliminata con successo');
        loadReceipts();
      } catch (error: any) {
        alert(error.response?.data?.detail || 'Impossibile eliminare');
      }
    } else {
      Alert.alert('Elimina Quietanza', msg, [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(endpoint);
              Alert.alert('Eliminata', 'Quietanza eliminata con successo');
              loadReceipts();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Impossibile eliminare');
            }
          }
        }
      ]);
    }
  };

  const handleEdit = (receipt: any) => {
    setSelectedReceipt(receipt);
    setEditAmount(String(receipt.amount_gross || ''));
    setEditModalVisible(true);
  };
  
  const handleSaveEdit = async () => {
    if (!selectedReceipt || !editAmount) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido');
      return;
    }
    
    try {
      setSaving(true);
      // Use the create-receipt endpoint which updates if exists
      await api.post(`/admin/${selectedReceipt.user_role}/${selectedReceipt.user_id}/compensation/create-receipt`, {
        month: selectedReceipt.month,
        year: selectedReceipt.year,
        amount_gross: amount
      });
      Alert.alert('Salvato', 'Quietanza aggiornata con successo');
      setEditModalVisible(false);
      loadReceipts();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare');
    } finally {
      setSaving(false);
    }
  };

  const filteredReceipts = receipts.filter(r => {
    if (filterRole && r.user_role !== filterRole) return false;
    if (filterStatus === 'pending' && r.receipt_signed) return false;
    if (filterStatus === 'signed' && !r.receipt_signed) return false;
    return true;
  });

  // Separate custom from standard
  const customReceipts = filteredReceipts.filter(r => r.is_custom);
  const pendingCustom = customReceipts.filter(r => !r.receipt_signed);
  const signedCustom = customReceipts.filter(r => r.receipt_signed);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📋 Quietanze</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gestione' && styles.tabActive]}
          onPress={() => setActiveTab('gestione')}
        >
          <Text style={[styles.tabText, activeTab === 'gestione' && styles.tabTextActive]}>
            Gestione Quietanze
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.tabActive]}
          onPress={() => setActiveTab('report')}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
            Report Quietanze
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'gestione' ? (
        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8E44AD" />
              <Text style={styles.loadingText}>Caricamento quietanze...</Text>
            </View>
          ) : (
            <>
              {/* Stats Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.statNumber, { color: '#E65100' }]}>{stats.custom_pending}</Text>
                  <Text style={styles.statLabel}>Custom in attesa</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{stats.custom_signed}</Text>
                  <Text style={styles.statLabel}>Custom firmate</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.statNumber, { color: '#1565C0' }]}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Totale</Text>
                </View>
              </View>

              {/* Filters */}
              <View style={styles.filtersRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.filterChip, !filterRole && styles.filterChipActive]}
                    onPress={() => setFilterRole(null)}
                  >
                    <Text style={[styles.filterChipText, !filterRole && styles.filterChipTextActive]}>Tutti</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'coach' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'coach' ? null : 'coach')}
                  >
                    <Text style={[styles.filterChipText, filterRole === 'coach' && styles.filterChipTextActive]}>🏐 Coach</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'dirigente' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'dirigente' ? null : 'dirigente')}
                  >
                    <Text style={[styles.filterChipText, filterRole === 'dirigente' && styles.filterChipTextActive]}>🏅 Dirigenti</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'collaboratore' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'collaboratore' ? null : 'collaboratore')}
                  >
                    <Text style={[styles.filterChipText, filterRole === 'collaboratore' && styles.filterChipTextActive]}>👤 Collaboratori</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Pending Custom Receipts */}
              {pendingCustom.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⏳ Quietanze Personalizzate in Attesa ({pendingCustom.length})</Text>
                  {pendingCustom.map((receipt, index) => (
                    <View key={`pending-${index}`} style={[styles.receiptCard, styles.receiptPending]}>
                      <View style={styles.receiptHeader}>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(receipt.user_role) + '20' }]}>
                          <Text style={[styles.roleBadgeText, { color: getRoleColor(receipt.user_role) }]}>
                            {getRoleLabel(receipt.user_role)}
                          </Text>
                        </View>
                        <Text style={styles.receiptDate}>{MONTH_NAMES[receipt.month]} {receipt.year}</Text>
                      </View>
                      <Text style={styles.receiptName}>{receipt.user_name}</Text>
                      {receipt.created_by_name && (
                        <Text style={styles.createdByText}>Creata da: {receipt.created_by_name}</Text>
                      )}
                      <View style={styles.receiptAmounts}>
                        <View>
                          <Text style={styles.amountLabel}>Importo custom</Text>
                          <Text style={styles.amountValue}>{formatCurrency(receipt.amount_gross)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Standard</Text>
                          <Text style={styles.amountStandard}>{formatCurrency(receipt.standard_amount)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Differenza</Text>
                          <Text style={[styles.amountDiff, { color: receipt.amount_gross > receipt.standard_amount ? '#4CAF50' : '#F44336' }]}>
                            {receipt.amount_gross > receipt.standard_amount ? '+' : ''}{formatCurrency(receipt.amount_gross - receipt.standard_amount)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.receiptActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(receipt)}>
                          <Ionicons name="pencil" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Modifica</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(receipt)}>
                          <Ionicons name="trash" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Elimina</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                        <Ionicons name="time-outline" size={14} color="#FF9800" />
                        <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '600' }}>In attesa di firma</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Signed Custom Receipts */}
              {signedCustom.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>✅ Quietanze Personalizzate Firmate ({signedCustom.length})</Text>
                  {signedCustom.map((receipt, index) => (
                    <View key={`signed-${index}`} style={[styles.receiptCard, styles.receiptSigned]}>
                      <View style={styles.receiptHeader}>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(receipt.user_role) + '20' }]}>
                          <Text style={[styles.roleBadgeText, { color: getRoleColor(receipt.user_role) }]}>
                            {getRoleLabel(receipt.user_role)}
                          </Text>
                        </View>
                        <Text style={styles.receiptDate}>{MONTH_NAMES[receipt.month]} {receipt.year}</Text>
                      </View>
                      <Text style={styles.receiptName}>{receipt.user_name}</Text>
                      {receipt.created_by_name && (
                        <Text style={styles.createdByText}>Creata da: {receipt.created_by_name}</Text>
                      )}
                      <View style={styles.receiptAmounts}>
                        <View>
                          <Text style={styles.amountLabel}>Importo pagato</Text>
                          <Text style={styles.amountValue}>{formatCurrency(receipt.amount_gross)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Standard</Text>
                          <Text style={styles.amountStandard}>{formatCurrency(receipt.standard_amount)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Differenza</Text>
                          <Text style={[styles.amountDiff, { color: receipt.amount_gross > receipt.standard_amount ? '#4CAF50' : '#F44336' }]}>
                            {receipt.amount_gross > receipt.standard_amount ? '+' : ''}{formatCurrency(receipt.amount_gross - receipt.standard_amount)}
                          </Text>
                        </View>
                      </View>
                      {(receipt.exceeded_5000 || receipt.exceeded_15000) && (
                        <View style={styles.thresholdBadges}>
                          {receipt.exceeded_5000 && (
                            <View style={[styles.thresholdBadge, { backgroundColor: '#FF980020' }]}>
                              <Text style={{ color: '#E65100', fontSize: 11 }}>Superato €5k</Text>
                            </View>
                          )}
                          {receipt.exceeded_15000 && (
                            <View style={[styles.thresholdBadge, { backgroundColor: '#9C27B020' }]}>
                              <Text style={{ color: '#7B1FA2', fontSize: 11 }}>Superato €15k</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: '600' }}>Firmata dal coach</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {customReceipts.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>Nessuna quietanza personalizzata</Text>
                  <Text style={styles.emptyStateSubtext}>Le quietanze con importo diverso dallo standard appariranno qui</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        // Report Tab - redirect to existing reports page
        <View style={styles.reportRedirect}>
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => router.push('/admin/reports')}
          >
            <Ionicons name="bar-chart" size={40} color="#8E44AD" />
            <Text style={styles.reportBtnTitle}>Report Quietanze</Text>
            <Text style={styles.reportBtnSubtitle}>Vai al riepilogo compensi di Coach, Dirigenti e Collaboratori</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>✏️ Modifica Quietanza</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedReceipt && (
              <>
                <View style={styles.editModalInfo}>
                  <Text style={styles.editModalLabel}>Utente</Text>
                  <Text style={styles.editModalValue}>{selectedReceipt.user_name}</Text>
                  
                  <Text style={styles.editModalLabel}>Periodo</Text>
                  <Text style={styles.editModalValue}>{MONTH_NAMES[selectedReceipt.month]} {selectedReceipt.year}</Text>
                  
                  <Text style={styles.editModalLabel}>Importo standard</Text>
                  <Text style={styles.editModalValue}>{formatCurrency(selectedReceipt.standard_amount)}</Text>
                </View>
                
                <View style={styles.editInputContainer}>
                  <Text style={styles.editModalLabel}>Nuovo importo (€)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="numeric"
                    placeholder="Es: 5000"
                  />
                </View>
                
                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    style={[styles.editModalBtn, styles.editModalCancelBtn]}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.editModalCancelText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editModalBtn, styles.editModalSaveBtn, saving && { opacity: 0.5 }]}
                    onPress={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.editModalSaveText}>Salva</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#8E44AD',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  filtersRow: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#8E44AD',
    borderColor: '#8E44AD',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  receiptPending: {
    borderLeftColor: '#FF9800',
  },
  receiptSigned: {
    borderLeftColor: '#4CAF50',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  receiptDate: {
    fontSize: 13,
    color: '#666',
  },
  receiptName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  createdByText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  receiptAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  amountStandard: {
    fontSize: 14,
    color: '#666',
  },
  amountDiff: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 13,
  },
  thresholdBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  thresholdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  reportRedirect: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  reportBtn: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
  },
  reportBtnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E44AD',
    marginTop: 12,
  },
  reportBtnSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editModalInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  editModalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  editModalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  editInputContainer: {
    marginBottom: 20,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 6,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editModalCancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  editModalSaveBtn: {
    backgroundColor: '#8E44AD',
  },
  editModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  editModalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
