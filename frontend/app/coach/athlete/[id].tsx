import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';

interface TechnicalData {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  team_id?: string;
  athlete_photo?: string;
  athlete_photo_artistic?: string;
  athlete_role?: string;
  athlete_height?: number;
  athlete_weight?: number;
  athlete_characteristics?: string[];
  certificate_status?: string;
  certificate_expiry?: string;
  // Emergency contacts
  parent_name?: string;
  parent_phone?: string;
  emergency_phone?: string;
}

interface SocietySettings {
  athlete_roles: string[];
  athlete_characteristics: string[];
}

export default function CoachAthleteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState<TechnicalData | null>(null);
  const [settings, setSettings] = useState<SocietySettings>({ athlete_roles: [], athlete_characteristics: [] });
  
  // Form state
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoArtistic, setPhotoArtistic] = useState<string | null>(null);
  const [transformingPhoto, setTransformingPhoto] = useState(false);
  const [role, setRole] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [elevation, setElevation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [athleteRes, settingsRes] = await Promise.all([
        api.get(`/athletes/${id}/technical-data`),
        api.get('/settings/society'),
      ]);
      
      const athleteData = athleteRes.data;
      setAthlete(athleteData);
      setSettings({
        athlete_roles: settingsRes.data.athlete_roles || [],
        athlete_characteristics: settingsRes.data.athlete_characteristics || [],
      });
      
      // Initialize form state
      setPhoto(athleteData.athlete_photo || null);
      setPhotoArtistic(athleteData.athlete_photo_artistic || null);
      setRole(athleteData.athlete_role || '');
      setHeight(athleteData.athlete_height ? String(athleteData.athlete_height) : '');
      setWeight(athleteData.athlete_weight ? String(athleteData.athlete_weight) : '');
      setElevation(athleteData.athlete_elevation ? String(athleteData.athlete_elevation) : '');
      setNotes(athleteData.athlete_notes || '');
      setSelectedCharacteristics(athleteData.athlete_characteristics || []);
    } catch (error) {
      console.error('Error loading athlete:', error);
      showAlert('Errore', 'Impossibile caricare i dati dell\'atleta');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSelectPhoto = async () => {
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
        setPhoto(originalPhoto);
        
        // Transform photo to artistic style
        setTransformingPhoto(true);
        try {
          const response = await api.post(`/athletes/${id}/transform-photo`, {
            image_base64: originalPhoto
          });
          
          if (response.data.success && response.data.artistic_photo) {
            setPhotoArtistic(response.data.artistic_photo);
            showAlert('✅ Foto Trasformata', 'La foto è stata trasformata in stile artistico!');
          } else {
            setPhotoArtistic(originalPhoto);
          }
        } catch (transformError: any) {
          console.error('Error transforming photo:', transformError);
          setPhotoArtistic(originalPhoto);
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

  const toggleCharacteristic = (char: string) => {
    if (selectedCharacteristics.includes(char)) {
      setSelectedCharacteristics(selectedCharacteristics.filter(c => c !== char));
    } else {
      setSelectedCharacteristics([...selectedCharacteristics, char]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/athletes/${id}/technical-data`, {
        athlete_photo: photo,
        athlete_photo_artistic: photoArtistic,
        athlete_role: role || null,
        athlete_height: height ? parseInt(height) : null,
        athlete_weight: weight ? parseInt(weight) : null,
        athlete_characteristics: selectedCharacteristics,
      });
      showAlert('✅ Successo', 'Dati tecnici salvati correttamente');
    } catch (error: any) {
      console.error('Error saving:', error);
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const getCertificateInfo = () => {
    if (!athlete?.certificate_status) {
      return { icon: 'alert-circle', color: '#FF9500', text: 'Certificato non presente' };
    }
    switch (athlete.certificate_status) {
      case 'valid':
        return { icon: 'checkmark-circle', color: '#34C759', text: 'Certificato valido' };
      case 'expiring_soon':
        return { icon: 'warning', color: '#FF9500', text: 'Certificato in scadenza' };
      case 'expired':
        return { icon: 'close-circle', color: '#FF3B30', text: 'Certificato scaduto' };
      default:
        return { icon: 'alert-circle', color: '#FF9500', text: 'Stato sconosciuto' };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dati Tecnici</Text>
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

  const certInfo = getCertificateInfo();
  const age = calculateAge(athlete.date_of_birth);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dati Tecnici</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Athlete Info Card */}
        <View style={styles.athleteCard}>
          <View style={styles.photoSection}>
            {transformingPhoto ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.transformingText}>Trasformando...</Text>
              </View>
            ) : photoArtistic ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${photoArtistic}` }}
                style={styles.athletePhoto}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={48} color="#ccc" />
              </View>
            )}
            <TouchableOpacity 
              style={[styles.changePhotoBtn, transformingPhoto && styles.changePhotoBtnDisabled]} 
              onPress={handleSelectPhoto}
              disabled={transformingPhoto}
            >
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.changePhotoBtnText}>Foto</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.athleteInfo}>
            <Text style={styles.athleteName}>{athlete.full_name}</Text>
            {age && <Text style={styles.athleteAge}>{age} anni</Text>}
          </View>
        </View>

        {/* Certificate Status - VISIBLE TO ALL */}
        <View style={[styles.section, styles.certificateSection]}>
          <View style={styles.certificateHeader}>
            <Ionicons name={certInfo.icon as any} size={24} color={certInfo.color} />
            <Text style={[styles.certificateStatus, { color: certInfo.color }]}>
              {certInfo.text}
            </Text>
          </View>
          {athlete.certificate_expiry && (
            <Text style={styles.certificateExpiry}>
              Scadenza: {formatDate(athlete.certificate_expiry)}
            </Text>
          )}
        </View>

        {/* Emergency Contacts - CRITICAL FOR COACH */}
        <View style={[styles.section, styles.emergencySection]}>
          <Text style={styles.sectionTitle}>📞 Contatti Emergenza</Text>
          
          {athlete.parent_name && (
            <View style={styles.emergencyContact}>
              <Ionicons name="person" size={18} color="#007AFF" />
              <Text style={styles.emergencyLabel}>Genitore:</Text>
              <Text style={styles.emergencyValue}>{athlete.parent_name}</Text>
            </View>
          )}
          
          {athlete.parent_phone && (
            <TouchableOpacity 
              style={styles.emergencyPhoneRow}
              onPress={() => {
                // Open phone dialer
                const phoneUrl = `tel:${athlete.parent_phone}`;
                import('react-native').then(({ Linking }) => {
                  Linking.openURL(phoneUrl);
                });
              }}
            >
              <Ionicons name="call" size={18} color="#34C759" />
              <Text style={styles.emergencyPhone}>{athlete.parent_phone}</Text>
              <View style={styles.callButton}>
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={styles.callButtonText}>Chiama</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {athlete.emergency_phone && athlete.emergency_phone !== athlete.parent_phone && (
            <TouchableOpacity 
              style={styles.emergencyPhoneRow}
              onPress={() => {
                const phoneUrl = `tel:${athlete.emergency_phone}`;
                import('react-native').then(({ Linking }) => {
                  Linking.openURL(phoneUrl);
                });
              }}
            >
              <Ionicons name="alert-circle" size={18} color="#FF9500" />
              <Text style={styles.emergencyPhone}>{athlete.emergency_phone}</Text>
              <View style={[styles.callButton, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={styles.callButtonText}>Emergenza</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {!athlete.parent_phone && !athlete.emergency_phone && (
            <Text style={styles.noEmergencyContact}>
              ⚠️ Nessun contatto di emergenza disponibile
            </Text>
          )}
        </View>

        {/* Role Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏐 Ruolo</Text>
          {settings.athlete_roles.length > 0 ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={role}
                onValueChange={setRole}
                style={styles.picker}
              >
                <Picker.Item label="Seleziona ruolo..." value="" />
                {settings.athlete_roles.map((r, index) => (
                  <Picker.Item key={index} label={r} value={r} />
                ))}
              </Picker>
            </View>
          ) : (
            <Text style={styles.noSettingsText}>
              ⚠️ Nessun ruolo definito. L'admin deve configurare i ruoli nelle impostazioni della società.
            </Text>
          )}
        </View>

        {/* Physical Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📏 Dati Fisici</Text>
          
          <View style={styles.physicalRowThree}>
            <View style={styles.physicalInputThird}>
              <Text style={styles.inputLabel}>Altezza cm.</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                placeholder="175"
                keyboardType="numeric"
                placeholderTextColor="#aaa"
                maxLength={3}
              />
            </View>
            
            <View style={styles.physicalInputThird}>
              <Text style={styles.inputLabel}>Peso kg.</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="65"
                keyboardType="numeric"
                placeholderTextColor="#aaa"
                maxLength={3}
              />
            </View>
            
            <View style={styles.physicalInputThird}>
              <Text style={styles.inputLabel}>Elevaz. cm.</Text>
              <TextInput
                style={styles.input}
                value={elevation}
                onChangeText={setElevation}
                placeholder="45"
                keyboardType="numeric"
                placeholderTextColor="#aaa"
                maxLength={3}
              />
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Note Allenatore</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Inserisci osservazioni, giudizi, note tecniche..."
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Characteristics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Caratteristiche</Text>
          {settings.athlete_characteristics.length > 0 ? (
            <View style={styles.characteristicsContainer}>
              {settings.athlete_characteristics.map((char, index) => {
                const isSelected = selectedCharacteristics.includes(char);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.characteristicTag, isSelected && styles.characteristicTagSelected]}
                    onPress={() => toggleCharacteristic(char)}
                  >
                    <Text style={[styles.characteristicText, isSelected && styles.characteristicTextSelected]}>
                      {char}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noSettingsText}>
              ⚠️ Nessuna caratteristica definita. L'admin deve configurare le caratteristiche nelle impostazioni.
            </Text>
          )}
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="lock-closed" size={16} color="#666" />
          <Text style={styles.privacyText}>
            I dati anagrafici dell'atleta sono riservati e non visibili in questa sezione.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Save Button */}
      <View style={styles.floatingSaveContainer}>
        <TouchableOpacity
          style={[styles.floatingSaveButton, saving && styles.floatingSaveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.floatingSaveText}>SALVA DATI TECNICI</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  athleteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoSection: {
    position: 'relative',
  },
  athletePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  changePhotoBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  changePhotoBtnDisabled: {
    opacity: 0.5,
  },
  transformingText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 8,
  },
  athleteInfo: {
    marginLeft: 16,
    flex: 1,
  },
  athleteName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  athleteAge: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  certificateSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  certificateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  certificateStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  certificateExpiry: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginLeft: 36,
  },
  // Emergency Contact Styles
  emergencySection: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  emergencyContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  emergencyLabel: {
    fontSize: 14,
    color: '#666',
  },
  emergencyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emergencyPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  emergencyPhone: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noEmergencyContact: {
    fontSize: 13,
    color: '#FF9500',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 55,
  },
  picker: {
    height: 55,
  },
  noSettingsText: {
    fontSize: 13,
    color: '#FF9500',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  physicalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  physicalInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
  },
  characteristicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  characteristicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  characteristicTagSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  characteristicText: {
    fontSize: 14,
    color: '#333',
  },
  characteristicTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  // Floating Save Button
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
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
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
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
