import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { GDPRPrivacyModal } from '../../src/components/GDPRPrivacyModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../src/constants/countries';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://audit-compliance-14.preview.emergentagent.com';

const DOC_TYPES = ['Carta Identità', 'Passaporto', 'Patente Auto'];

export default function DirigenteProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  
  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Document images
  const [docFrontImage, setDocFrontImage] = useState<string | null>(null);
  const [docBackImage, setDocBackImage] = useState<string | null>(null);
  
  // Profile photo (artistic)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoArtistic, setProfilePhotoArtistic] = useState<string | null>(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  
  // Privacy consent state
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [societyName, setSocietyName] = useState('PALLAVOLO PERUGIA SSD A RL');
  
  // Signed receipts for compact view
  const [signedReceipts, setSignedReceipts] = useState<any[]>([]);
  
  // My documents (privacy, receipts, etc.)
  const [myDocuments, setMyDocuments] = useState<any[]>([]);
  const [showAllDocumentsModal, setShowAllDocumentsModal] = useState(false);
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    province_of_birth: '',
    country_of_birth: DEFAULT_COUNTRY,
    gender: '' as '' | 'M' | 'F',
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    monthly_compensation: 0,
    compensation_accepted: false,
    // Documento e Dati Bancari
    id_type: '',
    id_front: '',
    id_back: '',
    iban: '',
    account_holder: '',
    bank_name: '',
    doc_front_image: '',
    doc_back_image: '',
  });

  const [editData, setEditData] = useState({ ...profileData });

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (side === 'front') {
          setDocFrontImage(result.assets[0].base64);
          setEditData({...editData, doc_front_image: result.assets[0].base64});
        } else {
          setDocBackImage(result.assets[0].base64);
          setEditData({...editData, doc_back_image: result.assets[0].base64});
        }
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const loadProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const data = response.data;
      setProfileData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        province_of_birth: data.birth_province || data.province_of_birth || '',
        country_of_birth: data.country_of_birth || DEFAULT_COUNTRY,
        gender: data.gender || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
        doc_front_image: data.doc_front_image || '',
        doc_back_image: data.doc_back_image || '',
      });
      setEditData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        province_of_birth: data.birth_province || data.province_of_birth || '',
        country_of_birth: data.country_of_birth || DEFAULT_COUNTRY,
        gender: data.gender || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
        doc_front_image: data.doc_front_image || '',
        doc_back_image: data.doc_back_image || '',
      });
      // Load profile photo
      setProfilePhoto(data.profile_photo || null);
      setProfilePhotoArtistic(data.profile_photo_artistic || null);
      
      // Load privacy status and show modal if not accepted
      const isPrivacyAccepted = data.privacy_accepted || false;
      setPrivacyAccepted(isPrivacyAccepted);
      // Privacy will be shown when user clicks Save, not automatically
      // Save privacy state for later use
      setPrivacyAccepted(isPrivacyAccepted);
      
      // Load society name
      try {
        const societyRes = await api.get('/settings/society');
        if (societyRes.data?.name) {
          setSocietyName(societyRes.data.name);
        }
      } catch (e) {
        console.log('Using default society name');
      }
      
      // Load signed receipts
      try {
        const receiptsRes = await api.get(`/dirigente/${user?.id}/compensation`);
        if (Array.isArray(receiptsRes.data)) {
          setSignedReceipts(receiptsRes.data.filter((r: any) => r.receipt_signed));
        }
      } catch (err) {
        console.log('No compensation data');
      }
      
      // Load my signed documents (privacy, receipts, etc.)
      try {
        const docsRes = await api.get('/documents/my-documents');
        if (docsRes.data?.documents) {
          setMyDocuments(docsRes.data.documents);
        }
      } catch (err) {
        console.log('No documents found');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle privacy signature
  const handlePrivacySign = async (signatureBase64: string) => {
    try {
      // Generate privacy document with signature using /documents/sign endpoint
      const privacyText = `
INFORMATIVA SULLA PRIVACY E CONSENSO AL TRATTAMENTO DEI DATI PERSONALI

Il/La sottoscritto/a ${profileData.full_name || `${editData.last_name} ${editData.first_name}`}, nato/a a ${profileData.place_of_birth || editData.place_of_birth || ''} il ${formatDate(profileData.date_of_birth || editData.date_of_birth)}, residente in ${profileData.address || editData.address || ''}, ${profileData.city || editData.city || ''} (${profileData.province || editData.province || ''}), C.F. ${profileData.fiscal_code || editData.fiscal_code || ''},

DICHIARA

di aver letto e compreso l'informativa ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR) relativa al trattamento dei propri dati personali da parte di ${societyName} e

ACCONSENTE

al trattamento dei propri dati personali per le finalità connesse alla propria attività di Dirigente presso la società sportiva, inclusa la comunicazione a terzi per finalità strettamente connesse all'attività sportiva.
      `.trim();

      const signResponse = await api.post('/documents/sign', {
        document_type: 'privacy_consent',
        document_title: 'Consenso Privacy Dirigente',
        document_text: privacyText,
        signer_name: profileData.full_name || `${editData.last_name} ${editData.first_name}`,
        signer_email: user?.email || '',
        signature_base64: signatureBase64,
        related_entity_id: user?.id,
        additional_data: {
          role: 'dirigente',
          fiscal_code: profileData.fiscal_code || editData.fiscal_code
        }
      });
      
      console.log('Document signed:', signResponse.data);
      
      // Also update privacy_accepted flag in user profile
      const updateResponse = await api.patch('/auth/me', {
        privacy_accepted: true,
      });
      
      console.log('Privacy flag updated:', updateResponse.data);
      
      // Update local state
      setPrivacyAccepted(true);
      setShowPrivacyModal(false);
      
      // Now save the profile
      await performSave();
      
      Alert.alert(
        'Privacy Confermata',
        'La tua conferma privacy è stata registrata. Una copia è stata inviata alla tua email e salvata nell\'archivio.',
        [{ text: 'OK' }]
      );
      
      // Reload profile to get updated data and documents list
      await loadProfile();
    } catch (error: any) {
      console.error('Error signing privacy:', error);
      Alert.alert(
        'Errore',
        error.response?.data?.detail || 'Impossibile salvare la conferma privacy. Riprova.'
      );
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  // Calculate Codice Fiscale
  const handleCalculateCF = async () => {
    if (!editData.first_name || !editData.last_name || !editData.date_of_birth || !editData.place_of_birth || !editData.gender) {
      showAlert('Dati mancanti', 'Compila Nome, Cognome, Sesso, Data e Luogo di Nascita per calcolare il CF');
      return;
    }

    try {
      const response = await api.post('/utils/calcola-cf', {
        nome: editData.first_name,
        cognome: editData.last_name,
        data_nascita: editData.date_of_birth,
        luogo_nascita: editData.place_of_birth,
        sesso: editData.gender,
      });

      if (response.data.success && response.data.codice_fiscale) {
        setEditData({...editData, fiscal_code: response.data.codice_fiscale});
        showAlert('Successo', `Codice Fiscale calcolato: ${response.data.codice_fiscale}`);
      } else {
        showAlert('Errore', response.data.error || 'Impossibile calcolare il CF. Verifica il luogo di nascita.');
      }
    } catch (error: any) {
      showAlert('Errore', 'Errore nel calcolo del Codice Fiscale');
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!editData.last_name?.trim()) {
      showAlert('Campo Obbligatorio', 'Inserisci il Cognome');
      return;
    }
    if (!editData.first_name?.trim()) {
      showAlert('Campo Obbligatorio', 'Inserisci il Nome');
      return;
    }
    if (!editData.phone?.trim()) {
      showAlert('Campo Obbligatorio', 'Inserisci il Telefono');
      return;
    }
    if (!editData.fiscal_code?.trim()) {
      showAlert('Campo Obbligatorio', 'Inserisci il Codice Fiscale');
      return;
    }
    
    // If privacy not yet accepted, show privacy modal instead of saving directly
    if (!privacyAccepted) {
      // Update profileData with current editData so privacy modal has correct data
      setProfileData({...profileData, ...editData});
      setShowPrivacyModal(true);
      return;
    }
    
    // Privacy already accepted, proceed with save
    await performSave();
  };
  
  const performSave = async () => {
    setSaving(true);
    try {
      // Convert date to ISO format
      let isoDate = null;
      if (editData.date_of_birth) {
        const parts = editData.date_of_birth.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      await api.patch('/auth/me', {
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`,
        date_of_birth: isoDate,
        place_of_birth: editData.place_of_birth,
        birth_province: editData.province_of_birth,
        country_of_birth: editData.country_of_birth,
        gender: editData.gender,
        fiscal_code: editData.fiscal_code,
        address: editData.address,
        city: editData.city,
        postal_code: editData.postal_code,
        province: editData.province,
        phone: editData.phone,
      });
      
      showAlert('Successo', 'Profilo aggiornato con successo');
      setEditing(false);
      await loadProfile();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', onPress: async () => { await logout(); router.replace('/login'); } },
      ]);
    }
  };

  const handleAcceptCompensation = async () => {
    try {
      await api.patch('/auth/me', { compensation_accepted: true });
      showAlert('Successo', 'Compenso accettato con successo');
      await loadProfile();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
    }
  };

  const handleChangePassword = async () => {
    // Validations
    if (!currentPassword) {
      showAlert('Errore', 'Inserisci la password attuale');
      return;
    }
    if (!newPassword) {
      showAlert('Errore', 'Inserisci la nuova password');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Errore', 'La nuova password deve avere almeno 6 caratteri');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert('Errore', 'Le nuove password non coincidono');
      return;
    }
    if (currentPassword === newPassword) {
      showAlert('Errore', 'La nuova password deve essere diversa da quella attuale');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      showAlert('Successo', 'Password cambiata con successo!');
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Formattazione automatica data gg/mm/aaaa
  const formatDateInput = (text: string, key: string) => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    let formatted = '';
    
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2);
    }
    if (cleaned.length >= 3) {
      formatted += '/' + cleaned.substring(2, 4);
    }
    if (cleaned.length >= 5) {
      formatted += '/' + cleaned.substring(4, 8);
    }
    
    setEditData({ ...editData, [key]: formatted });
  };

  const renderField = (label: string, value: string, key: string, editable: boolean = true) => {
    const isDateField = key === 'date_of_birth';
    const isProvinceField = key.toLowerCase().includes('province') || key.toLowerCase().includes('provincia');
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}{isProvinceField && editing ? ' (2 lettere)' : ''}</Text>
        {editing && editable ? (
          isDateField ? (
            <TextInput
              style={styles.input}
              value={editData[key as keyof typeof editData]?.toString() || ''}
              onChangeText={(text) => formatDateInput(text, key)}
              placeholder="GG/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
            />
          ) : (
            <TextInput
              style={styles.input}
              value={editData[key as keyof typeof editData]?.toString() || ''}
              onChangeText={(text) => {
                if (isProvinceField) {
                  setEditData({ ...editData, [key]: text.toUpperCase().slice(0, 2) });
                } else {
                  setEditData({ ...editData, [key]: text.toUpperCase() });
                }
              }}
              autoCapitalize="characters"
              maxLength={isProvinceField ? 2 : undefined}
              placeholder={isProvinceField ? 'es. PG' : undefined}
            />
          )
        ) : (
          <Text style={styles.fieldValue}>{value || '-'}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Edit/Save Buttons */}
        <View style={styles.actionButtons}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setEditing(false);
                  setEditData({ ...profileData });
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.headerButtonsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => setEditing(true)}
              >
                <Ionicons name="pencil" size={20} color="#8E44AD" />
                <Text style={styles.editButtonText}>Modifica Dati</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.passwordButton]}
                onPress={() => setShowChangePassword(!showChangePassword)}
              >
                <Ionicons name="key" size={20} color="#007AFF" />
                <Text style={styles.passwordButtonText}>Password</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Change Password Section - Now at top */}
        {showChangePassword && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔐 Cambia Password</Text>
            <View style={styles.changePasswordForm}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Password Attuale</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Inserisci password attuale"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Nuova Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Minimo 6 caratteri"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Conferma Nuova Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  placeholder="Ripeti la nuova password"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.changePasswordButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelPasswordButton}
                  onPress={() => {
                    setShowChangePassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                >
                  <Text style={styles.cancelPasswordButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.changePasswordButton, changingPassword && styles.buttonDisabled]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  <Ionicons name="key" size={18} color="#fff" />
                  <Text style={styles.changePasswordButtonText}>
                    {changingPassword ? 'Cambio...' : 'Cambia Password'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Profile Photo Section - RIMOSSA per privacy */}

        {/* Account Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Account</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profileData.email}</Text>
          </View>
        </View>

        {/* Personal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
          {renderField('Nome', profileData.first_name, 'first_name')}
          {renderField('Cognome', profileData.last_name, 'last_name')}
          {renderField('Data di Nascita', profileData.date_of_birth, 'date_of_birth')}
          
          {/* Stato di Nascita - Dropdown */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Stato di Nascita</Text>
            {editing ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editData.country_of_birth}
                  onValueChange={(value) => setEditData({...editData, country_of_birth: value})}
                  style={styles.picker}
                >
                  {COUNTRIES.map((country) => (
                    <Picker.Item key={country} label={country} value={country} />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text style={styles.fieldValue}>{profileData.country_of_birth || DEFAULT_COUNTRY}</Text>
            )}
          </View>
          
          {renderField('Luogo di Nascita', profileData.place_of_birth, 'place_of_birth')}
          {renderField('Provincia di Nascita', profileData.province_of_birth || '', 'province_of_birth')}
          {renderField('Indirizzo', profileData.address, 'address')}
          {renderField('Città', profileData.city, 'city')}
          
          {/* CAP e Provincia sulla stessa riga */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              {renderField('CAP', profileData.postal_code, 'postal_code')}
            </View>
            <View style={{ flex: 1 }}>
              {renderField('Provincia', profileData.province, 'province')}
            </View>
          </View>
          
          {renderField('Telefono', profileData.phone, 'phone')}
        </View>

        {/* Fiscal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          
          {/* Gender Selection */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Sesso</Text>
            {editing ? (
              <View style={styles.genderButtons}>
                <TouchableOpacity 
                  style={[styles.genderBtn, editData.gender === 'M' && styles.genderBtnActive]}
                  onPress={() => setEditData({...editData, gender: 'M'})}
                >
                  <Text style={[styles.genderBtnText, editData.gender === 'M' && styles.genderBtnTextActive]}>M</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderBtn, editData.gender === 'F' && styles.genderBtnActive]}
                  onPress={() => setEditData({...editData, gender: 'F'})}
                >
                  <Text style={[styles.genderBtnText, editData.gender === 'F' && styles.genderBtnTextActive]}>F</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fieldValue}>{profileData.gender || '-'}</Text>
            )}
          </View>

          {/* Codice Fiscale with Calculate Button */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Codice Fiscale</Text>
            {editing ? (
              <View style={styles.cfCalculateRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={editData.fiscal_code || ''}
                  onChangeText={(text) => setEditData({...editData, fiscal_code: text.toUpperCase()})}
                  autoCapitalize="characters"
                  maxLength={16}
                  placeholder="CODICE FISCALE"
                />
                <TouchableOpacity 
                  style={styles.calculateCfBtn}
                  onPress={handleCalculateCF}
                  disabled={!editData.gender || !editData.date_of_birth || !editData.place_of_birth || !editData.first_name || !editData.last_name}
                >
                  <Ionicons name="calculator" size={18} color="#fff" />
                  <Text style={styles.calculateCfBtnText}>Calcola</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fieldValue}>{profileData.fiscal_code || '-'}</Text>
            )}
          </View>
        </View>

        {/* Compensation Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Compenso</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Compenso Mensile</Text>
            <Text style={styles.compensationAmount}>
              {profileData.monthly_compensation > 0 
                ? `€ ${profileData.monthly_compensation.toFixed(2)}`
                : 'Non ancora impostato'}
            </Text>
          </View>
          
          {profileData.monthly_compensation > 0 && !profileData.compensation_accepted && (
            <View style={{ marginBottom: 12 }}>
              <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#FF9500' }}>
                <Text style={{ color: '#856404', fontSize: 13, fontWeight: '500' }}>
                  ⚠️ Il tuo compenso mensile richiede accettazione. Clicca il pulsante qui sotto per confermare.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAcceptCompensation}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.acceptButtonText}>Accetta Compenso € {profileData.monthly_compensation.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          )}

          {profileData.compensation_accepted && (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.acceptedBadgeText}>Compenso Accettato</Text>
            </View>
          )}
          
          {/* Link to Compensation Page with Digital Signatures */}
          {profileData.monthly_compensation > 0 && profileData.compensation_accepted && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F3E5F5',
                padding: 14,
                borderRadius: 10,
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#8E44AD',
                borderStyle: 'dashed',
              }}
              onPress={() => router.push('/dirigente/compensation')}
              data-testid="go-to-compensation-btn"
            >
              <Ionicons name="receipt-outline" size={24} color="#8E44AD" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8E44AD' }}>
                  Firma Quietanze Mensili
                </Text>
                <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                  Genera e firma le quietanze dei compensi sportivi
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#8E44AD" />
            </TouchableOpacity>
          )}
        </View>

        {/* I Miei Documenti */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📁 I Miei Documenti</Text>
            {myDocuments.length > 0 && (
              <TouchableOpacity onPress={() => setShowAllDocumentsModal(true)}>
                <Text style={{ color: '#8E44AD', fontSize: 12, fontWeight: '600' }}>
                  {myDocuments.length} totali - Vedi tutti →
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {myDocuments.length === 0 ? (
            <Text style={{ color: '#666', fontStyle: 'italic', paddingVertical: 10 }}>
              Nessun documento firmato
            </Text>
          ) : (
            <>
              {myDocuments.slice(0, 3).map((doc: any, index: number) => (
                <View key={doc.id || index} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: index < Math.min(myDocuments.length, 3) - 1 ? 1 : 0,
                  borderBottomColor: '#f0f0f0',
                }}>
                  <Ionicons 
                    name={doc.document_type === 'privacy_consent' ? 'shield-checkmark' : 
                          doc.document_type?.includes('5000') ? 'alert-circle' :
                          doc.document_type?.includes('15000') ? 'warning' : 'document-text'} 
                    size={24} 
                    color={doc.document_type === 'privacy_consent' ? '#4CAF50' : 
                           doc.document_type?.includes('5000') ? '#FF9800' :
                           doc.document_type?.includes('15000') ? '#F44336' : '#8E44AD'} 
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>
                      {doc.document_title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : ''}
                    </Text>
                  </View>
                  {doc.pdf_filename && (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const token = await AsyncStorage.getItem('token');
                          const downloadUrl = `${API_URL}/api/documents/download/${doc.id}`;
                          
                          if (Platform.OS === 'web') {
                            // Web: Use blob and download link
                            const response = await fetch(downloadUrl, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            
                            if (!response.ok) {
                              Alert.alert('Errore', 'Impossibile aprire il documento');
                              return;
                            }
                            
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            // Open in new tab instead of downloading
                            window.open(url, '_blank');
                          } else {
                            // Mobile: Use expo-file-system and expo-sharing
                            const filename = doc.pdf_filename || `documento_${doc.id}.pdf`;
                            const fileUri = FileSystem.documentDirectory + filename;
                            
                            const downloadResult = await FileSystem.downloadAsync(
                              downloadUrl,
                              fileUri,
                              {
                                headers: { 'Authorization': `Bearer ${token}` }
                              }
                            );
                            
                            if (downloadResult.status !== 200) {
                              Alert.alert('Errore', 'Impossibile scaricare il documento');
                              return;
                            }
                            
                            // Check if sharing is available
                            const isSharingAvailable = await Sharing.isAvailableAsync();
                            if (isSharingAvailable) {
                              await Sharing.shareAsync(downloadResult.uri, {
                                mimeType: 'application/pdf',
                                dialogTitle: 'Apri documento PDF'
                              });
                            } else {
                              Alert.alert('Successo', `Documento salvato in: ${fileUri}`);
                            }
                          }
                        } catch (err) {
                          console.error('Download error:', err);
                          Alert.alert('Errore', 'Apertura non riuscita');
                        }
                      }}
                      style={{ 
                        padding: 10, 
                        backgroundColor: '#00ACC1',
                        borderRadius: 8,
                      }}
                      data-testid={`download-doc-${doc.id}`}
                    >
                      <Ionicons name="eye-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {myDocuments.length > 3 && (
                <TouchableOpacity 
                  onPress={() => setShowAllDocumentsModal(true)}
                  style={{
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderTopColor: '#f0f0f0',
                    marginTop: 8,
                  }}
                  data-testid="view-all-documents-btn"
                >
                  <Text style={{ color: '#8E44AD', fontWeight: '600' }}>
                    + Visualizza altri {myDocuments.length - 3} documenti
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>


        {/* Documento e Dati Bancari */}
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
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editData.id_type}
                  onValueChange={(v) => setEditData({...editData, id_type: v})}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleziona..." value="" />
                  {DOC_TYPES.map((type) => (
                    <Picker.Item key={type} label={type} value={type} />
                  ))}
                </Picker>
              </View>
              
              <Text style={styles.inputLabel}>Numero Documento</Text>
              <TextInput
                style={styles.input}
                value={editData.id_front}
                onChangeText={(v) => setEditData({...editData, id_front: v})}
                placeholder="es. AX1234567"
                placeholderTextColor="#ccc"
              />
              
              <Text style={styles.inputLabel}>Scadenza Documento</Text>
              <TextInput
                style={styles.input}
                value={editData.id_back}
                onChangeText={(v) => {
                  let formatted = v.replace(/[^0-9]/g, '');
                  if (formatted.length > 2) {
                    formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                  }
                  if (formatted.length > 5) {
                    formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                  }
                  setEditData({...editData, id_back: formatted});
                }}
                placeholder="gg/mm/aaaa"
                placeholderTextColor="#ccc"
                maxLength={10}
                keyboardType="numeric"
              />
              
              {/* Foto Documento - Due icone in una riga */}
              <Text style={styles.inputLabel}>Foto Documento</Text>
              <View style={styles.docImagesRow}>
                <TouchableOpacity style={styles.docImageBtnSmall} onPress={() => pickImage('front')}>
                  {(docFrontImage || editData.doc_front_image) ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${docFrontImage || editData.doc_front_image}` }} 
                      style={styles.docImageSmall} 
                    />
                  ) : (
                    <View style={styles.docImagePlaceholderSmall}>
                      <Ionicons name="card-outline" size={24} color="#007AFF" />
                      <Text style={styles.docImageTextSmall}>Fronte</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.docImageBtnSmall} onPress={() => pickImage('back')}>
                  {(docBackImage || editData.doc_back_image) ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${docBackImage || editData.doc_back_image}` }} 
                      style={styles.docImageSmall} 
                    />
                  ) : (
                    <View style={styles.docImagePlaceholderSmall}>
                      <Ionicons name="card-outline" size={24} color="#007AFF" />
                      <Text style={styles.docImageTextSmall}>Retro</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>IBAN</Text>
              <TextInput
                style={styles.input}
                value={editData.iban}
                onChangeText={(v) => setEditData({...editData, iban: v.toUpperCase()})}
                placeholder="es. IT60X0542811101000000123456"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <Text style={styles.inputLabel}>Intestatario Conto</Text>
              <TextInput
                style={styles.input}
                value={editData.account_holder}
                onChangeText={(v) => setEditData({...editData, account_holder: v.toUpperCase()})}
                placeholder="es. MARIO ROSSI"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <Text style={styles.inputLabel}>Nome Banca</Text>
              <TextInput
                style={styles.input}
                value={editData.bank_name}
                onChangeText={(v) => setEditData({...editData, bank_name: v.toUpperCase()})}
                placeholder="es. INTESA SANPAOLO"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <TouchableOpacity
                style={[styles.saveBankButtonFixed, savingBank && styles.saveButtonDisabled]}
                onPress={async () => {
                  setSavingBank(true);
                  try {
                    await api.patch('/users/me/bank-details', {
                      id_type: editData.id_type,
                      id_front: editData.id_front,
                      id_back: editData.id_back,
                      iban: editData.iban,
                      account_holder: editData.account_holder,
                      bank_name: editData.bank_name,
                      doc_front_image: docFrontImage || editData.doc_front_image,
                      doc_back_image: docBackImage || editData.doc_back_image,
                    });
                    setProfileData({
                      ...profileData,
                      id_type: editData.id_type,
                      id_front: editData.id_front,
                      id_back: editData.id_back,
                      iban: editData.iban,
                      account_holder: editData.account_holder,
                      bank_name: editData.bank_name,
                      doc_front_image: docFrontImage || editData.doc_front_image || '',
                      doc_back_image: docBackImage || editData.doc_back_image || '',
                    });
                    setEditingBank(false);
                    showAlert('Salvato', 'Dati bancari aggiornati');
                  } catch (error: any) {
                    showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
                  } finally {
                    setSavingBank(false);
                  }
                }}
                disabled={savingBank}
              >
                <Text style={styles.saveBankButtonText}>
                  {savingBank ? 'Salvataggio...' : '💾 SALVA DATI BANCARI'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tipo Documento</Text>
                <Text style={styles.fieldValue}>{profileData.id_type || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Numero Documento</Text>
                <Text style={styles.fieldValue}>{profileData.id_front || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Scadenza</Text>
                <Text style={styles.fieldValue}>{profileData.id_back || '-'}</Text>
              </View>
              {profileData.doc_front_image && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Documento Fronte</Text>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${profileData.doc_front_image}` }} 
                    style={styles.docImage} 
                  />
                </View>
              )}
              {profileData.doc_back_image && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Documento Retro</Text>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${profileData.doc_back_image}` }} 
                    style={styles.docImage} 
                  />
                </View>
              )}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>IBAN</Text>
                <Text style={styles.fieldValue}>{profileData.iban || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Intestatario</Text>
                <Text style={styles.fieldValue}>{profileData.account_holder || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Banca</Text>
                <Text style={styles.fieldValue}>{profileData.bank_name || '-'}</Text>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Save Button */}
      {editing && (
        <View style={styles.floatingSaveContainer}>
          <TouchableOpacity
            style={[styles.floatingSaveButton, saving && styles.floatingSaveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#fff" />
                <Text style={styles.floatingSaveText}>SALVA MODIFICHE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* GDPR Privacy Modal */}
      <GDPRPrivacyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onSign={(success, documentId) => {
          if (success) {
            handlePrivacySign('');
          }
        }}
        documentType="gdpr_adult"
        signerInfo={{
          name: profileData.first_name || (profileData.full_name?.split(' ').slice(1).join(' ') || ''),
          surname: profileData.last_name || (profileData.full_name?.split(' ')[0] || ''),
          fiscal_code: profileData.fiscal_code || '',
          birth_date: profileData.date_of_birth || '',
          birth_place: profileData.place_of_birth || '',
          address: profileData.address || '',
          city: profileData.city || '',
          province: profileData.province || '',
        }}
      />

      {/* All Documents Modal */}
      <Modal
        visible={showAllDocumentsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAllDocumentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📁 Tutti i Miei Documenti</Text>
              <TouchableOpacity 
                onPress={() => setShowAllDocumentsModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {myDocuments.map((doc: any, index: number) => (
                <View key={doc.id || index} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderBottomWidth: index < myDocuments.length - 1 ? 1 : 0,
                  borderBottomColor: '#f0f0f0',
                }}>
                  <Ionicons 
                    name={doc.document_type === 'privacy_consent' ? 'shield-checkmark' : 
                          doc.document_type?.includes('5000') ? 'alert-circle' :
                          doc.document_type?.includes('15000') ? 'warning' : 'document-text'} 
                    size={24} 
                    color={doc.document_type === 'privacy_consent' ? '#4CAF50' : 
                           doc.document_type?.includes('5000') ? '#FF9800' :
                           doc.document_type?.includes('15000') ? '#F44336' : '#8E44AD'} 
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>
                      {doc.document_title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : ''}
                    </Text>
                  </View>
                  {doc.pdf_filename && (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const token = await AsyncStorage.getItem('token');
                          const downloadUrl = `${API_URL}/api/documents/download/${doc.id}`;
                          
                          if (Platform.OS === 'web') {
                            const response = await fetch(downloadUrl, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            
                            if (!response.ok) {
                              Alert.alert('Errore', 'Impossibile scaricare il documento');
                              return;
                            }
                            
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            // Open in new tab instead of downloading
                            window.open(url, '_blank');
                          } else {
                            const filename = doc.pdf_filename || `documento_${doc.id}.pdf`;
                            const fileUri = FileSystem.documentDirectory + filename;
                            
                            const downloadResult = await FileSystem.downloadAsync(
                              downloadUrl,
                              fileUri,
                              { headers: { 'Authorization': `Bearer ${token}` } }
                            );
                            
                            if (downloadResult.status !== 200) {
                              Alert.alert('Errore', 'Impossibile scaricare il documento');
                              return;
                            }
                            
                            const isSharingAvailable = await Sharing.isAvailableAsync();
                            if (isSharingAvailable) {
                              await Sharing.shareAsync(downloadResult.uri, {
                                mimeType: 'application/pdf',
                                dialogTitle: 'Apri documento PDF'
                              });
                            } else {
                              Alert.alert('Successo', `Documento salvato`);
                            }
                          }
                        } catch (err) {
                          console.error('Download error:', err);
                          Alert.alert('Errore', 'Apertura non riuscita');
                        }
                      }}
                      style={{ 
                        padding: 10, 
                        backgroundColor: '#00ACC1',
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="eye-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#8E44AD',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#F3E5F5',
  },
  editButtonText: {
    color: '#8E44AD',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  // Gender buttons styles
  genderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    width: 48,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  genderBtnTextActive: {
    color: '#fff',
  },
  cfCalculateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calculateCfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    gap: 6,
  },
  calculateCfBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  docImagesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  docImageBtnSmall: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    height: 80,
  },
  docImagePlaceholderSmall: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  docImageTextSmall: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
  },
  docImageSmall: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  docImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: '#f5f5f5',
    marginTop: 8,
  },
  compensationAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8E44AD',
    marginTop: 4,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  acceptedBadgeText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  monthInfo: {
    flex: 1,
  },
  monthLabel: {
    fontSize: 15,
    color: '#333',
  },
  monthActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthCheckboxActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  monthStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    width: 80,
  },
  monthStatusTextPaid: {
    color: '#34C759',
  },
  limitSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  limitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 8,
  },
  limitDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  limitCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    gap: 10,
  },
  limitCheckboxActive: {
    backgroundColor: '#FFEBEE',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FF9500',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  limitCheckboxText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  declarationDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Styles for €15.000 section
  limitSection15k: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  limitCheckbox15kActive: {
    backgroundColor: '#FFEBEB',
    borderColor: '#FF3B30',
  },
  checkbox15kActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  declarationDate15k: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  changePasswordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changePasswordForm: {
    marginTop: 16,
  },
  changePasswordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  changePasswordButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Header buttons row
  headerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  passwordButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  // Change password buttons row
  changePasswordButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelPasswordButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPasswordButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  // Bank save button - GREEN
  saveBankButtonFixed: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  saveBankButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  // Profile photo styles
  profilePhotoContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  profilePhotoLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f0f0f0',
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
  },
  transformingText: {
    color: '#007AFF',
    fontSize: 13,
    marginTop: 10,
    fontStyle: 'italic',
  },
  uploadPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  uploadPhotoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Floating Save Button
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingSaveButton: {
    backgroundColor: '#8E44AD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  floatingSaveButtonDisabled: {
    opacity: 0.6,
  },
  floatingSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles for documents
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollView: {
    padding: 16,
  },
});
