import React, { useState, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

export default function Register() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Form fields
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState('parent');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true); // Passwords visible by default

  // Refs for field navigation
  const firstNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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

    // Validation
    if (!lastName.trim() || !firstName.trim()) {
      showAlert('Errore', 'Inserisci cognome e nome');
      return;
    }

    if (!email.trim()) {
      showAlert('Errore', 'Inserisci la tua email');
      return;
    }

    if (!password) {
      showAlert('Errore', 'Inserisci una password');
      return;
    }

    if (password.length < 6) {
      showAlert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Errore', 'Le password non coincidono');
      return;
    }

    if (!inviteCode) {
      showAlert('Errore', 'Inserisci il codice invito della tua società sportiva');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        full_name: `${lastName.trim().toUpperCase()} ${firstName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim().toUpperCase(),
        phone: phone.trim() || null,
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
        <Text style={styles.title}>👋 Registrazione</Text>
        <Text style={styles.subtitle}>Crea il tuo account in pochi secondi</Text>

        <View style={styles.form}>
          {/* Invite Code Section */}
          <View style={styles.inviteCodeSection}>
            <Text style={styles.inviteCodeLabel}>🎟️ Codice Invito Società</Text>
            <TextInput
              style={styles.inviteCodeInput}
              placeholder="Es: PUZTKF74"
              placeholderTextColor="#999"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
              returnKeyType="next"
            />
            <Text style={styles.inviteCodeHint}>
              Chiedi il codice al tuo club sportivo
            </Text>
          </View>

          {/* Role Selector */}
          <View style={styles.roleSection}>
            <Text style={styles.inputLabel}>Tipo di account</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'parent' && styles.roleButtonActive]}
                onPress={() => setRole('parent')}
              >
                <Ionicons name="people" size={20} color={role === 'parent' ? '#fff' : '#007AFF'} />
                <Text style={[styles.roleButtonText, role === 'parent' && styles.roleButtonTextActive]}>Genitore</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, role === 'coach' && styles.roleButtonActive]}
                onPress={() => setRole('coach')}
              >
                <Ionicons name="fitness" size={20} color={role === 'coach' ? '#fff' : '#007AFF'} />
                <Text style={[styles.roleButtonText, role === 'coach' && styles.roleButtonTextActive]}>Coach</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, role === 'viewer' && styles.roleButtonActive]}
                onPress={() => setRole('viewer')}
              >
                <Ionicons name="briefcase" size={20} color={role === 'viewer' ? '#fff' : '#007AFF'} />
                <Text style={[styles.roleButtonText, role === 'viewer' && styles.roleButtonTextActive]}>Dirigente</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Personal Info - Only for parent role */}
          {role === 'parent' && (
            <>
              <Text style={styles.inputLabel}>Cognome</Text>
              <TextInput
                style={styles.input}
                placeholder="es: ROSSI"
                placeholderTextColor="#aaa"
                value={lastName}
                onChangeText={(text) => setLastName(text.toUpperCase())}
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() => firstNameRef.current?.focus()}
              />

              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                ref={firstNameRef}
                style={styles.input}
                placeholder="es: Mario"
                placeholderTextColor="#aaa"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />

              <Text style={styles.inputLabel}>Telefono</Text>
              <TextInput
                ref={phoneRef}
                style={styles.input}
                placeholder="es: 333 1234567"
                placeholderTextColor="#aaa"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />

              <Text style={styles.inputLabel}>Email (sarà il tuo User ID)</Text>
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="esempio@email.com"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <View style={styles.passwordSection}>
                <View style={styles.passwordHeader}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TouchableOpacity 
                    style={styles.togglePasswordBtn}
                    onPress={() => setShowPasswords(!showPasswords)}
                  >
                    <Ionicons 
                      name={showPasswords ? "eye-off" : "eye"} 
                      size={18} 
                      color="#666" 
                    />
                    <Text style={styles.togglePasswordText}>
                      {showPasswords ? 'Nascondi' : 'Mostra'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Minimo 6 caratteri"
                  placeholderTextColor="#aaa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                />

                <Text style={styles.inputLabel}>Conferma Password</Text>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="Ripeti la password"
                  placeholderTextColor="#aaa"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Registrazione...' : role === 'parent' ? 'Registrati' : 'Continua →'}
            </Text>
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
    marginBottom: 24,
  },
  form: {
    width: '100%',
  },
  inviteCodeSection: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  inviteCodeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  inviteCodeInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  inviteCodeHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  roleSection: {
    marginBottom: 20,
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    gap: 6,
  },
  roleButtonActive: {
    backgroundColor: '#007AFF',
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  passwordSection: {
    marginTop: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  togglePasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  togglePasswordText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
  },
});
