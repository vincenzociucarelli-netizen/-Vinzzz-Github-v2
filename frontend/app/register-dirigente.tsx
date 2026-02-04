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
import { Ionicons } from '@expo/vector-icons';

export default function RegisterDirigente() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true);

  // Form fields - simplified
  const [inviteCode, setInviteCode] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Refs for navigation
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
    // Validation
    if (!inviteCode) {
      showAlert('Errore', 'Inserisci il codice invito della società');
      return;
    }
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

    setLoading(true);
    try {
      const fullName = `${lastName.trim()} ${firstName.trim()}`;

      const response = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName,
        role: 'viewer',  // Dirigente = viewer role
        invite_code: inviteCode.toUpperCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });

      await setUser(response.data.user, response.data.token);
      
      showAlert(
        'Registrazione Completata',
        'La tua richiesta è stata inviata. Attendi l\'approvazione dell\'amministratore.',
        () => router.replace('/login')
      );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrazione Dirigente</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Crea il tuo account dirigente in pochi secondi</Text>

        <View style={styles.form}>
          {/* Invite Code */}
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
            <Text style={styles.inviteCodeHint}>Chiedi il codice al tuo club</Text>
          </View>

          {/* Personal Info */}
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
            placeholder="es: MARIO"
            placeholderTextColor="#aaa"
            value={firstName}
            onChangeText={(text) => setFirstName(text.toUpperCase())}
            autoCapitalize="characters"
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

          {/* Passwords */}
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

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#5856D6" />
            <Text style={styles.infoText}>
              I dati aggiuntivi (data nascita, codice fiscale, documenti, ecc.) potranno essere inseriti dopo la registrazione nel tuo profilo.
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>
              {loading ? 'Registrazione...' : 'Registrati'}
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
  header: {
    backgroundColor: '#5856D6',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
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
    backgroundColor: '#F0EFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#5856D6',
  },
  inviteCodeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5856D6',
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
    borderColor: '#5856D6',
  },
  inviteCodeHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0EFFF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    marginLeft: 12,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5856D6',
    paddingVertical: 16,
    borderRadius: 10,
    gap: 8,
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
    color: '#5856D6',
    fontSize: 15,
  },
});
