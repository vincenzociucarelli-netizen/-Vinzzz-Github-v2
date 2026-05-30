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
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';

import { formatCurrency, formatAmount } from '../../../src/utils/formatCurrency';

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
  country_of_birth?: string;
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
  // Onboarding checklist
  onboarding_checklist?: {
    contract_signed?: boolean;
    ras_registered?: boolean;
    fiscal_code_acquired?: boolean;
    criminal_record?: boolean;
  };
}

export default function AdminDirigenteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dirigente, setDirigente] = useState<Dirigente | null>(null);
  // Last reset audit info (admin info banner near reset button)
  const [lastReset, setLastReset] = useState<any | null>(null);
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
  
  // Onboarding checklist edit state
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [checklistItems, setChecklistItems] = useState({
    contract_signed: false,
    ras_registered: false,
    fiscal_code_acquired: false,
    criminal_record: false,
  });
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');
  const [otherAnnualCompensation, setOtherAnnualCompensation] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [qualifications, setQualifications] = useState<string[]>([]); // Array di tutte le cariche
  const [availableQualifications, setAvailableQualifications] = useState<string[]>([]);
  const [qualificationModalVisible, setQualificationModalVisible] = useState(false);
  // Bank details
  const [documentType, setDocumentType] = useState('');
  const [documentFront, setDocumentFront] = useState('');
  const [documentBack, setDocumentBack] = useState('');
  const [iban, setIban] = useState('');
  const [ibanHolder, setIbanHolder] = useState('');
  const [bankName, setBankName] = useState('');
  // Teams and Venues
  const [teams, setTeams] = useState<{id: string, name: string}[]>([]);
  const [availableVenues, setAvailableVenues] = useState<{name: string}[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedVenueNames, setSelectedVenueNames] = useState<string[]>([]);
  // Signed receipts
  const [signedReceipts, setSignedReceipts] = useState<any[]>([]);
  const [thresholdStatus, setThresholdStatus] = useState<any>(null);
  const [thresholdStatus2, setThresholdStatus2] = useState<any>(null);
  
  // Modal quietanze firmate
  const [receiptsModalVisible, setReceiptsModalVisible] = useState(false);
  
  // Modal per creare quietanza (Admin)
  const [createReceiptModalVisible, setCreateReceiptModalVisible] = useState(false);
  const [newReceiptMonth, setNewReceiptMonth] = useState(new Date().getMonth() + 1);
  const [newReceiptYear, setNewReceiptYear] = useState(new Date().getFullYear());
  const [newReceiptAmount, setNewReceiptAmount] = useState('');
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  
  // Documenti firmati
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [documentsModalVisible, setDocumentsModalVisible] = useState(false);
  
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
      const [userResponse, settingsResponse, teamsResponse] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/settings/society'),
        api.get('/teams'),
      ]);
      
      setDirigente(userResponse.data);
      // Fetch last reset audit info (silent fail if user is not admin)
      try {
        const lr = await api.get(`/admin/audit/last-reset/${id}`);
        setLastReset(lr.data || null);
      } catch {}
      setMonthlyCompensation(userResponse.data.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(userResponse.data.other_annual_compensation?.toString() || '0');
      
      // Format dates from ISO to dd/mm/yyyy for display
      if (userResponse.data.contract_start_date) {
        const [y, m, d] = userResponse.data.contract_start_date.split('-');
        setContractStartDate(`${d}/${m}/${y}`);
      } else {
        setContractStartDate('');
      }
      if (userResponse.data.contract_end_date) {
        const [y, m, d] = userResponse.data.contract_end_date.split('-');
        setContractEndDate(`${d}/${m}/${y}`);
      } else {
        setContractEndDate('');
      }
      
      // Load qualifications - support both new array and legacy fields
      let loadedQualifications: string[] = [];
      if (userResponse.data.qualifications && userResponse.data.qualifications.length > 0) {
        loadedQualifications = userResponse.data.qualifications;
      } else {
        // Fallback to legacy fields if qualifications array is empty
        if (userResponse.data.qualification) {
          loadedQualifications.push(userResponse.data.qualification);
        }
        if (userResponse.data.qualification2) {
          loadedQualifications.push(userResponse.data.qualification2);
        }
      }
      setQualifications(loadedQualifications);
      
      setDocumentType(userResponse.data.document_type || '');
      setDocumentFront(userResponse.data.document_front || '');
      setDocumentBack(userResponse.data.document_back || '');
      setIban(userResponse.data.iban || '');
      setIbanHolder(userResponse.data.iban_holder || '');
      setBankName(userResponse.data.bank_name || '');
      
      // Load teams and venues
      setTeams(teamsResponse.data || []);
      setSelectedTeamIds(userResponse.data.assigned_teams || []);
      setAvailableVenues(settingsResponse.data.venues || []);
      setSelectedVenueNames(userResponse.data.assigned_venues || []);
      
      // Load signed receipts from compensation endpoint
      try {
        const compensationRes = await api.get(`/dirigente/${id}/compensation`);
        if (Array.isArray(compensationRes.data)) {
          setSignedReceipts(compensationRes.data);
        }
      } catch (err) {
        console.log('No compensation data available');
      }
      
      // Load threshold status (year 1 + year 2)
      try {
        const startYear = userResponse.data.contract_start_date 
          ? parseInt(userResponse.data.contract_start_date.split('-')[0]) 
          : new Date().getFullYear();
        const endYear = userResponse.data.contract_end_date 
          ? parseInt(userResponse.data.contract_end_date.split('-')[0]) 
          : startYear;
        const t1Res = await api.get(`/dirigente/${id}/threshold-status/${startYear}`);
        setThresholdStatus(t1Res.data);
        if (endYear > startYear) {
          const t2Res = await api.get(`/dirigente/${id}/threshold-status/${endYear}`);
          setThresholdStatus2(t2Res.data);
        } else {
          setThresholdStatus2(null);
        }
      } catch (e) {
        setThresholdStatus(null);
        setThresholdStatus2(null);
      }
      
      // Load user's signed documents
      try {
        const docsRes = await api.get(`/documents/my-documents?signer_id=${id}`);
        // Filter only signed documents (with signed_at date)
        const signedDocs = (docsRes.data?.documents || []).filter((doc: any) => doc.signed_at);
        signedDocs.sort((a: any, b: any) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime());
        setUserDocuments(signedDocs);
      } catch (docError) {
        console.log('No documents found for user');
        setUserDocuments([]);
      }
      
      // Load available qualifications from settings
      setAvailableQualifications(settingsResponse.data.dirigente_qualifications || []);
      
      // Initialize onboarding checklist state
      const checklist = userResponse.data.onboarding_checklist || {};
      setChecklistItems({
        contract_signed: checklist.contract_signed || false,
        ras_registered: checklist.ras_registered || false,
        fiscal_code_acquired: checklist.fiscal_code_acquired || false,
        criminal_record: checklist.criminal_record || false,
      });
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

  // Admin utility: wipe ALL receipts + threshold declarations + signed PDFs
  // for this dirigente + a specific year. Used for testing/cleanup.
  const handleResetDirigenteYearReceipts = async (year: number) => {
    if (!dirigente || !dirigente.id) {
      showAlert('Errore', 'Dirigente non caricato');
      return;
    }
    const fullName = (dirigente.full_name ||
      `${(dirigente as any).last_name || ''} ${(dirigente as any).first_name || ''}`).trim();
    let confirmed = false;
    if (Platform.OS === 'web') {
      const typed = window.prompt(
        `⚠️ Stai per RICHIEDERE A ${fullName.toUpperCase()} il consenso a cancellare TUTTE le quietanze, dichiarazioni soglie e PDF firmati per l'anno ${year}.\n\nLa cancellazione effettiva avverrà SOLO dopo che il firmatario avrà autorizzato ogni singola richiesta dalla sua dashboard (come per Francesca/Agnese).\n\nDigita esattamente "RESET ${year}" per inviare la richiesta:`
      );
      confirmed = typed === `RESET ${year}`;
    } else {
      confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          `Richiedi reset quietanze ${year}`,
          `Verrà inviata a ${fullName} una richiesta di cancellazione per OGNI quietanza/comunicazione del ${year}. La cancellazione effettiva avverrà solo dopo la sua approvazione.`,
          [
            { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
            { text: 'INVIA RICHIESTA', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
    }
    if (!confirmed) return;
    try {
      const resp = await api.post('/admin/compensations/reset-coach-year', {
        signer_id: dirigente.id,
        year,
      });
      const r = resp.data?.results || {};
      const created = r.deletion_requests_created || 0;
      const pending = r.deletion_requests_already_pending || 0;
      const unsigned = r.unsigned_compensations_deleted || 0;
      const thrUns = r.threshold_declarations_unsigned_deleted || 0;
      showAlert(
        '✅ Richieste inviate',
        `${created} richieste di cancellazione create${pending ? ` (${pending} già in attesa)` : ''}.\n` +
        (unsigned ? `\n• ${unsigned} quietanze NON firmate eliminate subito` : '') +
        (thrUns ? `\n• ${thrUns} dichiarazioni soglia non firmate eliminate subito` : '') +
        `\n\n${fullName} riceverà una notifica e dovrà autorizzare ogni richiesta dalla sua dashboard prima della cancellazione effettiva.`
      );
      await loadData();
      try {
        const lr = await api.get(`/admin/audit/last-reset/${dirigente.id}`);
        setLastReset(lr.data || null);
      } catch {}
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Errore sconosciuto';
      showAlert('Errore Reset', String(msg));
    }
  };

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    try {
      await api.patch(`/users/${id}`, {
        onboarding_checklist: checklistItems,
      });
      showAlert('Successo', 'Checklist onboarding aggiornata');
      setEditingOnboarding(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile salvare la checklist');
    } finally {
      setSavingOnboarding(false);
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
    const monthly = parseFloat(monthlyCompensation.replace(',', '.')) || 0;
    const prior = parseFloat(otherAnnualCompensation.replace(',', '.')) || 0;
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    
    const years: { [year: number]: { months: number, startMonth: string, endMonth: string, total: number, baseAmount: number, supplementary: number, prior: number, grandTotal: number, exceedsThreshold5k: boolean, exceedsThreshold15k: boolean } } = {};
    
    const start = parseDate(contractStartDate);
    const end = parseDate(contractEndDate);
    
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      
      for (let year = startYear; year <= endYear; year++) {
        const yearStartMonth = (year === startYear) ? start.getMonth() : 0;
        const yearEndMonth = (year === endYear) ? end.getMonth() : 11;
        
        const monthsThisYear = yearEndMonth - yearStartMonth + 1;
        
        // Calculate from actual receipts if available
        const yearReceipts = (signedReceipts || []).filter((r: any) => {
          if (r.year !== year) return false;
          const monthIndex = r.month - 1;
          return monthIndex >= yearStartMonth && monthIndex <= yearEndMonth;
        });
        
        const baseAmountThisYear = monthly * monthsThisYear;
        
        // Calculate supplementary: difference between receipt amount and monthly rate
        let supplementaryThisYear = 0;
        yearReceipts.forEach((receipt: any) => {
          const receiptAmount = receipt.amount_gross || receipt.amount || 0;
          if (receiptAmount > monthly) {
            supplementaryThisYear += receiptAmount - monthly;
          }
        });
        
        const totalThisYear = baseAmountThisYear + supplementaryThisYear;
        const priorThisYear = (year === startYear) ? prior : 0;
        const grandTotalThisYear = priorThisYear + totalThisYear;
        
        years[year] = {
          months: monthsThisYear,
          startMonth: monthNames[yearStartMonth],
          endMonth: monthNames[yearEndMonth],
          total: totalThisYear,
          baseAmount: baseAmountThisYear,
          supplementary: supplementaryThisYear,
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
    const monthly = parseFloat(monthlyCompensation.replace(',', '.')) || 0;
    const prior = parseFloat(otherAnnualCompensation.replace(',', '.')) || 0;
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
    
    // Calculate base total (monthly × months)
    const thisClubTotal = monthly * monthsInContract;
    
    // Calculate supplementary amounts from receipts within contract period
    let supplementaryTotal = 0;
    let contractStartMonth = 0;
    let contractEndMonth = 11;
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      contractStartMonth = start.getMonth();
      contractEndMonth = end.getMonth();
      startYear = start.getFullYear();
      endYear = end.getFullYear();
    }
    
    if (signedReceipts && signedReceipts.length > 0) {
      signedReceipts.forEach((receipt: any) => {
        const receiptAmount = receipt.amount_gross || receipt.amount || 0;
        const receiptYear = receipt.year;
        const receiptMonth = receipt.month - 1; // Convert to 0-indexed
        
        let isInContract = false;
        if (startYear === endYear) {
          isInContract = receiptYear === startYear && receiptMonth >= contractStartMonth && receiptMonth <= contractEndMonth;
        } else {
          if (receiptYear === startYear) {
            isInContract = receiptMonth >= contractStartMonth;
          } else if (receiptYear === endYear) {
            isInContract = receiptMonth <= contractEndMonth;
          } else if (receiptYear > startYear && receiptYear < endYear) {
            isInContract = true;
          }
        }
        
        if (isInContract && receiptAmount > monthly) {
          supplementaryTotal += receiptAmount - monthly;
        }
      });
    }
    
    return {
      monthly,
      prior,
      monthsInContract,
      startMonthName,
      endMonthName,
      startYear,
      endYear,
      thisClubTotal,
      supplementaryTotal,
      grandTotal: thisClubTotal + supplementaryTotal
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
      
      await api.patch(`/users/${id}/compensation`, {
        monthly_compensation: parseFloat(monthlyCompensation.replace(',', '.')) || 0,
        other_annual_compensation: parseFloat(otherAnnualCompensation.replace(',', '.')) || 0,
        contract_start_date: isoStartDate,
        contract_end_date: isoEndDate,
        assigned_teams: selectedTeamIds,
        assigned_venues: selectedVenueNames,
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
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
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
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
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

        {/* Checklist + Documenti on one row */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 }}>
          {/* Onboarding Checklist Button - compact */}
          {dirigente.status === 'approved' && (() => {
            const checklist = dirigente.onboarding_checklist || {};
            const totalItems = 4;
            const completedItems = [
              checklist.contract_signed,
              checklist.ras_registered,
              checklist.fiscal_code_acquired,
              checklist.criminal_record
            ].filter(Boolean).length;
            const isComplete = completedItems === totalItems;
            
            return (
              <TouchableOpacity 
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: isComplete ? '#4CAF50' : '#F44336',
                }}
                onPress={() => setEditingOnboarding(true)}
              >
                <Ionicons name={isComplete ? "checkmark-circle" : "alert-circle"} size={20} color="#fff" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>Checklist</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{completedItems}/{totalItems}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </TouchableOpacity>
            );
          })()}

          {/* Documenti Firmati Button - compact */}
          <TouchableOpacity 
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
              borderRadius: 10,
              backgroundColor: '#3498DB',
            }}
            onPress={() => setDocumentsModalVisible(true)}
          >
            <Ionicons name="folder-open" size={20} color="#fff" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>Documenti</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{userDocuments.length} firmati</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Passa a Modalità Dirigente */}
        <TouchableOpacity
          style={{
            backgroundColor: '#F3E5F5',
            marginHorizontal: 16,
            marginTop: 8,
            padding: 12,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#8E44AD',
          }}
          data-testid="switch-to-dirigente-view-btn"
          onPress={() => router.replace('/dirigente')}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="briefcase" size={20} color="#8E44AD" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E44AD' }}>Passa a Modalità Dirigente</Text>
            <Text style={{ fontSize: 11, color: '#666' }}>Compensi, quietanze e profilo</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={24} color="#8E44AD" />
        </TouchableOpacity>

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
            <Text style={styles.label}>Stato di nascita</Text>
            <Text style={styles.value}>{dirigente.country_of_birth || 'Italia'}</Text>
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
          <Text style={styles.cardTitle}>🏅 Cariche nella Società</Text>
          {availableQualifications.length > 0 ? (
            <View>
              {/* Tags delle cariche assegnate */}
              <View style={styles.tagsContainer}>
                {(!qualifications || qualifications.length === 0) ? (
                  <Text style={styles.emptyTagsText}>Nessuna carica assegnata</Text>
                ) : (
                  qualifications.map((q, index) => (
                    <View key={index} style={styles.qualificationTag}>
                      <Text style={styles.qualificationTagText}>{q}</Text>
                      <TouchableOpacity 
                        onPress={async () => {
                          const newQualifications = qualifications.filter(qual => qual !== q);
                          setQualifications(newQualifications);
                          try {
                            await api.patch(`/users/${id}`, { qualifications: newQualifications });
                          } catch (error) {
                            console.error('Error removing qualification:', error);
                            setQualifications(qualifications); // Rollback on error
                          }
                        }}
                      >
                        <Ionicons name="close-circle" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
              
              {/* Selettore per aggiungere cariche */}
              <TouchableOpacity
                style={styles.addQualificationBtn}
                onPress={() => setQualificationModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="#34C759" />
                <Text style={styles.addQualificationText}>Aggiungi carica...</Text>
              </TouchableOpacity>
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

        {/* Incarichi Assegnati (sempre visibili) */}
        {(selectedTeamIds.length > 0 || selectedVenueNames.length > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Incarichi Assegnati</Text>
            
            {selectedTeamIds.length > 0 && (
              <View style={{ marginBottom: selectedVenueNames.length > 0 ? 12 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="people" size={16} color="#007AFF" />
                  <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#333' }}>Squadre</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {teams.filter(t => selectedTeamIds.includes(t.id)).map((team) => (
                    <View
                      key={team.id}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 14,
                        backgroundColor: '#E3F2FD',
                        borderWidth: 1,
                        borderColor: '#007AFF',
                      }}
                    >
                      <Text style={{ color: '#007AFF', fontWeight: '500', fontSize: 12 }}>{team.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {selectedVenueNames.length > 0 && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="location" size={16} color="#FF9500" />
                  <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#333' }}>Palestre</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {selectedVenueNames.map((venue, idx) => (
                    <View
                      key={idx}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 14,
                        backgroundColor: '#FFF3E0',
                        borderWidth: 1,
                        borderColor: '#FF9500',
                      }}
                    >
                      <Text style={{ color: '#E65100', fontWeight: '500', fontSize: 12 }}>{venue}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

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
              <Text style={styles.inputLabel}>Importo Mensile (€) - Questa ASD/SSD</Text>
              <TextInput
                style={styles.input}
                value={monthlyCompensation}
                onChangeText={(text) => {
                  // Allow numbers and comma for decimals (Italian format)
                  const cleaned = text.replace(/[^0-9,]/g, '');
                  const parts = cleaned.split(',');
                  const formatted = parts.length > 2 ? parts[0] + ',' + parts.slice(1).join('') : cleaned;
                  setMonthlyCompensation(formatted);
                }}
                onFocus={() => { if (monthlyCompensation === '0' || monthlyCompensation === '') setMonthlyCompensation(''); }}
                keyboardType="decimal-pad"
                placeholder="€ 0,00"
                placeholderTextColor="#999"
                selectTextOnFocus={true}
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Compensi Pregressi (€) - Da altre ASD/SSD nell'anno</Text>
              <TextInput
                style={styles.input}
                value={otherAnnualCompensation}
                onChangeText={(text) => {
                  // Allow numbers and comma for decimals (Italian format)
                  const cleaned = text.replace(/[^0-9,]/g, '');
                  const parts = cleaned.split(',');
                  const formatted = parts.length > 2 ? parts[0] + ',' + parts.slice(1).join('') : cleaned;
                  setOtherAnnualCompensation(formatted);
                }}
                onFocus={() => { if (otherAnnualCompensation === '0' || otherAnnualCompensation === '') setOtherAnnualCompensation(''); }}
                keyboardType="decimal-pad"
                placeholder="€ 0,00"
                placeholderTextColor="#999"
                selectTextOnFocus={true}
              />
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4, marginBottom: 12 }}>
                Compensi già percepiti da altre società sportive nell'anno solare corrente
              </Text>
              
              {/* Date Contratto - Una riga */}
              <Text style={styles.inputLabel}>📅 Periodo Contratto</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Data Inizio</Text>
                  <TextInput
                    style={styles.input}
                    value={contractStartDate}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '');
                      let formatted = '';
                      if (cleaned.length > 0) formatted = cleaned.substring(0, 2);
                      if (cleaned.length > 2) formatted += '/' + cleaned.substring(2, 4);
                      if (cleaned.length > 4) formatted += '/' + cleaned.substring(4, 8);
                      setContractStartDate(formatted);
                    }}
                    placeholder="gg/mm/aaaa"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Data Fine</Text>
                  <TextInput
                    style={styles.input}
                    value={contractEndDate}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '');
                      let formatted = '';
                      if (cleaned.length > 0) formatted = cleaned.substring(0, 2);
                      if (cleaned.length > 2) formatted += '/' + cleaned.substring(2, 4);
                      if (cleaned.length > 4) formatted += '/' + cleaned.substring(4, 8);
                      setContractEndDate(formatted);
                    }}
                    placeholder="gg/mm/aaaa"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
              
              {/* Assegnazione Squadre */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                <Ionicons name="people" size={18} color="#007AFF" />
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
                <Text style={styles.compensationAmount}>{formatCurrency(dirigente.monthly_compensation || 0)}</Text>
                <Text style={styles.compensationPeriod}> / mese</Text>
              </View>
              {(dirigente as any).other_annual_compensation > 0 && (
                <View style={{ marginTop: 8, padding: 10, backgroundColor: '#FFF8E1', borderRadius: 8, borderWidth: 1, borderColor: '#F9A825' }}>
                  <Text style={{ fontSize: 12, color: '#F9A825', fontWeight: '600' }}>
                    + {formatCurrency((dirigente as any).other_annual_compensation)} compensi pregressi da altre ASD/SSD
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
                    const prior = parseFloat(otherAnnualCompensation.replace(',', '.')) || 0;
                    
                    return (
                      <>
                        {/* Box RAS - Totale Contratto */}
                        <View style={[styles.totalBox, { backgroundColor: '#E3F2FD', marginBottom: 12 }]}>
                          <Text style={[styles.totalLabel, { color: '#1565C0', fontWeight: 'bold' }]}>
                            📄 Comunicazione RAS - Totale Contratto
                          </Text>
                          <Text style={{ color: '#1565C0', fontSize: 12, marginTop: 4 }}>
                            Dal {contractStartDate.split('-').reverse().join('/')} al {contractEndDate.split('-').reverse().join('/')} = {breakdown.monthsInContract} mesi
                          </Text>
                          {/* Linear layout */}
                          <View style={{ marginTop: 8 }}>
                            <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(breakdown.thisClubTotal)}</Text></Text>
                            <Text style={{ fontSize: 11, color: '#1565C0', marginBottom: 4 }}>  ({breakdown.monthsInContract} mesi × {formatCurrency(parseFloat(monthlyCompensation.replace(',', '.')) || 0)})</Text>
                            <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(breakdown.supplementaryTotal || 0)}</Text></Text>
                            <Text style={{ fontSize: 15, color: '#1565C0', fontWeight: 'bold', marginTop: 4, borderTopWidth: 1, borderTopColor: '#90CAF9', paddingTop: 8 }}>• TOTALE RAS: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(breakdown.grandTotal)}</Text></Text>
                          </View>
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
                            <View style={{ marginTop: 8 }}>
                              <Text style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[0]].baseAmount || yearlyBreakdown[years[0]].total)}</Text></Text>
                              <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[0]].supplementary || 0)}</Text></Text>
                              {prior > 0 && (
                                <Text style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>• Pregressi: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(prior)}</Text></Text>
                              )}
                              <Text style={{ fontSize: 15, color: yearlyBreakdown[years[0]].exceedsThreshold15k ? '#8E44AD' : yearlyBreakdown[years[0]].exceedsThreshold5k ? '#F57F17' : '#2E7D32', fontWeight: 'bold', marginTop: 4 }}>• Totale Anno: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[0]].grandTotal)}</Text></Text>
                            </View>
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
                            <View style={{ marginTop: 8 }}>
                              <Text style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[1]].baseAmount || yearlyBreakdown[years[1]].total)}</Text></Text>
                              <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[1]].supplementary || 0)}</Text></Text>
                              {yearlyBreakdown[years[1]].priorCompensation > 0 && (
                                <Text style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>• Pregressi: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[1]].priorCompensation)}</Text></Text>
                              )}
                              <Text style={{ fontSize: 15, color: yearlyBreakdown[years[1]].exceedsThreshold15k ? '#8E44AD' : yearlyBreakdown[years[1]].exceedsThreshold5k ? '#F57F17' : '#2E7D32', fontWeight: 'bold', marginTop: 4 }}>• Totale Anno: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(yearlyBreakdown[years[1]].grandTotal)}</Text></Text>
                            </View>
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
          
          {/* Threshold Warnings/Signed Banners (admin view) */}
          {(thresholdStatus || thresholdStatus2) && (
            <View style={{ marginTop: 12, gap: 10 }}>
              {/* Warning 5k - YEAR 1 */}
              {thresholdStatus?.thresholds?.['5000']?.needs_warning && !thresholdStatus?.thresholds?.['5000']?.declaration_signed && (
                <View style={{ backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: '#FF9800', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#E65100', textAlign: 'center', marginBottom: 6 }}>⚠️ Anno {dirigente?.contract_start_date?.split('-')[0]}: Soglia dei €5.000</Text>
                  <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', lineHeight: 18 }}>
                    Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus?.thresholds?.['5000']?.threshold_month || 0]}</Text> supererà la soglia previdenziale di €5.000.
                  </Text>
                  <Text style={{ fontSize: 12, color: '#E65100', textAlign: 'center', fontStyle: 'italic', marginTop: 4 }}>Contributi previdenziali INPS</Text>
                </View>
              )}
              {/* Warning 15k - YEAR 1 */}
              {thresholdStatus?.thresholds?.['15000']?.needs_warning && !thresholdStatus?.thresholds?.['15000']?.declaration_signed && (
                <View style={{ backgroundColor: '#F3E5F5', borderWidth: 2, borderColor: '#9C27B0', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#6A1B9A', textAlign: 'center', marginBottom: 6 }}>🚨 Anno {dirigente?.contract_start_date?.split('-')[0]}: Soglia dei €15.000</Text>
                  <Text style={{ fontSize: 13, color: '#6A1B9A', textAlign: 'center', lineHeight: 18 }}>
                    Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus?.thresholds?.['15000']?.threshold_month || 0]}</Text> supererà la soglia fiscale di €15.000.
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6A1B9A', textAlign: 'center', fontStyle: 'italic', marginTop: 4 }}>Tassazione IRPEF obbligatoria</Text>
                </View>
              )}
              {/* Warning 5k - YEAR 2 */}
              {thresholdStatus2?.thresholds?.['5000']?.needs_warning && !thresholdStatus2?.thresholds?.['5000']?.declaration_signed && (
                <View style={{ backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: '#FF9800', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#E65100', textAlign: 'center', marginBottom: 6 }}>⚠️ Anno {dirigente?.contract_end_date?.split('-')[0]}: Soglia dei €5.000</Text>
                  <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', lineHeight: 18 }}>
                    Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus2?.thresholds?.['5000']?.threshold_month || 0]}</Text> supererà la soglia previdenziale di €5.000.
                  </Text>
                  <Text style={{ fontSize: 12, color: '#E65100', textAlign: 'center', fontStyle: 'italic', marginTop: 4 }}>Contributi previdenziali INPS</Text>
                </View>
              )}
              {/* Warning 15k - YEAR 2 */}
              {thresholdStatus2?.thresholds?.['15000']?.needs_warning && !thresholdStatus2?.thresholds?.['15000']?.declaration_signed && (
                <View style={{ backgroundColor: '#F3E5F5', borderWidth: 2, borderColor: '#9C27B0', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#6A1B9A', textAlign: 'center', marginBottom: 6 }}>🚨 Anno {dirigente?.contract_end_date?.split('-')[0]}: Soglia dei €15.000</Text>
                  <Text style={{ fontSize: 13, color: '#6A1B9A', textAlign: 'center', lineHeight: 18 }}>
                    Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus2?.thresholds?.['15000']?.threshold_month || 0]}</Text> supererà la soglia fiscale di €15.000.
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6A1B9A', textAlign: 'center', fontStyle: 'italic', marginTop: 4 }}>Tassazione IRPEF obbligatoria</Text>
                </View>
              )}
              {/* Signed declarations - YEAR 1 */}
              {thresholdStatus?.thresholds?.['5000']?.declaration_signed && (
                <View style={{ backgroundColor: '#D4EDDA', borderWidth: 2, borderColor: '#28A745', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#155724', textAlign: 'center', marginBottom: 6 }}>✅ Anno {dirigente?.contract_start_date?.split('-')[0]}: Dichiarazione €5.000 firmata</Text>
                  <Text style={{ fontSize: 13, color: '#155724', textAlign: 'center', fontStyle: 'italic' }}>Soglia previdenziale comunicata{((thresholdStatus?.thresholds?.['5000']?.threshold_month) && (thresholdStatus?.thresholds?.['5000']?.threshold_month) >= 1 && (thresholdStatus?.thresholds?.['5000']?.threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus?.thresholds?.['5000']?.threshold_month]})` : ''}</Text>
                </View>
              )}
              {thresholdStatus?.thresholds?.['15000']?.declaration_signed && (
                <View style={{ backgroundColor: '#D4EDDA', borderWidth: 2, borderColor: '#28A745', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#155724', textAlign: 'center', marginBottom: 6 }}>✅ Anno {dirigente?.contract_start_date?.split('-')[0]}: Dichiarazione €15.000 firmata</Text>
                  <Text style={{ fontSize: 13, color: '#155724', textAlign: 'center', fontStyle: 'italic' }}>Soglia fiscale comunicata{((thresholdStatus?.thresholds?.['15000']?.threshold_month) && (thresholdStatus?.thresholds?.['15000']?.threshold_month) >= 1 && (thresholdStatus?.thresholds?.['15000']?.threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus?.thresholds?.['15000']?.threshold_month]})` : ''}</Text>
                </View>
              )}
              {/* Signed declarations - YEAR 2 */}
              {thresholdStatus2?.thresholds?.['5000']?.declaration_signed && (
                <View style={{ backgroundColor: '#E3F2FD', borderWidth: 2, borderColor: '#2196F3', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1565C0', textAlign: 'center', marginBottom: 6 }}>✅ Anno {dirigente?.contract_end_date?.split('-')[0]}: Dichiarazione €5.000 firmata</Text>
                  <Text style={{ fontSize: 13, color: '#1565C0', textAlign: 'center', fontStyle: 'italic' }}>Soglia previdenziale comunicata{((thresholdStatus2?.thresholds?.['5000']?.threshold_month) && (thresholdStatus2?.thresholds?.['5000']?.threshold_month) >= 1 && (thresholdStatus2?.thresholds?.['5000']?.threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus2?.thresholds?.['5000']?.threshold_month]})` : ''}</Text>
                </View>
              )}
              {thresholdStatus2?.thresholds?.['15000']?.declaration_signed && (
                <View style={{ backgroundColor: '#E3F2FD', borderWidth: 2, borderColor: '#2196F3', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1565C0', textAlign: 'center', marginBottom: 6 }}>✅ Anno {dirigente?.contract_end_date?.split('-')[0]}: Dichiarazione €15.000 firmata</Text>
                  <Text style={{ fontSize: 13, color: '#1565C0', textAlign: 'center', fontStyle: 'italic' }}>Soglia fiscale comunicata{((thresholdStatus2?.thresholds?.['15000']?.threshold_month) && (thresholdStatus2?.thresholds?.['15000']?.threshold_month) >= 1 && (thresholdStatus2?.thresholds?.['15000']?.threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus2?.thresholds?.['15000']?.threshold_month]})` : ''}</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Totale già percepito (quietanze firmate) - Banner cliccabile */}
          {signedReceipts.filter((r: any) => r.receipt_signed).length > 0 && (
            <TouchableOpacity 
              style={{ marginTop: 12, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, borderWidth: 1, borderColor: '#90CAF9' }}
              onPress={() => setReceiptsModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#1565C0', fontWeight: '500' }}>💰 Già Percepito:</Text>
                  <Ionicons name="chevron-forward" size={16} color="#1565C0" style={{ marginLeft: 4 }} />
                </View>
                <Text style={{ fontWeight: 'bold', color: '#1565C0', fontSize: 16 }}>
                  {formatCurrency(signedReceipts
                    .filter((r: any) => r.receipt_signed)
                    .reduce((sum: number, r: any) => sum + (r.amount_gross || r.amount || 0), 0)
                    )}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {signedReceipts.filter((r: any) => r.receipt_signed).length} quietanze firmate - Tocca per vedere
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Pulsante Genera Quietanza - Solo Admin */}
          <TouchableOpacity 
            style={{ 
              marginTop: 12, 
              padding: 12, 
              backgroundColor: '#4CAF50', 
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onPress={() => {
              setNewReceiptAmount(dirigente?.monthly_compensation?.toString() || '0');
              setCreateReceiptModalVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
              Genera Quietanza Personalizzata
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dati Bancari - Solo visualizzazione per Admin */}

        {/* Documenti e IBAN - Solo per utenti approvati */}
        {dirigente.status === 'approved' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🏦 Dati Bancari</Text>
              <TouchableOpacity onPress={() => setEditingBank(!editingBank)}>
                <Ionicons name={editingBank ? "close" : "create"} size={22} color="#8E44AD" />
              </TouchableOpacity>
            </View>

            {editingBank ? (
              <>
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

      {/* Qualification Selection Modal - Add multiple qualifications */}
      <Modal
        visible={qualificationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQualificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qualificationModalContent}>
            <View style={styles.qualificationModalHeader}>
              <Text style={styles.qualificationModalTitle}>🏅 Aggiungi Carica</Text>
              <TouchableOpacity onPress={() => setQualificationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.qualificationModalList}>
              {availableQualifications.filter(q => !qualifications.includes(q)).length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={40} color="#34C759" />
                  <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
                    Tutte le cariche disponibili sono già state assegnate
                  </Text>
                </View>
              ) : (
                availableQualifications.filter(q => !qualifications.includes(q)).map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={styles.qualificationModalItem}
                    onPress={async () => {
                      const newQualifications = [...qualifications, q];
                      setQualifications(newQualifications);
                      setQualificationModalVisible(false);
                      try {
                        await api.patch(`/users/${id}`, { qualifications: newQualifications });
                        showAlert('Successo', `Carica "${q}" aggiunta`);
                      } catch (error) {
                        console.error('Error adding qualification:', error);
                        setQualifications(qualifications); // Rollback
                        showAlert('Errore', 'Impossibile aggiungere la carica');
                      }
                    }}
                  >
                    <Ionicons name="add" size={22} color="#34C759" />
                    <Text style={styles.qualificationModalItemText}>{q}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.qualificationModalCancelBtn}
              onPress={() => setQualificationModalVisible(false)}
            >
              <Text style={styles.qualificationModalCancelText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quietanze Firmate Modal */}
      <Modal
        visible={receiptsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReceiptsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>📋 Gestione Quietanze</Text>
              <TouchableOpacity onPress={() => setReceiptsModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ padding: 12 }}>
              {/* Quietanze in attesa di firma */}
              {signedReceipts.filter((r: any) => !r.receipt_signed).length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF9800', marginBottom: 8 }}>
                    ⏳ In attesa di firma ({signedReceipts.filter((r: any) => !r.receipt_signed).length})
                  </Text>
                  {signedReceipts
                    .filter((r: any) => !r.receipt_signed)
                    .sort((a: any, b: any) => {
                      if (a.year !== b.year) return b.year - a.year;
                      return b.month - a.month;
                    })
                    .map((receipt: any) => {
                      const MONTH_NAMES_SHORT = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                      return (
                        <View key={`pending-${receipt.month}-${receipt.year}`} style={{ 
                          flexDirection: 'row', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          backgroundColor: '#FFF3E0', 
                          padding: 12, 
                          borderRadius: 8, 
                          marginBottom: 8,
                          borderLeftWidth: 3,
                          borderLeftColor: '#FF9800'
                        }}>
                          <View>
                            <Text style={{ fontWeight: '600', color: '#E65100' }}>
                              {MONTH_NAMES_SHORT[receipt.month]} {receipt.year}
                            </Text>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                              {formatCurrency(receipt.amount_gross || receipt.amount || 0)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#2196F3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                              onPress={() => {
                                setSelectedMonthForReceipt(receipt.month);
                                setSelectedYearForReceipt(receipt.year);
                                setCustomReceiptAmount(String(receipt.amount_gross || receipt.amount || ''));
                                setReceiptsModalVisible(false);
                                setCreateReceiptModalVisible(true);
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '500', fontSize: 12 }}>Modifica</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: '#F44336', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                              onPress={() => {
                                Alert.alert(
                                  'Elimina Quietanza',
                                  `Eliminare la quietanza di ${MONTH_NAMES_SHORT[receipt.month]} ${receipt.year}?`,
                                  [
                                    { text: 'Annulla', style: 'cancel' },
                                    { 
                                      text: 'Elimina', 
                                      style: 'destructive',
                                      onPress: async () => {
                                        try {
                                          await api.delete(`/admin/dirigente/${id}/compensation/${receipt.year}/${receipt.month}`);
                                          showAlert('Eliminata', 'Quietanza eliminata');
                                          loadData();
                                        } catch (error) {
                                          showAlert('Errore', 'Impossibile eliminare la quietanza');
                                        }
                                      }
                                    }
                                  ]
                                );
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '500', fontSize: 12 }}>Elimina</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
              
              {/* Totale firmato */}
              <View style={{ backgroundColor: '#E8F5E9', padding: 12, borderRadius: 10, marginBottom: 12 }}>
                <Text style={{ color: '#2E7D32', fontWeight: '600', fontSize: 13 }}>💰 Totale Percepito</Text>
                <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 24, marginTop: 2 }}>
                  {formatCurrency(signedReceipts
                    .filter((r: any) => r.receipt_signed)
                    .reduce((sum: number, r: any) => sum + (r.amount_gross || r.amount || 0), 0)
                    )}
                </Text>
                <Text style={{ color: '#666', fontSize: 11 }}>
                  {signedReceipts.filter((r: any) => r.receipt_signed).length} quietanze firmate
                </Text>
              </View>

              {/* ADMIN UTILITY — Reset quietanze di un anno (irreversibile) */}
              <View style={{ backgroundColor: '#FFEBEE', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FFCDD2' }}>
                <Text style={{ color: '#B71C1C', fontWeight: '700', fontSize: 12, marginBottom: 6 }}>
                  🧹 Richiedi Reset Quietanze (Admin)
                </Text>
                <Text style={{ color: '#7F0000', fontSize: 11, marginBottom: 8 }}>
                  Invia richiesta di cancellazione a questo dirigente per TUTTE le quietanze, soglie e PDF firmati dell'anno scelto. Cancellazione effettiva solo dopo approvazione del firmatario.
                </Text>
                {lastReset && lastReset.timestamp && (
                  <Text style={{ color: '#7F0000', fontSize: 10, marginBottom: 8, fontStyle: 'italic' }}>
                    Ultimo reset: anno {lastReset.year} • {new Date(lastReset.timestamp.endsWith?.('Z') ? lastReset.timestamp : lastReset.timestamp + 'Z').toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })} da {lastReset.admin_name || lastReset.admin_email || 'admin'}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                    <TouchableOpacity
                      key={`reset-y-${y}`}
                      onPress={() => handleResetDirigenteYearReceipts(y)}
                      style={{ backgroundColor: '#C62828', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, flex: 1, minWidth: 130 }}
                      testID={`reset-receipts-${y}`}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
                        Richiedi reset {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Lista quietanze compatta - con calcolo soglie dinamico */}
              {(() => {
                const signedOnly = signedReceipts.filter((r: any) => r.receipt_signed);
                
                // Sort chronologically to calculate thresholds
                const sortedForCalc = [...signedOnly].sort((a: any, b: any) => {
                  if (a.year !== b.year) return a.year - b.year;
                  return a.month - b.month;
                });
                
                // Calculate threshold months per year
                const thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } } = {};
                const cumulativeByYear: { [year: number]: number } = {};
                const priorComp = dirigente?.other_annual_compensation || 0;
                const contractYear = dirigente?.contract_start_date ? parseInt(dirigente.contract_start_date.split('-')[0]) : new Date().getFullYear();
                
                // Add prior compensation to first year
                if (priorComp > 0) {
                  cumulativeByYear[contractYear] = priorComp;
                }
                
                for (const r of sortedForCalc) {
                  if (!thresholdsByYear[r.year]) {
                    thresholdsByYear[r.year] = { first5k: null, first15k: null };
                  }
                  if (!cumulativeByYear[r.year]) {
                    cumulativeByYear[r.year] = r.year === contractYear ? (priorComp || 0) : 0;
                  }
                  
                  cumulativeByYear[r.year] += (r.amount_gross || r.amount || 0);
                  
                  if (cumulativeByYear[r.year] > 5000 && thresholdsByYear[r.year].first5k === null) {
                    thresholdsByYear[r.year].first5k = r.month;
                  }
                  if (cumulativeByYear[r.year] > 15000 && thresholdsByYear[r.year].first15k === null) {
                    thresholdsByYear[r.year].first15k = r.month;
                  }
                }
                
                // Now render sorted by most recent first
                const sortedForDisplay = [...signedOnly].sort((a: any, b: any) => {
                  if (a.year !== b.year) return b.year - a.year;
                  return b.month - a.month;
                });
                
                return sortedForDisplay.map((receipt: any, index: number) => {
                  const MONTH_NAMES = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                  
                  // Check if this month is at or after threshold
                  const yearThresholds = thresholdsByYear[receipt.year] || { first5k: null, first15k: null };
                  const isAfter5k = yearThresholds.first5k !== null && receipt.month >= yearThresholds.first5k;
                  const isAfter15k = yearThresholds.first15k !== null && receipt.month >= yearThresholds.first15k;
                  const isThreshold5kMonth = yearThresholds.first5k === receipt.month;
                  const isThreshold15kMonth = yearThresholds.first15k === receipt.month;
                  
                  return (
                    <View 
                      key={index} 
                      style={{ 
                        backgroundColor: isAfter15k ? '#F3E5F5' : isAfter5k ? '#FFF8E1' : '#E8F5E9',
                        paddingVertical: 8, 
                        paddingHorizontal: 10,
                        marginBottom: 6,
                        borderLeftWidth: 3,
                        borderLeftColor: isAfter15k ? '#8E44AD' : isAfter5k ? '#FF9800' : '#4CAF50',
                        borderRadius: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                            {MONTH_NAMES[receipt.month]} {receipt.year}
                          </Text>
                          {isThreshold5kMonth && !isThreshold15kMonth && (
                            <View style={{ backgroundColor: '#FF9800', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, marginLeft: 6 }}>
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>&gt;5K</Text>
                            </View>
                          )}
                          {isThreshold15kMonth && (
                            <View style={{ backgroundColor: '#8E44AD', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, marginLeft: 6 }}>
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>&gt;15K</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2E7D32' }}>
                          {formatCurrency((receipt.amount_gross || receipt.amount || 0))}
                        </Text>
                      </View>
                    </View>
                  );
                });
              })()}
              
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Receipt Modal - Admin Only */}
      <Modal
        visible={createReceiptModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateReceiptModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 }}>
              📝 Genera Quietanza Personalizzata
            </Text>
            
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              Crea una quietanza con importo personalizzato per questo mese. Il dirigente dovrà poi firmarla.
            </Text>
            
            {/* Mese e Anno */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Mese</Text>
                <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8 }}>
                  <Picker
                    selectedValue={newReceiptMonth}
                    onValueChange={(value) => setNewReceiptMonth(value)}
                    style={{ height: 50 }}
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <Picker.Item key={m} label={['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][m-1]} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Anno</Text>
                <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8 }}>
                  <Picker
                    selectedValue={newReceiptYear}
                    onValueChange={(value) => setNewReceiptYear(value)}
                    style={{ height: 50 }}
                  >
                    {[2024,2025,2026,2027].map(y => (
                      <Picker.Item key={y} label={y.toString()} value={y} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            
            {/* Importo */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Importo Lordo (€)</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 18,
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
                value={newReceiptAmount}
                onChangeText={setNewReceiptAmount}
                keyboardType="numeric"
                placeholder="0.00"
              />
              <Text style={{ fontSize: 11, color: '#999', marginTop: 4, textAlign: 'center' }}>
                Compenso base: {formatCurrency(dirigente?.monthly_compensation || 0)}
              </Text>
            </View>
            
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8, alignItems: 'center' }}
                onPress={() => setCreateReceiptModalVisible(false)}
              >
                <Text style={{ color: '#666' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ 
                  flex: 1, 
                  padding: 12, 
                  backgroundColor: creatingReceipt ? '#ccc' : '#4CAF50', 
                  borderRadius: 8, 
                  alignItems: 'center' 
                }}
                disabled={creatingReceipt}
                onPress={async () => {
                  if (!newReceiptAmount || parseFloat(newReceiptAmount) <= 0) {
                    showAlert('Errore', 'Inserisci un importo valido');
                    return;
                  }
                  setCreatingReceipt(true);
                  try {
                    const response = await api.post(`/admin/dirigente/${id}/compensation/create-receipt`, {
                      month: newReceiptMonth,
                      year: newReceiptYear,
                      amount_gross: parseFloat(newReceiptAmount)
                    });
                    showAlert('Successo', response.data.message);
                    setCreateReceiptModalVisible(false);
                    loadData();
                  } catch (error: any) {
                    showAlert('Errore', error.response?.data?.detail || 'Errore nella creazione');
                  } finally {
                    setCreatingReceipt(false);
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {creatingReceipt ? 'Creazione...' : 'Genera'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Documents Modal */}
      <Modal
        visible={documentsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDocumentsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>📁 Documenti Firmati</Text>
              <TouchableOpacity onPress={() => setDocumentsModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ padding: 12 }}>
              {userDocuments.length === 0 ? (
                <Text style={{ color: '#666', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                  Nessun documento firmato
                </Text>
              ) : (
                userDocuments
                  .sort((a: any, b: any) => new Date(b.signed_at || 0).getTime() - new Date(a.signed_at || 0).getTime())
                  .map((doc: any, index: number) => (
                  <TouchableOpacity
                    key={doc.id || index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: doc.document_type === 'privacy_consent' ? '#4CAF50' : 
                                      doc.document_type?.includes('compensation') ? '#007AFF' :
                                      doc.document_type?.includes('5000') ? '#FF9800' :
                                      doc.document_type?.includes('15000') ? '#8E44AD' : '#007AFF',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                    onPress={async () => {
                      try {
                        const response = await api.get(`/documents/download/${doc.id}`, { responseType: 'blob' });
                        if (Platform.OS === 'web') {
                          const url = window.URL.createObjectURL(new Blob([response.data]));
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = doc.pdf_filename || 'documento.pdf';
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        }
                      } catch (err) {
                        showAlert('Errore', 'Impossibile scaricare il documento');
                      }
                    }}
                  >
                    <Ionicons 
                      name={doc.document_type === 'privacy_consent' ? 'shield-checkmark' : 
                            doc.document_type?.includes('compensation') ? 'receipt' :
                            doc.document_type?.includes('5000') ? 'alert-circle' :
                            doc.document_type?.includes('15000') ? 'warning' : 'document-text'} 
                      size={22} 
                      color={doc.document_type === 'privacy_consent' ? '#4CAF50' : 
                             doc.document_type?.includes('compensation') ? '#007AFF' :
                             doc.document_type?.includes('5000') ? '#FF9800' :
                             doc.document_type?.includes('15000') ? '#8E44AD' : '#007AFF'} 
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }} numberOfLines={2}>
                        {doc.document_title}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                        {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : ''}
                      </Text>
                    </View>
                    <Ionicons name="download-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Onboarding Checklist Edit Modal */}
      <Modal
        visible={editingOnboarding}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingOnboarding(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.onboardingModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>📋 Checklist Onboarding</Text>
              <Text style={styles.modalSubtitle}>{dirigente?.full_name}</Text>
              
              <Text style={styles.onboardingChecklistHeader}>Spunta le voci completate:</Text>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.contract_signed && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, contract_signed: !checklistItems.contract_signed})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.contract_signed ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Contratto/Lettera d'incarico firmata</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.ras_registered && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, ras_registered: !checklistItems.ras_registered})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.ras_registered ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Iscrizione RAS (Registro Attività Sportive)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.fiscal_code_acquired && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, fiscal_code_acquired: !checklistItems.fiscal_code_acquired})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.fiscal_code_acquired ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Codice fiscale acquisito</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.criminal_record && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, criminal_record: !checklistItems.criminal_record})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.criminal_record ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Certificato casellario giudiziale (se richiesto)</Text>
              </TouchableOpacity>
              
              <View style={styles.onboardingModalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingOnboarding(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.onboardingSaveBtn, savingOnboarding && styles.disabledBtn]}
                  onPress={handleSaveOnboarding}
                  disabled={savingOnboarding}
                >
                  {savingOnboarding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.onboardingSaveBtnText}>Salva</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    color: '#333',
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
  // Checklist button styles
  checklistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  checklistButtonComplete: {
    backgroundColor: '#4CAF50',
  },
  checklistButtonIncomplete: {
    backgroundColor: '#F44336',
  },
  checklistButtonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  checklistButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Onboarding modal styles
  onboardingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '92%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  onboardingChecklistHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  onboardingChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  onboardingChecklistItemChecked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#34C759',
  },
  onboardingChecklistText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  onboardingModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  onboardingSaveBtn: {
    flex: 1.5,
    padding: 14,
    backgroundColor: '#34C759',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingSaveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Qualification tags styles
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  qualificationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#34C759',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  qualificationTagText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  emptyTagsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  addQualificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    gap: 8,
  },
  addQualificationText: {
    fontSize: 14,
    color: '#666',
  },
});
