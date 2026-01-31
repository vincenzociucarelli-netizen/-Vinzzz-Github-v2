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
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleRegister = async () => {
    if (!fullName || !dateOfBirth || !teamId) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirth)) {
      Alert.alert('Errore', 'Formato data non valido. Usa YYYY-MM-DD (es: 2010-05-15)');
      return;
    }

    setLoading(true);
    try {
      await api.post('/athletes', {
        full_name: fullName,
        date_of_birth: dateOfBirth,
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
          <Text style={styles.label}>Nome completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: Mario Rossi"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Data di nascita (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: 2010-05-15"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Squadra</Text>
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
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
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
