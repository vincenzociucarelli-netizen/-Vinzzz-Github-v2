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
import SignaturePad from '../../src/components/SignaturePad';

const MONTH_NAMES = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

interface CompensationRecord {
  id: string;
  month: number;
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

export default function CoachCompensation() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
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
  
  // Signature modal for receipts
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  
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
      if (profileRes.data.contract_start_date) {
        const startParts = profileRes.data.contract_start_date.split('-');
        if (startParts.length === 3) {
          setContractStartYear(parseInt(startParts[0]));
          setContractStartMonth(parseInt(startParts[1]));
        }
      }
      if (profileRes.data.contract_end_date) {
        const endParts = profileRes.data.contract_end_date.split('-');
        if (endParts.length === 3) {
          setContractEndYear(parseInt(endParts[0]));
          setContractEndMonth(parseInt(endParts[1]));
        }
      }
      
      // Set prior compensation
      setPriorCompensation(profileRes.data.other_annual_compensation || 0);
      
      // Load compensation records
      const recordsRes = await api.get(`/coach/${user?.id}/compensation`);
      const yearRecords = recordsRes.data.filter((r: CompensationRecord) => r.year === currentYear);
      setRecords(yearRecords);
      
      // Calculate yearly total
      const total = yearRecords
        .filter((r: CompensationRecord) => r.receipt_signed)
        .reduce((sum: number, r: CompensationRecord) => sum + (r.amount_gross || r.amount || 0), 0);
      setYearlyTotal(total);
      
      // Load threshold status
      try {
        const thresholdRes = await api.get(`/coach/${user?.id}/threshold-status/${currentYear}`);
        setThresholdStatus(thresholdRes.data);
      } catch (err) {
        console.log('Error loading threshold status:', err);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSignature = (month: number) => {
    // Check if blocked by threshold
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
    
    // Check if this month is already signed
    const existingRecord = records.find(r => r.month === month && r.receipt_signed);
    if (existingRecord) {
      Alert.alert('Già firmata', 'La quietanza per questo mese è già stata firmata.');
      return;
    }
    
    setSelectedMonth(month);
    setSignature(null);
    setShowSignatureModal(true);
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
    
    try {
      setSigningDeclaration(true);
      
      const response = await api.post(`/coach/${user?.id}/threshold-declaration`, {
        year: currentYear,
        threshold_type: declarationType,
        signature_base64: declarationSignature.replace('data:image/png;base64,', ''),
      });
      
      const thresholdAmount = declarationType === '5000' ? '5.000' : '15.000';
      
      Alert.alert(
        'Dichiarazione Firmata',
        `Dichiarazione di superamento soglia € ${thresholdAmount} firmata con successo!\n\nUna copia è stata inviata alla tua email.`
      );
      
      setShowDeclarationModal(false);
      loadData(); // Reload to update status
      
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
      const newTotal = yearlyTotal + monthlyAmount;
      const exceeded5000 = newTotal > 5000 && yearlyTotal <= 5000;
      const exceeded15000 = newTotal > 15000 && yearlyTotal <= 15000;
      
      const response = await api.post(`/coach/${user?.id}/compensation/receipt`, {
        month: selectedMonth,
        year: currentYear,
        amount_gross: profile.monthly_compensation,
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
    
    // Only block future months if we're in the same year AND the month is in the future
    if (checkYear === currentYearActual && month > currentMonthActual) {
      return 'future';
    }
    // If viewing a future year entirely, block all
    if (checkYear > currentYearActual) {
      return 'future';
    }
    
    const record = records.find(r => r.month === month && r.year === checkYear);
    if (record?.receipt_signed) {
      return 'signed';
    }
    if (thresholdStatus?.is_blocked) {
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

  const renderMonthCard = (month: number, year?: number) => {
    const displayYear = year || currentYear;
    const status = getMonthStatus(month, displayYear);
    const record = records.find(r => r.month === month && r.year === displayYear);
    const monthlyAmount = profile?.monthly_compensation || 0;
    
    return (
      <TouchableOpacity
        key={`${displayYear}-${month}`}
        style={[
          styles.monthCard,
          status === 'signed' && styles.monthCardSigned,
          status === 'future' && styles.monthCardFuture,
          status === 'blocked' && styles.monthCardBlocked,
        ]}
        onPress={() => (status === 'pending' || status === 'blocked') && handleOpenSignature(month, displayYear)}
        disabled={status === 'future'}
        data-testid={`month-card-${displayYear}-${month}`}
      >
        <View style={styles.monthHeader}>
          <Text style={styles.monthName}>{MONTH_NAMES[month]}</Text>
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
        
        <Text style={styles.monthAmount}>€ {monthlyAmount.toFixed(2)}</Text>
        
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
          <View style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 20, padding: 6 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compensi Sportivi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Link at TOP */}
        <TouchableOpacity 
          style={[styles.infoSection, { marginBottom: 16, backgroundColor: '#fff', borderRadius: 12 }]}
          onPress={() => router.push('/coach/profile')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="person-circle" size={40} color="#FF9500" />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.infoTitle, { marginBottom: 0 }]}>Il Mio Profilo</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Dati personali, documento e IBAN</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </View>
        </TouchableOpacity>
        
        {/* Year Summaries - Contract-based */}
        {contractStartYear && contractEndYear && (
          <>
            {/* First Year Summary (with prior compensation) */}
            {(() => {
              const summary = getYearSummary(contractStartYear);
              const exceeds5k = summary.totalProjected >= 5000;
              const exceeds15k = summary.totalProjected >= 15000;
              return (
                <View key={`summary-${contractStartYear}`} style={[styles.summaryCard, { marginBottom: 16 }]}>
                  <Text style={styles.summaryTitle}>📊 Anno {contractStartYear} (Inizio Contratto)</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Mesi nel contratto:</Text>
                    <Text style={styles.summaryValue}>{MONTH_NAMES[contractStartMonth]} - Dic ({summary.monthCount} mesi)</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Compenso da contratto:</Text>
                    <Text style={styles.summaryValue}>€{summary.monthlyComp} × {summary.monthCount} = €{summary.yearlyFromContract.toLocaleString()}</Text>
                  </View>
                  {summary.priorCompensation > 0 && (
                    <View style={[styles.summaryRow, { backgroundColor: '#FFF3CD', padding: 8, borderRadius: 6 }]}>
                      <Text style={[styles.summaryLabel, { color: '#856404' }]}>+ Pregressi dichiarati:</Text>
                      <Text style={[styles.summaryValue, { color: '#856404' }]}>€{summary.priorCompensation.toLocaleString()}</Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }]}>
                    <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>TOTALE ANNO:</Text>
                    <Text style={[styles.summaryValue, styles.summaryTotal, exceeds5k ? { color: '#FF3B30' } : {}]}>
                      €{summary.totalProjected.toLocaleString()}
                    </Text>
                  </View>
                  {exceeds5k && (
                    <Text style={{ fontSize: 12, color: '#FF3B30', marginTop: 4 }}>
                      ⚠️ Supera soglia €5.000 {exceeds15k ? '+ €15.000' : ''}
                    </Text>
                  )}
                </View>
              );
            })()}
            
            {/* Second Year Summary (if contract spans 2 years) */}
            {contractEndYear > contractStartYear && (() => {
              const summary = getYearSummary(contractEndYear);
              const exceeds5k = summary.totalProjected >= 5000;
              const exceeds15k = summary.totalProjected >= 15000;
              return (
                <View key={`summary-${contractEndYear}`} style={[styles.summaryCard, { marginBottom: 16 }]}>
                  <Text style={styles.summaryTitle}>📊 Anno {contractEndYear} (Fine Contratto)</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Mesi nel contratto:</Text>
                    <Text style={styles.summaryValue}>Gen - {MONTH_NAMES[contractEndMonth]} ({summary.monthCount} mesi)</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Compenso da contratto:</Text>
                    <Text style={styles.summaryValue}>€{summary.monthlyComp} × {summary.monthCount} = €{summary.yearlyFromContract.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }]}>
                    <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>TOTALE ANNO:</Text>
                    <Text style={[styles.summaryValue, styles.summaryTotal, exceeds5k ? { color: '#FF3B30' } : {}]}>
                      €{summary.totalProjected.toLocaleString()}
                    </Text>
                  </View>
                  {exceeds5k && (
                    <Text style={{ fontSize: 12, color: '#FF3B30', marginTop: 4 }}>
                      ⚠️ Supera soglia €5.000 {exceeds15k ? '+ €15.000' : ''}
                    </Text>
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
              <Text style={styles.summaryValue}>€ {(profile?.monthly_compensation || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Totale quietanzato:</Text>
              <Text style={[styles.summaryValue, styles.summaryTotal]}>€ {yearlyTotal.toFixed(2)}</Text>
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
        
        {/* Fallback: Old 12 months if no contract dates */}
        {(!contractStartYear || !contractEndYear) && (
          <>
            <Text style={styles.sectionTitle}>Quietanze Mensili</Text>
            <View style={styles.monthsGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => renderMonthCard(month))}
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
            • La firma della quietanza genera un PDF inviato via email{'\n'}
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
                Quietanza {MONTH_NAMES[selectedMonth || 0]} {currentYear}
              </Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Receipt Preview */}
              <View style={styles.receiptPreview}>
                <Text style={styles.receiptTitle}>QUIETANZA COMPENSO SPORTIVO DILETTANTISTICO</Text>
                <Text style={styles.receiptText}>
                  Collaboratore: {profile?.full_name}{'\n'}
                  Mese: {MONTH_NAMES[selectedMonth || 0]} {currentYear}{'\n'}
                  Compenso lordo: € {(profile?.monthly_compensation || 0).toFixed(2)}{'\n'}
                  {'\n'}
                  Il collaboratore dichiara che non sono intervenute variazioni rispetto all'autocertificazione precedente.
                </Text>
              </View>

              {/* Signature Pad */}
              <Text style={styles.signatureLabel}>Firma qui sotto:</Text>
              <SignaturePad
                ref={signatureRef}
                onSave={(sig) => setSignature(sig)}
                onClear={() => setSignature(null)}
                width={Platform.OS === 'web' ? 400 : undefined}
                height={200}
              />

              {/* Confirm Buttons */}
              <View style={styles.modalButtons}>
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
            </ScrollView>
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
                  che, alla data odierna, il totale dei compensi percepiti per attività sportiva dilettantistica nell'anno solare {currentYear}, anche da altri enti sportivi, ha raggiunto e/o superato l'importo complessivo di € {declarationType === '5000' ? '5.000,00' : '15.000,00'}.{'\n'}
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

              {/* Signature Pad */}
              <Text style={styles.signatureLabel}>Firma qui sotto:</Text>
              <SignaturePad
                onSave={(sig) => setDeclarationSignature(sig)}
                onClear={() => setDeclarationSignature(null)}
                width={Platform.OS === 'web' ? 400 : undefined}
                height={200}
              />

              {/* Confirm Buttons */}
              <View style={styles.modalButtons}>
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
            </ScrollView>
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
});
