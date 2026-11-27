import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from './Icon';

export interface SelectablePerson {
  id: string;
  full_name: string;
}

interface Props {
  title: string;
  color?: string;
  people: SelectablePerson[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  emptyText?: string;
  helperText?: string;
  testIDPrefix?: string;
}

const getInitials = (name: string) =>
  (name || '').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

/**
 * Multi-select compatto e collassabile: mostra in riga i nomi selezionati e,
 * all'apertura, un elenco a scomparsa (con ricerca per liste lunghe) per scegliere
 * le persone. Sostituisce le lunghe liste verticali di checkbox.
 */
export default function PersonMultiSelect({
  title,
  color = '#007AFF',
  people,
  selectedIds,
  onToggle,
  emptyText = 'Nessuna persona disponibile nel sistema',
  helperText,
  testIDPrefix = 'pms',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedNames = useMemo(
    () =>
      people
        .filter((p) => selectedIds.includes(p.id))
        .map((p) => p.full_name)
        .sort((a, b) => a.localeCompare(b)),
    [people, selectedIds],
  );

  const sorted = useMemo(
    () => [...people].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [people],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [sorted, query]);

  const count = selectedIds.length;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        testID={`${testIDPrefix}-toggle`}
      >
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          {count > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: color }]}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          ) : null}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
        </View>
      </TouchableOpacity>

      {/* Riepilogo selezionati (sempre visibile) */}
      {selectedNames.length > 0 ? (
        <View style={styles.chipsWrap}>
          {selectedNames.map((n) => (
            <View key={n} style={[styles.chip, { borderColor: color }]}>
              <Text style={[styles.chipText, { color }]} numberOfLines={1}>{n}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noneText}>Nessuno selezionato</Text>
      )}

      {open ? (
        people.length > 0 ? (
          <View style={styles.listBox}>
            {sorted.length > 6 ? (
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cerca per nome…"
                  placeholderTextColor="#9CA3AF"
                  value={query}
                  onChangeText={setQuery}
                  testID={`${testIDPrefix}-search`}
                />
                {query.length > 0 ? (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            <ScrollView style={styles.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filtered.map((p) => {
                const sel = selectedIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.row, sel && styles.rowSelected]}
                    onPress={() => onToggle(p.id)}
                    testID={`${testIDPrefix}-item-${p.id}`}
                  >
                    <View style={[styles.avatar, { backgroundColor: color }]}>
                      <Text style={styles.avatarText}>{getInitials(p.full_name)}</Text>
                    </View>
                    <Text style={[styles.rowName, sel && { fontWeight: '700', color: '#111827' }]} numberOfLines={1}>
                      {p.full_name}
                    </Text>
                    <Ionicons
                      name={sel ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={sel ? color : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                );
              })}
              {filtered.length === 0 ? <Text style={styles.noneText}>Nessun risultato per “{query}”</Text> : null}
            </ScrollView>
          </View>
        ) : (
          <Text style={styles.emptyText}>{emptyText}</Text>
        )
      ) : null}

      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2, marginBottom: 2 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F8FAFC', maxWidth: '100%' },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  noneText: { fontSize: 12.5, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },
  listBox: { marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  scroll: { maxHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowSelected: { backgroundColor: '#EFF6FF' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rowName: { flex: 1, fontSize: 14, color: '#374151' },
  emptyText: { fontSize: 13, color: '#9CA3AF', marginTop: 8 },
  helper: { fontSize: 11.5, color: '#9CA3AF', marginTop: 6 },
});
