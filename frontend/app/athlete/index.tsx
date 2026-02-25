import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import SignatureCanvas from 'react-signature-canvas';

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
  const [privacySignature, setPrivacySignature] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);

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
            backgroundColor: profile?.status === 'trial' ? '#FFF3E0' : profile?.status === 'pending_privacy' ? '#E3F2FD' : '#E8F5E9', 
            paddingHorizontal: 12, 
            paddingVertical: 6, 
            borderRadius: 16,
            marginTop: 8
          }}>
            <Text style={{ 
              color: profile?.status === 'trial' ? '#FF9800' : profile?.status === 'pending_privacy' ? '#1976D2' : '#4CAF50',
              fontWeight: '600',
              fontSize: 13
            }}>
              {profile?.status === 'trial' ? '⏳ Periodo di Prova' : profile?.status === 'pending_privacy' ? '📝 Firma Privacy Richiesta' : '✓ Attivo'}
            </Text>
          </View>
          
          {/* Pending Privacy Banner */}
          {profile?.status === 'pending_privacy' && (
            <TouchableOpacity 
              style={{ 
                backgroundColor: '#E3F2FD', 
                padding: 12, 
                borderRadius: 8, 
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#1976D2'
              }}
              onPress={() => router.push('/athlete/profile')}
            >
              <Text style={{ color: '#1976D2', fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
                ✍️ Devi accettare la Privacy per continuare
              </Text>
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                Clicca qui per andare al profilo e firmare
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
                  onPress={() => {
                    // Apri direttamente il modal per firmare la privacy
                    setShowPrivacyModal(true);
                  }}
                  }}
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
        
        {/* Contact Info */}
        {profile?.email && (
          <View style={styles.menuItem}>
            <Ionicons name="mail" size={22} color="#007AFF" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Email</Text>
              <Text style={styles.menuItemSubtitle}>{profile.email}</Text>
            </View>
          </View>
        )}
        
        {profile?.phone_athlete && (
          <View style={styles.menuItem}>
            <Ionicons name="call" size={22} color="#007AFF" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Telefono</Text>
              <Text style={styles.menuItemSubtitle}>{profile.phone_athlete}</Text>
            </View>
          </View>
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
        
        {/* Attendance/Schedule Section */}
        {profile?.team_id && (
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push(`/athlete/schedule`)}
          >
            <Ionicons name="calendar" size={22} color="#007AFF" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Presenze e Orari</Text>
              <Text style={styles.menuItemSubtitle}>Calendario allenamenti e partite</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}
        
      </ScrollView>
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
});
