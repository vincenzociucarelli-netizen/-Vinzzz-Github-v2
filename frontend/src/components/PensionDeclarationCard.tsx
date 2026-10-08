/**
 * 🆕 PensionDeclarationCard — sezione "Posizione previdenziale" nella vista
 * PERSONALE del lavoratore (atleta PRO / coach / dirigente / collaboratore).
 *
 * Mostra l'ultima dichiarazione sottoscritta (o l'avviso se manca), lo storico
 * delle versioni e il pulsante per presentare una NUOVA dichiarazione.
 * Le dichiarazioni precedenti non si possono modificare: ogni variazione è
 * una nuova versione firmata.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PensionDeclarationModal from './PensionDeclarationModal';
import { formatPensionDateTime, pensionStatusStyle } from '../utils/pensionDeclaration';

interface Props {
  userFullName: string;
  /** Richiamato dopo ogni nuova firma (es. per ricaricare la pagina padre) */
  onDeclared?: () => void;
}

export default function PensionDeclarationCard({ userFullName, onDeclared }: Props) {
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/me/pension-declaration/status');
      setLatest(res.data?.latest || null);
      setHistory(res.data?.history || []);
    } catch {
      setLatest(null); setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const st = pensionStatusStyle(latest?.status || 'not_declared');

  return (
    <View style={styles.card} testID="pension-declaration-card">
      <View style={styles.titleRow}>
        <Text style={{ fontSize: 14, marginRight: 6 }}>🛡️</Text>
        <Text style={styles.title}>Posizione previdenziale dichiarata</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#1E3A8A" style={{ marginVertical: 8 }} />
      ) : latest ? (
        <>
          <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Ionicons name={st.icon as any} size={16} color={st.color} />
            <Text style={[styles.badgeText, { color: st.color }]}>{st.label} · v.{latest.version_number}</Text>
          </View>
          <Text style={styles.position}>
            <Text style={{ fontWeight: '700' }}>{latest.position}.</Text> {latest.position_label}
          </Text>
          {latest.detail ? <Text style={styles.detail}>Tipologia: <Text style={{ fontWeight: '600' }}>{latest.detail}</Text>{latest.detail_note ? ` — ${latest.detail_note}` : ''}</Text> : null}
          <Text style={styles.meta}>Sottoscritta il {formatPensionDateTime(latest.signed_at)} · testo v.{latest.text_version}</Text>

          {history.length > 1 && (
            <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={styles.historyToggle} testID="pension-history-toggle">
              <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color="#1E3A8A" />
              <Text style={styles.historyToggleText}>Storico dichiarazioni ({history.length})</Text>
            </TouchableOpacity>
          )}
          {showHistory && history.slice(1).map((h) => (
            <View key={h.id} style={styles.historyItem}>
              <Text style={styles.historyText}>
                <Text style={{ fontWeight: '700' }}>v.{h.version_number}</Text> · {h.position}. {h.position_short}{h.detail ? ` (${h.detail})` : ''} · {formatPensionDateTime(h.signed_at)}
              </Text>
            </View>
          ))}
        </>
      ) : (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            ⚠️ Non hai ancora sottoscritto la Dichiarazione della posizione previdenziale. È richiesta per completare l&apos;accettazione dell&apos;accordo di lavoro sportivo.
          </Text>
        </View>
      )}

      {!loading && (
        <TouchableOpacity style={[styles.btn, latest && styles.btnSecondary]} onPress={() => setModalOpen(true)} testID="pension-new-declaration-btn">
          <Ionicons name={latest ? 'refresh-circle' : 'create'} size={18} color={latest ? '#1E3A8A' : '#fff'} />
          <Text style={[styles.btnText, latest && { color: '#1E3A8A' }]}>
            {latest ? 'Aggiorna posizione (nuova dichiarazione)' : 'Sottoscrivi Dichiarazione Previdenziale'}
          </Text>
        </TouchableOpacity>
      )}

      <PensionDeclarationModal
        visible={modalOpen}
        userFullName={userFullName}
        previousVersionNumber={latest?.version_number || null}
        onClose={() => setModalOpen(false)}
        onDeclared={() => { setModalOpen(false); load(); onDeclared?.(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F5F3FF', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#6D28D9', marginTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  position: { fontSize: 13, color: '#1F2937', lineHeight: 19 },
  detail: { fontSize: 13, color: '#374151', marginTop: 4 },
  meta: { fontSize: 11, color: '#6B7280', marginTop: 6 },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, minHeight: 32 },
  historyToggleText: { fontSize: 12, color: '#1E3A8A', fontWeight: '600' },
  historyItem: { backgroundColor: '#fff', borderRadius: 6, padding: 8, marginTop: 6 },
  historyText: { fontSize: 12, color: '#4B5563' },
  warnBox: { backgroundColor: '#FFF3CD', padding: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#FF9500' },
  warnText: { color: '#856404', fontSize: 13, fontWeight: '500' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E3A8A', padding: 12, borderRadius: 8, marginTop: 10, gap: 8, minHeight: 44 },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#1E3A8A' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
