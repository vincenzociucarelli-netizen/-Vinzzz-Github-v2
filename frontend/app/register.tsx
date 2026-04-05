import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import { Ionicons } from '../src/components/Icon';

export default function Register() {
  const router = useRouter();
  const { code: urlCode, invite_token: urlInviteToken } = useLocalSearchParams<{ code?: string; invite_token?: string }>();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Step management: 'role' -> 'invite' -> 'form' -> 'child-check' (parents only)
  const [step, setStep] = useState<'role' | 'invite' | 'form' | 'child-check'>('role');
  
  // Form fields
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
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
  const [codeFromUrl, setCodeFromUrl] = useState(false);

  // Auto-fill invite code from URL parameter (?code=XXXX)
  useEffect(() => {
    if (urlCode && !inviteCode) {
      setInviteCode(urlCode.toUpperCase());
      setCodeFromUrl(true);
    }
  }, [urlCode]);
  
  // Child-check step states (for parents)
  const [childAlreadyRegistered, setChildAlreadyRegistered] = useState<boolean | null>(null);
  const [searchCognome, setSearchCognome] = useState('');
  const [searchNome, setSearchNome] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [linkRequestSent, setLinkRequestSent] = useState(false);
  const [linkError, setLinkError] = useState('');
  
  // GDPR consent states
  const [consentPrivacyViewed, setConsentPrivacyViewed] = useState(false);
  const [consentDataProcessing, setConsentDataProcessing] = useState(false);
  const [consentInternalImages, setConsentInternalImages] = useState(false);
  const [consentPromotionalImages, setConsentPromotionalImages] = useState(false);

  // Refs
  const firstNameRef = useRef<TextInput>(null);
  const fiscalCodeRef = useRef<TextInput>(null);
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
      showAlert('Errore', error.response?.data?.detail || 'Codice invito non valido. Verifica e riprova.');
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


    // Invite code required for ALL roles
    if (!inviteCode) {
      showAlert('Errore', 'Inserisci il codice invito della tua società sportiva');
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
          fiscal_code: fiscalCode.trim().toUpperCase() || undefined,
          role: role,
          invite_code: inviteCode.trim().toUpperCase(),
          ...(role === 'parent' && dataPassword ? { data_password: dataPassword } : {}),
          consents: {
            privacy_viewed: consentPrivacyViewed,
            images_promo: consentPromotionalImages,
          },
        });
      }

      if (response.data.token) {
        // Mark invite as completed if coming from email invite
        if (urlInviteToken) {
          try {
            await api.post('/athletes/invite-complete', { token: urlInviteToken });
          } catch (e) { /* ignore - non-critical */ }
        }
        
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
          // Parent can login immediately, then show child-check step
          await setUser(response.data.user, response.data.token);
          setStep('child-check');
        }
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      let msg = 'Errore durante la registrazione';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail)) msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      showAlert('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  // === Child-check step functions ===
  const searchChild = async () => {
    if (!searchCognome.trim()) {
      showAlert('Attenzione', 'Inserisci almeno il cognome');
      return;
    }
    setSearching(true);
    setSearchDone(true);
    try {
      const response = await api.post('/parent-link/search', {
        cognome: searchCognome.trim(),
        nome: searchNome.trim(),
      });
      setSearchResults(response.data.results || []);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la ricerca');
    } finally {
      setSearching(false);
    }
  };

  const requestLink = async (athleteId: string) => {
    setLinkError('');
    try {
      const res = await api.post('/parent-link/request', { athlete_id: athleteId });
      setLinkRequestSent(true);
      // Auto-redirect to parent dashboard
      setTimeout(() => {
        router.replace('/parent');
      }, 2500);
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore nell\'invio della richiesta';
      setLinkError(msg);
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
          setStep('invite');
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
          setStep('invite');
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
          setStep('invite');
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
          setStep('invite');
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
          setStep('invite');
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
    if (type === 'privacy') { setHasOpenedPrivacy(true); setConsentPrivacyViewed(true); }
    if (type === 'terms') setHasOpenedTerms(true);
  };

  const canContinueFromWelcome = hasOpenedPrivacy && hasOpenedTerms && consentPrivacyViewed;

  // After welcome, decide next step - ALWAYS go to invite code step
  const proceedFromWelcome = () => {
    setStep('invite');
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
              I dati di tutti gli iscritti sono gestiti dalla tua associazione sportiva. RegistraTEAM fornisce la tecnologia, ma non decide come vengono utilizzati.
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

        {/* GDPR Consent Checkboxes */}
        {hasOpenedPrivacy && hasOpenedTerms && (
          <View style={{ marginTop: 12, marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 }}>I tuoi consensi personali:</Text>
            
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10 }}
              onPress={() => setConsentPrivacyViewed(!consentPrivacyViewed)}
              data-testid="consent-privacy-viewed"
            >
              <Ionicons name={consentPrivacyViewed ? "checkbox" : "square-outline"} size={22} color={consentPrivacyViewed ? "#4CAF50" : "#999"} />
              <Text style={{ flex: 1, fontSize: 13, color: '#333', lineHeight: 18 }}>
                <Text style={{ fontWeight: '600' }}>Dichiaro di aver preso visione dell'Informativa sulla Privacy</Text> <Text style={{ color: '#C62828', fontWeight: '700' }}>*</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10, backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FFB74D' }}
              onPress={() => setConsentPromotionalImages(!consentPromotionalImages)}
              data-testid="consent-promotional-images"
            >
              <Ionicons name={consentPromotionalImages ? "checkbox" : "square-outline"} size={26} color={consentPromotionalImages ? "#FF6F00" : "#FF9800"} />
              <Text style={{ flex: 1, fontSize: 14, color: '#333', lineHeight: 20, fontWeight: '500' }}>
                Acconsento all'uso delle mie immagini a scopi promozionali
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!canContinueFromWelcome && (
          <View style={styles.welcomeHintBox}>
            <Ionicons name="alert-circle" size={16} color="#E65100" />
            <Text style={styles.welcomeHintText}>
              {!hasOpenedTerms || !hasOpenedPrivacy 
                ? 'Devi aprire e leggere entrambi i documenti prima di poter continuare'
                : 'Devi confermare la presa visione della privacy per continuare'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueBtn, !canContinueFromWelcome && styles.btnDisabledStrong]}
          onPress={() => { if (canContinueFromWelcome) proceedFromWelcome(); }}
          activeOpacity={canContinueFromWelcome ? 0.7 : 1}
          data-testid="welcome-continue-btn"
        >
          <Text style={[styles.continueBtnText, !canContinueFromWelcome && { opacity: 0.5 }]}>
            {canContinueFromWelcome ? 'Continua' : 'Apri i documenti'}
          </Text>
          <Ionicons name={canContinueFromWelcome ? "arrow-forward" : "lock-closed"} size={20} color={canContinueFromWelcome ? "#fff" : "rgba(255,255,255,0.5)"} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Auto-validate invite code when it comes from URL
  useEffect(() => {
    if (codeFromUrl && inviteCode && step === 'invite' && !societyName) {
      validateInviteCode();
    }
  }, [step, codeFromUrl]);

  // STEP 3: Invite Code (for Coach/Dirigente)
  const renderInviteCode = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setStep('role')}>
        <View style={{ backgroundColor: "rgba(0,122,255,0.15)", borderRadius: 20, padding: 6 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>Codice Invito Società</Text>
      <Text style={styles.stepSubtitle}>
        {codeFromUrl 
          ? 'Il codice è stato precompilato dal link ricevuto. Verifica e continua.'
          : 'Inserisci il codice che ti è stato fornito dalla tua società sportiva. Senza questo codice non è possibile procedere con la registrazione.'}
      </Text>

      <View style={styles.inviteCodeBox}>
        <Ionicons name="ticket-outline" size={24} color="#007AFF" />
        <TextInput
          style={styles.inviteCodeInput}
          placeholder="ES: ABCD1234"
          placeholderTextColor="#999"
          value={inviteCode}
          onChangeText={(text) => { setInviteCode(text.toUpperCase()); setSocietyName(''); }}
          autoCapitalize="characters"
          maxLength={8}
          autoFocus
          data-testid="invite-code-step-input"
        />
      </View>

      {societyName ? (
        <View style={[styles.societyBadge, { marginBottom: 16 }]}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.societyBadgeText}>{societyName}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.continueBtn, (validatingCode || !inviteCode.trim()) && styles.btnDisabled]}
        onPress={validateInviteCode}
        disabled={validatingCode || !inviteCode.trim()}
        data-testid="validate-invite-btn"
      >
        {validatingCode ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.continueBtnText}>Verifica e Continua</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.inviteHint}>
        Non hai il codice? Contatta l'amministratore della tua società sportiva.
      </Text>
    </View>
  );

  // STEP 3: Registration Form
  const renderForm = () => (
    <View style={styles.form}>
      <TouchableOpacity 
        style={styles.backBtn} 
        onPress={() => setStep('invite')}
      >
        <View style={{ backgroundColor: "rgba(0,122,255,0.15)", borderRadius: 20, padding: 6 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
      </TouchableOpacity>

      <Text style={styles.formTitle}>
        Registrazione {role === 'parent' ? 'Genitore' : role === 'coach' ? 'Coach' : role === 'athlete' ? 'Atleta Maggiorenne' : role === 'collaboratore' ? 'Collaboratore' : 'Dirigente'}
      </Text>

      {/* Show validated society */}
      {societyName && (
        <View style={[styles.societyBadge, { marginBottom: 12 }]}>
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
        onSubmitEditing={() => fiscalCodeRef.current?.focus()}
      />

      <Text style={styles.inputLabel}>Codice Fiscale</Text>
      <TextInput
        ref={fiscalCodeRef}
        style={styles.input}
        placeholder="es: RSSMRA85M01G478L"
        placeholderTextColor="#aaa"
        value={fiscalCode}
        onChangeText={(text) => setFiscalCode(text.toUpperCase())}
        autoCapitalize="characters"
        maxLength={16}
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        data-testid="fiscal-code-input"
      />

      <Text style={styles.inputLabel}>Telefono * (per contatti urgenti)</Text>
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
            Come atleta maggiorenne, avrai 7 giorni di prova. Verrai assegnato a una squadra dall'amministratore.
          </Text>
        </View>
      )}

      {/* Privacy e Consensi Section */}
      <View style={{ backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 }}>Privacy e Consensi</Text>
        
        {/* Open Terms */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}
          onPress={() => { 
            const base = typeof window !== 'undefined' ? window.location.origin : '';
            if (typeof window !== 'undefined') window.open(base + '/terms-of-use', '_blank');
            setHasOpenedTerms(true);
            if (hasOpenedPrivacy) setConsentPrivacyViewed(true);
          }}
          data-testid="open-terms-link"
        >
          <Ionicons name={hasOpenedTerms ? "checkmark-circle" : "document-text-outline"} size={22} color={hasOpenedTerms ? "#4CAF50" : "#007AFF"} />
          <Text style={{ flex: 1, fontSize: 14, color: '#007AFF', textDecorationLine: 'underline' }}>Termini di utilizzo</Text>
          {hasOpenedTerms && <Text style={{ fontSize: 11, color: '#4CAF50' }}>Letto</Text>}
        </TouchableOpacity>

        {/* Open Privacy */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}
          onPress={() => { 
            const base = typeof window !== 'undefined' ? window.location.origin : '';
            if (typeof window !== 'undefined') window.open(base + '/privacy-policy', '_blank');
            setHasOpenedPrivacy(true);
            if (hasOpenedTerms) setConsentPrivacyViewed(true);
          }}
          data-testid="open-privacy-policy-link"
        >
          <Ionicons name={hasOpenedPrivacy ? "checkmark-circle" : "shield-outline"} size={22} color={hasOpenedPrivacy ? "#4CAF50" : "#007AFF"} />
          <Text style={{ flex: 1, fontSize: 14, color: '#007AFF', textDecorationLine: 'underline' }}>Informativa sulla Privacy</Text>
          {hasOpenedPrivacy && <Text style={{ fontSize: 11, color: '#4CAF50' }}>Letto</Text>}
        </TouchableOpacity>

        {/* Auto-checked consent when both docs opened */}
        {hasOpenedPrivacy && hasOpenedTerms && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10 }}>
              <Ionicons name="checkbox" size={22} color="#4CAF50" />
              <Text style={{ flex: 1, fontSize: 13, color: '#333' }}>
                Dichiaro di aver preso visione dell'Informativa sulla Privacy e dei Termini di utilizzo *
              </Text>
            </View>

            {/* Promotional images consent */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10, backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, marginTop: 4 }}
              onPress={() => setConsentPromotionalImages(!consentPromotionalImages)}
              data-testid="consent-promo-images"
            >
              <Ionicons name={consentPromotionalImages ? "checkbox" : "square-outline"} size={22} color={consentPromotionalImages ? "#FF9800" : "#999"} />
              <Text style={{ flex: 1, fontSize: 13, color: '#333' }}>
                Acconsento all'uso delle mie immagini a scopi promozionali (facoltativo)
              </Text>
            </TouchableOpacity>
          </>
        )}

        {!hasOpenedPrivacy || !hasOpenedTerms ? (
          <Text style={{ fontSize: 12, color: '#999', marginTop: 8, fontStyle: 'italic' }}>
            Apri entrambi i documenti per procedere
          </Text>
        ) : null}
      </View>

      {/* Submit Button */}
      {(() => {
        const canSubmit = hasOpenedTerms && hasOpenedPrivacy && consentPrivacyViewed && !loading;
        return (
          <TouchableOpacity
            style={[styles.registerButton, !canSubmit && { opacity: 0.4 }]}
            onPress={handleRegister}
            disabled={!canSubmit}
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
        );
      })()}

      <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/login')}>
        <Text style={styles.loginLinkText}>
          Hai già un account? <Text style={styles.loginLinkBold}>Accedi</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );

  // STEP: Child already registered? (after parent registration)
  const renderChildCheck = () => (
    <View style={styles.stepContainer}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ backgroundColor: '#E8F5E9', borderRadius: 50, width: 64, height: 64, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
        </View>
        <Text style={styles.stepTitle}>Registrazione completata!</Text>
        <Text style={[styles.stepSubtitle, { textAlign: 'center' }]}>
          Benvenuto/a nella società {societyName || ''}
        </Text>
      </View>

      <Text style={{ fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 16, textAlign: 'center' }}>
        Il tuo figlio/a è già registrato nella società?
      </Text>

      {childAlreadyRegistered === null && (
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#E3F2FD', borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
              borderWidth: 2, borderColor: '#007AFF',
            }}
            onPress={() => setChildAlreadyRegistered(true)}
            data-testid="child-already-yes"
          >
            <View style={{ backgroundColor: '#007AFF', borderRadius: 24, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="search" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#007AFF' }}>Sì, è già registrato</Text>
              <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Cerca il figlio/a per cognome e richiedi il collegamento</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: '#FFF3E0', borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
              borderWidth: 2, borderColor: '#FF9800',
            }}
            onPress={() => router.replace('/parent/register-athlete')}
            data-testid="child-already-no"
          >
            <View style={{ backgroundColor: '#FF9800', borderRadius: 24, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="person-add" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#E65100' }}>No, devo registrarlo</Text>
              <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Compila il modulo di iscrizione per il tuo figlio/a</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 8, padding: 12 }}
            onPress={() => router.replace('/parent')}
            data-testid="skip-child-check"
          >
            <Text style={{ fontSize: 14, color: '#999' }}>Lo farò più tardi</Text>
          </TouchableOpacity>
        </View>
      )}

      {childAlreadyRegistered === true && !linkRequestSent && (
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E0E0E0' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 12 }}>
            Cerca il tuo figlio/a per cognome
          </Text>

          <TextInput
            style={{ backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 8 }}
            placeholder="Cognome *"
            value={searchCognome}
            onChangeText={setSearchCognome}
            autoCapitalize="characters"
            data-testid="child-search-cognome"
          />
          <TextInput
            style={{ backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 12 }}
            placeholder="Nome (opzionale)"
            value={searchNome}
            onChangeText={setSearchNome}
            autoCapitalize="characters"
            data-testid="child-search-nome"
          />

          <TouchableOpacity
            style={[styles.continueBtn, (searching || !searchCognome.trim()) && styles.btnDisabled]}
            onPress={searchChild}
            disabled={searching || !searchCognome.trim()}
            data-testid="child-search-btn"
          >
            {searching ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.continueBtnText}> Cerca</Text>
              </>
            )}
          </TouchableOpacity>

          {searchDone && searchResults.length === 0 && !searching && (
            <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 14, marginTop: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#E65100', fontWeight: '600' }}>Nessun risultato trovato</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 4, textAlign: 'center' }}>
                Verifica il cognome o registra il figlio/a come nuovo atleta
              </Text>
              <TouchableOpacity
                style={{ marginTop: 10, backgroundColor: '#FF9800', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
                onPress={() => router.replace('/parent/register-athlete')}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Registra nuovo atleta</Text>
              </TouchableOpacity>
            </View>
          )}

          {searchResults.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                {searchResults.length} risultat{searchResults.length === 1 ? 'o' : 'i'} trovato/i:
              </Text>
              {searchResults.map((athlete: any) => (
                <View key={athlete.id} style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#333' }}>
                        {athlete.last_name} {athlete.first_name}
                      </Text>
                      {athlete.date_of_birth ? (
                        <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Nato/a il {athlete.date_of_birth}</Text>
                      ) : null}
                      {athlete.team ? (
                        <Text style={{ fontSize: 12, color: '#007AFF', marginTop: 2 }}>{athlete.team}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#007AFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                      onPress={() => requestLink(athlete.id)}
                      data-testid={`link-athlete-${athlete.id}`}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Collega</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {linkError ? (
                <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="alert-circle" size={20} color="#C62828" />
                  <Text style={{ flex: 1, fontSize: 13, color: '#C62828', fontWeight: '600' }}>{linkError}</Text>
                </View>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 12, padding: 8 }}
            onPress={() => setChildAlreadyRegistered(null)}
          >
            <Text style={{ fontSize: 13, color: '#007AFF' }}>Indietro</Text>
          </TouchableOpacity>
        </View>
      )}

      {linkRequestSent && (
        <View style={{ backgroundColor: '#E8F5E9', borderRadius: 14, padding: 20, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#2E7D32', marginTop: 12, textAlign: 'center' }}>
            Richiesta di collegamento inviata!
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
            L'altro genitore riceverà una notifica e dovrà approvare il collegamento.
          </Text>
          <Text style={{ fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center' }}>
            Verrai reindirizzato al tuo profilo...
          </Text>
          <TouchableOpacity
            style={[styles.continueBtn, { marginTop: 16 }]}
            onPress={() => router.replace('/parent')}
            data-testid="go-to-parent-dashboard"
          >
            <Text style={styles.continueBtnText}>Vai al Profilo</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
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
        {step === 'child-check' && renderChildCheck()}
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
  welcomeHintBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  welcomeHintText: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600' as const,
  },
  btnDisabledStrong: {
    backgroundColor: '#B0BEC5',
    opacity: 0.7,
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
