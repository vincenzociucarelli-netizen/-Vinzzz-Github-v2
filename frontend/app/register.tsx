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
      showAlert('Errore', 'Compila tutti i campi');
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
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Ruolo:</Text>
            <View style={styles.picker}>
              <Picker
                selectedValue={role}
                onValueChange={(value) => setRole(value)}
              >
                <Picker.Item label="Genitore/Atleta" value="parent" />
                <Picker.Item label="Coach" value="coach" />
                <Picker.Item label="Admin" value="admin" />
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
