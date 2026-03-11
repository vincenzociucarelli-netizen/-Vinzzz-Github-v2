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

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
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
  total_amount?: number;
  installment_1_amount?: number;
  installment_2_amount?: number;
  installment_2_due_date?: string;
  installment_3_amount?: number;
  installment_3_due_date?: string;
  discount_amount?: number;
  discount_reason?: string;
  bank_info?: string;
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
  const [planExpanded, setPlanExpanded] = useState(false);

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
      const response = await api.get(`/payments/${profile?.id}/fiscal-receipt`);
      
      if (Platform.OS === 'web') {
        const data = response.data;
        if (data && data.payments && data.payments.length > 0) {
          const totalPaid = data.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          
          // Create a receipt HTML with payment methods - A4 optimized
          const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Ricevuta Pagamenti - ${data.athlete?.last_name} ${data.athlete?.first_name}</title>
              <style>
                @page {
                  size: A4;
                  margin: 20mm;
                }
                * { box-sizing: border-box; }
                body {
                  font-family: Arial, Helvetica, sans-serif;
                  margin: 0;
                  padding: 0;
                  background: #fff;
                  color: #333;
                  font-size: 14px;
                  line-height: 1.5;
                }
                .receipt-container {
                  width: 100%;
                  max-width: 210mm;
                  min-height: 297mm;
                  margin: 0 auto;
                  padding: 15mm;
                  background: #fff;
                }
                .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 3px solid #007AFF;
                }
                .header h1 {
                  font-size: 28px;
                  margin: 0 0 10px 0;
                  color: #007AFF;
                  letter-spacing: 2px;
                }
                .society-name {
                  font-size: 18px;
                  font-weight: bold;
                  color: #333;
                  margin: 10px 0;
                }
                .season { font-size: 14px; color: #666; }
                .section { margin-bottom: 25px; }
                .section-title {
                  font-size: 16px;
                  font-weight: bold;
                  color: #007AFF;
                  border-bottom: 2px solid #007AFF;
                  padding-bottom: 8px;
                  margin-bottom: 15px;
                }
                .info-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 10px 0;
                  border-bottom: 1px solid #eee;
                }
                .info-label { color: #666; font-size: 14px; }
                .info-value { font-weight: bold; font-size: 14px; color: #333; }
                .payments-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 10px;
                }
                .payments-table th {
                  background: #f5f5f5;
                  padding: 12px;
                  text-align: left;
                  font-size: 13px;
                  color: #666;
                  border-bottom: 2px solid #ddd;
                }
                .payments-table td {
                  padding: 12px;
                  border-bottom: 1px solid #eee;
                  font-size: 14px;
                }
                .payments-table .amount {
                  text-align: right;
                  font-weight: bold;
                  color: #4CAF50;
                  font-size: 16px;
                }
                .payments-table .method {
                  color: #888;
                  font-size: 12px;
                  font-style: italic;
                }
                .total-section {
                  margin-top: 30px;
                  padding: 20px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: right;
                }
                .total-label { font-size: 16px; color: #666; }
                .total-amount {
                  font-size: 28px;
                  font-weight: bold;
                  color: #4CAF50;
                  margin-top: 5px;
                }
                .footer {
                  margin-top: 50px;
                  padding-top: 20px;
                  border-top: 1px solid #eee;
                  text-align: center;
                  font-size: 11px;
                  color: #999;
                }
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .receipt-container { padding: 0; min-height: auto; }
                }
              </style>
            </head>
            <body>
              <div class="receipt-container">
                <div class="header">
                  <h1>RICEVUTA PAGAMENTI</h1>
                  <div class="society-name">${data.society?.name || 'Società Sportiva'}</div>
                  <div class="season">Stagione Sportiva ${data.season || ''}</div>
                </div>
                
                <div class="section">
                  <div class="section-title">Dati Atleta</div>
                  <div class="info-row">
                    <span class="info-label">Cognome e Nome:</span>
                    <span class="info-value">${data.athlete?.last_name} ${data.athlete?.first_name}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Codice Fiscale:</span>
                    <span class="info-value">${data.athlete?.fiscal_code || '-'}</span>
                  </div>
                </div>
                
                <div class="section">
                  <div class="section-title">Pagamenti Effettuati</div>
                  <table class="payments-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Modalità</th>
                        <th style="text-align: right;">Importo</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.payments.map((p: any) => {
                        const payDate = p.paid_date ? new Date(p.paid_date).toLocaleDateString('it-IT') : (p.date ? new Date(p.date).toLocaleDateString('it-IT') : '-');
                        const method = p.payment_method || 'Non specificato';
                        return `
                        <tr>
                          <td>${payDate}</td>
                          <td class="method">${method}</td>
                          <td class="amount">€ ${p.amount?.toFixed(2) || '0.00'}</td>
                        </tr>
                      `}).join('')}
                    </tbody>
                  </table>
                </div>
                
                <div class="total-section">
                  <div class="total-label">Totale Pagato</div>
                  <div class="total-amount">€ ${totalPaid.toFixed(2)}</div>
                </div>
                
                <div class="footer">
                  Documento generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </body>
            </html>
          `;
          
          // Convert HTML to Blob and create download link
          const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          
          // Create a temporary link and click it
          const link = document.createElement('a');
          link.href = url;
          link.download = `Ricevuta_${data.athlete?.last_name}_${data.athlete?.first_name}.html`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up URL
          setTimeout(() => URL.revokeObjectURL(url), 100);
        } else {
          window.alert('Nessun pagamento registrato per generare la ricevuta');
        }
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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Quote Section - Compact with expandable payment plan */}
        {paymentInfo && (paymentInfo.total_amount || (paymentInfo.installments && paymentInfo.installments.length > 0)) && (() => {
          // Build installment plan with payment status
          const installments = paymentInfo.installments || [];
          const planItems = installments
            .filter((inst: any) => parseFloat(inst.amount) > 0)
            .map((inst: any, index: number) => {
              const amount = parseFloat(inst.amount) || 0;
              const name = inst.name || (index === 0 ? 'Quota iscrizione' : `Rata ${index}`);
              const dueDate = inst.due_date;
              // Match with actual payments by installment_number
              const matchedPayment = payments.find(p => p.installment_number === (index + 1));
              const paid = matchedPayment ? isPaid(matchedPayment) : false;
              const paidDate = matchedPayment?.paid_date;
              return { name, amount, dueDate, paid, paidDate, index };
            });
          
          // Find next unpaid installment
          const nextDue = planItems.find(item => !item.paid);
          
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>💰</Text>
                <Text style={styles.sectionTitle}>Quote</Text>
              </View>
              
              <View style={styles.sectionContent}>
                {/* Quota Annuale - always visible */}
                {paymentInfo.total_amount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#333' }}>Quota Annuale</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }}>{formatCurrency(paymentInfo.total_amount, true, 0)}</Text>
                  </View>
                )}
                
                {/* Sconto */}
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#4CAF50' }}>Sconto: {discountReason || '-'}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#4CAF50' }}>- {formatCurrency(discount, true, 0)}</Text>
                  </View>
                )}
                
                {/* Next installment due - compact row */}
                {nextDue && (
                  <TouchableOpacity 
                    style={{ 
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: '#FFF3F0', borderRadius: 10, padding: 12, marginBottom: 8,
                      borderLeftWidth: 4, borderLeftColor: '#FF3B30'
                    }}
                    onPress={() => setPlanExpanded(!planExpanded)}
                    data-testid="next-installment-row"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Prossima rata</Text>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#FF3B30' }}>
                        {nextDue.name}: {formatCurrency(nextDue.amount, true, 0)}
                        {nextDue.dueDate ? ` - Scad. ${formatDate(nextDue.dueDate)}` : ''}
                      </Text>
                    </View>
                    <Ionicons name={planExpanded ? "chevron-up" : "chevron-down"} size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
                
                {!nextDue && planItems.length > 0 && (
                  <TouchableOpacity 
                    style={{ 
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, marginBottom: 8,
                      borderLeftWidth: 4, borderLeftColor: '#4CAF50'
                    }}
                    onPress={() => setPlanExpanded(!planExpanded)}
                    data-testid="all-paid-row"
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#4CAF50' }}>Tutte le rate pagate!</Text>
                    <Ionicons name={planExpanded ? "chevron-up" : "chevron-down"} size={20} color="#4CAF50" />
                  </TouchableOpacity>
                )}
                
                {/* Expandable full payment plan */}
                {planExpanded && (
                  <View style={{ marginTop: 4 }}>
                    {planItems.map((item, idx) => (
                      <View 
                        key={idx} 
                        style={{ 
                          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                          paddingVertical: 10, paddingHorizontal: 8,
                          borderBottomWidth: idx < planItems.length - 1 ? 1 : 0, 
                          borderBottomColor: '#f0f0f0',
                          backgroundColor: item.paid ? '#F0F8FF' : 'transparent'
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ 
                            fontSize: 14, fontWeight: '500', 
                            color: item.paid ? '#2196F3' : '#FF3B30',
                            textDecorationLine: item.paid ? 'line-through' : 'none'
                          }}>
                            {item.name}
                          </Text>
                          {item.paid && item.paidDate && (
                            <Text style={{ fontSize: 11, color: '#2196F3', marginTop: 2 }}>
                              Pagata il {formatDate(item.paidDate)}
                            </Text>
                          )}
                          {!item.paid && item.dueDate && (
                            <Text style={{ fontSize: 11, color: '#FF3B30', marginTop: 2 }}>
                              Scadenza: {formatDate(item.dueDate)}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ 
                            fontSize: 15, fontWeight: '600', 
                            color: item.paid ? '#2196F3' : '#FF3B30',
                            textDecorationLine: item.paid ? 'line-through' : 'none'
                          }}>
                            {formatCurrency(item.amount, true, 0)}
                          </Text>
                          <Ionicons 
                            name={item.paid ? "checkmark-circle" : "ellipse-outline"} 
                            size={20} 
                            color={item.paid ? '#2196F3' : '#FF3B30'} 
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Pagamenti Ricevuti - Only show paid payments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>✅</Text>
            <Text style={styles.sectionTitle}>Pagamenti Ricevuti</Text>
          </View>
          
          <View style={styles.sectionContent}>
            {payments.filter(p => isPaid(p)).length === 0 ? (
              <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
            ) : (
              payments.filter(p => isPaid(p)).map((payment, index) => (
                <View 
                  key={payment.id} 
                  style={styles.installmentCard}
                >
                  <View style={styles.installmentInfo}>
                    <Text style={styles.installmentTitle}>
                      Rata {index + 1}
                    </Text>
                    <Text style={[styles.installmentAmount, { color: '#4CAF50' }]}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    {payment.paid_date && (
                      <Text style={styles.installmentDue}>
                        Pagato il: {formatDate(payment.paid_date)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.installmentStatus}>
                    <Text style={styles.statusEmoji}>✅</Text>
                    <Text style={[styles.statusLabel, { color: '#4CAF50' }]}>Pagata</Text>
                  </View>
                </View>
              ))
            )}
          </View>
          
          {/* Residuo Dovuto - Calcolo corretto: quota totale - sconto - pagato */}
          {(() => {
            const quotaTotale = paymentInfo?.total_amount || 0;
            const scontoApplicato = discount || 0;
            const residuo = quotaTotale - scontoApplicato - totalPaid;
            return residuo > 0 ? (
              <View style={styles.residueRow}>
                <Text style={styles.residueLabel}>Residuo Dovuto</Text>
                <Text style={styles.residueAmount}>{formatCurrency(residuo)}</Text>
              </View>
            ) : null;
          })()}
        </View>

        {/* Modalità di pagamento */}
        {(iban || bankInfoText || paypalEmail) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>💳</Text>
              <Text style={styles.sectionTitle}>Modalità di pagamento:</Text>
            </View>
            
            <View style={styles.sectionContent}>
              {/* Show bank_info from team if available */}
              {bankInfoText && (
                <View style={styles.paymentMethod}>
                  <Text style={styles.paymentMethodIcon}>🏦</Text>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Bonifico Bancario:</Text>
                    <Text style={[styles.paymentMethodValue, { whiteSpace: 'pre-wrap' }]}>{bankInfoText}</Text>
                  </View>
                </View>
              )}
              
              {/* Fallback to society IBAN if no team bank_info */}
              {!bankInfoText && iban && (
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
                <Text style={styles.paidAmount}>{formatCurrency(totalPaid)}</Text>
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
          <Text style={styles.downloadText}>Scarica Ricevuta Pagamenti</Text>
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
