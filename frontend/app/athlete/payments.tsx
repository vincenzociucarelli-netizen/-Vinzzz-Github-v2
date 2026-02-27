import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { useAuthStore } from '../../src/store/authStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Payment {
  id: string;
  athlete_id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status?: 'pending' | 'paid' | 'overdue';
  paid?: boolean;
  description: string;
  installment_number?: number;
}

interface TeamPaymentInfo {
  seasonal_fee?: number;
  discount_amount?: number;
  discount_reason?: string;
  bank_iban?: string;
  bank_name?: string;
  paypal_email?: string;
}

export default function AthletePayments() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<TeamPaymentInfo | null>(null);
  const [societySettings, setSocietySettings] = useState<any>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  const loadData = async () => {
    try {
      const meRes = await api.get('/auth/me');
      const athleteId = meRes.data.athlete_id;
      
      if (athleteId) {
        // Load athlete profile
        const athleteRes = await api.get(`/athletes/${athleteId}`);
        setProfile(athleteRes.data);
        
        // Load payments
        const paymentsRes = await api.get(`/payments/${athleteId}`);
        const paymentData = paymentsRes.data || [];
        setPayments(paymentData);
        
        // Calculate totals
        const isPaidFn = (p: Payment) => p.paid === true || p.status === 'paid';
        const due = paymentData.filter((p: Payment) => !isPaidFn(p)).reduce((sum: number, p: Payment) => sum + p.amount, 0);
        const paid = paymentData.filter((p: Payment) => isPaidFn(p)).reduce((sum: number, p: Payment) => sum + p.amount, 0);
        setTotalDue(due);
        setTotalPaid(paid);
        
        // Load team payment info
        if (athleteRes.data.team_id) {
          try {
            const teamInfoRes = await api.get(`/teams/${athleteRes.data.team_id}/payment-info`);
            setPaymentInfo(teamInfoRes.data);
          } catch (e) {
            console.log('No team payment info');
          }
        }
        
        // Load society settings for IBAN
        try {
          const societyRes = await api.get('/settings/society');
          setSocietySettings(societyRes.data);
        } catch (e) {
          console.log('No society settings');
        }
      }
    } catch (error) {
      console.error('Error loading payments:', error);
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

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '-';
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const isPaid = (payment: Payment) => payment.paid === true || payment.status === 'paid';
  
  const isOverdue = (payment: Payment) => {
    if (isPaid(payment)) return false;
    if (!payment.due_date) return false;
    return new Date(payment.due_date) < new Date();
  };

  const getInstallmentTitle = (payment: Payment, index: number) => {
    if (payment.description) return payment.description;
    if (index === 0) return 'Pagamento Rata Iscrizione';
    return `Pagamento ${index}ª Rata`;
  };

  const downloadReceipt = async () => {
    try {
      const response = await api.get(`/payments/${profile?.id}/receipt`, {
        responseType: 'blob'
      });
      
      if (Platform.OS === 'web') {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore durante il download';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Errore', msg);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const seasonalFee = paymentInfo?.seasonal_fee || 0;
  const discount = paymentInfo?.discount_amount || profile?.discount_amount || 0;
  const discountReason = paymentInfo?.discount_reason || profile?.discount_reason || '';
  // Bank info can be from society settings (iban field) or team payment info (bank_info as text)
  const bankInfoText = paymentInfo?.bank_info || '';
  const iban = societySettings?.iban || paymentInfo?.bank_iban || (bankInfoText.includes('IBAN') ? bankInfoText : '');
  const bankName = societySettings?.ragione_sociale || paymentInfo?.bank_name || 'Pallavolo Perugia SSD a RL';
  const paypalEmail = societySettings?.paypal_email || paymentInfo?.paypal_email || '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.full_name || 'Pagamenti'}</Text>
        <TouchableOpacity onPress={downloadReceipt}>
          <View style={styles.receiptButton}>
            <Ionicons name="document-text" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Pagamenti Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💰</Text>
            <Text style={styles.sectionTitle}>Pagamenti</Text>
          </View>
          
          <View style={styles.sectionContent}>
            {/* Quota Stagionale */}
            {seasonalFee > 0 && (
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Quota Stagionale:</Text>
                <Text style={styles.feeAmount}>€ {seasonalFee.toFixed(2)}</Text>
              </View>
            )}
            
            {/* Sconto */}
            {discount > 0 && (
              <View style={styles.feeRow}>
                <Text style={[styles.feeLabel, { color: '#4CAF50' }]}>
                  Sconto applicato per: {discountReason || 'Non specificato'}
                </Text>
                <Text style={[styles.feeAmount, { color: '#4CAF50' }]}>- € {discount.toFixed(2)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Dettaglio Rate */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>📅</Text>
            <Text style={styles.sectionTitle}>Dettaglio Rate</Text>
          </View>
          
          <View style={styles.sectionContent}>
            {payments.length === 0 ? (
              <Text style={styles.emptyText}>Nessuna rata registrata</Text>
            ) : (
              payments.map((payment, index) => {
                const paid = isPaid(payment);
                const overdue = isOverdue(payment);
                
                return (
                  <View 
                    key={payment.id} 
                    style={[
                      styles.installmentCard,
                      overdue && !paid && styles.installmentOverdue
                    ]}
                  >
                    <View style={styles.installmentInfo}>
                      <Text style={styles.installmentTitle}>
                        {getInstallmentTitle(payment, index)}
                      </Text>
                      <Text style={[styles.installmentAmount, paid && { color: '#4CAF50' }]}>
                        € {payment.amount.toFixed(2)}
                      </Text>
                      <Text style={[
                        styles.installmentDue,
                        overdue && !paid && styles.installmentDueOverdue
                      ]}>
                        Scadenza: {formatDate(payment.due_date)}
                        {overdue && !paid && ' ⚠️ SCADUTA'}
                      </Text>
                    </View>
                    <View style={styles.installmentStatus}>
                      {paid ? (
                        <>
                          <Text style={styles.statusEmoji}>✅</Text>
                          <Text style={[styles.statusLabel, { color: '#4CAF50' }]}>Pagata</Text>
                        </>
                      ) : overdue ? (
                        <>
                          <Text style={styles.statusEmoji}>⏰</Text>
                          <Text style={[styles.statusLabel, { color: '#F44336' }]}>Scaduta</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.statusEmoji}>⏳</Text>
                          <Text style={[styles.statusLabel, { color: '#FF9800' }]}>Da pagare</Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
          
          {/* Residuo Dovuto */}
          {totalDue > 0 && (
            <View style={styles.residueRow}>
              <Text style={styles.residueLabel}>Residuo Dovuto</Text>
              <Text style={styles.residueAmount}>€ {totalDue.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Modalità di pagamento */}
        {(iban || paypalEmail) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>💳</Text>
              <Text style={styles.sectionTitle}>Modalità di pagamento:</Text>
            </View>
            
            <View style={styles.sectionContent}>
              {iban && (
                <View style={styles.paymentMethod}>
                  <Text style={styles.paymentMethodIcon}>🏦</Text>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Bonifico Bancario:</Text>
                    <Text style={styles.paymentMethodValue}>{iban}</Text>
                    <Text style={styles.paymentMethodValue}>{bankName}</Text>
                    <Text style={styles.paymentMethodNote}>Causale: inserire il nome dell'atleta</Text>
                  </View>
                </View>
              )}
              
              {paypalEmail && (
                <View style={styles.paymentMethod}>
                  <Text style={styles.paymentMethodIcon}>🅿️</Text>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>PayPal:</Text>
                    <Text style={styles.paymentMethodValue}>{paypalEmail}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Pagamenti Effettuati */}
        {totalPaid > 0 && (
          <View style={[styles.section, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.sectionTitle, { color: '#4CAF50', textAlign: 'center', marginBottom: 8 }]}>
              Pagamenti Effettuati:
            </Text>
            <View style={styles.paidSummary}>
              <View>
                <Text style={styles.paidAmount}>€{totalPaid.toFixed(2)}</Text>
                {payments.filter(p => isPaid(p)).length > 0 && (
                  <Text style={styles.paidDate}>
                    {formatDate(payments.filter(p => isPaid(p))[0]?.paid_date || '')}
                  </Text>
                )}
              </View>
              <Text style={styles.paidCheckmark}>✅</Text>
            </View>
          </View>
        )}

        {/* Scarica Ricevuta Button */}
        <TouchableOpacity style={styles.downloadButton} onPress={downloadReceipt}>
          <Text style={styles.downloadEmoji}>🧾</Text>
          <Text style={styles.downloadText}>Scarica Ricevuta Fiscale</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  sectionContent: {
    padding: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  feeAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  installmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  installmentOverdue: {
    backgroundColor: '#FFEBEE',
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  installmentInfo: {
    flex: 1,
  },
  installmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  installmentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 2,
  },
  installmentDue: {
    fontSize: 13,
    color: '#666',
  },
  installmentDueOverdue: {
    color: '#F44336',
    fontWeight: '600',
  },
  installmentStatus: {
    alignItems: 'center',
    marginLeft: 12,
  },
  statusEmoji: {
    fontSize: 28,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  residueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  residueLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  residueAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F44336',
  },
  paymentMethod: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  paymentMethodIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentMethodValue: {
    fontSize: 13,
    color: '#666',
  },
  paymentMethodNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  paidSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  paidAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  paidDate: {
    fontSize: 13,
    color: '#666',
  },
  paidCheckmark: {
    fontSize: 36,
  },
  downloadButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  downloadEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 20,
  },
});
