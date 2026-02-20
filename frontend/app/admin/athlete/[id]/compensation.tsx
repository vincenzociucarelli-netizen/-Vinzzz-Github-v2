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
  const [ibanHolder, setIbanHolder] = useState('');
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

  const loadData = async () => {
    try {
      const [athleteRes, teamRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/athletes/${id}/team`).catch(() => ({ data: null })),
      ]);
      
      const athleteData = athleteRes.data;
      setAthlete(athleteData);
      setTeam(teamRes.data);
      
      // Load compensation settings
      setMonthlyCompensation(athleteData.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(athleteData.other_annual_compensation?.toString() || '0');
      setPriorCompensation(athleteData.prior_compensation?.toString() || '0');
      setContractStartDate(athleteData.contract_start_date || '');
      setContractEndDate(athleteData.contract_end_date || '');
      
      // Bank info
      setIban(athleteData.iban || '');
      setIbanHolder(athleteData.iban_holder || '');
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
        iban_holder: ibanHolder || null,
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

  const handleDateInput = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^\d\/]/g, '');
    let formatted = cleaned;
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      formatted = cleaned + '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      formatted = cleaned + '/';
    }
    const parts = formatted.split('/');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      setter(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      setter(formatted);
    }
  };

  // Calculate compensation breakdown
  const getCompensationBreakdown = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const other = parseFloat(otherAnnualCompensation) || 0;
    const prior = parseFloat(priorCompensation) || 0;
    
    if (!contractStartDate || !contractEndDate) {
      return { monthsInContract: 0, thisClubTotal: 0, grandTotal: other };
    }
    
    const start = new Date(contractStartDate);
    const end = new Date(contractEndDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    const thisClubTotal = monthly * months;
    
    return {
      monthsInContract: months,
      thisClubTotal,
      grandTotal: thisClubTotal + other,
    };
  };

  // Get months in contract range
  const getContractMonths = () => {
    if (!contractStartDate || !contractEndDate) return [];
    
    const months: {month: string, year: number, monthIndex: number}[] = [];
    const start = new Date(contractStartDate);
    const end = new Date(contractEndDate);
    
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
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🏦 Dati Bancari</Text>
              
              <Text style={styles.inputLabel}>IBAN</Text>
              <TextInput
                style={styles.input}
                value={iban}
                onChangeText={(t) => setIban(t.toUpperCase())}
                placeholder="IT00X0000000000000000000000"
                autoCapitalize="characters"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Intestatario</Text>
              <TextInput
                style={styles.input}
                value={ibanHolder}
                onChangeText={setIbanHolder}
                placeholder="Nome Cognome"
                autoCapitalize="words"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Banca</Text>
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Nome Banca"
              />

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
              </View>

              {/* Bank Info Display */}
              {iban && (
                <View style={styles.bankInfoBox}>
                  <Text style={styles.bankInfoTitle}>🏦 Dati Bancari</Text>
                  <Text style={styles.bankInfoText}>IBAN: {iban}</Text>
                  {ibanHolder && <Text style={styles.bankInfoText}>Intestatario: {ibanHolder}</Text>}
                  {bankName && <Text style={styles.bankInfoText}>Banca: {bankName}</Text>}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Monthly Receipts */}
        {contractMonths.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Quietanze Mensili</Text>
            <Text style={styles.cardSubtitle}>
              Clicca su un mese per registrare la firma della quietanza
            </Text>

            <View style={styles.monthsGrid}>
              {contractMonths.map((m, idx) => {
                const signed = isReceiptSigned(m.month, m.year);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.monthButton, signed && styles.monthButtonSigned]}
                    onPress={() => {
                      setSelectedMonth({ month: m.month, year: m.year });
                      setReceiptModalVisible(true);
                    }}
                  >
                    <Text style={[styles.monthButtonText, signed && styles.monthButtonTextSigned]}>
                      {m.month.substring(0, 3)}
                    </Text>
                    <Text style={[styles.monthButtonYear, signed && styles.monthButtonTextSigned]}>
                      {m.year}
                    </Text>
                    {signed && (
                      <Ionicons name="checkmark-circle" size={16} color="#fff" style={styles.monthCheck} />
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
      </ScrollView>

      {/* Receipt Modal */}
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

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setReceiptModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              
              {selectedMonth && !isReceiptSigned(selectedMonth.month, selectedMonth.year) ? (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSign]}
                  onPress={() => selectedMonth && handleSignReceipt(selectedMonth.month, selectedMonth.year, true)}
                  disabled={signingReceipt}
                >
                  {signingReceipt ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.modalButtonSignText}>Firma Quietanza</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonUnsign]}
                  onPress={() => selectedMonth && handleSignReceipt(selectedMonth.month, selectedMonth.year, false)}
                  disabled={signingReceipt}
                >
                  {signingReceipt ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="close" size={18} color="#fff" />
                      <Text style={styles.modalButtonSignText}>Annulla Firma</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
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
});
