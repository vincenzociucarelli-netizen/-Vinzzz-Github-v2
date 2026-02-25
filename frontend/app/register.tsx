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
import { Ionicons } from '../src/components/Icon';

export default function Register() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Step management: 'role' -> 'invite' -> 'form'
  const [step, setStep] = useState<'role' | 'invite' | 'form'>('role');
  
  // Form fields
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true);
  const [validatingCode, setValidatingCode] = useState(false);
  const [societyName, setSocietyName] = useState('');

  // Refs
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

  // Validate invite code for Coach/Dirigente
  const validateInviteCode = async () => {
    if (!inviteCode.trim()) {
      showAlert('Errore', 'Inserisci il codice invito');
      return;
    }

    setValidatingCode(true);
    try {
      const response = await api.post('/auth/validate-invite-code', {
        invite_code: inviteCode.trim().toUpperCase()
      });
      
      if (response.data.valid) {
        setSocietyName(response.data.society_name || '');
        setStep('form');
      } else {
        showAlert('Errore', 'Codice invito non valido');
      }
    } catch (error: any) {
      // If endpoint doesn't exist, just proceed
      if (error.response?.status === 404) {
        setStep('form');
      } else {
        showAlert('Errore', error.response?.data?.detail || 'Codice invito non valido');
      }
    } finally {
      setValidatingCode(false);
    }
  };

  const handleRegister = async () => {
    // Validation
    if (!lastName.trim() || !firstName.trim()) {
      showAlert('Errore', 'Inserisci cognome e nome');
      return;
    }

    if (!phone.trim()) {
      showAlert('Errore', 'Inserisci il numero di telefono (necessario per contatti urgenti)');
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

    // Invite code required for coach, viewer, and athlete
    if (!inviteCode && (role !== 'parent')) {
      showAlert('Errore', 'Inserisci il codice invito');
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (role === 'athlete') {
        // Use the adult athlete registration endpoint
        response = await api.post('/auth/register-adult-athlete', {
          email: email.trim().toLowerCase(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim().toUpperCase(),
          phone: phone.trim(),
          invite_code: inviteCode.trim().toUpperCase(),
        });
        
        // Adult athlete needs approval - show message and redirect to login
        showAlert(
          '✅ Registrazione completata!',
          'Il tuo account è stato creato.\n\n⏳ IMPORTANTE: La tua registrazione deve essere approvata da un Amministratore.\n\nTi contatteremo telefonicamente per accordarci. Una volta approvato, potrai accedere con le tue credenziali.',
          () => router.replace('/login')
        );
        return;
      } else {
        // Use the standard registration endpoint
        response = await api.post('/auth/register', {
          email: email.trim().toLowerCase(),
          password,
          full_name: `${lastName.trim().toUpperCase()} ${firstName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim().toUpperCase(),
          phone: phone.trim(),
          role: role,
          invite_code: inviteCode.trim().toUpperCase(),
        });
      }

      if (response.data.token) {
        await setUser(response.data.user, response.data.token);
        
        // Different messages based on role
        if (role === 'coach' || role === 'viewer' || role === 'collaboratore') {
          showAlert(
            '✅ Registrazione completata!',
            'Il tuo account è stato creato.\n\n⚠️ IMPORTANTE: La tua registrazione deve essere approvata da un Amministratore prima di poter accedere a tutte le funzionalità.\n\nRiceverai una notifica quando sarai abilitato.',
            () => {
              if (role === 'coach') router.replace('/coach');
              else if (role === 'collaboratore') router.replace('/collaboratore');
              else router.replace('/dirigente');
            }
          );
        } else if (role === 'athlete') {
          showAlert(
            '✅ Registrazione completata!',
            'Benvenuto! Sei registrato come atleta maggiorenne.\n\n🏃 Hai 7 giorni di prova. L\'amministratore ti assegnerà a una squadra.',
            () => router.replace('/athlete')
          );
        } else {
          showAlert(
            '✅ Registrazione completata!',
            'Benvenuto! Completa il tuo profilo nella sezione dedicata.',
            () => router.replace('/parent')
          );
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Errore durante la registrazione';
      showAlert('Errore', message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 1: Role Selection
  const renderRoleSelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Chi sei?</Text>
      <Text style={styles.stepSubtitle}>Seleziona il tuo ruolo per continuare</Text>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setRole('parent');
          setStep('form'); // Parent goes directly to form
        }}
        data-testid="role-parent-btn"
      >
        <View style={[styles.roleIcon, { backgroundColor: '#E3F2FD' }]}>
          <Ionicons name="people" size={32} color="#007AFF" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Genitore / Atleta Minorenne</Text>
          <Text style={styles.roleCardDesc}>Gestisci gli atleti della tua famiglia</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setRole('athlete');
          setStep('form'); // Adult athlete goes directly to form
        }}
        data-testid="role-adult-athlete-btn"
      >
        <View style={[styles.roleIcon, { backgroundColor: '#FFF8E1' }]}>
          <Ionicons name="person" size={32} color="#FF9800" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Atleta Maggiorenne (18+)</Text>
          <Text style={styles.roleCardDesc}>Registrati autonomamente come atleta adulto</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setRole('coach');
          setStep('form'); // Coach goes directly to form
        }}
        data-testid="role-coach-btn"
      >
        <View style={[styles.roleIcon, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="fitness" size={32} color="#4CAF50" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Allenatore / Coach</Text>
          <Text style={styles.roleCardDesc}>Gestisci le tue squadre e atleti</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setRole('viewer');
          setStep('form'); // Dirigente goes directly to form
        }}
        data-testid="role-dirigente-btn"
      >
        <View style={[styles.roleIcon, { backgroundColor: '#F3E5F5' }]}>
          <Ionicons name="briefcase" size={32} color="#9C27B0" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Dirigente</Text>
          <Text style={styles.roleCardDesc}>Visualizza dati della società</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setRole('collaboratore');
          setStep('form'); // Collaboratore goes directly to form
        }}
        data-testid="role-collaboratore-btn"
      >
        <View style={[styles.roleIcon, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="hand-left" size={32} color="#FF5722" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Collaboratore</Text>
          <Text style={styles.roleCardDesc}>Collaboratore sportivo della società</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/login')}>
        <Text style={styles.loginLinkText}>
          Hai già un account? <Text style={styles.loginLinkBold}>Accedi</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );

  // STEP 2: Invite Code (for Coach/Dirigente)
  const renderInviteCode = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setStep('role')}>
        <View style={{ backgroundColor: "rgba(0,122,255,0.15)", borderRadius: 20, padding: 6 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>Codice Invito</Text>
      <Text style={styles.stepSubtitle}>
        Inserisci il codice che ti è stato fornito dalla tua società sportiva
      </Text>

      <View style={styles.inviteCodeBox}>
        <Ionicons name="ticket-outline" size={24} color="#007AFF" />
        <TextInput
          style={styles.inviteCodeInput}
          placeholder="ES: ABCD1234"
          placeholderTextColor="#999"
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={8}
          autoFocus
        />
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, validatingCode && styles.btnDisabled]}
        onPress={() => setStep('form')} // Skip validation, go directly to form
        disabled={validatingCode}
      >
        {validatingCode ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.continueBtnText}>Continua</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.inviteHint}>
        💡 Non hai il codice? Contatta l'amministratore della tua società sportiva.
      </Text>
    </View>
  );

  // STEP 3: Registration Form
  const renderForm = () => (
    <View style={styles.form}>
      <TouchableOpacity 
        style={styles.backBtn} 
        onPress={() => setStep('role')}
      >
        <View style={{ backgroundColor: "rgba(0,122,255,0.15)", borderRadius: 20, padding: 6 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
      </TouchableOpacity>

      <Text style={styles.formTitle}>
        Registrazione {role === 'parent' ? 'Genitore' : role === 'coach' ? 'Coach' : role === 'athlete' ? 'Atleta Maggiorenne' : 'Dirigente'}
      </Text>

      {/* Invite code for all roles (inline) */}
      <View style={styles.inviteCodeSection}>
        <Text style={styles.inviteCodeLabel}>🎟️ Codice Invito Società</Text>
        <TextInput
          style={styles.inviteCodeInputSmall}
          placeholder="Es: ABCD1234"
          placeholderTextColor="#999"
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={8}
          data-testid="invite-code-input"
        />
      </View>

      {/* Show society name if validated */}
      {societyName && (
        <View style={styles.societyBadge}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.societyBadgeText}>{societyName}</Text>
        </View>
      )}

      {/* Name fields */}
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
        onSubmitEditing={() => phoneRef.current?.focus()}
      />

      <Text style={styles.inputLabel}>📱 Telefono * (per contatti urgenti)</Text>
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
          <Ionicons name={showPasswords ? "eye" : "eye-off"} size={20} color="#666" />
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

      {/* Warning for Coach/Dirigente */}
      {(role === 'coach' || role === 'viewer') && (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle" size={20} color="#FF9500" />
          <Text style={styles.warningText}>
            ⚠️ Dopo la registrazione, il tuo account dovrà essere approvato da un Amministratore prima di poter accedere a tutte le funzionalità.
          </Text>
        </View>
      )}

      {/* Info for Parent */}
      {role === 'parent' && (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Gli altri dati potrai inserirli dopo nella sezione "Il mio profilo".
          </Text>
        </View>
      )}

      {/* Info for Adult Athlete */}
      {role === 'athlete' && (
        <View style={[styles.infoBox, { backgroundColor: '#FFF8E1', borderColor: '#FF9800', borderWidth: 1 }]}>
          <Ionicons name="fitness" size={20} color="#FF9800" />
          <Text style={styles.infoText}>
            🏃 Come atleta maggiorenne, avrai 7 giorni di prova. Verrai assegnato a una squadra dall'amministratore.
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.registerButton, loading && styles.btnDisabled]}
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

      <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/login')}>
        <Text style={styles.loginLinkText}>
          Hai già un account? <Text style={styles.loginLinkBold}>Accedi</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );

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
        {step === 'role' && renderRoleSelection()}
        {step === 'invite' && renderInviteCode()}
        {step === 'form' && renderForm()}
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
    paddingTop: 60,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  stepContainer: {
    flex: 1,
    width: '100%',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    lineHeight: 20,
  },
  backBtn: {
    marginBottom: 20,
    padding: 4,
  },
  // Role Cards
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleCardContent: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  roleCardDesc: {
    fontSize: 13,
    color: '#666',
  },
  // Invite Code Step
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 12,
  },
  inviteCodeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: '#007AFF',
    textAlign: 'center',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  inviteHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
  // Form
  form: {
    flex: 1,
    width: '100%',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inviteCodeSection: {
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  inviteCodeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  inviteCodeInputSmall: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 3,
    color: '#007AFF',
  },
  societyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  societyBadgeText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
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
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
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
