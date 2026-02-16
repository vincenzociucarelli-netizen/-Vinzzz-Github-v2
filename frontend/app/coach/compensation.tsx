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
  year: int;
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
  
  // Signature modal
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  
  // Threshold flags
  const [showExceeded5000, setShowExceeded5000] = useState(false);
  const [showExceeded15000, setShowExceeded15000] = useState(false);
  
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
      
      // Load compensation records
      const recordsRes = await api.get(`/coach/${user?.id}/compensation`);
      const yearRecords = recordsRes.data.filter((r: CompensationRecord) => r.year === currentYear);
      setRecords(yearRecords);
      
      // Calculate yearly total
      const total = yearRecords
        .filter((r: CompensationRecord) => r.received)
        .reduce((sum: number, r: CompensationRecord) => sum + (r.amount_gross || r.amount || 0), 0);
      setYearlyTotal(total);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSignature = (month: number) => {
    // Check if this month is already signed
    const existingRecord = records.find(r => r.month === month && r.receipt_signed);
    if (existingRecord) {
      Alert.alert('Già firmata', 'La quietanza per questo mese è già stata firmata.');
      return;
    }
    
    setSelectedMonth(month);
    setSignature(null);
    
    // Calculate new total and check thresholds
    const monthlyAmount = profile?.monthly_compensation || 0;
    const newTotal = yearlyTotal + monthlyAmount;
    
    setShowExceeded5000(newTotal > 5000 && yearlyTotal <= 5000);
    setShowExceeded15000(newTotal > 15000 && yearlyTotal <= 15000);
    
    setShowSignatureModal(true);
  };

  const handleSign = async (exceeded5000: boolean = false, exceeded15000: boolean = false) => {
    if (!signature || !selectedMonth || !profile) {
      Alert.alert('Errore', 'Firma richiesta');
      return;
    }
    
    try {
      setSigning(true);
      
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

  const getMonthStatus = (month: number): 'pending' | 'signed' | 'future' => {
    if (month > currentMonth && currentYear >= new Date().getFullYear()) {
      return 'future';
    }
    const record = records.find(r => r.month === month);
    if (record?.receipt_signed) {
      return 'signed';
    }
    return 'pending';
  };

  const renderMonthCard = (month: number) => {
    const status = getMonthStatus(month);
    const record = records.find(r => r.month === month);
    const monthlyAmount = profile?.monthly_compensation || 0;
    
    return (
      <TouchableOpacity
        key={month}
        style={[
          styles.monthCard,
          status === 'signed' && styles.monthCardSigned,
          status === 'future' && styles.monthCardFuture,
        ]}
        onPress={() => status === 'pending' && handleOpenSignature(month)}
        disabled={status === 'future'}
        data-testid={`month-card-${month}`}
      >
        <View style={styles.monthHeader}>
          <Text style={styles.monthName}>{MONTH_NAMES[month]}</Text>
          {status === 'signed' && (
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          )}
          {status === 'future' && (
            <Ionicons name="time-outline" size={20} color="#999" />
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
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compensi Sportivi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Riepilogo {currentYear}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Compenso mensile:</Text>
            <Text style={styles.summaryValue}>€ {(profile?.monthly_compensation || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Totale ricevuto:</Text>
            <Text style={[styles.summaryValue, styles.summaryTotal]}>€ {yearlyTotal.toFixed(2)}</Text>
          </View>
          
          {/* Threshold warnings */}
          {yearlyTotal > 5000 && (
            <View style={[styles.thresholdBanner, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="warning" size={16} color="#856404" />
              <Text style={styles.thresholdText}>Superata soglia €5.000</Text>
            </View>
          )}
          {yearlyTotal > 15000 && (
            <View style={[styles.thresholdBanner, { backgroundColor: '#F8D7DA' }]}>
              <Ionicons name="alert-circle" size={16} color="#721C24" />
              <Text style={[styles.thresholdText, { color: '#721C24' }]}>Superata soglia €15.000</Text>
            </View>
          )}
        </View>

        {/* Monthly Cards */}
        <Text style={styles.sectionTitle}>Quietanze Mensili</Text>
        <View style={styles.monthsGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => renderMonthCard(month))}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Informazioni</Text>
          <Text style={styles.infoText}>
            • Fino a €5.000/anno: compenso esente da tasse{'\n'}
            • Da €5.000 a €15.000: ritenuta IRPEF 23%{'\n'}
            • Oltre €15.000: contributi INPS + IRPEF{'\n'}
            • La firma della quietanza genera un PDF che viene inviato via email
          </Text>
        </View>
      </ScrollView>

      {/* Signature Modal */}
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

              {/* Threshold Warning */}
              {showExceeded5000 && (
                <View style={[styles.warningBox, { backgroundColor: '#FFF3CD' }]}>
                  <Ionicons name="warning" size={20} color="#856404" />
                  <Text style={styles.warningText}>
                    Con questo compenso supererai la soglia di €5.000 annuali.
                    Dalla prossima quietanza verranno applicate le ritenute IRPEF.
                  </Text>
                </View>
              )}

              {showExceeded15000 && (
                <View style={[styles.warningBox, { backgroundColor: '#F8D7DA' }]}>
                  <Ionicons name="alert-circle" size={20} color="#721C24" />
                  <Text style={[styles.warningText, { color: '#721C24' }]}>
                    ATTENZIONE: Con questo compenso supererai la soglia di €15.000 annuali.
                    Saranno applicati contributi INPS e obblighi fiscali aggiuntivi.
                  </Text>
                </View>
              )}

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
                  onPress={() => handleSign(showExceeded5000, showExceeded15000)}
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
    marginBottom: 20,
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
  thresholdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  thresholdText: {
    fontSize: 13,
    color: '#856404',
    flex: 1,
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
