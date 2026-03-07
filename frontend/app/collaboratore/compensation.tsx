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
import SignaturePadInline from '../../src/components/SignaturePadInline';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
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

// Helper to convert base64 to Blob for PDF viewing
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
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
  receipt_signed: boolean;  // Backend saves as receipt_signed for collaboratori
  receipt_signed_date?: string;
  receipt_document_id?: string;
  exceeded_5000: boolean;
  exceeded_15000: boolean;
}

interface CollaboratoreProfile {
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
  collaboratore_id: string;
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

export default function CollaboratoreCompensation() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CollaboratoreProfile | null>(null);
  const [records, setRecords] = useState<CompensationRecord[]>([]);
  const [yearlyTotal, setYearlyTotal] = useState(0);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  
  // Contract dates
  const [contractStartYear, setContractStartYear] = useState<number | null>(null);
  const [contractEndYear, setContractEndYear] = useState<number | null>(null);
  const [contractStartMonth, setContractStartMonth] = useState<number | null>(null);
  const [contractEndMonth, setContractEndMonth] = useState<number | null>(null);
  const [priorCompensation, setPriorCompensation] = useState(0);
  
  // Threshold status per year
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
      const recordsRes = await api.get(`/collaboratore/${user?.id}/compensation`);
      console.log('Loaded collaboratore compensation records:', recordsRes.data);
      // API returns {collaboratore: {...}, records: [...]} - extract the records array
      const recordsArray = Array.isArray(recordsRes.data) 
        ? recordsRes.data 
        : (recordsRes.data?.records || []);
      setRecords(recordsArray);
      
      // Calculate yearly total for current display year (including prior compensation for first year)
      const totalFromReceipts = recordsArray
        .filter((r: CompensationRecord) => r.year === currentYear && r.receipt_signed)
        .reduce((sum: number, r: CompensationRecord) => sum + (r.amount_gross || r.amount || 0), 0);
      
      // Add prior compensation if this is the first year of the contract
      const priorComp = profileRes.data.other_annual_compensation || 0;
      const total = (currentYear === startYear) ? totalFromReceipts + priorComp : totalFromReceipts;
      setYearlyTotal(total);
      
      // Load threshold status for contract start year (where thresholds matter most)
      const thresholdYear = startYear || currentYear;
      try {
        const thresholdRes = await api.get(`/collaboratore/${user?.id}/threshold-status/${thresholdYear}`);
        setThresholdStatus(thresholdRes.data);
        
        // Also load 2026 threshold status if needed
        if (currentYear >= 2026 || (startYear && startYear < 2026)) {
          const threshold2026Res = await api.get(`/collaboratore/${user?.id}/threshold-status/2026`);
          setThresholdStatus2026(threshold2026Res.data);
        }
      } catch (err) {
        console.log('Error loading threshold status:', err);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSignature = (month: number, year?: number) => {
    // Prevent action if still loading
    if (loading) {
      console.log('Still loading, ignoring click');
      return;
    }
    
    const targetYear = year || currentYear;
    
    // Calculate if this month will exceed thresholds
    const monthlyAmount = profile?.monthly_compensation || 0;
    const priorComp = profile?.other_annual_compensation || 0;
    
    // Get contract start year
    let contractStartYearLocal = null;
    if (profile?.contract_start_date) {
      contractStartYearLocal = parseInt(profile.contract_start_date.split('-')[0]);
    }
    
    // Calculate total before this month - use matchesMonth helper for legacy support
    const yearRecords = records.filter(r => r.year === targetYear && r.receipt_signed);
    const yearTotalFromReceipts = yearRecords.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
    const yearTotalBeforeThis = (targetYear === contractStartYearLocal) 
      ? yearTotalFromReceipts + priorComp 
      : yearTotalFromReceipts;
    
    const newTotal = yearTotalBeforeThis + monthlyAmount;
    
    // Check if THIS month will be the first to EXCEED thresholds (go OVER, not just reach)
    // €5.000 esatti = ancora esente, €5.001 = superamento
    // €15.000 esatti = ancora solo contributi, €15.001 = superamento fiscale
    const willExceed5k = newTotal > 5000 && yearTotalBeforeThis <= 5000;
    const willExceed15k = newTotal > 15000 && yearTotalBeforeThis <= 15000;
    
    console.log('Threshold check for modal:', { yearTotalBeforeThis, monthlyAmount, newTotal, willExceed5k, willExceed15k });
    
    // Use the correct threshold status based on year
    const relevantThresholdStatus = targetYear === 2026 ? thresholdStatus2026 : thresholdStatus;
    
    // Check if blocked by threshold (already exceeded but not declared)
    if (relevantThresholdStatus?.is_blocked) {
      Alert.alert(
        'Azione Bloccata',
        relevantThresholdStatus.block_reason || 'Devi prima firmare la dichiarazione di superamento soglia.',
        [
          { text: 'Annulla', style: 'cancel' },
          { 
            text: 'Firma Dichiarazione', 
            onPress: () => {
              // Determine which declaration is needed
              if (relevantThresholdStatus.thresholds['15000'].needs_declaration) {
                openDeclarationModal('15000');
              } else if (relevantThresholdStatus.thresholds['5000'].needs_declaration) {
                openDeclarationModal('5000');
              }
            }
          }
        ]
      );
      return;
    }
    
    // Check if this month is already signed - use matchesMonth for legacy support
    const existingRecord = records.find(r => matchesMonth(r.month, month) && r.year === targetYear && r.receipt_signed);
    if (existingRecord) {
      Alert.alert('Già firmata', 'La quietanza per questo mese è già stata firmata.');
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
    // Also set selected month/year in signature modal state for when declaration is done
    setSignatureModalState(prev => ({ ...prev, month, year }));
    setShowDeclarationModal(true);
  };

  const openDeclarationModal = (type: '5000' | '15000') => {
    setDeclarationType(type);
    setDeclarationSignature(null);
    setShowDeclarationModal(true);
  };

  const handleSignDeclaration = async () => {
    if (!declarationSignature) {
      Alert.alert('Errore', 'Firma richiesta');
      return;
    }
    
    // Use current month if selectedMonth is not set
    const monthToUse = selectedMonth ?? new Date().getMonth() + 1;
    const yearToUse = selectedYear || new Date().getFullYear();
    
    try {
      setSigningDeclaration(true);
      
      // Use the compensation receipt endpoint which now generates the correct threshold document
      const response = await api.post(`/collaboratore/${user?.id}/compensation/receipt`, {
        month: monthToUse,
        year: yearToUse,
        amount_gross: profile?.monthly_compensation || 0,
        signature_base64: declarationSignature.replace('data:image/png;base64,', ''),
        exceeded_5000: declarationType === '5000',
        exceeded_15000: declarationType === '15000',
      });
      
      const thresholdAmount = declarationType === '5000' ? '5.000' : '15.000';
      const monthName = MONTH_NAMES[monthToUse || 0];
      
      // Show PDF if available
      if (response.data.pdf_base64 && Platform.OS === 'web') {
        const pdfBlob = base64ToBlob(response.data.pdf_base64, 'application/pdf');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }
      
      Alert.alert(
        'Dichiarazione Firmata',
        `Comunicazione di superamento soglia € ${thresholdAmount} per ${monthName} ${selectedYear} firmata con successo!\n\nCompreso lordo: € ${response.data.amount_gross.toFixed(2)}\nTotale annuo: € ${response.data.yearly_total.toFixed(2)}\n\nUna copia è stata inviata alla tua email e alla società.`
      );
      
      setShowDeclarationModal(false);
      setDeclarationSignature(null);
      
      // Delay loadData to avoid state conflicts
      setTimeout(() => {
        loadData();
      }, 500);
      
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la firma');
    } finally {
      setSigningDeclaration(false);
    }
  };

  const handleSign = async () => {
    if (!signature || !selectedMonth || !profile) {
      Alert.alert('Errore', 'Firma richiesta');
      return;
    }
    
    try {
      setSigning(true);
      
      // Calculate if thresholds will be exceeded
      const monthlyAmount = profile.monthly_compensation || 0;
      const priorComp = profile.other_annual_compensation || 0;
      
      // Calculate total for the selected year (not current display year)
      const yearRecords = records.filter(r => r.year === selectedYear && r.receipt_signed);
      const yearTotalFromReceipts = yearRecords.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
      
      // Get contract start year to determine if prior compensation applies
      let contractStartYearLocal = null;
      if (profile.contract_start_date) {
        contractStartYearLocal = parseInt(profile.contract_start_date.split('-')[0]);
      }
      
      // Include prior compensation only for the first year of contract
      const yearTotalBeforeThis = (selectedYear === contractStartYearLocal) 
        ? yearTotalFromReceipts + priorComp 
        : yearTotalFromReceipts;
      
      const newTotal = yearTotalBeforeThis + monthlyAmount;
      
      // Check if THIS month causes the threshold to be exceeded
      const exceeded5000 = newTotal > 5000 && yearTotalBeforeThis <= 5000;
      const exceeded15000 = newTotal > 15000 && yearTotalBeforeThis <= 15000;
      
      console.log('Threshold calculation:', { yearTotalBeforeThis, monthlyAmount, newTotal, exceeded5000, exceeded15000, priorComp, contractStartYearLocal, selectedYear });
      
      const response = await api.post(`/collaboratore/${user?.id}/compensation/receipt`, {
        month: selectedMonth,
        year: selectedYear,
        amount_gross: profile.monthly_compensation,
        signature_base64: signature.replace('data:image/png;base64,', ''),
        exceeded_5000: exceeded5000,
        exceeded_15000: exceeded15000,
      });
      
      // Close modal FIRST, then show success message
      closeSignatureModal();
      
      // Show PDF if available
      if (response.data.pdf_base64 && Platform.OS === 'web') {
        const pdfBlob = base64ToBlob(response.data.pdf_base64, 'application/pdf');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }
      
      Alert.alert(
        'Quietanza Firmata',
        `Quietanza firmata con successo!\n\nLordo: € ${response.data.amount_gross.toFixed(2)}\nNetto: € ${response.data.amount_net.toFixed(2)}\n\nTotale annuo: € ${response.data.yearly_total.toFixed(2)}`
      );
      
      loadData();
      
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la firma');
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
    if (record?.receipt_signed) {
      return 'signed';
    }
    
    // Use the correct threshold status based on year
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
    const yearlyFromContract = monthlyComp * monthCount;
    
    // Add prior compensation only for the first year of contract
    const includePrior = year === contractStartYear;
    const prior = includePrior ? priorCompensation : 0;
    const total = yearlyFromContract + prior;
    
    // Calculate signed total for this year
    const signedTotal = records
      .filter(r => r.year === year && r.receipt_signed)
      .reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
    
    return {
      year,
      monthCount,
      monthlyComp,
      yearlyFromContract,
      priorCompensation: prior,
      totalProjected: total,
      signedTotal: signedTotal + prior,
      months: monthsInYear,
    };
  };

  const renderThresholdWarnings = () => {
    if (!thresholdStatus) return null;
    
    const warnings = [];
    
    // Warning for approaching €5.000
    if (thresholdStatus.thresholds['5000'].needs_warning && !thresholdStatus.thresholds['5000'].declaration_signed) {
      warnings.push(
        <View key="warning-5000" style={[styles.thresholdBanner, { backgroundColor: '#FFF3CD' }]}>
          <Ionicons name="warning" size={18} color="#856404" />
          <View style={styles.thresholdBannerContent}>
            <Text style={styles.thresholdBannerTitle}>Attenzione: Prossima soglia €5.000</Text>
            <Text style={styles.thresholdBannerText}>
              Con la prossima quietanza supererai la soglia previdenziale di €5.000.
            </Text>
          </View>
        </View>
      );
    }
    
    // Warning for approaching €15.000
    if (thresholdStatus.thresholds['15000'].needs_warning && !thresholdStatus.thresholds['15000'].declaration_signed) {
      warnings.push(
        <View key="warning-15000" style={[styles.thresholdBanner, { backgroundColor: '#F8D7DA' }]}>
          <Ionicons name="alert-circle" size={18} color="#721C24" />
          <View style={styles.thresholdBannerContent}>
            <Text style={[styles.thresholdBannerTitle, { color: '#721C24' }]}>Attenzione: Prossima soglia €15.000</Text>
            <Text style={[styles.thresholdBannerText, { color: '#721C24' }]}>
              Con la prossima quietanza supererai la soglia fiscale di €15.000.
            </Text>
          </View>
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
      warnings.push(
        <View key="signed-5000" style={[styles.thresholdBanner, { backgroundColor: '#D4EDDA' }]}>
          <Ionicons name="checkmark-circle" size={18} color="#155724" />
          <View style={styles.thresholdBannerContent}>
            <Text style={[styles.thresholdBannerTitle, { color: '#155724' }]}>
              Dichiarazione €5.000 firmata
            </Text>
            <Text style={[styles.thresholdBannerText, { color: '#155724' }]}>
              Soglia previdenziale comunicata
            </Text>
          </View>
        </View>
      );
    }
    
    if (thresholdStatus.thresholds['15000'].declaration_signed) {
      warnings.push(
        <View key="signed-15000" style={[styles.thresholdBanner, { backgroundColor: '#D4EDDA' }]}>
          <Ionicons name="checkmark-circle" size={18} color="#155724" />
          <View style={styles.thresholdBannerContent}>
            <Text style={[styles.thresholdBannerTitle, { color: '#155724' }]}>
              Dichiarazione €15.000 firmata
            </Text>
            <Text style={[styles.thresholdBannerText, { color: '#155724' }]}>
              Soglia fiscale comunicata
            </Text>
          </View>
        </View>
      );
    }
    
    return warnings.length > 0 ? <View style={styles.warningsContainer}>{warnings}</View> : null;
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
    
    for (const r of sorted) {
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
    const monthlyAmount = profile?.monthly_compensation || 0;
    
    // Check if threshold was exceeded in this specific month (for badge)
    const exceeded5k = record?.exceeded_5000 === true;
    const exceeded15k = record?.exceeded_15000 === true;
    
    // Check if this month is after threshold was crossed IN THE SAME YEAR (for highlighting)
    const thresholdsByYear = getThresholdMonths();
    const isAfter5k = status === 'signed' && isMonthAfterThreshold(month, displayYear, thresholdsByYear, '5k');
    const isAfter15k = status === 'signed' && isMonthAfterThreshold(month, displayYear, thresholdsByYear, '15k');
    
    // Determine the card style based on threshold status
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
    
    return (
      <TouchableOpacity
        key={`${displayYear}-${month}`}
        style={[
          styles.monthCard,
          getCardStyle(),
          // Purple background when exceeded €15k
          exceeded15k && status === 'signed' && { backgroundColor: '#F3E5F5', borderColor: '#8E44AD' },
        ]}
        onPress={() => (status === 'pending' || status === 'blocked') && handleOpenSignature(month, displayYear)}
        disabled={status === 'future'}
        data-testid={`month-card-${displayYear}-${month}`}
      >
        {/* Threshold Badge - positioned at top right */}
        {(exceeded5k || exceeded15k) && (
          <View style={{
            position: 'absolute',
            top: -8,
            right: -8,
            backgroundColor: exceeded15k ? '#8E44AD' : '#F9A825',
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 8,
            zIndex: 10,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
              {exceeded15k ? '>15K' : '>5K'}
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compensi Sportivi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Collaboratore Name and Profile Link */}
        <View style={{ marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="person-circle" size={50} color="#007AFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>{profile?.full_name || 'Collaboratore'}</Text>
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
                {(() => {
                  // Handle ISO date format with timezone
                  const formatContractDate = (dateStr: string) => {
                    try {
                      // Remove timezone part if present (everything after 'T' or the date itself)
                      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                      const parts = cleanDate.split('-');
                      if (parts.length === 3) {
                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                      }
                      return dateStr;
                    } catch {
                      return dateStr;
                    }
                  };
                  const startFormatted = formatContractDate(profile.contract_start_date!);
                  const endFormatted = formatContractDate(profile.contract_end_date!);
                  return `${startFormatted} - ${endFormatted}`;
                })()}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F8FF', padding: 12, borderRadius: 8 }}
            onPress={() => router.push('/collaboratore/profile')}
          >
            <Ionicons name="create-outline" size={20} color="#007AFF" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 15 }}>Il Mio Profilo</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Dati personali, documento e IBAN</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        {/* Year Summaries - Contract-based - ENHANCED STYLE */}
        {contractStartYear && contractEndYear && (
          <>
            {/* Combined: Pregressi + Periodo Contratto + Totale RAS - Single unified banner */}
            <View style={styles.unifiedContractBanner}>
              {/* Header: Periodo Contratto */}
              <Text style={styles.unifiedBannerPeriod}>
                Periodo Contratto: {MONTH_NAMES[contractStartMonth || 1]} {contractStartYear} - {MONTH_NAMES[contractEndMonth || 1]} {contractEndYear}
              </Text>
              
              {/* Calculation row */}
              <Text style={styles.unifiedBannerCalc}>
                {formatCurrency(profile?.monthly_compensation || 0)} × {(() => {
                  const months1 = getContractMonthsForYear(contractStartYear).length;
                  const months2 = contractEndYear > contractStartYear ? getContractMonthsForYear(contractEndYear).length : 0;
                  return months1 + months2;
                })()} mesi = {formatCurrency((() => {
                  const months1 = getContractMonthsForYear(contractStartYear).length;
                  const months2 = contractEndYear > contractStartYear ? getContractMonthsForYear(contractEndYear).length : 0;
                  return (profile?.monthly_compensation || 0) * (months1 + months2);
                })())}
              </Text>
              
              {/* Prior compensation if any */}
              {priorCompensation > 0 && (
                <View style={styles.unifiedBannerPrior}>
                  <Text style={styles.unifiedBannerPriorLabel}>+ Compensi Pregressi (dichiarati)</Text>
                  <Text style={styles.unifiedBannerPriorValue}>{formatCurrency(priorCompensation)}</Text>
                </View>
              )}
              
              {/* Total for RAS */}
              <View style={styles.unifiedBannerTotal}>
                <Text style={styles.unifiedBannerTotalLabel}>TOTALE PER RAS:</Text>
                <Text style={styles.unifiedBannerTotalValue}>
                  {formatCurrency((() => {
                    const months1 = getContractMonthsForYear(contractStartYear).length;
                    const months2 = contractEndYear > contractStartYear ? getContractMonthsForYear(contractEndYear).length : 0;
                    return (profile?.monthly_compensation || 0) * (months1 + months2) + (priorCompensation || 0);
                  })())}
                </Text>
              </View>
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
                  
                  {/* Calculation breakdown */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={styles.yearBoxCalcLabel}>Compenso ASD:</Text>
                    <Text style={styles.yearBoxCalcValue}>{formatCurrency(summary.yearlyFromContract)}</Text>
                  </View>
                  {summary.priorCompensation > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[styles.yearBoxCalcLabel, { color: '#FF9800' }]}>+ Pregressi:</Text>
                      <Text style={[styles.yearBoxCalcValue, { color: '#FF9800' }]}>{formatCurrency(summary.priorCompensation)}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 8 }}>
                    <Text style={[styles.yearBoxCalcLabel, { fontWeight: '700' }]}>Totale:</Text>
                    <Text style={[styles.yearBoxTotal, { color: exceeds15k ? '#C62828' : exceeds5k ? '#F57F17' : headerColor }]}>{formatCurrency(summary.totalProjected)}</Text>
                  </View>
                  
                  {/* Threshold Warnings - Show both if both exceeded */}
                  {exceeds5k && (
                    <View style={styles.thresholdWarningBox5k}>
                      <Text style={styles.thresholdWarningTitle5k}>⚠️ SUPERAMENTO € 5.000,00</Text>
                      <Text style={styles.thresholdWarningText5k}>Contributi previdenziali INPS</Text>
                    </View>
                  )}
                  {exceeds15k && (
                    <View style={styles.thresholdWarningBox15k}>
                      <Text style={styles.thresholdWarningTitle15k}>🚨 SUPERAMENTO € 15.000,00</Text>
                      <Text style={styles.thresholdWarningText15k}>Tassazione IRPEF obbligatoria</Text>
                    </View>
                  )}
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
                  
                  {/* Calculation breakdown */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={styles.yearBoxCalcLabel}>Compenso ASD:</Text>
                    <Text style={styles.yearBoxCalcValue}>{formatCurrency(summary.yearlyFromContract)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 8 }}>
                    <Text style={[styles.yearBoxCalcLabel, { fontWeight: '700' }]}>Totale Anno:</Text>
                    <Text style={[styles.yearBoxTotal, { color: exceeds15k ? '#C62828' : exceeds5k ? '#F57F17' : headerColor }]}>{formatCurrency(summary.totalProjected)}</Text>
                  </View>
                  
                  {/* Threshold Warnings - Show both if both exceeded */}
                  {exceeds5k && (
                    <View style={styles.thresholdWarningBox5k}>
                      <Text style={styles.thresholdWarningTitle5k}>⚠️ SUPERAMENTO € 5.000,00</Text>
                      <Text style={styles.thresholdWarningText5k}>Contributi previdenziali INPS</Text>
                    </View>
                  )}
                  {exceeds15k && (
                    <View style={styles.thresholdWarningBox15k}>
                      <Text style={styles.thresholdWarningTitle15k}>🚨 SUPERAMENTO € 15.000,00</Text>
                      <Text style={styles.thresholdWarningText15k}>Tassazione IRPEF obbligatoria</Text>
                    </View>
                  )}
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {/* Receipt Preview - Compact Version */}
              <View style={[styles.receiptPreview, { padding: 12, marginBottom: 8, backgroundColor: '#FFFBF0', borderWidth: 1, borderColor: '#E0D5C0' }]}>
                <Text style={[styles.receiptTitle, { fontSize: 13, marginBottom: 8, textAlign: 'center', fontWeight: '700' }]}>
                  QUIETANZA COMPENSO SPORTIVO
                </Text>
                
                <View style={{ borderTopWidth: 1, borderTopColor: '#E0D5C0', paddingTop: 8 }}>
                  <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#666', marginBottom: 1 }}>COLLABORATORE</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{profile?.full_name}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#666', marginBottom: 1 }}>CODICE FISCALE</Text>
                      <Text style={{ fontSize: 11, color: '#333' }}>{profile?.fiscal_code || 'N/D'}</Text>
                    </View>
                  </View>
                  
                  <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#666', marginBottom: 1 }}>PERIODO</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>
                        {MONTH_NAMES[selectedMonth || 0]} {selectedYear}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#666', marginBottom: 1 }}>IMPORTO LORDO</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7D32' }}>
                        {formatCurrency(profile?.monthly_compensation || 0)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ backgroundColor: '#F5F5F5', padding: 8, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, color: '#666', textAlign: 'center', lineHeight: 14 }}>
                      Il sottoscritto dichiara di aver ricevuto il compenso sopra indicato per l'attività sportiva dilettantistica svolta nel mese di riferimento.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Signature Pad */}
              <View style={{ marginBottom: 6 }}>
                <Text style={[styles.signatureLabel, { marginBottom: 6 }]}>Firma qui sotto:</Text>
                <SignaturePadInline
                  ref={signatureRef}
                  onSave={(sig) => setSignature(sig)}
                  onClear={() => setSignature(null)}
                  height={120}
                />
              </View>
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
                  !signature && styles.buttonDisabled
                ]}
                onPress={handleSign}
                disabled={!signature || signing}
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

              {/* Metadata Section - Verifiable Data */}
              <View style={{ backgroundColor: '#F5F5F5', padding: 12, marginVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 8, textAlign: 'center' }}>
                  METADATI DI VERIFICA
                </Text>
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Compensi pregressi dichiarati:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>
                      € {(thresholdStatus?.prior_compensation || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Totale annuo prima del compenso:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>
                      € {(thresholdStatus?.total_with_prior || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Totale annuo dopo il compenso:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>
                      € {((thresholdStatus?.total_with_prior || 0) + (profile?.monthly_compensation || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Soglia superata:</Text>
                    <Text style={{ fontSize: 10, color: '#333', fontWeight: '600' }}>€ {declarationType === '5000' ? '5.000,00' : '15.000,00'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 4 }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Timestamp firma (UTC):</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>{new Date().toISOString()}</Text>
                  </View>
                </View>
              </View>

              {/* Signature Pad */}
              <Text style={styles.signatureLabel}>Firma qui sotto:</Text>
              <SignaturePadInline
                onSave={(sig) => setDeclarationSignature(sig)}
                onClear={() => setDeclarationSignature(null)}
                height={150}
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
                onPress={handleSignDeclaration}
                disabled={!declarationSignature || signingDeclaration}
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
  receiptTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  receiptText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 22,
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
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#F44336',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  thresholdWarningTitle15k: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: 'bold',
  },
  thresholdWarningText15k: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 2,
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
  // Unified Banner Styles (same as Coach)
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
  // Year Box Calculation Styles (same as Coach)
  yearBoxCalcLabel: {
    fontSize: 14,
    color: '#666',
  },
  yearBoxCalcValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
