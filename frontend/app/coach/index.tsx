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
  TextInput,
  Modal,
  Linking,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { Team } from '../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { SportIcon } from '../../src/components/SportIcon';

// Web QR Scanner
let Html5QrcodeScanner: any = null;
if (Platform.OS === 'web') {
  Html5QrcodeScanner = require('html5-qrcode').Html5QrcodeScanner;
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
  const [webScannerError, setWebScannerError] = useState<string | null>(null);
  const [manualQrInput, setManualQrInput] = useState('');
  const [manualInputModalVisible, setManualInputModalVisible] = useState(false);
  const webScannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement | null>(null);

  // Certificate override modal state
  const [certificateOverrideModal, setCertificateOverrideModal] = useState(false);
  const [certificateOverrideData, setCertificateOverrideData] = useState<{
    athleteId: string;
    athleteName: string;
    teamId: string;
    blockReason: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

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

  // Auto-select team if only one
  useEffect(() => {
    if (teams.length === 1 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeams();
    await loadCommitments();
    await loadDirigenti();
    setRefreshing(false);
  };

  // State for force registration
  const [pendingQrCode, setPendingQrCode] = useState<string | null>(null);
  const [forceModalVisible, setForceModalVisible] = useState(false);
  const [forceNote, setForceNote] = useState('');
  const [pendingAttendance, setPendingAttendance] = useState<{
    athlete_name?: string;
    team_name?: string;
    check_in_time?: string;
    block_reason?: string;
  } | null>(null);
  
  // Team selection for scanner
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamSelectModalVisible, setTeamSelectModalVisible] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const showForceRegistrationDialog = (qrCode: string, attendanceData: any) => {
    setPendingQrCode(qrCode);
    setPendingAttendance(attendanceData);
    setForceNote('');
    
    const athleteName = attendanceData?.athlete_name || 'Atleta';
    const checkInTime = attendanceData?.check_in_time ? 
      new Date(attendanceData.check_in_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 
      '';
    const teamName = attendanceData?.team_name || '';
    
    if (Platform.OS === 'web') {
      setForceModalVisible(true);
    } else {
      Alert.alert(
        '⚠️ PRESENZA GIÀ REGISTRATA',
        `${athleteName} è già stato/a registrato/a oggi alle ${checkInTime}${teamName ? ` per ${teamName}` : ''}.\n\nSe fa allenamento con due squadre diverse, puoi forzare la registrazione.`,
        [
          {
            text: 'Annulla',
            style: 'cancel',
            onPress: () => {
              setPendingQrCode(null);
              setPendingAttendance(null);
            }
          },
          {
            text: 'FORZA REGISTRAZIONE',
            style: 'destructive',
            onPress: () => {
              // On native, prompt for note
              Alert.prompt(
                'Nota forzatura',
                'Inserisci una nota (opzionale):',
                [
                  { text: 'Annulla', style: 'cancel' },
                  { text: 'Conferma', onPress: (note) => handleForceRegistration(qrCode, note || '') }
                ],
                'plain-text'
              );
            }
          }
        ]
      );
    }
  };

  // Handle certificate override (Admin only)
  const handleCertificateOverride = async () => {
    if (!certificateOverrideData || !overrideReason.trim()) {
      showAlert('Errore', 'Inserisci il motivo dell\'override (obbligatorio)');
      return;
    }

    if (overrideReason.trim().length < 5) {
      showAlert('Errore', 'Il motivo deve essere di almeno 5 caratteri');
      return;
    }

    setOverrideLoading(true);
    try {
      // 1. First, call the override endpoint
      await api.post('/certificates/override', {
        athlete_id: certificateOverrideData.athleteId,
        reason: overrideReason.trim()
      });

      // 2. Now register the attendance with override flag
      const response = await api.post('/attendance/check', {
        qr_code: certificateOverrideData.athleteId,
        team_id: certificateOverrideData.teamId,
        force: true,
        force_note: `Override certificato: ${overrideReason.trim()}`
      });

      setCertificateOverrideModal(false);
      setCertificateOverrideData(null);
      setOverrideReason('');

      // Show success message
      showAlert(
        '✅ ACCESSO AUTORIZZATO',
        `${certificateOverrideData.athleteName} è stato/a registrato/a all'allenamento.\n\n⚠️ L'override è valido SOLO per questa sessione.`
      );
    } catch (error: any) {
      showAlert(
        'Errore Override',
        error.response?.data?.detail || 'Impossibile effettuare l\'override'
      );
    } finally {
      setOverrideLoading(false);
    }
  };

  // Handle certificate access denial (Admin only)
  const handleCertificateDenial = async () => {
    if (!certificateOverrideData) return;

    setOverrideLoading(true);
    try {
      // Log the denial in audit logs
      await api.post('/certificates/deny-access', {
        athlete_id: certificateOverrideData.athleteId,
        athlete_name: certificateOverrideData.athleteName,
        reason: certificateOverrideData.blockReason
      });

      setCertificateOverrideModal(false);
      setCertificateOverrideData(null);
      setOverrideReason('');

      // Show denial message
      showAlert(
        '⛔ ACCESSO RIFIUTATO',
        `${certificateOverrideData.athleteName} NON è stato/a ammesso/a all'allenamento per certificato medico scaduto.`
      );
    } catch (error: any) {
      // Even if logging fails, close the modal and show denial
      setCertificateOverrideModal(false);
      setCertificateOverrideData(null);
      setOverrideReason('');
      
      showAlert(
        '⛔ ACCESSO RIFIUTATO',
        `${certificateOverrideData?.athleteName || 'Atleta'} NON è stato/a ammesso/a all'allenamento.`
      );
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleForceRegistration = async (qrCode: string, note: string = '') => {
    setForceModalVisible(false);
    try {
      const response = await api.post('/attendance/check', { 
        qr_code: qrCode, 
        team_id: selectedTeamId,
        force: true,
        force_note: note || forceNote || 'Forzatura coach'
      });
      const attendance = response.data;
      
      if (attendance.status === 'blocked') {
        showAlert('⛔ ACCESSO NEGATO', attendance.block_reason || 'Atleta non autorizzato');
      } else {
        showAlert('✅ Presenza Registrata (Forzata)', `Presenza forzata registrata per ${attendance.athlete_name || 'atleta'}.`);
      }
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    }
    setPendingQrCode(null);
    setPendingAttendance(null);
    setForceNote('');
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanning(false);
    
    // Check if team is selected
    if (!selectedTeamId) {
      showAlert('⚠️ Seleziona Squadra', 'Devi selezionare una squadra prima di registrare le presenze.');
      setTeamSelectModalVisible(true);
      return;
    }
    
    try {
      const response = await api.post('/attendance/check', { 
        qr_code: data,
        team_id: selectedTeamId
      });
      const attendance = response.data;
      
      if (attendance.status === 'already_registered') {
        // Already registered today - show force option with details
        showForceRegistrationDialog(data, attendance);
      } else if (attendance.status === 'blocked') {
        // Check if blocked due to certificate
        if (attendance.certificate_blocked && attendance.can_override && user?.role === 'admin') {
          // Show override modal for admin
          setCertificateOverrideData({
            athleteId: attendance.athlete_id,
            athleteName: attendance.athlete_name || 'Atleta',
            teamId: attendance.team_id,
            blockReason: attendance.block_reason || 'Certificato scaduto'
          });
          setOverrideReason('');
          setCertificateOverrideModal(true);
        } else {
          // Blocked - show error with red styling
          showAlert(
            '⛔ ACCESSO NEGATO',
            `${attendance.athlete_name || 'Atleta'}\n\n${attendance.block_reason || 'Non autorizzato'}`
          );
        }
      } else {
        // Allowed - show success with athlete name
        const athleteName = attendance.athlete_name || 'Atleta';
        const hasWarning = attendance.block_reason && attendance.block_reason.trim() !== '';
        
        if (hasWarning) {
          showAlert(
            '✅ PRESENZA REGISTRATA - ATTENZIONE!',
            `${athleteName} ammesso/a all'allenamento.\n\n${attendance.block_reason}`
          );
        } else {
          showAlert(
            '✅ Presenza Registrata',
            `${athleteName} - Presenza registrata con successo!`
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
    setWebScannerError(null);
    
    // Wait for DOM to be ready
    setTimeout(() => {
      try {
        const html5QrcodeScanner = new Html5QrcodeScanner(
          "web-qr-scanner",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            // Force back camera (environment facing) and hide camera selection
            videoConstraints: {
              facingMode: { exact: "environment" }
            },
            // Hide UI elements for simpler interface
            showZoomSliderIfSupported: false,
            defaultZoomValueIfSupported: 1,
          },
          false
        );
        
        html5QrcodeScanner.render(
          async (decodedText: string) => {
            html5QrcodeScanner.clear();
            setWebScannerActive(false);
            setWebScannerError(null);
            await handleBarCodeScanned({ data: decodedText });
          },
          (error: any) => {
            // Check for permission errors
            const errorStr = String(error);
            if (errorStr.includes('NotAllowedError') || errorStr.includes('Permission denied')) {
              setWebScannerError('PERMISSION_DENIED');
            }
          }
        );
        
        webScannerRef.current = html5QrcodeScanner;
        
        // Add custom CSS to improve button spacing and avoid overlap
        setTimeout(() => {
          const style = document.createElement('style');
          style.textContent = `
            #web-qr-scanner {
              padding-bottom: 20px !important;
            }
            #web-qr-scanner button {
              margin: 8px 5px !important;
              padding: 12px 20px !important;
              font-size: 14px !important;
              min-height: 44px !important;
            }
            #web-qr-scanner select {
              margin: 10px 5px !important;
              padding: 10px !important;
              font-size: 14px !important;
            }
            #web-qr-scanner #html5-qrcode-button-camera-permission {
              background-color: #007AFF !important;
              color: white !important;
              border: none !important;
              border-radius: 10px !important;
              margin-bottom: 15px !important;
            }
            #web-qr-scanner #html5-qrcode-anchor-scan-type-change {
              margin-top: 15px !important;
              font-size: 13px !important;
            }
            #web-qr-scanner #html5-qrcode-button-camera-start {
              background-color: #34C759 !important;
              color: white !important;
              border: none !important;
              border-radius: 10px !important;
            }
            /* Hide the library's Stop Scanning button - we use our own Chiudi Scanner button */
            #web-qr-scanner #html5-qrcode-button-camera-stop {
              display: none !important;
            }
            #web-qr-scanner video {
              margin-bottom: 10px !important;
              max-height: 300px !important;
            }
            /* Torch button styling */
            #web-qr-scanner button[id*="torch"],
            #web-qr-scanner button:contains("Torch") {
              background-color: #FF9500 !important;
              color: white !important;
              border: none !important;
              border-radius: 10px !important;
            }
          `;
          document.head.appendChild(style);
        }, 200);
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
    setWebScannerError(null);
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
      style={styles.teamCard}
      onPress={() => router.push(`/coach/team/${team.id}`)}
    >
      <View style={styles.teamCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.teamName}>{team.name}</Text>
          {team.description && (
            <Text style={styles.teamDescription}>{team.description}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

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
            <TouchableOpacity onPress={() => { stopWebScanner(); }} style={{ padding: 8 }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scanner Presenze</Text>
            <TouchableOpacity onPress={() => { stopWebScanner(); }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.webScannerContainer}>
            {/* Permission error message */}
            {webScannerError === 'PERMISSION_DENIED' && (
              <View style={{ backgroundColor: '#FFEBEE', padding: 16, borderRadius: 12, marginBottom: 20, marginHorizontal: 16, borderWidth: 1, borderColor: '#F44336' }}>
                <Text style={{ color: '#C62828', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                  ⚠️ Permesso fotocamera negato
                </Text>
                <Text style={{ color: '#333', fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
                  Per usare lo scanner devi consentire l'accesso alla fotocamera.
                </Text>
                <Text style={{ color: '#333', fontSize: 13, lineHeight: 18 }}>
                  <Text style={{ fontWeight: '600' }}>Come risolvere:</Text>{'\n'}
                  1. Clicca sull'icona 🔒 nella barra degli indirizzi{'\n'}
                  2. Seleziona "Impostazioni sito"{'\n'}
                  3. Imposta "Fotocamera" su "Consenti"{'\n'}
                  4. Ricarica la pagina
                </Text>
                <TouchableOpacity 
                  style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginTop: 16 }}
                  onPress={() => setManualInputModalVisible(true)}
                >
                  <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
                    Inserisci codice manualmente
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            <div id="web-qr-scanner" style={{ width: '100%', maxWidth: 500 }} />
            
            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 30, marginBottom: 40 }]}
              onPress={stopWebScanner}
            >
              <Text style={styles.cancelButtonText}>Chiudi Scanner</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setActiveTab('teams')} style={{ padding: 8 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scanner Presenze</Text>
          <TouchableOpacity onPress={handleLogout} style={{ padding: 8 }}>
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
        
        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={styles.scannerContent}
        >
          <Ionicons name="qr-code" size={60} color="#007AFF" />
          <Text style={styles.scannerTitle}>Pronto per scansionare</Text>
          <Text style={styles.scannerSubtitle}>Registra le presenze degli atleti</Text>
          
          {/* Team Selection */}
          <TouchableOpacity 
            style={[styles.teamSelector, selectedTeamId && styles.teamSelectorActive]}
            onPress={() => setTeamSelectModalVisible(true)}
          >
            <Ionicons name="people" size={20} color={selectedTeamId ? "#34C759" : "#999"} />
            <Text style={[styles.teamSelectorText, selectedTeamId && styles.teamSelectorTextActive]}>
              {selectedTeamId 
                ? `📋 ${teams.find(t => t.id === selectedTeamId)?.name || 'Squadra selezionata'}`
                : '⚠️ Seleziona una squadra'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity style={styles.scannerButton} onPress={startWebScanner}>
                <Ionicons name="camera" size={22} color="#fff" />
                <Text style={styles.scannerButtonText}>Apri Scanner Fotocamera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.scannerButtonSecondary} 
                onPress={() => setManualInputModalVisible(true)}
              >
                <Ionicons name="keypad" size={22} color="#007AFF" />
                <Text style={styles.scannerButtonSecondaryText}>Inserisci Codice Manualmente</Text>
              </TouchableOpacity>
              
              {/* Tip for permanent camera permission */}
              <View style={styles.permissionTip}>
                <Text style={styles.permissionTipTitle}>
                  📱 Come memorizzare il permesso fotocamera
                </Text>
                <Text style={styles.permissionTipText}>
                  <Text style={{ fontWeight: '600' }}>Metodo 1 - Dalle impostazioni del telefono:</Text>{'\n'}
                  Vai in Impostazioni → App → Chrome/Browser → Autorizzazioni → Fotocamera → Consenti sempre
                </Text>
                <Text style={styles.permissionTipText}>
                  <Text style={{ fontWeight: '600' }}>Metodo 2 - Dalle impostazioni del browser:</Text>{'\n'}
                  Tocca ⋮ (menu) → Impostazioni → Impostazioni sito → Fotocamera
                </Text>
                <Text style={styles.permissionTipNote}>
                  💡 Seleziona "Consenti sempre" quando il browser chiede il permesso
                </Text>
              </View>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.scannerButton} 
              onPress={async () => {
                if (Platform.OS !== 'web') {
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
              <Ionicons name="scan" size={22} color="#fff" />
              <Text style={styles.scannerButtonText}>Scansiona QR Code</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/coach/history')}
          >
            <Ionicons name="list" size={18} color="#007AFF" />
            <Text style={styles.historyButtonText}>Storico Presenze</Text>
          </TouchableOpacity>
          
          <View style={{ height: 40 }} />
        </ScrollView>
        
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
                placeholderTextColor="#999"
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
              <Text style={styles.modalTitle}>⚠️ PRESENZA GIÀ REGISTRATA</Text>
              <Text style={styles.modalSubtitle}>
                {pendingAttendance?.athlete_name || 'Atleta'} è già stato/a registrato/a oggi
                {pendingAttendance?.check_in_time ? ` alle ${new Date(pendingAttendance.check_in_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}
                {pendingAttendance?.team_name ? ` per ${pendingAttendance.team_name}` : ''}.
                {'\n\n'}
                Se fa allenamento con due squadre diverse, puoi forzare la registrazione.
              </Text>
              
              <TextInput
                style={styles.forceNoteInput}
                placeholder="Nota (es. doppio allenamento, arrivato in ritardo...)"
                placeholderTextColor="#999"
                value={forceNote}
                onChangeText={setForceNote}
                multiline
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setForceModalVisible(false);
                    setPendingQrCode(null);
                    setPendingAttendance(null);
                    setForceNote('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Annulla</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.forceButton]}
                  onPress={() => pendingQrCode && handleForceRegistration(pendingQrCode, forceNote)}
                >
                  <Text style={styles.forceButtonText}>FORZA REGISTRAZIONE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Certificate Override Modal (Admin only) */}
        <Modal
          visible={certificateOverrideModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setCertificateOverrideModal(false);
            setCertificateOverrideData(null);
            setOverrideReason('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.certificateOverrideModal]}>
              <View style={styles.certificateOverrideHeader}>
                <Text style={styles.certificateOverrideIcon}>🏥</Text>
                <Text style={styles.certificateOverrideTitle}>CERTIFICATO SCADUTO</Text>
              </View>
              
              <View style={styles.certificateOverrideAthleteBox}>
                <Text style={styles.certificateOverrideAthleteName}>
                  {certificateOverrideData?.athleteName}
                </Text>
                <Text style={styles.certificateOverrideReason}>
                  {certificateOverrideData?.blockReason}
                </Text>
              </View>
              
              <Text style={styles.certificateOverrideWarning}>
                ⚠️ L'override è valido SOLO per questa sessione di allenamento.
                Il blocco si riattiverà automaticamente.
              </Text>
              
              <Text style={styles.certificateOverrideLabel}>
                Motivo dell'override (obbligatorio):
              </Text>
              <TextInput
                style={styles.certificateOverrideInput}
                placeholder="es. Certificato in fase di rinnovo, gara imminente..."
                placeholderTextColor="#999"
                value={overrideReason}
                onChangeText={setOverrideReason}
                multiline
                numberOfLines={3}
              />
              
              {/* Two main action buttons - RIFIUTA and AUTORIZZA */}
              <View style={styles.certificateActionButtons}>
                {/* RIFIUTA Button - Red, prominent */}
                <TouchableOpacity
                  style={[
                    styles.certificateDenyButton,
                    overrideLoading && styles.certificateButtonDisabled
                  ]}
                  onPress={handleCertificateDenial}
                  disabled={overrideLoading}
                >
                  {overrideLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.certificateDenyButtonIcon}>⛔</Text>
                      <Text style={styles.certificateDenyButtonText}>RIFIUTA</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                {/* AUTORIZZA Button - Green, requires reason */}
                <TouchableOpacity
                  style={[
                    styles.certificateAuthorizeButton,
                    (!overrideReason.trim() || overrideLoading) && styles.certificateButtonDisabled
                  ]}
                  onPress={handleCertificateOverride}
                  disabled={!overrideReason.trim() || overrideLoading}
                >
                  {overrideLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.certificateAuthorizeButtonIcon}>✅</Text>
                      <Text style={styles.certificateAuthorizeButtonText}>AUTORIZZA</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Cancel link */}
              <TouchableOpacity
                style={styles.certificateCancelLink}
                onPress={() => {
                  setCertificateOverrideModal(false);
                  setCertificateOverrideData(null);
                  setOverrideReason('');
                }}
              >
                <Text style={styles.certificateCancelLinkText}>Annulla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Team Selection Modal */}
        <Modal
          visible={teamSelectModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setTeamSelectModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📋 Seleziona Squadra</Text>
              <Text style={styles.modalSubtitle}>
                Seleziona la squadra per cui vuoi registrare le presenze:
              </Text>
              
              <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
                {teams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.teamSelectItem,
                      selectedTeamId === team.id && styles.teamSelectItemActive
                    ]}
                    onPress={() => {
                      setSelectedTeamId(team.id);
                      setTeamSelectModalVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons 
                        name={selectedTeamId === team.id ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={selectedTeamId === team.id ? "#34C759" : "#ccc"} 
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.teamSelectName}>{team.name}</Text>
                        {team.sport && <Text style={styles.teamSelectSport}>{team.sport}</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { alignSelf: 'center' }]}
                onPress={() => setTeamSelectModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Chiudi</Text>
              </TouchableOpacity>
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

        {/* Profile Link - Moved up */}
        <TouchableOpacity
          style={styles.profileLink}
          onPress={() => router.push('/coach/profile')}
        >
          <Ionicons name="person-circle" size={24} color="#007AFF" />
          <Text style={styles.profileLinkText}>Il Mio Profilo</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

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
                    name={item.type === 'training' ? 'fitness' : item.type === 'rifinitura' ? 'sunny' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : item.type === 'rifinitura' ? '#9C27B0' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : item.type === 'rifinitura' ? (
                      <Text style={[styles.commitmentItemTitle, { color: '#9C27B0' }]}>
                        🏠 Rifinitura pre-gara {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' || item.type === 'rifinitura'
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
                    name={item.type === 'training' ? 'fitness' : item.type === 'rifinitura' ? 'sunny' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : item.type === 'rifinitura' ? '#9C27B0' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : item.type === 'rifinitura' ? (
                      <Text style={[styles.commitmentItemTitle, { color: '#9C27B0' }]}>
                        🏠 Rifinitura pre-gara {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' || item.type === 'rifinitura'
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
                    name={item.type === 'training' ? 'fitness' : item.type === 'rifinitura' ? 'sunny' : 'trophy'} 
                    size={16} 
                    color={item.type === 'training' ? '#007AFF' : item.type === 'rifinitura' ? '#9C27B0' : '#FF9500'} 
                  />
                  <View style={styles.commitmentItemContent}>
                    {item.type === 'training' ? (
                      <Text style={styles.commitmentItemTitle}>
                        Allenamento {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : item.type === 'rifinitura' ? (
                      <Text style={[styles.commitmentItemTitle, { color: '#9C27B0' }]}>
                        🏠 Rifinitura pre-gara {abbreviateTeamName(item.team_name)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        <Text style={styles.matchTitleMain}>Gara {abbreviateTeamName(item.team_name)}</Text>
                        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' || item.type === 'rifinitura'
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SportIcon size={20} />
            <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>Squadre Assegnate</Text>
          </View>
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
  scannerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  scannerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  scannerButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scannerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  scannerButtonSecondary: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  scannerButtonSecondaryText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionTip: {
    marginTop: 24,
    marginHorizontal: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  permissionTipTitle: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 6,
  },
  permissionTipText: {
    fontSize: 11,
    color: '#333',
    lineHeight: 18,
    marginBottom: 6,
  },
  permissionTipNote: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    fontStyle: 'italic',
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
    marginTop: 24,
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
  forceButton: {
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  forceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
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
  // Force note input
  forceNoteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  // Team selection
  teamSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
  },
  teamSelectItemActive: {
    borderColor: '#34C759',
    backgroundColor: '#f0fff4',
  },
  teamSelectName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  teamSelectSport: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  // Team selector in scanner
  teamSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '100%',
    maxWidth: 350,
  },
  teamSelectorActive: {
    backgroundColor: '#f0fff4',
    borderColor: '#34C759',
  },
  teamSelectorText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  teamSelectorTextActive: {
    color: '#333',
    fontWeight: '500',
  },
  // Certificate Override Modal
  certificateOverrideModal: {
    borderWidth: 2,
    borderColor: '#E74C3C',
  },
  certificateOverrideHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  certificateOverrideIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  certificateOverrideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E74C3C',
    textAlign: 'center',
  },
  certificateOverrideAthleteBox: {
    backgroundColor: '#FDEDEC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  certificateOverrideAthleteName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  certificateOverrideReason: {
    fontSize: 14,
    color: '#C0392B',
  },
  certificateOverrideWarning: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
  },
  certificateOverrideLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  certificateOverrideInput: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  certificateOverrideButton: {
    backgroundColor: '#E74C3C',
  },
  certificateOverrideButtonDisabled: {
    backgroundColor: '#ccc',
  },
  certificateOverrideButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // New certificate action buttons styles
  certificateActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  certificateDenyButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  certificateDenyButtonIcon: {
    fontSize: 18,
  },
  certificateDenyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  certificateAuthorizeButton: {
    flex: 1,
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  certificateAuthorizeButtonIcon: {
    fontSize: 18,
  },
  certificateAuthorizeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  certificateButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  certificateCancelLink: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
  certificateCancelLinkText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
