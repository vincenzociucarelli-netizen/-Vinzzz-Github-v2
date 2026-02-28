import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function SocietySettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Logo e immagini
  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(50);
  const [sportImage, setSportImage] = useState<string | null>(null);
  const [stampSignature, setStampSignature] = useState<string | null>(null);

  // Dati società
  const [societyName, setSocietyName] = useState('');
  const [ragioneSociale, setRagioneSociale] = useState('');
  const [sportPraticato, setSportPraticato] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [societyEmail, setSocietyEmail] = useState('');
  const [societyPec, setSocietyPec] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/society');
      setSocietyName(response.data.name || '');
      setLogo(response.data.logo || null);
      setLogoSize(response.data.logo_size || 50);
      setSportImage(response.data.sport_image || null);
      setRagioneSociale(response.data.ragione_sociale || '');
      setSportPraticato(response.data.sport_praticato || '');
      setAddress(response.data.address || '');
      setPostalCode(response.data.postal_code || '');
      setCity(response.data.city || '');
      setProvince(response.data.province || '');
      setFiscalCode(response.data.fiscal_code || '');
      setPhone(response.data.phone || '');
      setPhone2(response.data.phone2 || '');
      setPresidentName(response.data.president_name || '');
      setStampSignature(response.data.stamp_signature || null);
      setSocietyEmail(response.data.email || '');
      setSocietyPec(response.data.pec || '');
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/society', {
        name: societyName,
        logo: logo,
        logo_size: logoSize,
        sport_image: sportImage,
        ragione_sociale: ragioneSociale,
        sport_praticato: sportPraticato,
        address: address,
        postal_code: postalCode,
        city: city,
        province: province,
        fiscal_code: fiscalCode,
        phone: phone,
        phone2: phone2,
        president_name: presidentName,
        stamp_signature: stampSignature,
        email: societyEmail,
        pec: societyPec,
      });
      showAlert('Successo', 'Dati società salvati con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLogo(result.assets[0].base64);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleSelectSportImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSportImage(result.assets[0].base64);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleSelectStampSignature = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setStampSignature(result.assets[0].base64);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1565C0' }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dati Società</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Logo Società */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 Logo Società</Text>
          <View style={styles.logoContainer}>
            {logo ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${logo}` }}
                  style={[styles.logoImage, { width: logoSize, height: logoSize }]}
                  resizeMode="contain"
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={() => setLogo(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#ccc" />
                <Text style={styles.logoPlaceholderText}>Nessun logo</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectLogo}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {logo ? 'Cambia Logo' : 'Seleziona Logo'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {logo && (
            <View style={styles.sizeControl}>
              <Text style={styles.sizeLabel}>Dimensione Logo nell'header: {logoSize}px</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Piccolo</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={30}
                  maximumValue={80}
                  step={5}
                  value={logoSize}
                  onValueChange={setLogoSize}
                  minimumTrackTintColor="#1565C0"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#1565C0"
                />
                <Text style={styles.sliderLabel}>Grande</Text>
              </View>
            </View>
          )}
        </View>

        {/* Immagine Sport */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏐 Immagine Sport</Text>
          <Text style={styles.sectionDesc}>
            Carica un'immagine che rappresenta il tuo sport
          </Text>
          
          <View style={styles.logoContainer}>
            {sportImage ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${sportImage}` }}
                  style={{ width: 100, height: 100 }}
                  resizeMode="contain"
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={() => setSportImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.logoPlaceholder, { width: 100, height: 100 }]}>
                <Ionicons name="football-outline" size={48} color="#ccc" />
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectSportImage}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {sportImage ? 'Cambia' : 'Seleziona'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nome Società */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nome Società</Text>
          <TextInput
            style={styles.input}
            value={societyName}
            onChangeText={setSocietyName}
            placeholder="Es: ASD Volley Club"
          />
        </View>

        {/* Dati Fiscali */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Dati per Ricevuta Fiscale</Text>
          
          <Text style={styles.inputLabel}>Ragione Sociale</Text>
          <TextInput
            style={styles.input}
            value={ragioneSociale}
            onChangeText={setRagioneSociale}
            placeholder="Es: ASD PALLAVOLO PERUGIA"
          />
          
          <Text style={styles.inputLabel}>Sport Praticato</Text>
          <TextInput
            style={styles.input}
            value={sportPraticato}
            onChangeText={setSportPraticato}
            placeholder="Es: Pallavolo, Calcio, Basket..."
          />
          
          <Text style={styles.inputLabel}>Indirizzo</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Es: Via Roma, 123"
          />
          
          <View style={styles.row}>
            <View style={styles.smallInputContainer}>
              <Text style={styles.inputLabel}>CAP</Text>
              <TextInput
                style={styles.input}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="06100"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.mediumInputContainer}>
              <Text style={styles.inputLabel}>Città</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Perugia"
              />
            </View>
            <View style={styles.smallInputContainer}>
              <Text style={styles.inputLabel}>Prov.</Text>
              <TextInput
                style={styles.input}
                value={province}
                onChangeText={(text) => setProvince(text.toUpperCase())}
                placeholder="PG"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>
          
          <Text style={styles.inputLabel}>Codice Fiscale</Text>
          <TextInput
            style={styles.input}
            value={fiscalCode}
            onChangeText={setFiscalCode}
            placeholder="Es: 12345678901"
            autoCapitalize="characters"
          />
          
          <View style={styles.row}>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>Telefono 1</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Es: 075 1234567"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>Telefono 2</Text>
              <TextInput
                style={styles.input}
                value={phone2}
                onChangeText={setPhone2}
                placeholder="Es: 333 1234567"
                keyboardType="phone-pad"
              />
            </View>
          </View>
          
          <Text style={styles.inputLabel}>Nome Presidente</Text>
          <TextInput
            style={styles.input}
            value={presidentName}
            onChangeText={setPresidentName}
            placeholder="Es: Mario Rossi"
          />

          <View style={styles.row}>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>Email Società</Text>
              <TextInput
                style={styles.input}
                value={societyEmail}
                onChangeText={setSocietyEmail}
                placeholder="info@societasportiva.it"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>PEC</Text>
              <TextInput
                style={styles.input}
                value={societyPec}
                onChangeText={setSocietyPec}
                placeholder="societa@pec.it"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Timbro e Firma */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖊️ Timbro e Firma Presidente</Text>
          <Text style={styles.sectionDesc}>
            Per le ricevute fiscali (opzionale)
          </Text>
          
          <View style={styles.logoContainer}>
            {stampSignature ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/png;base64,${stampSignature}` }}
                  style={{ width: 150, height: 80, resizeMode: 'contain' }}
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={() => setStampSignature(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.logoPlaceholder, { width: 150, height: 80 }]}>
                <Ionicons name="create-outline" size={32} color="#ccc" />
                <Text style={styles.logoPlaceholderText}>Nessun timbro</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectStampSignature}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {stampSignature ? 'Cambia' : 'Seleziona'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Save Button */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Salva</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoPreview: {
    position: 'relative',
  },
  logoImage: {
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  logoPlaceholderText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  removeLogoBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  selectLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 8,
  },
  selectLogoBtnText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  sizeControl: {
    marginTop: 16,
  },
  sizeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  smallInputContainer: {
    flex: 1,
  },
  mediumInputContainer: {
    flex: 2,
  },
  halfInputContainer: {
    flex: 1,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  saveButton: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
