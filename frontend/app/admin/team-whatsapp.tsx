import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';

interface RosterContact {
  athlete_id: string;
  athlete_name: string;
  is_minor: boolean;
  athlete_phone: string;
  mother_phone: string;
  father_phone: string;
}

type Mode = 'parents' | 'athlete' | 'both';

// Normalizza un numero italiano in formato internazionale senza "+"
const normalizePhone = (raw: string): string => {
  let p = (raw || '').replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('00')) p = p.substring(2);
  if (p.startsWith('39')) return p;
  p = p.replace(/^0+/, '');
  return `39${p}`;
};

// Costruisce l'elenco dei numeri (con etichetta) in base alla modalità scelta
function buildRecipients(athletes: RosterContact[], mode: Mode) {
  const seen = new Set<string>();
  const list: { label: string; phone: string; norm: string }[] = [];
  athletes.forEach(a => {
    const targets: { label: string; phone: string }[] = [];
    if (mode === 'parents' || mode === 'both') {
      if (a.mother_phone) targets.push({ label: `${a.athlete_name} · Madre`, phone: a.mother_phone });
      if (a.father_phone) targets.push({ label: `${a.athlete_name} · Padre`, phone: a.father_phone });
    }
    if (mode === 'athlete' || mode === 'both') {
      if (a.athlete_phone) targets.push({ label: `${a.athlete_name} · Atleta`, phone: a.athlete_phone });
    }
    targets.forEach(t => {
      const norm = normalizePhone(t.phone);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push({ label: t.label, phone: t.phone, norm });
      }
    });
  });
  return list;
}

export default function TeamWhatsApp() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = typeof params.team_id === 'string' ? params.team_id : '';
  const teamName = typeof params.team_name === 'string' ? params.team_name : '';

  const [athletes, setAthletes] = useState<RosterContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('parents');
  const [message, setMessage] = useState('');
  const [sentSet, setSentSet] = useState<Set<string>>(new Set());

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/admin/teams/${teamId}/whatsapp-contacts`)
      .then(res => setAthletes(res.data?.athletes || []))
      .catch(() => setAthletes([]))
      .finally(() => setLoading(false));
  }, [teamId]);

  const recipients = useMemo(() => buildRecipients(athletes, mode), [athletes, mode]);

  const openWhatsApp = (norm: string) => {
    const url = message.trim()
      ? `https://wa.me/${norm}?text=${encodeURIComponent(message.trim())}`
      : `https://wa.me/${norm}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
    setSentSet(prev => { const n = new Set(prev); n.add(norm); return n; });
  };

  const copyNumbers = async () => {
    if (recipients.length === 0) { showAlert('Nessun numero', 'Non ci sono numeri per questa selezione.'); return; }
    // Formato compatibile con la rubrica: +39XXXXXXXXXX separati da virgola e newline
    const text = recipients.map(r => `+${r.norm}`).join(', ');
    await Clipboard.setStringAsync(text);
    showAlert('Numeri copiati', `${recipients.length} numeri copiati.\n\nOra apri WhatsApp → Nuovo → Nuova lista broadcast e incolla/seleziona i contatti.`);
  };

  const copyMessage = async () => {
    if (!message.trim()) { showAlert('Messaggio vuoto', 'Scrivi prima il messaggio.'); return; }
    await Clipboard.setStringAsync(message.trim());
    showAlert('Messaggio copiato', 'Puoi incollarlo nella lista broadcast di WhatsApp.');
  };

  const MODES: { key: Mode; label: string; icon: string }[] = [
    { key: 'parents', label: 'Genitori', icon: 'people-outline' },
    { key: 'athlete', label: 'Atleta', icon: 'person-outline' },
    { key: 'both', label: 'Entrambi', icon: 'people-circle-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="tw-back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Messaggio WhatsApp</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{teamName || 'Squadra'}</Text>
        </View>
        <Ionicons name="logo-whatsapp" size={26} color="#fff" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Recipient mode */}
        <View style={styles.section}>
          <Text style={styles.label}>Invia a</Text>
          <View style={styles.modeRow}>
            {MODES.map(m => {
              const active = mode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => setMode(m.key)}
                  testID={`tw-mode-${m.key}`}
                >
                  <Ionicons name={m.icon as any} size={16} color={active ? '#fff' : '#25776b'} />
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Message */}
        <View style={styles.section}>
          <Text style={styles.label}>Messaggio (uguale per tutti)</Text>
          <TextInput
            style={styles.messageInput}
            multiline
            placeholder="Es. Ciao, l'allenamento di oggi è sospeso per maltempo. Grazie!"
            placeholderTextColor="#9AA0A6"
            value={message}
            onChangeText={setMessage}
            testID="tw-message"
          />
        </View>

        {/* Broadcast helper */}
        <View style={styles.section}>
          <View style={styles.broadcastCard}>
            <Text style={styles.broadcastTitle}>📢 Invio unico (Lista Broadcast)</Text>
            <Text style={styles.broadcastHint}>
              Copia i numeri e il messaggio, poi su WhatsApp crea una «Nuova lista broadcast» e incolla il messaggio per inviarlo a tutti in un colpo.
            </Text>
            <View style={styles.broadcastBtns}>
              <TouchableOpacity style={styles.copyBtn} onPress={copyNumbers} testID="tw-copy-numbers">
                <Ionicons name="call-outline" size={16} color="#fff" />
                <Text style={styles.copyBtnText}>Copia numeri ({recipients.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#455A64' }]} onPress={copyMessage} testID="tw-copy-message">
                <Ionicons name="clipboard-outline" size={16} color="#fff" />
                <Text style={styles.copyBtnText}>Copia messaggio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tap-by-tap list */}
        <View style={styles.section}>
          <Text style={styles.label}>Oppure invia uno per uno ({recipients.length})</Text>
          {loading ? (
            <ActivityIndicator color="#25D366" style={{ marginTop: 20 }} />
          ) : recipients.length === 0 ? (
            <Text style={styles.emptyText}>Nessun numero disponibile per questa selezione.</Text>
          ) : (
            recipients.map((r) => {
              const sent = sentSet.has(r.norm);
              return (
                <View key={r.norm} style={styles.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{r.label}</Text>
                    <Text style={styles.contactPhone}>{r.phone}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.sendBtn, sent && styles.sendBtnDone]}
                    onPress={() => openWhatsApp(r.norm)}
                    testID={`tw-send-${r.norm}`}
                  >
                    <Ionicons name={sent ? 'checkmark' : 'logo-whatsapp'} size={18} color="#fff" />
                    <Text style={styles.sendBtnText}>{sent ? 'Inviato' : 'Invia'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.footerHint}>
          WhatsApp si aprirà con il messaggio precompilato: confermerai tu l’invio. I minori vengono contattati tramite i genitori.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: {
    backgroundColor: '#25D366',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 1 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#B7E4CE',
  },
  modeChipActive: { backgroundColor: '#25D366', borderColor: '#25D366' },
  modeChipText: { fontSize: 13, color: '#25776b', fontWeight: '700' },
  modeChipTextActive: { color: '#fff' },
  messageInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD',
    padding: 12, minHeight: 110, fontSize: 14, lineHeight: 20, textAlignVertical: 'top', color: '#222',
  },
  broadcastCard: {
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#B7E4CE',
  },
  broadcastTitle: { fontSize: 14, fontWeight: '800', color: '#1B5E20' },
  broadcastHint: { fontSize: 12.5, color: '#33691E', marginTop: 4, lineHeight: 18 },
  broadcastBtns: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2E7D32', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: '#888', fontStyle: 'italic', marginTop: 10 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#ECEFF1',
  },
  contactName: { fontSize: 14, fontWeight: '600', color: '#222' },
  contactPhone: { fontSize: 12.5, color: '#666', marginTop: 2 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25D366',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  sendBtnDone: { backgroundColor: '#8BC34A' },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  footerHint: { fontSize: 11.5, color: '#888', textAlign: 'center', marginTop: 16, paddingHorizontal: 24, fontStyle: 'italic' },
});
