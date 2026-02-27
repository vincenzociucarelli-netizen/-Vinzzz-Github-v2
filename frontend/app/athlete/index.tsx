import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { AdultPrivacyModal } from '../../src/components/AdultPrivacyModal';

const MONTH_NAMES = [
  '', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

const MONTH_NAMES_FULL = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

interface AthleteProfile {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  fiscal_code?: string;
  monthly_compensation: number;
  compensation_accepted: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  other_annual_compensation?: number;
  iban?: string;
  iban_holder_first_name?: string;
  iban_holder_last_name?: string;
  bank_name?: string;
  athlete_type?: string;
  // Additional fields for quota athletes
  team_id?: string;
  team_name?: string;
  profile_photo?: string;
  status?: string;
  trial_end_date?: string;
  privacy_accepted?: boolean;
  privacy_accepted_date?: string;
  email?: string;
  phone_athlete?: string;
}

interface Receipt {
  id: string;
  month: string;
  year: number;
  amount: number;
  signed: boolean;
  signed_date?: string;
}

export default function AthleteScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [societySettings, setSocietySettings] = useState<any>(null);

  // Contract dates
  const [contractStartYear, setContractStartYear] = useState<number | null>(null);
  const [contractEndYear, setContractEndYear] = useState<number | null>(null);
  const [contractStartMonth, setContractStartMonth] = useState<number | null>(null);
  const [contractEndMonth, setContractEndMonth] = useState<number | null>(null);
  
  // Privacy modal state
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [societyData, setSocietyData] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Certificate and Coach state
  const [coachInfo, setCoachInfo] = useState<any>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certDateModalVisible, setCertDateModalVisible] = useState(false);
  const [certDateInput, setCertDateInput] = useState('');
  const [pendingCertBase64, setPendingCertBase64] = useState<string | null>(null);

  // Helper function to format date strings correctly
  const formatDateIT = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
      // Parse the date string (handles ISO format and other formats)
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Check if profile data is complete for privacy signature
  const isProfileComplete = () => {
    if (!profile) return false;
    
    // Get field values considering different naming conventions
    const firstName = profile.first_name;
    const lastName = profile.last_name;
    const fiscalCode = profile.fiscal_code;
    const dateOfBirth = (profile as any).date_of_birth || (profile as any).birth_date;
    const placeOfBirth = (profile as any).place_of_birth || (profile as any).birth_place;
    const gender = (profile as any).gender || (profile as any).sesso;
    
    // Log for debugging
    console.log('Profile completeness check:', {
      firstName, lastName, fiscalCode, dateOfBirth, placeOfBirth, gender
    });
    
    const requiredFields = [firstName, lastName, fiscalCode, dateOfBirth, placeOfBirth, gender];
    return requiredFields.every(field => field && field.toString().trim() !== '');
  };

  // Get missing profile fields for message
  const getMissingFields = () => {
    if (!profile) return 'tutti i dati';
    const missing: string[] = [];
    if (!profile.first_name) missing.push('nome');
    if (!profile.last_name) missing.push('cognome');
    if (!profile.fiscal_code) missing.push('codice fiscale');
    if (!(profile as any).date_of_birth && !(profile as any).birth_date) missing.push('data di nascita');
    if (!(profile as any).place_of_birth && !(profile as any).birth_place) missing.push('luogo di nascita');
    if (!(profile as any).gender && !(profile as any).sesso) missing.push('sesso');
    return missing.join(', ');
  };

  // Handle the "Rimani e Firma Privacy" action
  const handleStayAndSignPrivacy = () => {
    if (!isProfileComplete()) {
      const missingFields = getMissingFields();
      if (Platform.OS === 'web') {
        window.alert(`Per firmare la privacy devi prima completare i tuoi dati anagrafici.\n\nCampi mancanti: ${missingFields}\n\nVerrai reindirizzato alla pagina del profilo.`);
        router.push('/athlete/profile');
      } else {
        Alert.alert(
          'Dati Incompleti',
          `Per firmare la privacy devi prima completare i tuoi dati anagrafici.\n\nCampi mancanti: ${missingFields}`,
          [
            { text: 'Vai al Profilo', onPress: () => router.push('/athlete/profile') }
          ]
        );
      }
      return;
    }
    // Profile is complete, open privacy modal
    setShowPrivacyModal(true);
  };

  // Auto-format date input (add slashes automatically)
  const formatDateInput = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as GG/MM/AAAA
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.substring(0, 2);
    }
    if (digits.length > 2) {
      formatted += '/' + digits.substring(2, 4);
    }
    if (digits.length > 4) {
      formatted += '/' + digits.substring(4, 8);
    }
    
    return formatted;
  };

  // Handle date input change with auto-formatting
  const handleDateInputChange = (text: string) => {
    const formatted = formatDateInput(text);
    setCertDateInput(formatted);
  };

  // Confirm certificate upload with date
  const confirmCertUpload = async () => {
    if (!pendingCertBase64) return;
    
    // Validate date
    const parts = certDateInput.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) {
      if (Platform.OS === 'web') {
        window.alert('Inserisci una data valida nel formato GG/MM/AAAA');
      } else {
        Alert.alert('Errore', 'Inserisci una data valida nel formato GG/MM/AAAA');
      }
      return;
    }
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020 || year > 2100) {
      if (Platform.OS === 'web') {
        window.alert('Data non valida. Verifica giorno, mese e anno.');
      } else {
        Alert.alert('Errore', 'Data non valida. Verifica giorno, mese e anno.');
      }
      return;
    }
    
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    setUploadingCert(true);
    try {
      await api.post('/athletes/upload-medical-certificate', {
        certificate_base64: pendingCertBase64,
        expiry_date: isoDate
      });
      
      setCertDateModalVisible(false);
      setPendingCertBase64(null);
      setCertDateInput('');
      
      if (Platform.OS === 'web') {
        window.alert('Certificato medico caricato con successo!');
      } else {
        Alert.alert('Successo', 'Certificato medico caricato con successo!');
      }
      
      loadData();
    } catch (error: any) {
      console.error('Upload error:', error);
      if (Platform.OS === 'web') {
        window.alert(`Errore: ${error.response?.data?.detail || error.message || 'Errore sconosciuto'}`);
      } else {
        Alert.alert('Errore', error.response?.data?.detail || 'Errore nel caricamento');
      }
    } finally {
      setUploadingCert(false);
    }
  };

  // Handle certificate upload
  const handleUploadCertificate = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          
          // Store the base64 and open date modal
          setPendingCertBase64(base64);
          
          // Set default date: today + 1 year
          const defaultDate = new Date();
          defaultDate.setFullYear(defaultDate.getFullYear() + 1);
          const defaultDateStr = `${String(defaultDate.getDate()).padStart(2, '0')}/${String(defaultDate.getMonth() + 1).padStart(2, '0')}/${defaultDate.getFullYear()}`;
          setCertDateInput(defaultDateStr);
          
          setCertDateModalVisible(true);
        };
        
        reader.onerror = () => {
          console.error('File read error');
          if (Platform.OS === 'web') {
            window.alert('Errore nella lettura del file');
          }
        };
        
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      Alert.alert('Info', 'Usa la versione web per caricare il certificato');
    }
  };

  // View certificate
  const handleViewCertificate = () => {
    if (!profile?.medical_certificate_url) {
      if (Platform.OS === 'web') {
        window.alert('Nessun certificato disponibile');
      } else {
        Alert.alert('Info', 'Nessun certificato disponibile');
      }
      return;
    }
    
    if (Platform.OS === 'web') {
      // For base64 data
      if (profile.medical_certificate_url.startsWith('data:')) {
        try {
          const [header, base64Data] = profile.medical_certificate_url.split(',');
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
          
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          
          const blobUrl = window.URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
          
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
        } catch (error) {
          console.error('Error opening certificate:', error);
          window.alert('Impossibile aprire il certificato');
        }
      } else {
        window.open(profile.medical_certificate_url, '_blank');
      }
    }
  };

  // Print certificate
  const handlePrintCertificate = () => {
    if (!profile?.medical_certificate_url) {
      if (Platform.OS === 'web') {
        window.alert('Nessun certificato disponibile');
      }
      return;
    }
    
    if (Platform.OS === 'web') {
      try {
        const [header, base64Data] = profile.medical_certificate_url.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          if (mimeType.startsWith('image/')) {
            printWindow.document.write(`
              <html>
                <head>
                  <title>Certificato Medico - ${profile.full_name || 'Atleta'}</title>
                  <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    img { max-width: 100%; max-height: 100vh; }
                    @media print { body { margin: 0; } img { max-width: 100%; } }
                  </style>
                </head>
                <body>
                  <img src="${profile.medical_certificate_url}" onload="window.print(); window.close();" />
                </body>
              </html>
            `);
          } else {
            // For PDF
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const blobUrl = window.URL.createObjectURL(blob);
            
            printWindow.location.href = blobUrl;
            printWindow.onload = () => {
              printWindow.print();
            };
          }
        }
      } catch (error) {
        console.error('Error printing certificate:', error);
        window.alert('Impossibile stampare il certificato');
      }
    }
  };

  // Share certificate
  const handleShareCertificate = async () => {
    if (!profile?.medical_certificate_url) {
      if (Platform.OS === 'web') {
        window.alert('Nessun certificato disponibile');
      }
      return;
    }
    
    if (Platform.OS === 'web') {
      try {
        const [header, base64Data] = profile.medical_certificate_url.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        const fileName = `certificato_medico_${profile.full_name?.replace(/\s+/g, '_') || 'atleta'}.${mimeType.split('/')[1] || 'jpg'}`;
        const file = new File([blob], fileName, { type: mimeType });
        
        // Check if Web Share API is available
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Certificato Medico',
            text: `Certificato medico di ${profile.full_name || 'Atleta'}`,
            files: [file]
          });
        } else {
          // Fallback: download the file
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          window.alert('File scaricato! Puoi condividerlo manualmente.');
        }
      } catch (error) {
        console.error('Error sharing certificate:', error);
        window.alert('Impossibile condividere il certificato');
      }
    }
  };

  const loadData = async () => {
    try {
      // Load athlete profile
      const meResponse = await api.get('/auth/me');
      const athleteData = meResponse.data;
      
      // For athletes, we need to get their athlete record
      if (athleteData.athlete_id) {
        const athleteResponse = await api.get(`/athletes/${athleteData.athlete_id}`);
        setProfile(athleteResponse.data);
        
        // Parse contract dates
        if (athleteResponse.data.contract_start_date) {
          const startDate = new Date(athleteResponse.data.contract_start_date);
          setContractStartYear(startDate.getFullYear());
          setContractStartMonth(startDate.getMonth() + 1);
        }
        if (athleteResponse.data.contract_end_date) {
          const endDate = new Date(athleteResponse.data.contract_end_date);
          setContractEndYear(endDate.getFullYear());
          setContractEndMonth(endDate.getMonth() + 1);
        }
        
        // Load receipts
        const receiptsResponse = await api.get(`/athletes/${athleteData.athlete_id}/compensation/receipts`);
        setReceipts(receiptsResponse.data || []);
        
        // Load coach info if athlete has a team
        if (athleteResponse.data.team_id) {
          try {
            const coachResponse = await api.get(`/teams/${athleteResponse.data.team_id}/coach`);
            if (coachResponse.data) {
              setCoachInfo(coachResponse.data);
            }
          } catch (coachError) {
            console.log('No coach info available');
          }
        }
      } else {
        // Direct athlete user
        setProfile(athleteData);
      }
      
      // Load society settings
      const settingsResponse = await api.get('/settings/society');
      setSocietySettings(settingsResponse.data);
      
    } catch (error: any) {
      console.error('Error loading data:', error);
      showAlert('Errore', 'Impossibile caricare i dati');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Generate contract months
  const getContractMonths = () => {
    if (!contractStartYear || !contractStartMonth || !contractEndYear || !contractEndMonth) {
      return [];
    }
    
    const months: { year: number; month: number }[] = [];
    let year = contractStartYear;
    let month = contractStartMonth;
    
    while (year < contractEndYear || (year === contractEndYear && month <= contractEndMonth)) {
      months.push({ year, month });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    
    return months;
  };

  const isReceiptSigned = (year: number, month: number) => {
    const monthName = MONTH_NAMES_FULL[month];
    return receipts.some(r => r.year === year && r.month === monthName && r.signed);
  };

  const getReceiptSignedDate = (year: number, month: number) => {
    const monthName = MONTH_NAMES_FULL[month];
    const receipt = receipts.find(r => r.year === year && r.month === monthName && r.signed);
    return receipt?.signed_date;
  };

  const isMonthAvailable = (year: number, month: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Past months and current month are available
    if (year < currentYear) return true;
    if (year === currentYear && month <= currentMonth) return true;
    return false;
  };

  const getSignedCount = () => {
    return receipts.filter(r => r.signed).length;
  };

  const getTotalMonths = () => {
    return getContractMonths().length;
  };

  // Calculate yearly totals for threshold warnings
  const calculateYearlyTotals = () => {
    const yearlyTotals: { [year: number]: { months: number; total: number; prior: number } } = {};
    const contractMonths = getContractMonths();
    const monthlyComp = profile?.monthly_compensation || 0;
    const priorComp = profile?.other_annual_compensation || 0;
    
    contractMonths.forEach(({ year, month }) => {
      if (!yearlyTotals[year]) {
        yearlyTotals[year] = { months: 0, total: 0, prior: 0 };
      }
      yearlyTotals[year].months++;
      yearlyTotals[year].total += monthlyComp;
    });
    
    // Add prior compensation to first year
    if (Object.keys(yearlyTotals).length > 0) {
      const firstYear = Math.min(...Object.keys(yearlyTotals).map(Number));
      yearlyTotals[firstYear].prior = priorComp;
    }
    
    return yearlyTotals;
  };

  const yearlyTotals = profile ? calculateYearlyTotals() : {};
  const contractMonths = getContractMonths();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  if (!profile || profile.athlete_type !== 'compensated') {
    // Vista per atleti "quota" (non compensati)
    return (
      <>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Il Mio Profilo</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Profile Card for quota athletes */}
        <View style={[styles.profileCard, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' }]}>
          {profile?.profile_photo ? (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${profile.profile_photo}` }}
              style={[styles.profileAvatar, { backgroundColor: 'transparent' }]}
            />
          ) : (
            <View style={[styles.profileAvatar, { backgroundColor: '#007AFF' }]}>
              <Text style={styles.profileInitial}>
                {profile?.first_name?.charAt(0) || profile?.full_name?.charAt(0) || 'A'}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: '#333' }]}>{profile?.full_name || 'Atleta'}</Text>
          
          {/* Status Badge */}
          <View style={{ 
            backgroundColor: profile?.status === 'trial' ? '#FFF3E0' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '#E3F2FD' : '#E8F5E9', 
            paddingHorizontal: 12, 
            paddingVertical: 6, 
            borderRadius: 16,
            marginTop: 8
          }}>
            <Text style={{ 
              color: profile?.status === 'trial' ? '#FF9800' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '#1976D2' : '#4CAF50',
              fontWeight: '600',
              fontSize: 13
            }}>
              {profile?.status === 'trial' ? '⏳ Periodo di Prova' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '📝 Firma Privacy Richiesta' : '✓ Attivo'}
            </Text>
          </View>
          
          {/* Pending Privacy Banner - only show if NOT privacy_accepted */}
          {profile?.status === 'pending_privacy' && !profile?.privacy_accepted && (
            <TouchableOpacity 
              style={{ 
                backgroundColor: '#E3F2FD', 
                padding: 12, 
                borderRadius: 8, 
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#1976D2'
              }}
              onPress={handleStayAndSignPrivacy}
            >
              <Text style={{ color: '#1976D2', fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
                ✍️ Devi accettare la Privacy per continuare
              </Text>
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                Clicca qui per firmare
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Trial end date */}
          {profile?.status === 'trial' && profile?.trial_end_date && (
            <Text style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              Fine prova: {formatDateIT(profile.trial_end_date)}
            </Text>
          )}
          
          {/* Team - sempre visibile */}
          <Text style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
            Squadra: {profile?.team_name || (profile?.team_id ? 'Caricamento...' : 'Non assegnata')}
          </Text>
          
          {/* Recesso dalla prova - Due opzioni */}
          {profile?.status === 'trial' && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10, textAlign: 'center' }}>
                Vuoi terminare il periodo di prova?
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                {/* Opzione 1: Rimani e firma privacy */}
                <TouchableOpacity 
                  style={{ 
                    flex: 1,
                    maxWidth: 220,
                    backgroundColor: '#E3F2FD', 
                    paddingHorizontal: 12, 
                    paddingVertical: 10, 
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#2196F3'
                  }}
                  onPress={handleStayAndSignPrivacy}
                >
                  <Text style={{ color: '#1565C0', fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
                    ✅ Rimani e Firma Privacy
                  </Text>
                  <Text style={{ color: '#666', fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                    Continua come atleta
                  </Text>
                </TouchableOpacity>
                
                {/* Opzione 2: Non rimanere e cancella dati */}
                <TouchableOpacity 
                  style={{ 
                    flex: 1,
                    maxWidth: 220,
                    backgroundColor: '#FFEBEE', 
                    paddingHorizontal: 12, 
                    paddingVertical: 10, 
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#F44336'
                  }}
                  onPress={async () => {
                    const confirm = Platform.OS === 'web' 
                      ? window.confirm('ATTENZIONE: Questa azione cancellerà definitivamente tutti i tuoi dati (profilo, pagamenti, presenze). Sei sicuro?')
                      : await new Promise<boolean>((resolve) => {
                          Alert.alert(
                            '⚠️ Cancella Account',
                            'ATTENZIONE: Questa azione cancellerà definitivamente tutti i tuoi dati (profilo, pagamenti, presenze).\n\nSei sicuro di voler procedere?',
                            [
                              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                              { text: 'Cancella Tutto', style: 'destructive', onPress: () => resolve(true) }
                            ]
                          );
                        });
                    
                    if (confirm) {
                      try {
                        await api.post('/athletes/withdraw-trial-leave');
                        if (Platform.OS === 'web') {
                          window.alert('Account eliminato. Tutti i tuoi dati sono stati cancellati.');
                        } else {
                          Alert.alert('Account Eliminato', 'Tutti i tuoi dati sono stati cancellati.');
                        }
                        handleLogout();
                      } catch (error: any) {
                        const msg = error.response?.data?.detail || 'Errore durante l\'eliminazione';
                        if (Platform.OS === 'web') {
                          window.alert(msg);
                        } else {
                          Alert.alert('Errore', msg);
                        }
                      }
                    }
                  }}
                >
                  <Text style={{ color: '#C62828', fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
                    ❌ Non Rimanere
                  </Text>
                  <Text style={{ color: '#666', fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                    Cancella tutti i dati
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        
        {/* QR Code Section */}
        {profile?.qr_code && (
          <TouchableOpacity 
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
            onPress={() => setShowQRModal(true)}
          >
            <Image 
              source={{ uri: profile.qr_code }}
              style={{ width: 60, height: 60, borderRadius: 4 }}
              resizeMode="contain"
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>Il Tuo QR Code</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Tocca per ingrandire</Text>
              {profile?.athlete_code && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#007AFF', marginTop: 4, letterSpacing: 1 }}>{profile.athlete_code}</Text>
              )}
            </View>
            <Ionicons name="expand" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
        
        {/* Certificato Medico Card - for quota athletes */}
        <View style={[styles.certificateCard, { marginTop: 16 }]}>
          <Text style={styles.certificateCardTitle}>📋 Certificato Medico</Text>
          {(profile as any)?.medical_certificate_url || (profile as any)?.medical_certificate_expiry ? (
            <View>
              <View style={styles.certificateInfo}>
                <Ionicons
                  name={new Date((profile as any)?.medical_certificate_expiry) < new Date() ? 'close-circle' : 'checkmark-circle'}
                  size={24}
                  color={new Date((profile as any)?.medical_certificate_expiry) < new Date() ? '#FF3B30' : '#34C759'}
                />
                <View style={styles.certificateDetails}>
                  <Text style={styles.certificateLabel}>
                    Scadenza: {formatDateIT((profile as any)?.medical_certificate_expiry)}
                  </Text>
                  {new Date((profile as any)?.medical_certificate_expiry) < new Date() && (
                    <Text style={styles.certificateExpired}>SCADUTO</Text>
                  )}
                </View>
              </View>
              <View style={styles.certificateButtonsRow}>
                <TouchableOpacity
                  style={[styles.certificateViewButton, { flex: 1 }]}
                  onPress={handleViewCertificate}
                >
                  <Ionicons name="eye" size={18} color="#007AFF" />
                  <Text style={styles.certificateViewButtonText}>Visualizza</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.certificateUploadButton, { flex: 1, marginLeft: 8 }]}
                  onPress={handleUploadCertificate}
                  disabled={uploadingCert}
                >
                  <Text style={styles.certificateUploadButtonText}>
                    {uploadingCert ? '...' : 'Carica'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: '#888', marginTop: 8, textAlign: 'center' }}>
                Apri il certificato per stampare o condividere
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={24} color="#FF9500" />
                <Text style={styles.warningText}>Nessun certificato caricato</Text>
              </View>
              <TouchableOpacity
                style={[styles.certificateMainButton, { backgroundColor: '#007AFF' }]}
                onPress={handleUploadCertificate}
                disabled={uploadingCert}
              >
                <Text style={styles.certificateMainButtonText}>
                  {uploadingCert ? 'Caricamento...' : '📤 Carica Certificato'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Dati Iscrizione Card - for quota athletes */}
        <View style={[styles.iscrizioneCard, { marginTop: 16 }]}>
          <Text style={styles.iscrizioneCardTitle}>📝 Dati Iscrizione</Text>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Squadra</Text>
            <Text style={[styles.dataValue, { color: '#E53935', fontWeight: '700' }]}>
              🏐 {profile?.team_name || 'Non assegnata'}
            </Text>
          </View>
          
          {/* Coach Info for quota athletes */}
          {coachInfo && (
            <View style={styles.coachInfoCard}>
              <Text style={styles.coachInfoTitle}>👨‍🏫 Coach della Squadra</Text>
              <View style={styles.coachInfoRow}>
                {coachInfo.profile_photo_artistic || coachInfo.profile_photo ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${coachInfo.profile_photo_artistic || coachInfo.profile_photo}` }}
                    style={styles.coachPhoto}
                  />
                ) : (
                  <View style={styles.coachPhotoPlaceholder}>
                    <Ionicons name="person" size={20} color="#999" />
                  </View>
                )}
                <View style={styles.coachInfoDetails}>
                  <Text style={styles.coachName}>{coachInfo.full_name}</Text>
                  <Text style={styles.coachContactHint}>Per contattare il coach, rivolgersi alla segreteria</Text>
                </View>
              </View>
            </View>
          )}
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Cognome</Text>
            <Text style={styles.dataValue}>{profile?.last_name || '-'}</Text>
          </View>
          
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Nome</Text>
            <Text style={styles.dataValue}>{profile?.first_name || '-'}</Text>
          </View>
        </View>
        
        {/* Menu Items */}
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/athlete/profile')}
        >
          <Ionicons name="person" size={22} color="#007AFF" />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Dati Personali</Text>
            <Text style={styles.menuItemSubtitle}>Visualizza e modifica i tuoi dati</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
        {/* Privacy Status */}
        <View style={[styles.menuItem, { backgroundColor: profile?.privacy_accepted ? '#E8F5E9' : '#FFF3E0' }]}>
          <Ionicons 
            name={profile?.privacy_accepted ? "checkmark-circle" : "alert-circle"} 
            size={22} 
            color={profile?.privacy_accepted ? "#4CAF50" : "#FF9800"} 
          />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Privacy</Text>
            <Text style={styles.menuItemSubtitle}>
              {profile?.privacy_accepted 
                ? `Accettata il ${formatDateIT(profile.privacy_accepted_date)}` 
                : 'Da accettare'}
            </Text>
          </View>
          {!profile?.privacy_accepted && (
            <Ionicons name="chevron-forward" size={20} color="#FF9800" />
          )}
        </View>
        
        {/* Contact Info - Email and Phone on same row */}
        {(profile?.email || profile?.phone_athlete) && (
          <View style={[styles.menuItem, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            {profile?.email && (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="mail" size={18} color="#666" />
                <Text style={{ marginLeft: 6, color: '#666', fontSize: 13 }}>{profile.email}</Text>
              </View>
            )}
            {profile?.phone_athlete && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="call" size={18} color="#666" />
                <Text style={{ marginLeft: 6, color: '#666', fontSize: 13 }}>{profile.phone_athlete}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Presenze/Statistiche - PRIMA dei pagamenti, più visibile */}
        {profile?.team_id && (
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#2196F3' }]}
            onPress={() => router.push(`/athlete/presenze`)}
          >
            <Ionicons name="stats-chart" size={22} color="#2196F3" />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: '#1976D2' }]}>Presenze e Statistiche</Text>
              <Text style={styles.menuItemSubtitle}>Visualizza le tue presenze e statistiche</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2196F3" />
          </TouchableOpacity>
        )}
        
        {/* Payments Section */}
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push(`/athlete/payments`)}
        >
          <Ionicons name="card" size={22} color="#007AFF" />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Pagamenti</Text>
            <Text style={styles.menuItemSubtitle}>Visualizza le tue rate e pagamenti</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
        {/* Orari Allenamenti - Separato dalle presenze */}
        {profile?.team_id && (
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push(`/athlete/schedule?tab=orari`)}
          >
            <Ionicons name="calendar" size={22} color="#007AFF" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Orari Allenamenti</Text>
              <Text style={styles.menuItemSubtitle}>Calendario settimanale</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}
        
        {/* Documenti Section */}
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push(`/athlete/documents`)}
        >
          <Ionicons name="document-text" size={22} color="#007AFF" />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Documenti</Text>
            <Text style={styles.menuItemSubtitle}>Privacy, certificati e altro</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
      </ScrollView>
      
      {/* Privacy Modal - using AdultPrivacyModal component */}
      <AdultPrivacyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onSign={async (signatureBase64: string) => {
          try {
            // First, sign the privacy document (generates PDF)
            const signResponse = await api.post('/documents/sign', {
              document_type: 'privacy_consent',
              document_title: 'Privacy - Informativa GDPR',
              document_text: 'Accettazione informativa sulla privacy',
              signer_name: profile?.full_name || '',
              signer_email: user?.email || profile?.email || '',
              signature_base64: signatureBase64,
              related_entity_id: profile?.id,
              additional_data: {
                role: 'athlete',
                fiscal_code: profile?.fiscal_code || ''
              }
            });
            
            // Only call withdraw-trial-stay if athlete is in trial status
            if (profile?.status === 'trial') {
              await api.post('/athletes/withdraw-trial-stay');
            }
            
            // Update athlete status to active and save privacy info
            await api.patch(`/athletes/${profile?.id}`, {
              status: 'active',
              privacy_accepted: true,
              privacy_accepted_date: new Date().toISOString(),
              privacy_signature: signatureBase64,
              privacy_pdf_url: signResponse.data?.pdf_url || null
            });
            
            // Also update user status via accept-privacy endpoint
            try {
              await api.post('/auth/accept-privacy');
            } catch (e) {
              // Ignore if already active
            }
            
            if (Platform.OS === 'web') {
              window.alert('Privacy accettata! Ora sei un atleta attivo.');
            } else {
              Alert.alert('Successo', 'Privacy accettata! Ora sei un atleta attivo.');
            }
            setShowPrivacyModal(false);
            loadData();
          } catch (error: any) {
            let msg = 'Errore durante il salvataggio';
            if (error.response?.data?.detail) {
              msg = typeof error.response.data.detail === 'string' 
                ? error.response.data.detail 
                : JSON.stringify(error.response.data.detail);
            } else if (error.message) {
              msg = error.message;
            }
            if (Platform.OS === 'web') {
              window.alert(msg);
            } else {
              Alert.alert('Errore', msg);
            }
            throw error;
          }
        }}
        signerName={profile?.full_name || ''}
        signerRole="athlete"
        societyName={societySettings?.ragione_sociale || societySettings?.name || 'PALLAVOLO PERUGIA SSD A RL'}
        fiscalCode={profile?.fiscal_code || ''}
        birthDate={profile?.birth_date || ''}
        birthPlace={profile?.birth_place || ''}
        address={profile?.address || ''}
        city={profile?.city || ''}
        province={profile?.province || ''}
      />
      
      {/* Certificate Date Input Modal */}
      <Modal
        visible={certDateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setCertDateModalVisible(false);
          setPendingCertBase64(null);
          setCertDateInput('');
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' }}>
              📋 Data Scadenza Certificato
            </Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' }}>
              Inserisci la data di scadenza (GG/MM/AAAA)
            </Text>
            
            <View style={{ position: 'relative' }}>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 18,
                  textAlign: 'center',
                  backgroundColor: '#f9f9f9',
                  fontWeight: '600',
                  letterSpacing: 1,
                }}
                value={certDateInput}
                onChangeText={handleDateInputChange}
                placeholder="27/02/2028"
                placeholderTextColor="#bbb"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            
            <Text style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' }}>
              Digita solo i numeri, le barre / vengono inserite automaticamente
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f0f0f0',
                  paddingVertical: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setCertDateModalVisible(false);
                  setPendingCertBase64(null);
                  setCertDateInput('');
                }}
              >
                <Text style={{ color: '#666', fontWeight: '600', fontSize: 15 }}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: uploadingCert ? '#ccc' : '#34C759',
                  paddingVertical: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={confirmCertUpload}
                disabled={uploadingCert || certDateInput.length < 10}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {uploadingCert ? 'Caricamento...' : 'Conferma'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setShowQRModal(false)}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', maxWidth: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16 }}>Il Tuo QR Code</Text>
            {profile?.qr_code && (
              <Image 
                source={{ uri: profile.qr_code }}
                style={{ width: 250, height: 250, borderRadius: 8 }}
                resizeMode="contain"
              />
            )}
            {profile?.athlete_code && (
              <View style={{ marginTop: 16, backgroundColor: '#f5f5f5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', letterSpacing: 2 }}>{profile.athlete_code}</Text>
              </View>
            )}
            <Text style={{ marginTop: 12, color: '#666', fontSize: 13, textAlign: 'center' }}>
              Mostra questo codice al coach per registrare la tua presenza
            </Text>
            <TouchableOpacity 
              style={{ marginTop: 20, backgroundColor: '#007AFF', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 }}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#B8860B']} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>
            {profile.first_name?.charAt(0) || profile.full_name?.charAt(0) || 'A'}
          </Text>
        </View>
        <Text style={styles.profileName}>{profile.full_name}</Text>
        <Text style={styles.profileCompensation}>
          Compenso mensile: €{profile.monthly_compensation?.toLocaleString('it-IT') || 0}
        </Text>
        
        {/* Contract Period */}
        {profile.contract_start_date && profile.contract_end_date && (
          <View style={styles.contractPeriod}>
            <Text style={styles.contractPeriodText}>
              Periodo Contratto: {formatDateIT(profile.contract_start_date)} - {formatDateIT(profile.contract_end_date)}
            </Text>
          </View>
        )}
      </View>

      {/* Certificato Medico Card */}
      <View style={styles.certificateCard}>
        <Text style={styles.certificateCardTitle}>Certificato Medico</Text>
        {(profile as any)?.medical_certificate_url || (profile as any)?.medical_certificate_expiry ? (
          <View>
            <View style={styles.certificateInfo}>
              <Ionicons
                name={new Date((profile as any)?.medical_certificate_expiry) < new Date() ? 'close-circle' : 'checkmark-circle'}
                size={24}
                color={new Date((profile as any)?.medical_certificate_expiry) < new Date() ? '#FF3B30' : '#34C759'}
              />
              <View style={styles.certificateDetails}>
                <Text style={styles.certificateLabel}>
                  Scadenza: {formatDateIT((profile as any)?.medical_certificate_expiry)}
                </Text>
                {new Date((profile as any)?.medical_certificate_expiry) < new Date() && (
                  <Text style={styles.certificateExpired}>SCADUTO</Text>
                )}
              </View>
            </View>
            <View style={styles.certificateButtonsRow}>
              <TouchableOpacity
                style={styles.certificateViewButton}
                onPress={handleViewCertificate}
              >
                <Ionicons name="eye" size={18} color="#007AFF" />
                <Text style={styles.certificateViewButtonText}>Visualizza</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.certificateUploadButton}
                onPress={handleUploadCertificate}
                disabled={uploadingCert}
              >
                <Text style={styles.certificateUploadButtonText}>
                  {uploadingCert ? 'Caricamento...' : 'Carica Nuovo'}
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
              style={styles.certificateMainButton}
              onPress={handleUploadCertificate}
              disabled={uploadingCert}
            >
              <Text style={styles.certificateMainButtonText}>
                {uploadingCert ? 'Caricamento...' : 'Carica Certificato'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Dati Iscrizione Card */}
      <View style={styles.iscrizioneCard}>
        <Text style={styles.iscrizioneCardTitle}>Dati Iscrizione</Text>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Squadra</Text>
          <Text style={[styles.dataValue, { color: '#E53935', fontWeight: '700' }]}>
            🏐 {profile?.team_name || 'Non assegnata'}
          </Text>
        </View>
        
        {/* Coach Info */}
        {coachInfo && (
          <View style={styles.coachInfoCard}>
            <Text style={styles.coachInfoTitle}>👨‍🏫 Coach della Squadra</Text>
            <View style={styles.coachInfoRow}>
              {coachInfo.profile_photo_artistic || coachInfo.profile_photo ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${coachInfo.profile_photo_artistic || coachInfo.profile_photo}` }}
                  style={styles.coachPhoto}
                />
              ) : (
                <View style={styles.coachPhotoPlaceholder}>
                  <Ionicons name="person" size={20} color="#999" />
                </View>
              )}
              <View style={styles.coachInfoDetails}>
                <Text style={styles.coachName}>{coachInfo.full_name}</Text>
                <Text style={styles.coachContactHint}>Per contattare il coach, rivolgersi alla segreteria</Text>
              </View>
            </View>
          </View>
        )}
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Cognome</Text>
          <Text style={styles.dataValue}>{profile?.last_name || '-'}</Text>
        </View>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Nome</Text>
          <Text style={styles.dataValue}>{profile?.first_name || '-'}</Text>
        </View>
      </View>

      {/* Link to Profile */}
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/athlete/profile')}
      >
        <Ionicons name="person" size={22} color="#B8860B" />
        <View style={styles.menuItemContent}>
          <Text style={styles.menuItemTitle}>Il Mio Profilo</Text>
          <Text style={styles.menuItemSubtitle}>Dati personali, documento e IBAN</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      {/* Yearly Breakdown */}
      {Object.keys(yearlyTotals).sort((a, b) => parseInt(a) - parseInt(b)).map((yearStr, idx, arr) => {
        const year = parseInt(yearStr);
        const data = yearlyTotals[year];
        const yearTotal = data.total + data.prior;
        const exceeds5K = yearTotal > 5000;
        const exceeds15K = yearTotal > 15000;
        
        const yearMonths = contractMonths.filter(m => m.year === year);
        const firstMonthName = MONTH_NAMES_FULL[yearMonths[0]?.month || 1];
        const lastMonthName = MONTH_NAMES_FULL[yearMonths[yearMonths.length - 1]?.month || 12];
        
        // Determine if this is start, end, or middle year
        const isFirstYear = idx === 0;
        const isLastYear = idx === arr.length - 1;
        const yearLabel = isFirstYear && isLastYear 
          ? '' 
          : isFirstYear 
            ? '(Inizio Contratto)' 
            : isLastYear 
              ? '(Fine Contratto)' 
              : '';
        
        return (
          <View key={year} style={styles.yearCard}>
            <View style={styles.yearHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
                <Text style={styles.yearTitle}>Anno {year}</Text>
                {yearLabel ? <Text style={styles.yearLabelText}> {yearLabel}</Text> : null}
              </View>
              {exceeds5K && (
                <View style={[styles.thresholdBadge, exceeds15K ? styles.thresholdBadge15K : styles.thresholdBadge5K]}>
                  <Text style={styles.thresholdBadgeText}>{exceeds15K ? '>15K' : '>5K'}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.yearCalculation}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Mesi nel contratto:</Text>
                <Text style={styles.calcValue}>{firstMonthName} - {lastMonthName} ({data.months} mesi)</Text>
              </View>
              
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Compenso da contratto:</Text>
                <Text style={styles.calcValue}>€{profile.monthly_compensation} × {data.months} = €{data.total.toLocaleString('it-IT')}</Text>
              </View>
              
              {data.prior > 0 && (
                <View style={[styles.calcRow, styles.priorRow]}>
                  <Text style={[styles.calcLabel, { color: '#B8860B' }]}>+ Pregressi dichiarati:</Text>
                  <Text style={[styles.calcValue, { color: '#B8860B', fontWeight: '600' }]}>€{data.prior.toLocaleString('it-IT')}</Text>
                </View>
              )}
              
              <View style={[styles.calcRow, styles.calcTotalRow]}>
                <Text style={styles.calcTotalLabel}>TOTALE ANNO:</Text>
                <Text style={[styles.calcTotalValue, exceeds5K && styles.calcTotalValueWarning]}>
                  €{yearTotal.toLocaleString('it-IT')}
                </Text>
              </View>
            </View>
            
            {exceeds5K && (
              <View style={[styles.warningBox, exceeds15K && styles.warningBox15K]}>
                <Ionicons name="warning" size={18} color={exceeds15K ? '#D32F2F' : '#FF9800'} />
                <Text style={[styles.warningText, exceeds15K && styles.warningText15K]}>
                  {exceeds15K 
                    ? 'Supera soglia €15.000 - Ritenuta fiscale'
                    : 'Supera soglia €5.000 - Contributi previdenziali'
                  }
                </Text>
              </View>
            )}
            
            {/* Receipts Grid for this year */}
            <Text style={styles.receiptsTitle}>Quietanze {year}</Text>
            <View style={styles.receiptsGrid}>
              {yearMonths.map(({ year: y, month }) => {
                const signed = isReceiptSigned(y, month);
                const available = isMonthAvailable(y, month);
                const signedDate = getReceiptSignedDate(y, month);
                
                // Check if this month exceeds 5K threshold
                const monthIndex = contractMonths.findIndex(m => m.year === y && m.month === month);
                let runningTotal = (profile?.other_annual_compensation || 0);
                for (let i = 0; i <= monthIndex; i++) {
                  if (contractMonths[i].year === y) {
                    runningTotal += profile?.monthly_compensation || 0;
                  }
                }
                const monthExceeds5K = runningTotal > 5000;
                
                return (
                  <TouchableOpacity
                    key={`${y}-${month}`}
                    style={[
                      styles.receiptItem,
                      signed && styles.receiptItemSigned,
                      signed && monthExceeds5K && styles.receiptItemExceeds5K,
                      !available && !signed && styles.receiptItemUnavailable,
                      available && !signed && styles.receiptItemPending,
                    ]}
                    onPress={() => {
                      if (available && !signed) {
                        router.push(`/athlete/compensation?month=${month}&year=${y}`);
                      }
                    }}
                    disabled={!available || signed}
                  >
                    {signed ? (
                      <>
                        <Ionicons name="checkmark" size={16} color={monthExceeds5K ? '#8B6914' : '#2E7D32'} />
                        <Text style={[styles.receiptMonth, monthExceeds5K && styles.receiptMonthExceeds5K]}>
                          {MONTH_NAMES[month]}
                        </Text>
                        <Text style={[styles.receiptAmount, monthExceeds5K && styles.receiptAmountExceeds5K]}>
                          €{profile.monthly_compensation}
                        </Text>
                        {signedDate && (
                          <Text style={styles.receiptDate}>
                            Firmata il {new Date(signedDate).toLocaleDateString('it-IT')}
                          </Text>
                        )}
                      </>
                    ) : available ? (
                      <>
                        <Text style={styles.receiptMonthPending}>{MONTH_NAMES[month]}</Text>
                        <Text style={styles.receiptAmountPending}>€{profile.monthly_compensation}</Text>
                        <Text style={styles.receiptAction}>Tocca per firmare</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="time-outline" size={16} color="#999" />
                        <Text style={styles.receiptMonthUnavailable}>{MONTH_NAMES[month]}</Text>
                        <Text style={styles.receiptAmountUnavailable}>€{profile.monthly_compensation}</Text>
                        <Text style={styles.receiptUnavailable}>Non disponibile</Text>
                      </>
                    )}
                    
                    {monthExceeds5K && signed && (
                      <View style={styles.exceeds5KBadge}>
                        <Text style={styles.exceeds5KBadgeText}>{'>'}5K</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Riepilogo Quietanze</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Quietanze firmate:</Text>
          <Text style={styles.summaryValue}>{getSignedCount()} / {getTotalMonths()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totale contratto:</Text>
          <Text style={styles.summaryValue}>
            €{((profile?.monthly_compensation || 0) * getTotalMonths()).toLocaleString('it-IT')}
          </Text>
        </View>
      </View>

      {/* Bank Info */}
      {profile.iban && (
        <View style={styles.bankCard}>
          <Text style={styles.bankTitle}>Dati Bancari</Text>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>IBAN:</Text>
            <Text style={styles.bankValue}>{profile.iban}</Text>
          </View>
          {(profile.iban_holder_last_name || profile.iban_holder_first_name) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Intestatario:</Text>
              <Text style={styles.bankValue}>
                {profile.iban_holder_last_name} {profile.iban_holder_first_name}
              </Text>
            </View>
          )}
          {profile.bank_name && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Banca:</Text>
              <Text style={styles.bankValue}>{profile.bank_name}</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
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
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  profileCard: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  profileCompensation: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  contractPeriod: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  contractPeriodText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  yearCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  yearTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  yearLabelText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  thresholdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thresholdBadge5K: {
    backgroundColor: '#FFF3E0',
  },
  thresholdBadge15K: {
    backgroundColor: '#FFEBEE',
  },
  thresholdBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9800',
  },
  yearSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  yearCalculation: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  priorRow: {
    backgroundColor: 'rgba(184, 134, 11, 0.1)',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 6,
    paddingVertical: 8,
  },
  calcLabel: {
    fontSize: 13,
    color: '#666',
  },
  calcValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  calcTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },
  calcTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  calcTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  calcTotalValueWarning: {
    color: '#D32F2F',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  warningBox15K: {
    backgroundColor: '#FFEBEE',
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    flex: 1,
  },
  warningText15K: {
    color: '#C62828',
  },
  receiptsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  receiptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  receiptItem: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 90,
  },
  receiptItemSigned: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  receiptItemExceeds5K: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB300',
  },
  receiptItemPending: {
    backgroundColor: '#fff',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  receiptItemUnavailable: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  receiptMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
  receiptMonthExceeds5K: {
    color: '#8B6914',
  },
  receiptAmount: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  receiptAmountExceeds5K: {
    color: '#8B6914',
  },
  receiptDate: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  receiptMonthPending: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976D2',
    marginTop: 4,
  },
  receiptAmountPending: {
    fontSize: 12,
    color: '#1976D2',
  },
  receiptAction: {
    fontSize: 9,
    color: '#1976D2',
    marginTop: 4,
    fontWeight: '600',
  },
  receiptMonthUnavailable: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
  },
  receiptAmountUnavailable: {
    fontSize: 12,
    color: '#999',
  },
  receiptUnavailable: {
    fontSize: 9,
    color: '#999',
    marginTop: 4,
  },
  exceeds5KBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFB300',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exceeds5KBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bankCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bankTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  bankRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  bankLabel: {
    fontSize: 13,
    color: '#666',
    width: 90,
  },
  bankValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  // Certificate Card Styles
  certificateCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  certificateCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  certificateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  certificateDetails: {
    marginLeft: 12,
  },
  certificateLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  certificateExpired: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '700',
    marginTop: 2,
  },
  certificateButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  certificateViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  certificateViewButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  certificateUploadButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  certificateUploadButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  certificateMainButton: {
    backgroundColor: '#B8860B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  certificateMainButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // Iscrizione Card Styles
  iscrizioneCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iscrizioneCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
  },
  dataValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  // Coach Info Styles
  coachInfoCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
  },
  coachInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  coachInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  coachPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachInfoDetails: {
    marginLeft: 12,
    flex: 1,
  },
  coachName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  coachContactHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
