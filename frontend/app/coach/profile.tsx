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
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import PhotoViewer from '../../src/components/PhotoViewer';

const DOC_TYPES = ['Carta Identità', 'Passaporto', 'Patente Auto'];

export default function CoachProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Photo viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState('');
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    province_of_birth: '',
    birth_province: '',
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    coach_license_number: '',
    monthly_compensation: 0,
    compensation_accepted: false,
    contract_start_date: '',
    contract_end_date: '',
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
  const [compensationHistory, setCompensationHistory] = useState({});
  const [signedReceipts, setSignedReceipts] = useState<any[]>([]);
  const [over5000Limit, setOver5000Limit] = useState({});
  const [hasExceeded5000, setHasExceeded5000] = useState(false);
  const [hasExceeded15000, setHasExceeded15000] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  
  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Document images
  const [docFrontImage, setDocFrontImage] = useState(null);
  const [docBackImage, setDocBackImage] = useState(null);
  
  // Profile photo (artistic)
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoArtistic, setProfilePhotoArtistic] = useState(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);

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
        province_of_birth: data.birth_province || data.province_of_birth || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        coach_license_number: data.coach_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        // Documento e Dati Bancari
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
        doc_front_image: data.doc_front_image || '',
        doc_back_image: data.doc_back_image || '',
        contract_start_date: data.contract_start_date || '',
        contract_end_date: data.contract_end_date || '',
      });
      setEditData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        province_of_birth: data.birth_province || data.province_of_birth || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        coach_license_number: data.coach_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
        // Documento e Dati Bancari
        id_type: data.id_type || '',
        id_front: data.id_front || '',
        id_back: data.id_back || '',
        iban: data.iban || '',
        account_holder: data.account_holder || '',
        bank_name: data.bank_name || '',
      });
      // Load compensation history
      setCompensationHistory(data.compensation_history || {});
      setOver5000Limit(data.over_5000_limit || {});
      // Check if any month has exceeded €5000 or €15000
      const exceeded5000 = data.over_5000_limit && (data.over_5000_limit.exceeded_5000 === true || Object.values(data.over_5000_limit).some((v) => v === true && typeof v === 'boolean'));
      const exceeded15000 = data.over_5000_limit && data.over_5000_limit.exceeded_15000 === true;
      setHasExceeded5000(exceeded5000 || false);
      setHasExceeded15000(exceeded15000 || false);
      // Load profile photo
      setProfilePhoto(data.profile_photo || null);
      setProfilePhotoArtistic(data.profile_photo_artistic || null);
      // Load signed receipts
      try {
        const receiptsRes = await api.get(`/coach/${data.id}/compensation`);
        setSignedReceipts(receiptsRes.data || []);
      } catch (e) {
        console.log('No receipts found');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (side) => {
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

  // Generate contract months based on coach's contract dates
  const getContractMonths = () => {
    const months: {key: string, label: string}[] = [];
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    // Use contract dates if available
    const startDate = profileData.contract_start_date ? new Date(profileData.contract_start_date) : null;
    const endDate = profileData.contract_end_date ? new Date(profileData.contract_end_date) : null;
    
    if (startDate && endDate) {
      // Generate months from contract start to end
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      
      while (current <= end) {
        const monthIndex = current.getMonth();
        const year = current.getFullYear();
        months.push({
          key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
          label: `${monthNames[monthIndex]} ${year}`,
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Fallback to season months (July to June)
      const now = new Date();
      const currentYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      for (let i = 0; i < 12; i++) {
        const monthIndex = (6 + i) % 12;
        const year = monthIndex >= 6 ? currentYear : currentYear + 1;
        months.push({
          key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
          label: `${monthNames[monthIndex]} ${year}`,
        });
      }
    }
    return months;
  };

  const formatDate = (dateStr) => {
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

  const showAlert = (title, message, onOk) => {
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
        birth_province: editData.province_of_birth,
        fiscal_code: editData.fiscal_code,
        address: editData.address,
        city: editData.city,
        postal_code: editData.postal_code,
        province: editData.province,
        phone: editData.phone,
        coach_license_number: editData.coach_license_number,
      });
      
      showAlert('Successo', 'Profilo aggiornato con successo');
      setEditing(false);
      await loadProfile();
    } catch (error) {
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
    } catch (error) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
    }
  };

  const handleToggleMonth = async (monthKey) => {
    const newHistory = { ...compensationHistory };
    newHistory[monthKey] = !newHistory[monthKey];
    setCompensationHistory(newHistory);
    
    try {
      await api.patch('/auth/me', { compensation_history: newHistory });
    } catch (error) {
      // Revert on error
      setCompensationHistory(compensationHistory);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleToggle5000Limit = async () => {
    const newValue = !hasExceeded5000;
    
    // Se si sta attivando, chiedi conferma
    if (newValue) {
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      const confirmMsg = `ATTENZIONE: Stai dichiarando di aver superato il limite di €5.000 nell'anno solare.\n\nLa data di oggi (${dateStr}) verrà memorizzata e rimarrà visibile all'amministratore.\n\nConfermi?`;
      
      const confirmAction = Platform.OS === 'web'
        ? window.confirm(confirmMsg)
        : await new Promise((resolve) => {
            Alert.alert(
              'Conferma Dichiarazione',
              confirmMsg,
              [
                { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confermo', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (!confirmAction) return;
    }
    
    setHasExceeded5000(newValue);
    
    const now = new Date();
    const newLimit = { ...over5000Limit };
    
    if (newValue) {
      newLimit.exceeded_5000 = true;
      newLimit.exceeded_5000_date = now.toISOString();
    } else {
      newLimit.exceeded_5000 = false;
    }
    
    setOver5000Limit(newLimit);
    
    try {
      await api.patch('/auth/me', { over_5000_limit: newLimit });
      if (newValue) {
        showAlert('Registrato', 'La tua dichiarazione è stata memorizzata. Da ora dovrai versare i contributi INPS.');
      }
    } catch (error) {
      setHasExceeded5000(!newValue);
      setOver5000Limit(over5000Limit);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleToggle15000Limit = async () => {
    const newValue = !hasExceeded15000;
    
    // Se si sta attivando, chiedi conferma
    if (newValue) {
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      const confirmMsg = `ATTENZIONE: Stai dichiarando di aver superato il limite di €15.000 nell'anno solare.\n\nLa data di oggi (${dateStr}) verrà memorizzata e rimarrà visibile all'amministratore.\n\nOltre ai contributi INPS, sarà dovuta anche l'IRPEF sulla parte eccedente.\n\nConfermi?`;
      
      const confirmAction = Platform.OS === 'web'
        ? window.confirm(confirmMsg)
        : await new Promise((resolve) => {
            Alert.alert(
              'Conferma Dichiarazione',
              confirmMsg,
              [
                { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confermo', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (!confirmAction) return;
    }
    
    setHasExceeded15000(newValue);
    
    const now = new Date();
    const newLimit = { ...over5000Limit };
    
    if (newValue) {
      newLimit.exceeded_15000 = true;
      newLimit.exceeded_15000_date = now.toISOString();
      // Se supera 15k, automaticamente ha superato anche 5k
      if (!newLimit.exceeded_5000) {
        newLimit.exceeded_5000 = true;
        newLimit.exceeded_5000_date = now.toISOString();
        setHasExceeded5000(true);
      }
    } else {
      newLimit.exceeded_15000 = false;
    }
    
    setOver5000Limit(newLimit);
    
    try {
      await api.patch('/auth/me', { over_5000_limit: newLimit });
      if (newValue) {
        showAlert('Registrato', 'La tua dichiarazione è stata memorizzata. Sarà dovuta IRPEF sulla parte eccedente i €15.000.');
      }
    } catch (error) {
      setHasExceeded15000(!newValue);
      setOver5000Limit(over5000Limit);
      showAlert('Errore', 'Errore durante il salvataggio');
    }
  };

  const handleChangePassword = async () => {
    // Validations
    if (!currentPassword) {
      showAlert('Errore', 'Inserisci la password attuale');
      return;
    }
    if (!newPassword) {
      showAlert('Errore', 'Inserisci la nuova password');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Errore', 'La nuova password deve avere almeno 6 caratteri');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert('Errore', 'Le nuove password non coincidono');
      return;
    }
    if (currentPassword === newPassword) {
      showAlert('Errore', 'La nuova password deve essere diversa da quella attuale');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      showAlert('Successo', 'Password cambiata con successo!');
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
    } catch (error) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Auto-format date as GG/MM/AAAA
  const formatDateInputAuto = (text: string) => {
    const numbers = text.replace(/\D/g, '');
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
    return formatted;
  };

  const renderField = (label: string, value: string, key: string, editable = true) => {
    // Special handling for date_of_birth field
    const isDateField = key === 'date_of_birth';
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}{isDateField && editing ? ' (GG/MM/AAAA)' : ''}</Text>
        {editing && editable ? (
          <TextInput
            style={styles.input}
            value={editData[key]?.toString() || ''}
            onChangeText={(text) => {
              if (isDateField) {
                setEditData({ ...editData, [key]: formatDateInputAuto(text) });
              } else {
                setEditData({ ...editData, [key]: text.toUpperCase() });
              }
            }}
            autoCapitalize={isDateField ? 'none' : 'characters'}
            keyboardType={isDateField ? 'number-pad' : 'default'}
            maxLength={isDateField ? 10 : undefined}
            placeholder={isDateField ? '01/01/1990' : undefined}
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: editing ? 100 : 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
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
            <View style={styles.headerButtonsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => setEditing(true)}
              >
                <Ionicons name="pencil" size={20} color="#007AFF" />
                <Text style={styles.editButtonText}>Modifica Dati</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.passwordButton]}
                onPress={() => setShowChangePassword(!showChangePassword)}
              >
                <Ionicons name="key" size={20} color="#007AFF" />
                <Text style={styles.passwordButtonText}>Password</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Change Password Section - Now at top */}
        {showChangePassword && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔐 Cambia Password</Text>
            <View style={styles.changePasswordForm}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Password Attuale</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Inserisci password attuale"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Nuova Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Minimo 6 caratteri"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Conferma Nuova Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  placeholder="Ripeti la nuova password"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.changePasswordButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelPasswordButton}
                  onPress={() => {
                    setShowChangePassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                >
                  <Text style={styles.cancelPasswordButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.changePasswordButton, changingPassword && styles.buttonDisabled]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  <Ionicons name="key" size={18} color="#fff" />
                  <Text style={styles.changePasswordButtonText}>
                    {changingPassword ? 'Cambio...' : 'Cambia Password'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

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
                    } catch (transformError) {
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
        </View>

        {/* Personal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
          {renderField('Nome', profileData.first_name, 'first_name')}
          {renderField('Cognome', profileData.last_name, 'last_name')}
          {renderField('Data di Nascita', profileData.date_of_birth, 'date_of_birth')}
          {renderField('Luogo di Nascita', profileData.place_of_birth, 'place_of_birth')}
          {renderField('Provincia di Nascita', profileData.province_of_birth, 'province_of_birth')}
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
          {renderField('N° Tesserino Allenatore', profileData.coach_license_number, 'coach_license_number')}
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

          {/* Link to Compensation Page with Receipts */}
          {profileData.monthly_compensation > 0 && profileData.compensation_accepted && (
            <TouchableOpacity
              style={styles.compensationLinkButton}
              onPress={() => router.push('/coach/compensation')}
              data-testid="compensation-receipts-btn"
            >
              <Ionicons name="document-text" size={20} color="#007AFF" />
              <Text style={styles.compensationLinkText}>Quietanze Mensili</Text>
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Registro Quietanze Compatto */}
        {profileData.monthly_compensation > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Registro Quietanze</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {(() => {
                // Find first month where each threshold was exceeded
                const sortedReceipts = [...signedReceipts]
                  .filter(r => r.receipt_signed)
                  .sort((a, b) => {
                    if (a.year !== b.year) return a.year - b.year;
                    return a.month - b.month;
                  });
                
                let first5k: { year: number, month: number } | null = null;
                let first15k: { year: number, month: number } | null = null;
                
                for (const r of sortedReceipts) {
                  if (r.exceeded_5000 && !first5k) {
                    first5k = { year: r.year, month: r.month };
                  }
                  if (r.exceeded_15000 && !first15k) {
                    first15k = { year: r.year, month: r.month };
                  }
                }
                
                const isAfterThreshold = (yearInt: number, monthInt: number, threshold: { year: number, month: number } | null) => {
                  if (!threshold) return false;
                  if (yearInt > threshold.year) return true;
                  if (yearInt === threshold.year && monthInt >= threshold.month) return true;
                  return false;
                };
                
                return getContractMonths().map((month) => {
                  const [year, monthNum] = month.key.split('-');
                  const yearInt = parseInt(year);
                  const monthInt = parseInt(monthNum);
                  const receipt = signedReceipts.find(r => r.year === yearInt && r.month === monthInt);
                  const isSigned = receipt?.receipt_signed === true;
                  
                  // Check if THIS is the threshold month (for badge)
                  const isThreshold5k = receipt?.exceeded_5000 === true;
                  const isThreshold15k = receipt?.exceeded_15000 === true;
                  
                  // Check if month is AFTER threshold (for highlighting)
                  const isAfter5k = isSigned && isAfterThreshold(yearInt, monthInt, first5k);
                  const isAfter15k = isSigned && isAfterThreshold(yearInt, monthInt, first15k);
                  
                  // Check if month is in the future
                  const now = new Date();
                  const currentYearActual = now.getFullYear();
                  const currentMonthActual = now.getMonth() + 1;
                  const isFuture = (yearInt > currentYearActual) || 
                                   (yearInt === currentYearActual && monthInt > currentMonthActual);
                  
                  return (
                    <View 
                      key={month.key} 
                      style={{
                        backgroundColor: isAfter15k ? '#FFF3E0' : isAfter5k ? '#FFF8E1' : isSigned ? '#E8F5E9' : isFuture ? '#FAFAFA' : '#F5F5F5',
                        borderRadius: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderWidth: isAfter15k ? 2 : isAfter5k ? 2 : isSigned ? 2 : 1,
                        borderColor: isAfter15k ? '#E65100' : isAfter5k ? '#F9A825' : isSigned ? '#4CAF50' : isFuture ? '#E8E8E8' : '#E0E0E0',
                        minWidth: 85,
                        alignItems: 'center',
                        opacity: isFuture ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: isFuture ? '#AAA' : '#666', fontWeight: '500' }}>
                        {month.label.split(' ')[0].substring(0, 3)} {month.label.split(' ')[1]}
                      </Text>
                      {isThreshold15k ? (
                        <Text style={{ fontSize: 11, color: '#E65100', fontWeight: 'bold' }}>&gt;15K</Text>
                      ) : isThreshold5k ? (
                        <Text style={{ fontSize: 11, color: '#F9A825', fontWeight: 'bold' }}>&gt;5K</Text>
                      ) : (
                        <Text style={{ fontSize: 12, color: isSigned ? (isAfter15k ? '#E65100' : isAfter5k ? '#F9A825' : '#2E7D32') : isFuture ? '#CCC' : '#999', fontWeight: '600' }}>
                          {isSigned ? '✓' : isFuture ? '○' : '-'}
                        </Text>
                      )}
                    </View>
                  );
                });
              })()}
            </View>
          </View>
        )}

        {/* Documento e Dati Bancari */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🏦 Documento e Dati Bancari</Text>
            <TouchableOpacity onPress={() => setEditingBank(!editingBank)}>
              <Ionicons name={editingBank ? "close" : "create"} size={22} color="#007AFF" />
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
                onChangeText={(v) => setEditData({...editData, id_front: v.toUpperCase()})}
                placeholder="es. AX1234567"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <Text style={styles.inputLabel}>Scadenza Documento</Text>
              <TextInput
                style={styles.input}
                value={editData.id_back}
                onChangeText={(v) => {
                  // Auto-format: add / after day and month
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
                onChangeText={(v) => setEditData({...editData, account_holder: v.toUpperCase()})}
                placeholder="es. MARIO ROSSI"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <Text style={styles.inputLabel}>Nome Banca</Text>
              <TextInput
                style={styles.input}
                value={editData.bank_name}
                onChangeText={(v) => setEditData({...editData, bank_name: v.toUpperCase()})}
                placeholder="es. INTESA SANPAOLO"
                placeholderTextColor="#ccc"
                autoCapitalize="characters"
              />
              
              <TouchableOpacity
                style={[styles.saveBankButtonFixed, savingBank && styles.saveButtonDisabled]}
                onPress={async () => {
                  setSavingBank(true);
                  try {
                    const payload: any = {
                      id_type: editData.id_type,
                      id_front: editData.id_front,
                      id_back: editData.id_back,
                      iban: editData.iban,
                      account_holder: editData.account_holder,
                      bank_name: editData.bank_name,
                    };
                    // Add images only if they exist and are not too large
                    if (docFrontImage) {
                      payload.doc_front_image = docFrontImage;
                    } else if (editData.doc_front_image) {
                      payload.doc_front_image = editData.doc_front_image;
                    }
                    if (docBackImage) {
                      payload.doc_back_image = docBackImage;
                    } else if (editData.doc_back_image) {
                      payload.doc_back_image = editData.doc_back_image;
                    }
                    
                    await api.patch('/users/me/bank-details', payload);
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
                    console.error('Error saving bank details:', error);
                    showAlert('Errore', error.response?.data?.detail || 'Errore nel salvataggio. Riprova.');
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
              
              {/* Document Images */}
              <View style={styles.docImagesContainer}>
                <TouchableOpacity 
                  style={styles.docImageWrapper}
                  onPress={() => {
                    if (profileData.doc_front_image) {
                      setSelectedPhoto(profileData.doc_front_image);
                      setSelectedPhotoTitle('Fronte Documento');
                      setPhotoViewerVisible(true);
                    }
                  }}
                  disabled={!profileData.doc_front_image}
                >
                  <Text style={styles.docImageLabel}>Fronte Documento</Text>
                  {profileData.doc_front_image ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${profileData.doc_front_image}` }}
                      style={styles.docImagePreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.docImagePlaceholder}>
                      <Ionicons name="id-card-outline" size={32} color="#ccc" />
                      <Text style={styles.docImagePlaceholderText}>Non caricato</Text>
                    </View>
                  )}
                  {profileData.doc_front_image && (
                    <Text style={styles.tapToEnlarge}>Tocca per ingrandire</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.docImageWrapper}
                  onPress={() => {
                    if (profileData.doc_back_image) {
                      setSelectedPhoto(profileData.doc_back_image);
                      setSelectedPhotoTitle('Retro Documento');
                      setPhotoViewerVisible(true);
                    }
                  }}
                  disabled={!profileData.doc_back_image}
                >
                  <Text style={styles.docImageLabel}>Retro Documento</Text>
                  {profileData.doc_back_image ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${profileData.doc_back_image}` }}
                      style={styles.docImagePreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.docImagePlaceholder}>
                      <Ionicons name="id-card-outline" size={32} color="#ccc" />
                      <Text style={styles.docImagePlaceholderText}>Non caricato</Text>
                    </View>
                  )}
                  {profileData.doc_back_image && (
                    <Text style={styles.tapToEnlarge}>Tocca per ingrandire</Text>
                  )}
                </TouchableOpacity>
              </View>

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
      </KeyboardAvoidingView>

      {/* Floating Save Button when editing */}
      {editing && (
        <View style={styles.floatingSaveContainer}>
          <TouchableOpacity
            style={[styles.floatingSaveButton, saving && styles.floatingSaveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.floatingSaveText}>SALVA MODIFICHE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Photo Viewer for documents */}
      <PhotoViewer
        visible={photoViewerVisible}
        photo={selectedPhoto}
        title={selectedPhotoTitle}
        onClose={() => setPhotoViewerVisible(false)}
      />
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
    backgroundColor: '#007AFF',
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
    backgroundColor: '#E8F4FD',
  },
  editButtonText: {
    color: '#007AFF',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  imageUploadBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageUploadPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageUploadText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
  },
  docImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
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
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 70,
  },
  picker: {
    height: 70,
  },
  saveBankButtonFixed: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBankButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  // Document images styles for view mode
  docImagesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  docImageWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  docImageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  docImagePreview: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  docImagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docImagePlaceholderText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  tapToEnlarge: {
    fontSize: 10,
    color: '#007AFF',
    marginTop: 4,
    textAlign: 'center',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusAccepted: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextAccepted: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57C00',
  },
  compensationAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
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
  compensationLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 10,
  },
  compensationLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
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
  declarationDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Tax Table Styles
  taxTableSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  taxTableTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  taxTableSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  taxTable: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  taxTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  taxTableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  taxTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  taxTableRowActive: {
    backgroundColor: '#E3F2FD',
  },
  taxTableCell: {
    flex: 1,
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
  },
  taxCellGreen: {
    color: '#34C759',
    fontWeight: '600',
  },
  taxCellRed: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  taxCellOrange: {
    color: '#FF9500',
    fontWeight: '600',
  },
  taxTableNote: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  // Limit Section Styles
  limitSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    marginTop: 20,
  },
  limitCheckboxContent: {
    flex: 1,
  },
  limitCheckboxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  limitCheckboxDesc: {
    fontSize: 12,
    color: '#666',
  },
  limitCheckbox5000Active: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  limitCheckbox15000Active: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  checkbox5000Active: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  checkbox15000Active: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  changePasswordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changePasswordForm: {
    marginTop: 16,
  },
  changePasswordButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePasswordButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Header buttons row
  headerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  passwordButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  // Change password buttons row
  changePasswordButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelPasswordButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPasswordButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  // Profile photo styles
  profilePhotoContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  profilePhotoLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f0f0f0',
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
  },
  transformingText: {
    color: '#007AFF',
    fontSize: 13,
    marginTop: 10,
    fontStyle: 'italic',
  },
  uploadPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  uploadPhotoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Floating save button styles
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingSaveButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  floatingSaveButtonDisabled: {
    opacity: 0.6,
  },
  floatingSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
