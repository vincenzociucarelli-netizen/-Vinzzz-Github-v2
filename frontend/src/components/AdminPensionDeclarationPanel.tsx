/**
 * 🆕 AdminPensionDeclarationPanel — vista ADMIN (sola lettura) della
 * Dichiarazione posizione previdenziale di un utente/atleta: ultima versione,
 * badge stato (Firmata / Da verificare / Non dichiarata), storico completo con
 * firma, metadati (IP/UA/data), versione testo, ID accordo.
 * L'admin NON può modificare né firmare al posto del lavoratore.
 *
 * Backend: GET /api/admin/users/{user_id}/pension-declarations
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { formatPensionDateTime, pensionStatusStyle } from '../utils/pensionDeclaration';

interface Props { userId: string }

export default function AdminPensionDeclarationPanel({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await api.get(`/admin/users/${userId}/pension-declarations`);
      setLatest(res.data?.latest || null);
      setHistory(res.data?.history || []);
    } catch { setLatest(null); setHistory([]); } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const st = pensionStatusStyle(latest?.status || 'not_declared');

  return (
    <View style={styles.card} testID="admin-pension-panel">
      <View style={styles.titleRow}>
        <Ionicons name="shield-checkmark" size={18} color="#6D28D9" />
        <Text style={styles.title}>Posizione previdenziale (dichiarata dal lavoratore)</Text>
      </View>
      {loading ? <ActivityIndicator color="#6D28D9" /> : (
        <>
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
              <Ionicons name={st.icon as any} size={14} color={st.color} />
              <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>
            {latest && <Text style={styles.meta}>v.{latest.version_number} · {formatPensionDateTime(latest.signed_at)}</Text>}
          </View>
          {latest ? (
            <>
              <Text style={styles.position}><Text style={{ fontWeight: '700' }}>{latest.position}.</Text> {latest.position_label}</Text>
              {latest.detail ? <Text style={styles.detail}>Tipologia: <Text style={{ fontWeight: '600' }}>{latest.detail}</Text>{latest.detail_note ? ` — ${latest.detail_note}` : ''}</Text> : null}
              <TouchableOpacity style={styles.detailsBtn} onPress={() => setOpen(true)} testID="admin-pension-details-btn">
                <Ionicons name="document-text" size={16} color="#6D28D9" />
                <Text style={styles.detailsBtnText}>Dettagli, firma e storico ({history.length})</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.empty}>Il lavoratore non ha ancora sottoscritto la dichiarazione previdenziale.</Text>
          )}
        </>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Storico dichiarazioni previdenziali</Text>
              <TouchableOpacity onPress={() => setOpen(false)} testID="admin-pension-close"><Ionicons name="close" size={26} color="#fff" /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {history.map((h, idx) => {
                const s = pensionStatusStyle(h.status);
                return (
                  <View key={h.id} style={[styles.histCard, idx === 0 && styles.histCardLatest]}>
                    <View style={styles.row}>
                      <Text style={styles.histVersion}>Versione {h.version_number}{idx === 0 ? ' (attuale)' : ''}</Text>
                      <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
                        <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.position}><Text style={{ fontWeight: '700' }}>{h.position}.</Text> {h.position_label}</Text>
                    {h.detail ? <Text style={styles.detail}>Tipologia: {h.detail}{h.detail_note ? ` — ${h.detail_note}` : ''}</Text> : null}
                    <Text style={styles.histMeta}>Sottoscritta: {formatPensionDateTime(h.signed_at)} da {h.signed_by_name || h.user_full_name}</Text>
                    <Text style={styles.histMeta}>Testo v.{h.text_version} · Accordo: {h.agreement_id}</Text>
                    <Text style={styles.histMeta}>IP: {h.ip} · {String(h.user_agent || '').slice(0, 60)}</Text>
                    {h.previous_declaration_id ? <Text style={styles.histMeta}>Sostituisce: {h.previous_declaration_id}</Text> : null}
                    <Text style={styles.histMeta}>ID: {h.id}</Text>
                    {h.signature_base64 ? (
                      <Image source={{ uri: h.signature_base64 }} style={styles.sig} resizeMode="contain" />
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F5F3FF', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#6D28D9' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 11, color: '#6B7280' },
  position: { fontSize: 13, color: '#1F2937', lineHeight: 19 },
  detail: { fontSize: 12, color: '#374151', marginTop: 4 },
  empty: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 36 },
  detailsBtnText: { fontSize: 12, color: '#6D28D9', fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modal: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#6D28D9', padding: 14 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  histCard: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#FAFAFA' },
  histCardLatest: { borderColor: '#6D28D9', backgroundColor: '#F5F3FF' },
  histVersion: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  histMeta: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  sig: { width: '100%', height: 110, marginTop: 8, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB' },
});
