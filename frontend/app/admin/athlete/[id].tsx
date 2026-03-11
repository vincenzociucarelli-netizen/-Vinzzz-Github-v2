import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { Athlete, Team, Payment, Certificate } from '../../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { downloadFiscalReceipt, ReceiptData } from '../../../src/utils/fiscalReceipt';
import CodiceFiscale from 'codice-fiscale-js';
import { SportIcon } from '../../../src/components/SportIcon';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../../src/store/authStore';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../../src/constants/countries';

import { formatCurrency, formatAmount } from '../../../src/utils/formatCurrency';
interface PaymentSummary {
  total_due: number;
  discount: number;
  discount_note: string;
  total_after_discount: number;
  total_paid: number;
  residual: number;
  installments: {
    first: number;
    second: number;
    third: number;
  };
}

interface AthleteAttendanceStats {
  total_attendances: number;
  weekly_attendances: number;
  monthly_attendances: number;
  total_percentage: number;
  monthly_percentage: number;
  weekly_percentage: number;
}

export default function AdminAthleteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [stats, setStats] = useState<AthleteAttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dati' | 'pagamenti' | 'presenze'>('dati');
  
  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  
  // Withdraw modal
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  
  // Reactivate modal with team selection
  const [reactivateModalVisible, setReactivateModalVisible] = useState(false);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [reactivating, setReactivating] = useState(false);
  
  // Add/Edit payment modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    paid_date: '',
    is_cash: false,
    notes: '',
    description: '',
    payment_method: 'Bonifico',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // Certificate modal
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certExpiryDate, setCertExpiryDate] = useState('');
  const [certIssueDate, setCertIssueDate] = useState('');
  const [certValidityMonths, setCertValidityMonths] = useState('12');
  const [certImage, setCertImage] = useState<string | null>(null);
  const [certVerified, setCertVerified] = useState(false);
  const [savingCert, setSavingCert] = useState(false);
  
  // Certificate viewer modal
  const [certViewerVisible, setCertViewerVisible] = useState(false);
  
  // Society data for receipt
  const [societyData, setSocietyData] = useState<any>(null);
  
  // Athlete photo states
  const [athletePhoto, setAthletePhoto] = useState<string | null>(null);
  const [athletePhotoArtistic, setAthletePhotoArtistic] = useState<string | null>(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  
  // Technical data
  const [athleteRole, setAthleteRole] = useState('');
  const [athleteHeight, setAthleteHeight] = useState('');
  const [athleteWeight, setAthleteWeight] = useState('');
  const [athleteElevation, setAthleteElevation] = useState('');
  const [athleteNotes, setAthleteNotes] = useState('');
  const [athleteCharacteristics, setAthleteCharacteristics] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableCharacteristics, setAvailableCharacteristics] = useState<string[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  
  // Athlete type for adult athletes (quota vs compensated)
  const [athleteType, setAthleteType] = useState<'quota' | 'compensated'>('quota');
  const [changingType, setChangingType] = useState(false);
  
  // Compensation data (for compensated athletes)
  const [compensation, setCompensation] = useState<any>(null);
  const [compensationModalVisible, setCompensationModalVisible] = useState(false);
  const [compensationAmount, setCompensationAmount] = useState('');
  const [compensationStartDate, setCompensationStartDate] = useState('');
  const [compensationEndDate, setCompensationEndDate] = useState('');
  const [savingCompensation, setSavingCompensation] = useState(false);
  
  // QR Code modal
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const qrCodeRef = useRef<View>(null);
  
  // Reset data password modal
  const [resetDataPasswordVisible, setResetDataPasswordVisible] = useState(false);
  const [newDataPassword, setNewDataPassword] = useState('');
  const [resettingDataPassword, setResettingDataPassword] = useState(false);
  const [hasDataPassword, setHasDataPassword] = useState(false);
  
  // Reset account password (for athlete login)
  const [resetAccountPasswordVisible, setResetAccountPasswordVisible] = useState(false);
  const [resettingAccountPassword, setResettingAccountPassword] = useState(false);
  
  // Detach parents
  const [detachingParents, setDetachingParents] = useState(false);
  
  // Delete athlete
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pickCertImage = async () => {
    // Show action sheet to choose camera or gallery
    if (Platform.OS === 'web') {
      // On web, directly launch gallery (camera not well supported)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      
      if (!result.canceled && result.assets[0].base64) {
        setCertImage(result.assets[0].base64);
      }
    } else {
      // On mobile, show options
      Alert.alert(
        'Carica Certificato',
        'Come vuoi caricare l\'immagine?',
        [
          {
            text: 'Scatta Foto',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                showAlert('Permesso negato', 'È necessario il permesso per usare la fotocamera');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.7,
                base64: true,
              });
              if (!result.canceled && result.assets[0].base64) {
                setCertImage(result.assets[0].base64);
              }
            },
          },
          {
            text: 'Scegli dalla Galleria',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.7,
                base64: true,
              });
              if (!result.canceled && result.assets[0].base64) {
                setCertImage(result.assets[0].base64);
              }
            },
          },
          { text: 'Annulla', style: 'cancel' },
        ]
      );
    }
  };

  // Formatta automaticamente la data come GG/MM/AAAA
  const formatDateInput = (text: string) => {
    // Rimuovi tutto tranne i numeri
    const numbers = text.replace(/\D/g, '');
    
    // Formatta come GG/MM/AAAA
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
    
    setCertExpiryDate(formatted);
  };

  const loadData = async () => {
    try {
      const [athleteRes, paymentsRes, certRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/payments/${id}`),
        api.get(`/certificates/${id}`).catch(() => ({ data: null })),
      ]);

      const athleteData = athleteRes.data;
      setAthlete(athleteData);
      setPayments(paymentsRes.data);
      setCertificate(certRes.data);
      
      // Load athlete type (for adult athletes)
      setAthleteType(athleteData.athlete_type || 'quota');
      
      // Load compensation data if compensated athlete
      if (athleteData.athlete_type === 'compensated') {
        try {
          const compRes = await api.get(`/athletes/${id}/compensation`);
          setCompensation(compRes.data);
        } catch (e) {
          setCompensation(null);
        }
      }
      
      // Load athlete photo
      setAthletePhoto(athleteData.athlete_photo || null);
      setAthletePhotoArtistic(athleteData.athlete_photo_artistic || null);
      
      // Load technical data
      setAthleteRole(athleteData.athlete_role || '');
      setAthleteHeight(athleteData.athlete_height?.toString() || '');
      setAthleteWeight(athleteData.athlete_weight?.toString() || '');
      setAthleteElevation(athleteData.athlete_elevation?.toString() || '');
      setAthleteNotes(athleteData.athlete_notes || '');
      setAthleteCharacteristics(athleteData.athlete_characteristics || []);
      
      // Load available roles and characteristics from settings
      try {
        const settingsRes = await api.get('/settings/society');
        setAvailableRoles(settingsRes.data.athlete_roles || []);
        setAvailableCharacteristics(settingsRes.data.athlete_characteristics || []);
        setSocietyData(settingsRes.data); // Save full society data for receipt
      } catch (e) {
        console.log('Could not load settings');
      }
      
      // Load all teams for team change dropdown
      try {
        const teamsRes = await api.get('/teams');
        setAllTeams(teamsRes.data);
      } catch (e) {
        console.log('Could not load teams');
      }
      
      // Populate edit data
      setEditData({
        federal_code: athleteData.federal_code || '',
        is_registered: athleteData.is_registered || false,
        last_name: athleteData.last_name || athleteData.full_name?.split(' ')[0] || '',
        first_name: athleteData.first_name || athleteData.full_name?.split(' ').slice(1).join(' ') || '',
        date_of_birth: athleteData.date_of_birth ? formatDateForInput(athleteData.date_of_birth) : '',
        birth_place: athleteData.birth_place || '',
        birth_province: athleteData.birth_province || '',
        country_of_birth: athleteData.country_of_birth || DEFAULT_COUNTRY,
        fiscal_code: athleteData.fiscal_code || '',
        email: athleteData.email || '',
        phone_athlete: athleteData.phone_athlete || '',
        phone_mother: athleteData.phone_mother || '',
        phone_father: athleteData.phone_father || '',
        address: athleteData.address || '',
        postal_code: athleteData.postal_code || '',
        city: athleteData.city || '',
        province: athleteData.province || '',
        discount_amount: athleteData.discount_amount?.toString() || '0',
        discount_note: athleteData.discount_note || '',
        // Technical data
        athlete_role: athleteData.athlete_role || '',
        athlete_height: athleteData.athlete_height?.toString() || '',
        athlete_weight: athleteData.athlete_weight?.toString() || '',
        athlete_elevation: athleteData.athlete_elevation?.toString() || '',
        athlete_notes: athleteData.athlete_notes || '',
        // Second parent
        second_parent_email: athleteData.second_parent_email || '',
        // Team
        team_id: athleteData.team_id || '',
        team_id_2: athleteData.team_id_2 || '',
        // Athlete code for payment import
        athlete_code: athleteData.athlete_code || '',
      });

      // Load team info
      if (athleteData.team_id) {
        const teamRes = await api.get(`/teams/${athleteData.team_id}`);
        setTeam(teamRes.data);
        
        // Load payment summary
        try {
          const summaryRes = await api.get(`/payments/${id}/summary`);
          setPaymentSummary(summaryRes.data);
        } catch (e) {
          console.log('Could not load payment summary');
        }
        
        // Load attendance stats
        try {
          const statsRes = await api.get(`/teams/${athleteData.team_id}/attendance-stats`);
          const athleteStats = statsRes.data.athletes.find((a: any) => a.athlete_id === id);
          if (athleteStats) {
            setStats(athleteStats);
          }
        } catch (e) {
          console.log('Could not load attendance stats');
        }
      }
      
      // Check if athlete has data password
      try {
        const hasPassRes = await api.get(`/athletes/${id}/has-password`);
        setHasDataPassword(hasPassRes.data.has_password);
      } catch (e) {
        console.log('Could not check data password');
      }
    } catch (error) {
      console.error('Error loading athlete data:', error);
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

  const handleResetDataPassword = async () => {
    if (!newDataPassword || newDataPassword.length < 4) {
      showAlert('Errore', 'La password deve essere di almeno 4 caratteri');
      return;
    }
    
    setResettingDataPassword(true);
    try {
      await api.patch(`/athletes/${id}/reset-data-password`, {
        new_password: newDataPassword
      });
      showAlert('Successo', `Password modifiche resettata per ${athlete?.first_name} ${athlete?.last_name}`);
      setResetDataPasswordVisible(false);
      setNewDataPassword('');
      setHasDataPassword(true);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile resettare la password');
    } finally {
      setResettingDataPassword(false);
    }
  };

  // Reset account password (for athlete login) - sends email with reset link
  const handleResetAccountPassword = async () => {
    if (!athlete?.email) {
      showAlert('Errore', 'L\'atleta non ha un indirizzo email registrato. Aggiungi prima un\'email valida.');
      return;
    }
    
    setResettingAccountPassword(true);
    try {
      const response = await api.post(`/admin/athletes/${id}/reset-password`, {
        send_email: true
      });
      showAlert(
        '✅ Email Inviata', 
        `Email di reset password inviata a ${response.data.email}.\n\nL'atleta riceverà un codice da inserire per impostare una nuova password.`
      );
      setResetAccountPasswordVisible(false);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile inviare l\'email di reset password');
    } finally {
      setResettingAccountPassword(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  // Format date for input field (ISO to dd/mm/yyyy)
  const formatDateForInput = (dateStr: string) => {
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

  // Auto-format date input as dd/mm/yyyy
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

  const handleSaveData = async () => {
    setSaving(true);
    try {
      // Convert date_of_birth from dd/mm/yyyy to ISO
      let dateOfBirthISO = null;
      if (editData.date_of_birth) {
        const parts = editData.date_of_birth.split('/');
        if (parts.length === 3) {
          const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(date.getTime())) {
            dateOfBirthISO = date.toISOString();
          }
        }
      }

      const updatePayload: any = {
        federal_code: editData.federal_code || null,
        is_registered: editData.is_registered,
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`.trim(),
        date_of_birth: dateOfBirthISO,
        birth_place: editData.birth_place || null,
        birth_province: editData.birth_province || null,
        country_of_birth: editData.country_of_birth || DEFAULT_COUNTRY,
        fiscal_code: editData.fiscal_code || null,
        email: editData.email || null,
        phone_athlete: editData.phone_athlete || null,
        phone_mother: editData.phone_mother || null,
        phone_father: editData.phone_father || null,
        address: editData.address || null,
        postal_code: editData.postal_code || null,
        city: editData.city || null,
        province: editData.province || null,
        discount_amount: parseFloat(editData.discount_amount) || 0,
        discount_note: editData.discount_note || null,
        // Technical data
        athlete_role: editData.athlete_role || null,
        athlete_height: editData.athlete_height ? parseInt(editData.athlete_height) : null,
        athlete_weight: editData.athlete_weight ? parseInt(editData.athlete_weight) : null,
        athlete_elevation: editData.athlete_elevation ? parseInt(editData.athlete_elevation) : null,
        athlete_notes: editData.athlete_notes || null,
        // Second parent
        second_parent_email: editData.second_parent_email?.toLowerCase().trim() || null,
        // Team change
        team_id: editData.team_id || athlete?.team_id || null,
        team_id_2: editData.team_id_2 || null,
        // Athlete code for payment import
        athlete_code: editData.athlete_code?.toUpperCase().trim() || null,
      };

      await api.patch(`/athletes/${id}`, updatePayload);
      
      showAlert('Successo', 'Dati salvati con successo');
      setEditing(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.amount || !newPayment.paid_date) {
      showAlert('Errore', 'Inserisci importo e data');
      return;
    }

    // CONFERMA OBBLIGATORIA prima di salvare
    const athleteName = `${athlete?.last_name?.toUpperCase() || ''} ${athlete?.first_name?.toUpperCase() || ''}`.trim();
    const amount = parseFloat(newPayment.amount);
    const confirmMessage = editingPaymentId 
      ? `Confermi la MODIFICA del pagamento?\n\nAtleta: ${athleteName}\nImporto: € ${amount.toFixed(2)}\nData: ${newPayment.paid_date}`
      : `Confermi la REGISTRAZIONE del pagamento?\n\nAtleta: ${athleteName}\nImporto: € ${amount.toFixed(2)}\nData: ${newPayment.paid_date}\nMetodo: ${newPayment.payment_method || 'Bonifico'}`;
    
    if (Platform.OS === 'web') {
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setSavingPayment(true);
    try {
      if (editingPaymentId) {
        // Update existing payment
        await api.put(`/payments/manual/${editingPaymentId}`, {
          amount: amount,
          paid_date: newPayment.paid_date,
          is_cash: newPayment.is_cash,
          notes: newPayment.notes || null,
          description: newPayment.description || null,
          payment_method: newPayment.payment_method || 'Bonifico',
        });
        showAlert('Successo', `Pagamento per ${athleteName} modificato correttamente`);
      } else {
        // Create new payment
        await api.post('/payments/manual', {
          athlete_id: id,
          amount: amount,
          paid_date: newPayment.paid_date,
          is_cash: newPayment.is_cash,
          notes: newPayment.notes || null,
          description: newPayment.description || null,
          payment_method: newPayment.payment_method || 'Bonifico',
        });
        showAlert('Successo', `Pagamento di € ${amount.toFixed(2)} registrato per ${athleteName}`);
      }

      setPaymentModalVisible(false);
      setEditingPaymentId(null);
      setNewPayment({ amount: '', paid_date: '', is_cash: false, notes: '', description: '', payment_method: 'Bonifico' });
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleEditPayment = (payment: any) => {
    // Convert date to dd/mm/yyyy format for input
    let formattedDate = '';
    if (payment.paid_date) {
      try {
        const date = new Date(payment.paid_date);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      } catch {
        formattedDate = payment.paid_date;
      }
    }

    setEditingPaymentId(payment.id);
    setNewPayment({
      amount: payment.amount?.toString() || '',
      paid_date: formattedDate,
      is_cash: payment.is_cash || false,
      notes: payment.notes || '',
      description: payment.description || '',
      payment_method: payment.payment_method || 'Bonifico',
    });
    setPaymentModalVisible(true);
  };

  const openNewPaymentModal = () => {
    setEditingPaymentId(null);
    setNewPayment({ amount: '', paid_date: '', is_cash: false, notes: '', description: '', payment_method: 'Bonifico' });
    setPaymentModalVisible(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Sei sicuro di voler eliminare questo pagamento?')
      : await new Promise((resolve) => {
          Alert.alert('Conferma', 'Eliminare questo pagamento?', [
            { text: 'Annulla', onPress: () => resolve(false) },
            { text: 'Elimina', onPress: () => resolve(true), style: 'destructive' },
          ]);
        });

    if (confirmed) {
      try {
        await api.delete(`/payments/${paymentId}`);
        showAlert('Successo', 'Pagamento eliminato');
        await loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore');
      }
    }
  };

  // Withdraw athlete
  const handleWithdrawAthlete = async () => {
    setWithdrawing(true);
    try {
      await api.patch(`/athletes/${id}`, {
        is_withdrawn: true,
        withdrawn_reason: withdrawReason || 'Ritiro dalla squadra',
      });
      showAlert('Successo', 'Atleta ritirato dalla squadra');
      setWithdrawModalVisible(false);
      setWithdrawReason('');
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il ritiro');
    } finally {
      setWithdrawing(false);
    }
  };

  // Reactivate athlete - open modal to select team
  const handleReactivateAthlete = async () => {
    // Load all teams first
    try {
      const teamsRes = await api.get('/teams');
      setAllTeams(teamsRes.data);
      // Pre-select current team if exists
      if (athlete?.team_id) {
        setSelectedTeamId(athlete.team_id);
      }
      setReactivateModalVisible(true);
    } catch (error) {
      showAlert('Errore', 'Impossibile caricare le squadre');
    }
  };

  // Confirm reactivation with selected team
  const confirmReactivation = async () => {
    if (!selectedTeamId) {
      showAlert('Errore', 'Seleziona una squadra');
      return;
    }

    setReactivating(true);
    try {
      await api.patch(`/athletes/${id}`, {
        is_withdrawn: false,
        team_id: selectedTeamId,
      });
      showAlert('Successo', 'Atleta riattivato e assegnato alla nuova squadra');
      setReactivateModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la riattivazione');
    } finally {
      setReactivating(false);
    }
  };

  // Delete athlete permanently
  const handleDeleteAthlete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/athletes/${id}`);
      showAlert('Successo', 'Atleta eliminato definitivamente');
      setDeleteModalVisible(false);
      router.back();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
    } finally {
      setDeleting(false);
    }
  };

  // Change athlete type (quota <-> compensated)
  const handleChangeAthleteType = async (newType: 'quota' | 'compensated') => {
    const typeLabel = newType === 'quota' ? 'paga quota' : 'riceve compenso';
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Confermi di voler impostare questo atleta come "${typeLabel}"?\n\n${newType === 'quota' 
          ? 'Verranno create le rate di pagamento in base alla squadra.'
          : 'Le rate di pagamento verranno rimosse e potrai configurare il compenso.'}`)
      : await new Promise(resolve => {
          Alert.alert(
            'Cambia Tipo Atleta',
            `Confermi di voler impostare questo atleta come "${typeLabel}"?\n\n${newType === 'quota' 
              ? 'Verranno create le rate di pagamento in base alla squadra.'
              : 'Le rate di pagamento verranno rimosse e potrai configurare il compenso.'}`,
            [
              { text: 'Annulla', onPress: () => resolve(false) },
              { text: 'Conferma', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirm) return;
    
    setChangingType(true);
    try {
      await api.patch(`/athletes/${id}`, { athlete_type: newType });
      setAthleteType(newType);
      showAlert('Successo', `Atleta impostato come "${typeLabel}"`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio tipo');
    } finally {
      setChangingType(false);
    }
  };

  // Save athlete compensation
  const handleSaveCompensation = async () => {
    if (!compensationAmount || parseFloat(compensationAmount) <= 0) {
      showAlert('Errore', 'Inserisci un importo valido');
      return;
    }
    
    setSavingCompensation(true);
    try {
      await api.post(`/athletes/${id}/compensation`, {
        monthly_amount: parseFloat(compensationAmount),
        start_date: compensationStartDate || null,
        end_date: compensationEndDate || null,
      });
      showAlert('Successo', 'Compenso salvato con successo');
      setCompensationModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingCompensation(false);
    }
  };

  // Detach parents from adult athlete
  const handleDetachParents = async () => {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Confermi di voler sganciare i genitori da questo atleta maggiorenne?\n\nI dati dei genitori rimarranno salvati ma non saranno più visibili.')
      : await new Promise(resolve => {
          Alert.alert(
            'Sgancia Genitori',
            'Confermi di voler sganciare i genitori da questo atleta maggiorenne?\n\nI dati dei genitori rimarranno salvati ma non saranno più visibili.',
            [
              { text: 'Annulla', onPress: () => resolve(false) },
              { text: 'Conferma', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirm) return;
    
    setDetachingParents(true);
    try {
      await api.post(`/athletes/${id}/detach-parents`);
      showAlert('Successo', 'Genitori sganciati con successo');
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante lo sgancio genitori');
    } finally {
      setDetachingParents(false);
    }
  };

  // Reattach parents to athlete
  const handleReattachParents = async () => {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Vuoi ricollegare i genitori a questo atleta?')
      : await new Promise(resolve => {
          Alert.alert(
            'Ricollega Genitori',
            'Vuoi ricollegare i genitori a questo atleta?',
            [
              { text: 'Annulla', onPress: () => resolve(false) },
              { text: 'Conferma', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirm) return;
    
    setDetachingParents(true);
    try {
      await api.post(`/athletes/${id}/reattach-parents`);
      showAlert('Successo', 'Genitori ricollegati con successo');
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il ricollegamento');
    } finally {
      setDetachingParents(false);
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return '#34C759';
    if (percentage >= 50) return '#FF9500';
    return '#FF3B30';
  };

  const handleSaveCertificate = async () => {
    if (!certIssueDate) {
      showAlert('Errore', 'Inserisci la data di emissione');
      return;
    }
    
    // Converti da DD/MM/YYYY a Date
    const parts = certIssueDate.split('/');
    if (parts.length !== 3) {
      showAlert('Errore', 'Formato data non valido. Usa GG/MM/AAAA');
      return;
    }
    
    const issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(issueDate.getTime())) {
      showAlert('Errore', 'Data non valida');
      return;
    }
    
    // Calcola data di scadenza: giorno prima dello stesso giorno/mese dell'anno dopo
    const expiryDate = new Date(issueDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    expiryDate.setDate(expiryDate.getDate() - 1);
    
    setSavingCert(true);
    try {
      const response = await api.post('/certificates/simple', {
        athlete_id: id,
        issue_date: issueDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        verified: certVerified,
      });
      setCertificate({
        id: response.data.id,
        athlete_id: id as string,
        expiry_date: response.data.expiry_date,
        verified: response.data.verified,
      });
      setCertModalVisible(false);
      setCertIssueDate('');
      setCertVerified(false);
      showAlert('Successo', 'Certificato medico salvato');
    } catch (error: any) {
      console.error('Error saving certificate:', error);
      showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
    } finally {
      setSavingCert(false);
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
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  if (!athlete) {
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
          <Text>Atleta non trovato</Text>
        </View>
      </View>
    );
  }

  const isCertificateExpired = certificate && new Date(certificate.expiry_date) < new Date();
  const isCertificateExpiringSoon = certificate && !isCertificateExpired && 
    new Date(certificate.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  // Determine certificate color: red=expired, orange=expiring soon, green=valid
  const getCertificateColor = () => {
    if (isCertificateExpired) return '#FF3B30'; // Red
    if (isCertificateExpiringSoon) return '#FF9500'; // Orange
    if (!certificate?.verified) return '#FF9500'; // Orange - not yet verified
    return '#34C759'; // Green - valid and verified
  };

  // Generate payment statement (attestato di versamento)
  const generatePaymentStatement = async (action: 'print' | 'share') => {
    if (!athlete) {
      showAlert('Attenzione', 'Dati atleta non disponibili');
      return;
    }

    try {
      // Check if athlete is adult (no parent_id means adult)
      const isAdultAthlete = !(athlete as any).parent_id;
      
      // Get current season
      const now = new Date();
      const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const season = `${year}/${year + 1}`;

      // For adult athletes, use a simple receipt (same as what the athlete sees)
      if (isAdultAthlete) {
        const paidPayments = payments.filter((p: any) => p.paid_date || p.paid === true);
        const totalPaid = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Simple receipt HTML for adult athletes - A4 optimized
        const simpleReceiptHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ricevuta Pagamenti - ${(athlete as any).last_name || ''} ${(athlete as any).first_name || ''}</title>
            <style>
              @page {
                size: A4;
                margin: 20mm;
              }
              * {
                box-sizing: border-box;
              }
              body {
                font-family: Arial, Helvetica, sans-serif;
                margin: 0;
                padding: 0;
                background: #fff;
                color: #333;
                font-size: 14px;
                line-height: 1.5;
              }
              .receipt-container {
                width: 100%;
                max-width: 210mm;
                min-height: 297mm;
                margin: 0 auto;
                padding: 15mm;
                background: #fff;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 3px solid #007AFF;
              }
              .header h1 {
                font-size: 28px;
                margin: 0 0 10px 0;
                color: #007AFF;
                letter-spacing: 2px;
              }
              .society-name {
                font-size: 18px;
                font-weight: bold;
                color: #333;
                margin: 10px 0;
              }
              .season {
                font-size: 14px;
                color: #666;
              }
              .section {
                margin-bottom: 25px;
              }
              .section-title {
                font-size: 16px;
                font-weight: bold;
                color: #007AFF;
                border-bottom: 2px solid #007AFF;
                padding-bottom: 8px;
                margin-bottom: 15px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
              }
              .info-label {
                color: #666;
                font-size: 14px;
              }
              .info-value {
                font-weight: bold;
                font-size: 14px;
                color: #333;
              }
              .payments-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              .payments-table th {
                background: #f5f5f5;
                padding: 12px;
                text-align: left;
                font-size: 13px;
                color: #666;
                border-bottom: 2px solid #ddd;
              }
              .payments-table td {
                padding: 12px;
                border-bottom: 1px solid #eee;
                font-size: 14px;
              }
              .payments-table .amount {
                text-align: right;
                font-weight: bold;
                color: #4CAF50;
                font-size: 16px;
              }
              .payments-table .method {
                color: #888;
                font-size: 12px;
                font-style: italic;
              }
              .total-section {
                margin-top: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                text-align: right;
              }
              .total-label {
                font-size: 16px;
                color: #666;
              }
              .total-amount {
                font-size: 28px;
                font-weight: bold;
                color: #4CAF50;
                margin-top: 5px;
              }
              .footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                text-align: center;
                font-size: 11px;
                color: #999;
              }
              @media print {
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .receipt-container {
                  padding: 0;
                  min-height: auto;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <h1>RICEVUTA PAGAMENTI</h1>
                <div class="society-name">${societyData?.ragione_sociale || societyData?.society_name || 'Società Sportiva'}</div>
                <div class="season">Stagione Sportiva ${season}</div>
              </div>
              
              <div class="section">
                <div class="section-title">Dati Atleta</div>
                <div class="info-row">
                  <span class="info-label">Cognome e Nome:</span>
                  <span class="info-value">${(athlete as any).last_name || ''} ${(athlete as any).first_name || ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Codice Fiscale:</span>
                  <span class="info-value">${(athlete as any).fiscal_code || '-'}</span>
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Pagamenti Effettuati</div>
                ${paidPayments.length === 0 ? '<p style="color: #666; padding: 20px 0;">Nessun pagamento registrato</p>' : `
                <table class="payments-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Modalità</th>
                      <th style="text-align: right;">Importo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paidPayments.map((p: any) => {
                      const payDate = p.paid_date ? new Date(p.paid_date).toLocaleDateString('it-IT') : '-';
                      const method = p.payment_method || 'Non specificato';
                      return `
                      <tr>
                        <td>${payDate}</td>
                        <td class="method">${method}</td>
                        <td class="amount">€ ${(p.amount || 0).toFixed(2)}</td>
                      </tr>
                    `}).join('')}
                  </tbody>
                </table>
                `}
              </div>
              
              <div class="total-section">
                <div class="total-label">Totale Pagato</div>
                <div class="total-amount">€ ${totalPaid.toFixed(2)}</div>
              </div>
              
              <div class="footer">
                Documento generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </body>
          </html>
        `;

        const filename = `Ricevuta_${(athlete as any).last_name || 'Atleta'}_${(athlete as any).first_name || ''}.html`;

        if (action === 'print') {
          if (Platform.OS === 'web') {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(simpleReceiptHtml);
              printWindow.document.close();
              printWindow.onload = () => {
                printWindow.focus();
                printWindow.print();
              };
            }
          }
        } else {
          // Share/Download
          if (Platform.OS === 'web') {
            // Try Web Share API first
            if (navigator.share) {
              try {
                const blob = new Blob([simpleReceiptHtml], { type: 'text/html' });
                const file = new File([blob], filename, { type: 'text/html' });
                await navigator.share({
                  title: `Ricevuta ${(athlete as any).last_name} ${(athlete as any).first_name}`,
                  text: `Ricevuta pagamenti per ${(athlete as any).last_name} ${(athlete as any).first_name}`,
                  files: [file]
                });
              } catch (shareError: any) {
                // Fallback to download if share fails or is cancelled
                if (shareError.name !== 'AbortError') {
                  const blob = new Blob([simpleReceiptHtml], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = filename;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setTimeout(() => URL.revokeObjectURL(url), 100);
                }
              }
            } else {
              // Fallback for browsers without Web Share API
              const blob = new Blob([simpleReceiptHtml], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(url), 100);
            }
          }
        }
        return;
      }

      // For minor athletes, use the formal Attestato di Versamento

      // Prepare receipt data - works even with 0 payments
      const receiptData: ReceiptData = {
        athlete: {
          first_name: (athlete as any).first_name || athlete.full_name?.split(' ').slice(1).join(' ') || '',
          last_name: (athlete as any).last_name || athlete.full_name?.split(' ')[0] || '',
          fiscal_code: (athlete as any).fiscal_code || '',
          address: (athlete as any).address || '',
          postal_code: (athlete as any).postal_code || '',
          city: (athlete as any).city || '',
          province: (athlete as any).province || '',
          date_of_birth: (athlete as any).date_of_birth || '',
          birth_place: (athlete as any).birth_place || '',
          birth_province: (athlete as any).birth_province || '',
        },
        parent: {
          first_name: '', // Admin view doesn't have parent data directly
          last_name: '',
        },
        society: {
          name: societyData?.ragione_sociale || societyData?.society_name || societyData?.name || 'Società Sportiva',
          address: societyData?.address || societyData?.company_address || '',
          city: societyData?.city || societyData?.company_city || '',
          postal_code: societyData?.postal_code || societyData?.company_zip_code || '',
          province: societyData?.province || societyData?.company_province || '',
          fiscal_code: societyData?.fiscal_code || societyData?.company_tax_code || '',
          phone: societyData?.phone || societyData?.phone1 || '',
          phone2: societyData?.phone2 || '',
          president_name: societyData?.president_name || '',
          logo: societyData?.logo || societyData?.company_logo_base64 || '',
          stamp_signature: societyData?.stamp_signature || societyData?.stamp_signature_base64 || '',
          sport_type: societyData?.sport_type || societyData?.sport_praticato || 'PALLAVOLO',
        },
        // Filter only payments with paid_date for the attestato - use receipt_number from database
        payments: payments.filter((p: any) => p.paid_date).length > 0 
          ? payments.filter((p: any) => p.paid_date).map((p: any, index) => ({
              date: p.paid_date || '',
              receipt_number: p.receipt_number || `${index + 1}`,
              amount: p.amount || 0,
              description: p.description || p.notes || '',
              payment_method: p.payment_method || (p.is_cash ? 'Contanti' : 'Bonifico'),
            })) 
          : [], // Empty array if no payments
        season: season,
        receipt_number: '', // Not used for individual receipts
        team_name: team?.name || '',
      };

      // Import generateReceiptHTML from fiscalReceipt
      const { generateReceiptHTML } = await import('../../../src/utils/fiscalReceipt');
      const html = generateReceiptHTML(receiptData);
      const filename = `Attestato_${(athlete as any).last_name || 'Atleta'}_${(athlete as any).first_name || ''}_${season.replace('/', '-')}.pdf`;

      if (action === 'print') {
        // Print action
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
            showAlert('Errore', 'Popup bloccato. Abilita i popup per stampare.');
          }
        } else {
          await Print.printAsync({ html });
        }
      } else {
        // Share action - download HTML file directly
        if (Platform.OS === 'web') {
          try {
            // Create blob and download HTML file directly
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Attestato_${(athlete as any).last_name || 'Atleta'}_${(athlete as any).first_name || ''}_${season.replace('/', '-')}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showAlert('Download completato', 'Il file HTML è stato scaricato. Aprilo per visualizzare o stampare.');
          } catch (e) {
            console.error('Share error:', e);
            showAlert('Errore', 'Impossibile scaricare il documento');
          }
        } else {
          // Mobile: generate PDF and share
          const { uri } = await Print.printToFileAsync({ html });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Attestato di Versamento',
              UTI: 'com.adobe.pdf',
            });
          } else {
            showAlert('Errore', 'Condivisione non disponibile');
          }
        }
      }
    } catch (error) {
      console.error('Error generating payment statement:', error);
      showAlert('Errore', 'Impossibile generare l\'attestato di versamento');
    }
  };

  // Print QR Code function
  const printQRCode = async () => {
    if (!athlete?.qr_code) {
      showAlert('Errore', 'QR Code non disponibile');
      return;
    }
    
    try {
      // Get QR code - handle both data URI and base64
      let qrCodeSrc = athlete.qr_code;
      
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
              <div class="athlete-code">Codice: ${(athlete as any).qr_identifier || (athlete as any).athlete_code || athlete.id}</div>
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
          showAlert('Errore', 'Popup bloccato. Abilita i popup per stampare.');
        }
      } else {
        // Mobile: use expo-print
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Errore stampa:', error);
      showAlert('Errore', 'Impossibile stampare il QR code. Riprova.');
    }
  };

  // Share QR Code function
  const shareQRCode = async () => {
    if (!athlete?.qr_code) {
      showAlert('Errore', 'QR Code non disponibile');
      return;
    }
    
    try {
      // Get QR code source
      let qrCodeSrc = athlete.qr_code;
      
      // Ensure it's a proper data URI
      if (!qrCodeSrc.startsWith('data:')) {
        qrCodeSrc = `data:image/png;base64,${qrCodeSrc}`;
      }
      
      // On web, generate HTML and download
      if (Platform.OS === 'web') {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>QR Code - ${athlete.full_name}</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
    h1 { color: #333; margin-bottom: 10px; }
    h2 { color: #666; font-weight: normal; margin-bottom: 30px; }
    .qr-image { width: 250px; height: 250px; border: 2px solid #007AFF; padding: 10px; border-radius: 10px; }
    .code { margin-top: 15px; font-size: 14px; color: #666; background: #f5f5f5; padding: 8px 16px; border-radius: 4px; display: inline-block; }
    .footer { margin-top: 30px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>${athlete.full_name}</h1>
  <h2>QR Code Atleta</h2>
  <img class="qr-image" src="${qrCodeSrc}" alt="QR Code" />
  <div class="code">Codice: ${(athlete as any).athlete_code || athlete.id}</div>
  <p class="footer">Presentare questo codice all'allenatore per registrare la presenza</p>
</body>
</html>`;
        
        // Download HTML file
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QRCode_${athlete.full_name.replace(/\s+/g, '_')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showAlert('Download completato', 'Il file HTML è stato scaricato. Aprilo e condividilo.');
        return;
      }
      
      // Mobile: Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert('Errore', 'La condivisione non è disponibile su questo dispositivo');
        return;
      }
      
      // Save QR code to file and share
      const FileSystem = require('expo-file-system/legacy');
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
    } catch (error) {
      console.error('Errore condivisione:', error);
      showAlert('Errore', 'Impossibile condividere il QR code. Riprova.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {/* Mini QR Code in header */}
          {athlete.qr_code && (
            <TouchableOpacity 
              onPress={() => setQrModalVisible(true)}
              style={styles.miniQrButton}
              data-testid="mini-qr-button"
            >
              <Image
                source={{ uri: athlete.qr_code.startsWith('data:') ? athlete.qr_code : `data:image/png;base64,${athlete.qr_code}` }}
                style={styles.miniQrImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>{athlete.full_name}</Text>
        </View>
        {activeTab === 'dati' && (
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? "close" : "create"} size={24} color="#fff" />
          </TouchableOpacity>
        )}
        {activeTab !== 'dati' && <View style={{ width: 24 }} />}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dati' && styles.tabActive]}
          onPress={() => setActiveTab('dati')}
        >
          <Ionicons name="person" size={18} color={activeTab === 'dati' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'dati' && styles.tabTextActive]}>Dati</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab, 
            activeTab === 'pagamenti' && styles.tabActive,
            athleteType === 'compensated' && styles.tabGold,
            athleteType === 'compensated' && activeTab === 'pagamenti' && styles.tabGoldActive
          ]}
          onPress={() => setActiveTab('pagamenti')}
        >
          <Ionicons 
            name={athleteType === 'compensated' ? "trophy" : "card"} 
            size={18} 
            color={activeTab === 'pagamenti' ? (athleteType === 'compensated' ? '#B8860B' : '#007AFF') : '#666'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'pagamenti' && styles.tabTextActive,
            athleteType === 'compensated' && activeTab === 'pagamenti' && styles.tabTextGold
          ]}>
            {athleteType === 'compensated' ? 'Compensi' : 'Pagamenti'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'presenze' && styles.tabActive]}
          onPress={() => setActiveTab('presenze')}
        >
          <Ionicons name="calendar" size={18} color={activeTab === 'presenze' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'presenze' && styles.tabTextActive]}>Presenze</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Withdrawn Banner */}
        {athlete.is_withdrawn && (
          <View style={styles.withdrawnBanner}>
            <Ionicons name="warning" size={24} color="#fff" />
            <View style={styles.withdrawnBannerText}>
              <Text style={styles.withdrawnBannerTitle}>ATLETA RITIRATO</Text>
              {athlete.withdrawn_reason && (
                <Text style={styles.withdrawnBannerSubtitle}>Motivo: {athlete.withdrawn_reason}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.reactivateButton}
              onPress={handleReactivateAthlete}
            >
              <Text style={styles.reactivateButtonText}>Riattiva</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DATI TAB */}
        {activeTab === 'dati' && (
          <>
            {/* Foto Atleta - RIMOSSA per privacy */}

            {/* Dati Tecnici */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 Dati Tecnici</Text>
              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Ruolo</Text>
                  {availableRoles.length > 0 ? (
                    <View style={styles.roleSelector}>
                      {availableRoles.map((role) => (
                        <TouchableOpacity
                          key={role}
                          style={[
                            styles.roleOption,
                            editData.athlete_role === role && styles.roleOptionSelected
                          ]}
                          onPress={() => setEditData({...editData, athlete_role: role})}
                        >
                          <Text style={[
                            styles.roleOptionText,
                            editData.athlete_role === role && styles.roleOptionTextSelected
                          ]}>{role}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={editData.athlete_role}
                      onChangeText={(t) => setEditData({...editData, athlete_role: t})}
                      placeholder="Es. Palleggiatore, Schiacciatore..."
                      placeholderTextColor="#999"
                    />
                  )}
                  <View style={styles.rowInputsThree}>
                    <View style={styles.thirdInput}>
                      <Text style={styles.inputLabel}>Altezza cm.</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.athlete_height}
                        onChangeText={(t) => setEditData({...editData, athlete_height: t.replace(/\D/g, '')})}
                        placeholder="175"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={3}
                      />
                    </View>
                    <View style={styles.thirdInput}>
                      <Text style={styles.inputLabel}>Peso kg.</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.athlete_weight}
                        onChangeText={(t) => setEditData({...editData, athlete_weight: t.replace(/\D/g, '')})}
                        placeholder="65"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={3}
                      />
                    </View>
                    <View style={styles.thirdInput}>
                      <Text style={styles.inputLabel}>Elevaz. cm.</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.athlete_elevation}
                        onChangeText={(t) => setEditData({...editData, athlete_elevation: t.replace(/\D/g, '')})}
                        placeholder="45"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={3}
                      />
                    </View>
                  </View>
                  <Text style={styles.inputLabel}>Note sull'atleta</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editData.athlete_notes}
                    onChangeText={(t) => setEditData({...editData, athlete_notes: t})}
                    placeholder="Note, osservazioni, informazioni utili..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
                </>
              ) : (
                <>
                  {/* Ruolo */}
                  {athleteRole ? (
                    <View style={styles.roleDisplay}>
                      <Text style={styles.techDataLabel}>Ruolo</Text>
                      <Text style={styles.roleValue}>{athleteRole}</Text>
                    </View>
                  ) : null}
                  
                  {/* Dati fisici in riga */}
                  <View style={styles.physicalDataRow}>
                    <View style={styles.physicalDataItem}>
                      <Text style={styles.physicalDataLabel}>Altezza cm.</Text>
                      <Text style={styles.physicalDataValue}>{athleteHeight || '-'}</Text>
                    </View>
                    <View style={styles.physicalDataItem}>
                      <Text style={styles.physicalDataLabel}>Peso kg.</Text>
                      <Text style={styles.physicalDataValue}>{athleteWeight || '-'}</Text>
                    </View>
                    <View style={styles.physicalDataItem}>
                      <Text style={styles.physicalDataLabel}>Elevaz. cm.</Text>
                      <Text style={styles.physicalDataValue}>{athleteElevation || '-'}</Text>
                    </View>
                  </View>
                  
                  {athleteNotes ? (
                    <View style={styles.notesSection}>
                      <Text style={styles.techDataLabel}>Note</Text>
                      <Text style={styles.notesText}>{athleteNotes}</Text>
                    </View>
                  ) : null}
                  {athleteCharacteristics.length > 0 && (
                    <View style={styles.characteristicsSection}>
                      <Text style={styles.techDataLabel}>Caratteristiche</Text>
                      <View style={styles.characteristicsTags}>
                        {athleteCharacteristics.map((char, idx) => (
                          <View key={idx} style={styles.characteristicTag}>
                            <Text style={styles.characteristicTagText}>{char}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Squadra */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SportIcon size={20} />
                <Text style={[styles.cardTitle, { marginLeft: 6 }]}>Squadra</Text>
              </View>
              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Squadra Principale (per Quote e Codice)</Text>
                  <View style={styles.teamSelector}>
                    {allTeams.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.teamOption,
                          editData.team_id === t.id && styles.teamOptionSelected
                        ]}
                        onPress={() => setEditData({...editData, team_id: t.id})}
                      >
                        <Ionicons 
                          name={editData.team_id === t.id ? "radio-button-on" : "radio-button-off"} 
                          size={20} 
                          color={editData.team_id === t.id ? "#007AFF" : "#999"} 
                        />
                        <Text style={[
                          styles.teamOptionText,
                          editData.team_id === t.id && styles.teamOptionTextSelected
                        ]}>{t.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>Squadra Secondaria (opzionale)</Text>
                  <View style={styles.teamSelector}>
                    <TouchableOpacity
                      style={[
                        styles.teamOption,
                        !editData.team_id_2 && styles.teamOptionSelected
                      ]}
                      onPress={() => setEditData({...editData, team_id_2: ''})}
                    >
                      <Ionicons 
                        name={!editData.team_id_2 ? "radio-button-on" : "radio-button-off"} 
                        size={20} 
                        color={!editData.team_id_2 ? "#007AFF" : "#999"} 
                      />
                      <Text style={[
                        styles.teamOptionText,
                        !editData.team_id_2 && styles.teamOptionTextSelected
                      ]}>Nessuna</Text>
                    </TouchableOpacity>
                    {allTeams.filter(t => t.id !== editData.team_id).map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.teamOption,
                          editData.team_id_2 === t.id && styles.teamOptionSelected
                        ]}
                        onPress={() => setEditData({...editData, team_id_2: t.id})}
                      >
                        <Ionicons 
                          name={editData.team_id_2 === t.id ? "radio-button-on" : "radio-button-off"} 
                          size={20} 
                          color={editData.team_id_2 === t.id ? "#007AFF" : "#999"} 
                        />
                        <Text style={[
                          styles.teamOptionText,
                          editData.team_id_2 === t.id && styles.teamOptionTextSelected
                        ]}>{t.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>Codice Atleta (per Import Pagamenti)</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.athlete_code}
                    onChangeText={(t) => setEditData({...editData, athlete_code: t.toUpperCase().replace(/[^A-Z0-9_-]/g, '')})}
                    placeholder="Es: ROSSI_MARIO_U16"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4, marginBottom: 8 }}>
                    Questo codice viene usato per abbinare i pagamenti importati da Excel
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Squadra Principale</Text>
                    <Text style={[styles.value, { color: '#E53935', fontWeight: 'bold' }]}>
                      {team?.name || '-'}
                    </Text>
                  </View>
                  {athlete?.team_id_2 && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Squadra Secondaria</Text>
                      <Text style={styles.value}>
                        {allTeams.find(t => t.id === athlete?.team_id_2)?.name || '-'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Codice Atleta (Import)</Text>
                    <Text style={[styles.valueCode, { color: '#007AFF' }]}>
                      {athlete?.athlete_code || '-'}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Tesseramento */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏅 Tesseramento</Text>
              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Codice Federale</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.federal_code}
                    onChangeText={(t) => setEditData({...editData, federal_code: t.toUpperCase()})}
                    placeholder="Inserisci codice federale"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Tesserato</Text>
                    <Switch
                      value={editData.is_registered}
                      onValueChange={(v) => setEditData({...editData, is_registered: v})}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Codice Federale</Text>
                    <Text style={styles.valueCode}>{athlete.federal_code || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tesserato</Text>
                    <View style={[styles.badge, athlete.is_registered ? styles.badgeGreen : styles.badgeRed]}>
                      <Text style={styles.badgeText}>{athlete.is_registered ? 'SÌ' : 'NO'}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Anagrafica */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>👤 Anagrafica</Text>
              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Cognome</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.last_name}
                    onChangeText={(t) => setEditData({...editData, last_name: t.toUpperCase()})}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.inputLabel}>Nome</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.first_name}
                    onChangeText={(t) => setEditData({...editData, first_name: t.toUpperCase()})}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.inputLabel}>Data di Nascita (GG/MM/AAAA)</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.date_of_birth}
                    onChangeText={(t) => setEditData({...editData, date_of_birth: formatDateInputAuto(t)})}
                    placeholder="01/01/2010"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <Text style={styles.inputLabel}>Stato di Nascita</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={editData.country_of_birth || DEFAULT_COUNTRY}
                      onValueChange={(value) => setEditData({...editData, country_of_birth: value})}
                      style={styles.picker}
                    >
                      {COUNTRIES.map((country) => (
                        <Picker.Item key={country} label={country} value={country} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.flex2}>
                      <Text style={styles.inputLabel}>Luogo di nascita</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.birth_place}
                        onChangeText={(t) => setEditData({...editData, birth_place: t.toUpperCase()})}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.inputLabel}>Prov. (2 lett.)</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.birth_province}
                        onChangeText={(t) => setEditData({...editData, birth_province: t.toUpperCase().slice(0, 2)})}
                        maxLength={2}
                        autoCapitalize="characters"
                        placeholder="PG"
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  <Text style={styles.inputLabel}>Codice Fiscale</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8 }]}
                      value={editData.fiscal_code}
                      onChangeText={(t) => setEditData({...editData, fiscal_code: t.toUpperCase()})}
                      autoCapitalize="characters"
                      maxLength={16}
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#007AFF',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 8,
                      }}
                      onPress={() => {
                        try {
                          // Parse date of birth
                          const dob = editData.date_of_birth;
                          if (!dob || !editData.last_name || !editData.first_name || !editData.place_of_birth || !editData.gender) {
                            Alert.alert('Dati Mancanti', 'Per calcolare il CF servono: Cognome, Nome, Data di Nascita, Luogo di Nascita e Sesso');
                            return;
                          }
                          
                          // Parse date - handle different formats
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
                          
                          const cf = new CodiceFiscale({
                            name: editData.first_name.toUpperCase(),
                            surname: editData.last_name.toUpperCase(),
                            gender: editData.gender as 'M' | 'F',
                            day: day,
                            month: month,
                            year: year,
                            birthplace: editData.place_of_birth.toUpperCase(),
                            birthplaceProvincia: editData.birth_province?.toUpperCase() || editData.province_of_birth?.toUpperCase() || '',
                          });
                          
                          setEditData({...editData, fiscal_code: cf.toString()});
                          Alert.alert('Successo', 'Codice Fiscale calcolato!');
                        } catch (error: any) {
                          console.error('CF calculation error:', error);
                          Alert.alert('Errore', 'Impossibile calcolare il CF. Verifica i dati inseriti (es. comune di nascita deve essere valido).');
                        }
                      }}
                    >
                      <Ionicons name="calculator" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.email}
                    onChangeText={(t) => setEditData({...editData, email: t.toLowerCase()})}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Tel. Atleta</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.phone_athlete}
                    onChangeText={(t) => setEditData({...editData, phone_athlete: t})}
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.inputLabel}>Tel. Madre</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.phone_mother}
                    onChangeText={(t) => setEditData({...editData, phone_mother: t})}
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.inputLabel}>Tel. Padre</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.phone_father}
                    onChangeText={(t) => setEditData({...editData, phone_father: t})}
                    keyboardType="phone-pad"
                  />
                  {!athlete?.parents_detached && (
                    <>
                      <Text style={styles.inputLabel}>Email Secondo Genitore</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.second_parent_email}
                        onChangeText={(t) => setEditData({...editData, second_parent_email: t.toLowerCase()})}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholder="email@esempio.com"
                        placeholderTextColor="#999"
                      />
                      <Text style={styles.inputHint}>👨‍👩‍👧 Se il secondo genitore si registra con questa email, vedrà automaticamente questo atleta</Text>
                    </>
                  )}
                  <Text style={styles.inputLabel}>Indirizzo</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.address}
                    onChangeText={(t) => setEditData({...editData, address: t})}
                  />
                  <View style={styles.row}>
                    <View style={styles.flex1}>
                      <Text style={styles.inputLabel}>CAP</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.postal_code}
                        onChangeText={(t) => setEditData({...editData, postal_code: t})}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.flex2}>
                      <Text style={styles.inputLabel}>Città</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.city}
                        onChangeText={(t) => setEditData({...editData, city: t.toUpperCase()})}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.inputLabel}>Prov. (2 lett.)</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.province}
                        onChangeText={(t) => setEditData({...editData, province: t.toUpperCase().slice(0, 2)})}
                        maxLength={2}
                        autoCapitalize="characters"
                        placeholder="PG"
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Cognome</Text>
                    <Text style={styles.value}>{(editData.last_name || '-').toUpperCase()}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Nome</Text>
                    <Text style={styles.value}>{(editData.first_name || '-').toUpperCase()}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Data di nascita</Text>
                    <Text style={styles.value}>{athlete.date_of_birth ? formatDate(athlete.date_of_birth) : '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Luogo di nascita</Text>
                    <Text style={styles.value}>{athlete.birth_place || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Prov.</Text>
                    <Text style={styles.value}>{athlete.birth_province || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Cod. Fiscale</Text>
                    <Text style={[styles.value, styles.valueSmall]}>{athlete.fiscal_code || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Email</Text>
                    <Text style={styles.value}>{athlete.email || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tel. Atleta</Text>
                    <Text style={styles.value}>{athlete.phone_athlete || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tel. Madre</Text>
                    <Text style={styles.value}>{athlete.phone_mother || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tel. Padre</Text>
                    <Text style={styles.value}>{athlete.phone_father || '-'}</Text>
                  </View>
                  {!athlete.parents_detached && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Email 2° Genitore</Text>
                      <Text style={styles.value}>{(athlete as any).second_parent_email || '-'}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Indirizzo</Text>
                    <Text style={styles.value}>{athlete.address || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>CAP</Text>
                    <Text style={styles.value}>{athlete.postal_code || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Città</Text>
                    <Text style={styles.value}>{athlete.city || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Provincia</Text>
                    <Text style={styles.value}>{athlete.province || '-'}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Squadra e Certificato */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SportIcon size={20} />
                <Text style={[styles.cardTitle, { marginLeft: 6 }]}>Squadra</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Squadra</Text>
                <Text style={styles.value}>{team?.name || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Iscrizione</Text>
                <Text style={styles.value}>{formatDate(athlete.registration_date)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Certificato Medico</Text>
              {certificate ? (
                <View>
                  <View style={styles.certRow}>
                    <Ionicons
                      name={isCertificateExpired ? 'close-circle' : (certificate.verified ? 'checkmark-circle' : 'time-outline')}
                      size={24}
                      color={getCertificateColor()}
                    />
                    <Text style={[styles.certText, { color: getCertificateColor() }]}>
                      Scadenza: {formatDate(certificate.expiry_date)} 
                      {isCertificateExpired && ' (SCADUTO)'}
                      {isCertificateExpiringSoon && ' (IN SCADENZA)'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 4 }}>
                    <Ionicons
                      name={certificate.verified ? 'shield-checkmark' : 'shield-outline'}
                      size={18}
                      color={certificate.verified ? '#4CAF50' : '#FF9500'}
                    />
                    <Text style={{ marginLeft: 8, fontSize: 13, color: certificate.verified ? '#4CAF50' : '#FF9500', fontWeight: '600' }}>
                      {certificate.verified ? 'Verificato dall\'admin' : 'Non ancora verificato dall\'admin'}
                    </Text>
                  </View>
                  {/* Metadati tracciabilità */}
                  {athlete?.medical_certificate_updated_by_name && (
                    <View style={{ marginTop: 8, paddingLeft: 4 }}>
                      <Text style={{ fontSize: 11, color: '#999' }}>
                        Inserito da: {athlete.medical_certificate_inserted_by_name || athlete.medical_certificate_updated_by_name}
                        {athlete.medical_certificate_inserted_at ? ` il ${formatDate(athlete.medical_certificate_inserted_at)}` : ''}
                      </Text>
                      {athlete.medical_certificate_verified_by_name && (
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          Verificato da: {athlete.medical_certificate_verified_by_name}
                          {athlete.medical_certificate_verified_at ? ` il ${formatDate(athlete.medical_certificate_verified_at)}` : ''}
                        </Text>
                      )}
                      {athlete.medical_certificate_updated_by_name !== athlete.medical_certificate_inserted_by_name && (
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          Ultimo aggiornamento: {athlete.medical_certificate_updated_by_name}
                          {athlete.medical_certificate_updated_at ? ` il ${formatDate(athlete.medical_certificate_updated_at)}` : ''}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color="#FF9500" />
                  <Text style={styles.warningText}>Nessun certificato</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.addCertButton}
                onPress={() => setCertModalVisible(true)}
              >
                <Ionicons name={certificate ? "create" : "add-circle"} size={18} color="#007AFF" />
                <Text style={styles.addCertButtonText}>
                  {certificate ? 'Aggiorna Certificato' : 'Inserisci dati Certificato'}
                </Text>
              </TouchableOpacity>
              
              <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#FF9800' }}>
                <Text style={{ fontSize: 12, color: '#E65100', lineHeight: 18 }}>
                  Copia del certificato dovrà essere consegnata alla Società e inviata per e-mail al seguente indirizzo: <Text style={{ fontWeight: 'bold' }}>{societyData?.email || '-'}</Text> in formato pdf
                </Text>
              </View>
              
            </View>

      {/* Privacy Status */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔒 Privacy GDPR</Text>
              {athlete.privacy_accepted ? (
                <View style={styles.certRow}>
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  <Text style={[styles.certText, { color: '#34C759' }]}>
                    Accettata il {athlete.privacy_accepted_date ? formatDate(athlete.privacy_accepted_date) : '-'}
                  </Text>
                </View>
              ) : (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color="#FF9500" />
                  <Text style={styles.warningText}>Privacy non ancora accettata</Text>
                </View>
              )}
            </View>

            {/* Password Modifiche (for minors) */}
            {hasDataPassword && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🔐 Password Modifiche</Text>
                <Text style={styles.cardSubtitle}>
                  Questo atleta ha una password per proteggere i dati sensibili (minorenne)
                </Text>
                <TouchableOpacity
                  style={styles.resetDataPasswordBtn}
                  onPress={() => setResetDataPasswordVisible(true)}
                >
                  <Ionicons name="key-outline" size={20} color="#fff" />
                  <Text style={styles.resetDataPasswordBtnText}>Reset Password Modifiche</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Withdraw Athlete Button */}
            {!athlete.is_withdrawn && (
              <TouchableOpacity
                style={styles.withdrawButton}
                onPress={() => setWithdrawModalVisible(true)}
              >
                <Ionicons name="remove-circle" size={20} color="#FF3B30" />
                <Text style={styles.withdrawButtonText}>Ritira Atleta dalla Squadra</Text>
              </TouchableOpacity>
            )}

            {/* Reset Account Password Button - For athletes with email */}
            {(athlete as any).email && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🔑 Password Accesso App</Text>
                <Text style={styles.cardSubtitle}>
                  Invia un'email all'atleta con un link per reimpostare la password di accesso all'app
                </Text>
                <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                  Email: {(athlete as any).email}
                </Text>
                <TouchableOpacity
                  style={[styles.resetDataPasswordBtn, { backgroundColor: '#007AFF' }]}
                  onPress={() => setResetAccountPasswordVisible(true)}
                  data-testid="reset-account-password-btn"
                >
                  <Ionicons name="mail-outline" size={20} color="#fff" />
                  <Text style={styles.resetDataPasswordBtnText}>Invia Email Reset Password</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Detach/Reattach Parents Button - Only for adult athletes */}
            {!athlete.is_minor && (
              <View style={styles.parentsActionSection}>
                {!athlete.parents_detached ? (
                  <TouchableOpacity
                    style={styles.detachParentsButton}
                    onPress={handleDetachParents}
                    disabled={detachingParents}
                  >
                    <Ionicons name="people" size={20} color="#FF9500" />
                    <Text style={styles.detachParentsButtonText}>
                      {detachingParents ? 'Sganciamento...' : 'Sgancia Genitori (Maggiorenne)'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <View style={styles.parentsDetachedBadge}>
                      <Text style={styles.parentsDetachedText}>👤 Genitori sganciati</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.reattachParentsButton}
                      onPress={handleReattachParents}
                      disabled={detachingParents}
                    >
                      <Ionicons name="people" size={18} color="#007AFF" />
                      <Text style={styles.reattachParentsButtonText}>
                        {detachingParents ? 'Ricollegamento...' : 'Ricollega Genitori'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Delete Athlete Button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setDeleteModalVisible(true)}
              data-testid="delete-athlete-btn"
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Elimina Atleta Definitivamente</Text>
            </TouchableOpacity>
          </>
        )}

        {/* PAGAMENTI TAB */}
        {activeTab === 'pagamenti' && (
          <>
            {/* Sezione per atleti che PAGANO QUOTA */}
            {athleteType === 'quota' && (
              <>
                {/* Riepilogo Quote */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>💰 Riepilogo Quote</Text>
                  {paymentSummary && (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.label}>Quota Totale</Text>
                        <Text style={styles.value}>{formatCurrency(paymentSummary.total_due)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>1ª Rata</Text>
                    <Text style={styles.value}>{formatCurrency(paymentSummary.installments.first)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>2ª Rata</Text>
                    <Text style={styles.value}>{formatCurrency(paymentSummary.installments.second)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>3ª Rata (con sconto)</Text>
                    <Text style={styles.value}>{formatCurrency(paymentSummary.installments.third)}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Sconto */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎁 Sconto</Text>
              <Text style={styles.inputLabel}>Importo Sconto (€)</Text>
              <TextInput
                style={styles.input}
                value={editData.discount_amount === '0' ? '' : editData.discount_amount}
                onChangeText={(t) => {
                  // Allow only numbers and one decimal point
                  let cleanValue = t.replace(/[^0-9.]/g, '');
                  // Remove leading zeros (but keep "0" or "0.x")
                  if (cleanValue.length > 1 && cleanValue.startsWith('0') && cleanValue[1] !== '.') {
                    cleanValue = cleanValue.replace(/^0+/, '');
                  }
                  // Prevent multiple decimal points
                  const parts = cleanValue.split('.');
                  if (parts.length > 2) {
                    cleanValue = parts[0] + '.' + parts.slice(1).join('');
                  }
                  setEditData({...editData, discount_amount: cleanValue || '0'});
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#999"
              />
              <Text style={styles.inputLabel}>Nota Sconto</Text>
              <TextInput
                style={styles.input}
                value={editData.discount_note}
                onChangeText={(t) => setEditData({...editData, discount_note: t})}
                placeholder="Es: Sconto fratello"
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveData}>
                <Text style={styles.saveBtnText}>Salva Sconto</Text>
              </TouchableOpacity>
              
              {paymentSummary && paymentSummary.discount > 0 && (
                <View style={styles.discountApplied}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.discountAppliedText}>
                    Sconto applicato: {formatCurrency(paymentSummary.discount)}
                  </Text>
                </View>
              )}
            </View>

            {/* Totale Residuo */}
            {paymentSummary && (
              <View style={[styles.card, styles.residualCard]}>
                <View style={styles.residualRow}>
                  <Text style={styles.residualLabel}>Totale Pagato</Text>
                  <Text style={styles.residualValue}>{formatCurrency(paymentSummary.total_paid)}</Text>
                </View>
                <View style={styles.residualRow}>
                  <Text style={styles.residualLabel}>Totale Dovuto</Text>
                  <Text style={styles.residualValue}>{formatCurrency(paymentSummary.total_after_discount)}</Text>
                </View>
                <View style={[styles.residualRow, styles.residualTotal]}>
                  {paymentSummary.residual < 0 ? (
                    <>
                      <Text style={styles.residualTotalLabel}>DA RESTITUIRE</Text>
                      <Text style={[styles.residualTotalValue, styles.residualOverpaid]}>
                        {formatCurrency(Math.abs(paymentSummary.residual))}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.residualTotalLabel}>RESIDUO</Text>
                      <Text style={[styles.residualTotalValue, paymentSummary.residual === 0 && styles.residualZero]}>
                        {formatCurrency(paymentSummary.residual)}
                      </Text>
                    </>
                  )}
                </View>
                {paymentSummary.residual < 0 && (
                  <View style={styles.overpaidWarning}>
                    <Ionicons name="warning" size={16} color="#FF3B30" />
                    <Text style={styles.overpaidWarningText}>
                      L'atleta ha versato {formatCurrency(Math.abs(paymentSummary.residual))} in più del dovuto
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Storico Pagamenti */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📜 Storico Pagamenti</Text>
                <TouchableOpacity 
                  style={styles.addPaymentBtn}
                  onPress={openNewPaymentModal}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addPaymentBtnText}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
              
              {/* Nota esplicativa */}
              <View style={styles.paymentInfoNote}>
                <Ionicons name="information-circle" size={16} color="#666" />
                <Text style={styles.paymentInfoNoteText}>
                  Ogni pagamento registrato scala automaticamente dal residuo. Puoi registrare più pagamenti parziali.
                </Text>
              </View>
              
              {payments.filter((p: any) => p.paid_date).length === 0 ? (
                <View style={styles.emptyPayments}>
                  <Ionicons name="card-outline" size={32} color="#ccc" />
                  <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
                </View>
              ) : (
                payments.filter((p: any) => p.paid_date).map((payment: any, index) => (
                  <View key={payment.id || index} style={styles.paymentItem}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                      <Text style={styles.paymentDate}>
                        {payment.paid_date ? formatDate(payment.paid_date) : '-'}
                      </Text>
                      {payment.payment_method && (
                        <View style={[styles.cashBadge, { backgroundColor: payment.payment_method === 'Contanti' ? '#FF9500' : '#007AFF' }]}>
                          <Text style={styles.cashBadgeText}>{payment.payment_method.toUpperCase()}</Text>
                        </View>
                      )}
                      {payment.description && (
                        <Text style={styles.paymentDescription}>{payment.description}</Text>
                      )}
                      {payment.notes && (
                        <Text style={styles.paymentNotes}>{payment.notes}</Text>
                      )}
                    </View>
                    <View style={styles.paymentActions}>
                      <TouchableOpacity 
                        style={styles.editPaymentBtn}
                        onPress={() => handleEditPayment(payment)}
                      >
                        <Ionicons name="pencil" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeletePayment(payment.id)}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Attestato di Versamento Button - Sempre visibile */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📄 Attestato di Versamento</Text>
              <View style={styles.attestatoButtonsRow}>
                <TouchableOpacity 
                  style={[styles.attestatoButton, styles.attestatoPrintBtn]}
                  onPress={() => generatePaymentStatement('print')}
                  data-testid="print-attestato-button"
                >
                  <Ionicons name="print" size={20} color="#fff" />
                  <Text style={styles.attestatoButtonText}>Stampa</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.attestatoButton, styles.attestatoShareBtn]}
                  onPress={() => generatePaymentStatement('share')}
                  data-testid="share-attestato-button"
                >
                  <Ionicons name="share-outline" size={20} color="#fff" />
                  <Text style={styles.attestatoButtonText}>Condividi</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.attestatoHint}>
                {payments.length > 0 
                  ? 'Documento con riepilogo pagamenti, dati società e firma del presidente'
                  : 'Nessun pagamento registrato - l\'attestato mostrerà importo versato: € 0,00'}
              </Text>
            </View>
              </>
            )}

            {/* Sezione per atleti che RICEVONO COMPENSO */}
            {athleteType === 'compensated' && (
              <>
                {/* Card Compensi Premium */}
                <View style={styles.compensationCard}>
                  <View style={styles.compensationCardHeader}>
                    <View style={styles.compensationCardIcon}>
                      <Ionicons name="trophy" size={24} color="#fff" />
                    </View>
                    <View style={styles.compensationCardHeaderText}>
                      <Text style={styles.compensationCardTitle}>Atleta Retribuito</Text>
                      <Text style={styles.compensationCardSubtitle}>Percepisce compenso sportivo</Text>
                    </View>
                  </View>

                  {/* Quick Stats */}
                  {athlete && (
                    <View style={styles.compensationStats}>
                      <View style={styles.compensationStatItem}>
                        <Text style={styles.compensationStatLabel}>Compenso Mensile</Text>
                        <Text style={styles.compensationStatValue}>{formatCurrency(athlete.monthly_compensation || 0)}</Text>
                      </View>
                      {athlete.contract_start_date && athlete.contract_end_date && (
                        <View style={styles.compensationStatItem}>
                          <Text style={styles.compensationStatLabel}>Durata Contratto</Text>
                          <Text style={styles.compensationStatDate}>
                            {new Date(athlete.contract_start_date).toLocaleDateString('it-IT')} - {new Date(athlete.contract_end_date).toLocaleDateString('it-IT')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Button to compensation page */}
                  <TouchableOpacity 
                    style={styles.compensationButton}
                    onPress={() => router.push(`/admin/athlete/${id}/compensation`)}
                  >
                    <Text style={styles.compensationButtonText}>Gestisci Compensi e Quietanze</Text>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        {/* PRESENZE TAB */}
        {activeTab === 'presenze' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Statistiche Presenze</Text>
            {stats ? (
              <>
                <View style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    <Text style={styles.statLabel}>Settimana</Text>
                  </View>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stats.weekly_attendances} presenze</Text>
                    <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.weekly_percentage) + '20' }]}>
                      <Text style={[styles.percentText, { color: getPercentageColor(stats.weekly_percentage) }]}>
                        {stats.weekly_percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Ionicons name="calendar" size={20} color="#FF9500" />
                    <Text style={styles.statLabel}>Mese</Text>
                  </View>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stats.monthly_attendances} presenze</Text>
                    <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.monthly_percentage) + '20' }]}>
                      <Text style={[styles.percentText, { color: getPercentageColor(stats.monthly_percentage) }]}>
                        {stats.monthly_percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Ionicons name="stats-chart" size={20} color="#5856D6" />
                    <Text style={styles.statLabel}>Totale</Text>
                  </View>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stats.total_attendances} presenze</Text>
                    <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.total_percentage) + '20' }]}>
                      <Text style={[styles.percentText, { color: getPercentageColor(stats.total_percentage) }]}>
                        {stats.total_percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyPayments}>
                <Ionicons name="calendar-outline" size={32} color="#ccc" />
                <Text style={styles.emptyText}>Nessuna statistica</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: editing ? 100 : 40 }} />
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
            <Text style={styles.qrModalTitle}>{athlete.full_name}</Text>
            <View ref={qrCodeRef} collapsable={false} style={styles.qrModalImageContainer}>
              <Image
                source={{ uri: athlete.qr_code?.startsWith('data:') ? athlete.qr_code : `data:image/png;base64,${athlete.qr_code}` }}
                style={styles.qrModalImage}
                resizeMode="contain"
              />
              <Text style={styles.qrModalCodeText}>Codice: {athlete.qr_identifier || athlete.athlete_code || athlete.id}</Text>
            </View>
            <Text style={styles.qrModalInstructions}>
              Mostra questo QR code al coach per registrare la presenza
            </Text>
            <View style={styles.qrButtonsRow}>
              <TouchableOpacity
                style={[styles.qrActionButton, styles.printButton]}
                onPress={printQRCode}
                data-testid="qr-print-button"
              >
                <Ionicons name="print" size={20} color="#fff" />
                <Text style={styles.qrActionButtonText}>Stampa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrActionButton, styles.shareButton]}
                onPress={shareQRCode}
                data-testid="qr-share-button"
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.qrActionButtonText}>Condividi</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.qrCloseButton}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.qrCloseButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating Save Button */}
      {editing && (
        <View style={styles.floatingSaveContainer}>
          <TouchableOpacity
            style={[styles.floatingSaveButton, saving && styles.floatingSaveButtonDisabled]}
            onPress={handleSaveData}
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

      {/* Add/Edit Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPaymentModalVisible(false);
          setEditingPaymentId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingPaymentId ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
            </Text>
            
            {/* IMPORTANTE: Banner di conferma atleta */}
            <View style={styles.athleteConfirmBanner} data-testid="payment-athlete-confirm-banner">
              <Text style={styles.athleteConfirmLabel}>Pagamento per:</Text>
              <Text style={styles.athleteConfirmName}>
                {athlete?.last_name?.toUpperCase()} {athlete?.first_name?.toUpperCase()}
              </Text>
              <Text style={styles.athleteConfirmTeam}>
                {athlete?.team_name || 'Squadra non assegnata'}
              </Text>
            </View>
            
            <Text style={styles.inputLabel}>Importo (€) *</Text>
            <TextInput
              style={styles.input}
              value={newPayment.amount}
              onChangeText={(t) => setNewPayment({...newPayment, amount: t})}
              keyboardType="decimal-pad"
              placeholder="Es: 150"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.inputLabel}>Data Pagamento (GG/MM/AAAA) *</Text>
            <TextInput
              style={styles.input}
              value={newPayment.paid_date}
              onChangeText={(t) => setNewPayment({...newPayment, paid_date: formatDateInputAuto(t)})}
              placeholder="Es: 15/01/2025"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
            />
            
            <Text style={styles.inputLabel}>Causale/Descrizione</Text>
            <TextInput
              style={styles.input}
              value={newPayment.description}
              onChangeText={(t) => setNewPayment({...newPayment, description: t})}
              placeholder="Es: Quota Gennaio-Febbraio"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.inputLabel}>Metodo di Pagamento</Text>
            <View style={styles.paymentMethodRow}>
              {['Bonifico', 'POS', 'Contanti', 'Assegno'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentMethodBtn,
                    newPayment.payment_method === method && styles.paymentMethodBtnActive
                  ]}
                  onPress={() => setNewPayment({...newPayment, payment_method: method, is_cash: method === 'Contanti'})}
                >
                  <Text style={[
                    styles.paymentMethodBtnText,
                    newPayment.payment_method === method && styles.paymentMethodBtnTextActive
                  ]}>{method}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={styles.input}
              value={newPayment.notes}
              onChangeText={(t) => setNewPayment({...newPayment, notes: t})}
              placeholder="Note opzionali"
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setEditingPaymentId(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingPayment && { opacity: 0.7 }]}
                onPress={handleAddPayment}
                disabled={savingPayment}
              >
                <Text style={styles.saveBtnText}>
                  {savingPayment ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="remove-circle" size={32} color="#FF3B30" />
              <Text style={styles.modalTitleDanger}>Ritira Atleta</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              L'atleta non sarà più visibile nella squadra e non potrà accedere agli allenamenti.
            </Text>
            <Text style={styles.inputLabel}>Motivo del ritiro (opzionale)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Es: Trasferimento ad altra squadra"
              placeholderTextColor="#999"
              value={withdrawReason}
              onChangeText={setWithdrawReason}
              multiline
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setWithdrawModalVisible(false);
                  setWithdrawReason('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleWithdrawAthlete}
                disabled={withdrawing}
              >
                <Text style={styles.modalButtonDangerText}>
                  {withdrawing ? 'Ritiro...' : 'Conferma Ritiro'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={40} color="#FF3B30" />
              <Text style={styles.modalTitleDanger}>Elimina Atleta</Text>
            </View>
            <Text style={[styles.modalSubtitle, { color: '#FF3B30', fontWeight: '600' }]}>
              ⚠️ ATTENZIONE: Questa azione è IRREVERSIBILE!
            </Text>
            <Text style={styles.modalSubtitle}>
              Verranno eliminati definitivamente:{'\n'}
              • Tutti i dati dell'atleta{'\n'}
              • Tutti i pagamenti registrati{'\n'}
              • Tutte le presenze{'\n'}
              • Tutti i certificati medici
            </Text>
            <View style={[styles.deleteConfirmBox]}>
              <Text style={styles.deleteConfirmText}>
                Stai per eliminare: {athlete?.first_name} {athlete?.last_name}
              </Text>
            </View>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleDeleteAthlete}
                disabled={deleting}
              >
                <Text style={styles.modalButtonDangerText}>
                  {deleting ? 'Eliminazione...' : 'ELIMINA DEFINITIVAMENTE'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Account Password Confirmation Modal */}
      <Modal
        visible={resetAccountPasswordVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setResetAccountPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="mail" size={40} color="#007AFF" />
              <Text style={styles.modalTitle}>Reset Password Accesso</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Verrà inviata un'email a:
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center', marginVertical: 10 }}>
              {(athlete as any)?.email || 'N/A'}
            </Text>
            <Text style={styles.modalSubtitle}>
              L'atleta riceverà un codice per impostare una nuova password di accesso all'app.
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setResetAccountPasswordVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#007AFF' }]}
                onPress={handleResetAccountPassword}
                disabled={resettingAccountPassword}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {resettingAccountPassword ? 'Invio...' : 'Invia Email'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reactivate Modal with Team Selection */}
      <Modal
        visible={reactivateModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReactivateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle" size={32} color="#34C759" />
              <Text style={styles.modalTitleSuccess}>Riattiva Atleta</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Seleziona la squadra in cui vuoi inserire l'atleta.
            </Text>
            
            <Text style={styles.inputLabel}>Squadra *</Text>
            <View style={styles.teamPickerContainer}>
              {allTeams.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.teamOption,
                    selectedTeamId === t.id && styles.teamOptionSelected,
                  ]}
                  onPress={() => setSelectedTeamId(t.id)}
                >
                  <Text
                    style={[
                      styles.teamOptionText,
                      selectedTeamId === t.id && styles.teamOptionTextSelected,
                    ]}
                  >
                    {t.name}
                  </Text>
                  {selectedTeamId === t.id && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setReactivateModalVisible(false);
                  setSelectedTeamId('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={confirmReactivation}
                disabled={reactivating || !selectedTeamId}
              >
                <Text style={styles.saveButtonText}>
                  {reactivating ? 'Riattivazione...' : 'Riattiva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Certificate Modal */}
      <Modal
        visible={certModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {certificate ? 'Aggiorna Certificato Medico' : 'Aggiungi Certificato Medico'}
            </Text>
            
            <Text style={styles.inputLabel}>Data di Emissione (GG/MM/AAAA)</Text>
            <TextInput
              style={styles.modalInput}
              value={certIssueDate}
              onChangeText={(text) => {
                // Auto-format date input
                let cleaned = text.replace(/\D/g, '');
                if (cleaned.length >= 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
                if (cleaned.length >= 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
                if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
                setCertIssueDate(cleaned);
              }}
              placeholder="gg/mm/aaaa"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
            />
            
            {certIssueDate.length === 10 && (
              <View style={{ backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginTop: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>SCADENZA CERTIFICATO</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2E7D32' }}>
                  {(() => {
                    const parts = certIssueDate.split('/');
                    if (parts.length === 3) {
                      const issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                      // Scadenza: giorno prima dello stesso giorno/mese dell'anno dopo
                      const expiryDate = new Date(issueDate);
                      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                      expiryDate.setDate(expiryDate.getDate() - 1);
                      return `${expiryDate.getDate().toString().padStart(2, '0')}/${(expiryDate.getMonth() + 1).toString().padStart(2, '0')}/${expiryDate.getFullYear()}`;
                    }
                    return '';
                  })()}
                </Text>
                <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>(giorno prima dell'anniversario di emissione)</Text>
              </View>
            )}
            
            {/* Checkbox verifica certificato - SOLO ADMIN e SOLO se certificato già salvato */}
            {isAdmin && certificate && (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: certVerified ? '#E8F5E9' : '#f5f5f5', borderRadius: 8, borderWidth: 1, borderColor: certVerified ? '#4CAF50' : '#ddd' }}
              onPress={() => setCertVerified(!certVerified)}
            >
              <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: certVerified ? '#4CAF50' : '#999', backgroundColor: certVerified ? '#4CAF50' : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                {certVerified && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: certVerified ? '#2E7D32' : '#333' }}>
                  Certificato medico verificato dall'admin
                </Text>
                <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  Confermo di aver verificato il certificato medico originale dell'atleta
                </Text>
              </View>
            </TouchableOpacity>
            )}
            {!isAdmin && (
              <View style={{ marginTop: 16, padding: 12, backgroundColor: '#FFF3E0', borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: '#E65100' }}>
                  La verifica del certificato può essere effettuata solo dall'admin
                </Text>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setCertModalVisible(false);
                  setCertIssueDate('');
                  setCertValidityMonths('12');
                  setCertVerified(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveCertificate}
                disabled={savingCert}
              >
                <Text style={styles.saveButtonText}>
                  {savingCert ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Enlargement Modal */}
      <Modal
        visible={photoModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.photoModalOverlay}
          activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}
        >
          <View style={styles.photoModalContent}>
            {(athletePhotoArtistic || athletePhoto) && (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${athletePhotoArtistic || athletePhoto}` }}
                style={styles.photoModalImage}
              />
            )}
            <TouchableOpacity 
              style={styles.closePhotoBtn}
              onPress={() => setPhotoModalVisible(false)}
            >
              <Text style={styles.closePhotoBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reset Data Password Modal */}
      <Modal
        visible={resetDataPasswordVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResetDataPasswordVisible(false)}
      >
        <View style={styles.modalOverlayPassword}>
          <View style={styles.modalContentPassword}>
            <Text style={styles.modalTitlePassword}>🔑 Reset Password Modifiche</Text>
            <Text style={styles.modalSubtitlePassword}>
              Imposta una nuova password per {athlete?.first_name} {athlete?.last_name}.
              {'\n'}Questa password protegge i dati sensibili dell'atleta minorenne.
            </Text>
            <TextInput
              style={styles.modalInputPassword}
              placeholder="Nuova password (min 4 caratteri)"
              placeholderTextColor="#999"
              value={newDataPassword}
              onChangeText={setNewDataPassword}
              secureTextEntry={false}
              autoCapitalize="none"
            />
            <View style={styles.modalButtonsPassword}>
              <TouchableOpacity
                style={styles.modalCancelBtnPassword}
                onPress={() => {
                  setResetDataPasswordVisible(false);
                  setNewDataPassword('');
                }}
              >
                <Text style={styles.modalCancelBtnTextPassword}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtnPassword, resettingDataPassword && styles.disabledBtnPassword]}
                onPress={handleResetDataPassword}
                disabled={resettingDataPassword}
              >
                {resettingDataPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmBtnTextPassword}>Conferma</Text>
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
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, color: '#666', marginLeft: 6 },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  content: { flex: 1 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666', flex: 1 },
  value: { fontSize: 14, fontWeight: '500', color: '#333', flex: 1, textAlign: 'right' },
  valueCode: { fontSize: 14, fontWeight: '600', color: '#007AFF', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  valueSmall: { fontSize: 12 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 14, color: '#333' },
  paymentMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  // Banner di conferma atleta nel modal pagamenti
  athleteConfirmBanner: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#1976D2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  athleteConfirmLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  athleteConfirmName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
  },
  athleteConfirmTeam: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  paymentMethodBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  paymentMethodBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  paymentMethodBtnText: { fontSize: 13, color: '#666' },
  paymentMethodBtnTextActive: { color: '#fff', fontWeight: '600' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeRed: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 6 },
  certRow: { flexDirection: 'row', alignItems: 'center' },
  certText: { fontSize: 14, marginLeft: 8, fontWeight: '500' },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8 },
  warningText: { fontSize: 14, color: '#FF9500', marginLeft: 8 },
  residualCard: { backgroundColor: '#F5F5F5' },
  residualRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  residualLabel: { fontSize: 14, color: '#666' },
  residualValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  residualTotal: { borderTopWidth: 2, borderTopColor: '#007AFF', marginTop: 8, paddingTop: 12 },
  residualTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  residualTotalValue: { fontSize: 20, fontWeight: 'bold', color: '#FF3B30' },
  residualZero: { color: '#34C759' },
  residualOverpaid: { color: '#FF3B30', backgroundColor: '#FFE5E5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  overpaidWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFE5E5', padding: 10, borderRadius: 8, marginTop: 12, gap: 8 },
  overpaidWarningText: { color: '#FF3B30', fontSize: 13, fontWeight: '500', flex: 1 },
  discountApplied: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  discountAppliedText: { fontSize: 13, color: '#34C759', marginLeft: 6 },
  addPaymentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addPaymentBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  paymentInfoNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 10, borderRadius: 8, marginBottom: 12 },
  paymentInfoNoteText: { fontSize: 12, color: '#666', marginLeft: 8, flex: 1 },
  emptyPayments: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#999', marginTop: 8 },
  paymentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  paymentInfo: { flex: 1 },
  paymentActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editPaymentBtn: { padding: 4 },
  paymentAmount: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  paymentDate: { fontSize: 13, color: '#666', marginTop: 2 },
  paymentDescription: { fontSize: 13, color: '#333', marginTop: 4 },
  paymentNotes: { fontSize: 12, color: '#999', marginTop: 2, fontStyle: 'italic' },
  cashBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  cashBadgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statInfo: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 14, color: '#333', marginLeft: 10 },
  statValues: { alignItems: 'flex-end' },
  statCount: { fontSize: 13, color: '#666' },
  percentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  percentText: { fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  modalTitleDanger: { fontSize: 20, fontWeight: 'bold', color: '#FF3B30', textAlign: 'center', marginTop: 12 },
  modalTitleSuccess: { fontSize: 20, fontWeight: 'bold', color: '#34C759', textAlign: 'center', marginTop: 12 },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#f5f5f5' },
  modalButtonCancelText: { fontSize: 16, color: '#666', fontWeight: '600' },
  modalButtonDanger: { backgroundColor: '#FF3B30' },
  modalButtonDangerText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  modalHeader: { alignItems: 'center', marginBottom: 12 },
  modalInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  cancelBtn: { flex: 1, padding: 14, backgroundColor: '#f5f5f5', borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, color: '#666' },
  // Team picker styles
  teamPickerContainer: { maxHeight: 200, marginBottom: 8 },
  teamOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 8 },
  teamOptionSelected: { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#007AFF' },
  teamOptionText: { fontSize: 15, color: '#333' },
  teamOptionTextSelected: { color: '#007AFF', fontWeight: '600' },
  // Withdrawn styles
  withdrawnBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12 },
  withdrawnBannerText: { flex: 1, marginLeft: 12 },
  withdrawnBannerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  withdrawnBannerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  reactivateButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  reactivateButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  withdrawButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F0', marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2' },
  withdrawButtonText: { color: '#FF3B30', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30', marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: 12 },
  deleteButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  deleteConfirmBox: { backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, marginVertical: 12, borderWidth: 1, borderColor: '#FFCDD2' },
  deleteConfirmText: { color: '#C62828', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  parentsActionSection: { marginHorizontal: 16, marginVertical: 8 },
  detachParentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8E1', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FFE082' },
  detachParentsButtonText: { color: '#FF9500', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  parentsDetachedBadge: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  parentsDetachedText: { color: '#4CAF50', fontSize: 13, fontWeight: '500' },
  reattachParentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8 },
  reattachParentsButtonText: { color: '#007AFF', fontSize: 13, fontWeight: '500', marginLeft: 6 },
  addCertButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F2FD', marginTop: 12, padding: 10, borderRadius: 8 },
  addCertButtonText: { color: '#007AFF', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  viewCertButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', marginTop: 8, padding: 10, borderRadius: 8 },
  viewCertButtonText: { color: '#34C759', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 12 },
  inputHint: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 4, marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderRadius: 6 },
  certImageBtn: { backgroundColor: '#f5f5f5', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', marginBottom: 16, overflow: 'hidden' },
  certImagePlaceholder: { height: 80, justifyContent: 'center', alignItems: 'center' },
  certImageText: { color: '#007AFF', fontSize: 12, marginTop: 4 },
  certImagePreview: { width: '100%', height: 120, resizeMode: 'cover' },
  cancelButton: { backgroundColor: '#f5f5f5' },
  cancelButtonText: { fontSize: 16, color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#007AFF' },
  saveButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  // Certificate Viewer Modal - FULL SCREEN styles
  certViewerFullScreen: { 
    flex: 1, 
    backgroundColor: '#fff',
  },
  certViewerHeaderFull: { 
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
  certViewerTitleFull: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    width: Dimensions.get('window').width - 32, 
    height: Dimensions.get('window').height - 250,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  certViewerFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  certViewerInfoFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  certViewerInfoTextFull: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  certViewerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  shareBtnText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  closeCertBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  closeCertBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Photo section styles
  photoSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  athletePhotoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
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
  photoPlaceholderText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  transformingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  transformingText: {
    color: '#007AFF',
    fontSize: 13,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  uploadPhotoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Technical data styles
  techDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  techDataItem: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  techDataLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  techDataValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  characteristicsSection: {
    marginTop: 12,
  },
  characteristicsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  characteristicTag: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  characteristicTagText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  // Role selector styles
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  roleOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  roleOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#666',
  },
  roleOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  // Row inputs
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  rowInputsThree: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  thirdInput: {
    flex: 1,
    minWidth: 90,
  },
  // Physical data display row
  physicalDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  physicalDataItem: {
    flex: 1,
    alignItems: 'center',
  },
  physicalDataLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  physicalDataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  roleDisplay: {
    marginBottom: 12,
  },
  roleValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  // Team selector styles
  teamSelector: {
    gap: 8,
  },
  // Photo modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContent: {
    alignItems: 'center',
  },
  photoModalImage: {
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  closePhotoBtn: {
    marginTop: 24,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  closePhotoBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#007AFF',
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
  // Reset Data Password Styles
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  resetDataPasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  resetDataPasswordBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlayPassword: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentPassword: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitlePassword: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitlePassword: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputPassword: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtonsPassword: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtnPassword: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelBtnTextPassword: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalConfirmBtnPassword: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmBtnTextPassword: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtnPassword: {
    opacity: 0.6,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // QR Code styles
  qrCodeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrCodeImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  qrCodeLabel: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  qrCodeHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Header center styles for QR
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  miniQrButton: {
    marginRight: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
    padding: 2,
  },
  miniQrImage: {
    width: 36,
    height: 36,
    borderRadius: 4,
  },
  // QR Modal styles
  qrModalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '90%',
    alignSelf: 'center',
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrModalImageContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  qrModalImage: {
    width: 200,
    height: 200,
  },
  qrModalCodeText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrModalInstructions: {
    marginTop: 16,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  qrButtonsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  qrActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  printButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
  },
  qrActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  qrCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  qrCloseButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Attestato button styles
  attestatoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  attestatoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  attestatoPrintBtn: {
    backgroundColor: '#007AFF',
  },
  attestatoShareBtn: {
    backgroundColor: '#34C759',
  },
  attestatoButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  attestatoHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  // Athlete Type Selector Styles
  athleteTypeSelector: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  athleteTypeSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  athleteTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  athleteTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  athleteTypeBtnSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  athleteTypeBtnSelectedGold: {
    backgroundColor: '#B8860B',
    borderColor: '#B8860B',
  },
  athleteTypeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  athleteTypeBtnTextSelected: {
    color: '#fff',
  },
  // Tab Gold Styles
  tabGold: {
    borderBottomColor: 'transparent',
  },
  tabGoldActive: {
    borderBottomColor: '#B8860B',
  },
  tabTextGold: {
    color: '#B8860B',
  },
  // Compensation Styles
  compensationCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  compensationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  compensationCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  compensationCardHeaderText: {
    flex: 1,
  },
  compensationCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFD700',
  },
  compensationCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  compensationStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  compensationStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  compensationStatLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  compensationStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFD700',
  },
  compensationStatDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  compensationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8860B',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  compensationButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  compensationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  compensationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B8860B',
  },
  compensationAmountBox: {
    backgroundColor: '#FFF8DC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  compensationAmountLabel: {
    fontSize: 13,
    color: '#B8860B',
    marginBottom: 4,
  },
  compensationAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#B8860B',
  },
  compensationDates: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  compensationDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  compensationDateLabel: {
    fontSize: 14,
    color: '#666',
  },
  compensationDateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  editCompensationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8860B',
    gap: 8,
  },
  editCompensationBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B8860B',
  },
  noCompensation: {
    alignItems: 'center',
    padding: 20,
  },
  noCompensationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  addCompensationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B8860B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addCompensationBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8DC',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
