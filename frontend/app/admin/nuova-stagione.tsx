/**
 * 🆕 08/07/2026 — Nuova Stagione: flusso a 2 step
 *
 * STEP A (una volta): admin clicca "🚀 Apri stagione X-Y" → backend archivia
 * tutto lo storico operativo + aggiorna current_season. Nessuno viene importato.
 *
 * STEP B (ripetibile per mesi): sotto compaiono 6 accordion:
 *   - Coach, Dirigenti, Collaboratori, Genitori (utenti)
 *   - Atleti (18- e 18+ quota, tutti insieme)
 *   - Atleti PRO (18+ compensati)
 * Ogni riga ha 2 bottoni: 🟢 "Importa" e ⚪ "Non riconferma".
 * Dopo la decisione la riga resta in grigio con "↩️ Annulla".
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';

type SectionKey = 'coaches' | 'dirigenti' | 'collaboratori' | 'genitori' | 'athletes' | 'athletes_pro';

interface Member {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  fiscal_code?: string;
  role?: string;
  athlete_type?: string;
  is_minor?: boolean;
  birth_date?: string;
  date_of_birth?: string;
  parent_id?: string;
  second_parent_id?: string;
  medical_certificate_expiry?: string;
  qr_code?: string;
  decision_status?: 'pending' | 'imported' | 'dismissed';
}

interface PreviewData {
  current_season: string;
  next_season: string;
  target_season: string;
  is_new_season_open: boolean;
  can_rollover: boolean;
  season_start_month: number;
  season_start_day: number;
  coaches: Member[];
  dirigenti: Member[];
  collaboratori: Member[];
  genitori: Member[];
  athletes: Member[];
  athletes_pro: Member[];
}

const SECTION_META: Record<SectionKey, { title: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  coaches:       { title: 'Coach',           icon: 'fitness',   color: '#E65100' },
  dirigenti:     { title: 'Dirigenti',       icon: 'briefcase', color: '#1565C0' },
  collaboratori: { title: 'Collaboratori',   icon: 'construct', color: '#6A1B9A' },
  genitori:      { title: 'Genitori',        icon: 'home',      color: '#00838F' },
  athletes:      { title: 'Atleti',          icon: 'people',    color: '#2E7D32' },
  athletes_pro:  { title: 'Atleti 18+ PRO',  icon: 'trophy',    color: '#B71C1C' },
};

const SECTION_ORDER: SectionKey[] = ['coaches', 'dirigenti', 'collaboratori', 'genitori', 'athletes', 'athletes_pro'];

export default function NuovaStagione() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreviewData | null>(null);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    coaches: true, dirigenti: true, collaboratori: true, genitori: true, athletes: true, athletes_pro: true,
  });
  const [openingSeason, setOpeningSeason] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const loadPreview = async () => {
    try {
      const r = await api.get('/seasons/rollover/preview');
      setData(r.data);
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Preview non disponibile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(); }, []);

  const handleOpenNewSeason = async () => {
    if (!data) return;
    if (confirmText.trim().toUpperCase() !== 'CONFERMA') {
      Alert.alert('Manca conferma', 'Digita "CONFERMA" per procedere.');
      return;
    }
    const msg = `Stai per APRIRE la stagione ${data.next_season}.\n\n• Tutta la storia operativa della ${data.current_season} verrà archiviata.\n• Nessun tesserato passa in automatico: dovrai importarli tu, uno per uno, in questa pagina.\n\nProcedere?`;
    const ok = Platform.OS === 'web'
      ? window.confirm(msg)
      : await new Promise<boolean>((res) => Alert.alert('Apri nuova stagione', msg, [
          { text: 'Annulla', style: 'cancel', onPress: () => res(false) },
          { text: 'Apri', style: 'destructive', onPress: () => res(true) },
        ]));
    if (!ok) return;
    setOpeningSeason(true);
    try {
      const r = await api.post('/seasons/open-new-season', { confirmation: 'CONFERMA' });
      Alert.alert('Stagione aperta', `Nuova stagione attiva: ${r.data.current_season}\n\nOra puoi importare i tesserati uno per uno.`);
      setConfirmText('');
      await loadPreview();
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Apertura fallita');
    } finally {
      setOpeningSeason(false);
    }
  };

  const decide = async (m: Member, action: 'import' | 'dismiss' | 'undo') => {
    if (busy[m.id]) return;
    setBusy((p) => ({ ...p, [m.id]: true }));
    try {
      if (action === 'import') {
        await api.post(`/seasons/import-member/${m.id}`);
      } else if (action === 'dismiss') {
        await api.post(`/seasons/dismiss-member/${m.id}`);
      } else {
        await api.post(`/seasons/undo-decision/${m.id}`);
      }
      await loadPreview();
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Operazione fallita');
    } finally {
      setBusy((p) => ({ ...p, [m.id]: false }));
    }
  };

  const counts = useMemo(() => {
    const res: Record<SectionKey, { total: number; pending: number; imported: number; dismissed: number }> = {
      coaches: { total: 0, pending: 0, imported: 0, dismissed: 0 },
      dirigenti: { total: 0, pending: 0, imported: 0, dismissed: 0 },
      collaboratori: { total: 0, pending: 0, imported: 0, dismissed: 0 },
      genitori: { total: 0, pending: 0, imported: 0, dismissed: 0 },
      athletes: { total: 0, pending: 0, imported: 0, dismissed: 0 },
      athletes_pro: { total: 0, pending: 0, imported: 0, dismissed: 0 },
    };
    if (!data) return res;
    (Object.keys(res) as SectionKey[]).forEach((k) => {
      const items = data[k] as Member[];
      res[k].total = items.length;
      items.forEach((m) => {
        if (m.decision_status === 'imported') res[k].imported += 1;
        else if (m.decision_status === 'dismissed') res[k].dismissed += 1;
        else res[k].pending += 1;
      });
    });
    return res;
  }, [data]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#E65100" /></View>;
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>Impossibile caricare il preview.</Text>
        <TouchableOpacity onPress={loadPreview} style={{ marginTop: 12, padding: 10, backgroundColor: '#E65100', borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Riprova</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gateBlocked = !data.can_rollover;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }} data-testid="back-btn">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🚀 Nuova Stagione</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* STEP A — Apri nuova stagione */}
      {!data.is_new_season_open ? (
        <View style={[styles.card, gateBlocked ? { backgroundColor: '#FFEBEE' } : { backgroundColor: '#FFF3E0' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name={gateBlocked ? 'lock-closed' : 'flag'} size={22} color={gateBlocked ? '#B71C1C' : '#E65100'} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: gateBlocked ? '#B71C1C' : '#E65100' }}>
              Step A — Apri la stagione {data.next_season}
            </Text>
          </View>
          {gateBlocked ? (
            <Text style={{ fontSize: 13, color: '#B71C1C', lineHeight: 20 }}>
              🔒 Puoi aprire la nuova stagione dal {String(data.season_start_day).padStart(2, '0')}/{String(data.season_start_month).padStart(2, '0')}.
              Configura la data in Impostazioni Società.
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: '#333', lineHeight: 20 }}>
                Attualmente sei nella stagione <Text style={{ fontWeight: '700' }}>{data.current_season}</Text>.{'\n'}
                Cliccando qui sotto: (1) tutto lo storico operativo verrà archiviato,{'\n'}
                (2) la stagione attiva diventa <Text style={{ fontWeight: '700' }}>{data.next_season}</Text>,{'\n'}
                (3) tutte le liste (Coach/Atleti/…) risulteranno vuote,{'\n'}
                (4) potrai importare i tesserati uno per uno con calma.
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="Digita CONFERMA per abilitare il pulsante"
                autoCapitalize="characters"
                style={styles.confirmInput}
                data-testid="open-season-confirm-input"
              />
              <TouchableOpacity
                onPress={handleOpenNewSeason}
                disabled={openingSeason || confirmText.trim().toUpperCase() !== 'CONFERMA'}
                style={[styles.openBtn, (openingSeason || confirmText.trim().toUpperCase() !== 'CONFERMA') && { backgroundColor: '#bdbdbd' }]}
                data-testid="open-new-season-btn"
              >
                {openingSeason ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="rocket" size={18} color="#fff" />
                    <Text style={styles.openBtnText}>🚀 Apri stagione {data.next_season}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: '#E8F5E9' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="checkmark-circle" size={22} color="#2E7D32" />
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#2E7D32' }}>
              ✅ Stagione {data.current_season} aperta
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#1B5E20', marginTop: 4 }}>
            Ora usa gli accordion qui sotto per importare i tesserati uno per uno. Puoi tornare in questa pagina in giorni diversi finché completi tutti.
          </Text>
        </View>
      )}

      {/* STEP B — Import individuale (visibile sempre, ma se stagione non aperta è read-only con hint) */}
      {SECTION_ORDER.map((key) => {
        const meta = SECTION_META[key];
        const items = data[key] as Member[];
        const c = counts[key];
        const isOpen = expanded[key];
        return (
          <View key={key} style={styles.section}>
            <TouchableOpacity
              style={[styles.sectionHeader, { backgroundColor: meta.color }]}
              onPress={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
              data-testid={`section-${key}`}
            >
              <Ionicons name={meta.icon} size={18} color="#fff" />
              <Text style={styles.sectionTitle}>{meta.title}</Text>
              <View style={styles.sectionCountsRow}>
                <View style={[styles.chip, { backgroundColor: '#FFC107' }]}><Text style={styles.chipText}>⏳ {c.pending}</Text></View>
                <View style={[styles.chip, { backgroundColor: '#4CAF50' }]}><Text style={styles.chipText}>✅ {c.imported}</Text></View>
                <View style={[styles.chip, { backgroundColor: '#9E9E9E' }]}><Text style={styles.chipText}>🚫 {c.dismissed}</Text></View>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
            </TouchableOpacity>
            {isOpen && (
              <View>
                {items.length === 0 ? (
                  <Text style={{ padding: 12, color: '#999', fontStyle: 'italic' }}>Nessun tesserato in questa categoria.</Text>
                ) : (
                  items.map((m) => {
                    const name = m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || '—';
                    const isMinor = m.is_minor;
                    const status = m.decision_status || 'pending';
                    const meta2 = key === 'athletes' && isMinor
                      ? [
                          m.parent_id ? '👨 gen.1' : null,
                          m.second_parent_id ? '👩 gen.2' : null,
                          m.medical_certificate_expiry ? `⚕️ ${m.medical_certificate_expiry.split('T')[0]}` : null,
                          m.qr_code ? '🔗 QR' : null,
                        ].filter(Boolean).join(' · ')
                      : (m.fiscal_code || m.email || '');
                    return (
                      <View key={m.id} style={[styles.item, status !== 'pending' && styles.itemGrey]} data-testid={`row-${m.id}`}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemName, status !== 'pending' && styles.textGrey]}>
                            {status === 'imported' ? '✅ ' : status === 'dismissed' ? '🚫 ' : ''}{name}
                            {key === 'athletes' && isMinor ? <Text style={{ fontSize: 10, color: '#F57C00' }}>  · minorenne</Text> : null}
                          </Text>
                          {!!meta2 && <Text style={[styles.itemMeta, status !== 'pending' && styles.textGrey]}>{meta2}</Text>}
                        </View>
                        {!data.is_new_season_open ? (
                          <Text style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>Apri prima la stagione</Text>
                        ) : status === 'pending' ? (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => decide(m, 'import')}
                              disabled={!!busy[m.id]}
                              style={[styles.actionBtn, { backgroundColor: '#2E7D32' }]}
                              data-testid={`import-btn-${m.id}`}
                            >
                              {busy[m.id] ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                  <Ionicons name="arrow-forward-circle" size={14} color="#fff" />
                                  <Text style={styles.actionText}>Importa</Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => decide(m, 'dismiss')}
                              disabled={!!busy[m.id]}
                              style={[styles.actionBtn, { backgroundColor: '#757575' }]}
                              data-testid={`dismiss-btn-${m.id}`}
                            >
                              <Ionicons name="close-circle" size={14} color="#fff" />
                              <Text style={styles.actionText}>Non riconferma</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => decide(m, 'undo')}
                            disabled={!!busy[m.id]}
                            style={[styles.actionBtn, { backgroundColor: '#455A64' }]}
                            data-testid={`undo-btn-${m.id}`}
                          >
                            <Ionicons name="arrow-undo" size={14} color="#fff" />
                            <Text style={styles.actionText}>Annulla</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#B71C1C', paddingHorizontal: 8, paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  card: {
    margin: 12, padding: 16, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#E65100',
  },
  confirmInput: {
    borderWidth: 2, borderColor: '#E65100', borderRadius: 8, padding: 10, fontSize: 14,
    fontWeight: '700', color: '#E65100', backgroundColor: '#fff', marginTop: 12, textAlign: 'center',
  },
  openBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E65100', padding: 12, borderRadius: 8,
  },
  openBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  section: {
    marginHorizontal: 12, marginBottom: 10, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1, marginLeft: 4 },
  sectionCountsRow: { flexDirection: 'row', gap: 4 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  chipText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  item: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  itemGrey: { backgroundColor: '#f9f9f9', opacity: 0.7 },
  itemName: { fontWeight: '700', color: '#222', fontSize: 13 },
  itemMeta: { fontSize: 11, color: '#777', marginTop: 2 },
  textGrey: { color: '#999' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 11 },
});
