import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import { Picker } from '@react-native-picker/picker';

export default function Register() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState('parent');
  const [loading, setLoading] = useState(false);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const handleRegister = async () => {
    // If coach, redirect to specific registration page
    if (role === 'coach') {
      router.push('/register-coach');
      return;
    }
    
    // If dirigente (viewer), redirect to specific registration page
    if (role === 'viewer') {
      router.push('/register-dirigente');
      return;
    }

    if (!email || !password || !firstName || !lastName) {
      showAlert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    if (!inviteCode) {
      showAlert('Errore', 'Inserisci il codice invito della tua società sportiva');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        full_name: `${lastName.toUpperCase()} ${firstName}`,
        first_name: firstName,
        last_name: lastName.toUpperCase(),
        role,
        invite_code: inviteCode.toUpperCase(),
      });
      
      await setUser(response.data.user, response.data.token);
      
      // Navigate based on role
      if (role === 'parent') {
        router.replace('/parent');
      }
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Registrazione</Text>
        <Text style={styles.subtitle}>Crea il tuo account</Text>

        <View style={styles.form}>
          <View style={styles.inviteCodeSection}>
            <Text style={styles.inviteCodeLabel}>🎟️ Codice Invito Società *</Text>
            <TextInput
              style={styles.inviteCodeInput}
              placeholder="Es: PUZTKF74"
              placeholderTextColor="#999"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
            />
            <Text style={styles.inviteCodeHint}>
              Chiedi il codice al tuo club sportivo
            </Text>
          </View>

          <Text style={styles.inputLabel}>Cognome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Inserisci il cognome"
            placeholderTextColor="#999"
            value={lastName}
            onChangeText={(text) => setLastName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.inputLabel}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Inserisci il nome"
            placeholderTextColor="#999"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="esempio@email.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimo 6 caratteri"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>Ruolo *</Text>
            <View style={styles.picker}>
              <Picker
                selectedValue={role}
                onValueChange={(value) => setRole(value)}
              >
                <Picker.Item label="Genitore/Atleta" value="parent" />
                <Picker.Item label="Coach" value="coach" />
                <Picker.Item label="Dirigente" value="viewer" />
              </Picker>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Registrazione...' : 'Registrati'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>Hai già un account? Accedi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});
