import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Modal,
  RefreshControl,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Picker } from '@react-native-picker/picker';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { GDPRPrivacyModal } from '../../../src/components/GDPRPrivacyModal';
import SignaturePadInline, { SignaturePadInlineRef } from '../../../src/components/SignaturePadInline';
import { Athlete, Certificate, Payment, PaymentSettings, Team } from '../../../src/types';
import { format, differenceInDays, addMonths, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuthStore } from '../../../src/store/authStore';
import { SportIcon } from '../../../src/components/SportIcon';
import CodiceFiscale from 'codice-fiscale-js';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../../src/constants/countries';

import { formatCurrency, formatAmount } from '../../../src/utils/formatCurrency';

// --- Certificate Date Form Component ---
function CertificateDateForm({ athleteId, certificate, onSaved }: { athleteId?: string, certificate: any, onSaved: () => void }) {
  const [issueDate, setIssueDate] = useState(certificate?.issue_date ? format(new Date(certificate.issue_date), 'dd/MM/yyyy') : '');
  const [validityMonths, setValidityMonths] = useState(certificate?.validity_months?.toString() || '');
  const [calculatedExpiry, setCalculatedExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '';
    if (digits.length > 0) formatted = digits.substring(0, 2);
    if (digits.length > 2) formatted += '/' + digits.substring(2, 4);
    if (digits.length > 4) formatted += '/' + digits.substring(4, 8);
    return formatted;
  };

  useEffect(() => {
    if (issueDate && validityMonths) {
      const parts = issueDate.split('/');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        const dt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const months = parseInt(validityMonths) || 0;
        if (!isNaN(dt.getTime()) && months > 0) {
          const expiry = subDays(addMonths(dt, months), 1);
          setCalculatedExpiry(format(expiry, 'dd/MM/yyyy'));
          return;
        }
      }
    }
    setCalculatedExpiry('');
  }, [issueDate, validityMonths]);

  const handleSave = async () => {
    if (!athleteId || !issueDate || !calculatedExpiry) return;
    const parts = issueDate.split('/');
    const issueDt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const expiryParts = calculatedExpiry.split('/');
    const expiryDt = new Date(parseInt(expiryParts[2]), parseInt(expiryParts[1]) - 1, parseInt(expiryParts[0]));
    
    setSaving(true);
    try {
      await api.post('/certificates/simple', {
        athlete_id: athleteId,
        issue_date: issueDt.toISOString(),
        expiry_date: expiryDt.toISOString(),
      });
      if (Platform.OS === 'web') window.alert('Certificato salvato!');
      else Alert.alert('Successo', 'Certificato salvato!');
      setShowForm(false);
      onSaved();
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Errore nel salvataggio';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Errore', msg);
    } finally {
      setSaving(false);
    }
  };

  if (!showForm) {
    if (certificate) {
      // Certificate exists: small subtle link to modify
      return (
        <TouchableOpacity
          style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 }}
          onPress={() => setShowForm(true)}
          data-testid="modify-certificate-dates-btn"
        >
          <Ionicons name="create-outline" size={16} color="#7B1FA2" />
          <Text style={{ color: '#7B1FA2', fontSize: 13, fontWeight: '500' }}>Modifica date certificato</Text>
        </TouchableOpacity>
      );
    }
    // No certificate: purple banner
    return (
      <TouchableOpacity
        style={{ 
          backgroundColor: '#EDE7F6', borderRadius: 10, padding: 12, marginTop: 12, 
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderWidth: 1, borderColor: '#CE93D8',
        }}
        onPress={() => setShowForm(true)}
        data-testid="insert-certificate-dates-btn"
      >
        <Ionicons name="calendar-outline" size={18} color="#7B1FA2" />
        <Text style={{ color: '#7B1FA2', fontWeight: '600', fontSize: 14 }}>
          Inserisci dati certificato
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ marginTop: 12, backgroundColor: '#F5F8FF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#BBDEFB' }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1565C0', marginBottom: 12 }}>Date Certificato Medico</Text>
      
      {/* Data Emissione */}
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4 }}>Data Emissione</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 12, color: issueDate ? '#000' : '#aaa' }}
        placeholder="gg/mm/aaaa"
        placeholderTextColor="#ccc"
        value={issueDate}
        onChangeText={(text) => setIssueDate(formatDateInput(text))}
        keyboardType="numeric"
        maxLength={10}
        data-testid="cert-issue-date-input"
      />
      
      {/* Mesi di validità */}
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4 }}>Mesi di Validità</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 12, color: validityMonths ? '#000' : '#aaa' }}
        placeholder="0"
        placeholderTextColor="#ccc"
        value={validityMonths}
        onChangeText={setValidityMonths}
        keyboardType="numeric"
        maxLength={2}
        data-testid="cert-validity-months-input"
      />
      
      {/* Scadenza calcolata - sempre visibile */}
      <View style={{ backgroundColor: calculatedExpiry ? '#E8F5E9' : '#F5F5F5', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="calendar" size={18} color={calculatedExpiry ? '#2E7D32' : '#bbb'} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: calculatedExpiry ? '#2E7D32' : '#bbb' }}>
          Scadenza: {calculatedExpiry || 'gg/mm/aaaa'}
        </Text>
      </View>
      
      {/* Bottoni */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' }}
          onPress={() => setShowForm(false)}
        >
          <Text style={{ fontWeight: '600', color: '#333' }}>Annulla</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: calculatedExpiry ? '#1565C0' : '#90CAF9', borderRadius: 8, padding: 12, alignItems: 'center', opacity: calculatedExpiry ? 1 : 0.6 }}
          onPress={handleSave}
          disabled={!calculatedExpiry || saving}
          data-testid="cert-save-btn"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontWeight: '600', color: '#fff' }}>Salva</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AthleteDetail() {
  const router = useRouter();
  const { id, tab } = useLocalSearchParams();
  const { user, logout } = useAuthStore();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [teamSchedule, setTeamSchedule] = useState<{
    training_sessions: any[];
    match_day: any;
  } | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  // Certificate states
  const [certIssueDateParent, setCertIssueDateParent] = useState('');
  const [certValidityMonthsParent, setCertValidityMonthsParent] = useState('12');
  const [savingCertParent, setSavingCertParent] = useState(false);
  const [societyEmail, setSocietyEmail] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [certIssueDate, setCertIssueDate] = useState('');
  const [certValidityMonths, setCertValidityMonths] = useState('12');
  
  // Data protection password states
  const [dataUnlocked, setDataUnlocked] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [checkingPassword, setCheckingPassword] = useState(false);
  // Data password reset via email
  const [dataPwResetStep, setDataPwResetStep] = useState<'idle' | 'code_sent' | 'sending'>('idle');
  const [dataPwResetCode, setDataPwResetCode] = useState('');
  const [dataPwResetNewPw, setDataPwResetNewPw] = useState('');
  const [dataPwResetError, setDataPwResetError] = useState('');
  
  // Parent profile data for GDPR signing
  const [parentProfile, setParentProfile] = useState<any>(null);
  
  // Edit mode states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    fiscal_code: '',
    birth_place: '',
    birth_province: '',
    country_of_birth: 'Italia',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone_athlete: '',
    phone_father: '',
    phone_mother: '',
    email: '',
    second_parent_email: '',
    tax_payer_last_name: '',
    tax_payer_first_name: '',
    tax_payer_fiscal_code: '',
    team_id: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Teams list for team selection
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Coach info for team
  const [coachInfo, setCoachInfo] = useState<any>(null);
  const [coachPhotoModalVisible, setCoachPhotoModalVisible] = useState(false);
  
  // Certificate viewing modal
  const [viewCertModalVisible, setViewCertModalVisible] = useState(false);
  
  // Athlete photo states
  const [athletePhoto, setAthletePhoto] = useState<string | null>(null);
  
  // Fiscal receipt state
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const [paymentsListExpanded, setPaymentsListExpanded] = useState(false);
  const paymentsRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [athletePhotoArtistic, setAthletePhotoArtistic] = useState<string | null>(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  
  // Collapsible sections state (matching adult profile structure)
  const [sectionsExpanded, setSectionsExpanded] = useState({
    anagrafici: false,
    fiscali: false,
  });
  const toggleSection = (section: 'anagrafici' | 'fiscali') => {
    setSectionsExpanded(prev => ({...prev, [section]: !prev[section]}));
  };
  
  // QR Code ref for sharing
  const qrCodeRef = useRef<View>(null);

  // Minor access control states
  const [minorAccessEnabled, setMinorAccessEnabled] = useState(false);
  const [minorHasPin, setMinorHasPin] = useState(false);
  const [minorAthleteCode, setMinorAthleteCode] = useState('');
  const [minorPinModalVisible, setMinorPinModalVisible] = useState(false);
  const [minorNewPin, setMinorNewPin] = useState('');
  const [minorConfirmPin, setMinorConfirmPin] = useState('');
  const [savingMinorPin, setSavingMinorPin] = useState(false);
  const [customCodeModalVisible, setCustomCodeModalVisible] = useState(false);
  const [nomeLiteModalVisible, setNomeLiteModalVisible] = useState(false);
  const [nomeLiteInput, setNomeLiteInput] = useState('');
  const [customCode, setCustomCode] = useState('');

  // Trial period states
  const [trialStatus, setTrialStatus] = useState<any>(null);
  const [downloadingTrialDoc, setDownloadingTrialDoc] = useState(false);
  const [profileCheck, setProfileCheck] = useState<any>(null);
  const [showTrialSignModal, setShowTrialSignModal] = useState(false);
  const [trialSignature, setTrialSignature] = useState<string | null>(null);
  const [signingTrialDoc, setSigningTrialDoc] = useState(false);
  const trialSignatureRef = useRef<SignaturePadInlineRef>(null);

  // End trial flow states
  const [endTrialStatus, setEndTrialStatus] = useState<any>(null);
  const [requestingEndTrial, setRequestingEndTrial] = useState(false);
  const [showEndTrialChoice, setShowEndTrialChoice] = useState(false);
  const [deletionCheck, setDeletionCheck] = useState<any>(null);
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);

  // Helper function for alerts
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadData = async () => {
    try {
      const [athleteRes, paymentsRes, teamsRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/payments/${id}`),
        api.get(`/teams`),
      ]);

      setAthlete(athleteRes.data);
      setPayments(paymentsRes.data);
      setTeams(teamsRes.data);
      
      // Load athlete photo
      setAthletePhoto(athleteRes.data.athlete_photo || null);
      setAthletePhotoArtistic(athleteRes.data.athlete_photo_artistic || null);

      // Load coach info for the athlete's team - get ALL coaches
      if (athleteRes.data.team_id) {
        try {
          const coachRes = await api.get(`/teams/${athleteRes.data.team_id}/coach`);
          if (coachRes.data) {
            setCoachInfo(coachRes.data);
          }
        } catch (e) {
          console.log('Could not load coach info');
        }
      }

      // Check if athlete has data password
      try {
        const passwordRes = await api.get(`/athletes/${id}/has-password`);
        setHasPassword(passwordRes.data.has_password);
        // If no password is set, data is automatically unlocked
        if (!passwordRes.data.has_password) {
          setDataUnlocked(true);
        }
      } catch (error) {
        setHasPassword(false);
        setDataUnlocked(true);
      }

      // Try to load certificate
      try {
        const certRes = await api.get(`/certificates/${id}`);
        setCertificate(certRes.data);
      } catch (error) {
        setCertificate(null);
      }

      // Load society email and name for certificate info
      try {
        const settingsRes = await api.get('/settings/society');
        setSocietyEmail(settingsRes.data?.email || '');
        setSocietyName(settingsRes.data?.name || '');
      } catch (error) {
        console.log('Could not load society info');
      }

      // Load payment info from team - store full response with dynamic installments
      try {
        const paymentInfoRes = await api.get(`/teams/${athleteRes.data.team_id}/payment-info`);
        setPaymentSettings(paymentInfoRes.data);
      } catch (error) {
        setPaymentSettings(null);
      }
      
      // Load team schedule (trainings and match day) from team data
      try {
        const teamData = teamsRes.data.find((t: any) => t.id === athleteRes.data.team_id);
        if (teamData) {
          setTeamSchedule({
            training_sessions: teamData.training_sessions || [],
            match_day: teamData.match_day || null,
          });
        }
      } catch (error) {
        setTeamSchedule(null);
      }

      // Load parent profile for GDPR signing
      try {
        const parentRes = await api.get('/auth/me');
        setParentProfile(parentRes.data);
      } catch (error) {
        console.log('Could not load parent profile');
      }

      // Load minor access status
      try {
        const minorStatusRes = await api.get(`/athletes/${id}/minor-access-status`);
        setMinorAccessEnabled(minorStatusRes.data.minor_access_enabled || false);
        setMinorHasPin(minorStatusRes.data.has_pin || false);
        setMinorAthleteCode(minorStatusRes.data.athlete_code || '');
      } catch (error) {
        console.log('Could not load minor access status');
      }

      // Load trial status
      try {
        const trialRes = await api.get(`/athletes/${id}/trial-status`);
        setTrialStatus(trialRes.data);
      } catch (error) {
        console.log('Could not load trial status');
      }

      // Load profile completeness check
      try {
        const profileRes = await api.get(`/athletes/${id}/profile-check`);
        setProfileCheck(profileRes.data);
      } catch (error) {
        console.log('Could not load profile check');
      }

      // Load end-trial status
      try {
        const endTrialRes = await api.get(`/athletes/${id}/end-trial-status`);
        setEndTrialStatus(endTrialRes.data);
      } catch (error) {
        console.log('Could not load end-trial status');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati dell\'atleta');
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Auto-scroll to payments section when tab=payments
  useEffect(() => {
    if (tab === 'payments' && athlete && paymentsRef.current && scrollViewRef.current) {
      setTimeout(() => {
        (paymentsRef.current as any)?.measureLayout?.(
          (scrollViewRef.current as any)?.getInnerViewNode?.(),
          (_x: number, y: number) => {
            (scrollViewRef.current as any)?.scrollTo?.({ y, animated: true });
          },
          () => {}
        );
      }, 500);
    }
  }, [tab, athlete]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Password verification function
  const handleVerifyPassword = async () => {
    if (!enteredPassword) {
      setPasswordError('Inserisci la password');
      return;
    }
    
    setCheckingPassword(true);
    setPasswordError('');
    
    try {
      const response = await api.post(`/athletes/${id}/verify-password`, {
        password: enteredPassword
      });
      
      if (response.data.verified) {
        setDataUnlocked(true);
        setPasswordModalVisible(false);
        setEnteredPassword('');
      } else {
        setPasswordError('Password non corretta');
      }
    } catch (error: any) {
      setPasswordError(error.response?.data?.detail || 'Errore verifica password');
    } finally {
      setCheckingPassword(false);
    }
  };

  // Request data password reset via email
  const handleRequestDataPwReset = async () => {
    if (!id) return;
    setDataPwResetStep('sending');
    setDataPwResetError('');
    try {
      await api.post('/auth/request-data-password-reset', { athlete_id: id });
      setDataPwResetStep('code_sent');
      setPasswordModalVisible(false);
      setEnteredPassword('');
      setPasswordError('');
    } catch (error: any) {
      setDataPwResetError(error.response?.data?.detail || 'Errore invio codice');
      setDataPwResetStep('idle');
    }
  };

  // Confirm data password reset with code
  const handleConfirmDataPwReset = async () => {
    if (!dataPwResetCode || !dataPwResetNewPw || !id) return;
    try {
      await api.post('/auth/confirm-data-password-reset', {
        athlete_id: id,
        verification_code: dataPwResetCode,
        new_password: dataPwResetNewPw,
      });
      const msg = 'Password dati aggiornata con successo!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Successo', msg);
      setDataPwResetStep('idle');
      setDataPwResetCode('');
      setDataPwResetNewPw('');
      setDataPwResetError('');
    } catch (error: any) {
      setDataPwResetError(error.response?.data?.detail || 'Errore verifica codice');
    }
  };


  // Download Fiscal Receipt
  const handleDownloadFiscalReceipt = async () => {
    if (!athlete) return;
    
    setGeneratingReceipt(true);
    try {
      const response = await api.get(`/payments/${id}/fiscal-receipt`);
      const receiptData = response.data;
      
      // Dynamic import for jspdf
      const { downloadFiscalReceipt } = await import('../../../src/utils/fiscalReceipt');
      
      downloadFiscalReceipt(receiptData);
      
      if (Platform.OS !== 'web') {
        Alert.alert('✅ Successo', 'Ricevuta fiscale scaricata');
      }
    } catch (error: any) {
      console.error('Error generating receipt:', error);
      const errorMessage = error.response?.data?.detail || 'Errore durante la generazione della ricevuta';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Errore', errorMessage);
      }
    } finally {
      setGeneratingReceipt(false);
    }
  };

  // Logout function
  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert(
        'Logout',
        'Sei sicuro di voler uscire?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
    }
  };

  // Data is always visible, but editing is locked until password verified
  // maskData is no longer used to hide data - data is always shown
  const maskData = (data: string | null | undefined): string => {
    if (!data) return '-';
    return data;  // Always show data - no masking
  };

  const handleUploadCertificate = async () => {
    // On web, use different approach
    if (Platform.OS === 'web') {
      // On web, go directly to gallery selection
      pickImage('gallery');
      return;
    }
    
    // On mobile, show options: camera or gallery
    Alert.alert(
      'Carica Certificato',
      'Come vuoi caricare il certificato medico?',
      [
        {
          text: 'Scatta Foto',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Scegli dalla Galleria',
          onPress: () => pickImage('gallery'),
        },
        {
          text: 'Annulla',
          style: 'cancel',
        },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      
      if (source === 'camera') {
        // Request camera permission
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permesso Negato', 'È necessario il permesso per usare la fotocamera');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,  // Disabled editing - direct upload
          quality: 0.7,
          base64: true,
        });
      } else {
        // Request gallery permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permesso Negato', 'È necessario il permesso per accedere alla galleria');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,  // Disabled editing - direct upload
          quality: 0.7,
          base64: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const image = result.assets[0];
      console.log('Image picked, has base64:', !!image.base64);
      
      // Set default issue date to today
      const today = new Date();
      const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      
      setSelectedFile({
        uri: image.uri,
        base64: image.base64,  // Store base64 directly
        name: 'certificato_medico.jpg',
        type: 'image',
      });
      setCertIssueDate(formattedDate);
      setCertValidityMonths('12');
      setCertModalVisible(true);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  // Formatta automaticamente la data con le /
  const formatDateInput = (text: string) => {
    // Rimuovi tutto tranne i numeri
    const numbers = text.replace(/[^\d]/g, '');
    
    // Applica il formato GG/MM/AAAA
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

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text);
    setCertIssueDate(formatted);
  };

  const calculateExpiryDate = (dateStr: string, months: string) => {
    // Formula corretta: Scadenza = (Data emissione + mesi di validità) - 1 giorno
    // Esempio: emissione 15/12/2025 + 12 mesi - 1 giorno = 14/12/2026
    const parts = dateStr.split('/');
    const monthsNum = parseInt(months) || 0;
    if (parts.length === 3 && monthsNum > 0) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      const issueDate = new Date(year, month, day);
      
      // Prima aggiungi i mesi, poi sottrai 1 giorno
      const expiryDate = subDays(addMonths(issueDate, monthsNum), 1);
      return format(expiryDate, 'dd/MM/yyyy', { locale: it });
    }
    return '';
  };

  const printQRCode = async () => {
    if (!athlete) return;
    
    try {
      // Get QR code - handle both data URI and base64
      let qrCodeSrc = athlete.qr_code || '';
      
      // If QR code is empty, show error
      if (!qrCodeSrc) {
        Alert.alert('Errore', 'QR Code non disponibile');
        return;
      }
      
      // If it's already a data URI, use it directly
      // If it's just base64, add the prefix
      if (!qrCodeSrc.startsWith('data:')) {
        qrCodeSrc = `data:image/png;base64,${qrCodeSrc}`;
      }
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>QR Code - ${athlete.full_name}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 40px;
                background: white;
              }
              h1 { font-size: 28px; margin-bottom: 10px; color: #333; }
              h2 { font-size: 18px; color: #666; margin-bottom: 30px; }
              .qr-container {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                margin: 20px auto;
              }
              .qr-image { 
                width: 280px; 
                height: 280px; 
                border: 2px solid #ddd;
                padding: 10px;
                background: white;
              }
              .athlete-code {
                margin-top: 15px;
                font-size: 16px;
                font-weight: bold;
                color: #333;
                background: #f5f5f5;
                padding: 8px 16px;
                border-radius: 4px;
              }
              p { margin-top: 25px; font-size: 14px; color: #666; }
              @media print {
                body { padding: 20px; }
                .qr-image { width: 250px; height: 250px; }
              }
            </style>
          </head>
          <body>
            <h1>${athlete.full_name}</h1>
            <h2>QR Code Atleta</h2>
            <div class="qr-container">
              <img class="qr-image" src="${qrCodeSrc}" alt="QR Code" />
              <div class="athlete-code">Codice: ${athlete.qr_identifier || athlete.athlete_code || athlete.id}</div>
            </div>
            <p>Presentare questo codice all'allenatore per registrare la presenza</p>
          </body>
        </html>
      `;
      
      // On web, open print dialog directly
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };
        } else {
          Alert.alert('Errore', 'Popup bloccato. Abilita i popup per stampare.');
        }
      } else {
        // Mobile: use expo-print
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Errore stampa:', error);
      Alert.alert('Errore', 'Impossibile stampare il QR code. Riprova.');
    }
  };

  const shareQRCode = async () => {
    if (!athlete) return;
    
    try {
      // Get QR code source
      let qrCodeSrc = athlete.qr_code || '';
      
      if (!qrCodeSrc) {
        Alert.alert('Errore', 'QR Code non disponibile');
        return;
      }
      
      // Ensure it's a proper data URI
      if (!qrCodeSrc.startsWith('data:')) {
        qrCodeSrc = `data:image/png;base64,${qrCodeSrc}`;
      }
      
      // On web, use different approach
      if (Platform.OS === 'web') {
        try {
          // Convert data URI to blob
          const response = await fetch(qrCodeSrc);
          const blob = await response.blob();
          const file = new File([blob], `qr_${athlete.full_name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
          
          // Check if Web Share API is available
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `QR Code - ${athlete.full_name}`,
              text: `QR Code per ${athlete.full_name}`,
              files: [file]
            });
          } else {
            // Fallback: download the image
            const link = document.createElement('a');
            link.href = qrCodeSrc;
            link.download = `qr_${athlete.full_name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Alert.alert('Download completato', 'Il QR code è stato scaricato');
          }
        } catch (webError) {
          console.error('Web share error:', webError);
          // Fallback to download
          const link = document.createElement('a');
          link.href = qrCodeSrc;
          link.download = `qr_${athlete.full_name.replace(/\s+/g, '_')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          Alert.alert('Download completato', 'Il QR code è stato scaricato');
        }
        return;
      }
      
      // Mobile: Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Errore', 'La condivisione non è disponibile su questo dispositivo');
        return;
      }
      
      // Try to capture the QR code view
      if (qrCodeRef.current) {
        try {
          const uri = await captureRef(qrCodeRef.current, {
            format: 'png',
            quality: 1,
          });
          
          // Share the captured image
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `QR Code - ${athlete.full_name}`,
          });
        } catch (captureError) {
          console.error('Errore cattura:', captureError);
          
          // Fallback: save and share the QR code directly
          let base64Data = qrCodeSrc;
          if (base64Data.startsWith('data:')) {
            base64Data = base64Data.split(',')[1];
          }
          
          const fileUri = FileSystem.cacheDirectory + `qr_${athlete.id}.png`;
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: `QR Code - ${athlete.full_name}`,
          });
        }
      }
    } catch (error) {
      console.error('Errore condivisione:', error);
      Alert.alert('Errore', 'Impossibile condividere il QR code. Riprova.');
    }
  };

  // Print certificate function (works on mobile and web)
  const printCertificate = async () => {
    if (!certificate?.pdf_data) {
      Alert.alert('Errore', 'Certificato non disponibile');
      return;
    }

    try {
      let certData = certificate.pdf_data;
      let mimeType = 'image/jpeg';
      
      // Detect mime type from data URI
      if (certData.startsWith('data:')) {
        const match = certData.match(/^data:([^;]+);base64,/);
        if (match) {
          mimeType = match[1];
        }
        certData = certData.split(',')[1] || certData;
      }

      const expiryFormatted = certificate?.expiry_date 
        ? format(new Date(certificate.expiry_date), 'dd/MM/yyyy', { locale: it })
        : 'N/D';

      // Create HTML for printing - single page, no extra margins
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Certificato Medico - ${athlete?.full_name}</title>
            <style>
              @page { 
                margin: 10mm; 
                size: A4;
              }
              * { 
                margin: 0; 
                padding: 0; 
                box-sizing: border-box; 
              }
              html, body { 
                height: 100%;
                width: 100%;
              }
              body { 
                font-family: Arial, sans-serif; 
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                padding: 5mm;
              }
              h1 { 
                font-size: 16px; 
                margin-bottom: 5px; 
                color: #333; 
              }
              .info { 
                font-size: 11px; 
                color: #666; 
                margin-bottom: 10px; 
              }
              .cert-container {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
              }
              .cert-image { 
                max-width: 100%; 
                max-height: 250mm;
                object-fit: contain;
                border: 1px solid #ddd;
              }
            </style>
          </head>
          <body>
            <h1>Certificato Medico</h1>
            <p class="info">${athlete?.full_name} - Scadenza: ${expiryFormatted}</p>
            <div class="cert-container">
              <img class="cert-image" src="data:${mimeType};base64,${certData}" />
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        // Web: open in new window and print
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        // Mobile: use expo-print
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Errore stampa certificato:', error);
      Alert.alert('Errore', 'Impossibile stampare il certificato. Riprova.');
    }
  };

  // Share certificate function
  const shareCertificate = async () => {
    if (!certificate?.pdf_data) {
      Alert.alert('Errore', 'Certificato non disponibile');
      return;
    }

    try {
      let certData = certificate.pdf_data;
      let extension = 'jpg';
      let mimeType = 'image/jpeg';
      
      // Detect file type and extract base64 data
      if (certData.startsWith('data:')) {
        if (certData.includes('image/png')) {
          extension = 'png';
          mimeType = 'image/png';
        } else if (certData.includes('application/pdf')) {
          extension = 'pdf';
          mimeType = 'application/pdf';
        } else if (certData.includes('image/jpeg') || certData.includes('image/jpg')) {
          extension = 'jpg';
          mimeType = 'image/jpeg';
        }
        // Remove data URI prefix
        const base64Index = certData.indexOf(',');
        if (base64Index !== -1) {
          certData = certData.substring(base64Index + 1);
        }
      }

      // Validate base64 data
      if (!certData || certData.length < 100) {
        Alert.alert('Errore', 'Dati del certificato non validi');
        return;
      }

      if (Platform.OS === 'web') {
        // Web: download file
        try {
          const byteCharacters = atob(certData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `certificato_${athlete?.full_name?.replace(/\s+/g, '_') || 'atleta'}.${extension}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (e) {
          Alert.alert('Errore', 'Impossibile scaricare il certificato');
        }
      } else {
        // Mobile: use expo-sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('Errore', 'La condivisione non è disponibile su questo dispositivo');
          return;
        }

        // Save to temp file
        const fileName = `certificato_${athlete?.full_name?.replace(/\s+/g, '_') || 'atleta'}_${Date.now()}.${extension}`;
        const fileUri = FileSystem.cacheDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, certData, {
          encoding: 'base64' as any,
        });

        // Verify file was created
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          Alert.alert('Errore', 'Impossibile creare il file temporaneo');
          return;
        }

        // Share the file
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          dialogTitle: `Certificato Medico - ${athlete?.full_name}`,
          UTI: extension === 'pdf' ? 'com.adobe.pdf' : `public.${extension}`,
        });
      }
    } catch (error: any) {
      console.error('Errore condivisione certificato:', error);
      Alert.alert('Errore', `Impossibile condividere il certificato: ${error.message || 'Riprova.'}`);
    }
  };

  // Helper function to get team name by id
  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Squadra non trovata';
  };

  const convertToISODate = (dateStr: string) => {
    // Converti da GG/MM/AAAA a YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const submitCertificate = async () => {
    if (!selectedFile) {
      Alert.alert('Errore', 'Nessun file selezionato');
      return;
    }

    if (!selectedFile.base64) {
      Alert.alert('Errore', 'Impossibile leggere l\'immagine');
      return;
    }

    if (certIssueDate.length !== 10) {
      Alert.alert('Errore', 'Inserisci una data di emissione valida');
      return;
    }

    const validityNum = parseInt(certValidityMonths);
    if (isNaN(validityNum) || validityNum <= 0) {
      Alert.alert('Errore', 'Inserisci una validità valida in mesi');
      return;
    }

    setUploadingCert(true);
    try {
      // Use the base64 directly from ImagePicker
      const base64Content = selectedFile.base64;
      console.log('Base64 content length:', base64Content?.length);

      // Convert date to ISO format
      const isoDate = convertToISODate(certIssueDate);
      console.log('ISO Date:', isoDate);

      // Send to backend using the base64 endpoint with JSON body
      const response = await api.post('/certificates/upload-base64', {
        athlete_id: id as string,
        issue_date: isoDate,
        validity_months: validityNum,
        pdf_base64: base64Content,
      });

      Alert.alert('Successo', 'Certificato caricato con successo');
      setCertModalVisible(false);
      setSelectedFile(null);
      await loadData();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il caricamento del certificato');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleAcceptPrivacy = async () => {
    // Now handled by GDPRPrivacyModal onSign callback
  };

  const handleGDPRPrivacySigned = async (success: boolean, documentId?: string) => {
    if (success) {
      try {
        const isEndTrialFlow = endTrialStatus?.end_trial_requested;
        if (isEndTrialFlow) {
          // End-trial flow: only set privacy, let backend auto-activate if all steps done
          const response = await api.patch(`/athletes/${id}`, {
            privacy_accepted: true,
            image_consent: true,
          });
          setPrivacyModalVisible(false);
          setPrivacyConfirmed(false);
          setAthlete(response.data);
          // Reload end-trial status
          const etRes = await api.get(`/athletes/${id}/end-trial-status`);
          setEndTrialStatus(etRes.data);
          if (response.data.status === 'active') {
            showAlert('Successo', 'Tutti i passaggi completati! Atleta attivato!');
          } else {
            showAlert('Successo', 'Privacy firmata! In attesa della verifica del certificato medico da parte dell\'admin.');
          }
        } else {
          // Normal flow: activate directly
          const response = await api.patch(`/athletes/${id}`, {
            privacy_accepted: true,
            image_consent: true,
            status: 'active',
          });
          setPrivacyModalVisible(false);
          setPrivacyConfirmed(false);
          setAthlete(response.data);
          showAlert('Successo', 'Privacy firmata e atleta attivato!');
        }
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'attivazione');
      }
    }
  };

  const handleRequestEndTrial = async () => {
    if (!athlete) return;
    setRequestingEndTrial(true);
    try {
      await api.post(`/athletes/${athlete.id}/request-end-trial`);
      const etRes = await api.get(`/athletes/${athlete.id}/end-trial-status`);
      setEndTrialStatus(etRes.data);
      // Refresh athlete to get updated state
      const athRes = await api.get(`/athletes/${athlete.id}`);
      setAthlete(athRes.data);
      setShowEndTrialChoice(false);
      showAlert('Perfetto!', 'Hai avviato la procedura per diventare membro effettivo. Segui i passaggi richiesti.');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la richiesta');
    } finally {
      setRequestingEndTrial(false);
    }
  };

  const handleShowDeletionOption = async () => {
    if (!athlete) return;
    try {
      const res = await api.get(`/athletes/${athlete.id}/deletion-check`);
      setDeletionCheck(res.data);
      setShowDeletionConfirm(true);
      setShowEndTrialChoice(true);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il controllo');
    }
  };

  const handleRequestDeletion = async () => {
    if (!athlete) return;
    setRequestingDeletion(true);
    try {
      await api.post(`/athletes/${athlete.id}/request-deletion`);
      setShowDeletionConfirm(false);
      setShowEndTrialChoice(false);
      // Reload athlete to show deletion_requested state
      const res = await api.get(`/athletes/${athlete.id}`);
      setAthlete(res.data);
      showAlert('Richiesta Inviata', 'La richiesta di cancellazione e stata inviata all\'amministratore. Verrai contattato quando sara elaborata.');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la richiesta');
    } finally {
      setRequestingDeletion(false);
    }
  };

  const formatDateForDisplay = (isoDate: string) => {
    // Converti da ISO a GG/MM/AAAA
    try {
      const date = new Date(isoDate);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return isoDate;
    }
  };

  const handleToggleStatus = async () => {
    if (!athlete) return;
    
    // Se è in prova e vuole attivare, deve prima accettare la privacy
    if (athlete.status === 'trial') {
      // Mostra il modal della privacy
      setPrivacyModalVisible(true);
      return;
    }
    
    // Se è già attivo e vuole tornare in prova (caso raro)
    await executeStatusToggle('trial');
  };

  const handlePrivacyAccept = async () => {
    // Apri il modal GDPR per la firma vera
    setPrivacyModalVisible(true);
  };

  const executeStatusToggle = async (newStatus: string) => {
    if (!athlete) return;
    
    setTogglingStatus(true);
    try {
      const response = await api.patch(`/athletes/${id}`, {
        status: newStatus,
        privacy_accepted: newStatus === 'active',
      });
      
      // Update local state immediately with response data
      setAthlete(response.data);
      
      if (newStatus === 'active') {
        showAlert('Successo', 'Atleta attivato! Privacy accettata.');
      } else {
        showAlert('Successo', 'Atleta rimesso in periodo di prova.');
      }
    } catch (error: any) {
      console.error('Toggle error:', error);
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    } finally {
      setTogglingStatus(false);
    }
  };

  const openEditModal = () => {
    if (!athlete) return;
    
    // Popola i dati di modifica con i valori attuali
    setEditData({
      first_name: athlete.first_name || '',
      last_name: athlete.last_name || '',
      date_of_birth: formatDateForDisplay(athlete.date_of_birth),
      gender: athlete.gender || '',
      fiscal_code: athlete.fiscal_code || '',
      birth_place: athlete.birth_place || '',
      birth_province: athlete.birth_province || '',
      country_of_birth: athlete.country_of_birth || 'Italia',
      address: athlete.address || '',
      city: athlete.city || '',
      postal_code: athlete.postal_code || '',
      province: athlete.province || '',
      phone_athlete: athlete.phone_athlete || '',
      phone_father: athlete.phone_father || '',
      phone_mother: athlete.phone_mother || '',
      email: athlete.email || '',
      second_parent_email: athlete.second_parent_email || '',
      tax_payer_last_name: athlete.tax_payer_last_name || '',
      tax_payer_first_name: athlete.tax_payer_first_name || '',
      tax_payer_fiscal_code: athlete.tax_payer_fiscal_code || '',
      team_id: athlete.team_id || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      // Converti la data in formato ISO
      const isoDate = convertToISODate(editData.date_of_birth);
      
      await api.patch(`/athletes/${id}`, {
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`,
        date_of_birth: isoDate,
        gender: editData.gender || null,
        fiscal_code: editData.fiscal_code,
        birth_place: editData.birth_place || null,
        birth_province: editData.birth_province || null,
        country_of_birth: editData.country_of_birth || 'Italia',
        address: editData.address || null,
        city: editData.city || null,
        postal_code: editData.postal_code || null,
        province: editData.province || null,
        phone_athlete: editData.phone_athlete || null,
        phone_father: editData.phone_father || null,
        phone_mother: editData.phone_mother || null,
        email: editData.email || null,
        second_parent_email: editData.second_parent_email || null,
        tax_payer_last_name: editData.tax_payer_last_name || null,
        tax_payer_first_name: editData.tax_payer_first_name || null,
        tax_payer_fiscal_code: editData.tax_payer_fiscal_code || null,
        team_id: editData.team_id || null,
      });

      Alert.alert('Successo', 'Dati aggiornati con successo');
      setEditModalVisible(false);
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAthlete = () => {
    if (!athlete) return;
    
    Alert.alert(
      'Elimina Atleta',
      `Sei sicuro di voler eliminare ${athlete.full_name}?\n\nQuesta azione è IRREVERSIBILE e cancellerà tutti i dati dell'atleta inclusi pagamenti e presenze.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => confirmDeleteAthlete(),
        },
      ]
    );
  };

  const confirmDeleteAthlete = async () => {
    try {
      await api.delete(`/athletes/${id}`);
      Alert.alert(
        'Atleta Eliminato',
        'L\'atleta è stato eliminato con successo.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/parent'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
    }
  };

  if (!athlete) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
    );
  }

  const trialDaysRemaining = athlete.trial_end_date 
    ? differenceInDays(new Date(athlete.trial_end_date), new Date())
    : 0;
  const trialHasStarted = !!(athlete.trial_start_date && athlete.trial_end_date);

  const isCertificateExpired = certificate
    ? new Date() > new Date(certificate.expiry_date)
    : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/parent')}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{athlete.full_name}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Card - Same style as 18+ */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }} data-testid="athlete-name-card">{athlete.full_name}</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                Squadra: <Text style={{ fontWeight: '600', color: '#E53935' }}>{athlete.team_name || getTeamName(athlete.team_id) || 'Non assegnata'}</Text>
              </Text>
              {athlete.email && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="mail" size={14} color="#999" />
                  <Text style={{ marginLeft: 4, color: '#999', fontSize: 12 }}>{athlete.email}</Text>
                </View>
              )}
            </View>
            <View style={{ 
              backgroundColor: athlete.status === 'active' ? '#E8F5E9' : athlete.status === 'trial' ? (athlete.trial_start_date ? '#FFF3E0' : '#F3E5F5') : athlete.status === 'deletion_requested' ? '#FFEBEE' : '#E3F2FD',
              paddingHorizontal: 10, 
              paddingVertical: 5, 
              borderRadius: 12
            }}>
              <Text style={{ 
                color: athlete.status === 'active' ? '#4CAF50' : athlete.status === 'trial' ? (athlete.trial_start_date ? '#FF9800' : '#7B1FA2') : athlete.status === 'deletion_requested' ? '#F44336' : '#1976D2',
                fontWeight: '600',
                fontSize: 12
              }} data-testid="athlete-status-badge">
                {athlete.status === 'active' ? 'Attivo' : athlete.status === 'trial' ? (athlete.trial_start_date ? 'In Prova' : 'Attesa Prova') : athlete.status === 'deletion_requested' ? 'Cancellazione' : athlete.status || ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Cronologia Atleta */}
        <TouchableOpacity
          style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
          onPress={() => router.push(`/parent/athlete/timeline?id=${athlete.id}`)}
          data-testid="timeline-btn"
        >
          <Ionicons name="time" size={36} color="#AF52DE" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>Cronologia Atleta</Text>
            <Text style={{ fontSize: 12, color: '#888' }}>Visualizza la storia completa</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        {/* QR Code - Compact */}
        <TouchableOpacity
          style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
          onPress={() => setQrModalVisible(true)}
          data-testid="qr-code-btn"
        >
          <Ionicons name="qr-code" size={36} color="#007AFF" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>QR Code Personale</Text>
            <Text style={{ fontSize: 12, color: '#888' }}>Tocca per visualizzare</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        {/* Athlete Photo Card - Only for adults */}
        {!athlete.is_minor && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📸 Foto Atleta</Text>
          <View style={styles.photoContainer}>
            {transformingPhoto ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.transformingText}>Creando ritratto artistico...</Text>
              </View>
            ) : athletePhotoArtistic ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${athletePhotoArtistic}` }}
                style={styles.athletePhotoLarge}
              />
            ) : athletePhoto ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${athletePhoto}` }}
                style={styles.athletePhotoLarge}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={64} color="#ccc" />
                <Text style={styles.photoPlaceholderText}>Nessuna foto</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.uploadPhotoButton, transformingPhoto && styles.buttonDisabled]}
              onPress={async () => {
                try {
                  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permissionResult.granted) {
                    Alert.alert('Permesso negato', 'È necessario concedere il permesso per accedere alla galleria');
                    return;
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7,
                    base64: true,
                  });

                  if (!result.canceled && result.assets[0].base64) {
                    const originalPhoto = result.assets[0].base64;
                    setAthletePhoto(originalPhoto);
                    setTransformingPhoto(true);
                    
                    try {
                      const response = await api.post(`/athletes/${id}/transform-photo`, {
                        image_base64: originalPhoto
                      });
                      
                      if (response.data.success && response.data.artistic_photo) {
                        setAthletePhotoArtistic(response.data.artistic_photo);
                        Alert.alert('✅ Foto Trasformata', 'La foto è stata trasformata in stile pastello!');
                      } else {
                        setAthletePhotoArtistic(originalPhoto);
                      }
                    } catch (transformError: any) {
                      console.error('Error transforming photo:', transformError);
                      setAthletePhotoArtistic(originalPhoto);
                      Alert.alert('Info', 'Foto caricata. La trasformazione artistica non è disponibile al momento.');
                    } finally {
                      setTransformingPhoto(false);
                    }
                  }
                } catch (error) {
                  console.error('Error selecting image:', error);
                  Alert.alert('Errore', 'Impossibile selezionare l\'immagine');
                }
              }}
              disabled={transformingPhoto}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.uploadPhotoButtonText}>
                {athletePhotoArtistic ? 'Cambia Foto' : 'Carica Foto'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.photoHint}>
              🎨 La foto verrà trasformata in stile pastello artistico
            </Text>
          </View>
        </View>
        )}

        {/* Dati Anagrafici + Fiscali - Collapsible Card (matching adult profile) */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('anagrafici')}
          >
            <Text style={styles.cardTitle}>Dati Anagrafici</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {dataUnlocked && (
                <TouchableOpacity onPress={openEditModal}>
                  <Ionicons name="create-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              )}
              {hasPassword && !dataUnlocked && (
                <TouchableOpacity onPress={() => setPasswordModalVisible(true)}>
                  <Ionicons name="lock-closed" size={20} color="#FF9500" />
                </TouchableOpacity>
              )}
              <Ionicons 
                name={sectionsExpanded.anagrafici ? "chevron-up" : "chevron-down"} 
                size={24} 
                color="#666" 
              />
            </View>
          </TouchableOpacity>
          
          {sectionsExpanded.anagrafici && (
            <View style={styles.collapsibleContent}>
              {hasPassword && !dataUnlocked && (
                <TouchableOpacity onPress={() => setPasswordModalVisible(true)} style={styles.lockedBanner}>
                  <Ionicons name="shield-checkmark" size={20} color="#FF9500" />
                  <Text style={styles.lockedBannerText}>
                    Dati protetti da password. Tocca per sbloccare.
                  </Text>
                </TouchableOpacity>
              )}
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Squadra</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <SportIcon size={18} />
                  <Text style={[styles.dataValue, { color: '#E53935', fontWeight: '700', marginLeft: 4 }]}>
                    {getTeamName(athlete.team_id)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Cognome</Text>
                <Text style={styles.dataValue}>{athlete.last_name || '-'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Nome</Text>
                <Text style={styles.dataValue}>{athlete.first_name || '-'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Data di Nascita</Text>
                <Text style={styles.dataValue}>{formatDateForDisplay(athlete.date_of_birth)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Stato di Nascita</Text>
                <Text style={styles.dataValue}>{athlete.country_of_birth || 'Italia'}</Text>
              </View>
              
              {(!athlete.country_of_birth || athlete.country_of_birth.toUpperCase() === 'ITALIA') && (
              <>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Comune di Nascita</Text>
                <Text style={styles.dataValue}>{maskData(athlete.birth_place)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Prov. Nascita</Text>
                <Text style={styles.dataValue}>{maskData(athlete.birth_province)}</Text>
              </View>
              </>
              )}
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Codice Fiscale</Text>
                <Text style={styles.dataValue}>{maskData(athlete.fiscal_code)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Indirizzo</Text>
                <Text style={styles.dataValue}>{maskData(athlete.address)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Città</Text>
                <Text style={styles.dataValue}>
                  {[athlete.city, athlete.province, athlete.postal_code].filter(Boolean).join(' - ') || '-'}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Tel. Atleta</Text>
                <Text style={styles.dataValue}>{maskData(athlete.phone_athlete)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Tel. Padre</Text>
                <Text style={styles.dataValue}>{maskData(athlete.phone_father)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Tel. Madre</Text>
                <Text style={styles.dataValue}>{maskData(athlete.phone_mother)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Email</Text>
                <Text style={styles.dataValue}>{maskData(athlete.email)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Email 2° Genitore</Text>
                <Text style={styles.dataValue}>{athlete.second_parent_email || '-'}</Text>
              </View>
            </View>
          )}

          {/* Divider between sections */}
          <View style={{ height: 1, backgroundColor: '#E5E5E5', marginVertical: 8 }} />

          {/* Dati del genitore che porterà in detrazione la spesa */}
          <TouchableOpacity 
            style={styles.collapsibleHeader}
            onPress={() => toggleSection('fiscali')}
          >
            <Text style={styles.cardTitle}>Dati del genitore che porta in detrazione la spesa</Text>
            <Ionicons 
              name={sectionsExpanded.fiscali ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#666" 
            />
          </TouchableOpacity>
          
          {sectionsExpanded.fiscali && (
            <View style={styles.collapsibleContent}>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Cognome</Text>
                <Text style={styles.dataValue}>{maskData(athlete.tax_payer_last_name)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Nome</Text>
                <Text style={styles.dataValue}>{maskData(athlete.tax_payer_first_name)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Codice Fiscale</Text>
                <Text style={styles.dataValue}>{maskData(athlete.tax_payer_fiscal_code)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Coach Info */}
        {coachInfo && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SportIcon size={20} />
              <Text style={[styles.cardTitle, { marginLeft: 6 }]}>Coach {getTeamName(athlete.team_id)}</Text>
            </View>
            {(coachInfo.all_coaches || [coachInfo]).map((coach: any, idx: number) => (
              <View key={coach.id || idx} style={[styles.coachInfoRow, idx > 0 && { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' }]}>
                {coach.profile_photo_artistic || coach.profile_photo ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${coach.profile_photo_artistic || coach.profile_photo}` }}
                    style={styles.coachPhotoSmall}
                  />
                ) : (
                  <View style={styles.coachPhotoPlaceholder}>
                    <Ionicons name="person" size={20} color="#999" />
                  </View>
                )}
                <View style={styles.coachInfoDetails}>
                  <Text style={styles.coachName}>{coach.full_name}</Text>
                  <Text style={styles.coachContactHint}>Per contattare il coach, rivolgersi alla segreteria</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Stato e Periodo di Prova - Card unificata */}
        {/* Banner profilo incompleto */}
        {profileCheck && !profileCheck.is_complete && (
          <View style={{ backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FF6F00' }} data-testid="profile-incomplete-banner">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={20} color="#E65100" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#E65100' }}>Anagrafica incompleta</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#795548', lineHeight: 18, marginBottom: 8 }}>
              Per generare o firmare documenti, completa i seguenti campi:
            </Text>
            {profileCheck.parent_missing?.length > 0 && (
              <Text style={{ fontSize: 12, color: '#E65100', marginBottom: 4 }}>
                Genitore: {profileCheck.parent_missing.join(', ')}
              </Text>
            )}
            {profileCheck.athlete_missing?.length > 0 && (
              <Text style={{ fontSize: 12, color: '#E65100', marginBottom: 4 }}>
                Atleta: {profileCheck.athlete_missing.join(', ')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {profileCheck.parent_missing?.length > 0 && (
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#FF6F00', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => router.push('/parent/profile')}
                  data-testid="go-to-parent-profile-btn"
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                    {profileCheck.parent_missing.length === 1 && profileCheck.parent_missing[0] === 'Password protezione dati'
                      ? 'Imposta Password Protezione Dati'
                      : 'Completa Profilo Genitore'}
                  </Text>
                </TouchableOpacity>
              )}
              {profileCheck.athlete_missing?.length > 0 && (
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#FF6F00', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => openEditModal()}
                  data-testid="go-to-athlete-profile-btn"
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Completa Dati Atleta</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stato</Text>
          
          {/* In attesa d'inizio prova (VIOLA) */}
          {athlete.status === 'trial' && !trialHasStarted && (
            <>
              <View style={{ backgroundColor: '#F3E5F5', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#9C27B0', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#7B1FA2', marginBottom: 4 }}>In attesa di inizio prova</Text>
                {athlete.trial_document_generated ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                    <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>Dichiarazione di prova firmata</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: '#6A1B9A', lineHeight: 18 }}>
                    Il periodo di prova inizier{'à'} automaticamente nel momento in cui {athlete.first_name || athlete.full_name?.split(' ').pop() || ''} registrer{'à'} la sua prima presenza in palestra, con la scansione del suo codice QR da parte del coach.{'\n'}Per poter partecipare, dovr{'à'} avere la dichiarazione di prova firmata da un genitore.{'\n'}Per evitare dimenticanze, ti consigliamo di firmare la dichiarazione sin da ora.
                  </Text>
                )}
              </View>
              {!athlete.trial_document_generated && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#EDE7F6', paddingVertical: 12, borderRadius: 10, gap: 8,
                  }}
                  onPress={() => {
                    setTrialSignature(null);
                    setShowTrialSignModal(true);
                  }}
                  data-testid="trial-download-document-button"
                >
                  <Ionicons name="create" size={18} color="#7B1FA2" />
                  <Text style={{ fontWeight: '600', color: '#7B1FA2', fontSize: 14 }}>
                    Firma Dichiarazione di Prova
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Banner - Richiesta cancellazione in attesa */}
          {athlete.deletion_requested && (
            <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#C62828', marginBottom: 12 }} data-testid="deletion-pending-banner">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Ionicons name="time" size={18} color="#C62828" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#C62828' }}>Cancellazione in attesa</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18 }}>
                La richiesta di cancellazione e stata inviata all'amministratore. In attesa di approvazione.
              </Text>
            </View>
          )}

          {/* In prova ATTIVA (ARANCIONE/BLU) */}
          {athlete.status === 'trial' && trialHasStarted && trialStatus && !trialStatus.trial_expired && !trialStatus.trial_warning && (
            <>
              <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#1976D2', marginBottom: 12 }} data-testid="trial-status-active">
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1565C0', marginBottom: 8 }}>Periodo di prova attivo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="calendar-outline" size={16} color="#1976D2" />
                  <Text style={{ fontSize: 13, color: '#333' }}>
                    Inizio: <Text style={{ fontWeight: '700' }}>{athlete.trial_start_date ? new Date(athlete.trial_start_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="calendar" size={16} color="#1976D2" />
                  <Text style={{ fontSize: 13, color: '#333' }}>
                    Scadenza: <Text style={{ fontWeight: '700' }}>{athlete.trial_end_date ? new Date(athlete.trial_end_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="fitness" size={16} color="#1976D2" />
                  <Text style={{ fontSize: 13, color: '#333' }}>
                    <Text style={{ fontWeight: '700' }}>{trialStatus.sessions_remaining}</Text> allenamenti disponibili ({trialStatus.sessions_count}/{trialStatus.max_sessions})
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar" size={16} color="#1976D2" />
                  <Text style={{ fontSize: 13, color: '#333' }}>
                    <Text style={{ fontWeight: '700' }}>{trialStatus.days_remaining}</Text> giorni rimanenti
                  </Text>
                </View>
                {athlete.trial_document_generated && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>Dichiarazione di prova firmata</Text>
                  </View>
                )}
              </View>
              {/* Bottoni Rimani / Non Rimanere (solo se non ancora richiesto) */}
              {!endTrialStatus?.end_trial_requested && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: '#333', textAlign: 'center', marginBottom: 8, fontWeight: '500' }}>
                    Vuoi terminare il periodo di prova?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' }}
                      onPress={() => handleRequestEndTrial()}
                      disabled={requestingEndTrial}
                      data-testid="rimani-firma-btn"
                    >
                      <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                        {requestingEndTrial ? 'Invio...' : 'Rimani e Firma\nPrivacy'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFEBEE' }}
                      onPress={() => handleShowDeletionOption()}
                      data-testid="non-rimanere-btn"
                    >
                      <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* WARNING - Ultimo allenamento o ultimo giorno (ARANCIONE) */}
          {athlete.status === 'trial' && trialHasStarted && trialStatus && trialStatus.trial_warning && !trialStatus.trial_expired && (
            <>
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#FF6F00', marginBottom: 12 }} data-testid="trial-status-warning">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="warning" size={18} color="#E65100" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#E65100' }}>
                    {trialStatus.sessions_remaining <= 1 ? 'Ultimo allenamento disponibile' : 'Ultimi giorni di prova'}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#795548', lineHeight: 18, marginBottom: 6 }}>
                  Certificato medico necessario per continuare l'attivita sportiva.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Ionicons name="fitness" size={14} color="#E65100" />
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    {trialStatus.sessions_count}/{trialStatus.max_sessions} allenamenti utilizzati
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar" size={14} color="#E65100" />
                  <Text style={{ fontSize: 12, color: '#555' }}>
                    {trialStatus.days_remaining} giorni rimanenti
                  </Text>
                </View>
              </View>
              {/* Bottoni Rimani / Non Rimanere (warning state) */}
              {!endTrialStatus?.end_trial_requested && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: '#333', textAlign: 'center', marginBottom: 8, fontWeight: '500' }}>
                    Vuoi terminare il periodo di prova?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' }}
                      onPress={() => handleRequestEndTrial()}
                      disabled={requestingEndTrial}
                      data-testid="rimani-firma-warning-btn"
                    >
                      <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                        {requestingEndTrial ? 'Invio...' : 'Rimani e Firma\nPrivacy'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFEBEE' }}
                      onPress={() => handleShowDeletionOption()}
                      data-testid="non-rimanere-warning-btn"
                    >
                      <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* SCADUTO (ROSSO) */}
          {athlete.status === 'trial' && trialHasStarted && trialStatus && trialStatus.trial_expired && !athlete.privacy_accepted && !endTrialStatus?.end_trial_requested && (
            <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#F44336', marginBottom: 12 }} data-testid="trial-status-expired">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="close-circle" size={18} color="#C62828" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#C62828' }}>Periodo di prova terminato</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18, marginBottom: 8 }}>
                Per proseguire l'attivita sportiva, avvia la procedura di iscrizione.
              </Text>
              <Text style={{ fontSize: 13, color: '#333', textAlign: 'center', marginBottom: 8, fontWeight: '500' }}>
                Vuoi terminare il periodo di prova?
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' }}
                  onPress={() => handleRequestEndTrial()}
                  disabled={requestingEndTrial}
                  data-testid="rimani-firma-expired-btn"
                >
                  <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                    {requestingEndTrial ? 'Invio...' : 'Rimani e Firma\nPrivacy'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFEBEE' }}
                  onPress={() => handleShowDeletionOption()}
                  data-testid="non-rimanere-expired-btn"
                >
                  <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottoni quando end_trial_requested - mostra solo Rimani/Firma Privacy */}
          {athlete.status === 'trial' && endTrialStatus?.end_trial_requested && !athlete.deletion_requested && (
            <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E0E0E0' }} data-testid="end-trial-stepper">
              <TouchableOpacity
                style={{ borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 13, alignItems: 'center', backgroundColor: endTrialStatus.steps.privacy_signed ? '#E8F5E9' : '#E3F2FD' }}
                onPress={() => {
                  if (!endTrialStatus.steps.privacy_signed) {
                    setPrivacyModalVisible(true);
                  }
                }}
                disabled={endTrialStatus.steps.privacy_signed}
                data-testid="rimani-firma-requested-btn"
              >
                <Text style={{ color: endTrialStatus.steps.privacy_signed ? '#2E7D32' : '#1565C0', fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
                  {endTrialStatus.steps.privacy_signed ? 'Privacy Firmata' : 'Rimani e Firma Privacy'}
                </Text>
              </TouchableOpacity>

              {/* All complete message */}
              {endTrialStatus.all_complete && athlete.status === 'trial' && (
                <View style={{ backgroundColor: '#E8F5E9', borderRadius: 8, padding: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                  <Text style={{ fontSize: 13, color: '#2E7D32', fontWeight: '600', flex: 1 }}>
                    Tutti i passaggi completati! L'atleta verra attivato automaticamente.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* In attività (VERDE) */}
          {athlete.status === 'active' && (
            <View style={{ backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#34C759' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7D32' }}>In attività</Text>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18 }}>Atleta confermato con privacy accettata</Text>
            </View>
          )}
        </View>

        {/* Certificate Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Certificato Medico</Text>
          {certificate ? (
            <View>
              {(() => {
                const expiryDate = new Date(certificate.expiry_date);
                const today = new Date();
                const daysLeft = differenceInDays(expiryDate, today);
                const isExpired = daysLeft < 0;
                const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;
                const statusColor = isExpired ? '#FF3B30' : isExpiringSoon ? '#FF9500' : '#34C759';
                const statusBg = isExpired ? '#FFF0F0' : isExpiringSoon ? '#FFF8E1' : '#E8F5E9';
                const statusText = isExpired ? 'SCADUTO' : isExpiringSoon ? `Scade tra ${daysLeft} giorni` : 'In corso di validità';
                return (
                  <View style={{ backgroundColor: statusBg, padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: statusColor }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={isExpired ? 'close-circle' : isExpiringSoon ? 'alert-circle' : 'checkmark-circle'}
                        size={22}
                        color={statusColor}
                      />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: statusColor }}>
                        Scadenza: {format(expiryDate, 'dd/MM/yyyy', { locale: it })}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: statusColor, fontWeight: '600', marginTop: 4, paddingLeft: 30 }}>
                      {statusText}
                    </Text>
                  </View>
                );
              })()}
              {certificate.issue_date && (
                <Text style={{ fontSize: 13, color: '#666', marginTop: 8, paddingLeft: 4 }}>
                  Emissione: {format(new Date(certificate.issue_date), 'dd/MM/yyyy', { locale: it })}
                </Text>
              )}
              {/* Stato verifica admin */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 4 }}>
                <Ionicons
                  name={athlete?.medical_certificate_verified ? 'shield-checkmark' : 'shield-outline'}
                  size={18}
                  color={athlete?.medical_certificate_verified ? '#4CAF50' : '#FF9500'}
                />
                <Text style={{ marginLeft: 8, fontSize: 13, color: athlete?.medical_certificate_verified ? '#4CAF50' : '#FF9500', fontWeight: '600' }}>
                  {athlete?.medical_certificate_verified ? "Verificato dall'admin" : "Non ancora verificato dall'admin"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#FF9500" />
              <Text style={styles.warningText}>Nessun certificato inserito</Text>
            </View>
          )}
          
          {/* Form inserimento date certificato */}
          <CertificateDateForm athleteId={athlete?.id} certificate={certificate} onSaved={loadData} />
        </View>

        {/* Team Schedule Card - Allenamenti e Gare Interne */}
        {teamSchedule && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SportIcon size={20} />
              <Text style={[styles.cardTitle, { marginLeft: 6 }]}>Calendario Squadra</Text>
            </View>
            
            {/* Allenamenti */}
            {teamSchedule.training_sessions && teamSchedule.training_sessions.length > 0 && (
              <View style={styles.scheduleSection}>
                <Text style={styles.scheduleSectionTitle}>📅 Allenamenti Settimanali</Text>
                {teamSchedule.training_sessions.map((session: any, idx: number) => (
                  <View key={idx} style={styles.scheduleItem}>
                    <View style={styles.scheduleDay}>
                      <Ionicons name="calendar-outline" size={16} color="#007AFF" />
                      <Text style={styles.scheduleDayText}>{session.day}</Text>
                    </View>
                    <View style={styles.scheduleDetails}>
                      <Text style={styles.scheduleTime}>
                        🕐 {session.timeStart} - {session.timeEnd}
                      </Text>
                      {session.venue && (
                        <Text style={styles.scheduleVenue}>
                          📍 {session.venue}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            {/* Gare Interne */}
            {teamSchedule.match_day && teamSchedule.match_day.day && (
              <View style={[styles.scheduleSection, { marginTop: 16 }]}>
                <Text style={styles.scheduleSectionTitle}>🏆 Gare Interne</Text>
                <View style={styles.scheduleItem}>
                  <View style={styles.scheduleDay}>
                    <Ionicons name="trophy-outline" size={16} color="#FF9500" />
                    <Text style={[styles.scheduleDayText, { color: '#FF9500' }]}>
                      {teamSchedule.match_day.day}
                    </Text>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleTime}>
                      🕐 {teamSchedule.match_day.time || 'Orario da definire'}
                    </Text>
                    {teamSchedule.match_day.venue && (
                      <Text style={styles.scheduleVenue}>
                        📍 {teamSchedule.match_day.venue}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
            
            {(!teamSchedule.training_sessions || teamSchedule.training_sessions.length === 0) && 
             (!teamSchedule.match_day || !teamSchedule.match_day.day) && (
              <Text style={styles.noDataText}>Calendario non ancora definito</Text>
            )}
          </View>
        )}

        {/* Payments Card - Dynamic Installments with Cumulative Logic */}
        <View style={styles.card} ref={paymentsRef}>
          <Text style={styles.cardTitle}>Pagamenti {athlete.first_name || ''}</Text>
          
          {/* Riepilogo Quota */}
          {paymentSettings && (
            <View style={styles.paymentSummary}>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>Quota Annuale:</Text>
                <Text style={styles.paymentSummaryValue}>
                  {formatCurrency(paymentSettings.total_amount || (
                    (paymentSettings.installment_1_amount || 0) + 
                    (paymentSettings.installment_2_amount || 0) + 
                    (paymentSettings.installment_3_amount || 0)
                  ))}
                </Text>
              </View>
              {athlete && athlete.discount_amount && athlete.discount_amount > 0 ? (
                <View style={styles.paymentSummaryRow}>
                  <Text style={[styles.paymentSummaryLabel, { color: '#34C759', flex: 1 }]}>
                    Sconto: {athlete.discount_reason || 'Non specificato'}
                  </Text>
                  <Text style={[styles.paymentSummaryValue, { color: '#34C759' }]}>
                    - {formatCurrency(athlete.discount_amount)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
          
          {/* Dynamic Installments with Cumulative Logic */}
          {paymentSettings && (() => {
            // Build installments array: prefer dynamic, fallback to legacy
            const installments = (paymentSettings.installments && paymentSettings.installments.length > 0) 
              ? paymentSettings.installments.filter((i: any) => parseFloat(i.amount) > 0).map((i: any) => ({
                  name: i.name,
                  amount: parseFloat(i.amount),
                  due_date: i.due_date,
                }))
              : [
                  { name: 'Quota iscrizione', amount: paymentSettings.installment_1_amount || 0, due_date: null },
                  { name: 'Rata 1', amount: paymentSettings.installment_2_amount || 0, due_date: paymentSettings.installment_2_due_date },
                  { name: 'Rata 2', amount: paymentSettings.installment_3_amount || 0, due_date: paymentSettings.installment_3_due_date },
                ].filter(i => i.amount > 0);
            
            // Cumulative: sum all paid payments
            const totalPaid = payments.filter(p => p.paid || p.paid_date).reduce((sum, p) => sum + (p.amount || 0), 0);
            let remaining = totalPaid;
            
            // Apply cumulative logic
            const rateWithStatus = installments.map((inst: any) => {
              if (remaining >= inst.amount) {
                remaining -= inst.amount;
                return { ...inst, status: 'paid', paidAmount: inst.amount };
              } else if (remaining > 0) {
                const partial = remaining;
                remaining = 0;
                return { ...inst, status: 'partial', paidAmount: partial };
              } else {
                return { ...inst, status: 'unpaid', paidAmount: 0 };
              }
            });
            
            // Find next due installment
            const nextDue = rateWithStatus.find((r: any) => r.status !== 'paid');
            const totalAmount = paymentSettings.total_amount || installments.reduce((s: number, i: any) => s + i.amount, 0);
            const residuo = totalAmount - (athlete?.discount_amount || 0) - totalPaid;
            
            return (
              <View>
                {/* Next Due Installment */}
                {nextDue && (
                  <View style={{ backgroundColor: nextDue.status === 'partial' ? '#FFF3E0' : '#FFF8E1', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: nextDue.status === 'partial' ? '#FF9800' : '#FFA000' }}>
                    <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>
                      {nextDue.status === 'partial' ? 'Rata parzialmente pagata' : 'Prossima rata:'}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#333' }}>{nextDue.name}: {formatCurrency(nextDue.amount)}</Text>
                    </View>
                    {nextDue.status === 'partial' && (
                      <Text style={{ fontSize: 13, color: '#FF9800', marginTop: 2 }}>(pagati {formatCurrency(nextDue.paidAmount)})</Text>
                    )}
                    {nextDue.due_date && (
                      <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        Scad. {new Date(nextDue.due_date).toLocaleDateString('it-IT')}
                      </Text>
                    )}
                  </View>
                )}

                {/* Pagamenti Effettuati - Collapsible Summary */}
                {totalPaid > 0 && (
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                    onPress={() => setPaymentsListExpanded(!paymentsListExpanded)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={18} color="#34C759" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>Pagamenti Effettuati</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#34C759' }}>
                        {rateWithStatus.filter((r: any) => r.status === 'paid').length + (rateWithStatus.some((r: any) => r.status === 'partial') ? 1 : 0)} - {formatCurrency(totalPaid)}
                      </Text>
                      <Ionicons name={paymentsListExpanded ? "chevron-up" : "chevron-down"} size={18} color="#888" />
                    </View>
                  </TouchableOpacity>
                )}

                {paymentsListExpanded && payments.filter(p => p.paid || p.paid_date).length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    {payments.filter(p => p.paid || p.paid_date).map((p, idx) => (
                      <View key={p.id || idx} style={styles.manualPaymentRow}>
                        <View style={styles.manualPaymentInfo}>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#333' }}>{p.description || `Pagamento ${idx + 1}`}</Text>
                          <Text style={styles.manualPaymentAmount}>{formatCurrency(p.amount)}</Text>
                          <Text style={styles.manualPaymentDate}>
                            {p.paid_date ? new Date(p.paid_date).toLocaleDateString('it-IT') : ''}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Residuo Dovuto */}
                {residuo > 0 && (
                  <View style={[styles.paymentRow, styles.residuoRow]}>
                    <Text style={{ fontWeight: '700', fontSize: 15 }}>Residuo Dovuto</Text>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#FF3B30' }}>{formatCurrency(residuo)}</Text>
                  </View>
                )}

                {/* Dettaglio Rate - Expandable */}
                <Text style={[styles.sectionSubtitle, { marginTop: 12 }]}>Dettaglio Rate</Text>
                {rateWithStatus.map((rate: any, index: number) => (
                  <View key={index} style={[
                    styles.paymentRow,
                    rate.status === 'paid' && { borderLeftColor: '#34C759', borderLeftWidth: 3 },
                    rate.status === 'partial' && { borderLeftColor: '#FF9800', borderLeftWidth: 3 },
                    rate.status === 'unpaid' && { borderLeftColor: '#FF3B30', borderLeftWidth: 3 }
                  ]}>
                    <View style={styles.paymentInfo}>
                      <Text style={[
                        styles.paymentTitle,
                        rate.status === 'paid' && { color: '#999' }
                      ]}>{rate.name}</Text>
                      {rate.status === 'paid' && (
                        <Text style={{ fontSize: 12, color: '#34C759', fontWeight: '500' }}>Pagata</Text>
                      )}
                      {rate.status === 'partial' && (
                        <Text style={{ fontSize: 12, color: '#FF9800' }}>Pagati {formatCurrency(rate.paidAmount)} di {formatCurrency(rate.amount)}</Text>
                      )}
                      {rate.due_date && rate.status !== 'paid' && (
                        <Text style={styles.paymentDue}>
                          Scad. {new Date(rate.due_date).toLocaleDateString('it-IT')}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.paymentAmount, rate.status === 'paid' && { color: '#999' }]}>
                        {formatCurrency(rate.amount)}
                      </Text>
                      <Ionicons
                        name={rate.status === 'paid' ? 'checkmark-circle' : rate.status === 'partial' ? 'ellipse-outline' : 'ellipse'}
                        size={22}
                        color={rate.status === 'paid' ? '#34C759' : rate.status === 'partial' ? '#FF9800' : '#FF3B30'}
                      />
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}
          
          {/* Modalità di pagamento */}
          {paymentSettings && (paymentSettings.bank_info || paymentSettings.paypal_email) && (
            <View style={styles.paymentInstructions}>
              <Text style={styles.instructionsTitle}>Modalità di pagamento:</Text>
              {paymentSettings.bank_info && (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <Ionicons name="business" size={16} color="#666" style={{ marginRight: 6, marginTop: 2 }} />
                  <Text style={[styles.instructionsText, { flex: 1 }]}>
                    <Text style={styles.bold}>Bonifico Bancario:</Text>
                    {'\n'}{paymentSettings.bank_info}
                  </Text>
                </View>
              )}
              {paymentSettings.paypal_email && (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <Ionicons name="logo-paypal" size={16} color="#003087" style={{ marginRight: 6, marginTop: 2 }} />
                  <Text style={[styles.instructionsText, { flex: 1 }]}>
                    <Text style={styles.bold}>PayPal:</Text>
                    {'\n'}{paymentSettings.paypal_email}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {/* Download Fiscal Receipt */}
          {payments.length > 0 && (
            <TouchableOpacity
              style={[styles.downloadReceiptBtn, generatingReceipt && { opacity: 0.6 }]}
              onPress={handleDownloadFiscalReceipt}
              disabled={generatingReceipt}
            >
              {generatingReceipt ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="receipt" size={20} color="#fff" />
              )}
              <Text style={styles.downloadReceiptBtnText}>
                {generatingReceipt ? 'Generazione...' : 'Scarica Ricevuta Fiscale'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Show payments even without payment settings */}
        {!paymentSettings && payments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pagamenti Effettuati</Text>
            <View style={styles.manualPaymentsSection}>
              {payments.filter(p => p.paid || p.paid_date).map((p, idx) => (
                <View key={p.id || idx} style={styles.manualPaymentRow}>
                  <View style={styles.manualPaymentInfo}>
                    <Text style={{ fontSize: 13, fontWeight: '500' }}>{p.description || `Pagamento ${idx + 1}`}</Text>
                    <Text style={styles.manualPaymentAmount}>{formatCurrency(p.amount)}</Text>
                    <Text style={styles.manualPaymentDate}>
                      {p.paid_date ? new Date(p.paid_date).toLocaleDateString('it-IT') : ''}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                </View>
              ))}
            </View>
          </View>
        )}


        {/* Minor Access Control Section */}
        <View style={[styles.card, { marginTop: 12 }]} data-testid="minor-access-section">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="phone-portrait" size={20} color="#34C759" />
            <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>Accesso Lite per {athlete?.first_name || 'tuo figlio/a'}</Text>
          </View>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 18 }}>
            Consenti a {athlete?.first_name || 'tuo figlio/a'} di accedere dal proprio telefono a informazioni utili: QR Code per la registrazione presenze, orari degli allenamenti, gare in calendario. Dati semplici e informativi, protetti da un PIN personale.
          </Text>

          {/* PIN setup */}
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: minorHasPin ? '#E8F5E9' : '#E3F2FD',
              paddingVertical: 12, borderRadius: 10, marginBottom: 10, gap: 8,
            }}
            onPress={() => { setMinorNewPin(''); setMinorConfirmPin(''); setMinorPinModalVisible(true); }}
            data-testid="minor-set-pin-button"
          >
            <Ionicons name={minorHasPin ? "key" : "add"} size={18} color={minorHasPin ? '#2E7D32' : '#1565C0'} />
            <Text style={{ fontWeight: '600', color: minorHasPin ? '#2E7D32' : '#1565C0', fontSize: 14 }}>
              {minorHasPin ? 'Modifica PIN' : 'Imposta PIN'}
            </Text>
          </TouchableOpacity>

          {/* Toggle access */}
          {minorHasPin && (
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: minorAccessEnabled ? '#FFF3E0' : '#E8F5E9',
                paddingVertical: 12, borderRadius: 10, marginBottom: 10, gap: 8,
              }}
              onPress={async () => {
                try {
                  const res = await api.post(`/athletes/${id}/toggle-minor-access`);
                  setMinorAccessEnabled(res.data.enabled);
                  showAlert('Successo', res.data.message);
                } catch (e: any) {
                  showAlert('Errore', e.response?.data?.detail || 'Errore');
                }
              }}
              data-testid="minor-toggle-access-button"
            >
              <Ionicons name={minorAccessEnabled ? "pause-circle" : "play-circle"} size={18} color={minorAccessEnabled ? '#E65100' : '#2E7D32'} />
              <Text style={{ fontWeight: '600', color: minorAccessEnabled ? '#E65100' : '#2E7D32', fontSize: 14 }}>
                {minorAccessEnabled ? 'Disattiva Accesso' : 'Attiva Accesso'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Credentials info */}
          {minorAccessEnabled && minorHasPin && (
            <View style={{ backgroundColor: '#F1F8E9', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#34C759' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#33691E', marginBottom: 6 }}>
                Credenziali per l'accesso:
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: '#555' }}>Nome Lite:</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a2e' }}>{athlete?.nome_lite || 'Non impostato'}</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}
                onPress={() => setNomeLiteModalVisible(true)}
                data-testid="set-nome-lite-button"
              >
                <Ionicons name="create-outline" size={15} color="#1565C0" />
                <Text style={{ fontSize: 12, color: '#1565C0', fontWeight: '600' }}>
                  {athlete?.nome_lite ? 'Modifica Nome Lite' : 'Imposta Nome Lite'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 6 }}>
                Dalla schermata di login, seleziona "Accesso Atleta" e inserisci il Nome Lite e il PIN.
              </Text>
            </View>
          )}
        </View>

        {/* Richiedi Cancellazione - visibile per atleti trial (dopo scelta) e attivi */}
        {!athlete.deletion_requested && (athlete.status === 'trial' || athlete.status === 'active') && (
          <View style={{ marginTop: 24, marginBottom: 40, paddingHorizontal: 4 }}>
            <TouchableOpacity
              style={{ borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFEBEE' }}
              onPress={() => handleShowDeletionOption()}
              data-testid="non-rimanere-bottom-btn"
            >
              <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 14, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={qrModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.modalTitle}>{athlete.full_name}</Text>
            <View ref={qrCodeRef} collapsable={false} style={styles.qrCodeContainer}>
              <Image
                source={{ uri: athlete.qr_code }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <Text style={styles.qrCodeText}>{athlete.qr_identifier || athlete.athlete_code || athlete.id}</Text>
            </View>
            <Text style={styles.qrInstructions}>
              Mostra questo QR code al coach per registrare la presenza
            </Text>
            <View style={styles.qrButtonsRow}>
              <TouchableOpacity
                style={[styles.qrActionButton, styles.printButton]}
                onPress={printQRCode}
              >
                <Ionicons name="print" size={20} color="#fff" />
                <Text style={styles.qrActionButtonText}>Stampa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrActionButton, styles.shareButton]}
                onPress={shareQRCode}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.qrActionButtonText}>Condividi</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Certificate Upload Modal */}
      <Modal
        visible={certModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.certModalContent}>
            <Text style={styles.modalTitle}>Carica Certificato Medico</Text>
            
            {selectedFile && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Data di emissione (GG/MM/AAAA)</Text>
              <TextInput
                style={styles.textInput}
                value={certIssueDate}
                onChangeText={handleDateChange}
                placeholder="__/__/____"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Validità (mesi)</Text>
              <TextInput
                style={styles.textInput}
                value={certValidityMonths}
                onChangeText={setCertValidityMonths}
                placeholder="12"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            {certIssueDate.length === 10 && parseInt(certValidityMonths) > 0 && (
              <View style={styles.expiryDateBox}>
                <Ionicons name="calendar" size={20} color="#34C759" />
                <Text style={styles.expiryDateText}>
                  Scadenza: {calculateExpiryDate(certIssueDate, certValidityMonths)}
                </Text>
              </View>
            )}

            <View style={styles.certModalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, styles.modalButton]}
                onPress={() => {
                  setCertModalVisible(false);
                  setSelectedFile(null);
                }}
              >
                <Text style={styles.buttonSecondaryText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, styles.modalButton]}
                onPress={submitCertificate}
                disabled={uploadingCert}
              >
                <Text style={styles.buttonText}>
                  {uploadingCert ? 'Caricamento...' : 'Carica'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Certificate Modal */}
      <Modal
        visible={viewCertModalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setViewCertModalVisible(false)}
      >
        <View style={styles.certViewerFullScreen}>
          {/* Header */}
          <View style={styles.certViewerHeader}>
            <TouchableOpacity 
              style={styles.certViewerBackBtn}
              onPress={() => setViewCertModalVisible(false)}
            >
              <View style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 20, padding: 6 }}><Ionicons name="chevron-back" size={24} color="#333" /></View>
            </TouchableOpacity>
            <Text style={styles.certViewerTitle}>📋 Certificato Medico</Text>
            {/* Print and Share Buttons */}
            {certificate?.pdf_data && (
              <View style={styles.certActionButtons}>
                <TouchableOpacity 
                  style={styles.printBtn}
                  onPress={printCertificate}
                >
                  <Ionicons name="print" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.shareBtn}
                  onPress={shareCertificate}
                >
                  <Ionicons name="share-outline" size={20} color="#34C759" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Certificate Image - Full Size */}
          <ScrollView 
            style={styles.certViewerScrollView}
            contentContainerStyle={styles.certViewerScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {certificate?.pdf_data && (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${certificate.pdf_data}` }} 
                style={styles.certViewerImageFull}
                resizeMode="contain"
              />
            )}
          </ScrollView>
          
          {/* Footer Info */}
          <View style={styles.certViewerFooter}>
            <View style={styles.certViewerInfoRow}>
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.certViewerInfoText}>
                Emissione: {certificate && format(new Date(certificate.issue_date), 'dd/MM/yyyy', { locale: it })}
              </Text>
            </View>
            <View style={styles.certViewerInfoRow}>
              <Ionicons 
                name={isCertificateExpired ? "close-circle" : (certificate?.verified ? "checkmark-circle" : "time-outline")} 
                size={16} 
                color={isCertificateExpired ? "#FF3B30" : (certificate?.verified ? "#34C759" : "#FF9500")} 
              />
              <Text style={[styles.certViewerInfoText, isCertificateExpired && { color: '#FF3B30' }]}>
                Scadenza: {certificate && format(new Date(certificate.expiry_date), 'dd/MM/yyyy', { locale: it })}
                {isCertificateExpired && ' (SCADUTO)'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.closeCertBtn}
              onPress={() => setViewCertModalVisible(false)}
            >
              <Text style={styles.closeCertBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Coach Photo Modal */}
      <Modal
        visible={coachPhotoModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCoachPhotoModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.coachPhotoModalOverlay}
          activeOpacity={1}
          onPress={() => setCoachPhotoModalVisible(false)}
        >
          <View style={styles.coachPhotoModalContent}>
            <Text style={styles.coachPhotoModalName}>{coachInfo?.full_name}</Text>
            {coachInfo && (coachInfo.profile_photo_artistic || coachInfo.profile_photo) && (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${coachInfo.profile_photo_artistic || coachInfo.profile_photo}` }}
                style={styles.coachPhotoLarge}
              />
            )}
            <TouchableOpacity 
              style={styles.closeCoachPhotoBtn}
              onPress={() => setCoachPhotoModalVisible(false)}
            >
              <Text style={styles.closeCoachPhotoBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* End Trial Choice Modal */}
      <Modal
        visible={showEndTrialChoice}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setShowEndTrialChoice(false); setShowDeletionConfirm(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} style={{ width: '100%' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ backgroundColor: '#C62828', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Conferma Cancellazione</Text>
              <TouchableOpacity onPress={() => { setShowEndTrialChoice(false); setShowDeletionConfirm(false); }} data-testid="end-trial-choice-close">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {showDeletionConfirm && (
              /* Deletion Confirmation View */
              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Ionicons name="warning" size={24} color="#C62828" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#C62828' }}>Conferma Cancellazione</Text>
                </View>

                {deletionCheck?.has_obligations && (
                  <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#FF8F00' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="alert-circle" size={18} color="#FF8F00" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF8F00' }}>Obblighi amministrativi rilevati</Text>
                    </View>
                    {deletionCheck.obligations.unpaid_payments.count > 0 && (
                      <Text style={{ fontSize: 12, color: '#795548', marginBottom: 4 }}>
                        - {deletionCheck.obligations.unpaid_payments.count} pagamenti non saldati (totale: {deletionCheck.obligations.unpaid_payments.total.toFixed(2)} EUR)
                      </Text>
                    )}
                    {deletionCheck.obligations.fiscal_documents.count > 0 && (
                      <Text style={{ fontSize: 12, color: '#795548', marginBottom: 4 }}>
                        - {deletionCheck.obligations.fiscal_documents.count} documenti fiscali gia emessi
                      </Text>
                    )}
                    {deletionCheck.obligations.compensations.count > 0 && (
                      <Text style={{ fontSize: 12, color: '#795548', marginBottom: 4 }}>
                        - {deletionCheck.obligations.compensations.count} compensi registrati
                      </Text>
                    )}
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                      I dati minimi necessari per obblighi di legge verranno conservati.
                    </Text>
                  </View>
                )}

                <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#C62828', marginBottom: 8 }}>Dati che verranno eliminati:</Text>
                  {deletionCheck && (
                    <>
                      <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>- Record atleta</Text>
                      {deletionCheck.data_to_delete.attendances > 0 && (
                        <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>- {deletionCheck.data_to_delete.attendances} presenze</Text>
                      )}
                      {deletionCheck.data_to_delete.signed_documents > 0 && (
                        <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>- {deletionCheck.data_to_delete.signed_documents} documenti firmati</Text>
                      )}
                      {deletionCheck.data_to_delete.payments > 0 && (
                        <Text style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>- {deletionCheck.data_to_delete.payments} pagamenti</Text>
                      )}
                    </>
                  )}
                  {deletionCheck?.parent_info?.parent_can_be_deleted && (
                    <Text style={{ fontSize: 12, color: '#C62828', fontWeight: '600', marginTop: 6 }}>
                      Anche l'account genitore verra eliminato (nessun altro figlio iscritto).
                    </Text>
                  )}
                </View>

                <Text style={{ fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 16, textAlign: 'center' }}>
                  La richiesta sara inviata all'amministratore per l'approvazione.
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#E0E0E0', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                    onPress={() => { 
                      // Log the cancellation before closing
                      api.post(`/athletes/${athlete?.id}/deletion-cancelled`).catch(() => {});
                      setShowDeletionConfirm(false); 
                      setShowEndTrialChoice(false); 
                    }}
                    data-testid="cancel-deletion-btn"
                  >
                    <Text style={{ fontWeight: '600', fontSize: 14, color: '#555' }}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1, backgroundColor: requestingDeletion ? '#EF9A9A' : '#C62828',
                      borderRadius: 10, paddingVertical: 12, alignItems: 'center',
                      flexDirection: 'row', justifyContent: 'center', gap: 6,
                    }}
                    onPress={handleRequestDeletion}
                    disabled={requestingDeletion}
                    data-testid="confirm-deletion-btn"
                  >
                    {requestingDeletion ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="trash" size={16} color="#fff" />
                    )}
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                      {requestingDeletion ? 'Invio...' : 'Conferma'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* GDPR Privacy Modal */}
      {privacyModalVisible && athlete && parentProfile && (
        <GDPRPrivacyModal
          visible={privacyModalVisible}
          onClose={() => setPrivacyModalVisible(false)}
          onSign={handleGDPRPrivacySigned}
          documentType="gdpr_minor"
          signerInfo={{
            name: parentProfile.first_name || (parentProfile.full_name?.split(' ').slice(1).join(' ') || ''),
            surname: parentProfile.last_name || (parentProfile.full_name?.split(' ')[0] || ''),
            fiscal_code: parentProfile.fiscal_code || '',
            birth_date: parentProfile.date_of_birth || '',
            birth_place: parentProfile.birth_place || parentProfile.place_of_birth || '',
            address: parentProfile.address || '',
            city: parentProfile.city || '',
            province: parentProfile.province || '',
          }}
          minorInfo={{
            id: athlete.id,
            name: athlete.first_name || '',
            surname: athlete.last_name || '',
            fiscal_code: athlete.fiscal_code || '',
            birth_date: athlete.date_of_birth || '',
            birth_place: athlete.birth_place || '',
          }}
          showDeleteOption={athlete.status === 'trial' && !endTrialStatus?.end_trial_requested}
          onDeleteRequest={() => {
            setPrivacyModalVisible(false);
            if (Platform.OS === 'web') {
              const confirmed = window.confirm(
                'Sei sicuro di voler cancellare tutti i dati?\n\nQuesta azione inviera una richiesta di cancellazione all\'amministratore. Tutti i dati dell\'atleta e dei genitori verranno rimossi dopo l\'approvazione (presenze, documenti, etc.).'
              );
              if (confirmed) {
                api.post(`/athletes/${athlete.id}/request-deletion`)
                  .then(() => {
                    showAlert('Richiesta Inviata', 'La richiesta di cancellazione dei dati e stata inviata all\'amministratore.');
                    router.replace('/parent');
                  })
                  .catch(() => {
                    showAlert('Errore', 'Impossibile inviare la richiesta. Riprova.');
                  });
              }
            } else {
              Alert.alert(
                'Cancellazione Dati',
                'Sei sicuro di voler cancellare tutti i dati?\n\nQuesta azione inviera una richiesta di cancellazione all\'amministratore.',
                [
                  { text: 'Annulla', style: 'cancel' },
                  {
                    text: 'Conferma Cancellazione',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.post(`/athletes/${athlete.id}/request-deletion`);
                        showAlert('Richiesta Inviata', 'La richiesta di cancellazione dei dati e stata inviata all\'amministratore.');
                        router.replace('/parent');
                      } catch {
                        showAlert('Errore', 'Impossibile inviare la richiesta. Riprova.');
                      }
                    }
                  }
                ]
              );
            }
          }}
        />
      )}

      {/* Trial Document Signature Modal */}
      <Modal
        visible={showTrialSignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrialSignModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90%', overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ backgroundColor: '#7B1FA2', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Firma Dichiarazione di Prova</Text>
              <TouchableOpacity onPress={() => setShowTrialSignModal(false)} data-testid="trial-sign-modal-close">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Info */}
              <View style={{ backgroundColor: '#F3E5F5', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#6A1B9A', lineHeight: 20 }}>
                  Firmando questo documento autorizzi la partecipazione di <Text style={{ fontWeight: '700' }}>{athlete?.first_name || athlete?.full_name}</Text> al periodo di prova.
                  {'\n'}La tua firma digitale verr{'à'} incorporata nel documento PDF ufficiale.
                </Text>
              </View>

              {/* Signature Pad */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>Disegna la tua firma qui sotto:</Text>
              <SignaturePadInline
                ref={trialSignatureRef}
                height={180}
                penColor="#1a237e"
                backgroundColor="#fafafa"
                onSave={(sig) => setTrialSignature(sig)}
                onClear={() => setTrialSignature(null)}
              />

              {/* Confirm Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: trialSignature ? '#7B1FA2' : '#ccc',
                  paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 16,
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                  opacity: signingTrialDoc ? 0.6 : 1,
                }}
                disabled={!trialSignature || signingTrialDoc}
                onPress={async () => {
                  if (!trialSignature) return;
                  setSigningTrialDoc(true);
                  try {
                    const res = await api.post(`/athletes/${id}/sign-trial-document`, {
                      signature_base64: trialSignature,
                    }, { responseType: 'blob' });
                    const blob = new Blob([res.data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    // Reload athlete data
                    const updated = await api.get(`/athletes/${id}`);
                    setAthlete(updated.data);
                    setShowTrialSignModal(false);
                    showAlert('Successo', 'Dichiarazione di prova firmata con successo!');
                  } catch (e: any) {
                    let msg = 'Errore nella firma del documento';
                    if (e.response?.data instanceof Blob) {
                      try { const text = await e.response.data.text(); const json = JSON.parse(text); msg = json.detail || msg; } catch {}
                    } else if (e.response?.data?.detail) { msg = e.response.data.detail; }
                    showAlert('Errore', msg);
                  } finally {
                    setSigningTrialDoc(false);
                  }
                }}
                data-testid="trial-sign-confirm-button"
              >
                {signingTrialDoc ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                )}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {signingTrialDoc ? 'Firma in corso...' : 'Conferma e Firma'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.modalTitle}>Modifica Dati</Text>
            
            <ScrollView style={styles.editScroll} showsVerticalScrollIndicator={false}>
              {/* Squadra - sola lettura per genitori - RIMOSSA: La squadra è gestita solo dall'admin */}

              <Text style={styles.inputLabel}>Cognome</Text>
              <TextInput
                style={styles.textInput}
                value={editData.last_name}
                onChangeText={(text) => setEditData({...editData, last_name: text.toUpperCase()})}
                autoCapitalize="characters"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.textInput}
                value={editData.first_name}
                onChangeText={(text) => setEditData({...editData, first_name: text.toUpperCase()})}
                autoCapitalize="characters"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Data di Nascita (GG/MM/AAAA)</Text>
              <TextInput
                style={styles.textInput}
                value={editData.date_of_birth}
                onChangeText={(text) => setEditData({...editData, date_of_birth: formatDateInput(text)})}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Sesso</Text>
              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, borderWidth: 2,
                    borderColor: editData.gender === 'M' ? '#007AFF' : '#ddd',
                    backgroundColor: editData.gender === 'M' ? '#E3F2FD' : '#fff',
                    alignItems: 'center',
                  }}
                  onPress={() => setEditData({...editData, gender: 'M'})}
                >
                  <Text style={{ fontWeight: '600', color: editData.gender === 'M' ? '#007AFF' : '#666' }}>M</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, borderWidth: 2,
                    borderColor: editData.gender === 'F' ? '#E91E63' : '#ddd',
                    backgroundColor: editData.gender === 'F' ? '#FCE4EC' : '#fff',
                    alignItems: 'center',
                  }}
                  onPress={() => setEditData({...editData, gender: 'F'})}
                >
                  <Text style={{ fontWeight: '600', color: editData.gender === 'F' ? '#E91E63' : '#666' }}>F</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Stato di Nascita</Text>
              <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
                <Picker
                  selectedValue={editData.country_of_birth || DEFAULT_COUNTRY}
                  onValueChange={(value) => {
                    const updates: any = { country_of_birth: value };
                    if (value !== 'Italia' && value !== 'ITALIA') {
                      updates.birth_place = '';
                      updates.birth_province = '';
                    }
                    setEditData({...editData, ...updates});
                  }}
                  style={{ height: 50 }}
                >
                  {COUNTRIES.map((country: string) => (
                    <Picker.Item key={country} label={country} value={country} />
                  ))}
                </Picker>
              </View>

              {(() => {
                const isItalia = !editData.country_of_birth || editData.country_of_birth === 'Italia' || editData.country_of_birth === 'ITALIA';
                return (
                  <View style={styles.rowInputs}>
                    <View style={isItalia ? styles.halfInputContainer : { flex: 1 }}>
                      <Text style={styles.inputLabel}>Luogo di Nascita</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editData.birth_place}
                        onChangeText={(text) => setEditData({...editData, birth_place: text.toUpperCase()})}
                        autoCapitalize="characters"
                        placeholder={isItalia ? "es: PERUGIA" : "es: BERLINO"}
                        placeholderTextColor="#aaa"
                        returnKeyType="next"
                      />
                    </View>
                    {isItalia && (
                      <View style={styles.halfInputContainer}>
                        <Text style={styles.inputLabel}>Prov. Nascita</Text>
                        <TextInput
                          style={styles.textInput}
                          value={editData.birth_province}
                          onChangeText={(text) => setEditData({...editData, birth_province: text.toUpperCase()})}
                          autoCapitalize="characters"
                          maxLength={2}
                          placeholder="es: PG"
                          placeholderTextColor="#aaa"
                          returnKeyType="next"
                        />
                      </View>
                    )}
                  </View>
                );
              })()}

              <Text style={styles.inputLabel}>Codice Fiscale</Text>
              <TextInput
                style={[styles.textInput, { marginBottom: 4 }]}
                value={editData.fiscal_code}
                onChangeText={(text) => setEditData({...editData, fiscal_code: text.toUpperCase()})}
                autoCapitalize="characters"
                maxLength={16}
                returnKeyType="next"
              />
              <TouchableOpacity
                style={{
                  backgroundColor: '#007AFF',
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
                data-testid="calculate-cf-btn"
                onPress={() => {
                    try {
                      const dob = editData.date_of_birth;
                      const isEstero = editData.country_of_birth && editData.country_of_birth !== 'Italia' && editData.country_of_birth !== 'ITALIA';
                      
                      if (!dob || !editData.last_name || !editData.first_name || !editData.gender) {
                        Alert.alert('Dati Mancanti', 'Per calcolare il CF servono: Cognome, Nome, Data di Nascita e Sesso');
                        return;
                      }
                      if (!isEstero && !editData.birth_place) {
                        Alert.alert('Dati Mancanti', 'Compila il Luogo di Nascita per calcolare il CF');
                        return;
                      }
                      
                      let day, month, year;
                      if (dob.includes('/')) {
                        const parts = dob.split('/');
                        day = parseInt(parts[0]);
                        month = parseInt(parts[1]);
                        year = parseInt(parts[2]);
                      } else if (dob.includes('-')) {
                        const parts = dob.split('-');
                        year = parseInt(parts[0]);
                        month = parseInt(parts[1]);
                        day = parseInt(parts[2]);
                      } else {
                        const d = new Date(dob);
                        day = d.getDate();
                        month = d.getMonth() + 1;
                        year = d.getFullYear();
                      }
                      
                      const birthplaceValue = isEstero 
                        ? editData.country_of_birth.toUpperCase() 
                        : (editData.birth_place || '').toUpperCase();
                      const cf = new CodiceFiscale({
                        name: editData.first_name.toUpperCase(),
                        surname: editData.last_name.toUpperCase(),
                        gender: editData.gender as 'M' | 'F',
                        day: day,
                        month: month,
                        year: year,
                        birthplace: birthplaceValue,
                        birthplaceProvincia: isEstero ? 'EE' : (editData.birth_province?.toUpperCase() || ''),
                      });
                      
                      setEditData({...editData, fiscal_code: cf.toString()});
                      Alert.alert('Successo', 'Codice Fiscale calcolato!');
                    } catch (error: any) {
                      console.error('CF calculation error:', error);
                      Alert.alert('Errore', 'Impossibile calcolare il CF. Verifica i dati inseriti (es. comune di nascita deve essere valido).');
                    }
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Calcola CF</Text>
                </TouchableOpacity>

              <Text style={styles.inputLabel}>Indirizzo</Text>
              <TextInput
                style={styles.textInput}
                value={editData.address}
                onChangeText={(text) => setEditData({...editData, address: text.toUpperCase()})}
                autoCapitalize="characters"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Città</Text>
              <TextInput
                style={styles.textInput}
                value={editData.city}
                onChangeText={(text) => setEditData({...editData, city: text.toUpperCase()})}
                autoCapitalize="characters"
                returnKeyType="next"
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInputContainer}>
                  <Text style={styles.inputLabel}>CAP</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editData.postal_code}
                    onChangeText={(text) => setEditData({...editData, postal_code: text})}
                    keyboardType="number-pad"
                    maxLength={5}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.halfInputContainer}>
                  <Text style={styles.inputLabel}>Provincia</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editData.province}
                    onChangeText={(text) => setEditData({...editData, province: text.toUpperCase()})}
                    autoCapitalize="characters"
                    maxLength={2}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Tel. Atleta</Text>
              <TextInput
                style={styles.textInput}
                value={editData.phone_athlete}
                onChangeText={(text) => setEditData({...editData, phone_athlete: text})}
                keyboardType="phone-pad"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Tel. Padre</Text>
              <TextInput
                style={styles.textInput}
                value={editData.phone_father}
                onChangeText={(text) => setEditData({...editData, phone_father: text})}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Tel. Madre</Text>
              <TextInput
                style={styles.textInput}
                value={editData.phone_mother}
                onChangeText={(text) => setEditData({...editData, phone_mother: text})}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={editData.email}
                onChangeText={(text) => setEditData({...editData, email: text.toLowerCase()})}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Email 2° Genitore</Text>
              <TextInput
                style={styles.textInput}
                value={editData.second_parent_email}
                onChangeText={(text) => setEditData({...editData, second_parent_email: text.toLowerCase()})}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="es: madre@email.com"
                placeholderTextColor="#aaa"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Cognome Genitore (per detrazione)</Text>
              <TextInput
                style={styles.textInput}
                value={editData.tax_payer_last_name}
                onChangeText={(text) => setEditData({...editData, tax_payer_last_name: text.toUpperCase()})}
                autoCapitalize="characters"
                placeholder="es: ROSSI"
                placeholderTextColor="#aaa"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Nome Genitore (per detrazione)</Text>
              <TextInput
                style={styles.textInput}
                value={editData.tax_payer_first_name}
                onChangeText={(text) => setEditData({...editData, tax_payer_first_name: text.toUpperCase()})}
                autoCapitalize="characters"
                placeholder="es: MARIO"
                placeholderTextColor="#aaa"
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Codice Fiscale Genitore</Text>
              <TextInput
                style={styles.textInput}
                value={editData.tax_payer_fiscal_code}
                onChangeText={(text) => setEditData({...editData, tax_payer_fiscal_code: text.toUpperCase()})}
                autoCapitalize="characters"
                maxLength={16}
                placeholder="es: RSSMRA80A01H501Z"
                placeholderTextColor="#aaa"
                returnKeyType="done"
              />
            </ScrollView>

            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, styles.modalButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.buttonSecondaryText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, styles.modalButton]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                <Text style={styles.buttonText}>
                  {savingEdit ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Password Unlock Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModal}>
            <View style={styles.passwordModalHeader}>
              <Ionicons name="lock-closed" size={32} color="#FF9500" />
              <Text style={styles.passwordModalTitle}>Dati Protetti</Text>
              <Text style={styles.passwordModalSubtitle}>
                Inserisci la password per visualizzare e modificare i dati sensibili
              </Text>
            </View>
            
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#999"
              value={enteredPassword}
              onChangeText={setEnteredPassword}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              textContentType="none"
              autoFocus
            />
            
            {passwordError ? (
              <Text style={styles.passwordError}>{passwordError}</Text>
            ) : null}
            
            {/* Link reset password dati via email */}
            <TouchableOpacity
              style={{ alignSelf: 'center', marginTop: 8, marginBottom: 4, padding: 6 }}
              onPress={handleRequestDataPwReset}
              data-testid="forgot-data-password-btn"
            >
              <Text style={{ color: '#7B1FA2', fontSize: 13, textDecorationLine: 'underline' }}>
                Password dimenticata?
              </Text>
            </TouchableOpacity>
            
            <View style={styles.passwordModalButtons}>
              <TouchableOpacity
                style={[styles.passwordModalBtn, styles.passwordModalBtnCancel]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setEnteredPassword('');
                  setPasswordError('');
                }}
              >
                <Text style={styles.passwordModalBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.passwordModalBtn, styles.passwordModalBtnConfirm]}
                onPress={handleVerifyPassword}
                disabled={checkingPassword}
              >
                {checkingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.passwordModalBtnConfirmText}>Sblocca</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Data Password Reset Modal (code verification) */}
      <Modal
        visible={dataPwResetStep === 'code_sent'}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setDataPwResetStep('idle'); setDataPwResetError(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModal}>
            <View style={styles.passwordModalHeader}>
              <Ionicons name="mail-open" size={32} color="#7B1FA2" />
              <Text style={styles.passwordModalTitle}>Reset Password Dati</Text>
              <Text style={styles.passwordModalSubtitle}>
                Abbiamo inviato un codice di verifica alla tua email. Inseriscilo qui sotto con la nuova password.
              </Text>
            </View>
            
            <TextInput
              style={styles.passwordInput}
              placeholder="Codice di verifica (6 cifre)"
              placeholderTextColor="#999"
              value={dataPwResetCode}
              onChangeText={setDataPwResetCode}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
            
            <TextInput
              style={[styles.passwordInput, { marginTop: 8 }]}
              placeholder="Nuova password dati"
              placeholderTextColor="#999"
              value={dataPwResetNewPw}
              onChangeText={setDataPwResetNewPw}
              autoCapitalize="none"
            />
            
            {dataPwResetError ? (
              <Text style={styles.passwordError}>{dataPwResetError}</Text>
            ) : null}
            
            <View style={styles.passwordModalButtons}>
              <TouchableOpacity
                style={[styles.passwordModalBtn, styles.passwordModalBtnCancel]}
                onPress={() => { setDataPwResetStep('idle'); setDataPwResetCode(''); setDataPwResetNewPw(''); setDataPwResetError(''); }}
              >
                <Text style={styles.passwordModalBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.passwordModalBtn, { backgroundColor: '#7B1FA2', opacity: dataPwResetCode.length === 6 && dataPwResetNewPw.length >= 4 ? 1 : 0.5 }]}
                onPress={handleConfirmDataPwReset}
                disabled={dataPwResetCode.length !== 6 || dataPwResetNewPw.length < 4}
              >
                <Text style={styles.passwordModalBtnConfirmText}>Conferma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Minor PIN Setup Modal */}
      <Modal
        visible={minorPinModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMinorPinModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' }}>
              {minorHasPin ? 'Modifica PIN Atleta' : 'Imposta PIN Atleta'}
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 20, textAlign: 'center' }}>
              Il PIN deve essere di 4-6 cifre. {athlete?.first_name || "L'atleta"} lo usera per accedere alla propria dashboard.
            </Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 14, fontSize: 20, textAlign: 'center', letterSpacing: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' }}
              placeholder="PIN"
              placeholderTextColor="#bbb"
              value={minorNewPin}
              onChangeText={setMinorNewPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              data-testid="minor-pin-input"
            />
            <TextInput
              style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 14, fontSize: 20, textAlign: 'center', letterSpacing: 8, marginBottom: 20, borderWidth: 1, borderColor: '#e0e0e0' }}
              placeholder="Conferma PIN"
              placeholderTextColor="#bbb"
              value={minorConfirmPin}
              onChangeText={setMinorConfirmPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              data-testid="minor-pin-confirm-input"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={() => setMinorPinModalVisible(false)}
              >
                <Text style={{ fontWeight: '600', color: '#666' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#34C759', borderRadius: 10, padding: 14, alignItems: 'center', opacity: savingMinorPin ? 0.6 : 1 }}
                disabled={savingMinorPin}
                onPress={async () => {
                  if (!minorNewPin || minorNewPin.length < 4) {
                    showAlert('Errore', 'Il PIN deve avere almeno 4 cifre');
                    return;
                  }
                  if (minorNewPin !== minorConfirmPin) {
                    showAlert('Errore', 'I PIN non coincidono');
                    return;
                  }
                  setSavingMinorPin(true);
                  try {
                    await api.post(`/athletes/${id}/set-minor-pin`, { pin: minorNewPin });
                    setMinorHasPin(true);
                    setMinorAccessEnabled(true);
                    setMinorPinModalVisible(false);
                    showAlert('Successo', `PIN impostato! ${athlete?.first_name || "L'atleta"} puo ora accedere con il codice ${minorAthleteCode} e il PIN.`);
                  } catch (e: any) {
                    showAlert('Errore', e.response?.data?.detail || 'Errore nel salvataggio');
                  } finally {
                    setSavingMinorPin(false);
                  }
                }}
                data-testid="minor-pin-save-button"
              >
                {savingMinorPin ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontWeight: '600', color: '#fff' }}>Salva PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Code Modal */}
      <Modal
        visible={customCodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCustomCodeModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' }}>
              Personalizza Codice Atleta
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, textAlign: 'center' }}>
              Scegli un codice facile da ricordare (minimo 6 caratteri).
            </Text>
            <Text style={{ fontSize: 12, color: '#999', marginBottom: 16, textAlign: 'center' }}>
              Esempi: MARTA2016, SARA.PG, LUCA-VOLLEY
            </Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 14, fontSize: 18, textAlign: 'center', letterSpacing: 2, marginBottom: 16, borderWidth: 1, borderColor: '#e0e0e0' }}
              placeholder="Nuovo codice"
              placeholderTextColor="#bbb"
              value={customCode}
              onChangeText={(t) => setCustomCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={20}
              data-testid="custom-code-input"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={() => setCustomCodeModalVisible(false)}
              >
                <Text style={{ fontWeight: '600', color: '#666' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1565C0', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={async () => {
                  if (!customCode || customCode.trim().length < 6) {
                    showAlert('Errore', 'Il codice deve avere almeno 6 caratteri');
                    return;
                  }
                  try {
                    const res = await api.post(`/athletes/${id}/set-custom-code`, { code: customCode.trim() });
                    setMinorAthleteCode(res.data.athlete_code);
                    setCustomCodeModalVisible(false);
                    showAlert('Successo', `Codice aggiornato: ${res.data.athlete_code}`);
                  } catch (e: any) {
                    showAlert('Errore', e.response?.data?.detail || 'Errore nel salvataggio');
                  }
                }}
                data-testid="custom-code-save-button"
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>Salva Codice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Nome Lite */}
      <Modal
        visible={nomeLiteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNomeLiteModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' }}>
              Imposta Nome Lite
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 16, textAlign: 'center' }}>
              Scegli un nome facile da ricordare per l'accesso Lite (3-20 caratteri). Deve essere unico.
            </Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 14, fontSize: 16, textAlign: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#e0e0e0' }}
              placeholder="Es: MartinaG, Marti08"
              placeholderTextColor="#bbb"
              value={nomeLiteInput}
              onChangeText={setNomeLiteInput}
              autoCapitalize="none"
              maxLength={20}
              data-testid="nome-lite-input"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={() => setNomeLiteModalVisible(false)}
              >
                <Text style={{ fontWeight: '600', color: '#666' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1565C0', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={async () => {
                  if (!nomeLiteInput || nomeLiteInput.trim().length < 3) {
                    showAlert('Errore', 'Il nome deve avere almeno 3 caratteri');
                    return;
                  }
                  try {
                    const res = await api.post(`/athletes/${id}/set-nome-lite`, { nome_lite: nomeLiteInput.trim() });
                    setAthlete((prev: any) => prev ? { ...prev, nome_lite: res.data.nome_lite } : prev);
                    setNomeLiteModalVisible(false);
                    showAlert('Successo', `Nome Lite impostato: ${res.data.nome_lite}`);
                  } catch (e: any) {
                    showAlert('Errore', e.response?.data?.detail || 'Errore nel salvataggio');
                  }
                }}
                data-testid="nome-lite-save-button"
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>Salva</Text>
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
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
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
  qrButton: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  qrButtonText: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 12,
  },
  statusTextDanger: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 12,
  },
  statusTextSuccess: {
    flex: 1,
    fontSize: 14,
    color: '#34C759',
    marginLeft: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  certInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  certDetails: {
    flex: 1,
    marginLeft: 12,
  },
  certLabel: {
    fontSize: 14,
    color: '#333',
  },
  certExpired: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: 'bold',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSuccess: {
    backgroundColor: '#34C759',
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentSummaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginTop: 8,
    paddingTop: 12,
  },
  paymentSummaryLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  paymentSummaryValueBold: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
  },
  scheduleSection: {
    marginBottom: 8,
  },
  scheduleSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  scheduleItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  scheduleDay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleDayText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
    marginLeft: 8,
  },
  scheduleDetails: {
    marginLeft: 24,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  scheduleVenue: {
    fontSize: 13,
    color: '#666',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentOverdue: {
    backgroundColor: '#FFF5F5',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  paymentStatusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  residuoRow: {
    backgroundColor: '#f0f0f0',
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
  },
  residuoAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 4,
  },
  paymentDue: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentInstructions: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  privacyScroll: {
    maxHeight: 350,
    marginBottom: 20,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  privacyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  privacyNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  privacyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  doubleConfirmText: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  // Certificate Modal Styles
  certModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  expiryDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8E8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  expiryDateText: {
    fontSize: 14,
    color: '#34C759',
    marginLeft: 10,
    fontWeight: '600',
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  selectedFileName: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  certModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  // Status toggle styles
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
  },
  statusToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  statusToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusToggleSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  statusToggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9500',
    padding: 3,
    justifyContent: 'center',
  },
  statusToggleActive: {
    backgroundColor: '#34C759',
  },
  statusToggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  statusToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  statusToggleText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  // Data display styles
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  editButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  lockButtonText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 4,
    fontWeight: '500',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  lockedBannerText: {
    fontSize: 13,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
  },
  passwordModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  passwordModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  passwordModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  passwordInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  passwordError: {
    color: '#FF3B30',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  passwordModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  passwordModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  passwordModalBtnCancel: {
    backgroundColor: '#f0f0f0',
  },
  passwordModalBtnCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordModalBtnConfirm: {
    backgroundColor: '#FF9500',
  },
  passwordModalBtnConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'flex-start',
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
    marginRight: 12,
  },
  dataValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  // Edit Modal styles
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '95%',
    maxHeight: '90%',
  },
  editScroll: {
    maxHeight: 450,
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInputContainer: {
    flex: 1,
    marginRight: 8,
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // QR Code sharing styles
  qrCodeContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  qrCodeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#666',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    letterSpacing: 1,
  },
  qrButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  qrActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 130,
  },
  printButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
  },
  qrActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Certificate buttons row
  certButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  buttonView: {
    backgroundColor: '#E8F4FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonViewText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  // View Certificate Modal
  viewCertModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '85%',
    alignItems: 'center',
  },
  certImageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  certImage: {
    width: '100%',
    height: 350,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  certInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  certInfoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  certExpiredText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  // Team Picker styles
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    overflow: 'hidden',
    minHeight: 56,
  },
  picker: {
    height: 56,
    width: '100%',
  },
  // Delete athlete styles
  deleteSection: {
    margin: 16,
    marginTop: 8,
    marginBottom: 40,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
  },
  downloadReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  downloadReceiptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  manualPaymentsSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  manualPaymentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 12,
  },
  manualPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  manualPaymentInfo: {
    flex: 1,
  },
  manualPaymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  manualPaymentDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  deleteRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderColor: '#FF3B30',
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
  },
  deleteRequestButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteWarning: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Certificate Viewer Full Screen styles
  certViewerFullScreen: { 
    flex: 1, 
    backgroundColor: '#fff',
  },
  certViewerHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingTop: 50, 
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  certViewerBackBtn: {
    padding: 8,
  },
  certViewerTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333',
  },
  certActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  printBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  shareBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  printBtnText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  certViewerScrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  certViewerScrollContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  certViewerImageFull: { 
    width: '100%', 
    height: 500,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  certViewerFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  certViewerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  certViewerInfoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  closeCertBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  closeCertBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Athlete photo styles
  photoContainer: { alignItems: 'center', paddingVertical: 16 },
  athletePhotoLarge: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#f0f0f0' },
  photoPlaceholder: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  photoPlaceholderText: { color: '#aaa', fontSize: 14, marginTop: 8 },
  transformingText: { color: '#007AFF', fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  uploadPhotoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, marginTop: 16, gap: 8 },
  uploadPhotoButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  photoHint: { color: '#888', fontSize: 12, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
  buttonDisabled: { opacity: 0.5 },
  // Coach info styles
  coachInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  coachInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  coachInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachPhotoSmall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  coachPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachInfoDetails: {
    flex: 1,
    marginLeft: 12,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  coachContactHint: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  coachPhotoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachPhotoModalContent: {
    alignItems: 'center',
    padding: 20,
  },
  coachPhotoModalName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  coachPhotoLarge: {
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  closeCoachPhotoBtn: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#333',
    borderRadius: 25,
  },
  closeCoachPhotoBtnText: {
    color: '#fff',
    fontSize: 16,
  },
});
