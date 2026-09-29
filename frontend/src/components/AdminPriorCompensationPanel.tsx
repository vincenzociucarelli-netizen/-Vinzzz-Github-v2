/**
 * 🆕 27/07/2026 — AdminPriorCompensationPanel
 *
 * Componente admin per visualizzare la dichiarazione pregresso firmata da un
 * utente (atleta/coach/dirigente/collaboratore), inclusa firma digitale,
 * metadati IP/UA/timestamp e storia completa delle modifiche fatte dagli admin.
 *
 * L'admin può modificare l'importo — la modifica viene registrata con nota
 * nella history (change log immutabile).
 *
 * Backend endpoint:
 *   GET   /api/admin/users/{user_id}/prior-compensation
 *   PATCH /api/admin/users/{user_id}/prior-compensation
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

interface Props {
  userId: string;
  /** Se true, il pannello è compatto (mostra solo status + bottone "Dettagli") */
  compact?: boolean;
}

interface DeclarationStatus {
  signed: boolean;
  amount: number;
  signed_at: string | null;
  signed_year: number | null;
  current_fiscal_year: number;
  has_signature_image: boolean;
  requires_renewal: boolean;
  signature_base64?: string;
  ip?: string;
  user_agent?: string;
  admin_history?: Array<{
    changed_at: string;
    changed_by_id: string;
    changed_by_name?: string;
    changed_by_email?: string;
    old_amount: number;
    new_amount: number;
    note?: string;
  }>;
  user_full_name?: string;
  user_email?: string;
  user_role?: string;
}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const formatCurrency = (n: number) => {
  return `€ ${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    // I timestamp sono salvati in UTC (spesso senza suffisso 'Z'): se manca il
    // fuso, lo forziamo a UTC e poi convertiamo a Europe/Rome per la visualizzazione.
    let s = String(iso);
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
    const d = new Date(s);
    return d.toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Europe/Rome',
    });
  } catch { return String(iso); }
};

export default function AdminPriorCompensationPanel({ userId, compact = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DeclarationStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await api.get(`/admin/users/${userId}/prior-compensation`);
      setStatus(res.data);
    } catch (_e) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const openDetails = () => {
    setDetailsOpen(true);
    setNewAmount(status?.amount?.toString() || '0');
    setEditNote('');
    setEditMode(false);
  };

  const handleSave = async () => {
    const parsed = parseFloat(newAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      showAlert('Importo non valido', 'Inserisci un numero >= 0');
      return;
    }
    try {
      setSaving(true);
      const res = await api.patch(`/admin/users/${userId}/prior-compensation`, {
        amount: parsed,
        note: editNote.trim() || null,
      });
      if (res.data?.success) {
        showAlert('Modifica salvata', `Nuovo importo: € ${parsed.toFixed(2)}`);
        setEditMode(false);
        setEditNote('');
        await fetchStatus();
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      showAlert('Errore', typeof detail === 'string' ? detail : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.compactCard} data-testid="admin-prior-comp-loading">
        <ActivityIndicator size="small" color="#1E3A8A" />
      </View>
    );
  }
  if (!status) return null;

  const badgeColor = status.signed ? '#059669' : (status.requires_renewal ? '#EA580C' : '#DC2626');
  const badgeLabel = status.signed
    ? '✓ Firmato'
    : (status.requires_renewal ? '⚠ Rinnovo necessario' : '✗ Non firmato');

  return (
    <>
      <View style={styles.compactCard} data-testid="admin-prior-comp-panel">
        <View style={styles.compactRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compactLabel}>📋 Dichiarazione Pregresso {status.current_fiscal_year}</Text>
            <View style={styles.rowGap6}>
              <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
              <Text style={styles.compactAmount}>{formatCurrency(status.amount)}</Text>
            </View>
          </View>
          {!compact && (
            <TouchableOpacity style={styles.detailsBtn} onPress={openDetails} data-testid="admin-prior-comp-details-btn">
              <Ionicons name="eye" size={16} color="#fff" />
              <Text style={styles.detailsBtnText}>Dettagli</Text>
            </TouchableOpacity>
          )}
        </View>
        {compact && (
          <TouchableOpacity style={[styles.detailsBtn, { marginTop: 8 }]} onPress={openDetails}>
            <Ionicons name="eye" size={16} color="#fff" />
            <Text style={styles.detailsBtnText}>Dettagli</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={detailsOpen} animationType="slide" transparent onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.rowGap6}>
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.modalTitle}>Dichiarazione Pregresso</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailsOpen(false)} data-testid="admin-prior-comp-close">
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Info utente */}
              <View style={styles.userBox}>
                <Text style={styles.userName}>{status.user_full_name || 'Utente'}</Text>
                <Text style={styles.userMeta}>{status.user_email} · {status.user_role}</Text>
              </View>

              {/* Status */}
              <View style={styles.statusGrid}>
                <View style={styles.statusCell}>
                  <Text style={styles.cellLabel}>Stato</Text>
                  <View style={[styles.badge, { backgroundColor: badgeColor, alignSelf: 'flex-start' }]}>
                    <Text style={styles.badgeText}>{badgeLabel}</Text>
                  </View>
                </View>
                <View style={styles.statusCell}>
                  <Text style={styles.cellLabel}>Importo</Text>
                  <Text style={styles.cellValue}>{formatCurrency(status.amount)}</Text>
                </View>
                <View style={styles.statusCell}>
                  <Text style={styles.cellLabel}>Anno fiscale</Text>
                  <Text style={styles.cellValue}>{status.signed_year || status.current_fiscal_year}</Text>
                </View>
                <View style={styles.statusCell}>
                  <Text style={styles.cellLabel}>Firmato il</Text>
                  <Text style={styles.cellValue}>{formatDateTime(status.signed_at)}</Text>
                </View>
              </View>

              {/* Metadati */}
              {(status.ip || status.user_agent) && (
                <View style={styles.metaBox}>
                  <Text style={styles.sectionTitle}>Metadati firma</Text>
                  {status.ip && <Text style={styles.metaText}><Text style={styles.metaLabel}>IP:</Text> {status.ip}</Text>}
                  {status.user_agent && (
                    <Text style={styles.metaText} numberOfLines={2}>
                      <Text style={styles.metaLabel}>Device:</Text> {status.user_agent}
                    </Text>
                  )}
                </View>
              )}

              {/* Firma image */}
              {status.has_signature_image && status.signature_base64 && (
                <View style={styles.sigBox}>
                  <Text style={styles.sectionTitle}>Firma digitale</Text>
                  <Image
                    source={{ uri: status.signature_base64 }}
                    style={styles.sigImage}
                    resizeMode="contain"
                    data-testid="admin-prior-comp-signature-img"
                  />
                </View>
              )}

              {/* Edit importo */}
              <View style={styles.editBox}>
                <View style={styles.rowGap6}>
                  <Ionicons name="create" size={16} color="#1E3A8A" />
                  <Text style={styles.sectionTitle}>Modifica importo (admin)</Text>
                </View>
                {!editMode ? (
                  <TouchableOpacity style={styles.editStartBtn} onPress={() => setEditMode(true)} data-testid="admin-prior-comp-start-edit">
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={styles.editStartBtnText}>Modifica importo</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={styles.inputLabel}>Nuovo importo (€)</Text>
                    <TextInput
                      value={newAmount}
                      onChangeText={setNewAmount}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                      style={styles.input}
                      editable={!saving}
                      data-testid="admin-prior-comp-new-amount"
                    />
                    <Text style={styles.inputLabel}>Motivo (opzionale)</Text>
                    <TextInput
                      value={editNote}
                      onChangeText={setEditNote}
                      placeholder="Es. correzione dopo controllo contratto"
                      style={[styles.input, { minHeight: 60 }]}
                      multiline
                      editable={!saving}
                      data-testid="admin-prior-comp-note"
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditMode(false)} disabled={saving}>
                        <Text style={styles.cancelBtnText}>Annulla</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} data-testid="admin-prior-comp-save">
                        {saving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.saveBtnText}>Salva</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* History */}
              <View style={styles.historyBox}>
                <View style={styles.rowGap6}>
                  <Ionicons name="time" size={16} color="#374151" />
                  <Text style={styles.sectionTitle}>Storia modifiche admin</Text>
                </View>
                {(!status.admin_history || status.admin_history.length === 0) ? (
                  <Text style={styles.emptyHistory}>Nessuna modifica admin registrata.</Text>
                ) : (
                  <View>
                    {(status.admin_history || []).slice().reverse().map((h, i) => (
                      <View key={i} style={styles.historyItem} data-testid={`admin-prior-comp-history-${i}`}>
                        <Text style={styles.historyWhen}>{formatDateTime(h.changed_at)}</Text>
                        <Text style={styles.historyWho}>{h.changed_by_name || h.changed_by_email || '—'}</Text>
                        <Text style={styles.historyChange}>
                          {formatCurrency(h.old_amount)} → <Text style={{ fontWeight: '700' }}>{formatCurrency(h.new_amount)}</Text>
                        </Text>
                        {h.note && <Text style={styles.historyNote}>💬 {h.note}</Text>}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
    marginBottom: 12,
  },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactLabel: { fontSize: 13, fontWeight: '600', color: '#1E3A8A', marginBottom: 4 },
  compactAmount: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  rowGap6: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modalBox: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    padding: 14,
  },
  modalTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalBody: { paddingHorizontal: 16, paddingTop: 12 },
  userBox: { paddingBottom: 12, borderBottomWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14, gap: 12 },
  statusCell: { minWidth: 140, flex: 1 },
  cellLabel: { fontSize: 11, color: '#6B7280', textTransform: 'uppercase' as any, marginBottom: 4 },
  cellValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  metaBox: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 14 },
  metaText: { fontSize: 12, color: '#4B5563', marginBottom: 4 },
  metaLabel: { fontWeight: '600', color: '#374151' },
  sigBox: { marginBottom: 14 },
  sigImage: { width: '100%', height: 140, backgroundColor: '#FFFDF7', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  editBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 14 },
  editStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  editStartBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  cancelBtnText: { color: '#6B7280', fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  historyBox: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 14 },
  emptyHistory: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  historyItem: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  historyWhen: { fontSize: 11, color: '#6B7280' },
  historyWho: { fontSize: 12, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  historyChange: { fontSize: 13, color: '#1F2937', marginTop: 2 },
  historyNote: { fontSize: 12, color: '#4B5563', fontStyle: 'italic', marginTop: 4 },
});
