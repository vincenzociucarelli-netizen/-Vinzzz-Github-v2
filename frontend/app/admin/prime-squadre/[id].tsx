import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../../src/services/api';

interface CompensationRecord {
  id: string;
  month: number;
  year: number;
  amount_gross: number;
  receipt_signed: boolean;
  receipt_signed_date?: string;
  exceeded_5000?: boolean;
  exceeded_15000?: boolean;
}

interface ThresholdStatus {
  yearly_total: number;
  monthly_compensation: number;
  prior_compensation: number;
  thresholds: {
    '5000': {
      exceeded: boolean;
      exceeded_month?: number;
      approaching: boolean;
    };
    '15000': {
      exceeded: boolean;
      exceeded_month?: number;
      approaching: boolean;
    };
  };
}

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  team_name?: string;
  monthly_compensation?: number;
  fiscal_code?: string;
}

const MONTHS = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function AthleteCompensationDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [records, setRecords] = useState<CompensationRecord[]>([]);
  const [thresholdStatus, setThresholdStatus] = useState<ThresholdStatus | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sportImage, setSportImage] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [athleteRes, recordsRes, thresholdRes, societyRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/prime-squadre/athletes/${id}/compensation`),
        api.get(`/prime-squadre/athletes/${id}/threshold-status/${selectedYear}`),
        api.get('/settings/society'),
      ]);
      
      setAthlete(athleteRes.data);
      setRecords(recordsRes.data);
      setThresholdStatus(thresholdRes.data);
      setSportImage(societyRes.data.sport_image || null);
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.response?.status === 404) {
        showAlert('Errore', 'Atleta non trovato in Atleti Pro');
        router.back();
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id, selectedYear])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSignReceipt = async (month: number) => {
    try {
      // For now, create a simple signature (in production, this would be a canvas signature)
      const response = await api.post(`/prime-squadre/athletes/${id}/compensation/receipt`, {
        year: selectedYear,
        month: month,
        signature_base64: 'ADMIN_SIGNATURE_PLACEHOLDER' // In production, capture actual signature
      });
      
      showAlert('Successo', `Quietanza per ${MONTHS[month]} firmata con successo`);
      setShowSignModal(false);
      setSelectedMonth(null);
      loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile firmare la quietanza');
    }
  };

  const getMonthStatus = (month: number): 'signed' | 'available' | 'future' | 'approaching_5k' | 'exceeded_5k' | 'exceeded_15k' => {
    const record = records.find(r => r.month === month && r.year === selectedYear);
    const now = new Date();
    const targetDate = new Date(selectedYear, month - 1, 1);
    
    if (record?.receipt_signed) {
      if (record.exceeded_15000) return 'exceeded_15k';
      if (record.exceeded_5000) return 'exceeded_5k';
      return 'signed';
    }
    
    if (targetDate > now) return 'future';
    
    // Check if approaching thresholds
    if (thresholdStatus?.thresholds['5000'].approaching) return 'approaching_5k';
    
    return 'available';
  };

  const getMonthColor = (status: string): string => {
    switch (status) {
      case 'signed': return '#4CAF50';
      case 'exceeded_5k': return '#FF9800';
      case 'exceeded_15k': return '#f44336';
      case 'approaching_5k': return '#FFC107';
      case 'available': return '#2196F3';
      case 'future': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const yearRecords = records.filter(r => r.year === selectedYear);
  const totalSigned = yearRecords.filter(r => r.receipt_signed).reduce((sum, r) => sum + r.amount_gross, 0);

  if (!athlete) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compensi Atleta</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Athlete Info Card */}
        <View style={styles.athleteCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {sportImage && (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${sportImage}` }}
                style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }}
                resizeMode="contain"
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.athleteName}>{athlete.last_name} {athlete.first_name}</Text>
              {athlete.team_name && <Text style={styles.athleteTeam}>{athlete.team_name}</Text>}
              {athlete.fiscal_code && <Text style={styles.fiscalCode}>CF: {athlete.fiscal_code}</Text>}
            </View>
          </View>
          <View style={styles.compensationBadge}>
            <Text style={styles.compensationBadgeText}>€{athlete.monthly_compensation || 0}/mese</Text>
          </View>
        </View>

        {/* Year Selector */}
        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(selectedYear - 1)}
          >
            <Text style={styles.yearButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(selectedYear + 1)}
          >
            <Text style={styles.yearButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Threshold Status */}
        {thresholdStatus && (
          <View style={styles.thresholdCard}>
            <Text style={styles.thresholdTitle}>Soglie Fiscali {selectedYear}</Text>
            <View style={styles.thresholdRow}>
              <Text style={styles.thresholdLabel}>Totale Anno:</Text>
              <Text style={styles.thresholdValue}>€{thresholdStatus.yearly_total.toLocaleString()}</Text>
            </View>
            <View style={styles.thresholdRow}>
              <Text style={styles.thresholdLabel}>Soglia €5.000:</Text>
              <Text style={[styles.thresholdStatus, { 
                color: thresholdStatus.thresholds['5000'].exceeded ? '#f44336' : 
                       thresholdStatus.thresholds['5000'].approaching ? '#FF9800' : '#4CAF50'
              }]}>
                {thresholdStatus.thresholds['5000'].exceeded ? '⚠️ Superata' :
                 thresholdStatus.thresholds['5000'].approaching ? '⚡ In avvicinamento' : '✓ OK'}
              </Text>
            </View>
            <View style={styles.thresholdRow}>
              <Text style={styles.thresholdLabel}>Soglia €15.000:</Text>
              <Text style={[styles.thresholdStatus, { 
                color: thresholdStatus.thresholds['15000'].exceeded ? '#f44336' : 
                       thresholdStatus.thresholds['15000'].approaching ? '#FF9800' : '#4CAF50'
              }]}>
                {thresholdStatus.thresholds['15000'].exceeded ? '⚠️ Superata' :
                 thresholdStatus.thresholds['15000'].approaching ? '⚡ In avvicinamento' : '✓ OK'}
              </Text>
            </View>
          </View>
        )}

        {/* Monthly Grid */}
        <Text style={styles.sectionTitle}>Quietanze Mensili</Text>
        <View style={styles.monthsGrid}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const status = getMonthStatus(month);
            const record = yearRecords.find(r => r.month === month);
            
            return (
              <TouchableOpacity
                key={month}
                style={[styles.monthCard, { borderColor: getMonthColor(status) }]}
                onPress={() => {
                  if (status === 'available' || status === 'approaching_5k') {
                    setSelectedMonth(month);
                    setShowSignModal(true);
                  }
                }}
                disabled={status === 'future' || status === 'signed' || status === 'exceeded_5k' || status === 'exceeded_15k'}
              >
                <Text style={styles.monthName}>{MONTHS[month].substring(0, 3)}</Text>
                {record?.receipt_signed ? (
                  <>
                    <Text style={[styles.monthAmount, { color: getMonthColor(status) }]}>
                      €{record.amount_gross}
                    </Text>
                    <Text style={styles.signedLabel}>✓ Firmata</Text>
                  </>
                ) : status === 'future' ? (
                  <Text style={styles.futureLabel}>🕐</Text>
                ) : (
                  <Text style={styles.signLabel}>Firma</Text>
                )}
                {status === 'exceeded_5k' && <Text style={styles.thresholdBadge}>{'>5K'}</Text>}
                {status === 'exceeded_15k' && <Text style={styles.thresholdBadge}>{'>15K'}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Riepilogo {selectedYear}</Text>
          <Text style={styles.summaryText}>
            Quietanze firmate: {yearRecords.filter(r => r.receipt_signed).length}/12
          </Text>
          <Text style={styles.summaryAmount}>
            Totale erogato: €{totalSigned.toLocaleString()}
          </Text>
        </View>
      </ScrollView>

      {/* Sign Modal */}
      <Modal visible={showSignModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Firma Quietanza</Text>
            <Text style={styles.modalSubtitle}>
              {MONTHS[selectedMonth || 0]} {selectedYear}
            </Text>
            <Text style={styles.modalAmount}>
              Importo: €{athlete.monthly_compensation || 0}
            </Text>
            
            <Text style={styles.modalNote}>
              Cliccando "Firma" confermi di aver ricevuto il compenso mensile indicato.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowSignModal(false);
                  setSelectedMonth(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => selectedMonth && handleSignReceipt(selectedMonth)}
              >
                <Text style={styles.confirmButtonText}>Firma</Text>
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
  header: {
    backgroundColor: '#B8860B',
    padding: 16,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  athleteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  athleteName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  athleteTeam: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  fiscalCode: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  compensationBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  compensationBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B8860B',
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 20,
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  yearText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  thresholdCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  thresholdTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  thresholdLabel: {
    fontSize: 14,
    color: '#666',
  },
  thresholdValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  thresholdStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  monthCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    minHeight: 90,
    justifyContent: 'center',
  },
  monthName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  monthAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  signedLabel: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 2,
  },
  futureLabel: {
    fontSize: 20,
    marginTop: 8,
  },
  signLabel: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 8,
    fontWeight: '500',
  },
  thresholdBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  summaryCard: {
    backgroundColor: '#B8860B',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  summaryText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 8,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#B8860B',
    textAlign: 'center',
    marginTop: 16,
  },
  modalNote: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#B8860B',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
