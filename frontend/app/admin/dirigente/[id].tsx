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
  Dimensions,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';

interface Dirigente {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
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
  compensation_accepted?: boolean;
  compensation_history?: { [key: string]: boolean };
  over_5000_limit?: { [key: string]: boolean };
  // Photo fields
  profile_photo?: string;
  profile_photo_artistic?: string;
  // Qualification/Position in society
  qualification?: string;
  // Document fields
  id_type?: string;
  id_front?: string;
  id_back?: string;
  doc_front_image?: string;
  doc_back_image?: string;
  iban?: string;
  account_holder?: string;
  bank_name?: string;
}

export default function AdminDirigenteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dirigente, setDirigente] = useState<Dirigente | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  
  // Image viewer modal
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageTitle, setViewingImageTitle] = useState('');
  
  // Reset password modal
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');
  const [otherAnnualCompensation, setOtherAnnualCompensation] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [qualification, setQualification] = useState('');
  const [availableQualifications, setAvailableQualifications] = useState<string[]>([]);
  const [qualificationModalVisible, setQualificationModalVisible] = useState(false);
  // Bank details
  const [documentType, setDocumentType] = useState('');
  const [documentFront, setDocumentFront] = useState('');
  const [documentBack, setDocumentBack] = useState('');
  const [iban, setIban] = useState('');
  const [ibanHolder, setIbanHolder] = useState('');
  const [bankName, setBankName] = useState('');
  // Signed receipts
  const [signedReceipts, setSignedReceipts] = useState<any[]>([]);
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
      showAlert('Successo', `Password resettata per ${dirigente?.full_name}`);
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
      const [userResponse, settingsResponse] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/settings/society'),
      ]);
      
      setDirigente(userResponse.data);
      setMonthlyCompensation(userResponse.data.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(userResponse.data.other_annual_compensation?.toString() || '0');
      setContractStartDate(userResponse.data.contract_start_date || '');
      setContractEndDate(userResponse.data.contract_end_date || '');
      setQualification(userResponse.data.qualification || '');
      setDocumentType(userResponse.data.document_type || '');
      setDocumentFront(userResponse.data.document_front || '');
      setDocumentBack(userResponse.data.document_back || '');
      setIban(userResponse.data.iban || '');
      setIbanHolder(userResponse.data.iban_holder || '');
      setBankName(userResponse.data.bank_name || '');
      
      // Load signed receipts from compensation endpoint
      try {
        const compensationRes = await api.get(`/dirigente/${id}/compensation`);
        if (Array.isArray(compensationRes.data)) {
          setSignedReceipts(compensationRes.data);
        }
      } catch (err) {
        console.log('No compensation data available');
      }
      
      // Load available qualifications from settings
      setAvailableQualifications(settingsResponse.data.dirigente_qualifications || []);
    } catch (error) {
      console.error('Error loading dirigente data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  // Helper per parsare date in formato dd/mm/yyyy o yyyy-mm-dd
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    // Se è in formato dd/mm/yyyy
    if (dateStr.includes('/')) {
      const [dd, mm, yyyy] = dateStr.split('/');
      return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    }
    // Se è in formato yyyy-mm-dd (ISO)
    if (dateStr.includes('-')) {
      return new Date(dateStr);
    }
    return null;
  };

  // Calcolo breakdown per anno solare
  const getYearlyBreakdown = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const prior = parseFloat(otherAnnualCompensation) || 0;
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    
    const years: { [year: number]: { months: number, startMonth: string, endMonth: string, total: number, prior: number, grandTotal: number, exceedsThreshold5k: boolean, exceedsThreshold15k: boolean } } = {};
    
    const start = parseDate(contractStartDate);
    const end = parseDate(contractEndDate);
    
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      
      for (let year = startYear; year <= endYear; year++) {
        const yearStartMonth = (year === startYear) ? start.getMonth() : 0;
        const yearEndMonth = (year === endYear) ? end.getMonth() : 11;
        
        const monthsThisYear = yearEndMonth - yearStartMonth + 1;
        const totalThisYear = monthly * monthsThisYear;
        
        const priorThisYear = (year === startYear) ? prior : 0;
        const grandTotalThisYear = priorThisYear + totalThisYear;
        
        years[year] = {
          months: monthsThisYear,
          startMonth: monthNames[yearStartMonth],
          endMonth: monthNames[yearEndMonth],
          total: totalThisYear,
          prior: priorThisYear,
          grandTotal: grandTotalThisYear,
          exceedsThreshold5k: grandTotalThisYear > 5000,
          exceedsThreshold15k: grandTotalThisYear > 15000
        };
      }
    }
    
    return years;
  };
  
  const getCompensationBreakdown = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const prior = parseFloat(otherAnnualCompensation) || 0;
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    let monthsInContract = 12;
    let startMonthName = 'Gennaio';
    let endMonthName = 'Dicembre';
    let startYear = new Date().getFullYear();
    let endYear = startYear;
    
    const start = parseDate(contractStartDate);
    const end = parseDate(contractEndDate);
    
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      monthsInContract = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      if (monthsInContract < 1) monthsInContract = 1;
      startMonthName = monthNames[start.getMonth()];
      endMonthName = monthNames[end.getMonth()];
      startYear = start.getFullYear();
      endYear = end.getFullYear();
    }
    
    return {
      monthly,
      prior,
      monthsInContract,
      startMonthName,
      endMonthName,
      startYear,
      endYear,
      thisClubTotal: monthly * monthsInContract,
      grandTotal: prior + (monthly * monthsInContract)
    };
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

  const handleSaveCompensation = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${id}/compensation`, {
        monthly_compensation: parseFloat(monthlyCompensation) || 0,
        other_annual_compensation: parseFloat(otherAnnualCompensation) || 0,
      });
      showAlert('Successo', 'Compenso aggiornato con successo');
      setEditing(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (side === 'front') {
          setDocumentFront(result.assets[0].base64);
        } else {
          setDocumentBack(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSaveBankDetails = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${id}/bank-details`, {
        document_type: documentType,
        document_front: documentFront,
        document_back: documentBack,
        iban: iban.toUpperCase().replace(/\s/g, ''),
        iban_holder: ibanHolder.toUpperCase(),
        bank_name: bankName.toUpperCase(),
      });
      showAlert('Successo', 'Dati bancari aggiornati con successo');
      setEditingBank(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
        </View>
      </View>
    );
  }

  if (!dirigente) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Errore</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Dirigente non trovato</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{dirigente.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(dirigente.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(dirigente.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(dirigente.status) }]}>
            {getStatusLabel(dirigente.status)}
          </Text>
        </View>

        {/* Header con nome e contatti */}
        <View style={styles.photoSection}>
          <Text style={styles.photoName}>{dirigente.full_name}</Text>
          <Text style={styles.photoRole}>
            {dirigente.role === 'admin' ? '👑 Amministratore' : '👔 Dirigente'}
          </Text>
          
          {/* Contact Buttons */}
          <View style={styles.contactButtons}>
            {dirigente.phone && (
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => {
                  const phone = dirigente.phone?.replace(/\D/g, '');
                  const phoneWithCountry = phone?.startsWith('39') ? phone : `39${phone}`;
                  Linking.openURL(`https://wa.me/${phoneWithCountry}`);
                }}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.whatsappBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.resetPasswordBtn}
              onPress={() => setResetPasswordVisible(true)}
            >
              <Ionicons name="key-outline" size={20} color="#fff" />
              <Text style={styles.resetPasswordBtnText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* €5000/€15000 Alert - Show if any signed receipt exceeded thresholds */}
        {signedReceipts.some(r => r.exceeded_5000 || r.exceeded_15000) && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={24} color="#FF3B30" />
            <View style={styles.alertContent}>
              {signedReceipts.some(r => r.exceeded_5000) && (
                <>
                  <Text style={styles.alertTitle}>⚠️ SUPERAMENTO €5.000</Text>
                  <Text style={styles.alertText}>
                    Il dirigente ha superato il limite di €5.000 annui.
                  </Text>
                </>
              )}
              {signedReceipts.some(r => r.exceeded_15000) && (
                <>
                  <Text style={[styles.alertTitle, { marginTop: 8 }]}>🚨 SUPERAMENTO €15.000</Text>
                  <Text style={styles.alertText}>
                    Superato anche il limite di €15.000 - obblighi fiscali aggiuntivi!
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Dati Personali */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Dati Personali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{dirigente.first_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Cognome</Text>
            <Text style={styles.value}>{dirigente.last_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Data di nascita</Text>
            <Text style={styles.value}>{formatDate(dirigente.date_of_birth)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Luogo di nascita</Text>
            <Text style={styles.value}>{dirigente.place_of_birth || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{dirigente.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Telefono</Text>
            <Text style={styles.value}>{dirigente.phone || '-'}</Text>
          </View>
        </View>

        {/* Indirizzo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏠 Indirizzo</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Via</Text>
            <Text style={styles.value}>{dirigente.address || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>CAP</Text>
            <Text style={styles.value}>{dirigente.postal_code || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Città</Text>
            <Text style={styles.value}>{dirigente.city || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Provincia</Text>
            <Text style={styles.value}>{dirigente.province || '-'}</Text>
          </View>
        </View>

        {/* Dati Fiscali */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Codice Fiscale</Text>
            <Text style={[styles.value, styles.valueCode]}>{dirigente.fiscal_code || '-'}</Text>
          </View>
        </View>

        {/* Carica nella Società */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏅 Carica nella Società</Text>
          {availableQualifications.length > 0 ? (
            <View style={styles.qualificationContainer}>
              <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setQualificationModalVisible(true)}
              >
                <Text style={[
                  styles.selectBoxText,
                  !qualification && styles.selectBoxPlaceholder
                ]}>
                  {qualification || 'Seleziona carica...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {qualification && (
                <TouchableOpacity
                  style={styles.clearQualificationBtn}
                  onPress={async () => {
                    setQualification('');
                    try {
                      await api.patch(`/users/${id}`, { qualification: '' });
                      showAlert('Successo', 'Carica rimossa');
                      loadData();
                    } catch (error) {
                      console.error('Error clearing qualification:', error);
                    }
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  <Text style={styles.clearQualificationText}>Rimuovi</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noQualificationsBox}>
              <Ionicons name="information-circle" size={20} color="#FF9500" />
              <Text style={styles.noQualificationsText}>
                Nessuna carica definita. Vai in Impostazioni → Cariche Dirigenti per aggiungerne.
              </Text>
            </View>
          )}
        </View>

        {/* Compenso */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💰 Compenso Mensile</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Ionicons name={editing ? "close" : "create"} size={22} color="#8E44AD" />
            </TouchableOpacity>
          </View>
          
          {editing ? (
            <>
              <Text style={styles.inputLabel}>Importo Mensile (€) - Questa ASD</Text>
              <TextInput
                style={styles.input}
                value={monthlyCompensation}
                onChangeText={setMonthlyCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#999"
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Compensi Pregressi (€) - Da altre ASD/SSD nell'anno</Text>
              <TextInput
                style={styles.input}
                value={otherAnnualCompensation}
                onChangeText={setOtherAnnualCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4, marginBottom: 12 }}>
                Compensi già percepiti da altre società sportive nell'anno solare corrente
              </Text>
              
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveCompensation}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Salvataggio...' : 'Salva Compenso'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.compensationDisplay}>
                <Text style={styles.compensationAmount}>€{dirigente.monthly_compensation || 0}</Text>
                <Text style={styles.compensationPeriod}>/mese (questa ASD)</Text>
              </View>
              {(dirigente as any).other_annual_compensation > 0 && (
                <View style={{ marginTop: 8, padding: 10, backgroundColor: '#FFF8E1', borderRadius: 8, borderWidth: 1, borderColor: '#F9A825' }}>
                  <Text style={{ fontSize: 12, color: '#F9A825', fontWeight: '600' }}>
                    + €{(dirigente as any).other_annual_compensation} compensi pregressi da altre ASD
                  </Text>
                </View>
              )}
              
              {/* Calcolo per Anno Solare - Enhanced UI */}
              {contractStartDate && contractEndDate && (
                <View style={{ marginTop: 16 }}>
                  {(() => {
                    const breakdown = getCompensationBreakdown();
                    const yearlyBreakdown = getYearlyBreakdown();
                    const years = Object.keys(yearlyBreakdown).map(Number).sort();
                    const prior = parseFloat(otherAnnualCompensation) || 0;
                    
                    return (
                      <>
                        {/* Box RAS - Totale Contratto */}
                        <View style={[styles.totalBox, { backgroundColor: '#F3E5F5', marginBottom: 12 }]}>
                          <Text style={[styles.totalLabel, { color: '#8E44AD', fontWeight: 'bold' }]}>
                            📄 Comunicazione RAS - Totale Contratto
                          </Text>
                          <Text style={{ color: '#8E44AD', fontSize: 12, marginTop: 4 }}>
                            Dal {contractStartDate.split('-').reverse().join('/')} al {contractEndDate.split('-').reverse().join('/')} = {breakdown.monthsInContract} mesi
                          </Text>
                          <Text style={[styles.totalValue, { color: '#8E44AD', fontSize: 22 }]}>
                            €{breakdown.thisClubTotal.toLocaleString()}
                          </Text>
                          <Text style={{ color: '#8E44AD', fontSize: 11 }}>
                            ({breakdown.monthsInContract} mesi × €{parseFloat(monthlyCompensation) || 0})
                          </Text>
                        </View>
                        
                        {/* Header Calcolo per Anno */}
                        <View style={{ backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>📊 Calcolo per Anno Solare (soglie €5k/€15k)</Text>
                        </View>
                        
                        {/* Box Anno Inizio */}
                        {years.length > 0 && years[0] && yearlyBreakdown[years[0]] && (
                          <View style={[styles.totalBox, { 
                            backgroundColor: yearlyBreakdown[years[0]].exceedsThreshold5k ? '#FFF8E1' : '#E8F5E9',
                            marginBottom: 12 
                          }]}>
                            <Text style={[styles.totalLabel, { 
                              color: yearlyBreakdown[years[0]].exceedsThreshold5k ? '#F57F17' : '#2E7D32',
                              fontWeight: 'bold' 
                            }]}>
                              {yearlyBreakdown[years[0]].exceedsThreshold5k ? '⚠️' : '✅'} Anno {years[0]} ({yearlyBreakdown[years[0]].startMonth}-Dic: {yearlyBreakdown[years[0]].months} mesi)
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap' }}>
                              <View style={{ marginRight: 8 }}>
                                <Text style={{ fontSize: 12, color: '#666' }}>Compenso ASD:</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600' }}>€{yearlyBreakdown[years[0]].total.toLocaleString()}</Text>
                              </View>
                              {prior > 0 && (
                                <View style={{ marginRight: 8 }}>
                                  <Text style={{ fontSize: 12, color: '#E65100' }}>+ Pregressi:</Text>
                                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#E65100' }}>€{prior.toLocaleString()}</Text>
                                </View>
                              )}
                              <View>
                                <Text style={{ fontSize: 12, color: '#333' }}>Totale:</Text>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: yearlyBreakdown[years[0]].exceedsThreshold5k ? '#F57F17' : '#2E7D32' }}>
                                  €{yearlyBreakdown[years[0]].grandTotal.toLocaleString()}
                                </Text>
                              </View>
                            </View>
                            {yearlyBreakdown[years[0]].exceedsThreshold5k && !yearlyBreakdown[years[0]].exceedsThreshold15k && (
                              <View style={{ backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: '#FF9800', borderRadius: 8, padding: 10, marginTop: 8 }}>
                                <Text style={{ fontSize: 13, color: '#E65100', fontWeight: 'bold', textAlign: 'center' }}>
                                  ⚠️ SUPERAMENTO €5.000
                                </Text>
                                <Text style={{ fontSize: 11, color: '#F57F17', textAlign: 'center', marginTop: 4 }}>
                                  Contributi previdenziali INPS
                                </Text>
                              </View>
                            )}
                            {yearlyBreakdown[years[0]].exceedsThreshold15k && (
                              <View style={{ backgroundColor: '#FFEBEE', borderWidth: 2, borderColor: '#F44336', borderRadius: 8, padding: 10, marginTop: 8 }}>
                                <Text style={{ fontSize: 13, color: '#C62828', fontWeight: 'bold', textAlign: 'center' }}>
                                  🚨 SUPERAMENTO €15.000
                                </Text>
                                <Text style={{ fontSize: 11, color: '#D32F2F', textAlign: 'center', marginTop: 4 }}>
                                  Tassazione IRPEF obbligatoria
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {/* Box Anno Fine (se diverso) */}
                        {years.length > 1 && years[1] && yearlyBreakdown[years[1]] && (
                          <View style={[styles.totalBox, { 
                            backgroundColor: yearlyBreakdown[years[1]].exceedsThreshold5k ? '#FFF8E1' : '#E8F5E9',
                            marginBottom: 12 
                          }]}>
                            <Text style={[styles.totalLabel, { 
                              color: yearlyBreakdown[years[1]].exceedsThreshold5k ? '#F57F17' : '#2E7D32',
                              fontWeight: 'bold' 
                            }]}>
                              {yearlyBreakdown[years[1]].exceedsThreshold5k ? '⚠️' : '✅'} Anno {years[1]} (Gen-{yearlyBreakdown[years[1]].endMonth}: {yearlyBreakdown[years[1]].months} mesi)
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                              <View>
                                <Text style={{ fontSize: 12, color: '#666' }}>Compenso ASD:</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600' }}>€{yearlyBreakdown[years[1]].total.toLocaleString()}</Text>
                              </View>
                              <View>
                                <Text style={{ fontSize: 12, color: '#333' }}>Totale Anno:</Text>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: yearlyBreakdown[years[1]].exceedsThreshold5k ? '#F57F17' : '#2E7D32' }}>
                                  €{yearlyBreakdown[years[1]].grandTotal.toLocaleString()}
                                </Text>
                              </View>
                            </View>
                            {yearlyBreakdown[years[1]].exceedsThreshold5k && !yearlyBreakdown[years[1]].exceedsThreshold15k && (
                              <View style={{ backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: '#FF9800', borderRadius: 8, padding: 10, marginTop: 8 }}>
                                <Text style={{ fontSize: 13, color: '#E65100', fontWeight: 'bold', textAlign: 'center' }}>
                                  ⚠️ SUPERAMENTO €5.000
                                </Text>
                                <Text style={{ fontSize: 11, color: '#F57F17', textAlign: 'center', marginTop: 4 }}>
                                  Contributi previdenziali INPS
                                </Text>
                              </View>
                            )}
                            {yearlyBreakdown[years[1]].exceedsThreshold15k && (
                              <View style={{ backgroundColor: '#FFEBEE', borderWidth: 2, borderColor: '#F44336', borderRadius: 8, padding: 10, marginTop: 8 }}>
                                <Text style={{ fontSize: 13, color: '#C62828', fontWeight: 'bold', textAlign: 'center' }}>
                                  🚨 SUPERAMENTO €15.000
                                </Text>
                                <Text style={{ fontSize: 11, color: '#D32F2F', textAlign: 'center', marginTop: 4 }}>
                                  Tassazione IRPEF obbligatoria
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>
              )}
            </>
          )}

          {dirigente.compensation_accepted && (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.acceptedText}>Accettato dal dirigente</Text>
            </View>
          )}
          
          {/* Totale già percepito (quietanze firmate) */}
          {signedReceipts.filter((r: any) => r.receipt_signed).length > 0 && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#2E7D32', fontWeight: '500' }}>💰 Già Percepito:</Text>
                <Text style={{ fontWeight: 'bold', color: '#2E7D32', fontSize: 16 }}>
                  € {signedReceipts
                    .filter((r: any) => r.receipt_signed)
                    .reduce((sum: number, r: any) => sum + (r.amount_gross || r.amount || 0), 0)
                    .toFixed(2)}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {signedReceipts.filter((r: any) => r.receipt_signed).length} quietanze firmate
              </Text>
            </View>
          )}
        </View>

        {/* Storico Quietanze Firmate - Dati reali dal database */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Quietanze Firmate</Text>
          <Text style={styles.historySubtitle}>Quietanze effettivamente firmate dal dirigente</Text>
          
          {signedReceipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nessuna quietanza firmata</Text>
            </View>
          ) : (
            (() => {
              // Sort receipts by date (oldest first) to find threshold crossings
              const sortedByDate = [...signedReceipts]
                .filter(r => r.receipt_signed === true)
                .sort((a, b) => {
                  if (a.year !== b.year) return a.year - b.year;
                  return a.month - b.month;
                });
              
              // Track thresholds PER YEAR (they reset each calendar year)
              const thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } } = {};
              
              for (const r of sortedByDate) {
                if (!thresholdsByYear[r.year]) {
                  thresholdsByYear[r.year] = { first5k: null, first15k: null };
                }
                if (r.exceeded_5000 && thresholdsByYear[r.year].first5k === null) {
                  thresholdsByYear[r.year].first5k = r.month;
                }
                if (r.exceeded_15000 && thresholdsByYear[r.year].first15k === null) {
                  thresholdsByYear[r.year].first15k = r.month;
                }
              }
              
              // Helper to check if a month is after a threshold IN THE SAME YEAR
              const isAfterThreshold = (receipt: any, type: '5k' | '15k') => {
                const yearThresholds = thresholdsByYear[receipt.year];
                if (!yearThresholds) return false;
                const thresholdMonth = type === '5k' ? yearThresholds.first5k : yearThresholds.first15k;
                if (thresholdMonth === null) return false;
                return receipt.month >= thresholdMonth;
              };
              
              // Sort for display (newest first)
              const sortedForDisplay = [...sortedByDate].reverse();
              
              return sortedForDisplay.map((receipt) => {
                const monthNames = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                                   'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
                const monthLabel = `${monthNames[receipt.month]} ${receipt.year}`;
                const signedDate = receipt.receipt_signed_date 
                  ? format(new Date(receipt.receipt_signed_date), 'dd/MM/yyyy', { locale: it })
                  : '-';
                
                // Check if this is THE month where threshold was crossed (show badge)
                const isThreshold5kMonth = receipt.exceeded_5000 === true;
                const isThreshold15kMonth = receipt.exceeded_15000 === true;
                
                // Check if this month is after the threshold was crossed IN SAME YEAR (highlight row)
                const isAfter15k = isAfterThreshold(receipt, '15k');
                const isAfter5k = isAfterThreshold(receipt, '5k');
                
                return (
                  <View key={`${receipt.year}-${receipt.month}`} style={[
                    styles.monthRow,
                    isAfter15k && { backgroundColor: '#FFF3E0', borderLeftWidth: 4, borderLeftColor: '#E65100' },
                    isAfter5k && !isAfter15k && { backgroundColor: '#FFF8E1', borderLeftWidth: 4, borderLeftColor: '#F9A825' }
                  ]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.monthLabel}>{monthLabel}</Text>
                        {isThreshold15kMonth && (
                          <View style={{ backgroundColor: '#E65100', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>&gt;15K</Text>
                          </View>
                        )}
                        {isThreshold5kMonth && !isThreshold15kMonth && (
                          <View style={{ backgroundColor: '#F9A825', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>&gt;5K</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.signedDateText}>Firmata il: {signedDate}</Text>
                    </View>
                    <View style={styles.monthStatus}>
                      <View style={[styles.paidBadge, styles.paidBadgeActive]}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text style={[styles.paidText, styles.paidTextActive]}>FIRMATA</Text>
                      </View>
                    </View>
                  </View>
                );
              });
            })()
          )}
          
          {signedReceipts.filter(r => r.receipt_signed === true).length === 0 && signedReceipts.length > 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nessuna quietanza firmata ancora</Text>
            </View>
          )}
        </View>

        {/* Documenti e IBAN - Solo per utenti approvati */}
        {dirigente.status === 'approved' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🏦 Documento e Dati Bancari</Text>
              <TouchableOpacity onPress={() => setEditingBank(!editingBank)}>
                <Ionicons name={editingBank ? "close" : "create"} size={22} color="#8E44AD" />
              </TouchableOpacity>
            </View>

            {editingBank ? (
              <>
                <Text style={styles.inputLabel}>Tipo Documento</Text>
                <View style={styles.docTypeButtons}>
                  {['C.I.', 'Passaporto', 'Patente'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.docTypeBtn, documentType === type && styles.docTypeBtnActive]}
                      onPress={() => setDocumentType(type)}
                    >
                      <Text style={[styles.docTypeBtnText, documentType === type && styles.docTypeBtnTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Documento Fronte</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('front')}>
                  {documentFront ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${documentFront}` }} style={styles.docPreview} />
                  ) : (
                    <>
                      <Ionicons name="camera" size={24} color="#8E44AD" />
                      <Text style={styles.uploadBtnText}>Carica Fronte</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Documento Retro</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('back')}>
                  {documentBack ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${documentBack}` }} style={styles.docPreview} />
                  ) : (
                    <>
                      <Ionicons name="camera" size={24} color="#8E44AD" />
                      <Text style={styles.uploadBtnText}>Carica Retro</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.inputLabel}>IBAN</Text>
                <TextInput
                  style={styles.input}
                  value={iban}
                  onChangeText={(text) => setIban(text.toUpperCase())}
                  placeholder="IT00X0000000000000000000000"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />

                <Text style={styles.inputLabel}>Intestatario Conto</Text>
                <TextInput
                  style={styles.input}
                  value={ibanHolder}
                  onChangeText={(text) => setIbanHolder(text.toUpperCase())}
                  placeholder="NOME COGNOME"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />

                <Text style={styles.inputLabel}>Nome Banca</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={(text) => setBankName(text.toUpperCase())}
                  placeholder="ES. UNICREDIT, INTESA SANPAOLO"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSaveBankDetails}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Salvataggio...' : 'Salva Dati Bancari'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Tipo Documento</Text>
                  <Text style={styles.value}>{dirigente.document_type || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Documento</Text>
                  <Text style={styles.value}>
                    {dirigente.doc_front_image ? '✅ Caricato' : '❌ Mancante'}
                  </Text>
                </View>
                {(dirigente.doc_front_image || dirigente.doc_back_image) && (
                  <View style={styles.docImagesRow}>
                    <Text style={styles.tapHint}>👆 Tocca per ingrandire</Text>
                    {dirigente.doc_front_image && (
                      <TouchableOpacity 
                        style={styles.docImageContainer}
                        onPress={() => openImageViewer(dirigente.doc_front_image!, 'Documento Fronte')}
                      >
                        <Text style={styles.docImageLabel}>Fronte</Text>
                        <Image source={{ uri: `data:image/jpeg;base64,${dirigente.doc_front_image}` }} style={styles.docThumb} />
                      </TouchableOpacity>
                    )}
                    {dirigente.doc_back_image && (
                      <TouchableOpacity 
                        style={styles.docImageContainer}
                        onPress={() => openImageViewer(dirigente.doc_back_image!, 'Documento Retro')}
                      >
                        <Text style={styles.docImageLabel}>Retro</Text>
                        <Image source={{ uri: `data:image/jpeg;base64,${dirigente.doc_back_image}` }} style={styles.docThumb} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.label}>IBAN</Text>
                  <Text style={[styles.value, styles.valueCode]}>{dirigente.iban || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Intestatario</Text>
                  <Text style={styles.value}>{dirigente.account_holder || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Banca</Text>
                  <Text style={styles.value}>{dirigente.bank_name || '-'}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Date Registrazione */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Informazioni Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Registrato il</Text>
            <Text style={styles.value}>{formatDate(dirigente.created_at)}</Text>
          </View>
          {dirigente.approved_at && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Approvato il</Text>
              <Text style={styles.value}>{formatDate(dirigente.approved_at)}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>{viewingImageTitle}</Text>
            <TouchableOpacity 
              style={styles.imageViewerClose}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {viewingImage && (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${viewingImage}` }} 
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity 
            style={styles.imageViewerCloseBtn}
            onPress={() => setImageViewerVisible(false)}
          >
            <Text style={styles.imageViewerCloseBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Qualification Selection Modal */}
      <Modal
        visible={qualificationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQualificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qualificationModalContent}>
            <View style={styles.qualificationModalHeader}>
              <Text style={styles.qualificationModalTitle}>🏅 Seleziona Carica</Text>
              <TouchableOpacity onPress={() => setQualificationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.qualificationModalList}>
              {availableQualifications.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[
                    styles.qualificationModalItem,
                    qualification === q && styles.qualificationModalItemSelected
                  ]}
                  onPress={async () => {
                    setQualification(q);
                    setQualificationModalVisible(false);
                    try {
                      await api.patch(`/users/${id}`, { qualification: q });
                      showAlert('Successo', `Carica aggiornata a "${q}"`);
                      loadData();
                    } catch (error) {
                      console.error('Error saving qualification:', error);
                      showAlert('Errore', 'Impossibile salvare la carica');
                    }
                  }}
                >
                  <Ionicons 
                    name={qualification === q ? "checkmark-circle" : "ellipse-outline"} 
                    size={22} 
                    color={qualification === q ? "#8E44AD" : "#999"} 
                  />
                  <Text style={[
                    styles.qualificationModalItemText,
                    qualification === q && styles.qualificationModalItemTextSelected
                  ]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.qualificationModalCancelBtn}
              onPress={() => setQualificationModalVisible(false)}
            >
              <Text style={styles.qualificationModalCancelText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={resetPasswordVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResetPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔑 Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Imposta una nuova password per {dirigente?.full_name}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nuova password (min 6 caratteri)"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={false}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setResetPasswordVisible(false);
                  setNewPassword('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, resettingPassword && styles.disabledBtn]}
                onPress={handleResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Conferma</Text>
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
  header: {
    backgroundColor: '#8E44AD',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  statusBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginHorizontal: 16, 
    marginTop: 16, 
    padding: 12, 
    borderRadius: 10 
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: '600' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  alertContent: { flex: 1, marginLeft: 12 },
  alertTitle: { fontSize: 14, fontWeight: 'bold', color: '#FF3B30' },
  alertText: { fontSize: 12, color: '#666', marginTop: 4 },
  alertDate: { fontSize: 11, color: '#007AFF', marginTop: 4, fontStyle: 'italic' },
  // Photo section styles
  photoSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  photoContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#8E44AD',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  photoZoomHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 6,
  },
  photoName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  photoRole: {
    fontSize: 14,
    color: '#8E44AD',
    marginTop: 4,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resetPasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  resetPasswordBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Qualification selector styles
  qualificationContainer: {
    gap: 8,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectBoxText: {
    fontSize: 15,
    color: '#333',
  },
  selectBoxPlaceholder: {
    color: '#999',
  },
  clearQualificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearQualificationText: {
    fontSize: 13,
    color: '#FF3B30',
  },
  noQualificationsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  noQualificationsText: {
    flex: 1,
    fontSize: 13,
    color: '#F57C00',
  },
  // Qualification Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  qualificationModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  qualificationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  qualificationModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  qualificationModalList: {
    padding: 8,
  },
  qualificationModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  qualificationModalItemSelected: {
    backgroundColor: '#F3E5F5',
  },
  qualificationModalItemText: {
    fontSize: 16,
    color: '#333',
  },
  qualificationModalItemTextSelected: {
    color: '#8E44AD',
    fontWeight: '600',
  },
  qualificationModalCancelBtn: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  qualificationModalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  card: { 
    backgroundColor: '#fff', 
    margin: 16, 
    marginBottom: 8, 
    padding: 16, 
    borderRadius: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  label: { fontSize: 14, color: '#6c757d', flex: 1 },
  value: { fontSize: 14, fontWeight: '500', color: '#000', flex: 1, textAlign: 'right' },
  valueCode: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#8E44AD' },
  inputLabel: { fontSize: 13, color: '#6c757d', marginBottom: 4, marginTop: 8 },
  input: { 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    padding: 14, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    color: '#000',
  },
  saveBtn: { 
    backgroundColor: '#8E44AD', 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 16 
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  compensationDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 16 },
  compensationAmount: { fontSize: 36, fontWeight: 'bold', color: '#8E44AD' },
  compensationPeriod: { fontSize: 16, color: '#666', marginLeft: 4 },
  acceptedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#f0f0f0' 
  },
  acceptedText: { fontSize: 13, color: '#34C759', marginLeft: 6 },
  historySubtitle: { fontSize: 12, color: '#999', marginBottom: 16, marginTop: -8 },
  monthRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  monthLabel: { fontSize: 14, color: '#333' },
  monthStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exceededBadge: { 
    backgroundColor: '#FFEBEE', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 4 
  },
  exceededText: { fontSize: 10, fontWeight: 'bold', color: '#FF3B30' },
  paidBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  paidBadgeActive: { backgroundColor: '#34C759' },
  paidBadgeInactive: { backgroundColor: '#f0f0f0' },
  paidText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  paidTextActive: { color: '#fff' },
  paidTextInactive: { color: '#999' },
  docTypeButtons: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  docTypeBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    backgroundColor: '#f5f5f5', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  docTypeBtnActive: { backgroundColor: '#F3E5F5', borderColor: '#8E44AD' },
  docTypeBtnText: { fontSize: 14, color: '#666' },
  docTypeBtnTextActive: { color: '#8E44AD', fontWeight: '600' },
  uploadBtn: { 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginBottom: 8,
    minHeight: 100,
  },
  uploadBtnText: { color: '#8E44AD', marginTop: 8 },
  docPreview: { width: '100%', height: 150, borderRadius: 8 },
  docImagesRow: { flexDirection: 'row', gap: 12, marginVertical: 8, flexWrap: 'wrap' },
  docThumb: { width: 100, height: 70, borderRadius: 6 },
  docImageContainer: { alignItems: 'center' },
  docImageLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  tapHint: { fontSize: 10, color: '#007AFF', width: '100%', marginBottom: 8 },
  // Image Viewer Modal styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  imageViewerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  imageViewerClose: {
    padding: 8,
  },
  imageViewerImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 200,
  },
  imageViewerCloseBtn: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
  },
  imageViewerCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signedDateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  // Enhanced compensation breakdown styles
  totalBox: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
});
