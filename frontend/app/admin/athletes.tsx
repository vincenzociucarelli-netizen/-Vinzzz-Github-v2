import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Image,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '../../src/components/Icon';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../src/constants/countries';
import api from '../../src/services/api';
import { Athlete, Team } from '../../src/types';
import { exportToExcel } from '../../src/utils/excelExport';
import { useAuthStore } from '../../src/store/authStore';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function AdminAthletes() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<{[key: string]: Team}>({});
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sectionListRef = useRef<SectionList>(null);
  
  // Modal per aggiungere atleta maggiorenne
  const [showAddAdultModal, setShowAddAdultModal] = useState(false);
  const [showAddMinorModal, setShowAddMinorModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
  });
  const [adultForm, setAdultForm] = useState({
    first_name: '',
    last_name: '',
    fiscal_code: '',
    date_of_birth: '',
    place_of_birth: '',
    country_of_birth: 'Italia',
    gender: '' as '' | 'M' | 'F',
    email: '',
    phone: '',
    team_id: '',
    athlete_type: 'quota' as 'quota' | 'compensated', // quota = paga, compensated = riceve compenso
  });

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Minor form state
  const [minorForm, setMinorForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    birth_place: '',
    birth_province: '',
    country_of_birth: 'Italia',
    phone: '',
    team_id: '',
    fiscal_code: '',
    parent_email: '',
    second_parent_email: '',
    data_password: '',
  });
  const [calculatingMinorCF, setCalculatingMinorCF] = useState(false);

  const resetMinorForm = () => {
    setMinorForm({
      first_name: '', last_name: '', date_of_birth: '', gender: '',
      birth_place: '', birth_province: '', country_of_birth: 'Italia',
      phone: '', team_id: '', fiscal_code: '', parent_email: '', second_parent_email: '', data_password: '',
    });
  };

  const handleCalculateMinorCF = async () => {
    if (!minorForm.first_name || !minorForm.last_name || !minorForm.date_of_birth || !minorForm.gender || (!minorForm.birth_place && (!minorForm.country_of_birth || minorForm.country_of_birth.toUpperCase() === 'ITALIA'))) {
      showAlert('Dati mancanti', 'Compila Nome, Cognome, Data di Nascita, Sesso e Luogo di Nascita');
      return;
    }
    setCalculatingMinorCF(true);
    try {
      const res = await api.post('/utils/calcola-cf', {
        nome: minorForm.first_name,
        cognome: minorForm.last_name,
        data_nascita: minorForm.date_of_birth,
        luogo_nascita: minorForm.birth_place || minorForm.country_of_birth,
        sesso: minorForm.gender,
        stato_nascita: minorForm.country_of_birth,
      });
      if (res.data.success && res.data.codice_fiscale) {
        setMinorForm({ ...minorForm, fiscal_code: res.data.codice_fiscale });
      } else {
        showAlert('Errore', res.data.error || 'Impossibile calcolare il CF');
      }
    } catch (e: any) {
      showAlert('Errore', 'Errore nel calcolo del CF');
    } finally {
      setCalculatingMinorCF(false);
    }
  };

  const resetInviteForm = () => {
    setInviteForm({ email: '', first_name: '', last_name: '', is_minor: false, team_id: '' });
  };

  const handleInviteAthlete = async () => {
    if (!inviteForm.email) {
      showAlert('Errore', 'Inserisci l\'email dell\'atleta');
      return;
    }
    setSendingInvite(true);
    try {
      const response = await api.post('/athletes/invite', {
        email: inviteForm.email,
        first_name: inviteForm.first_name || undefined,
        last_name: inviteForm.last_name || undefined,
        is_minor: inviteForm.is_minor,
        team_id: inviteForm.team_id || undefined,
      });
      showAlert('Successo', response.data.message || `Invito inviato a ${inviteForm.email}`);
      setShowInviteModal(false);
      resetInviteForm();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore nell\'invio dell\'invito');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAddMinorAthlete = async () => {
    if (!minorForm.first_name || !minorForm.last_name || !minorForm.date_of_birth || !minorForm.parent_email || !minorForm.data_password) {
      showAlert('Errore', 'Compila tutti i campi obbligatori: Nome, Cognome, Data di nascita, Email genitore e Password dati');
      return;
    }
    // Parse date DD/MM/YYYY to YYYY-MM-DD
    const parts = minorForm.date_of_birth.split('/');
    if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
      showAlert('Errore', 'Data di nascita non valida (formato: gg/mm/aaaa)');
      return;
    }
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    
    setAddingAthlete(true);
    try {
      const res = await api.post('/athletes/minor', {
        first_name: minorForm.first_name.toUpperCase(),
        last_name: minorForm.last_name.toUpperCase(),
        date_of_birth: isoDate,
        gender: minorForm.gender || undefined,
        birth_place: minorForm.birth_place || undefined,
        birth_province: minorForm.birth_province || undefined,
        country_of_birth: minorForm.country_of_birth || 'Italia',
        phone: minorForm.phone || undefined,
        team_id: minorForm.team_id || undefined,
        fiscal_code: minorForm.fiscal_code || undefined,
        parent_email: minorForm.parent_email,
        second_parent_email: minorForm.second_parent_email || undefined,
        data_password: minorForm.data_password,
      });
      const msg = res.data.parent_existed 
        ? `Atleta minorenne registrato e collegato al genitore esistente.`
        : `Atleta minorenne registrato. Account genitore creato per ${minorForm.parent_email}`;
      showAlert('Successo', msg);
      setShowAddMinorModal(false);
      resetMinorForm();
      loadAthletes();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore nella registrazione');
    } finally {
      setAddingAthlete(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/athletes');
      await exportToExcel(response.data, 'Atleti');
      showAlert('Successo', 'File Excel esportato con successo');
    } catch (error: any) {
      showAlert('Errore', error.message || 'Errore durante l\'esportazione');
    } finally {
      setExporting(false);
    }
  };

  const resetAdultForm = () => {
    setAdultForm({
      first_name: '',
      last_name: '',
      fiscal_code: '',
      date_of_birth: '',
      place_of_birth: '',
      gender: '',
      email: '',
      phone: '',
      team_id: '',
      athlete_type: 'quota',
    });
  };

  const formatDateInput = (text: string): string => {
    let cleaned = text.replace(/[^0-9]/g, '');
    cleaned = cleaned.slice(0, 8);
    if (cleaned.length > 2) {
      cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 5) {
      cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
    }
    return cleaned;
  };

  const handleAddAdultAthlete = async () => {
    // Validazione semplificata - solo nome, cognome e email
    if (!adultForm.first_name.trim() || !adultForm.last_name.trim()) {
      showAlert('Errore', 'Nome e cognome sono obbligatori');
      return;
    }
    if (!adultForm.email.trim()) {
      showAlert('Errore', 'L\'email è obbligatoria per gli atleti maggiorenni');
      return;
    }

    // Verifica età solo se data fornita
    let isoDate = null;
    if (adultForm.date_of_birth && adultForm.date_of_birth.length === 10) {
      const parts = adultForm.date_of_birth.split('/');
      if (parts.length === 3) {
        const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const isAdult = age > 18 || (age === 18 && monthDiff >= 0);
        
        if (!isAdult) {
          showAlert('Errore', 'L\'atleta deve essere maggiorenne (18+ anni).\n\nPer i minorenni, usa la registrazione tramite genitore.');
          return;
        }
        isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    setAddingAthlete(true);
    try {
      await api.post('/athletes/adult', {
        first_name: adultForm.first_name.trim().toUpperCase(),
        last_name: adultForm.last_name.trim().toUpperCase(),
        email: adultForm.email.trim().toLowerCase(),
        fiscal_code: adultForm.fiscal_code.trim().toUpperCase() || null,
        date_of_birth: isoDate,
        phone: adultForm.phone.trim() || null,
        team_id: adultForm.team_id || null,
        athlete_type: adultForm.athlete_type,
      });

      showAlert('Successo', `${adultForm.first_name} ${adultForm.last_name} invitato/a con successo!\n\nL'atleta può ora registrarsi con l'email ${adultForm.email.trim().toLowerCase()}`);
      setShowAddAdultModal(false);
      resetAdultForm();
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setAddingAthlete(false);
    }
  };

  // Calculate Codice Fiscale
  const handleCalculateCF = async () => {
    const isEstero = adultForm.country_of_birth && adultForm.country_of_birth !== 'Italia' && adultForm.country_of_birth !== 'ITALIA';
    
    if (!adultForm.first_name || !adultForm.last_name || !adultForm.date_of_birth || !adultForm.gender) {
      showAlert('Dati mancanti', 'Compila Nome, Cognome, Sesso e Data di Nascita per calcolare il CF');
      return;
    }
    
    if (!isEstero && !adultForm.place_of_birth) {
      showAlert('Dati mancanti', 'Compila il Luogo di Nascita per calcolare il CF');
      return;
    }

    try {
      const luogoNascita = isEstero ? adultForm.country_of_birth : adultForm.place_of_birth;
      
      const response = await api.post('/utils/calcola-cf', {
        nome: adultForm.first_name,
        cognome: adultForm.last_name,
        data_nascita: adultForm.date_of_birth,
        luogo_nascita: luogoNascita,
        sesso: adultForm.gender,
      });

      if (response.data.success && response.data.codice_fiscale) {
        setAdultForm({...adultForm, fiscal_code: response.data.codice_fiscale});
        showAlert('Successo', `Codice Fiscale calcolato: ${response.data.codice_fiscale}`);
      } else {
        showAlert('Errore', response.data.error || 'Impossibile calcolare il CF. Verifica il luogo di nascita.');
      }
    } catch (error: any) {
      showAlert('Errore', 'Errore nel calcolo del Codice Fiscale');
    }
  };

  const loadData = async () => {
    try {
      const [athletesRes, teamsRes, codeRes] = await Promise.all([
        api.get('/athletes'),
        api.get('/teams'),
        api.get('/societies/invite-code').catch(() => ({ data: { invite_code: '', society_name: '' } })),
      ]);

      setAthletes(athletesRes.data);
      setInviteCode(codeRes.data.invite_code || '');
      setSocietyName(codeRes.data.society_name || '');
      
      const teamsMap: {[key: string]: Team} = {};
      teamsRes.data.forEach((team: Team) => {
        teamsMap[team.id] = team;
      });
      setTeams(teamsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getRegistrationLink = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    return `${baseUrl}/register?code=${inviteCode}`;
  };

  const getShareMessage = () => {
    return `Ciao! Per iscriverti alla ${societyName}, registrati qui:\n${getRegistrationLink()}\n\nInserisci il codice società: ${inviteCode}`;
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(getShareMessage());
      showAlert('Copiato!', 'Link e messaggio copiati negli appunti');
    } catch (e) {
      // Fallback for web
      try {
        if (Platform.OS === 'web' && navigator.clipboard) {
          await navigator.clipboard.writeText(getShareMessage());
          showAlert('Copiato!', 'Link e messaggio copiati negli appunti');
        } else {
          showAlert('Errore', 'Impossibile copiare. Copia il link manualmente.');
        }
      } catch {
        showAlert('Errore', 'Impossibile copiare. Copia il link manualmente.');
      }
    }
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(getShareMessage());
    const url = `https://wa.me/?text=${msg}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Get surname from athlete - uses last_name if available, otherwise extracts from full_name
  const getSurname = (athlete: Athlete) => {
    // If last_name field is available, use it
    if (athlete.last_name) {
      return athlete.last_name.trim();
    }
    // Otherwise, assume full_name is "Nome Cognome" and take the last word
    const parts = athlete.full_name.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

  // Sort and filter athletes
  const processedAthletes = useMemo(() => {
    let filtered = athletes;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = athletes.filter(a => 
        a.full_name.toLowerCase().includes(query) ||
        teams[a.team_id]?.name?.toLowerCase().includes(query)
      );
    }
    
    // Sort by surname alphabetically
    return filtered.sort((a, b) => {
      const surnameA = getSurname(a).toUpperCase();
      const surnameB = getSurname(b).toUpperCase();
      return surnameA.localeCompare(surnameB, 'it');
    });
  }, [athletes, searchQuery, teams]);

  // Group athletes by first letter of surname for sections
  const sections = useMemo(() => {
    const grouped: { [key: string]: Athlete[] } = {};
    
    processedAthletes.forEach(athlete => {
      const surname = getSurname(athlete);
      const firstLetter = surname.charAt(0).toUpperCase() || '#';
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(athlete);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'it'))
      .map(letter => ({
        title: letter,
        data: grouped[letter],
      }));
  }, [processedAthletes]);

  // Get available letters for sidebar
  const availableLetters = useMemo(() => {
    return sections.map(s => s.title);
  }, [sections]);

  const scrollToLetter = (letter: string) => {
    const sectionIndex = sections.findIndex(s => s.title === letter);
    if (sectionIndex !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    }
  };

  // Format name as "COGNOME Nome" for display
  const formatAthleteNameForDisplay = (athlete: Athlete) => {
    if (athlete.last_name && athlete.first_name) {
      return `${athlete.last_name.toUpperCase()} ${athlete.first_name}`;
    }
    // If no separate fields, try to reverse "Nome Cognome" to "COGNOME Nome"
    const parts = athlete.full_name.trim().split(' ');
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      const name = parts.slice(0, -1).join(' ');
      return `${surname.toUpperCase()} ${name}`;
    }
    return athlete.full_name;
  };

  const getStatusText = (item: Athlete) => {
    if (item.is_withdrawn) return 'Ritirato';
    if (item.status === 'trial') {
      return item.trial_start_date ? 'In prova' : 'In attesa';
    }
    return 'Attivo';
  };

  const getStatusColor = (item: Athlete) => {
    if (item.is_withdrawn) return '#FF3B30';
    if (item.status === 'trial') return '#FF9500';
    return '#34C759';
  };

  const renderAthleteItem = ({ item }: { item: Athlete }) => (
    <TouchableOpacity 
      style={[
        styles.athleteCard,
        item.is_withdrawn && styles.athleteCardWithdrawn,
        (item as any).athlete_type === 'compensated' && styles.athleteCardCompensated
      ]}
      onPress={() => router.push(`/admin/athlete/${item.id}`)}
      data-testid={`athlete-card-${item.id}`}
    >
      {/* Compensated Badge - PRO indicator */}
      {(item as any).athlete_type === 'compensated' && (
        <View style={styles.compensatedBadge}>
          <Text style={styles.compensatedBadgeText}>PRO</Text>
        </View>
      )}
      <View style={styles.athleteInfo}>
        <View style={styles.athleteNameRow}>
          <Text style={[
            styles.athleteName,
            item.is_withdrawn && styles.athleteNameWithdrawn,
            (item as any).athlete_type === 'compensated' && styles.athleteNameCompensated
          ]} numberOfLines={1}>
            {formatAthleteNameForDisplay(item)}
          </Text>
          {(item as any).athlete_code && (item as any).athlete_code.includes('ADULT') && (
            <Text style={styles.athleteCode}>{(item as any).athlete_code}</Text>
          )}
          {(item as any).has_overpayment && (
            <View style={styles.overpaymentBadge}>
              <Text style={styles.overpaymentBadgeText}>⚠️ {formatCurrency(Math.abs((item as any).payment_residual))}</Text>
            </View>
          )}
        </View>
        <Text style={[
          styles.teamName,
          (item as any).athlete_type === 'compensated' && styles.teamNameCompensated
        ]} numberOfLines={1}>
          {teams[item.team_id]?.name || '-'}
          {(item as any).athlete_type === 'compensated' && ' • Retribuito'}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor(item) }]}>
          {getStatusText(item)}
        </Text>
      </View>
      <Text style={{ fontSize: 18, color: '#ccc' }}>›</Text>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Atleti ({processedAthletes.length})</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca atleta o squadra..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ fontSize: 18, color: '#999' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Share Registration Link Button */}
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <TouchableOpacity 
          style={{ backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onPress={() => setShowShareLink(!showShareLink)}
          data-testid="share-link-btn"
        >
          <Ionicons name="share-social" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Condividi Link Registrazione</Text>
        </TouchableOpacity>
        
        {showShareLink && (
          <View style={{ backgroundColor: '#f5f7fa', borderRadius: 8, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#e0e0e0' }}>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              Condividi questo link per far registrare nuovi atleti o genitori alla {societyName}:
            </Text>
            <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: '#333', fontFamily: 'monospace' }} selectable>{getRegistrationLink()}</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>
              Codice società: <Text style={{ fontWeight: '700', color: '#333' }}>{inviteCode}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onPress={handleCopyLink}
                data-testid="copy-link-btn"
              >
                <Ionicons name="copy" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Copia</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#25D366', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onPress={handleShareWhatsApp}
                data-testid="share-whatsapp-btn"
              >
                <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      
      {/* Invite Single Person Button */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TouchableOpacity 
          style={{ backgroundColor: '#007AFF', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onPress={() => setShowInviteModal(true)}
          data-testid="invite-person-btn"
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Invita Persona</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Athletes List */}
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderAthleteItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 48, color: '#ccc' }}>👥</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nessun risultato' : 'Nessun atleta registrato'}
              </Text>
            </View>
          }
          getItemLayout={(data, index) => ({
            length: 56,
            offset: 56 * index,
            index,
          })}
          onScrollToIndexFailed={() => {}}
        />

        {/* Alphabet Sidebar */}
        {!searchQuery && processedAthletes.length > 10 && (
          <View style={styles.alphabetSidebar}>
            {ALPHABET.map((letter) => {
              const isAvailable = availableLetters.includes(letter);
              return (
                <TouchableOpacity
                  key={letter}
                  style={styles.alphabetItem}
                  onPress={() => isAvailable && scrollToLetter(letter)}
                  disabled={!isAvailable}
                >
                  <Text style={[
                    styles.alphabetText,
                    !isAvailable && styles.alphabetTextDisabled
                  ]}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Modal Aggiungi Atleta Maggiorenne */}
      <Modal
        visible={showAddAdultModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddAdultModal(false);
          resetAdultForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invita Atleta Maggiorenne</Text>
              <TouchableOpacity onPress={() => {
                setShowAddAdultModal(false);
                resetAdultForm();
              }}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Tipo Atleta - Scelta principale */}
              <View style={styles.athleteTypeSection}>
                <Text style={styles.sectionLabel}>Tipo Atleta</Text>
                <View style={styles.athleteTypeButtons}>
                  <TouchableOpacity 
                    style={[
                      styles.athleteTypeBtn,
                      adultForm.athlete_type === 'quota' && styles.athleteTypeBtnActive
                    ]}
                    onPress={() => setAdultForm({...adultForm, athlete_type: 'quota'})}
                  >
                    <Ionicons 
                      name="card" 
                      size={16} 
                      color={adultForm.athlete_type === 'quota' ? '#fff' : '#007AFF'} 
                    />
                    <Text style={[
                      styles.athleteTypeBtnText,
                      adultForm.athlete_type === 'quota' && styles.athleteTypeBtnTextActive
                    ]}>Paga Quota</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.athleteTypeBtn,
                      adultForm.athlete_type === 'compensated' && styles.athleteTypeBtnActiveGold
                    ]}
                    onPress={() => setAdultForm({...adultForm, athlete_type: 'compensated'})}
                  >
                    <Ionicons 
                      name="trophy" 
                      size={16} 
                      color={adultForm.athlete_type === 'compensated' ? '#fff' : '#B8860B'} 
                    />
                    <Text style={[
                      styles.athleteTypeBtnText,
                      adultForm.athlete_type === 'compensated' && styles.athleteTypeBtnTextActive
                    ]}>Retribuito (PRO)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dati Essenziali */}
              <Text style={styles.sectionLabel}>Dati Atleta</Text>
              
              <Text style={styles.inputLabel}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={adultForm.first_name}
                onChangeText={(v) => setAdultForm({...adultForm, first_name: v})}
                placeholder="Nome"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Cognome *</Text>
              <TextInput
                style={styles.input}
                value={adultForm.last_name}
                onChangeText={(v) => setAdultForm({...adultForm, last_name: v})}
                placeholder="Cognome"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={adultForm.email}
                onChangeText={(v) => setAdultForm({...adultForm, email: v.toLowerCase()})}
                placeholder="email@esempio.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Sezione Codice Fiscale */}
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Codice Fiscale (opzionale)</Text>
              
              <Text style={styles.inputLabel}>Sesso</Text>
              <View style={styles.genderButtons}>
                <TouchableOpacity 
                  style={[styles.genderBtn, adultForm.gender === 'M' && styles.genderBtnActive]}
                  onPress={() => setAdultForm({...adultForm, gender: 'M'})}
                >
                  <Text style={[styles.genderBtnText, adultForm.gender === 'M' && styles.genderBtnTextActive]}>M</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderBtn, adultForm.gender === 'F' && styles.genderBtnActive]}
                  onPress={() => setAdultForm({...adultForm, gender: 'F'})}
                >
                  <Text style={[styles.genderBtnText, adultForm.gender === 'F' && styles.genderBtnTextActive]}>F</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Data di Nascita</Text>
              <TextInput
                style={styles.input}
                value={adultForm.date_of_birth}
                onChangeText={(v) => setAdultForm({...adultForm, date_of_birth: formatDateInput(v)})}
                placeholder="GG/MM/AAAA"
                placeholderTextColor="#999"
                maxLength={10}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Stato di Nascita</Text>
              <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 12, backgroundColor: '#fff' }}>
                <Picker
                  selectedValue={adultForm.country_of_birth}
                  onValueChange={(value) => {
                    const updates: any = { country_of_birth: value };
                    if (value !== 'Italia' && value !== 'ITALIA') {
                      updates.place_of_birth = '';
                    }
                    setAdultForm({...adultForm, ...updates});
                  }}
                  style={{ height: 50, color: '#333' }}
                >
                  {COUNTRIES.map((country) => (
                    <Picker.Item key={country} label={country} value={country} />
                  ))}
                </Picker>
              </View>

              {(!adultForm.country_of_birth || adultForm.country_of_birth === 'Italia' || adultForm.country_of_birth === 'ITALIA') && (
              <>
              <Text style={styles.inputLabel}>Luogo di Nascita (Comune)</Text>
              <TextInput
                style={styles.input}
                value={adultForm.place_of_birth}
                onChangeText={(v) => setAdultForm({...adultForm, place_of_birth: v})}
                placeholder="Es: Roma, Perugia, Milano..."
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
              </>
              )}

              <Text style={styles.inputLabel}>Codice Fiscale</Text>
              <View style={styles.cfCalculateRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={adultForm.fiscal_code}
                  onChangeText={(v) => setAdultForm({...adultForm, fiscal_code: v.toUpperCase()})}
                  placeholder="CODICE FISCALE"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  maxLength={16}
                />
                <TouchableOpacity 
                  style={[styles.calculateCfBtn, { opacity: (!adultForm.gender || !adultForm.date_of_birth || !adultForm.first_name || !adultForm.last_name || ((!adultForm.country_of_birth || adultForm.country_of_birth === 'Italia' || adultForm.country_of_birth === 'ITALIA') && !adultForm.place_of_birth)) ? 0.5 : 1 }]}
                  onPress={handleCalculateCF}
                  disabled={!adultForm.gender || !adultForm.date_of_birth || !adultForm.first_name || !adultForm.last_name || ((!adultForm.country_of_birth || adultForm.country_of_birth === 'Italia' || adultForm.country_of_birth === 'ITALIA') && !adultForm.place_of_birth)}
                >
                  <Ionicons name="calculator" size={18} color="#fff" />
                  <Text style={styles.calculateCfBtnText}>CF</Text>
                </TouchableOpacity>
              </View>

              {/* Squadra - opzionale */}
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Squadra (opzionale)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={adultForm.team_id}
                  onValueChange={(v) => setAdultForm({...adultForm, team_id: v})}
                  style={styles.picker}
                >
                  <Picker.Item label="Assegna dopo..." value="" />
                  {Object.values(teams).map((team) => (
                    <Picker.Item key={team.id} label={team.name} value={team.id} />
                  ))}
                </Picker>
              </View>

              {/* Info box */}
              <View style={[
                styles.infoBox,
                adultForm.athlete_type === 'compensated' && styles.infoBoxGold
              ]}>
                <Ionicons 
                  name="information-circle" 
                  size={20} 
                  color={adultForm.athlete_type === 'compensated' ? '#B8860B' : '#007AFF'} 
                />
                <Text style={styles.infoBoxText}>
                  L'atleta riceverà un invito e potrà registrarsi autonomamente con questa email. 
                  {adultForm.athlete_type === 'compensated' 
                    ? ' Sarà automaticamente riconosciuto come atleta PRO.'
                    : ''
                  }
                </Text>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAddAdultModal(false);
                  resetAdultForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.saveBtn,
                  adultForm.athlete_type === 'compensated' && styles.saveBtnGold
                ]}
                onPress={handleAddAdultAthlete}
                disabled={addingAthlete}
              >
                {addingAthlete ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Registra</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Aggiungi Atleta Minorenne */}
      <Modal
        visible={showAddMinorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowAddMinorModal(false); resetMinorForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Registra Atleta Minorenne</Text>
              <Text style={{ color: '#666', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
                L'atleta sarà collegato al genitore tramite email
              </Text>
              
              <Text style={styles.inputLabel}>Nome *</Text>
              <TextInput style={styles.modalInput} value={minorForm.first_name} onChangeText={v => setMinorForm({...minorForm, first_name: v})} placeholder="Nome" autoCapitalize="characters" />
              
              <Text style={styles.inputLabel}>Cognome *</Text>
              <TextInput style={styles.modalInput} value={minorForm.last_name} onChangeText={v => setMinorForm({...minorForm, last_name: v})} placeholder="Cognome" autoCapitalize="characters" />
              
              <Text style={styles.inputLabel}>Data di Nascita * (gg/mm/aaaa)</Text>
              <TextInput style={styles.modalInput} value={minorForm.date_of_birth} onChangeText={v => setMinorForm({...minorForm, date_of_birth: formatDateInput(v)})} placeholder="gg/mm/aaaa" keyboardType="number-pad" maxLength={10} />
              
              <Text style={styles.inputLabel}>Sesso *</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity style={[styles.genderBtn, minorForm.gender === 'M' && styles.genderBtnActive]} onPress={() => setMinorForm({...minorForm, gender: 'M'})}>
                  <Text style={[styles.genderBtnText, minorForm.gender === 'M' && styles.genderBtnTextActive]}>M</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genderBtn, minorForm.gender === 'F' && styles.genderBtnActive]} onPress={() => setMinorForm({...minorForm, gender: 'F'})}>
                  <Text style={[styles.genderBtnText, minorForm.gender === 'F' && styles.genderBtnTextActive]}>F</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Stato di Nascita</Text>
              <TextInput style={styles.modalInput} value={minorForm.country_of_birth} onChangeText={v => setMinorForm({...minorForm, country_of_birth: v.toUpperCase()})} placeholder="es: ITALIA" autoCapitalize="characters" />
              
              {(!minorForm.country_of_birth || minorForm.country_of_birth.toUpperCase() === 'ITALIA') && (
              <>
              <Text style={styles.inputLabel}>Luogo di Nascita</Text>
              <TextInput style={styles.modalInput} value={minorForm.birth_place} onChangeText={v => setMinorForm({...minorForm, birth_place: v.toUpperCase()})} placeholder="es: PERUGIA" autoCapitalize="characters" />
              
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Prov.</Text>
                  <TextInput style={styles.modalInput} value={minorForm.birth_province} onChangeText={v => setMinorForm({...minorForm, birth_province: v.toUpperCase()})} placeholder="PG" autoCapitalize="characters" maxLength={2} />
                </View>
              </View>
              </>
              )}
              
              <Text style={styles.inputLabel}>Codice Fiscale</Text>
              <View style={styles.cfCalculateRow}>
                <TextInput style={[styles.modalInput, { flex: 1, marginBottom: 0 }]} value={minorForm.fiscal_code} onChangeText={v => setMinorForm({...minorForm, fiscal_code: v.toUpperCase()})} placeholder="Codice Fiscale" autoCapitalize="characters" maxLength={16} />
                <TouchableOpacity
                  style={[styles.calculateCfBtn, { opacity: (!minorForm.gender || !minorForm.date_of_birth || !minorForm.first_name || !minorForm.last_name || (!minorForm.birth_place && (!minorForm.country_of_birth || minorForm.country_of_birth.toUpperCase() === 'ITALIA'))) ? 0.5 : 1 }]}
                  onPress={handleCalculateMinorCF}
                  disabled={calculatingMinorCF || !minorForm.gender || !minorForm.date_of_birth || !minorForm.first_name || !minorForm.last_name || (!minorForm.birth_place && (!minorForm.country_of_birth || minorForm.country_of_birth.toUpperCase() === 'ITALIA'))}
                >
                  {calculatingMinorCF ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="calculator" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>CF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Squadra</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={minorForm.team_id} onValueChange={v => setMinorForm({...minorForm, team_id: v})} style={styles.picker}>
                  <Picker.Item label="-- Seleziona squadra --" value="" />
                  {Object.values(teams).map((t: any) => <Picker.Item key={t.id} label={t.name} value={t.id} />)}
                </Picker>
              </View>
              
              <Text style={styles.inputLabel}>Telefono</Text>
              <TextInput style={styles.modalInput} value={minorForm.phone} onChangeText={v => setMinorForm({...minorForm, phone: v})} placeholder="Telefono" keyboardType="phone-pad" />
              
              <View style={{ backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1565C0', marginBottom: 8 }}>Dati Genitore/Tutore</Text>
                
                <Text style={styles.inputLabel}>Email Genitore *</Text>
                <TextInput style={styles.modalInput} value={minorForm.parent_email} onChangeText={v => setMinorForm({...minorForm, parent_email: v})} placeholder="email@genitore.com" keyboardType="email-address" autoCapitalize="none" />
                <Text style={{ color: '#888', fontSize: 11, marginTop: -4, marginBottom: 8 }}>Se il genitore non ha ancora un account, verrà creato automaticamente</Text>
                
                <Text style={styles.inputLabel}>Email Secondo Genitore</Text>
                <TextInput style={styles.modalInput} value={minorForm.second_parent_email} onChangeText={v => setMinorForm({...minorForm, second_parent_email: v})} placeholder="email@secondogenitore.com" keyboardType="email-address" autoCapitalize="none" />
                <Text style={{ color: '#888', fontSize: 11, marginTop: -4 }}>Se il secondo genitore si registra con questa email, vedrà automaticamente questo atleta</Text>
              </View>
              
              <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#E65100', marginBottom: 8 }}>Protezione Dati</Text>
                
                <Text style={styles.inputLabel}>Password Dati *</Text>
                <TextInput style={styles.modalInput} value={minorForm.data_password} onChangeText={v => setMinorForm({...minorForm, data_password: v})} placeholder="Password per proteggere i dati" secureTextEntry />
                <Text style={{ color: '#888', fontSize: 11, marginTop: -4 }}>Il genitore dovrà inserirla per modificare i dati del minore</Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddMinorModal(false); resetMinorForm(); }}>
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddMinorAthlete} disabled={addingAthlete}>
                {addingAthlete ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Registra</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Invita Persona via Email */}
      <Modal
        visible={showInviteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setShowInviteModal(false); resetInviteForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400, padding: 0, overflow: 'hidden' }]}>
              {/* Header blu */}
              <View style={{ backgroundColor: '#007AFF', paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-add" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Invita Persona</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                    Riceverà un'email con il link per registrarsi
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setShowInviteModal(false); resetInviteForm(); }}>
                  <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#007AFF', textTransform: 'uppercase', marginBottom: 6 }}>Email *</Text>
                <TextInput
                  style={{ backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 14 }}
                  placeholder="nome@email.com"
                  placeholderTextColor="#aaa"
                  value={inviteForm.email}
                  onChangeText={(v) => setInviteForm({...inviteForm, email: v.toLowerCase()})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  data-testid="invite-email-input"
                />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#007AFF', textTransform: 'uppercase', marginBottom: 6 }}>Nome</Text>
                    <TextInput
                      style={{ backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0' }}
                      placeholder="Opzionale"
                      placeholderTextColor="#aaa"
                      value={inviteForm.first_name}
                      onChangeText={(v) => setInviteForm({...inviteForm, first_name: v})}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#007AFF', textTransform: 'uppercase', marginBottom: 6 }}>Cognome</Text>
                    <TextInput
                      style={{ backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0' }}
                      placeholder="Opzionale"
                      placeholderTextColor="#aaa"
                      value={inviteForm.last_name}
                      onChangeText={(v) => setInviteForm({...inviteForm, last_name: v})}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: inviteForm.is_minor ? '#FFF3E0' : '#F5F5F5', borderRadius: 10, borderWidth: 1, borderColor: inviteForm.is_minor ? '#FF9800' : '#E0E0E0' }}
                  onPress={() => setInviteForm({...inviteForm, is_minor: !inviteForm.is_minor})}
                  data-testid="invite-minor-toggle"
                >
                  <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#FF9800', alignItems: 'center', justifyContent: 'center', backgroundColor: inviteForm.is_minor ? '#FF9800' : 'transparent' }}>
                    {inviteForm.is_minor && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                  <Text style={{ fontSize: 13, color: '#555', flex: 1 }}>Minorenne (email inviata al genitore)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...(sendingInvite ? { opacity: 0.6 } : {}) }}
                  onPress={handleInviteAthlete}
                  disabled={sendingInvite}
                  data-testid="send-invite-btn"
                >
                  {sendingInvite ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Invia Invito</Text>
                    </>
                  )}
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
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: '#000',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    paddingRight: 30,
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  athleteCard: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  miniQrCode: {
    width: 36,
    height: 36,
    marginRight: 10,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  athleteCardWithdrawn: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  athleteCardCompensated: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#B8860B',
  },
  compensatedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  compensatedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  athleteInfo: {
    flex: 1,
    marginRight: 8,
  },
  athleteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  athleteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  athleteNameCompensated: {
    color: '#8B6914',
  },
  athleteCode: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF6B00',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overpaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  overpaymentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF3B30',
  },
  athleteNameWithdrawn: {
    color: '#FF3B30',
    textDecorationLine: 'line-through',
  },
  teamName: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  teamNameCompensated: {
    color: '#B8860B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  alphabetSidebar: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  alphabetItem: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  alphabetText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007AFF',
  },
  alphabetTextDisabled: {
    color: '#ddd',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  // FAB Styles
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  // Form Styles
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pickerContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  // Athlete Type Selection
  athleteTypeSection: {
    marginBottom: 20,
  },
  athleteTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  athleteTypeBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    gap: 4,
  },
  athleteTypeBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  athleteTypeBtnActiveGold: {
    backgroundColor: '#B8860B',
    borderColor: '#B8860B',
  },
  athleteTypeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  athleteTypeBtnTextActive: {
    color: '#fff',
  },
  athleteTypeBtnHint: {
    fontSize: 11,
    color: '#999',
  },
  athleteTypeBtnHintActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoBoxGold: {
    backgroundColor: '#FFF8DC',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  // Codice Fiscale Form
  cfRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  genderBtn: {
    width: 48,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  genderBtnTextActive: {
    color: '#fff',
  },
  cfCalculateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calculateCfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    gap: 6,
  },
  calculateCfBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Buttons
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnGold: {
    backgroundColor: '#B8860B',
  },
  saveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
