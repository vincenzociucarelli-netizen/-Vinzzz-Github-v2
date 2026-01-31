import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Team } from '../../src/types';

export default function RegisterAthlete() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dati Anagrafici
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState('');
  
  // Contatti
  const [phoneAthlete, setPhoneAthlete] = useState('');
  const [phoneFather, setPhoneFather] = useState('');
  const [phoneMother, setPhoneMother] = useState('');
  const [email, setEmail] = useState('');
  
  // Dati Fiscali
  const [taxPayerName, setTaxPayerName] = useState('');
  const [taxPayerFiscalCode, setTaxPayerFiscalCode] = useState('');
  
  // Squadra
  const [teamId, setTeamId] = useState('');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
      if (response.data.length > 0) {
        setTeamId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const convertToISODate = (dateStr: string) => {
    // Converti da GG/MM/AAAA a YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const handleRegister = async () => {
    // Validazioni
    if (!firstName || !lastName) {
      Alert.alert('Errore', 'Inserisci nome e cognome');
      return;
    }
    
    if (!dateOfBirth) {
      Alert.alert('Errore', 'Inserisci la data di nascita (GG/MM/AAAA)');
      return;
    }
    
    if (!fiscalCode) {
      Alert.alert('Errore', 'Inserisci il codice fiscale');
      return;
    }
    
    if (!teamId) {
      Alert.alert('Errore', 'Seleziona una squadra');
      return;
    }

    // Valida formato data GG/MM/AAAA
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dateOfBirth)) {
      Alert.alert('Errore', 'Formato data non valido. Usa GG/MM/AAAA (es: 15/05/2010)');
      return;
    }

    setLoading(true);
    try {
      const fullName = `${firstName} ${lastName}`;
      const isoDate = convertToISODate(dateOfBirth);
      
      await api.post('/athletes', {
        full_name: fullName,
        date_of_birth: isoDate,
        fiscal_code: fiscalCode,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        province: province || null,
        phone_athlete: phoneAthlete || null,
        phone_father: phoneFather || null,
        phone_mother: phoneMother || null,
        tax_payer_name: taxPayerName || null,
        tax_payer_fiscal_code: taxPayerFiscalCode || null,
        team_id: teamId,
      });
      
      Alert.alert(
        'Successo',
        'Atleta registrato con successo! Periodo di prova: 7 giorni',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registra Atleta</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.form}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>📋 Dati Anagrafici</Text>

          <Text style={styles.label}>Cognome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: ROSSI"
            value={lastName}
            onChangeText={(text) => setLastName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: MARIO"
            value={firstName}
            onChangeText={(text) => setFirstName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Data di Nascita (GG/MM/AAAA) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: 15/05/2010"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Codice Fiscale *</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: RSSMRA10E15H501Z"
            value={fiscalCode}
            onChangeText={(text) => setFiscalCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={16}
          />

          <Text style={styles.label}>Indirizzo</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: VIA ROMA 123"
            value={address}
            onChangeText={(text) => setAddress(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>CAP</Text>
              <TextInput
                style={styles.input}
                placeholder="06100"
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Provincia</Text>
              <TextInput
                style={styles.input}
                placeholder="PG"
                value={province}
                onChangeText={(text) => setProvince(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          <Text style={styles.label}>Città</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: PERUGIA"
            value={city}
            onChangeText={(text) => setCity(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.sectionTitle}>📞 Contatti</Text>

          <Text style={styles.label}>Telefono Atleta</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: 3331234567"
            value={phoneAthlete}
            onChangeText={setPhoneAthlete}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Telefono Padre</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: 3337654321"
            value={phoneFather}
            onChangeText={setPhoneFather}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Telefono Madre</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: 3339876543"
            value={phoneMother}
            onChangeText={setPhoneMother}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: nome@email.it"
            value={email}
            onChangeText={(text) => setEmail(text.toLowerCase())}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.sectionTitle}>🏀 Squadra</Text>

          <Text style={styles.label}>Squadra di Appartenenza *</Text>
          {teams.length > 0 ? (
            <View style={styles.picker}>
              <Picker
                selectedValue={teamId}
                onValueChange={(value) => setTeamId(value)}
              >
                {teams.map((team) => (
                  <Picker.Item key={team.id} label={team.name} value={team.id} />
                ))}
              </Picker>
            </View>
          ) : (
            <Text style={styles.noTeamsText}>Nessuna squadra disponibile</Text>
          )}

          <Text style={styles.sectionTitle}>💳 Dati Fiscali (per Detrazione)</Text>

          <Text style={styles.label}>Cognome e Nome Genitore</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: ROSSI MARIO"
            value={taxPayerName}
            onChangeText={(text) => setTaxPayerName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Codice Fiscale Genitore</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: RSSMRA70A01H501Z"
            value={taxPayerFiscalCode}
            onChangeText={(text) => setTaxPayerFiscalCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={16}
          />

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Periodo di prova di 7 giorni. Dopo questo periodo, dovrai confermare
              la privacy e completare il pagamento della prima rata.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading || teams.length === 0}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Registrazione...' : 'Registra Atleta'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  form: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 20,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  noTeamsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#E3F2FF',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});