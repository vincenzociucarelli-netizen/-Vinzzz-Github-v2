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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';

interface Dirigente {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
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
  monthly_compensation?: number;
  compensation_accepted?: boolean;
  compensation_history?: { [key: string]: boolean };
  over_5000_limit?: { [key: string]: boolean };
  // Document fields
  id_type?: string;
  id_front?: string;
  id_back?: string;
  doc_front_image?: string;
  doc_back_image?: string;
  iban?: string;
  account_holder?: string;
  bank_name?: string;
}

export default function AdminDirigenteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dirigente, setDirigente] = useState<Dirigente | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  
  // Image viewer modal
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageTitle, setViewingImageTitle] = useState('');
  
  // Edit state
  const [monthlyCompensation, setMonthlyCompensation] = useState('');
  // Bank details
  const [documentType, setDocumentType] = useState('');
  const [documentFront, setDocumentFront] = useState('');
  const [documentBack, setDocumentBack] = useState('');
  const [iban, setIban] = useState('');
  const [ibanHolder, setIbanHolder] = useState('');
  const [bankName, setBankName] = useState('');

  const openImageViewer = (imageBase64: string, title: string) => {
    setViewingImage(imageBase64);
    setViewingImageTitle(title);
    setImageViewerVisible(true);
  };

  const loadData = async () => {
    try {
      const response = await api.get(`/users/${id}`);
      setDirigente(response.data);
      setMonthlyCompensation(response.data.monthly_compensation?.toString() || '0');
      setDocumentType(response.data.document_type || '');
      setDocumentFront(response.data.document_front || '');
      setDocumentBack(response.data.document_back || '');
      setIban(response.data.iban || '');
      setIbanHolder(response.data.iban_holder || '');
      setBankName(response.data.bank_name || '');
    } catch (error) {
      console.error('Error loading dirigente data:', error);
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

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (side === 'front') {
          setDocumentFront(result.assets[0].base64);
        } else {
          setDocumentBack(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSaveBankDetails = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${id}/bank-details`, {
        document_type: documentType,
        document_front: documentFront,
        document_back: documentBack,
        iban: iban.toUpperCase().replace(/\s/g, ''),
        iban_holder: ibanHolder.toUpperCase(),
        bank_name: bankName.toUpperCase(),
      });
      showAlert('Successo', 'Dati bancari aggiornati con successo');
      setEditingBank(false);
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
  const hasExceeded5000 = dirigente?.over_5000_limit && 
    Object.values(dirigente.over_5000_limit).some(v => v === true);

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
          <ActivityIndicator size="large" color="#8E44AD" />
        </View>
      </View>
    );
  }

  if (!dirigente) {
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
          <Text>Dirigente non trovato</Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>{dirigente.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(dirigente.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(dirigente.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(dirigente.status) }]}>
            {getStatusLabel(dirigente.status)}
          </Text>
        </View>

        {/* €5000 Alert */}
        {hasExceeded5000 && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={24} color="#FF3B30" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>⚠️ SUPERAMENTO €5.000</Text>
              <Text style={styles.alertText}>
                Il dirigente ha dichiarato di aver superato il limite di €5.000 annui.
              </Text>
            </View>
          </View>
        )}

        {/* Dati Personali */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Dati Personali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{dirigente.first_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Cognome</Text>
            <Text style={styles.value}>{dirigente.last_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Data di nascita</Text>
            <Text style={styles.value}>{formatDate(dirigente.date_of_birth)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Luogo di nascita</Text>
            <Text style={styles.value}>{dirigente.place_of_birth || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{dirigente.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Telefono</Text>
            <Text style={styles.value}>{dirigente.phone || '-'}</Text>
          </View>
        </View>

        {/* Indirizzo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏠 Indirizzo</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Via</Text>
            <Text style={styles.value}>{dirigente.address || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>CAP</Text>
            <Text style={styles.value}>{dirigente.postal_code || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Città</Text>
            <Text style={styles.value}>{dirigente.city || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Provincia</Text>
            <Text style={styles.value}>{dirigente.province || '-'}</Text>
          </View>
        </View>

        {/* Dati Fiscali */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Codice Fiscale</Text>
            <Text style={[styles.value, styles.valueCode]}>{dirigente.fiscal_code || '-'}</Text>
          </View>
        </View>

        {/* Compenso */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💰 Compenso Mensile</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Ionicons name={editing ? "close" : "create"} size={22} color="#8E44AD" />
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
              <Text style={styles.compensationAmount}>€{dirigente.monthly_compensation || 0}</Text>
              <Text style={styles.compensationPeriod}>/mese</Text>
            </View>
          )}

          {dirigente.compensation_accepted && (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.acceptedText}>Accettato dal dirigente</Text>
            </View>
          )}
        </View>

        {/* Storico Compensi */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Storico Pagamenti Stagione</Text>
          <Text style={styles.historySubtitle}>Mesi segnati come pagati dal dirigente</Text>
          
          {seasonMonths.map((month) => {
            const isPaid = dirigente.compensation_history?.[month.key] === true;
            const exceeded = dirigente.over_5000_limit?.[month.key] === true;
            
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

        {/* Documenti e IBAN - Solo per utenti approvati */}
        {dirigente.status === 'approved' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🏦 Documento e Dati Bancari</Text>
              <TouchableOpacity onPress={() => setEditingBank(!editingBank)}>
                <Ionicons name={editingBank ? "close" : "create"} size={22} color="#8E44AD" />
              </TouchableOpacity>
            </View>

            {editingBank ? (
              <>
                <Text style={styles.inputLabel}>Tipo Documento</Text>
                <View style={styles.docTypeButtons}>
                  {['C.I.', 'Passaporto', 'Patente'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.docTypeBtn, documentType === type && styles.docTypeBtnActive]}
                      onPress={() => setDocumentType(type)}
                    >
                      <Text style={[styles.docTypeBtnText, documentType === type && styles.docTypeBtnTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Documento Fronte</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('front')}>
                  {documentFront ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${documentFront}` }} style={styles.docPreview} />
                  ) : (
                    <>
                      <Ionicons name="camera" size={24} color="#8E44AD" />
                      <Text style={styles.uploadBtnText}>Carica Fronte</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Documento Retro</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('back')}>
                  {documentBack ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${documentBack}` }} style={styles.docPreview} />
                  ) : (
                    <>
                      <Ionicons name="camera" size={24} color="#8E44AD" />
                      <Text style={styles.uploadBtnText}>Carica Retro</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.inputLabel}>IBAN</Text>
                <TextInput
                  style={styles.input}
                  value={iban}
                  onChangeText={(text) => setIban(text.toUpperCase())}
                  placeholder="IT00X0000000000000000000000"
                  autoCapitalize="characters"
                />

                <Text style={styles.inputLabel}>Intestatario Conto</Text>
                <TextInput
                  style={styles.input}
                  value={ibanHolder}
                  onChangeText={(text) => setIbanHolder(text.toUpperCase())}
                  placeholder="NOME COGNOME"
                  autoCapitalize="characters"
                />

                <Text style={styles.inputLabel}>Nome Banca</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={(text) => setBankName(text.toUpperCase())}
                  placeholder="ES. UNICREDIT, INTESA SANPAOLO"
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSaveBankDetails}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Salvataggio...' : 'Salva Dati Bancari'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Tipo Documento</Text>
                  <Text style={styles.value}>{dirigente.document_type || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Documento</Text>
                  <Text style={styles.value}>
                    {dirigente.doc_front_image ? '✅ Caricato' : '❌ Mancante'}
                  </Text>
                </View>
                {(dirigente.doc_front_image || dirigente.doc_back_image) && (
                  <View style={styles.docImagesRow}>
                    {dirigente.doc_front_image && (
                      <View style={styles.docImageContainer}>
                        <Text style={styles.docImageLabel}>Fronte</Text>
                        <Image source={{ uri: `data:image/jpeg;base64,${dirigente.doc_front_image}` }} style={styles.docThumb} />
                      </View>
                    )}
                    {dirigente.doc_back_image && (
                      <View style={styles.docImageContainer}>
                        <Text style={styles.docImageLabel}>Retro</Text>
                        <Image source={{ uri: `data:image/jpeg;base64,${dirigente.doc_back_image}` }} style={styles.docThumb} />
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.label}>IBAN</Text>
                  <Text style={[styles.value, styles.valueCode]}>{dirigente.iban || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Intestatario</Text>
                  <Text style={styles.value}>{dirigente.account_holder || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Banca</Text>
                  <Text style={styles.value}>{dirigente.bank_name || '-'}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Date Registrazione */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Informazioni Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Registrato il</Text>
            <Text style={styles.value}>{formatDate(dirigente.created_at)}</Text>
          </View>
          {dirigente.approved_at && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Approvato il</Text>
              <Text style={styles.value}>{formatDate(dirigente.approved_at)}</Text>
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
    backgroundColor: '#8E44AD',
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
  valueCode: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#8E44AD' },
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
    backgroundColor: '#8E44AD', 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 16 
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  compensationDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 16 },
  compensationAmount: { fontSize: 36, fontWeight: 'bold', color: '#8E44AD' },
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
  docTypeButtons: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  docTypeBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    backgroundColor: '#f5f5f5', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  docTypeBtnActive: { backgroundColor: '#F3E5F5', borderColor: '#8E44AD' },
  docTypeBtnText: { fontSize: 14, color: '#666' },
  docTypeBtnTextActive: { color: '#8E44AD', fontWeight: '600' },
  uploadBtn: { 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginBottom: 8,
    minHeight: 100,
  },
  uploadBtnText: { color: '#8E44AD', marginTop: 8 },
  docPreview: { width: '100%', height: 150, borderRadius: 8 },
  docImagesRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  docThumb: { width: 100, height: 70, borderRadius: 6 },
  docImageContainer: { alignItems: 'center' },
  docImageLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
});
