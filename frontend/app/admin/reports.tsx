import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface ReportSummary {
  year: number;
  month: number;
  month_name: string;
  breakdown: {
    coach: { count: number; total: number };
    dirigente: { count: number; total: number };
    atleta: { count: number; total: number };
    atleta_pro: { count: number; total: number };
  };
  total_count: number;
  total_amount: number;
}

interface SocietySettings {
  sport_image: string | null;
}

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [society, setSociety] = useState<SocietySettings>({ sport_image: null });

  // Load society settings on mount
  useEffect(() => {
    const loadSociety = async () => {
      try {
        const res = await api.get('/settings/society');
        setSociety({ sport_image: res.data.sport_image || null });
      } catch (error) {
        console.log('Error loading society settings');
      }
    };
    loadSociety();
  }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reports/monthly-compensation/${selectedYear}/${selectedMonth}/summary`);
      setSummary(response.data);
    } catch (error: any) {
      console.error('Error loading summary:', error);
      showAlert('Errore', 'Impossibile caricare il riepilogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedYear, selectedMonth]);

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await api.get(
        `/reports/monthly-compensation/${selectedYear}/${selectedMonth}`,
        { responseType: 'blob' }
      );
      
      if (Platform.OS === 'web') {
        // Create blob and download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_quietanze_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        showAlert('Successo', 'Report scaricato!');
      } else {
        showAlert('Info', 'Download PDF disponibile solo su web');
      }
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      showAlert('Errore', 'Impossibile scaricare il report');
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `€ ${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Quietanze</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Selector */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Seleziona Periodo</Text>
        
        <View style={styles.selectorRow}>
          {/* Year Selector */}
          <View style={styles.selectorGroup}>
            <Text style={styles.selectorSubLabel}>Anno</Text>
            <View style={styles.pillsContainer}>
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.pill,
                    selectedYear === year && styles.pillSelected
                  ]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text style={[
                    styles.pillText,
                    selectedYear === year && styles.pillTextSelected
                  ]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Month Selector */}
        <View style={styles.monthsGrid}>
          {MONTHS.map((month, index) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.monthPill,
                selectedMonth === index + 1 && styles.monthPillSelected
              ]}
              onPress={() => setSelectedMonth(index + 1)}
            >
              <Text style={[
                styles.monthPillText,
                selectedMonth === index + 1 && styles.monthPillTextSelected
              ]}>
                {month.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary Card */}
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
      ) : summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            Riepilogo {summary.month_name} {summary.year}
          </Text>

          {/* Breakdown */}
          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#64B5F6' }]}>
                  <Text style={{ fontSize: 24 }}>🏋️</Text>
                </View>
                <Text style={styles.breakdownLabel}>Coach</Text>
                <Text style={styles.breakdownCount}>{summary.breakdown.coach.count}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(summary.breakdown.coach.total)}</Text>
              </View>

              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#9575CD' }]}>
                  <Ionicons name="briefcase" size={24} color="#fff" />
                </View>
                <Text style={styles.breakdownLabel}>Dirigenti</Text>
                <Text style={styles.breakdownCount}>{summary.breakdown.dirigente.count}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(summary.breakdown.dirigente.total)}</Text>
              </View>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#81C784' }]}>
                  {society.sport_image ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${society.sport_image}` }}
                      style={{ width: 32, height: 32, borderRadius: 4 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="fitness" size={24} color="#fff" />
                  )}
                </View>
                <Text style={styles.breakdownLabel}>Atleti</Text>
                <Text style={styles.breakdownCount}>{summary.breakdown.atleta.count}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(summary.breakdown.atleta.total)}</Text>
              </View>

              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#FFB74D' }]}>
                  <Ionicons name="people" size={24} color="#fff" />
                </View>
                <Text style={styles.breakdownLabel}>Collaboratori</Text>
                <Text style={styles.breakdownCount}>{summary.breakdown.collaboratore?.count || 0}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(summary.breakdown.collaboratore?.total || 0)}</Text>
              </View>
            </View>
          </View>

          {/* Total */}
          <View style={styles.totalContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Totale Quietanze</Text>
              <Text style={styles.totalCount}>{summary.total_count}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Importo Totale</Text>
              <Text style={styles.totalAmount}>{formatCurrency(summary.total_amount)}</Text>
            </View>
          </View>

          {/* Download Button */}
          <TouchableOpacity
            style={[
              styles.downloadButton,
              (downloading || summary.total_count === 0) && styles.downloadButtonDisabled
            ]}
            onPress={downloadPDF}
            disabled={downloading || summary.total_count === 0}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>
                  {summary.total_count === 0 ? 'Nessuna quietanza da scaricare' : 'Scarica Report PDF'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#007AFF" />
        <Text style={styles.infoText}>
          Il report PDF include tutte le quietanze firmate nel mese selezionato, 
          suddivise per tipologia (Coach, Dirigenti, Atleti). Utile per la contabilità mensile.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#007AFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  selectorContainer: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  selectorRow: {
    marginBottom: 15,
  },
  selectorGroup: {
    flex: 1,
  },
  selectorSubLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  pillSelected: {
    backgroundColor: '#007AFF',
  },
  pillText: {
    fontSize: 14,
    color: '#666',
  },
  pillTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  monthPill: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  monthPillSelected: {
    backgroundColor: '#007AFF',
  },
  monthPillText: {
    fontSize: 13,
    color: '#666',
  },
  monthPillTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  breakdownContainer: {
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  breakdownIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  breakdownCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  breakdownAmount: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  totalContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 15,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#007AFF',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 10,
  },
  downloadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    margin: 15,
    borderRadius: 12,
    padding: 15,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 20,
  },
});
