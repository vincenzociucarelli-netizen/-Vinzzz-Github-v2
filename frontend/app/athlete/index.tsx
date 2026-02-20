import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

const MONTH_NAMES = [
  '', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

const MONTH_NAMES_FULL = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

interface AthleteProfile {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  fiscal_code?: string;
  monthly_compensation: number;
  compensation_accepted: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  other_annual_compensation?: number;
  iban?: string;
  iban_holder_first_name?: string;
  iban_holder_last_name?: string;
  bank_name?: string;
  athlete_type?: string;
}

interface Receipt {
  id: string;
  month: string;
  year: number;
  amount: number;
  signed: boolean;
  signed_date?: string;
}

export default function AthleteScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [societySettings, setSocietySettings] = useState<any>(null);

  // Contract dates
  const [contractStartYear, setContractStartYear] = useState<number | null>(null);
  const [contractEndYear, setContractEndYear] = useState<number | null>(null);
  const [contractStartMonth, setContractStartMonth] = useState<number | null>(null);
  const [contractEndMonth, setContractEndMonth] = useState<number | null>(null);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadData = async () => {
    try {
      // Load athlete profile
      const meResponse = await api.get('/auth/me');
      const athleteData = meResponse.data;
      
      // For athletes, we need to get their athlete record
      if (athleteData.athlete_id) {
        const athleteResponse = await api.get(`/athletes/${athleteData.athlete_id}`);
        setProfile(athleteResponse.data);
        
        // Parse contract dates
        if (athleteResponse.data.contract_start_date) {
          const startDate = new Date(athleteResponse.data.contract_start_date);
          setContractStartYear(startDate.getFullYear());
          setContractStartMonth(startDate.getMonth() + 1);
        }
        if (athleteResponse.data.contract_end_date) {
          const endDate = new Date(athleteResponse.data.contract_end_date);
          setContractEndYear(endDate.getFullYear());
          setContractEndMonth(endDate.getMonth() + 1);
        }
        
        // Load receipts
        const receiptsResponse = await api.get(`/athletes/${athleteData.athlete_id}/compensation/receipts`);
        setReceipts(receiptsResponse.data || []);
      } else {
        // Direct athlete user
        setProfile(athleteData);
      }
      
      // Load society settings
      const settingsResponse = await api.get('/settings/society');
      setSocietySettings(settingsResponse.data);
      
    } catch (error: any) {
      console.error('Error loading data:', error);
      showAlert('Errore', 'Impossibile caricare i dati');
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

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Generate contract months
  const getContractMonths = () => {
    if (!contractStartYear || !contractStartMonth || !contractEndYear || !contractEndMonth) {
      return [];
    }
    
    const months: { year: number; month: number }[] = [];
    let year = contractStartYear;
    let month = contractStartMonth;
    
    while (year < contractEndYear || (year === contractEndYear && month <= contractEndMonth)) {
      months.push({ year, month });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    
    return months;
  };

  const isReceiptSigned = (year: number, month: number) => {
    const monthName = MONTH_NAMES_FULL[month];
    return receipts.some(r => r.year === year && r.month === monthName && r.signed);
  };

  const getReceiptSignedDate = (year: number, month: number) => {
    const monthName = MONTH_NAMES_FULL[month];
    const receipt = receipts.find(r => r.year === year && r.month === monthName && r.signed);
    return receipt?.signed_date;
  };

  const isMonthAvailable = (year: number, month: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Past months and current month are available
    if (year < currentYear) return true;
    if (year === currentYear && month <= currentMonth) return true;
    return false;
  };

  const getSignedCount = () => {
    return receipts.filter(r => r.signed).length;
  };

  const getTotalMonths = () => {
    return getContractMonths().length;
  };

  // Calculate yearly totals for threshold warnings
  const calculateYearlyTotals = () => {
    const yearlyTotals: { [year: number]: { months: number; total: number; prior: number } } = {};
    const contractMonths = getContractMonths();
    const monthlyComp = profile?.monthly_compensation || 0;
    const priorComp = profile?.other_annual_compensation || 0;
    
    contractMonths.forEach(({ year, month }) => {
      if (!yearlyTotals[year]) {
        yearlyTotals[year] = { months: 0, total: 0, prior: 0 };
      }
      yearlyTotals[year].months++;
      yearlyTotals[year].total += monthlyComp;
    });
    
    // Add prior compensation to first year
    if (Object.keys(yearlyTotals).length > 0) {
      const firstYear = Math.min(...Object.keys(yearlyTotals).map(Number));
      yearlyTotals[firstYear].prior = priorComp;
    }
    
    return yearlyTotals;
  };

  const yearlyTotals = profile ? calculateYearlyTotals() : {};
  const contractMonths = getContractMonths();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  if (!profile || profile.athlete_type !== 'compensated') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Il Mio Profilo</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Non hai compensi attivi</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#B8860B']} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>
            {profile.first_name?.charAt(0) || profile.full_name?.charAt(0) || 'A'}
          </Text>
        </View>
        <Text style={styles.profileName}>{profile.full_name}</Text>
        <Text style={styles.profileCompensation}>
          Compenso mensile: €{profile.monthly_compensation?.toLocaleString('it-IT') || 0}
        </Text>
        
        {/* Contract Period */}
        {profile.contract_start_date && profile.contract_end_date && (
          <View style={styles.contractPeriod}>
            <Text style={styles.contractPeriodText}>
              Periodo Contratto: {new Date(profile.contract_start_date).toLocaleDateString('it-IT')} - {new Date(profile.contract_end_date).toLocaleDateString('it-IT')}
            </Text>
          </View>
        )}
      </View>

      {/* Link to Profile */}
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/athlete/profile')}
      >
        <Ionicons name="person" size={22} color="#B8860B" />
        <View style={styles.menuItemContent}>
          <Text style={styles.menuItemTitle}>Il Mio Profilo</Text>
          <Text style={styles.menuItemSubtitle}>Dati personali, documento e IBAN</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      {/* Yearly Breakdown */}
      {Object.keys(yearlyTotals).map((yearStr) => {
        const year = parseInt(yearStr);
        const data = yearlyTotals[year];
        const yearTotal = data.total + data.prior;
        const exceeds5K = yearTotal > 5000;
        const exceeds15K = yearTotal > 15000;
        
        const yearMonths = contractMonths.filter(m => m.year === year);
        const firstMonthName = MONTH_NAMES_FULL[yearMonths[0]?.month || 1];
        const lastMonthName = MONTH_NAMES_FULL[yearMonths[yearMonths.length - 1]?.month || 12];
        
        return (
          <View key={year} style={styles.yearCard}>
            <View style={styles.yearHeader}>
              <Text style={styles.yearTitle}>Anno {year}</Text>
              {exceeds5K && (
                <View style={[styles.thresholdBadge, exceeds15K ? styles.thresholdBadge15K : styles.thresholdBadge5K]}>
                  <Text style={styles.thresholdBadgeText}>{exceeds15K ? '>15K' : '>5K'}</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.yearSubtitle}>
              Mesi nel contratto: {firstMonthName} - {lastMonthName} ({data.months} mesi)
            </Text>
            
            <View style={styles.yearCalculation}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Compenso da contratto:</Text>
                <Text style={styles.calcValue}>€{profile.monthly_compensation} × {data.months} = €{data.total.toLocaleString('it-IT')}</Text>
              </View>
              
              {data.prior > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>+ Pregressi dichiarati:</Text>
                  <Text style={styles.calcValue}>€{data.prior.toLocaleString('it-IT')}</Text>
                </View>
              )}
              
              <View style={[styles.calcRow, styles.calcTotalRow]}>
                <Text style={styles.calcTotalLabel}>TOTALE ANNO:</Text>
                <Text style={[styles.calcTotalValue, exceeds5K && styles.calcTotalValueWarning]}>
                  €{yearTotal.toLocaleString('it-IT')}
                </Text>
              </View>
            </View>
            
            {exceeds5K && (
              <View style={[styles.warningBox, exceeds15K && styles.warningBox15K]}>
                <Ionicons name="warning" size={18} color={exceeds15K ? '#D32F2F' : '#FF9800'} />
                <Text style={[styles.warningText, exceeds15K && styles.warningText15K]}>
                  {exceeds15K 
                    ? 'Supera soglia €15.000 - Ritenuta fiscale'
                    : 'Supera soglia €5.000 - Contributi previdenziali'
                  }
                </Text>
              </View>
            )}
            
            {/* Receipts Grid for this year */}
            <Text style={styles.receiptsTitle}>Quietanze {year}</Text>
            <View style={styles.receiptsGrid}>
              {yearMonths.map(({ year: y, month }) => {
                const signed = isReceiptSigned(y, month);
                const available = isMonthAvailable(y, month);
                const signedDate = getReceiptSignedDate(y, month);
                
                // Check if this month exceeds 5K threshold
                const monthIndex = contractMonths.findIndex(m => m.year === y && m.month === month);
                let runningTotal = (profile?.other_annual_compensation || 0);
                for (let i = 0; i <= monthIndex; i++) {
                  if (contractMonths[i].year === y) {
                    runningTotal += profile?.monthly_compensation || 0;
                  }
                }
                const monthExceeds5K = runningTotal > 5000;
                
                return (
                  <TouchableOpacity
                    key={`${y}-${month}`}
                    style={[
                      styles.receiptItem,
                      signed && styles.receiptItemSigned,
                      signed && monthExceeds5K && styles.receiptItemExceeds5K,
                      !available && !signed && styles.receiptItemUnavailable,
                      available && !signed && styles.receiptItemPending,
                    ]}
                    onPress={() => {
                      if (available && !signed) {
                        router.push(`/athlete/compensation?month=${month}&year=${y}`);
                      }
                    }}
                    disabled={!available || signed}
                  >
                    {signed ? (
                      <>
                        <Ionicons name="checkmark" size={16} color={monthExceeds5K ? '#8B6914' : '#2E7D32'} />
                        <Text style={[styles.receiptMonth, monthExceeds5K && styles.receiptMonthExceeds5K]}>
                          {MONTH_NAMES[month]}
                        </Text>
                        <Text style={[styles.receiptAmount, monthExceeds5K && styles.receiptAmountExceeds5K]}>
                          €{profile.monthly_compensation}
                        </Text>
                        {signedDate && (
                          <Text style={styles.receiptDate}>
                            Firmata il {new Date(signedDate).toLocaleDateString('it-IT')}
                          </Text>
                        )}
                      </>
                    ) : available ? (
                      <>
                        <Text style={styles.receiptMonthPending}>{MONTH_NAMES[month]}</Text>
                        <Text style={styles.receiptAmountPending}>€{profile.monthly_compensation}</Text>
                        <Text style={styles.receiptAction}>Tocca per firmare</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="time-outline" size={16} color="#999" />
                        <Text style={styles.receiptMonthUnavailable}>{MONTH_NAMES[month]}</Text>
                        <Text style={styles.receiptAmountUnavailable}>€{profile.monthly_compensation}</Text>
                        <Text style={styles.receiptUnavailable}>Non disponibile</Text>
                      </>
                    )}
                    
                    {monthExceeds5K && signed && (
                      <View style={styles.exceeds5KBadge}>
                        <Text style={styles.exceeds5KBadgeText}>{'>'}5K</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Riepilogo Quietanze</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Quietanze firmate:</Text>
          <Text style={styles.summaryValue}>{getSignedCount()} / {getTotalMonths()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totale contratto:</Text>
          <Text style={styles.summaryValue}>
            €{((profile?.monthly_compensation || 0) * getTotalMonths()).toLocaleString('it-IT')}
          </Text>
        </View>
      </View>

      {/* Bank Info */}
      {profile.iban && (
        <View style={styles.bankCard}>
          <Text style={styles.bankTitle}>Dati Bancari</Text>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>IBAN:</Text>
            <Text style={styles.bankValue}>{profile.iban}</Text>
          </View>
          {(profile.iban_holder_last_name || profile.iban_holder_first_name) && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Intestatario:</Text>
              <Text style={styles.bankValue}>
                {profile.iban_holder_last_name} {profile.iban_holder_first_name}
              </Text>
            </View>
          )}
          {profile.bank_name && (
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Banca:</Text>
              <Text style={styles.bankValue}>{profile.bank_name}</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
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
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  profileCard: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  profileCompensation: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  contractPeriod: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  contractPeriodText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  yearCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  yearTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  thresholdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thresholdBadge5K: {
    backgroundColor: '#FFF3E0',
  },
  thresholdBadge15K: {
    backgroundColor: '#FFEBEE',
  },
  thresholdBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9800',
  },
  yearSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  yearCalculation: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  calcLabel: {
    fontSize: 13,
    color: '#666',
  },
  calcValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  calcTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },
  calcTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  calcTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  calcTotalValueWarning: {
    color: '#D32F2F',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  warningBox15K: {
    backgroundColor: '#FFEBEE',
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    flex: 1,
  },
  warningText15K: {
    color: '#C62828',
  },
  receiptsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  receiptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  receiptItem: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 90,
  },
  receiptItemSigned: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  receiptItemExceeds5K: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB300',
  },
  receiptItemPending: {
    backgroundColor: '#fff',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  receiptItemUnavailable: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  receiptMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
  receiptMonthExceeds5K: {
    color: '#8B6914',
  },
  receiptAmount: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  receiptAmountExceeds5K: {
    color: '#8B6914',
  },
  receiptDate: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  receiptMonthPending: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976D2',
    marginTop: 4,
  },
  receiptAmountPending: {
    fontSize: 12,
    color: '#1976D2',
  },
  receiptAction: {
    fontSize: 9,
    color: '#1976D2',
    marginTop: 4,
    fontWeight: '600',
  },
  receiptMonthUnavailable: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
  },
  receiptAmountUnavailable: {
    fontSize: 12,
    color: '#999',
  },
  receiptUnavailable: {
    fontSize: 9,
    color: '#999',
    marginTop: 4,
  },
  exceeds5KBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFB300',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exceeds5KBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bankCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bankTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  bankRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  bankLabel: {
    fontSize: 13,
    color: '#666',
    width: 90,
  },
  bankValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
});
