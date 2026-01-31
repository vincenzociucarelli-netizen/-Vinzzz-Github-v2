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
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete, Team, Payment, Certificate } from '../../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface AthleteAttendanceStats {
  total_attendances: number;
  weekly_attendances: number;
  monthly_attendances: number;
  total_percentage: number;
  monthly_percentage: number;
  weekly_percentage: number;
}

export default function AdminAthleteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [stats, setStats] = useState<AthleteAttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dati' | 'pagamenti' | 'presenze'>('dati');

  const loadData = async () => {
    try {
      const [athleteRes, paymentsRes, certRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/payments/${id}`),
        api.get(`/certificates/${id}`).catch(() => ({ data: null })),
      ]);

      setAthlete(athleteRes.data);
      setPayments(paymentsRes.data);
      setCertificate(certRes.data);

      // Load team info
      if (athleteRes.data.team_id) {
        const teamRes = await api.get(`/teams/${athleteRes.data.team_id}`);
        setTeam(teamRes.data);
        
        // Load attendance stats from team stats
        try {
          const statsRes = await api.get(`/teams/${athleteRes.data.team_id}/attendance-stats`);
          const athleteStats = statsRes.data.athletes.find((a: any) => a.athlete_id === id);
          if (athleteStats) {
            setStats(athleteStats);
          }
        } catch (e) {
          console.log('Could not load attendance stats');
        }
      }
    } catch (error) {
      console.error('Error loading athlete data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#34C759';
      case 'pending': return '#FF9500';
      case 'overdue': return '#FF3B30';
      default: return '#666';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Pagato';
      case 'pending': return 'In attesa';
      case 'overdue': return 'Scaduto';
      default: return status;
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return '#34C759';
    if (percentage >= 50) return '#FF9500';
    return '#FF3B30';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  if (!athlete) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Errore</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Atleta non trovato</Text>
        </View>
      </View>
    );
  }

  const isCertificateExpired = certificate && new Date(certificate.expiry_date) < new Date();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{athlete.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dati' && styles.tabActive]}
          onPress={() => setActiveTab('dati')}
        >
          <Ionicons name="person" size={18} color={activeTab === 'dati' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'dati' && styles.tabTextActive]}>Dati</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pagamenti' && styles.tabActive]}
          onPress={() => setActiveTab('pagamenti')}
        >
          <Ionicons name="card" size={18} color={activeTab === 'pagamenti' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'pagamenti' && styles.tabTextActive]}>Pagamenti</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'presenze' && styles.tabActive]}
          onPress={() => setActiveTab('presenze')}
        >
          <Ionicons name="calendar" size={18} color={activeTab === 'presenze' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'presenze' && styles.tabTextActive]}>Presenze</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* DATI TAB */}
        {activeTab === 'dati' && (
          <>
            {/* Info Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Informazioni Personali</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.label}>Nome Completo</Text>
                <Text style={styles.value}>{athlete.full_name}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.label}>Data di Nascita</Text>
                <Text style={styles.value}>{formatDate(athlete.date_of_birth)}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.label}>Codice Fiscale</Text>
                <Text style={styles.value}>{athlete.fiscal_code}</Text>
              </View>
              
              {athlete.email && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{athlete.email}</Text>
                </View>
              )}
              
              {athlete.phone_athlete && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Telefono Atleta</Text>
                  <Text style={styles.value}>{athlete.phone_athlete}</Text>
                </View>
              )}
              
              {athlete.phone_father && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Telefono Padre</Text>
                  <Text style={styles.value}>{athlete.phone_father}</Text>
                </View>
              )}
              
              {athlete.phone_mother && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Telefono Madre</Text>
                  <Text style={styles.value}>{athlete.phone_mother}</Text>
                </View>
              )}
              
              {athlete.address && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Indirizzo</Text>
                  <Text style={styles.value}>
                    {athlete.address}, {athlete.city} ({athlete.province}) {athlete.postal_code}
                  </Text>
                </View>
              )}
            </View>

            {/* Team Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Squadra</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Squadra</Text>
                <Text style={styles.value}>{team?.name || 'Non assegnata'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Data Iscrizione</Text>
                <Text style={styles.value}>{formatDate(athlete.registration_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Stato</Text>
                <Text style={[styles.value, { color: athlete.status === 'active' ? '#34C759' : '#FF9500' }]}>
                  {athlete.status === 'active' ? 'Attivo' : 'Periodo di prova'}
                </Text>
              </View>
            </View>

            {/* Certificate Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Certificato Medico</Text>
              {certificate ? (
                <>
                  <View style={styles.certStatus}>
                    <Ionicons
                      name={isCertificateExpired ? 'close-circle' : 'checkmark-circle'}
                      size={24}
                      color={isCertificateExpired ? '#FF3B30' : '#34C759'}
                    />
                    <Text style={[styles.certStatusText, { color: isCertificateExpired ? '#FF3B30' : '#34C759' }]}>
                      {isCertificateExpired ? 'SCADUTO' : 'Valido'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Scadenza</Text>
                    <Text style={styles.value}>{formatDate(certificate.expiry_date)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={24} color="#FF9500" />
                  <Text style={styles.warningText}>Nessun certificato caricato</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* PAGAMENTI TAB */}
        {activeTab === 'pagamenti' && (
          <>
            {/* Payment Summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Riepilogo Quote</Text>
              {team && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Quota Totale</Text>
                    <Text style={styles.value}>€{team.total_amount}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>1ª Rata</Text>
                    <Text style={styles.value}>€{team.installment_1_amount}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>2ª Rata</Text>
                    <Text style={styles.value}>€{team.installment_2_amount}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>3ª Rata</Text>
                    <Text style={styles.value}>€{team.installment_3_amount}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Payments List */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Storico Pagamenti</Text>
              {payments.length === 0 ? (
                <View style={styles.emptyPayments}>
                  <Ionicons name="card-outline" size={32} color="#ccc" />
                  <Text style={styles.emptyPaymentsText}>Nessun pagamento registrato</Text>
                </View>
              ) : (
                payments.map((payment, index) => (
                  <View key={payment.id || index} style={styles.paymentItem}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentDescription}>{payment.description}</Text>
                      <Text style={styles.paymentDate}>
                        Scadenza: {formatDate(payment.due_date)}
                      </Text>
                      {payment.paid_at && (
                        <Text style={styles.paymentPaidDate}>
                          Pagato: {formatDate(payment.paid_at)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.paymentRight}>
                      <Text style={styles.paymentAmount}>€{payment.amount}</Text>
                      <View style={[styles.paymentStatus, { backgroundColor: getPaymentStatusColor(payment.status) + '20' }]}>
                        <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(payment.status) }]}>
                          {getPaymentStatusLabel(payment.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* PRESENZE TAB */}
        {activeTab === 'presenze' && (
          <>
            {/* Attendance Stats */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Statistiche Presenze</Text>
              
              {stats ? (
                <>
                  {/* Weekly */}
                  <View style={styles.statRow}>
                    <View style={styles.statInfo}>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                      <Text style={styles.statLabel}>Questa Settimana</Text>
                    </View>
                    <View style={styles.statValues}>
                      <Text style={styles.statCount}>{stats.weekly_attendances} presenze</Text>
                      <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.weekly_percentage) + '20' }]}>
                        <Text style={[styles.percentText, { color: getPercentageColor(stats.weekly_percentage) }]}>
                          {stats.weekly_percentage}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Monthly */}
                  <View style={styles.statRow}>
                    <View style={styles.statInfo}>
                      <Ionicons name="calendar" size={20} color="#FF9500" />
                      <Text style={styles.statLabel}>Questo Mese</Text>
                    </View>
                    <View style={styles.statValues}>
                      <Text style={styles.statCount}>{stats.monthly_attendances} presenze</Text>
                      <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.monthly_percentage) + '20' }]}>
                        <Text style={[styles.percentText, { color: getPercentageColor(stats.monthly_percentage) }]}>
                          {stats.monthly_percentage}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Total */}
                  <View style={styles.statRow}>
                    <View style={styles.statInfo}>
                      <Ionicons name="stats-chart" size={20} color="#5856D6" />
                      <Text style={styles.statLabel}>Totale Stagione</Text>
                    </View>
                    <View style={styles.statValues}>
                      <Text style={styles.statCount}>{stats.total_attendances} presenze</Text>
                      <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.total_percentage) + '20' }]}>
                        <Text style={[styles.percentText, { color: getPercentageColor(stats.total_percentage) }]}>
                          {stats.total_percentage}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyPayments}>
                  <Ionicons name="calendar-outline" size={32} color="#ccc" />
                  <Text style={styles.emptyPaymentsText}>Statistiche non disponibili</Text>
                </View>
              )}
            </View>

            {/* Legend */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Legenda</Text>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                <Text style={styles.legendText}>≥80% - Eccellente</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
                <Text style={styles.legendText}>50-79% - Sufficiente</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                <Text style={styles.legendText}>&lt;50% - Insufficiente</Text>
              </View>
            </View>
          </>
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
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  certStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  certStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
  },
  emptyPayments: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyPaymentsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentPaidDate: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  statValues: {
    alignItems: 'flex-end',
  },
  statCount: {
    fontSize: 13,
    color: '#666',
  },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  percentText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 10,
  },
});
