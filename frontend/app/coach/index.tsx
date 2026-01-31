import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Team, Athlete } from '../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface AthleteWithCert extends Athlete {
  certificate_expiry?: string;
  is_expired?: boolean;
}

export default function CoachScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'scanner'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [athletes, setAthletes] = useState<AthleteWithCert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      // Load teams assigned to this coach
      const response = await api.get('/coach/my-teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAthletes = async (teamId: string) => {
    try {
      const response = await api.get(`/coach/team/${teamId}/athletes`);
      setAthletes(response.data);
    } catch (error) {
      console.error('Error loading athletes:', error);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadAthletes(selectedTeam.id);
    }
  }, [selectedTeam]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeams();
    if (selectedTeam) {
      await loadAthletes(selectedTeam.id);
    }
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanning(false);
    
    try {
      const response = await api.post('/attendance/check', { qr_code: data });
      const attendance = response.data;
      
      if (attendance.status === 'blocked') {
        showAlert(
          'Accesso Negato',
          attendance.block_reason || 'Atleta non autorizzato'
        );
      } else {
        showAlert(
          'Presenza Registrata',
          'Atleta autorizzato e presenza registrata con successo!'
        );
      }
    } catch (error: any) {
      showAlert(
        'Errore',
        error.response?.data?.detail || 'Errore durante la registrazione'
      );
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        logout();
        router.replace('/login');
      }
    } else {
      Alert.alert(
        'Logout',
        'Sei sicuro di voler uscire?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
    }
  };

  const renderTeamCard = (team: Team) => (
    <TouchableOpacity
      key={team.id}
      style={[styles.teamCard, selectedTeam?.id === team.id && styles.teamCardSelected]}
      onPress={() => setSelectedTeam(team)}
    >
      <View style={styles.teamCardHeader}>
        <Text style={styles.teamName}>{team.name}</Text>
        {selectedTeam?.id === team.id && (
          <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
        )}
      </View>
      {team.description && (
        <Text style={styles.teamDescription}>{team.description}</Text>
      )}
    </TouchableOpacity>
  );

  const renderAthleteItem = ({ item }: { item: AthleteWithCert }) => {
    const isExpired = item.is_expired || (item.certificate_expiry && new Date(item.certificate_expiry) < new Date());
    
    return (
      <View style={styles.athleteItem}>
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{item.full_name}</Text>
          <View style={styles.certRow}>
            <Ionicons 
              name={isExpired ? "close-circle" : "checkmark-circle"} 
              size={18} 
              color={isExpired ? "#FF3B30" : "#34C759"} 
            />
            <Text style={[styles.certText, { color: isExpired ? "#FF3B30" : "#34C759" }]}>
              {item.certificate_expiry 
                ? `Scadenza: ${formatDate(item.certificate_expiry)}${isExpired ? ' (SCADUTO)' : ''}`
                : 'Nessun certificato'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Scanner Mode
  if (activeTab === 'scanner') {
    if (!permission) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Scanner Presenze</Text>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('teams')}>
              <Ionicons name="people" size={20} color="#666" />
              <Text style={styles.tabText}>Squadre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, styles.tabActive]} onPress={() => setActiveTab('scanner')}>
              <Ionicons name="qr-code" size={20} color="#007AFF" />
              <Text style={[styles.tabText, styles.tabTextActive]}>Scanner</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.content}>
            <Ionicons name="camera" size={80} color="#007AFF" />
            <Text style={styles.title}>Abilita Fotocamera</Text>
            <Text style={styles.subtitle}>Per scansionare i QR code degli atleti</Text>
            
            <TouchableOpacity style={styles.button} onPress={requestPermission}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.buttonText}>Abilita Fotocamera</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (scanning && permission.granted) {
      return (
        <View style={styles.container}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={handleBarCodeScanned}
            />
            
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerText}>Inquadra il QR code dell'atleta</Text>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setScanning(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scanner Presenze</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('teams')}>
            <Ionicons name="people" size={20} color="#666" />
            <Text style={styles.tabText}>Squadre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, styles.tabActive]} onPress={() => setActiveTab('scanner')}>
            <Ionicons name="qr-code" size={20} color="#007AFF" />
            <Text style={[styles.tabText, styles.tabTextActive]}>Scanner</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Ionicons name="qr-code" size={80} color="#007AFF" />
          <Text style={styles.title}>Pronto per scansionare</Text>
          <Text style={styles.subtitle}>Registra le presenze degli atleti</Text>
          
          <TouchableOpacity style={styles.button} onPress={() => setScanning(true)}>
            <Ionicons name="scan" size={24} color="#fff" />
            <Text style={styles.buttonText}>Scansiona QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/coach/history')}
          >
            <Ionicons name="list" size={20} color="#007AFF" />
            <Text style={styles.historyButtonText}>Storico Presenze</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Teams & Athletes Mode
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Le Mie Squadre</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]} onPress={() => setActiveTab('teams')}>
          <Ionicons name="people" size={20} color="#007AFF" />
          <Text style={[styles.tabText, styles.tabTextActive]}>Squadre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('scanner')}>
          <Ionicons name="qr-code" size={20} color="#666" />
          <Text style={styles.tabText}>Scanner</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>Ciao, {user?.full_name}! 👋</Text>
          <Text style={styles.welcomeSubtext}>
            Seleziona una squadra per vedere gli atleti
          </Text>
        </View>

        {/* Teams List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏐 Squadre Assegnate</Text>
          {teams.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="football-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessuna squadra assegnata</Text>
              <Text style={styles.emptySubtext}>Contatta l'admin per essere assegnato a una squadra</Text>
            </View>
          ) : (
            teams.map(renderTeamCard)
          )}
        </View>

        {/* Athletes List (if team selected) */}
        {selectedTeam && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>👥 Atleti - {selectedTeam.name}</Text>
              <TouchableOpacity 
                style={styles.attendanceBtn}
                onPress={() => router.push(`/admin/team/${selectedTeam.id}/attendances`)}
              >
                <Ionicons name="calendar" size={16} color="#007AFF" />
                <Text style={styles.attendanceBtnText}>Presenze</Text>
              </TouchableOpacity>
            </View>
            
            {athletes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="person-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Nessun atleta</Text>
              </View>
            ) : (
              <FlatList
                data={athletes}
                renderItem={renderAthleteItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  welcomeCard: {
    backgroundColor: '#E8F4FD',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  teamCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E8F4FD',
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teamDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  athleteItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  certText: {
    fontSize: 13,
    marginLeft: 6,
  },
  attendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  attendanceBtnText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  historyButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 8,
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
