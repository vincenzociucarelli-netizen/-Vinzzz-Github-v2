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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { SportIcon } from '../../../src/components/SportIcon';

interface Collaboratore {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  assigned_teams: string[];
  assigned_venues: string[];
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
  const [quietanzeModalVisible, setQuietanzeModalVisible] = useState(false);
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');
  const [otherAnnualCompensation, setOtherAnnualCompensation] = useState('0');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  
  // Assegnazioni
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedVenueNames, setSelectedVenueNames] = useState<string[]>([]);
  const [availableVenues, setAvailableVenues] = useState<{name: string, address: string, city: string}[]>([]);

  // Helper: genera i mesi del contratto
  const getContractMonths = () => {
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const months: { name: string; month: number; year: number }[] = [];
    
    if (!collaboratore?.contract_start_date || !collaboratore?.contract_end_date) {
      return months;
    }
    
    const startDate = new Date(collaboratore.contract_start_date);
    const endDate = new Date(collaboratore.contract_end_date);
    
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    while (current <= endDate) {
      months.push({
        name: monthNames[current.getMonth()],
        month: current.getMonth() + 1,
        year: current.getFullYear()
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const contractMonths = collaboratore ? getContractMonths() : [];

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
      const [collabRes, teamsRes, settingsRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/teams'),
        api.get('/settings/society'),
      ]);
      setCollaboratore(collabRes.data);
      setTeams(teamsRes.data);
      setAvailableVenues(settingsRes.data.venues || []);
      setMonthlyCompensation(collabRes.data.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(collabRes.data.other_annual_compensation?.toString() || '0');
      setSelectedTeamIds(collabRes.data.assigned_teams || []);
      setSelectedVenueNames(collabRes.data.assigned_venues || []);
      
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
      // Load signed receipts
      try {
        const compensationRes = await api.get(`/collaboratore/${id}/compensation`);
        // API returns {collaboratore: {...}, records: [...]}
        const records = compensationRes.data?.records || [];
        setSignedReceipts(records);
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
      
      const newCompensation = parseFloat(monthlyCompensation) || 0;
      const oldCompensation = collaboratore?.monthly_compensation || 0;
      
      await api.patch(`/users/${id}`, {
        monthly_compensation: newCompensation,
        other_annual_compensation: parseFloat(otherAnnualCompensation) || 0,
        contract_start_date: isoStartDate,
        contract_end_date: isoEndDate,
        assigned_teams: selectedTeamIds,
        assigned_venues: selectedVenueNames,
      });
      
      // Show different message if compensation changed
      if (newCompensation !== oldCompensation && newCompensation > 0) {
        showAlert('Compenso Aggiornato', `Il compenso è stato modificato da €${oldCompensation.toFixed(2)} a €${newCompensation.toFixed(2)}.\n\nIl collaboratore dovrà ri-accettare il nuovo importo.`);
      } else {
        showAlert('Successo', 'Dati aggiornati');
      }
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
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: 'transparent' }]}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#7B1FA2" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dettaglio Collaboratore</Text>
        <TouchableOpacity onPress={() => setResetPasswordVisible(true)} style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: 8 }}>
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
              source={{ uri: collaboratore.profile_photo_artistic?.startsWith('data:') 
                ? collaboratore.profile_photo_artistic 
                : collaboratore.profile_photo_artistic 
                  ? `data:image/jpeg;base64,${collaboratore.profile_photo_artistic}`
                  : collaboratore.profile_photo?.startsWith('data:')
                    ? collaboratore.profile_photo
                    : `data:image/jpeg;base64,${collaboratore.profile_photo}`
              }}
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
          
          {/* WhatsApp Button */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: collaboratore.phone ? '#25D366' : '#ccc',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 25,
              marginTop: 12,
            }}
            onPress={() => {
              if (!collaboratore.phone) {
                Alert.alert('Telefono non disponibile', 'Questo collaboratore non ha un numero di telefono registrato');
                return;
              }
              const phone = collaboratore.phone?.replace(/\D/g, '');
              const phoneWithCountry = phone?.startsWith('39') ? phone : `39${phone}`;
              Linking.openURL(`https://wa.me/${phoneWithCountry}`);
            }}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>WhatsApp</Text>
          </TouchableOpacity>
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
          
          {/* Reset Password Button */}
          <TouchableOpacity
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#FF9500', 
              padding: 12, 
              borderRadius: 8, 
              marginTop: 15 
            }}
            onPress={() => setResetPasswordVisible(true)}
          >
            <Ionicons name="key" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Reset Password</Text>
          </TouchableOpacity>
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
              
              {/* Assegnazione Squadre */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                <SportIcon size={18} />
                <Text style={[styles.inputLabel, { marginLeft: 6, marginTop: 0, marginBottom: 0 }]}>Squadre Assegnate</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {teams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    onPress={() => {
                      if (selectedTeamIds.includes(team.id)) {
                        setSelectedTeamIds(selectedTeamIds.filter(t => t !== team.id));
                      } else {
                        setSelectedTeamIds([...selectedTeamIds, team.id]);
                      }
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: selectedTeamIds.includes(team.id) ? '#007AFF' : '#ddd',
                      backgroundColor: selectedTeamIds.includes(team.id) ? '#E3F2FD' : '#f9f9f9',
                    }}
                  >
                    <Text style={{ color: selectedTeamIds.includes(team.id) ? '#007AFF' : '#666', fontWeight: selectedTeamIds.includes(team.id) ? '600' : '400' }}>
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {teams.length === 0 && (
                  <Text style={{ color: '#999', fontStyle: 'italic' }}>Nessuna squadra disponibile</Text>
                )}
              </View>

              {/* Assegnazione Palestre */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>🏟️ Palestre Assegnate</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {availableVenues.map((venue, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      if (selectedVenueNames.includes(venue.name)) {
                        setSelectedVenueNames(selectedVenueNames.filter(v => v !== venue.name));
                      } else {
                        setSelectedVenueNames([...selectedVenueNames, venue.name]);
                      }
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: selectedVenueNames.includes(venue.name) ? '#FF9500' : '#ddd',
                      backgroundColor: selectedVenueNames.includes(venue.name) ? '#FFF3E0' : '#f9f9f9',
                    }}
                  >
                    <Text style={{ color: selectedVenueNames.includes(venue.name) ? '#E65100' : '#666', fontWeight: selectedVenueNames.includes(venue.name) ? '600' : '400' }}>
                      {venue.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {availableVenues.length === 0 && (
                  <Text style={{ color: '#999', fontStyle: 'italic' }}>Nessuna palestra configurata nelle impostazioni</Text>
                )}
              </View>
              
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
              
              {/* Totale già percepito (quietanze firmate) - Cliccabile */}
              {signedReceipts.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setQuietanzeModalVisible(true)}
                  style={{ marginTop: 12, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, borderWidth: 1, borderColor: '#90CAF9' }}
                >
                  <View style={[styles.infoRow, { alignItems: 'center' }]}>
                    <Text style={[styles.infoLabel, { color: '#1565C0' }]}>💰 Già Percepito:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.infoValue, { fontWeight: 'bold', color: '#1565C0', fontSize: 16, marginRight: 8 }]}>
                        € {signedReceipts
                          .filter((r: any) => r.receipt_signed)
                          .reduce((sum: number, r: any) => sum + (r.amount_gross || 0), 0)
                          .toFixed(2)}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#1565C0" />
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {signedReceipts.filter((r: any) => r.receipt_signed).length} quietanze firmate • Tocca per dettagli
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* Visualizzazione Assegnazioni */}
              {(selectedTeamIds.length > 0 || selectedVenueNames.length > 0) && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                  {selectedTeamIds.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <SportIcon size={16} />
                        <Text style={[styles.infoLabel, { marginLeft: 4 }]}>Squadre:</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {selectedTeamIds.map((teamId) => {
                          const team = teams.find(t => t.id === teamId);
                          return team ? (
                            <View key={teamId} style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                              <Text style={{ color: '#007AFF', fontSize: 13, fontWeight: '500' }}>{team.name}</Text>
                            </View>
                          ) : null;
                        })}
                      </View>
                    </View>
                  )}
                  {selectedVenueNames.length > 0 && (
                    <View>
                      <Text style={styles.infoLabel}>🏟️ Palestre:</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {selectedVenueNames.map((venueName, idx) => (
                          <View key={idx} style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ color: '#E65100', fontSize: 13, fontWeight: '500' }}>{venueName}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Assegnazioni Squadre e Palestre - Sezione separata sempre visibile */}
        <View style={[styles.card, { backgroundColor: '#F3E5F5', borderWidth: 1, borderColor: '#9C27B0' }]}>
          <Text style={[styles.cardTitle, { color: '#7B1FA2' }]}>📍 Assegnazioni</Text>
          
          {/* Squadre */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
            <SportIcon size={18} />
            <Text style={[styles.inputLabel, { color: '#7B1FA2', marginLeft: 6, marginTop: 0 }]}>Squadre</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {teams.length === 0 ? (
              <Text style={{ color: '#999', fontStyle: 'italic' }}>Nessuna squadra disponibile</Text>
            ) : (
              teams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  onPress={() => {
                    if (selectedTeamIds.includes(team.id)) {
                      setSelectedTeamIds(selectedTeamIds.filter(t => t !== team.id));
                    } else {
                      setSelectedTeamIds([...selectedTeamIds, team.id]);
                    }
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: selectedTeamIds.includes(team.id) ? '#9C27B0' : '#ddd',
                    backgroundColor: selectedTeamIds.includes(team.id) ? '#E1BEE7' : '#fff',
                  }}
                >
                  <Text style={{ 
                    color: selectedTeamIds.includes(team.id) ? '#7B1FA2' : '#666', 
                    fontWeight: selectedTeamIds.includes(team.id) ? '600' : '400' 
                  }}>
                    {selectedTeamIds.includes(team.id) ? '✓ ' : ''}{team.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Palestre */}
          <Text style={[styles.inputLabel, { color: '#7B1FA2', marginTop: 8 }]}>🏟️ Palestre</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {availableVenues.length === 0 ? (
              <Text style={{ color: '#999', fontStyle: 'italic' }}>Nessuna palestra configurata (vai in Impostazioni)</Text>
            ) : (
              availableVenues.map((venue, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    if (selectedVenueNames.includes(venue.name)) {
                      setSelectedVenueNames(selectedVenueNames.filter(v => v !== venue.name));
                    } else {
                      setSelectedVenueNames([...selectedVenueNames, venue.name]);
                    }
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: selectedVenueNames.includes(venue.name) ? '#FF9500' : '#ddd',
                    backgroundColor: selectedVenueNames.includes(venue.name) ? '#FFF3E0' : '#fff',
                  }}
                >
                  <Text style={{ 
                    color: selectedVenueNames.includes(venue.name) ? '#E65100' : '#666', 
                    fontWeight: selectedVenueNames.includes(venue.name) ? '600' : '400' 
                  }}>
                    {selectedVenueNames.includes(venue.name) ? '✓ ' : ''}{venue.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Pulsante Salva Assegnazioni */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: '#9C27B0', marginTop: 8 }]}
            onPress={async () => {
              try {
                await api.patch(`/users/${id}`, {
                  assigned_teams: selectedTeamIds,
                  assigned_venues: selectedVenueNames,
                });
                showAlert('Successo', 'Assegnazioni salvate');
                loadData();
              } catch (error: any) {
                showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
              }
            }}
          >
            <Text style={styles.saveButtonText}>💾 Salva Assegnazioni</Text>
          </TouchableOpacity>
        </View>

        {/* Onboarding Checklist Button */}
        {(() => {
          const totalItems = 3; // contract_signed, id_acquired, fiscal_code_acquired
          const completedItems = [
            checklistItems.contract_signed,
            checklistItems.id_acquired,
            checklistItems.fiscal_code_acquired
          ].filter(Boolean).length;
          
          const isComplete = completedItems === totalItems;
          
          return (
            <TouchableOpacity 
              style={[
                styles.checklistButton,
                isComplete ? styles.checklistButtonComplete : styles.checklistButtonIncomplete
              ]}
              onPress={() => setEditingOnboarding(true)}
            >
              <Ionicons 
                name={isComplete ? "checkmark-circle" : "alert-circle"} 
                size={24} 
                color="#fff" 
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.checklistButtonTitle}>
                  Checklist Onboarding
                </Text>
                <Text style={styles.checklistButtonSubtitle}>
                  {completedItems}/{totalItems} completati
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          );
        })()}

        {/* Onboarding Modal */}
        <Modal
          visible={editingOnboarding}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setEditingOnboarding(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.onboardingModalContent}>
              <Text style={styles.onboardingModalTitle}>📋 Checklist Onboarding</Text>
              <Text style={{ color: '#666', marginBottom: 16, textAlign: 'center' }}>
                Seleziona le attività completate
              </Text>
              
              {Object.entries(checklistItems).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.onboardingChecklistItem, value && styles.onboardingChecklistItemChecked]}
                  onPress={() => setChecklistItems({ ...checklistItems, [key]: !value })}
                >
                  <Text style={{ fontSize: 22 }}>{value ? '☑️' : '⬜'}</Text>
                  <Text style={styles.onboardingChecklistText}>
                    {key === 'contract_signed' && 'Contratto/Lettera d\'incarico firmata'}
                    {key === 'id_acquired' && 'Documento d\'identità acquisito'}
                    {key === 'fiscal_code_acquired' && 'Codice fiscale acquisito'}
                  </Text>
                </TouchableOpacity>
              ))}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingOnboarding(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, savingOnboarding && styles.saveButtonDisabled]}
                  onPress={handleSaveOnboarding}
                  disabled={savingOnboarding}
                >
                  {savingOnboarding ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Salva</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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

      {/* Quietanze Modal */}
      <Modal visible={quietanzeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', width: '95%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#4CAF50', padding: 8, borderRadius: 10, marginRight: 10 }}>
                  <Ionicons name="receipt" size={24} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Quietanze Firmate</Text>
                  <Text style={{ fontSize: 13, color: '#388E3C', fontWeight: '600' }}>
                    {signedReceipts.length} {signedReceipts.length === 1 ? 'quietanza' : 'quietanze'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setQuietanzeModalVisible(false)}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            
            {signedReceipts.length > 0 && (
              <View style={{ backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 12 }}>Totale Percepito</Text>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}>
                  € {signedReceipts.reduce((sum: number, r: any) => sum + (r.amount_gross || r.amount || 0), 0).toFixed(2)}
                </Text>
              </View>
            )}
            
            {/* Month Icons Grid - Solo mesi del contratto */}
            {contractMonths.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 8 }}>
                {contractMonths.map(({ name: monthName, month: monthNum, year }) => {
                  const isSigned = signedReceipts.some((r: any) => r.month === monthNum && r.year === year);
                  return (
                    <View key={`${monthName}-${year}`} style={{ width: contractMonths.length <= 5 ? `${100/contractMonths.length}%` : '20%', alignItems: 'center', paddingVertical: 6 }}>
                      <View style={{ 
                        width: 36, height: 36, borderRadius: 18, 
                        backgroundColor: isSigned ? '#4CAF50' : '#e0e0e0',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 2
                      }}>
                        <Ionicons name={isSigned ? "checkmark" : "remove"} size={20} color={isSigned ? '#fff' : '#999'} />
                      </View>
                      <Text style={{ fontSize: 11, color: isSigned ? '#4CAF50' : '#999', fontWeight: '600' }}>{monthName}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <ScrollView style={{ maxHeight: 300 }}>
              {signedReceipts.map((receipt, index) => (
                <View key={receipt.id || index} style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8F5E9' }}>
                  <Ionicons name="document-text" size={24} color="#4CAF50" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: '#333' }}>
                      {receipt.month_name || `Mese ${receipt.month}`} {receipt.year}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#4CAF50', fontWeight: '500' }}>
                      € {(receipt.amount_gross || receipt.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={{ backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, marginTop: 16, alignItems: 'center' }}
              onPress={() => setQuietanzeModalVisible(false)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Chiudi</Text>
            </TouchableOpacity>
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
