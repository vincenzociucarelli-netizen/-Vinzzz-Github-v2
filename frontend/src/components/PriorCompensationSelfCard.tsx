/**
 * 🆕 PriorCompensationSelfCard — vista PERSONALE del pregresso (dirigente /
 * collaboratore, pagine che non usano CompensationSummaryCard).
 * Mostra importo dichiarato + stato firma e permette di firmare o VARIARE il
 * pregresso con una nuova dichiarazione firmata (la precedente resta nello
 * storico). Dopo la firma, se manca la dichiarazione previdenziale la richiede.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PriorCompensationDeclarationModal from './PriorCompensationDeclarationModal';
import PensionDeclarationModal from './PensionDeclarationModal';

interface Props {
  userFullName: string;
  contractStartDate?: string | null;
  onChanged?: () => void;
}

const fmt = (n: number) => `€ ${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PriorCompensationSelfCard({ userFullName, contractStartDate, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ signed: boolean; amount: number; signed_at?: string | null; versions?: number } | null>(null);
  const [priorOpen, setPriorOpen] = useState(false);
  const [pensionOpen, setPensionOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/me/prior-compensation/status');
      setStatus(res.data);
    } catch { setStatus(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleDeclared = async () => {
    setPriorOpen(false);
    await load();
    onChanged?.();
    try {
      const p = await api.get('/me/pension-declaration/status');
      if (!p.data?.declared) setPensionOpen(true);
    } catch { /* noop */ }
  };

  const signed = !!status?.signed;
  return (
    <View style={styles.card} testID="prior-comp-self-card">
      <View style={styles.row}>
        <Text style={{ fontSize: 14, marginRight: 6 }}>📋</Text>
        <Text style={styles.title}>Pregresso dichiarato (altre ASD/SSD, anno in corso)</Text>
      </View>
      {loading ? <ActivityIndicator color="#007AFF" /> : (
        <>
          <Text style={styles.amount}>{fmt(status?.amount || 0)}</Text>
          <Text style={[styles.badge, signed ? styles.badgeOk : styles.badgeWarn]}>
            {signed ? `✓ Firmato${status?.versions && status.versions > 1 ? ` · ${status.versions}ª dichiarazione` : ''}` : '✗ Non firmato per l\'anno in corso'}
          </Text>
          <TouchableOpacity style={[styles.btn, signed && styles.btnOutline]} onPress={() => setPriorOpen(true)} testID="prior-comp-self-btn">
            <Ionicons name={signed ? 'create-outline' : 'create'} size={16} color={signed ? '#007AFF' : '#fff'} />
            <Text style={[styles.btnText, signed && { color: '#007AFF' }]}>
              {signed ? 'Varia pregresso (nuova dichiarazione firmata)' : 'Firma Dichiarazione Pregresso'}
            </Text>
          </TouchableOpacity>
        </>
      )}
      <PriorCompensationDeclarationModal
        visible={priorOpen}
        userFullName={userFullName}
        contractStartDate={contractStartDate}
        isVariation={signed}
        currentAmount={status?.amount}
        onClose={() => setPriorOpen(false)}
        onDeclared={handleDeclared}
      />
      <PensionDeclarationModal
        visible={pensionOpen}
        userFullName={userFullName}
        onClose={() => setPensionOpen(false)}
        onDeclared={() => { setPensionOpen(false); onChanged?.(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#E8F4FD', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#007AFF', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1 },
  amount: { fontSize: 20, color: '#1F2937', fontWeight: 'bold' },
  badge: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  badgeOk: { color: '#1B5E20' },
  badgeWarn: { color: '#B45309' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1E3A8A', padding: 10, borderRadius: 8, marginTop: 10, minHeight: 44 },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#007AFF' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
