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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../../src/constants/countries';

export default function AdminProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Profile photo states
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoArtistic, setProfilePhotoArtistic] = useState<string | null>(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  
  // Qualifications and teams
  const [dirigenteQualifications, setDirigenteQualifications] = useState<string[]>([]);
  const [assignedTeamNames, setAssignedTeamNames] = useState<string[]>([]);
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    country_of_birth: DEFAULT_COUNTRY,
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    qualification: '',
    monthly_compensation: 0,
    compensation_accepted: false,
    // Document and Bank details
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
  
  // Document images (for upload)
  const [docFrontImage, setDocFrontImage] = useState<string | null>(null);
  const [docBackImage, setDocBackImage] = useState<string | null>(null);
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  
  const [compensationHistory, setCompensationHistory] = useState<{[key: string]: boolean}>({});
  const [over5000Limit, setOver5000Limit] = useState<{[key: string]: boolean}>({});
  const [hasExceeded5000, setHasExceeded5000] = useState(false);

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
        country_of_birth: data.country_of_birth || DEFAULT_COUNTRY,
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        qualification: data.qualification || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        // Document and Bank details
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
        doc_front_image: data.doc_front_image || '',
        doc_back_image: data.doc_back_image || '',
      });
      setEditData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        country_of_birth: data.country_of_birth || DEFAULT_COUNTRY,
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        qualification: data.qualification || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        // Document and Bank details
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
        doc_front_image: data.doc_front_image || '',
        doc_back_image: data.doc_back_image || '',
      });
      // Load document images
      setDocFrontImage(data.doc_front_image || null);
      setDocBackImage(data.doc_back_image || null);
      setCompensationHistory(data.compensation_history || {});
      setOver5000Limit(data.over_5000_limit || {});
      const exceeded = data.over_5000_limit && Object.values(data.over_5000_limit).some((v: any) => v === true);
      setHasExceeded5000(exceeded || false);
      // Load profile photos
      setProfilePhoto(data.profile_photo || null);
      setProfilePhotoArtistic(data.profile_photo_artistic || null);
      
      // Load assigned team names
      if (data.assigned_teams && data.assigned_teams.length > 0) {
        try {
          const teamsResponse = await api.get('/teams');
          const teams = teamsResponse.data;
          const teamNames = data.assigned_teams.map((teamId: string) => {
            const team = teams.find((t: any) => t.id === teamId);
            return team ? team.name : 'Squadra sconosciuta';
          });
          setAssignedTeamNames(teamNames);
        } catch (err) {
          console.error('Error loading teams:', err);
        }
      }
      
      // Load society settings for qualifications
      try {
        const settingsResponse = await api.get('/settings/society');
        setDirigenteQualifications(settingsResponse.data.dirigente_qualifications || []);
      } catch (err) {
        console.error('Error loading settings:', err);
      }
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

  // Pick document image
  const pickDocImage = async (side: 'front' | 'back') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('Permesso negato', 'È necessario concedere il permesso per accedere alla galleria');
        return;
      }

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

  const handleSave = async () => {
    setSaving(true);
    try {
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
        country_of_birth: editData.country_of_birth,
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
      setCompensationHistory(compensationHistory);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleToggle5000Limit = async () => {
    const newValue = !hasExceeded5000;
    setHasExceeded5000(newValue);
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const newLimit = { ...over5000Limit };
    newLimit[currentMonthKey] = newValue;
    setOver5000Limit(newLimit);
    
    try {
      await api.patch('/auth/me', { over_5000_limit: newLimit });
      if (newValue) {
        showAlert('Attenzione', 'La tua dichiarazione è stata registrata.');
      }
    } catch (error: any) {
      setHasExceeded5000(!newValue);
      setOver5000Limit(over5000Limit);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const renderField = (label: string, value: string, key: string, editable: boolean = true) => {
    const isProvinceField = key === 'province' || key.toLowerCase().includes('province');
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}{isProvinceField && editing ? ' (2 lettere)' : ''}</Text>
        {editing && editable ? (
          <TextInput
            style={styles.input}
            value={editData[key as keyof typeof editData]?.toString() || ''}
            onChangeText={(text) => setEditData({ ...editData, [key]: text.toUpperCase() })}
            autoCapitalize="characters"
            maxLength={isProvinceField ? 2 : undefined}
            placeholder={isProvinceField ? 'es. PG' : undefined}
            placeholderTextColor="#999"
          />
        ) : (
          <Text style={styles.fieldValue}>{value || '-'}</Text>
        )}
      </View>
    );
  };

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
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <View style={{ width: 24 }} />
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
              <Ionicons name="pencil" size={20} color="#007AFF" />
              <Text style={styles.editButtonText}>Modifica Dati</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Photo Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📸 Foto Profilo</Text>
          <View style={styles.profilePhotoContainer}>
            {transformingPhoto ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.transformingText}>Creando ritratto artistico...</Text>
              </View>
            ) : profilePhotoArtistic ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profilePhotoArtistic}` }}
                style={styles.profilePhotoLarge}
              />
            ) : profilePhoto ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profilePhoto}` }}
                style={styles.profilePhotoLarge}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={64} color="#ccc" />
                <Text style={styles.photoPlaceholderText}>Nessuna foto</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.uploadPhotoButton, transformingPhoto && styles.buttonDisabled]}
              onPress={async () => {
                try {
                  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permissionResult.granted) {
                    showAlert('Permesso negato', 'È necessario concedere il permesso per accedere alla galleria');
                    return;
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7,
                    base64: true,
                  });

                  if (!result.canceled && result.assets[0].base64) {
                    const originalPhoto = result.assets[0].base64;
                    setProfilePhoto(originalPhoto);
                    setTransformingPhoto(true);
                    
                    try {
                      const response = await api.post('/auth/me/transform-photo', {
                        image_base64: originalPhoto
                      });
                      
                      if (response.data.success && response.data.artistic_photo) {
                        setProfilePhotoArtistic(response.data.artistic_photo);
                        showAlert('✅ Foto Trasformata', 'La tua foto è stata trasformata in stile pastello!');
                      } else {
                        setProfilePhotoArtistic(originalPhoto);
                      }
                    } catch (transformError: any) {
                      console.error('Error transforming photo:', transformError);
                      setProfilePhotoArtistic(originalPhoto);
                      showAlert('Info', 'Foto caricata. La trasformazione artistica non è disponibile al momento.');
                    } finally {
                      setTransformingPhoto(false);
                    }
                  }
                } catch (error) {
                  console.error('Error selecting image:', error);
                  showAlert('Errore', 'Impossibile selezionare l\'immagine');
                }
              }}
              disabled={transformingPhoto}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.uploadPhotoButtonText}>
                {profilePhotoArtistic ? 'Cambia Foto' : 'Carica Foto'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.photoHint}>
              🎨 La foto verrà trasformata automaticamente in stile pastello
            </Text>
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Account</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profileData.email}</Text>
          </View>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Ruolo</Text>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#007AFF" />
              <Text style={styles.adminBadgeText}>AMMINISTRATORE</Text>
            </View>
          </View>
        </View>

        {/* Personal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
          {renderField('Nome', profileData.first_name, 'first_name')}
          {renderField('Cognome', profileData.last_name, 'last_name')}
          {renderField('Data di Nascita', profileData.date_of_birth, 'date_of_birth')}
          
          {/* Stato di Nascita - Dropdown */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Stato di Nascita</Text>
            {editing ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editData.country_of_birth}
                  onValueChange={(value) => setEditData({...editData, country_of_birth: value})}
                  style={styles.picker}
                >
                  {COUNTRIES.map((country) => (
                    <Picker.Item key={country} label={country} value={country} />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text style={styles.fieldValue}>{profileData.country_of_birth || DEFAULT_COUNTRY}</Text>
            )}
          </View>
          
          {renderField('Luogo di Nascita', profileData.place_of_birth, 'place_of_birth')}
          {renderField('Indirizzo', profileData.address, 'address')}
          {renderField('Città', profileData.city, 'city')}
          
          {/* CAP e Provincia sulla stessa riga */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              {renderField('CAP', profileData.postal_code, 'postal_code')}
            </View>
            <View style={{ flex: 1 }}>
              {renderField('Provincia', profileData.province, 'province')}
            </View>
          </View>
          
          {renderField('Telefono', profileData.phone, 'phone')}
        </View>

        {/* Fiscal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          {renderField('Codice Fiscale', profileData.fiscal_code, 'fiscal_code')}
        </View>

        {/* Document Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📄 Documento d'Identità</Text>
            {!editingBank && (
              <TouchableOpacity onPress={() => setEditingBank(true)}>
                <Ionicons name="pencil" size={20} color="#007AFF" />
              </TouchableOpacity>
            )}
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
                  <Picker.Item label="Seleziona tipo..." value="" />
                  <Picker.Item label="Carta d'Identità" value="Carta d'Identità" />
                  <Picker.Item label="Patente" value="Patente" />
                  <Picker.Item label="Passaporto" value="Passaporto" />
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Fronte Documento</Text>
              <TouchableOpacity style={styles.docUploadBtn} onPress={() => pickDocImage('front')}>
                {docFrontImage || editData.doc_front_image ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${docFrontImage || editData.doc_front_image}` }} 
                    style={styles.docPreview} 
                  />
                ) : (
                  <View style={styles.docPlaceholder}>
                    <Ionicons name="camera" size={32} color="#999" />
                    <Text style={styles.docPlaceholderText}>Carica fronte</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Retro Documento</Text>
              <TouchableOpacity style={styles.docUploadBtn} onPress={() => pickDocImage('back')}>
                {docBackImage || editData.doc_back_image ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${docBackImage || editData.doc_back_image}` }} 
                    style={styles.docPreview} 
                  />
                ) : (
                  <View style={styles.docPlaceholder}>
                    <Ionicons name="camera" size={32} color="#999" />
                    <Text style={styles.docPlaceholderText}>Carica retro</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tipo Documento</Text>
                <Text style={styles.fieldValue}>{profileData.id_type || '-'}</Text>
              </View>
              {profileData.doc_front_image && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Fronte</Text>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${profileData.doc_front_image}` }} 
                    style={styles.docPreviewSmall} 
                  />
                </View>
              )}
              {profileData.doc_back_image && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Retro</Text>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${profileData.doc_back_image}` }} 
                    style={styles.docPreviewSmall} 
                  />
                </View>
              )}
            </>
          )}
        </View>

        {/* Bank Details Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🏦 Dati Bancari</Text>
          </View>
          
          {editingBank ? (
            <>
              <Text style={styles.inputLabel}>IBAN</Text>
              <TextInput
                style={styles.input}
                value={editData.iban}
                onChangeText={(t) => setEditData({...editData, iban: t.toUpperCase()})}
                placeholder="IT..."
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Intestatario Conto</Text>
              <TextInput
                style={styles.input}
                value={editData.account_holder}
                onChangeText={(t) => setEditData({...editData, account_holder: t.toUpperCase()})}
                placeholder="Nome e Cognome"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Nome Banca</Text>
              <TextInput
                style={styles.input}
                value={editData.bank_name}
                onChangeText={(t) => setEditData({...editData, bank_name: t})}
                placeholder="Nome della banca"
                placeholderTextColor="#999"
              />

              <View style={styles.bankButtonsRow}>
                <TouchableOpacity 
                  style={styles.cancelBankBtn}
                  onPress={() => {
                    setEditingBank(false);
                    setEditData({...editData, 
                      id_type: profileData.id_type,
                      iban: profileData.iban,
                      account_holder: profileData.account_holder,
                      bank_name: profileData.bank_name,
                      doc_front_image: profileData.doc_front_image,
                      doc_back_image: profileData.doc_back_image,
                    });
                    setDocFrontImage(profileData.doc_front_image || null);
                    setDocBackImage(profileData.doc_back_image || null);
                  }}
                >
                  <Text style={styles.cancelBankBtnText}>Annulla</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveBankBtn, savingBank && styles.buttonDisabled]}
                  disabled={savingBank}
                  onPress={async () => {
                    setSavingBank(true);
                    try {
                      await api.patch('/users/me/bank-details', {
                        id_type: editData.id_type,
                        iban: editData.iban,
                        account_holder: editData.account_holder,
                        bank_name: editData.bank_name,
                        doc_front_image: docFrontImage || editData.doc_front_image,
                        doc_back_image: docBackImage || editData.doc_back_image,
                      });
                      setProfileData({
                        ...profileData,
                        id_type: editData.id_type,
                        iban: editData.iban,
                        account_holder: editData.account_holder,
                        bank_name: editData.bank_name,
                        doc_front_image: docFrontImage || editData.doc_front_image || '',
                        doc_back_image: docBackImage || editData.doc_back_image || '',
                      });
                      setEditingBank(false);
                      showAlert('Salvato', 'Dati documento e bancari aggiornati');
                    } catch (error: any) {
                      showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
                    } finally {
                      setSavingBank(false);
                    }
                  }}
                >
                  {savingBank ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBankBtnText}>Salva</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
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

        {/* Compensation Info - Solo se ha un compenso */}
        {profileData.monthly_compensation > 0 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💰 Compenso</Text>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Compenso Mensile</Text>
                <Text style={styles.compensationAmount}>
                  € {profileData.monthly_compensation.toFixed(2)}
                </Text>
              </View>
              
              {!profileData.compensation_accepted && (
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
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1 },
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, gap: 6 },
  editButton: { backgroundColor: '#E3F2FF' },
  editButtonText: { color: '#007AFF', fontWeight: '600' },
  saveButton: { backgroundColor: '#34C759' },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  cardSubtitle: { fontSize: 13, color: '#666', marginBottom: 16, marginTop: -8 },
  fieldContainer: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: '#666', marginBottom: 4, textTransform: 'uppercase' },
  fieldValue: { fontSize: 16, color: '#333' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', gap: 6 },
  adminBadgeText: { color: '#007AFF', fontWeight: '600', fontSize: 12 },
  compensationAmount: { fontSize: 28, fontWeight: 'bold', color: '#007AFF', marginTop: 4 },
  acceptButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#34C759', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, marginTop: 16, gap: 8 },
  acceptButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  acceptedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 12, gap: 6 },
  acceptedBadgeText: { color: '#2E7D32', fontSize: 14, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  monthInfo: { flex: 1 },
  monthLabel: { fontSize: 15, color: '#333' },
  monthActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthCheckbox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  monthCheckboxActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
  monthStatusText: { fontSize: 11, fontWeight: '600', color: '#999', width: 80 },
  monthStatusTextPaid: { color: '#34C759' },
  limitSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  limitTitle: { fontSize: 14, fontWeight: '600', color: '#FF9500', marginBottom: 8 },
  limitDescription: { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 12 },
  limitCheckbox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#FFF8E1', borderRadius: 8, gap: 10 },
  limitCheckboxActive: { backgroundColor: '#FFEBEE' },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#FF9500', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  limitCheckboxText: { flex: 1, fontSize: 13, color: '#333' },
  // Profile photo styles
  profilePhotoContainer: { alignItems: 'center', paddingVertical: 16 },
  profilePhotoLarge: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#f0f0f0' },
  photoPlaceholder: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  photoPlaceholderText: { color: '#aaa', fontSize: 14, marginTop: 8 },
  transformingText: { color: '#007AFF', fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  uploadPhotoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, marginTop: 16, gap: 8 },
  uploadPhotoButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  photoHint: { color: '#888', fontSize: 12, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
  buttonDisabled: { opacity: 0.5 },
  // Document and Bank styles
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  inputLabel: { fontSize: 12, color: '#666', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  pickerContainer: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  picker: { height: 50 },
  docUploadBtn: { borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  docPreview: { width: '100%', height: 150, resizeMode: 'cover' },
  docPreviewSmall: { width: 120, height: 80, borderRadius: 4, marginTop: 4 },
  docPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
  docPlaceholderText: { color: '#999', fontSize: 13, marginTop: 4 },
  bankButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBankBtn: { flex: 1, backgroundColor: '#f5f5f5', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  cancelBankBtnText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBankBtn: { flex: 1, backgroundColor: '#34C759', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  saveBankBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
