import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Collaboratore {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  assigned_teams: string[];
  created_at: string;
  approved_at?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  fiscal_code?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  phone?: string;
  monthly_compensation?: number;
  other_annual_compensation?: number;
  contract_start_date?: string;
  contract_end_date?: string;
  compensation_accepted?: boolean;
  profile_photo?: string;
  profile_photo_artistic?: string;
  document_type?: string;
  document_front?: string;
  document_back?: string;
  iban?: string;
  iban_holder?: string;
  bank_name?: string;
  onboarding_checklist?: {
    contract_signed?: boolean;
    id_acquired?: boolean;
    fiscal_code_acquired?: boolean;
  };
  onboarding_completed?: boolean;
}

interface Team {
  id: string;
  name: string;
}

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

export default function AdminCollaboratoreDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [collaboratore, setCollaboratore] = useState<Collaboratore | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Image viewer modal
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageTitle, setViewingImageTitle] = useState('');
  
  // Reset password modal
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Onboarding checklist edit state
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [checklistItems, setChecklistItems] = useState({
    contract_signed: false,
    id_acquired: false,
    fiscal_code_acquired: false,
  });
  
  // Quietanze firmate
  const [signedReceipts, setSignedReceipts] = useState<any[]>([]);
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');
  const [otherAnnualCompensation, setOtherAnnualCompensation] = useState('0');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');

  const openImageViewer = (imageBase64: string, title: string) => {
    setViewingImage(imageBase64);
    setViewingImageTitle(title);
    setImageViewerVisible(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showAlert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    
    setResettingPassword(true);
    try {
      await api.patch(`/users/${id}/reset-password`, {
        new_password: newPassword
      });
      showAlert('Successo', `Password resettata per ${collaboratore?.full_name}`);
      setResetPasswordVisible(false);
      setNewPassword('');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile resettare la password');
    } finally {
      setResettingPassword(false);
    }
  };

  const loadData = async () => {
    try {
      const [collabRes, teamsRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/teams'),
      ]);
      setCollaboratore(collabRes.data);
      setTeams(teamsRes.data);
      setMonthlyCompensation(collabRes.data.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(collabRes.data.other_annual_compensation?.toString() || '0');
      
      // Load contract dates and convert to Italian format dd/mm/yyyy
      if (collabRes.data.contract_start_date) {
        // Parse ISO date string directly to avoid timezone issues
        const dateStr = collabRes.data.contract_start_date.split('T')[0]; // Get only date part
        const [yyyy, mm, dd] = dateStr.split('-');
        setContractStartDate(`${dd}/${mm}/${yyyy}`);
      }
      if (collabRes.data.contract_end_date) {
        const dateStr = collabRes.data.contract_end_date.split('T')[0];
        const [yyyy, mm, dd] = dateStr.split('-');
        setContractEndDate(`${dd}/${mm}/${yyyy}`);
      }
      
      // Initialize onboarding checklist state
      const checklist = collabRes.data.onboarding_checklist || {};
      setChecklistItems({
        contract_signed: checklist.contract_signed || false,
        id_acquired: checklist.id_acquired || false,
        fiscal_code_acquired: checklist.fiscal_code_acquired || false,
      });
      
      // Load signed receipts
      try {
        const compensationRes = await api.get(`/collaboratore/${id}/compensation`);
        if (Array.isArray(compensationRes.data)) {
          setSignedReceipts(compensationRes.data);
        } else {
          setSignedReceipts([]);
        }
      } catch (compError) {
        setSignedReceipts([]);
      }
    } catch (error) {
      console.error('Error loading collaboratore:', error);
      showAlert('Errore', 'Impossibile caricare i dati del collaboratore');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSaveCompensation = async () => {
    setSaving(true);
    try {
      // Convert dd/mm/yyyy to ISO format for backend
      let isoStartDate = null;
      let isoEndDate = null;
      
      if (contractStartDate && contractStartDate.length === 10) {
        const [dd, mm, yyyy] = contractStartDate.split('/');
        isoStartDate = `${yyyy}-${mm}-${dd}`;
      }
      if (contractEndDate && contractEndDate.length === 10) {
        const [dd, mm, yyyy] = contractEndDate.split('/');
        isoEndDate = `${yyyy}-${mm}-${dd}`;
      }
      
      await api.patch(`/users/${id}`, {
        monthly_compensation: parseFloat(monthlyCompensation) || 0,
        other_annual_compensation: parseFloat(otherAnnualCompensation) || 0,
        contract_start_date: isoStartDate,
        contract_end_date: isoEndDate,
      });
      showAlert('Successo', 'Compenso aggiornato');
      setEditing(false);
      loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    try {
      await api.patch(`/users/${id}`, {
        onboarding_checklist: checklistItems,
        onboarding_completed: Object.values(checklistItems).every(v => v),
        onboarding_date: Object.values(checklistItems).every(v => v) ? new Date().toISOString() : null,
      });
      showAlert('Successo', 'Checklist aggiornata');
      setEditingOnboarding(false);
      loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile salvare');
    } finally {
      setSavingOnboarding(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/D';
    try {
      // If already in dd/mm/yyyy format, return as is
      if (dateString.includes('/')) {
        return dateString;
      }
      // Convert ISO format to Italian dd/mm/yyyy
      const datePart = dateString.split('T')[0];
      const [yyyy, mm, dd] = datePart.split('-');
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!collaboratore) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Collaboratore non trovato</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dettaglio Collaboratore</Text>
        <TouchableOpacity onPress={() => setResetPasswordVisible(true)}>
          <Ionicons name="key" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Profile Photo */}
        <View style={styles.profileSection}>
          {collaboratore.profile_photo_artistic || collaboratore.profile_photo ? (
            <Image
              source={{ uri: collaboratore.profile_photo_artistic || collaboratore.profile_photo }}
              style={styles.profilePhoto}
            />
          ) : (
            <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
              <Ionicons name="person" size={60} color="#ccc" />
            </View>
          )}
          <Text style={styles.profileName}>{collaboratore.full_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: collaboratore.status === 'approved' ? '#34C759' : '#FF9500' }]}>
            <Text style={styles.statusBadgeText}>{collaboratore.status === 'approved' ? 'ATTIVO' : 'IN ATTESA'}</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Informazioni Personali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{collaboratore.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefono:</Text>
            <Text style={styles.infoValue}>{collaboratore.phone || 'N/D'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data di nascita:</Text>
            <Text style={styles.infoValue}>{formatDate(collaboratore.date_of_birth)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Luogo di nascita:</Text>
            <Text style={styles.infoValue}>{collaboratore.place_of_birth || 'N/D'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Codice Fiscale:</Text>
            <Text style={styles.infoValue}>{collaboratore.fiscal_code || 'N/D'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Indirizzo:</Text>
            <Text style={styles.infoValue}>
              {collaboratore.address ? `${collaboratore.address}, ${collaboratore.city} (${collaboratore.province})` : 'N/D'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Registrato il:</Text>
            <Text style={styles.infoValue}>{formatDate(collaboratore.created_at)}</Text>
          </View>
        </View>

        {/* Compensation Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💰 Compenso</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Ionicons name={editing ? "close" : "create"} size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {editing ? (
            <>
              <Text style={styles.inputLabel}>Compenso Mensile (€)</Text>
              <TextInput
                style={styles.input}
                value={monthlyCompensation}
                onChangeText={setMonthlyCompensation}
                onFocus={(e) => { if (monthlyCompensation === '0') setMonthlyCompensation(''); }}
                keyboardType="numeric"
                placeholder="0.00"
                selectTextOnFocus={true}
              />
              
              <Text style={styles.inputLabel}>Compensi Pregressi da altre ASD/SSD (€)</Text>
              <TextInput
                style={styles.input}
                value={otherAnnualCompensation}
                onChangeText={setOtherAnnualCompensation}
                onFocus={(e) => { if (otherAnnualCompensation === '0') setOtherAnnualCompensation(''); }}
                keyboardType="numeric"
                placeholder="0.00"
                selectTextOnFocus={true}
              />
              
              <Text style={styles.inputLabel}>Data Inizio Contratto</Text>
              <TextInput
                style={styles.input}
                value={contractStartDate}
                onChangeText={(text) => {
                  // Auto-format as dd/mm/yyyy
                  const cleaned = text.replace(/\D/g, '');
                  let formatted = '';
                  if (cleaned.length > 0) formatted = cleaned.substring(0, 2);
                  if (cleaned.length > 2) formatted += '/' + cleaned.substring(2, 4);
                  if (cleaned.length > 4) formatted += '/' + cleaned.substring(4, 8);
                  setContractStartDate(formatted);
                }}
                placeholder="gg/mm/aaaa"
                keyboardType="numeric"
                maxLength={10}
              />
              
              <Text style={styles.inputLabel}>Data Fine Contratto</Text>
              <TextInput
                style={styles.input}
                value={contractEndDate}
                onChangeText={(text) => {
                  // Auto-format as dd/mm/yyyy
                  const cleaned = text.replace(/\D/g, '');
                  let formatted = '';
                  if (cleaned.length > 0) formatted = cleaned.substring(0, 2);
                  if (cleaned.length > 2) formatted += '/' + cleaned.substring(2, 4);
                  if (cleaned.length > 4) formatted += '/' + cleaned.substring(4, 8);
                  setContractEndDate(formatted);
                }}
                placeholder="gg/mm/aaaa"
                keyboardType="numeric"
                maxLength={10}
              />
              
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveCompensation}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Salva Compenso</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Compenso Mensile:</Text>
                <Text style={[styles.infoValue, { fontWeight: 'bold', color: '#007AFF' }]}>
                  € {(collaboratore.monthly_compensation || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Compensi Pregressi:</Text>
                <Text style={styles.infoValue}>€ {(collaboratore.other_annual_compensation || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Periodo Contratto:</Text>
                <Text style={styles.infoValue}>
                  {contractStartDate && contractEndDate 
                    ? `${formatDate(contractStartDate)} - ${formatDate(contractEndDate)}`
                    : 'Non definito'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Compenso Accettato:</Text>
                <Text style={[styles.infoValue, { color: collaboratore.compensation_accepted ? '#34C759' : '#FF9500' }]}>
                  {collaboratore.compensation_accepted ? '✓ Sì' : '✗ No'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Onboarding Checklist */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📋 Checklist Onboarding</Text>
            <TouchableOpacity onPress={() => setEditingOnboarding(!editingOnboarding)}>
              <Ionicons name={editingOnboarding ? "close" : "create"} size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {editingOnboarding ? (
            <>
              {Object.entries(checklistItems).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.checklistItem}
                  onPress={() => setChecklistItems({ ...checklistItems, [key]: !value })}
                >
                  <Ionicons
                    name={value ? "checkbox" : "square-outline"}
                    size={24}
                    color={value ? "#34C759" : "#ccc"}
                  />
                  <Text style={styles.checklistLabel}>
                    {key === 'contract_signed' && 'Contratto firmato'}
                    {key === 'id_acquired' && 'Documento identità acquisito'}
                    {key === 'fiscal_code_acquired' && 'Codice fiscale acquisito'}
                  </Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={[styles.saveButton, savingOnboarding && styles.saveButtonDisabled]}
                onPress={handleSaveOnboarding}
                disabled={savingOnboarding}
              >
                {savingOnboarding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Salva Checklist</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {Object.entries(checklistItems).map(([key, value]) => (
                <View key={key} style={styles.checklistItem}>
                  <Ionicons
                    name={value ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={value ? "#34C759" : "#FF3B30"}
                  />
                  <Text style={styles.checklistLabel}>
                    {key === 'contract_signed' && 'Contratto firmato'}
                    {key === 'id_acquired' && 'Documento identità acquisito'}
                    {key === 'fiscal_code_acquired' && 'Codice fiscale acquisito'}
                  </Text>
                </View>
              ))}
              
              <View style={[styles.onboardingStatus, { backgroundColor: collaboratore.onboarding_completed ? '#E8F5E9' : '#FFF3E0' }]}>
                <Ionicons
                  name={collaboratore.onboarding_completed ? "checkmark-circle" : "time"}
                  size={20}
                  color={collaboratore.onboarding_completed ? "#34C759" : "#FF9500"}
                />
                <Text style={{ marginLeft: 8, color: collaboratore.onboarding_completed ? "#34C759" : "#FF9500", fontWeight: '600' }}>
                  {collaboratore.onboarding_completed ? 'Onboarding Completato' : 'Onboarding in corso'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Document Images */}
        {(collaboratore.document_front || collaboratore.document_back) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🪪 Documento</Text>
            <View style={styles.documentsRow}>
              {collaboratore.document_front && (
                <TouchableOpacity
                  style={styles.documentThumb}
                  onPress={() => openImageViewer(collaboratore.document_front!, 'Fronte Documento')}
                >
                  <Image source={{ uri: collaboratore.document_front }} style={styles.documentImage} />
                  <Text style={styles.documentLabel}>Fronte</Text>
                </TouchableOpacity>
              )}
              {collaboratore.document_back && (
                <TouchableOpacity
                  style={styles.documentThumb}
                  onPress={() => openImageViewer(collaboratore.document_back!, 'Retro Documento')}
                >
                  <Image source={{ uri: collaboratore.document_back }} style={styles.documentImage} />
                  <Text style={styles.documentLabel}>Retro</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bank Info */}
        {collaboratore.iban && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏦 Dati Bancari</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>IBAN:</Text>
              <Text style={styles.infoValue}>{collaboratore.iban}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Intestatario:</Text>
              <Text style={styles.infoValue}>{collaboratore.iban_holder || collaboratore.full_name}</Text>
            </View>
            {collaboratore.bank_name && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Banca:</Text>
                <Text style={styles.infoValue}>{collaboratore.bank_name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Signed Receipts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Quietanze Firmate ({signedReceipts.length})</Text>
          {signedReceipts.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna quietanza firmata</Text>
          ) : (
            signedReceipts.slice(0, 6).map((receipt, index) => (
              <View key={receipt.id || index} style={styles.receiptItem}>
                <Ionicons name="document-text" size={20} color="#007AFF" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ fontWeight: '500' }}>
                    {receipt.month_name || `Mese ${receipt.month}`} {receipt.year}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    € {(receipt.amount_gross || receipt.amount || 0).toFixed(2)}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal visible={imageViewerVisible} transparent animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>{viewingImageTitle}</Text>
            <TouchableOpacity onPress={() => setImageViewerVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {viewingImage && (
            <Image source={{ uri: viewingImage }} style={styles.imageViewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal visible={resetPasswordVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔑 Reset Password</Text>
            <Text style={styles.modalSubtitle}>{collaboratore.full_name}</Text>
            
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nuova password (min 6 caratteri)"
              secureTextEntry
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => { setResetPasswordVisible(false); setNewPassword(''); }}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, resettingPassword && styles.saveButtonDisabled]}
                onPress={handleResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Reset</Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF5722',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1 },
  profileSection: { alignItems: 'center', paddingVertical: 20 },
  profilePhoto: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e0e0e0' },
  profilePhotoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 22, fontWeight: 'bold', marginTop: 12, color: '#333' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { color: '#666', fontSize: 14 },
  infoValue: { color: '#333', fontSize: 14, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 10 },
  inputLabel: { fontSize: 14, color: '#666', marginTop: 10, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checklistLabel: { marginLeft: 10, fontSize: 14, color: '#333' },
  onboardingStatus: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginTop: 10 },
  documentsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  documentThumb: { alignItems: 'center' },
  documentImage: { width: 100, height: 70, borderRadius: 8, backgroundColor: '#f0f0f0' },
  documentLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  emptyText: { color: '#999', fontStyle: 'italic', textAlign: 'center', paddingVertical: 15 },
  receiptItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
  imageViewerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, paddingTop: 50 },
  imageViewerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  imageViewerImage: { flex: 1, width: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  modalButtonCancel: { backgroundColor: '#f0f0f0' },
  modalButtonCancelText: { color: '#666', fontWeight: '600' },
  modalButtonConfirm: { backgroundColor: '#007AFF' },
  modalButtonConfirmText: { color: '#fff', fontWeight: '600' },
});
