/**
 * 🆕 02/10/2026 — Stanza dei Bottoni
 *
 * Hub admin che raccoglie le operazioni "occasionali" (si fanno una volta ogni tanto
 * e spesso ci si dimentica dove sono). Ogni operazione ha una breve descrizione
 * (a cosa serve / come si fa) e un pulsante che la apre o la esegue.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';

type IconName = keyof typeof Ionicons.glyphMap;

interface OpItem {
  key: string;
  icon: IconName;
  color: string;
  title: string;
  what: string;        // a cosa serve
  how: string;         // come si fa
  route?: string;      // navigazione
  action?: 'close_trials' | 'sync_fipav'; // azione diretta
  danger?: boolean;    // evidenzia operazione delicata
  badge?: string;      // es. conteggio
}

export default function StanzaBottoniScreen() {
  const router = useRouter();
  const [trialsCount, setTrialsCount] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Modale conferma "Fine periodo prove"
  const [confirmTrials, setConfirmTrials] = useState(false);
  // Modale risultato generico
  const [result, setResult] = useState<{ title: string; message: string } | null>(null);

  const loadCounts = async () => {
    try {
      const r = await api.get('/admin/trials/active-count');
      setTrialsCount(r.data?.count ?? 0);
    } catch {
      setTrialsCount(null);
    }
  };

  useEffect(() => { loadCounts(); }, []);

  const doCloseTrials = async () => {
    setConfirmTrials(false);
    setBusyKey('close_trials');
    try {
      const r = await api.post('/admin/trials/close-all');
      await loadCounts();
      setResult({
        title: 'Fine periodo prove',
        message: r.data?.message || 'Operazione completata.',
      });
    } catch (err: any) {
      setResult({
        title: 'Errore',
        message: err?.response?.data?.detail || err?.message || 'Operazione non riuscita.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const doRepairMinors = async () => {
    setBusyKey('repair_minors');
    try {
      const r = await api.post('/admin/athletes/repair-minor-flags');
      setResult({
        title: 'Riparazione minorenni',
        message: r.data?.message || 'Operazione completata.',
      });
    } catch (err: any) {
      setResult({
        title: 'Errore',
        message: err?.response?.data?.detail || err?.message || 'Operazione non riuscita.',
      });
    } finally {
      setBusyKey(null);
    }
  };


  const doSyncFipav = async () => {
    setBusyKey('sync_fipav');
    try {
      const r = await api.post('/matches/sync-fipav');
      const d = r.data || {};
      setResult({
        title: 'Sincronizzazione FIPAV',
        message: `${d.message || 'Completata.'}\n\nGare trovate sul portale: ${d.scraped_total ?? 0}`,
      });
    } catch (err: any) {
      setResult({
        title: 'Errore sincronizzazione',
        message: err?.response?.data?.detail || err?.message || 'Operazione non riuscita.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const sections: { title: string; items: OpItem[] }[] = [
    {
      title: 'Contabilità e Compensi',
      items: [
        {
          key: 'income_summary',
          icon: 'pie-chart',
          color: '#2E7D32',
          title: 'Riepilogo Incassi',
          what: 'Totali effettivamente incassati raggruppati per metodo di pagamento (contanti, bonifico, Stripe, POS…), con dettaglio mese per mese.',
          how: 'Apri, scegli il periodo (mese, anno o date personalizzate) e leggi i totali per metodo.',
          route: '/admin/income-summary',
        },
        {
          key: 'refunds_report',
          icon: 'arrow-undo',
          color: '#6A1B9A',
          title: 'Report Rimborsi',
          what: 'Elenco dei rimborsi Stripe con motivo, data e admin che li ha effettuati.',
          how: 'Apri per consultare i rimborsi ed eventualmente esportarli in CSV.',
          route: '/admin/refunds-report',
        },
        {
          key: 'external_comp',
          icon: 'business',
          color: '#EF6C00',
          title: 'Compensi Esterni',
          what: 'Riepilogo delle dichiarazioni di compenso ricevute da altre Società (ASD/SSD).',
          how: 'Apri per consultare gli importi dichiarati dai collaboratori altrove.',
          route: '/admin/external-compensations',
        },
        {
          key: 'pension_declarations',
          icon: 'shield-checkmark',
          color: '#6D28D9',
          title: 'Dichiarazioni Previdenziali',
          what: 'Posizione previdenziale e pregresso dichiarati dai collaboratori, con storico firmato.',
          how: 'Apri per consultare le dichiarazioni ed esportarle in Excel per il consulente del lavoro.',
          route: '/admin/pension-declarations',
        },
        {
          key: 'quietanze_speciali',
          icon: 'receipt',
          color: '#2E7D32',
          title: 'Quietanze',
          what: 'Gestione delle quietanze personalizzate e ARCHIVIO di tutte le quietanze firmate da coach, dirigenti, collaboratori e atleti pro, mese per mese.',
          how: 'Apri per gestire le quietanze o scaricare i PDF/ZIP mensili da consegnare al commercialista.',
          route: '/admin/quietanze',
        },
      ],
    },
    {
      title: 'Archivi e Consensi',
      items: [
        {
          key: 'attendances',
          icon: 'clipboard',
          color: '#1565C0',
          title: 'Storico Presenze',
          what: 'Consulta le presenze registrate agli allenamenti.',
          how: 'Apri per rivedere le presenze degli atleti.',
          route: '/admin/attendances',
        },
        {
          key: 'documents_archive',
          icon: 'folder-open',
          color: '#00838F',
          title: 'Archivio Documenti',
          what: 'Archivio dei documenti firmati (privacy, quietanze e altri moduli).',
          how: 'Apri per cercare e scaricare i documenti firmati.',
          route: '/admin/documents-archive',
        },
        {
          key: 'image_consents',
          icon: 'camera',
          color: '#AD1457',
          title: 'Riepilogo Consensi Annuali',
          what: 'Riepilogo dei consensi all\'uso delle immagini: chi ha dato il consenso e chi no.',
          how: 'Apri per verificare gli atleti senza consenso foto.',
          route: '/admin/image-consents',
        },
        {
          key: 'consent_audit',
          icon: 'finger-print',
          color: '#2E7D32',
          title: 'Consensi Privacy',
          what: 'Audit trail dei consensi GDPR di utenti e atleti: chi ha accettato cosa, quando e da quale dispositivo.',
          how: 'Apri per consultare e verificare lo storico dei consensi privacy.',
          route: '/admin/settings/consent-audit',
        },
      ],
    },
    {
      title: 'Calendario Gare (FIPAV)',
      items: [
        {
          key: 'import_calendar',
          icon: 'globe',
          color: '#00838F',
          title: 'Importa Calendario',
          what: 'Importa il calendario gare dalla federazione (FIPAV e altre).',
          how: 'Segui la procedura: scegli stagione, società e campionati da importare.',
          route: '/admin/import-calendar',
        },
        {
          key: 'sync_fipav',
          icon: 'sync',
          color: '#EF6C00',
          title: 'Sincronizza FIPAV',
          what: 'Aggiorna date, risultati e campi di gioco delle gare già in archivio leggendo il portale FIPAV.',
          how: 'Premi: controlla il portale e aggiorna in automatico le gare con variazioni.',
          action: 'sync_fipav',
        },
      ],
    },
    {
      title: 'Periodo di Prova',
      items: [
        {
          key: 'close_trials',
          icon: 'flag',
          color: '#C62828',
          danger: true,
          title: 'Fine periodo prove',
          what: 'Chiude in blocco TUTTE le prove ancora attive della società. Da quel momento ogni atleta deve firmare la privacy, pagare la quota concordata e inserire i dati del certificato medico (consegnando copia e poi originale alla società).',
          how: 'Premi il pulsante e conferma. L\'operazione vale per tutta la società e non riguarda chi è già attivo o ritirato.',
          action: 'close_trials',
          badge: trialsCount !== null ? `${trialsCount} in prova` : undefined,
        },
      ],
    },
    {
      title: 'Manutenzione Dati',
      items: [
        {
          key: 'data_hygiene',
          icon: 'medkit',
          color: '#C62828',
          title: 'Igiene Dati',
          what: 'Trova le anomalie negli anagrafici: codice fiscale mancante o duplicato, atleti senza squadra, minorenni senza genitore, collegamenti orfani, possibili doppioni.',
          how: 'Apri il pannello, espandi una categoria e tocca l\'atleta per correggere il dato nella sua scheda.',
          route: '/admin/data-hygiene',
        },
        {
          key: 'payments_hygiene',
          icon: 'cash',
          color: '#AD1457',
          title: 'Igiene Pagamenti',
          what: 'Individua anomalie nei pagamenti (importi, rate, duplicati).',
          how: 'Apri il report e correggi le voci segnalate.',
          route: '/admin/payments-hygiene',
        },
        {
          key: 'repair_minors',
          icon: 'people',
          color: '#1565C0',
          title: 'Ripara Minorenni',
          what: 'Ricalcola l\'etichetta minorenne/maggiorenne di tutti gli atleti dalla data di nascita. Corregge i record importati con l\'etichetta sbagliata (che impediva l\'attivazione automatica e la gestione corretta di privacy genitore e convocazioni).',
          how: 'Premi il pulsante: la correzione è automatica e sicura. Salta chi non ha una data di nascita valida.',
          action: 'repair_minors',
        },
        {
          key: 'diagnose',
          icon: 'pulse',
          color: '#455A64',
          title: 'Diagnostica',
          what: 'Verifica la distribuzione delle stagioni attive (utile se liste o archivi appaiono vuoti).',
          how: 'Apri e leggi i conteggi per atleti, squadre e utenti.',
          route: '/admin/diagnose',
        },
      ],
    },
    {
      title: 'Inizio / Fine Stagione (una volta l\'anno)',
      items: [
        {
          key: 'nuova_stagione',
          icon: 'sparkles',
          color: '#6A1B9A',
          title: 'Nuova Stagione',
          what: 'Avvia una nuova stagione sportiva archiviando i dati di quella precedente.',
          how: 'Apri e segui la procedura guidata di creazione nuova stagione.',
          route: '/admin/nuova-stagione',
        },
        {
          key: 'riconferma',
          icon: 'refresh-circle',
          color: '#1565C0',
          title: 'Riconferma Stagione',
          what: 'Chiede agli iscritti di confermare la partecipazione alla nuova stagione.',
          how: 'Avvia la riconferma: gli atleti riceveranno la richiesta di conferma.',
          route: '/admin/season-reconfirm',
        },
        {
          key: 'preseason',
          icon: 'megaphone',
          color: '#2E7D32',
          title: 'Pre-Stagione ed Eventi',
          what: 'Gestisce pre-iscrizioni, open day, tryout ed eventi prima della stagione.',
          how: 'Crea un evento e condividi il link di pre-iscrizione con le famiglie.',
          route: '/admin/preseason',
        },
        {
          key: 'seasons',
          icon: 'archive',
          color: '#5D4037',
          title: 'Storico Stagioni',
          what: 'Consulta lo storico delle stagioni passate (atleti, staff e campionati archiviati).',
          how: 'Apri per rivedere i dati delle stagioni precedenti.',
          route: '/admin/seasons',
        },
      ],
    },
  ];

  const onPressOp = (op: OpItem) => {
    if (busyKey) return;
    if (op.route) { router.push(op.route as any); return; }
    if (op.action === 'close_trials') { setConfirmTrials(true); return; }
    if (op.action === 'sync_fipav') { doSyncFipav(); return; }
    if (op.action === 'repair_minors') { doRepairMinors(); return; }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="stanza-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Stanza dei Bottoni</Text>
          <Text style={styles.headerSub}>Operazioni occasionali, tutte in un posto</Text>
        </View>
        <Ionicons name="construct" size={26} color="#fff" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {sections.map((sec) => (
          <View key={sec.title} style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            {sec.items.map((op) => (
              <TouchableOpacity
                key={op.key}
                style={[styles.card, op.danger && styles.cardDanger]}
                onPress={() => onPressOp(op)}
                activeOpacity={0.7}
                data-testid={`op-${op.key}`}
                disabled={!!busyKey}
              >
                <View style={[styles.iconWrap, { backgroundColor: op.color + '1A' }]}>
                  {busyKey === op.key
                    ? <ActivityIndicator size="small" color={op.color} />
                    : <Ionicons name={op.icon} size={24} color={op.color} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{op.title}</Text>
                    {op.badge ? (
                      <View style={styles.badge}><Text style={styles.badgeText}>{op.badge}</Text></View>
                    ) : null}
                  </View>
                  <Text style={styles.what}>{op.what}</Text>
                  <View style={styles.howRow}>
                    <Ionicons name="information-circle-outline" size={14} color="#607D8B" />
                    <Text style={styles.how}>{op.how}</Text>
                  </View>
                </View>
                {op.route ? <Ionicons name="chevron-forward" size={20} color="#B0BEC5" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Conferma Fine periodo prove */}
      <Modal visible={confirmTrials} transparent animationType="fade" onRequestClose={() => setConfirmTrials(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIcon, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="flag" size={28} color="#C62828" />
            </View>
            <Text style={styles.modalTitle}>Chiudere tutte le prove?</Text>
            <Text style={styles.modalText}>
              {trialsCount !== null
                ? `Stai per terminare il periodo di prova di ${trialsCount} ${trialsCount === 1 ? 'atleta' : 'atleti'}.`
                : 'Stai per terminare il periodo di prova di tutti gli atleti in prova.'}
              {'\n\n'}Ognuno dovrà firmare la privacy, pagare la quota concordata e inserire i dati del certificato medico. L&apos;operazione riguarda tutta la società.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.mBtn, styles.mBtnCancel]} onPress={() => setConfirmTrials(false)} data-testid="confirm-trials-cancel">
                <Text style={styles.mBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mBtnDanger]} onPress={doCloseTrials} data-testid="confirm-trials-ok">
                <Text style={styles.mBtnDangerText}>Sì, chiudi tutte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Risultato generico */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="checkmark-circle" size={30} color="#2E7D32" />
            </View>
            <Text style={styles.modalTitle}>{result?.title}</Text>
            <Text style={styles.modalText}>{result?.message}</Text>
            <TouchableOpacity style={[styles.mBtn, styles.mBtnPrimary, { alignSelf: 'stretch' }]} onPress={() => setResult(null)} data-testid="result-ok">
              <Text style={styles.mBtnPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#37474F', paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 18 : 48, paddingBottom: 18,
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#78909C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#ECEFF1',
  },
  cardDanger: { borderColor: '#FFCDD2', backgroundColor: '#FFF8F8' },
  iconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#263238' },
  badge: { backgroundColor: '#C62828', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  what: { fontSize: 13, color: '#546E7A', lineHeight: 18, marginTop: 3 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6 },
  how: { flex: 1, fontSize: 12, color: '#607D8B', fontStyle: 'italic', lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 420, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#263238', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#546E7A', lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  modalBtns: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  mBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  mBtnCancel: { backgroundColor: '#ECEFF1' },
  mBtnCancelText: { color: '#455A64', fontWeight: '700', fontSize: 15 },
  mBtnDanger: { backgroundColor: '#C62828' },
  mBtnDangerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  mBtnPrimary: { backgroundColor: '#37474F' },
  mBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
