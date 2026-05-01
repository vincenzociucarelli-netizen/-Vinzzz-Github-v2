/**
 * /register-society
 *
 * Pagina pubblica di onboarding per una NUOVA Società sportiva.
 * Crea in un colpo:
 *   1) la Società
 *   2) l'admin persona fisica (Dirigente Incaricato) → auto-login
 *   3) l'account istituzionale (read-only) con email di setup password
 *
 * Vincoli:
 *  - email istituzionale ≠ email personale dirigente
 *  - termini, privacy e dichiarazione "autorizzato dalla Società" obbligatori
 */
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import { Ionicons } from '../src/components/Icon';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterSocietyScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  // Society fields
  const [societyName, setSocietyName] = useState('');
  const [societyFiscal, setSocietyFiscal] = useState('');
  const [societyAddress, setSocietyAddress] = useState('');
  const [societyCity, setSocietyCity] = useState('');
  const [societyPostalCode, setSocietyPostalCode] = useState('');
  const [societyProvince, setSocietyProvince] = useState('');
  const [societyEmail, setSocietyEmail] = useState('');
  const [societyPhone, setSocietyPhone] = useState('');
  const [societyPec, setSocietyPec] = useState('');

  // Admin (dirigente incaricato) fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminFiscal, setAdminFiscal] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Legal acceptance
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAuthorization, setAcceptAuthorization] = useState(false);

  const [loading, setLoading] = useState(false);

  const showError = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Errore', msg);
  };

  const showSuccess = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Successo', msg);
  };

  const validate = (): string | null => {
    if (!societyName.trim()) return 'Inserisci il nome della Società';
    if (!societyFiscal.trim() || societyFiscal.trim().length < 11)
      return 'Codice fiscale / P.IVA della Società obbligatorio (min 11 caratteri)';
    if (!societyAddress.trim()) return 'Inserisci la sede legale della Società';
    if (!REGEX_EMAIL.test(societyEmail.trim()))
      return "L'email istituzionale della Società non è valida";

    if (!firstName.trim() || !lastName.trim()) return 'Inserisci nome e cognome';
    if (!REGEX_EMAIL.test(adminEmail.trim())) return 'La tua email personale non è valida';
    if (adminEmail.trim().toLowerCase() === societyEmail.trim().toLowerCase())
      return "La tua email personale deve essere DIVERSA dall'email istituzionale della Società";
    if (!adminPhone.trim()) return 'Inserisci il tuo telefono';
    if (!adminFiscal.trim() || adminFiscal.trim().length !== 16)
      return 'Codice fiscale personale obbligatorio (16 caratteri)';
    if (password.length < 8) return 'La password deve essere di almeno 8 caratteri';
    if (password !== confirmPassword) return 'Le due password non coincidono';

    if (!acceptTerms) return 'Devi accettare i Termini di Utilizzo';
    if (!acceptPrivacy) return "Devi accettare l'Informativa Privacy";
    if (!acceptAuthorization)
      return 'Devi dichiarare di essere autorizzato dalla Società ad attivare RegistraTEAM';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register-society', {
        society_name: societyName.trim(),
        society_fiscal_code: societyFiscal.trim().toUpperCase(),
        society_address: societyAddress.trim(),
        society_city: societyCity.trim() || undefined,
        society_postal_code: societyPostalCode.trim() || undefined,
        society_province: societyProvince.trim().toUpperCase() || undefined,
        society_email: societyEmail.trim().toLowerCase(),
        society_phone: societyPhone.trim() || undefined,
        society_pec: societyPec.trim().toLowerCase() || undefined,
        admin_email: adminEmail.trim().toLowerCase(),
        admin_password: password,
        admin_first_name: firstName.trim(),
        admin_last_name: lastName.trim(),
        admin_fiscal_code: adminFiscal.trim().toUpperCase(),
        admin_phone: adminPhone.trim(),
        accept_terms: acceptTerms,
        accept_privacy: acceptPrivacy,
        accept_authorization: acceptAuthorization,
      });
      const { token, user } = res.data;
      await setUser(user, token);
      showSuccess(
        `🎉 Benvenuto in RegistraTEAM!\n\nLa tua Società è stata creata.\n\n📧 Abbiamo inviato un'email a ${societyEmail.trim()} con il link per impostare la prima password della casella istituzionale (sola lettura).\n\nOra completi la tua dichiarazione come Responsabile Admin.`
      );
      router.replace('/admin');
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail || 'Errore durante la registrazione della Società';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backBtn} data-testid="back-to-login">
            <Ionicons name="chevron-back" size={26} color="#1565C0" />
          </TouchableOpacity>
          <View style={styles.iconWrap}>
            <Ionicons name="business" size={48} color="#fff" />
          </View>
          <Text style={styles.title}>Registra una nuova Società</Text>
          <Text style={styles.subtitle}>
            Onboarding RegistraTEAM — Configurazione iniziale
          </Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#1565C0" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Come funziona</Text>
            <Text style={styles.infoText}>
              Tu sei il <Text style={styles.bold}>Dirigente Incaricato</Text> della
              configurazione tecnica. Compila i dati della Società e i tuoi dati personali:
              creeremo la Società, il tuo account admin e — automaticamente — la casella
              email ufficiale della Società in <Text style={styles.bold}>sola lettura</Text>{' '}
              (per ricevere comunicazioni).
            </Text>
          </View>
        </View>

        {/* Sezione Società */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Dati della Società</Text>

          <Field label="Nome / Ragione Sociale *" value={societyName} onChange={setSocietyName} placeholder="Es. Pallavolo Perugia SSD A RL" testID="society-name" />
          <Field label="Codice Fiscale / P.IVA Società *" value={societyFiscal} onChange={setSocietyFiscal} placeholder="11 caratteri" autoCap="characters" testID="society-fiscal" maxLength={16} />
          <Field label="Sede legale (Via, n.) *" value={societyAddress} onChange={setSocietyAddress} placeholder="Es. Via Roma 1" testID="society-address" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}>
              <Field label="Città" value={societyCity} onChange={setSocietyCity} placeholder="Perugia" testID="society-city" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CAP" value={societyPostalCode} onChange={setSocietyPostalCode} placeholder="06100" testID="society-cap" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Prov." value={societyProvince} onChange={setSocietyProvince} placeholder="PG" autoCap="characters" testID="society-prov" maxLength={2} />
            </View>
          </View>
          <Field label="Email istituzionale ufficiale *" value={societyEmail} onChange={setSocietyEmail} placeholder="info@tuasocieta.it" keyboard="email-address" testID="society-email" />
          <Text style={styles.hint}>
            Questa è la casella ufficiale della Società. Riceverà notifiche e copia delle
            comunicazioni, ma non potrà eseguire operazioni (sola lettura).
          </Text>
          <Field label="Telefono Società" value={societyPhone} onChange={setSocietyPhone} placeholder="075 1234567" keyboard="phone-pad" testID="society-phone" />
          <Field label="PEC (opzionale)" value={societyPec} onChange={setSocietyPec} placeholder="pec@pec.tuasocieta.it" keyboard="email-address" testID="society-pec" />
        </View>

        {/* Sezione Dirigente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. I tuoi dati (Dirigente Incaricato)</Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="Nome *" value={firstName} onChange={setFirstName} testID="admin-first-name" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cognome *" value={lastName} onChange={setLastName} testID="admin-last-name" />
            </View>
          </View>
          <Field label="La tua email personale *" value={adminEmail} onChange={setAdminEmail} placeholder="mario.rossi@gmail.com" keyboard="email-address" testID="admin-email" />
          <Text style={styles.hint}>Deve essere DIVERSA dall'email istituzionale.</Text>
          <Field label="Telefono *" value={adminPhone} onChange={setAdminPhone} keyboard="phone-pad" testID="admin-phone" />
          <Field label="Codice Fiscale personale *" value={adminFiscal} onChange={setAdminFiscal} placeholder="16 caratteri" autoCap="characters" testID="admin-fiscal" maxLength={16} />

          {/* Password */}
          <View style={styles.passwordRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Password *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                placeholder="min 8 caratteri"
                data-testid="admin-password"
                autoComplete="new-password"
              />
            </View>
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn} data-testid="toggle-pwd">
              <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <View>
            <Text style={styles.fieldLabel}>Conferma password *</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPwd}
              data-testid="admin-confirm-pwd"
              autoComplete="new-password"
            />
          </View>
        </View>

        {/* Sezione legale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Dichiarazioni legali</Text>

          <CheckRow value={acceptTerms} onToggle={() => setAcceptTerms(!acceptTerms)} testID="accept-terms">
            Dichiaro di aver letto e accettato i{' '}
            <Text style={styles.link} onPress={() => router.push('/terms-of-use')}>Termini di Utilizzo</Text>
          </CheckRow>
          <CheckRow value={acceptPrivacy} onToggle={() => setAcceptPrivacy(!acceptPrivacy)} testID="accept-privacy">
            Dichiaro di aver letto l'
            <Text style={styles.link} onPress={() => router.push('/privacy-policy')}>Informativa Privacy</Text>{' '}
            e acconsento al trattamento dei miei dati personali ai sensi del GDPR (UE 2016/679)
          </CheckRow>
          <CheckRow value={acceptAuthorization} onToggle={() => setAcceptAuthorization(!acceptAuthorization)} testID="accept-authorization">
            Dichiaro di essere stato autorizzato dalla Società ad attivare RegistraTEAM e
            di assumere le funzioni di Dirigente Incaricato per la configurazione iniziale.
          </CheckRow>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          data-testid="submit-register-society"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Crea la Società e Accedi</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.loginBtn} data-testid="goto-login">
          <Text style={styles.loginText}>Hai già un account? Accedi</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ----- Helpers ---------------------------------------------------------

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
  autoCap,
  testID,
  maxLength,
}: any) => (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType={keyboard || 'default'}
      autoCapitalize={autoCap || 'none'}
      maxLength={maxLength}
      data-testid={testID}
    />
  </View>
);

const CheckRow = ({ value, onToggle, children, testID }: any) => (
  <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.7} data-testid={testID}>
    <View style={[styles.checkbox, value && styles.checkboxOn]}>
      {value && <Ionicons name="checkmark" size={16} color="#fff" />}
    </View>
    <Text style={styles.checkText}>{children}</Text>
  </TouchableOpacity>
);

// ----- Styles ----------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scroll: { padding: 0, paddingBottom: 40 },
  header: {
    backgroundColor: '#1565C0',
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, textAlign: 'center' },
  infoCard: {
    margin: 16,
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoTitle: { fontWeight: '800', color: '#0D47A1', marginBottom: 4, fontSize: 13 },
  infoText: { fontSize: 13, color: '#1565C0', lineHeight: 18 },
  bold: { fontWeight: '700' },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1565C0', marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fafafa' },
  hint: { fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' },
  passwordRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  eyeBtn: { padding: 10, marginBottom: 0 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#1565C0', marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#1565C0' },
  checkText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#333' },
  link: { color: '#1565C0', fontWeight: '700', textDecorationLine: 'underline' },
  submitBtn: { marginHorizontal: 16, backgroundColor: '#1565C0', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  loginBtn: { padding: 16, alignItems: 'center' },
  loginText: { color: '#1565C0', fontSize: 14, fontWeight: '600' },
});
