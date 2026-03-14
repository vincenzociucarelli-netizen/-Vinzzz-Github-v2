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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
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
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    is_minor: false,
    team_id: '',
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
    phone: '',
    team_id: '',
    fiscal_code: '',
    parent_email: '',
    second_parent_email: '',
    data_password: '',
  });

  const resetMinorForm = () => {
    setMinorForm({
      first_name: '', last_name: '', date_of_birth: '', gender: '',
      phone: '', team_id: '', fiscal_code: '', parent_email: '', second_parent_email: '', data_password: '',
    });
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
      await api.post('/athletes/invite', {
        email: inviteForm.email,
        first_name: inviteForm.first_name || undefined,
        last_name: inviteForm.last_name || undefined,
        is_minor: inviteForm.is_minor,
        team_id: inviteForm.team_id || undefined,
      });
      showAlert('Successo', `Invito inviato a ${inviteForm.email}. L'atleta riceverà un'email con il link per completare la registrazione.`);
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
      const [athletesRes, teamsRes] = await Promise.all([
        api.get('/athletes'),
        api.get('/teams'),
      ]);

      setAthletes(athletesRes.data);
      
      const teamsMap: {[key: string]: Team} = {};
      teamsRes.data.forEach((team: Team) => {
        teamsMap[team.id] = team;
      });
      setTeams(teamsMap);
    } catch (error) {
      console.error('Error loading data:', error);
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
    if (item.status === 'trial') return 'In prova';
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

      {/* Add Athlete Buttons */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4, gap: 8 }}>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onPress={() => setShowAddAdultModal(true)}
          data-testid="add-adult-athlete-btn"
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Maggiorenne</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: '#FF9800', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onPress={() => setShowAddMinorModal(true)}
          data-testid="add-minor-athlete-btn"
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Minorenne</Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TouchableOpacity 
          style={{ backgroundColor: '#4CAF50', paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onPress={() => setShowInviteModal(true)}
          data-testid="invite-athlete-btn"
        >
          <Ionicons name="mail" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Invita via Email</Text>
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
                      size={24} 
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
                      size={24} 
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
              
              <View style={styles.cfRow}>
                <View style={{ flex: 1 }}>
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
                </View>
                <View style={{ flex: 2, marginLeft: 12 }}>
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
                </View>
              </View>

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

              <View style={styles.cfCalculateRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={adultForm.fiscal_code}
                  onChangeText={(v) => setAdultForm({...adultForm, fiscal_code: v.toUpperCase()})}
                  placeholder="CODICE FISCALE"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  maxLength={16}
                />
                <TouchableOpacity 
                  style={styles.calculateCfBtn}
                  onPress={handleCalculateCF}
                  disabled={!adultForm.gender || !adultForm.date_of_birth || !adultForm.first_name || !adultForm.last_name || ((!adultForm.country_of_birth || adultForm.country_of_birth === 'Italia' || adultForm.country_of_birth === 'ITALIA') && !adultForm.place_of_birth)}
                >
                  <Ionicons name="calculator" size={20} color="#fff" />
                  <Text style={styles.calculateCfBtnText}>Calcola</Text>
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
              
              <Text style={styles.inputLabel}>Sesso</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity style={[styles.genderBtn, minorForm.gender === 'M' && styles.genderBtnActive]} onPress={() => setMinorForm({...minorForm, gender: 'M'})}>
                  <Text style={[styles.genderBtnText, minorForm.gender === 'M' && styles.genderBtnTextActive]}>M</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genderBtn, minorForm.gender === 'F' && styles.genderBtnActive]} onPress={() => setMinorForm({...minorForm, gender: 'F'})}>
                  <Text style={[styles.genderBtnText, minorForm.gender === 'F' && styles.genderBtnTextActive]}>F</Text>
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
              
              <Text style={styles.inputLabel}>Codice Fiscale</Text>
              <TextInput style={styles.modalInput} value={minorForm.fiscal_code} onChangeText={v => setMinorForm({...minorForm, fiscal_code: v.toUpperCase()})} placeholder="Codice Fiscale" autoCapitalize="characters" maxLength={16} />
              
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

      {/* Modal Invita Atleta via Email */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowInviteModal(false); resetInviteForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Invita Atleta via Email</Text>
              <Text style={{ color: '#666', fontSize: 13, marginBottom: 16, lineHeight: 19 }}>
                L'atleta riceverà un'email con un link per completare la registrazione autonomamente.
              </Text>

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Email dell'atleta (o genitore)"
                value={inviteForm.email}
                onChangeText={(v) => setInviteForm({...inviteForm, email: v})}
                keyboardType="email-address"
                autoCapitalize="none"
                data-testid="invite-email-input"
              />

              <Text style={styles.inputLabel}>Nome (opzionale)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome"
                value={inviteForm.first_name}
                onChangeText={(v) => setInviteForm({...inviteForm, first_name: v})}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Cognome (opzionale)</Text>
              <TextInput
                style={styles.input}
                placeholder="Cognome"
                value={inviteForm.last_name}
                onChangeText={(v) => setInviteForm({...inviteForm, last_name: v})}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}
                onPress={() => setInviteForm({...inviteForm, is_minor: !inviteForm.is_minor})}
                data-testid="invite-minor-toggle"
              >
                <View style={[{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#FF9800', alignItems: 'center', justifyContent: 'center' }, inviteForm.is_minor && { backgroundColor: '#FF9800' }]}>
                  {inviteForm.is_minor && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={{ fontSize: 14, color: '#333' }}>Atleta minorenne (l'email verrà inviata al genitore)</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Squadra (opzionale)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={inviteForm.team_id}
                  onValueChange={(v) => setInviteForm({...inviteForm, team_id: v})}
                  style={styles.picker}
                >
                  <Picker.Item label="-- Nessuna squadra --" value="" />
                  {Object.values(teams).map((t: any) => (
                    <Picker.Item key={t.id} label={t.name} value={t.id} />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#4CAF50', marginTop: 8 }, sendingInvite && { opacity: 0.5 }]}
                onPress={handleInviteAthlete}
                disabled={sendingInvite}
                data-testid="send-invite-btn"
              >
                {sendingInvite ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mail" size={18} color="#fff" />
                    <Text style={styles.modalBtnText}>Invia Invito</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#999', marginTop: 8 }]}
                onPress={() => { setShowInviteModal(false); resetInviteForm(); }}
              >
                <Text style={styles.modalBtnText}>Annulla</Text>
              </TouchableOpacity>
            </ScrollView>
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    gap: 8,
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
