import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import InstitutionalBanner from '../../../src/components/InstitutionalBanner';

export default function TrialSettings() {
  const router = useRouter();
  const [maxDays, setMaxDays] = useState(7);
  const [maxSessions, setMaxSessions] = useState(3);
  const [blockExpiredCertificates, setBlockExpiredCertificates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings/society');
      setMaxDays(res.data.trial_max_days ?? 7);
      setMaxSessions(res.data.trial_max_sessions ?? 3);
      setBlockExpiredCertificates(res.data.block_expired_certificates || false);
    } catch (e) {}
    setLoaded(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/society', {
        trial_max_days: maxDays,
        trial_max_sessions: maxSessions,
        block_expired_certificates: blockExpiredCertificates,
      });
      if (Platform.OS === 'web') {
        window.alert('Impostazioni salvate!');
      } else {
        Alert.alert('Salvato', 'Impostazioni aggiornate.');
      }
    } catch (e) {
      if (Platform.OS === 'web') {
        window.alert('Errore nel salvataggio.');
      } else {
        Alert.alert('Errore', 'Impossibile salvare.');
      }
    }
    setSaving(false);
  };

  const adjustDays = (delta: number) => {
    setMaxDays(prev => Math.max(3, Math.min(15, prev + delta)));
  };

  const adjustSessions = (delta: number) => {
    setMaxSessions(prev => Math.max(1, Math.min(5, prev + delta)));
  };

  if (!loaded) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backBtn}>
          <View style={styles.backIcon}>
            <Ionicons name="chevron-back" size={24} color="#FF6F00" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Certificato Medico e Periodo di Prova</Text>
        <View style={{ width: 40 }} />
      </View>

      <InstitutionalBanner detail="Il blocco certificati permanente (oltre la mezzanotte) richiede la firma del Legale Rappresentante." />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Sezione Certificato Medico */}
        <View style={styles.sectionHeader} data-testid="medical-cert-section">
          <Ionicons name="medkit" size={20} color="#E65100" />
          <Text style={styles.sectionTitle}>Certificato Medico</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Gestione scadenza e blocco automatico certificati medici atleti</Text>

        <TouchableOpacity 
          style={[styles.certToggleCard, blockExpiredCertificates && styles.certToggleCardActive]}
          onPress={() => setBlockExpiredCertificates(!blockExpiredCertificates)}
          activeOpacity={0.7}
          data-testid="block-expired-cert-toggle"
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.certToggleTitle, blockExpiredCertificates && styles.certToggleTitleActive]}>
              {blockExpiredCertificates ? 'Blocco automatico ATTIVO' : 'Blocco automatico DISATTIVO'}
            </Text>
            <Text style={styles.certToggleDesc}>
              {blockExpiredCertificates 
                ? 'La scansione QR blocca la registrazione per atleti con certificato scaduto/mancante'
                : 'La scansione QR permette la registrazione anche con certificato scaduto'}
            </Text>
          </View>
          <View style={[styles.toggleSwitch, blockExpiredCertificates && styles.toggleSwitchOn]}>
            <View style={[styles.toggleKnob, blockExpiredCertificates && styles.toggleKnobOn]} />
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sezione Periodo di Prova */}
        <View style={styles.sectionHeader} data-testid="trial-period-section">
          <Ionicons name="timer" size={20} color="#FF6F00" />
          <Text style={styles.sectionTitle}>Periodo di Prova</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Definisci i limiti del periodo di prova senza certificato medico. Il documento di prova utilizza automaticamente questi valori.</Text>

        {/* Durata massima giorni */}
        <View style={styles.settingCard} data-testid="trial-days-card">
          <View style={styles.settingHeader}>
            <Ionicons name="calendar" size={20} color="#FF6F00" />
            <Text style={styles.settingLabel}>Durata massima prova</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity 
              style={[styles.stepBtn, maxDays <= 3 && styles.stepBtnDisabled]} 
              onPress={() => adjustDays(-1)}
              disabled={maxDays <= 3}
              data-testid="days-minus-btn"
            >
              <Ionicons name="remove" size={22} color={maxDays <= 3 ? '#ccc' : '#FF6F00'} />
            </TouchableOpacity>
            <View style={styles.stepValue}>
              <Text style={styles.stepNumber} data-testid="trial-days-value">{maxDays}</Text>
              <Text style={styles.stepUnit}>giorni</Text>
            </View>
            <TouchableOpacity 
              style={[styles.stepBtn, maxDays >= 15 && styles.stepBtnDisabled]} 
              onPress={() => adjustDays(1)}
              disabled={maxDays >= 15}
              data-testid="days-plus-btn"
            >
              <Ionicons name="add" size={22} color={maxDays >= 15 ? '#ccc' : '#FF6F00'} />
            </TouchableOpacity>
          </View>
          <Text style={styles.range}>min 3 — max 15 giorni</Text>
          <Text style={styles.hint}>Si consiglia: 7-10 giorni</Text>
        </View>

        {/* Numero massimo allenamenti */}
        <View style={styles.settingCard} data-testid="trial-sessions-card">
          <View style={styles.settingHeader}>
            <Ionicons name="fitness" size={20} color="#FF6F00" />
            <Text style={styles.settingLabel}>Numero massimo allenamenti</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity 
              style={[styles.stepBtn, maxSessions <= 1 && styles.stepBtnDisabled]} 
              onPress={() => adjustSessions(-1)}
              disabled={maxSessions <= 1}
              data-testid="sessions-minus-btn"
            >
              <Ionicons name="remove" size={22} color={maxSessions <= 1 ? '#ccc' : '#FF6F00'} />
            </TouchableOpacity>
            <View style={styles.stepValue}>
              <Text style={styles.stepNumber} data-testid="trial-sessions-value">{maxSessions}</Text>
              <Text style={styles.stepUnit}>allenamenti</Text>
            </View>
            <TouchableOpacity 
              style={[styles.stepBtn, maxSessions >= 5 && styles.stepBtnDisabled]} 
              onPress={() => adjustSessions(1)}
              disabled={maxSessions >= 5}
              data-testid="sessions-plus-btn"
            >
              <Ionicons name="add" size={22} color={maxSessions >= 5 ? '#ccc' : '#FF6F00'} />
            </TouchableOpacity>
          </View>
          <Text style={styles.range}>min 1 — max 5 allenamenti</Text>
          <Text style={styles.hint}>Si consiglia: 2-3 allenamenti</Text>
        </View>

        {/* Regole sistema */}
        <View style={styles.rulesCard} data-testid="trial-rules-card">
          <View style={styles.rulesHeader}>
            <Ionicons name="lock-closed" size={18} color="#1a237e" />
            <Text style={styles.rulesTitle}>Regole sistema (automatiche)</Text>
          </View>
          <View style={styles.ruleRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.ruleText}>Se giorni {'>'} {maxDays} → blocco atleta</Text>
          </View>
          <View style={styles.ruleRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.ruleText}>Se allenamenti {'>'} {maxSessions} → blocco atleta</Text>
          </View>
          <View style={styles.ruleRow}>
            <Ionicons name="document-text" size={16} color="#1a237e" />
            <Text style={styles.ruleText}>Il documento di prova usa questi valori nella dichiarazione firmata</Text>
          </View>
        </View>

        {/* Salva */}
        <TouchableOpacity 
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
          data-testid="save-trial-settings-btn"
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva Impostazioni'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#FF6F00' },
  backBtn: {},
  backIcon: { backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  sectionSubtitle: { fontSize: 13, color: '#777', lineHeight: 19, marginBottom: 14 },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
  certToggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12,
    backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFB74D',
    marginBottom: 4,
  },
  certToggleCardActive: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  certToggleTitle: { fontSize: 14, fontWeight: '700', color: '#E65100', marginBottom: 4 },
  certToggleTitleActive: { color: '#2E7D32' },
  certToggleDesc: { fontSize: 12, color: '#666' },
  toggleSwitch: { width: 50, height: 28, borderRadius: 14, padding: 2, backgroundColor: '#ccc', justifyContent: 'center' },
  toggleSwitchOn: { backgroundColor: '#66BB6A' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleKnobOn: { alignSelf: 'flex-end' },
  settingCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f0f0f0' },
  settingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFE082' },
  stepBtnDisabled: { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0' },
  stepValue: { alignItems: 'center', marginHorizontal: 24 },
  stepNumber: { fontSize: 36, fontWeight: '800', color: '#FF6F00' },
  stepUnit: { fontSize: 12, color: '#999', marginTop: -2 },
  range: { fontSize: 11, color: '#999', textAlign: 'center' },
  hint: { fontSize: 11, color: '#FF6F00', textAlign: 'center', fontStyle: 'italic', marginTop: 2 },
  rulesCard: { backgroundColor: '#E8EAF6', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#C5CAE9' },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rulesTitle: { fontSize: 14, fontWeight: '700', color: '#1a237e' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  ruleText: { fontSize: 13, color: '#333' },
  saveBtn: { backgroundColor: '#FF6F00', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
