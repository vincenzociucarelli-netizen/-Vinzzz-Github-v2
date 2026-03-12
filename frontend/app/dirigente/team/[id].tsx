import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

interface Athlete {
  id: string;
  full_name: string;
  team_id: string;
  status: string;
  medical_certificate_expiry?: string;
  medical_certificate_date?: string;
  is_withdrawn?: boolean;
}

interface AthleteWithCert extends Athlete {
  certificate_expiry?: string;
  is_expired?: boolean;
  days_to_expiry?: number;
}

export default function TeamAthletes() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [athletes, setAthletes] = useState<AthleteWithCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);
  const [certDate, setCertDate] = useState('');
  const [certMonths, setCertMonths] = useState('12');
  const [savingCert, setSavingCert] = useState(false);

  const loadAthletes = async () => {
    try {
      const response = await api.get(`/teams/${id}/athletes`);
      const processedAthletes = response.data.map((athlete: Athlete) => {
        let isExpired = false;
        let daysToExpiry = null;
        
        if (athlete.medical_certificate_expiry) {
          const expiryDate = new Date(athlete.medical_certificate_expiry);
          const today = new Date();
          daysToExpiry = differenceInDays(expiryDate, today);
          isExpired = daysToExpiry < 0;
        }
        
        return {
          ...athlete,
          certificate_expiry: athlete.medical_certificate_expiry,
          is_expired: isExpired,
          days_to_expiry: daysToExpiry,
        };
      });
      
      processedAthletes.sort((a: AthleteWithCert, b: AthleteWithCert) => {
        if (a.is_withdrawn && !b.is_withdrawn) return 1;
        if (!a.is_withdrawn && b.is_withdrawn) return -1;
        return 0;
      });
      
      setAthletes(processedAthletes);
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAthletes();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAthletes();
    setRefreshing(false);
  };

  const getCertificateStatus = (athlete: AthleteWithCert) => {
    if (!athlete.certificate_expiry) {
      return { color: '#FF3B30', text: 'Mancante', icon: 'close-circle' };
    }
    if (athlete.is_expired) {
      return { color: '#FF3B30', text: 'Scaduto', icon: 'close-circle' };
    }
    if (athlete.days_to_expiry !== null && athlete.days_to_expiry <= 30) {
      return { color: '#FF9500', text: `Scade tra ${athlete.days_to_expiry}g`, icon: 'warning' };
    }
    return { color: '#34C759', text: 'Valido', icon: 'checkmark-circle' };
  };

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0,2) + '/' + digits.slice(2);
    return digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,8);
  };

  const handleExpandAthlete = (athlete: AthleteWithCert) => {
    if (expandedAthleteId === athlete.id) {
      setExpandedAthleteId(null);
      return;
    }
    setExpandedAthleteId(athlete.id);
    // Pre-fill certificate date if existing
    if (athlete.medical_certificate_date) {
      try {
        const d = new Date(athlete.medical_certificate_date);
        setCertDate(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`);
      } catch { setCertDate(''); }
    } else {
      setCertDate('');
    }
    setCertMonths('12');
  };

  const handleSaveCert = async (athleteId: string) => {
    if (!certDate || certDate.length < 10) {
      const msg = 'Inserisci la data del certificato (GG/MM/AAAA)';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Errore', msg);
      return;
    }
    const parts = certDate.split('/');
    if (parts.length !== 3) return;
    const [dd, mm, yyyy] = parts;
    const issueDate = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
    if (isNaN(issueDate.getTime())) {
      const msg = 'Data non valida';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Errore', msg);
      return;
    }
    const months = parseInt(certMonths) || 12;
    const expiryDate = new Date(issueDate);
    expiryDate.setMonth(expiryDate.getMonth() + months);

    setSavingCert(true);
    try {
      await api.patch(`/athletes/${athleteId}`, {
        medical_certificate_date: issueDate.toISOString(),
        medical_certificate_expiry: expiryDate.toISOString(),
      });
      const msg = `Certificato salvato! Scadenza: ${String(expiryDate.getDate()).padStart(2,'0')}/${String(expiryDate.getMonth()+1).padStart(2,'0')}/${expiryDate.getFullYear()}`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Successo', msg);
      setExpandedAthleteId(null);
      await loadAthletes();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore nel salvataggio';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Errore', msg);
    } finally {
      setSavingCert(false);
    }
  };

  const formatExpiryDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch { return dateStr; }
  };

  const activeAthletes = athletes.filter(a => !a.is_withdrawn);
  const withdrawnAthletes = athletes.filter(a => a.is_withdrawn);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{name || 'Squadra'}</Text>
          <Text style={styles.headerSubtitle}>{activeAthletes.length} atleti attivi</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
            <Text style={styles.legendText}>Certificato Valido</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
            <Text style={styles.legendText}>In scadenza</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
            <Text style={styles.legendText}>Mancante/Scaduto</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8E44AD']} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Caricamento...</Text>
          </View>
        ) : athletes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun atleta in questa squadra</Text>
          </View>
        ) : (
          <>
            {/* Active Athletes */}
            {activeAthletes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Atleti Attivi ({activeAthletes.length})</Text>
                {activeAthletes.map((athlete) => {
                  const certStatus = getCertificateStatus(athlete);
                  const isExpanded = expandedAthleteId === athlete.id;
                  return (
                    <View key={athlete.id} style={{ marginBottom: 8 }}>
                      <TouchableOpacity 
                        style={styles.athleteCard}
                        onPress={() => handleExpandAthlete(athlete)}
                        data-testid={`athlete-card-${athlete.id}`}
                      >
                        <View style={styles.athleteInfo}>
                          <Text style={styles.athleteName}>{athlete.full_name}</Text>
                          <View style={styles.athleteMeta}>
                            <View style={[styles.statusBadge, { backgroundColor: athlete.status === 'trial' ? '#FF9500' : '#34C759' }]}>
                              <Text style={styles.statusBadgeText}>
                                {athlete.status === 'trial' ? 'IN PROVA' : 'ATTIVO'}
                              </Text>
                            </View>
                            {athlete.certificate_expiry && (
                              <Text style={{ fontSize: 11, color: '#999' }}>
                                Scad: {formatExpiryDate(athlete.certificate_expiry)}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.certContainer}>
                            <Ionicons name={certStatus.icon as any} size={18} color={certStatus.color} />
                            <Text style={[styles.certText, { color: certStatus.color }]}>
                              {certStatus.text}
                            </Text>
                          </View>
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#999" />
                        </View>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.certForm} data-testid={`cert-form-${athlete.id}`}>
                          <Text style={styles.certFormTitle}>Certificato Medico</Text>
                          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                            <View style={{ flex: 2 }}>
                              <Text style={styles.certFormLabel}>Data emissione</Text>
                              <TextInput
                                style={styles.certFormInput}
                                value={certDate}
                                onChangeText={(v) => setCertDate(formatDateInput(v))}
                                placeholder="GG/MM/AAAA"
                                placeholderTextColor="#999"
                                maxLength={10}
                                keyboardType="numeric"
                                data-testid={`cert-date-${athlete.id}`}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.certFormLabel}>Validità (mesi)</Text>
                              <TextInput
                                style={styles.certFormInput}
                                value={certMonths}
                                onChangeText={setCertMonths}
                                placeholder="12"
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                                data-testid={`cert-months-${athlete.id}`}
                              />
                            </View>
                            <TouchableOpacity
                              style={[styles.certFormBtn, savingCert && { opacity: 0.6 }]}
                              onPress={() => handleSaveCert(athlete.id)}
                              disabled={savingCert}
                              data-testid={`cert-save-${athlete.id}`}
                            >
                              {savingCert ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons name="checkmark" size={20} color="#fff" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Withdrawn Athletes */}
            {withdrawnAthletes.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: '#999' }]}>Ritirati ({withdrawnAthletes.length})</Text>
                {withdrawnAthletes.map((athlete) => {
                  const certStatus = getCertificateStatus(athlete);
                  return (
                    <View key={athlete.id} style={[styles.athleteCard, styles.athleteCardWithdrawn]}>
                      <View style={styles.athleteInfo}>
                        <Text style={[styles.athleteName, styles.athleteNameWithdrawn]}>{athlete.full_name}</Text>
                        <View style={styles.athleteMeta}>
                          <View style={[styles.statusBadge, { backgroundColor: '#FF3B30' }]}>
                            <Text style={styles.statusBadgeText}>RITIRATO</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.certContainer}>
                        <Ionicons name={certStatus.icon as any} size={18} color="#999" />
                        <Text style={[styles.certText, { color: '#999' }]}>
                          {certStatus.text}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 12,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  legendContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  athleteCardWithdrawn: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  athleteNameWithdrawn: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  athleteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  certContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  certText: {
    fontSize: 12,
    fontWeight: '500',
  },
  certForm: {
    backgroundColor: '#fff',
    borderRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 14,
    marginTop: -4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  certFormTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  certFormLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  certFormInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  certFormBtn: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 44,
    height: 44,
  },
});
