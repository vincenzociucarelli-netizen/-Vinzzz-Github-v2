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
        <Text style={styles.headerTitle}>Dettaglio Atleta</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 🆕 27/06/2026 — Pagina dettaglio "Atleti Pro" sostituita da banner-link
          verso la scheda Atleta unificata. La sezione "Atleti Pro" resta come
          lista filtrata per il modulo premium, ma il dettaglio è UNA SOLA fonte. */}
      <ScrollView style={styles.content}>
        <View style={{ margin: 16, backgroundColor: '#E3F2FD', borderRadius: 14, padding: 18, borderLeftWidth: 4, borderLeftColor: '#1565C0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Text style={{ fontSize: 22 }}>👤</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0D47A1', flex: 1 }}>
              Scheda Atleta unificata
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0D47A1', marginBottom: 6 }}>
            {athlete.last_name} {athlete.first_name}
          </Text>
          {athlete.team_name ? (
            <Text style={{ fontSize: 12, color: '#1565C0', marginBottom: 10 }}>
              🏐 {athlete.team_name}
            </Text>
          ) : null}
          <Text style={{ fontSize: 13, color: '#1565C0', lineHeight: 19, marginBottom: 14 }}>
            Per evitare duplicazioni, tutta la gestione di compensi, quietanze, soglie €5k/€15k, anagrafica, presenze e dati bancari di questo atleta è centralizzata nella <Text style={{ fontWeight: '700' }}>scheda Atleta principale</Text>. Apri lì per modificare i dati.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace(`/admin/athlete/${athlete.id}` as any)}
            data-testid="admin-pro-go-to-athlete-btn"
            style={{ backgroundColor: '#1565C0', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <Text style={{ fontSize: 18 }}>🏐</Text>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              Apri Scheda Atleta completa
            </Text>
            <Text style={{ color: '#fff', fontSize: 16 }}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 16, padding: 12, backgroundColor: '#FFF3E0', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#FB8C00' }}>
          <Text style={{ fontSize: 12, color: '#E65100', lineHeight: 17 }}>
            💡 La sezione <Text style={{ fontWeight: '700' }}>Atleti Pro</Text> resta come elenco filtrato (utile anche come modulo premium acquistabile), ma il <Text style={{ fontWeight: '700' }}>dettaglio</Text> è uno solo per non disallineare i dati.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Rendering legacy del dettaglio Atleti Pro disabilitato — vedi banner-link sopra.
// La logica viene mantenuta nel commento per riferimento futuro nel caso si volesse
// ripristinare una vista light specifica per il modulo Pro.
function _LegacyAthleteCompensationDetailPage_DEPRECATED() {
  return (
    <View>
      {/* legacy content removed 27/06/2026 */}
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
