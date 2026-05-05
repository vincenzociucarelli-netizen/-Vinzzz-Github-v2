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
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import PhotoViewer from '../../src/components/PhotoViewer';
import { GDPRPrivacyModal } from '../../src/components/GDPRPrivacyModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConsentManager } from '../../src/components/ConsentManager';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../src/constants/countries';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://registrateam-vol.preview.emergentagent.com';

const DOC_TYPES = ['Carta Identità', 'Passaporto', 'Patente Auto'];

export default function CoachProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Photo viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState('');
  
  // Collapsible sections state
  const [sectionsExpanded, setSectionsExpanded] = useState({
    anagrafici: false,
    fiscali: false,
    bancari: false,
  });
  
  const toggleSection = (section: 'anagrafici' | 'fiscali' | 'bancari') => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    province_of_birth: '',
    birth_province: '',
    country_of_birth: DEFAULT_COUNTRY,
    gender: '' as '' | 'M' | 'F',
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    coach_license_number: '',
    monthly_compensation: 0,
    other_annual_compensation: 0, // Compensi pregressi da altre società
    compensation_accepted: false,
    contract_start_date: '',
    contract_end_date: '',
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
  const [compensationHistory, setCompensationHistory] = useState({});
  const [signedReceipts, setSignedReceipts] = useState<any[]>([]);
  const [over5000Limit, setOver5000Limit] = useState({});
  const [hasExceeded5000, setHasExceeded5000] = useState(false);
  const [hasExceeded15000, setHasExceeded15000] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  
  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Document images
  const [docFrontImage, setDocFrontImage] = useState(null);
  const [docBackImage, setDocBackImage] = useState(null);
  
  // Profile photo (artistic)
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoArtistic, setProfilePhotoArtistic] = useState(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  
  // Privacy consent state
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showConsents, setShowConsents] = useState(false);
  const [societyName, setSocietyName] = useState('PALLAVOLO PERUGIA SSD A RL');
  
  // My documents (privacy, receipts, etc.)
  const [myDocuments, setMyDocuments] = useState<any[]>([]);
  const [showAllDocumentsModal, setShowAllDocumentsModal] = useState(false);
  
  // Assigned teams
  const [teams, setTeams] = useState<Array<{id: string; name: string}>>([]);

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
        coach_license_number: data.coach_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
        other_annual_compensation: data.other_annual_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        // Documento e Dati Bancari
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
        doc_front_image: data.doc_front_image || '',
        doc_back_image: data.doc_back_image || '',
        contract_start_date: data.contract_start_date || '',
        contract_end_date: data.contract_end_date || '',
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
        coach_license_number: data.coach_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
        other_annual_compensation: data.other_annual_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        // Documento e Dati Bancari
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
      });
      // Load compensation history
      setCompensationHistory(data.compensation_history || {});
      setOver5000Limit(data.over_5000_limit || {});
      // Check if any month has exceeded €5000 or €15000
      const exceeded5000 = data.over_5000_limit && (data.over_5000_limit.exceeded_5000 === true || Object.values(data.over_5000_limit).some((v) => v === true && typeof v === 'boolean'));
      const exceeded15000 = data.over_5000_limit && data.over_5000_limit.exceeded_15000 === true;
      setHasExceeded5000(exceeded5000 || false);
      setHasExceeded15000(exceeded15000 || false);
      // Load profile photo
      setProfilePhoto(data.profile_photo || null);
      setProfilePhotoArtistic(data.profile_photo_artistic || null);
      
      // Load privacy status
      const isPrivacyAccepted = data.privacy_accepted || false;
      // Privacy will be shown when user clicks Save, not automatically
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
        const receiptsRes = await api.get(`/coach/${data.id}/compensation`);
        setSignedReceipts(receiptsRes.data || []);
      } catch (e) {
        console.log('No receipts found');
      }
      
      // Load my signed documents (privacy, receipts, etc.)
      try {
        const docsRes = await api.get('/documents/my-documents');
        const allDocs: any[] = [];
        // Add signed documents
        if (docsRes.data?.documents) {
          allDocs.push(...docsRes.data.documents.filter((doc: any) => doc.signed_at));
        }
        // Add consent records from grouped.personal
        if (docsRes.data?.grouped?.personal) {
          allDocs.push(...docsRes.data.grouped.personal.filter((doc: any) => doc.signed_at));
        }
        // Deduplicate by id and sort newest first
        const seen = new Set<string>();
        const uniqueDocs = allDocs.filter((doc: any) => {
          if (seen.has(doc.id)) return false;
          seen.add(doc.id);
          return true;
        });
        uniqueDocs.sort((a: any, b: any) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime());
        setMyDocuments(uniqueDocs);
      } catch (err) {
        console.log('No documents found');
      }
      
      // Load assigned teams
      try {
        const teamsRes = await api.get('/coach/my-teams');
        setTeams(teamsRes.data || []);
      } catch (err) {
        console.log('Error loading teams:', err);
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

7. ACCETTAZIONE DIGITALE DEL DOCUMENTO
L'accettazione del presente documento avviene tramite l'applicativo gestionale utilizzato dalla Società. Il sistema registra metadati tecnici dell'accettazione (data, ora, identificativo utente, dispositivo, IP) ai fini della tracciabilità e sicurezza.

DICHIARAZIONE
Il sottoscritto dichiara di aver preso visione dell'informativa sulla privacy ai sensi del Regolamento UE 2016/679 e prende atto del trattamento dei propri dati personali.

Staff: ${profileData.full_name || `${editData.last_name} ${editData.first_name}`}
Società sportiva: ${societyName}
      `.trim();

      await api.post('/documents/sign', {
        document_type: 'privacy_consent',
        document_title: 'Consenso Privacy Coach',
        document_text: privacyText,
        signer_name: profileData.full_name || `${editData.last_name} ${editData.first_name}`,
        signer_email: user?.email || '',
        signature_base64: signatureBase64,
        related_entity_id: user?.id,
        additional_data: {
          role: 'coach',
          fiscal_code: profileData.fiscal_code
        }
      });
      
      // Also update privacy_accepted flag in user profile
      await api.patch('/auth/me', {
        privacy_accepted: true,
      });
      
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
      
      // Reload profile to get updated data
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
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  const pickImage = async (side) => {
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

  // Generate contract months based on coach's contract dates
  const getContractMonths = () => {
    const months: {key: string, label: string}[] = [];
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    // Use contract dates if available
    const startDate = profileData.contract_start_date ? new Date(profileData.contract_start_date) : null;
    const endDate = profileData.contract_end_date ? new Date(profileData.contract_end_date) : null;
    
    if (startDate && endDate) {
      // Generate months from contract start to end
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      
      while (current <= end) {
        const monthIndex = current.getMonth();
        const year = current.getFullYear();
        months.push({
          key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
          label: `${monthNames[monthIndex]} ${year}`,
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Fallback to season months (July to June)
      const now = new Date();
      const currentYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      for (let i = 0; i < 12; i++) {
        const monthIndex = (6 + i) % 12;
        const year = monthIndex >= 6 ? currentYear : currentYear + 1;
        months.push({
          key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
          label: `${monthNames[monthIndex]} ${year}`,
        });
      }
    }
    return months;
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const showAlert = (title, message, onOk) => {
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
        luogo_nascita: isEstero ? (editData.place_of_birth || editData.country_of_birth) : editData.place_of_birth,
        sesso: editData.gender,
        stato_nascita: editData.country_of_birth || 'Italia',
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
    
    // If privacy not yet accepted, save profile first then show privacy modal
    if (!privacyAccepted) {
      setSaving(true);
      try {
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
          coach_license_number: editData.coach_license_number,
          other_annual_compensation: editData.other_annual_compensation || 0,
        });
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
        setSaving(false);
        return;
      }
      setSaving(false);
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
        coach_license_number: editData.coach_license_number,
        other_annual_compensation: editData.other_annual_compensation || 0,
      });
      
      showAlert('Successo', 'Profilo aggiornato con successo');
      setEditing(false);
      await loadProfile();
    } catch (error) {
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
    } catch (error) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
    }
  };

  const handleToggleMonth = async (monthKey) => {
    const newHistory = { ...compensationHistory };
    newHistory[monthKey] = !newHistory[monthKey];
    setCompensationHistory(newHistory);
    
    try {
      await api.patch('/auth/me', { compensation_history: newHistory });
    } catch (error) {
      // Revert on error
      setCompensationHistory(compensationHistory);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleToggle5000Limit = async () => {
    const newValue = !hasExceeded5000;
    
    // Se si sta attivando, chiedi conferma
    if (newValue) {
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      const confirmMsg = `ATTENZIONE: Stai dichiarando di aver superato il limite di €5.000 nell'anno solare.\n\nLa data di oggi (${dateStr}) verrà memorizzata e rimarrà visibile all'amministratore.\n\nConfermi?`;
      
      const confirmAction = Platform.OS === 'web'
        ? window.confirm(confirmMsg)
        : await new Promise((resolve) => {
            Alert.alert(
              'Conferma Dichiarazione',
              confirmMsg,
              [
                { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confermo', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (!confirmAction) return;
    }
    
    setHasExceeded5000(newValue);
    
    const now = new Date();
    const newLimit = { ...over5000Limit };
    
    if (newValue) {
      newLimit.exceeded_5000 = true;
      newLimit.exceeded_5000_date = now.toISOString();
    } else {
      newLimit.exceeded_5000 = false;
    }
    
    setOver5000Limit(newLimit);
    
    try {
      await api.patch('/auth/me', { over_5000_limit: newLimit });
      if (newValue) {
        showAlert('Registrato', 'La tua dichiarazione è stata memorizzata. Da ora dovrai versare i contributi INPS.');
      }
    } catch (error) {
      setHasExceeded5000(!newValue);
      setOver5000Limit(over5000Limit);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleToggle15000Limit = async () => {
    const newValue = !hasExceeded15000;
    
    // Se si sta attivando, chiedi conferma
    if (newValue) {
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      const confirmMsg = `ATTENZIONE: Stai dichiarando di aver superato il limite di €15.000 nell'anno solare.\n\nLa data di oggi (${dateStr}) verrà memorizzata e rimarrà visibile all'amministratore.\n\nOltre ai contributi INPS, sarà dovuta anche l'IRPEF sulla parte eccedente.\n\nConfermi?`;
      
      const confirmAction = Platform.OS === 'web'
        ? window.confirm(confirmMsg)
        : await new Promise((resolve) => {
            Alert.alert(
              'Conferma Dichiarazione',
              confirmMsg,
              [
                { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confermo', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (!confirmAction) return;
    }
    
    setHasExceeded15000(newValue);
    
    const now = new Date();
    const newLimit = { ...over5000Limit };
    
    if (newValue) {
      newLimit.exceeded_15000 = true;
      newLimit.exceeded_15000_date = now.toISOString();
      // Se supera 15k, automaticamente ha superato anche 5k
      if (!newLimit.exceeded_5000) {
        newLimit.exceeded_5000 = true;
        newLimit.exceeded_5000_date = now.toISOString();
        setHasExceeded5000(true);
      }
    } else {
      newLimit.exceeded_15000 = false;
    }
    
    setOver5000Limit(newLimit);
    
    try {
      await api.patch('/auth/me', { over_5000_limit: newLimit });
      if (newValue) {
        showAlert('Registrato', 'La tua dichiarazione è stata memorizzata. Sarà dovuta IRPEF sulla parte eccedente i €15.000.');
      }
    } catch (error) {
      setHasExceeded15000(!newValue);
      setOver5000Limit(over5000Limit);
      showAlert('Errore', 'Errore durante il salvataggio');
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
    } catch (error) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Auto-format date as GG/MM/AAAA
  const formatDateInputAuto = (text: string) => {
    const numbers = text.replace(/\D/g, '');
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 2);
    }
    if (numbers.length > 2) {
      formatted += '/' + numbers.substring(2, 4);
    }
    if (numbers.length > 4) {
      formatted += '/' + numbers.substring(4, 8);
    }
    return formatted;
  };

  const renderField = (label: string, value: string, key: string, editable = true) => {
    // Special handling for date_of_birth field
    const isDateField = key === 'date_of_birth';
    // Province fields should be max 2 characters
    const isProvinceField = key.toLowerCase().includes('province') || key.toLowerCase().includes('provincia');
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}{isDateField && editing ? ' (GG/MM/AAAA)' : ''}{isProvinceField && editing ? ' (2 lettere)' : ''}</Text>
        {editing && editable ? (
          <TextInput
            style={styles.input}
            value={editData[key]?.toString() || ''}
            onChangeText={(text) => {
              if (isDateField) {
                setEditData({ ...editData, [key]: formatDateInputAuto(text) });
              } else if (isProvinceField) {
                // Limita a 2 caratteri per le province
                setEditData({ ...editData, [key]: text.toUpperCase().slice(0, 2) });
              } else {
                setEditData({ ...editData, [key]: text.toUpperCase() });
              }
            }}
            autoCapitalize={isDateField ? 'none' : 'characters'}
            keyboardType={isDateField ? 'number-pad' : 'default'}
            maxLength={isDateField ? 10 : isProvinceField ? 2 : undefined}
            placeholder={isDateField ? '01/01/1990' : isProvinceField ? 'es. PG' : undefined}
            placeholderTextColor="#999"
          />
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/coach'))}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: editing ? 100 : 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
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
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSave}
                  disabled={saving}
                >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Salvataggio...' : 'Salva'}
                </Text>
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
                <Ionicons name="create-outline" size={20} color="#007AFF" />
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
              {(editing ? editData.country_of_birth : profileData.country_of_birth || DEFAULT_COUNTRY) === DEFAULT_COUNTRY && renderField('Provincia di Nascita', profileData.province_of_birth, 'province_of_birth')}
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

              {/* Dati Fiscali - integrati nella sezione anagrafici */}
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 12 }}>Dati Fiscali</Text>
              </View>

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
                    {Platform.OS === 'web' ? (
                      <div
                        onClick={() => {
                          if (editData.gender && editData.date_of_birth && editData.first_name && editData.last_name) {
                            handleCalculateCF();
                          }
                        }}
                        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: (!editData.gender || !editData.date_of_birth || !editData.first_name || !editData.last_name) ? '#ccc' : '#4CAF50', paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 8, cursor: 'pointer' }}
                        data-testid="calculate-cf-btn"
                      >
                        <Ionicons name="calculator" size={18} color="#fff" />
                        <Text style={styles.calculateCfBtnText}>Calcola</Text>
                      </div>
                    ) : (
                      <TouchableOpacity 
                        style={styles.calculateCfBtn}
                        onPress={handleCalculateCF}
                        disabled={!editData.gender || !editData.date_of_birth || !editData.first_name || !editData.last_name}
                      >
                        <Ionicons name="calculator" size={18} color="#fff" />
                        <Text style={styles.calculateCfBtnText}>Calcola</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <Text style={styles.fieldValue}>{profileData.fiscal_code || '-'}</Text>
                )}
              </View>

              {renderField('N° Tesserino Allenatore', profileData.coach_license_number, 'coach_license_number')}
            </View>
          )}
        </View>

        {/* Compensation Info */}
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
                style={[styles.inputField, { flex: 1, paddingVertical: 10, fontSize: 18 }]}
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

          {/* Link to Compensation Page with Receipts */}
          {profileData.monthly_compensation > 0 && profileData.compensation_accepted && (
            <TouchableOpacity
              style={styles.compensationLinkButton}
              onPress={() => router.push('/coach/compensation')}
              data-testid="compensation-receipts-btn"
            >
              <Ionicons name="document-text" size={22} color="#fff" />
              <Text style={styles.compensationLinkText}>Quietanze Mensili</Text>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Squadre Assegnate */}
          {teams.length > 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#FF9800' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#E65100', marginBottom: 8 }}>🏐 Squadre Assegnate</Text>
              {teams.map((team) => (
                <TouchableOpacity 
                  key={team.id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                  onPress={() => router.push(`/coach/team/${team.id}`)}
                >
                  <Text style={{ fontSize: 13, color: '#333' }}>• </Text>
                  <Text style={{ fontSize: 13, color: '#1565C0', textDecorationLine: 'underline' }}>{team.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* I Miei Documenti */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📁 I Miei Documenti</Text>
            {myDocuments.length > 0 && (
              <TouchableOpacity onPress={() => setShowAllDocumentsModal(true)}>
                <Text style={{ color: '#007AFF', fontSize: 12, fontWeight: '600' }}>
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
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const token = await AsyncStorage.getItem('token');
                        const downloadUrl = `${API_URL}/api/documents/signed/${doc.id}/pdf`;
                        
                        if (Platform.OS === 'web') {
                          const response = await fetch(downloadUrl, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          
                          if (!response.ok) {
                            let errMsg = 'Impossibile aprire il documento';
                            if (response.status === 401) {
                              errMsg = 'Sessione scaduta. Effettua nuovamente il login.';
                            } else {
                              try {
                                const errData = await response.json();
                                if (errData?.detail) errMsg = errData.detail;
                              } catch {}
                            }
                            Alert.alert('Errore', errMsg);
                            return;
                          }
                          
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          // Use anchor download to bypass mobile popup blockers
                          const filename = `${doc.document_title || 'documento'}.pdf`.replace(/[^\w.\-]+/g, '_');
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          a.target = '_blank';
                          a.rel = 'noopener noreferrer';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => window.URL.revokeObjectURL(url), 1500);
                        }
                      } catch (err) {
                        console.error('Download error:', err);
                        Alert.alert('Errore', 'Apertura non riuscita');
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, textDecoration: 'none' }}
                    data-testid={`open-doc-${doc.id}`}
                  >
                  <Ionicons 
                    name={doc.document_type === 'privacy_consent' ? 'shield-checkmark' : 
                          doc.document_type?.includes('5000') ? 'alert-circle' :
                          doc.document_type?.includes('15000') ? 'warning' : 'document-text'} 
                    size={24} 
                    color={doc.document_type === 'privacy_consent' ? '#4CAF50' : 
                           doc.document_type?.includes('5000') ? '#FF9800' :
                           doc.document_type?.includes('15000') ? '#F44336' : '#007AFF'} 
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>
                      {doc.document_title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : ''}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color="#007AFF" />
                  </a>
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
                  <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                    + Visualizza altri {myDocuments.length - 3} documenti
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Dati Bancari - Collapsible */}
        {!editing && (
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('bancari')}
          >
            <Text style={styles.cardTitle}>🏦 Dati Bancari</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {!sectionsExpanded.bancari && (
                <TouchableOpacity onPress={() => { toggleSection('bancari'); setEditingBank(true); }}>
                  <Ionicons name="create" size={20} color="#007AFF" />
                </TouchableOpacity>
              )}
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
                    placeholderTextColor="#999"
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
                  
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      style={{ flex: 1, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' }}
                      onPress={() => setEditingBank(false)}
                    >
                      <Text style={{ color: '#666' }}>Annulla</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[{ flex: 2, padding: 12, backgroundColor: '#34C759', borderRadius: 8, alignItems: 'center' }, savingBank && { opacity: 0.6 }]}
                      onPress={async () => {
                        setSavingBank(true);
                        try {
                          await api.patch('/users/me/bank-details', {
                            iban: editData.iban,
                            account_holder: editData.account_holder,
                            bank_name: editData.bank_name,
                          });
                          setProfileData({
                            ...profileData,
                            iban: editData.iban,
                            account_holder: editData.account_holder,
                            bank_name: editData.bank_name,
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
                      <Text style={{ color: '#fff', fontWeight: '600' }}>
                        {savingBank ? 'Salvataggio...' : '💾 Salva'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>IBAN</Text>
                      <Text style={styles.fieldValue}>{profileData.iban || '-'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditingBank(true)}>
                      <Ionicons name="create" size={20} color="#007AFF" />
                    </TouchableOpacity>
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

          {/* Privacy Consent Management - solo dopo firma privacy */}
          {privacyAccepted && (
            <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity 
                onPress={() => setShowConsents(!showConsents)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E3F2FD', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#1565C0' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1565C0' }}>Consensi Privacy</Text>
                <Ionicons name={showConsents ? "chevron-up" : "chevron-down"} size={20} color="#1565C0" />
              </TouchableOpacity>
              {showConsents && <ConsentManager entityType="staff" accentColor="#1565C0" />}
            </View>
          )}

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Save Button when editing */}
      {editing && (
        <View style={styles.floatingSaveContainer}>
          <TouchableOpacity
            style={[styles.floatingSaveButton, saving && styles.floatingSaveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
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
          birth_place: profileData.place_of_birth || profileData.country_of_birth || '',
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
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const token = await AsyncStorage.getItem('token');
                        const downloadUrl = `${API_URL}/api/documents/signed/${doc.id}/pdf`;
                        if (Platform.OS === 'web') {
                          const response = await fetch(downloadUrl, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          if (!response.ok) {
                            let errMsg = 'Impossibile aprire il documento';
                            if (response.status === 401) {
                              errMsg = 'Sessione scaduta. Effettua nuovamente il login.';
                            } else {
                              try {
                                const errData = await response.json();
                                if (errData?.detail) errMsg = errData.detail;
                              } catch {}
                            }
                            Alert.alert('Errore', errMsg);
                            return;
                          }
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const filename = `${doc.document_title || 'documento'}.pdf`.replace(/[^\w.\-]+/g, '_');
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          a.target = '_blank';
                          a.rel = 'noopener noreferrer';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => window.URL.revokeObjectURL(url), 1500);
                        }
                      } catch (err) {
                        console.error('Download error:', err);
                        Alert.alert('Errore', 'Apertura non riuscita');
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, textDecoration: 'none' }}
                    data-testid={`open-modal-doc-${doc.id}`}
                  >
                  <Ionicons 
                    name={doc.document_type === 'privacy_consent' ? 'shield-checkmark' : 
                          doc.document_type?.includes('5000') ? 'alert-circle' :
                          doc.document_type?.includes('15000') ? 'warning' : 'document-text'} 
                    size={24} 
                    color={doc.document_type === 'privacy_consent' ? '#4CAF50' : 
                           doc.document_type?.includes('5000') ? '#FF9800' :
                           doc.document_type?.includes('15000') ? '#F44336' : '#007AFF'} 
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>
                      {doc.document_title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : ''}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color="#007AFF" />
                  </a>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Photo Viewer for documents */}
      <PhotoViewer
        visible={photoViewerVisible}
        photo={selectedPhoto}
        title={selectedPhotoTitle}
        onClose={() => setPhotoViewerVisible(false)}
      />
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
    backgroundColor: '#007AFF',
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
    backgroundColor: '#E8F4FD',
  },
  editButtonText: {
    color: '#007AFF',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  imageUploadBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageUploadPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageUploadText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
  },
  docImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
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
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 70,
  },
  picker: {
    height: 70,
  },
  saveBankButtonFixed: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBankButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
    paddingBottom: 8,
  },
  collapsibleContent: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
  // Document images styles for view mode
  docImagesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  docImageWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  docImageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  docImagePreview: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  docImagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docImagePlaceholderText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  tapToEnlarge: {
    fontSize: 10,
    color: '#007AFF',
    marginTop: 4,
    textAlign: 'center',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusAccepted: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextAccepted: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57C00',
  },
  compensationAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
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
  compensationLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  compensationLinkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
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
  // Tax Table Styles
  taxTableSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  taxTableTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  taxTableSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  taxTable: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  taxTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  taxTableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  taxTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  taxTableRowActive: {
    backgroundColor: '#E3F2FD',
  },
  taxTableCell: {
    flex: 1,
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
  },
  taxCellGreen: {
    color: '#34C759',
    fontWeight: '600',
  },
  taxCellRed: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  taxCellOrange: {
    color: '#FF9500',
    fontWeight: '600',
  },
  taxTableNote: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  // Limit Section Styles
  limitSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    marginTop: 20,
  },
  limitCheckboxContent: {
    flex: 1,
  },
  limitCheckboxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  limitCheckboxDesc: {
    fontSize: 12,
    color: '#666',
  },
  limitCheckbox5000Active: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  limitCheckbox15000Active: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  checkbox5000Active: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  checkbox15000Active: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
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
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Floating save button styles
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
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
  // Modal styles
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
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
