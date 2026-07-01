/**
 * 🆕 01/07/2026 — Riconferma da Archivio
 * L'admin sceglie tipo (Atleti / Coach / Collaboratori / Dirigenti) → vede la lista
 * archiviata della stagione precedente, seleziona con checkbox e clicca
 * "Riconferma per stagione corrente". Modello "clean slate": chi non viene
 * riconfermato NON appare nelle liste operative della nuova stagione.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/services/api';

type MemberType = 'athletes' | 'coach' | 'collaboratore' | 'dirigente';

interface Member {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  team_id?: string;
  team_name?: string;
  assigned_team_names?: string[];
  athlete_type?: string;
  monthly_compensation?: number;
  other_annual_compensation?: number;
  already_in_current?: boolean;
  linked_athlete_id?: string;
  qualification?: string;
}

const TYPE_LABELS: Record<MemberType, string> = {
  athletes: 'Atleti',
  coach: 'Coach',
  collaboratore: 'Collaboratori',
  dirigente: 'Dirigenti',
};

const TYPE_ICONS: Record<MemberType, string> = {
  athletes: '🏐',
  coach: '🏋️',
  collaboratore: '👷',
  dirigente: '💼',
};

export default function SeasonReconfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ season?: string }>();
  const season = String(params.season || '');
  const [type, setType] = useState<MemberType>('athletes');
  const [members, setMembers] = useState<Member[]>([]);
  const [currentSeason, setCurrentSeason] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (season) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, type]);

  const loadMembers = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const res = await api.get(`/seasons/${encodeURIComponent(season)}/members?type=${type}`);
      setMembers(res.data?.members || []);
      setCurrentSeason(res.data?.current_season || '');
    } catch (err: any) {
      Alert.alert('Errore', err?.response?.data?.detail || 'Caricamento non riuscito');
    } finally {
      setLoading(false);
    }
  };

  // Raggruppa per squadra (per atleti) o per prima squadra assegnata (per staff)
  const groups = useMemo(() => {
    const g = new Map<string, Member[]>();
    for (const m of members) {
      const key = type === 'athletes'
        ? (m.team_name || 'Nessuna squadra')
        : ((m.assigned_team_names || []).join(', ') || 'Nessuna squadra assegnata');
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(m);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [members, type]);

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleGroup = (groupMembers: Member[]) => {
    const groupSelectable = groupMembers.filter(m => !m.already_in_current);
    const allSelected = groupSelectable.every(m => selectedIds.has(m.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      groupSelectable.forEach(m => next.delete(m.id));
    } else {
      groupSelectable.forEach(m => next.add(m.id));
    }
    setSelectedIds(next);
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const body = type === 'athletes'
      ? { athlete_ids: ids, user_ids: [] }
      : { athlete_ids: [], user_ids: ids };
    const msg = `Confermi la riconferma di ${ids.length} elemento/i per la stagione ${currentSeason}?`;
    const ok = Platform.OS === 'web' ? window.confirm(msg) : await new Promise<boolean>(res => {
      Alert.alert('Riconferma', msg, [
        { text: 'Annulla', style: 'cancel', onPress: () => res(false) },
        { text: 'Riconferma', onPress: () => res(true) },
      ]);
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.post('/seasons/reconfirm-bulk', body);
      const conf = (r.data?.athletes?.confirmed || 0) + (r.data?.users?.confirmed || 0);
      const flagged = (r.data?.athletes?.pro_flagged || 0) + (r.data?.users?.pro_flagged || 0);
      const flaggedMsg = flagged > 0 ? `\n\n${flagged} risultano compensati: appariranno nelle liste con il badge rosso "Compenso da riconfermare".` : '';
      if (Platform.OS === 'web') {
        window.alert(`✅ Riconfermati ${conf} per la stagione ${currentSeason}.${flaggedMsg}`);
      } else {
        Alert.alert('Successo', `Riconfermati ${conf} per la stagione ${currentSeason}.${flaggedMsg}`);
      }
      await loadMembers();
    } catch (err: any) {
      Alert.alert('Errore', err?.response?.data?.detail || 'Riconferma non riuscita');
    } finally {
      setBusy(false);
    }
  };

  const selectableTotal = members.filter(m => !m.already_in_current).length;
  const allSelected = selectableTotal > 0 && members.every(m => m.already_in_current || selectedIds.has(m.id));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/seasons'))} data-testid="back-btn">
          <View style={styles.roundBtn}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Riconferma da {season}</Text>
          <Text style={styles.headerSub}>→ Stagione corrente {currentSeason || '…'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Type selector tabs */}
      <View style={styles.tabsRow}>
        {(['athletes', 'coach', 'collaboratore', 'dirigente'] as MemberType[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setType(t)}
            style={[styles.tab, type === t && styles.tabActive]}
            data-testid={`tab-${t}`}
          >
            <Text style={[styles.tabText, type === t && styles.tabTextActive]}>
              {TYPE_ICONS[t]} {TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Toolbar: select all + counter */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => {
            if (allSelected) setSelectedIds(new Set());
            else setSelectedIds(new Set(members.filter(m => !m.already_in_current).map(m => m.id)));
          }}
          style={styles.toolbarBtn}
          data-testid="select-all-btn"
        >
          <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={20} color="#1B5E20" />
          <Text style={styles.toolbarBtnText}>{allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}</Text>
        </TouchableOpacity>
        <Text style={styles.counterText}>
          {selectedIds.size} / {selectableTotal} selezionati
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        ) : members.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="folder-open-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>Nessun {TYPE_LABELS[type].toLowerCase()} archiviato in questa stagione.</Text>
          </View>
        ) : (
          groups.map(([groupName, groupMembers]) => {
            const groupSelectable = groupMembers.filter(m => !m.already_in_current);
            const groupAllSelected = groupSelectable.length > 0 && groupSelectable.every(m => selectedIds.has(m.id));
            return (
              <View key={groupName} style={styles.groupBox}>
                <TouchableOpacity
                  onPress={() => toggleGroup(groupMembers)}
                  style={styles.groupHeader}
                  data-testid={`group-toggle-${groupName}`}
                >
                  <Ionicons name={groupAllSelected ? 'checkbox' : 'square-outline'} size={20} color="#1B5E20" />
                  <Text style={styles.groupHeaderText}>{groupName}</Text>
                  <Text style={styles.groupHeaderCount}>{groupMembers.length}</Text>
                </TouchableOpacity>
                {groupMembers.map(m => {
                  const isChecked = selectedIds.has(m.id);
                  const isLocked = !!m.already_in_current;
                  const label = m.full_name || `${m.last_name || ''} ${m.first_name || ''}`.trim() || m.email || '—';
                  const compTag = (m.monthly_compensation || 0) > 0 || (m.other_annual_compensation || 0) > 0 ? '💰 PRO' : '';
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => !isLocked && toggleOne(m.id)}
                      disabled={isLocked}
                      style={[styles.memberRow, isLocked && styles.memberRowLocked]}
                      data-testid={`member-row-${m.id}`}
                    >
                      <Ionicons
                        name={isLocked ? 'checkmark-circle' : (isChecked ? 'checkbox' : 'square-outline')}
                        size={20}
                        color={isLocked ? '#9E9E9E' : '#1B5E20'}
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.memberName, isLocked && styles.memberNameLocked]}>
                          {label} {compTag ? <Text style={styles.memberCompTag}>{compTag}</Text> : null}
                        </Text>
                        {m.qualification ? <Text style={styles.memberSub}>🏅 {m.qualification}</Text> : null}
                        {m.email ? <Text style={styles.memberSub}>{m.email}</Text> : null}
                        {isLocked && (
                          <Text style={styles.lockedTag}>Già nella stagione {currentSeason}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Fixed footer with action */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={busy || selectedIds.size === 0}
          style={[styles.confirmBtn, (busy || selectedIds.size === 0) && styles.confirmBtnDisabled]}
          data-testid="reconfirm-bulk-btn"
        >
          <Ionicons name="checkmark-done" size={20} color="#fff" />
          <Text style={styles.confirmBtnText}>
            {busy ? 'Riconferma in corso…' : `Riconferma ${selectedIds.size} → ${currentSeason}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  roundBtn: { backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 2 },
  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab: { flex: 1, paddingVertical: 8, marginHorizontal: 3, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center' },
  tabActive: { backgroundColor: '#1B5E20' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbarBtnText: { fontSize: 13, color: '#1B5E20', fontWeight: '600' },
  counterText: { fontSize: 13, color: '#666', fontWeight: '600' },
  content: { flex: 1 },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#666', textAlign: 'center' },
  groupBox: { backgroundColor: '#fff', margin: 8, borderRadius: 10, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#E8F5E9', borderBottomWidth: 1, borderBottomColor: '#C8E6C9' },
  groupHeaderText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1B5E20' },
  groupHeaderCount: { fontSize: 12, color: '#1B5E20', backgroundColor: '#C8E6C9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  memberRowLocked: { backgroundColor: '#FAFAFA' },
  memberName: { fontSize: 14, color: '#222', fontWeight: '500' },
  memberNameLocked: { color: '#9E9E9E' },
  memberCompTag: { fontSize: 11, color: '#B8860B', fontWeight: '700' },
  memberSub: { fontSize: 11, color: '#666', marginTop: 2 },
  lockedTag: { fontSize: 10, color: '#2E7D32', marginTop: 4, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B5E20', paddingVertical: 14, borderRadius: 10 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
