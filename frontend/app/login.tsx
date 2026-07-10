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

// 🆕 09/07/2026 (v7.13) — Scanner QR per Accesso Lite (Web only, html5-qrcode)
let Html5QrcodeScanner: any = null;
let Html5QrcodeScanType: any = null;
if (Platform.OS === 'web') {
  const lib = require('html5-qrcode');
  Html5QrcodeScanner = lib.Html5QrcodeScanner;
  Html5QrcodeScanType = lib.Html5QrcodeScanType;
}

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
  
  // 🆕 09/07/2026 (v7.13) — Scanner QR per popolare automaticamente il codice atleta
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanFeedback, setScanFeedback] = useState<null | string>(null); // v7.14 feedback visivo
  
  // 🆕 08/07/2026 (v7.11) — Device pairing per Accesso Lite:
  // dopo il primo login riuscito salviamo un profilo "carta" in localStorage,
  // così ai login successivi la ragazza inserisce solo il PIN.
  const [litePairing, setLitePairing] = useState<null | {
    athlete_code: string;
    nome_lite: string;
    society_id: string;
    society_name: string;
    society_logo: string;
  }>(null);
  
  // Society branding
  const [societyName, setSocietyName] = useState('GESTIONE SOCIETA');
  const [societyLogo, setSocietyLogo] = useState<string | null>(null);

  useEffect(() => {
    loadSocietySettings();
    loadSavedAthleteCode();
    loadLitePairing();
  }, []);

  const loadLitePairing = async () => {
    try {
      const raw = await AsyncStorage.getItem('lite_pairing');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.athlete_code) {
          setLitePairing(parsed);
          // Pre-compila athleteCode con nome_lite per il fallback (se preme "Cambia atleta")
          setAthleteCode(parsed.nome_lite || parsed.athlete_code);
        }
      }
    } catch {}
  };

  const saveLitePairing = async (u: any) => {
    try {
      if (u?.athlete_code) {
        const pairing = {
          athlete_code: u.athlete_code,
          nome_lite: u.nome_lite || '',
          society_id: u.society_id || '',
          society_name: u.society_name || '',
          society_logo: u.society_logo || '',
        };
        await AsyncStorage.setItem('lite_pairing', JSON.stringify(pairing));
        setLitePairing(pairing);
      }
    } catch {}
  };

  const forgetLitePairing = async () => {
    try {
      await AsyncStorage.removeItem('lite_pairing');
    } catch {}
    setLitePairing(null);
    setAthleteCode('');
    setPin('');
  };

  // 🆕 v7.13 — Scanner QR
  useEffect(() => {
    if (Platform.OS !== 'web' || !showQrScanner || !Html5QrcodeScanner) return;
    let scanner: any = null;
    let mounted = true;
    setScanError('');

    const startScanner = () => {
      try {
        scanner = new Html5QrcodeScanner(
          'lite-qr-scanner',
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            videoConstraints: { facingMode: 'environment' },
            supportedScanTypes: Html5QrcodeScanType
              ? [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE]
              : undefined,
          },
          false
        );
        scanner.render(
          (decodedText: string) => {
            if (!mounted) return;
            // Il QR contiene il qr_identifier (12 char alfanumerico maiuscolo)
            const clean = (decodedText || '').trim().toUpperCase();
            if (clean.length >= 4) {
              setAthleteCode(clean);
              setShowQrScanner(false);
              try { scanner.clear(); } catch {}
              // 🆕 v7.14 — Feedback visivo post-scansione (auto-scompare dopo 3s)
              setScanFeedback('Riconosciuto! Ora inserisci il PIN 🔑');
              setTimeout(() => setScanFeedback(null), 3500);
            }
          },
          (_err: string) => { /* ignore scan-in-progress noise */ }
        );

        // Traduzione italiana (una tantum + polling breve, no MutationObserver — v7.5 pattern)
        const translate = () => {
          const box = document.getElementById('lite-qr-scanner');
          if (!box) return;
          box.querySelectorAll('button').forEach((b) => {
            const t = (b.textContent || '').trim();
            if (t === 'Request Camera Permissions') b.textContent = 'Consenti fotocamera';
            else if (t === 'Start Scanning') b.textContent = 'Avvia scansione';
            else if (t === 'Stop Scanning') b.textContent = 'Ferma scansione';
            else if (t === 'Switch On Torch') b.textContent = '🔦 Accendi torcia';
            else if (t === 'Switch Off Torch') b.textContent = '🔦 Spegni torcia';
            else if (t.startsWith('Choose Image')) {
              b.textContent = t.replace('Choose Image', '📁 Scegli immagine').replace(/ - No image ch(?:oo)?sen/, '');
            }
          });
          const anchor = box.querySelector('#html5-qrcode-anchor-scan-type-change') as HTMLElement | null;
          if (anchor) {
            const t = (anchor.textContent || '').trim();
            if (t === 'Scan an Image File') anchor.textContent = '📁 Scansiona da foto in galleria';
            else if (t === 'Scan using camera directly') anchor.textContent = '📷 Torna alla fotocamera';
          }
        };
        translate();
        let poll = 0;
        const iv = setInterval(() => { translate(); if (++poll >= 10) clearInterval(iv); }, 300);
      } catch (e: any) {
        setScanError(e?.message || 'Errore avvio scanner');
      }
    };

    // CSS: nascondi camera selector (forziamo back-camera)
    const style = document.createElement('style');
    style.textContent = `
      #lite-qr-scanner select#html5-qrcode-select-camera { display: none !important; }
      #lite-qr-scanner div[id$="__camera_selection"] { display: none !important; }
      #lite-qr-scanner input[type="file"] { display: none !important; }
      #lite-qr-scanner video { max-height: 260px !important; border-radius: 12px; }
    `;
    document.head.appendChild(style);

    startScanner();
    return () => {
      mounted = false;
      try { scanner && scanner.clear(); } catch {}
      try { document.head.removeChild(style); } catch {}
    };
  }, [showQrScanner]);

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
    // Con litePairing: chiediamo solo il PIN (nome_lite/athlete_code già in memoria)
    // Senza litePairing: input classico (nome_lite o athlete_code)
    const identifier = litePairing ? (litePairing.nome_lite || litePairing.athlete_code) : athleteCode.trim();
    if (!identifier || !pin) {
      showAlert('Errore', litePairing ? 'Inserisci il PIN' : 'Inserisci il Nome Lite e il PIN');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        athlete_code: identifier,
        pin: pin.trim(),
      };
      // 🆕 v7.11 — Se il device ha già un pairing, passa il society_id per restringere
      // la ricerca (nome_lite è univoco per società, non globalmente).
      if (litePairing?.society_id) {
        payload.society_id = litePairing.society_id;
      }
      const response = await api.post('/auth/minor-login', payload);
      await saveAthleteCode(identifier.toUpperCase());
      // Salviamo il pairing per il prossimo login (card + PIN)
      await saveLitePairing(response.data.user);
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
        {/* 🆕 v7.13 — Modal Scanner QR (Web) */}
        {Platform.OS === 'web' && showQrScanner && (
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            padding: 16,
            alignItems: 'center',
            justifyContent: 'flex-start',
          }} data-testid="lite-qr-scanner-modal">
            <View style={{ width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a2e' }}>
                  📷 Scansiona QR
                </Text>
                <TouchableOpacity
                  onPress={() => setShowQrScanner(false)}
                  style={{ padding: 8 }}
                  data-testid="lite-qr-scanner-close-btn"
                >
                  <Ionicons name="close" size={28} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 }}>
                Chiedi al tuo genitore di aprire l'app sul suo telefono e mostrarti il QR del tuo profilo. Punta la fotocamera al QR per riempire automaticamente il codice.
              </Text>
              <div id="lite-qr-scanner" style={{ width: '100%', minHeight: 260 }} />
              {scanError ? (
                <Text style={{ fontSize: 13, color: '#C62828', marginTop: 10 }} data-testid="lite-qr-scan-error">
                  ⚠️ {scanError}
                </Text>
              ) : null}
            </View>
          </View>
        )}

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

            {/* Link "Sei una nuova società? Registrati qui" temporaneamente nascosto:
                la piattaforma è in fase di demo controllata con 3 società attive
                (PPG, Sirio, "La Tua Società" demo per amici). Riattivare quando
                l'audit multi-tenancy completo sarà finito. La pagina
                /register-society resta funzionante per accesso diretto via URL. */}
          </View>
        ) : (
          <View style={styles.form}>
            {litePairing ? (
              <>
                {/* 🆕 v7.11 — Card "Device Pairing": accesso rapido con solo il PIN */}
                <Text style={styles.subtitle}>Ciao! 👋</Text>
                <View style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: '#4CAF50',
                  gap: 12,
                }} data-testid="lite-pairing-card">
                  {litePairing.society_logo ? (
                    <Image
                      source={{ uri: litePairing.society_logo.startsWith('data:') ? litePairing.society_logo : `data:image/png;base64,${litePairing.society_logo}` }}
                      style={{ width: 52, height: 52, borderRadius: 12 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={28} color="#4CAF50" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a2e' }} numberOfLines={1}>
                      {litePairing.nome_lite || 'Atleta'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }} numberOfLines={1}>
                      {litePairing.society_name || 'La tua società'}
                    </Text>
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Inserisci il tuo PIN"
                  placeholderTextColor="#999"
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  autoFocus
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

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={forgetLitePairing}
                  data-testid="lite-pairing-forget-btn"
                >
                  <Text style={[styles.linkText, { fontSize: 13 }]}>
                    Non sei tu? Cambia atleta
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>Accedi con Nome Lite e PIN</Text>
                <Text style={styles.minorHint}>
                  Chiedi al tuo genitore il tuo Nome Lite (o codice atleta) e il PIN
                </Text>

                {/* 🆕 v7.13 — Pulsante scanner QR: la ragazza scansiona il QR mostrato dal genitore */}
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#E8F5E9',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      borderWidth: 2,
                      borderColor: '#4CAF50',
                      borderStyle: 'dashed',
                    }}
                    onPress={() => { setScanError(''); setShowQrScanner(true); }}
                    data-testid="minor-login-scan-qr-btn"
                  >
                    <Ionicons name="qr-code-outline" size={22} color="#2E7D32" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7D32' }}>
                      📷 Scansiona il QR del tuo genitore
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 🆕 v7.14 — Feedback visivo post-scansione */}
                {scanFeedback && (
                  <View style={{
                    backgroundColor: '#C8E6C9',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: 2,
                    borderColor: '#4CAF50',
                  }} data-testid="scan-success-feedback">
                    <Ionicons name="checkmark-circle" size={26} color="#2E7D32" />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#1B5E20' }}>
                      {scanFeedback}
                    </Text>
                  </View>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Nome Lite (o codice atleta)"
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
              </>
            )}
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
