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
import { Ionicons } from '@expo/vector-icons';

export default function RegisterCoach() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Account, 2: Anagrafica, 3: Fiscale

  // Step 1 - Account
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 - Dati Anagrafici
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState('');
  const [phone, setPhone] = useState('');

  // Step 3 - Dati Fiscali e Tesserino
  const [fiscalCode, setFiscalCode] = useState('');
  const [coachLicenseNumber, setCoachLicenseNumber] = useState('');

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const validateStep1 = () => {
    if (!inviteCode) {
      showAlert('Errore', 'Inserisci il codice invito della società');
      return false;
    }
    if (!email || !password) {
      showAlert('Errore', 'Compila tutti i campi');
      return false;
    }
    if (password !== confirmPassword) {
      showAlert('Errore', 'Le password non coincidono');
      return false;
    }
    if (password.length < 6) {
      showAlert('Errore', 'La password deve essere di almeno 6 caratteri');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!firstName || !lastName || !dateOfBirth) {
      showAlert('Errore', 'Compila nome, cognome e data di nascita');
      return false;
    }
    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dateOfBirth)) {
      showAlert('Errore', 'Formato data non valido. Usa GG/MM/AAAA');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!fiscalCode) {
      showAlert('Errore', 'Inserisci il codice fiscale');
      return false;
    }
    if (!coachLicenseNumber) {
      showAlert('Errore', 'Inserisci il numero di tesserino allenatore');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const convertToISODate = (dateStr: string): string => {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };

  const handleRegister = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const fullName = `${lastName} ${firstName}`;
      const isoDate = convertToISODate(dateOfBirth);

      const response = await api.post('/auth/register', {
        email,
        password,
        full_name: fullName,
        role: 'coach',
        invite_code: inviteCode.toUpperCase(),
        first_name: firstName,
        last_name: lastName,
        date_of_birth: isoDate,
        place_of_birth: placeOfBirth || null,
        fiscal_code: fiscalCode,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        province: province || null,
        phone: phone || null,
        coach_license_number: coachLicenseNumber,
      });

      await setUser(response.data.user, response.data.token);
      
      showAlert(
        'Registrazione Completata',
        'La tua richiesta è stata inviata. Attendi l\'approvazione dell\'amministratore.',
        () => router.replace('/coach')
      );
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
        <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>1</Text>
      </View>
      <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
      <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
        <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>2</Text>
      </View>
      <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
      <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
        <Text style={[styles.stepDotText, step >= 3 && styles.stepDotTextActive]}>3</Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>👤 Credenziali Account</Text>
      
      <Text style={styles.inputLabel}>Email *</Text>
      <TextInput
        style={styles.input}
        placeholder="esempio@email.com"
        value={email}
        onChangeText={(text) => setEmail(text.toLowerCase())}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.inputLabel}>Password *</Text>
      <TextInput
        style={styles.input}
        placeholder="Minimo 6 caratteri"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.inputLabel}>Conferma Password *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ripeti la password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>📋 Dati Anagrafici</Text>
      
      <Text style={styles.inputLabel}>Nome *</Text>
      <TextInput
        style={styles.input}
        placeholder="MARIO"
        value={firstName}
        onChangeText={(text) => setFirstName(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <Text style={styles.inputLabel}>Cognome *</Text>
      <TextInput
        style={styles.input}
        placeholder="ROSSI"
        value={lastName}
        onChangeText={(text) => setLastName(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <Text style={styles.inputLabel}>Data di nascita *</Text>
      <TextInput
        style={styles.input}
        placeholder="GG/MM/AAAA"
        placeholderTextColor="#999"
        value={dateOfBirth}
        onChangeText={(text) => {
          // Auto-format date with slashes
          const cleaned = text.replace(/\D/g, '');
          let formatted = '';
          if (cleaned.length > 0) formatted = cleaned.substring(0, 2);
          if (cleaned.length > 2) formatted += '/' + cleaned.substring(2, 4);
          if (cleaned.length > 4) formatted += '/' + cleaned.substring(4, 8);
          setDateOfBirth(formatted);
        }}
        keyboardType="numeric"
        maxLength={10}
      />

      <Text style={styles.inputLabel}>Luogo di nascita</Text>
      <TextInput
        style={styles.input}
        placeholder="PERUGIA"
        value={placeOfBirth}
        onChangeText={(text) => setPlaceOfBirth(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <Text style={styles.inputLabel}>Indirizzo</Text>
      <TextInput
        style={styles.input}
        placeholder="VIA ROMA 1"
        value={address}
        onChangeText={(text) => setAddress(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <View style={styles.row}>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>Città</Text>
          <TextInput
            style={styles.input}
            placeholder="PERUGIA"
            value={city}
            onChangeText={(text) => setCity(text.toUpperCase())}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.inputSmall}>
          <Text style={styles.inputLabel}>Prov.</Text>
          <TextInput
            style={styles.input}
            placeholder="PG"
            value={province}
            onChangeText={(text) => setProvince(text.toUpperCase())}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputSmall}>
          <Text style={styles.inputLabel}>CAP</Text>
          <TextInput
            style={styles.input}
            placeholder="06100"
            value={postalCode}
            onChangeText={setPostalCode}
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>Telefono</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>
      </View>
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>💼 Dati Fiscali e Tesserino</Text>
      
      <Text style={styles.inputLabel}>Codice Fiscale *</Text>
      <TextInput
        style={styles.input}
        placeholder="RSSMRA80A01H501Z"
        value={fiscalCode}
        onChangeText={(text) => setFiscalCode(text.toUpperCase())}
        autoCapitalize="characters"
        maxLength={16}
      />

      <Text style={styles.inputLabel}>Numero Tesserino Allenatore *</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={coachLicenseNumber}
        onChangeText={(text) => setCoachLicenseNumber(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Il compenso mensile e le squadre assegnate saranno configurati dall'amministratore della società dopo l'approvazione.
        </Text>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrazione Coach</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderStepIndicator()}
        
        <Text style={styles.stepLabel}>
          Passo {step} di 3: {step === 1 ? 'Account' : step === 2 ? 'Anagrafica' : 'Fiscale'}
        </Text>

        <View style={styles.form}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <View style={styles.buttonRow}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handlePrevStep}
              >
                <Ionicons name="arrow-back" size={20} color="#007AFF" />
                <Text style={styles.buttonSecondaryText}>Indietro</Text>
              </TouchableOpacity>
            )}
            
            {step < 3 ? (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, step === 1 && { flex: 1 }]}
                onPress={handleNextStep}
              >
                <Text style={styles.buttonPrimaryText}>Avanti</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.buttonPrimaryText}>
                  {loading ? 'Registrazione...' : 'Completa Registrazione'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
    backgroundColor: '#007AFF',
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#007AFF',
  },
  stepDotText: {
    color: '#999',
    fontWeight: 'bold',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: '#e0e0e0',
  },
  stepLineActive: {
    backgroundColor: '#007AFF',
  },
  stepLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#000',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputSmall: {
    width: 100,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F4FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    marginLeft: 12,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  buttonSecondary: {
    backgroundColor: '#f0f0f0',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
