import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocietyBranding from '../../src/components/SocietyBranding';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CASE_ORDER = [
  'trial_start_unsigned',
  'trial_end_no_certificate',
  'trial_end_no_privacy',
  'trial_end_no_decision',
  'unsigned_receipt',
  'certificate_expiring',
];

type CaseSetting = { label: string; threshold_days: number; template: string };

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, CaseSetting>>({});
  const [vars, setVars] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const r = await fetch(`${API}/api/admin/whatsapp/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        setSettings(data.settings || {});
        setVars(data.available_variables || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/whatsapp/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings }),
      });
      if (!r.ok) throw new Error('Errore salvataggio');
      if (Platform.OS === 'web') {
        alert('✅ Impostazioni salvate');
      } else {
        Alert.alert('Salvato', 'Impostazioni aggiornate');
      }
    } catch (e: any) {
      if (Platform.OS === 'web') alert('❌ ' + e.message);
      else Alert.alert('Errore', e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    const confirmMsg = 'Sei sicuro di voler ripristinare i messaggi predefiniti? Le tue personalizzazioni saranno perse.';
    const ok = Platform.OS === 'web' ? window.confirm(confirmMsg) : true;
    if (!ok) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/whatsapp/settings/reset-defaults`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Errore reset');
      // Reload settings
      const r2 = await fetch(`${API}/api/admin/whatsapp/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r2.json();
      setSettings(data.settings || {});
      if (Platform.OS === 'web') alert('✅ Default ripristinati');
      else Alert.alert('OK', 'Default ripristinati');
    } catch (e: any) {
      if (Platform.OS === 'web') alert('❌ ' + e.message);
      else Alert.alert('Errore', e.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, field: keyof CaseSetting, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#25D366" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="was-back">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>⚙️ Impostazioni Solleciti</Text>
            <Text style={styles.headerSub}>Personalizza soglie temporali e messaggi</Text>
          </View>
        </View>
        <SocietyBranding light logoSize={26} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color="#1565C0" />
          <Text style={styles.infoText}>
            Variabili disponibili nel messaggio: {vars.map(v => `{${v}}`).join(', ')}
          </Text>
        </View>

        {CASE_ORDER.map(key => {
          const s = settings[key];
          if (!s) return null;
          return (
            <View key={key} style={styles.card} data-testid={`was-card-${key}`}>
              <Text style={styles.cardTitle}>{s.label}</Text>

              <Text style={styles.fieldLabel}>Sollecitare dopo (giorni)</Text>
              <TextInput
                style={styles.input}
                value={String(s.threshold_days)}
                onChangeText={(t) => update(key, 'threshold_days', Number(t.replace(/\D/g, '') || 0))}
                keyboardType="numeric"
                data-testid={`was-threshold-${key}`}
              />

              <Text style={styles.fieldLabel}>Messaggio</Text>
              <TextInput
                style={styles.textarea}
                value={s.template}
                onChangeText={(t) => update(key, 'template', t)}
                multiline
                data-testid={`was-template-${key}`}
              />
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
          data-testid="was-save"
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Salva impostazioni</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resetBtn, saving && { opacity: 0.6 }]}
          onPress={resetDefaults}
          disabled={saving}
          data-testid="was-reset-defaults"
        >
          <Ionicons name="refresh-outline" size={16} color="#C62828" />
          <Text style={styles.resetBtnText}>Ripristina messaggi predefiniti</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#25D366', paddingTop: Platform.OS === 'web' ? 22 : 50, paddingBottom: 16, paddingHorizontal: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  infoCard: {
    flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#E3F2FD',
    borderRadius: 8, marginBottom: 14, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: '#0D47A1', lineHeight: 18 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#666', marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, fontSize: 14, width: 90 },
  textarea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, fontSize: 13, minHeight: 90, textAlignVertical: 'top', lineHeight: 18 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#25D366', paddingVertical: 14, borderRadius: 10, marginTop: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderColor: '#C62828', borderWidth: 1,
    paddingVertical: 12, borderRadius: 10, marginTop: 10,
  },
  resetBtnText: { color: '#C62828', fontWeight: '600', fontSize: 13 },
});
