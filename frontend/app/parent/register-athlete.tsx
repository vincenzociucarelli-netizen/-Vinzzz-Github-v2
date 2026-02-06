import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Team } from '../../src/types';
import { useAuthStore } from '../../src/store/authStore';

export default function RegisterAthlete() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  
  // Dati Anagrafici
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthProvince, setBirthProvince] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState('');
  
  // Contatti
  const [phoneAthlete, setPhoneAthlete] = useState('');
  const [phoneFather, setPhoneFather] = useState('');
  const [phoneMother, setPhoneMother] = useState('');
  const [email, setEmail] = useState('');
  
  // Dati Fiscali
  const [taxPayerLastName, setTaxPayerLastName] = useState('');
  const [taxPayerFirstName, setTaxPayerFirstName] = useState('');
  const [taxPayerFiscalCode, setTaxPayerFiscalCode] = useState('');
  
  // Squadre
  const [teamId, setTeamId] = useState('');
  const [teamId2, setTeamId2] = useState('');  // Seconda squadra (opzionale)
  
  // Periodo di prova
  const [isTrialPeriod, setIsTrialPeriod] = useState(true);  // Default: periodo di prova
  
  // Password protezione dati sensibili
  const [dataPassword, setDataPassword] = useState('');
  const [dataPasswordConfirm, setDataPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
      if (response.data.length > 0) {
        setTeamId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert(
        'Logout',
        'Sei sicuro di voler uscire?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
    }
  };

  const convertToISODate = (dateStr: string) => {
    // Converti da GG/MM/AAAA a YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const formatDateInput = (text: string) => {
    // Remove non-numeric characters except /
    let cleaned = text.replace(/[^0-9/]/g, '');
    
    // Auto-add slashes
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      cleaned += '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      cleaned += '/';
    }
    
    // Limit to dd/mm/yyyy format
    if (cleaned.length > 10) {
      cleaned = cleaned.substring(0, 10);
    }
    
    return cleaned;
  };

  const handleRegister = async () => {
    // Prevent double submission
    if (loading) return;
    
    // Validazioni
    if (!firstName || !lastName) {
      showAlert('Errore', 'Inserisci nome e cognome');
      return;
    }
    
    if (!dateOfBirth) {
      showAlert('Errore', 'Inserisci la data di nascita (GG/MM/AAAA)');
      return;
    }
    
    if (!fiscalCode) {
      showAlert('Errore', 'Inserisci il codice fiscale');
      return;
    }
    
    // Team is OPTIONAL - parent may not know the team yet

    // Valida formato data GG/MM/AAAA
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dateOfBirth)) {
      showAlert('Errore', 'Formato data non valido. Usa GG/MM/AAAA (es: 15/05/2010)');
      return;
    }

    // Calcola se minorenne per validare password
    const parts = dateOfBirth.split('/');
    const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const today = new Date();
    const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const isMinor = age < 18;

    // Se minorenne, password obbligatoria
    if (isMinor && !dataPassword) {
      showAlert('Errore', 'Per un atleta minorenne è obbligatorio impostare una password di protezione dati');
      return;
    }
    
    if (dataPassword && dataPassword !== dataPasswordConfirm) {
      showAlert('Errore', 'Le password non coincidono');
      return;
    }
    
    if (dataPassword && dataPassword.length < 4) {
      showAlert('Errore', 'La password deve essere di almeno 4 caratteri');
      return;
    }

    setLoading(true);
    try {
      const fullName = `${lastName} ${firstName}`;
      const isoDate = convertToISODate(dateOfBirth);
      
      await api.post('/athletes', {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: isoDate,
        birth_place: birthPlace || null,
        birth_province: birthProvince || null,
        fiscal_code: fiscalCode,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        province: province || null,
        phone_athlete: phoneAthlete || null,
        phone_father: phoneFather || null,
        phone_mother: phoneMother || null,
        email: email || null,
        tax_payer_last_name: taxPayerLastName || null,
        tax_payer_first_name: taxPayerFirstName || null,
        tax_payer_fiscal_code: taxPayerFiscalCode || null,
        team_id: teamId,
        team_id_2: teamId2 || null,
        is_trial: isTrialPeriod,
        privacy_accepted: !isTrialPeriod,  // Se non è prova, accetta privacy
        data_password: dataPassword || null,
      });
      
      const successMsg = isTrialPeriod 
        ? 'Atleta registrato! In attesa di approvazione da parte dell\'amministratore.'
        : 'Atleta registrato con privacy accettata! In attesa di approvazione.';
      
      showAlert('Successo', successMsg, () => router.replace('/parent'));
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/parent')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registra Atleta</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.form}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>📋 Dati Anagrafici</Text>

          <Text style={styles.label}>Cognome *</Text>
          <TextInput
            style={styles.input}
            placeholder="es: Rossi"
            placeholderTextColor="#aaa"
            value={lastName}
            onChangeText={(text) => setLastName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="es: Mario"
            placeholderTextColor="#aaa"
            value={firstName}
            onChangeText={(text) => setFirstName(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Data di Nascita (GG/MM/AAAA) *</Text>
          <TextInput
            style={styles.input}
            placeholder="es: 15/05/2010"
            placeholderTextColor="#aaa"
            value={dateOfBirth}
            onChangeText={(text) => setDateOfBirth(formatDateInput(text))}
            keyboardType="number-pad"
            maxLength={10}
          />

          <View style={styles.row}>
            <View style={styles.flex2}>
              <Text style={styles.label}>Luogo di Nascita *</Text>
              <TextInput
                style={styles.input}
                placeholder="es: Roma"
                placeholderTextColor="#aaa"
                value={birthPlace}
                onChangeText={(text) => setBirthPlace(text.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Prov. *</Text>
              <TextInput
                style={styles.input}
                placeholder="RM"
                placeholderTextColor="#aaa"
                value={birthProvince}
                onChangeText={(text) => setBirthProvince(text.toUpperCase())}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Text style={styles.label}>Codice Fiscale *</Text>
          <TextInput
            style={styles.input}
            placeholder="es: RSSMRA10E15H501Z"
            placeholderTextColor="#aaa"
            value={fiscalCode}
            onChangeText={(text) => setFiscalCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={16}
          />

          <Text style={styles.label}>Indirizzo</Text>
          <TextInput
            style={styles.input}
            placeholder="es: Via Roma 123"
            placeholderTextColor="#aaa"
            value={address}
            onChangeText={(text) => setAddress(text.toUpperCase())}
            autoCapitalize="characters"
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>CAP</Text>
              <TextInput
                style={styles.input}
                placeholder="00100"
                placeholderTextColor="#aaa"
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={styles.flex2}>
              <Text style={styles.label}>Città</Text>
              <TextInput
                style={styles.input}
                placeholder="Roma"
                placeholderTextColor="#aaa"
                value={city}
                onChangeText={(text) => setCity(text.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Prov.</Text>
              <TextInput
                style={styles.input}
                placeholder="RM"
                placeholderTextColor="#aaa"
                value={province}
                onChangeText={(text) => setProvince(text.toUpperCase())}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>📞 Contatti</Text>

          <Text style={styles.label}>Tel. Atleta</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            placeholderTextColor="#aaa"
            value={phoneAthlete}
            onChangeText={setPhoneAthlete}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Tel. Padre</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            placeholderTextColor="#aaa"
            value={phoneFather}
            onChangeText={setPhoneFather}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Tel. Madre</Text>
          <TextInput
            style={styles.input}
            placeholder="333 1234567"
            placeholderTextColor="#aaa"
            value={phoneMother}
            onChangeText={setPhoneMother}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@esempio.com"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.sectionTitle}>💳 Dati per Fatturazione</Text>

          <Text style={styles.label}>Cognome Genitore</Text>
          <TextInput
            style={styles.input}
            placeholder="es: ROSSI"
            placeholderTextColor="#aaa"
            value={taxPayerLastName}
            onChangeText={(text) => setTaxPayerLastName(text.toUpperCase())}
            autoCapitalize="characters"
            returnKeyType="next"
          />

          <Text style={styles.label}>Nome Genitore</Text>
          <TextInput
            style={styles.input}
            placeholder="es: MARIO"
            placeholderTextColor="#aaa"
            value={taxPayerFirstName}
            onChangeText={(text) => setTaxPayerFirstName(text.toUpperCase())}
            autoCapitalize="characters"
            returnKeyType="next"
          />

          <Text style={styles.label}>Codice Fiscale Genitore</Text>
          <TextInput
            style={styles.input}
            placeholder="es: RSSMRA80A01H501Z"
            placeholderTextColor="#aaa"
            value={taxPayerFiscalCode}
            onChangeText={(text) => setTaxPayerFiscalCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={16}
            returnKeyType="next"
          />

          <Text style={styles.sectionTitle}>🏐 Squadre</Text>

          <Text style={styles.label}>Squadra Principale *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={teamId}
              onValueChange={(value) => setTeamId(value)}
              style={styles.picker}
            >
              {teams.map((team) => (
                <Picker.Item key={team.id} label={team.name} value={team.id} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Seconda Squadra (opzionale)</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={teamId2}
              onValueChange={(value) => setTeamId2(value)}
              style={styles.picker}
            >
              <Picker.Item label="-- Nessuna --" value="" />
              {teams.filter(t => t.id !== teamId).map((team) => (
                <Picker.Item key={team.id} label={team.name} value={team.id} />
              ))}
            </Picker>
          </View>
          
          <Text style={styles.hint}>
            💡 I dati economici (pagamenti) sono relativi solo alla squadra principale
          </Text>

          <Text style={styles.sectionTitle}>🔐 Protezione Dati Sensibili</Text>
          
          <Text style={styles.protectionNote}>
            Per proteggere i dati anagrafici e il certificato medico dell'atleta minorenne, 
            imposta una password. Solo tu potrai visualizzare e modificare questi dati.
          </Text>

          <Text style={styles.label}>Password protezione dati *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Minimo 4 caratteri"
              value={dataPassword}
              onChangeText={setDataPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Conferma password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ripeti la password"
            value={dataPasswordConfirm}
            onChangeText={setDataPasswordConfirm}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />

          <Text style={styles.sectionTitle}>📝 Tipo Iscrizione</Text>
          
          <TouchableOpacity 
            style={styles.checkboxRow}
            onPress={() => setIsTrialPeriod(!isTrialPeriod)}
          >
            <View style={[styles.checkbox, isTrialPeriod && styles.checkboxChecked]}>
              {isTrialPeriod && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxLabel}>Richiedo periodo di prova (7 giorni)</Text>
              <Text style={styles.checkboxSubtext}>
                {isTrialPeriod 
                  ? 'Non è richiesta la firma sulla privacy durante la prova'
                  : 'Confermo e accetto la privacy e la liberatoria'}
              </Text>
            </View>
          </TouchableOpacity>
          
          {!isTrialPeriod && (
            <TouchableOpacity 
              style={styles.privacyLink}
              onPress={() => setPrivacyModalVisible(true)}
            >
              <Ionicons name="document-text-outline" size={18} color="#007AFF" />
              <Text style={styles.privacyLinkText}>Leggi l'informativa sulla privacy</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Registrazione...' : 'Registra Atleta'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Privacy Modal */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.privacyModalContent}>
            <View style={styles.privacyModalHeader}>
              <Text style={styles.privacyModalTitle}>Conferma Privacy e Liberatoria</Text>
              <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.privacyScroll}>
              <Text style={styles.privacyTitle}>LIBERATORIA</Text>
              
              <Text style={styles.privacyText}>
                Il/La sottoscritto/a, in qualità di esercente la responsabilità genitoriale 
                sull'atleta iscritto/a alla società sportiva:
              </Text>
              
              <Text style={styles.privacyTitle}>DICHIARA</Text>
              
              <Text style={styles.privacyText}>
                di essere stato informato e di aver preso visione dell'informativa ai sensi 
                degli artt. 13 e 14 del Regolamento (UE) 2016/679 sulla protezione dei dati (GDPR), 
                disponibile anche sul sito web della società, riguardo il trattamento dei dati 
                personali propri e dell'atleta.
              </Text>
              
              <Text style={styles.privacyTitle}>PRESTA IL PROPRIO CONSENSO</Text>
              
              <Text style={styles.privacyText}>
                ☑ al trattamento dei dati personali propri e dell'atleta per le finalità 
                strettamente connesse e necessarie alla pratica sportiva dilettantistica 
                (iscrizione, tesseramento, partecipazione a manifestazioni sportive, 
                gestione amministrativa);{'\n\n'}
                
                ☑ all'utilizzo di immagini e/o video dell'atleta per finalità promozionali 
                e comunicative della società, sia su supporti tradizionali che digitali 
                (sito web, social network, materiale promozionale), con l'impegno che tali 
                immagini non saranno utilizzate per fini commerciali o cedute a terzi;{'\n\n'}
                
                ☑ alla comunicazione dei dati a federazioni, enti di promozione sportiva, 
                assicurazioni e altri soggetti necessari per lo svolgimento dell'attività sportiva.
              </Text>
              
              <Text style={styles.privacyNote}>
                Il consenso è revocabile in qualsiasi momento mediante comunicazione scritta 
                alla società. Il rifiuto del consenso ai trattamenti necessari comporterà 
                l'impossibilità di partecipare all'attività sportiva.
              </Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.privacyAcceptBtn}
              onPress={() => setPrivacyModalVisible(false)}
            >
              <Text style={styles.privacyAcceptBtnText}>Accetto e Confermo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  form: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
    minHeight: 56,
  },
  picker: {
    height: 56,
    width: '100%',
  },
  hint: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  protectionNote: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  checkboxSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
  },
  privacyLinkText: {
    color: '#007AFF',
    fontSize: 14,
    marginLeft: 6,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  privacyModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  privacyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  privacyModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  privacyScroll: {
    padding: 16,
    maxHeight: 400,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 16,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 8,
  },
  privacyNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  privacyBold: {
    fontWeight: 'bold',
  },
  privacyAcceptBtn: {
    backgroundColor: '#34C759',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  privacyAcceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
