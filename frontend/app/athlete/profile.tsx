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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import PhotoViewer from '../../src/components/PhotoViewer';
import { GDPRPrivacyModal } from '../../src/components/GDPRPrivacyModal';
import { TrialEndModal } from '../../src/components/TrialEndModal';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../src/constants/countries';
import { ConsentManager } from '../../src/components/ConsentManager';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
const DOC_TYPES = ['Carta Identità', 'Passaporto', 'Patente Auto'];

export default function AthleteProfile() {
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
  
  // Trial and Privacy state
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTrialEndModal, setShowTrialEndModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showConsents, setShowConsents] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [societyName, setSocietyName] = useState('PALLAVOLO PERUGIA SSD A RL');
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [isAdult, setIsAdult] = useState(false);
  const [isQuotaAthlete, setIsQuotaAthlete] = useState(true); // true if athlete pays quota, false if compensated
  
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
    athlete_license_number: '',
    monthly_compensation: 0,
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
  
  // Collapsible sections state
  const [sectionsExpanded, setSectionsExpanded] = useState({
    anagrafici: false,
    fiscali: false,
    bancari: false,
  });
  
  const toggleSection = (section: 'anagrafici' | 'fiscali' | 'bancari') => {
    setSectionsExpanded(prev => ({...prev, [section]: !prev[section]}));
  };
  
  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Versione Lite state
  const [liteEnabled, setLiteEnabled] = useState(false);
  const [nomeLite, setNomeLite] = useState('');
  const [showNomeLiteModal, setShowNomeLiteModal] = useState(false);
  const [nomeLiteInput, setNomeLiteInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [savingLite, setSavingLite] = useState(false);
  
  // Document images
  const [docFrontImage, setDocFrontImage] = useState(null);
  const [docBackImage, setDocBackImage] = useState(null);
  
  // Profile photo (artistic)
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoArtistic, setProfilePhotoArtistic] = useState(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  
  // Note: Trial and privacy state is declared above

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
        athlete_license_number: data.athlete_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
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
        athlete_license_number: data.athlete_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
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
      // Load profile photo (athletes use athlete_photo, users use profile_photo)
      setProfilePhoto(data.athlete_photo || data.profile_photo || null);
      setProfilePhotoArtistic(data.athlete_photo_artistic || data.profile_photo_artistic || null);
      
      // Store athlete_id
      setAthleteId(data.athlete_id || data.id);
      
      // Load Lite access info
      setNomeLite(data.nome_lite || '');
      setLiteEnabled(data.minor_access_enabled || false);
      
      // Check if athlete is quota type (pays fees) vs compensated (receives payment)
      setIsQuotaAthlete(data.athlete_type !== 'compensated');
      
      // Load society name
      try {
        const societyRes = await api.get('/settings/society');
        if (societyRes.data?.name) {
          setSocietyName(societyRes.data.name);
        }
      } catch (e) {
        console.log('Using default society name');
      }
      
      // Check if athlete is adult (18+)
      let isAdultAthlete = false;
      if (data.date_of_birth) {
        const dob = new Date(data.date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        isAdultAthlete = age >= 18;
        setIsAdult(isAdultAthlete);
      }
      
      // Check trial status
      const isPrivacyAccepted = data.privacy_accepted || false;
      setPrivacyAccepted(isPrivacyAccepted);
      
      // Check trial expiration for adult athletes
      if (isAdultAthlete) {
        const trialEnd = data.trial_end_date;
        if (trialEnd) {
          const trialEndDateObj = new Date(trialEnd);
          const now = new Date();
          const isExpired = now > trialEndDateObj;
          
          setTrialEndDate(trialEndDateObj.toLocaleDateString('it-IT'));
          setTrialExpired(isExpired);
          
          // If trial expired and privacy not accepted, show trial end modal
          if (isExpired && !isPrivacyAccepted) {
            setTimeout(() => setShowTrialEndModal(true), 500);
          }
        }
      }
      
      // Load signed receipts
      try {
        const athleteIdForReceipts = data.athlete_id || data.id;
        const receiptsRes = await api.get(`/athletes/${athleteIdForReceipts}/compensation/receipts`);
        setSignedReceipts(receiptsRes.data || []);
      } catch (e) {
        console.log('No receipts found');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle privacy signature for adult athletes
  const handlePrivacySign = async (signatureBase64: string) => {
    try {
      // Generate privacy document with signature using /documents/sign endpoint
      const privacyText = `
INFORMATIVA SULLA PRIVACY E CONSENSO AL TRATTAMENTO DEI DATI PERSONALI

Il/La sottoscritto/a ${profileData.full_name || `${profileData.last_name} ${profileData.first_name}`}, nato/a a ${profileData.place_of_birth || ''} il ${profileData.date_of_birth || ''}, residente in ${profileData.address || ''}, ${profileData.city || ''} (${profileData.province || ''}), C.F. ${profileData.fiscal_code || ''},

DICHIARA

di aver letto e compreso l'informativa ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR) relativa al trattamento dei propri dati personali da parte di ${societyName} e

ACCONSENTE

al trattamento dei propri dati personali per le finalità connesse alla propria attività di Atleta presso la società sportiva, inclusa la comunicazione a terzi per finalità strettamente connesse all'attività sportiva.
      `.trim();

      await api.post('/documents/sign', {
        document_type: 'privacy_consent',
        document_title: 'Consenso Privacy Atleta',
        document_text: privacyText,
        signer_name: profileData.full_name || `${profileData.last_name} ${profileData.first_name}`,
        signer_email: user?.email || profileData.email || '',
        signature_base64: signatureBase64,
        related_entity_id: athleteId,
        additional_data: {
          role: 'athlete',
          fiscal_code: profileData.fiscal_code
        }
      });
      
      // Also update privacy_accepted flag in athlete profile
      await api.patch('/auth/me', {
        privacy_accepted: true,
      });
      
      // Update local state
      setPrivacyAccepted(true);
      setShowPrivacyModal(false);
      setShowTrialEndModal(false);
      
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

  // Generate contract months based on athlete's contract dates
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

  const formatDate = (dateStr) => {
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
        luogo_nascita: luogoNascita,
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
        athlete_license_number: editData.athlete_license_number,
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

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        new_password: newPassword,
      });
      showAlert('Successo', 'Password cambiata con successo!');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Versione Lite handlers
  const handleSaveNomeLite = async () => {
    const nome = nomeLiteInput.trim();
    if (nome.length < 3) {
      showAlert('Errore', 'Il nome lite deve avere almeno 3 caratteri');
      return;
    }
    setSavingLite(true);
    try {
      const res = await api.post(`/athletes/${athleteId}/set-nome-lite`, { nome_lite: nome });
      setNomeLite(res.data.nome_lite);
      setShowNomeLiteModal(false);
      showAlert('Successo', `Nome Lite impostato: ${res.data.nome_lite}`);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingLite(false);
    }
  };

  const handleSavePin = async () => {
    const pin = pinInput.trim();
    if (!pin.match(/^\d{4,6}$/)) {
      showAlert('Errore', 'Il PIN deve essere composto da 4 a 6 cifre');
      return;
    }
    setSavingLite(true);
    try {
      await api.post(`/athletes/${athleteId}/set-minor-pin`, { pin });
      setLiteEnabled(true);
      setShowPinModal(false);
      setPinInput('');
      showAlert('Successo', 'PIN impostato! Ora puoi accedere alla Versione Lite.');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingLite(false);
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
    const isProvinceField = key === 'province' || key === 'province_of_birth' || key === 'birth_province';
    
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
            maxLength={isDateField ? 10 : (isProvinceField ? 2 : undefined)}
            placeholder={isDateField ? '01/01/1990' : (isProvinceField ? 'es. PG' : undefined)}
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
        <TouchableOpacity onPress={() => router.back()}>
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
                <Text style={styles.fieldLabel}>Nuova Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    placeholder="Minimo 6 caratteri"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    data-testid="new-password-input"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={{ padding: 10, marginLeft: -40 }}
                    data-testid="toggle-new-password"
                  >
                    <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={22} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Conferma Nuova Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Ripeti la nuova password"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    data-testid="confirm-password-input"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ padding: 10, marginLeft: -40 }}
                    data-testid="toggle-confirm-password"
                  >
                    <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.changePasswordButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelPasswordButton}
                  onPress={() => {
                    setShowChangePassword(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                >
                  <Text style={styles.cancelPasswordButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.changePasswordButton, changingPassword && styles.buttonDisabled]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                  data-testid="change-password-submit"
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

        {/* Personal & Fiscal Data - Unified Card */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('anagrafici')}
          >
            <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => { setSectionsExpanded(prev => ({...prev, anagrafici: true, fiscali: true})); setEditing(true); }}>
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
                    <TouchableOpacity 
                      style={styles.calculateCfBtn}
                      onPress={handleCalculateCF}
                      disabled={!editData.gender || !editData.date_of_birth || !editData.first_name || !editData.last_name || ((!editData.country_of_birth || editData.country_of_birth === 'Italia' || editData.country_of_birth === 'ITALIA') && !editData.place_of_birth)}
                    >
                      <Ionicons name="calculator" size={18} color="#fff" />
                      <Text style={styles.calculateCfBtnText}>Calcola</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.fieldValue}>{profileData.fiscal_code || '-'}</Text>
                )}
              </View>

              {!isQuotaAthlete && renderField('N° Tesserino', profileData.athlete_license_number, 'athlete_license_number')}
            </View>
          )}
        </View>

        {/* Compensation Info - Only show for compensated athletes */}
        {!isQuotaAthlete && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Compenso Mensile</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.compensationAmount}>
              {profileData.monthly_compensation > 0 
                ? `€ ${profileData.monthly_compensation.toFixed(2)}`
                : 'Non ancora impostato'}
            </Text>
          </View>
          
          {profileData.monthly_compensation > 0 && !profileData.compensation_accepted && (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptCompensation}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>Accetta Compenso</Text>
            </TouchableOpacity>
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
              onPress={() => router.push('/athlete/compensation')}
              data-testid="compensation-receipts-btn"
            >
              <Ionicons name="document-text" size={20} color="#007AFF" />
              <Text style={styles.compensationLinkText}>Quietanze Mensili</Text>
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Registro Quietanze Compatto - Only show for compensated athletes */}
        {!isQuotaAthlete && profileData.monthly_compensation > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Registro Quietanze</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {(() => {
                // Find first month where each threshold was exceeded PER YEAR
                const sortedReceipts = [...signedReceipts]
                  .filter(r => r.receipt_signed)
                  .sort((a, b) => {
                    if (a.year !== b.year) return a.year - b.year;
                    return a.month - b.month;
                  });
                
                // Track thresholds PER YEAR (they reset each calendar year)
                const thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } } = {};
                
                for (const r of sortedReceipts) {
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
                
                const isAfterThreshold = (yearInt: number, monthInt: number, type: '5k' | '15k') => {
                  const yearThresholds = thresholdsByYear[yearInt];
                  if (!yearThresholds) return false;
                  const thresholdMonth = type === '5k' ? yearThresholds.first5k : yearThresholds.first15k;
                  if (thresholdMonth === null) return false;
                  // Only highlight months in the SAME year that are >= threshold month
                  return monthInt >= thresholdMonth;
                };
                
                return getContractMonths().map((month) => {
                  const [year, monthNum] = month.key.split('-');
                  const yearInt = parseInt(year);
                  const monthInt = parseInt(monthNum);
                  const receipt = signedReceipts.find(r => r.year === yearInt && r.month === monthInt);
                  const isSigned = receipt?.receipt_signed === true;
                  
                  // Check if THIS is the threshold month (for badge)
                  const isThreshold5k = receipt?.exceeded_5000 === true;
                  const isThreshold15k = receipt?.exceeded_15000 === true;
                  
                  // Check if month is AFTER threshold IN SAME YEAR (for highlighting)
                  const isAfter5k = isSigned && isAfterThreshold(yearInt, monthInt, '5k');
                  const isAfter15k = isSigned && isAfterThreshold(yearInt, monthInt, '15k');
                  
                  // Check if month is in the future
                  const now = new Date();
                  const currentYearActual = now.getFullYear();
                  const currentMonthActual = now.getMonth() + 1;
                  const isFuture = (yearInt > currentYearActual) || 
                                   (yearInt === currentYearActual && monthInt > currentMonthActual);
                  
                  return (
                    <View 
                      key={month.key} 
                      style={{
                        backgroundColor: isAfter15k ? '#FFF3E0' : isAfter5k ? '#FFF8E1' : isSigned ? '#E8F5E9' : isFuture ? '#FAFAFA' : '#F5F5F5',
                        borderRadius: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderWidth: isAfter15k ? 2 : isAfter5k ? 2 : isSigned ? 2 : 1,
                        borderColor: isAfter15k ? '#E65100' : isAfter5k ? '#F9A825' : isSigned ? '#4CAF50' : isFuture ? '#E8E8E8' : '#E0E0E0',
                        minWidth: 85,
                        alignItems: 'center',
                        opacity: isFuture ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: isFuture ? '#AAA' : '#666', fontWeight: '500' }}>
                        {month.label.split(' ')[0].substring(0, 3)} {month.label.split(' ')[1]}
                      </Text>
                      {isThreshold15k ? (
                        <Text style={{ fontSize: 11, color: '#E65100', fontWeight: 'bold' }}>&gt;15K</Text>
                      ) : isThreshold5k ? (
                        <Text style={{ fontSize: 11, color: '#F9A825', fontWeight: 'bold' }}>&gt;5K</Text>
                      ) : (
                        <Text style={{ fontSize: 12, color: isSigned ? (isAfter15k ? '#E65100' : isAfter5k ? '#F9A825' : '#2E7D32') : isFuture ? '#CCC' : '#999', fontWeight: '600' }}>
                          {isSigned ? '✓' : isFuture ? '○' : '-'}
                        </Text>
                      )}
                    </View>
                  );
                });
              })()}
            </View>
          </View>
        )}

        {/* Versione Lite Section */}
        <View style={styles.card} data-testid="lite-access-section">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="phone-portrait" size={24} color="#007AFF" />
            <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>Versione Lite</Text>
          </View>
          
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 18 }}>
            Accedi a una versione semplificata con QR code, presenze e orari. Dalla schermata di login, seleziona "Accesso Atleta" e inserisci il Nome Lite e il PIN.
          </Text>

          {/* Nome Lite */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10 }}>
            <View>
              <Text style={{ fontSize: 13, color: '#555' }}>Nome Lite:</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 2 }}>{nomeLite || 'Non impostato'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setNomeLiteInput(nomeLite); setShowNomeLiteModal(true); }}
              style={{ backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              data-testid="set-nome-lite-btn"
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                {nomeLite ? 'Modifica' : 'Imposta'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* PIN */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10 }}>
            <View>
              <Text style={{ fontSize: 13, color: '#555' }}>PIN di accesso:</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: liteEnabled ? '#34C759' : '#FF9500', marginTop: 2 }}>
                {liteEnabled ? 'Attivo' : 'Non impostato'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { setPinInput(''); setShowPinModal(true); }}
              style={{ backgroundColor: liteEnabled ? '#34C759' : '#FF9500', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              data-testid="set-pin-btn"
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                {liteEnabled ? 'Cambia PIN' : 'Imposta PIN'}
              </Text>
            </TouchableOpacity>
          </View>

          {liteEnabled && nomeLite ? (
            <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#2E7D32', textAlign: 'center' }}>
                Accesso Lite attivo! Usa "{nomeLite}" + PIN per accedere.
              </Text>
            </View>
          ) : null}
        </View>

          {/* Privacy Consent Management - collassabile */}
          <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
            <TouchableOpacity 
              onPress={() => setShowConsents(!showConsents)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#4CAF50' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7D32' }}>Consensi Privacy</Text>
              <Ionicons name={showConsents ? "chevron-up" : "chevron-down"} size={20} color="#2E7D32" />
            </TouchableOpacity>
            {showConsents && <ConsentManager entityType="athlete" entityId={athleteId || undefined} accentColor="#4CAF50" />}
          </View>

        <View style={{ height: 120 }} />
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

      {/* Photo Viewer for documents */}
      <PhotoViewer
        visible={photoViewerVisible}
        photo={selectedPhoto}
        title={selectedPhotoTitle}
        onClose={() => setPhotoViewerVisible(false)}
      />

      {/* Trial End Modal (for adult athletes whose trial has expired) */}
      {isAdult && (
        <TrialEndModal
          visible={showTrialEndModal}
          onAcceptPrivacy={() => {
            setShowTrialEndModal(false);
            // Show medical certificate alert first, then privacy modal
            Alert.alert(
              'Certificato Medico Richiesto',
              'Per continuare come atleta tesserato, dovrai consegnare alla società un certificato medico di idoneità sportiva in corso di validità.',
              [{ text: 'Ho capito, procedi', onPress: () => setShowPrivacyModal(true) }]
            );
          }}
          onDeleteData={async () => {
            setDeletingData(true);
            try {
              await api.delete('/auth/delete-my-data');
              Alert.alert(
                'Dati Eliminati',
                'Tutti i tuoi dati sono stati cancellati. Verrai reindirizzato alla pagina di login.',
                [{ text: 'OK', onPress: async () => {
                  await logout();
                  if (Platform.OS === 'web') {
                    window.location.href = '/login';
                  } else {
                    router.replace('/login');
                  }
                }}]
              );
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Impossibile eliminare i dati. Riprova.');
            } finally {
              setDeletingData(false);
            }
          }}
          signerName={profileData.full_name || `${profileData.first_name} ${profileData.last_name}`}
          signerRole="athlete"
          trialEndDate={trialEndDate || undefined}
          deleting={deletingData}
        />
      )}

      {/* GDPR Privacy Modal (only for athletes 18+) */}
      {isAdult && (
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
            birth_place: profileData.place_of_birth || profileData.country_of_birth || '',
            address: profileData.address || '',
            city: profileData.city || '',
            province: profileData.province || '',
          }}
        />
      )}

      {/* Modal: Nome Lite */}
      {showNomeLiteModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 360 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 }}>Imposta Nome Lite</Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Scegli un nome unico per accedere alla Versione Lite (min 3, max 20 caratteri).</Text>
            <TextInput
              value={nomeLiteInput}
              onChangeText={setNomeLiteInput}
              placeholder="Es: MarioR"
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 }}
              maxLength={20}
              data-testid="nome-lite-input"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowNomeLiteModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' }}
              >
                <Text style={{ color: '#666', fontWeight: '600' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNomeLite}
                disabled={savingLite}
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#007AFF', alignItems: 'center', opacity: savingLite ? 0.6 : 1 }}
                data-testid="save-nome-lite-btn"
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{savingLite ? 'Salvataggio...' : 'Salva'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal: PIN */}
      {showPinModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 360 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 }}>Imposta PIN</Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Inserisci un PIN numerico da 4 a 6 cifre per l'accesso alla Versione Lite.</Text>
            <TextInput
              value={pinInput}
              onChangeText={(t) => setPinInput(t.replace(/\D/g, ''))}
              placeholder="Es: 1234"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 20, textAlign: 'center', letterSpacing: 8, marginBottom: 16 }}
              data-testid="pin-input"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowPinModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' }}
              >
                <Text style={{ color: '#666', fontWeight: '600' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSavePin}
                disabled={savingLite}
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#34C759', alignItems: 'center', opacity: savingLite ? 0.6 : 1 }}
                data-testid="save-pin-btn"
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{savingLite ? 'Salvataggio...' : 'Salva'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
  },
  collapsibleContent: {
    marginTop: 16,
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
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 10,
  },
  compensationLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
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
});
