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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import { Ionicons } from '@expo/vector-icons';

export default function Register() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Form fields - SOLO i campi essenziali
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState('parent');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true); // Password visibili di default

  // Refs per navigazione campi
  const firstNameRef = useRef<TextInput>(null);
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
    // Validazione
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
        role: role,
        invite_code: inviteCode.trim().toUpperCase(),
      });

      if (response.data.token) {
        setUser({ ...response.data.user, token: response.data.token });
        showAlert(
          '✅ Registrazione completata!',
          'Benvenuto! Completa il tuo profilo nella sezione dedicata.',
          () => {
            // Redirect based on role
            if (role === 'parent') router.replace('/parent');
            else if (role === 'coach') router.replace('/coach');
            else if (role === 'viewer') router.replace('/dirigente');
          }
        );
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Errore durante la registrazione';
      showAlert('Errore', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Registrazione</Text>
          <Text style={styles.subtitle}>
            Inserisci i dati essenziali. Potrai completare il profilo dopo.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Codice Invito */}
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

          {/* Tipo Account */}
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

          {/* Dati Essenziali */}
          <Text style={styles.inputLabel}>Cognome *</Text>
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

          <Text style={styles.inputLabel}>Nome *</Text>
          <TextInput
            ref={firstNameRef}
            style={styles.input}
            placeholder="es: MARIO"
            placeholderTextColor="#aaa"
            value={firstName}
            onChangeText={(text) => setFirstName(text.toUpperCase())}
            autoCapitalize="characters"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

          <Text style={styles.inputLabel}>Email (sarà il tuo User ID) *</Text>
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="es: mario.rossi@email.com"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <View style={styles.passwordLabelRow}>
            <Text style={styles.inputLabel}>Password *</Text>
            <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
              <Ionicons 
                name={showPasswords ? "eye" : "eye-off"} 
                size={20} 
                color="#666" 
              />
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
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />

          <Text style={styles.inputLabel}>Conferma Password *</Text>
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder="Ripeti la password"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPasswords}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Gli altri dati (telefono, indirizzo, documenti, ecc.) potrai inserirli dopo la registrazione nella sezione "Il mio profilo".
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.registerButtonText}>Registrati</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginLinkText}>
              Hai già un account? <Text style={styles.loginLinkBold}>Accedi</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
    marginTop: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  form: {
    flex: 1,
  },
  inviteCodeSection: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  inviteCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  inviteCodeInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 4,
    color: '#007AFF',
  },
  inviteCodeHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  roleSection: {
    marginBottom: 20,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    gap: 6,
  },
  roleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
  },
  loginLinkBold: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
