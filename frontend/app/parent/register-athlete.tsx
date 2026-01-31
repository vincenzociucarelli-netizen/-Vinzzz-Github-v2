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
import { useAuthStore } from '../../src/store/authStore';

export default function RegisterAthlete() {
  const router = useRouter();
  const { logout } = useAuthStore();
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
  
  // Squadre
  const [teamId, setTeamId] = useState('');
  const [teamId2, setTeamId2] = useState('');  // Seconda squadra (opzionale)

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

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        router.replace('/login');
      }
    } else {
      Alert.alert(
        'Logout',
        'Sei sicuro di voler uscire?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
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

  const formatDateInput = (text: string) => {
    // Remove non-numeric characters except /
    let cleaned = text.replace(/[^0-9/]/g, '');
    
    // Auto-add slashes
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      cleaned += '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      cleaned += '/';
    }
    
    // Limit to dd/mm/yyyy format
    if (cleaned.length > 10) {
      cleaned = cleaned.substring(0, 10);
    }
    
    return cleaned;
  };

  const handleRegister = async () => {
    // Prevent double submission
    if (loading) return;
    
    // Validazioni
    if (!firstName || !lastName) {
      showAlert('Errore', 'Inserisci nome e cognome');
      return;
    }
    
    if (!dateOfBirth) {
      showAlert('Errore', 'Inserisci la data di nascita (GG/MM/AAAA)');
      return;
    }
    
    if (!fiscalCode) {
      showAlert('Errore', 'Inserisci il codice fiscale');
      return;
    }
    
    if (!teamId) {
      showAlert('Errore', 'Seleziona una squadra');
      return;
    }

    // Valida formato data GG/MM/AAAA
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dateOfBirth)) {
      showAlert('Errore', 'Formato data non valido. Usa GG/MM/AAAA (es: 15/05/2010)');
      return;
    }

    setLoading(true);
    try {
      const fullName = `${lastName} ${firstName}`;
      const isoDate = convertToISODate(dateOfBirth);
      
      await api.post('/athletes', {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: isoDate,
        fiscal_code: fiscalCode,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        province: province || null,
        phone_athlete: phoneAthlete || null,
        phone_father: phoneFather || null,
        phone_mother: phoneMother || null,
        email: email || null,
        tax_payer_name: taxPayerName || null,
        tax_payer_fiscal_code: taxPayerFiscalCode || null,
        team_id: teamId,
        team_id_2: teamId2 || null,
      });
      
      showAlert(
        'Successo',
        'Atleta registrato con successo! Periodo di prova: 7 giorni',
        () => router.back()
      );
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
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
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
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
            onChangeText={(text) => setDateOfBirth(formatDateInput(text))}
            keyboardType="number-pad"
            maxLength={10}
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
            <View style={styles.flex1}>
              <Text style={styles.label}>CAP</Text>
              <TextInput
                style={styles.input}
                placeholder="00100"
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={styles.flex2}>
              <Text style={styles.label}>Città</Text>
              <TextInput
                style={styles.input}
                placeholder="ROMA"
                value={city}
                onChangeText={(text) => setCity(text.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Prov.</Text>
              <TextInput
                style={styles.input}
                placeholder="RM"
                value={province}
                onChangeText={(text) => setProvince(text.toUpperCase())}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>📞 Contatti</Text>

          <Text style={styles.label}>Tel. Atleta</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            value={phoneAthlete}
            onChangeText={setPhoneAthlete}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Tel. Padre</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            value={phoneFather}
            onChangeText={setPhoneFather}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Tel. Madre</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            value={phoneMother}
            onChangeText={setPhoneMother}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@esempio.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.sectionTitle}>💳 Dati per Fatturazione</Text>

          <Text style={styles.label}>Nome Contribuente</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome e Cognome o Ragione Sociale"
            value={taxPayerName}
            onChangeText={(text) => setTaxPayerName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Codice Fiscale Contribuente</Text>
          <TextInput
            style={styles.input}
            placeholder="Codice Fiscale o P.IVA"
            value={taxPayerFiscalCode}
            onChangeText={(text) => setTaxPayerFiscalCode(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.sectionTitle}>🏐 Squadra</Text>

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={teamId}
              onValueChange={(value) => setTeamId(value)}
              style={styles.picker}
            >
              {teams.map((team) => (
                <Picker.Item key={team.id} label={team.name} value={team.id} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Registrazione...' : 'Registra Atleta'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
