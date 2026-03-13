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

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://cert-management-3.preview.emergentagent.com';

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
  
  // Assigned teams and venues (set by admin)
  const [assignedTeams, setAssignedTeams] = useState<{id: string, name: string}[]>([]);
  const [assignedVenues, setAssignedVenues] = useState<string[]>([]);
  
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
    other_annual_compensation: 0,
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
  
  // Collapsible sections state
  const [sectionsExpanded, setSectionsExpanded] = useState({
    anagrafici: false,
    fiscali: false,
    bancari: false,
  });
  
  const toggleSection = (section: 'anagrafici' | 'fiscali' | 'bancari') => {
    setSectionsExpanded(prev => ({...prev, [section]: !prev[section]}));
  };

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
        other_annual_compensation: data.other_annual_compensation || 0,
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
        other_annual_compensation: data.other_annual_compensation || 0,
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
      
      // Load society name (use ragione_sociale which is the legal full name)
      try {
        const societyRes = await api.get('/settings/society');
        if (societyRes.data?.ragione_sociale) {
          setSocietyName(societyRes.data.ragione_sociale);
        } else if (societyRes.data?.name) {
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
          // Filter only signed documents (with signed_at date)
          const signedDocs = docsRes.data.documents.filter((doc: any) => doc.signed_at);
          setMyDocuments(signedDocs);
        }
      } catch (err) {
        console.log('No documents found');
      }
      
      // Load assigned teams and venues
      try {
        // Get assigned team IDs from user data
        const teamIds = data.assigned_teams || [];
        if (teamIds.length > 0) {
          // Fetch team names
          const teamsRes = await api.get('/teams');
          const allTeams = teamsRes.data || [];
          const assignedTeamsList = allTeams.filter((t: any) => teamIds.includes(t.id));
          setAssignedTeams(assignedTeamsList);
        }
        // Get assigned venues from user data
        setAssignedVenues(data.assigned_venues || []);
      } catch (err) {
        console.log('Error loading assignments');
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
INFORMATIVA PRIVACY PER STAFF
(ai sensi del Regolamento UE 2016/679 - GDPR)

Gentile Collaboratore / Membro dello Staff,
la presente informativa descrive le modalità di trattamento dei dati personali da parte della società sportiva:
${societyName}

Il Titolare del trattamento dei dati personali è la società sportiva sopra indicata nella persona del proprio legale rappresentante pro tempore.

1. TITOLARE DEL TRATTAMENTO
Il Titolare del trattamento dei dati personali è ${societyName}. Per qualsiasi richiesta relativa al trattamento dei dati è possibile contattare la Società tramite i recapiti indicati.

2. FINALITÀ E BASE GIURIDICA DEL TRATTAMENTO
I dati personali saranno trattati per le seguenti finalità: gestione dei rapporti sportivi, associativi o collaborativi con la Società; adempimenti degli obblighi di legge, fiscali e contabili; comunicazioni con enti sportivi di riferimento (Federazioni, EPS, RAS); gestione delle attività sportive, organizzative e amministrative della Società; gestione dei compensi sportivi dilettantistici, ove previsti.

3. TIPOLOGIA DI DATI TRATTATI
La Società potrà trattare le seguenti categorie di dati personali: dati anagrafici (nome, cognome, data e luogo di nascita, codice fiscale); dati di contatto (telefono, email, indirizzo); dati relativi alle attività svolte per la Società; dati amministrativi e fiscali connessi alla gestione dei compensi sportivi dilettantistici.

4. MODALITÀ DI TRATTAMENTO
Il trattamento dei dati avviene mediante strumenti informatici e/o cartacei con modalità idonee a garantire la sicurezza e la riservatezza dei dati personali.

5. PERIODO DI CONSERVAZIONE
I dati personali saranno conservati per tutta la durata del rapporto con la Società e successivamente per il periodo necessario all'adempimento degli obblighi previsti dalla normativa vigente.

6. DIRITTI DELL'INTERESSATO
L'interessato può esercitare i diritti previsti dagli articoli 15–22 del GDPR.

7. FIRMA DIGITALE DEL DOCUMENTO
La sottoscrizione del presente documento avviene in forma digitale tramite l'applicativo gestionale utilizzato dalla Società.

DICHIARAZIONE
Il sottoscritto dichiara di aver letto e compreso la presente informativa e prende atto del trattamento dei dati personali per le finalità indicate.

Staff: ${profileData.full_name || `${editData.last_name} ${editData.first_name}`}
Società sportiva: ${societyName}
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
    const isEstero = editData.country_of_birth && editData.country_of_birth !== 'Italia' && editData.country_of_birth !== 'ITALIA';
    
    if (!editData.first_name || !editData.last_name || !editData.date_of_birth || !editData.gender) {
      showAlert('Dati mancanti', 'Compila Nome, Cognome, Sesso e Data di Nascita per calcolare il CF');
      return;
    }
    
    if (!isEstero && !editData.place_of_birth) {
      showAlert('Dati mancanti', 'Compila il Luogo di Nascita per calcolare il CF');
      return;
    }

    try {
      const luogoNascita = isEstero ? editData.country_of_birth : editData.place_of_birth;
      
      const response = await api.post('/utils/calcola-cf', {
        nome: editData.first_name,
        cognome: editData.last_name,
        data_nascita: editData.date_of_birth,
        luogo_nascita: luogoNascita,
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
              placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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

        {/* Account Info - Compact */}
        <View style={[styles.card, { paddingVertical: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>👤 Account</Text>
            <Text style={{ fontSize: 14, color: '#666' }}>{profileData.email}</Text>
          </View>
        </View>

        {/* Personal Data - Collapsible */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('anagrafici')}
          >
            <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => { setSectionsExpanded(prev => ({...prev, anagrafici: true})); setEditing(true); }}>
                <Ionicons name="create-outline" size={20} color="#8E44AD" />
              </TouchableOpacity>
              <Ionicons 
                name={sectionsExpanded.anagrafici ? "chevron-up" : "chevron-down"} 
                size={24} 
                color="#666" 
              />
            </View>
          </TouchableOpacity>
          
          {sectionsExpanded.anagrafici && (
            <View style={styles.collapsibleContent}>
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
                      onValueChange={(value) => {
                        const updates: any = { country_of_birth: value };
                        if (value !== 'Italia' && value !== 'ITALIA') {
                          updates.place_of_birth = '';
                          updates.province_of_birth = '';
                        }
                        setEditData({...editData, ...updates});
                      }}
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
              
              {(editing ? editData.country_of_birth : profileData.country_of_birth || DEFAULT_COUNTRY) === DEFAULT_COUNTRY && renderField('Luogo di Nascita', profileData.place_of_birth, 'place_of_birth')}
              {(editing ? editData.country_of_birth : profileData.country_of_birth || DEFAULT_COUNTRY) === DEFAULT_COUNTRY && renderField('Provincia di Nascita', profileData.province_of_birth || '', 'province_of_birth')}
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
          )}
        </View>

        {/* Fiscal Data - Collapsible */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('fiscali')}
          >
            <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => { setSectionsExpanded(prev => ({...prev, fiscali: true})); setEditing(true); }}>
                <Ionicons name="create-outline" size={20} color="#8E44AD" />
              </TouchableOpacity>
              <Ionicons 
                name={sectionsExpanded.fiscali ? "chevron-up" : "chevron-down"} 
                size={24} 
                color="#666" 
              />
            </View>
          </TouchableOpacity>
          
          {sectionsExpanded.fiscali && (
            <View style={styles.collapsibleContent}>
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
                      placeholderTextColor="#999"
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
          )}
        </View>

        {/* Compensation Info - Hidden during editing to prevent data loss */}
        {!editing && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Compenso Mensile</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.compensationAmount}>
              {profileData.monthly_compensation > 0 
                ? `€ ${profileData.monthly_compensation.toFixed(2)}`
                : 'Non ancora impostato'}
            </Text>
          </View>
          
          {/* Prior Compensation Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>COMPENSI PREGRESSI (NELL'ANNO)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 18, marginRight: 4 }}>€</Text>
              <TextInput
                style={[styles.input, { flex: 1, paddingVertical: 10, fontSize: 18 }]}
                value={editData.other_annual_compensation?.toString() || '0'}
                onChangeText={(text) => {
                  const numValue = parseFloat(text.replace(',', '.')) || 0;
                  setEditData({...editData, other_annual_compensation: numValue});
                }}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#999"
              />
            </View>
            <Text style={{ fontSize: 11, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
              Inserisci l'importo totale di compensi sportivi già percepiti nell'anno corrente (per il calcolo delle soglie fiscali)
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
                <Text style={styles.acceptButtonText}>Accetta Compenso {formatCurrency(profileData.monthly_compensation)}</Text>
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
                backgroundColor: '#8E44AD',
                padding: 16,
                borderRadius: 12,
                marginTop: 12,
                shadowColor: '#8E44AD',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
                elevation: 5,
              }}
              onPress={() => router.push('/dirigente/compensation')}
              data-testid="go-to-compensation-btn"
            >
              <Ionicons name="receipt-outline" size={24} color="#fff" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
                  Firma Quietanze Mensili
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  Genera e firma le quietanze dei compensi sportivi
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Incarichi Assegnati */}
        {(assignedTeams.length > 0 || assignedVenues.length > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Incarichi Assegnati</Text>
            
            {assignedTeams.length > 0 && (
              <View style={{ marginBottom: assignedVenues.length > 0 ? 16 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="people" size={18} color="#007AFF" />
                  <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#333' }}>Squadre</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {assignedTeams.map((team) => (
                    <View
                      key={team.id}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: '#E3F2FD',
                        borderWidth: 1,
                        borderColor: '#007AFF',
                      }}
                    >
                      <Text style={{ color: '#007AFF', fontWeight: '500', fontSize: 13 }}>{team.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {assignedVenues.length > 0 && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="location" size={18} color="#FF9500" />
                  <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#333' }}>Palestre</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {assignedVenues.map((venue, idx) => (
                    <View
                      key={idx}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: '#FFF3E0',
                        borderWidth: 1,
                        borderColor: '#FF9500',
                      }}
                    >
                      <Text style={{ color: '#E65100', fontWeight: '500', fontSize: 13 }}>{venue}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

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


        {/* Dati Bancari - Collapsible - Hidden while editing main profile to avoid data loss */}
        {!editing && (
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('bancari')}
          >
            <Text style={styles.cardTitle}>🏦 Dati Bancari</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => { setSectionsExpanded(prev => ({...prev, bancari: true})); setEditingBank(true); }}>
                <Ionicons name="create-outline" size={20} color="#8E44AD" />
              </TouchableOpacity>
              <Ionicons 
                name={sectionsExpanded.bancari ? "chevron-up" : "chevron-down"} 
                size={24} 
                color="#666" 
              />
            </View>
          </TouchableOpacity>
          
          {sectionsExpanded.bancari && (
            <View style={styles.collapsibleContent}>
          {editingBank ? (
            <>
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
          )}
        </View>
        )}

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
        onSign={async (success, documentId) => {
          if (success) {
            try {
              // GDPRPrivacyModal already saved the signed document via /documents/sign-gdpr-privacy
              // We just need to update the privacy_accepted flag and save the profile
              await api.patch('/auth/me', {
                privacy_accepted: true,
              });
              setPrivacyAccepted(true);
              setShowPrivacyModal(false);
              // Now save the profile
              await performSave();
              Alert.alert(
                'Privacy Confermata',
                'La tua conferma privacy è stata registrata. Una copia è stata inviata alla tua email e salvata nell\'archivio.',
                [{ text: 'OK' }]
              );
              // Reload profile to get updated data
              await loadProfile();
            } catch (error: any) {
              console.error('Error updating privacy status:', error);
              Alert.alert(
                'Errore',
                error.response?.data?.detail || 'Errore durante l\'aggiornamento. Riprova.'
              );
            }
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
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsibleContent: {
    marginTop: 16,
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
    fontSize: 24,
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
