/**
 * Responsabile Admin settings page.
 *
 * Shows who is the current Responsabile Admin ("lo scettro dell'app"),
 * their declaration status, and the delegation history.
 *
 * If the current user IS the Responsabile:
 *   - Can re-sign / view their declaration
 *   - Can delegate the role to another Admin (opens a confirmation modal)
 *
 * If the current user is NOT the Responsabile:
 *   - Can only view who holds the role and the history
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../../src/services/api';
import { Ionicons } from '../../../src/components/Icon';

interface Admin {
  id: string;
  email: string;
  full_name: string;
}

interface PrimaryStatus {
  primary_admin_id: string | null;
  primary_admin_name: string | null;
  primary_admin_email: string | null;
  is_current_user_primary: boolean;
  declaration_signed: boolean;
  declaration_type: 'legal_representative' | 'authorized_delegate' | null;
  declaration_at: string | null;
  delegable_admins: Admin[];
  primary_set_explicitly: boolean;
}

interface HistoryEvent {
  id?: string;
  action: string;
  user_name?: string;
  user_email?: string;
  ip_address?: string;
  created_at?: string;
  timestamp?: string;
  details?: any;
}

const DECLARATION_LABEL: Record<string, string> = {
  legal_representative: 'Legale Rappresentante della Società',
  authorized_delegate: 'Dirigente autorizzato dal Legale Rappresentante',
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PrimaryAdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PrimaryStatus | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<Admin | null>(null);
  const [delegating, setDelegating] = useState(false);

  const showMsg = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, hi] = await Promise.all([
        api.get('/admin/primary-admin/status'),
        api.get('/admin/primary-admin/history'),
      ]);
      setStatus(st.data);
      setHistory((hi.data?.events || []) as HistoryEvent[]);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile caricare';
      showMsg('Errore', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openDelegate = (admin: Admin) => {
    setSelectedDelegate(admin);
    setDelegateModalOpen(true);
  };

  const confirmDelegate = async () => {
    if (!selectedDelegate) return;
    setDelegating(true);
    try {
      await api.post('/admin/primary-admin/delegate', {
        new_admin_id: selectedDelegate.id,
      });
      setDelegateModalOpen(false);
      setSelectedDelegate(null);
      showMsg(
        '✅ Delega completata',
        `${selectedDelegate.full_name} è ora il nuovo Responsabile Admin. Dovrà firmare la propria dichiarazione al prossimo accesso.`
      );
      await loadAll();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile delegare';
      showMsg('Errore', msg);
    } finally {
      setDelegating(false);
    }
  };

  if (loading || !status) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  const isPrimary = status.is_current_user_primary;
  const declLabel = status.declaration_type ? DECLARATION_LABEL[status.declaration_type] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/admin/settings')} style={styles.backBtn} data-testid="back-btn">
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-back" size={22} color="#1565C0" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Responsabile Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
        {/* Scettro card */}
        <View style={styles.scepterCard}>
          <View style={styles.scepterIcon}>
            <Ionicons name="shield-checkmark" size={38} color="#fff" />
          </View>
          <Text style={styles.scepterLabel}>DETENTORE ATTUALE</Text>
          <Text style={styles.scepterName} data-testid="primary-admin-name">
            {status.primary_admin_name || '—'}
          </Text>
          <Text style={styles.scepterEmail}>{status.primary_admin_email || ''}</Text>
          {isPrimary && (
            <View style={styles.youBadge}>
              <Ionicons name="person" size={12} color="#1565C0" />
              <Text style={styles.youBadgeText}>Sei tu</Text>
            </View>
          )}
        </View>

        {/* Declaration status */}
        <View style={[styles.card, { borderColor: status.declaration_signed ? '#2E7D32' : '#E65100' }]}>
          <View style={styles.cardHeader}>
            <Ionicons
              name={status.declaration_signed ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={status.declaration_signed ? '#2E7D32' : '#E65100'}
            />
            <Text style={[styles.cardTitle, { color: status.declaration_signed ? '#2E7D32' : '#E65100' }]}>
              Dichiarazione di ruolo
            </Text>
          </View>
          {status.declaration_signed ? (
            <>
              <Text style={styles.kv}>
                <Text style={styles.kvLabel}>Tipo: </Text>{declLabel}
              </Text>
              <Text style={styles.kv}>
                <Text style={styles.kvLabel}>Firmata il: </Text>{formatDateTime(status.declaration_at)}
              </Text>
            </>
          ) : (
            <Text style={styles.warningText}>
              {isPrimary
                ? 'Devi firmare la tua dichiarazione prima di esercitare funzioni sensibili (es. mantenere disattivato il blocco certificati oltre la mezzanotte). Il popup appare automaticamente al tuo accesso.'
                : 'Il Responsabile non ha ancora firmato la dichiarazione. Solo lui/lei potrà firmarla al proprio prossimo accesso.'}
            </Text>
          )}
        </View>

        {/* Delegation (only if current user is primary) */}
        {isPrimary && (
          <View style={[styles.card, { borderColor: '#7B1FA2' }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="swap-horizontal" size={20} color="#7B1FA2" />
              <Text style={[styles.cardTitle, { color: '#7B1FA2' }]}>Delega ad un altro Admin</Text>
            </View>
            <Text style={styles.hintText}>
              Puoi passare lo "scettro" ad un altro Admin della società. La dichiarazione attuale verrà annullata e il nuovo Responsabile dovrà firmarne una propria.
            </Text>
            {status.delegable_admins.length === 0 ? (
              <Text style={styles.mutedText}>Nessun altro Admin disponibile per la delega.</Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {status.delegable_admins.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.adminRow}
                    onPress={() => openDelegate(a)}
                    data-testid={`delegate-to-${a.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adminName}>{a.full_name}</Text>
                      <Text style={styles.adminEmail}>{a.email}</Text>
                    </View>
                    <View style={styles.delegateCta}>
                      <Ionicons name="arrow-forward" size={14} color="#7B1FA2" />
                      <Text style={styles.delegateCtaText}>DELEGA</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* History */}
        <View style={[styles.card, { borderColor: '#5856D6' }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={20} color="#5856D6" />
            <Text style={[styles.cardTitle, { color: '#5856D6' }]}>Storico</Text>
          </View>
          {history.length === 0 ? (
            <Text style={styles.mutedText}>Nessun evento registrato.</Text>
          ) : (
            history.map((e, idx) => (
              <View key={e.id || idx} style={styles.histItem}>
                <View style={styles.histDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.histAction}>
                    {e.action === 'primary_admin_declaration_signed'
                      ? '✍️ Dichiarazione firmata'
                      : '🔄 Delega Responsabile Admin'}
                  </Text>
                  <Text style={styles.histMeta}>
                    {e.user_name || e.user_email || '—'} • {formatDateTime(e.created_at || e.timestamp)}
                  </Text>
                  {e.action === 'primary_admin_delegated' && e.details && (
                    <Text style={styles.histDetail}>
                      Da {e.details.from_user_name || '—'} → {e.details.to_user_name || '—'}
                    </Text>
                  )}
                  {e.action === 'primary_admin_declaration_signed' && e.details?.declaration_type && (
                    <Text style={styles.histDetail}>
                      Ruolo: {DECLARATION_LABEL[e.details.declaration_type] || e.details.declaration_type}
                    </Text>
                  )}
                  {e.ip_address && e.ip_address !== 'unknown' && (
                    <Text style={styles.histIp}>IP: {e.ip_address}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Delegate confirmation modal */}
      <Modal visible={delegateModalOpen} transparent animationType="fade" onRequestClose={() => setDelegateModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={22} color="#fff" />
              <Text style={styles.modalTitle}>Conferma delega</Text>
            </View>
            <View style={{ padding: 18 }}>
              <Text style={styles.modalLead}>
                Stai per passare lo "scettro" di Responsabile Admin a:
              </Text>
              <View style={styles.modalPerson}>
                <Text style={styles.modalPersonName}>{selectedDelegate?.full_name}</Text>
                <Text style={styles.modalPersonEmail}>{selectedDelegate?.email}</Text>
              </View>
              <View style={styles.modalWarnBox}>
                <Text style={styles.modalWarnText}>
                  ⚠️ La tua dichiarazione attuale verrà annullata. Non potrai più usare le funzioni riservate al Responsabile finché non ti verrà nuovamente delegato il ruolo.
                </Text>
                <Text style={styles.modalWarnText}>
                  L'eventuale flag "Mantieni disattivato" sul blocco certificati verrà disabilitato.
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setDelegateModalOpen(false)}
                  disabled={delegating}
                  style={[styles.btnSecondary, delegating && { opacity: 0.5 }]}
                  data-testid="delegate-cancel"
                >
                  <Text style={styles.btnSecondaryText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDelegate}
                  disabled={delegating}
                  style={[styles.btnPrimary, delegating && { opacity: 0.5 }]}
                  data-testid="delegate-confirm"
                >
                  {delegating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>CONFERMA DELEGA</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1565C0',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  backBtnInner: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  content: { flex: 1 },
  scepterCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#1565C0',
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  scepterIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1565C0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  scepterLabel: { fontSize: 10, color: '#888', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  scepterName: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginTop: 4 },
  scepterEmail: { fontSize: 12, color: '#666', marginTop: 2 },
  youBadge: {
    marginTop: 10, backgroundColor: '#E3F2FD', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  youBadgeText: { color: '#1565C0', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4,
    padding: 14, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  kv: { fontSize: 13, color: '#333', marginBottom: 4, lineHeight: 19 },
  kvLabel: { color: '#666', fontWeight: '700' },
  warningText: { fontSize: 12, color: '#E65100', lineHeight: 18 },
  hintText: { fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 17 },
  mutedText: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  adminRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FAFAFA', borderRadius: 8, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#EEE',
  },
  adminName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  adminEmail: { fontSize: 12, color: '#666', marginTop: 2 },
  delegateCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3E5F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: '#CE93D8',
  },
  delegateCtaText: { color: '#7B1FA2', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  histItem: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  histDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5856D6', marginTop: 6 },
  histAction: { fontSize: 13, fontWeight: '700', color: '#333' },
  histMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  histDetail: { fontSize: 11, color: '#555', marginTop: 3, fontStyle: 'italic' },
  histIp: { fontSize: 10, color: '#AAA', marginTop: 2 },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  modalHeader: {
    backgroundColor: '#7B1FA2', paddingVertical: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalLead: { fontSize: 13, color: '#555', marginBottom: 10 },
  modalPerson: { backgroundColor: '#FAFAFA', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  modalPersonName: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  modalPersonEmail: { fontSize: 12, color: '#666', marginTop: 2 },
  modalWarnBox: { backgroundColor: '#FFF3E0', borderLeftWidth: 4, borderLeftColor: '#FF9800', padding: 10, borderRadius: 6, marginBottom: 16, gap: 6 },
  modalWarnText: { fontSize: 12, color: '#E65100', lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  btnSecondary: { flex: 1, backgroundColor: '#EEE', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnSecondaryText: { color: '#666', fontSize: 13, fontWeight: '700' },
  btnPrimary: { flex: 1, backgroundColor: '#7B1FA2', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});
