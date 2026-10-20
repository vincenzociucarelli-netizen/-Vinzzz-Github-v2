/**
 * 🆕 Ricerca Funzioni (Command palette Admin)
 *
 * L'app è cresciuta con tante funzioni: questa schermata permette di trovarle
 * scrivendo una parte del nome del comando. Mostra DOVE si trova la funzione
 * (breadcrumb) e, per le azioni "dentro" una schermata, l'indicazione del
 * pulsante da toccare. Un tap apre la schermata giusta.
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type IconName = keyof typeof Ionicons.glyphMap;

interface Command {
  title: string;
  keywords: string;   // parole chiave extra (sinonimi, errori comuni)
  where: string;      // breadcrumb: dove si trova
  route: string;      // schermata da aprire
  icon: IconName;
  color: string;
  hint?: string;      // indicazione del pulsante da toccare (azioni "dentro" una schermata)
}

// Registro comandi. Ordinato per aree; la ricerca filtra su titolo + parole chiave + percorso.
const COMMANDS: Command[] = [
  // ——— Azioni "dentro" una schermata (le più difficili da ritrovare) ———
  {
    title: 'Ripara prove in blocco',
    keywords: 'prova scaduta allenamenti presenze ricalcola riallinea sistema aggiusta conteggio 6/3 prove certificato attiva atleta',
    where: 'Squadre › apri una squadra › Registra Presenze (manuale)',
    route: '/admin/teams',
    icon: 'construct',
    color: '#C62828',
    hint: 'Squadre → apri la squadra → tocca «Registra Presenze (manuale)»: lì in alto trovi il pulsante «Ripara prove in blocco (dalle presenze)».',
  },
  {
    title: 'Fine periodo prove',
    keywords: 'chiudi prove termina periodo prova scaduta fine trial close trials',
    where: 'Stanza dei Bottoni › Periodo di Prova',
    route: '/admin/stanza-bottoni',
    icon: 'flag',
    color: '#C62828',
    hint: 'Nella Stanza dei Bottoni, sezione "Periodo di Prova", tocca «Fine periodo prove» e conferma.',
  },
  {
    title: 'Sincronizza FIPAV',
    keywords: 'aggiorna gare risultati calendario federazione sync fipav partite',
    where: 'Stanza dei Bottoni › Calendario Gare (FIPAV)',
    route: '/admin/stanza-bottoni',
    icon: 'sync',
    color: '#EF6C00',
    hint: 'Nella Stanza dei Bottoni, sezione "Calendario Gare", tocca «Sincronizza FIPAV».',
  },
  {
    title: 'Rimuovi minori dal roster (Atleti PRO)',
    keywords: 'ripara atleti pro minorenni prime squadre roster pulisci',
    where: 'Atleti PRO / Prime Squadre',
    route: '/admin/prime-squadre',
    icon: 'build',
    color: '#B8860B',
    hint: 'In Atleti PRO tocca «🛠️ Ripara: rimuovi minori dal roster».',
  },

  // ——— Contabilità e Compensi ———
  { title: 'Riepilogo Incassi', keywords: 'incassi totali pagamenti contanti bonifico stripe pos cassa entrate', where: 'Stanza dei Bottoni › Contabilità', route: '/admin/income-summary', icon: 'pie-chart', color: '#2E7D32' },
  { title: 'Report Rimborsi', keywords: 'rimborsi refund stripe restituzioni', where: 'Stanza dei Bottoni › Contabilità', route: '/admin/refunds-report', icon: 'arrow-undo', color: '#6A1B9A' },
  { title: 'Compensi Esterni', keywords: 'compensi esterni altre societa asd ssd dichiarazioni', where: 'Stanza dei Bottoni › Contabilità', route: '/admin/external-compensations', icon: 'business', color: '#EF6C00' },
  { title: 'Dichiarazioni Previdenziali', keywords: 'previdenza inps pensione pregresso dichiarazione posizione contributi', where: 'Stanza dei Bottoni › Contabilità', route: '/admin/pension-declarations', icon: 'shield-checkmark', color: '#6D28D9' },
  { title: 'Quietanze', keywords: 'quietanza ricevute compensi pdf zip commercialista firme archivio mensile', where: 'Stanza dei Bottoni › Contabilità', route: '/admin/quietanze', icon: 'receipt', color: '#2E7D32' },
  { title: 'Storico Pagamenti', keywords: 'pagamenti quote storico incassi ricevute', where: 'Pagamenti', route: '/admin/payments-history', icon: 'card', color: '#1565C0' },
  { title: 'Importa Pagamenti', keywords: 'importa pagamenti excel csv caricamento', where: 'Pagamenti', route: '/admin/payments-import', icon: 'cloud-upload', color: '#00838F' },
  { title: 'Pagamenti Stripe', keywords: 'stripe pagamenti online carta transazioni', where: 'Pagamenti', route: '/admin/stripe-payments', icon: 'card', color: '#635BFF' },
  { title: 'Riepilogo Compensi (Report)', keywords: 'report compensi riepilogo annuale export', where: 'Report', route: '/admin/reports', icon: 'stats-chart', color: '#455A64' },

  // ——— Archivi e Consensi ———
  { title: 'Storico Presenze', keywords: 'presenze allenamenti storico archivio registro', where: 'Stanza dei Bottoni › Archivi', route: '/admin/attendances', icon: 'clipboard', color: '#1565C0' },
  { title: 'Archivio Documenti', keywords: 'documenti firmati privacy moduli pdf archivio', where: 'Stanza dei Bottoni › Archivi', route: '/admin/documents-archive', icon: 'folder-open', color: '#00838F' },
  { title: 'Riepilogo Consensi Immagini', keywords: 'consenso immagini foto privacy annuale', where: 'Stanza dei Bottoni › Archivi', route: '/admin/image-consents', icon: 'camera', color: '#AD1457' },
  { title: 'Consensi Privacy (Audit)', keywords: 'privacy gdpr consensi audit trail dispositivo accettazione', where: 'Stanza dei Bottoni › Archivi', route: '/admin/settings/consent-audit', icon: 'finger-print', color: '#2E7D32' },
  { title: 'Archivio Certificati Medici', keywords: 'certificati medici archivio scadenza visita', where: 'Certificati', route: '/admin/medical-certificates-archive', icon: 'medkit', color: '#C62828' },
  { title: 'Originali Certificati', keywords: 'originali certificati medici consegna cartaceo', where: 'Certificati', route: '/admin/certificate-originals', icon: 'document-attach', color: '#EF6C00' },

  // ——— Manutenzione Dati ———
  { title: 'Igiene Dati', keywords: 'anomalie codice fiscale duplicati orfani senza squadra manutenzione pulizia', where: 'Stanza dei Bottoni › Manutenzione', route: '/admin/data-hygiene', icon: 'medkit', color: '#C62828' },
  { title: 'Igiene Pagamenti', keywords: 'anomalie pagamenti duplicati rate importi manutenzione', where: 'Stanza dei Bottoni › Manutenzione', route: '/admin/payments-hygiene', icon: 'cash', color: '#AD1457' },
  { title: 'Diagnostica', keywords: 'diagnostica stagioni vuote conteggi debug problemi', where: 'Stanza dei Bottoni › Manutenzione', route: '/admin/diagnose', icon: 'pulse', color: '#455A64' },

  // ——— Calendario Gare ———
  { title: 'Calendario Gare', keywords: 'partite gare match calendario impegni', where: 'Dashboard', route: '/admin/matches', icon: 'calendar', color: '#EF6C00' },
  { title: 'Importa Calendario', keywords: 'importa calendario fipav federazione campionati', where: 'Stanza dei Bottoni › Calendario', route: '/admin/import-calendar', icon: 'globe', color: '#00838F' },

  // ——— Stagione (occasionali) ———
  { title: 'Nuova Stagione', keywords: 'cambio stagione nuova annata archivia apri stagione', where: 'Stanza dei Bottoni › Stagione', route: '/admin/nuova-stagione', icon: 'sparkles', color: '#6A1B9A' },
  { title: 'Riconferma Stagione', keywords: 'riconferma stagione iscritti conferma partecipazione', where: 'Stanza dei Bottoni › Stagione', route: '/admin/season-reconfirm', icon: 'refresh-circle', color: '#1565C0' },
  { title: 'Storico Stagioni', keywords: 'storico stagioni passate archivio annate', where: 'Stanza dei Bottoni › Stagione', route: '/admin/seasons', icon: 'archive', color: '#5D4037' },
  { title: 'Pre-Stagione ed Eventi', keywords: 'preiscrizioni open day tryout eventi prestagione', where: 'Dashboard', route: '/admin/preseason', icon: 'megaphone', color: '#2E7D32' },

  // ——— Anagrafiche ———
  { title: 'Atleti', keywords: 'atleti giocatori tesserati anagrafica', where: 'Dashboard', route: '/admin/athletes', icon: 'people', color: '#8E24AA' },
  { title: 'Cerca Atleta', keywords: 'cerca trova atleta nome', where: 'Dashboard', route: '/admin/athlete-search', icon: 'search', color: '#1565C0' },
  { title: 'Elenco per Squadra', keywords: 'roster elenco squadra colonne export excel lista', where: 'Dashboard', route: '/admin/team-roster', icon: 'list', color: '#1565C0' },
  { title: 'Coach', keywords: 'coach allenatori staff tecnico', where: 'Dashboard', route: '/admin/coaches', icon: 'fitness', color: '#E67E22' },
  { title: 'Collaboratori', keywords: 'collaboratori staff personale', where: 'Dashboard', route: '/admin/collaboratori', icon: 'construct', color: '#3498DB' },
  { title: 'Dirigenti e Admin', keywords: 'dirigenti admin ruoli accessi permessi', where: 'Dashboard', route: '/admin/dirigenti', icon: 'briefcase', color: '#8E44AD' },
  { title: 'Coordinatori', keywords: 'coordinatori permessi gruppi', where: 'Dashboard', route: '/admin/coordinators', icon: 'people-circle', color: '#F9A825' },
  { title: 'Genitori', keywords: 'genitori famiglie figli', where: 'Dashboard', route: '/admin/parents', icon: 'people', color: '#AD1457' },
  { title: 'Squadre', keywords: 'squadre team gruppi', where: 'Dashboard', route: '/admin/teams', icon: 'layers', color: '#2E7D32' },
  { title: 'Atleti PRO / Prime Squadre', keywords: 'atleti pro prime squadre compensati remunerati', where: 'Dashboard', route: '/admin/prime-squadre', icon: 'star', color: '#B8860B' },
  { title: 'Iscrizioni', keywords: 'iscrizioni approvazioni nuovi pending da approvare', where: 'Dashboard', route: '/admin/iscrizioni', icon: 'person-add', color: '#1976D2' },

  // ——— Comunicazioni ———
  { title: 'Solleciti WhatsApp', keywords: 'whatsapp solleciti promemoria messaggi', where: 'Dashboard', route: '/admin/whatsapp-reminders', icon: 'logo-whatsapp', color: '#25D366' },
  { title: 'Impostazioni WhatsApp', keywords: 'whatsapp impostazioni configurazione modelli', where: 'Impostazioni', route: '/admin/whatsapp-settings', icon: 'logo-whatsapp', color: '#128C7E' },
  { title: 'Notifiche', keywords: 'notifiche avvisi messaggi', where: 'Dashboard', route: '/admin/notifications', icon: 'notifications', color: '#5E35B1' },
  { title: 'Bacheca Note', keywords: 'note bacheca appunti promemoria', where: 'Dashboard', route: '/admin/notes', icon: 'reader', color: '#F9A825' },

  // ——— Scansione presenze ———
  { title: 'Scansiona Presenze (QR)', keywords: 'qr scansione presenze check-in badge', where: 'Presenze', route: '/admin/scan-attendance', icon: 'qr-code', color: '#1565C0' },

  // ——— Società e Impostazioni ———
  { title: 'Profilo Società', keywords: 'societa profilo dati contatti logo', where: 'Dashboard', route: '/admin/society-profile', icon: 'business', color: '#1565C0' },
  { title: 'Impostazioni', keywords: 'impostazioni settaggi configurazione', where: 'Header', route: '/admin/settings', icon: 'settings', color: '#455A64' },
  { title: 'Dati Società', keywords: 'societa impostazioni dati fiscali indirizzo', where: 'Impostazioni', route: '/admin/settings/society', icon: 'business', color: '#1565C0' },
  { title: 'Configura Stripe', keywords: 'stripe pagamenti online configurazione chiavi', where: 'Impostazioni', route: '/admin/settings/stripe', icon: 'card', color: '#635BFF' },
  { title: 'Cambia Email', keywords: 'cambia email account accesso', where: 'Impostazioni', route: '/admin/settings/change-email', icon: 'mail', color: '#1565C0' },
  { title: 'Esporta Dati', keywords: 'esporta dati backup download gdpr', where: 'Impostazioni', route: '/admin/settings/export-data', icon: 'download', color: '#00838F' },
  { title: 'Importa Atleti', keywords: 'importa atleti excel csv caricamento massivo', where: 'Impostazioni', route: '/admin/settings/import-athletes', icon: 'cloud-upload', color: '#2E7D32' },
  { title: 'Ripristina Backup', keywords: 'ripristina backup restore recupero dati', where: 'Impostazioni', route: '/admin/settings/restore-backup', icon: 'cloud-download', color: '#C62828' },
  { title: 'Log di Audit', keywords: 'audit log registro attivita sicurezza', where: 'Impostazioni', route: '/admin/settings/audit-logs', icon: 'list', color: '#455A64' },
  { title: 'Amministratore Principale', keywords: 'admin principale primary responsabile', where: 'Impostazioni', route: '/admin/settings/primary-admin', icon: 'shield', color: '#8E44AD' },

  // ——— Hub ———
  { title: 'Stanza dei Bottoni', keywords: 'stanza bottoni operazioni occasionali hub strumenti', where: 'Dashboard', route: '/admin/stanza-bottoni', icon: 'construct', color: '#37474F' },
  { title: 'Mappa Palestre', keywords: 'palestre palazzetti mappa campi gioco', where: 'Dashboard', route: '/palestre', icon: 'location', color: '#2E7D32' },
];

// Normalizza: minuscolo + rimuove accenti per ricerca tollerante.
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function FunctionSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return COMMANDS;
    const tokens = q.split(/\s+/).filter(Boolean);
    return COMMANDS
      .map((c) => {
        const hay = norm(`${c.title} ${c.keywords} ${c.where}`);
        // tutti i token devono comparire (ricerca AND)
        const matchesAll = tokens.every((t) => hay.includes(t));
        if (!matchesAll) return null;
        // punteggio: bonus se il titolo inizia con la query
        const titleN = norm(c.title);
        let score = 0;
        if (titleN.startsWith(q)) score += 100;
        if (titleN.includes(q)) score += 50;
        return { c, score };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.score - a!.score))
      .map((x) => x!.c);
  }, [query]);

  const open = (c: Command) => {
    router.push(c.route as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="func-search-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#90A4AE" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca una funzione…"
            placeholderTextColor="#90A4AE"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            testID="func-search-input"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#B0BEC5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.counter}>
          {query.trim()
            ? `${results.length} risultat${results.length === 1 ? 'o' : 'i'}`
            : `${COMMANDS.length} funzioni — scrivi per filtrare`}
        </Text>

        {results.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search" size={40} color="#CFD8DC" />
            <Text style={styles.emptyText}>Nessuna funzione trovata per «{query.trim()}».</Text>
            <Text style={styles.emptyHint}>{'Prova con un\'altra parola (es. prove, quietanze, incassi).'}</Text>
          </View>
        ) : (
          results.map((c, idx) => (
            <TouchableOpacity
              key={`${c.route}-${c.title}`}
              style={[styles.row, { backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F7F9FC' }]}
              onPress={() => open(c)}
              testID={`func-result-${idx}`}
            >
              <View style={[styles.iconWrap, { backgroundColor: c.color + '1A' }]}>
                <Ionicons name={c.icon} size={20} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.title}</Text>
                <View style={styles.breadcrumbRow}>
                  <Ionicons name="navigate-outline" size={11} color="#90A4AE" />
                  <Text style={styles.breadcrumb} numberOfLines={2}>{c.where}</Text>
                </View>
                {c.hint ? (
                  <View style={styles.hintBox}>
                    <Ionicons name="bulb-outline" size={12} color="#B45309" />
                    <Text style={styles.hintText}>{c.hint}</Text>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CFD8DC" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    backgroundColor: '#1565C0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 2 },
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },
  counter: { fontSize: 12, color: '#78909C', marginBottom: 8, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#263238' },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  breadcrumb: { fontSize: 12, color: '#78909C', flex: 1 },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#FFF8E1',
    borderRadius: 7,
    padding: 7,
    marginTop: 6,
  },
  hintText: { fontSize: 11.5, color: '#8A6100', flex: 1, lineHeight: 16 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { fontSize: 14, color: '#607D8B', fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 12, color: '#90A4AE', textAlign: 'center' },
});
