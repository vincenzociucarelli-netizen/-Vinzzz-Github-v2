import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import SocietyBranding from '../../src/components/SocietyBranding';
import SignaturePadInline from '../../src/components/SignaturePadInline';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
import { handleAnagraficaError } from '../../src/utils/anagraficaError';
import ExternalCompensationStep from '../../src/components/ExternalCompensationStep';
const MONTH_NAMES = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

// Helper to compare month values - handles both number and legacy string formats
const matchesMonth = (recordMonth: number | string, targetMonth: number): boolean => {
  if (typeof recordMonth === 'number') {
    return recordMonth === targetMonth;
  }
  // Legacy: month stored as string name (e.g., "Settembre")
  const monthIndex = MONTH_NAMES.indexOf(recordMonth);
  return monthIndex === targetMonth;
};

// Helper to format ISO date string to DD/MM/YYYY
const formatContractDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Handle ISO format: "2025-09-01T00:00:00+00:00" or simple "2025-09-01"
  const cleanDate = dateStr.split('T')[0]; // Remove time part
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr; // Return as-is if unexpected format
};

interface CompensationRecord {
  id: string;
  month: number | string;  // Can be number (1-12) or string ("Gennaio", etc.)
  year: number;
  amount_gross?: number;
  amount_net?: number;
  amount?: number;
  deductions?: number;
  received: boolean;
  received_date?: string;
  receipt_signed: boolean;  // Backend saves as receipt_signed for coaches
  receipt_signed_date?: string;
  receipt_document_id?: string;
  exceeded_5000: boolean;
  exceeded_15000: boolean;
}

interface CoachProfile {
  id: string;
  full_name: string;
  fiscal_code?: string;
  monthly_compensation: number;
  compensation_accepted: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  other_annual_compensation?: number; // Prior compensation
}

interface ThresholdStatus {
  coach_id: string;
  year: number;
  monthly_compensation: number;
  yearly_total: number;
  thresholds: {
    '5000': {
      threshold: number;
      warning_at: number;
      needs_warning: boolean;
      needs_declaration: boolean;
      declaration_signed: boolean;
      declaration_date?: string;
    };
    '15000': {
      threshold: number;
      warning_at: number;
      needs_warning: boolean;
      needs_declaration: boolean;
      declaration_signed: boolean;
      declaration_date?: string;
    };
  };
  is_blocked: boolean;
  block_reason?: string;
}

export default function AthleteCompensation() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [records, setRecords] = useState<CompensationRecord[]>([]);
  // Compensi esterni annuali dichiarati dall'utente per il calcolo proiettato delle soglie
  const [externalByYear, setExternalByYear] = useState<{ [year: number]: number }>({});
  // External Compensation pre-step (auto-dichiarazione altre ASD/SSD)
  const [extStepVisible, setExtStepVisible] = useState(false);
  const [extPendingMonth, setExtPendingMonth] = useState<number | null>(null);
  const [extPendingYear, setExtPendingYear] = useState<number | null>(null);
  const [extDeclaration, setExtDeclaration] = useState<{ amount: number; none: boolean } | null>(null);
  const [yearlyTotal, setYearlyTotal] = useState(0);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  
  // Contract dates
  const [contractStartYear, setContractStartYear] = useState<number | null>(null);
  const [contractEndYear, setContractEndYear] = useState<number | null>(null);
  const [contractStartMonth, setContractStartMonth] = useState<number | null>(null);
  const [contractEndMonth, setContractEndMonth] = useState<number | null>(null);
  const [priorCompensation, setPriorCompensation] = useState(0);
  
  // Threshold status
  const [thresholdStatus, setThresholdStatus] = useState<ThresholdStatus | null>(null);
  const [thresholdStatus2026, setThresholdStatus2026] = useState<ThresholdStatus | null>(null);
  
  // Signature modal for receipts - consolidated into a single state object to prevent re-renders
  const [signatureModalState, setSignatureModalState] = useState<{
    visible: boolean;
    month: number | null;
    year: number | null;
    signature: string | null;
  }>({
    visible: false,
    month: null,
    year: null,
    signature: null,
  });
  const [signing, setSigning] = useState(false);
  
  // Convenience getters for backward compatibility
  const showSignatureModal = signatureModalState.visible;
  const selectedMonth = signatureModalState.month;
  const selectedYear = signatureModalState.year || currentYear;
  const signature = signatureModalState.signature;
  
  // Helper functions to update signature modal
  const openSignatureModal = (month: number, year: number) => {
    setSignatureModalState({
      visible: true,
      month,
      year,
      signature: null,
    });
  };
  
  const closeSignatureModal = () => {
    setSignatureModalState(prev => ({ ...prev, visible: false }));
  };
  
  const setSignature = (sig: string | null) => {
    setSignatureModalState(prev => ({ ...prev, signature: sig }));
  };
  
  // Declaration modal
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [declarationType, setDeclarationType] = useState<'5000' | '15000'>('5000');
  const [declarationAmount, setDeclarationAmount] = useState(0);
  const [declarationSignature, setDeclarationSignature] = useState<string | null>(null);
  const [signingDeclaration, setSigningDeclaration] = useState(false);
  
  const signatureRef = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load profile
      const profileRes = await api.get('/auth/me');
      setProfile(profileRes.data);
      
      // Parse contract dates
      let startYear = null;
      let endYear = null;
      if (profileRes.data.contract_start_date) {
        const startParts = profileRes.data.contract_start_date.split('-');
        if (startParts.length === 3) {
          startYear = parseInt(startParts[0]);
          setContractStartYear(startYear);
          setContractStartMonth(parseInt(startParts[1]));
        }
      }
      if (profileRes.data.contract_end_date) {
        const endParts = profileRes.data.contract_end_date.split('-');
        if (endParts.length === 3) {
          endYear = parseInt(endParts[0]);
          setContractEndYear(endYear);
          setContractEndMonth(parseInt(endParts[1]));
        }
      }
      
      // Set initial display year based on contract (show start year first if contract spans multiple years)
      // Only set if this is the first load (currentYear hasn't been changed by user)
      const now = new Date();
      const currentActualYear = now.getFullYear();
      if (startYear && endYear && startYear !== endYear) {
        // Multi-year contract - show the year that's most relevant
        if (startYear === currentActualYear || endYear === currentActualYear) {
          // If current year is part of contract, show it
          // Otherwise, show start year (where most records likely are)
          if (startYear <= currentActualYear && currentActualYear <= endYear) {
            setCurrentYear(currentActualYear);
          } else {
            setCurrentYear(startYear);
          }
        } else {
          // Contract is in the past or future, show start year
          setCurrentYear(startYear);
        }
      }
      
      // Set prior compensation
      setPriorCompensation(profileRes.data.other_annual_compensation || 0);
      
      // Load ALL compensation records (not filtered by year)
      // For athletes, profile.id is the athlete_id from /auth/me which is athlete_id mapping
      const athleteId = user?.athlete_id || user?.id;
      const recordsRes = await api.get(`/athletes/${athleteId}/compensation/receipts`);
      // Normalize athlete receipts to match the schema used by the UI
      // (UI was originally built for /coach/.../compensation which uses
      //  `receipt_signed` and `amount_gross` instead of `signed` and `amount`).
      const rawAthleteRecords: any[] = recordsRes.data || [];
      const normalizedRecords = rawAthleteRecords.map((r: any) => ({
        ...r,
        receipt_signed: r.receipt_signed !== undefined ? r.receipt_signed : !!r.signed,
        receipt_signed_date: r.receipt_signed_date || r.signed_date,
        amount_gross: r.amount_gross !== undefined ? r.amount_gross : r.amount,
        amount: r.amount !== undefined ? r.amount : r.amount_gross,
      }));
      console.log('Loaded athlete compensation records (normalized):', normalizedRecords);
      setRecords(normalizedRecords);
      
      // Calculate yearly total for current display year (including prior compensation for first year)
      const totalFromReceipts = normalizedRecords
        .filter((r: CompensationRecord) => r.year === currentYear && r.receipt_signed)
        .reduce((sum: number, r: CompensationRecord) => sum + (r.amount_gross || r.amount || 0), 0);
      
      // Add prior compensation if this is the first year of the contract
      const priorComp = profileRes.data.other_annual_compensation || 0;
      const total = (currentYear === startYear) ? totalFromReceipts + priorComp : totalFromReceipts;
      setYearlyTotal(total);
      
      // Athletes don't have a /threshold-status endpoint — soglie sono calcolate
      // lato client da getProjectedThresholdMonths() che già usa records + externalByYear.
      // Lasciamo thresholdStatus a null, evitando le chiamate non disponibili.
      setThresholdStatus(null);
      setThresholdStatus2026(null);
      
      // Carica i compensi esterni auto-dichiarati raggruppati per anno
      try {
        const extRes = await api.get('/me/external-compensations');
        const items: Array<{ year: number; amount: number }> = extRes.data?.items || [];
        const byYear: { [y: number]: number } = {};
        for (const it of items) {
          const y = Number(it.year);
          byYear[y] = (byYear[y] || 0) + Number(it.amount || 0);
        }
        setExternalByYear(byYear);
      } catch (err) {
        console.log('Error loading external compensations:', err);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Callback dal modal ExternalCompensationStep
  const handleExtConfirm = (data: { externalAmount: number; declaredNone: boolean }) => {
    setExtDeclaration({ amount: data.externalAmount, none: data.declaredNone });
    setExtStepVisible(false);
    if (extPendingMonth != null && extPendingYear != null) {
      handleOpenSignature(extPendingMonth, extPendingYear, { skipExtStep: true });
    }
  };

  const handleExtCancel = () => {
    setExtStepVisible(false);
    setExtPendingMonth(null);
    setExtPendingYear(null);
  };

  const handleOpenSignature = (month: number, year?: number, opts?: { skipExtStep?: boolean }) => {
    console.log('handleOpenSignature called:', { month, year, loading, thresholdStatus });
    
    // Prevent action if still loading
    if (loading) {
      console.log('Still loading, ignoring click');
      Alert.alert('Caricamento', 'Attendi il caricamento dei dati...');
      return;
    }
    
    const targetYear = year || currentYear;
    
    // CRONOLOGICAL ORDER CHECK: prevent signing a month if any prior contract
    // month is still unsigned (avoids out-of-order thresholds).
    if (contractStartYear && contractStartMonth) {
      const monthNamesLong = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      const endYear = contractEndYear || targetYear;
      const endMonth = contractEndMonth || 12;
      let blocked = false;
      for (let y = contractStartYear; y <= endYear && !blocked; y++) {
        const mStart = y === contractStartYear ? contractStartMonth : 1;
        const mEnd = y === endYear ? endMonth : 12;
        for (let m = mStart; m <= mEnd; m++) {
          if (y > targetYear || (y === targetYear && m >= month)) { blocked = true; break; }
          const isSigned = records.some(r => r.year === y && matchesMonth(r.month, m) && r.receipt_signed);
          if (!isSigned) {
            Alert.alert(
              'Ordine cronologico richiesto',
              `Devi prima firmare la quietanza di ${monthNamesLong[m]} ${y}. Le quietanze vanno firmate in ordine cronologico.`,
              [{ text: 'OK' }]
            );
            return;
          }
        }
      }
    }
    
    // Check if there's an existing record with a custom amount set by Admin
    const existingRecord = records.find(r => matchesMonth(r.month, month) && r.year === targetYear);
    const amountForThisMonth = existingRecord?.amount_gross || existingRecord?.amount || profile?.monthly_compensation || 0;
    
    const priorComp = profile?.other_annual_compensation || 0;
    
    // Get contract start year
    let contractStartYearLocal = null;
    if (profile?.contract_start_date) {
      contractStartYearLocal = parseInt(profile.contract_start_date.split('-')[0]);
    }
    
    // Calculate total before this month - chronological order matters!
    // Only include months BEFORE the target month (signing out-of-order would
    // wrongly attribute threshold-crossing to the current month).
    const yearRecords = records.filter(r => r.year === targetYear && r.receipt_signed && r.month < month);
    const yearTotalFromReceipts = yearRecords.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
    // Include also cumulative external compensations already declared + the
    // one just declared in the pre-sign modal (not yet in DB)
    const externalThisYearTotal = externalByYear[targetYear] || 0;
    const externalJustDeclared = extDeclaration?.amount ?? 0;
    const yearTotalBeforeThis = ((targetYear === contractStartYearLocal)
      ? yearTotalFromReceipts + priorComp
      : yearTotalFromReceipts) + externalThisYearTotal + externalJustDeclared;
    
    const newTotal = yearTotalBeforeThis + amountForThisMonth;
    
    // Check if THIS month will be the first to exceed thresholds
    const willExceed5k = newTotal > 5000 && yearTotalBeforeThis <= 5000;
    const willExceed15k = newTotal > 15000 && yearTotalBeforeThis <= 15000;
    
    console.log('Threshold check for modal:', { yearTotalBeforeThis, amountForThisMonth, newTotal, willExceed5k, willExceed15k });
    
    // Check if blocked by threshold (already exceeded but not declared)
    if (thresholdStatus?.is_blocked) {
      Alert.alert(
        'Azione Bloccata',
        thresholdStatus.block_reason || 'Devi prima firmare la dichiarazione di superamento soglia.',
        [
          { text: 'Annulla', style: 'cancel' },
          { 
            text: 'Firma Dichiarazione', 
            onPress: () => {
              // Determine which declaration is needed
              if (thresholdStatus.thresholds['15000'].needs_declaration) {
                openDeclarationModal('15000');
              } else if (thresholdStatus.thresholds['5000'].needs_declaration) {
                openDeclarationModal('5000');
              }
            }
          }
        ]
      );
      return;
    }
    
    // Check if this month is already signed - use matchesMonth for legacy support
    const signedRecord = records.find(r => matchesMonth(r.month, month) && r.year === targetYear && r.receipt_signed);
    if (signedRecord) {
      Alert.alert('Già firmata', 'La quietanza per questo mese è già stata firmata.');
      return;
    }
    
    // 📌 STEP PRE-FIRMA: chiedi sempre se ci sono altri compensi da ASD esterne.
    if (!opts?.skipExtStep) {
      setExtPendingMonth(month);
      setExtPendingYear(targetYear);
      setExtStepVisible(true);
      return;
    }

    // If this month will exceed a threshold, show declaration modal instead
    if (willExceed15k) {
      openDeclarationModalForMonth('15000', month, targetYear);
    } else if (willExceed5k) {
      openDeclarationModalForMonth('5000', month, targetYear);
    } else {
      // Open signature modal with all state in one update to prevent re-renders
      openSignatureModal(month, targetYear);
    }
  };

  // New function to open declaration modal for a specific month
  const openDeclarationModalForMonth = (type: '5000' | '15000', month: number, year: number) => {
    setDeclarationType(type);
    setDeclarationSignature(null);
    setSignatureModalState(prev => ({ ...prev, month, year }));
    const existingRecord = records.find(r => matchesMonth(r.month, month) && r.year === year);
    setDeclarationAmount(existingRecord?.amount_gross || existingRecord?.amount || profile?.monthly_compensation || 0);
    setShowDeclarationModal(true);
  };

  const openDeclarationModal = (type: '5000' | '15000') => {
    const now = new Date();
    const currentMonthNum = now.getMonth() + 1;
    const currentYearNum = now.getFullYear();
    setDeclarationType(type);
    setDeclarationSignature(null);
    setSignatureModalState(prev => ({ ...prev, month: currentMonthNum, year: currentYearNum }));
    const pendingMonth = records.find(r => !r.receipt_signed && !r.declaration_pending);
    setDeclarationAmount(pendingMonth?.amount_gross || pendingMonth?.amount || profile?.monthly_compensation || 0);
    setShowDeclarationModal(true);
  };

  const handleSignDeclaration = async () => {
    if (!declarationSignature) {
      Alert.alert('Errore', 'Firma richiesta');
      return;
    }
    
    try {
      setSigningDeclaration(true);
      
      // Check if there's an existing record with a custom amount set by Admin
      const existingRecord = records.find(r => r.month === selectedMonth && r.year === selectedYear);
      const amountToSign = existingRecord?.amount_gross || existingRecord?.amount || profile?.monthly_compensation || 0;
      
      // Use the compensation receipt endpoint which now generates the correct threshold document
      const athleteIdForSign = user?.athlete_id || user?.id;
      const response = await api.post(`/athletes/${athleteIdForSign}/compensation/receipt-sign`, {
        month: selectedMonth,
        year: selectedYear,
        amount_gross: amountToSign,
        signature_base64: declarationSignature.replace('data:image/png;base64,', ''),
        exceeded_5000: declarationType === '5000',
        exceeded_15000: declarationType === '15000',
        external_compensation_amount: extDeclaration?.amount ?? 0,
        external_compensation_none: extDeclaration?.none ?? false,
      });
      
      const thresholdAmount = declarationType === '5000' ? '5.000' : '15.000';
      const monthName = MONTH_NAMES[selectedMonth || 0];
      
      Alert.alert(
        'Dichiarazione Firmata',
        `Comunicazione di superamento soglia € ${thresholdAmount} per ${monthName} ${selectedYear} firmata con successo!\n\nCompreso lordo: € ${response.data.amount_gross.toFixed(2)}\nTotale annuo: € ${response.data.yearly_total.toFixed(2)}\n\nUna copia è stata inviata alla tua email e alla società.`
      );
      
      setShowDeclarationModal(false);
      loadData(); // Reload to update status
      
    } catch (error: any) {
      console.error('[Coach handleSignDeclaration] ERROR', error?.response?.status, error?.response?.data, error?.message);
      if (handleAnagraficaError(error, '/athletes/profile')) return;
      const detail = error?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : (detail?.message || error?.message || 'Errore durante la firma');
      Alert.alert('Errore firma', `${msg}\n\nCodice HTTP: ${error?.response?.status || 'n/a'}`);
    } finally {
      setSigningDeclaration(false);
    }
  };

  const handleSign = async (overrideSignature?: string) => {
    const sig = overrideSignature || signature;
    // Log remoto per debug produzione (Fede / Andrea click che non vanno)
    const logRemote = (msg: string, data: any = {}) => {
      try { api.post('/debug/client-log', { message: `[Athlete] ${msg}`, data }); } catch {}
    };
    logRemote('handleSign START', { hasSig: !!sig, sigLen: sig?.length || 0, selectedMonth, selectedYear, hasProfile: !!profile, extDeclaration });
    console.log('[Coach handleSign] START', { signature: !!sig, selectedMonth, selectedYear, profile: !!profile, extDeclaration });
    if (!sig || !selectedMonth || !profile) {
      logRemote('handleSign EXIT: missing prereqs', { sig: !!sig, selectedMonth, profile: !!profile });
      console.log('[Coach handleSign] EXIT: missing signature/month/profile', { sig: !!sig, selectedMonth, profile: !!profile });
      Alert.alert('Errore', 'Firma richiesta o dati mancanti');
      return;
    }
    
    try {
      setSigning(true);
      
      // Check if there's already a record for this month (e.g., admin-created with custom amount)
      const existingRecord = records.find(r => 
        (r.month === selectedMonth || matchesMonth(r.month, selectedMonth)) && 
        r.year === selectedYear
      );
      
      // Use existing record amount if available, otherwise use monthly compensation
      const monthlyAmount = existingRecord?.amount_gross || existingRecord?.amount || profile.monthly_compensation || 0;
      const priorComp = profile.other_annual_compensation || 0;
      
      // Calculate total for the selected year (chronological order — only months BEFORE this one)
      const yearRecords = records.filter(r => r.year === selectedYear && r.receipt_signed && r.month < selectedMonth);
      const yearTotalFromReceipts = yearRecords.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
      
      // Get contract start year to determine if prior compensation applies
      let contractStartYearLocal = null;
      if (profile.contract_start_date) {
        contractStartYearLocal = parseInt(profile.contract_start_date.split('-')[0]);
      }
      
      // Include prior compensation only for the first year of contract
      // + cumulative external compensations declared for this year + the one
      // just declared in the pre-sign modal
      const externalThisYearTotalAlready = externalByYear[selectedYear] || 0;
      const externalThisSign = extDeclaration?.amount ?? 0;
      const yearTotalBeforeThis = ((selectedYear === contractStartYearLocal)
        ? yearTotalFromReceipts + priorComp
        : yearTotalFromReceipts) + externalThisYearTotalAlready + externalThisSign;
      
      const newTotal = yearTotalBeforeThis + monthlyAmount;
      
      // Check if THIS month causes the threshold to be exceeded
      const exceeded5000 = newTotal > 5000 && yearTotalBeforeThis <= 5000;
      const exceeded15000 = newTotal > 15000 && yearTotalBeforeThis <= 15000;
      
      console.log('Threshold calculation:', { yearTotalBeforeThis, monthlyAmount, newTotal, exceeded5000, exceeded15000, priorComp, contractStartYearLocal, selectedYear, externalThisYearTotalAlready, externalThisSign });
      try { api.post('/debug/client-log', { message: '[Athlete] handleSign before POST', data: { yearTotalBeforeThis, monthlyAmount, newTotal, exceeded5000, exceeded15000 } }); } catch {}

      // Log ATTEMPTING POST (fire-and-forget so the main POST is not delayed)
      try { api.post('/debug/client-log', { message: '[Athlete] handleSign ATTEMPTING POST', data: { url: `/athletes/${user?.athlete_id || user?.id}/compensation/receipt-sign`, sigLen: sig.length } }); } catch {}

      const receiptPayload = {
        month: selectedMonth,
        year: selectedYear,
        amount_gross: monthlyAmount,
        signature_base64: sig.replace('data:image/png;base64,', ''),
        exceeded_5000: exceeded5000,
        exceeded_15000: exceeded15000,
        external_compensation_amount: extDeclaration?.amount ?? 0,
        external_compensation_none: extDeclaration?.none ?? false,
      };

      // Retry once on ERR_NETWORK / timeout (Render free tier sometimes resets the first connection)
      const athleteIdForSign = user?.athlete_id || user?.id;
      const signEndpoint = `/athletes/${athleteIdForSign}/compensation/receipt-sign`;
      let response: any;
      try {
        response = await api.post(signEndpoint, receiptPayload, {
          timeout: 90000,
        });
      } catch (firstErr: any) {
        const isNetErr = !firstErr?.response && (firstErr?.code === 'ERR_NETWORK' || firstErr?.code === 'ECONNABORTED' || firstErr?.message === 'Network Error');
        if (!isNetErr) throw firstErr;
        // Log retry attempt remotely
        try { api.post('/debug/client-log', { message: '[Athlete] handleSign RETRY after network error', data: { code: firstErr?.code, message: firstErr?.message } }); } catch {}
        // Wait 1.5s then retry once (gives Render time to spin up / recover)
        await new Promise(r => setTimeout(r, 1500));
        response = await api.post(signEndpoint, receiptPayload, {
          timeout: 120000, // longer timeout for the retry
        });
        try { api.post('/debug/client-log', { message: '[Athlete] handleSign RETRY OK', data: { status: response.status } }); } catch {}
      }

      // Log POST OK
      try { await api.post('/debug/client-log', { message: '[Athlete] handleSign POST OK', data: { status: response.status, success: response.data?.success, hasPdf: !!response.data?.pdf_base64 } }); } catch {}
      
      // Close modal FIRST, then show success message
      closeSignatureModal();
      setExtDeclaration(null);
      setExtPendingMonth(null);
      setExtPendingYear(null);
      
      Alert.alert(
        'Quietanza Firmata',
        `Quietanza firmata con successo!\n\nLordo: € ${response.data.amount_gross.toFixed(2)}\nNetto: € ${response.data.amount_net.toFixed(2)}\n\nTotale annuo: € ${response.data.yearly_total.toFixed(2)}`
      );
      
      loadData();
      
    } catch (error: any) {
      console.error('[Coach handleSign] ERROR', error?.response?.status, error?.response?.data, error?.message);
      // Remote log POST_ERROR so we can see it on Render (mobile users have no console)
      try {
        const errPayload = {
          status: error?.response?.status ?? null,
          data: typeof error?.response?.data === 'string' ? error.response.data.slice(0, 500) : error?.response?.data ?? null,
          message: error?.message ?? null,
          code: error?.code ?? null,
          isAxios: !!error?.isAxiosError,
          isNetwork: !error?.response,
          url: error?.config?.url ?? null,
        };
        api.post('/debug/client-log', { message: '[Athlete] handleSign POST_ERROR', data: errPayload });
      } catch {}
      if (handleAnagraficaError(error, '/athletes/profile')) return;
      const detail = error?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : (detail?.message || error?.message || 'Errore durante la firma');
      Alert.alert('Errore firma quietanza', `${msg}\n\nCodice HTTP: ${error?.response?.status || 'n/a'}`);
    } finally {
      setSigning(false);
    }
  };

  const getMonthStatus = (month: number, year?: number): 'pending' | 'signed' | 'future' | 'blocked' => {
    const checkYear = year || currentYear;
    const now = new Date();
    const currentYearActual = now.getFullYear();
    const currentMonthActual = now.getMonth() + 1;
    
    // Only block future months if we're in the same year AND the month is in the future
    if (checkYear === currentYearActual && month > currentMonthActual) {
      return 'future';
    }
    // If viewing a future year entirely, block all
    if (checkYear > currentYearActual) {
      return 'future';
    }
    
    // Use matchesMonth helper for legacy support
    const record = records.find(r => matchesMonth(r.month, month) && r.year === checkYear);
    
    // FIRST check if already signed - signed months should show as signed
    if (record?.receipt_signed) {
      return 'signed';
    }
    
    // Only show blocked status for 2026+ years and if threshold is blocked
    // Use the correct threshold status for the year being checked
    const relevantThresholdStatus = checkYear === 2026 ? thresholdStatus2026 : thresholdStatus;
    if (relevantThresholdStatus?.is_blocked) {
      return 'blocked';
    }
    
    return 'pending';
  };
  
  // Get months for current year based on contract dates
  const getContractMonthsForYear = (year: number): number[] => {
    if (!contractStartYear || !contractEndYear || !contractStartMonth || !contractEndMonth) {
      // Fallback: all 12 months
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    
    const months: number[] = [];
    
    // First year of contract
    if (year === contractStartYear && year === contractEndYear) {
      // Contract starts and ends in same year
      for (let m = contractStartMonth; m <= contractEndMonth; m++) {
        months.push(m);
      }
    } else if (year === contractStartYear) {
      // First year: from start month to December
      for (let m = contractStartMonth; m <= 12; m++) {
        months.push(m);
      }
    } else if (year === contractEndYear) {
      // Last year: from January to end month
      for (let m = 1; m <= contractEndMonth; m++) {
        months.push(m);
      }
    } else if (year > contractStartYear && year < contractEndYear) {
      // Middle years: all months
      for (let m = 1; m <= 12; m++) {
        months.push(m);
      }
    }
    
    return months;
  };
  
  // Calculate year summary with prior compensation
  const getYearSummary = (year: number) => {
    const monthsInYear = getContractMonthsForYear(year);
    const monthlyComp = profile?.monthly_compensation || 0;
    const monthCount = monthsInYear.length;
    const yearlyFromContractBase = monthlyComp * monthCount;  // Base compensation
    
    // Calculate actual total from receipts (includes custom amounts)
    let actualYearlyTotal = 0;
    let supplementaryTotal = 0;
    let specialMonths: { month: number, amount: number }[] = [];
    
    monthsInYear.forEach(month => {
      const receipt = records.find(r => r.year === year && r.month === month);
      const receiptAmount = receipt?.amount_gross || receipt?.amount || monthlyComp;
      actualYearlyTotal += receiptAmount;
      
      // Calculate supplementary (custom amount different from standard monthly)
      if (receiptAmount !== monthlyComp && receipt) {
        supplementaryTotal += (receiptAmount - monthlyComp);
        specialMonths.push({ month, amount: receiptAmount });
      }
    });
    
    // Add prior compensation only for the first year of contract
    const includePrior = year === contractStartYear;
    const prior = includePrior ? priorCompensation : 0;
    // External compensations declared for this year (altre ASD/SSD)
    const externalTotal = externalByYear[year] || 0;
    const total = actualYearlyTotal + prior + externalTotal;  // Use actual amounts + external
    
    // Calculate signed total for this year
    const signedTotal = records
      .filter(r => r.year === year && r.receipt_signed)
      .reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
    
    return {
      year,
      monthCount,
      monthlyComp,
      yearlyFromContract: actualYearlyTotal,  // Now includes supplementary amounts
      yearlyFromContractBase,  // Base compensation (monthly × months)
      supplementaryTotal,  // Amount above standard monthly
      specialMonths,  // Months with custom amounts
      priorCompensation: prior,
      externalTotal,  // Compensi dichiarati da altre ASD/SSD
      totalProjected: total,
      signedTotal: signedTotal + prior + externalTotal,
      months: monthsInYear,
    };
  };

  const renderThresholdWarnings = () => {
    if (!thresholdStatus) return null;
    
    const warnings = [];
    
    // Resolve threshold month name from backend projection (preferred) with fallback to local records
    const monthlyComp = profile?.monthly_compensation || 0;
    const priorComp = profile?.other_annual_compensation || 0;
    
    const monthNameFromBackend = (status: ThresholdStatus | null, type: '5000' | '15000') => {
      const m = status?.thresholds?.[type]?.threshold_month;
      if (m && m >= 1 && m <= 12) return MONTH_NAMES[m] || '';
      return '';
    };
    
    const findThresholdMonthFallback = (year: number, threshold: number) => {
      const yearRecords = records.filter(r => r.year === year).sort((a: any, b: any) => a.month - b.month);
      const prior = (year === contractStartYear) ? priorComp : 0;
      let cumulative = prior;
      for (const r of yearRecords) {
        const amt = r.amount_gross || r.amount || monthlyComp;
        cumulative += amt;
        if (cumulative > threshold) {
          return MONTH_NAMES[r.month] || '';
        }
      }
      return '';
    };
    
    const thresholdMonth5k_y1 = monthNameFromBackend(thresholdStatus, '5000') || findThresholdMonthFallback(contractStartYear, 5000);
    const thresholdMonth15k_y1 = monthNameFromBackend(thresholdStatus, '15000') || findThresholdMonthFallback(contractStartYear, 15000);
    const thresholdMonth5k_y2 = monthNameFromBackend(thresholdStatus2026, '5000') || findThresholdMonthFallback(contractStartYear + 1, 5000);
    const thresholdMonth15k_y2 = monthNameFromBackend(thresholdStatus2026, '15000') || findThresholdMonthFallback(contractStartYear + 1, 15000);
    
    // Year 1 projection: show banner whenever the projected annual total exceeds threshold,
    // declaration not yet signed, and not already in "needs_declaration" state (which has its own banner).
    const summaryY1 = getYearSummary(contractStartYear);
    const willExceed5k_y1 = (summaryY1?.totalProjected || 0) > 5000;
    const willExceed15k_y1 = (summaryY1?.totalProjected || 0) > 15000;
    const showWarning5k_y1 = willExceed5k_y1
      && !thresholdStatus.thresholds['5000'].declaration_signed
      && !thresholdStatus.thresholds['5000'].needs_declaration
      && !!thresholdMonth5k_y1;
    const showWarning15k_y1 = willExceed15k_y1
      && !thresholdStatus.thresholds['15000'].declaration_signed
      && !thresholdStatus.thresholds['15000'].needs_declaration
      && !!thresholdMonth15k_y1;
    
    // Warning for approaching €5.000
    if (showWarning5k_y1) {
      warnings.push(
        <View key="warning-5000" style={styles.thresholdWarningBox5k}>
          <Text style={styles.thresholdWarningTitle5k}>⚠️ Anno {contractStartYear}: Soglia dei €5.000</Text>
          <Text style={[styles.thresholdWarningText5k, { textAlign: 'center', lineHeight: 18, marginTop: 4 }]}>
            Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth5k_y1}</Text> supererai la soglia previdenziale di €5.000.
          </Text>
          <Text style={[styles.thresholdWarningText5k, { textAlign: 'center', fontStyle: 'italic', marginTop: 4 }]}>Contributi previdenziali INPS</Text>
        </View>
      );
    }
    
    // Warning for approaching €15.000
    if (showWarning15k_y1) {
      warnings.push(
        <View key="warning-15000" style={styles.thresholdWarningBox15k}>
          <Text style={styles.thresholdWarningTitle15k}>🚨 Anno {contractStartYear}: Soglia dei €15.000</Text>
          <Text style={[styles.thresholdWarningText15k, { textAlign: 'center', lineHeight: 18, marginTop: 4 }]}>
            Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth15k_y1}</Text> supererai la soglia fiscale di €15.000.
          </Text>
          <Text style={[styles.thresholdWarningText15k, { textAlign: 'center', fontStyle: 'italic', marginTop: 4 }]}>Tassazione IRPEF obbligatoria</Text>
        </View>
      );
    }
    
    // Blocked: needs €5.000 declaration
    if (thresholdStatus.thresholds['5000'].needs_declaration) {
      warnings.push(
        <TouchableOpacity 
          key="blocked-5000" 
          style={[styles.thresholdBanner, styles.blockedBanner]}
          onPress={() => openDeclarationModal('5000')}
          data-testid="declaration-5000-btn"
        >
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <View style={styles.thresholdBannerContent}>
            <Text style={[styles.thresholdBannerTitle, { color: '#fff' }]}>
              Dichiarazione €5.000 richiesta
            </Text>
            <Text style={[styles.thresholdBannerText, { color: '#fff' }]}>
              Tocca qui per firmare la dichiarazione e sbloccare le quietanze
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      );
    }
    
    // Blocked: needs €15.000 declaration
    if (thresholdStatus.thresholds['15000'].needs_declaration) {
      warnings.push(
        <TouchableOpacity 
          key="blocked-15000" 
          style={[styles.thresholdBanner, styles.blockedBanner, { backgroundColor: '#721C24' }]}
          onPress={() => openDeclarationModal('15000')}
          data-testid="declaration-15000-btn"
        >
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <View style={styles.thresholdBannerContent}>
            <Text style={[styles.thresholdBannerTitle, { color: '#fff' }]}>
              URGENTE: Dichiarazione €15.000 richiesta
            </Text>
            <Text style={[styles.thresholdBannerText, { color: '#fff' }]}>
              Tocca qui per firmare la dichiarazione fiscale
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      );
    }
    
    // Show signed declarations
    if (thresholdStatus.thresholds['5000'].declaration_signed) {
      const m1 = thresholdStatus.thresholds['5000'].threshold_month;
      const monthLabel1 = (m1 && m1 >= 1 && m1 <= 12) ? MONTH_NAMES[m1] : '';
      warnings.push(
        <View key="signed-5000" style={styles.thresholdSignedBox}>
          <Text style={styles.thresholdSignedTitle}>
            ✅ Anno {contractStartYear}: Dichiarazione €5.000 firmata
          </Text>
          <Text style={styles.thresholdSignedBody}>
            Soglia previdenziale comunicata{monthLabel1 ? ` (superata nel mese di ${monthLabel1})` : ''}
          </Text>
        </View>
      );
    }
    
    if (thresholdStatus.thresholds['15000'].declaration_signed) {
      const m2 = thresholdStatus.thresholds['15000'].threshold_month;
      const monthLabel2 = (m2 && m2 >= 1 && m2 <= 12) ? MONTH_NAMES[m2] : '';
      warnings.push(
        <View key="signed-15000" style={styles.thresholdSignedBox}>
          <Text style={styles.thresholdSignedTitle}>
            ✅ Anno {contractStartYear}: Dichiarazione €15.000 firmata
          </Text>
          <Text style={styles.thresholdSignedBody}>
            Soglia fiscale comunicata{monthLabel2 ? ` (superata nel mese di ${monthLabel2})` : ''}
          </Text>
        </View>
      );
    }
    
    // ==================== 2026 WARNINGS ====================
    // Add warnings for the second year (2026) if contract spans two years
    if (thresholdStatus2026 && contractEndYear && contractEndYear > contractStartYear) {
      const year2026 = contractEndYear;
      const summaryY2 = getYearSummary(contractEndYear);
      const willExceed5k_y2 = (summaryY2?.totalProjected || 0) > 5000;
      const willExceed15k_y2 = (summaryY2?.totalProjected || 0) > 15000;
      const showWarning5k_y2 = willExceed5k_y2
        && !thresholdStatus2026.thresholds['5000'].declaration_signed
        && !!thresholdMonth5k_y2;
      const showWarning15k_y2 = willExceed15k_y2
        && !thresholdStatus2026.thresholds['15000'].declaration_signed
        && !!thresholdMonth15k_y2;
      
      // Show signed declarations for 2026 - LIGHT BLUE to distinguish from first year
      if (thresholdStatus2026.thresholds['5000'].declaration_signed) {
        const m1y2 = thresholdStatus2026.thresholds['5000'].threshold_month;
        const monthLabel1y2 = (m1y2 && m1y2 >= 1 && m1y2 <= 12) ? MONTH_NAMES[m1y2] : '';
        warnings.push(
          <View key="signed-5000-2026" style={[styles.thresholdSignedBox, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
            <Text style={[styles.thresholdSignedTitle, { color: '#1565C0' }]}>
              ✅ Anno {year2026}: Dichiarazione €5.000 firmata
            </Text>
            <Text style={[styles.thresholdSignedBody, { color: '#1565C0' }]}>
              Soglia previdenziale comunicata{monthLabel1y2 ? ` (superata nel mese di ${monthLabel1y2})` : ''}
            </Text>
          </View>
        );
      }
      
      if (thresholdStatus2026.thresholds['15000'].declaration_signed) {
        const m2y2 = thresholdStatus2026.thresholds['15000'].threshold_month;
        const monthLabel2y2 = (m2y2 && m2y2 >= 1 && m2y2 <= 12) ? MONTH_NAMES[m2y2] : '';
        warnings.push(
          <View key="signed-15000-2026" style={[styles.thresholdSignedBox, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
            <Text style={[styles.thresholdSignedTitle, { color: '#1565C0' }]}>
              ✅ Anno {year2026}: Dichiarazione €15.000 firmata
            </Text>
            <Text style={[styles.thresholdSignedBody, { color: '#1565C0' }]}>
              Soglia fiscale comunicata{monthLabel2y2 ? ` (superata nel mese di ${monthLabel2y2})` : ''}
            </Text>
          </View>
        );
      }
      
      // Warning for €5.000 in 2026 — stays visible from "approaching" to
      // "exceeded but declaration not yet signed". Then the AZZURRO "signed"
      // banner above takes over.
      if (showWarning5k_y2) {
        const isExceeded5k_y2 = thresholdStatus2026.thresholds['5000'].needs_declaration;
        warnings.push(
          <View key="warning-5000-2026" style={styles.thresholdWarningBox5k}>
            <Text style={styles.thresholdWarningTitle5k}>⚠️ Anno {year2026}: Soglia dei €5.000</Text>
            <Text style={[styles.thresholdWarningText5k, { textAlign: 'center', lineHeight: 18, marginTop: 4 }]}>
              {isExceeded5k_y2
                ? <>Soglia previdenziale di €5.000 superata nel mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth5k_y2}</Text>.</>
                : <>Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth5k_y2}</Text> supererai la soglia previdenziale di €5.000.</>}
            </Text>
            <Text style={[styles.thresholdWarningText5k, { textAlign: 'center', fontStyle: 'italic', marginTop: 4 }]}>Contributi previdenziali INPS</Text>
          </View>
        );
      }
      
      // Warning for €15.000 in 2026 — same logic as 5k
      if (showWarning15k_y2) {
        const isExceeded15k_y2 = thresholdStatus2026.thresholds['15000'].needs_declaration;
        warnings.push(
          <View key="warning-15000-2026" style={styles.thresholdWarningBox15k}>
            <Text style={styles.thresholdWarningTitle15k}>🚨 Anno {year2026}: Soglia dei €15.000</Text>
            <Text style={[styles.thresholdWarningText15k, { textAlign: 'center', lineHeight: 18, marginTop: 4 }]}>
              {isExceeded15k_y2
                ? <>Soglia fiscale di €15.000 superata nel mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth15k_y2}</Text>.</>
                : <>Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth15k_y2}</Text> supererai la soglia fiscale di €15.000.</>}
            </Text>
            <Text style={[styles.thresholdWarningText15k, { textAlign: 'center', fontStyle: 'italic', marginTop: 4 }]}>Tassazione IRPEF obbligatoria</Text>
          </View>
        );
      }

      // NOTE: Per request 30/05/2026 we no longer show a separate "BLOCKED"
      // red banner for 2026 thresholds. The warning banner (orange/purple)
      // stays visible until the declaration is signed, then becomes light-blue.
    }
    
    return warnings.length > 0 ? <View style={styles.warningsContainer}>{warnings}</View> : null;
  };

  // Find first month where each threshold was exceeded based on PROJECTED
  // cumulative (signed + unsigned). Used for coloring month cards so that
  // the user can SEE in advance which months will be above 5k/15k.
  //
  // CRITICAL: we project ALL 12 months of every relevant year using the
  // user's `monthly_compensation` for months that don't have a DB record
  // yet. Otherwise, before signing any quietanza, no records exist → no
  // cumulative → no >5K/>15K badge shown (bug reported 30/05/2026).
  const getProjectedThresholdMonths = () => {
    const thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } } = {};
    const monthlyDefault = profile?.monthly_compensation || 0;

    // Build a quick map: "year-month" → amount (from DB record), else default
    const recordMap: { [key: string]: number } = {};
    for (const r of records) {
      recordMap[`${r.year}-${r.month}`] = r.amount_gross || r.amount || monthlyDefault;
    }

    // Discover all years to project: contract start year, current year, any year present in records
    const yearsSet = new Set<number>();
    if (contractStartYear) yearsSet.add(contractStartYear);
    yearsSet.add(currentYear);
    records.forEach(r => yearsSet.add(r.year));
    const years = Array.from(yearsSet).sort();

    for (const y of years) {
      thresholdsByYear[y] = { first5k: null, first15k: null };
      // Inizia il cumulativo includendo:
      // - prior_compensation (compensi pregressi del primo anno di contratto)
      // - compensi esterni già dichiarati per l'anno (altre ASD/SSD)
      let cumul = 0;
      if (y === contractStartYear && priorCompensation > 0) cumul += priorCompensation;
      const externalForYear = externalByYear[y] || 0;
      if (externalForYear > 0) cumul += externalForYear;
      // Se i soli esterni già superano una soglia, marca subito il primo mese
      // utile (gennaio o primo mese del contratto), così la dashboard mostra il badge.
      const firstContractMonth = (y === contractStartYear && contractStartMonth) ? contractStartMonth : 1;
      if (cumul > 5000) thresholdsByYear[y].first5k = firstContractMonth;
      if (cumul > 15000) thresholdsByYear[y].first15k = firstContractMonth;
      for (let m = 1; m <= 12; m++) {
        const hasRecord = recordMap[`${y}-${m}`] !== undefined;
        // Project monthly default ONLY for months WITHIN the contract period.
        // Signed/admin records always count (regardless of period) for safety.
        let inContract = true;
        if (contractStartYear && y < contractStartYear) inContract = false;
        else if (contractEndYear && y > contractEndYear) inContract = false;
        else if (y === contractStartYear && contractStartMonth && m < contractStartMonth) inContract = false;
        else if (contractEndYear && y === contractEndYear && contractEndMonth && m > contractEndMonth) inContract = false;
        const amount = hasRecord ? recordMap[`${y}-${m}`] : (inContract ? monthlyDefault : 0);
        if (amount <= 0) continue;
        cumul += amount;
        if (cumul > 5000 && thresholdsByYear[y].first5k === null) {
          thresholdsByYear[y].first5k = m;
        }
        if (cumul > 15000 && thresholdsByYear[y].first15k === null) {
          thresholdsByYear[y].first15k = m;
        }
      }
    }
    return thresholdsByYear;
  };

  // Find first month where each threshold was exceeded (for highlighting subsequent months)
  const getThresholdMonths = () => {
    const signedRecords = records.filter(r => r.receipt_signed);
    const sorted = [...signedRecords].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    // Track thresholds PER YEAR (they reset each calendar year)
    const thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } } = {};
    
    // Calculate cumulative totals per year to find threshold months
    const cumulativeByYear: { [year: number]: number } = {};
    
    // Add prior compensation to first year
    if (contractStartYear && priorCompensation > 0) {
      cumulativeByYear[contractStartYear] = priorCompensation;
    }
    
    for (const r of sorted) {
      if (!thresholdsByYear[r.year]) {
        thresholdsByYear[r.year] = { first5k: null, first15k: null };
      }
      if (!cumulativeByYear[r.year]) {
        cumulativeByYear[r.year] = r.year === contractStartYear ? (priorCompensation || 0) : 0;
      }
      
      // Add this month's ACTUAL compensation (may be custom amount set by Admin)
      const actualAmount = r.amount_gross || r.amount || profile?.monthly_compensation || 0;
      cumulativeByYear[r.year] += actualAmount;
      
      // Check if this month crosses €5k threshold
      if (cumulativeByYear[r.year] > 5000 && thresholdsByYear[r.year].first5k === null) {
        thresholdsByYear[r.year].first5k = r.month;
      }
      // Check if this month crosses €15k threshold  
      if (cumulativeByYear[r.year] > 15000 && thresholdsByYear[r.year].first15k === null) {
        thresholdsByYear[r.year].first15k = r.month;
      }
    }
    
    return thresholdsByYear;
  };
  
  const isMonthAfterThreshold = (month: number, year: number, thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } }, type: '5k' | '15k') => {
    const yearThresholds = thresholdsByYear[year];
    if (!yearThresholds) return false;
    
    const thresholdMonth = type === '5k' ? yearThresholds.first5k : yearThresholds.first15k;
    if (thresholdMonth === null) return false;
    
    // Only highlight months in the SAME year that are >= threshold month
    return month >= thresholdMonth;
  };

  const renderMonthCard = (month: number, year?: number) => {
    const displayYear = year || currentYear;
    const status = getMonthStatus(month, displayYear);
    // Use matchesMonth for legacy support
    const record = records.find(r => matchesMonth(r.month, month) && r.year === displayYear);
    // Use record amount if exists, otherwise use profile's monthly compensation
    const monthlyAmount = record?.amount_gross || record?.amount || profile?.monthly_compensation || 0;
    
    // Check if this month is after threshold was crossed IN THE SAME YEAR (for highlighting)
    // Uses PROJECTED cumulative (signed + unsigned) so the user can see in advance
    // which months are above 5k/15k even before they sign them.
    const thresholdsByYear = getProjectedThresholdMonths();
    const isAfter5k = isMonthAfterThreshold(month, displayYear, thresholdsByYear, '5k');
    const isAfter15k = isMonthAfterThreshold(month, displayYear, thresholdsByYear, '15k');
    
    // Use calculated thresholds for badge display (not DB values which may be stale)
    const showBadge5k = isAfter5k && !isAfter15k;
    const showBadge15k = isAfter15k;
    
    // Determine the card style based on threshold status.
    // Colors apply to ALL statuses (signed/pending/blocked/future) so the
    // user has a clear visual cue from start of the year.
    const getCardStyle = () => {
      if (status === 'signed') {
        if (isAfter15k) return styles.monthCardSigned15k;
        if (isAfter5k) return styles.monthCardSigned5k;
        return styles.monthCardSigned;
      }
      if (status === 'future') return styles.monthCardFuture;
      if (status === 'blocked') return styles.monthCardBlocked;
      return null;
    };

    // Additional inline style for threshold-based background — applied ONLY
    // to SIGNED cards. Unsigned/blocked/future cards keep their standard
    // pending/blocked/future look (white/yellow/locked).
    const thresholdInlineStyle = null;
    
    return (
      <TouchableOpacity
        key={`${displayYear}-${month}`}
        style={[
          styles.monthCard,
          getCardStyle(),
          // Threshold tint applied ONLY to signed months. Pending/blocked/future
          // months keep a white background but still show the >5K/>15K badge
          // as a preview hint.
          status === 'signed' && isAfter15k && { backgroundColor: '#F3E5F5', borderColor: '#8E44AD' },
          status === 'signed' && isAfter5k && !isAfter15k && { backgroundColor: '#FFF8E1', borderColor: '#F9A825' },
        ]}
        onPress={() => {
          console.log('Month card pressed:', { month, displayYear, status });
          if (status === 'pending' || status === 'blocked') {
            handleOpenSignature(month, displayYear);
          } else if (status === 'signed') {
            Alert.alert('Già firmata', `La quietanza di ${MONTH_NAMES[month]} ${displayYear} è già stata firmata.`);
          }
        }}
        disabled={status === 'future'}
        data-testid={`month-card-${displayYear}-${month}`}
      >
        {/* Threshold Badge - positioned at top right */}
        {(showBadge5k || showBadge15k) && (
          <View style={{
            position: 'absolute',
            top: -8,
            right: -8,
            backgroundColor: showBadge15k ? '#8E44AD' : '#F9A825',
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 8,
            zIndex: 10,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
              {showBadge15k ? '>15K' : '>5K'}
            </Text>
          </View>
        )}
        
        <View style={styles.monthHeader}>
          <Text style={styles.monthName}>{MONTH_NAMES[month]}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {status === 'signed' && (
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            )}
            {status === 'future' && (
              <Ionicons name="time-outline" size={20} color="#999" />
            )}
            {status === 'blocked' && (
              <Ionicons name="lock-closed" size={20} color="#FF9500" />
            )}
          </View>
        </View>
        
        <Text style={styles.monthAmount}>{formatCurrency(monthlyAmount)}</Text>
        
        {status === 'signed' && record && (
          <Text style={styles.signedDate}>
            Firmata il {new Date(record.receipt_signed_date || record.received_date || '').toLocaleDateString('it-IT')}
          </Text>
        )}
        
        {status === 'pending' && (
          <Text style={styles.pendingText}>Tocca per firmare</Text>
        )}
        
        {status === 'blocked' && (
          <Text style={styles.blockedText}>Firma dichiarazione</Text>
        )}
        
        {status === 'future' && (
          <Text style={styles.futureText}>Non disponibile</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/coach'))} style={styles.backButton}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SocietyBranding light={false} />
          <Text style={styles.headerTitle}>Compensi Sportivi</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Coach Name and Profile Link */}
        <View style={{ marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="person-circle" size={50} color="#007AFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>{profile?.full_name || 'Coach'}</Text>
              <Text style={{ fontSize: 13, color: '#666' }}>Compenso mensile: {formatCurrency((profile?.monthly_compensation || 0))}</Text>
            </View>
          </View>
          
          {/* Contract Period - Full dates */}
          {profile?.contract_start_date && profile?.contract_end_date && (
            <View style={{ 
              backgroundColor: '#E8F4FD', 
              padding: 12, 
              borderRadius: 8, 
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#007AFF',
              borderStyle: 'dashed'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>📅</Text>
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>Periodo Contratto</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#007AFF', fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
                {formatContractDate(profile.contract_start_date!)} - {formatContractDate(profile.contract_end_date!)}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F8FF', padding: 10, borderRadius: 8 }}
            onPress={() => router.push('/athletes/profile')}
          >
            <Ionicons name="create-outline" size={18} color="#007AFF" />
            <Text style={{ marginLeft: 8, color: '#007AFF', fontWeight: '500' }}>Il Mio Profilo</Text>
            <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, color: '#666' }}>Dati personali, documento e IBAN</Text>
            <Ionicons name="chevron-forward" size={18} color="#007AFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
        
        {/* Year Summaries - Contract-based - ENHANCED STYLE */}
        {contractStartYear && contractEndYear && (
          <>
            {/* Combined: Periodo Contratto + Totale RAS - Single unified banner */}
            <View style={styles.unifiedContractBanner}>
              {/* Header: Periodo Contratto */}
              <Text style={styles.unifiedBannerPeriod}>
                📄 Comunicazione RAS - Totale Contratto
              </Text>
              <Text style={{ color: '#1565C0', fontSize: 12, marginTop: 4 }}>
                Dal {formatContractDate(profile?.contract_start_date || '')} al {formatContractDate(profile?.contract_end_date || '')} = {(() => {
                  const months1 = getContractMonthsForYear(contractStartYear).length;
                  const months2 = contractEndYear > contractStartYear ? getContractMonthsForYear(contractEndYear).length : 0;
                  return months1 + months2;
                })()} mesi
              </Text>
              
              {/* Linear layout like Admin view */}
              {(() => {
                const summary1 = getYearSummary(contractStartYear);
                const summary2 = contractEndYear > contractStartYear ? getYearSummary(contractEndYear) : { yearlyFromContract: 0, yearlyFromContractBase: 0, supplementaryTotal: 0, specialMonths: [] };
                const totalBase = (summary1.yearlyFromContractBase || 0) + (summary2.yearlyFromContractBase || 0);
                const totalSupplementary = (summary1.supplementaryTotal || 0) + (summary2.supplementaryTotal || 0);
                const allSpecialMonths = [...(summary1.specialMonths || []).map((s: any) => ({ ...s, year: contractStartYear })), ...((summary2 as any).specialMonths || []).map((s: any) => ({ ...s, year: contractEndYear }))];
                const grandTotal = totalBase + totalSupplementary;
                const months1 = getContractMonthsForYear(contractStartYear).length;
                const months2 = contractEndYear > contractStartYear ? getContractMonthsForYear(contractEndYear).length : 0;
                const totalMonths = months1 + months2;
                
                return (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(totalBase)}</Text></Text>
                    <Text style={{ fontSize: 11, color: '#1565C0', marginBottom: 4 }}>  ({totalMonths} mesi × {formatCurrency(profile?.monthly_compensation || 0)})</Text>
                    {allSpecialMonths.length > 0 && (
                      <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare ({allSpecialMonths.map((s: any) => `${MONTH_NAMES[s.month]?.substring(0,3)} '${String(s.year).slice(2)}`).join(', ')}): <Text style={{ fontWeight: 'bold' }}>{formatCurrency(totalSupplementary)}</Text></Text>
                    )}
                    <Text style={{ fontSize: 15, color: '#1565C0', fontWeight: 'bold', marginTop: 4, borderTopWidth: 1, borderTopColor: '#90CAF9', paddingTop: 8 }}>• TOTALE RAS: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(grandTotal)}</Text></Text>
                  </View>
                );
              })()}
            </View>
            
            {/* Calcolo per Anno Solare Header */}
            <View style={styles.yearCalcHeader}>
              <Text style={styles.yearCalcHeaderText}>📊 Calcolo per Anno Solare (soglie €5k/€15k)</Text>
            </View>
            
            {/* First Year Summary (with prior compensation) - GREEN theme */}
            {(() => {
              const summary = getYearSummary(contractStartYear);
              const exceeds5k = summary.totalProjected > 5000;
              const exceeds15k = summary.totalProjected > 15000;
              // First year: GREEN base color
              const bgColor = '#E8F5E9';  // Light green
              const borderColor = '#4CAF50';  // Green border
              const headerColor = '#2E7D32';  // Dark green for header
              const icon = exceeds15k ? '🚨' : exceeds5k ? '⚠️' : '✅';
              
              return (
                <View key={`summary-${contractStartYear}`} style={[styles.yearBox, { backgroundColor: bgColor, borderLeftWidth: 4, borderLeftColor: borderColor }]}>
                  <Text style={[styles.yearBoxTitle, { color: headerColor }]}>
                    {icon} Anno {contractStartYear} ({MONTH_NAMES[contractStartMonth || 9].substring(0,3)}-Dic: {summary.monthCount} mesi)
                  </Text>
                  
                  {/* Linear layout like Admin view */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.yearlyFromContractBase || 0)}</Text></Text>
                    {(summary.specialMonths?.length > 0) && (
                      <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare ({summary.specialMonths.map((s: any) => `${MONTH_NAMES[s.month]?.substring(0,3)} '${String(contractStartYear).slice(2)}`).join(', ')}): <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.supplementaryTotal || 0)}</Text></Text>
                    )}
                    {summary.priorCompensation > 0 && (
                      <Text style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>• Pregressi: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.priorCompensation)}</Text></Text>
                    )}
                    {(summary.externalTotal || 0) > 0 && (
                      <Text style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>• Compensi esterni (altre ASD): <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.externalTotal)}</Text></Text>
                    )}
                    <Text style={{ fontSize: 15, color: exceeds15k ? '#8E44AD' : exceeds5k ? '#F57F17' : headerColor, fontWeight: 'bold', marginTop: 4 }}>• Totale Anno: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.totalProjected)}</Text></Text>
                  </View>
                </View>
              );
            })()}
            
            {/* Second Year Summary (if contract spans 2 years) - BLUE theme */}
            {contractEndYear > contractStartYear && (() => {
              const summary = getYearSummary(contractEndYear);
              const exceeds5k = summary.totalProjected > 5000;
              const exceeds15k = summary.totalProjected > 15000;
              // Second year: BLUE base color
              const bgColor = '#E3F2FD';  // Light blue
              const borderColor = '#2196F3';  // Blue border
              const headerColor = '#1565C0';  // Dark blue for header
              const icon = exceeds15k ? '🚨' : exceeds5k ? '⚠️' : '✅';
              
              return (
                <View key={`summary-${contractEndYear}`} style={[styles.yearBox, { backgroundColor: bgColor, borderLeftWidth: 4, borderLeftColor: borderColor }]}>
                  <Text style={[styles.yearBoxTitle, { color: headerColor }]}>
                    {icon} Anno {contractEndYear} (Gen-{MONTH_NAMES[contractEndMonth || 5].substring(0,3)}: {summary.monthCount} mesi)
                  </Text>
                  
                  {/* Linear layout like Admin view */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.yearlyFromContractBase || 0)}</Text></Text>
                    {(summary.specialMonths?.length > 0) && (
                      <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare ({summary.specialMonths.map((s: any) => `${MONTH_NAMES[s.month]?.substring(0,3)} '${String(contractEndYear).slice(2)}`).join(', ')}): <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.supplementaryTotal || 0)}</Text></Text>
                    )}
                    {(summary.externalTotal || 0) > 0 && (
                      <Text style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>• Compensi esterni (altre ASD): <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.externalTotal)}</Text></Text>
                    )}
                    <Text style={{ fontSize: 15, color: exceeds15k ? '#8E44AD' : exceeds5k ? '#F57F17' : headerColor, fontWeight: 'bold', marginTop: 4 }}>• Totale Anno: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.totalProjected)}</Text></Text>
                  </View>
                </View>
              );
            })()}
          </>
        )}
        
        {/* Fallback: Old summary if no contract dates */}
        {(!contractStartYear || !contractEndYear) && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Riepilogo {currentYear}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Compenso mensile:</Text>
              <Text style={styles.summaryValue}>{formatCurrency((profile?.monthly_compensation || 0))}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Totale quietanzato:</Text>
              <Text style={[styles.summaryValue, styles.summaryTotal]}>{formatCurrency(yearlyTotal)}</Text>
            </View>
          </View>
        )}

        {/* Threshold Warnings/Actions */}
        {renderThresholdWarnings()}

        {/* Monthly Cards - Contract-based */}
        {contractStartYear && contractEndYear && (
          <>
            {/* First Year Months */}
            <Text style={styles.sectionTitle}>Quietanze {contractStartYear}</Text>
            <View style={styles.monthsGrid}>
              {getContractMonthsForYear(contractStartYear).map(month => renderMonthCard(month, contractStartYear))}
            </View>
            
            {/* Second Year Months */}
            {contractEndYear > contractStartYear && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Quietanze {contractEndYear}</Text>
                <View style={styles.monthsGrid}>
                  {getContractMonthsForYear(contractEndYear).map(month => renderMonthCard(month, contractEndYear))}
                </View>
              </>
            )}
          </>
        )}
        
        {/* Fallback: No contract dates set - show only current year with warning */}
        {(!contractStartYear || !contractEndYear) && (
          <>
            <View style={{ backgroundColor: '#FFF3CD', borderRadius: 8, padding: 12, marginHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning" size={20} color="#856404" />
              <Text style={{ color: '#856404', marginLeft: 8, flex: 1, fontSize: 13 }}>
                Date contratto non impostate. Contatta l'amministratore per configurare il periodo contrattuale.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Quietanze {new Date().getFullYear()}</Text>
            <View style={styles.monthsGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => m <= new Date().getMonth() + 1).map(month => renderMonthCard(month, new Date().getFullYear()))}
            </View>
          </>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Informazioni</Text>
          <Text style={styles.infoText}>
            • Fino a €5.000/anno: compenso esente da tasse e contributi{'\n'}
            • Da €5.000 a €15.000: soggetto a contributi previdenziali{'\n'}
            • Oltre €15.000: soggetto anche a imposizione fiscale IRPEF{'\n'}
            • La firma della quietanza genera un PDF salvato nei "Miei Documenti"{'\n'}
            • Al superamento delle soglie è richiesta una dichiarazione
          </Text>
        </View>
      </ScrollView>

      {/* Signature Modal for Receipts */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Quietanza {MONTH_NAMES[selectedMonth || 0]} {selectedYear}
              </Text>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll} 
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
            >
              {/* Receipt Preview */}
              <View style={styles.receiptPreviewCompact}>
                <Text style={styles.receiptTitleCompact}>QUIETANZA COMPENSO SPORTIVO DILETTANTISTICO</Text>
                <Text style={styles.receiptTextCompact}>
                  Collaboratore: {profile?.full_name} • Mese: {MONTH_NAMES[selectedMonth || 0]} {selectedYear}{'\n'}
                  Compenso lordo: {formatCurrency((profile?.monthly_compensation || 0))}{'\n'}
                  Il collaboratore dichiara che non sono intervenute variazioni rispetto all'autocertificazione precedente.
                </Text>
              </View>

              {/* Signature Pad */}
              <Text style={styles.signatureLabel}>Firma qui sotto:</Text>
              <SignaturePadInline
                ref={signatureRef}
                onSave={(sig) => setSignature(sig)}
                onClear={() => setSignature(null)}
                height={180}
              />
            </ScrollView>

            {/* Confirm Buttons - OUTSIDE ScrollView for fixed position */}
            <View style={styles.modalButtonsFixed}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeSignatureModal}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                ]}
                onPress={() => {
                  // Forza il read della firma al momento del tap (utile su
                  // mobile dove onEnd può non scattare per scroll/touch lift)
                  let sig = signature;
                  if (!sig && signatureRef.current) {
                    sig = signatureRef.current.toDataURL();
                    if (sig) setSignature(sig);
                  }
                  if (!sig) {
                    Alert.alert('Firma richiesta', 'Disegna la tua firma nel riquadro prima di confermare.');
                    return;
                  }
                  // Passa la firma direttamente per evitare race condition con setSignature
                  handleSign(sig);
                }}
                disabled={signing}
              >
                {signing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Firma Quietanza</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Declaration Modal */}
      <Modal
        visible={showDeclarationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeclarationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, declarationType === '15000' && { backgroundColor: '#721C24' }]}>
              <Text style={[styles.modalTitle, declarationType === '15000' && { color: '#fff' }]}>
                Dichiarazione Soglia € {declarationType === '5000' ? '5.000' : '15.000'}
              </Text>
              <TouchableOpacity onPress={() => setShowDeclarationModal(false)}>
                <Ionicons name="close" size={24} color={declarationType === '15000' ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Declaration Preview */}
              <View style={[styles.receiptPreview, declarationType === '15000' && { borderColor: '#721C24' }]}>
                <Text style={styles.receiptTitle}>
                  COMUNICAZIONE DI SUPERAMENTO DELLA SOGLIA {declarationType === '5000' ? 'PREVIDENZIALE' : 'FISCALE'}
                </Text>
                <Text style={styles.receiptText}>
                  Il/La sottoscritto/a{'\n'}
                  Nome e Cognome: {profile?.full_name}{'\n'}
                  Codice Fiscale: {profile?.fiscal_code || 'N/D'}{'\n'}
                  {'\n'}
                  COMUNICA{'\n'}
                  {'\n'}
                  che, alla data odierna, il totale dei compensi percepiti per attività sportiva dilettantistica nell'anno solare {selectedYear}, anche da altri enti sportivi, ha raggiunto e/o superato l'importo complessivo di € {declarationType === '5000' ? '5.000,00' : '15.000,00'}.{'\n'}
                  {'\n'}
                  Il sottoscritto dichiara di essere a conoscenza che, dal momento del superamento della suddetta soglia, {declarationType === '5000' 
                    ? 'i compensi eccedenti sono soggetti agli obblighi previdenziali previsti dalla normativa vigente.'
                    : 'i compensi eccedenti sono soggetti a imposizione fiscale secondo la normativa vigente.'
                  }{'\n'}
                  {'\n'}
                  Si impegna inoltre a comunicare tempestivamente eventuali ulteriori variazioni della propria situazione.
                </Text>
              </View>

              {/* Warning */}
              <View style={[styles.warningBox, declarationType === '15000' && { backgroundColor: '#F8D7DA' }]}>
                <Ionicons 
                  name={declarationType === '5000' ? 'warning' : 'alert-circle'} 
                  size={20} 
                  color={declarationType === '5000' ? '#856404' : '#721C24'} 
                />
                <Text style={[styles.warningText, declarationType === '15000' && { color: '#721C24' }]}>
                  {declarationType === '5000' 
                    ? 'Firmando questa dichiarazione comunichi di aver superato la soglia previdenziale di €5.000. I compensi futuri saranno soggetti a contributi.'
                    : 'ATTENZIONE: Firmando questa dichiarazione comunichi di aver superato la soglia fiscale di €15.000. I compensi futuri saranno soggetti a tassazione IRPEF.'
                  }
                </Text>
              </View>

              {/* Metadata Section */}
              <View style={{ backgroundColor: '#F5F5F5', padding: 12, marginVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 8, textAlign: 'center' }}>METADATI DI VERIFICA</Text>
                {(() => {
                  const tsCurrentYear = selectedYear === 2026 ? (thresholdStatus2026 || thresholdStatus) : thresholdStatus;
                  const tsPrevYear = selectedYear === 2026 ? thresholdStatus : null;
                  const prevYear = selectedYear ? selectedYear - 1 : null;
                  return (
                <View style={{ gap: 4 }}>
                  {tsPrevYear && prevYear && (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: '#888' }}>Somme pregresse {prevYear}:</Text>
                        <Text style={{ fontSize: 10, color: '#333' }}>€ {(tsPrevYear?.prior_compensation || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: '#888' }}>Totale somme percepite {prevYear}:</Text>
                        <Text style={{ fontSize: 10, color: '#333' }}>€ {(tsPrevYear?.yearly_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={{ height: 6 }} />
                    </>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Somme pregresse {selectedYear}:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>€ {(selectedYear && selectedYear > (tsPrevYear?.year || 0) ? 0 : (tsCurrentYear?.prior_compensation || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Totale somme percepite {selectedYear} prima del compenso:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>€ {(tsCurrentYear?.yearly_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Totale somme percepite {selectedYear} dopo il compenso:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>€ {((tsCurrentYear?.yearly_total || 0) + declarationAmount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Soglia superata:</Text>
                    <Text style={{ fontSize: 10, color: '#333', fontWeight: '600' }}>€ {declarationType === '5000' ? '5.000,00' : '15.000,00'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 4 }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Timestamp firma:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>{new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                  </View>
                </View>
                  );
                })()}
              </View>

              {/* Signature Pad */}
              <Text style={styles.signatureLabel}>Firma qui sotto:</Text>
              <SignaturePadInline
                onSave={(sig) => {
                  console.log('Declaration signature saved, length:', sig?.length || 0);
                  setDeclarationSignature(sig);
                }}
                onClear={() => {
                  console.log('Declaration signature cleared');
                  setDeclarationSignature(null);
                }}
                height={200}
              />
            </ScrollView>

            {/* Confirm Buttons - OUTSIDE ScrollView for fixed position */}
            <View style={styles.modalButtonsFixed}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeclarationModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                  declarationType === '15000' && { backgroundColor: '#721C24' },
                  !declarationSignature && styles.buttonDisabled
                ]}
                onPress={() => {
                  console.log('Button pressed, declarationSignature:', declarationSignature ? 'SET' : 'NULL');
                  handleSignDeclaration();
                }}
                disabled={signingDeclaration}
              >
                {signingDeclaration ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Firma Dichiarazione</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Step pre-firma: dichiarazione altri compensi (altre ASD/SSD) */}
      <ExternalCompensationStep
        visible={extStepVisible}
        monthLabel={
          extPendingMonth != null && extPendingYear != null
            ? `${MONTH_NAMES[extPendingMonth] || ''} ${extPendingYear}`
            : ''
        }
        ourAmount={
          extPendingMonth != null && extPendingYear != null
            ? (records.find(r => matchesMonth(r.month, extPendingMonth) && r.year === extPendingYear)?.amount_gross
              || records.find(r => matchesMonth(r.month, extPendingMonth) && r.year === extPendingYear)?.amount
              || profile?.monthly_compensation
              || 0)
            : 0
        }
        alreadyCumulated={(() => {
          if (extPendingMonth == null || extPendingYear == null) return 0;
          const signedBefore = records
            .filter(r => r.year === extPendingYear && r.receipt_signed && (typeof r.month === 'number' ? r.month < extPendingMonth : true))
            .reduce((s, r) => s + (r.amount_gross || r.amount || 0), 0);
          const ext = externalByYear[extPendingYear] || 0;
          const contractStartYearLocal = profile?.contract_start_date
            ? parseInt(String(profile.contract_start_date).split('-')[0])
            : null;
          const prior = (extPendingYear === contractStartYearLocal)
            ? (profile?.other_annual_compensation || 0) : 0;
          return signedBefore + ext + prior;
        })()}
        loading={signing || signingDeclaration}
        onCancel={handleExtCancel}
        onConfirm={handleExtConfirm}
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
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backButton: {
    padding: 8,
  },
  backArrow: {
    fontSize: 24,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  summaryTotal: {
    fontSize: 18,
    color: '#007AFF',
  },
  progressSection: {
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressFillExceeded: {
    backgroundColor: '#FF9500',
  },
  warningsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  thresholdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  thresholdBannerContent: {
    flex: 1,
  },
  thresholdBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  thresholdBannerText: {
    fontSize: 12,
    color: '#856404',
    marginTop: 2,
  },
  blockedBanner: {
    backgroundColor: '#FF9500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    marginBottom: 10,
  },
  monthCardSigned: {
    borderColor: '#34C759',
    backgroundColor: '#F0FFF4',
  },
  monthCardSigned5k: {
    borderColor: '#F9A825',
    backgroundColor: '#FFF8E1',
  },
  monthCardSigned15k: {
    borderColor: '#E65100',
    backgroundColor: '#FFF3E0',
  },
  monthCardFuture: {
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    opacity: 0.6,
  },
  monthCardBlocked: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF8E6',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  monthName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  monthAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginVertical: 4,
  },
  signedDate: {
    fontSize: 9,
    color: '#34C759',
  },
  pendingText: {
    fontSize: 9,
    color: '#007AFF',
  },
  blockedText: {
    fontSize: 9,
    color: '#FF9500',
  },
  futureText: {
    fontSize: 9,
    color: '#999',
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 40,  // Extra padding to ensure buttons are visible above keyboard/bottom
  },
  receiptPreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  receiptPreviewCompact: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  receiptTitleCompact: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  receiptText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 22,
  },
  receiptTextCompact: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    flex: 1,
    lineHeight: 20,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  modalButtonsFixed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  // Enhanced Year Summary Styles
  priorCompBox: {
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  priorCompLabel: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 4,
  },
  priorCompValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E65100',
  },
  contractPeriodBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  contractPeriodLabel: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
    marginBottom: 4,
  },
  contractPeriodValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  yearCalcHeader: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  yearCalcHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  yearBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  yearBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  yearBoxCalc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  yearBoxTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  thresholdWarningBox5k: {
    backgroundColor: '#FFF3E0',
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  thresholdWarningTitle5k: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: 'bold',
  },
  thresholdWarningText5k: {
    fontSize: 12,
    color: '#F57F17',
    marginTop: 2,
  },
  thresholdWarningBox15k: {
    backgroundColor: '#F3E5F5',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  thresholdWarningTitle15k: {
    fontSize: 14,
    color: '#6C3483',
    fontWeight: 'bold',
  },
  thresholdWarningText15k: {
    fontSize: 12,
    color: '#8E44AD',
    marginTop: 2,
  },
  // Banner "Dichiarazione firmata" (verde, stile bordato/centrato)
  thresholdSignedBox: {
    backgroundColor: '#D4EDDA',
    borderWidth: 2,
    borderColor: '#28A745',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  thresholdSignedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#155724',
    textAlign: 'center',
    marginBottom: 6,
  },
  thresholdSignedBody: {
    fontSize: 13,
    color: '#155724',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  totalContractBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#81C784',
  },
  totalContractLabel: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 4,
  },
  totalContractValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  totalContractSubtext: {
    fontSize: 12,
    color: '#388E3C',
    marginTop: 4,
  },
  // Unified contract banner styles
  unifiedContractBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  unifiedBannerPeriod: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
    marginBottom: 4,
  },
  unifiedBannerCalc: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  unifiedBannerPrior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  unifiedBannerPriorLabel: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
  },
  unifiedBannerPriorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
  },
  unifiedBannerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  unifiedBannerTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  unifiedBannerTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
});
