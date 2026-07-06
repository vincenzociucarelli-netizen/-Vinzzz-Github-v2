/**
 * 🆕 06/07/2026 — Nuova Stagione: rollover atomico
 *
 * Sostituisce il vecchio flusso Riconferma Bulk / Backfill / Reset per-utente.
 * L'admin dopo la data `season_start_month/day` configurata nelle impostazioni
 * società può:
 *   1. Vedere TUTTI i tesserati raggruppati per ruolo (5 accordion)
 *   2. Spuntare/deselezionare chi importare nella nuova stagione
 *   3. Confermare digitando "CONFERMA" e cliccare il pulsante rosso
 *
 * L'endpoint `/seasons/rollover` esegue atomicamente:
 *   - Archivia tutto lo storico stagione precedente (is_previous_season: true)
 *   - Per i selezionati: mantiene SOLO anagrafica (adulti) o anagrafica + genitori
 *     + certificato medico + qr_code (minorenni). Tutto il resto ripartito da zero.
 *   - Aggiorna current_season
 *
 * Nessun banner, nessun snapshot temporaneo, nessuna riconferma successiva richiesta.
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
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';

type SectionKey = 'coaches' | 'dirigenti' | 'collaboratori' | 'athletes_adult' | 'athletes_minor';

interface Member {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  fiscal_code?: string;
  role?: string;
  status?: string;
  birth_date?: string;
  date_of_birth?: string;
  parent_id?: string;
  second_parent_id?: string;
  medical_certificate_expiry?: string;
  qr_code?: string;
}

interface PreviewData {
  current_season: string;
  next_season: string;
  can_rollover: boolean;
  season_start_month: number;
  season_start_day: number;
  coaches: Member[];
  dirigenti: Member[];
  collaboratori: Member[];
  athletes_adult: Member[];
  athletes_minor: Member[];
}

const SECTION_META: Record<SectionKey, { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; kind: 'user' | 'athlete' }> = {
  coaches:         { title: 'Coach',              icon: 'fitness',           color: '#E65100', kind: 'user' },
  dirigenti:       { title: 'Dirigenti',          icon: 'briefcase',         color: '#1565C0', kind: 'user' },
  collaboratori:   { title: 'Collaboratori',      icon: 'construct',         color: '#6A1B9A', kind: 'user' },
  athletes_adult:  { title: 'Atleti maggiorenni', icon: 'person',            color: '#2E7D32', kind: 'athlete' },
  athletes_minor:  { title: 'Atleti minorenni',   icon: 'people',            color: '#F57C00', kind: 'athlete' },
};

const SECTION_ORDER: SectionKey[] = ['coaches', 'dirigenti', 'collaboratori', 'athletes_adult', 'athletes_minor'];

export default function NuovaStagione() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreviewData | null>(null);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    coaches: true, dirigenti: true, collaboratori: true, athletes_adult: true, athletes_minor: true,
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const r = await api.get('/seasons/rollover/preview');
      setData(r.data);
      // Pre-seleziona tutti di default
      const initial: Record<string, boolean> = {};
      (['coaches', 'dirigenti', 'collaboratori', 'athletes_adult', 'athletes_minor'] as SectionKey[]).forEach((k) => {
        (r.data[k] as Member[]).forEach((m) => { initial[m.id] = true; });
      });
      setSelected(initial);
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Preview non disponibile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(); }, []);

  const toggleAll = (section: SectionKey, value: boolean) => {
    if (!data) return;
    const items = data[section] as Member[];
    setSelected((prev) => {
      const next = { ...prev };
      items.forEach((m) => { next[m.id] = value; });
      return next;
    });
  };

  const counts = useMemo(() => {
    const res: Record<SectionKey, { total: number; sel: number }> = {
      coaches: { total: 0, sel: 0 },
      dirigenti: { total: 0, sel: 0 },
      collaboratori: { total: 0, sel: 0 },
      athletes_adult: { total: 0, sel: 0 },
      athletes_minor: { total: 0, sel: 0 },
    };
    if (!data) return res;
    (Object.keys(res) as SectionKey[]).forEach((k) => {
      const items = data[k] as Member[];
      res[k].total = items.length;
      res[k].sel = items.filter((m) => selected[m.id]).length;
    });
    return res;
  }, [data, selected]);

  const totalSelected = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  const handleSubmit = async () => {
    if (!data) return;
    if (confirmText.trim().toUpperCase() !== 'CONFERMA') {
      Alert.alert('Manca conferma', 'Digita "CONFERMA" nel campo in basso per procedere.');
      return;
    }
    const selected_user_ids: string[] = [];
    const selected_athlete_ids: string[] = [];
    (['coaches', 'dirigenti', 'collaboratori'] as SectionKey[]).forEach((k) => {
      (data[k] as Member[]).forEach((m) => { if (selected[m.id]) selected_user_ids.push(m.id); });
    });
    (['athletes_adult', 'athletes_minor'] as SectionKey[]).forEach((k) => {
      (data[k] as Member[]).forEach((m) => { if (selected[m.id]) selected_athlete_ids.push(m.id); });
    });

    const msg = `Stai per passare dalla stagione ${data.current_season} alla ${data.next_season}.\n\n• Importa (solo anagrafica): ${selected_user_ids.length + selected_athlete_ids.length} tesserati\n• Archivia in sola lettura: tutti gli altri + tutta la storia operativa (compensi, contratti, quietanze, presenze)\n\nProcedere?`;
    const ok = Platform.OS === 'web'
      ? window.confirm(msg)
      : await new Promise<boolean>((res) => Alert.alert('Rollover stagione', msg, [
          { text: 'Annulla', style: 'cancel', onPress: () => res(false) },
          { text: 'Procedi', style: 'destructive', onPress: () => res(true) },
        ]));
    if (!ok) return;
    setSubmitting(true);
    try {
      const r = await api.post('/seasons/rollover', {
        selected_user_ids,
        selected_athlete_ids,
        confirmation: 'CONFERMA',
      });
      Alert.alert('Rollover completato',
        `Da ${r.data.from_season} → ${r.data.to_season}\n\nImportati: ${r.data.users_imported} utenti + ${r.data.athletes_imported} atleti.`);
      router.replace('/admin');
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Rollover fallito');
    } finally {
      setSubmitting(false);
    }
  };

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

  const disabled = !data.can_rollover;

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

      {/* Banner data-gate */}
      <View style={[styles.banner, disabled ? styles.bannerDisabled : styles.bannerReady]}>
        <Ionicons name={disabled ? 'lock-closed' : 'unlock'} size={20} color={disabled ? '#B71C1C' : '#2E7D32'} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.bannerTitle, { color: disabled ? '#B71C1C' : '#2E7D32' }]}>
            {disabled
              ? `🔒 Rollover disponibile dal ${data.season_start_day.toString().padStart(2, '0')}/${data.season_start_month.toString().padStart(2, '0')}`
              : `Pronto per il passaggio: ${data.current_season} → ${data.next_season}`}
          </Text>
          <Text style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
            {disabled
              ? 'La data di inizio stagione è configurata nelle Impostazioni Società. Torna dopo il primo giorno di stagione.'
              : 'Spunta chi vuoi importare nella nuova stagione (di default: tutti). Verrà mantenuta SOLO l\u2019anagrafica (per minorenni anche genitori, certificato medico, QR). Il resto ripartira\u2019 da zero.'}
          </Text>
        </View>
      </View>

      {/* Sezioni */}
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
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{c.sel} / {c.total}</Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
            </TouchableOpacity>
            {isOpen && (
              <View>
                {items.length === 0 ? (
                  <Text style={{ padding: 12, color: '#999', fontStyle: 'italic' }}>Nessun tesserato in questa categoria.</Text>
                ) : (
                  <>
                    <View style={styles.bulkRow}>
                      <TouchableOpacity onPress={() => toggleAll(key, true)} data-testid={`select-all-${key}`}>
                        <Text style={styles.bulkLink}>Seleziona tutti</Text>
                      </TouchableOpacity>
                      <Text style={{ color: '#ccc' }}> | </Text>
                      <TouchableOpacity onPress={() => toggleAll(key, false)} data-testid={`deselect-all-${key}`}>
                        <Text style={styles.bulkLink}>Deseleziona tutti</Text>
                      </TouchableOpacity>
                    </View>
                    {items.map((m) => {
                      const isSel = !!selected[m.id];
                      const name = m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || '—';
                      const meta2 = key === 'athletes_minor'
                        ? [
                            m.parent_id ? '👨 gen.1' : null,
                            m.second_parent_id ? '👩 gen.2' : null,
                            m.medical_certificate_expiry ? `⚕️ ${m.medical_certificate_expiry.split('T')[0]}` : null,
                            m.qr_code ? '🔗 QR' : null,
                          ].filter(Boolean).join(' · ')
                        : (m.fiscal_code || m.email || '');
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.item, isSel && styles.itemSelected]}
                          onPress={() => setSelected((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          data-testid={`row-${m.id}`}
                        >
                          <Ionicons
                            name={isSel ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSel ? meta.color : '#bbb'}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={{ fontWeight: '700', color: '#222' }}>{name}</Text>
                            {!!meta2 && <Text style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{meta2}</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Footer conferma */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Digita <Text style={{ fontWeight: '900' }}>CONFERMA</Text> per procedere:</Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="CONFERMA"
          autoCapitalize="characters"
          style={styles.confirmInput}
          editable={!disabled && !submitting}
          data-testid="confirm-input"
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={disabled || submitting || confirmText.trim().toUpperCase() !== 'CONFERMA'}
          style={[
            styles.submitBtn,
            (disabled || submitting || confirmText.trim().toUpperCase() !== 'CONFERMA') && styles.submitBtnDisabled,
          ]}
          data-testid="rollover-submit-btn"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="rocket" size={18} color="#fff" />
              <Text style={styles.submitText}>Conferma passaggio a {data.next_season}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: '#777', marginTop: 8, textAlign: 'center' }}>
          Importi selezionati: {totalSelected}. Gli altri restano archiviati in sola lettura.
        </Text>
      </View>
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
  banner: {
    flexDirection: 'row', alignItems: 'flex-start',
    margin: 12, padding: 14, borderRadius: 10, borderLeftWidth: 4,
  },
  bannerDisabled: { backgroundColor: '#FFEBEE', borderLeftColor: '#B71C1C' },
  bannerReady:    { backgroundColor: '#E8F5E9', borderLeftColor: '#2E7D32' },
  bannerTitle: { fontSize: 14, fontWeight: '700' },
  section: {
    marginHorizontal: 12, marginBottom: 10, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
  },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1, marginLeft: 6 },
  sectionCount: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionCountText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bulkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  bulkLink: { color: '#1565C0', fontSize: 12, fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  itemSelected: { backgroundColor: '#fffbf0' },
  footer: { margin: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  footerLabel: { fontSize: 13, color: '#333', marginBottom: 8 },
  confirmInput: {
    borderWidth: 2, borderColor: '#B71C1C', borderRadius: 8, padding: 12, fontSize: 15,
    fontWeight: '700', color: '#B71C1C', backgroundColor: '#fff', marginBottom: 12, textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#B71C1C', padding: 14, borderRadius: 10,
  },
  submitBtnDisabled: { backgroundColor: '#999' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
