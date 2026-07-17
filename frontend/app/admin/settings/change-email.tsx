import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';

export default function ChangeEmailPage() {
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/auth/me');
        setCurrentEmail(r.data?.email || '');
      } catch { /* noop */ }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!password || !newEmail) {
      Alert.alert('Attenzione', 'Compila entrambi i campi.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      Alert.alert('Attenzione', 'Formato email non valido.');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post('/auth/change-email', {
        current_password: password,
        new_email: newEmail.trim().toLowerCase(),
      });
      Alert.alert('Fatto', `Email aggiornata a ${r.data?.email}. Dovrai fare login con la nuova email.`);
      // Torna alle impostazioni. Il token attuale è ancora valido, ma d'ora in poi login = nuova email.
      router.replace('/admin/settings');
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile aggiornare');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cambia la mia email</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.card}>
          <Text style={styles.label}>Email attuale</Text>
          <View style={styles.readonlyBox}>
            <Ionicons name="mail" size={18} color="#666" />
            <Text style={styles.readonlyText}>{currentEmail || '—'}</Text>
          </View>

          <View style={{ height: 16 }} />

          <Text style={styles.label}>Nuova email *</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={t => setNewEmail(t.toLowerCase())}
            placeholder="nuova.email@esempio.com"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="email-address"
            data-testid="change-email-new-input"
          />

          <View style={{ height: 16 }} />

          <Text style={styles.label}>Password attuale *</Text>
          <View style={styles.pwdRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="La tua password"
              placeholderTextColor="#999"
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              data-testid="change-email-pwd-input"
            />
            <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding: 10 }}>
              <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Richiediamo la password per confermare che sei tu. Dopo il cambio d&apos;email,
            userai la nuova email per fare login. La sessione attuale resta attiva.
          </Text>

          <TouchableOpacity
            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}
            data-testid="change-email-submit-btn"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>Aggiorna email</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#00838F', paddingTop: 40, paddingHorizontal: 12, paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  readonlyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0f0f0', borderRadius: 8, padding: 12,
  },
  readonlyText: { fontSize: 14, color: '#666', flex: 1 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14,
    backgroundColor: '#fafafa', color: '#000',
  },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hint: { fontSize: 12, color: '#888', marginTop: 12, lineHeight: 16 },
  submitBtn: {
    marginTop: 18, backgroundColor: '#00838F', borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
