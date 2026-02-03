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
  Modal,
  Switch,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete, Team, Payment, Certificate } from '../../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';

interface PaymentSummary {
  total_due: number;
  discount: number;
  discount_note: string;
  total_after_discount: number;
  total_paid: number;
  residual: number;
  installments: {
    first: number;
    second: number;
    third: number;
  };
}

interface AthleteAttendanceStats {
  total_attendances: number;
  weekly_attendances: number;
  monthly_attendances: number;
  total_percentage: number;
  monthly_percentage: number;
  weekly_percentage: number;
}

export default function AdminAthleteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [stats, setStats] = useState<AthleteAttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dati' | 'pagamenti' | 'presenze'>('dati');
  
  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  
  // Withdraw modal
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  
  // Reactivate modal with team selection
  const [reactivateModalVisible, setReactivateModalVisible] = useState(false);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [reactivating, setReactivating] = useState(false);
  
  // Add/Edit payment modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    paid_date: '',
    is_cash: false,
    notes: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // Certificate modal
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certExpiryDate, setCertExpiryDate] = useState('');
  const [certImage, setCertImage] = useState<string | null>(null);
  const [savingCert, setSavingCert] = useState(false);

  const pickCertImage = async () => {
    // Show action sheet to choose camera or gallery
    if (Platform.OS === 'web') {
      // On web, directly launch gallery (camera not well supported)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });
      
      if (!result.canceled && result.assets[0].base64) {
        setCertImage(result.assets[0].base64);
      }
    } else {
      // On mobile, show options
      Alert.alert(
        'Carica Certificato',
        'Come vuoi caricare l\'immagine?',
        [
          {
            text: 'Scatta Foto',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                showAlert('Permesso negato', 'È necessario il permesso per usare la fotocamera');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
                base64: true,
              });
              if (!result.canceled && result.assets[0].base64) {
                setCertImage(result.assets[0].base64);
              }
            },
          },
          {
            text: 'Scegli dalla Galleria',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
                base64: true,
              });
              if (!result.canceled && result.assets[0].base64) {
                setCertImage(result.assets[0].base64);
              }
            },
          },
          { text: 'Annulla', style: 'cancel' },
        ]
      );
    }
  };

  // Formatta automaticamente la data come GG/MM/AAAA
  const formatDateInput = (text: string) => {
    // Rimuovi tutto tranne i numeri
    const numbers = text.replace(/\D/g, '');
    
    // Formatta come GG/MM/AAAA
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 2);
    }
    if (numbers.length > 2) {
      formatted += '/' + numbers.substring(2, 4);
    }
    if (numbers.length > 4) {
      formatted += '/' + numbers.substring(4, 8);
    }
    
    setCertExpiryDate(formatted);
  };

  const loadData = async () => {
    try {
      const [athleteRes, paymentsRes, certRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/payments/${id}`),
        api.get(`/certificates/${id}`).catch(() => ({ data: null })),
      ]);

      const athleteData = athleteRes.data;
      setAthlete(athleteData);
      setPayments(paymentsRes.data);
      setCertificate(certRes.data);
      
      // Populate edit data
      setEditData({
        federal_code: athleteData.federal_code || '',
        is_registered: athleteData.is_registered || false,
        last_name: athleteData.last_name || athleteData.full_name?.split(' ')[0] || '',
        first_name: athleteData.first_name || athleteData.full_name?.split(' ').slice(1).join(' ') || '',
        birth_place: athleteData.birth_place || '',
        birth_province: athleteData.birth_province || '',
        fiscal_code: athleteData.fiscal_code || '',
        email: athleteData.email || '',
        phone_athlete: athleteData.phone_athlete || '',
        phone_mother: athleteData.phone_mother || '',
        phone_father: athleteData.phone_father || '',
        address: athleteData.address || '',
        postal_code: athleteData.postal_code || '',
        city: athleteData.city || '',
        province: athleteData.province || '',
        discount_amount: athleteData.discount_amount?.toString() || '0',
        discount_note: athleteData.discount_note || '',
      });

      // Load team info
      if (athleteData.team_id) {
        const teamRes = await api.get(`/teams/${athleteData.team_id}`);
        setTeam(teamRes.data);
        
        // Load payment summary
        try {
          const summaryRes = await api.get(`/payments/${id}/summary`);
          setPaymentSummary(summaryRes.data);
        } catch (e) {
          console.log('Could not load payment summary');
        }
        
        // Load attendance stats
        try {
          const statsRes = await api.get(`/teams/${athleteData.team_id}/attendance-stats`);
          const athleteStats = statsRes.data.athletes.find((a: any) => a.athlete_id === id);
          if (athleteStats) {
            setStats(athleteStats);
          }
        } catch (e) {
          console.log('Could not load attendance stats');
        }
      }
    } catch (error) {
      console.error('Error loading athlete data:', error);
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

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const handleSaveData = async () => {
    try {
      const updatePayload: any = {
        federal_code: editData.federal_code || null,
        is_registered: editData.is_registered,
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`.trim(),
        birth_place: editData.birth_place || null,
        birth_province: editData.birth_province || null,
        fiscal_code: editData.fiscal_code || null,
        email: editData.email || null,
        phone_athlete: editData.phone_athlete || null,
        phone_mother: editData.phone_mother || null,
        phone_father: editData.phone_father || null,
        address: editData.address || null,
        postal_code: editData.postal_code || null,
        city: editData.city || null,
        province: editData.province || null,
        discount_amount: parseFloat(editData.discount_amount) || 0,
        discount_note: editData.discount_note || null,
      };

      await api.patch(`/athletes/${id}`, updatePayload);
      showAlert('Successo', 'Dati salvati con successo');
      setEditing(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.amount || !newPayment.paid_date) {
      showAlert('Errore', 'Inserisci importo e data');
      return;
    }

    setSavingPayment(true);
    try {
      if (editingPaymentId) {
        // Update existing payment
        await api.put(`/payments/manual/${editingPaymentId}`, {
          amount: parseFloat(newPayment.amount),
          paid_date: newPayment.paid_date,
          is_cash: newPayment.is_cash,
          notes: newPayment.notes || null,
        });
        showAlert('Successo', 'Pagamento modificato');
      } else {
        // Create new payment
        await api.post('/payments/manual', {
          athlete_id: id,
          amount: parseFloat(newPayment.amount),
          paid_date: newPayment.paid_date,
          is_cash: newPayment.is_cash,
          notes: newPayment.notes || null,
        });
        showAlert('Successo', 'Pagamento registrato');
      }

      setPaymentModalVisible(false);
      setEditingPaymentId(null);
      setNewPayment({ amount: '', paid_date: '', is_cash: false, notes: '' });
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleEditPayment = (payment: any) => {
    // Convert date to dd/mm/yyyy format for input
    let formattedDate = '';
    if (payment.paid_date) {
      try {
        const date = new Date(payment.paid_date);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      } catch {
        formattedDate = payment.paid_date;
      }
    }

    setEditingPaymentId(payment.id);
    setNewPayment({
      amount: payment.amount?.toString() || '',
      paid_date: formattedDate,
      is_cash: payment.is_cash || false,
      notes: payment.notes || '',
    });
    setPaymentModalVisible(true);
  };

  const openNewPaymentModal = () => {
    setEditingPaymentId(null);
    setNewPayment({ amount: '', paid_date: '', is_cash: false, notes: '' });
    setPaymentModalVisible(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Sei sicuro di voler eliminare questo pagamento?')
      : await new Promise((resolve) => {
          Alert.alert('Conferma', 'Eliminare questo pagamento?', [
            { text: 'Annulla', onPress: () => resolve(false) },
            { text: 'Elimina', onPress: () => resolve(true), style: 'destructive' },
          ]);
        });

    if (confirmed) {
      try {
        await api.delete(`/payments/${paymentId}`);
        showAlert('Successo', 'Pagamento eliminato');
        await loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore');
      }
    }
  };

  // Withdraw athlete
  const handleWithdrawAthlete = async () => {
    setWithdrawing(true);
    try {
      await api.patch(`/athletes/${id}`, {
        is_withdrawn: true,
        withdrawn_reason: withdrawReason || 'Ritiro dalla squadra',
      });
      showAlert('Successo', 'Atleta ritirato dalla squadra');
      setWithdrawModalVisible(false);
      setWithdrawReason('');
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il ritiro');
    } finally {
      setWithdrawing(false);
    }
  };

  // Reactivate athlete - open modal to select team
  const handleReactivateAthlete = async () => {
    // Load all teams first
    try {
      const teamsRes = await api.get('/teams');
      setAllTeams(teamsRes.data);
      // Pre-select current team if exists
      if (athlete?.team_id) {
        setSelectedTeamId(athlete.team_id);
      }
      setReactivateModalVisible(true);
    } catch (error) {
      showAlert('Errore', 'Impossibile caricare le squadre');
    }
  };

  // Confirm reactivation with selected team
  const confirmReactivation = async () => {
    if (!selectedTeamId) {
      showAlert('Errore', 'Seleziona una squadra');
      return;
    }

    setReactivating(true);
    try {
      await api.patch(`/athletes/${id}`, {
        is_withdrawn: false,
        team_id: selectedTeamId,
      });
      showAlert('Successo', 'Atleta riattivato e assegnato alla nuova squadra');
      setReactivateModalVisible(false);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la riattivazione');
    } finally {
      setReactivating(false);
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return '#34C759';
    if (percentage >= 50) return '#FF9500';
    return '#FF3B30';
  };

  const handleSaveCertificate = async () => {
    if (!certExpiryDate) {
      showAlert('Errore', 'Inserisci la data di scadenza');
      return;
    }
    
    // Converti da DD/MM/YYYY a ISO
    const parts = certExpiryDate.split('/');
    if (parts.length !== 3) {
      showAlert('Errore', 'Formato data non valido. Usa GG/MM/AAAA');
      return;
    }
    
    const expiryDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(expiryDate.getTime())) {
      showAlert('Errore', 'Data non valida');
      return;
    }
    
    setSavingCert(true);
    try {
      const response = await api.post('/certificates/simple', {
        athlete_id: id,
        expiry_date: expiryDate.toISOString(),
        image_base64: certImage || null,
      });
      setCertificate({
        id: response.data.id,
        athlete_id: id as string,
        expiry_date: response.data.expiry_date,
      });
      setCertModalVisible(false);
      setCertExpiryDate('');
      setCertImage(null);
      showAlert('Successo', 'Certificato medico salvato');
    } catch (error: any) {
      console.error('Error saving certificate:', error);
      showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
    } finally {
      setSavingCert(false);
    }
  };

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
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  if (!athlete) {
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
          <Text>Atleta non trovato</Text>
        </View>
      </View>
    );
  }

  const isCertificateExpired = certificate && new Date(certificate.expiry_date) < new Date();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{athlete.full_name}</Text>
        {activeTab === 'dati' && (
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? "close" : "create"} size={24} color="#fff" />
          </TouchableOpacity>
        )}
        {activeTab !== 'dati' && <View style={{ width: 24 }} />}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dati' && styles.tabActive]}
          onPress={() => setActiveTab('dati')}
        >
          <Ionicons name="person" size={18} color={activeTab === 'dati' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'dati' && styles.tabTextActive]}>Dati</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pagamenti' && styles.tabActive]}
          onPress={() => setActiveTab('pagamenti')}
        >
          <Ionicons name="card" size={18} color={activeTab === 'pagamenti' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'pagamenti' && styles.tabTextActive]}>Pagamenti</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'presenze' && styles.tabActive]}
          onPress={() => setActiveTab('presenze')}
        >
          <Ionicons name="calendar" size={18} color={activeTab === 'presenze' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'presenze' && styles.tabTextActive]}>Presenze</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Withdrawn Banner */}
        {athlete.is_withdrawn && (
          <View style={styles.withdrawnBanner}>
            <Ionicons name="warning" size={24} color="#fff" />
            <View style={styles.withdrawnBannerText}>
              <Text style={styles.withdrawnBannerTitle}>ATLETA RITIRATO</Text>
              {athlete.withdrawn_reason && (
                <Text style={styles.withdrawnBannerSubtitle}>Motivo: {athlete.withdrawn_reason}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.reactivateButton}
              onPress={handleReactivateAthlete}
            >
              <Text style={styles.reactivateButtonText}>Riattiva</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DATI TAB */}
        {activeTab === 'dati' && (
          <>
            {/* Tesseramento */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏅 Tesseramento</Text>
              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Codice Federale</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.federal_code}
                    onChangeText={(t) => setEditData({...editData, federal_code: t.toUpperCase()})}
                    placeholder="Inserisci codice federale"
                    autoCapitalize="characters"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Tesserato</Text>
                    <Switch
                      value={editData.is_registered}
                      onValueChange={(v) => setEditData({...editData, is_registered: v})}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Codice Federale</Text>
                    <Text style={styles.valueCode}>{athlete.federal_code || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tesserato</Text>
                    <View style={[styles.badge, athlete.is_registered ? styles.badgeGreen : styles.badgeRed]}>
                      <Text style={styles.badgeText}>{athlete.is_registered ? 'SÌ' : 'NO'}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Anagrafica */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>👤 Anagrafica</Text>
              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Cognome</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.last_name}
                    onChangeText={(t) => setEditData({...editData, last_name: t.toUpperCase()})}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.inputLabel}>Nome</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.first_name}
                    onChangeText={(t) => setEditData({...editData, first_name: t.toUpperCase()})}
                    autoCapitalize="characters"
                  />
                  <View style={styles.row}>
                    <View style={styles.flex2}>
                      <Text style={styles.inputLabel}>Luogo di nascita</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.birth_place}
                        onChangeText={(t) => setEditData({...editData, birth_place: t.toUpperCase()})}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.inputLabel}>Prov.</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.birth_province}
                        onChangeText={(t) => setEditData({...editData, birth_province: t.toUpperCase()})}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  <Text style={styles.inputLabel}>Codice Fiscale</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.fiscal_code}
                    onChangeText={(t) => setEditData({...editData, fiscal_code: t.toUpperCase()})}
                    autoCapitalize="characters"
                    maxLength={16}
                  />
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.email}
                    onChangeText={(t) => setEditData({...editData, email: t.toLowerCase()})}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Tel. Atleta</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.phone_athlete}
                    onChangeText={(t) => setEditData({...editData, phone_athlete: t})}
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.inputLabel}>Tel. Madre</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.phone_mother}
                    onChangeText={(t) => setEditData({...editData, phone_mother: t})}
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.inputLabel}>Tel. Padre</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.phone_father}
                    onChangeText={(t) => setEditData({...editData, phone_father: t})}
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.inputLabel}>Indirizzo</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.address}
                    onChangeText={(t) => setEditData({...editData, address: t})}
                  />
                  <View style={styles.row}>
                    <View style={styles.flex1}>
                      <Text style={styles.inputLabel}>CAP</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.postal_code}
                        onChangeText={(t) => setEditData({...editData, postal_code: t})}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.flex2}>
                      <Text style={styles.inputLabel}>Città</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.city}
                        onChangeText={(t) => setEditData({...editData, city: t.toUpperCase()})}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.inputLabel}>Prov.</Text>
                      <TextInput
                        style={styles.input}
                        value={editData.province}
                        onChangeText={(t) => setEditData({...editData, province: t.toUpperCase()})}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveData}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Salva Modifiche</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Cognome</Text>
                    <Text style={styles.value}>{editData.last_name || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Nome</Text>
                    <Text style={styles.value}>{editData.first_name || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Luogo di nascita</Text>
                    <Text style={styles.value}>{athlete.birth_place || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Prov.</Text>
                    <Text style={styles.value}>{athlete.birth_province || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Cod. Fiscale</Text>
                    <Text style={[styles.value, styles.valueSmall]}>{athlete.fiscal_code || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Email</Text>
                    <Text style={styles.value}>{athlete.email || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tel. Atleta</Text>
                    <Text style={styles.value}>{athlete.phone_athlete || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tel. Madre</Text>
                    <Text style={styles.value}>{athlete.phone_mother || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Tel. Padre</Text>
                    <Text style={styles.value}>{athlete.phone_father || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Indirizzo</Text>
                    <Text style={styles.value}>{athlete.address || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>CAP</Text>
                    <Text style={styles.value}>{athlete.postal_code || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Città</Text>
                    <Text style={styles.value}>{athlete.city || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Provincia</Text>
                    <Text style={styles.value}>{athlete.province || '-'}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Squadra e Certificato */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏐 Squadra</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Squadra</Text>
                <Text style={styles.value}>{team?.name || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Iscrizione</Text>
                <Text style={styles.value}>{formatDate(athlete.registration_date)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>📋 Certificato Medico</Text>
              {certificate ? (
                <View style={styles.certRow}>
                  <Ionicons
                    name={isCertificateExpired ? 'close-circle' : 'checkmark-circle'}
                    size={24}
                    color={isCertificateExpired ? '#FF3B30' : '#34C759'}
                  />
                  <Text style={[styles.certText, { color: isCertificateExpired ? '#FF3B30' : '#34C759' }]}>
                    Scadenza: {formatDate(certificate.expiry_date)} {isCertificateExpired && '(SCADUTO)'}
                  </Text>
                </View>
              ) : (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color="#FF9500" />
                  <Text style={styles.warningText}>Nessun certificato</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.addCertButton}
                onPress={() => setCertModalVisible(true)}
              >
                <Ionicons name={certificate ? "create" : "add-circle"} size={18} color="#007AFF" />
                <Text style={styles.addCertButtonText}>
                  {certificate ? 'Aggiorna Certificato' : 'Aggiungi Certificato'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Withdraw Athlete Button */}
            {!athlete.is_withdrawn && (
              <TouchableOpacity
                style={styles.withdrawButton}
                onPress={() => setWithdrawModalVisible(true)}
              >
                <Ionicons name="remove-circle" size={20} color="#FF3B30" />
                <Text style={styles.withdrawButtonText}>Ritira Atleta dalla Squadra</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* PAGAMENTI TAB */}
        {activeTab === 'pagamenti' && (
          <>
            {/* Riepilogo Quote */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💰 Riepilogo Quote</Text>
              {paymentSummary && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Quota Totale</Text>
                    <Text style={styles.value}>€{paymentSummary.total_due}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>1ª Rata</Text>
                    <Text style={styles.value}>€{paymentSummary.installments.first}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>2ª Rata</Text>
                    <Text style={styles.value}>€{paymentSummary.installments.second}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>3ª Rata (con sconto)</Text>
                    <Text style={styles.value}>€{paymentSummary.installments.third}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Sconto */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎁 Sconto</Text>
              <Text style={styles.inputLabel}>Importo Sconto (€)</Text>
              <TextInput
                style={styles.input}
                value={editData.discount_amount}
                onChangeText={(t) => setEditData({...editData, discount_amount: t})}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={styles.inputLabel}>Nota Sconto</Text>
              <TextInput
                style={styles.input}
                value={editData.discount_note}
                onChangeText={(t) => setEditData({...editData, discount_note: t})}
                placeholder="Es: Sconto fratello"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveData}>
                <Text style={styles.saveBtnText}>Salva Sconto</Text>
              </TouchableOpacity>
              
              {paymentSummary && paymentSummary.discount > 0 && (
                <View style={styles.discountApplied}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.discountAppliedText}>
                    Sconto applicato: €{paymentSummary.discount}
                  </Text>
                </View>
              )}
            </View>

            {/* Totale Residuo */}
            {paymentSummary && (
              <View style={[styles.card, styles.residualCard]}>
                <View style={styles.residualRow}>
                  <Text style={styles.residualLabel}>Totale Pagato</Text>
                  <Text style={styles.residualValue}>€{paymentSummary.total_paid}</Text>
                </View>
                <View style={styles.residualRow}>
                  <Text style={styles.residualLabel}>Totale Dovuto</Text>
                  <Text style={styles.residualValue}>€{paymentSummary.total_after_discount}</Text>
                </View>
                <View style={[styles.residualRow, styles.residualTotal]}>
                  <Text style={styles.residualTotalLabel}>RESIDUO</Text>
                  <Text style={[styles.residualTotalValue, paymentSummary.residual === 0 && styles.residualZero]}>
                    €{paymentSummary.residual}
                  </Text>
                </View>
              </View>
            )}

            {/* Storico Pagamenti */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📜 Storico Pagamenti</Text>
                <TouchableOpacity 
                  style={styles.addPaymentBtn}
                  onPress={openNewPaymentModal}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addPaymentBtnText}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
              
              {payments.length === 0 ? (
                <View style={styles.emptyPayments}>
                  <Ionicons name="card-outline" size={32} color="#ccc" />
                  <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
                </View>
              ) : (
                payments.map((payment: any, index) => (
                  <View key={payment.id || index} style={styles.paymentItem}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentAmount}>€{payment.amount}</Text>
                      <Text style={styles.paymentDate}>
                        {payment.paid_date ? formatDate(payment.paid_date) : '-'}
                      </Text>
                      {payment.is_cash && (
                        <View style={styles.cashBadge}>
                          <Text style={styles.cashBadgeText}>CONTANTI</Text>
                        </View>
                      )}
                      {payment.notes && (
                        <Text style={styles.paymentNotes}>{payment.notes}</Text>
                      )}
                    </View>
                    <View style={styles.paymentActions}>
                      <TouchableOpacity 
                        style={styles.editPaymentBtn}
                        onPress={() => handleEditPayment(payment)}
                      >
                        <Ionicons name="pencil" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeletePayment(payment.id)}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* PRESENZE TAB */}
        {activeTab === 'presenze' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Statistiche Presenze</Text>
            {stats ? (
              <>
                <View style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    <Text style={styles.statLabel}>Settimana</Text>
                  </View>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stats.weekly_attendances} presenze</Text>
                    <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.weekly_percentage) + '20' }]}>
                      <Text style={[styles.percentText, { color: getPercentageColor(stats.weekly_percentage) }]}>
                        {stats.weekly_percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Ionicons name="calendar" size={20} color="#FF9500" />
                    <Text style={styles.statLabel}>Mese</Text>
                  </View>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stats.monthly_attendances} presenze</Text>
                    <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.monthly_percentage) + '20' }]}>
                      <Text style={[styles.percentText, { color: getPercentageColor(stats.monthly_percentage) }]}>
                        {stats.monthly_percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Ionicons name="stats-chart" size={20} color="#5856D6" />
                    <Text style={styles.statLabel}>Totale</Text>
                  </View>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stats.total_attendances} presenze</Text>
                    <View style={[styles.percentBadge, { backgroundColor: getPercentageColor(stats.total_percentage) + '20' }]}>
                      <Text style={[styles.percentText, { color: getPercentageColor(stats.total_percentage) }]}>
                        {stats.total_percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyPayments}>
                <Ionicons name="calendar-outline" size={32} color="#ccc" />
                <Text style={styles.emptyText}>Nessuna statistica</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPaymentModalVisible(false);
          setEditingPaymentId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingPaymentId ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
            </Text>
            
            <Text style={styles.inputLabel}>Importo (€) *</Text>
            <TextInput
              style={styles.input}
              value={newPayment.amount}
              onChangeText={(t) => setNewPayment({...newPayment, amount: t})}
              keyboardType="decimal-pad"
              placeholder="Es: 150"
            />
            
            <Text style={styles.inputLabel}>Data Pagamento (gg/mm/aaaa) *</Text>
            <TextInput
              style={styles.input}
              value={newPayment.paid_date}
              onChangeText={(t) => setNewPayment({...newPayment, paid_date: formatDateInput(t)})}
              placeholder="Es: 15/01/2025"
              keyboardType="number-pad"
              maxLength={10}
            />
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Pagamento in Contanti</Text>
              <Switch
                value={newPayment.is_cash}
                onValueChange={(v) => setNewPayment({...newPayment, is_cash: v})}
              />
            </View>
            
            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={styles.input}
              value={newPayment.notes}
              onChangeText={(t) => setNewPayment({...newPayment, notes: t})}
              placeholder="Note opzionali"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setEditingPaymentId(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingPayment && { opacity: 0.7 }]}
                onPress={handleAddPayment}
                disabled={savingPayment}
              >
                <Text style={styles.saveBtnText}>
                  {savingPayment ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="remove-circle" size={32} color="#FF3B30" />
              <Text style={styles.modalTitleDanger}>Ritira Atleta</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              L'atleta non sarà più visibile nella squadra e non potrà accedere agli allenamenti.
            </Text>
            <Text style={styles.inputLabel}>Motivo del ritiro (opzionale)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Es: Trasferimento ad altra squadra"
              value={withdrawReason}
              onChangeText={setWithdrawReason}
              multiline
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setWithdrawModalVisible(false);
                  setWithdrawReason('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleWithdrawAthlete}
                disabled={withdrawing}
              >
                <Text style={styles.modalButtonDangerText}>
                  {withdrawing ? 'Ritiro...' : 'Conferma Ritiro'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Certificate Modal */}
      <Modal
        visible={certModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {certificate ? 'Aggiorna Certificato Medico' : 'Aggiungi Certificato Medico'}
            </Text>
            
            <Text style={styles.inputLabel}>Data Scadenza (GG/MM/AAAA)</Text>
            <TextInput
              style={styles.modalInput}
              value={certExpiryDate}
              onChangeText={formatDateInput}
              placeholder="31/12/2025"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
            />
            
            <Text style={styles.inputLabel}>Foto Certificato (opzionale)</Text>
            <TouchableOpacity style={styles.certImageBtn} onPress={pickCertImage}>
              {certImage ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${certImage}` }} 
                  style={styles.certImagePreview} 
                />
              ) : (
                <View style={styles.certImagePlaceholder}>
                  <Ionicons name="camera" size={24} color="#007AFF" />
                  <Text style={styles.certImageText}>Carica foto</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setCertModalVisible(false);
                  setCertExpiryDate('');
                  setCertImage(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveCertificate}
                disabled={savingCert}
              >
                <Text style={styles.saveButtonText}>
                  {savingCert ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, color: '#666', marginLeft: 6 },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  content: { flex: 1 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666', flex: 1 },
  value: { fontSize: 14, fontWeight: '500', color: '#333', flex: 1, textAlign: 'right' },
  valueCode: { fontSize: 14, fontWeight: '600', color: '#007AFF', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  valueSmall: { fontSize: 12 },
  inputLabel: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 14, color: '#333' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeRed: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 6 },
  certRow: { flexDirection: 'row', alignItems: 'center' },
  certText: { fontSize: 14, marginLeft: 8, fontWeight: '500' },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8 },
  warningText: { fontSize: 14, color: '#FF9500', marginLeft: 8 },
  residualCard: { backgroundColor: '#F5F5F5' },
  residualRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  residualLabel: { fontSize: 14, color: '#666' },
  residualValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  residualTotal: { borderTopWidth: 2, borderTopColor: '#007AFF', marginTop: 8, paddingTop: 12 },
  residualTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  residualTotalValue: { fontSize: 20, fontWeight: 'bold', color: '#FF3B30' },
  residualZero: { color: '#34C759' },
  discountApplied: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  discountAppliedText: { fontSize: 13, color: '#34C759', marginLeft: 6 },
  addPaymentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addPaymentBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  emptyPayments: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#999', marginTop: 8 },
  paymentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  paymentInfo: { flex: 1 },
  paymentActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editPaymentBtn: { padding: 4 },
  paymentAmount: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  paymentDate: { fontSize: 13, color: '#666', marginTop: 2 },
  paymentNotes: { fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' },
  cashBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  cashBadgeText: { fontSize: 10, color: '#FF9500', fontWeight: 'bold' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statInfo: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { fontSize: 14, color: '#333', marginLeft: 10 },
  statValues: { alignItems: 'flex-end' },
  statCount: { fontSize: 13, color: '#666' },
  percentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  percentText: { fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  modalTitleDanger: { fontSize: 20, fontWeight: 'bold', color: '#FF3B30', textAlign: 'center', marginTop: 12 },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#f5f5f5' },
  modalButtonCancelText: { fontSize: 16, color: '#666', fontWeight: '600' },
  modalButtonDanger: { backgroundColor: '#FF3B30' },
  modalButtonDangerText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  modalHeader: { alignItems: 'center', marginBottom: 12 },
  modalInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  cancelBtn: { flex: 1, padding: 14, backgroundColor: '#f5f5f5', borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, color: '#666' },
  // Withdrawn styles
  withdrawnBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12 },
  withdrawnBannerText: { flex: 1, marginLeft: 12 },
  withdrawnBannerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  withdrawnBannerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  reactivateButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  reactivateButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  withdrawButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F0', marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2' },
  withdrawButtonText: { color: '#FF3B30', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  addCertButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F2FD', marginTop: 12, padding: 10, borderRadius: 8 },
  addCertButtonText: { color: '#007AFF', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 12 },
  certImageBtn: { backgroundColor: '#f5f5f5', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', marginBottom: 16, overflow: 'hidden' },
  certImagePlaceholder: { height: 80, justifyContent: 'center', alignItems: 'center' },
  certImageText: { color: '#007AFF', fontSize: 12, marginTop: 4 },
  certImagePreview: { width: '100%', height: 120, resizeMode: 'cover' },
  cancelButton: { backgroundColor: '#f5f5f5' },
  cancelButtonText: { fontSize: 16, color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#007AFF' },
  saveButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
