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
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Picker } from '@react-native-picker/picker';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete, Certificate, Payment, PaymentSettings, Team } from '../../../src/types';
import { format, differenceInDays, addMonths, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuthStore } from '../../../src/store/authStore';

export default function AthleteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  // Certificate upload modal states
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
  
  // Edit mode states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    full_name: '',
    date_of_birth: '',
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone_athlete: '',
    phone_father: '',
    phone_mother: '',
    email: '',
    tax_payer_name: '',
    tax_payer_fiscal_code: '',
    team_id: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Teams list for team selection
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Certificate viewing modal
  const [viewCertModalVisible, setViewCertModalVisible] = useState(false);
  
  // QR Code ref for sharing
  const qrCodeRef = useRef<View>(null);

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

      // Load payment info from team instead of global settings
      try {
        const paymentInfoRes = await api.get(`/teams/${athleteRes.data.team_id}/payment-info`);
        setPaymentSettings({
          id: '',
          season: '',
          installment_1_amount: paymentInfoRes.data.installment_1_amount,
          installment_2_amount: paymentInfoRes.data.installment_2_amount,
          installment_2_due_date: paymentInfoRes.data.installment_2_due_date,
          installment_3_amount: paymentInfoRes.data.installment_3_amount,
          installment_3_due_date: paymentInfoRes.data.installment_3_due_date,
          bank_info: paymentInfoRes.data.bank_info,
          paypal_email: paymentInfoRes.data.paypal_email,
        });
      } catch (error) {
        setPaymentSettings(null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati dell\'atleta');
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

  // Mask sensitive data if not unlocked
  const maskData = (data: string | null | undefined): string => {
    if (!data) return '-';
    if (dataUnlocked) return data;
    return '••••••••';
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
    
    const html = `
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 40px;
            }
            h1 { font-size: 24px; margin-bottom: 10px; }
            h2 { font-size: 18px; color: #666; margin-bottom: 30px; }
            img { width: 300px; height: 300px; }
            p { margin-top: 20px; font-size: 14px; color: #888; }
          </style>
        </head>
        <body>
          <h1>${athlete.full_name}</h1>
          <h2>QR Code Atleta</h2>
          <img src="data:image/png;base64,${athlete.qr_code}" />
          <p>Presentare questo codice all'allenatore per registrare la presenza</p>
        </body>
      </html>
    `;
    
    try {
      await Print.printAsync({ html });
    } catch (error) {
      console.error('Errore stampa:', error);
      Alert.alert('Errore', 'Impossibile stampare il QR code');
    }
  };

  const shareQRCode = async () => {
    if (!athlete) return;
    
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Errore', 'La condivisione non è disponibile su questo dispositivo');
        return;
      }
      
      // Capture the QR code view as an image
      if (qrCodeRef.current) {
        const uri = await captureRef(qrCodeRef.current, {
          format: 'png',
          quality: 1,
        });
        
        // Share the captured image
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `QR Code - ${athlete.full_name}`,
        });
      }
    } catch (error) {
      console.error('Errore condivisione:', error);
      Alert.alert('Errore', 'Impossibile condividere il QR code');
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
    if (!privacyConfirmed) {
      if (Platform.OS === 'web') {
        // Su web non mostriamo doppia conferma, procediamo direttamente
        setPrivacyConfirmed(true);
      } else {
        Alert.alert('Attenzione', 'Devi confermare due volte per procedere');
        setPrivacyConfirmed(true);
        return;
      }
    }

    try {
      // Accetta privacy E attiva l'atleta in un'unica chiamata
      const response = await api.patch(`/athletes/${id}`, {
        privacy_accepted: true,
        image_consent: true,
        status: 'active',
      });

      // Aggiorna lo stato locale immediatamente
      setAthlete(response.data);
      
      showAlert('Successo', 'Privacy accettata e atleta attivato!');
      setPrivacyModalVisible(false);
      setPrivacyConfirmed(false);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
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
    setPrivacyModalVisible(false);
    setPrivacyConfirmed(true);
    await executeStatusToggle('active');
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
    const nameParts = athlete.full_name.split(' ');
    setEditData({
      full_name: athlete.full_name || '',
      date_of_birth: formatDateForDisplay(athlete.date_of_birth),
      fiscal_code: athlete.fiscal_code || '',
      address: athlete.address || '',
      city: athlete.city || '',
      postal_code: athlete.postal_code || '',
      province: athlete.province || '',
      phone_athlete: athlete.phone_athlete || '',
      phone_father: athlete.phone_father || '',
      phone_mother: athlete.phone_mother || '',
      email: athlete.email || '',
      tax_payer_name: athlete.tax_payer_name || '',
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
        full_name: editData.full_name,
        date_of_birth: isoDate,
        fiscal_code: editData.fiscal_code,
        address: editData.address || null,
        city: editData.city || null,
        postal_code: editData.postal_code || null,
        province: editData.province || null,
        phone_athlete: editData.phone_athlete || null,
        phone_father: editData.phone_father || null,
        phone_mother: editData.phone_mother || null,
        email: editData.email || null,
        tax_payer_name: editData.tax_payer_name || null,
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
      `Sei sicuro di voler eliminare ${athlete.full_name}?\n\nQuesta azione è IRREVERSIBILE e cancellerà tutti i dati dell'atleta inclusi certificati, pagamenti e presenze.`,
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
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
    );
  }

  const trialDaysRemaining = differenceInDays(
    new Date(athlete.trial_end_date),
    new Date()
  );

  const isCertificateExpired = certificate
    ? new Date() > new Date(certificate.expiry_date)
    : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{athlete.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* QR Code Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QR Code Personale</Text>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => setQrModalVisible(true)}
          >
            <Ionicons name="qr-code" size={100} color="#007AFF" />
            <Text style={styles.qrButtonText}>Tocca per visualizzare</Text>
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stato</Text>
          
          {/* Toggle Status */}
          <TouchableOpacity 
            style={styles.statusToggleRow}
            onPress={handleToggleStatus}
            disabled={togglingStatus}
          >
            <View style={styles.statusToggleInfo}>
              <Text style={styles.statusToggleLabel}>
                {athlete.status === 'trial' ? '⏳ In Prova' : '✅ Attivo'}
              </Text>
              <Text style={styles.statusToggleSubtext}>
                {athlete.status === 'trial' 
                  ? `Tocca per terminare la prova (${trialDaysRemaining} giorni rimanenti)`
                  : 'Atleta confermato con privacy accettata'}
              </Text>
            </View>
            <View style={[
              styles.statusToggle,
              athlete.status === 'active' && styles.statusToggleActive
            ]}>
              {togglingStatus ? (
                <Text style={styles.statusToggleText}>...</Text>
              ) : (
                <View style={[
                  styles.statusToggleKnob,
                  athlete.status === 'active' && styles.statusToggleKnobActive
                ]} />
              )}
            </View>
          </TouchableOpacity>

          {athlete.status === 'trial' && trialDaysRemaining <= 0 && !athlete.privacy_accepted && (
            <View style={[styles.statusBox, { marginTop: 12 }]}>
              <Ionicons name="alert-circle" size={24} color="#FF3B30" />
              <Text style={styles.statusTextDanger}>
                Periodo di prova terminato - Conferma privacy richiesta
              </Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setPrivacyModalVisible(true)}
              >
                <Text style={styles.actionButtonText}>Conferma Privacy</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Certificate Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Certificato Medico</Text>
          {certificate ? (
            <View>
              <View style={styles.certInfo}>
                <Ionicons
                  name={isCertificateExpired ? 'close-circle' : 'checkmark-circle'}
                  size={24}
                  color={isCertificateExpired ? '#FF3B30' : '#34C759'}
                />
                <View style={styles.certDetails}>
                  <Text style={styles.certLabel}>
                    Scadenza: {format(new Date(certificate.expiry_date), 'dd/MM/yyyy', { locale: it })}
                  </Text>
                  {isCertificateExpired && (
                    <Text style={styles.certExpired}>SCADUTO</Text>
                  )}
                </View>
              </View>
              <View style={styles.certButtonsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonView, (!dataUnlocked && hasPassword) && styles.buttonDisabled]}
                  onPress={() => dataUnlocked ? setViewCertModalVisible(true) : setPasswordModalVisible(true)}
                >
                  <Ionicons name={dataUnlocked ? "eye" : "lock-closed"} size={18} color={dataUnlocked ? "#007AFF" : "#FF9500"} />
                  <Text style={[styles.buttonViewText, (!dataUnlocked && hasPassword) && { color: '#FF9500' }]}>
                    {dataUnlocked ? 'Visualizza' : 'Sblocca'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary, { flex: 1 }, (!dataUnlocked && hasPassword) && styles.buttonDisabled]}
                  onPress={() => dataUnlocked ? handleUploadCertificate() : setPasswordModalVisible(true)}
                  disabled={uploadingCert}
                >
                  <Text style={styles.buttonSecondaryText}>
                    {uploadingCert ? 'Caricamento...' : (dataUnlocked ? 'Carica Nuovo' : 'Sblocca per caricare')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={24} color="#FF9500" />
                <Text style={styles.warningText}>Nessun certificato caricato</Text>
              </View>
              <TouchableOpacity
                style={[styles.button, (!dataUnlocked && hasPassword) && styles.buttonDisabled]}
                onPress={() => dataUnlocked ? handleUploadCertificate() : setPasswordModalVisible(true)}
                disabled={uploadingCert}
              >
                <Text style={styles.buttonText}>
                  {uploadingCert ? 'Caricamento...' : (dataUnlocked ? 'Carica Certificato' : 'Sblocca per caricare')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Dati Iscrizione Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Dati Iscrizione</Text>
            {hasPassword && !dataUnlocked ? (
              <TouchableOpacity 
                onPress={() => setPasswordModalVisible(true)} 
                style={styles.lockButton}
              >
                <Ionicons name="lock-closed" size={20} color="#FF9500" />
                <Text style={styles.lockButtonText}>Sblocca</Text>
              </TouchableOpacity>
            ) : hasPassword && dataUnlocked && user?.role === 'parent' ? (
              <TouchableOpacity onPress={openEditModal} style={styles.editButton}>
                <Ionicons name="pencil" size={20} color="#007AFF" />
                <Text style={styles.editButtonText}>Modifica</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openEditModal} style={styles.editButton}>
                <Ionicons name="pencil" size={20} color="#007AFF" />
                <Text style={styles.editButtonText}>Modifica</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {hasPassword && !dataUnlocked && (
            <View style={styles.lockedBanner}>
              <Ionicons name="shield-checkmark" size={20} color="#FF9500" />
              <Text style={styles.lockedBannerText}>
                Dati protetti da password. Tocca "Sblocca" per visualizzare.
              </Text>
            </View>
          )}
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Squadra</Text>
            <Text style={styles.dataValue}>{getTeamName(athlete.team_id)}</Text>
          </View>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Nome Completo</Text>
            <Text style={styles.dataValue}>{athlete.full_name}</Text>
          </View>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Data di Nascita</Text>
            <Text style={styles.dataValue}>{dataUnlocked ? formatDateForDisplay(athlete.date_of_birth) : '••/••/••••'}</Text>
          </View>
          
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
              {dataUnlocked 
                ? ([athlete.city, athlete.province, athlete.postal_code].filter(Boolean).join(' - ') || '-')
                : '••••••••'
              }
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
            <Text style={styles.dataLabel}>Genitore Detrazione</Text>
            <Text style={styles.dataValue}>{maskData(athlete.tax_payer_name)}</Text>
          </View>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>CF Genitore</Text>
            <Text style={styles.dataValue}>{maskData(athlete.tax_payer_fiscal_code)}</Text>
          </View>
        </View>

        {/* Payments Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagamenti</Text>
          {payments.length > 0 ? (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Rata {payment.installment_number}</Text>
                  <Text style={styles.paymentAmount}>€ {payment.amount.toFixed(2)}</Text>
                  <Text style={styles.paymentDue}>
                    Scadenza: {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: it })}
                  </Text>
                </View>
                <Ionicons
                  name={payment.paid ? 'checkmark-circle' : 'alert-circle'}
                  size={32}
                  color={payment.paid ? '#34C759' : '#FF9500'}
                />
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Nessun pagamento disponibile</Text>
          )}
          
          {paymentSettings && (
            <View style={styles.paymentInstructions}>
              <Text style={styles.instructionsTitle}>Modalità di pagamento:</Text>
              <Text style={styles.instructionsText}>
                <Text style={styles.bold}>Bonifico Bancario:</Text>
                {'\n'}{paymentSettings.bank_info}
              </Text>
              <Text style={styles.instructionsText}>
                <Text style={styles.bold}>PayPal:</Text>
                {'\n'}{paymentSettings.paypal_email}
              </Text>
            </View>
          )}
        </View>

        {/* Delete Athlete Button */}
        <View style={styles.deleteSection}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAthlete}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Elimina Atleta</Text>
          </TouchableOpacity>
          <Text style={styles.deleteWarning}>
            Questa azione è irreversibile
          </Text>
        </View>
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
        transparent={true}
        onRequestClose={() => setViewCertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewCertModalContent}>
            <Text style={styles.modalTitle}>Certificato Medico</Text>
            {certificate && (
              <View style={styles.certImageContainer}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${certificate.pdf_data}` }}
                  style={styles.certImage}
                  resizeMode="contain"
                />
                <View style={styles.certInfoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.certInfoText}>
                    Emissione: {format(new Date(certificate.issue_date), 'dd/MM/yyyy', { locale: it })}
                  </Text>
                </View>
                <View style={styles.certInfoRow}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.certInfoText}>
                    Validità: {certificate.validity_months} mesi
                  </Text>
                </View>
                <View style={styles.certInfoRow}>
                  <Ionicons 
                    name={isCertificateExpired ? "close-circle" : "checkmark-circle"} 
                    size={16} 
                    color={isCertificateExpired ? "#FF3B30" : "#34C759"} 
                  />
                  <Text style={[styles.certInfoText, isCertificateExpired && styles.certExpiredText]}>
                    Scadenza: {format(new Date(certificate.expiry_date), 'dd/MM/yyyy', { locale: it })}
                    {isCertificateExpired && ' (SCADUTO)'}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setViewCertModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.privacyModalContent}>
            <Text style={styles.modalTitle}>Conferma Privacy e Liberatoria</Text>
            
            <ScrollView style={styles.privacyScroll}>
              <Text style={styles.privacyTitle}>LIBERATORIA</Text>
              
              <Text style={styles.privacyText}>
                Il/La sottoscritto/a, in qualità di esercente la responsabilità genitoriale 
                sull'atleta iscritto/a alla società sportiva:
              </Text>
              
              <Text style={styles.privacyTitle}>DICHIARA</Text>
              
              <Text style={styles.privacyText}>
                di essere stato informato e di aver preso visione dell'informativa ai sensi 
                degli artt. 13 e 14 del Regolamento (UE) 2016/679 sulla protezione dei dati (GDPR), 
                disponibile anche sul sito web della società, riguardo il trattamento dei dati 
                personali propri e dell'atleta.
              </Text>
              
              <Text style={styles.privacyTitle}>PRESTA IL PROPRIO CONSENSO</Text>
              
              <Text style={styles.privacyText}>
                ☑ al trattamento dei dati personali propri e dell'atleta per le finalità 
                strettamente connesse e necessarie alla pratica sportiva dilettantistica 
                (iscrizione, tesseramento, partecipazione a manifestazioni sportive, 
                gestione amministrativa);{'\n\n'}
                
                ☑ all'utilizzo di immagini e/o video dell'atleta per finalità promozionali 
                e comunicative della società, sia su supporti tradizionali che digitali 
                (sito web, social network, materiale promozionale), con l'impegno che tali 
                immagini non saranno utilizzate per fini commerciali o cedute a terzi;{'\n\n'}
                
                ☑ alla comunicazione dei dati a federazioni, enti di promozione sportiva, 
                assicurazioni e altri soggetti necessari per lo svolgimento dell'attività sportiva.
              </Text>
              
              <Text style={styles.privacyNote}>
                Il consenso è revocabile in qualsiasi momento mediante comunicazione scritta 
                alla società. Il rifiuto del consenso ai trattamenti necessari comporterà 
                l'impossibilità di partecipare all'attività sportiva.
              </Text>
            </ScrollView>

            <View style={styles.privacyButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setPrivacyModalVisible(false);
                  setPrivacyConfirmed(false);
                }}
              >
                <Text style={styles.buttonSecondaryText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSuccess]}
                onPress={handleAcceptPrivacy}
              >
                <Text style={styles.buttonText}>Accetto e Confermo</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={styles.inputLabel}>Squadra</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editData.team_id}
                  onValueChange={(value) => setEditData({...editData, team_id: value})}
                  style={styles.picker}
                >
                  {teams.map((team) => (
                    <Picker.Item key={team.id} label={team.name} value={team.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Nome Completo</Text>
              <TextInput
                style={styles.textInput}
                value={editData.full_name}
                onChangeText={(text) => setEditData({...editData, full_name: text.toUpperCase()})}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Data di Nascita (GG/MM/AAAA)</Text>
              <TextInput
                style={styles.textInput}
                value={editData.date_of_birth}
                onChangeText={(text) => setEditData({...editData, date_of_birth: formatDateInput(text)})}
                keyboardType="number-pad"
                maxLength={10}
              />

              <Text style={styles.inputLabel}>Codice Fiscale</Text>
              <TextInput
                style={styles.textInput}
                value={editData.fiscal_code}
                onChangeText={(text) => setEditData({...editData, fiscal_code: text.toUpperCase()})}
                autoCapitalize="characters"
                maxLength={16}
              />

              <Text style={styles.inputLabel}>Indirizzo</Text>
              <TextInput
                style={styles.textInput}
                value={editData.address}
                onChangeText={(text) => setEditData({...editData, address: text.toUpperCase()})}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Città</Text>
              <TextInput
                style={styles.textInput}
                value={editData.city}
                onChangeText={(text) => setEditData({...editData, city: text.toUpperCase()})}
                autoCapitalize="characters"
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
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Tel. Atleta</Text>
              <TextInput
                style={styles.textInput}
                value={editData.phone_athlete}
                onChangeText={(text) => setEditData({...editData, phone_athlete: text})}
                keyboardType="phone-pad"
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
              />

              <Text style={styles.inputLabel}>Genitore Detrazione</Text>
              <TextInput
                style={styles.textInput}
                value={editData.tax_payer_name}
                onChangeText={(text) => setEditData({...editData, tax_payer_name: text.toUpperCase()})}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>CF Genitore</Text>
              <TextInput
                style={styles.textInput}
                value={editData.tax_payer_fiscal_code}
                onChangeText={(text) => setEditData({...editData, tax_payer_fiscal_code: text.toUpperCase()})}
                autoCapitalize="characters"
                maxLength={16}
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
              value={enteredPassword}
              onChangeText={setEnteredPassword}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
            />
            
            {passwordError ? (
              <Text style={styles.passwordError}>{passwordError}</Text>
            ) : null}
            
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  qrButton: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 8,
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
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    borderRadius: 8,
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
});
