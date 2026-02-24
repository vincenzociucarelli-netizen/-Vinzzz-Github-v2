import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import Slider from '@react-native-community/slider';

export default function SettingsScreen() {
  const router = useRouter();
  const [societyName, setSocietyName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(50); // Default size in pixels (header display)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Athlete roles and characteristics
  const [athleteRoles, setAthleteRoles] = useState<string[]>([]);
  const [athleteCharacteristics, setAthleteCharacteristics] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [newCharacteristic, setNewCharacteristic] = useState('');

  // Dirigente qualifications
  const [dirigenteQualifications, setDirigenteQualifications] = useState<string[]>([]);
  const [newQualification, setNewQualification] = useState('');

  // Venues (Campi da gioco / Palestre)
  const [venues, setVenues] = useState<{name: string, address: string, city: string}[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');

  // Fiscal receipt data
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
  const [stampSignature, setStampSignature] = useState<string | null>(null);
  const [societyEmail, setSocietyEmail] = useState('');
  const [societyPec, setSocietyPec] = useState('');
  const [proEnabled, setProEnabled] = useState(false);
  const [sportImage, setSportImage] = useState<string | null>(null);
  
  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/society');
      setSocietyName(response.data.name || '');
      setLogo(response.data.logo || null);
      setLogoSize(response.data.logo_size || 50);
      setAthleteRoles(response.data.athlete_roles || []);
      setAthleteCharacteristics(response.data.athlete_characteristics || []);
      setDirigenteQualifications(response.data.dirigente_qualifications || []);
      setVenues(response.data.venues || []);
      // Load fiscal receipt data
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
      setProEnabled(response.data.pro_enabled || false);
      setSportImage(response.data.sport_image || null);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSelectLogo = async () => {
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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLogo(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
  };

  const handleSelectSportImage = async () => {
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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSportImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error selecting sport image:', error);
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleRemoveSportImage = () => {
    setSportImage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/society', {
        name: societyName,
        logo: logo,
        logo_size: logoSize,
        sport_image: sportImage,
        athlete_roles: athleteRoles,
        athlete_characteristics: athleteCharacteristics,
        dirigente_qualifications: dirigenteQualifications,
        // Fiscal receipt data
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
        pro_enabled: proEnabled,
      });
      showAlert('Successo', 'Impostazioni salvate con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const addRole = () => {
    if (newRole.trim() && !athleteRoles.includes(newRole.trim().toUpperCase())) {
      setAthleteRoles([...athleteRoles, newRole.trim().toUpperCase()]);
      setNewRole('');
    }
  };

  const removeRole = (role: string) => {
    setAthleteRoles(athleteRoles.filter(r => r !== role));
  };

  const addCharacteristic = () => {
    if (newCharacteristic.trim() && !athleteCharacteristics.includes(newCharacteristic.trim().toUpperCase())) {
      setAthleteCharacteristics([...athleteCharacteristics, newCharacteristic.trim().toUpperCase()]);
      setNewCharacteristic('');
    }
  };

  const removeCharacteristic = (char: string) => {
    setAthleteCharacteristics(athleteCharacteristics.filter(c => c !== char));
  };

  const addQualification = () => {
    if (newQualification.trim() && !dirigenteQualifications.includes(newQualification.trim())) {
      setDirigenteQualifications([...dirigenteQualifications, newQualification.trim()]);
      setNewQualification('');
    }
  };

  const removeQualification = (qual: string) => {
    setDirigenteQualifications(dirigenteQualifications.filter(q => q !== qual));
  };

  const addVenue = () => {
    if (newVenueName.trim()) {
      const newVenue = {
        name: newVenueName.trim(),
        address: newVenueAddress.trim(),
        city: newVenueCity.trim()
      };
      // Check if venue with same name already exists
      if (!venues.some(v => v.name.toLowerCase() === newVenue.name.toLowerCase())) {
        setVenues([...venues, newVenue]);
        setNewVenueName('');
        setNewVenueAddress('');
        setNewVenueCity('');
      } else {
        showAlert('Errore', 'Una palestra con questo nome esiste già');
      }
    }
  };

  const removeVenue = (venueName: string) => {
    setVenues(venues.filter(v => v.name !== venueName));
  };

  const handleSelectStampSignature = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showAlert('Permesso negato', 'È necessario concedere il permesso per accedere alla galleria');
        return;
      }

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
      console.error('Error selecting stamp/signature:', error);
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleRemoveStampSignature = () => {
    setStampSignature(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Impostazioni</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logo Società</Text>
          <Text style={styles.sectionDesc}>
            Il logo sarà visibile nell'header di tutte le schermate
          </Text>
          
          <View style={styles.logoContainer}>
            {logo ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${logo}` }}
                  style={[styles.logoImage, { width: logoSize * 2, height: logoSize * 2 }]}
                  resizeMode="contain"
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={handleRemoveLogo}
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
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#007AFF"
                />
                <Text style={styles.sliderLabel}>Grande</Text>
              </View>
              <Text style={styles.sizeHint}>Anteprima nell'header: {logoSize}x{logoSize}px</Text>
            </View>
          )}
        </View>

        {/* Immagine Sport */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏐 Immagine Sport</Text>
          <Text style={styles.sectionDesc}>
            Carica un'immagine che rappresenta il tuo sport (es. pallone da volley, basket)
          </Text>
          
          <View style={styles.logoContainer}>
            {sportImage ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${sportImage}` }}
                  style={[styles.logoImage, { width: 100, height: 100 }]}
                  resizeMode="contain"
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={handleRemoveSportImage}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="football-outline" size={48} color="#ccc" />
                <Text style={styles.logoPlaceholderText}>Nessuna immagine</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectSportImage}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {sportImage ? 'Cambia Immagine' : 'Seleziona Immagine'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nome Società</Text>
          <TextInput
            style={styles.input}
            value={societyName}
            onChangeText={setSocietyName}
            placeholder="Es: ASD Volley Club"
          />
        </View>

        {/* Dati Anagrafici Società per Ricevuta Fiscale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Dati Società per Ricevuta Fiscale</Text>
          <Text style={styles.sectionDesc}>
            Questi dati verranno utilizzati nella generazione delle ricevute fiscali
          </Text>
          
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
                placeholder="Es: info@societasportiva.it"
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
                placeholder="Es: societa@pec.it"
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
            Carica un'immagine del timbro e firma per le ricevute fiscali (opzionale)
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
                  onPress={handleRemoveStampSignature}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.logoPlaceholder, { width: 150, height: 80 }]}>
                <Ionicons name="create-outline" size={32} color="#ccc" />
                <Text style={styles.logoPlaceholderText}>Nessun timbro/firma</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectStampSignature}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {stampSignature ? 'Cambia Immagine' : 'Seleziona Immagine'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ruoli Atleti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏐 Ruoli Atleti</Text>
          <Text style={styles.sectionDesc}>
            Definisci i ruoli specifici per il tuo sport (es: Palleggiatore, Centrale, Schiacciatore per il volley)
          </Text>
          
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={newRole}
              onChangeText={setNewRole}
              placeholder="Aggiungi ruolo..."
              onSubmitEditing={addRole}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagBtn} onPress={addRole}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {athleteRoles.length === 0 ? (
              <Text style={styles.noTagsText}>Nessun ruolo definito</Text>
            ) : (
              athleteRoles.map((role, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{role}</Text>
                  <TouchableOpacity onPress={() => removeRole(role)}>
                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Caratteristiche Atleti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Caratteristiche Atleti</Text>
          <Text style={styles.sectionDesc}>
            Definisci altre caratteristiche da registrare (es: Mano Forte, Ricezione, ecc.)
          </Text>
          
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={newCharacteristic}
              onChangeText={setNewCharacteristic}
              placeholder="Aggiungi caratteristica..."
              onSubmitEditing={addCharacteristic}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: '#5856D6' }]} onPress={addCharacteristic}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {athleteCharacteristics.length === 0 ? (
              <Text style={styles.noTagsText}>Nessuna caratteristica definita</Text>
            ) : (
              athleteCharacteristics.map((char, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: '#F0EFFF', borderColor: '#5856D6' }]}>
                  <Text style={[styles.tagText, { color: '#5856D6' }]}>{char}</Text>
                  <TouchableOpacity onPress={() => removeCharacteristic(char)}>
                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Prime Squadre */}
        <View style={[styles.section, { backgroundColor: '#FFFBEB', borderColor: '#FFD700', borderWidth: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: '#B8860B' }]}>🏆 Prime Squadre</Text>
              <Text style={styles.sectionDesc}>
                Attiva il modulo per gestire compensi di atleti e collaboratori delle serie maggiori
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: proEnabled ? '#4CAF50' : '#ccc' }
              ]}
              onPress={() => setProEnabled(!proEnabled)}
            >
              <View style={[
                styles.toggleCircle,
                { transform: [{ translateX: proEnabled ? 20 : 0 }] }
              ]} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            {proEnabled ? '✅ Modulo attivo - max 50 membri' : '🔒 Modulo disattivato'}
          </Text>
        </View>

        {/* Qualifiche Dirigenti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👔 Qualifiche Dirigenti</Text>
          <Text style={styles.sectionDesc}>
            Definisci le qualifiche per i dirigenti (es: Presidente, Vice Presidente, Segretario, ecc.)
          </Text>
          
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={newQualification}
              onChangeText={setNewQualification}
              placeholder="Aggiungi qualifica..."
              onSubmitEditing={addQualification}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: '#34C759' }]} onPress={addQualification}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {dirigenteQualifications.length === 0 ? (
              <Text style={styles.noTagsText}>Nessuna qualifica definita</Text>
            ) : (
              dirigenteQualifications.map((qual, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: '#E8F9EE', borderColor: '#34C759' }]}>
                  <Text style={[styles.tagText, { color: '#34C759' }]}>{qual}</Text>
                  <TouchableOpacity onPress={() => removeQualification(qual)}>
                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Spacer for floating button */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Save Button */}
      <View style={styles.floatingSaveContainer}>
        <TouchableOpacity 
          style={[styles.floatingSaveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          data-testid="floating-save-button"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Salva Modifiche</Text>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoPreview: {
    position: 'relative',
    marginBottom: 16,
  },
  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  removeLogoBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  logoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  logoPlaceholderText: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  selectLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
  },
  selectLogoBtnText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  sizeControl: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
    width: 50,
    textAlign: 'center',
  },
  sizeHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  floatingSaveButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Tag styles for roles and characteristics
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addTagBtn: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  noTagsText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  // Row layout styles for form inputs
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  smallInputContainer: {
    width: 80,
  },
  mediumInputContainer: {
    flex: 1,
  },
  halfInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  toggleButton: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    padding: 2,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
});
