import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Coach {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  assigned_teams: string[];
  created_at: string;
  approved_at?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  fiscal_code?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  phone?: string;
  coach_license_number?: string;
  monthly_compensation?: number;
  compensation_accepted?: boolean;
  compensation_history?: { [key: string]: boolean };
  over_5000_limit?: { [key: string]: boolean };
  // Document fields
  document_type?: string;
  document_front?: string;
  document_back?: string;
  iban?: string;
  iban_holder?: string;
  bank_name?: string;
}

interface Team {
  id: string;
  name: string;
}

export default function AdminCoachDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTeams, setEditingTeams] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');

  const loadData = async () => {
    try {
      const [coachRes, teamsRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/teams'),
      ]);
      setCoach(coachRes.data);
      setTeams(teamsRes.data);
      setMonthlyCompensation(coachRes.data.monthly_compensation?.toString() || '0');
      setSelectedTeams(coachRes.data.assigned_teams || []);
    } catch (error) {
      console.error('Error loading coach data:', error);
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

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const getTeamNames = (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'Nessuna squadra';
    return teamIds
      .map(tid => teams.find(t => t.id === tid)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const handleSaveTeams = async () => {
    setSavingTeams(true);
    try {
      await api.patch(`/users/${id}/assigned-teams`, {
        assigned_teams: selectedTeams
      });
      setCoach({ ...coach!, assigned_teams: selectedTeams });
      setEditingTeams(false);
      showAlert('Salvato', 'Squadre assegnate con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
    } finally {
      setSavingTeams(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#34C759';
      case 'pending': return '#FF9500';
      case 'rejected': return '#FF3B30';
      case 'suspended': return '#8E8E93';
      default: return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Attivo';
      case 'pending': return 'In attesa';
      case 'rejected': return 'Rifiutato';
      case 'suspended': return 'Sospeso';
      default: return status;
    }
  };

  const handleSaveCompensation = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${id}/compensation`, {
        monthly_compensation: parseFloat(monthlyCompensation) || 0,
      });
      showAlert('Successo', 'Compenso aggiornato con successo');
      setEditing(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // Generate season months (July to June)
  const getSeasonMonths = () => {
    const now = new Date();
    const currentYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthIndex = (6 + i) % 12;
      const year = monthIndex >= 6 ? currentYear : currentYear + 1;
      const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                          'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      months.push({
        key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        label: `${monthNames[monthIndex]} ${year}`,
      });
    }
    return months;
  };

  const seasonMonths = getSeasonMonths();

  // Check if any month has exceeded €5000
  const hasExceeded5000 = coach?.over_5000_limit && 
    Object.values(coach.over_5000_limit).some(v => v === true);

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
          <ActivityIndicator size="large" color="#FF9500" />
        </View>
      </View>
    );
  }

  if (!coach) {
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
          <Text>Coach non trovato</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{coach.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(coach.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(coach.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(coach.status) }]}>
            {getStatusLabel(coach.status)}
          </Text>
        </View>

        {/* €5000 Alert */}
        {hasExceeded5000 && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={24} color="#FF3B30" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>⚠️ SUPERAMENTO €5.000</Text>
              <Text style={styles.alertText}>
                Il coach ha dichiarato di aver superato il limite di €5.000 annui.
              </Text>
            </View>
          </View>
        )}

        {/* Dati Personali */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Dati Personali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{coach.first_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Cognome</Text>
            <Text style={styles.value}>{coach.last_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Data di nascita</Text>
            <Text style={styles.value}>{formatDate(coach.date_of_birth)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Luogo di nascita</Text>
            <Text style={styles.value}>{coach.place_of_birth || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{coach.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Telefono</Text>
            <Text style={styles.value}>{coach.phone || '-'}</Text>
          </View>
        </View>

        {/* Indirizzo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏠 Indirizzo</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Via</Text>
            <Text style={styles.value}>{coach.address || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>CAP</Text>
            <Text style={styles.value}>{coach.postal_code || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Città</Text>
            <Text style={styles.value}>{coach.city || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Provincia</Text>
            <Text style={styles.value}>{coach.province || '-'}</Text>
          </View>
        </View>

        {/* Dati Fiscali */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Codice Fiscale</Text>
            <Text style={[styles.value, styles.valueCode]}>{coach.fiscal_code || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>N. Tesserino</Text>
            <Text style={[styles.value, styles.valueCode]}>{coach.coach_license_number || '-'}</Text>
          </View>
        </View>

        {/* Squadre Assegnate */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🏐 Squadre Assegnate</Text>
            <TouchableOpacity onPress={() => setEditingTeams(!editingTeams)}>
              <Ionicons name={editingTeams ? "close" : "create"} size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {editingTeams ? (
            <>
              <Text style={styles.hintText}>Seleziona le squadre da assegnare al coach:</Text>
              {teams.map((team) => {
                const isAssigned = selectedTeams.includes(team.id);
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamCheckbox, isAssigned && styles.teamCheckboxSelected]}
                    onPress={() => {
                      if (isAssigned) {
                        setSelectedTeams(selectedTeams.filter(t => t !== team.id));
                      } else {
                        setSelectedTeams([...selectedTeams, team.id]);
                      }
                    }}
                  >
                    <Ionicons 
                      name={isAssigned ? "checkbox" : "square-outline"} 
                      size={22} 
                      color={isAssigned ? "#007AFF" : "#999"} 
                    />
                    <Text style={[styles.teamCheckboxText, isAssigned && styles.teamCheckboxTextSelected]}>
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.saveTeamsBtn, savingTeams && styles.saveBtnDisabled]}
                onPress={handleSaveTeams}
                disabled={savingTeams}
              >
                <Text style={styles.saveTeamsBtnText}>
                  {savingTeams ? 'Salvataggio...' : 'Salva Squadre'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.teamsText}>{getTeamNames(coach.assigned_teams)}</Text>
          )}
        </View>

        {/* Compenso */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💰 Compenso Mensile</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Ionicons name={editing ? "close" : "create"} size={22} color="#FF9500" />
            </TouchableOpacity>
          </View>
          
          {editing ? (
            <>
              <Text style={styles.inputLabel}>Importo Mensile (€)</Text>
              <TextInput
                style={styles.input}
                value={monthlyCompensation}
                onChangeText={setMonthlyCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveCompensation}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Salvataggio...' : 'Salva Compenso'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.compensationDisplay}>
              <Text style={styles.compensationAmount}>€{coach.monthly_compensation || 0}</Text>
              <Text style={styles.compensationPeriod}>/mese</Text>
            </View>
          )}

          {coach.compensation_accepted && (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.acceptedText}>Accettato dal coach</Text>
            </View>
          )}
        </View>

        {/* Storico Compensi */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Storico Pagamenti Stagione</Text>
          <Text style={styles.historySubtitle}>Mesi segnati come pagati dal coach</Text>
          
          {seasonMonths.map((month) => {
            const isPaid = coach.compensation_history?.[month.key] === true;
            const exceeded = coach.over_5000_limit?.[month.key] === true;
            
            return (
              <View key={month.key} style={styles.monthRow}>
                <Text style={styles.monthLabel}>{month.label}</Text>
                <View style={styles.monthStatus}>
                  {exceeded && (
                    <View style={styles.exceededBadge}>
                      <Text style={styles.exceededText}>€5K+</Text>
                    </View>
                  )}
                  <View style={[styles.paidBadge, isPaid ? styles.paidBadgeActive : styles.paidBadgeInactive]}>
                    <Ionicons 
                      name={isPaid ? "checkmark" : "remove"} 
                      size={14} 
                      color={isPaid ? "#fff" : "#999"} 
                    />
                    <Text style={[styles.paidText, isPaid ? styles.paidTextActive : styles.paidTextInactive]}>
                      {isPaid ? 'PAGATO' : 'NON PAGATO'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Documenti e IBAN - Solo visualizzazione per Admin */}
        {coach.status === 'approved' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏦 Documento e Dati Bancari</Text>
            <Text style={styles.readOnlyNote}>* Dati inseriti dal coach nel proprio profilo</Text>
            
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Tipo Documento</Text>
              <Text style={styles.readOnlyValue}>{coach.id_type || '-'}</Text>
            </View>
            
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Numero Documento</Text>
              <Text style={styles.readOnlyValue}>{coach.id_front || '-'}</Text>
            </View>
            
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Scadenza Documento</Text>
              <Text style={styles.readOnlyValue}>{coach.id_back || '-'}</Text>
            </View>
            
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>IBAN</Text>
              <Text style={styles.readOnlyValue}>{coach.iban || '-'}</Text>
            </View>
            
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Intestatario Conto</Text>
              <Text style={styles.readOnlyValue}>{coach.account_holder || '-'}</Text>
            </View>
            
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Banca</Text>
              <Text style={styles.readOnlyValue}>{coach.bank_name || '-'}</Text>
            </View>
          </View>
        )}

        {/* Date Registrazione */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Informazioni Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Registrato il</Text>
            <Text style={styles.value}>{formatDate(coach.created_at)}</Text>
          </View>
          {coach.approved_at && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Approvato il</Text>
              <Text style={styles.value}>{formatDate(coach.approved_at)}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#FF9500',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  statusBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginHorizontal: 16, 
    marginTop: 16, 
    padding: 12, 
    borderRadius: 10 
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: '600' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  alertContent: { flex: 1, marginLeft: 12 },
  alertTitle: { fontSize: 14, fontWeight: 'bold', color: '#FF3B30' },
  alertText: { fontSize: 12, color: '#666', marginTop: 4 },
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
    elevation: 3 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  label: { fontSize: 14, color: '#6c757d', flex: 1 },
  value: { fontSize: 14, fontWeight: '500', color: '#000', flex: 1, textAlign: 'right' },
  valueCode: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#FF9500' },
  teamsText: { fontSize: 14, color: '#007AFF', lineHeight: 22 },
  hintText: { fontSize: 13, color: '#666', marginBottom: 12 },
  teamCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamCheckboxSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  teamCheckboxText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  teamCheckboxTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
  saveTeamsBtn: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveTeamsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputLabel: { fontSize: 13, color: '#6c757d', marginBottom: 4, marginTop: 8 },
  input: { 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    padding: 14, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    color: '#000',
  },
  saveBtn: { 
    backgroundColor: '#FF9500', 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 16 
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  compensationDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 16 },
  compensationAmount: { fontSize: 36, fontWeight: 'bold', color: '#FF9500' },
  compensationPeriod: { fontSize: 16, color: '#666', marginLeft: 4 },
  acceptedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#f0f0f0' 
  },
  acceptedText: { fontSize: 13, color: '#34C759', marginLeft: 6 },
  historySubtitle: { fontSize: 12, color: '#999', marginBottom: 16, marginTop: -8 },
  monthRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  monthLabel: { fontSize: 14, color: '#333' },
  monthStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exceededBadge: { 
    backgroundColor: '#FFEBEE', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 4 
  },
  exceededText: { fontSize: 10, fontWeight: 'bold', color: '#FF3B30' },
  paidBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  paidBadgeActive: { backgroundColor: '#34C759' },
  paidBadgeInactive: { backgroundColor: '#f0f0f0' },
  paidText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  paidTextActive: { color: '#fff' },
  paidTextInactive: { color: '#999' },
  readOnlyNote: { 
    fontSize: 12, 
    color: '#999', 
    fontStyle: 'italic', 
    marginBottom: 16, 
    marginTop: -8 
  },
  readOnlyField: { 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  readOnlyLabel: { 
    fontSize: 13, 
    color: '#6c757d', 
    marginBottom: 4 
  },
  readOnlyValue: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: '#333' 
  },
  readOnlyNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  readOnlyField: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  readOnlyLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
});
