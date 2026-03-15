import React, { useState, useEffect, useMemo } from 'react';
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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { Athlete } from '../../src/types';
import SignaturePad from '../../src/components/SignaturePad';
import { SportIcon } from '../../src/components/SportIcon';
import { ParentOnboardingTutorial } from '../../src/components/ParentOnboardingTutorial';

// Colori vivaci per distinguere i figli
const ATHLETE_COLORS = [
  '#E91E63', // Rosa
  '#2196F3', // Blu
  '#4CAF50', // Verde
  '#FF9800', // Arancione
  '#9C27B0', // Viola
  '#00BCD4', // Ciano
  '#F44336', // Rosso
  '#3F51B5', // Indaco
];

export default function ParentDashboard() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [commitments, setCommitments] = useState<{
    today: any[];
    tomorrow: any[];
    day_after: any[];
    upcoming: any[];
  }>({ today: [], tomorrow: [], day_after: [], upcoming: [] });
  const [showUpcoming, setShowUpcoming] = useState(false);
  
  // Trial period modal state
  const [trialModalVisible, setTrialModalVisible] = useState(false);
  const [athletesRequiringAction, setAthletesRequiringAction] = useState<any[]>([]);
  const [processingTrial, setProcessingTrial] = useState(false);
  
  // Digital signature state
  const [signatureVisible, setSignatureVisible] = useState(false);
  const [signingAthlete, setSigningAthlete] = useState<any | null>(null);
  
  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);

  // Mappa nome atleta -> colore
  const athleteColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    athletes.forEach((athlete, index) => {
      const name = athlete.first_name || (athlete.full_name?.split(' ')[0] || '');
      if (name && !map[name]) {
        map[name] = ATHLETE_COLORS[index % ATHLETE_COLORS.length];
      }
    });
    return map;
  }, [athletes]);

  // Funzione per renderizzare i nomi degli atleti colorati
  const renderAthleteNames = (namesStr: string) => {
    if (!namesStr) return null;
    const names = namesStr.split(', ').filter(n => n.trim());
    if (names.length === 0) return null;
    
    return (
      <Text style={styles.athleteNamesContainer}>
        {' ('}
        {names.map((name, idx) => (
          <Text key={idx}>
            <Text style={[styles.athleteNameColored, { color: athleteColorMap[name] || '#007AFF' }]}>
              {name}
            </Text>
            {idx < names.length - 1 ? ', ' : ''}
          </Text>
        ))}
        {')'}
      </Text>
    );
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

  // Funzione per formattare il titolo della gara
  const formatMatchTitle = (item: any) => {
    const teamAbbrev = abbreviateTeamName(item.team_name);
    const athleteNames = item.athlete_names || '';
    const names = athleteNames.split(', ').filter((n: string) => n.trim());
    
    return (
      <>
        <Text style={styles.matchTitleMain}>
          Gara {teamAbbrev}
          {names.length > 0 && (
            <Text style={styles.matchTitleAthleteWrapper}>
              {' ('}
              {names.map((fullName: string, idx: number) => {
                const firstName = fullName.split(' ')[0];
                const color = athleteColorMap[fullName] || '#007AFF';
                return (
                  <Text key={idx}>
                    <Text style={[styles.matchTitleAthlete, { color }]}>{firstName}</Text>
                    {idx < names.length - 1 ? ', ' : ''}
                  </Text>
                );
              })}
              {')'}
            </Text>
          )}
        </Text>
        <Text style={styles.matchTitleVs}>Vs. {item.opponent}</Text>
      </>
    );
  };

  const loadAthletes = async () => {
    try {
      const response = await api.get('/athletes/my');
      setAthletes(response.data);
    } catch (error) {
      console.error('Error loading athletes:', error);
    }
  };
  
  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications/expiring');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.log('Could not load notifications');
    }
  };

  const loadCommitments = async () => {
    try {
      const response = await api.get('/parent/commitments');
      setCommitments(response.data);
    } catch (error) {
      console.error('Error loading commitments:', error);
    }
  };

  const [teams, setTeams] = useState<{[key: string]: string}>({});
  
  const loadTeams = async () => {
    try {
      const response = await api.get('/teams');
      const teamsMap: {[key: string]: string} = {};
      response.data.forEach((team: any) => {
        teamsMap[team.id] = team.name;
      });
      setTeams(teamsMap);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  // Check for expired trial periods
  const checkTrialPeriods = async () => {
    try {
      const response = await api.get('/trial/check-pending');
      if (response.data.athletes_requiring_action?.length > 0) {
        setAthletesRequiringAction(response.data.athletes_requiring_action);
        setTrialModalVisible(true);
      }
    } catch (error) {
      console.error('Error checking trial periods:', error);
    }
  };

  // Handle privacy acceptance and continue - now with digital signature
  const handleAcceptPrivacy = async (athleteId: string, athleteName: string) => {
    // Find the athlete in the list
    const athlete = athletesRequiringAction.find(a => a.id === athleteId);
    if (athlete) {
      // Check if athlete profile is complete before allowing privacy signature
      const missingFields = [];
      if (!athlete.fiscal_code) missingFields.push('Codice Fiscale');
      if (!athlete.date_of_birth) missingFields.push('Data di nascita');
      if (!athlete.birth_place && !athlete.place_of_birth) missingFields.push('Luogo di nascita');
      if (!athlete.gender) missingFields.push('Sesso');
      
      if (missingFields.length > 0) {
        if (Platform.OS === 'web') {
          window.alert(`⚠️ Prima di firmare la privacy, completa il profilo di ${athleteName}.\n\nCampi mancanti:\n- ${missingFields.join('\n- ')}\n\nVai nella sezione "Dati Atleta" per completare il profilo.`);
        } else {
          Alert.alert(
            'Profilo Incompleto',
            `Prima di firmare la privacy, completa il profilo di ${athleteName}.\n\nCampi mancanti:\n- ${missingFields.join('\n- ')}`,
            [
              { text: 'OK', style: 'default' }
            ]
          );
        }
        return;
      }
      
      setSigningAthlete({ ...athlete, athleteName });
      setSignatureVisible(true);
    }
  };
  
  // Handle the actual signature submission
  const handleSignPrivacy = async (signatureBase64: string) => {
    if (!signingAthlete || !user) return;
    
    const athleteId = signingAthlete.id;
    const athleteName = signingAthlete.full_name || signingAthlete.athleteName;
    
    setProcessingTrial(true);
    try {
      // First, sign the document digitally
      const privacyText = `INFORMATIVA PRIVACY PER MINORI
(Regolamento UE 2016/679 - GDPR)

Gentile Genitore/Tutore,
la presente informativa descrive le modalità di trattamento dei dati personali del minore da parte della società sportiva.

1. FINALITÀ DEL TRATTAMENTO
I dati personali del minore e del genitore/tutore saranno trattati per:
- gestione dell'iscrizione e partecipazione alle attività sportive;
- adempimento degli obblighi previsti dalle normative sportive e assicurative;
- comunicazioni con federazioni sportive, enti di promozione sportiva e organismi sportivi;
- gestione delle presenze ad allenamenti e attività sportive;
- comunicazioni organizzative con le famiglie;
- gestione amministrativa e fiscale delle attività sportive.

2. TIPOLOGIA DI DATI TRATTATI
Dati del minore: nome e cognome, data di nascita, codice fiscale, recapito telefonico (se presente), dati relativi alla partecipazione alle attività sportive.
Dati del genitore/tutore: nome e cognome, codice fiscale, telefono, email, indirizzo.
Il codice fiscale del genitore/tutore può essere utilizzato anche ai fini della detrazione fiscale delle spese sportive prevista dalla normativa vigente.

3. CERTIFICATO MEDICO SPORTIVO
La società acquisisce e conserva presso la propria sede la documentazione relativa al certificato medico sportivo del minore. Nel sistema gestionale vengono registrate esclusivamente la data di emissione e la data di scadenza del certificato medico.

4. MODALITÀ DI TRATTAMENTO
Il trattamento dei dati avviene mediante strumenti informatici e/o cartacei con modalità idonee a garantire la sicurezza e la riservatezza dei dati personali.

5. PERIODO DI CONSERVAZIONE
I dati saranno conservati per tutta la durata del rapporto sportivo con la società e successivamente per il periodo necessario all'adempimento degli obblighi legali.

6. DIRITTI DELL'INTERESSATO
Il genitore/tutore può esercitare i diritti previsti dagli articoli 15–22 del GDPR.

7. UTILIZZO DI IMMAGINI E VIDEO
Durante le attività sportive potranno essere realizzate fotografie o riprese video degli atleti per finalità documentative, informative e promozionali della società sportiva.

8. FIRMA DIGITALE DEL DOCUMENTO
La sottoscrizione del presente documento avviene in forma digitale tramite l'applicativo gestionale utilizzato dalla società.

DICHIARAZIONE
Il sottoscritto genitore/tutore ${user.full_name} dichiara di aver letto e compreso la presente informativa e autorizza il trattamento dei dati personali del minore ${athleteName} per le finalità indicate.`;

      await api.post('/documents/sign', {
        document_type: 'privacy_consent',
        document_title: `Consenso Privacy - ${athleteName}`,
        document_text: privacyText,
        signer_name: user.full_name,
        signer_email: user.email,
        signature_base64: signatureBase64,
        related_entity_id: athleteId,
        additional_data: {
          'Atleta': athleteName,
          'Genitore/Tutore': user.full_name,
          'Tipo documento': 'Consenso Privacy e Liberatoria'
        }
      });
      
      // Then update the athlete's privacy status
      await api.post(`/trial/accept-privacy/${athleteId}`);
      
      Alert.alert(
        '✅ Documento Firmato', 
        `La privacy per ${athleteName} è stata accettata e firmata.\n\nUna copia del documento è stata inviata alla tua email.`
      );
      
      // Remove this athlete from the list
      const remaining = athletesRequiringAction.filter(a => a.id !== athleteId);
      setAthletesRequiringAction(remaining);
      if (remaining.length === 0) {
        setTrialModalVisible(false);
      }
      
      // Reload athletes
      await loadAthletes();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile completare la firma');
    } finally {
      setProcessingTrial(false);
      setSigningAthlete(null);
    }
  };

  // Handle data deletion request
  const handleRequestDeletion = async (athleteId: string, athleteName: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`⚠️ ATTENZIONE: Stai per richiedere la CANCELLAZIONE DEFINITIVA di tutti i dati di ${athleteName}. Questa azione è IRREVERSIBILE.\n\nVuoi procedere?`)) {
        return;
      }
      // Double confirmation
      if (!window.confirm(`Conferma finale: sei sicuro di voler cancellare ${athleteName} dalla società?`)) {
        return;
      }
    }
    
    setProcessingTrial(true);
    try {
      const response = await api.post(`/trial/request-deletion/${athleteId}`);
      
      // Check if parent account was also deleted
      if (response.data.parent_deleted) {
        // Clear token and redirect to login
        try {
          await AsyncStorage.removeItem('token');
        } catch (e) {
          console.log('Error removing token:', e);
        }
        if (Platform.OS === 'web') {
          // Also clear localStorage
          try {
            localStorage.removeItem('token');
          } catch (e) {}
          window.alert('Account eliminato. Verrai reindirizzato alla pagina di login.');
          window.location.href = '/login';
        } else {
          Alert.alert('Account Eliminato', 'Tutti i tuoi dati sono stati cancellati.', [
            { text: 'OK', onPress: () => router.replace('/login') }
          ]);
        }
        return;
      }
      
      // Remove this athlete from the list
      const remaining = athletesRequiringAction.filter(a => a.id !== athleteId);
      setAthletesRequiringAction(remaining);
      if (remaining.length === 0) {
        setTrialModalVisible(false);
      }
      
      // Reload athletes
      await loadAthletes();
      
      if (Platform.OS === 'web') {
        window.alert(`Tutti i dati di ${athleteName} sono stati eliminati.`);
      } else {
        Alert.alert('Cancellazione Completata', `Tutti i dati di ${athleteName} sono stati eliminati.`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Impossibile completare l\'operazione';
      if (Platform.OS === 'web') {
        window.alert('Errore: ' + errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
    } finally {
      setProcessingTrial(false);
    }
  };

  useEffect(() => {
    loadAthletes();
    loadCommitments();
    loadTeams();
    loadNotifications();
    checkTrialPeriods(); // Check for expired trial periods
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAthletes(), loadCommitments(), loadTeams(), loadNotifications()]);
    setRefreshing(false);
  };

  const openEditProfile = () => {
    // Split full_name into first and last name
    const nameParts = (user?.full_name || '').split(' ');
    setEditLastName(nameParts[0] || '');
    setEditFirstName(nameParts.slice(1).join(' ') || '');
    setEditProfileVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editLastName.trim() || !editFirstName.trim()) {
      Alert.alert('Errore', 'Cognome e Nome sono obbligatori');
      return;
    }
    setSavingProfile(true);
    try {
      const fullName = `${editLastName.trim()} ${editFirstName.trim()}`;
      await api.patch('/auth/me', {
        full_name: fullName,
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
      });
      // Update local user state and force re-render
      await updateUser({
        full_name: fullName,
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
      });
      setEditProfileVisible(false);
      // Reload athletes to force refresh
      await loadAthletes();
      Alert.alert('✅ Successo', 'I tuoi dati sono stati aggiornati correttamente');
    } catch (error: any) {
      console.error('Profile update error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 'Impossibile aggiornare i dati';
      Alert.alert('Errore', errorMessage);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
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

  return (
    <View style={styles.container}>
      <ParentOnboardingTutorial />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>I Miei Figli</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.profileSection}>
          <View style={styles.welcomeRow}>
            <Text style={styles.welcomeLabel}>Benvenuto</Text>
            <TouchableOpacity onPress={() => router.push('/parent/profile')} style={styles.editProfileBtn}>
              <Ionicons name="person-circle-outline" size={18} color="#E91E63" />
              <Text style={[styles.editProfileText, { color: '#E91E63' }]}>Il Mio Profilo</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.welcomeName}>
            {user?.full_name?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
        </View>

        {/* Notifications Banner */}
        {notifications.length > 0 && showNotifications && (
          <View style={styles.notificationBanner}>
            <View style={styles.notificationHeader}>
              <View style={styles.notificationTitleRow}>
                <Ionicons name="notifications" size={20} color="#FF9800" />
                <Text style={styles.notificationTitle}>Scadenze in arrivo</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {notifications.map((notif, index) => (
              <View key={index} style={[
                styles.notificationItem,
                notif.status === 'expired' && styles.notificationExpired,
                notif.status === 'urgent' && styles.notificationUrgent
              ]}>
                <Ionicons 
                  name={notif.type === 'certificate' ? 'document-text' : 'card'} 
                  size={18} 
                  color={notif.status === 'expired' ? '#D32F2F' : (notif.status === 'urgent' ? '#F57C00' : '#FF9800')} 
                />
                <View style={styles.notificationContent}>
                  <Text style={[
                    styles.notificationMessage,
                    notif.status === 'expired' && { color: '#D32F2F' }
                  ]}>
                    {notif.athlete_name}: {notif.message}
                  </Text>
                  <Text style={styles.notificationDate}>
                    {notif.type === 'certificate' ? `Scadenza: ${notif.expiry_date}` : `Scadenza: ${notif.due_date}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* IMPEGNI Section */}
        <View style={styles.commitmentsSection}>
          <Text style={styles.commitmentsSectionTitle}>📅 Impegni</Text>
          
          {/* OGGI */}
          <View style={styles.commitmentDay}>
            <View style={styles.commitmentDayHeader}>
              <View style={[styles.commitmentDot, { backgroundColor: '#FF3B30' }]} />
              <Text style={styles.commitmentDayTitle}>OGGI</Text>
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
                        {renderAthleteNames(item.athlete_names)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        {formatMatchTitle(item)}
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
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
              <Text style={styles.commitmentDayTitle}>DOMANI</Text>
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
                        {renderAthleteNames(item.athlete_names)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        {formatMatchTitle(item)}
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
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
              <Text style={styles.commitmentDayTitle}>DOPODOMANI</Text>
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
                        {renderAthleteNames(item.athlete_names)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        {formatMatchTitle(item)}
                      </View>
                    )}
                    <Text style={styles.commitmentItemDetails}>
                      {item.type === 'training' 
                        ? `${item.time_start} - ${item.time_end}` 
                        : `ore ${item.time}`} • {item.venue}
                      {item.city ? ` - ${item.city}` : ''}
                    </Text>
                    {item.meeting_time && (
                      <Text style={styles.commitmentMeeting}>⚠️ Ritrovo: {item.meeting_time}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* IMPEGNI SUCCESSIVI - Collapsible */}
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
                        {renderAthleteNames(item.athlete_names)}
                      </Text>
                    ) : (
                      <View style={styles.matchTitleContainer}>
                        {formatMatchTitle(item)}
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
                    {item.meeting_time && (
                      <Text style={styles.commitmentMeeting}>⚠️ Ritrovo: {item.meeting_time}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ATLETI Section */}
        <Text style={styles.athletesSectionTitle}>👨‍👩‍👧‍👦 I Miei Figli</Text>

        {athletes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Nessun atleta registrato</Text>
            <Text style={styles.emptySubtext}>Inizia registrando un atleta</Text>
          </View>
        ) : (
          <View style={styles.athletesList}>
            {athletes.map((athlete) => {
              // Determina colore bordo in base allo stato
              const borderColor = athlete.status === 'pending' 
                ? '#FFE082' 
                : athlete.status === 'trial' 
                  ? '#FF9500' // Arancione per prova
                  : '#34C759'; // Verde per attivo
              
              const iconColor = athlete.status === 'pending' 
                ? '#FF9500' 
                : athlete.status === 'trial' 
                  ? '#FF9500' 
                  : '#34C759';
              
              return (
              <TouchableOpacity
                key={athlete.id}
                style={[
                  styles.athleteCard,
                  { borderLeftWidth: 4, borderLeftColor: borderColor },
                  athlete.status === 'pending' && styles.athleteCardPending
                ]}
                onPress={() => athlete.status !== 'pending' && router.push(`/parent/athlete/${athlete.id}`)}
                disabled={athlete.status === 'pending'}
              >
                <View style={[styles.athleteIcon, { backgroundColor: `${iconColor}15` }]}>
                  <Ionicons 
                    name={athlete.status === 'pending' ? "time" : "person"} 
                    size={24} 
                    color={iconColor} 
                  />
                </View>
                <View style={styles.athleteInfo}>
                  <Text style={styles.athleteName}>{athlete.full_name}</Text>
                  {athlete.team_id && teams[athlete.team_id] && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <SportIcon size={14} />
                      <Text style={[styles.athleteTeam, { marginLeft: 4 }]}>{teams[athlete.team_id]}</Text>
                    </View>
                  )}
                  <Text style={[
                    styles.athleteStatus,
                    { color: iconColor, fontWeight: '600' }
                  ]}>
                    {athlete.status === 'pending' 
                      ? '⏳ In attesa di approvazione' 
                      : athlete.status === 'trial' 
                        ? '🔶 Periodo di prova' 
                        : '✓ Attivo'}
                  </Text>
                </View>
                {athlete.status !== 'pending' && (
                  <Ionicons name="chevron-forward" size={24} color="#999" />
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/parent/register-athlete')}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Registra Nuovo Atleta</Text>
        </TouchableOpacity>

        {/* Documents Button */}
        <TouchableOpacity
          style={styles.documentsButton}
          onPress={() => router.push('/parent/documents')}
        >
          <Ionicons name="folder-open" size={24} color="#8E44AD" />
          <Text style={styles.documentsButtonText}>I Miei Documenti</Text>
          <Ionicons name="chevron-forward" size={20} color="#8E44AD" />
        </TouchableOpacity>
      </ScrollView>

      {/* Modal per modifica nome */}
      <Modal
        visible={editProfileVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifica Dati Personali</Text>
            
            <Text style={styles.inputLabel}>Cognome</Text>
            <TextInput
              style={styles.textInput}
              value={editLastName}
              onChangeText={(text) => setEditLastName(text.toUpperCase())}
              autoCapitalize="characters"
              placeholder="es: ROSSI"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.inputLabel}>Nome</Text>
            <TextInput
              style={styles.textInput}
              value={editFirstName}
              onChangeText={(text) => setEditFirstName(text.toUpperCase())}
              autoCapitalize="characters"
              placeholder="es: MARIO"
              placeholderTextColor="#aaa"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditProfileVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                <Text style={styles.saveButtonText}>
                  {savingProfile ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Trial Period Expired Modal */}
      <Modal
        visible={trialModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setTrialModalVisible(false)}
      >
        <View style={styles.trialModalOverlay}>
          <View style={styles.trialModalContent}>
            {/* Close button */}
            <TouchableOpacity 
              style={styles.trialCloseBtn}
              onPress={() => setTrialModalVisible(false)}
            >
              <Text style={styles.trialCloseBtnText}>✕</Text>
            </TouchableOpacity>
            
            <View style={styles.trialModalHeader}>
              <Ionicons name="time-outline" size={48} color="#FF9500" />
              <Text style={styles.trialModalTitle}>Periodo di Prova Terminato</Text>
              <Text style={styles.trialModalSubtitle}>
                Il periodo di prova di 7 giorni è terminato. Per continuare, è necessario confermare l'iscrizione.
              </Text>
            </View>

            {athletesRequiringAction.map((athlete) => (
              <View key={athlete.id} style={styles.trialAthleteCard}>
                <Text style={styles.trialAthleteName}>{athlete.full_name}</Text>
                <Text style={styles.trialAthleteTeam}>{athlete.team_name || 'Squadra'}</Text>
                
                <View style={styles.trialButtonsRow}>
                  <TouchableOpacity
                    style={[styles.trialButton, styles.trialButtonAccept]}
                    onPress={() => handleAcceptPrivacy(athlete.id, athlete.full_name)}
                    disabled={processingTrial}
                    data-testid={`accept-privacy-${athlete.id}`}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.trialButtonText}>Resta, Compila e Firma</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.trialButton, styles.trialButtonDelete]}
                    onPress={() => handleRequestDeletion(athlete.id, athlete.full_name)}
                    disabled={processingTrial}
                    data-testid={`delete-data-${athlete.id}`}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.trialButtonText}>Esci e Cancella</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {processingTrial && (
              <View style={styles.trialProcessing}>
                <Text style={styles.trialProcessingText}>Elaborazione in corso...</Text>
              </View>
            )}
            
            {/* Decide later button */}
            <TouchableOpacity 
              style={styles.trialDecideLaterBtn}
              onPress={() => setTrialModalVisible(false)}
            >
              <Text style={styles.trialDecideLaterText}>Decidi dopo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Digital Signature Modal */}
      {signingAthlete && user && (
        <SignaturePad
          visible={signatureVisible}
          onClose={() => {
            setSignatureVisible(false);
            setSigningAthlete(null);
          }}
          onSign={handleSignPrivacy}
          documentTitle={`Consenso Privacy - ${signingAthlete.full_name || signingAthlete.athleteName}`}
          documentText={`Il/La sottoscritto/a ${user.full_name}, in qualità di genitore/tutore dell'atleta minorenne ${signingAthlete.full_name || signingAthlete.athleteName}, dichiara di aver letto e compreso l'informativa sulla privacy (GDPR) e presta il proprio consenso a:

• Trattamento dati per attività sportiva
• Comunicazione dati a Federazioni/EPS per tesseramento
• Utilizzo immagini/video sui social e materiale promozionale
• Comunicazione dati ad assicurazioni ed enti sanitari

Firma qui sotto per confermare.`}
          signerName={user.full_name}
        />
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  welcomeLabel: {
    fontSize: 14,
    color: '#666',
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  profileSection: {
    padding: 20,
    paddingBottom: 10,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
  },
  editProfileText: {
    marginLeft: 4,
    color: '#007AFF',
    fontSize: 14,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  athletesList: {
    padding: 16,
  },
  athleteCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  athleteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  athleteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  athleteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  athleteTeam: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
    fontWeight: '500',
  },
  athleteStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  athleteStatusPending: {
    color: '#FF9500',
    fontWeight: '600',
  },
  athleteCardPending: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  addButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Commitments Section Styles
  commitmentsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commitmentsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  commitmentDayTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  noCommitments: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 20,
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    marginLeft: 20,
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
  matchTitleContainer: {
    marginBottom: 2,
  },
  matchTitleMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  matchTitleAthleteWrapper: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchTitleAthlete: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  matchTitleVs: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  athleteNameColored: {
    fontWeight: 'bold',
  },
  commitmentItemDate: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 2,
  },
  upcomingToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  athleteNamesContainer: {
    fontSize: 14,
  },
  athleteName: {
    fontWeight: '700',
    fontSize: 14,
  },
  athletesSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  matchTitleContainer: {
    flexDirection: 'column',
  },
  matchTitleMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  matchTitleAthlete: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  matchTitleVs: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF9500',
    marginTop: 2,
  },
  // Trial Period Modal Styles
  trialModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  trialModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
  },
  trialModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  trialModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  trialModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  trialAthleteCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  trialAthleteName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  trialAthleteTeam: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  trialButtonsRow: {
    gap: 10,
  },
  trialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  trialButtonAccept: {
    backgroundColor: '#34C759',
  },
  trialButtonDelete: {
    backgroundColor: '#FF3B30',
  },
  trialButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  trialProcessing: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  trialProcessingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  trialCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  trialCloseBtnText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  trialDecideLaterBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  trialDecideLaterText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  // Notification styles
  notificationBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E65100',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    gap: 10,
  },
  notificationExpired: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
  },
  notificationUrgent: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 3,
    borderLeftColor: '#F57C00',
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  notificationDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  documentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EEF8',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#8E44AD',
    gap: 12,
  },
  documentsButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#8E44AD',
  },
});
