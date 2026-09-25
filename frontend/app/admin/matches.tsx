import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { championshipColor } from '../../src/utils/championshipColor';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../src/services/api';
import { MultiStepTutorial, TutorialStep } from '../../src/components/MultiStepTutorial';
import { Ionicons } from '../../src/components/Icon';
import { SportIcon } from '../../src/components/SportIcon';
import { downloadMatchCalendarPDF, MatchRow, TeamGroup } from '../../src/utils/matchCalendarReport';

import * as XLSX from 'xlsx';

interface Match {
  id: string;
  team_id: string;
  team_name: string;
  match_number?: string;
  date: string;
  opponent: string;
  venue: string;
  address?: string;
  city?: string;
  home_away: string;
  meeting_time?: string;
  notes?: string;
  result?: string;
}

interface Team {
  id: string;
  name: string;
}

export default function AdminMatches() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Home team modal state
  const [homeTeamModalVisible, setHomeTeamModalVisible] = useState(false);
  const [homeTeamName, setHomeTeamName] = useState('');
  const [pendingImportData, setPendingImportData] = useState<any[]>([]);
  // 🆕 Squadra selezionata manualmente per l'import (evita il match fragile su CampionatoNome)
  const [importTeamId, setImportTeamId] = useState('');

  // FIPAV sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResultVisible, setSyncResultVisible] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Filter state
  const [filterMode, setFilterMode] = useState<'upcoming' | 'played' | 'all'>('upcoming');

  // 🆕 24/09/2026 — Opzioni export Excel: squadra + casa/trasferta + stato
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportTeamId, setExportTeamId] = useState<string>('all');
  const [exportHomeAway, setExportHomeAway] = useState<'all' | 'home' | 'away'>('all');
  const [exportStatus, setExportStatus] = useState<'all' | 'upcoming' | 'played'>('all');

  // 🆕 24/09/2026 — Info società per intestazione PDF (nome + logo)
  const [societyInfo, setSocietyInfo] = useState<{ name: string; logo: string | null }>({ name: '', logo: null });

  // Multi-step info tutorial (mostrato al tap di "Info & tutorial")
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const TUTORIAL_STEPS: TutorialStep[] = [
    {
      icon: 'calendar', iconColor: '#fff', iconBg: '#007AFF',
      title: 'Benvenuto nel Calendario Gare',
      description: 'Qui gestisci tutte le partite delle tue squadre. Hai 4 modi per aggiungerle:\n\n📥 Importa da Excel\n🔄 Sincronizza da FIPAV\n➕ Aggiungi manualmente\n📋 Scarica il template',
    },
    {
      icon: 'share-outline', iconColor: '#fff', iconBg: '#34C759',
      title: '1. Scarica il Template Excel',
      description: 'Tocca il pulsante verde "Template" per scaricare un file Excel di esempio già pronto.\n\nCompilalo con le tue gare seguendo le colonne (data, squadra, avversario, orario, palestra) e poi ricaricalo nell\'app.',
    },
    {
      icon: 'cloud-upload-outline', iconColor: '#fff', iconBg: '#007AFF',
      title: '2. Importa le tue gare',
      description: 'Tocca l\'icona ☁️ in alto a destra per caricare il file Excel.\n\n💡 Importa o aggiorna: se ricarichi lo stesso file dopo che la federazione ha cambiato le date, le gare con stesso numero vengono aggiornate, le nuove aggiunte.',
    },
    {
      icon: 'sync-outline', iconColor: '#fff', iconBg: '#FF6F00',
      title: '3. Sincronizza da FIPAV',
      description: 'Tocca l\'icona 🔄 arancione per importare automaticamente il calendario ufficiale dalla FIPAV.\n\nNessun file Excel da gestire, le gare si aggiornano da sole quando la federazione cambia date.',
    },
    {
      icon: 'add-circle', iconColor: '#fff', iconBg: '#007AFF',
      title: '4. Aggiungi manualmente',
      description: 'Tocca il pulsante + in alto a destra per inserire una singola gara a mano.\n\nUtile per amichevoli, tornei o quando devi correggere una gara importata.',
    },
    {
      icon: 'options', iconColor: '#fff', iconBg: '#9C27B0',
      title: 'Filtri e visualizzazione',
      description: 'Usa i 3 tab in alto per filtrare:\n\n⏰ Da disputare — solo le gare future\n🏆 Giocate — solo le gare già fatte\n📋 Tutte — l\'elenco completo\n\nTocca una gara per modificarla o cancellarla.',
    },
  ];

  // Carica nome squadra di casa salvato (per evitare di doverlo riscrivere ad ogni re-import)
  useEffect(() => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('lastHomeTeamName');
        if (saved) setHomeTeamName(saved);
      }
    } catch {}
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    team_id: '',
    date: '',
    time: '',
    opponent: '',
    venue: '',
    address: '',
    city: '',
    home_away: 'home',
    meeting_time: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [matchesRes, teamsRes] = await Promise.all([
        api.get('/matches'),
        api.get('/teams'),
      ]);
      setMatches(matchesRes.data);
      setTeams(teamsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Carica nome + logo società per l'intestazione del PDF (best-effort)
    api.get('/settings/society?include_images=true')
      .then((res) => setSocietyInfo({ name: res.data?.name || '', logo: res.data?.logo || null }))
      .catch(() => {});
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSyncFipav = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/matches/sync-fipav');
      setSyncResult(response.data);
      setSyncResultVisible(true);
      loadData(); // Reload matches after sync
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la sincronizzazione FIPAV');
    } finally {
      setSyncing(false);
    }
  };

  // 🆕 29/07/2026 — Esporta calendario completo società in .ics
  const handleExportIcs = async () => {
    try {
      const res = await api.get('/matches', { params: { format: 'ics' }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/calendar' });
      if (Platform.OS === 'web') {
        // @ts-ignore
        const url = URL.createObjectURL(blob);
        // @ts-ignore
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gare_societa.ics';
        // @ts-ignore
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile esportare il calendario');
    }
  };

  // 🆕 06/09/2026 — Esporta le gare (Excel/PDF)
  // 🆕 24/09/2026 — filtri: squadra (tutte/singola), casa/trasferta, stato
  //             + un foglio/sezione per ogni squadra e un riepilogo generale

  // Filtra + ordina le gare in base ai filtri correnti dell'export
  const getExportList = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matches.filter((match) => {
      if (exportTeamId !== 'all' && match.team_id !== exportTeamId) return false;
      if (exportHomeAway !== 'all' && (match.home_away || 'home') !== exportHomeAway) return false;
      const matchDate = new Date(match.date);
      matchDate.setHours(0, 0, 0, 0);
      const hasResult = match.result && match.result.trim() !== '' && match.result !== '-';
      if (exportStatus === 'upcoming') return matchDate >= today && !hasResult;
      if (exportStatus === 'played') return hasResult || matchDate < today;
      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return exportStatus === 'played' ? dateB - dateA : dateA - dateB;
    });
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return { dataStr: '', oraStr: '' };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { dataStr: '', oraStr: '' };
    // 🆕 24/09/2026 — timeZone:'UTC' OBBLIGATORIO: l'app memorizza l'orario gara come
    // "wall-clock" UTC e lo mostra sempre con timeZone:'UTC' (vedi formatDate della lista).
    // Senza questo, l'export Excel/PDF mostrerebbe l'orario spostato del fuso del browser
    // (es. 21:00 → 23:00 a Roma). Così l'orario esportato coincide con quello mostrato.
    return {
      dataStr: d.toLocaleDateString('it-IT', { timeZone: 'UTC' }),
      oraStr: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    };
  };

  // Descrizione dei filtri applicati (per sottotitolo PDF / nome file)
  const exportSubtitle = () => {
    const teamLbl = exportTeamId === 'all'
      ? 'Tutta la società'
      : (teams.find((t) => t.id === exportTeamId)?.name || 'Squadra');
    const haLbl = exportHomeAway === 'home' ? 'Solo casa' : exportHomeAway === 'away' ? 'Solo trasferta' : 'Casa e trasferta';
    const stLbl = exportStatus === 'upcoming' ? 'Da disputare' : exportStatus === 'played' ? 'Giocate' : 'Tutte le gare';
    return `${teamLbl} · ${haLbl} · ${stLbl}`;
  };

  const exportFileName = () => {
    const teamLabel = exportTeamId === 'all'
      ? 'societa'
      : (teams.find((t) => t.id === exportTeamId)?.name || 'squadra').replace(/[^a-zA-Z0-9]+/g, '_');
    const haLabel = exportHomeAway === 'home' ? '_casa' : exportHomeAway === 'away' ? '_trasferta' : '';
    return `calendario_${teamLabel}${haLabel}`;
  };

  // Raggruppa le gare filtrate per squadra (rispettando l'ordinamento globale)
  const groupByTeam = (list: Match[]) => {
    const order: string[] = [];
    const map: { [name: string]: Match[] } = {};
    list.forEach((m) => {
      const name = m.team_name || 'Senza squadra';
      if (!map[name]) { map[name] = []; order.push(name); }
      map[name].push(m);
    });
    return order.map((name) => ({ name, items: map[name] }));
  };

  const handleExportExcel = async () => {
    try {
      const list = getExportList();
      if (!list || list.length === 0) {
        Alert.alert('Nessuna gara', 'Non ci sono gare da esportare per i filtri selezionati.');
        return;
      }

      // 🆕 25/09/2026 — Passati a ExcelJS per: colore intestazione DIVERSO per ogni foglio
      // squadra + LOGO società in cima al foglio Riepilogo (come nel PDF).
      const ExcelJS = (await import('exceljs')).default;

      // 🆕 26/09/2026 — Ordine colonne richiesto dall'utente:
      //  1) N° progressivo  2) Data (estesa, es. "Sabato 26 settembre 2026")
      //  3) Ora (HH:mm)  4) Casa/Trasferta  → poi il resto invariato.
      const SUMMARY_COLS: [string, number][] = [
        ['#', 5], ['Data', 26], ['Ora', 8], ['Casa/Trasferta', 13],
        ['Squadra', 16], ['Campionato/Gara', 14], ['Avversario', 24], ['Impianto', 26],
        ['Indirizzo', 30], ['Città', 16], ['Ritrovo', 10], ['Risultato', 12], ['Note', 20],
      ];
      const TEAM_COLS: [string, number][] = SUMMARY_COLS.filter(([h]) => h !== 'Squadra');

      // Data in formato esteso italiano con iniziale maiuscola (timeZone UTC = wall-clock salvato)
      const fmtDateExtended = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        return s.charAt(0).toUpperCase() + s.slice(1);
      };

      const matchToArray = (m: Match, cols: [string, number][], num: number) => {
        const { oraStr } = fmtDate(m.date);
        const map: { [k: string]: string } = {
          '#': String(num),
          'Squadra': m.team_name || '',
          'Campionato/Gara': m.match_number || '',
          'Casa/Trasferta': m.home_away === 'home' ? 'Casa' : 'Trasferta',
          'Avversario': m.opponent || '',
          'Data': fmtDateExtended(m.date),
          'Ora': oraStr,
          'Impianto': m.venue || '',
          'Indirizzo': m.address || '',
          'Città': m.city || '',
          'Ritrovo': m.meeting_time || '',
          'Risultato': m.result || '',
          'Note': m.notes || '',
        };
        return cols.map(([h]) => map[h] ?? '');
      };

      // Palette colori intestazione: un colore diverso per ogni foglio squadra
      const HEADER_PALETTE = [
        'FF1F3864', 'FF7030A0', 'FFC00000', 'FF1F7A3D', 'FFB35C00',
        'FF0B6E99', 'FF7A1F52', 'FF385723', 'FF9C4A00', 'FF1B5E7A',
      ];
      const ALT_FILL = 'FFF2F2F2';
      const BORDER = { style: 'thin' as const, color: { argb: 'FFD9D9D9' } };

      const wb = new ExcelJS.Workbook();
      const groups = groupByTeam(list);
      const usedNames: { [k: string]: number } = {};
      const safeSheetName = (raw: string) => {
        let n = (raw || 'Foglio').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 28) || 'Foglio';
        if (usedNames[n] != null) { usedNames[n] += 1; n = `${n.slice(0, 25)} ${usedNames[n]}`; }
        else usedNames[n] = 0;
        return n;
      };

      // Normalizza il logo: rileva il TIPO dai byte (magic base64) così l'estensione
      // dichiarata coincide SEMPRE con i byte reali (altrimenti Excel segnala il file
      // come danneggiato → "ripristino del disegno"). Se il tipo non è riconosciuto
      // si salta il logo (la tabella resta comunque corretta).
      const logoInfo = (() => {
        const raw = societyInfo.logo;
        if (!raw) return null;
        // estrai il base64 puro (senza eventuale prefisso data:)
        const b64 = raw.startsWith('data:') ? (raw.split(',')[1] || '') : raw;
        if (!b64) return null;
        let ext: 'png' | 'jpeg' | 'gif' | null = null;
        if (b64.startsWith('iVBORw0KGgo')) ext = 'png';        // PNG signature
        else if (b64.startsWith('/9j/')) ext = 'jpeg';          // JPEG signature
        else if (b64.startsWith('R0lGOD')) ext = 'gif';         // GIF signature
        else if (/image\/png/i.test(raw)) ext = 'png';
        else if (/image\/jpe?g/i.test(raw)) ext = 'jpeg';
        else if (/image\/gif/i.test(raw)) ext = 'gif';
        if (!ext) return null; // tipo non supportato/sconosciuto → niente logo
        return { b64, ext };
      })();

      const buildSheet = (
        name: string,
        cols: [string, number][],
        rows: string[][],
        headerArgb: string,
        withLogo: boolean,
      ) => {
        const ws = wb.addWorksheet(safeSheetName(name));
        ws.columns = cols.map(([, w]) => ({ width: w }));

        let headerRowIdx = 1;
        // Logo (+ nome società) in cima, solo dove richiesto
        if (withLogo && logoInfo) {
          try {
            const imgId = wb.addImage({ base64: logoInfo.b64, extension: logoInfo.ext });
            ws.addImage(imgId, { tl: { col: 0, row: 0 } as any, ext: { width: 120, height: 56 } });
          } catch { /* se il logo non è valido, prosegui senza */ }
          // Titolo società accanto al logo
          const titleCell = ws.getCell('C1');
          titleCell.value = societyInfo.name || 'RegistraTEAM';
          titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: headerArgb } };
          titleCell.alignment = { vertical: 'middle' };
          ws.mergeCells(1, 3, 1, cols.length);
          ws.getRow(1).height = 22;
          ws.getRow(2).height = 22;
          ws.getRow(3).height = 8; // riga di stacco
          headerRowIdx = 4;
        }

        // Intestazione
        const hr = ws.getRow(headerRowIdx);
        cols.forEach(([h], i) => {
          const cell = hr.getCell(i + 1);
          cell.value = h;
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerArgb } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
        });
        hr.height = 22;

        // Righe dati (alternate bianco / grigio chiaro)
        rows.forEach((r, ri) => {
          const row = ws.getRow(headerRowIdx + 1 + ri);
          const isAlt = (ri % 2) === 1;
          r.forEach((v, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = v;
            cell.font = { name: 'Calibri', size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? ALT_FILL : 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle' };
            cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
          });
        });
      };

      // Foglio riepilogativo con tutte le squadre (solo se più di una squadra) — con LOGO
      if (groups.length > 1) {
        buildSheet('Riepilogo', SUMMARY_COLS, list.map((m, i) => matchToArray(m, SUMMARY_COLS, i + 1)), HEADER_PALETTE[0], true);
      }
      // Un foglio per ogni squadra — colore intestazione diverso
      groups.forEach((g, idx) => {
        const color = HEADER_PALETTE[idx % HEADER_PALETTE.length];
        buildSheet(g.name, TEAM_COLS, g.items.map((m, i) => matchToArray(m, TEAM_COLS, i + 1)), color, false);
      });

      const fname = `${exportFileName()}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();

      if (Platform.OS === 'web') {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        // ArrayBuffer -> base64 (senza dipendere da btoa)
        const bytes = new Uint8Array(buffer as ArrayBuffer);
        const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let b64 = '';
        for (let i = 0; i < bytes.length; i += 3) {
          const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2];
          b64 += B64[b1 >> 2];
          b64 += B64[((b1 & 3) << 4) | ((b2 ?? 0) >> 4)];
          b64 += i + 1 < bytes.length ? B64[((b2 & 15) << 2) | ((b3 ?? 0) >> 6)] : '=';
          b64 += i + 2 < bytes.length ? B64[b3 & 63] : '=';
        }
        const fileUri = FileSystem.documentDirectory + fname;
        await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: 'base64' as any });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Esporta Calendario Gare',
          });
        } else {
          Alert.alert('Errore', 'Condivisione non disponibile');
        }
      }
      setExportModalVisible(false);
    } catch (e: any) {
      Alert.alert('Errore', 'Impossibile esportare le gare in Excel');
    }
  };

  // 🆕 24/09/2026 — Esporta le gare in PDF (riepilogo + una sezione per squadra)
  const handleExportPDF = async () => {
    try {
      const list = getExportList();
      if (!list || list.length === 0) {
        Alert.alert('Nessuna gara', 'Non ci sono gare da esportare per i filtri selezionati.');
        return;
      }
      const toRow = (m: Match): MatchRow => {
        const { dataStr, oraStr } = fmtDate(m.date);
        return {
          squadra: m.team_name || '',
          campionato: m.match_number || '',
          casaTrasferta: m.home_away === 'home' ? 'Casa' : 'Trasferta',
          avversario: m.opponent || '',
          data: dataStr,
          ora: oraStr,
          impianto: m.venue || '',
          citta: m.city || '',
          ritrovo: m.meeting_time || '',
          risultato: m.result || '',
        };
      };
      const groups: TeamGroup[] = groupByTeam(list).map((g) => ({
        teamName: g.name,
        rows: g.items.map(toRow),
      }));

      await downloadMatchCalendarPDF({
        societyName: societyInfo.name || 'RegistraTEAM',
        societyLogo: societyInfo.logo,
        subtitle: exportSubtitle(),
        groups,
        fileName: exportFileName(),
      });
      setExportModalVisible(false);
    } catch (e: any) {
      Alert.alert('Errore', 'Impossibile esportare le gare in PDF');
    }
  };

  const resetForm = () => {
    setFormData({
      team_id: '',
      date: '',
      time: '',
      opponent: '',
      venue: '',
      address: '',
      city: '',
      home_away: 'home',
      meeting_time: '',
      notes: '',
    });
    setEditingMatch(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (match: Match) => {
    const matchDate = new Date(match.date);
    // Formatta la data in formato italiano gg/mm/aaaa
    const day = matchDate.getDate().toString().padStart(2, '0');
    const month = (matchDate.getMonth() + 1).toString().padStart(2, '0');
    const year = matchDate.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;
    
    setEditingMatch(match);
    setFormData({
      team_id: match.team_id,
      date: formattedDate,
      time: `${matchDate.getUTCHours().toString().padStart(2, '0')}:${matchDate.getUTCMinutes().toString().padStart(2, '0')}`,
      opponent: match.opponent,
      venue: match.venue,
      address: match.address || '',
      city: match.city || '',
      home_away: match.home_away,
      meeting_time: match.meeting_time || '',
      notes: match.notes || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.team_id || !formData.date || !formData.opponent) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    setSaving(true);
    try {
      // Parse date - supporta sia YYYY-MM-DD che DD/MM/YYYY
      let dateStr = formData.date;
      if (dateStr.includes('/')) {
        // Formato DD/MM/YYYY -> YYYY-MM-DD
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      
      const timeStr = formData.time || '00:00';
      // Build ISO string preserving wall-clock time (no TZ conversion).
      // The whole app displays match times with timeZone:'UTC' to render
      // the exact value stored. So we store the user's local input as-is.
      const dateISO = `${dateStr}T${timeStr}:00.000Z`;
      const dateTime = new Date(dateISO);
      
      // Verifica che la data sia valida
      if (isNaN(dateTime.getTime())) {
        Alert.alert('Errore', 'Formato data non valido. Usa YYYY-MM-DD o DD/MM/YYYY');
        setSaving(false);
        return;
      }
      
      const payload = {
        team_id: formData.team_id,
        date: dateISO,
        opponent: formData.opponent,
        venue: formData.venue || "",
        address: formData.address || null,
        city: formData.city || null,
        home_away: formData.home_away,
        meeting_time: formData.meeting_time || null,
        notes: formData.notes || null,
      };

      if (editingMatch) {
        await api.patch(`/matches/${editingMatch.id}`, payload);
      } else {
        await api.post('/matches', payload);
      }

      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving match:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (matchId: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Eliminare questa gara?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Elimina Gara',
            'Sei sicuro di voler eliminare questa gara?',
            [
              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Elimina', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      await api.delete(`/matches/${matchId}`);
      loadData();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile eliminare la gara');
    }
  };

  // 🆕 22/09/2026 — Cancellazione IN BLOCCO del calendario di una squadra
  // 🆕 24/09/2026 — sezione collassabile + conferma digitando "ELIMINA"
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [bulkExpanded, setBulkExpanded] = useState(false);
  const [confirmTeam, setConfirmTeam] = useState<{ id: string; name: string; count: number } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const confirmDeleteTeamCalendar = async () => {
    if (!confirmTeam || confirmText.trim().toUpperCase() !== 'ELIMINA') return;
    const { id: teamId, name: teamName, count } = confirmTeam;
    setDeletingTeamId(teamId);
    try {
      const res = await api.delete(`/matches/team/${teamId}/all`);
      await loadData();
      const n = res.data?.deleted_count ?? count;
      setConfirmTeam(null);
      setConfirmText('');
      if (Platform.OS === 'web') window.alert(`Eliminate ${n} partite di "${teamName}"`);
      else Alert.alert('Fatto', `Eliminate ${n} partite di "${teamName}"`);
    } catch {
      if (Platform.OS === 'web') window.alert('Impossibile eliminare il calendario');
      else Alert.alert('Errore', 'Impossibile eliminare il calendario');
    } finally {
      setDeletingTeamId(null);
    }
  };


  // Download template Excel con formato standard
  const downloadTemplate = async () => {
    try {
      // Crea il template con le colonne nel nostro formato standard
      const templateData = [
        {
          'CampionatoNome': 'Under 16 Maschile',
          'GaraNumero': '2713',
          'GaraDataOra': '15/03/2026 18:30:00',
          'SquadraCasaNome': 'PALLAVOLO PERUGIA',
          'SquadraOspiteNome': 'AVVERSARIO ASD',
          'Impianto': 'PALESTRA LICEO ALESSI',
          'ImpiantoIndirizzo': 'Via Roma 123, Perugia (PG)',
          'Ritrovo': '17:30',
          'Note': ''
        },
        {
          'CampionatoNome': 'Under 16 Maschile',
          'GaraNumero': '2714',
          'GaraDataOra': '22/03/2026 16:00:00',
          'SquadraCasaNome': 'ALTRA SQUADRA',
          'SquadraOspiteNome': 'PALLAVOLO PERUGIA',
          'Impianto': 'PALAZZETTO DELLO SPORT',
          'ImpiantoIndirizzo': 'Via Verdi 45, Terni (TR)',
          'Ritrovo': '14:30',
          'Note': 'Trasferta'
        }
      ];

      // Crea workbook
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Calendario Gare');

      // Imposta larghezza colonne
      ws['!cols'] = [
        { wch: 20 }, // CampionatoNome
        { wch: 12 }, // GaraNumero
        { wch: 20 }, // GaraDataOra
        { wch: 25 }, // SquadraCasaNome
        { wch: 25 }, // SquadraOspiteNome
        { wch: 25 }, // Impianto
        { wch: 35 }, // ImpiantoIndirizzo
        { wch: 10 }, // Ritrovo
        { wch: 20 }, // Note
      ];

      if (Platform.OS === 'web') {
        // Web: download diretto
        XLSX.writeFile(wb, 'template_calendario_gare.xlsx');
      } else {
        // Mobile: salva e condividi
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = FileSystem.documentDirectory + 'template_calendario_gare.xlsx';
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: 'base64' as any,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Scarica Template Calendario',
          });
        } else {
          Alert.alert('Errore', 'Condivisione non disponibile');
        }
      }
    } catch (error) {
      console.error('Error creating template:', error);
      Alert.alert('Errore', 'Impossibile creare il template');
    }
  };

  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
      });

      if (result.canceled) return;

      setImporting(true);

      const file = result.assets[0];
      let fileContent;
      
      if (Platform.OS === 'web') {
        // Web: fetch the file and read as array buffer
        const response = await fetch(file.uri);
        fileContent = await response.arrayBuffer();
      } else {
        // Mobile: read as base64 and convert
        // Use string 'base64' instead of FileSystem.EncodingType.Base64 for compatibility
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64' as any,
        });
        // Convert base64 to ArrayBuffer using a polyfill approach
        // React Native doesn't have native atob, so we decode manually
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let bufferLength = base64.length * 0.75;
        if (base64[base64.length - 1] === '=') bufferLength--;
        if (base64[base64.length - 2] === '=') bufferLength--;
        
        const bytes = new Uint8Array(bufferLength);
        let p = 0;
        
        for (let i = 0; i < base64.length; i += 4) {
          const encoded1 = chars.indexOf(base64[i]);
          const encoded2 = chars.indexOf(base64[i + 1]);
          const encoded3 = chars.indexOf(base64[i + 2]);
          const encoded4 = chars.indexOf(base64[i + 3]);
          
          bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
          if (encoded3 !== -1 && base64[i + 2] !== '=') {
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
          }
          if (encoded4 !== -1 && base64[i + 3] !== '=') {
            bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
          }
        }
        fileContent = bytes.buffer;
      }

      // Parse Excel
      // 🆕 30/08/2026 — cellDates:true + raw:true → le celle data vengono lette come veri oggetti Date
      // (rispettando il valore memorizzato da Excel), evitando che Excel le stringifichi in formato
      // americano ambiguo tipo "9/12/26 17:30" che il backend non riconosceva.
      const workbook = XLSX.read(fileContent, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 🆕 24/09/2026 — Rilevamento riga di intestazione. Alcuni calendari (FIPAV /
      // società) hanno righe di titolo/sottotitolo prima delle colonne vere e proprie:
      // in quel caso sheet_to_json userebbe il titolo come header e l'import fallirebbe.
      // Leggiamo il foglio come matrice e cerchiamo la prima riga che contiene le
      // intestazioni note, poi costruiamo gli oggetti da lì in avanti.
      const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
      const HEADER_TOKENS = [
        'data', 'ora', 'orario', 'squadra casa', 'squadra trasferta', 'avversario',
        'campionatonome', 'garadataora', 'garanumero', 'squadracasanome', 'squadraospitenome',
        'impianto', 'giornata', 'sede', 'ritrovo',
      ];
      let headerIdx = 0;
      for (let i = 0; i < Math.min(aoa.length, 40); i++) {
        const cells = (aoa[i] || []).map((c: any) => String(c ?? '').trim().toLowerCase());
        const score = cells.filter((c: string) => HEADER_TOKENS.includes(c)).length;
        if (score >= 2) { headerIdx = i; break; }
      }
      const headers = (aoa[headerIdx] || []).map((c: any) => String(c ?? '').trim());
      const jsonData = aoa.slice(headerIdx + 1)
        .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
        .map((r) => {
          const obj: any = {};
          headers.forEach((h: string, idx: number) => { if (h) obj[h] = r[idx]; });
          return obj;
        });

      console.log('Excel header row:', headerIdx, headers);
      console.log('Excel data parsed:', jsonData.slice(0, 2)); // Debug

      // Store parsed data and show home team modal
      setPendingImportData(jsonData);
      // 🆕 Pre-seleziona la squadra se ce n'è una sola
      setImportTeamId(teams.length === 1 ? teams[0].id : '');
      setImporting(false);
      setHomeTeamModalVisible(true);
      
    } catch (error: any) {
      console.error('Import error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Errore durante la lettura del file';
      Alert.alert('Errore Import', errorMsg);
      setImporting(false);
    }
  };

  // Process import after home team name is provided
  const processImportWithHomeTeam = async () => {
    if (!importTeamId) {
      Alert.alert('Errore', 'Seleziona la squadra a cui assegnare le gare');
      return;
    }
    if (!homeTeamName.trim()) {
      Alert.alert('Errore', 'Inserisci il nome della squadra di casa per identificare le gare in casa');
      return;
    }

    setHomeTeamModalVisible(false);
    setImporting(true);

    try {
      const jsonData = pendingImportData;
      const homeTeamLower = homeTeamName.trim().toLowerCase();

      // 🆕 Squadra scelta manualmente dall'admin: tutte le gare del file appartengono a questa squadra.
      // Evita il riconoscimento automatico fragile basato su CampionatoNome (che con le amichevoli
      // contiene valori tipo "Allen_congiunto - B1" non corrispondenti al nome squadra).
      const selectedTeam = teams.find(t => t.id === importTeamId);

      // Map Excel data to matches format
      // Colonne file federazione: CampionatoNome, GaraDataOra, SquadraCasaNome, SquadraOspiteNome, Impianto, ImpiantoIndirizzo
      const matchesData = jsonData.map((row: any) => {
        console.log('Processing row:', row); // Debug
        // Helper: converte qualsiasi valore cella in stringa pulita (raw:true può dare numeri/Date)
        const S = (v: any) => {
          if (v == null) return '';
          if (v instanceof Date) return v.toString();
          return String(v).trim();
        };
        
        // CampionatoNome - identificativo della squadra (es. "U14 Maschile Campionato")
        const campionato = S(row['CampionatoNome'] || row['CAMPIONATONOME'] || row['Campionato'] || '');
        
        // SquadraCasaNome - nome della squadra di casa
        const squadraCasa = S(row['SquadraCasaNome'] || row['SQUADRACASANOME'] || row['Squadra Casa'] || '');
        
        // SquadraOspiteNome - avversario
        const squadraOspite = S(row['SquadraOspiteNome'] || row['SQUADRAOSPITENOME'] || row['Avversario'] || '');
        
        // Fallback al vecchio formato per compatibilità
        const teamNameLegacy = S(row['Squadra'] || row['Team'] || '');
        
        // Usa CampionatoNome, poi SquadraCasaNome, poi fallback legacy
        const teamSearchKey = campionato || squadraCasa || teamNameLegacy;
        
        // 🆕 Se l'admin ha selezionato una squadra, usala sempre. Altrimenti prova il match automatico.
        const team = selectedTeam || teams.find(t => {
          if (!teamSearchKey) return false;
          const tName = t.name.toLowerCase();
          const searchLower = teamSearchKey.toLowerCase();
          // Match esatto o parziale
          return tName === searchLower || 
                 tName.includes(searchLower) || 
                 searchLower.includes(tName);
        });
        
        // Determina se siamo in casa o in trasferta basandosi su SquadraCasaNome e il nome inserito dall'utente
        let isHome = false;
        if (squadraCasa) {
          const casaLower = squadraCasa.toLowerCase();
          // Controlla se il nome della squadra di casa contiene il nome inserito dall'utente
          isHome = casaLower.includes(homeTeamLower) || homeTeamLower.includes(casaLower);
        }
        
        // GaraDataOra - data e ora della gara
        let dateTimeStr = row['GaraDataOra'] || row['DATA'] || row['Data'] || '';

        // 🆕 24/09/2026 — Alcuni calendari FIPAV hanno DATA e ORA in colonne SEPARATE
        // (es. file "Calendario ... B1"): leggiamo l'orario a parte e lo uniamo alla data.
        let oraSep: any = row['Ora'] || row['ORA'] || row['Orario'] || row['ORARIO'] || '';
        if (oraSep instanceof Date) {
          const oo = new Date(Math.round(oraSep.getTime() / 60000) * 60000);
          oraSep = `${oo.getHours().toString().padStart(2, '0')}:${oo.getMinutes().toString().padStart(2, '0')}`;
        } else {
          oraSep = S(oraSep);
        }

        // Se è un oggetto Date (da Excel), convertilo in stringa
        if (dateTimeStr instanceof Date) {
          // Arrotonda al minuto più vicino (SheetJS può restituire 17:29:59 invece di 17:30)
          const d = new Date(Math.round(dateTimeStr.getTime() / 60000) * 60000);
          const datePart = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
          // Orario: preferisci la colonna "Ora" separata se presente, altrimenti quello della cella Data
          const timePart = oraSep || `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          dateTimeStr = `${datePart} ${timePart}`;
        } else if (dateTimeStr && typeof dateTimeStr === 'string') {
          dateTimeStr = dateTimeStr.trim();
          // Se la stringa data non contiene già un orario e abbiamo una colonna Ora separata, uniscili
          if (oraSep && !/\d{1,2}:\d{2}/.test(dateTimeStr)) {
            dateTimeStr = `${dateTimeStr} ${oraSep}`;
          }
        }
        
        // Determina l'avversario in base a casa/trasferta
        // Se siamo in casa, l'avversario è SquadraOspiteNome
        // Se siamo in trasferta, l'avversario è SquadraCasaNome
        const opponent = isHome ? squadraOspite : squadraCasa;
        
        // Impianto - nome palestra
        const impianto = S(row['Impianto'] || row['IMPIANTO'] || row['Luogo'] || '');
        
        // ImpiantoIndirizzo - indirizzo completo
        const indirizzo = S(row['ImpiantoIndirizzo'] || row['IMPIANTO INDIRIZZO'] || row['Indirizzo'] || '');
        
        // Estrai città dall'impianto o dall'indirizzo se contiene un trattino o virgola
        let venue = impianto;
        let city = '';
        if (impianto && impianto.includes(' - ')) {
          const parts = impianto.split(' - ');
          venue = parts[0].trim();
          city = parts.slice(1).join(' - ').trim();
        } else if (impianto && impianto.includes(', ')) {
          const parts = impianto.split(', ');
          venue = parts[0].trim();
          city = parts.slice(1).join(', ').trim();
        }
        
        // Casa/Trasferta - usa isHome calcolato
        const homeAway = isHome ? 'home' : 'away';
        
        // GaraNumero - numero univoco della gara
        const garaNumero = row['GaraNumero'] || row['GARANUMERO'] || row['Gara Numero'] || row['NumeroGara'] || '';
        
        // Ritrovo - orario ritrovo. Con cellDates un orario "16:00" può arrivare come Date → formatta HH:MM
        let ritrovo: any = row['Ritrovo'] || '';
        if (ritrovo instanceof Date) {
          const rr = new Date(Math.round(ritrovo.getTime() / 60000) * 60000);
          ritrovo = `${rr.getHours().toString().padStart(2, '0')}:${rr.getMinutes().toString().padStart(2, '0')}`;
        } else {
          ritrovo = S(ritrovo);
        }
        
        return {
          team_id: team?.id || '',
          team_name: team?.name || teamSearchKey,
          match_number: garaNumero ? String(garaNumero).trim() : '',
          date: dateTimeStr,
          opponent: opponent,
          venue: venue || '',
          address: indirizzo,
          city: city,
          home_away: homeAway,
          meeting_time: ritrovo,
          notes: S(row['Note'] || ''),
        };
      });

      // Filter out invalid rows
      const validMatches = matchesData.filter((m: any) => m.team_id && m.opponent);
      
      // Log per debugging
      const invalidMatches = matchesData.filter((m: any) => !m.team_id || !m.opponent);
      if (invalidMatches.length > 0) {
        console.log('Invalid matches (missing team_id or opponent):', invalidMatches.slice(0, 3));
        console.log('Available teams:', teams.map(t => t.name));
      }
      
      // Count home/away for feedback
      const homeCount = validMatches.filter((m: any) => m.home_away === 'home').length;
      const awayCount = validMatches.filter((m: any) => m.home_away === 'away').length;
      
      if (validMatches.length === 0) {
        const firstRow = matchesData[0];
        const columnNames = firstRow ? Object.keys(firstRow).join(', ') : 'nessuna';
        const searchedTeams = matchesData.slice(0, 3).map((m: any) => m.team_name || 'N/A').join(', ');
        const availableTeams = teams.map(t => t.name).join(', ');
        Alert.alert(
          'Errore Import', 
          `Nessuna gara valida trovata.\n\nColonne nel file: ${columnNames}\n\nSquadre cercate nel file: ${searchedTeams}\n\nSquadre disponibili nel sistema: ${availableTeams}\n\nAssicurati che CAMPIONATONOME o SQUADRACASANOME contenga parte del nome di una squadra.`
        );
        setImporting(false);
        return;
      }

      // Import matches
      const response = await api.post('/matches/import', { matches: validMatches });
      
      // Salva il nome squadra di casa per i prossimi re-import (no più riscritte!)
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('lastHomeTeamName', homeTeamName.trim());
        }
      } catch {}
      
      const updated = response.data.updated || 0;
      const newCount = response.data.new || 0;
      const isReimport = updated > 0;
      
      Alert.alert(
        isReimport ? '🔄 Calendario Aggiornato' : '✅ Import Completato',
        `${isReimport ? `🔄 Aggiornate: ${updated} gare (date/orari/luogo)\n🆕 Nuove: ${newCount} gare` : `Importate ${response.data.imported} gare`}\n\n🏠 Casa: ${homeCount}\n✈️ Trasferta: ${awayCount}${response.data.errors?.length > 0 ? `\n\nErrori: ${response.data.errors.join('\n')}` : ''}`
      );
      
      // Clear pending data (NON il nome casa, lo manteniamo per i prossimi import)
      setPendingImportData([]);
      
      loadData();
    } catch (error: any) {
      console.error('Import error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Errore durante l\'importazione del file';
      Alert.alert('Errore Import', errorMsg);
    } finally {
      setImporting(false);
      setImportModalVisible(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  const groupMatchesByMonth = () => {
    const grouped: { [key: string]: Match[] } = {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filtered = matches.filter(match => {
      const matchDate = new Date(match.date);
      matchDate.setHours(0, 0, 0, 0);
      const hasResult = match.result && match.result.trim() !== '' && match.result !== '-';
      
      if (filterMode === 'upcoming') {
        return matchDate >= today && !hasResult;
      } else if (filterMode === 'played') {
        return hasResult || matchDate < today;
      }
      return true;
    });
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return filterMode === 'played' ? dateB - dateA : dateA - dateB;
    });
    
    filtered.forEach(match => {
      const date = new Date(match.date);
      const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (!grouped[monthName]) {
        grouped[monthName] = [];
      }
      grouped[monthName].push(match);
    });
    return grouped;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Caricamento gare...</Text>
      </View>
    );
  }

  const groupedMatches = groupMatchesByMonth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backBtn}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} testID="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} testID="matches-page-title">Calendario Gare</Text>
        <TouchableOpacity
          onPress={handleSyncFipav}
          style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
          disabled={syncing}
          testID="sync-fipav-btn"
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sync-outline" size={18} color="#fff" />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleImportExcel} style={styles.importBtn}>
          <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        </TouchableOpacity>
        {/* 🆕 29/07/2026 — Esporta calendario società completo (.ics) */}
        <TouchableOpacity
          onPress={handleExportIcs}
          style={[styles.importBtn, { backgroundColor: '#7C3AED' }]}
          testID="export-matches-ics-btn"
        >
          <Ionicons name="calendar-outline" size={20} color="#fff" />
        </TouchableOpacity>
        {/* 🆕 06/09/2026 — Esporta gare in Excel/PDF — 🆕 24/09/2026 con opzioni + PDF */}
        <TouchableOpacity
          onPress={() => { setExportTeamId('all'); setExportHomeAway('all'); setExportStatus('all'); setExportModalVisible(true); }}
          style={[styles.exportBtn]}
          testID="export-matches-excel-btn"
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.exportBtnText}>Scarica</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Guida import Excel: 2 passi chiari con pulsanti etichettati */}
      <View style={styles.excelGuideCard}>
        <View style={styles.excelGuideHeader}>
          <Ionicons name="grid-outline" size={18} color="#1a1a2e" />
          <Text style={styles.excelGuideTitle}>Importa gare da Excel in 2 passi</Text>
          <TouchableOpacity
            onPress={() => setTutorialVisible(true)}
            testID="matches-info-btn"
            style={styles.excelGuideInfo}
          >
            <Ionicons name="help-circle-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.excelGuideSteps}>
          <TouchableOpacity
            style={[styles.excelStepBtn, styles.excelStepBtnTemplate]}
            onPress={downloadTemplate}
            testID="download-template-btn"
          >
            <View style={styles.excelStepNum}><Text style={styles.excelStepNumText}>1</Text></View>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.excelStepBtnText}>Scarica Template</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.excelStepBtn, styles.excelStepBtnImport]}
            onPress={handleImportExcel}
            testID="import-excel-btn"
          >
            <View style={styles.excelStepNum}><Text style={styles.excelStepNumText}>2</Text></View>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.excelStepBtnText}>Carica il file</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.excelGuideHint}>
          Scarica il modello, compilalo con le tue gare e ricaricalo qui. Poi scegli la squadra.
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar} testID="match-filter-bar">
        {([
          { key: 'upcoming', label: 'Da disputare', icon: 'time-outline' },
          { key: 'played', label: 'Giocate', icon: 'trophy-outline' },
          { key: 'all', label: 'Tutte', icon: 'list-outline' },
        ] as const).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filterMode === tab.key && styles.filterTabActive]}
            onPress={() => setFilterMode(tab.key)}
            testID={`filter-${tab.key}`}
          >
            <Ionicons name={tab.icon as any} size={16} color={filterMode === tab.key ? '#fff' : '#666'} />
            <Text style={[styles.filterTabText, filterMode === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {matches.length > 0 ? (() => {
          const counts: { [tid: string]: { name: string; count: number } } = {};
          for (const m of matches) {
            if (!m.team_id) continue;
            if (!counts[m.team_id]) counts[m.team_id] = { name: m.team_name || 'Squadra', count: 0 };
            counts[m.team_id].count += 1;
          }
          const rows = Object.entries(counts).sort((a, b) => a[1].name.localeCompare(b[1].name));
          if (rows.length === 0) return null;
          return (
            <View style={styles.bulkCard} testID="bulk-delete-section">
              <TouchableOpacity
                style={styles.bulkHeader}
                onPress={() => setBulkExpanded((v) => !v)}
                testID="bulk-delete-toggle"
              >
                <Text style={styles.bulkTitle}>🗑️ Svuota calendario di una squadra</Text>
                <Ionicons name={bulkExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#795548" />
              </TouchableOpacity>
              {bulkExpanded ? (
                <>
                  <Text style={styles.bulkHint}>Elimina in blocco tutte le partite importate di una squadra (utile per import errati/doppi).</Text>
                  {rows.map(([tid, info]) => (
                    <View key={tid} style={styles.bulkRow}>
                      <Text style={styles.bulkTeamName} numberOfLines={1}>{info.name} · {info.count} partite</Text>
                      <TouchableOpacity
                        style={[styles.bulkDelBtn, deletingTeamId === tid && { opacity: 0.5 }]}
                        disabled={deletingTeamId === tid}
                        onPress={() => { setConfirmTeam({ id: tid, name: info.name, count: info.count }); setConfirmText(''); }}
                        testID={`bulk-delete-${tid}`}
                      >
                        {deletingTeamId === tid ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.bulkDelBtnText}>Elimina tutte</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.bulkHint}>{rows.length} squadre con partite · tocca per gestire</Text>
              )}
            </View>
          );
        })() : null}
        {matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna gara in calendario</Text>
            <Text style={styles.emptySubtext}>Aggiungi gare manualmente o importa da Excel</Text>
          </View>
        ) : Object.keys(groupedMatches).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name={filterMode === 'played' ? 'trophy-outline' : 'time-outline'} size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {filterMode === 'played' ? 'Nessuna gara giocata' : 'Nessuna gara da disputare'}
            </Text>
            <Text style={styles.emptySubtext}>
              {filterMode === 'played' ? 'I risultati appariranno dopo le partite' : 'Tutte le gare hanno già un risultato'}
            </Text>
          </View>
        ) : (
          Object.entries(groupedMatches).map(([month, monthMatches]) => (
            <View key={month}>
              <Text style={styles.monthHeader}>{month.charAt(0).toUpperCase() + month.slice(1)}</Text>
              {monthMatches.map(match => {
                // Formatta il luogo: mostra palestra, città e indirizzo
                let venueDisplay = match.venue || 'Da definire';
                if (match.city) {
                  venueDisplay += ` - ${match.city}`;
                }
                  
                return (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchCard}
                  onPress={() => openEditModal(match)}
                  activeOpacity={0.7}
                >
                  <View style={styles.matchHeader}>
                    <View style={[styles.homeAwayBadge, match.home_away === 'away' && styles.awayBadge]}>
                      <Text style={styles.homeAwayText}>
                        {match.home_away === 'home' ? '🏠 Casa' : '✈️ Trasferta'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(match.id);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.matchTeam, { color: championshipColor(match.team_name) }]}>
                    {match.team_name}{match.match_number ? ` - gara ${match.match_number}` : ''}
                  </Text>
                  <Text style={styles.matchVs}>vs {match.opponent}</Text>
                  <View style={styles.matchDetails}>
                    <View style={styles.matchDetailItem}>
                      <Ionicons name="calendar-outline" size={14} color="#E53935" />
                      <Text style={styles.matchDateTime}>{formatDate(match.date)}</Text>
                    </View>
                    <View style={styles.matchDetailItem}>
                      <Ionicons name="location-outline" size={14} color="#666" />
                      <Text style={styles.matchDetailText}>{venueDisplay}</Text>
                    </View>
                    {match.address && (
                      <View style={styles.matchDetailItem}>
                        <Ionicons name="map-outline" size={14} color="#888" />
                        <Text style={[styles.matchDetailText, { color: '#888', fontSize: 12 }]}>{match.address}</Text>
                      </View>
                    )}
                    {match.meeting_time && (
                      <View style={styles.matchDetailItem}>
                        <Ionicons name="time-outline" size={14} color="#FF9500" />
                        <Text style={[styles.matchDetailText, { color: '#FF9500' }]}>
                          Ritrovo: {match.meeting_time}
                        </Text>
                      </View>
                    )}
                  </View>
                  {match.notes && (
                    <Text style={styles.matchNotes}>📝 {match.notes}</Text>
                  )}
                  {match.result && match.result !== '-' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
                      <Ionicons name="trophy" size={14} color="#2E7D32" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7D32' }}>{match.result}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
              })}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMatch ? 'Modifica Gara' : 'Nuova Gara'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Squadra *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.team_id}
                  onValueChange={(v) => setFormData({ ...formData, team_id: v })}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleziona squadra..." value="" />
                  {teams.map(team => (
                    <Picker.Item key={team.id} label={team.name} value={team.id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Data *</Text>
              <TextInput
                style={styles.input}
                value={formData.date}
                onChangeText={(v) => {
                  // Auto-format: inserisce "/" dopo giorno e mese
                  let formatted = v.replace(/[^0-9]/g, '');
                  if (formatted.length > 2) {
                    formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                  }
                  if (formatted.length > 5) {
                    formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                  }
                  setFormData({ ...formData, date: formatted });
                }}
                placeholder="gg/mm/aaaa"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={10}
                // 🐛 28/07/2026 — Chrome mobile riconosceva il pattern "gg/mm/aaaa" come
                // scadenza carta di credito e apriva l'autofill delle carte. Disabilitiamo
                // esplicitamente l'autocomplete e diamo un name/data-form-type non-cc.
                autoComplete="off"
                autoCorrect={false}
                dataDetectorTypes="none"
                {...({ name: 'match_date_field', 'data-form-type': 'other', 'data-lpignore': 'true', inputMode: 'numeric' } as any)}
              />

              <Text style={styles.label}>Ora</Text>
              <TextInput
                style={styles.input}
                value={formData.time}
                onChangeText={(v) => {
                  // Auto-format: inserisce ":" dopo le ore
                  let formatted = v.replace(/[^0-9]/g, '');
                  if (formatted.length > 2) {
                    formatted = formatted.slice(0, 2) + ':' + formatted.slice(2, 4);
                  }
                  setFormData({ ...formData, time: formatted });
                }}
                placeholder="HH:mm"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={5}
                autoComplete="off"
                autoCorrect={false}
                {...({ name: 'match_time_field', 'data-form-type': 'other', inputMode: 'numeric' } as any)}
              />

              <Text style={styles.label}>Avversario *</Text>
              <TextInput
                style={styles.input}
                value={formData.opponent}
                onChangeText={(v) => setFormData({ ...formData, opponent: v })}
                placeholder="Nome squadra avversaria"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Luogo (Palestra)</Text>
              <TextInput
                style={styles.input}
                value={formData.venue}
                onChangeText={(v) => setFormData({ ...formData, venue: v })}
                placeholder="Nome palestra / campo"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Indirizzo</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(v) => setFormData({ ...formData, address: v })}
                placeholder="Via, numero civico..."
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Città</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(v) => setFormData({ ...formData, city: v })}
                placeholder="es: Perugia, Terni, Foligno..."
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Casa / Trasferta</Text>
              <View style={styles.homeAwaySelector}>
                <TouchableOpacity
                  style={[styles.homeAwayOption, formData.home_away === 'home' && styles.homeAwaySelected]}
                  onPress={() => setFormData({ ...formData, home_away: 'home' })}
                >
                  <Text style={[styles.homeAwayOptionText, formData.home_away === 'home' && styles.homeAwaySelectedText]}>
                    🏠 Casa
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.homeAwayOption, formData.home_away === 'away' && styles.homeAwaySelected]}
                  onPress={() => setFormData({ ...formData, home_away: 'away' })}
                >
                  <Text style={[styles.homeAwayOptionText, formData.home_away === 'away' && styles.homeAwaySelectedText]}>
                    ✈️ Trasferta
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Orario Ritrovo</Text>
              <TextInput
                style={styles.input}
                value={formData.meeting_time}
                onChangeText={(v) => setFormData({ ...formData, meeting_time: v })}
                placeholder="es: 1 ora prima"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Note</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(v) => setFormData({ ...formData, notes: v })}
                placeholder="Note aggiuntive..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {editingMatch ? 'Salva Modifiche' : 'Aggiungi Gara'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Import Loading Overlay */}
      {importing && (
        <View style={styles.importOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.importText}>Importazione in corso...</Text>
        </View>
      )}

      {/* Home Team Name Modal for Excel Import */}
      <Modal visible={homeTeamModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.homeTeamModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SportIcon size={22} />
                <Text style={[styles.modalTitle, { marginLeft: 6 }]}>Identifica Gare in Casa</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setHomeTeamModalVisible(false);
                setPendingImportData([]);
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.homeTeamModalBody}>
              {/* 🆕 Selettore squadra: tutte le gare del file verranno assegnate a questa squadra */}
              <Text style={styles.homeTeamFieldLabel}>Squadra di destinazione</Text>
              <Text style={styles.homeTeamDescription}>
                Seleziona la squadra a cui assegnare tutte le gare del file (es. la tua B1).
              </Text>
              <View style={styles.teamPickerWrapper}>
                <Picker
                  selectedValue={importTeamId}
                  onValueChange={(val) => setImportTeamId(val)}
                  style={styles.teamPicker}
                >
                  <Picker.Item label="— Seleziona squadra —" value="" color="#999" />
                  {teams.map((t) => (
                    <Picker.Item key={t.id} label={t.name} value={t.id} />
                  ))}
                </Picker>
              </View>

              <View style={styles.homeTeamDivider} />

              <Text style={styles.homeTeamFieldLabel}>Nome società (per Casa/Trasferta)</Text>
              <Text style={styles.homeTeamDescription}>
                Inserisci il nome (o parte del nome) della tua società come appare nella colonna "SquadraCasaNome" del file Excel.
              </Text>
              <Text style={styles.homeTeamExample}>
                Esempio: "Pallavolo Perugia", "Perugia", "PGS Perugia"
              </Text>
              
              {homeTeamName.trim().length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 8, borderRadius: 6, marginTop: 6 }} testID="home-team-saved-hint">
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                  <Text style={{ marginLeft: 6, fontSize: 12, color: '#2E7D32', flex: 1 }}>
                    Nome salvato dall'ultima importazione. Modifica solo se necessario.
                  </Text>
                </View>
              )}
              
              <TextInput
                style={styles.homeTeamInput}
                value={homeTeamName}
                onChangeText={setHomeTeamName}
                placeholder="Nome squadra di casa..."
                placeholderTextColor="#999"
                autoFocus
                testID="home-team-name-input"
              />
              
              <Text style={styles.homeTeamHint}>
                Le gare dove "SquadraCasaNome" contiene questo testo saranno marcate come 🏠 Casa, le altre come ✈️ Trasferta.
              </Text>

              <View style={styles.homeTeamButtons}>
                <TouchableOpacity 
                  style={styles.homeTeamCancelBtn}
                  onPress={() => {
                    setHomeTeamModalVisible(false);
                    setPendingImportData([]);
                  }}
                >
                  <Text style={styles.homeTeamCancelText}>Annulla</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.homeTeamConfirmBtn, (!homeTeamName.trim() || !importTeamId) && styles.homeTeamConfirmDisabled]}
                  onPress={processImportWithHomeTeam}
                  disabled={!homeTeamName.trim() || !importTeamId}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.homeTeamConfirmText}>Importa Gare</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* FIPAV Sync Result Modal */}
      <Modal visible={syncResultVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sincronizzazione FIPAV</Text>
              <TouchableOpacity onPress={() => setSyncResultVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {syncResult && (
                <>
                  <View style={{ backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#2E7D32', marginBottom: 4 }} testID="sync-result-message">
                      {syncResult.message}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#666' }}>
                      Gare trovate sul portale: {syncResult.scraped_total} | Presenti in archivio: {syncResult.existing_matched}
                    </Text>
                  </View>
                  {syncResult.changes && syncResult.changes.length > 0 ? (
                    syncResult.changes.map((change: any, idx: number) => (
                      <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: change.date_new ? '#FF6F00' : '#4CAF50' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 6 }}>
                          Gara {change.match_number}
                        </Text>
                        {change.date_old && change.date_new && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Ionicons name="calendar-outline" size={14} color="#FF6F00" />
                            <Text style={{ fontSize: 13, color: '#E65100', textDecorationLine: 'line-through' }}>{change.date_old}</Text>
                            <Ionicons name="arrow-forward" size={12} color="#666" />
                            <Text style={{ fontSize: 13, color: '#2E7D32', fontWeight: '600' }}>{change.date_new}</Text>
                          </View>
                        )}
                        {change.result_new && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="trophy-outline" size={14} color="#4CAF50" />
                            <Text style={{ fontSize: 13, color: '#333' }}>Risultato: {change.result_new}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <View style={{ alignItems: 'center', padding: 24 }}>
                      <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                      <Text style={{ fontSize: 15, color: '#666', marginTop: 8 }}>Calendario aggiornato, nessuna modifica necessaria</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🆕 24/09/2026 — Modal conferma eliminazione calendario (digitare ELIMINA) */}
      <Modal visible={!!confirmTeam} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>⚠️ Conferma eliminazione</Text>
            {confirmTeam ? (
              <Text style={styles.confirmMsg}>
                Stai per eliminare TUTTE le {confirmTeam.count} partite di{'\n'}
                <Text style={{ fontWeight: '800' }}>{confirmTeam.name}</Text>.{'\n'}
                L&apos;operazione non è reversibile.
              </Text>
            ) : null}
            <Text style={styles.confirmLabel}>Per confermare, scrivi ELIMINA:</Text>
            <TextInput
              style={styles.confirmInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="ELIMINA"
              autoCapitalize="characters"
              autoCorrect={false}
              testID="confirm-delete-input"
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => { setConfirmTeam(null); setConfirmText(''); }}
                testID="confirm-cancel-btn"
              >
                <Text style={styles.confirmCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDelBtn,
                  confirmText.trim().toUpperCase() !== 'ELIMINA' && { opacity: 0.4 },
                ]}
                disabled={confirmText.trim().toUpperCase() !== 'ELIMINA' || !!deletingTeamId}
                onPress={confirmDeleteTeamCalendar}
                testID="confirm-delete-btn"
              >
                {deletingTeamId ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmDelText}>Elimina definitivamente</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* 🆕 24/09/2026 — Modal opzioni export Excel (squadra + casa/trasferta + stato) */}
      <Modal visible={exportModalVisible} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>📥 Esporta calendario</Text>

            <Text style={styles.confirmLabel}>Squadra</Text>
            <View style={styles.exportPickerWrap}>
              <Picker selectedValue={exportTeamId} onValueChange={(v) => setExportTeamId(v)} testID="export-team-picker">
                <Picker.Item label="Tutta la società (tutte le squadre)" value="all" />
                {teams.map((t) => (
                  <Picker.Item key={t.id} label={t.name} value={t.id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.confirmLabel}>Gare</Text>
            <View style={styles.segRow}>
              {([['all', 'Tutte'], ['home', '🏠 Casa'], ['away', '✈️ Trasferta']] as const).map(([val, lbl]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.segBtn, exportHomeAway === val && styles.segBtnActive]}
                  onPress={() => setExportHomeAway(val)}
                  testID={`export-ha-${val}`}
                >
                  <Text style={[styles.segText, exportHomeAway === val && styles.segTextActive]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.confirmLabel}>Stato</Text>
            <View style={styles.segRow}>
              {([['all', 'Tutte'], ['upcoming', 'Da disputare'], ['played', 'Giocate']] as const).map(([val, lbl]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.segBtn, exportStatus === val && styles.segBtnActive]}
                  onPress={() => setExportStatus(val)}
                  testID={`export-status-${val}`}
                >
                  <Text style={[styles.segText, exportStatus === val && styles.segTextActive]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setExportModalVisible(false)} testID="export-cancel-btn">
                <Text style={styles.confirmCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDelBtn, { backgroundColor: '#DC2626' }]} onPress={handleExportPDF} testID="export-pdf-btn">
                <Text style={styles.confirmDelText}>📄 PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDelBtn, { backgroundColor: '#217346' }]} onPress={handleExportExcel} testID="export-confirm-btn">
                <Text style={styles.confirmDelText}>📊 Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Syncing overlay */}
      {syncing && (
        <View style={styles.importOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.importText}>Sincronizzazione FIPAV in corso...</Text>
        </View>
      )}

      {/* Multi-step Tutorial Modal (reusable component) */}
      <MultiStepTutorial
        visible={tutorialVisible}
        steps={TUTORIAL_STEPS}
        onClose={() => setTutorialVisible(false)}
        testIdPrefix="matches-tutorial"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  importBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    marginRight: 8,
  },
  syncBtn: {
    padding: 8,
    backgroundColor: '#FF6F00',
    borderRadius: 8,
    marginRight: 8,
  },
  addBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#217346',
    borderRadius: 8,
    marginRight: 8,
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#f5f5f5',
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    gap: 8,
  },
  instructionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIconLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: '#007AFF',
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  templateBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  excelGuideCard: {
    backgroundColor: '#E8F4FD',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CDE7FA',
  },
  excelGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  excelGuideTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  excelGuideInfo: {
    padding: 2,
  },
  excelGuideSteps: {
    flexDirection: 'row',
    gap: 10,
  },
  excelStepBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    minHeight: 48,
  },
  excelStepBtnTemplate: {
    backgroundColor: '#34C759',
  },
  excelStepBtnImport: {
    backgroundColor: '#007AFF',
  },
  excelStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  excelStepNumText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  excelStepBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  excelGuideHint: {
    fontSize: 11,
    color: '#4a6b85',
    marginTop: 8,
    lineHeight: 15,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  bulkCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  bulkTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  bulkHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bulkHint: { fontSize: 11, color: '#795548', marginTop: 2, marginBottom: 8 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420 },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: '#C62828', marginBottom: 10 },
  confirmMsg: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 14 },
  confirmLabel: { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '600' },
  confirmInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, letterSpacing: 1 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  confirmCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#EEE', alignItems: 'center' },
  confirmCancelText: { color: '#333', fontWeight: '700', fontSize: 14 },
  confirmDelBtn: { flex: 1.4, paddingVertical: 12, borderRadius: 8, backgroundColor: '#C62828', alignItems: 'center' },
  confirmDelText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  exportPickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 4, overflow: 'hidden' },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#EEE', alignItems: 'center' },
  segBtnActive: { backgroundColor: '#1565C0' },
  segText: { fontSize: 12, color: '#444', fontWeight: '600' },
  segTextActive: { color: '#fff', fontWeight: '800' },
  bulkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, gap: 8, borderTopWidth: 1, borderTopColor: '#FFECB3',
  },
  bulkTeamName: { flex: 1, fontSize: 13, color: '#333', fontWeight: '600' },
  bulkDelBtn: { backgroundColor: '#C62828', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, minWidth: 92, alignItems: 'center' },
  bulkDelBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeAwayBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  awayBadge: {
    backgroundColor: '#FFF5EB',
  },
  homeAwayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
  matchTeam: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  matchVs: {
    fontSize: 14,
    color: '#333',
    marginVertical: 4,
  },
  matchDetails: {
    marginTop: 8,
    gap: 4,
  },
  matchDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchDetailText: {
    fontSize: 13,
    color: '#666',
  },
  matchDateTime: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: 'bold',
  },
  matchNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  homeAwaySelector: {
    flexDirection: 'row',
    gap: 12,
  },
  homeAwayOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  homeAwaySelected: {
    backgroundColor: '#007AFF',
  },
  homeAwayOptionText: {
    fontSize: 14,
    color: '#333',
  },
  homeAwaySelectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 40,
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  homeTeamModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  homeTeamModalBody: {
    padding: 20,
  },
  homeTeamFieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  teamPickerWrapper: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginBottom: 4,
    overflow: 'hidden',
  },
  teamPicker: {
    height: Platform.OS === 'ios' ? 180 : 50,
    width: '100%',
  },
  homeTeamDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  homeTeamDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  homeTeamExample: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  homeTeamInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  homeTeamHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    lineHeight: 18,
  },
  homeTeamButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  homeTeamCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  homeTeamCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  homeTeamConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  homeTeamConfirmDisabled: {
    opacity: 0.5,
  },
  homeTeamConfirmText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
