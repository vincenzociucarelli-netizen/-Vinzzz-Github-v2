import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Modal,
  Linking,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { Team, Athlete } from '../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Web QR Scanner
let Html5QrcodeScanner: any = null;
if (Platform.OS === 'web') {
  Html5QrcodeScanner = require('html5-qrcode').Html5QrcodeScanner;
}

interface AthleteWithCert extends Athlete {
  certificate_expiry?: string;
  is_expired?: boolean;
}

interface Dirigente {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  qualification?: string;
  profile_photo?: string;
}

export default function CoachScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'scanner' | 'society'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [athletes, setAthletes] = useState<AthleteWithCert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirigenti, setDirigenti] = useState<Dirigente[]>([]);
  const [commitments, setCommitments] = useState<{
    today: any[];
    tomorrow: any[];
    day_after: any[];
    upcoming: any[];
  }>({ today: [], tomorrow: [], day_after: [], upcoming: [] });
  const [showUpcoming, setShowUpcoming] = useState(false);
  
  // Web scanner states
  const [webScannerActive, setWebScannerActive] = useState(false);
  const [manualQrInput, setManualQrInput] = useState('');
  const [manualInputModalVisible, setManualInputModalVisible] = useState(false);
  const webScannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement | null>(null);

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

  const loadCommitments = async () => {
    try {
      const response = await api.get('/coach/commitments');
      setCommitments(response.data);
    } catch (error) {
      console.error('Error loading commitments:', error);
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

  const loadDirigenti = async () => {
    try {
      const response = await api.get('/users/dirigenti');
      setDirigenti(response.data);
    } catch (error) {
      console.error('Error loading dirigenti:', error);
    }
  };

  useEffect(() => {
    loadTeams();
    loadCommitments();
    loadDirigenti();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadAthletes(selectedTeam.id);
    }
  }, [selectedTeam]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeams();
    await loadCommitments();
    await loadDirigenti();
    if (selectedTeam) {
      await loadAthletes(selectedTeam.id);
    }
    setRefreshing(false);
  };

  // State for force registration
  const [pendingQrCode, setPendingQrCode] = useState<string | null>(null);
  const [forceModalVisible, setForceModalVisible] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const showForceRegistrationDialog = (qrCode: string) => {
    setPendingQrCode(qrCode);
    if (Platform.OS === 'web') {
      setForceModalVisible(true);
    } else {
      Alert.alert(
        '⚠️ GIÀ REGISTRATA',
        'Questa atleta è già stata registrata oggi.\n\nSe fa allenamento con due squadre diverse, puoi forzare la registrazione.',
        [
          {
            text: 'Annulla',
            style: 'cancel',
            onPress: () => setPendingQrCode(null)
          },
          {
            text: 'FORZA REGISTRAZIONE',
            style: 'destructive',
            onPress: () => handleForceRegistration(qrCode)
          }
        ]
      );
    }
  };

  const handleForceRegistration = async (qrCode: string) => {
    setForceModalVisible(false);
    try {
      const response = await api.post('/attendance/check', { qr_code: qrCode, force: true });
      const attendance = response.data;
      
      if (attendance.status === 'blocked') {
        showAlert('⛔ ACCESSO NEGATO', attendance.block_reason || 'Atleta non autorizzato');
      } else {
        showAlert('✅ Presenza Registrata (Forzata)', 'Seconda presenza registrata per allenamento con altra squadra.');
      }
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    }
    setPendingQrCode(null);
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
      
      if (attendance.status === 'already_registered') {
        // Already registered today - show force option
        showForceRegistrationDialog(data);
      } else if (attendance.status === 'blocked') {
        // Blocked - show error with red styling
        showAlert(
          '⛔ ACCESSO NEGATO',
          attendance.block_reason || 'Atleta non autorizzato'
        );
      } else {
        // Allowed - check for warnings
        const hasWarning = attendance.block_reason && attendance.block_reason.trim() !== '';
        
        if (hasWarning) {
          // Allowed but with warnings (certificate expiring, payment due)
          showAlert(
            '✅ PRESENZA REGISTRATA - ATTENZIONE!',
            `Atleta ammesso all'allenamento.\n\n${attendance.block_reason}`
          );
        } else {
          // All clear
          showAlert(
            '✅ Presenza Registrata',
            'Atleta autorizzato e presenza registrata con successo!'
          );
        }
      }
    } catch (error: any) {
      showAlert(
        'Errore',
        error.response?.data?.detail || 'Errore durante la registrazione'
      );
    }
  };

  // Web scanner initialization
  const startWebScanner = () => {
    if (Platform.OS !== 'web' || !Html5QrcodeScanner) return;
    
    setWebScannerActive(true);
    
    // Wait for DOM to be ready
    setTimeout(() => {
      try {
        const html5QrcodeScanner = new Html5QrcodeScanner(
          "web-qr-scanner",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
          },
          false
        );
        
        html5QrcodeScanner.render(
          async (decodedText: string) => {
            html5QrcodeScanner.clear();
            setWebScannerActive(false);
            await handleBarCodeScanned({ data: decodedText });
          },
          (error: any) => {
            // Ignore scanning errors (they happen constantly while scanning)
          }
        );
        
        webScannerRef.current = html5QrcodeScanner;
      } catch (error) {
        console.error('Error starting web scanner:', error);
        showAlert('Errore', 'Impossibile avviare lo scanner. Prova a inserire il codice manualmente.');
      }
    }, 100);
  };

  const stopWebScanner = () => {
    if (webScannerRef.current) {
      try {
        webScannerRef.current.clear();
      } catch (error) {
        console.log('Scanner already cleared');
      }
      webScannerRef.current = null;
    }
    setWebScannerActive(false);
  };

  // Manual QR code input
  const handleManualQrSubmit = async () => {
    if (!manualQrInput.trim()) {
      showAlert('Errore', 'Inserisci il codice QR');
      return;
    }
    
    setManualInputModalVisible(false);
    await handleBarCodeScanned({ data: manualQrInput.trim() });
    setManualQrInput('');
  };

  // Funzione per abbreviare il nome della squadra (es: "Under 16" -> "U. 16")
  const abbreviateTeamName = (name: string) => {
    if (!name) return '';
    return name
      .replace(/Under\s*/i, 'U. ')
      .replace(/Prima\s*/i, '1ª ')
      .replace(/Seconda\s*/i, '2ª ')
      .replace(/Serie\s*/i, 'S. ');
  };

  // Cleanup web scanner on unmount
  useEffect(() => {
    return () => {
      stopWebScanner();
    };
  }, []);

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
    const today = new Date();
    const expiryDate = item.certificate_expiry ? new Date(item.certificate_expiry) : null;
    const isExpired = item.is_expired || (expiryDate && expiryDate < today);
    
    // Check if expiring within 30 days
    let isExpiringSoon = false;
    if (expiryDate && !isExpired) {
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      isExpiringSoon = daysUntilExpiry <= 30;
    }
    
    // Determine color: red = expired/missing, orange = expiring soon, green = valid
    let statusColor = '#34C759'; // green
    let statusIcon = 'checkmark-circle';
    let statusText = '';
    
    if (!item.certificate_expiry) {
      statusColor = '#FF3B30'; // red
      statusIcon = 'close-circle';
      statusText = 'Nessun certificato';
    } else if (isExpired) {
      statusColor = '#FF3B30'; // red
      statusIcon = 'close-circle';
      statusText = `Scadenza: ${formatDate(item.certificate_expiry)} (SCADUTO)`;
    } else if (isExpiringSoon) {
      statusColor = '#FF9500'; // orange
      statusIcon = 'warning';
      statusText = `Scadenza: ${formatDate(item.certificate_expiry)} (IN SCADENZA)`;
    } else {
      statusText = `Scadenza: ${formatDate(item.certificate_expiry)}`;
    }
    
    return (
      <TouchableOpacity 
        style={styles.athleteItem}
        onPress={() => {
          console.log('Navigating to athlete:', item.id);
          router.push(`/coach/athlete/${item.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{item.full_name}</Text>
          <View style={styles.certRow}>
            <Ionicons 
              name={statusIcon as any} 
              size={18} 
              color={statusColor} 
            />
            <Text style={[styles.certText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
          {item.athlete_role && (
            <View style={styles.roleTag}>
              <Ionicons name="person" size={12} color="#5856D6" />
              <Text style={styles.roleText}>{item.athlete_role}</Text>
            </View>
          )}
        </View>
        <View style={styles.athleteActions}>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>
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

    // Mobile scanning with camera
    if (scanning && permission?.granted && Platform.OS !== 'web') {
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

    // Web scanner active
    if (Platform.OS === 'web' && webScannerActive) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Scanner Presenze</Text>
            <TouchableOpacity onPress={() => { stopWebScanner(); }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.webScannerContainer}>
            <div id="web-qr-scanner" style={{ width: '100%', maxWidth: 500 }} />
            
            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 20 }]}
              onPress={stopWebScanner}
            >
              <Text style={styles.cancelButtonText}>Chiudi Scanner</Text>
            </TouchableOpacity>
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
          
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity style={styles.button} onPress={startWebScanner}>
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.buttonText}>Apri Scanner Fotocamera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]} 
                onPress={() => setManualInputModalVisible(true)}
              >
                <Ionicons name="keypad" size={24} color="#007AFF" />
                <Text style={styles.buttonSecondaryText}>Inserisci Codice Manualmente</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.button} 
              onPress={async () => {
                if (Platform.OS !== 'web') {
                  // Request camera permission first if not granted
                  if (!permission?.granted) {
                    const result = await requestPermission();
                    if (result.granted) {
                      setScanning(true);
                    }
                  } else {
                    setScanning(true);
                  }
                } else {
                  startWebScanner();
                }
              }}
            >
              <Ionicons name="scan" size={24} color="#fff" />
              <Text style={styles.buttonText}>Scansiona QR Code</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/coach/history')}
          >
            <Ionicons name="list" size={20} color="#007AFF" />
            <Text style={styles.historyButtonText}>Storico Presenze</Text>
          </TouchableOpacity>
        </View>
        
        {/* Manual Input Modal */}
        <Modal
          visible={manualInputModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setManualInputModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Inserisci Codice QR</Text>
              <Text style={styles.modalSubtitle}>
                Inserisci il codice presente sotto il QR dell'atleta
              </Text>
              
              <TextInput
                style={styles.manualInput}
                placeholder="Codice QR atleta"
                value={manualQrInput}
                onChangeText={setManualQrInput}
                autoCapitalize="characters"
                autoFocus
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setManualInputModalVisible(false);
                    setManualQrInput('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Annulla</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleManualQrSubmit}
                >
                  <Text style={styles.modalButtonConfirmText}>Verifica</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Force Registration Modal (Web) */}
        <Modal
          visible={forceModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setForceModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚠️ GIÀ REGISTRATA</Text>
              <Text style={styles.modalSubtitle}>
                Questa atleta è già stata registrata oggi.{'\n\n'}
                Se fa allenamento con due squadre diverse, puoi forzare la registrazione.
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setForceModalVisible(false);
                    setPendingQrCode(null);
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Annulla</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.forceButton]}
                  onPress={() => pendingQrCode && handleForceRegistration(pendingQrCode)}
                >
                  <Text style={styles.forceButtonText}>FORZA REGISTRAZIONE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'teams' && styles.tabActive]} 
          onPress={() => setActiveTab('teams')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'teams' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'teams' && styles.tabTextActive]}>Squadre</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'scanner' && styles.tabActive]} 
          onPress={() => setActiveTab('scanner')}
        >
          <Ionicons name="qr-code" size={20} color={activeTab === 'scanner' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'scanner' && styles.tabTextActive]}>Scanner</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'society' && styles.tabActive]} 
          onPress={() => setActiveTab('society')}
        >
          <Ionicons name="business" size={20} color={activeTab === 'society' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'society' && styles.tabTextActive]}>Società</Text>
        </TouchableOpacity>
      </View>

      {/* Society Tab Content */}
      {activeTab === 'society' ? (
        <ScrollView
          style={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.societySection}>
            <Text style={styles.sectionTitle}>🏢 Dirigenti della Società</Text>
            <Text style={styles.sectionSubtitle}>
              Contatta i dirigenti tramite WhatsApp
            </Text>
            
            {dirigenti.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Nessun dirigente trovato</Text>
              </View>
            ) : (
              dirigenti.map((dir) => (
                <View key={dir.id} style={styles.dirigenteCard}>
                  <View style={styles.dirigenteInfo}>
                    {dir.profile_photo ? (
                      <Image 
                        source={{ uri: `data:image/jpeg;base64,${dir.profile_photo}` }}
                        style={styles.dirigentePhoto}
                      />
                    ) : (
                      <View style={styles.dirigentePhotoPlaceholder}>
                        <Ionicons name="person" size={24} color="#999" />
                      </View>
                    )}
                    <View style={styles.dirigenteDetails}>
                      <Text style={styles.dirigenteName}>{dir.full_name}</Text>
                      {dir.qualification && (
                        <Text style={styles.dirigenteRole}>📋 {dir.qualification}</Text>
                      )}
                      <Text style={styles.dirigenteEmail}>{dir.email}</Text>
                      {dir.phone && (
                        <View style={styles.phoneRow}>
                          <Text style={styles.dirigentePhone}>📞 {dir.phone}</Text>
                          <TouchableOpacity
                            style={styles.whatsappBtnSmall}
                            onPress={() => {
                              const phone = dir.phone.replace(/\D/g, '');
                              const phoneWithCountry = phone.startsWith('39') ? phone : `39${phone}`;
                              Linking.openURL(`https://wa.me/${phoneWithCountry}`);
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                            <Text style={styles.whatsappBtnTextSmall}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                  {!dir.phone && (
                    <TouchableOpacity
                      style={[styles.whatsappBtn, styles.whatsappBtnDisabled]}
                      disabled
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                      <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
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

        {/* IMPEGNI Section */}
        <View style={styles.commitmentsSection}>
          <Text style={styles.commitmentsSectionTitle}>📅 Impegni</Text>
          
          {/* OGGI */}
          <View style={styles.commitmentDay}>
            <View style={styles.commitmentDayHeader}>
              <View style={[styles.commitmentDot, { backgroundColor: '#FF3B30' }]} />
              <Text style={styles.commitmentDayTitle}>
                OGGI - {format(new Date(), 'EEEE', { locale: it }).toUpperCase()}
              </Text>
            </View>
            {commitments.today.length === 0 ? (
              <Text style={styles.noCommitments}>Nulla in programma</Text>
            ) : (
              commitments.today.map((item, idx) => (
                <View key={idx} style={styles.commitmentItem}>
                  <Ionicons 
                    name={item.type === 'training' ? 'fitness' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
                    {item.type === 'match' && item.home_away && (
                      <Text style={[styles.commitmentHomeAway, { color: item.home_away === 'home' ? '#007AFF' : '#FF9500' }]}>
                        {item.home_away === 'home' ? '🏠 Casa' : '✈️ Trasferta'}
                      </Text>
                    )}
                    {item.meeting_time && (
                      <Text style={styles.commitmentMeeting}>⚠️ Ritrovo: {item.meeting_time}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* DOMANI */}
          <View style={styles.commitmentDay}>
            <View style={styles.commitmentDayHeader}>
              <View style={[styles.commitmentDot, { backgroundColor: '#FF9500' }]} />
              <Text style={styles.commitmentDayTitle}>
                DOMANI - {format(new Date(Date.now() + 86400000), 'EEEE', { locale: it }).toUpperCase()}
              </Text>
            </View>
            {commitments.tomorrow.length === 0 ? (
              <Text style={styles.noCommitments}>Nulla in programma</Text>
            ) : (
              commitments.tomorrow.map((item, idx) => (
                <View key={idx} style={styles.commitmentItem}>
                  <Ionicons 
                    name={item.type === 'training' ? 'fitness' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
                    {item.type === 'match' && item.home_away && (
                      <Text style={[styles.commitmentHomeAway, { color: item.home_away === 'home' ? '#007AFF' : '#FF9500' }]}>
                        {item.home_away === 'home' ? '🏠 Casa' : '✈️ Trasferta'}
                      </Text>
                    )}
                    {item.meeting_time && (
                      <Text style={styles.commitmentMeeting}>⚠️ Ritrovo: {item.meeting_time}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* DOPODOMANI */}
          <View style={styles.commitmentDay}>
            <View style={styles.commitmentDayHeader}>
              <View style={[styles.commitmentDot, { backgroundColor: '#34C759' }]} />
              <Text style={styles.commitmentDayTitle}>
                DOPODOMANI - {format(new Date(Date.now() + 2*86400000), 'EEEE', { locale: it }).toUpperCase()}
              </Text>
            </View>
            {commitments.day_after.length === 0 ? (
              <Text style={styles.noCommitments}>Nulla in programma</Text>
            ) : (
              commitments.day_after.map((item, idx) => (
                <View key={idx} style={styles.commitmentItem}>
                  <Ionicons 
                    name={item.type === 'training' ? 'fitness' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
                    {item.type === 'match' && item.home_away && (
                      <Text style={[styles.commitmentHomeAway, { color: item.home_away === 'home' ? '#007AFF' : '#FF9500' }]}>
                        {item.home_away === 'home' ? '🏠 Casa' : '✈️ Trasferta'}
                      </Text>
                    )}
                    {item.meeting_time && (
                      <Text style={styles.commitmentMeeting}>⚠️ Ritrovo: {item.meeting_time}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* PROSSIMI GIORNI (day 4-7) - Collapsible */}
          {commitments.upcoming && commitments.upcoming.length > 0 && (
            <View style={styles.commitmentDay}>
              <TouchableOpacity 
                style={styles.upcomingToggle}
                onPress={() => setShowUpcoming(!showUpcoming)}
              >
                <View style={styles.commitmentDayHeader}>
                  <View style={[styles.commitmentDot, { backgroundColor: '#007AFF' }]} />
                  <Text style={styles.commitmentDayTitle}>IMPEGNI SUCCESSIVI ({commitments.upcoming.length})</Text>
                </View>
                <Ionicons 
                  name={showUpcoming ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#007AFF" 
                />
              </TouchableOpacity>
              
              {showUpcoming && commitments.upcoming.map((item, idx) => (
                <View key={idx} style={styles.commitmentItem}>
                  <Ionicons 
                    name={item.type === 'training' ? 'fitness' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDate}>
                      📅 {item.date} - {item.day_name}
                    </Text>
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
                    {item.type === 'match' && item.home_away && (
                      <Text style={[styles.commitmentHomeAway, { color: item.home_away === 'home' ? '#007AFF' : '#FF9500' }]}>
                        {item.home_away === 'home' ? '🏠 Casa' : '✈️ Trasferta'}
                      </Text>
                    )}
                    {item.meeting_time && (
                      <Text style={styles.commitmentMeeting}>⚠️ Ritrovo: {item.meeting_time}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
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
              <>
                {/* Certificate Legend */}
                <View style={styles.legendContainer}>
                  <Text style={styles.legendTitle}>📋 Certificato Medico:</Text>
                  <View style={styles.legendItems}>
                    <View style={styles.legendItem}>
                      <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                      <Text style={styles.legendText}>Valido</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <Ionicons name="warning" size={14} color="#FF9500" />
                      <Text style={styles.legendText}>In scadenza</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <Ionicons name="close-circle" size={14} color="#FF3B30" />
                      <Text style={styles.legendText}>Scaduto/Mancante</Text>
                    </View>
                  </View>
                </View>
                <FlatList
                  data={athletes}
                  renderItem={renderAthleteItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </>
            )}
          </View>
        )}

        {/* Profile Link */}
        <TouchableOpacity
          style={styles.profileLink}
          onPress={() => router.push('/coach/profile')}
        >
          <Ionicons name="person-circle" size={24} color="#007AFF" />
          <Text style={styles.profileLinkText}>Il Mio Profilo</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
      )}
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
  commitmentsSection: {
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
  commitmentsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  commitmentDay: {
    marginBottom: 16,
  },
  commitmentDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commitmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  commitmentDayTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
  },
  noCommitments: {
    fontSize: 14,
    color: '#999',
    marginLeft: 16,
    fontStyle: 'italic',
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 16,
  },
  commitmentItemContent: {
    flex: 1,
    marginLeft: 10,
  },
  commitmentItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commitmentItemDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commitmentMeeting: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
    fontWeight: '600',
  },
  commitmentHomeAway: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  commitmentItemDate: {
    fontSize: 12,
    color: '#8E44AD',
    fontWeight: '600',
    marginTop: 2,
  },
  matchTitleContainer: {
    marginBottom: 2,
  },
  matchTitleMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  matchTitleVs: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  upcomingToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F0FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
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
  legendContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
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
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    color: '#5856D6',
    fontWeight: '600',
  },
  athleteActions: {
    justifyContent: 'center',
    paddingLeft: 8,
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
  // Web scanner styles
  webScannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  buttonSecondary: {
    backgroundColor: '#f0f0f0',
    marginTop: 16,
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  manualInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileLink: {
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
    elevation: 3,
  },
  profileLinkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  // Society Tab Styles
  societySection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  dirigenteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  dirigenteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dirigentePhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  dirigentePhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dirigenteDetails: {
    marginLeft: 12,
    flex: 1,
  },
  dirigenteName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  dirigenteRole: {
    fontSize: 13,
    color: '#8E44AD',
    marginTop: 2,
  },
  dirigenteEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  dirigentePhone: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  whatsappBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  whatsappBtnTextSmall: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  whatsappBtnDisabled: {
    backgroundColor: '#ccc',
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});
