import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import { Ionicons } from '../src/components/Icon';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'standard' | 'minor'>('standard');
  
  // Minor login fields
  const [athleteCode, setAthleteCode] = useState('');
  const [pin, setPin] = useState('');
  
  // Society branding
  const [societyName, setSocietyName] = useState('GESTIONE SOCIETA');
  const [societyLogo, setSocietyLogo] = useState<string | null>(null);

  useEffect(() => {
    loadSocietySettings();
    loadSavedAthleteCode();
  }, []);

  const loadSavedAthleteCode = async () => {
    try {
      const savedCode = await AsyncStorage.getItem('last_athlete_code');
      if (savedCode) setAthleteCode(savedCode);
    } catch {}
  };

  const saveAthleteCode = async (code: string) => {
    try {
      await AsyncStorage.setItem('last_athlete_code', code);
    } catch {}
  };

  const loadSocietySettings = async () => {
    try {
      const response = await api.get('/settings/society');
      if (response.data.name) {
        setSocietyName(response.data.name);
      }
      // Use the new has_logo flag (more reliable than HEAD probe).
      if (response.data.has_logo) {
        setSocietyLogo(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png`);
      } else {
        // Fallback for older backend deployments: probe via HEAD
        try {
          const head = await fetch(
            `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png`,
            { method: 'HEAD' }
          );
          if (head.ok) {
            setSocietyLogo(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png`);
          }
        } catch {
          // ignore: logo is optional
        }
      }
    } catch (error) {
      // Use default name if settings not found
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Errore', 'Inserisci email e password');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      await setUser(response.data.user, response.data.token);
      
      // Multi-tenant safety: clear all in-memory module caches that may
      // contain data from a previously logged-in society on the same browser
      // (e.g. SportIcon image cache, ...). Forcing a full page reload after
      // login is the simplest 100% reliable way to start clean.
      const role = response.data.user.role;
      let target = '/select-role';
      if (role === 'coach') target = '/coach';
      else if (role === 'collaboratore') target = '/collaboratore';
      else if (role === 'parent') target = '/parent';
      else if (role === 'viewer' || role === 'dirigente') target = '/dirigente';
      else if (role === 'athlete') target = '/athlete';
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Use full reload to nuke any stale in-memory caches from previous session
        window.location.replace(target);
      } else {
        router.replace(target as any);
      }
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  const handleMinorLogin = async () => {
    if (!athleteCode || !pin) {
      showAlert('Errore', 'Inserisci il Nome Lite e il PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/minor-login', {
        athlete_code: athleteCode.trim(),
        pin: pin.trim(),
      });
      await saveAthleteCode(athleteCode.trim().toUpperCase());
      await setUser(response.data.user, response.data.token);
      router.replace('/minor');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Codice o PIN non validi');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Image
            source={societyLogo ? { uri: societyLogo } : require('../assets/images/registrateam-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>{societyName}</Text>

        {/* Mode selector tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, loginMode === 'standard' && styles.tabActive]}
            onPress={() => setLoginMode('standard')}
            data-testid="login-tab-standard"
          >
            <Ionicons name="mail" size={16} color={loginMode === 'standard' ? '#007AFF' : '#999'} />
            <Text style={[styles.tabText, loginMode === 'standard' && styles.tabTextActive]}>
              Accesso Standard
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, loginMode === 'minor' && styles.tabActive]}
            onPress={() => setLoginMode('minor')}
            data-testid="login-tab-minor"
          >
            <Ionicons name="person" size={16} color={loginMode === 'minor' ? '#007AFF' : '#999'} />
            <Text style={[styles.tabText, loginMode === 'minor' && styles.tabTextActive]}>
              Accesso Atleta
            </Text>
          </TouchableOpacity>
        </View>

        {loginMode === 'standard' ? (
          <View style={styles.form}>
            <Text style={styles.subtitle}>Accedi con email e password</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              data-testid="login-email-input"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                data-testid="login-password-input"
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

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              data-testid="login-submit-button"
            >
              <Text style={styles.buttonText}>{loading ? 'Accesso...' : 'Accedi'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={styles.forgotText}>Password dimenticata?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.linkText}>Non hai un account? Registrati</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/register-society')}
              data-testid="link-register-society"
            >
              <Text style={styles.linkText}>Sei una nuova società? Registrati qui</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.subtitle}>Accedi con Nome Lite e PIN</Text>
            <Text style={styles.minorHint}>
              Chiedi al tuo genitore il tuo Nome Lite e il PIN
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Nome Lite"
              placeholderTextColor="#999"
              value={athleteCode}
              onChangeText={setAthleteCode}
              autoCapitalize="none"
              autoCorrect={false}
              data-testid="minor-login-code-input"
            />

            <TextInput
              style={styles.input}
              placeholder="PIN (4-6 cifre)"
              placeholderTextColor="#999"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              data-testid="minor-login-pin-input"
            />

            <TouchableOpacity
              style={[styles.button, styles.buttonMinor, loading && styles.buttonDisabled]}
              onPress={handleMinorLogin}
              disabled={loading}
              data-testid="minor-login-submit-button"
            >
              <Ionicons name="log-in" size={20} color="#fff" />
              <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                {loading ? 'Accesso...' : 'Entra'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer legale — sempre visibile */}
        <View style={styles.legalFooter}>
          <Text style={styles.legalText}>
            Accedendo accetti i nostri{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/terms-of-use')} data-testid="login-tos-link">
              Termini di Utilizzo
            </Text>
            {' '}e la{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/privacy-policy')} data-testid="login-privacy-link">
              Informativa Privacy
            </Text>
          </Text>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  form: {
    width: '100%',
  },
  minorHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonMinor: {
    backgroundColor: '#34C759',
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
  forgotButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  forgotText: {
    color: '#666',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 18,
    marginHorizontal: 8,
  },
  newSocietyBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  newSocietyText: {
    color: '#666',
    fontSize: 13,
  },
  newSocietyEmph: {
    color: '#1565C0',
    fontWeight: '700',
  },
  legalFooter: {
    marginTop: 22,
    paddingTop: 16,
    paddingBottom: 6,
    alignItems: 'center',
  },
  legalText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: {
    color: '#1565C0',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
