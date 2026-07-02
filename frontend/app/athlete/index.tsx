import React, { useState, useEffect, useRef } from 'react';
import SocietyBranding from '../../src/components/SocietyBranding';
import AthleteTabBar from '../../src/components/athlete/AthleteTabBar';
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
import { OnboardingTutorial, ATHLETE_STEPS } from '../../src/components/OnboardingTutorial';
import SignaturePadInline, { SignaturePadInlineRef } from '../../src/components/SignaturePadInline';
import SwitchAccountButton from '../../src/components/SwitchAccountButton';

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
  // 🆕 26/06/2026 — Staff della società (per widget "Da Fare")
  const [dirigenti, setDirigenti] = useState<any[]>([]);
  const [societyCoaches, setSocietyCoaches] = useState<any[]>([]);
  const [collaboratori, setCollaboratori] = useState<any[]>([]);
  // Dual-role detection (atleta + coach): se vero, mostro TUTTO lo staff della società
  // (senza filtro per squadra), come fa il coach standard nella tab "Società".
  const [isDualRoleCoach, setIsDualRoleCoach] = useState<boolean>(false);
  const [certIssueDateAthlete, setCertIssueDateAthlete] = useState('');
  const [certValidityMonthsAthlete, setCertValidityMonthsAthlete] = useState('12');
  const [savingCertAthlete, setSavingCertAthlete] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [showUpcomingAthlete, setShowUpcomingAthlete] = useState(false);
  const [societyEmail, setSocietyEmail] = useState('');
  
  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  
  // Commitments (trainings + matches) for next 7 days — supports cancelled/modified flags
  const [commitments, setCommitments] = useState<{
    today: any[]; tomorrow: any[]; day_after: any[]; upcoming: any[];
  }>({ today: [], tomorrow: [], day_after: [], upcoming: [] });
  
  // Trial document signing
  const [showTrialSignModal, setShowTrialSignModal] = useState(false);
  const [trialSignature, setTrialSignature] = useState<string | null>(null);
  const [signingTrialDoc, setSigningTrialDoc] = useState(false);
  const trialSignatureRef = useRef<SignaturePadInlineRef>(null);
  
  // Trial status data (matching minor flow)
  const [trialStatus, setTrialStatus] = useState<any>(null);
  const [endTrialStatus, setEndTrialStatus] = useState<any>(null);
  const [societyName, setSocietyName] = useState<string>('');

  // 🆕 29/06/2026 — Richieste cancellazione documenti (parità Coach/Collaboratore):
  // l'admin invia una richiesta che l'atleta deve approvare/rifiutare.
  const [pendingDeletions, setPendingDeletions] = useState<any[]>([]);
  const [processingDeletion, setProcessingDeletion] = useState<string | null>(null);

  const loadPendingDeletions = async () => {
    try {
      const resp = await api.get('/deletion-requests/pending');
      setPendingDeletions(resp.data || []);
    } catch (e) {
      // silent
    }
  };

  const handleDeletionResponse = async (reqId: string, approve: boolean) => {
    if (processingDeletion) return;
    setProcessingDeletion(reqId);
    try {
      const path = approve ? `/deletion-requests/${reqId}/approve` : `/deletion-requests/${reqId}/reject`;
      await api.post(path);
      if (Platform.OS === 'web') {
        window.alert(approve ? 'Cancellazione autorizzata. Il documento è stato eliminato.' : 'Cancellazione rifiutata. Il documento resta valido.');
      } else {
        Alert.alert(approve ? 'Autorizzata' : 'Rifiutata', '');
      }
      loadPendingDeletions();
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Operazione non riuscita';
      if (Platform.OS === 'web') window.alert(`Errore: ${msg}`);
      else Alert.alert('Errore', msg);
    } finally {
      setProcessingDeletion(null);
    }
  };

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
    const placeOfBirth = (profile as any).place_of_birth || (profile as any).birth_place || (profile as any).country_of_birth;
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
    if (!(profile as any).place_of_birth && !(profile as any).birth_place && !(profile as any).country_of_birth) missing.push('luogo di nascita');
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
      let athleteData: any = null;
      try {
        const meResponse = await api.get('/auth/me');
        athleteData = meResponse.data;
      } catch (meErr) {
        console.error('loadData: /auth/me failed', meErr);
        showAlert('Errore', 'Impossibile caricare i dati');
        return;
      }

      // Set baseline profile from /auth/me so the dashboard never goes blank
      setProfile(athleteData);

      // For athletes, we need to get their athlete record
      if (athleteData.athlete_id) {
        try {
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
        } catch (athleteErr) {
          console.warn('loadData: /athletes/{id} failed, keeping baseline profile', athleteErr);
        }

        // Load receipts (best effort)
        try {
          const receiptsResponse = await api.get(`/athletes/${athleteData.athlete_id}/compensation/receipts`);
          setReceipts(receiptsResponse.data || []);
        } catch (rErr) {
          console.warn('loadData: receipts failed', rErr);
          setReceipts([]);
        }
      }

      // Load society settings (best effort)
      try {
        const settingsResponse = await api.get('/settings/society');
        setSocietySettings(settingsResponse.data);
        setSocietyEmail(settingsResponse.data?.email || '');
        setSocietyName(settingsResponse.data?.name || settingsResponse.data?.ragione_sociale || '');
      } catch (sErr) {
        console.warn('loadData: society settings failed', sErr);
      }

      // Load trial status data for adult athletes
      if (athleteData.athlete_id) {
        try {
          const trialRes = await api.get(`/athletes/${athleteData.athlete_id}/trial-status`);
          setTrialStatus(trialRes.data);
        } catch (e) { /* trial status not available */ }
        try {
          const endTrialRes = await api.get(`/athletes/${athleteData.athlete_id}/end-trial-status`);
          setEndTrialStatus(endTrialRes.data);
        } catch (e) { /* end-trial status not available */ }
      }

      // Load expiring notifications
      try {
        const notifResponse = await api.get('/notifications/expiring');
        setNotifications(notifResponse.data.notifications || []);
      } catch (notifError) {
        console.log('Could not load notifications');
      }

      // Load commitments (trainings + matches) for next 7 days.
      // 🆕 02/07/2026 — Se atleta dual-role (linked_coach_user_id), fetcho ANCHE
      // gli impegni come coach e li mergio in ordine cronologico con badge di ruolo.
      try {
        // Rileggo /auth/me per avere la flag dual-role fresca (evita race con setProfile async)
        let isDualRole = false;
        try {
          const meRes = await api.get('/auth/me');
          isDualRole = !!(meRes.data as any)?.linked_coach_user_id;
        } catch { /* fallback */ }
        const [athleteRes, coachRes] = await Promise.all([
          api.get('/athlete/commitments').catch(() => ({ data: null })),
          isDualRole
            ? api.get('/coach/commitments').catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
        ]);
        const tag = (arr: any[] = [], as_role: 'atleta' | 'coach') => (arr || []).map((x) => ({ ...x, as_role }));
        const sortBy = (a: any, b: any) => {
          const ka = `${a.date || ''}T${a.time_start || '00:00'}`;
          const kb = `${b.date || ''}T${b.time_start || '00:00'}`;
          return ka.localeCompare(kb);
        };
        const a = athleteRes?.data || { today: [], tomorrow: [], day_after: [], upcoming: [] };
        const c = coachRes?.data || { today: [], tomorrow: [], day_after: [], upcoming: [] };
        setCommitments({
          today: [...tag(a.today, 'atleta'), ...tag(c.today, 'coach')].sort(sortBy),
          tomorrow: [...tag(a.tomorrow, 'atleta'), ...tag(c.tomorrow, 'coach')].sort(sortBy),
          day_after: [...tag(a.day_after, 'atleta'), ...tag(c.day_after, 'coach')].sort(sortBy),
          upcoming: [...tag(a.upcoming, 'atleta'), ...tag(c.upcoming, 'coach')].sort(sortBy),
        });
      } catch {
        console.log('Could not load commitments');
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
    loadPendingDeletions();
  }, []);

  // 🆕 26/06/2026 — Carica lo staff della società (per widget "Da Fare"):
  // dirigenti + coach + collaboratori, e flag dual-role per decidere se filtrare per squadra.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dRes, cRes, kRes, drRes] = await Promise.allSettled([
          api.get('/users/dirigenti'),
          api.get('/users/fellow-coaches'),
          api.get('/users/staff-collaboratori'),
          api.get('/auth/me/dual-role-info'),
        ]);
        if (cancelled) return;
        if (dRes.status === 'fulfilled') setDirigenti(dRes.value.data || []);
        if (cRes.status === 'fulfilled') setSocietyCoaches(cRes.value.data || []);
        if (kRes.status === 'fulfilled') setCollaboratori(kRes.value.data || []);
        if (drRes.status === 'fulfilled') {
          const data = drRes.value.data || {};
          setIsDualRoleCoach(!!(data.is_dual_role && data.coach));
        }
      } catch (e) {
        // ignore: widget è opzionale
      }
    })();
    return () => { cancelled = true; };
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

  // 🐛 FIX: il backend salva `month` come numero (1-12); il codice legacy lo
  // confrontava con la stringa italiana "Settembre" → mai match → tutti i mesi
  // firmati apparivano come "Tocca per firmare". Ora match flessibile.
  const matchReceiptMonth = (r: any, monthInt: number): boolean => {
    const monthName = MONTH_NAMES_FULL[monthInt];
    if (typeof r.month === 'number') return r.month === monthInt;
    if (typeof r.month === 'string') return r.month === monthName;
    if (typeof r.month_name === 'string') return r.month_name === monthName;
    return false;
  };
  const isReceiptSignedFlag = (r: any) => r?.signed === true || r?.receipt_signed === true;

  const isReceiptSigned = (year: number, month: number) => {
    return receipts.some(r => r.year === year && matchReceiptMonth(r, month) && isReceiptSignedFlag(r));
  };

  const getReceiptSignedDate = (year: number, month: number) => {
    const receipt = receipts.find(r => r.year === year && matchReceiptMonth(r, month) && isReceiptSignedFlag(r));
    return receipt?.signed_date || receipt?.receipt_signed_date;
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
    // Check if the athlete is a minor (read-only mode)
    const isMinor = !!(profile as any)?.is_minor;

    // Vista per atleti "quota" (non compensati)
    return (
      <>
      <OnboardingTutorial role="athlete" steps={ATHLETE_STEPS} />
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />}
      >
        <View style={styles.header}>
          {/* BRANDING_WRAPPED */}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <SocietyBranding />
            <Text style={styles.headerTitle}>Il Mio Profilo</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* 🆕 Switch dual-role: Atleta ↔ Coach (visibile solo se atleta promosso) */}
        <SwitchAccountButton />
        
        {/* Compact Profile Header */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }} data-testid="athlete-name">Ciao {profile?.first_name || (profile?.full_name || '').split(' ')[0] || 'Atleta'}! 👋</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                Squadra: <Text style={{ fontWeight: '600', color: '#E53935' }}>{profile?.team_name || 'Non assegnata'}</Text>
              </Text>
              {profile?.email && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="mail" size={14} color="#999" />
                  <Text style={{ marginLeft: 4, color: '#999', fontSize: 12 }}>{profile.email}</Text>
                </View>
              )}
            </View>
            <View style={{ 
              backgroundColor: isMinor ? '#FFF3E0' : profile?.status === 'trial' ? '#FFF3E0' : profile?.status === 'pending_trial' ? '#F3E5F5' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '#E3F2FD' : '#E8F5E9', 
              paddingHorizontal: 10, 
              paddingVertical: 5, 
              borderRadius: 12
            }}>
              <Text style={{ 
                color: isMinor ? '#FF9800' : profile?.status === 'trial' ? '#FF9800' : profile?.status === 'pending_trial' ? '#7B1FA2' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? '#1976D2' : '#4CAF50',
                fontWeight: '600',
                fontSize: 12
              }} data-testid="athlete-status">
                {isMinor ? 'Minorenne' : profile?.status === 'trial' ? 'Periodo di Prova' : profile?.status === 'pending_trial' ? 'In Attesa Prova' : (profile?.status === 'pending_privacy' && !profile?.privacy_accepted) ? 'Firma Privacy' : 'Attivo'}
              </Text>
            </View>
          </View>

          {/* Minor Read-Only Banner */}
          {isMinor && (
            <View style={{ backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#FFB74D' }} data-testid="minor-readonly-banner">
              <Text style={{ color: '#E65100', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                Account in sola lettura - I tuoi dati sono gestiti dal genitore/tutore
              </Text>
            </View>
          )}
          
          {/* Pending Privacy Banner */}
          {!isMinor && profile?.status === 'pending_privacy' && !profile?.privacy_accepted && (
            <TouchableOpacity 
              style={{ backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#1976D2' }}
              onPress={handleStayAndSignPrivacy}
            >
              <Text style={{ color: '#1976D2', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                Devi accettare la Privacy per continuare - Clicca qui
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Pending Trial - Dichiarazione di prova (stile identico al minore - VIOLA) */}
          {/* 🆕 22/02/2026 — Nascosto per atleti PRO (compensated): non firmano prova, sono scelti dalla società */}
          {!isMinor && profile?.athlete_type !== 'compensated' && (profile?.status === 'pending_trial' || (profile?.status === 'trial' && !(profile as any)?.trial_document_generated)) && (
            <View style={{ marginTop: 16 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 }}>Stato</Text>
                
                <View style={{ backgroundColor: '#F3E5F5', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#9C27B0', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#7B1FA2', marginBottom: 4 }}>In attesa di inizio prova</Text>
                  {(profile as any)?.trial_document_generated ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                      <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>Dichiarazione di prova firmata</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, color: '#6A1B9A', lineHeight: 18 }}>
                      Il periodo di prova inizier{'à'} automaticamente nel momento in cui registrerai la tua prima presenza in palestra, con la scansione del tuo codice QR da parte del coach.{'\n'}Per poter partecipare, dovrai avere la dichiarazione di prova firmata.{'\n'}Per evitare dimenticanze, ti consigliamo di firmare la dichiarazione sin da ora.
                    </Text>
                  )}
                </View>
                
                {!(profile as any)?.trial_document_generated && (
                  Platform.OS === 'web' ? (
                    <a
                      href="/athlete/sign-trial"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EDE7F6', paddingTop: 12, paddingBottom: 12, borderRadius: 10, textDecoration: 'none', cursor: 'pointer' }}
                      data-testid="sign-trial-doc-btn"
                    >
                      <Text style={{ fontWeight: '600', color: '#7B1FA2', fontSize: 14 }}>Firma Dichiarazione di Prova</Text>
                    </a>
                  ) : (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDE7F6', paddingVertical: 12, borderRadius: 10, gap: 8 }}
                      onPress={() => router.push('/athlete/sign-trial')}
                      data-testid="sign-trial-doc-btn"
                    >
                      <Ionicons name="create" size={18} color="#7B1FA2" />
                      <Text style={{ fontWeight: '600', color: '#7B1FA2', fontSize: 14 }}>Firma Dichiarazione di Prova</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}

          {/* Trial info + actions (copiato dal flusso minore) */}
          {!isMinor && profile?.status === 'trial' && (() => {
            const trialHasStarted = !!(profile as any)?.trial_start_date;
            return (
            <View style={{ marginTop: 16 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 }}>Stato</Text>
                
                {/* In prova ATTIVA (BLU) */}
                {trialHasStarted && trialStatus && !trialStatus.trial_expired && !trialStatus.trial_warning && (
                  <>
                    <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#1976D2', marginBottom: 12 }} data-testid="trial-status-active">
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1565C0', marginBottom: 8 }}>Periodo di prova attivo</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="calendar-outline" size={16} color="#1976D2" />
                        <Text style={{ fontSize: 13, color: '#333' }}>
                          Inizio: <Text style={{ fontWeight: '700' }}>{(profile as any).trial_start_date ? new Date((profile as any).trial_start_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</Text>
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="calendar" size={16} color="#1976D2" />
                        <Text style={{ fontSize: 13, color: '#333' }}>
                          Scadenza: <Text style={{ fontWeight: '700' }}>{(profile as any).trial_end_date ? new Date((profile as any).trial_end_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</Text>
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
                      {(profile as any).trial_document_generated && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>Dichiarazione di prova firmata</Text>
                        </View>
                      )}
                    </View>
                    {/* Bottoni Resta / Lascia */}
                    <View style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#333', textAlign: 'center', marginBottom: 8, fontWeight: '500' }}>
                        Vuoi terminare il periodo di prova?
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={{ flex: 1, borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' }}
                          onPress={async () => {
                            const confirm = Platform.OS === 'web'
                              ? window.confirm('Confermi di voler restare nella società?')
                              : await new Promise<boolean>((resolve) => {
                                  Alert.alert('Resta nella Società', 'Confermi di voler restare?', [
                                    { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                                    { text: 'Conferma', onPress: () => resolve(true) }
                                  ]);
                                });
                            if (confirm) {
                              try {
                                const res = await api.post('/athletes/withdraw-trial-stay');
                                if (res.data?.action === 'activated') {
                                  showAlert('Benvenuto!', 'Sei stato attivato nella società!');
                                  loadData();
                                } else {
                                  showAlert('Successo', 'Richiesta inviata.');
                                  loadData();
                                }
                              } catch (error: any) {
                                showAlert('Errore', error.response?.data?.detail || 'Errore');
                              }
                            }
                          }}
                          data-testid="resta-societa-btn"
                        >
                          <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                            Interrompi la prova e resta nella Società
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFEBEE' }}
                          onPress={async () => {
                            const confirm = Platform.OS === 'web'
                              ? window.confirm('ATTENZIONE: Questa azione cancellerà definitivamente tutti i tuoi dati. Sei sicuro?')
                              : await new Promise<boolean>((resolve) => {
                                  Alert.alert('Lascia la Società', 'ATTENZIONE: Tutti i tuoi dati verranno cancellati.\n\nSei sicuro?', [
                                    { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                                    { text: 'Cancella Tutto', style: 'destructive', onPress: () => resolve(true) }
                                  ]);
                                });
                            if (confirm) {
                              try {
                                await api.post('/athletes/withdraw-trial-leave');
                                showAlert('Account Eliminato', 'Tutti i tuoi dati sono stati cancellati.');
                                handleLogout();
                              } catch (error: any) {
                                showAlert('Errore', error.response?.data?.detail || 'Errore');
                              }
                            }
                          }}
                          data-testid="lascia-societa-btn"
                        >
                          <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* WARNING - Ultimo allenamento o ultimo giorno (ARANCIONE) */}
                {trialHasStarted && trialStatus && trialStatus.trial_warning && !trialStatus.trial_expired && (
                  <>
                    <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#FF6F00', marginBottom: 12 }} data-testid="trial-status-warning">
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="warning" size={18} color="#E65100" />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#E65100' }}>
                          {trialStatus.sessions_remaining <= 1 ? 'Ultimo allenamento disponibile' : 'Ultimi giorni di prova'}
                        </Text>
                      </View>
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
                    <View style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#333', textAlign: 'center', marginBottom: 8, fontWeight: '500' }}>
                        Vuoi terminare il periodo di prova?
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={{ flex: 1, borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' }}
                          onPress={async () => {
                            const confirm = Platform.OS === 'web'
                              ? window.confirm('Confermi di voler restare nella società?')
                              : await new Promise<boolean>((resolve) => {
                                  Alert.alert('Resta nella Società', 'Confermi?', [
                                    { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                                    { text: 'Conferma', onPress: () => resolve(true) }
                                  ]);
                                });
                            if (confirm) {
                              try {
                                const res = await api.post('/athletes/withdraw-trial-stay');
                                if (res.data?.action === 'activated') {
                                  showAlert('Benvenuto!', 'Sei stato attivato nella società!');
                                } else {
                                  showAlert('Successo', 'Richiesta inviata.');
                                }
                                loadData();
                              } catch (error: any) {
                                showAlert('Errore', error.response?.data?.detail || 'Errore');
                              }
                            }
                          }}
                          data-testid="resta-societa-warning-btn"
                        >
                          <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Interrompi la prova e resta nella Società</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFEBEE' }}
                          onPress={async () => {
                            const confirm = Platform.OS === 'web'
                              ? window.confirm('ATTENZIONE: Tutti i tuoi dati verranno cancellati. Sei sicuro?')
                              : await new Promise<boolean>((resolve) => {
                                  Alert.alert('Lascia la Società', 'Tutti i dati cancellati. Sei sicuro?', [
                                    { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                                    { text: 'Cancella Tutto', style: 'destructive', onPress: () => resolve(true) }
                                  ]);
                                });
                            if (confirm) {
                              try {
                                await api.post('/athletes/withdraw-trial-leave');
                                showAlert('Account Eliminato', 'Tutti i tuoi dati sono stati cancellati.');
                                handleLogout();
                              } catch (error: any) {
                                showAlert('Errore', error.response?.data?.detail || 'Errore');
                              }
                            }
                          }}
                          data-testid="lascia-societa-warning-btn"
                        >
                          <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* SCADUTO (ROSSO) */}
                {trialHasStarted && trialStatus && trialStatus.trial_expired && (
                  <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#F44336', marginBottom: 12 }} data-testid="trial-status-expired">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="close-circle" size={18} color="#C62828" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#C62828' }}>Periodo di prova terminato</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#555', lineHeight: 18, marginBottom: 8 }}>
                      Per proseguire l'attivita sportiva, avvia la procedura di iscrizione.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={{ flex: 1, borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' }}
                        onPress={async () => {
                          const confirm = Platform.OS === 'web'
                            ? window.confirm('Confermi di voler restare nella società?')
                            : await new Promise<boolean>((resolve) => {
                                Alert.alert('Resta nella Società', 'Confermi?', [
                                  { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                                  { text: 'Conferma', onPress: () => resolve(true) }
                                ]);
                              });
                          if (confirm) {
                            try {
                              const res = await api.post('/athletes/withdraw-trial-stay');
                              if (res.data?.action === 'activated') {
                                showAlert('Benvenuto!', 'Sei stato attivato nella società!');
                              } else {
                                showAlert('Successo', 'Richiesta inviata.');
                              }
                              loadData();
                            } catch (error: any) {
                              showAlert('Errore', error.response?.data?.detail || 'Errore');
                            }
                          }
                        }}
                        data-testid="resta-societa-expired-btn"
                      >
                        <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Interrompi la prova e resta nella Società</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, borderWidth: 2, borderColor: '#C62828', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFEBEE' }}
                        onPress={async () => {
                          const confirm = Platform.OS === 'web'
                            ? window.confirm('ATTENZIONE: Tutti i tuoi dati verranno cancellati. Sei sicuro?')
                            : await new Promise<boolean>((resolve) => {
                                Alert.alert('Lascia la Società', 'Tutti i dati cancellati. Sei sicuro?', [
                                  { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                                  { text: 'Cancella Tutto', style: 'destructive', onPress: () => resolve(true) }
                                ]);
                              });
                          if (confirm) {
                            try {
                              await api.post('/athletes/withdraw-trial-leave');
                              showAlert('Account Eliminato', 'Tutti i tuoi dati sono stati cancellati.');
                              handleLogout();
                            } catch (error: any) {
                              showAlert('Errore', error.response?.data?.detail || 'Errore');
                            }
                          }
                        }}
                        data-testid="lascia-societa-expired-btn"
                      >
                        <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Lascia {societyName || 'la Società'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Non ancora iniziato - senza trialStatus */}
                {!trialHasStarted && (
                  <View style={{ backgroundColor: '#F3E5F5', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#9C27B0' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#7B1FA2', marginBottom: 4 }}>In attesa di inizio prova</Text>
                    <Text style={{ fontSize: 12, color: '#6A1B9A', lineHeight: 18 }}>
                      La prova inizier{'à'} alla prima scansione QR del coach.
                    </Text>
                  </View>
                )}
              </View>
            </View>
            );
          })()}
        </View>
        
        {/* 🆕 24/02/2026 — QR / Cronologia / Pagamenti / Coach / Orari / Presenze / Dati Personali /
            Documenti / Mappa Palestre SPOSTATI nelle tab Anagrafica / Pagamenti / Presenze */}
        
        {/* 🆕 27/02/2026 — Certificato Medico SPOSTATO nella tab Anagrafica. Mappa Palestre qui (richiesta utente). */}
        <TouchableOpacity
          style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
          onPress={() => router.push('/palestre')}
          data-testid="athlete-palestre-btn-dafare"
        >
          <Ionicons name="map" size={26} color="#43A047" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>🏟️ Mappa Palestre</Text>
            <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Palazzetti dei campionati</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        {/* 🆕 24/02/2026 — Dati Personali / Documenti / Mappa Palestre SPOSTATI nella tab Anagrafica */}
        
        {/* Privacy status - only show if NOT yet accepted (to prompt signing) */}
        {!isMinor && !profile?.privacy_accepted && (
        <TouchableOpacity 
          style={[styles.menuItem, { backgroundColor: '#FFF3E0' }]} 
          data-testid="privacy-status"
          onPress={() => {
            handleStayAndSignPrivacy();
          }}
        >
          <Ionicons 
            name="alert-circle" 
            size={22} 
            color="#FF9800" 
          />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Privacy</Text>
            <Text style={styles.menuItemSubtitle}>Da accettare - Clicca per firmare</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FF9800" />
        </TouchableOpacity>
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
    <View style={{ flex: 1 }}>
    <OnboardingTutorial role="athlete" steps={ATHLETE_STEPS} />
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#B8860B']} />}
    >
      {/* Header */}
      <View style={styles.header}>
        {/* BRANDING_WRAPPED */}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <SocietyBranding />
            <Text style={styles.headerTitle}>Il Mio Profilo</Text>
          </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <AthleteTabBar />

      {/* 🆕 Switch dual-role: Atleta PRO ↔ Coach (visibile solo se atleta promosso) */}
      <SwitchAccountButton />

      {/* 🚫 26/06/2026 — Banner "Vai a Compensi Sportivi" RIMOSSO: duplicava il bottone
          "Compensi" già presente in alto nella tab navigation. */}

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>
            {profile.first_name?.charAt(0) || profile.full_name?.charAt(0) || 'A'}
          </Text>
        </View>
        <Text style={styles.profileName}>{profile.full_name}</Text>
        {/* 🚫 16/06/2026 — Compenso mensile + Periodo Contratto SPOSTATI nella pagina
            "Dati Personali" (/athlete/profile) per non avere info sensibili in bella vista. */}
      </View>

      {/* 🆕 28/06/2026 — Banner Privacy per atleti PRO/COMPENSATED
          (bug fix: prima compariva solo per atleti QUOTA, gli atleti PRO non venivano
          mai sollecitati a firmare la privacy dopo aver completato l'anagrafica). */}
      {!profile?.privacy_accepted && (
        <TouchableOpacity
          style={{
            backgroundColor: '#FFF3E0',
            marginHorizontal: 16,
            marginBottom: 16,
            padding: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#FF9800',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
          onPress={handleStayAndSignPrivacy}
          data-testid="pro-privacy-banner"
        >
          <Ionicons name="alert-circle" size={24} color="#FF9800" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#E65100', fontWeight: '700', fontSize: 14 }}>
              Firma la Privacy GDPR
            </Text>
            <Text style={{ color: '#E65100', fontSize: 12, marginTop: 2 }}>
              Devi firmare l'informativa privacy per attivare il tuo account
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FF9800" />
        </TouchableOpacity>
      )}

      {/* 🆕 29/06/2026 — Banner richieste cancellazione documenti firmati
          (parità Coach/Collaboratore). L'admin NON può cancellare unilateralmente:
          l'atleta deve approvare o rifiutare ogni richiesta. */}
      {pendingDeletions.length > 0 && (
        <View
          style={{ marginHorizontal: 16, marginBottom: 16, padding: 12, backgroundColor: '#FFF3E0', borderLeftWidth: 4, borderLeftColor: '#FF9800', borderRadius: 8 }}
          data-testid="athlete-pending-deletions-banner"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="alert-circle" size={20} color="#E65100" />
            <Text style={{ marginLeft: 8, fontWeight: '700', color: '#E65100', flex: 1 }}>
              Richieste di cancellazione documenti ({pendingDeletions.length})
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
            L'amministratore ha richiesto la cancellazione di documenti firmati. Devi autorizzare o rifiutare:
          </Text>
          {pendingDeletions.map((req: any) => (
            <View key={req.id} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 10, marginBottom: 6 }}>
              <Text style={{ fontWeight: '600', fontSize: 13, marginBottom: 2 }}>{req.document_title}</Text>
              <Text style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                Richiesta da: {req.requested_by_name}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleDeletionResponse(req.id, true)}
                  disabled={processingDeletion === req.id}
                  style={{ flex: 1, backgroundColor: '#E74C3C', paddingVertical: 8, borderRadius: 6, alignItems: 'center', opacity: processingDeletion === req.id ? 0.5 : 1 }}
                  data-testid={`athlete-approve-deletion-${req.id}`}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Autorizza cancellazione</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletionResponse(req.id, false)}
                  disabled={processingDeletion === req.id}
                  style={{ flex: 1, backgroundColor: '#27AE60', paddingVertical: 8, borderRadius: 6, alignItems: 'center', opacity: processingDeletion === req.id ? 0.5 : 1 }}
                  data-testid={`athlete-reject-deletion-${req.id}`}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Rifiuta</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Prossimi Impegni — Trainings + Matches con supporto annullamento/modifica */}
      {(commitments.today.length + commitments.tomorrow.length + commitments.day_after.length + commitments.upcoming.length > 0) && (
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#000' }}>📅 Prossimi Impegni</Text>
          {(() => {
            const fmt = (offset: number) => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const days = ['DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO'];
              return `${dd}/${mm} - ${days[d.getDay()]}`;
            };
            return [
              { key: 'today', label: `OGGI ${fmt(0)}` },
              { key: 'tomorrow', label: `DOMANI ${fmt(1)}` },
              { key: 'day_after', label: `DOPODOMANI ${fmt(2)}` },
              { key: 'upcoming', label: 'IMPEGNI SUCCESSIVI' },
            ];
          })().map(section => {
            const items = (commitments as any)[section.key] as any[];
            if (!items || items.length === 0) return null;
            const isUpcoming = section.key === 'upcoming';
            const isCollapsed = isUpcoming && !showUpcomingAthlete;
            return (
              <View key={section.key} style={{ marginBottom: 10 }}>
                {isUpcoming ? (
                  <TouchableOpacity
                    onPress={() => setShowUpcomingAthlete(!showUpcomingAthlete)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}
                    data-testid="athlete-upcoming-toggle"
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#666' }}>{section.label} ({items.length})</Text>
                    <Ionicons name={showUpcomingAthlete ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 6 }}>{section.label}</Text>
                )}
                {!isCollapsed && items.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 8 }}>
                    <Ionicons name={item.type === 'training' ? 'fitness' : 'trophy'} size={16} color={item.type === 'training' ? '#007AFF' : '#FF9500'} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        {item.as_role && (
                          <View style={{
                            paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6,
                            backgroundColor: item.as_role === 'atleta' ? '#E3F2FD' : '#FFF3E0',
                            borderWidth: 1, borderColor: item.as_role === 'atleta' ? '#1565C0' : '#F57C00',
                          }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: item.as_role === 'atleta' ? '#0D47A1' : '#E65100' }}>
                              {item.as_role === 'atleta' ? 'ATL' : 'COACH'}
                            </Text>
                          </View>
                        )}
                        <Text style={[{ fontSize: 14, fontWeight: '600' }, item.cancelled && { textDecorationLine: 'line-through', color: '#888' }]}>
                          {item.type === 'training' ? `Allenamento ${item.team_name}${item.modified ? ' ✏️ Variato' : ''}` : (item.title || `${item.team_name || ''} ${item.opponent ? `vs ${item.opponent}` : ''}`.trim())}
                        </Text>
                      </View>
                      {section.key === 'upcoming' && (
                        <Text style={{ fontSize: 12, color: '#666' }}>📅 {item.date} - {item.day_name}</Text>
                      )}
                      {item.cancelled ? (
                        item.reason === 'Gara' ? (
                          <>
                            <Text style={{ color: '#C0392B', fontWeight: '700', fontSize: 13, marginTop: 2 }}>
                              ❌ ANNULLATO {item.time_start ? `(${item.time_start} - ${item.time_end})` : ''}
                            </Text>
                            <Text style={{ color: '#1565C0', fontWeight: '600', fontSize: 12, marginTop: 2 }}>c'è una gara</Text>
                          </>
                        ) : (
                          <>
                            <Text style={{ color: '#C0392B', fontWeight: '700', fontSize: 13, marginTop: 2 }}>
                              ❌ ANNULLATO {item.time_start ? `(${item.time_start} - ${item.time_end})` : ''}
                            </Text>
                            <TouchableOpacity onPress={() => {
                              const msg = item.reason ? `Allenamento annullato.\nMotivo: ${item.reason}` : 'Allenamento annullato.';
                              if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Annullato', msg); }
                            }}>
                              <Text style={{ color: '#1565C0', fontWeight: '600', fontSize: 12, marginTop: 2, textDecorationLine: 'underline' }}>tocca per il motivo</Text>
                            </TouchableOpacity>
                          </>
                        )
                      ) : (
                        <Text style={[{ fontSize: 13, color: '#444' }, item.modified && { color: '#D35400', fontWeight: '700', backgroundColor: '#FFF3E0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }]}>
                          {item.type === 'training' ? `${item.time_start} - ${item.time_end}` : `ore ${item.time}`} • {item.venue}
                        </Text>
                      )}
                      {item.modified && item.reason && (
                        <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#D35400' }}>Motivo: {item.reason}</Text>
                      )}
                      {item.meeting_time && !item.cancelled && (
                        <Text style={{ fontSize: 12, color: '#FF9500', fontWeight: '600' }}>⚠️ Ritrovo: {item.meeting_time}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}


      {/* Squadra Card (ex "Dati Iscrizione") */}
      <View style={styles.iscrizioneCard}>
        <Text style={styles.iscrizioneCardTitle}>Squadra</Text>
        
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

      {/* 🆕 26/06/2026 — Staff della Squadra (Dirigenti + Coach + Collaboratori)
          Se l'atleta è DUAL-ROLE coach, mostra TUTTO lo staff della società senza filtro;
          altrimenti filtra per il team_id dell'atleta (gli assegnati alla squadra). */}
      {(() => {
        const myTeamId = profile?.team_id;
        const showAll = isDualRoleCoach;
        const filterAssigned = (list: any[]) => {
          if (showAll) return list;
          if (!myTeamId) return [];
          return list.filter((u: any) => Array.isArray(u.assigned_teams) && u.assigned_teams.includes(myTeamId));
        };
        const dirFiltered = filterAssigned(dirigenti || []);
        const coachFiltered = filterAssigned(societyCoaches || []);
        const colFiltered = filterAssigned(collaboratori || []);
        const hasAny = dirFiltered.length + coachFiltered.length + colFiltered.length > 0;
        if (!hasAny) return null;

        const renderContact = (u: any, palette: string[], roleLabel?: string) => {
          const fullName = u.full_name || '';
          const initials = fullName ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
          const colorIndex = fullName ? fullName.charCodeAt(0) % palette.length : 0;
          const bgColor = palette[colorIndex];
          return (
            <View key={u.id} style={athleteStaffStyles.card} data-testid={`staff-contact-${u.id}`}>
              <View style={[athleteStaffStyles.avatar, { backgroundColor: bgColor }]}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={athleteStaffStyles.name}>{fullName}</Text>
                {(u.qualification || u.activity_type || roleLabel) ? (
                  <Text style={athleteStaffStyles.role}>{u.qualification || u.activity_type || roleLabel}</Text>
                ) : null}
                {u.email ? <Text style={athleteStaffStyles.email}>{u.email}</Text> : null}
                {u.phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity onPress={() => Platform.OS === 'web' ? window.open(`tel:${u.phone}`) : null}>
                      <Text style={athleteStaffStyles.phone}>{u.phone}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={athleteStaffStyles.waBtn}
                      onPress={() => {
                        const phone = u.phone.replace(/\D/g, '');
                        const phoneWithCountry = phone.startsWith('39') ? phone : `39${phone}`;
                        const url = `https://wa.me/${phoneWithCountry}`;
                        if (Platform.OS === 'web') window.open(url, '_blank');
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={12} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          );
        };

        return (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: '#1565C0' }}>
              <Text style={athleteStaffStyles.title}>
                {showAll ? '🏢 Staff della Società' : '🏐 Staff della tua Squadra'}
              </Text>
              <Text style={athleteStaffStyles.subtitle}>
                {showAll ? 'Tutto lo staff (dual-role)' : 'Allenatori, dirigenti e collaboratori assegnati alla tua squadra'}
              </Text>

              {coachFiltered.length > 0 && (
                <CollapsibleStaffSection
                  label="Allenatori"
                  count={coachFiltered.length}
                  testId="staff-section-allenatori"
                >
                  {coachFiltered.map((c: any) => renderContact(c, ['#E65100', '#1565C0', '#2E7D32', '#6A1B9A', '#00838F'], 'Allenatore'))}
                </CollapsibleStaffSection>
              )}
              {dirFiltered.length > 0 && (
                <CollapsibleStaffSection
                  label="Dirigenti"
                  count={dirFiltered.length}
                  testId="staff-section-dirigenti"
                >
                  {dirFiltered.map((d: any) => renderContact(d, ['#1565C0', '#6A1B9A', '#00838F', '#2E7D32', '#D84315'], 'Dirigente'))}
                </CollapsibleStaffSection>
              )}
              {colFiltered.length > 0 && (
                <CollapsibleStaffSection
                  label="Collaboratori"
                  count={colFiltered.length}
                  testId="staff-section-collaboratori"
                >
                  {colFiltered.map((c: any) => renderContact(c, ['#00838F', '#2E7D32', '#6A1B9A', '#D84315', '#4527A0'], 'Collaboratore'))}
                </CollapsibleStaffSection>
              )}
            </View>
          </View>
        );
      })()}

      {/* 🚫 23/02/2026 — Link "Dati Personali" RIMOSSO da fondo pagina:
          esiste già la sezione apposita /athlete/profile raggiungibile dall'header. */}

      {/* 🚫 15/06/2026 — Yearly Breakdown + Riepilogo Quietanze RIMOSSI da qui:
          duplicavano le info già presenti nella pagina /athlete/compensation
          (sezione "Calcolo per Anno Solare" + "Quietanze Mensili"). */}

      {/* 🚫 16/06/2026 — Dati Bancari SPOSTATI nella pagina "Dati Personali"
          (/athlete/profile) per non avere info sensibili in bella vista. */}

      {/* 🆕 29/06/2026 — Mappa Palestre (parità con Coach/Admin):
          fondo pagina Da Fare per Atleti 18+ PRO. */}
      <TouchableOpacity
        style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
        onPress={() => router.push('/palestre')}
        data-testid="athlete-pro-palestre-btn-dafare"
      >
        <Ionicons name="map" size={26} color="#43A047" />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>🏟️ Mappa Palestre</Text>
          <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Palazzetti dei campionati</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#999" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* Trial document signing is now on /athlete/sign-trial page */}

    {/* 🆕 28/06/2026 — Privacy Modal anche per atleti PRO/COMPENSATED
        (bug fix: prima questa modale era disponibile solo nel ramo QUOTA). */}
    <GDPRPrivacyModal
      visible={showPrivacyModal}
      onClose={() => setShowPrivacyModal(false)}
      onSign={async (success: boolean, documentId?: string) => {
        if (!success) return;
        try {
          if (profile?.status === 'trial') {
            await api.post('/athletes/withdraw-trial-stay');
          }
          await api.patch(`/athletes/${profile?.id}`, {
            status: 'active',
            privacy_accepted: true,
            privacy_accepted_date: new Date().toISOString(),
            privacy_pdf_url: documentId ? `/api/documents/signed/${documentId}/pdf` : null,
          });
          try {
            await api.post('/auth/accept-privacy');
          } catch (e) {
            console.log('accept-privacy backend call failed (non-blocking)', e);
          }
          setShowPrivacyModal(false);
          await loadData();
        } catch (e: any) {
          console.error('Error saving privacy acceptance:', e);
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

    </View>
  );
}


// 🆕 02/07/2026 — Sezione staff collassabile (accordion) per Da Fare atleta
const CollapsibleStaffSection: React.FC<{ label: string; count: number; children: any; testId?: string }> = ({ label, count, children, testId }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
        data-testid={testId}
      >
        <Text style={athleteStaffStyles.sectionLabel}>
          {label} <Text style={{ color: '#999', fontWeight: '400', fontSize: 11 }}>({count})</Text>
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
      </TouchableOpacity>
      {open && <View style={{ marginTop: 8 }}>{children}</View>}
    </View>
  );
};

// 🆕 26/06/2026 — Stili widget "Staff" su Da Fare atleta
const athleteStaffStyles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: '#0D47A1' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#37474F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F8FA', borderRadius: 10, padding: 10, marginBottom: 8, gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: '#111' },
  role: { fontSize: 12, color: '#6A1B9A', fontWeight: '600' },
  email: { fontSize: 11, color: '#555' },
  phone: { fontSize: 12, color: '#1565C0', fontWeight: '700' },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#25D366', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});


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
    backgroundColor: '#1565C0',
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
    backgroundColor: '#1565C0',
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
    backgroundColor: '#1565C0',
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
  compensationQuickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1565C0',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  compensationQuickLinkIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compensationQuickLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFD700',
  },
  compensationQuickLinkSubtitle: {
    fontSize: 12,
    color: '#E3F2FD',
    marginTop: 2,
  },
});
