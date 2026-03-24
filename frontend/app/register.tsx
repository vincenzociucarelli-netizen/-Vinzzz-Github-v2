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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import { Ionicons } from '../src/components/Icon';

export default function Register() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Step management: 'role' -> 'welcome' -> 'invite' -> 'form'
  const [step, setStep] = useState<'role' | 'welcome' | 'invite' | 'form'>('role');
  
  // Form fields
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dataPassword, setDataPassword] = useState('');
  const [confirmDataPassword, setConfirmDataPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true);
  const [validatingCode, setValidatingCode] = useState(false);
  const [societyName, setSocietyName] = useState('');
  const [hasOpenedPrivacy, setHasOpenedPrivacy] = useState(false);
  const [hasOpenedTerms, setHasOpenedTerms] = useState(false);

  // Refs
  const firstNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const dataPasswordRef = useRef<TextInput>(null);
  const confirmDataPasswordRef = useRef<TextInput>(null);

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

    // Data password validation for parents
    if (role === 'parent') {
      if (!dataPassword) {
        showAlert('Errore', 'Inserisci la Password Dati per proteggere i dati sensibili del minore');
        return;
      }
      if (dataPassword.length < 6) {
        showAlert('Errore', 'La Password Dati deve essere di almeno 6 caratteri');
        return;
      }
      if (dataPassword !== confirmDataPassword) {
        showAlert('Errore', 'Le Password Dati non coincidono');
        return;
      }
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
        
        // Athlete needs email verification
        showAlert(
          'Registrazione completata!',
          'Ti abbiamo inviato un\'email di verifica.\n\nControlla la tua casella di posta e clicca sul link per attivare il tuo account.\n\nSe non la trovi, controlla anche nello spam.',
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
          ...(role === 'parent' && dataPassword ? { data_password: dataPassword } : {}),
        });
      }

      if (response.data.token) {
        // Different behavior based on role
        if (role === 'coach' || role === 'viewer' || role === 'collaboratore') {
          // Coach, Collaboratore and Viewer need approval - do NOT login automatically
          // Show message and redirect to login page
          showAlert(
            '✅ Registrazione completata!',
            'Il tuo account è stato creato.\n\n⏳ IMPORTANTE: La tua registrazione deve essere approvata da un Amministratore prima di poter accedere.\n\nTi contatteremo per accordarci. Una volta approvato, potrai accedere con le tue credenziali.',
            () => router.replace('/login')
          );
        } else {
          // Parent can login immediately
          await setUser(response.data.user, response.data.token);
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
          setStep('welcome');
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
          setStep('welcome');
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
          setStep('welcome');
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
          setStep('welcome');
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
          setStep('welcome');
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

  // Helper: open document and track
  const openDocument = (type: 'privacy' | 'terms') => {
    const url = type === 'privacy' ? '/privacy-policy' : '/terms-of-use';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
    if (type === 'privacy') setHasOpenedPrivacy(true);
    if (type === 'terms') setHasOpenedTerms(true);
  };

  const canContinueFromWelcome = hasOpenedPrivacy && hasOpenedTerms;

  // After welcome, decide next step
  const proceedFromWelcome = () => {
    if (role === 'parent') {
      setStep('form');
    } else {
      // coach, viewer, athlete, collaboratore need invite code in the form
      setStep('form');
    }
  };

  // STEP 2: Welcome Screen
  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('role'); setHasOpenedPrivacy(false); setHasOpenedTerms(false); }}>
        <View style={{ backgroundColor: "rgba(0,122,255,0.15)", borderRadius: 20, padding: 6 }}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </View>
      </TouchableOpacity>

      <View style={styles.welcomeCard} data-testid="welcome-screen">
        <View style={styles.welcomeIconWrapper}>
          <Ionicons name="trophy" size={48} color="#007AFF" />
        </View>
        <Text style={styles.welcomeTitle}>Benvenuto in RegistraTEAM!</Text>
        <Text style={styles.welcomeSubtitle}>
          RegistraTEAM ti aiuta a gestire in modo semplice la tua attivita sportiva: presenze, comunicazioni e organizzazione della tua squadra.
        </Text>

        <View style={styles.welcomeInfoBlock}>
          <Ionicons name="lock-closed" size={18} color="#007AFF" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.welcomeInfoTitle}>I tuoi dati</Text>
            <Text style={styles.welcomeInfoText}>
              I dati degli atleti sono gestiti dalla tua associazione sportiva. RegistraTEAM fornisce la tecnologia, ma non decide come vengono utilizzati.
            </Text>
          </View>
        </View>

        <View style={styles.welcomeInfoBlock}>
          <Ionicons name="clipboard" size={18} color="#007AFF" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.welcomeInfoTitle}>Cosa utilizziamo</Text>
            <Text style={styles.welcomeInfoText}>
              Utilizziamo solo le informazioni necessarie per la gestione sportiva e amministrativa (presenze, certificati, quote).
            </Text>
          </View>
        </View>

        <View style={styles.welcomeInfoBlock}>
          <Ionicons name="shield-checkmark" size={18} color="#007AFF" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.welcomeInfoTitle}>Sicurezza</Text>
            <Text style={styles.welcomeInfoText}>
              I dati sono archiviati in modo sicuro su server situati nell'Unione Europea.
            </Text>
          </View>
        </View>

        <Text style={[styles.welcomeSubtitle, { marginTop: 16, marginBottom: 8 }]}>
          Per maggiori dettagli consulta:
        </Text>

        {/* Terms of Use Link */}
        <TouchableOpacity
          style={[styles.documentLink, hasOpenedTerms && styles.documentLinkVisited]}
          onPress={() => openDocument('terms')}
          data-testid="open-terms-link"
        >
          <View style={styles.documentLinkLeft}>
            <Ionicons
              name={hasOpenedTerms ? "checkmark-circle" : "document-text-outline"}
              size={22}
              color={hasOpenedTerms ? "#4CAF50" : "#007AFF"}
            />
            <Text style={[styles.documentLinkText, hasOpenedTerms && { color: '#4CAF50' }]}>
              Termini di utilizzo
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#999" />
        </TouchableOpacity>

        {/* Privacy Policy Link */}
        <TouchableOpacity
          style={[styles.documentLink, hasOpenedPrivacy && styles.documentLinkVisited]}
          onPress={() => openDocument('privacy')}
          data-testid="open-privacy-policy-link"
        >
          <View style={styles.documentLinkLeft}>
            <Ionicons
              name={hasOpenedPrivacy ? "checkmark-circle" : "document-text-outline"}
              size={22}
              color={hasOpenedPrivacy ? "#4CAF50" : "#007AFF"}
            />
            <Text style={[styles.documentLinkText, hasOpenedPrivacy && { color: '#4CAF50' }]}>
              Informativa sulla Privacy
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#999" />
        </TouchableOpacity>

        <Text style={styles.welcomeAcceptText}>
          Continuando, accetti i Termini di utilizzo e l'Informativa sulla Privacy.
        </Text>

        {!canContinueFromWelcome && (
          <Text style={styles.welcomeHint}>
            Apri entrambi i documenti per poter continuare
          </Text>
        )}

        <TouchableOpacity
          style={[styles.continueBtn, !canContinueFromWelcome && styles.btnDisabled]}
          onPress={proceedFromWelcome}
          disabled={!canContinueFromWelcome}
          data-testid="welcome-continue-btn"
        >
          <Text style={styles.continueBtnText}>Continua</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // STEP 3: Invite Code (for Coach/Dirigente)
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
        Registrazione {role === 'parent' ? 'Genitore' : role === 'coach' ? 'Coach' : role === 'athlete' ? 'Atleta Maggiorenne' : role === 'collaboratore' ? 'Collaboratore' : 'Dirigente'}
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
        returnKeyType={role === 'parent' ? 'next' : 'done'}
        onSubmitEditing={() => role === 'parent' ? dataPasswordRef.current?.focus() : handleRegister()}
      />

      {/* Data Password for Parents */}
      {role === 'parent' && (
        <>
          <View style={[styles.dataPasswordSection, { marginTop: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="shield-checkmark" size={20} color="#FF9500" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>Password Dati (protezione dati sensibili)</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 12 }}>
              Questa password separata protegge i dati personali del minore (codice fiscale, indirizzo, ecc.). 
              Ogni genitore avrà la propria password dati. L'admin potrà resettarla se necessario.
            </Text>

            <Text style={styles.inputLabel}>Password Dati *</Text>
            <TextInput
              ref={dataPasswordRef}
              style={styles.input}
              placeholder="Minimo 6 caratteri"
              placeholderTextColor="#aaa"
              value={dataPassword}
              onChangeText={setDataPassword}
              secureTextEntry={!showPasswords}
              returnKeyType="next"
              onSubmitEditing={() => confirmDataPasswordRef.current?.focus()}
              data-testid="data-password-input"
            />

            <Text style={styles.inputLabel}>Conferma Password Dati *</Text>
            <TextInput
              ref={confirmDataPasswordRef}
              style={styles.input}
              placeholder="Ripeti la password dati"
              placeholderTextColor="#aaa"
              value={confirmDataPassword}
              onChangeText={setConfirmDataPassword}
              secureTextEntry={!showPasswords}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              data-testid="confirm-data-password-input"
            />
          </View>
        </>
      )}

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
        {step === 'welcome' && renderWelcome()}
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
  dataPasswordSection: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9500',
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
  // Welcome Screen
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  welcomeIconWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  documentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F8FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D6E4FF',
  },
  documentLinkVisited: {
    backgroundColor: '#F0FFF0',
    borderColor: '#A5D6A7',
  },
  documentLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  documentLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  welcomeHint: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 8,
  },
  welcomeInfoBlock: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  welcomeInfoTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#333',
    marginBottom: 2,
  },
  welcomeInfoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },
  welcomeAcceptText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
    fontStyle: 'italic' as const,
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
