import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Platform, Linking, Modal, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocietyBranding from '../../src/components/SocietyBranding';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CASE_COLORS: Record<string, { bg: string; fg: string; icon: string }> = {
  trial_start_unsigned:    { bg: '#FFF8E1', fg: '#F57F17', icon: 'create-outline' },
  trial_end_no_certificate:{ bg: '#FFEBEE', fg: '#C62828', icon: 'medkit-outline' },
  trial_end_no_privacy:    { bg: '#FFEBEE', fg: '#C62828', icon: 'shield-outline' },
  trial_end_no_decision:   { bg: '#FFF3E0', fg: '#EF6C00', icon: 'help-circle-outline' },
  unsigned_receipt:        { bg: '#E3F2FD', fg: '#1565C0', icon: 'receipt-outline' },
  certificate_expiring:    { bg: '#FFEBEE', fg: '#C62828', icon: 'medical-outline' },
};

type Contact = { name: string; phone: string; role: string };
type CaseRow = {
  case: string;
  label: string;
  athlete_id?: string | null;
  athlete_name?: string | null;
  user_id?: string;
  user_role?: string;
  contacts: Contact[];
  data_context?: Record<string, any>;
  days_overdue: number;
  expires_in_days?: number;
  last_reminder_at?: string | null;
  template: string;
};

export default function WhatsAppRemindersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filterCase, setFilterCase] = useState<string>('all');
  const [selected, setSelected] = useState<{ row: CaseRow; contact: Contact } | null>(null);
  const [renderedMessage, setRenderedMessage] = useState('');
  const [renderingMsg, setRenderingMsg] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/whatsapp/pending-reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setCases(data.cases || []);
    } catch (e) {
      console.warn('load reminders error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterCase === 'all' ? cases : cases.filter(c => c.case === filterCase);

  const counts = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.case] = (acc[c.case] || 0) + 1;
    return acc;
  }, {});

  const openReminderModal = async (row: CaseRow, contact: Contact) => {
    setSelected({ row, contact });
    setRenderingMsg(true);
    setRenderedMessage('');
    try {
      const token = await AsyncStorage.getItem('token');
      const params = new URLSearchParams({
        case: row.case,
        contact_name: contact.name || '',
      });
      if (row.athlete_id) params.append('athlete_id', row.athlete_id);
      if (row.user_id) params.append('user_id', row.user_id);
      const r = await fetch(`${API}/api/admin/whatsapp/render?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setRenderedMessage(data.message || row.template);
    } catch (e) {
      setRenderedMessage(row.template);
    } finally {
      setRenderingMsg(false);
    }
  };

  const openWhatsApp = async () => {
    if (!selected) return;
    const digits = selected.contact.phone.replace(/\D/g, '');
    let phone = digits;
    if (phone.startsWith('00')) phone = phone.substring(2);
    if (phone.startsWith('0') && phone.length <= 11) phone = '39' + phone.replace(/^0+/, '');
    if (!phone.startsWith('39') && (phone.length === 9 || phone.length === 10)) phone = '39' + phone;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(renderedMessage)}`;
    // Log + open
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API}/api/admin/whatsapp/log-sent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          case: selected.row.case,
          target_user_id: selected.row.user_id || null,
          target_athlete_id: selected.row.athlete_id || null,
          target_phone: selected.contact.phone,
          message_sent: renderedMessage,
        }),
      });
    } catch (e) { /* non-blocking */ }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
    setSelected(null);
    setTimeout(load, 800);
  };

  const formatRelative = (iso?: string | null) => {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    if (isNaN(diffMs)) return null;
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 1) return 'pochi minuti fa';
    if (hours < 24) return `${hours}h fa`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}g fa`;
    return new Date(iso).toLocaleDateString('it-IT');
  };

  const filterChips = [
    { key: 'all', label: `Tutti (${cases.length})` },
    ...Object.keys(CASE_COLORS).map(k => ({ key: k, label: `${shortLabel(k)} (${counts[k] || 0})` })),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="wa-back">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>🟢 Solleciti WhatsApp</Text>
            <Text style={styles.headerSub}>{cases.length} casi pendenti</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/admin/whatsapp-settings')}
            style={styles.settingsBtn}
            data-testid="wa-settings-btn"
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <SocietyBranding light logoSize={26} />
      </View>

      {/* Filter chips */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {filterChips.map(c => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setFilterCase(c.key)}
              style={[styles.chip, filterCase === c.key && styles.chipActive]}
              data-testid={`wa-filter-${c.key}`}
            >
              <Text style={[styles.chipText, filterCase === c.key && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#25D366" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle" size={48} color="#43A047" />
              <Text style={styles.emptyTitle}>Tutto in regola! 🎉</Text>
              <Text style={styles.emptySub}>Nessun sollecito da inviare al momento.</Text>
            </View>
          ) : filtered.map((row, idx) => {
            const c = CASE_COLORS[row.case] || CASE_COLORS.trial_start_unsigned;
            const lastRem = formatRelative(row.last_reminder_at);
            return (
              <View key={idx} style={[styles.caseCard, { borderLeftColor: c.fg }]}>
                <View style={styles.caseHeader}>
                  <View style={[styles.caseIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={c.icon as any} size={22} color={c.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.caseLabel}>{row.label}</Text>
                    <Text style={styles.caseTarget}>
                      {row.athlete_name || `${row.user_role}: ${row.contacts[0]?.name}`}
                    </Text>
                  </View>
                  <View style={[styles.daysBadge, { backgroundColor: c.bg }]}>
                    <Text style={[styles.daysBadgeText, { color: c.fg }]}>
                      {row.case === 'certificate_expiring' && row.expires_in_days != null && row.expires_in_days > 0
                        ? `tra ${row.expires_in_days}g`
                        : `${row.days_overdue}g`}
                    </Text>
                  </View>
                </View>

                {row.data_context && Object.keys(row.data_context).length > 0 && (
                  <View style={styles.contextRow}>
                    {row.data_context.end_date && (
                      <Text style={styles.contextText}>Fine prova: {row.data_context.end_date}</Text>
                    )}
                    {row.data_context.start_date && (
                      <Text style={styles.contextText}>Inizio: {row.data_context.start_date}</Text>
                    )}
                    {row.data_context.expiry_date && (
                      <Text style={styles.contextText}>Scadenza: {row.data_context.expiry_date}</Text>
                    )}
                    {row.data_context.month && (
                      <Text style={styles.contextText}>
                        Mese: {row.data_context.month}
                        {row.data_context.amount ? ` (€ ${Number(row.data_context.amount).toFixed(2)})` : ''}
                      </Text>
                    )}
                  </View>
                )}

                {lastRem && (
                  <View style={styles.lastRemBadge}>
                    <Ionicons name="time-outline" size={13} color="#888" />
                    <Text style={styles.lastRemText}>Ultimo sollecito: {lastRem}</Text>
                  </View>
                )}

                <View style={styles.contactsRow}>
                  {row.contacts.map((ct, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.waBtn}
                      onPress={() => openReminderModal(row, ct)}
                      data-testid={`wa-send-${row.case}-${i}`}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      <Text style={styles.waBtnText}>{ct.name} ({ct.role})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal anteprima messaggio */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              <Text style={styles.modalTitle}>Anteprima messaggio</Text>
              <TouchableOpacity onPress={() => setSelected(null)} data-testid="wa-modal-close">
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {selected && (
              <Text style={styles.modalSub}>
                A: <Text style={{ fontWeight: '600' }}>{selected.contact.name}</Text> ({selected.contact.phone})
              </Text>
            )}
            {renderingMsg ? (
              <ActivityIndicator color="#25D366" style={{ marginVertical: 18 }} />
            ) : (
              <TextInput
                style={styles.messageInput}
                multiline
                value={renderedMessage}
                onChangeText={setRenderedMessage}
                data-testid="wa-modal-message"
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setSelected(null)}>
                <Text style={styles.btnSecondaryText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={openWhatsApp}
                disabled={!renderedMessage || renderingMsg}
                data-testid="wa-modal-send"
              >
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Apri WhatsApp</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              WhatsApp si aprirà con il messaggio precompilato. Confermerai tu l'invio.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function shortLabel(case_key: string): string {
  const map: Record<string, string> = {
    trial_start_unsigned: 'Firma prova',
    trial_end_no_certificate: 'Certif. mancante',
    trial_end_no_privacy: 'Privacy',
    trial_end_no_decision: 'Decisione',
    unsigned_receipt: 'Quietanze',
    certificate_expiring: 'Cert. in scadenza',
  };
  return map[case_key] || case_key;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#25D366',
    paddingTop: Platform.OS === 'web' ? 22 : 50,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  backBtn: { padding: 4 },
  settingsBtn: { padding: 6 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  chipsWrap: { paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8 },
  chipActive: { backgroundColor: '#25D366' },
  chipText: { color: '#444', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#43A047' },
  emptySub: { color: '#666' },
  caseCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  caseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caseIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  caseLabel: { fontSize: 14, fontWeight: '700', color: '#222' },
  caseTarget: { fontSize: 13, color: '#666', marginTop: 2 },
  daysBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  daysBadgeText: { fontSize: 12, fontWeight: '700' },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingLeft: 50 },
  contextText: { fontSize: 12, color: '#555' },
  lastRemBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingLeft: 50 },
  lastRemText: { fontSize: 11, color: '#888', fontStyle: 'italic' },
  contactsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25D366',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  waBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#222' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 8 },
  messageInput: {
    marginTop: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12,
    minHeight: 130, fontSize: 14, lineHeight: 20, textAlignVertical: 'top', color: '#222',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnSecondary: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#eee' },
  btnSecondaryText: { color: '#444', fontWeight: '700' },
  btnPrimary: {
    flex: 2, flexDirection: 'row', gap: 6, padding: 12, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  modalHint: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
