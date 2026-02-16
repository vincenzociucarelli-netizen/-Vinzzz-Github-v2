import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
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
  other_annual_compensation?: number;  // Da altre ASD/SSD
  prior_compensation?: number;  // Compensi pregressi alla data di assunzione
  contract_start_date?: string;  // Data inizio contratto
  contract_end_date?: string;  // Data fine contratto
  compensation_accepted?: boolean;
  compensation_history?: { [key: string]: boolean };
  over_5000_limit?: { [key: string]: boolean };
  // Photo fields
  profile_photo?: string;
  profile_photo_artistic?: string;
  // Document fields
  document_type?: string;
  document_front?: string;
  document_back?: string;
  iban?: string;
  iban_holder?: string;
  bank_name?: string;
  // Onboarding fields
  onboarding_checklist?: {
    contract_signed?: boolean;
    ras_registered?: boolean;
    id_acquired?: boolean;
    fiscal_code_acquired?: boolean;
    criminal_record?: boolean;
  };
  onboarding_completed?: boolean;
  onboarding_date?: string;
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
  
  // Image viewer modal
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageTitle, setViewingImageTitle] = useState('');
  
  // Reset password modal
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Onboarding checklist edit state
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [checklistItems, setChecklistItems] = useState({
    contract_signed: false,
    ras_registered: false,
    id_acquired: false,
    fiscal_code_acquired: false,
    criminal_record: false,
  });
  const [priorCompensation, setPriorCompensation] = useState('0');
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');
  const [otherAnnualCompensation, setOtherAnnualCompensation] = useState('0');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');

  const openImageViewer = (imageBase64: string, title: string) => {
    setViewingImage(imageBase64);
    setViewingImageTitle(title);
    setImageViewerVisible(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showAlert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    
    setResettingPassword(true);
    try {
      await api.patch(`/users/${id}/reset-password`, {
        new_password: newPassword
      });
      showAlert('Successo', `Password resettata per ${coach?.full_name}`);
      setResetPasswordVisible(false);
      setNewPassword('');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Impossibile resettare la password');
    } finally {
      setResettingPassword(false);
    }
  };

  const loadData = async () => {
    try {
      const [coachRes, teamsRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/teams'),
      ]);
      setCoach(coachRes.data);
      setTeams(teamsRes.data);
      setMonthlyCompensation(coachRes.data.monthly_compensation?.toString() || '0');
      setOtherAnnualCompensation(coachRes.data.other_annual_compensation?.toString() || '0');
      setSelectedTeams(coachRes.data.assigned_teams || []);
      
      // Load contract start date
      if (coachRes.data.contract_start_date) {
        const date = new Date(coachRes.data.contract_start_date);
        setContractStartDate(date.toISOString().split('T')[0]); // YYYY-MM-DD
      }
      
      // Load contract end date
      if (coachRes.data.contract_end_date) {
        const date = new Date(coachRes.data.contract_end_date);
        setContractEndDate(date.toISOString().split('T')[0]); // YYYY-MM-DD
      }
      
      // Initialize onboarding checklist state
      const checklist = coachRes.data.onboarding_checklist || {};
      setChecklistItems({
        contract_signed: checklist.contract_signed || false,
        ras_registered: checklist.ras_registered || false,
        id_acquired: checklist.id_acquired || false,
        fiscal_code_acquired: checklist.fiscal_code_acquired || false,
        criminal_record: checklist.criminal_record || false,
      });
      setPriorCompensation(coachRes.data.prior_compensation?.toString() || '0');
    } catch (error) {
      console.error('Error loading coach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    try {
      await api.patch(`/users/${id}/onboarding`, {
        onboarding_checklist: checklistItems,
        prior_compensation: parseFloat(priorCompensation) || 0,
        onboarding_completed: true,
      });
      showAlert('Successo', 'Checklist onboarding aggiornata');
      setEditingOnboarding(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingOnboarding(false);
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
        other_annual_compensation: parseFloat(otherAnnualCompensation) || 0,
        contract_start_date: contractStartDate || null,
        contract_end_date: contractEndDate || null,
      });
      showAlert('Successo', 'Compensi aggiornati con successo');
      setEditing(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // Calculate total annual compensation - considera data inizio e fine contratto
  const getTotalAnnualCompensation = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const prior = coach?.prior_compensation || 0;  // Compensi pregressi (prima del contratto)
    
    // Calcola mesi del contratto
    let monthsInContract = 12;
    if (contractStartDate && contractEndDate) {
      const start = new Date(contractStartDate);
      const end = new Date(contractEndDate);
      // Calcola differenza in mesi
      monthsInContract = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      if (monthsInContract < 1) monthsInContract = 1;
    } else if (contractStartDate) {
      // Solo data inizio: calcola fino a dicembre stesso anno
      const start = new Date(contractStartDate);
      monthsInContract = 12 - start.getMonth();
    }
    
    // Totale = compensi pregressi + (compenso mensile × mesi contratto)
    const thisClubTotal = monthly * monthsInContract;
    return prior + thisClubTotal;
  };
  
  // Calcola dettaglio compensi per display
  const getCompensationBreakdown = () => {
    const monthly = parseFloat(monthlyCompensation) || 0;
    const prior = coach?.prior_compensation || 0;
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    let monthsInContract = 12;
    let startMonthName = 'Gennaio';
    let endMonthName = 'Dicembre';
    let startYear = new Date().getFullYear();
    let endYear = startYear;
    
    if (contractStartDate && contractEndDate) {
      const start = new Date(contractStartDate);
      const end = new Date(contractEndDate);
      monthsInContract = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      if (monthsInContract < 1) monthsInContract = 1;
      startMonthName = monthNames[start.getMonth()];
      endMonthName = monthNames[end.getMonth()];
      startYear = start.getFullYear();
      endYear = end.getFullYear();
    } else if (contractStartDate) {
      const start = new Date(contractStartDate);
      monthsInContract = 12 - start.getMonth();
      startMonthName = monthNames[start.getMonth()];
      startYear = start.getFullYear();
    }
    
    return {
      monthly,
      prior,
      monthsInContract,
      startMonthName,
      endMonthName,
      startYear,
      endYear,
      thisClubTotal: monthly * monthsInContract,
      grandTotal: prior + (monthly * monthsInContract)
    };
  };

  const getCompensationBadge = () => {
    const total = getTotalAnnualCompensation();
    if (total <= 0) return null;
    if (total < 5000) return { text: '<5K', color: '#34C759', bg: '#E8F5E9' };
    if (total < 15000) return { text: '<15K', color: '#FF9500', bg: '#FFF3E0' };
    return { text: '>15K', color: '#FF3B30', bg: '#FFEBEE' };
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
              {/* Mostra la data di dichiarazione */}
              {(() => {
                if (!coach.over_5000_limit) return null;
                // Cerca la data più recente di dichiarazione
                const dateKeys = Object.keys(coach.over_5000_limit).filter(k => k.endsWith('_date'));
                if (dateKeys.length === 0) return null;
                const latestDateKey = dateKeys.sort().reverse()[0];
                const declarationDate = coach.over_5000_limit[latestDateKey];
                if (!declarationDate) return null;
                const d = new Date(declarationDate);
                const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} alle ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                return (
                  <Text style={styles.declarationDateAdmin}>
                    📅 Dichiarato il: {formattedDate}
                  </Text>
                );
              })()}
            </View>
          </View>
        )}

        {/* Onboarding Reminder Banner - Clickable to edit */}
        {coach.status === 'approved' && (() => {
          const checklist = coach.onboarding_checklist || {};
          const missingChecklist = !checklist.contract_signed || !checklist.ras_registered || 
                                   !checklist.id_acquired || !checklist.fiscal_code_acquired;
          const missingPriorComp = (coach.prior_compensation === undefined || coach.prior_compensation === null);
          
          if (!missingChecklist && !missingPriorComp) return null;
          
          const missingItems = [];
          if (!checklist.contract_signed) missingItems.push('Contratto/Lettera d\'incarico');
          if (!checklist.ras_registered) missingItems.push('Iscrizione RAS');
          if (!checklist.id_acquired) missingItems.push('Documento d\'identità');
          if (!checklist.fiscal_code_acquired) missingItems.push('Codice fiscale');
          if (missingPriorComp) missingItems.push('Compensi pregressi');
          
          return (
            <TouchableOpacity 
              style={styles.onboardingBanner}
              onPress={() => setEditingOnboarding(true)}
            >
              <Text style={{ fontSize: 18 }}>📋</Text>
              <View style={styles.onboardingBannerContent}>
                <Text style={styles.onboardingBannerTitle}>Promemoria Onboarding</Text>
                <Text style={styles.onboardingBannerText}>
                  Da completare: {missingItems.join(', ')}
                </Text>
                <Text style={styles.onboardingBannerAction}>Tocca per completare →</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={styles.photoContainer}
            onPress={() => {
              const photo = coach.profile_photo_artistic || coach.profile_photo;
              if (photo) {
                setViewingImage(photo);
                setViewingImageTitle('Foto Profilo');
                setImageViewerVisible(true);
              }
            }}
            disabled={!coach.profile_photo && !coach.profile_photo_artistic}
          >
            {coach.profile_photo_artistic || coach.profile_photo ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${coach.profile_photo_artistic || coach.profile_photo}` }}
                style={styles.profilePhoto}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="fitness" size={60} color="#FF9500" />
              </View>
            )}
            {(coach.profile_photo || coach.profile_photo_artistic) && (
              <View style={styles.photoZoomHint}>
                <Ionicons name="expand" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.photoName}>{coach.full_name}</Text>
          <Text style={styles.photoRole}>🏃 Coach</Text>
          
          {/* Contact Buttons */}
          <View style={styles.contactButtons}>
            <TouchableOpacity
              style={[styles.whatsappBtn, !coach.phone && styles.disabledBtn]}
              onPress={() => {
                if (!coach.phone) {
                  Alert.alert('Telefono non disponibile', 'Questo coach non ha un numero di telefono registrato');
                  return;
                }
                const phone = coach.phone?.replace(/\D/g, '');
                const phoneWithCountry = phone?.startsWith('39') ? phone : `39${phone}`;
                Linking.openURL(`https://wa.me/${phoneWithCountry}`);
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.whatsappBtnText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resetPasswordBtn}
              onPress={() => setResetPasswordVisible(true)}
            >
              <Ionicons name="key-outline" size={20} color="#fff" />
              <Text style={styles.resetPasswordBtnText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </View>

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
            <Text style={styles.cardTitle}>💰 Compensi</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {(() => {
                const badge = getCompensationBadge();
                return badge ? (
                  <View style={[styles.compBadgeLarge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.compBadgeLargeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                ) : null;
              })()}
              <TouchableOpacity onPress={() => setEditing(!editing)}>
                <Text style={{ fontSize: 22 }}>{editing ? '✕' : '✏️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {editing ? (
            <>
              <Text style={styles.inputLabel}>Data Inizio Contratto</Text>
              <TextInput
                style={styles.input}
                value={contractStartDate}
                onChangeText={setContractStartDate}
                placeholder="YYYY-MM-DD (es: 2025-09-01)"
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Data Fine Contratto</Text>
              <TextInput
                style={styles.input}
                value={contractEndDate}
                onChangeText={setContractEndDate}
                placeholder="YYYY-MM-DD (es: 2026-06-30)"
              />
              <Text style={styles.inputHint}>
                Periodo contratto per calcolo compensi e comunicazione RAS
              </Text>
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Compenso Mensile da questa ASD (€)</Text>
              <TextInput
                style={styles.input}
                value={monthlyCompensation}
                onChangeText={setMonthlyCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Compensi Annuali da altre ASD/SSD (€)</Text>
              <TextInput
                style={styles.input}
                value={otherAnnualCompensation}
                onChangeText={setOtherAnnualCompensation}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={styles.inputHint}>
                Inserisci la somma dichiarata dal coach dei compensi ricevuti da altre associazioni sportive
              </Text>
              
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Totale Contratto Stimato</Text>
                <Text style={styles.totalValue}>€{getTotalAnnualCompensation().toLocaleString()}</Text>
              </View>
              
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveCompensation}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Salvataggio...' : 'Salva Compensi'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.compensationDisplay}>
                <Text style={styles.compensationAmount}>€{coach.monthly_compensation || 0}</Text>
                <Text style={styles.compensationPeriod}>/mese (questa ASD)</Text>
              </View>
              {(coach.other_annual_compensation || 0) > 0 && (
                <View style={[styles.compensationDisplay, { marginTop: 8 }]}>
                  <Text style={[styles.compensationAmount, { fontSize: 18, color: '#666' }]}>
                    €{coach.other_annual_compensation}
                  </Text>
                  <Text style={styles.compensationPeriod}>/anno (altre ASD)</Text>
                </View>
              )}
              
              {/* Mostra breakdown del calcolo */}
              {(() => {
                const breakdown = getCompensationBreakdown();
                return (
                  <>
                    {breakdown.prior > 0 && (
                      <View style={[styles.totalBox, { marginTop: 8, backgroundColor: '#FFF3E0' }]}>
                        <Text style={[styles.totalLabel, { color: '#E65100' }]}>
                          Compensi Pregressi (prima del contratto)
                        </Text>
                        <Text style={[styles.totalValue, { color: '#E65100' }]}>
                          €{breakdown.prior.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    
                    {(contractStartDate || contractEndDate) && (
                      <View style={[styles.totalBox, { marginTop: 8, backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.totalLabel, { color: '#1565C0' }]}>
                          Periodo: {breakdown.startMonthName} {breakdown.startYear} - {breakdown.endMonthName} {breakdown.endYear} ({breakdown.monthsInContract} mesi)
                        </Text>
                        <Text style={[styles.totalValue, { color: '#1565C0' }]}>
                          €{breakdown.monthly} × {breakdown.monthsInContract} = €{breakdown.thisClubTotal.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    
                    <View style={[styles.totalBox, { marginTop: 12, backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.totalLabel, { color: '#2E7D32' }]}>Totale Compenso Contratto (per RAS)</Text>
                      <Text style={[styles.totalValue, { color: '#2E7D32', fontSize: 20 }]}>
                        €{breakdown.grandTotal.toLocaleString()}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </>
          )}

          {coach.compensation_accepted && (
            <View style={styles.acceptedBadge}>
              <Text style={{ fontSize: 14 }}>✅</Text>
              <Text style={styles.acceptedText}>Accettato dal coach</Text>
            </View>
          )}
          
          {/* Compensi Pregressi */}
          {(coach.prior_compensation !== undefined && coach.prior_compensation !== null) && (
            <View style={styles.priorCompensationBox}>
              <Text style={styles.priorCompensationLabel}>📋 Compensi pregressi (alla data di assunzione)</Text>
              <Text style={styles.priorCompensationValue}>€{coach.prior_compensation.toLocaleString()}</Text>
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
            
            {/* Foto Documenti se presenti - in riga compatta */}
            {(coach.doc_front_image || coach.doc_back_image) && (
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Foto Documento (clicca per ingrandire)</Text>
                <View style={styles.docImagesRowAdmin}>
                  {coach.doc_front_image && (
                    <TouchableOpacity 
                      style={styles.docImageContainerAdmin}
                      onPress={() => openImageViewer(coach.doc_front_image!, 'Documento Fronte')}
                    >
                      <Text style={styles.docImageLabelAdmin}>Fronte</Text>
                      <Image 
                        source={{ uri: `data:image/jpeg;base64,${coach.doc_front_image}` }} 
                        style={styles.docImagePreviewSmall} 
                      />
                      <Text style={styles.tapToEnlarge}>👆 Tocca per ingrandire</Text>
                    </TouchableOpacity>
                  )}
                  {coach.doc_back_image && (
                    <TouchableOpacity 
                      style={styles.docImageContainerAdmin}
                      onPress={() => openImageViewer(coach.doc_back_image!, 'Documento Retro')}
                    >
                      <Text style={styles.docImageLabelAdmin}>Retro</Text>
                      <Image 
                        source={{ uri: `data:image/jpeg;base64,${coach.doc_back_image}` }} 
                        style={styles.docImagePreviewSmall} 
                      />
                      <Text style={styles.tapToEnlarge}>👆 Tocca per ingrandire</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            
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

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>{viewingImageTitle}</Text>
            <TouchableOpacity 
              style={styles.imageViewerClose}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {viewingImage && (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${viewingImage}` }} 
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity 
            style={styles.imageViewerCloseBtn}
            onPress={() => setImageViewerVisible(false)}
          >
            <Text style={styles.imageViewerCloseBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={resetPasswordVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResetPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔑 Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Imposta una nuova password per {coach?.full_name}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nuova password (min 6 caratteri)"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={false}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setResetPasswordVisible(false);
                  setNewPassword('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, resettingPassword && styles.disabledBtn]}
                onPress={handleResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Conferma</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Onboarding Checklist Edit Modal */}
      <Modal
        visible={editingOnboarding}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingOnboarding(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.onboardingModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>📋 Checklist Onboarding</Text>
              <Text style={styles.modalSubtitle}>{coach?.full_name}</Text>
              
              <Text style={styles.onboardingChecklistHeader}>Spunta le voci completate:</Text>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.contract_signed && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, contract_signed: !checklistItems.contract_signed})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.contract_signed ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Contratto/Lettera d'incarico firmata</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.ras_registered && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, ras_registered: !checklistItems.ras_registered})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.ras_registered ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Iscrizione RAS (Registro Attività Sportive)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.id_acquired && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, id_acquired: !checklistItems.id_acquired})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.id_acquired ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Documento d'identità acquisito</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.fiscal_code_acquired && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, fiscal_code_acquired: !checklistItems.fiscal_code_acquired})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.fiscal_code_acquired ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Codice fiscale acquisito</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.onboardingChecklistItem, checklistItems.criminal_record && styles.onboardingChecklistItemChecked]}
                onPress={() => setChecklistItems({...checklistItems, criminal_record: !checklistItems.criminal_record})}
              >
                <Text style={{ fontSize: 22 }}>{checklistItems.criminal_record ? '☑️' : '⬜'}</Text>
                <Text style={styles.onboardingChecklistText}>Certificato casellario giudiziale (se richiesto)</Text>
              </TouchableOpacity>
              
              <View style={styles.onboardingCompensationSection}>
                <Text style={styles.onboardingCompensationLabel}>💰 Compensi pregressi alla data di assunzione (€)</Text>
                <Text style={styles.onboardingCompensationHint}>
                  Importo dichiarato dal coach dei compensi sportivi già percepiti nel corrente anno fiscale
                </Text>
                <TextInput
                  style={styles.onboardingCompensationInput}
                  value={priorCompensation}
                  onChangeText={setPriorCompensation}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.onboardingModalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingOnboarding(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.onboardingSaveBtn, savingOnboarding && styles.disabledBtn]}
                  onPress={handleSaveOnboarding}
                  disabled={savingOnboarding}
                >
                  {savingOnboarding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.onboardingSaveBtnText}>Salva</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  declarationDateAdmin: { fontSize: 13, color: '#FF3B30', fontWeight: 'bold', marginTop: 8 },
  // Photo section styles
  photoSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  photoContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF9500',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFE0B2',
    borderStyle: 'dashed',
  },
  photoZoomHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 6,
  },
  photoName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  photoRole: {
    fontSize: 14,
    color: '#FF9500',
    marginTop: 4,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  resetPasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  resetPasswordBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
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
  compensationDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 8 },
  compensationAmount: { fontSize: 36, fontWeight: 'bold', color: '#FF9500' },
  compensationPeriod: { fontSize: 14, color: '#666', marginLeft: 4 },
  inputHint: { fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' },
  totalBox: { 
    backgroundColor: '#F5F5F5', 
    padding: 12, 
    borderRadius: 8, 
    marginTop: 16, 
    alignItems: 'center' 
  },
  totalLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  compBadgeLarge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  compBadgeLargeText: { fontSize: 14, fontWeight: 'bold' },
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
  docImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
    marginTop: 8,
  },
  docImagesRowAdmin: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  docImageContainerAdmin: {
    alignItems: 'center',
  },
  docImageLabelAdmin: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  docImagePreviewSmall: {
    width: 100,
    height: 70,
    borderRadius: 6,
  },
  tapToEnlarge: {
    fontSize: 10,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 4,
  },
  // Image Viewer Modal styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  imageViewerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  imageViewerClose: {
    padding: 8,
  },
  imageViewerImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 200,
  },
  imageViewerCloseBtn: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
  },
  imageViewerCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Onboarding banner styles
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  onboardingBannerContent: {
    flex: 1,
    marginLeft: 10,
  },
  onboardingBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9500',
    marginBottom: 4,
  },
  onboardingBannerText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  onboardingBannerAction: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 6,
    fontWeight: '600',
  },
  // Prior compensation styles
  priorCompensationBox: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  priorCompensationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priorCompensationValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  // Onboarding edit modal styles
  onboardingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '92%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  onboardingChecklistHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  onboardingChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  onboardingChecklistItemChecked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#34C759',
  },
  onboardingChecklistText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  onboardingCompensationSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  onboardingCompensationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  onboardingCompensationHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  onboardingCompensationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  onboardingModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  onboardingSaveBtn: {
    flex: 1.5,
    padding: 14,
    backgroundColor: '#34C759',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingSaveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
