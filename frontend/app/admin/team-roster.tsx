import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';
import { exportToExcel } from '../../src/utils/excelExport';

interface RosterAthlete {
  id: string;
  full_name: string;
  date_of_birth: string;
  age: number | null;
  tesserato: boolean;
  status: string;
  cert_label: string;
  cert_expiry: string;
  cert_valid: boolean;
  gender: string;
  fiscal_code: string;
  category: string;
  address: string;
  city: string;
  cap: string;
  parent_name: string;
}

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  always?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'full_name', label: 'Atleta', width: 170, always: true },
  { key: 'date_of_birth', label: 'Data di nascita', width: 120 },
  { key: 'age', label: 'Età', width: 55 },
  { key: 'tesserato', label: 'Tesserato', width: 90 },
  { key: 'cert', label: 'Certificato Medico', width: 170 },
  { key: 'category', label: 'Categoria', width: 130 },
  { key: 'address', label: 'Indirizzo', width: 190 },
  { key: 'city', label: 'Città', width: 130 },
  { key: 'cap', label: 'CAP', width: 75 },
  { key: 'gender', label: 'Genere', width: 80 },
  { key: 'fiscal_code', label: 'Codice Fiscale', width: 160 },
  { key: 'status', label: 'Stato', width: 110 },
  { key: 'parent_name', label: 'Genitore', width: 160 },
];

const DEFAULT_SELECTED = ['full_name', 'date_of_birth', 'tesserato', 'cert'];

const STATUS_LABELS: { [k: string]: string } = {
  active: 'Attivo',
  trial: 'In prova',
  pending: 'In attesa',
  pending_trial: 'In prova',
  pending_certificate: 'Attesa certificato',
  pending_approval: 'Da approvare',
  blocked: 'Bloccato',
  withdrawn: 'Ritirato',
};
const statusLabel = (s: string) => STATUS_LABELS[s] || s || '—';
const genderLabel = (g: string) => (g === 'F' ? 'F' : g === 'M' ? 'M' : g || '—');

export default function TeamRoster() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [athletes, setAthletes] = useState<RosterAthlete[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedCols, setSelectedCols] = useState<string[]>(DEFAULT_SELECTED);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') { window.alert(`${title}\n${message}`); }
    else { Alert.alert(title, message); }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/teams');
        const list = (res.data || []).map((t: any) => ({ id: t.id, name: t.name }));
        setTeams(list);
        const initial = typeof params.team_id === 'string' && params.team_id ? params.team_id : (list[0]?.id || '');
        if (initial) setSelectedTeam(initial);
      } catch (e) {
        console.error('Errore caricamento squadre', e);
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedTeam) { setAthletes([]); return; }
    setLoading(true);
    api.get('/admin/team-roster', { params: { team_id: selectedTeam } })
      .then((res) => setAthletes(res.data?.athletes || []))
      .catch((e) => { console.error('Errore roster', e); setAthletes([]); })
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  // Quando si sceglie "Tutta la società", mostra automaticamente la colonna Categoria
  useEffect(() => {
    if (selectedTeam === 'ALL') {
      setSelectedCols(prev => (prev.includes('category') ? prev : [...prev, 'category']));
    }
  }, [selectedTeam]);

  const toggleCol = (key: string) => {
    const col = COLUMNS.find(c => c.key === key);
    if (col?.always) return;
    setSelectedCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const visibleColumns = useMemo(
    () => COLUMNS.filter(c => c.always || selectedCols.includes(c.key)),
    [selectedCols]
  );

  const cellValue = (a: RosterAthlete, key: string): string => {
    switch (key) {
      case 'full_name': return a.full_name || '—';
      case 'date_of_birth': return a.date_of_birth || '—';
      case 'age': return a.age != null ? String(a.age) : '—';
      case 'tesserato': return a.tesserato ? 'Sì' : 'No';
      case 'cert': return a.cert_expiry ? `${a.cert_label} · ${a.cert_expiry}` : a.cert_label;
      case 'category': return a.category || '—';
      case 'address': return a.address || '—';
      case 'city': return a.city || '—';
      case 'cap': return a.cap || '—';
      case 'gender': return genderLabel(a.gender);
      case 'fiscal_code': return a.fiscal_code || '—';
      case 'status': return statusLabel(a.status);
      case 'parent_name': return a.parent_name || '—';
      default: return '';
    }
  };

  const handleExport = async () => {
    if (athletes.length === 0) { showAlert('Nessun dato', 'Non ci sono atleti da esportare.'); return; }
    setExporting(true);
    try {
      const rows = athletes.map(a => {
        const row: { [k: string]: any } = {};
        visibleColumns.forEach(col => { row[col.label] = cellValue(a, col.key); });
        return row;
      });
      const teamName = teams.find(t => t.id === selectedTeam)?.name || 'Squadra';
      await exportToExcel(rows, `Elenco_${teamName.replace(/\s+/g, '_')}`);
      showAlert('Successo', 'Elenco esportato in Excel.');
    } catch (e: any) {
      showAlert('Errore', e?.message || 'Esportazione non riuscita.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="roster-back-btn">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elenco per Squadra</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Team selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Squadra</Text>
          {loadingTeams ? (
            <ActivityIndicator color="#1565C0" style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedTeam} onValueChange={setSelectedTeam} style={styles.picker}>
                {teams.length === 0 && <Picker.Item label="Nessuna squadra" value="" />}
                <Picker.Item label="🏢 Tutta la società" value="ALL" />
                {teams.map(t => <Picker.Item key={t.id} label={t.name} value={t.id} />)}
              </Picker>
            </View>
          )}
        </View>

        {/* Column chooser */}
        <View style={styles.section}>
          <Text style={styles.label}>Colonne da mostrare</Text>
          <View style={styles.chipsWrap}>
            {COLUMNS.map(col => {
              const active = col.always || selectedCols.includes(col.key);
              return (
                <TouchableOpacity
                  key={col.key}
                  style={[styles.chip, active && styles.chipActive, col.always && styles.chipLocked]}
                  onPress={() => toggleCol(col.key)}
                  disabled={col.always}
                  data-testid={`col-chip-${col.key}`}
                >
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={active ? '#fff' : '#888'}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{col.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Export */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.countText}>{athletes.length} atleti</Text>
          <TouchableOpacity
            style={[styles.exportBtn, (exporting || athletes.length === 0) && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting || athletes.length === 0}
            data-testid="roster-export-btn"
          >
            {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download-outline" size={18} color="#fff" />}
            <Text style={styles.exportBtnText}>Esporta Excel</Text>
          </TouchableOpacity>
        </View>

        {/* Table */}
        {loading ? (
          <ActivityIndicator color="#1565C0" style={{ marginTop: 30 }} />
        ) : athletes.length === 0 ? (
          <Text style={styles.emptyText}>Nessun atleta in questa squadra.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 4 }}>
            <View>
              {/* Header row */}
              <View style={[styles.row, styles.headerRow]}>
                {visibleColumns.map(col => (
                  <Text key={col.key} style={[styles.cell, styles.headerCell, { width: col.width }]} numberOfLines={2}>
                    {col.label}
                  </Text>
                ))}
              </View>
              {/* Data rows */}
              {athletes.map((a, idx) => (
                <View key={a.id} style={[styles.row, idx % 2 === 1 && styles.rowAlt]}>
                  {visibleColumns.map(col => {
                    let color = '#222';
                    if (col.key === 'tesserato') color = a.tesserato ? '#2E7D32' : '#C62828';
                    if (col.key === 'cert') color = a.cert_label === 'Valido' ? '#2E7D32' : (a.cert_label === 'Mancante' || a.cert_label === 'Scaduto' ? '#C62828' : '#E65100');
                    return (
                      <Text
                        key={col.key}
                        style={[styles.cell, { width: col.width, color, fontWeight: col.key === 'full_name' ? '700' : '400' }]}
                        numberOfLines={2}
                      >
                        {cellValue(a, col.key)}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: {
    backgroundColor: '#0D47A1',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 14,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  pickerWrap: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', overflow: 'hidden',
  },
  picker: { height: Platform.OS === 'ios' ? 180 : 52, width: '100%' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0D5DD',
  },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipLocked: { backgroundColor: '#90A4AE', borderColor: '#90A4AE' },
  chipText: { fontSize: 12.5, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  countText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2E7D32', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 30, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  headerRow: { backgroundColor: '#E3F2FD', borderTopWidth: 1, borderColor: '#CFE3F5' },
  rowAlt: { backgroundColor: '#FAFBFC' },
  cell: {
    fontSize: 12.5, color: '#222', paddingHorizontal: 10, paddingVertical: 10,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#ECEFF1',
  },
  headerCell: { fontWeight: '800', color: '#0D47A1', fontSize: 12 },
});
