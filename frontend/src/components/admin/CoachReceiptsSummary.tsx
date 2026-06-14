/**
 * 🆕 14/06/2026 — RIEPILOGO "GIÀ PERCEPITO" PER COACH (Hub Compensi)
 *
 * Spostato dalla pagina /admin/coach/[id].tsx al Hub Compensi /admin/persona/[id]/compensi.tsx
 * Mostra:
 *  - Card cliccabile con totale percepito + numero quietanze firmate
 *  - Modal con elenco quietanze, colori per soglie cumulative (verde/arancio/viola)
 *
 * Endpoint:
 *  - GET /api/coach/{user_id}/compensation       → array quietanze
 *  - GET /api/admin/users/{user_id}/external-compensations
 *  - GET /api/admin/coach/{user_id}              → prior_compensation + contract_start_date
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, StyleSheet,
} from 'react-native';
import api from '../../services/api';
import { Ionicons } from '../Icon';
import { formatCurrency } from '../../utils/formatCurrency';

interface CoachReceiptsSummaryProps {
  /** Coach user_id (NON athlete_id) */
  coachUserId: string;
}

const MONTH_NAMES_SHORT = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export const CoachReceiptsSummary: React.FC<CoachReceiptsSummaryProps> = ({ coachUserId }) => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [externals, setExternals] = useState<any[]>([]);
  const [coach, setCoach] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!coachUserId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [recRes, extRes, coachRes] = await Promise.all([
          api.get(`/coach/${coachUserId}/compensation`).catch(() => ({ data: [] })),
          api.get(`/admin/users/${coachUserId}/external-compensations`).catch(() => ({ data: { items: [] } })),
          api.get(`/admin/coach/${coachUserId}`).catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        const recs = Array.isArray(recRes.data) ? recRes.data : (recRes.data?.records || []);
        setReceipts(recs);
        setExternals(Array.isArray(extRes.data?.items) ? extRes.data.items : []);
        setCoach(coachRes.data || null);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Errore caricamento quietanze');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [coachUserId]);

  if (loading) {
    return (
      <View style={styles.loading} testID="coach-receipts-loading">
        <ActivityIndicator size="small" color="#1976D2" />
        <Text style={styles.loadingText}>Caricamento quietanze...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.error}><Ionicons name="alert-circle" size={16} color="#C62828" /><Text style={styles.errorText}>{error}</Text></View>
    );
  }

  const signed = receipts.filter(r => r.receipt_signed);
  if (signed.length === 0) return null;

  const totalSigned = signed.reduce((sum, r) => sum + (r.amount_gross || r.amount || 0), 0);

  // Calcolo soglie cumulative (Coach + esterni dichiarati) per anno
  const priorComp = coach?.other_annual_compensation || 0;
  const contractYear = coach?.contract_start_date ? parseInt(coach.contract_start_date.split('-')[0]) : new Date().getFullYear();

  const externalByYearMonth: Record<string, number> = {};
  for (const ext of externals) {
    const y = Number(ext.year);
    const m = Number(ext.related_receipt_month || ext.month);
    if (!y || !m) continue;
    externalByYearMonth[`${y}-${m}`] = (externalByYearMonth[`${y}-${m}`] || 0) + (Number(ext.amount) || 0);
  }

  const sortedForCalc = [...signed].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const thresholdsByYear: Record<number, { first5k: number | null, first15k: number | null }> = {};
  const cumByYear: Record<number, number> = {};
  if (priorComp > 0) cumByYear[contractYear] = priorComp;
  for (const r of sortedForCalc) {
    if (!thresholdsByYear[r.year]) thresholdsByYear[r.year] = { first5k: null, first15k: null };
    if (cumByYear[r.year] === undefined) cumByYear[r.year] = r.year === contractYear ? (priorComp || 0) : 0;
    const internal = r.amount_gross || r.amount || 0;
    const external = externalByYearMonth[`${r.year}-${r.month}`] || 0;
    cumByYear[r.year] += internal + external;
    if (cumByYear[r.year] > 5000 && thresholdsByYear[r.year].first5k === null) thresholdsByYear[r.year].first5k = r.month;
    if (cumByYear[r.year] > 15000 && thresholdsByYear[r.year].first15k === null) thresholdsByYear[r.year].first15k = r.month;
  }
  const sortedForDisplay = [...signed].sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        testID="coach-receipts-card"
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardEmoji}>💰</Text>
            <View>
              <Text style={styles.cardTitle}>Già Percepito (Coach)</Text>
              <Text style={styles.cardSubtitle}>{signed.length} quietanze firmate — tocca per vedere</Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardAmount}>{formatCurrency(totalSigned)}</Text>
            <Ionicons name="chevron-forward" size={18} color="#1565C0" />
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Quietanze firmate (Coach)</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} testID="close-receipts-modal">
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 12 }}>
              <View style={styles.modalTotalBox}>
                <Text style={styles.modalTotalLabel}>💰 Totale Percepito</Text>
                <Text style={styles.modalTotalAmount}>{formatCurrency(totalSigned)}</Text>
                <Text style={styles.modalTotalSub}>{signed.length} quietanze firmate</Text>
              </View>

              {sortedForDisplay.map((receipt, idx) => {
                const t = thresholdsByYear[receipt.year] || { first5k: null, first15k: null };
                const isAfter5k = t.first5k !== null && receipt.month >= (t.first5k || 0);
                const isAfter15k = t.first15k !== null && receipt.month >= (t.first15k || 0);
                const isThreshold5kMonth = t.first5k === receipt.month;
                const isThreshold15kMonth = t.first15k === receipt.month;
                return (
                  <View
                    key={`r-${receipt.year}-${receipt.month}-${idx}`}
                    style={[styles.receiptRow, {
                      backgroundColor: isAfter15k ? '#F3E5F5' : isAfter5k ? '#FFF3E0' : '#E8F5E9',
                      borderLeftColor: isAfter15k ? '#8E44AD' : isAfter5k ? '#FF9800' : '#4CAF50',
                    }]}
                  >
                    <View style={styles.receiptLeft}>
                      <Text style={styles.receiptMonth}>{MONTH_NAMES_SHORT[receipt.month]} {receipt.year}</Text>
                      {isThreshold5kMonth && !isThreshold15kMonth && (
                        <View style={[styles.tag, { backgroundColor: '#FF9800' }]}><Text style={styles.tagText}>{'>'}5K</Text></View>
                      )}
                      {isThreshold15kMonth && (
                        <View style={[styles.tag, { backgroundColor: '#8E44AD' }]}><Text style={styles.tagText}>{'>'}15K</Text></View>
                      )}
                    </View>
                    <Text style={styles.receiptAmount}>{formatCurrency(receipt.amount_gross || receipt.amount || 0)}</Text>
                  </View>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  loadingText: { color: '#666', fontSize: 12 },
  error: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#FFEBEE', borderRadius: 8, gap: 6 },
  errorText: { color: '#C62828', fontSize: 12 },
  card: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardEmoji: { fontSize: 24 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1565C0' },
  cardSubtitle: { fontSize: 11, color: '#1976D2', marginTop: 2 },
  cardAmount: { fontSize: 17, fontWeight: '800', color: '#1565C0' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  modalTotalBox: { backgroundColor: '#E8F5E9', padding: 14, borderRadius: 10, marginBottom: 12 },
  modalTotalLabel: { color: '#2E7D32', fontWeight: '700', fontSize: 13 },
  modalTotalAmount: { color: '#2E7D32', fontWeight: '800', fontSize: 26, marginTop: 4 },
  modalTotalSub: { color: '#666', fontSize: 11, marginTop: 2 },
  receiptRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, marginBottom: 6,
    borderLeftWidth: 3,
  },
  receiptLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  receiptMonth: { fontSize: 14, fontWeight: '600', color: '#333' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  receiptAmount: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
});

export default CoachReceiptsSummary;
