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
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';
import { SportIcon } from '../../../src/components/SportIcon';
import * as ImagePicker from 'expo-image-picker';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function OtherSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Ruoli atleti
  const [athleteRoles, setAthleteRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');

  // Caratteristiche atleti
  const [athleteCharacteristics, setAthleteCharacteristics] = useState<string[]>([]);
  const [newCharacteristic, setNewCharacteristic] = useState('');

  // Qualifiche dirigenti
  const [dirigenteQualifications, setDirigenteQualifications] = useState<string[]>([]);
  const [newQualification, setNewQualification] = useState('');

  // Palestre
  const [venues, setVenues] = useState<{name: string, address: string, city: string}[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');

  // Immagine Sport
  const [sportImage, setSportImage] = useState<string | null>(null);
  const [sportName, setSportName] = useState('');

  // Stagione sportiva
  const [seasonStartMonth, setSeasonStartMonth] = useState(7);
  const [seasonStartDay, setSeasonStartDay] = useState(1);
  const [seasonEndMonth, setSeasonEndMonth] = useState(6);
  const [seasonEndDay, setSeasonEndDay] = useState(30);

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    try {
      const authResponse = await api.get('/auth/me');
      if (authResponse.data?.role !== 'admin') {
        setIsAdmin(false);
        router.replace('/');
        return;
      }
      setIsAdmin(true);
      await loadSettings();
    } catch (error) {
      setIsAdmin(false);
      router.replace('/');
    }
  };
  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/society');
      setAthleteRoles(response.data.athlete_roles || []);
      setAthleteCharacteristics(response.data.athlete_characteristics || []);
      setDirigenteQualifications(response.data.dirigente_qualifications || []);
      setVenues(response.data.venues || []);
      setSportImage(response.data.sport_image || null);
      setSportName(response.data.sport_praticato || response.data.sport_name || '');
      setSeasonStartMonth(response.data.season_start_month || 7);
      setSeasonStartDay(response.data.season_start_day || 1);
      setSeasonEndMonth(response.data.season_end_month || 6);
      setSeasonEndDay(response.data.season_end_day || 30);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-add eventuali campi pendenti compilati (ma non confermati con +)
      let finalRoles = athleteRoles;
      let finalChars = athleteCharacteristics;
      let finalQuals = dirigenteQualifications;
      let finalVenues = venues;
      
      if (newRole.trim() && !athleteRoles.includes(newRole.trim())) {
        finalRoles = [...athleteRoles, newRole.trim()];
        setAthleteRoles(finalRoles);
        setNewRole('');
      }
      if (newCharacteristic.trim() && !athleteCharacteristics.includes(newCharacteristic.trim())) {
        finalChars = [...athleteCharacteristics, newCharacteristic.trim()];
        setAthleteCharacteristics(finalChars);
        setNewCharacteristic('');
      }
      if (newQualification.trim() && !dirigenteQualifications.includes(newQualification.trim())) {
        finalQuals = [...dirigenteQualifications, newQualification.trim()];
        setDirigenteQualifications(finalQuals);
        setNewQualification('');
      }
      if (newVenueName.trim() && !venues.some(v => v.name.toLowerCase() === newVenueName.trim().toLowerCase())) {
        finalVenues = [...venues, {
          name: newVenueName.trim(),
          address: newVenueAddress.trim(),
          city: newVenueCity.trim()
        }];
        setVenues(finalVenues);
        setNewVenueName('');
        setNewVenueAddress('');
        setNewVenueCity('');
      }
      
      await api.patch('/settings/society', {
        athlete_roles: finalRoles,
        athlete_characteristics: finalChars,
        dirigente_qualifications: finalQuals,
        venues: finalVenues,
        sport_image: sportImage,
        sport_praticato: sportName,
        season_start_month: seasonStartMonth,
        season_start_day: seasonStartDay,
        season_end_month: seasonEndMonth,
        season_end_day: seasonEndDay,
      });
      showAlert('Successo', 'Impostazioni salvate con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
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

  // Ruoli
  const addRole = () => {
    if (newRole.trim() && !athleteRoles.includes(newRole.trim())) {
      setAthleteRoles([...athleteRoles, newRole.trim()]);
      setNewRole('');
    }
  };
  const removeRole = (role: string) => {
    setAthleteRoles(athleteRoles.filter(r => r !== role));
  };

  // Caratteristiche
  const addCharacteristic = () => {
    if (newCharacteristic.trim() && !athleteCharacteristics.includes(newCharacteristic.trim())) {
      setAthleteCharacteristics([...athleteCharacteristics, newCharacteristic.trim()]);
      setNewCharacteristic('');
    }
  };
  const removeCharacteristic = (char: string) => {
    setAthleteCharacteristics(athleteCharacteristics.filter(c => c !== char));
  };

  // Qualifiche
  const addQualification = () => {
    if (newQualification.trim() && !dirigenteQualifications.includes(newQualification.trim())) {
      setDirigenteQualifications([...dirigenteQualifications, newQualification.trim()]);
      setNewQualification('');
    }
  };
  const removeQualification = (qual: string) => {
    setDirigenteQualifications(dirigenteQualifications.filter(q => q !== qual));
  };

  // Palestre
  const addVenue = () => {
    if (newVenueName.trim()) {
      if (!venues.some(v => v.name.toLowerCase() === newVenueName.trim().toLowerCase())) {
        setVenues([...venues, {
          name: newVenueName.trim(),
          address: newVenueAddress.trim(),
          city: newVenueCity.trim()
        }]);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E65100" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#E65100' }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Altre Impostazioni</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stagione Sportiva */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stagione Sportiva</Text>
          <Text style={styles.sectionDesc}>
            Definisci le date di inizio e fine della stagione sportiva
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Giorno Inizio</Text>
              <TextInput
                style={styles.input}
                value={String(seasonStartDay)}
                onChangeText={(v) => setSeasonStartDay(parseInt(v) || 1)}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#999"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Mese Inizio</Text>
              <TextInput
                style={styles.input}
                value={String(seasonStartMonth)}
                onChangeText={(v) => setSeasonStartMonth(parseInt(v) || 7)}
                keyboardType="numeric"
                placeholder="7"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Giorno Fine</Text>
              <TextInput
                style={styles.input}
                value={String(seasonEndDay)}
                onChangeText={(v) => setSeasonEndDay(parseInt(v) || 30)}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#999"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Mese Fine</Text>
              <TextInput
                style={styles.input}
                value={String(seasonEndMonth)}
                onChangeText={(v) => setSeasonEndMonth(parseInt(v) || 6)}
                keyboardType="numeric"
                placeholder="6"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: '#2E7D32' }}>
              Stagione corrente: dal {String(seasonStartDay).padStart(2, '0')}/{String(seasonStartMonth).padStart(2, '0')} al {String(seasonEndDay).padStart(2, '0')}/{String(seasonEndMonth).padStart(2, '0')} dell'anno successivo
            </Text>
          </View>
        </View>

        {/* Immagine e Nome Sport */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SportIcon size={20} />
            <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>Immagine e Nome Sport</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Carica un'immagine e indica il nome dello sport praticato
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
            {sportImage ? (
              <View style={{ position: 'relative' as const }}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${sportImage}` }}
                  style={{ width: 100, height: 100, borderRadius: 8 }}
                  resizeMode="contain"
                />
                <TouchableOpacity 
                  style={{ position: 'absolute' as const, top: -8, right: -8 }}
                  onPress={() => setSportImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' }}>
                <Ionicons name="football-outline" size={48} color="#ccc" />
              </View>
            )}
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8 }}
              onPress={handleSelectSportImage}
            >
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                {sportImage ? 'Cambia' : 'Seleziona'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 14, marginBottom: 4 }}>Nome sport *</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#FAFAFA' }}
            value={sportName}
            onChangeText={setSportName}
            placeholder="Es: Pallavolo, Calcio, Basket..."
            data-testid="sport-name-input"
          />
        </View>

        {/* Ruoli Atleti */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SportIcon size={20} />
            <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>Ruoli Atleti</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Definisci i ruoli per il tuo sport (es: Palleggiatore, Centrale, Schiacciatore)
          </Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.tagInput}
              value={newRole}
              onChangeText={setNewRole}
              placeholder="Aggiungi ruolo..."
              placeholderTextColor="#999"
              onSubmitEditing={addRole}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#007AFF' }]} onPress={addRole}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {athleteRoles.length === 0 ? (
              <Text style={styles.emptyText}>Nessun ruolo definito</Text>
            ) : (
              athleteRoles.map((role, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: '#E3F2FD', borderColor: '#007AFF' }]}>
                  <Text style={[styles.tagText, { color: '#007AFF' }]}>{role}</Text>
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
            Aggiungi caratteristiche misurabili (es: Altezza, Peso, Salto)
          </Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.tagInput}
              value={newCharacteristic}
              onChangeText={setNewCharacteristic}
              placeholder="Aggiungi caratteristica..."
              placeholderTextColor="#999"
              onSubmitEditing={addCharacteristic}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#FF9500' }]} onPress={addCharacteristic}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {athleteCharacteristics.length === 0 ? (
              <Text style={styles.emptyText}>Nessuna caratteristica definita</Text>
            ) : (
              athleteCharacteristics.map((char, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: '#FFF3E0', borderColor: '#FF9500' }]}>
                  <Text style={[styles.tagText, { color: '#E65100' }]}>{char}</Text>
                  <TouchableOpacity onPress={() => removeCharacteristic(char)}>
                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Qualifiche Dirigenti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👔 Qualifiche Dirigenti</Text>
          <Text style={styles.sectionDesc}>
            Definisci le qualifiche (es: Presidente, Vice Presidente, Segretario)
          </Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.tagInput}
              value={newQualification}
              onChangeText={setNewQualification}
              placeholder="Aggiungi qualifica..."
              placeholderTextColor="#999"
              onSubmitEditing={addQualification}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#34C759' }]} onPress={addQualification}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {dirigenteQualifications.length === 0 ? (
              <Text style={styles.emptyText}>Nessuna qualifica definita</Text>
            ) : (
              dirigenteQualifications.map((qual, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: '#E8F5E9', borderColor: '#34C759' }]}>
                  <Text style={[styles.tagText, { color: '#2E7D32' }]}>{qual}</Text>
                  <TouchableOpacity onPress={() => removeQualification(qual)}>
                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Palestre */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏟️ Campi da Gioco / Palestre</Text>
          <Text style={styles.sectionDesc}>
            Definisci i luoghi di allenamento e gara
          </Text>
          
          <View style={{ marginBottom: 12 }}>
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={newVenueName}
              onChangeText={setNewVenueName}
              placeholder="Nome palestra (es: Palestra Liceo Alessi)"
              placeholderTextColor="#999"
            />
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={newVenueAddress}
              onChangeText={setNewVenueAddress}
              placeholder="Indirizzo (es: Via Annibale Vecchi, 1)"
              placeholderTextColor="#999"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                value={newVenueCity}
                onChangeText={setNewVenueCity}
                placeholder="Città (es: Perugia)"
                placeholderTextColor="#999"
              />
              <TouchableOpacity 
                style={[styles.addBtn, { backgroundColor: '#9C27B0', height: 48, width: 48 }]} 
                onPress={addVenue}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          
          {venues.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna palestra definita</Text>
          ) : (
            venues.map((venue, index) => (
              <View key={index} style={styles.venueCard}>
                <Ionicons name="location" size={24} color="#9C27B0" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: '600', color: '#7B1FA2', fontSize: 15 }}>{venue.name}</Text>
                  {venue.address && <Text style={{ fontSize: 13, color: '#666' }}>{venue.address}</Text>}
                  {venue.city && <Text style={{ fontSize: 13, color: '#666' }}>{venue.city}</Text>}
                </View>
                <TouchableOpacity onPress={() => removeVenue(venue.name)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          )}
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
    padding: 12,
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
    marginBottom: 8,
    color: '#333',
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginRight: 8,
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
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    marginBottom: 4,
  },
  addBtn: {
    width: 48,
    height: 48,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#9C27B0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  saveButton: {
    backgroundColor: '#E65100',
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
  // Toggle styles for certificate settings
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  toggleContainerActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  toggleTitleActive: {
    color: '#2E7D32',
  },
  toggleDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#4CAF50',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleNote: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  toggleNoteText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 20,
  },
});
