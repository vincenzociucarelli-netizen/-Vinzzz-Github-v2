import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

interface DayInfo { day: number; weekday: string; is_weekend: boolean; is_training: boolean; }
interface RowInfo { athlete_id: string; name: string; cells: string[]; present: number; absent: number; }

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const CELL_W = 30;
const NAME_W = 130;

/**
 * 🆕 26/09/2026 — Griglia MENSILE presenze/assenze: nomi atlete in riga, giorni in colonna.
 * P = presente (verde), A = assente in un giorno di allenamento (rosso), vuoto = niente allenamento.
 */
export default function MonthlyAttendanceGrid({ teamId }: { teamId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [days, setDays] = useState<DayInfo[]>([]);
  const [rows, setRows] = useState<RowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/teams/${teamId}/attendance/monthly`, { params: { year, month } });
      setDays(res.data?.days || []);
      setRows(res.data?.rows || []);
    } catch (e) {
      setDays([]); setRows([]);
    } finally {
      setLoading(false);
    }
  }, [teamId, year, month]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const cellColor = (s: string) => s === 'P' ? '#E8F5E9' : s === 'A' ? '#FFEBEE' : '#FAFAFA';
  const cellText = (s: string) => s === 'P' ? '#2E7D32' : s === 'A' ? '#C62828' : '#ccc';

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} onPress={() => setOpen((v) => !v)} testID="monthly-grid-toggle">
        <Text style={styles.title}>📅 Vista mensile (presenze / assenze)</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#5856D6" />
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 10 }}>
          <View style={styles.navRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn} testID="grid-prev-month"><Ionicons name="chevron-back" size={20} color="#5856D6" /></TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn} testID="grid-next-month"><Ionicons name="chevron-forward" size={20} color="#5856D6" /></TouchableOpacity>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#E8F5E9' }]} /><Text style={styles.legendTxt}>P = presente</Text>
            <View style={[styles.legendDot, { backgroundColor: '#FFEBEE' }]} /><Text style={styles.legendTxt}>A = assente</Text>
            <View style={[styles.legendDot, { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#eee' }]} /><Text style={styles.legendTxt}>= no allenamento</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#5856D6" style={{ marginVertical: 16 }} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>Nessun dato per questo mese.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Header giorni */}
                <View style={{ flexDirection: 'row' }}>
                  <View style={[styles.nameCell, styles.headCell, { width: NAME_W }]}><Text style={styles.headTxt}>Atleta</Text></View>
                  {days.map((d) => (
                    <View key={d.day} style={[styles.dayCell, styles.headCell, d.is_weekend && { backgroundColor: '#EDE7F6' }]}>
                      <Text style={styles.dayNum}>{d.day}</Text>
                      <Text style={styles.dayWd}>{d.weekday}</Text>
                    </View>
                  ))}
                  <View style={[styles.totCell, styles.headCell]}><Text style={styles.headTxt}>P</Text></View>
                  <View style={[styles.totCell, styles.headCell]}><Text style={styles.headTxt}>A</Text></View>
                </View>
                {/* Righe atlete */}
                {rows.map((r, ri) => (
                  <View key={r.athlete_id} style={{ flexDirection: 'row', backgroundColor: ri % 2 ? '#fff' : '#F7F7FB' }}>
                    <View style={[styles.nameCell, { width: NAME_W }]}><Text style={styles.nameTxt} numberOfLines={1}>{r.name}</Text></View>
                    {r.cells.map((c, ci) => (
                      <View key={ci} style={[styles.dayCell, { backgroundColor: cellColor(c) }]}>
                        <Text style={[styles.cellTxt, { color: cellText(c) }]}>{c || '·'}</Text>
                      </View>
                    ))}
                    <View style={styles.totCell}><Text style={[styles.cellTxt, { color: '#2E7D32', fontWeight: '700' }]}>{r.present}</Text></View>
                    <View style={styles.totCell}><Text style={[styles.cellTxt, { color: '#C62828', fontWeight: '700' }]}>{r.absent}</Text></View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: '#333' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 },
  navBtn: { padding: 8, borderRadius: 8, backgroundColor: '#EDE7F6' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#5856D6', minWidth: 150, textAlign: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  legendDot: { width: 14, height: 14, borderRadius: 3 },
  legendTxt: { fontSize: 11, color: '#666', marginRight: 8 },
  empty: { fontSize: 13, color: '#999', paddingVertical: 12, textAlign: 'center' },
  headCell: { backgroundColor: '#5856D6' },
  headTxt: { color: '#fff', fontWeight: '700', fontSize: 11 },
  nameCell: { justifyContent: 'center', paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', minHeight: 34 },
  nameTxt: { fontSize: 12, fontWeight: '600', color: '#222' },
  dayCell: { width: CELL_W, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5e5' },
  dayNum: { fontSize: 11, fontWeight: '700', color: '#fff' },
  dayWd: { fontSize: 8, color: '#fff' },
  cellTxt: { fontSize: 12, fontWeight: '700' },
  totCell: { width: CELL_W + 6, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5e5', backgroundColor: '#F0F0F5' },
});
