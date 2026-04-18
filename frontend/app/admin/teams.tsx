import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { Team } from '../../src/types';
import { useAuthStore } from '../../src/store/authStore';
import { SportIcon } from '../../src/components/SportIcon';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
export default function TeamsScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [athletesCounts, setAthletesCounts] = useState<{[key: string]: number}>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sportImage, setSportImage] = useState<string | null>(null);
  const [availableVenues, setAvailableVenues] = useState<{name: string, address: string, city: string}[]>([]);
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);
  const [venuePickerTarget, setVenuePickerTarget] = useState<{type: 'training' | 'match' | 'rifinitura', index?: number} | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrimaSquadra, setIsPrimaSquadra] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [installments, setInstallments] = useState<{name: string, amount: string, due_date: string}[]>([
    { name: 'Iscrizione', amount: '', due_date: '' },
  ]);
  const [bankInfo, setBankInfo] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [championships, setChampionships] = useState('');
  const [calendarLink, setCalendarLink] = useState('');
  
  // Training schedule - structured format
  const [trainings, setTrainings] = useState([
    { day: '', timeStart: '', timeEnd: '', venue: '' },
    { day: '', timeStart: '', timeEnd: '', venue: '' },
  ]);
  const [matchDay, setMatchDay] = useState({ day: '', time: '', venue: '' });
  const [rifinitura, setRifinitura] = useState({ enabled: false, timeStart: '', timeEnd: '', venue: '' });
  
  // Day picker modal state
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [dayPickerTarget, setDayPickerTarget] = useState<{type: 'training' | 'match', index?: number} | null>(null);
  
  // Delete confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  
  // Open day picker for training
  const openDayPickerForTraining = (index: number) => {
    setDayPickerTarget({ type: 'training', index });
    setDayPickerVisible(true);
  };
  
  // Open day picker for match day
  const openDayPickerForMatch = () => {
    setDayPickerTarget({ type: 'match' });
    setDayPickerVisible(true);
  };
  
  // Handle day selection
  const handleDaySelect = (day: string) => {
    if (dayPickerTarget?.type === 'training' && dayPickerTarget.index !== undefined) {
      updateTraining(dayPickerTarget.index, 'day', day);
    } else if (dayPickerTarget?.type === 'match') {
      setMatchDay({...matchDay, day: day});
    }
    setDayPickerVisible(false);
    setDayPickerTarget(null);
  };

  // Venue picker functions
  const openVenuePickerForTraining = (index: number) => {
    setVenuePickerTarget({ type: 'training', index });
    setVenuePickerVisible(true);
  };
  const openVenuePickerForMatch = () => {
    setVenuePickerTarget({ type: 'match' });
    setVenuePickerVisible(true);
  };
  const openVenuePickerForRifinitura = () => {
    setVenuePickerTarget({ type: 'rifinitura' });
    setVenuePickerVisible(true);
  };
  const handleVenueSelect = (venueName: string) => {
    if (venuePickerTarget?.type === 'training' && venuePickerTarget.index !== undefined) {
      updateTraining(venuePickerTarget.index, 'venue', venueName);
    } else if (venuePickerTarget?.type === 'match') {
      setMatchDay({...matchDay, venue: venueName});
    } else if (venuePickerTarget?.type === 'rifinitura') {
      setRifinitura({...rifinitura, venue: venueName});
    }
    setVenuePickerVisible(false);
    setVenuePickerTarget(null);
  };
  
  const addTraining = () => {
    if (trainings.length < 10) {
      setTrainings([...trainings, { day: '', timeStart: '', timeEnd: '', venue: '' }]);
    }
  };
  
  const removeTraining = (index: number) => {
    if (trainings.length > 2) {
      const newTrainings = trainings.filter((_, i) => i !== index);
      setTrainings(newTrainings);
    }
  };
  
  // Helper function to format time as HH:mm
  const formatTimeInput = (text: string): string => {
    // Remove all non-numeric characters
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // Limit to 4 digits
    cleaned = cleaned.slice(0, 4);
    
    // Add : after first 2 digits if we have more than 2
    if (cleaned.length > 2) {
      cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
    }
    
    return cleaned;
  };

  const updateTraining = (index: number, field: string, value: string) => {
    const newTrainings = [...trainings];
    // Apply time formatting for time fields
    if (field === 'timeStart' || field === 'timeEnd') {
      value = formatTimeInput(value);
    }
    newTrainings[index] = { ...newTrainings[index], [field]: value };
    setTrainings(newTrainings);
  };
  
  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', onPress: async () => { await logout(); router.replace('/login'); } },
      ]);
    }
  };

  // Team priority order (from most important to least important)
  const TEAM_PRIORITY_ORDER = [
    'Serie A/1', 'Serie A/2', 'Serie A/3',
    'Serie B/1', 'Serie B/2',
    'Serie C', 'Serie D',
    '1° Div.', '2° Div.',
    'U.19', 'U.18', 'U.17', 'U.16', 'U.15', 'U.14', 'U.13', 'U.12',
    'Under 19', 'Under 18', 'Under 17', 'Under 16', 'Under 15', 'Under 14', 'Under 13', 'Under 12',
    'MiniVolley', 'Minivolley', 'Mini Volley',
    'Starter', 'CSI'
  ];

  const getTeamPriority = (teamName: string): number => {
    const nameLower = teamName.toLowerCase();
    
    // Check exact matches first (case insensitive)
    for (let i = 0; i < TEAM_PRIORITY_ORDER.length; i++) {
      if (nameLower === TEAM_PRIORITY_ORDER[i].toLowerCase()) {
        return i;
      }
    }
    
    // Check if team name contains any priority keyword
    for (let i = 0; i < TEAM_PRIORITY_ORDER.length; i++) {
      const keyword = TEAM_PRIORITY_ORDER[i].toLowerCase();
      if (nameLower.includes(keyword) || keyword.includes(nameLower.split(' ')[0])) {
        return i;
      }
    }
    
    // Check for patterns like "B/1", "A/2", etc.
    const serieMatch = nameLower.match(/serie\s*([abc])[\s\/]*(\d)?/i) || 
                       nameLower.match(/^([abc])[\s\/]*(\d)/i);
    if (serieMatch) {
      const letter = serieMatch[1].toUpperCase();
      const num = serieMatch[2] || '1';
      const serieKey = `Serie ${letter}/${num}`;
      const idx = TEAM_PRIORITY_ORDER.findIndex(p => p === serieKey);
      if (idx >= 0) return idx;
    }
    
    // Check for "Under X" or "U.X" patterns
    const underMatch = nameLower.match(/under\s*(\d+)/i) || nameLower.match(/u\.?\s*(\d+)/i);
    if (underMatch) {
      const age = parseInt(underMatch[1]);
      // Map age to priority (19 is highest, 12 is lowest among under categories)
      const underPriorities: {[key: number]: number} = {19: 9, 18: 10, 17: 11, 16: 12, 15: 13, 14: 14, 13: 15, 12: 16};
      if (underPriorities[age] !== undefined) {
        return underPriorities[age];
      }
    }
    
    // Default: put at the end
    return 999;
  };

  const sortTeams = (teamsToSort: Team[]): Team[] => {
    return [...teamsToSort].sort((a, b) => {
      const priorityA = getTeamPriority(a.name);
      const priorityB = getTeamPriority(b.name);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // If same priority, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  const loadTeams = async () => {
    try {
      const [teamsRes, countsRes, societyRes] = await Promise.all([
        api.get('/teams'),
        api.get('/teams/athletes-count/all'),
        api.get('/settings/society'),
      ]);
      // Sort teams by priority
      const sortedTeams = sortTeams(teamsRes.data);
      setTeams(sortedTeams);
      setAthletesCounts(countsRes.data);
      setSportImage(societyRes.data.sport_image || null);
      setAvailableVenues(societyRes.data.venues || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPrimaSquadra(false);
    setTotalAmount('');
    setInstallments([{ name: 'Iscrizione', amount: '', due_date: '' }]);
    setBankInfo('');
    setPaypalEmail('');
    setTrainings([
      { day: '', timeStart: '', timeEnd: '', venue: '' },
      { day: '', timeStart: '', timeEnd: '', venue: '' },
    ]);
    setMatchDay({ day: '', time: '', venue: '' });
    setRifinitura({ enabled: false, timeStart: '', timeEnd: '', venue: '' });
    setChampionships('');
    setCalendarLink('');
  };

  const showAlert = (title: string, message?: string) => {
    if (Platform.OS === 'web') {
      window.alert(message ? `${title}: ${message}` : title);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleCreateTeam = async () => {
    if (!name.trim()) {
      showAlert('Errore', 'Inserisci il nome della squadra');
      return;
    }

    // Validate trainings (at least 2 complete)
    const validTrainings = trainings.filter(t => t.day && t.timeStart && t.timeEnd && t.venue);
    if (validTrainings.length < 2) {
      showAlert('Errore', 'Inserisci almeno 2 allenamenti completi');
      return;
    }

    // Match day is optional - only validate if partially filled
    const hasPartialMatchDay = matchDay.day || matchDay.time || matchDay.venue;
    const hasCompleteMatchDay = matchDay.day && matchDay.time && matchDay.venue;
    if (hasPartialMatchDay && !hasCompleteMatchDay) {
      showAlert('Errore', 'Completa tutti i campi del giorno gara oppure lasciali tutti vuoti');
      return;
    }

    // Solo per squadre NON prime squadre: valida i pagamenti
    if (!isPrimaSquadra) {
      if (!totalAmount) {
        showAlert('Errore', 'Inserisci la quota totale annuale');
        return;
      }

      const validInstallments = installments.filter(inst => inst.amount && parseFloat(inst.amount) > 0);
      if (validInstallments.length === 0) {
        showAlert('Errore', 'Inserisci almeno una rata');
        return;
      }

      // Check that installments from the 2nd onward have a due date
      for (let i = 1; i < validInstallments.length; i++) {
        if (!validInstallments[i].due_date) {
          showAlert('Errore', `Inserisci la scadenza per ${validInstallments[i].name}`);
          return;
        }
        // Validate date format DD/MM/YYYY
        const dateParts = validInstallments[i].due_date.split('/');
        if (dateParts.length !== 3 || dateParts[2].length !== 4) {
          showAlert('Errore', `La scadenza di ${validInstallments[i].name} deve essere in formato GG/MM/AAAA (es: 15/11/2026)`);
          return;
        }
      }

      if (!bankInfo || !paypalEmail) {
        showAlert('Errore', 'Inserisci le informazioni di pagamento');
        return;
      }
    }

    // Convert date from DD/MM/YYYY to YYYY-MM-DD
    const convertDate = (dateStr: string): string => {
      if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
        // Already in YYYY-MM-DD format
        return dateStr;
      }
      // Convert from DD/MM/YYYY to YYYY-MM-DD
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return dateStr;
    };

    // Build training schedule string from structured data
    let trainingScheduleStr = '';
    validTrainings.forEach((t, idx) => {
      trainingScheduleStr += `${t.day.toUpperCase()}: ${t.venue} dalle ${t.timeStart} alle ${t.timeEnd}\n`;
    });
    if (hasCompleteMatchDay) {
      trainingScheduleStr += `GIORNO GARA: ${matchDay.day.toUpperCase()} alle ${matchDay.time} - ${matchDay.venue}`;
    }
    
    // Add rifinitura to training schedule string
    const hasRifinitura = rifinitura.enabled && rifinitura.timeStart && rifinitura.timeEnd && rifinitura.venue;
    if (hasRifinitura) {
      trainingScheduleStr += `\nRIFINITURA (mattina gara): ${rifinitura.venue} dalle ${rifinitura.timeStart} alle ${rifinitura.timeEnd}`;
    }

    setLoading(true);
    try {
      // Build installments for saving
      const validInstallments = installments
        .filter(inst => inst.amount && parseFloat(inst.amount) > 0)
        .map(inst => ({
          name: inst.name,
          amount: parseFloat(inst.amount),
          due_date: inst.due_date ? convertDate(inst.due_date) : null,
        }));

      const teamData: any = {
        name,
        description,
        is_prima_squadra: isPrimaSquadra,
        total_amount: isPrimaSquadra ? 0 : parseFloat(totalAmount),
        installments: isPrimaSquadra ? [] : validInstallments,
        bank_info: isPrimaSquadra ? null : bankInfo,
        paypal_email: isPrimaSquadra ? null : paypalEmail,
        training_schedule: trainingScheduleStr,
        trainings: validTrainings,
        match_day: hasCompleteMatchDay ? matchDay : null,
        rifinitura: hasRifinitura ? { timeStart: rifinitura.timeStart, timeEnd: rifinitura.timeEnd, venue: rifinitura.venue } : null,
        championships: championships || null,
        calendar_link: calendarLink || null,
      };

      // Legacy compatibility fields
      if (!isPrimaSquadra && validInstallments.length >= 1) {
        teamData.installment_1_amount = validInstallments[0].amount;
      }
      if (!isPrimaSquadra && validInstallments.length >= 2) {
        teamData.installment_2_amount = validInstallments[1].amount;
        teamData.installment_2_due_date = validInstallments[1].due_date;
      }
      if (!isPrimaSquadra && validInstallments.length >= 3) {
        teamData.installment_3_amount = validInstallments[2].amount;
        teamData.installment_3_due_date = validInstallments[2].due_date;
      }

      await api.post('/teams', teamData);
      
      setModalVisible(false);
      resetForm();
      await loadTeams();
      showAlert('Successo', 'Squadra creata con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    const athletesCount = athletesCounts[team.id] || 0;
    
    if (athletesCount > 0) {
      if (Platform.OS === 'web') {
        window.alert(`La squadra "${team.name}" ha ${athletesCount} atleti iscritti.\n\nTrasferire o eliminare gli atleti prima di poter eliminare la squadra.`);
      } else {
        Alert.alert(
          'Impossibile Eliminare',
          `La squadra "${team.name}" ha ${athletesCount} atleti iscritti.\n\nTrasferire o eliminare gli atleti prima di poter eliminare la squadra.`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    // Show the delete confirmation modal
    setTeamToDelete(team);
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!teamToDelete) return;
    
    // Verify the user typed the exact team name
    if (deleteConfirmText.trim().toLowerCase() !== teamToDelete.name.trim().toLowerCase()) {
      if (Platform.OS === 'web') {
        window.alert('Il nome inserito non corrisponde. Cancellazione annullata.');
      } else {
        Alert.alert('Errore', 'Il nome inserito non corrisponde. Cancellazione annullata.');
      }
      return;
    }
    
    try {
      await api.delete(`/teams/${teamToDelete.id}`);
      setDeleteModalVisible(false);
      setTeamToDelete(null);
      setDeleteConfirmText('');
      if (Platform.OS === 'web') {
        window.alert('Squadra eliminata con successo');
      } else {
        Alert.alert('Successo', 'Squadra eliminata con successo');
      }
      await loadTeams();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore durante l\'eliminazione';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
    }
  };

  const renderTeamItem = ({ item }: { item: Team }) => {
    const athletesCount = athletesCounts[item.id] || 0;
    
    return (
      <View style={styles.teamCardContainer}>
        <TouchableOpacity 
          style={styles.teamCard}
          onPress={() => router.push(`/admin/team/${item.id}`)}
        >
          <View style={styles.teamIcon}>
            {item.team_photo ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${item.team_photo}` }}
                style={{ width: 48, height: 48, borderRadius: 10 }}
              />
            ) : (
              <Ionicons name="people" size={24} color="#007AFF" />
            )}
          </View>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{item.name}</Text>
            <View style={styles.teamStats}>
              <View style={styles.statBadge}>
                <Ionicons name="person" size={12} color="#666" />
                <Text style={styles.statText}>{athletesCount} atleti</Text>
              </View>
            </View>
            {!item.is_prima_squadra && (
              <Text style={styles.teamAmount}>
                Quota: {formatCurrency(item.total_amount || 0)}
              </Text>
            )}
            {item.is_prima_squadra && (
              <Text style={[styles.teamAmount, { color: '#B8860B' }]}>
                ⭐ Prima Squadra
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteTeamButton}
          onPress={() => handleDeleteTeam(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Squadre</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={36} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={teams}
        renderItem={renderTeamItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {initialLoading ? (
              // Loading state con icona sport
              <>
                <View style={{ marginBottom: 16, opacity: 0.7 }}>
                  <SportIcon size={64} fallbackEmoji="⏳" />
                </View>
                <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>Caricamento squadre...</Text>
              </>
            ) : (
              // Empty state - lista vuota dopo il caricamento
              <>
                <View style={{ marginBottom: 8 }}>
                  <SportIcon size={64} fallbackEmoji="📚" />
                </View>
                <Text style={styles.emptyText}>Nessuna squadra</Text>
                <Text style={styles.emptySubtext}>Tocca + per creare una squadra</Text>
              </>
            )}
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuova Squadra</Text>

              <Text style={styles.label}>Nome Squadra *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Under 15"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Descrizione</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descrizione squadra (opzionale)"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.sectionTitle}>🏟️ Allenamenti Settimanali</Text>
              <Text style={styles.hint}>Minimo 2, massimo 10 allenamenti</Text>

              {trainings.map((training, index) => (
                <View key={index} style={styles.trainingRow}>
                  <View style={styles.trainingHeader}>
                    <Text style={styles.trainingLabel}>Allenamento {index + 1}</Text>
                    {trainings.length > 2 && (
                      <TouchableOpacity onPress={() => removeTraining(index)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.trainingFields}>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Giorno</Text>
                        <View style={styles.pickerContainer}>
                          <TouchableOpacity 
                            style={styles.pickerButton}
                            onPress={() => openDayPickerForTraining(index)}
                          >
                            <Text style={training.day ? styles.pickerText : styles.pickerPlaceholder}>
                              {training.day || 'Seleziona'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#666" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Palestra</Text>
                        <View style={styles.pickerContainer}>
                          <TouchableOpacity 
                            style={styles.pickerButton}
                            onPress={() => openVenuePickerForTraining(index)}
                          >
                            <Text style={[training.venue ? styles.pickerText : styles.pickerPlaceholder, {flex: 1}]} numberOfLines={1}>
                              {training.venue || 'Seleziona'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#666" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Dalle</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="18:00"
                          placeholderTextColor="#999"
                          value={training.timeStart}
                          onChangeText={(v) => updateTraining(index, 'timeStart', v)}
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Alle</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="20:00"
                          placeholderTextColor="#999"
                          value={training.timeEnd}
                          onChangeText={(v) => updateTraining(index, 'timeEnd', v)}
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {trainings.length < 10 && (
                <TouchableOpacity style={styles.addButton} onPress={addTraining}>
                  <Ionicons name="add" size={20} color="#007AFF" />
                  <Text style={styles.addButtonText}>Aggiungi Allenamento</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.sectionTitle}>🏆 Giorno Gara</Text>
              
              <View style={styles.trainingFields}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.miniLabel}>Giorno</Text>
                    <View style={styles.pickerContainer}>
                      <TouchableOpacity 
                        style={styles.pickerButton}
                        onPress={() => openDayPickerForMatch()}
                      >
                        <Text style={matchDay.day ? styles.pickerText : styles.pickerPlaceholder}>
                          {matchDay.day || 'Seleziona'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.miniLabel}>Orario</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="17:00"
                      placeholderTextColor="#999"
                      value={matchDay.time}
                      onChangeText={(v) => setMatchDay({...matchDay, time: formatTimeInput(v)})}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldFull}>
                    <Text style={styles.miniLabel}>Palestra Gare Casalinghe</Text>
                    <View style={styles.pickerContainer}>
                      <TouchableOpacity 
                        style={styles.pickerButton}
                        onPress={() => openVenuePickerForMatch()}
                      >
                        <Text style={[matchDay.venue ? styles.pickerText : styles.pickerPlaceholder, {flex: 1}]} numberOfLines={1}>
                          {matchDay.venue || 'Seleziona'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Rifinitura Section */}
              <View style={styles.rifinituraSection}>
                <TouchableOpacity 
                  style={styles.rifinituraToggle}
                  onPress={() => setRifinitura({...rifinitura, enabled: !rifinitura.enabled})}
                >
                  <Ionicons 
                    name={rifinitura.enabled ? "checkbox" : "square-outline"} 
                    size={24} 
                    color="#007AFF" 
                  />
                  <Text style={styles.rifinituraToggleText}>Allenamento di Rifinitura (mattina gara)</Text>
                </TouchableOpacity>
                
                {rifinitura.enabled && (
                  <View style={styles.trainingFields}>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Dalle</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="09:00"
                          placeholderTextColor="#999"
                          value={rifinitura.timeStart}
                          onChangeText={(v) => setRifinitura({...rifinitura, timeStart: formatTimeInput(v)})}
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.miniLabel}>Alle</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="11:00"
                          placeholderTextColor="#999"
                          value={rifinitura.timeEnd}
                          onChangeText={(v) => setRifinitura({...rifinitura, timeEnd: formatTimeInput(v)})}
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldFull}>
                        <Text style={styles.miniLabel}>Palestra</Text>
                        <View style={styles.pickerContainer}>
                          <TouchableOpacity 
                            style={styles.pickerButton}
                            onPress={() => openVenuePickerForRifinitura()}
                          >
                          <Text style={[rifinitura.venue ? styles.pickerText : styles.pickerPlaceholder, {flex: 1}]} numberOfLines={1}>
                              {rifinitura.venue || 'Seleziona'}
                          </Text>
                            <Ionicons name="chevron-down" size={16} color="#666" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>🏆 Campionati</Text>

              <Text style={styles.label}>Campionati Iscritti</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Es: Serie C, Coppa Regionale"
                placeholderTextColor="#999"
                value={championships}
                onChangeText={setChampionships}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.label}>Link Calendario Federazione</Text>
              <TextInput
                style={styles.input}
                placeholder="https://federazione.it/calendario"
                placeholderTextColor="#999"
                value={calendarLink}
                onChangeText={setCalendarLink}
                keyboardType="url"
                autoCapitalize="none"
              />

              {/* Sezione Pagamenti - solo per squadre non Prime Squadre */}
              {!isPrimaSquadra && (
                <>
                  <Text style={styles.sectionTitle}>💶 Pagamenti</Text>

                  <Text style={styles.label}>Quota Totale Annuale (€) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Es: 600"
                    placeholderTextColor="#999"
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.sectionTitle}>📋 Rate</Text>
                  
                  {installments.map((inst, index) => (
                    <View key={index} style={{marginBottom: 12, backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12}}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                        <Text style={{fontSize: 14, fontWeight: '600', color: '#333'}}>{inst.name}</Text>
                        {index > 0 && (
                          <TouchableOpacity onPress={() => {
                            const newInstallments = installments.filter((_, i) => i !== index);
                            // Rename remaining
                            setInstallments(newInstallments.map((inst, i) => ({ ...inst, name: `Rata ${i + 1}` })));
                          }}>
                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.miniLabel}>Importo (€) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Es: 250"
                        placeholderTextColor="#999"
                        value={inst.amount}
                        onChangeText={(v) => {
                          const newInstallments = [...installments];
                          newInstallments[index] = { ...newInstallments[index], amount: v };
                          setInstallments(newInstallments);
                        }}
                        keyboardType="decimal-pad"
                      />
                      {index > 0 && (
                        <>
                          <Text style={styles.miniLabel}>Scadenza *</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="es: 15/11/2026"
                            placeholderTextColor="#bbb"
                            value={inst.due_date}
                            onChangeText={(text) => {
                              let formatted = text.replace(/[^0-9]/g, '');
                              if (formatted.length > 2) formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                              if (formatted.length > 5) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                              const newInstallments = [...installments];
                              newInstallments[index] = { ...newInstallments[index], due_date: formatted };
                              setInstallments(newInstallments);
                            }}
                            keyboardType="numbers-and-punctuation"
                            maxLength={10}
                          />
                        </>
                      )}
                    </View>
                  ))}

                  {installments.length < 12 && (
                    <TouchableOpacity
                      style={[styles.addButton, {marginBottom: 16}]}
                      onPress={() => setInstallments([...installments, { name: `Rata ${installments.length + 1}`, amount: '', due_date: '' }])}
                    >
                      <Ionicons name="add" size={20} color="#007AFF" />
                      <Text style={styles.addButtonText}>Aggiungi Rata ({installments.length}/12)</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.sectionTitle}>🏦 Info Pagamento</Text>

                  <Text style={styles.label}>Dati Bonifico Bancario *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { textTransform: 'uppercase' }]}
                    placeholder="IBAN: IT00..."
                    placeholderTextColor="#999"
                    value={bankInfo}
                    onChangeText={(text) => setBankInfo(text.toUpperCase())}
                    autoCapitalize="characters"
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.label}>Email PayPal *</Text>
                  <TextInput
                    style={[styles.input, { textTransform: 'lowercase' }]}
                    placeholder="paypal@societa.it"
                    placeholderTextColor="#999"
                    value={paypalEmail}
                    onChangeText={(text) => setPaypalEmail(text.toLowerCase())}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.buttonSecondaryText}>Annulla</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleCreateTeam}
                  disabled={loading}
                >
                  <Text style={styles.buttonPrimaryText}>
                    {loading ? 'Creazione...' : 'Crea Squadra'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Day Picker Modal */}
      <Modal
        visible={dayPickerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDayPickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.dayPickerOverlay}
          activeOpacity={1}
          onPress={() => setDayPickerVisible(false)}
        >
          <View style={styles.dayPickerContent}>
            <Text style={styles.dayPickerTitle}>Seleziona Giorno</Text>
            {daysOfWeek.map((day) => (
              <TouchableOpacity
                key={day}
                style={styles.dayPickerItem}
                onPress={() => handleDaySelect(day)}
              >
                <Text style={styles.dayPickerItemText}>{day}</Text>
                {((dayPickerTarget?.type === 'training' && dayPickerTarget.index !== undefined && trainings[dayPickerTarget.index]?.day === day) ||
                  (dayPickerTarget?.type === 'match' && matchDay.day === day)) && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.dayPickerCancel}
              onPress={() => setDayPickerVisible(false)}
            >
              <Text style={styles.dayPickerCancelText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Venue Picker Modal */}
      <Modal
        visible={venuePickerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setVenuePickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.dayPickerOverlay}
          activeOpacity={1}
          onPress={() => setVenuePickerVisible(false)}
        >
          <View style={styles.dayPickerContent}>
            <Text style={styles.dayPickerTitle}>Seleziona Palestra</Text>
            {availableVenues.length === 0 ? (
              <View style={{padding: 16, alignItems: 'center'}}>
                <Text style={{color: '#999', fontSize: 14, textAlign: 'center'}}>
                  Nessuna palestra configurata.{'\n'}Aggiungile in Altre Impostazioni.
                </Text>
              </View>
            ) : (
              availableVenues.map((venue) => (
                <TouchableOpacity
                  key={venue.name}
                  style={styles.dayPickerItem}
                  onPress={() => handleVenueSelect(venue.name)}
                >
                  <View style={{flex: 1}}>
                    <Text style={styles.dayPickerItemText}>{venue.name}</Text>
                    {venue.address ? (
                      <Text style={{fontSize: 12, color: '#999'}}>{venue.address}{venue.city ? `, ${venue.city}` : ''}</Text>
                    ) : null}
                  </View>
                  {((venuePickerTarget?.type === 'training' && venuePickerTarget.index !== undefined && trainings[venuePickerTarget.index]?.venue === venue.name) ||
                    (venuePickerTarget?.type === 'match' && matchDay.venue === venue.name) ||
                    (venuePickerTarget?.type === 'rifinitura' && rifinitura.venue === venue.name)) && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={styles.dayPickerCancel}
              onPress={() => setVenuePickerVisible(false)}
            >
              <Text style={styles.dayPickerCancelText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setDeleteModalVisible(false);
          setTeamToDelete(null);
          setDeleteConfirmText('');
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Text style={{ fontSize: 40 }}>⚠️</Text>
            </View>
            <Text style={styles.deleteModalTitle}>Eliminazione Squadra</Text>
            <Text style={styles.deleteModalWarning}>
              Stai per eliminare definitivamente la squadra:
            </Text>
            <Text style={styles.deleteModalTeamName}>"{teamToDelete?.name}"</Text>
            <Text style={styles.deleteModalInstruction}>
              Per confermare, digita il nome esatto della squadra:
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              placeholder={teamToDelete?.name || 'Nome squadra'}
              placeholderTextColor="#999"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setTeamToDelete(null);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.deleteModalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteModalConfirmBtn,
                  deleteConfirmText.trim().toLowerCase() !== teamToDelete?.name.trim().toLowerCase() && styles.deleteModalConfirmBtnDisabled
                ]}
                onPress={handleConfirmDelete}
                disabled={deleteConfirmText.trim().toLowerCase() !== teamToDelete?.name.trim().toLowerCase()}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.deleteModalConfirmText}>Elimina</Text>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  teamCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteTeamButton: {
    backgroundColor: '#fff',
    padding: 12,
    marginLeft: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    flex: 1,
    marginLeft: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teamDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  teamAmount: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '500',
  },
  teamStats: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 2,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  teamVenue: {
    fontSize: 10,
    color: '#FF9500',
    marginTop: 2,
  },
  teamTraining: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    height: 120,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  trainingRow: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trainingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  trainingFields: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldFull: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  miniInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  trainingContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trainingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
  },
  pickerContainer: {
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  trainingRow: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  trainingFields: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldFull: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  miniInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  trainingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  // Day Picker Modal Styles
  dayPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayPickerContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  dayPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  dayPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayPickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  dayPickerCancel: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  dayPickerCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  deleteModalIcon: {
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalTeamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteModalInstruction: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalInput: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  deleteModalCancelBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  deleteModalConfirmBtn: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteModalConfirmBtnDisabled: {
    backgroundColor: '#FFB3B3',
  },
  deleteModalConfirmText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Rifinitura Styles
  rifinituraSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  rifinituraToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 12,
    gap: 8,
  },
  rifinituraToggleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Prima Squadra Styles
  primaSquadraToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
    marginVertical: 16,
    gap: 12,
  },
  primaSquadraTextContainer: {
    flex: 1,
  },
  primaSquadraLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  primaSquadraLabelActive: {
    color: '#B8860B',
    fontWeight: 'bold',
  },
  primaSquadraHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
