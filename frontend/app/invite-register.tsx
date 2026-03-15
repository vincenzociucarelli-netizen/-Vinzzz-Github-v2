import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../src/components/Icon';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

export default function InviteRegister() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { setUser } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Invitation info
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  
  // Form
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    // Minor specific
    parent_first_name: '',
    parent_last_name: '',
    parent_email: '',
    parent_phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // Auto-format date as dd/mm/yyyy
  const formatDateInput = (text: string) => {
    // Remove non-digits
    const digits = text.replace(/\D/g, '');
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    } else {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    }
    return formatted;
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    if (token) {
      loadInviteInfo();
    } else {
      setError('Token di invito mancante');
      setLoading(false);
    }
  }, [token]);

  const loadInviteInfo = async () => {
    try {
      const res = await api.get(`/athletes/invite-info/${token}`);
      setInviteInfo(res.data);
      setForm(prev => ({
        ...prev,
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        email: res.data.email || '',
      }));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invito non valido o scaduto');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // Validation
    if (!form.first_name || !form.last_name) {
      showAlert('Errore', 'Nome e cognome sono obbligatori');
      return;
    }
    if (!form.email) {
      showAlert('Errore', 'Email obbligatoria');
      return;
    }
    if (!form.password || form.password.length < 6) {
      showAlert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    if (form.password !== form.confirmPassword) {
      showAlert('Errore', 'Le password non corrispondono');
      return;
    }
    if (!form.phone) {
      showAlert('Errore', 'Numero di telefono obbligatorio');
      return;
    }
    
    if (inviteInfo?.is_minor) {
      if (!form.parent_first_name || !form.parent_last_name) {
        showAlert('Errore', 'Nome e cognome del genitore sono obbligatori');
        return;
      }
    }

    // Parse date if provided
    let dob: string | undefined;
    if (form.date_of_birth) {
      const parts = form.date_of_birth.split('/');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        showAlert('Errore', 'Data di nascita non valida (formato: gg/mm/aaaa)');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: any = {
        token,
        email: form.email,
        password: form.password,
        first_name: form.first_name.toUpperCase(),
        last_name: form.last_name.toUpperCase(),
        phone: form.phone,
        date_of_birth: dob || undefined,
        gender: form.gender || undefined,
      };
      
      if (inviteInfo?.is_minor) {
        payload.parent_first_name = form.parent_first_name.toUpperCase();
        payload.parent_last_name = form.parent_last_name.toUpperCase();
        payload.parent_email = form.parent_email || form.email;
        payload.parent_phone = form.parent_phone || form.phone;
      }

      const res = await api.post('/athletes/invite-register', payload);
      
      if (res.data.token) {
        await setUser(res.data.user, res.data.token);
        setSuccess(true);
        // Auto redirect after 2 seconds
        setTimeout(() => {
          const role = res.data.user?.role;
          if (role === 'parent') {
            router.replace('/parent');
          } else if (role === 'athlete') {
            router.replace('/athlete');
          } else {
            router.replace('/login');
          }
        }, 2000);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore nella registrazione');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565C0" />
        <Text style={{ marginTop: 12, color: '#666' }}>Caricamento invito...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorTitle}>Invito non valido</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.backBtnText}>Torna al Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
        <Text style={styles.successTitle}>Registrazione completata!</Text>
        <Text style={styles.successText}>Stai per essere reindirizzato...</Text>
        <ActivityIndicator size="small" color="#4CAF50" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="people" size={36} color="#fff" />
        <Text style={styles.headerTitle}>Registrazione Atleta</Text>
        <Text style={styles.headerSubtitle}>{inviteInfo?.society_name}</Text>
        {inviteInfo?.is_minor && (
          <View style={styles.minorBadge}>
            <Text style={styles.minorBadgeText}>Atleta Minorenne</Text>
          </View>
        )}
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>
          {inviteInfo?.is_minor ? 'Dati Atleta' : 'I tuoi dati'}
        </Text>

        <Text style={styles.label}>Cognome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Cognome"
          value={form.last_name}
          onChangeText={(v) => setForm({...form, last_name: v})}
          autoCapitalize="characters"
          data-testid="register-last-name"
        />

        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={form.first_name}
          onChangeText={(v) => setForm({...form, first_name: v})}
          autoCapitalize="characters"
          data-testid="register-first-name"
        />

        <Text style={styles.label}>Data di Nascita (GG/MM/AAAA)</Text>
        <TextInput
          style={styles.input}
          placeholder="GG/MM/AAAA"
          value={form.date_of_birth}
          onChangeText={(v) => setForm({...form, date_of_birth: formatDateInput(v)})}
          keyboardType="numeric"
          maxLength={10}
          data-testid="register-dob"
        />

        <Text style={styles.label}>Sesso</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity
            style={[styles.genderBtn, form.gender === 'M' && styles.genderBtnActive]}
            onPress={() => setForm({...form, gender: 'M'})}
          >
            <Text style={[styles.genderBtnText, form.gender === 'M' && styles.genderBtnTextActive]}>M</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderBtn, form.gender === 'F' && styles.genderBtnActive]}
            onPress={() => setForm({...form, gender: 'F'})}
          >
            <Text style={[styles.genderBtnText, form.gender === 'F' && styles.genderBtnTextActive]}>F</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Telefono *</Text>
        <TextInput
          style={styles.input}
          placeholder="Numero di telefono"
          value={form.phone}
          onChangeText={(v) => setForm({...form, phone: v})}
          keyboardType="phone-pad"
          data-testid="register-phone"
        />

        {/* Parent section for minors */}
        {inviteInfo?.is_minor && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Dati Genitore / Tutore</Text>

            <Text style={styles.label}>Cognome Genitore *</Text>
            <TextInput
              style={styles.input}
              placeholder="Cognome genitore"
              value={form.parent_last_name}
              onChangeText={(v) => setForm({...form, parent_last_name: v})}
              autoCapitalize="characters"
              data-testid="register-parent-last-name"
            />

            <Text style={styles.label}>Nome Genitore *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome genitore"
              value={form.parent_first_name}
              onChangeText={(v) => setForm({...form, parent_first_name: v})}
              autoCapitalize="characters"
              data-testid="register-parent-first-name"
            />

            <Text style={styles.label}>Telefono Genitore</Text>
            <TextInput
              style={styles.input}
              placeholder="Telefono genitore"
              value={form.parent_phone}
              onChangeText={(v) => setForm({...form, parent_phone: v})}
              keyboardType="phone-pad"
            />
          </>
        )}

        {/* Account credentials */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Credenziali di Accesso</Text>

        <Text style={styles.label}>Email (anche username di accesso) *</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={form.email}
          onChangeText={(v) => setForm({...form, email: v})}
          keyboardType="email-address"
          autoCapitalize="none"
          data-testid="register-email"
        />

        <Text style={styles.label}>Password *</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            style={styles.input}
            placeholder="Scegli una password (min 6 caratteri)"
            value={form.password}
            onChangeText={(v) => setForm({...form, password: v})}
            secureTextEntry={!showPassword}
            data-testid="register-password"
          />
          <TouchableOpacity
            style={{ position: 'absolute', right: 12, top: 12 }}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Conferma Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ripeti la password"
          value={form.confirmPassword}
          onChangeText={(v) => setForm({...form, confirmPassword: v})}
          secureTextEntry={!showPassword}
          data-testid="register-confirm-password"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
          onPress={handleRegister}
          disabled={submitting}
          data-testid="register-submit-btn"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Completa Registrazione</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.loginLinkText}>Hai già un account? Accedi</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa', padding: 24 },
  header: { backgroundColor: '#1565C0', padding: 24, paddingTop: 48, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 8 },
  headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  minorBadge: { backgroundColor: '#FF9800', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  minorBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  formContainer: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#333',
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  genderBtnActive: { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  genderBtnText: { fontSize: 15, fontWeight: '600', color: '#999' },
  genderBtnTextActive: { color: '#1565C0' },
  submitBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { color: '#1565C0', fontSize: 14 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 16 },
  errorText: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  backBtn: { backgroundColor: '#1565C0', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 24 },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginTop: 16 },
  successText: { fontSize: 14, color: '#666', marginTop: 8 },
});
