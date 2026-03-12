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
import { GDPRPrivacyModal } from '../../src/components/GDPRPrivacyModal';
import { SportIcon } from '../../src/components/SportIcon';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
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
  const [certIssueDateAthlete, setCertIssueDateAthlete] = useState('');
  const [savingCertAthlete, setSavingCertAthlete] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [societyEmail, setSocietyEmail] = useState('');
  
  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);

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
      setSocietyEmail(settingsResponse.data?.email || '');
      
      // Load expiring notifications
      try {
        const notifResponse = await api.get('/notifications/expiring');
        setNotifications(notifResponse.data.notifications || []);
      } catch (notifError) {
        console.log('Could not load notifications');
      }
      
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
        
        {/* Compact Profile Header */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }} data-testid="athlete-name">{profile?.full_name || 'Atleta'}</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                Squadra: <Text style={{ fontWeight: '600', color: '#E53935' }}>{profile?.team_name || 'Non assegnata'}</Text>
              </Text>
            </View>
            <View style={{ 
              backgroundColor: profile?.status === 'trial' ? '#FFF3E0' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '#E3F2FD' : '#E8F5E9', 
              paddingHorizontal: 10, 
              paddingVertical: 5, 
              borderRadius: 12
            }}>
              <Text style={{ 
                color: profile?.status === 'trial' ? '#FF9800' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '#1976D2' : '#4CAF50',
                fontWeight: '600',
                fontSize: 12
              }} data-testid="athlete-status">
                {profile?.status === 'trial' ? 'Periodo di Prova' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? 'Firma Privacy' : 'Attivo'}
              </Text>
            </View>
          </View>
          
          {/* Pending Privacy Banner */}
          {profile?.status === 'pending_privacy' && !profile?.privacy_accepted && (
            <TouchableOpacity 
              style={{ backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#1976D2' }}
              onPress={handleStayAndSignPrivacy}
            >
              <Text style={{ color: '#1976D2', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                Devi accettare la Privacy per continuare - Clicca qui
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Trial info + actions */}
          {profile?.status === 'trial' && (
            <View style={{ marginTop: 10 }}>
              {profile?.trial_end_date && (
                <Text style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                  Fine prova: {formatDateIT(profile.trial_end_date)}
                </Text>
              )}
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, textAlign: 'center' }}>
                Vuoi terminare il periodo di prova?
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                <TouchableOpacity 
                  style={{ flex: 1, maxWidth: 200, backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2196F3' }}
                  onPress={handleStayAndSignPrivacy}
                >
                  <Text style={{ color: '#1565C0', fontWeight: '600', fontSize: 12, textAlign: 'center' }}>Rimani e Firma Privacy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, maxWidth: 200, backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F44336' }}
                  onPress={async () => {
                    const confirm = Platform.OS === 'web' 
                      ? window.confirm('ATTENZIONE: Questa azione cancellerà definitivamente tutti i tuoi dati (profilo, pagamenti, presenze). Sei sicuro?')
                      : await new Promise<boolean>((resolve) => {
                          Alert.alert(
                            'Cancella Account',
                            'ATTENZIONE: Questa azione cancellerà definitivamente tutti i tuoi dati.\n\nSei sicuro?',
                            [
                              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                              { text: 'Cancella Tutto', style: 'destructive', onPress: () => resolve(true) }
                            ]
                          );
                        });
                    if (confirm) {
                      try {
                        await api.post('/athletes/withdraw-trial-leave');
                        if (Platform.OS === 'web') { window.alert('Account eliminato.'); } else { Alert.alert('Account Eliminato'); }
                        handleLogout();
                      } catch (error: any) {
                        const msg = error.response?.data?.detail || 'Errore';
                        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Errore', msg); }
                      }
                    }
                  }}
                >
                  <Text style={{ color: '#C62828', fontWeight: '600', fontSize: 12, textAlign: 'center' }}>Non Rimanere</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        
        {/* QR Code Section */}
        {profile?.qr_code && (
          <TouchableOpacity 
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
            onPress={() => setShowQRModal(true)}
            data-testid="qr-code-section"
          >
            <Image 
              source={{ uri: profile.qr_code }}
              style={{ width: 50, height: 50, borderRadius: 4 }}
              resizeMode="contain"
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>Il Tuo QR Code</Text>
              {profile?.athlete_code && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#007AFF', marginTop: 2, letterSpacing: 1 }}>{profile.athlete_code}</Text>
              )}
            </View>
            <Ionicons name="expand" size={22} color="#007AFF" />
          </TouchableOpacity>
        )}
        
        {/* Pagamenti - in evidenza */}
        <TouchableOpacity 
          style={[styles.menuItem, { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFA000' }]}
          onPress={() => router.push(`/athlete/payments`)}
          data-testid="payments-menu-item"
        >
          <Ionicons name="card" size={22} color="#FF8F00" />
          <View style={styles.menuItemContent}>
            <Text style={[styles.menuItemTitle, { color: '#E65100' }]}>Pagamenti</Text>
            <Text style={styles.menuItemSubtitle}>Visualizza le tue rate e pagamenti</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFA000" />
        </TouchableOpacity>
        
        {/* Dati Personali */}
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/athlete/profile')}
          data-testid="personal-data-menu-item"
        >
          <Ionicons name="person" size={22} color="#007AFF" />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Dati Personali</Text>
            <Text style={styles.menuItemSubtitle}>Visualizza e modifica i tuoi dati</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
        {/* Coach della Squadra - senza wrapper "Dati Iscrizione" */}
        {coachInfo && (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 }}>Coach della Squadra</Text>
            {(coachInfo.all_coaches || [coachInfo]).map((coach: any, idx: number) => (
              <View key={coach.id || idx} style={[styles.coachInfoRow, idx > 0 && { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' }]}>
                {coach.profile_photo_artistic || coach.profile_photo ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${coach.profile_photo_artistic || coach.profile_photo}` }}
                    style={styles.coachPhoto}
                  />
                ) : (
                  <View style={styles.coachPhotoPlaceholder}>
                    <Ionicons name="person" size={20} color="#999" />
                  </View>
                )}
                <View style={styles.coachInfoDetails}>
                  <Text style={styles.coachName}>{coach.full_name}</Text>
                  {coach.phone && (
                    <TouchableOpacity 
                      style={styles.whatsappButton}
                      onPress={() => {
                        const phoneNumber = coach.phone.replace(/\s+/g, '').replace(/^\+/, '');
                        const whatsappUrl = `https://wa.me/${phoneNumber}`;
                        if (Platform.OS === 'web') { window.open(whatsappUrl, '_blank'); }
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                      <Text style={styles.whatsappButtonText}>Contatta su WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* Orari Allenamenti */}
        {profile?.team_id && (
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push(`/athlete/schedule?tab=orari`)}
            data-testid="schedule-menu-item"
          >
            <Ionicons name="calendar" size={22} color="#007AFF" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Orari Allenamenti</Text>
              <Text style={styles.menuItemSubtitle}>Calendario settimanale</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}
        
        {/* Presenze/Statistiche */}
        {profile?.team_id && (
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#2196F3' }]}
            onPress={() => router.push(`/athlete/presenze`)}
            data-testid="attendance-menu-item"
          >
            <Ionicons name="stats-chart" size={22} color="#2196F3" />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: '#1976D2' }]}>Presenze e Statistiche</Text>
              <Text style={styles.menuItemSubtitle}>Visualizza le tue presenze e statistiche</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2196F3" />
          </TouchableOpacity>
        )}
        
        {/* Certificato Medico */}
        <View style={[styles.certificateCard, { marginTop: 0 }]}>
          <Text style={styles.certificateCardTitle}>Certificato Medico</Text>
          {(profile as any)?.medical_certificate_expiry ? (
            <View>
              <View style={styles.certificateInfo}>
                <Ionicons
                  name={new Date((profile as any)?.medical_certificate_expiry) < new Date() ? 'close-circle' : ((profile as any)?.medical_certificate_verified ? 'checkmark-circle' : 'time-outline')}
                  size={24}
                  color={new Date((profile as any)?.medical_certificate_expiry) < new Date() ? '#FF3B30' : ((profile as any)?.medical_certificate_verified ? '#34C759' : '#FF9500')}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 4 }}>
                <Ionicons
                  name={(profile as any)?.medical_certificate_verified ? 'shield-checkmark' : 'shield-outline'}
                  size={18}
                  color={(profile as any)?.medical_certificate_verified ? '#4CAF50' : '#FF9500'}
                />
                <Text style={{ marginLeft: 8, fontSize: 13, color: (profile as any)?.medical_certificate_verified ? '#4CAF50' : '#FF9500', fontWeight: '600' }}>
                  {(profile as any)?.medical_certificate_verified ? "Verificato dall'admin" : "Non ancora verificato dall'admin"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#FF9500" />
              <Text style={styles.warningText}>Nessun certificato inserito</Text>
            </View>
          )}
          
          {/* Collapsible: Nuovo certificato */}
          <TouchableOpacity 
            style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#eee' }}
            onPress={() => setShowCertForm(!showCertForm)}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>Nuovo certificato</Text>
            <Ionicons name={showCertForm ? "chevron-up" : "chevron-down"} size={20} color="#007AFF" />
          </TouchableOpacity>
          
          {showCertForm && (
          <View>
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 }}>Data di Emissione (GG/MM/AAAA)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' }}
              value={certIssueDateAthlete}
              onChangeText={(text) => {
                let cleaned = text.replace(/\D/g, '');
                if (cleaned.length >= 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
                if (cleaned.length >= 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
                if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
                setCertIssueDateAthlete(cleaned);
              }}
              placeholder="gg/mm/aaaa"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
            />
            {certIssueDateAthlete.length === 10 && (
              <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#666' }}>SCADENZA CERTIFICATO</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginTop: 2 }}>
                  {(() => {
                    const parts = certIssueDateAthlete.split('/');
                    if (parts.length === 3) {
                      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                      d.setFullYear(d.getFullYear() + 1);
                      d.setDate(d.getDate() - 1);
                      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    }
                    return '';
                  })()}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginTop: 10, alignItems: 'center', opacity: certIssueDateAthlete.length === 10 ? 1 : 0.5 }}
              disabled={certIssueDateAthlete.length !== 10 || savingCertAthlete}
              onPress={async () => {
                const parts = certIssueDateAthlete.split('/');
                if (parts.length !== 3) return;
                const issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                const expiryDate = new Date(issueDate);
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                expiryDate.setDate(expiryDate.getDate() - 1);
                setSavingCertAthlete(true);
                try {
                  await api.post('/certificates/simple', {
                    athlete_id: profile?.athlete_record_id || profile?.athlete_id || profile?.id,
                    issue_date: issueDate.toISOString(),
                    expiry_date: expiryDate.toISOString(),
                    verified: false,
                  });
                  const res = await api.get('/auth/me');
                  setProfile(res.data);
                  setCertIssueDateAthlete('');
                  if (Platform.OS === 'web') { window.alert('Certificato salvato con successo!'); } else { Alert.alert('Successo', 'Certificato salvato!'); }
                } catch (error: any) {
                  const msg = error.response?.data?.detail || 'Errore nel salvataggio';
                  if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Errore', msg); }
                } finally {
                  setSavingCertAthlete(false);
                }
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {savingCertAthlete ? 'Salvataggio...' : 'Salva Data Certificato'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#FF9800' }}>
            <Text style={{ fontSize: 12, color: '#E65100', lineHeight: 18 }}>
              Copia del certificato dovrà essere consegnata alla Società e inviata per e-mail al seguente indirizzo: <Text style={{ fontWeight: 'bold' }}>{(profile as any)?.society_email || societyEmail || '-'}</Text> in formato pdf
            </Text>
          </View>
          </View>
          )}
        </View>

        {/* Documenti */}
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push(`/athlete/documents`)}
          data-testid="documents-menu-item"
        >
          <Ionicons name="document-text" size={22} color="#007AFF" />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Documenti</Text>
            <Text style={styles.menuItemSubtitle}>Privacy, certificati e altro</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
        {/* Privacy */}
        <View style={[styles.menuItem, { backgroundColor: profile?.privacy_accepted ? '#E8F5E9' : '#FFF3E0' }]} data-testid="privacy-status">
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
        
        {/* Contact Info */}
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
        
        {/* Spacer per permettere scroll completo */}
        <View style={{ height: 100 }} />
        
      </ScrollView>
      
      {/* Privacy Modal - using GDPRPrivacyModal component */}
      <GDPRPrivacyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onSign={async (success: boolean, documentId?: string) => {
          if (!success) return;
          try {
            // Only call withdraw-trial-stay if athlete is in trial status
            if (profile?.status === 'trial') {
              await api.post('/athletes/withdraw-trial-stay');
            }
            
            // Update athlete status to active and save privacy info
            await api.patch(`/athletes/${profile?.id}`, {
              status: 'active',
              privacy_accepted: true,
              privacy_accepted_date: new Date().toISOString(),
              privacy_pdf_url: documentId ? `/api/documents/signed/${documentId}/pdf` : null
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
          }
        }}
        documentType="gdpr_adult"
        signerInfo={{
          name: profile?.full_name?.split(' ').slice(1).join(' ') || '',
          surname: profile?.full_name?.split(' ')[0] || '',
          fiscal_code: profile?.fiscal_code || '',
          birth_date: profile?.birth_date || '',
          birth_place: profile?.birth_place || '',
          address: profile?.address || '',
          city: profile?.city || '',
          province: profile?.province || '',
        }}
      />
      
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
          Compenso mensile: {formatCurrency(profile.monthly_compensation)}
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
        {(profile as any)?.medical_certificate_expiry ? (
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
            {/* Stato verifica admin */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 4 }}>
              <Ionicons
                name={(profile as any)?.medical_certificate_verified ? 'shield-checkmark' : 'shield-outline'}
                size={18}
                color={(profile as any)?.medical_certificate_verified ? '#4CAF50' : '#FF9500'}
              />
              <Text style={{ marginLeft: 8, fontSize: 13, color: (profile as any)?.medical_certificate_verified ? '#4CAF50' : '#FF9500', fontWeight: '600' }}>
                {(profile as any)?.medical_certificate_verified ? "Verificato dall'admin" : "Non ancora verificato dall'admin"}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#FF9500" />
              <Text style={styles.warningText}>Nessun certificato inserito</Text>
            </View>
          </View>
        )}
        
        {/* Collapsible: Nuovo certificato */}
        <TouchableOpacity 
          style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#eee' }}
          onPress={() => setShowCertForm(!showCertForm)}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>Nuovo certificato</Text>
          <Ionicons name={showCertForm ? "chevron-up" : "chevron-down"} size={20} color="#007AFF" />
        </TouchableOpacity>
        
        {showCertForm && (
        <View>
        {/* Form inserimento data emissione */}
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 }}>Data di Emissione (GG/MM/AAAA)</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' }}
            value={certIssueDateAthlete}
            onChangeText={(text) => {
              let cleaned = text.replace(/\D/g, '');
              if (cleaned.length >= 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
              if (cleaned.length >= 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
              if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
              setCertIssueDateAthlete(cleaned);
            }}
            placeholder="gg/mm/aaaa"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={10}
          />
          {certIssueDateAthlete.length === 10 && (
            <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#666' }}>SCADENZA CERTIFICATO</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginTop: 2 }}>
                {(() => {
                  const parts = certIssueDateAthlete.split('/');
                  if (parts.length === 3) {
                    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    d.setFullYear(d.getFullYear() + 1);
                    d.setDate(d.getDate() - 1);
                    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                  }
                  return '';
                })()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginTop: 10, alignItems: 'center', opacity: certIssueDateAthlete.length === 10 ? 1 : 0.5 }}
            disabled={certIssueDateAthlete.length !== 10 || savingCertAthlete}
            onPress={async () => {
              const parts = certIssueDateAthlete.split('/');
              if (parts.length !== 3) return;
              const issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              const expiryDate = new Date(issueDate);
              expiryDate.setFullYear(expiryDate.getFullYear() + 1);
              expiryDate.setDate(expiryDate.getDate() - 1);
              setSavingCertAthlete(true);
              try {
                await api.post('/certificates/simple', {
                  athlete_id: profile?.athlete_record_id || profile?.athlete_id || profile?.id,
                  issue_date: issueDate.toISOString(),
                  expiry_date: expiryDate.toISOString(),
                  verified: false,
                });
                const res = await api.get('/auth/me');
                setProfile(res.data);
                setCertIssueDateAthlete('');
                if (Platform.OS === 'web') {
                  window.alert('Certificato salvato con successo!');
                } else {
                  Alert.alert('Successo', 'Certificato salvato con successo!');
                }
              } catch (error: any) {
                const msg = error.response?.data?.detail || 'Errore nel salvataggio';
                if (Platform.OS === 'web') {
                  window.alert(msg);
                } else {
                  Alert.alert('Errore', msg);
                }
              } finally {
                setSavingCertAthlete(false);
              }
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {savingCertAthlete ? 'Salvataggio...' : 'Salva Data Certificato'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Info consegna/spedizione */}
        <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#FF9800' }}>
          <Text style={{ fontSize: 12, color: '#E65100', lineHeight: 18 }}>
            Copia del certificato dovrà essere consegnata alla Società e inviata per e-mail al seguente indirizzo: <Text style={{ fontWeight: 'bold' }}>{(profile as any)?.society_email || societyEmail || '-'}</Text> in formato pdf
          </Text>
        </View>
        </View>
        )}
      </View>

      {/* Dati Iscrizione Card */}
      <View style={styles.iscrizioneCard}>
        <Text style={styles.iscrizioneCardTitle}>Dati Iscrizione</Text>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Squadra</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: 6 }}>
              <SportIcon size={24} />
            </View>
            <Text style={[styles.dataValue, { color: '#E53935', fontWeight: '700' }]}>
              {profile?.team_name || 'Non assegnata'}
            </Text>
          </View>
        </View>
        
        {/* Coach Info */}
        {coachInfo && (
          <View style={styles.coachInfoCard}>
            <Text style={styles.coachInfoTitle}>Coach della Squadra</Text>
            {(coachInfo.all_coaches || [coachInfo]).map((coach: any, idx: number) => (
              <View key={coach.id || idx} style={[styles.coachInfoRow, idx > 0 && { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' }]}>
                {coach.profile_photo_artistic || coach.profile_photo ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${coach.profile_photo_artistic || coach.profile_photo}` }}
                    style={styles.coachPhoto}
                  />
                ) : (
                  <View style={styles.coachPhotoPlaceholder}>
                    <Ionicons name="person" size={20} color="#999" />
                  </View>
                )}
                <View style={styles.coachInfoDetails}>
                  <Text style={styles.coachName}>{coach.full_name}</Text>
                  {coach.phone && (
                    <TouchableOpacity 
                      style={styles.whatsappButton}
                      onPress={() => {
                        const phoneNumber = coach.phone.replace(/\s+/g, '').replace(/^\+/, '');
                        const whatsappUrl = `https://wa.me/${phoneNumber}`;
                        if (Platform.OS === 'web') {
                          window.open(whatsappUrl, '_blank');
                        }
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                      <Text style={styles.whatsappButtonText}>Contatta su WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Link to Profile */}
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/athlete/profile')}
      >
        <Ionicons name="person" size={22} color="#B8860B" />
        <View style={styles.menuItemContent}>
          <Text style={styles.menuItemTitle}>Dati Personali</Text>
          <Text style={styles.menuItemSubtitle}>Visualizza e modifica i tuoi dati</Text>
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
                <Text style={styles.calcValue}>{formatCurrency(profile.monthly_compensation)} × {data.months} = {formatCurrency(data.total)}</Text>
              </View>
              
              {data.prior > 0 && (
                <View style={[styles.calcRow, styles.priorRow]}>
                  <Text style={[styles.calcLabel, { color: '#B8860B' }]}>+ Pregressi dichiarati:</Text>
                  <Text style={[styles.calcValue, { color: '#B8860B', fontWeight: '600' }]}>{formatCurrency(data.prior)}</Text>
                </View>
              )}
              
              <View style={[styles.calcRow, styles.calcTotalRow]}>
                <Text style={styles.calcTotalLabel}>TOTALE ANNO:</Text>
                <Text style={[styles.calcTotalValue, exceeds5K && styles.calcTotalValueWarning]}>
                  {formatCurrency(yearTotal)}
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
                          {formatCurrency(profile.monthly_compensation)}
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
                        <Text style={styles.receiptAmountPending}>{formatCurrency(profile.monthly_compensation)}</Text>
                        <Text style={styles.receiptAction}>Tocca per firmare</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="time-outline" size={16} color="#999" />
                        <Text style={styles.receiptMonthUnavailable}>{MONTH_NAMES[month]}</Text>
                        <Text style={styles.receiptAmountUnavailable}>{formatCurrency(profile.monthly_compensation)}</Text>
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
            {formatCurrency((profile?.monthly_compensation || 0) * getTotalMonths())}
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
    marginTop: 10,
    padding: 14,
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
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  whatsappButtonText: {
    color: '#25D366',
    fontWeight: '600',
    fontSize: 13,
  },
  // Notification styles
  notificationBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E65100',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    gap: 10,
  },
  notificationExpired: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
  },
  notificationUrgent: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 3,
    borderLeftColor: '#F57C00',
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  notificationDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
