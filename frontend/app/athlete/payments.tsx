import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
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
  paid?: boolean;  // Boolean field from DB
  description: string;
  installment_number?: number;
}

export default function AthletePayments() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  const loadData = async () => {
    try {
      // Get athlete ID from user
      const meRes = await api.get('/auth/me');
      const aid = meRes.data.athlete_id;
      setAthleteId(aid);
      
      if (aid) {
        // Load payments
        const paymentsRes = await api.get(`/payments/${aid}`);
        const paymentData = paymentsRes.data || [];
        setPayments(paymentData);
        
        // Calculate totals - check both 'paid' boolean and 'status' field
        const isPaid = (p: Payment) => p.paid === true || p.status === 'paid';
        const due = paymentData.filter((p: Payment) => !isPaid(p)).reduce((sum: number, p: Payment) => sum + p.amount, 0);
        const paid = paymentData.filter((p: Payment) => isPaid(p)).reduce((sum: number, p: Payment) => sum + p.amount, 0);
        setTotalDue(due);
        setTotalPaid(paid);
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
      return format(new Date(dateStr), 'dd MMM yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  // Helper to check if payment is paid
  const isPaid = (payment: Payment) => payment.paid === true || payment.status === 'paid';

  const getStatusColor = (payment: Payment) => {
    if (isPaid(payment)) return '#4CAF50';
    if (payment.status === 'overdue') return '#F44336';
    return '#FF9800';
  };

  const getStatusText = (payment: Payment) => {
    if (isPaid(payment)) return 'Pagato';
    if (payment.status === 'overdue') return 'Scaduto';
    return 'Da pagare';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>I Miei Pagamenti</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.summaryLabel}>Pagato</Text>
            <Text style={[styles.summaryAmount, { color: '#4CAF50' }]}>€ {totalPaid.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.summaryLabel}>Da Pagare</Text>
            <Text style={[styles.summaryAmount, { color: '#FF9800' }]}>€ {totalDue.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payments List */}
        <Text style={styles.sectionTitle}>Rate e Pagamenti</Text>
        
        {payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentDescription}>
                  {payment.description || `Rata ${payment.installment_number || ''}`}
                </Text>
                {payment.due_date && (
                  <Text style={styles.paymentDate}>
                    Scadenza: {formatDate(payment.due_date)}
                  </Text>
                )}
                {payment.paid_date && (
                  <Text style={[styles.paymentDate, { color: '#4CAF50' }]}>
                    Pagato il: {formatDate(payment.paid_date)}
                  </Text>
                )}
              </View>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>€ {payment.amount.toFixed(2)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(payment.status)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
        
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 16,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 13,
    color: '#666',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
