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
import { Picker } from '@react-native-picker/picker';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../src/constants/countries';
import * as ImagePicker from 'expo-image-picker';
import { ConsentManager } from '../../src/components/ConsentManager';

export default function ParentProfile() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    fiscal_code: '',
  });

  const [editData, setEditData] = useState({ ...profileData });
  
  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Data Protection Password state
  const [showDataPassword, setShowDataPassword] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [dataOldPassword, setDataOldPassword] = useState('');
  const [dataNewPassword, setDataNewPassword] = useState('');
  const [dataConfirmPassword, setDataConfirmPassword] = useState('');
  const [savingDataPassword, setSavingDataPassword] = useState(false);
  const [athletePasswordStatus, setAthletePasswordStatus] = useState<Record<string, boolean>>({});
  
  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoArtistic, setProfilePhotoArtistic] = useState<string | null>(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);

  // Children data for second parent email
  const [children, setChildren] = useState<any[]>([]);

  const loadProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const data = response.data;
      setProfileData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        fiscal_code: data.fiscal_code || '',
      });
      setEditData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        fiscal_code: data.fiscal_code || '',
      });
      setProfilePhoto(data.profile_photo || null);
      setProfilePhotoArtistic(data.profile_photo_artistic || null);
      
      // Load children data
      try {
        const childrenRes = await api.get('/athletes/my');
        setChildren(childrenRes.data || []);
      } catch (e) {
        console.error('Error loading children:', e);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
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
      await api.patch('/auth/me', {
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`.trim(),
        phone: editData.phone,
        address: editData.address,
        city: editData.city,
        postal_code: editData.postal_code,
        province: editData.province,
        fiscal_code: editData.fiscal_code,
      });
      
      // Save children's second_parent_email
      for (const child of children) {
        if (child._editEmail !== undefined) {
          try {
            await api.patch(`/athletes/${child.id}`, { second_parent_email: child._editEmail });
          } catch (e) {
            console.error(`Error saving second parent email for ${child.first_name}:`, e);
          }
        }
      }
      
      showAlert('Successo', 'Profilo aggiornato con successo');
      setEditing(false);
      // Aggiorna lo store locale per riflettere il nuovo nome nella dashboard
      await updateUser({
        full_name: `${editData.last_name} ${editData.first_name}`.trim(),
        first_name: editData.first_name,
        last_name: editData.last_name,
        phone: editData.phone,
      });
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

  const handleChangePassword = async () => {
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleOpenDataPassword = async () => {
    setShowDataPassword(!showDataPassword);
    if (!showDataPassword) {
      try {
        const res = await api.get('/athletes/my');
        const athleteList = res.data || [];
        setAthletes(athleteList);
        const statusMap: Record<string, boolean> = {};
        for (const a of athleteList) {
          try {
            const checkRes = await api.get(`/athletes/${a.id}/has-password`);
            statusMap[a.id] = checkRes.data?.has_password || false;
          } catch {
            statusMap[a.id] = false;
          }
        }
        setAthletePasswordStatus(statusMap);
        if (athleteList.length > 0 && !selectedAthleteId) {
          setSelectedAthleteId(athleteList[0].id);
        }
      } catch (error) {
        console.error('Error loading athletes for data password:', error);
      }
    }
  };

  const handleSaveDataPassword = async () => {
    if (!selectedAthleteId) return;
    
    if (!dataNewPassword) {
      showAlert('Errore', 'Inserisci la nuova password');
      return;
    }
    if (dataNewPassword.length < 4) {
      showAlert('Errore', 'La password deve essere di almeno 4 caratteri');
      return;
    }
    if (dataNewPassword !== dataConfirmPassword) {
      showAlert('Errore', 'Le password non corrispondono');
      return;
    }

    setSavingDataPassword(true);
    try {
      await api.post(`/athletes/${selectedAthleteId}/change-password`, {
        old_password: null,
        new_password: dataNewPassword,
      });
      showAlert('Successo', 'Password protezione dati aggiornata!');
      setDataNewPassword('');
      setDataConfirmPassword('');
      setAthletePasswordStatus(prev => ({ ...prev, [selectedAthleteId!]: true }));
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setSavingDataPassword(false);
    }
  };

  const handlePickPhoto = async () => {
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
            showAlert('✅ Foto Trasformata', 'La tua foto è stata trasformata in stile artistico!');
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
  };

  const renderField = (label: string, value: string, key: string, editable = true) => {
    return (
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
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E91E63" />
        <Text style={{ marginTop: 10 }}>Caricamento...</Text>
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
              <View>
              <View style={styles.headerButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => setEditing(true)}
                >
                  <Ionicons name="pencil" size={20} color="#1565C0" />
                  <Text style={[styles.editButtonText, { color: '#1565C0' }]}>Modifica Dati</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.passwordButton]}
                  onPress={() => setShowChangePassword(!showChangePassword)}
                >
                  <Ionicons name="key" size={20} color="#E65100" />
                  <Text style={[styles.passwordButtonText, { color: '#E65100' }]}>Pw d'accesso</Text>
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.dataPasswordButton]}
                  onPress={handleOpenDataPassword}
                  data-testid="data-password-btn"
                >
                  <Ionicons name="shield-checkmark" size={20} color="#6A1B9A" />
                  <Text style={[styles.passwordButtonText, { color: '#6A1B9A' }]}>PW Protezione Dati</Text>
                </TouchableOpacity>
              </View>
              </View>
            )}
          </View>

          {/* Change Password Section */}
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
                    placeholderTextColor="#999"
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
                    placeholderTextColor="#999"
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
                    placeholderTextColor="#999"
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

          {/* Data Protection Password Section */}
          {showDataPassword && (
            <View style={styles.card} data-testid="data-password-section">
              <Text style={styles.cardTitle}>🛡️ PW Protezione Dati</Text>
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                La password di protezione dati protegge l'accesso ai dati sensibili dei tuoi atleti.
              </Text>
              
              {athletes.length === 0 ? (
                <Text style={{ color: '#999', textAlign: 'center', padding: 10 }}>Nessun atleta registrato</Text>
              ) : (
                <>
                  {/* Athlete selector */}
                  {athletes.length > 1 && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={styles.fieldLabel}>Seleziona Atleta</Text>
                      {athletes.map(a => (
                        <TouchableOpacity
                          key={a.id}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            marginBottom: 4,
                            backgroundColor: selectedAthleteId === a.id ? '#E91E63' : '#f5f5f5',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                          onPress={() => setSelectedAthleteId(a.id)}
                        >
                          <Ionicons name="person" size={16} color={selectedAthleteId === a.id ? '#fff' : '#666'} />
                          <Text style={{ color: selectedAthleteId === a.id ? '#fff' : '#333', fontWeight: '600', fontSize: 13 }}>
                            {a.full_name}
                          </Text>
                          {athletePasswordStatus[a.id] && (
                            <Ionicons name="shield-checkmark" size={14} color={selectedAthleteId === a.id ? '#fff' : '#4CAF50'} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  {athletes.length === 1 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Text style={{ fontWeight: '600', color: '#333' }}>{athletes[0].full_name}</Text>
                      {athletePasswordStatus[athletes[0].id] && (
                        <Ionicons name="shield-checkmark" size={14} color="#4CAF50" />
                      )}
                    </View>
                  )}

                  {selectedAthleteId && (
                    <View style={styles.changePasswordForm}>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{athletePasswordStatus[selectedAthleteId] ? 'Nuova Password' : 'Imposta Password'}</Text>
                        <TextInput
                          style={styles.input}
                          value={dataNewPassword}
                          onChangeText={setDataNewPassword}
                          secureTextEntry
                          placeholder="Minimo 4 caratteri"
                          placeholderTextColor="#999"
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Conferma Password</Text>
                        <TextInput
                          style={styles.input}
                          value={dataConfirmPassword}
                          onChangeText={setDataConfirmPassword}
                          secureTextEntry
                          placeholder="Ripeti la password"
                          placeholderTextColor="#999"
                        />
                      </View>
                      <View style={styles.changePasswordButtonsRow}>
                        <TouchableOpacity
                          style={styles.cancelPasswordButton}
                          onPress={() => {
                            setShowDataPassword(false);
                            setDataNewPassword('');
                            setDataConfirmPassword('');
                          }}
                        >
                          <Text style={styles.cancelPasswordButtonText}>Annulla</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.changePasswordButton, savingDataPassword && styles.buttonDisabled]}
                          onPress={handleSaveDataPassword}
                          disabled={savingDataPassword}
                          data-testid="save-data-password-btn"
                        >
                          <Ionicons name="shield-checkmark" size={18} color="#fff" />
                          <Text style={styles.changePasswordButtonText}>
                            {savingDataPassword ? 'Salvataggio...' : 'Salva'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Profile Photo Section - RIMOSSA per privacy */}

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
            <Text style={styles.cardTitle}>📋 I Miei Dati</Text>
            {renderField('Cognome', profileData.last_name, 'last_name')}
            {renderField('Nome', profileData.first_name, 'first_name')}
            {renderField('Codice Fiscale', profileData.fiscal_code, 'fiscal_code')}
            {renderField('Telefono', profileData.phone, 'phone')}
            <Text style={styles.phoneHint}>Il telefono è necessario per comunicazioni urgenti dalla società</Text>
          </View>

          {/* Children - Email 2° Genitore */}
          {children.filter(c => c.is_minor).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>I Miei Figli</Text>
              {children.filter(c => c.is_minor).map((child) => (
                <View key={child.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 8 }}>
                    {child.first_name} {child.last_name}
                  </Text>
                  <Text style={styles.fieldLabel}>Email 2° Genitore</Text>
                  {editing ? (
                    <TextInput
                      style={styles.input}
                      value={child._editEmail ?? child.second_parent_email ?? ''}
                      onChangeText={(text) => {
                        setChildren(prev => prev.map(c => 
                          c.id === child.id ? {...c, _editEmail: text.toLowerCase()} : c
                        ));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="es: madre@email.com"
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{child.second_parent_email || '-'}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Privacy Consent Management */}
          <ConsentManager entityType="user" accentColor="#E91E63" />
          {children.filter(c => c.is_minor).map((child) => (
            <ConsentManager
              key={`consent-${child.id}`}
              entityType="athlete"
              entityId={child.id}
              entityName={`${child.first_name} ${child.last_name}`}
              accentColor="#E91E63"
            />
          ))}

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
    backgroundColor: '#E91E63',
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
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1565C0',
  },
  editButtonText: {
    color: '#1565C0',
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
  headerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#E65100',
  },
  dataPasswordButton: {
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#6A1B9A',
  },
  passwordButtonText: {
    color: '#E65100',
    fontWeight: '600',
    marginLeft: 4,
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
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  phoneHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
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
    color: '#E91E63',
    fontSize: 13,
    marginTop: 10,
    fontStyle: 'italic',
  },
  uploadPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E91E63',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  // Change password styles
  changePasswordForm: {
    marginTop: 8,
  },
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
  changePasswordButton: {
    flex: 1,
    backgroundColor: '#E91E63',
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
