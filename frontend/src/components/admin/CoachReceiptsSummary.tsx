/**
 * 🆕 15/06/2026 — RIEPILOGO "GIÀ PERCEPITO" UNIFICATO (Hub Compensi)
 *
 * Mostra le quietanze firmate (Atleta + Coach) con cumulo cronologico CORRETTO:
 *  - Primo mese attivo del contratto (no mesi pre/post contratto)
 *  - Pregresso applicato al primo mese attivo SOLO se è il primo anno fiscale
 *  - Esterni distribuiti per `related_receipt_month`
 *  - Colore mese: verde <5K · arancio 5K-15K · viola >15K
 *  - Badge ">5K" / ">15K" sul mese di superamento soglia
 *
 * Endpoint:
 *  - GET /api/admin/persons/{personId}/compensation-summary  → cumulato/breakdown/esterni
 *  - GET /api/coach/{userId}/compensation                    → quietanze coach
 *  - GET /api/athletes/{athleteId}/compensation/receipts     → quietanze atleta
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, StyleSheet,
} from 'react-native';
import api from '../../services/api';
import { Ionicons } from '../Icon';
import { formatCurrency } from '../../utils/formatCurrency';
import { THRESHOLD_COLORS, getThresholdState } from '../../utils/thresholdColors';
import { calculateThresholds, type MonthAmount } from '../../utils/thresholdCalculator';

interface PersonReceiptsSummaryProps {
  personId: string;
  userId?: string | null;
  athleteId?: string | null;
}

const MONTH_NAMES_SHORT = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTH_NAMES_IT = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Normalizza il mese (può essere "Gennaio" stringa o 1 int) a numero 1-12 */
function normalizeMonth(m: any): number | null {
  if (m == null) return null;
  if (typeof m === 'number') return m >= 1 && m <= 12 ? m : null;
  const s = String(m).trim();
  const asNum = parseInt(s);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
  const idx = MONTH_NAMES_IT.findIndex(n => n.toLowerCase() === s.toLowerCase());
  return idx > 0 ? idx : null;
}

interface UnifiedReceipt {
  year: number;
  month: number;
  amount: number;
  role: 'coach' | 'athlete';
  signed_date?: string;
}

export const CoachReceiptsSummary: React.FC<PersonReceiptsSummaryProps> = ({ personId, userId, athleteId }) => {
  const [summary, setSummary] = useState<any>(null);
  const [coachRcs, setCoachRcs] = useState<any[]>([]);
  const [athleteRcs, setAthleteRcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [summaryRes, coachRes, athleteRes] = await Promise.all([
          api.get(`/admin/persons/${personId}/compensation-summary`).catch(() => ({ data: null })),
          userId
            ? api.get(`/coach/${userId}/compensation`).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          athleteId
            ? api.get(`/athletes/${athleteId}/compensation/receipts`).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        setSummary(summaryRes.data || null);
        const cr = Array.isArray(coachRes.data) ? coachRes.data : (coachRes.data?.records || []);
        setCoachRcs(cr);
        const ar = Array.isArray(athleteRes.data) ? athleteRes.data : (athleteRes.data?.records || []);
        setAthleteRcs(ar);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Errore caricamento quietanze');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [personId, userId, athleteId]);

  if (loading) {
    return (
      <View style={styles.loading} testID="receipts-loading">
        <ActivityIndicator size="small" color="#1976D2" />
        <Text style={styles.loadingText}>Caricamento quietanze...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle" size={16} color="#C62828" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Lista unificata di quietanze firmate
  const unified: UnifiedReceipt[] = [];
  for (const r of coachRcs) {
    if (!r.receipt_signed) continue;
    const m = normalizeMonth(r.month);
    if (!m || !r.year) continue;
    unified.push({
      year: Number(r.year),
      month: m,
      amount: Number(r.amount_gross || r.amount || 0),
      role: 'coach',
      signed_date: r.receipt_signed_date,
    });
  }
  for (const r of athleteRcs) {
    if (!r.signed) continue;
    const m = normalizeMonth(r.month);
    if (!m || !r.year) continue;
    unified.push({
      year: Number(r.year),
      month: m,
      amount: Number(r.amount || 0),
      role: 'athlete',
      signed_date: r.signed_date,
    });
  }

  if (unified.length === 0) return null;

  const totalSigned = unified.reduce((s, r) => s + r.amount, 0);

  // === Calcolo cumulo cronologico per ogni anno (delegato a utility condivisa) ===
  // Aggrego coach + atleta + esterni per (anno, mese), poi calcolo soglie con la
  // funzione `calculateThresholds` riusabile (stessa logica del backend `_month_breaches`).
  const monthAmounts: MonthAmount[] = [];
  const fyBlocks: Record<number, any> = {};
  if (summary?.fiscal_year_current) fyBlocks[summary.fiscal_year_current.year] = summary.fiscal_year_current;
  if (summary?.fiscal_year_next) fyBlocks[summary.fiscal_year_next.year] = summary.fiscal_year_next;

  let contractStartYear: number | undefined;
  let priorCompensation = 0;
  for (const yStr of Object.keys(fyBlocks)) {
    const y = Number(yStr);
    const block = fyBlocks[y];
    if (block.is_first_year) {
      contractStartYear = y;
      priorCompensation = block.prior_compensation || 0;
    }
    const coachBd = (y === summary?.fiscal_year_current?.year
      ? summary?.coach_section?.fiscal_year?.breakdown
      : summary?.coach_section?.fiscal_year_next?.breakdown) || [];
    const athleteBd = (y === summary?.fiscal_year_current?.year
      ? summary?.athlete_section?.fiscal_year?.breakdown
      : summary?.athlete_section?.fiscal_year_next?.breakdown) || [];
    const merged: Record<number, number> = {};
    coachBd.forEach((b: any) => { if ((b.amount || 0) > 0) merged[b.month] = (merged[b.month] || 0) + b.amount; });
    athleteBd.forEach((b: any) => { if ((b.amount || 0) > 0) merged[b.month] = (merged[b.month] || 0) + b.amount; });
    const ext = block.supplementary_by_month || {};
    Object.entries(ext).forEach(([m, a]) => {
      const mi = Number(m);
      const ai = Number(a) || 0;
      if (mi >= 1 && mi <= 12 && ai > 0) merged[mi] = (merged[mi] || 0) + ai;
    });
    Object.entries(merged).forEach(([m, a]) => {
      monthAmounts.push({ year: y, month: Number(m), amount: a });
    });
  }

  const { thresholdsByYear, cumulativeByYearMonth } = calculateThresholds({
    monthAmounts,
    priorCompensation,
    contractStartYear,
  });

  // Ordino per anno DESC, mese DESC (più recente in alto)
  const sortedDisplay = [...unified].sort((a, b) =>
    a.year !== b.year ? b.year - a.year : b.month - a.month
  );

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        testID="receipts-card"
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardEmoji}>💰</Text>
            <View>
              <Text style={styles.cardTitle}>Già Percepito</Text>
              <Text style={styles.cardSubtitle}>{unified.length} quietanze firmate — tocca per vedere</Text>
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
              <Text style={styles.modalTitle}>📋 Quietanze firmate</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} testID="close-receipts-modal">
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 12 }}>
              <View style={styles.modalTotalBox}>
                <Text style={styles.modalTotalLabel}>💰 Totale Percepito</Text>
                <Text style={styles.modalTotalAmount}>{formatCurrency(totalSigned)}</Text>
                <Text style={styles.modalTotalSub}>
                  {unified.length} quietanze firmate
                  {(coachRcs.filter(r => r.receipt_signed).length > 0 && athleteRcs.filter(r => r.signed).length > 0)
                    ? ' (Atleta + Coach)' : ''}
                </Text>
              </View>

              {sortedDisplay.map((rec, idx) => {
                const t = thresholdsByYear[rec.year] || { first5k: null, first15k: null };
                const cum = cumulativeByYearMonth[`${rec.year}-${rec.month}`] || 0;
                const state = getThresholdState(cum);
                const palette = THRESHOLD_COLORS[state];
                const isThreshold5kMonth = t.first5k === rec.month;
                const isThreshold15kMonth = t.first15k === rec.month;
                return (
                  <View
                    key={`r-${rec.year}-${rec.month}-${rec.role}-${idx}`}
                    style={[styles.receiptRow, {
                      backgroundColor: palette.background,
                      borderLeftColor: palette.accent,
                    }]}
                  >
                    <View style={styles.receiptLeft}>
                      <Text style={styles.receiptMonth}>
                        {MONTH_NAMES_SHORT[rec.month]} {rec.year}
                        <Text style={styles.receiptRole}>{rec.role === 'coach' ? '  (Coach)' : '  (Atleta)'}</Text>
                      </Text>
                      {isThreshold15kMonth && (
                        <View style={[styles.tag, { backgroundColor: THRESHOLD_COLORS.over15k.accent }]}>
                          <Text style={styles.tagText}>{'>'}15K</Text>
                        </View>
                      )}
                      {isThreshold5kMonth && !isThreshold15kMonth && (
                        <View style={[styles.tag, { backgroundColor: THRESHOLD_COLORS.between5k15k.accent }]}>
                          <Text style={styles.tagText}>{'>'}5K</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.receiptAmount}>{formatCurrency(rec.amount)}</Text>
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
  receiptRole: { fontSize: 11, color: '#777', fontWeight: '400' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  receiptAmount: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
});

export default CoachReceiptsSummary;
