import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

const DOC_TYPES = ['Carta Identità', 'Passaporto', 'Patente Auto'];

export default function DirigenteProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  
  // Document images
  const [docFrontImage, setDocFrontImage] = useState<string | null>(null);
  const [docBackImage, setDocBackImage] = useState<string | null>(null);
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    monthly_compensation: 0,
    compensation_accepted: false,
    // Documento e Dati Bancari
    id_type: '',
    id_front: '',
    id_back: '',
    iban: '',
    account_holder: '',
    bank_name: '',
    doc_front_image: '',
    doc_back_image: '',
  });

  const [editData, setEditData] = useState({ ...profileData });
  const [compensationHistory, setCompensationHistory] = useState<{[key: string]: boolean}>({});
  const [over5000Limit, setOver5000Limit] = useState<{[key: string]: boolean}>({});
  const [hasExceeded5000, setHasExceeded5000] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (side === 'front') {
          setDocFrontImage(result.assets[0].base64);
          setEditData({...editData, doc_front_image: result.assets[0].base64});
        } else {
          setDocBackImage(result.assets[0].base64);
          setEditData({...editData, doc_back_image: result.assets[0].base64});
        }
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  // Generate season months (July to June)
  const getSeasonMonths = () => {
    const now = new Date();
    const currentYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const months = [];
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    for (let i = 0; i < 12; i++) {
      const monthIndex = (6 + i) % 12;
      const year = monthIndex >= 6 ? currentYear : currentYear + 1;
      months.push({
        key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        label: `${monthNames[monthIndex]} ${year}`,
      });
    }
    return months;
  };

  const loadProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const data = response.data;
      setProfileData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
      });
      setEditData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
      });
      // Load compensation history
      setCompensationHistory(data.compensation_history || {});
      setOver5000Limit(data.over_5000_limit || {});
      // Check if any month has exceeded €5000
      const exceeded = data.over_5000_limit && Object.values(data.over_5000_limit).some((v: any) => v === true);
      setHasExceeded5000(exceeded || false);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert date to ISO format
      let isoDate = null;
      if (editData.date_of_birth) {
        const parts = editData.date_of_birth.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      await api.patch('/auth/me', {
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`,
        date_of_birth: isoDate,
        place_of_birth: editData.place_of_birth,
        fiscal_code: editData.fiscal_code,
        address: editData.address,
        city: editData.city,
        postal_code: editData.postal_code,
        province: editData.province,
        phone: editData.phone,
      });
      
      showAlert('Successo', 'Profilo aggiornato con successo');
      setEditing(false);
      await loadProfile();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
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

  const handleAcceptCompensation = async () => {
    try {
      await api.patch('/auth/me', { compensation_accepted: true });
      showAlert('Successo', 'Compenso accettato con successo');
      await loadProfile();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
    }
  };

  const handleToggleMonth = async (monthKey: string) => {
    const newHistory = { ...compensationHistory };
    newHistory[monthKey] = !newHistory[monthKey];
    setCompensationHistory(newHistory);
    
    try {
      await api.patch('/auth/me', { compensation_history: newHistory });
    } catch (error: any) {
      // Revert on error
      setCompensationHistory(compensationHistory);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleToggle5000Limit = async () => {
    const newValue = !hasExceeded5000;
    setHasExceeded5000(newValue);
    
    // Set current month as the exceeded month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const newLimit = { ...over5000Limit };
    newLimit[currentMonthKey] = newValue;
    setOver5000Limit(newLimit);
    
    try {
      await api.patch('/auth/me', { over_5000_limit: newLimit });
      if (newValue) {
        showAlert('Attenzione', 'La tua dichiarazione è stata registrata. L\'amministratore riceverà una notifica.');
      }
    } catch (error: any) {
      // Revert on error
      setHasExceeded5000(!newValue);
      setOver5000Limit(over5000Limit);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const renderField = (label: string, value: string, key: string, editable: boolean = true) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing && editable ? (
        <TextInput
          style={styles.input}
          value={editData[key as keyof typeof editData]?.toString() || ''}
          onChangeText={(text) => setEditData({ ...editData, [key]: text.toUpperCase() })}
          autoCapitalize="characters"
        />
      ) : (
        <Text style={styles.fieldValue}>{value || '-'}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Edit/Save Buttons */}
        <View style={styles.actionButtons}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setEditing(false);
                  setEditData({ ...profileData });
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="pencil" size={20} color="#8E44AD" />
              <Text style={styles.editButtonText}>Modifica Dati</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Account</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profileData.email}</Text>
          </View>
        </View>

        {/* Personal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
          {renderField('Nome', profileData.first_name, 'first_name')}
          {renderField('Cognome', profileData.last_name, 'last_name')}
          {renderField('Data di Nascita', profileData.date_of_birth, 'date_of_birth')}
          {renderField('Luogo di Nascita', profileData.place_of_birth, 'place_of_birth')}
          {renderField('Indirizzo', profileData.address, 'address')}
          {renderField('Città', profileData.city, 'city')}
          {renderField('Provincia', profileData.province, 'province')}
          {renderField('CAP', profileData.postal_code, 'postal_code')}
          {renderField('Telefono', profileData.phone, 'phone')}
        </View>

        {/* Fiscal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          {renderField('Codice Fiscale', profileData.fiscal_code, 'fiscal_code')}
        </View>

        {/* Compensation Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Compenso</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Compenso Mensile</Text>
            <Text style={styles.compensationAmount}>
              {profileData.monthly_compensation > 0 
                ? `€ ${profileData.monthly_compensation.toFixed(2)}`
                : 'Non ancora impostato'}
            </Text>
          </View>
          
          {profileData.monthly_compensation > 0 && !profileData.compensation_accepted && (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptCompensation}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>Accetta Compenso</Text>
            </TouchableOpacity>
          )}

          {profileData.compensation_accepted && (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.acceptedBadgeText}>Compenso Accettato</Text>
            </View>
          )}
        </View>

        {/* Monthly Payment Tracking */}
        {profileData.monthly_compensation > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Registro Pagamenti Mensili</Text>
            <Text style={styles.cardSubtitle}>
              Indica i mesi in cui hai ricevuto il compenso
            </Text>
            
            {getSeasonMonths().map((month) => {
              const isPaid = compensationHistory[month.key] === true;
              
              return (
                <View key={month.key} style={styles.monthRow}>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>{month.label}</Text>
                  </View>
                  <View style={styles.monthActions}>
                    <TouchableOpacity
                      style={[styles.monthCheckbox, isPaid && styles.monthCheckboxActive]}
                      onPress={() => handleToggleMonth(month.key)}
                    >
                      {isPaid && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                    <Text style={[styles.monthStatusText, isPaid && styles.monthStatusTextPaid]}>
                      {isPaid ? 'PAGATO' : 'NON PAGATO'}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* €5000 Limit Declaration */}
            <View style={styles.limitSection}>
              <Text style={styles.limitTitle}>⚠️ Dichiarazione Superamento €5.000</Text>
              <Text style={styles.limitDescription}>
                Se il totale dei compensi ricevuti nell'anno SOLARE (dal 01/01 al 31/12) supera €5.000, 
                devi segnalarlo per gli adempimenti fiscali previsti dalla legge.
              </Text>
              <TouchableOpacity
                style={[styles.limitCheckbox, hasExceeded5000 && styles.limitCheckboxActive]}
                onPress={handleToggle5000Limit}
              >
                <View style={[styles.checkbox, hasExceeded5000 && styles.checkboxActive]}>
                  {hasExceeded5000 && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.limitCheckboxText}>
                  Dichiaro di aver superato il limite di €5.000 annui
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Documento e Dati Bancari */}
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
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editData.id_type}
                  onValueChange={(v) => setEditData({...editData, id_type: v})}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleziona..." value="" />
                  {DOC_TYPES.map((type) => (
                    <Picker.Item key={type} label={type} value={type} />
                  ))}
                </Picker>
              </View>
              
              <Text style={styles.inputLabel}>Numero Documento</Text>
              <TextInput
                style={styles.input}
                value={editData.id_front}
                onChangeText={(v) => setEditData({...editData, id_front: v})}
                placeholder="es. AX1234567"
                placeholderTextColor="#ccc"
              />
              
              <Text style={styles.inputLabel}>Scadenza Documento</Text>
              <TextInput
                style={styles.input}
                value={editData.id_back}
                onChangeText={(v) => {
                  let formatted = v.replace(/[^0-9]/g, '');
                  if (formatted.length > 2) {
                    formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                  }
                  if (formatted.length > 5) {
                    formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                  }
                  setEditData({...editData, id_back: formatted});
                }}
                placeholder="gg/mm/aaaa"
                placeholderTextColor="#ccc"
                maxLength={10}
                keyboardType="numeric"
              />
              
              {/* Foto Documento - Due icone in una riga */}
              <Text style={styles.inputLabel}>Foto Documento</Text>
              <View style={styles.docImagesRow}>
                <TouchableOpacity style={styles.docImageBtnSmall} onPress={() => pickImage('front')}>
                  {(docFrontImage || editData.doc_front_image) ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${docFrontImage || editData.doc_front_image}` }} 
                      style={styles.docImageSmall} 
                    />
                  ) : (
                    <View style={styles.docImagePlaceholderSmall}>
                      <Ionicons name="card-outline" size={24} color="#007AFF" />
                      <Text style={styles.docImageTextSmall}>Fronte</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.docImageBtnSmall} onPress={() => pickImage('back')}>
                  {(docBackImage || editData.doc_back_image) ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${docBackImage || editData.doc_back_image}` }} 
                      style={styles.docImageSmall} 
                    />
                  ) : (
                    <View style={styles.docImagePlaceholderSmall}>
                      <Ionicons name="card-outline" size={24} color="#007AFF" />
                      <Text style={styles.docImageTextSmall}>Retro</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>IBAN</Text>
              <TextInput
                style={styles.input}
                value={editData.iban}
                onChangeText={(v) => setEditData({...editData, iban: v.toUpperCase()})}
                placeholder="es. IT60X0542811101000000123456"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <Text style={styles.inputLabel}>Intestatario Conto</Text>
              <TextInput
                style={styles.input}
                value={editData.account_holder}
                onChangeText={(v) => setEditData({...editData, account_holder: v})}
                placeholder="es. Intestazione del conto"
                placeholderTextColor="#ccc"
              />
              
              <Text style={styles.inputLabel}>Nome Banca</Text>
              <TextInput
                style={styles.input}
                value={editData.bank_name}
                onChangeText={(v) => setEditData({...editData, bank_name: v})}
                placeholder="es. Intesa Sanpaolo"
                placeholderTextColor="#ccc"
              />
              
              <TouchableOpacity
                style={[styles.saveBankButtonFixed, savingBank && styles.saveButtonDisabled]}
                onPress={async () => {
                  setSavingBank(true);
                  try {
                    await api.patch('/users/me/bank-details', {
                      id_type: editData.id_type,
                      id_front: editData.id_front,
                      id_back: editData.id_back,
                      iban: editData.iban,
                      account_holder: editData.account_holder,
                      bank_name: editData.bank_name,
                      doc_front_image: docFrontImage || editData.doc_front_image,
                      doc_back_image: docBackImage || editData.doc_back_image,
                    });
                    setProfileData({
                      ...profileData,
                      id_type: editData.id_type,
                      id_front: editData.id_front,
                      id_back: editData.id_back,
                      iban: editData.iban,
                      account_holder: editData.account_holder,
                      bank_name: editData.bank_name,
                      doc_front_image: docFrontImage || editData.doc_front_image || '',
                      doc_back_image: docBackImage || editData.doc_back_image || '',
                    });
                    setEditingBank(false);
                    showAlert('Salvato', 'Dati bancari aggiornati');
                  } catch (error: any) {
                    showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
                  } finally {
                    setSavingBank(false);
                  }
                }}
                disabled={savingBank}
              >
                <Text style={styles.saveBankButtonText}>
                  {savingBank ? 'Salvataggio...' : '💾 SALVA DATI BANCARI'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tipo Documento</Text>
                <Text style={styles.fieldValue}>{profileData.id_type || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Numero Documento</Text>
                <Text style={styles.fieldValue}>{profileData.id_front || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Scadenza</Text>
                <Text style={styles.fieldValue}>{profileData.id_back || '-'}</Text>
              </View>
              {profileData.doc_front_image && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Documento Fronte</Text>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${profileData.doc_front_image}` }} 
                    style={styles.docImage} 
                  />
                </View>
              )}
              {profileData.doc_back_image && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Documento Retro</Text>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${profileData.doc_back_image}` }} 
                    style={styles.docImage} 
                  />
                </View>
              )}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>IBAN</Text>
                <Text style={styles.fieldValue}>{profileData.iban || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Intestatario</Text>
                <Text style={styles.fieldValue}>{profileData.account_holder || '-'}</Text>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Banca</Text>
                <Text style={styles.fieldValue}>{profileData.bank_name || '-'}</Text>
              </View>
            </>
          )}
        </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#8E44AD',
    paddingTop: 50,
    paddingBottom: 20,
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
  content: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#F3E5F5',
  },
  editButtonText: {
    color: '#8E44AD',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  docImagesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  docImageBtnSmall: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    height: 80,
  },
  docImagePlaceholderSmall: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  docImageTextSmall: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
  },
  docImageSmall: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  compensationAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8E44AD',
    marginTop: 4,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  acceptedBadgeText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  monthInfo: {
    flex: 1,
  },
  monthLabel: {
    fontSize: 15,
    color: '#333',
  },
  monthActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthCheckboxActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  monthStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    width: 80,
  },
  monthStatusTextPaid: {
    color: '#34C759',
  },
  limitSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  limitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 8,
  },
  limitDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  limitCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    gap: 10,
  },
  limitCheckboxActive: {
    backgroundColor: '#FFEBEE',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FF9500',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  limitCheckboxText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
});
