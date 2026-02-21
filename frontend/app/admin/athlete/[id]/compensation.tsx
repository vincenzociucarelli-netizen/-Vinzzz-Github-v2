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
  Modal,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../../src/services/api';
import { Ionicons } from '../../../../src/components/Icon';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team_id: string;
  athlete_type: string;
  monthly_compensation?: number;
  other_annual_compensation?: number;
  prior_compensation?: number;
  contract_start_date?: string;
  contract_end_date?: string;
  compensation_accepted?: boolean;
  compensation_history?: { [key: string]: boolean };
  iban?: string;
  iban_holder_first_name?: string;
  iban_holder_last_name?: string;
  bank_name?: string;
  identity_document_photo?: string;
  email?: string;
  fiscal_code?: string;
  date_of_birth?: string;
  phone_athlete?: string;
}

interface SignedReceipt {
  month: string;
  year: number;
  signed: boolean;
  signed_date?: string;
  amount?: number;
}

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const MONTH_NAMES_SHORT: { [key: number]: string } = {
  1: 'Gen', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'Mag', 6: 'Giu',
  7: 'Lug', 8: 'Ago', 9: 'Set', 10: 'Ott', 11: 'Nov', 12: 'Dic'
};

export default function AthleteCompensation() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<any>(null);
  
  // Compensation settings
  const [editing, setEditing] = useState(false);
  const [monthlyCompensation, setMonthlyCompensation] = useState('0');
  const [otherAnnualCompensation, setOtherAnnualCompensation] = useState('0');
  const [priorCompensation, setPriorCompensation] = useState('0');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  
  // Bank info
  const [iban, setIban] = useState('');
  const [ibanHolderFirstName, setIbanHolderFirstName] = useState('');
  const [ibanHolderLastName, setIbanHolderLastName] = useState('');
  const [bankName, setBankName] = useState('');
  
  // Signed receipts
  const [signedReceipts, setSignedReceipts] = useState<SignedReceipt[]>([]);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{month: string, year: number} | null>(null);
  const [signingReceipt, setSigningReceipt] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Convert ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS) to Italian format (DD/MM/YYYY)
  const formatDateToItalian = (isoDate: string | null | undefined): string => {
    if (!isoDate) return '';
    try {
      // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS" formats
      const dateStr = isoDate.split('T')[0];
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  // Convert Italian format (DD/MM/YYYY) to ISO format (YYYY-MM-DD) for API
  const formatDateToISO = (italianDate: string): string | null => {
    if (!italianDate) return null;
    const parts = italianDate.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return italianDate;
  };

  const loadData = async () => {
    try {
      const [athleteRes, teamRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/athletes/${id}/team`).catch(() => ({ data: null })),
      ]);
      
      const athleteData = athleteRes.data;
      setAthlete(athleteData);
      setTeam(teamRes.data);
      
      // Load compensation settings - convert dates to Italian format
      setMonthlyCompensation(athleteData.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(athleteData.other_annual_compensation?.toString() || '0');
      setPriorCompensation(athleteData.prior_compensation?.toString() || '0');
      setContractStartDate(formatDateToItalian(athleteData.contract_start_date));
      setContractEndDate(formatDateToItalian(athleteData.contract_end_date));
      
      // Bank info
      setIban(athleteData.iban || '');
      setIbanHolderFirstName(athleteData.iban_holder_first_name || '');
      setIbanHolderLastName(athleteData.iban_holder_last_name || '');
      setBankName(athleteData.bank_name || '');
      
      // Load signed receipts
      try {
        const compensationRes = await api.get(`/athletes/${id}/compensation/receipts`);
        if (Array.isArray(compensationRes.data)) {
          setSignedReceipts(compensationRes.data);
        } else if (compensationRes.data?.records) {
          setSignedReceipts(compensationRes.data.records);
        }
      } catch (e) {
        setSignedReceipts([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Errore', 'Impossibile caricare i dati');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveCompensation = async () => {
    setSaving(true);
    try {
      // Convert dates from DD/MM/YYYY to YYYY-MM-DD if needed
      let startDate = contractStartDate;
      let endDate = contractEndDate;
      
      if (startDate && startDate.includes('/')) {
        const parts = startDate.split('/');
        if (parts.length === 3) {
          startDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      
      if (endDate && endDate.includes('/')) {
        const parts = endDate.split('/');
        if (parts.length === 3) {
          endDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      
      await api.patch(`/athletes/${id}/compensation/settings`, {
        monthly_compensation: parseFloat(monthlyCompensation) || 0,
        other_annual_compensation: parseFloat(otherAnnualCompensation) || 0,
        prior_compensation: parseFloat(priorCompensation) || 0,
        contract_start_date: startDate || null,
        contract_end_date: endDate || null,
        iban: iban || null,
        iban_holder_first_name: ibanHolderFirstName || null,
        iban_holder_last_name: ibanHolderLastName || null,
        bank_name: bankName || null,
      });
      
      showAlert('Successo', 'Compensi aggiornati con successo');
      setEditing(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleSignReceipt = async (month: string, year: number, sign: boolean) => {
    setSigningReceipt(true);
    try {
      await api.post(`/athletes/${id}/compensation/receipt`, {
        month,
        year,
        signed: sign,
      });
      
      showAlert('Successo', sign ? 'Quietanza firmata' : 'Quietanza annullata');
      setReceiptModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'operazione');
    } finally {
      setSigningReceipt(false);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    // Handle ISO datetime format (e.g., 2024-09-01T00:00:00)
    let cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Handle date input - keeps Italian format (DD/MM/YYYY) in state
  const handleDateInput = (text: string, setter: (val: string) => void) => {
    // Remove any non-digit and non-slash characters
    const cleaned = text.replace(/[^\d\/]/g, '');
    let formatted = cleaned;
    
    // Auto-add slashes for better UX
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      formatted = cleaned + '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      formatted = cleaned + '/';
    }
    
    // Keep the date in Italian format (DD/MM/YYYY)
    // Conversion to ISO happens only during save
    setter(formatted);
  };

  // Calculate compensation breakdown
  const getCompensationBreakdown = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const other = parseFloat(otherAnnualCompensation) || 0;
    const prior = parseFloat(priorCompensation) || 0;
    
    if (!contractStartDate || !contractEndDate) {
      return { monthsInContract: 0, thisClubTotal: 0, grandTotal: other };
    }
    
    // Convert from Italian format if needed
    const startISO = formatDateToISO(contractStartDate) || contractStartDate;
    const endISO = formatDateToISO(contractEndDate) || contractEndDate;
    
    const start = new Date(startISO);
    const end = new Date(endISO);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    const thisClubTotal = monthly * months;
    
    return {
      monthsInContract: months,
      thisClubTotal,
      grandTotal: thisClubTotal + other,
    };
  };

  // Get yearly breakdown for detailed view
  const getYearlyBreakdown = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const other = parseFloat(otherAnnualCompensation) || 0;
    
    if (!contractStartDate || !contractEndDate) return {};
    
    // Convert from Italian format if needed
    const startISO = formatDateToISO(contractStartDate) || contractStartDate;
    const endISO = formatDateToISO(contractEndDate) || contractEndDate;
    
    const start = new Date(startISO);
    const end = new Date(endISO);
    
    const yearlyData: { [year: number]: { months: number, total: number, prior: number, startMonth: number, endMonth: number } } = {};
    
    let current = new Date(start);
    while (current <= end) {
      const year = current.getFullYear();
      if (!yearlyData[year]) {
        yearlyData[year] = { months: 0, total: 0, prior: 0, startMonth: current.getMonth() + 1, endMonth: current.getMonth() + 1 };
      }
      yearlyData[year].months++;
      yearlyData[year].endMonth = current.getMonth() + 1;
      current.setMonth(current.getMonth() + 1);
    }
    
    // Add prior compensation to first year
    const years = Object.keys(yearlyData).map(Number).sort((a, b) => a - b);
    if (years.length > 0) {
      yearlyData[years[0]].prior = other;
    }
    
    // Calculate totals
    for (const year of years) {
      yearlyData[year].total = yearlyData[year].months * monthly;
    }
    
    return yearlyData;
  };

  // Get months in contract range
  const getContractMonths = () => {
    if (!contractStartDate || !contractEndDate) return [];
    
    const months: {month: string, year: number, monthIndex: number}[] = [];
    
    // Convert from Italian format (DD/MM/YYYY) to ISO if needed
    const startISO = formatDateToISO(contractStartDate) || contractStartDate;
    const endISO = formatDateToISO(contractEndDate) || contractEndDate;
    
    const start = new Date(startISO);
    const end = new Date(endISO);
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      months.push({
        month: MONTHS[current.getMonth()],
        year: current.getFullYear(),
        monthIndex: current.getMonth(),
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const isReceiptSigned = (month: string, year: number) => {
    return signedReceipts.some(r => r.month === month && r.year === year && r.signed);
  };

  const getReceiptSignedDate = (month: string, year: number) => {
    const receipt = signedReceipts.find(r => r.month === month && r.year === year && r.signed);
    return receipt?.signed_date;
  };

  const getCompensationBadge = () => {
    const breakdown = getCompensationBreakdown();
    if (breakdown.grandTotal > 5000) {
      return { text: '⚠️ OVER 5000€', bg: '#FFEBEE', color: '#D32F2F' };
    } else if (breakdown.grandTotal > 4000) {
      return { text: '⚡ Vicino al limite', bg: '#FFF3E0', color: '#EF6C00' };
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  if (!athlete) {
    return (
      <View style={styles.errorContainer}>
        <Text>Atleta non trovato</Text>
      </View>
    );
  }

  const breakdown = getCompensationBreakdown();
  const contractMonths = getContractMonths();
  const badge = getCompensationBadge();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Compensi Atleta</Text>
          <Text style={styles.headerSubtitle}>{athlete.first_name} {athlete.last_name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Team Badge */}
        {team && (
          <View style={styles.teamBadge}>
            <Ionicons name="trophy" size={16} color="#B8860B" />
            <Text style={styles.teamBadgeText}>{team.name}</Text>
          </View>
        )}

        {/* Compensation Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💰 Compensi</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {badge && (
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setEditing(!editing)}>
                <Text style={{ fontSize: 22 }}>{editing ? '✕' : '✏️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {editing ? (
            <View>
              <Text style={styles.inputLabel}>📅 Data Inizio Contratto (GG/MM/AAAA)</Text>
              <TextInput
                style={styles.input}
                value={formatDateDisplay(contractStartDate)}
                onChangeText={(text) => handleDateInput(text, setContractStartDate)}
                placeholder="GG/MM/AAAA"
                maxLength={10}
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>📅 Data Fine Contratto (GG/MM/AAAA)</Text>
              <TextInput
                style={styles.input}
                value={formatDateDisplay(contractEndDate)}
                onChangeText={(text) => handleDateInput(text, setContractEndDate)}
                placeholder="GG/MM/AAAA"
                maxLength={10}
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>💰 Compenso Mensile (€)</Text>
              <TextInput
                style={styles.input}
                value={monthlyCompensation}
                onChangeText={setMonthlyCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>📋 Compensi Pregressi (€)</Text>
              <TextInput
                style={styles.input}
                value={otherAnnualCompensation}
                onChangeText={setOtherAnnualCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={styles.inputHint}>
                Importo percepito dall'atleta prima di questo contratto
              </Text>

              {/* Bank Info */}
              {/* Dati Bancari - Improved Design */}
              <View style={styles.bankSection}>
                <View style={styles.bankSectionHeader}>
                  <View style={styles.bankIconContainer}>
                    <Text style={{ fontSize: 20 }}>🏦</Text>
                  </View>
                  <Text style={styles.bankSectionTitle}>Dati Bancari</Text>
                </View>
                
                <View style={styles.bankInputGroup}>
                  <Text style={styles.bankInputLabel}>IBAN</Text>
                  <TextInput
                    style={styles.bankInput}
                    value={iban}
                    onChangeText={(t) => setIban(t.toUpperCase())}
                    placeholder="IT00X0000000000000000000000"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.bankInputGroup}>
                  <Text style={styles.bankInputLabel}>Intestatario Conto</Text>
                  <View style={styles.bankInputColumn}>
                    <TextInput
                      style={styles.bankInput}
                      value={ibanHolderLastName}
                      onChangeText={(t) => setIbanHolderLastName(t.toUpperCase())}
                      placeholder="Cognome"
                      placeholderTextColor="#999"
                      autoCapitalize="characters"
                    />
                    <TextInput
                      style={styles.bankInput}
                      value={ibanHolderFirstName}
                      onChangeText={(t) => setIbanHolderFirstName(t.toUpperCase())}
                      placeholder="Nome"
                      placeholderTextColor="#999"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.bankInputGroup}>
                  <Text style={styles.bankInputLabel}>Banca</Text>
                  <TextInput
                    style={styles.bankInput}
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="Nome della banca"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Preview */}
              {contractStartDate && contractEndDate && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>📄 Riepilogo Contratto</Text>
                  <Text style={styles.previewText}>
                    Dal {formatDateDisplay(contractStartDate)} al {formatDateDisplay(contractEndDate)} = {breakdown.monthsInContract} mesi
                  </Text>
                  <Text style={styles.previewAmount}>€{breakdown.thisClubTotal.toLocaleString()}</Text>
                  <Text style={styles.previewHint}>
                    ({monthlyCompensation}€ × {breakdown.monthsInContract} mesi)
                  </Text>
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveCompensation}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Salva Compensi</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* Display Mode */}
              <View style={styles.compensationDisplay}>
                <View style={styles.compensationRow}>
                  <Text style={styles.compensationLabel}>Compenso Mensile</Text>
                  <Text style={styles.compensationValue}>€{monthlyCompensation}</Text>
                </View>
                <View style={styles.compensationRow}>
                  <Text style={styles.compensationLabel}>Durata Contratto</Text>
                  <Text style={styles.compensationValue}>
                    {contractStartDate && contractEndDate 
                      ? `${formatDateDisplay(contractStartDate)} - ${formatDateDisplay(contractEndDate)}`
                      : 'Non impostata'}
                  </Text>
                </View>
                <View style={styles.compensationRow}>
                  <Text style={styles.compensationLabel}>Mesi</Text>
                  <Text style={styles.compensationValue}>{breakdown.monthsInContract}</Text>
                </View>
                <View style={[styles.compensationRow, styles.compensationTotal]}>
                  <Text style={styles.compensationTotalLabel}>Totale Contratto</Text>
                  <Text style={styles.compensationTotalValue}>€{breakdown.thisClubTotal.toLocaleString()}</Text>
                </View>
                {parseFloat(otherAnnualCompensation) > 0 && (
                  <View style={[styles.compensationRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' }]}>
                    <Text style={styles.compensationLabel}>📋 Compensi Pregressi</Text>
                    <Text style={styles.compensationValue}>€{parseFloat(otherAnnualCompensation).toLocaleString()}</Text>
                  </View>
                )}
                {parseFloat(otherAnnualCompensation) > 0 && (
                  <View style={[styles.compensationRow, styles.compensationTotal]}>
                    <Text style={styles.compensationTotalLabel}>Totale Annuo Complessivo</Text>
                    <Text style={styles.compensationTotalValue}>€{breakdown.grandTotal.toLocaleString()}</Text>
                  </View>
                )}
              </View>

              {/* Bank Info Display */}
              {iban && (
                <View style={styles.bankInfoBox}>
                  <Text style={styles.bankInfoTitle}>🏦 Dati Bancari</Text>
                  <Text style={styles.bankInfoText}>IBAN: {iban}</Text>
                  {(ibanHolderFirstName || ibanHolderLastName) && (
                    <Text style={styles.bankInfoText}>
                      Intestatario: {ibanHolderLastName} {ibanHolderFirstName}
                    </Text>
                  )}
                  {bankName && <Text style={styles.bankInfoText}>Banca: {bankName}</Text>}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Yearly Breakdown - Detailed Calculations */}
        {contractMonths.length > 0 && !editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Calcoli Annuali</Text>
            {(() => {
              const yearlyData = getYearlyBreakdown();
              const years = Object.keys(yearlyData).map(Number).sort((a, b) => a - b);
              
              return years.map((year, idx) => {
                const data = yearlyData[year];
                const yearTotal = data.total + data.prior;
                const exceeds5K = yearTotal > 5000;
                const exceeds15K = yearTotal > 15000;
                const isFirstYear = idx === 0;
                const isLastYear = idx === years.length - 1;
                const yearLabel = isFirstYear && isLastYear 
                  ? '' 
                  : isFirstYear 
                    ? '(Inizio Contratto)' 
                    : isLastYear 
                      ? '(Fine Contratto)' 
                      : '';
                
                const firstMonthName = MONTHS[data.startMonth - 1];
                const lastMonthName = MONTHS[data.endMonth - 1];
                
                return (
                  <View key={year} style={[styles.yearBreakdownCard, idx > 0 && { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a2e' }}>Anno {year}</Text>
                        {yearLabel ? <Text style={{ fontSize: 12, color: '#666', marginLeft: 8, fontStyle: 'italic' }}>{yearLabel}</Text> : null}
                      </View>
                      {exceeds5K && (
                        <View style={{ backgroundColor: exceeds15K ? '#FFEBEE' : '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: exceeds15K ? '#D32F2F' : '#E65100' }}>
                            {exceeds15K ? '⚠️ >15K' : '⚠️ >5K'}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 13, color: '#666' }}>Mesi nel contratto:</Text>
                        <Text style={{ fontSize: 13, color: '#333' }}>{firstMonthName} - {lastMonthName} ({data.months} mesi)</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 13, color: '#666' }}>Compenso da contratto:</Text>
                        <Text style={{ fontSize: 13, color: '#333' }}>€{monthlyCompensation} × {data.months} = €{data.total.toLocaleString('it-IT')}</Text>
                      </View>
                      
                      {data.prior > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, backgroundColor: 'rgba(184, 134, 11, 0.1)', marginHorizontal: -12, paddingHorizontal: 12, paddingVertical: 6 }}>
                          <Text style={{ fontSize: 13, color: '#B8860B', fontWeight: '500' }}>+ Pregressi dichiarati:</Text>
                          <Text style={{ fontSize: 13, color: '#B8860B', fontWeight: '600' }}>€{data.prior.toLocaleString('it-IT')}</Text>
                        </View>
                      )}
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ddd', marginTop: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a2e' }}>TOTALE ANNO:</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: exceeds5K ? (exceeds15K ? '#D32F2F' : '#E65100') : '#2E7D32' }}>€{yearTotal.toLocaleString('it-IT')}</Text>
                      </View>
                    </View>
                    
                    {exceeds5K && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: exceeds15K ? '#FFEBEE' : '#FFF3E0', padding: 10, borderRadius: 8, marginTop: 10 }}>
                        <Ionicons name="warning" size={16} color={exceeds15K ? '#D32F2F' : '#FF9800'} />
                        <Text style={{ marginLeft: 8, fontSize: 12, color: exceeds15K ? '#D32F2F' : '#E65100' }}>
                          {exceeds15K ? 'Supera soglia €15.000 - Ritenuta fiscale' : 'Supera soglia €5.000 - Contributi previdenziali'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              });
            })()}
          </View>
        )}

        {/* Identity Document */}
        {athlete?.identity_document_photo && !editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🪪 Documento di Riconoscimento</Text>
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <Image
                source={{ uri: athlete.identity_document_photo.startsWith('data:') 
                  ? athlete.identity_document_photo 
                  : `data:image/jpeg;base64,${athlete.identity_document_photo}` 
                }}
                style={{ width: '100%', height: 200, borderRadius: 10 }}
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* Monthly Receipts - READ ONLY for Admin */}
        {contractMonths.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Quietanze Mensili</Text>
            <Text style={styles.cardSubtitle}>
              Stato delle quietanze - Solo l'atleta può firmare
            </Text>

            <View style={styles.monthsGrid}>
              {contractMonths.map((m, idx) => {
                const signed = isReceiptSigned(m.month, m.year);
                const signedDate = getReceiptSignedDate(m.month, m.year);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.monthButton, signed && styles.monthButtonSigned]}
                    onPress={() => {
                      if (signed) {
                        // Show details only for signed receipts
                        setSelectedMonth({ month: m.month, year: m.year });
                        setReceiptModalVisible(true);
                      }
                    }}
                    disabled={!signed}
                  >
                    <Text style={[styles.monthButtonText, signed && styles.monthButtonTextSigned]}>
                      {m.month.substring(0, 3)}
                    </Text>
                    <Text style={[styles.monthButtonYear, signed && styles.monthButtonTextSigned]}>
                      {m.year}
                    </Text>
                    {signed ? (
                      <Ionicons name="checkmark-circle" size={16} color="#fff" style={styles.monthCheck} />
                    ) : (
                      <Text style={{ fontSize: 10, color: '#999', marginTop: 2 }}>In attesa</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Summary */}
            <View style={styles.receiptSummary}>
              <Text style={styles.receiptSummaryText}>
                Quietanze firmate: {signedReceipts.filter(r => r.signed).length} / {contractMonths.length}
              </Text>
            </View>
          </View>
        )}

        {/* Info Section - Same as Coach/Dirigente */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Informazioni Importanti</Text>
          <Text style={styles.infoText}>
            • Fino a €5.000/anno: compenso esente da tasse e contributi{'\n'}
            • Da €5.000 a €15.000: soggetto a contributi previdenziali{'\n'}
            • Oltre €15.000: soggetto anche a imposizione fiscale IRPEF{'\n'}
            • La firma della quietanza genera un PDF inviato via email{'\n'}
            • Al superamento delle soglie è richiesta una dichiarazione
          </Text>
        </View>
      </ScrollView>

      {/* Receipt Modal - READ ONLY for Admin */}
      <Modal
        visible={receiptModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Quietanza {selectedMonth?.month} {selectedMonth?.year}
            </Text>
            <Text style={styles.modalAmount}>
              Importo: €{monthlyCompensation}
            </Text>

            {selectedMonth && isReceiptSigned(selectedMonth.month, selectedMonth.year) && (
              <View style={{ backgroundColor: '#E8F5E9', padding: 16, borderRadius: 12, marginTop: 12 }}>
                <Text style={{ color: '#2E7D32', fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
                  ✓ Firmata dall'atleta
                </Text>
                {getReceiptSignedDate(selectedMonth.month, selectedMonth.year) && (
                  <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Data firma: {new Date(getReceiptSignedDate(selectedMonth.month, selectedMonth.year) || '').toLocaleDateString('it-IT')}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setReceiptModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Chiudi</Text>
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
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearBreakdownCard: {
    // No specific styling needed, using inline styles
  },
  header: {
    backgroundColor: '#B8860B',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8DC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  teamBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B8860B',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B8860B',
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: '#FFF8DC',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B8860B',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 13,
    color: '#666',
  },
  previewAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#B8860B',
    marginTop: 8,
  },
  previewHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#B8860B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  compensationDisplay: {
    gap: 12,
  },
  compensationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  compensationLabel: {
    fontSize: 14,
    color: '#666',
  },
  compensationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  compensationTotal: {
    backgroundColor: '#FFF8DC',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderBottomWidth: 0,
  },
  compensationTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B8860B',
  },
  compensationTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#B8860B',
  },
  bankInfoBox: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  bankInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  bankInfoText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthButton: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  monthButtonSigned: {
    backgroundColor: '#B8860B',
    borderColor: '#B8860B',
  },
  monthButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  monthButtonTextSigned: {
    color: '#fff',
  },
  monthButtonYear: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  monthCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  receiptSummary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF8DC',
    borderRadius: 8,
    alignItems: 'center',
  },
  receiptSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B8860B',
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
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#B8860B',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalButtonCancel: {
    backgroundColor: '#F5F5F5',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonSign: {
    backgroundColor: '#B8860B',
  },
  modalButtonUnsign: {
    backgroundColor: '#FF6B6B',
  },
  modalButtonSignText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // New Bank Section Styles
  bankSection: {
    marginTop: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bankSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  bankIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e3a5f',
  },
  bankInputGroup: {
    marginBottom: 16,
  },
  bankInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bankInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  bankInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bankInputColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  bankInputHalf: {
    flex: 1,
  },
  // Info Section Styles (same as Coach/Dirigente)
  infoSection: {
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 22,
  },
});
