import React, { useState, useEffect, useRef } from 'react';
import SocietyBranding from '../../src/components/SocietyBranding';
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

interface CompensationRecord {
  id: string;
  month: number | string;  // Can be number (1-12) or string ("Gennaio", etc.) for legacy data
  year: number;
  amount_gross?: number;
  amount_net?: number;
  amount?: number;
  deductions?: number;
  received: boolean;
  received_date?: string;
  receipt_signed: boolean;
  receipt_signed_date?: string;
  receipt_document_id?: string;
  exceeded_5000: boolean;
  exceeded_15000: boolean;
}

interface DirigenteProfile {
  id: string;
  full_name: string;
  fiscal_code?: string;
  monthly_compensation: number;
  compensation_accepted: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  other_annual_compensation?: number;
}

interface ThresholdStatus {
  dirigente_id: string;
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

export default function DirigenteCompensation() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DirigenteProfile | null>(null);
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
  
  // Threshold status
  const [thresholdStatus, setThresholdStatus] = useState<ThresholdStatus | null>(null);
  const [thresholdStatus2026, setThresholdStatus2026] = useState<ThresholdStatus | null>(null);
  
  // Signature modal for receipts
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  
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
      
      // Set prior compensation
      setPriorCompensation(profileRes.data.other_annual_compensation || 0);
      
      // Load ALL compensation records
      const recordsRes = await api.get(`/dirigente/${user?.id}/compensation`);
      setRecords(recordsRes.data || []);
      
      // Calculate yearly total for current display year
      const totalFromReceipts = (recordsRes.data || [])
        .filter((r: CompensationRecord) => r.year === currentYear && r.receipt_signed)
        .reduce((sum: number, r: CompensationRecord) => sum + (r.amount_gross || r.amount || 0), 0);
      
      const priorComp = profileRes.data.other_annual_compensation || 0;
      const total = (currentYear === startYear) ? totalFromReceipts + priorComp : totalFromReceipts;
      setYearlyTotal(total);
      
      // Load threshold status
      const thresholdYear = startYear || currentYear;
      try {
        const thresholdRes = await api.get(`/dirigente/${user?.id}/threshold-status/${thresholdYear}`);
        setThresholdStatus(thresholdRes.data);
      } catch (err) {
        console.log('Error loading threshold status:', err);
      }
      
      // Load threshold status for second year (2026) if contract spans multiple years
      if (endYear && endYear > (startYear || currentYear)) {
        try {
          const thresholdRes2026 = await api.get(`/dirigente/${user?.id}/threshold-status/${endYear}`);
          setThresholdStatus2026(thresholdRes2026.data);
        } catch (err) {
          console.log('Error loading 2026 threshold status:', err);
        }
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const handleOpenSignature = (month: number, year?: number) => {
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
    
    let contractStartYearLocal = null;
    if (profile?.contract_start_date) {
      contractStartYearLocal = parseInt(profile.contract_start_date.split('-')[0]);
    }
    
    const yearRecords = records.filter(r => r.year === targetYear && r.receipt_signed && r.month < month);
    const yearTotalFromReceipts = yearRecords.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
    const yearTotalBeforeThis = (targetYear === contractStartYearLocal) 
      ? yearTotalFromReceipts + priorComp 
      : yearTotalFromReceipts;
    
    const newTotal = yearTotalBeforeThis + amountForThisMonth;
    
    const willExceed5k = newTotal > 5000 && yearTotalBeforeThis <= 5000;
    const willExceed15k = newTotal > 15000 && yearTotalBeforeThis <= 15000;
    
    if (thresholdStatus?.is_blocked) {
      Alert.alert(
        'Azione Bloccata',
        thresholdStatus.block_reason || 'Devi prima firmare la dichiarazione di superamento soglia.',
        [
          { text: 'Annulla', style: 'cancel' },
          { 
            text: 'Firma Dichiarazione', 
            onPress: () => {
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
    
    // Check if already signed
    if (existingRecord?.receipt_signed) {
      Alert.alert('Già firmata', 'La quietanza per questo mese è già stata firmata.');
      return;
    }
    
    setSelectedMonth(month);
    setSelectedYear(targetYear);
    setSignature(null);
    
    if (willExceed15k) {
      openDeclarationModalForMonth('15000', month, targetYear);
    } else if (willExceed5k) {
      openDeclarationModalForMonth('5000', month, targetYear);
    } else {
      setShowSignatureModal(true);
    }
  };

  const openDeclarationModalForMonth = (type: '5000' | '15000', month: number, year: number) => {
    setDeclarationType(type);
    setDeclarationSignature(null);
    setSelectedMonth(month);
    setSelectedYear(year);
    setShowDeclarationModal(true);
  };

  const openDeclarationModal = (type: '5000' | '15000') => {
    setDeclarationType(type);
    setDeclarationSignature(null);
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
      
      const response = await api.post(`/dirigente/${user?.id}/compensation/receipt`, {
        month: selectedMonth,
        year: selectedYear,
        amount_gross: amountToSign,
        signature_base64: declarationSignature.replace('data:image/png;base64,', ''),
        exceeded_5000: declarationType === '5000',
        exceeded_15000: declarationType === '15000',
      });
      
      const thresholdAmount = declarationType === '5000' ? '5.000' : '15.000';
      const monthName = MONTH_NAMES[selectedMonth || 0];
      
      Alert.alert(
        'Dichiarazione Firmata',
        `Comunicazione di superamento soglia € ${thresholdAmount} per ${monthName} ${selectedYear} firmata con successo!\n\nCompreso lordo: € ${response.data.amount_gross.toFixed(2)}\nTotale annuo: € ${response.data.yearly_total.toFixed(2)}\n\nUna copia è stata inviata alla tua email e alla società.`
      );
      
      setShowDeclarationModal(false);
      loadData();
      
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
      
      // Check if there's an existing record with a custom amount set by Admin
      const existingRecord = records.find(r => r.month === selectedMonth && r.year === selectedYear);
      const amountToSign = existingRecord?.amount_gross || existingRecord?.amount || profile.monthly_compensation || 0;
      
      const priorComp = profile.other_annual_compensation || 0;
      
      const yearRecords = records.filter(r => r.year === selectedYear && r.receipt_signed && r.month < selectedMonth);
      const yearTotalFromReceipts = yearRecords.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);
      
      let contractStartYearLocal = null;
      if (profile.contract_start_date) {
        contractStartYearLocal = parseInt(profile.contract_start_date.split('-')[0]);
      }
      
      const yearTotalBeforeThis = (selectedYear === contractStartYearLocal) 
        ? yearTotalFromReceipts + priorComp 
        : yearTotalFromReceipts;
      
      const newTotal = yearTotalBeforeThis + amountToSign;
      
      const exceeded5000 = newTotal > 5000 && yearTotalBeforeThis <= 5000;
      const exceeded15000 = newTotal > 15000 && yearTotalBeforeThis <= 15000;
      
      const response = await api.post(`/dirigente/${user?.id}/compensation/receipt`, {
        month: selectedMonth,
        year: selectedYear,
        amount_gross: amountToSign,
        signature_base64: signature.replace('data:image/png;base64,', ''),
        exceeded_5000: exceeded5000,
        exceeded_15000: exceeded15000,
      });
      
      Alert.alert(
        'Quietanza Firmata',
        `Quietanza firmata con successo!\n\nLordo: € ${response.data.amount_gross.toFixed(2)}\nNetto: € ${response.data.amount_net.toFixed(2)}\n\nTotale annuo: € ${response.data.yearly_total.toFixed(2)}`
      );
      
      setShowSignatureModal(false);
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
    
    if (checkYear === currentYearActual && month > currentMonthActual) {
      return 'future';
    }
    if (checkYear > currentYearActual) {
      return 'future';
    }
    
    // Use matchesMonth helper for legacy data support
    const record = records.find(r => matchesMonth(r.month, month) && r.year === checkYear);
    if (record?.receipt_signed) {
      return 'signed';
    }
    if (thresholdStatus?.is_blocked) {
      return 'blocked';
    }
    return 'pending';
  };
  
  const getContractMonthsForYear = (year: number): number[] => {
    if (!contractStartYear || !contractEndYear || !contractStartMonth || !contractEndMonth) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    
    const months: number[] = [];
    
    if (year === contractStartYear && year === contractEndYear) {
      for (let m = contractStartMonth; m <= contractEndMonth; m++) {
        months.push(m);
      }
    } else if (year === contractStartYear) {
      for (let m = contractStartMonth; m <= 12; m++) {
        months.push(m);
      }
    } else if (year === contractEndYear) {
      for (let m = 1; m <= contractEndMonth; m++) {
        months.push(m);
      }
    } else if (year > contractStartYear && year < contractEndYear) {
      for (let m = 1; m <= 12; m++) {
        months.push(m);
      }
    }
    
    return months;
  };
  
  const getYearSummary = (year: number) => {
    const monthsInYear = getContractMonthsForYear(year);
    const monthlyComp = profile?.monthly_compensation || 0;
    const monthCount = monthsInYear.length;
    const yearlyFromContractBase = monthlyComp * monthCount;  // Base compensation
    
    // Calculate actual total from receipts (includes custom amounts)
    let actualYearlyTotal = 0;
    let supplementaryTotal = 0;
    
    monthsInYear.forEach(month => {
      const receipt = records.find(r => r.year === year && r.month === month);
      const receiptAmount = receipt?.amount_gross || receipt?.amount || monthlyComp;
      actualYearlyTotal += receiptAmount;
      
      // Calculate supplementary (amount above standard monthly)
      if (receiptAmount > monthlyComp) {
        supplementaryTotal += receiptAmount - monthlyComp;
      }
    });
    
    // Add prior compensation only for the first year of contract
    const includePrior = year === contractStartYear;
    const prior = includePrior ? priorCompensation : 0;
    const total = actualYearlyTotal + prior;  // Use actual amounts, not base
    
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
      priorCompensation: prior,
      totalProjected: total,
      signedTotal: signedTotal + prior,
      months: monthsInYear,
    };
  };

  const renderThresholdWarnings = () => {
    if (!thresholdStatus) return null;
    
    const warnings = [];
    
    // Calculate which month the threshold is actually crossed for each year
    const monthlyComp = profile?.monthly_compensation || 0;
    const priorComp = profile?.other_annual_compensation || 0;
    
    const findThresholdMonth = (year: number, threshold: number) => {
      // Generate all months for the given year based on contract period
      let months: number[] = [];
      if (year === contractStartYear && contractStartMonth) {
        // First year: from contract start month to December
        for (let m = contractStartMonth; m <= 12; m++) months.push(m);
      } else if (year === contractEndYear && contractEndMonth) {
        // Second year: from January to contract end month
        for (let m = 1; m <= contractEndMonth; m++) months.push(m);
      }
      
      const prior = (year === contractStartYear) ? priorComp : 0;
      let cumulative = prior;
      
      for (const m of months) {
        // Check if there's an actual record with a different amount (e.g., special month)
        const existingRecord = records.find(r => r.year === year && r.month === m);
        const amt = existingRecord ? (existingRecord.amount_gross || existingRecord.amount || monthlyComp) : monthlyComp;
        cumulative += amt;
        if (cumulative > threshold) {
          return MONTH_NAMES[m] || '';
        }
      }
      return '';
    };
    
    const thresholdMonth5k_y1 = findThresholdMonth(contractStartYear, 5000);
    const thresholdMonth15k_y1 = findThresholdMonth(contractStartYear, 15000);
    const thresholdMonth5k_y2 = findThresholdMonth(contractStartYear + 1, 5000);
    const thresholdMonth15k_y2 = findThresholdMonth(contractStartYear + 1, 15000);
    
    // ==================== FIRST YEAR (contractStartYear) WARNINGS ====================
    // Warning for approaching €5.000
    if (thresholdStatus.thresholds['5000'].needs_warning && !thresholdStatus.thresholds['5000'].declaration_signed) {
      warnings.push(
        <View key="warning-5000" style={styles.alertBox5k}>
          <Text style={styles.alertTitle5k}>⚠️ Anno {contractStartYear}: Soglia dei €5.000</Text>
          <Text style={styles.alertBody5k}>
            Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth5k_y1}</Text> supererai la soglia previdenziale di €5.000.
          </Text>
          <Text style={styles.alertFooter5k}>Contributi previdenziali INPS</Text>
        </View>
      );
    }
    
    // Warning for approaching €15.000
    if (thresholdStatus.thresholds['15000'].needs_warning && !thresholdStatus.thresholds['15000'].declaration_signed) {
      warnings.push(
        <View key="warning-15000" style={styles.alertBox15k}>
          <Text style={styles.alertTitle15k}>🚨 Anno {contractStartYear}: Soglia dei €15.000</Text>
          <Text style={styles.alertBody15k}>
            Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{thresholdMonth15k_y1}</Text> supererai la soglia fiscale di €15.000.
          </Text>
          <Text style={styles.alertFooter15k}>Tassazione IRPEF obbligatoria</Text>
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
              Anno {contractStartYear}: Dichiarazione €5.000 richiesta
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
              Anno {contractStartYear}: URGENTE - Dichiarazione €15.000 richiesta
            </Text>
            <Text style={[styles.thresholdBannerText, { color: '#fff' }]}>
              Tocca qui per firmare la dichiarazione fiscale
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      );
    }
    
    // Show signed declarations for first year
    if (thresholdStatus.thresholds['5000'].declaration_signed) {
      warnings.push(
        <View key="signed-5000" style={styles.thresholdSignedBox}>
          <Text style={styles.thresholdSignedTitle}>
            ✅ Anno {contractStartYear}: Dichiarazione €5.000 firmata
          </Text>
          <Text style={styles.thresholdSignedBody}>
            Soglia previdenziale comunicata{((thresholdStatus.thresholds['5000'].threshold_month) && (thresholdStatus.thresholds['5000'].threshold_month) >= 1 && (thresholdStatus.thresholds['5000'].threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus.thresholds['5000'].threshold_month]})` : ''}
          </Text>
        </View>
      );
    }
    
    if (thresholdStatus.thresholds['15000'].declaration_signed) {
      warnings.push(
        <View key="signed-15000" style={styles.thresholdSignedBox}>
          <Text style={styles.thresholdSignedTitle}>
            ✅ Anno {contractStartYear}: Dichiarazione €15.000 firmata
          </Text>
          <Text style={styles.thresholdSignedBody}>
            Soglia fiscale comunicata{((thresholdStatus.thresholds['15000'].threshold_month) && (thresholdStatus.thresholds['15000'].threshold_month) >= 1 && (thresholdStatus.thresholds['15000'].threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus.thresholds['15000'].threshold_month]})` : ''}
          </Text>
        </View>
      );
    }
    
    // ==================== SECOND YEAR (2026) WARNINGS ====================
    if (thresholdStatus2026 && contractEndYear && contractEndYear > contractStartYear) {
      const year2026 = contractEndYear;
      
      // Show signed declarations for 2026 - LIGHT BLUE to distinguish from first year
      if (thresholdStatus2026.thresholds['5000'].declaration_signed) {
        warnings.push(
          <View key="signed-5000-2026" style={[styles.thresholdSignedBox, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
            <Text style={[styles.thresholdSignedTitle, { color: '#1565C0' }]}>
              ✅ Anno {year2026}: Dichiarazione €5.000 firmata
            </Text>
            <Text style={[styles.thresholdSignedBody, { color: '#1565C0' }]}>
              Soglia previdenziale comunicata{((thresholdStatus2026.thresholds['5000'].threshold_month) && (thresholdStatus2026.thresholds['5000'].threshold_month) >= 1 && (thresholdStatus2026.thresholds['5000'].threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus2026.thresholds['5000'].threshold_month]})` : ''}
            </Text>
          </View>
        );
      }
      
      if (thresholdStatus2026.thresholds['15000'].declaration_signed) {
        warnings.push(
          <View key="signed-15000-2026" style={[styles.thresholdSignedBox, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
            <Text style={[styles.thresholdSignedTitle, { color: '#1565C0' }]}>
              ✅ Anno {year2026}: Dichiarazione €15.000 firmata
            </Text>
            <Text style={[styles.thresholdSignedBody, { color: '#1565C0' }]}>
              Soglia fiscale comunicata{((thresholdStatus2026.thresholds['15000'].threshold_month) && (thresholdStatus2026.thresholds['15000'].threshold_month) >= 1 && (thresholdStatus2026.thresholds['15000'].threshold_month) <= 12) ? ` (superata nel mese di ${['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][thresholdStatus2026.thresholds['15000'].threshold_month]})` : ''}
            </Text>
          </View>
        );
      }
      
      // Warning for €5.000 in 2026 — visible from "approaching" to "exceeded
      // but not yet signed". Once signed the light-blue "signed" banner takes
      // over.
      if ((thresholdStatus2026.thresholds['5000'].needs_warning || thresholdStatus2026.thresholds['5000'].needs_declaration) && !thresholdStatus2026.thresholds['5000'].declaration_signed) {
        const m1y2 = thresholdStatus2026.thresholds['5000'].threshold_month;
        const monthLabel1y2 = (m1y2 && m1y2 >= 1 && m1y2 <= 12) ? ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][m1y2] : (thresholdMonth5k_y2 || '');
        const isExceeded = thresholdStatus2026.thresholds['5000'].needs_declaration;
        warnings.push(
          <View key="warning-5000-2026" style={styles.alertBox5k}>
            <Text style={styles.alertTitle5k}>⚠️ Anno {year2026}: Soglia dei €5.000</Text>
            <Text style={styles.alertBody5k}>
              {isExceeded
                ? <>Soglia previdenziale di €5.000 superata nel mese di <Text style={{ fontWeight: 'bold' }}>{monthLabel1y2}</Text>.</>
                : <>Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{monthLabel1y2}</Text> supererai la soglia previdenziale di €5.000.</>}
            </Text>
            <Text style={styles.alertFooter5k}>Contributi previdenziali INPS</Text>
          </View>
        );
      }
      
      // Warning for €15.000 in 2026 — same logic as 5k
      if ((thresholdStatus2026.thresholds['15000'].needs_warning || thresholdStatus2026.thresholds['15000'].needs_declaration) && !thresholdStatus2026.thresholds['15000'].declaration_signed) {
        const m2y2 = thresholdStatus2026.thresholds['15000'].threshold_month;
        const monthLabel2y2 = (m2y2 && m2y2 >= 1 && m2y2 <= 12) ? ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][m2y2] : (thresholdMonth15k_y2 || '');
        const isExceeded = thresholdStatus2026.thresholds['15000'].needs_declaration;
        warnings.push(
          <View key="warning-15000-2026" style={styles.alertBox15k}>
            <Text style={styles.alertTitle15k}>🚨 Anno {year2026}: Soglia dei €15.000</Text>
            <Text style={styles.alertBody15k}>
              {isExceeded
                ? <>Soglia fiscale di €15.000 superata nel mese di <Text style={{ fontWeight: 'bold' }}>{monthLabel2y2}</Text>.</>
                : <>Con la quietanza del mese di <Text style={{ fontWeight: 'bold' }}>{monthLabel2y2}</Text> supererai la soglia fiscale di €15.000.</>}
            </Text>
            <Text style={styles.alertFooter15k}>Tassazione IRPEF obbligatoria</Text>
          </View>
        );
      }
    }
    
    return warnings.length > 0 ? <View style={styles.warningsContainer}>{warnings}</View> : null;
  };

  // Find first month where each threshold was exceeded based on PROJECTED
  // cumulative (signed + unsigned). Projects ALL 12 months of every relevant
  // year using monthly_compensation for months without a DB record yet.
  const getProjectedThresholdMonths = () => {
    const thresholdsByYear: { [year: number]: { first5k: number | null, first15k: number | null } } = {};
    const monthlyDefault = profile?.monthly_compensation || 0;
    const recordMap: { [key: string]: number } = {};
    for (const r of records) {
      recordMap[`${r.year}-${r.month}`] = r.amount_gross || r.amount || monthlyDefault;
    }
    const yearsSet = new Set<number>();
    if (contractStartYear) yearsSet.add(contractStartYear);
    yearsSet.add(currentYear);
    records.forEach(r => yearsSet.add(r.year));
    const years = Array.from(yearsSet).sort();
    for (const y of years) {
      thresholdsByYear[y] = { first5k: null, first15k: null };
      let cumul = (y === contractStartYear && priorCompensation > 0) ? priorCompensation : 0;
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
    
    return month >= thresholdMonth;
  };

  const renderMonthCard = (month: number, year?: number) => {
    const displayYear = year || currentYear;
    const status = getMonthStatus(month, displayYear);
    // Use matchesMonth helper for legacy data support
    const record = records.find(r => matchesMonth(r.month, month) && r.year === displayYear);
    // Use custom amount from record if exists (set by Admin), otherwise use profile monthly
    const monthlyAmount = record?.amount_gross || record?.amount || profile?.monthly_compensation || 0;
    
    // Uses PROJECTED cumulative (signed + unsigned) so user sees in advance
    // which months are above 5k/15k even before signing.
    const thresholdsByYear = getProjectedThresholdMonths();
    const isAfter5k = isMonthAfterThreshold(month, displayYear, thresholdsByYear, '5k');
    const isAfter15k = isMonthAfterThreshold(month, displayYear, thresholdsByYear, '15k');
    
    // Use calculated thresholds for badge display (not DB values which may be stale)
    const showBadge5k = isAfter5k && !isAfter15k;
    const showBadge15k = isAfter15k;
    
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

    const thresholdInlineStyle = null;
    
    return (
      <TouchableOpacity
        key={`${displayYear}-${month}`}
        style={[
          styles.monthCard,
          getCardStyle(),
          // Purple background when exceeded €15k (signed)
          // Threshold tint applied to ALL statuses (signed, blocked, pending, future)
          // so that >5K months appear orange and >15K months appear purple even
          // before signing.
          isAfter15k && { backgroundColor: '#F3E5F5', borderColor: '#8E44AD' },
          isAfter5k && !isAfter15k && { backgroundColor: '#FFF8E1', borderColor: '#F9A825' },
        ]}
        onPress={() => (status === 'pending' || status === 'blocked') && handleOpenSignature(month, displayYear)}
        disabled={status === 'future'}
        data-testid={`month-card-${displayYear}-${month}`}
      >
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
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/dirigente'))} style={styles.backButton}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        {/* BRANDING_WRAPPED */}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <SocietyBranding />
            <Text style={styles.headerTitle}>Compensi Sportivi</Text>
          </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Dirigente Name and Profile Link */}
        <View style={{ marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="person-circle" size={50} color="#8E44AD" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>{profile?.full_name || 'Dirigente'}</Text>
              <Text style={{ fontSize: 13, color: '#666' }}>Compenso mensile: {formatCurrency((profile?.monthly_compensation || 0))}</Text>
            </View>
          </View>
          
          {profile?.contract_start_date && profile?.contract_end_date && (
            <View style={{ 
              backgroundColor: '#F3E5F5', 
              padding: 12, 
              borderRadius: 8, 
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#8E44AD',
              borderStyle: 'dashed'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>📅</Text>
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>Periodo Contratto</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#8E44AD', fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
                {formatContractDate(profile.contract_start_date!)} - {formatContractDate(profile.contract_end_date!)}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E5F5', padding: 10, borderRadius: 8 }}
            onPress={() => router.push('/dirigente/profile')}
          >
            <Ionicons name="create-outline" size={18} color="#8E44AD" />
            <Text style={{ marginLeft: 8, color: '#8E44AD', fontWeight: '500' }}>Il Mio Profilo</Text>
            <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, color: '#666' }}>Dati personali, documento e IBAN</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E44AD" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
        
        {/* Year Summaries - Contract-based - ENHANCED STYLE */}
        {contractStartYear && contractEndYear && (
          <>
            {/* Combined: Periodo Contratto + Totale RAS - Single unified banner */}
            <View style={styles.unifiedContractBanner}>
              {/* Header: Comunicazione RAS */}
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
              
              {/* Linear layout like Coach view */}
              {(() => {
                const summary1 = getYearSummary(contractStartYear);
                const summary2 = contractEndYear > contractStartYear ? getYearSummary(contractEndYear) : { yearlyFromContractBase: 0, supplementaryTotal: 0 };
                const totalBase = (summary1.yearlyFromContractBase || 0) + (summary2.yearlyFromContractBase || 0);
                const totalSupplementary = (summary1.supplementaryTotal || 0) + (summary2.supplementaryTotal || 0);
                const grandTotal = totalBase + totalSupplementary;
                const months1 = getContractMonthsForYear(contractStartYear).length;
                const months2 = contractEndYear > contractStartYear ? getContractMonthsForYear(contractEndYear).length : 0;
                const totalMonths = months1 + months2;
                
                return (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(totalBase)}</Text></Text>
                    <Text style={{ fontSize: 11, color: '#1565C0', marginBottom: 4 }}>  ({totalMonths} mesi × {formatCurrency(profile?.monthly_compensation || 0)})</Text>
                    <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(totalSupplementary)}</Text></Text>
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
                  
                  {/* Linear layout like Coach view */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.yearlyFromContractBase || 0)}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.supplementaryTotal || 0)}</Text></Text>
                    {summary.priorCompensation > 0 && (
                      <Text style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>• Pregressi: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.priorCompensation)}</Text></Text>
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
                  
                  {/* Linear layout like Coach view */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>• Compenso base: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.yearlyFromContractBase || 0)}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#1565C0', marginBottom: 4 }}>• Somma supplementare: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.supplementaryTotal || 0)}</Text></Text>
                    <Text style={{ fontSize: 15, color: exceeds15k ? '#8E44AD' : exceeds5k ? '#F57F17' : headerColor, fontWeight: 'bold', marginTop: 4 }}>• Totale Anno: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(summary.totalProjected)}</Text></Text>
                  </View>
                </View>
              );
            })()}
          </>
        )}
        
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

        {/* Threshold Warnings */}
        {renderThresholdWarnings()}

        {/* Monthly Cards */}
        {contractStartYear && contractEndYear && (
          <>
            <Text style={styles.sectionTitle}>Quietanze {contractStartYear}</Text>
            <View style={styles.monthsGrid}>
              {getContractMonthsForYear(contractStartYear).map(month => renderMonthCard(month, contractStartYear))}
            </View>
            
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
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Quietanza {MONTH_NAMES[selectedMonth || 0]} {selectedYear}
              </Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={[styles.receiptPreview, { padding: 12, marginBottom: 12 }]}>
                <Text style={[styles.receiptTitle, { fontSize: 13, marginBottom: 6 }]}>QUIETANZA COMPENSO SPORTIVO</Text>
                <Text style={[styles.receiptText, { fontSize: 12, lineHeight: 18 }]}>
                  {profile?.full_name} • {MONTH_NAMES[selectedMonth || 0]} {selectedYear} • {formatCurrency(
                    (records.find(r => r.month === selectedMonth && r.year === selectedYear)?.amount_gross || 
                     records.find(r => r.month === selectedMonth && r.year === selectedYear)?.amount || 
                     profile?.monthly_compensation || 0)
                  )}
                </Text>
              </View>

              <Text style={[styles.signatureLabel, { marginBottom: 8 }]}>Firma qui sotto:</Text>
              <SignaturePadInline
                ref={signatureRef}
                onSave={(sig) => setSignature(sig)}
                onClear={() => setSignature(null)}
                height={150}
              />
            </ScrollView>

            {/* Confirm Buttons - OUTSIDE ScrollView for fixed position */}
            <View style={styles.modalButtonsFixed}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSignatureModal(false)}
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
                        <Text style={{ fontSize: 10, color: '#333' }}>€ {(tsPrevYear?.yearly_total || tsPrevYear?.total_with_prior || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
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
                    <Text style={{ fontSize: 10, color: '#333' }}>€ {(tsCurrentYear?.yearly_total || tsCurrentYear?.total_with_prior || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>Totale somme percepite {selectedYear} dopo il compenso:</Text>
                    <Text style={{ fontSize: 10, color: '#333' }}>€ {((tsCurrentYear?.yearly_total || tsCurrentYear?.total_with_prior || 0) + declarationAmount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
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
    backgroundColor: '#8E44AD',
    borderBottomWidth: 1,
    borderBottomColor: '#7D3C98',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#8E44AD',
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
  // Alert boxes (stile vecchio SUPERAMENTO con bordi e testo centrato)
  alertBox5k: {
    backgroundColor: '#FFF3E0',
    borderWidth: 2,
    borderColor: '#FF9800',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  alertTitle5k: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E65100',
    textAlign: 'center',
    marginBottom: 6,
  },
  alertBody5k: {
    fontSize: 13,
    color: '#E65100',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  alertFooter5k: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 2,
  },
  alertBox15k: {
    backgroundColor: '#F3E5F5',
    borderWidth: 2,
    borderColor: '#9C27B0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  alertTitle15k: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6A1B9A',
    textAlign: 'center',
    marginBottom: 6,
  },
  alertBody15k: {
    fontSize: 13,
    color: '#6A1B9A',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  alertFooter15k: {
    fontSize: 12,
    color: '#6A1B9A',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Banner "Dichiarazione firmata" (verde, stesso layout dei warning)
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
    borderColor: '#E0E0E0',
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
    color: '#8E44AD',
    marginVertical: 4,
  },
  signedDate: {
    fontSize: 9,
    color: '#34C759',
  },
  pendingText: {
    fontSize: 9,
    color: '#8E44AD',
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
    backgroundColor: '#F3E5F5',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A1B9A',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#7B1FA2',
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
    paddingBottom: 40,
    flexGrow: 1,
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
    backgroundColor: '#8E44AD',
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
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#8E44AD',
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
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  contractPeriodLabel: {
    fontSize: 14,
    color: '#8E44AD',
    fontWeight: '600',
    marginBottom: 4,
  },
  contractPeriodValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#8E44AD',
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
