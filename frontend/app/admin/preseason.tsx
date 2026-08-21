import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, Alert, Platform, Linking, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';

// ⚡ PERF 15/08/2026 — La lista campagne NON include più il base64 della copertina
// (era la causa dei ~30s di caricamento). La thumbnail usa l'endpoint /cover.jpg
// compresso (JPEG ~280KB, cacheable). has_cover indica se la copertina esiste.
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const campaignCoverUri = (c: any): string =>
  c && c.has_cover ? `${BACKEND_URL}/api/preseason/public/${c.id}/cover.jpg` : '';

// 🆕 30/06/2026 — Renderer mini-markdown per la lista admin: trasforma
// [label](url) e URL grezzi (http/https/mailto/tel) in <Text onPress>
// cliccabili (Linking.openURL). Stesso comportamento di /preseason/[id].
function renderRichText(input?: string, linkStyle?: any) {
  if (!input) return null;
  const out: React.ReactNode[] = [];
  const combined = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\))|(https?:\/\/[^\s)]+)/gi;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = combined.exec(input)) !== null) {
    if (m.index > lastIdx) {
      out.push(<React.Fragment key={`t${key++}`}>{input.substring(lastIdx, m.index)}</React.Fragment>);
    }
    if (m[1]) {
      const label = m[2];
      const url = m[3];
      out.push(
        <Text
          key={`l${key++}`}
          style={linkStyle || { color: '#1565C0', textDecorationLine: 'underline', fontWeight: '700' }}
          onPress={() => Linking.openURL(url)}
        >
          {label}
        </Text>
      );
    } else if (m[4]) {
      const url = m[4];
      out.push(
        <Text
          key={`u${key++}`}
          style={linkStyle || { color: '#1565C0', textDecorationLine: 'underline', fontWeight: '700' }}
          onPress={() => Linking.openURL(url)}
        >
          {url}
        </Text>
      );
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < input.length) {
    out.push(<React.Fragment key={`t${key++}`}>{input.substring(lastIdx)}</React.Fragment>);
  }
  return out;
}

interface Campaign {
  id: string;
  title: string;
  season: string;
  description: string;
  event_info?: string;  // 🆕 27/02/2026 — Info aggiuntive admin (es. indicazioni Open Day, contatti, orari)
  cover_image?: string;  // 🆕 27/02/2026 — Immagine copertina per anteprima social (data URI base64)
  has_cover?: boolean;   // ⚡ 15/08/2026 — flag dalla lista (base64 non trasferito per performance)
  is_active: boolean;
  open_date?: string;
  close_date?: string;
  response_count: number;
  created_at: string;
  auto_reminders_enabled?: boolean;
  reminder_frequency_days?: number;
  last_auto_reminder_sent?: string;
  auto_reminder_count?: number;
  last_notification_sent?: string;
  notification_count?: number;
}

interface ResponseItem {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone_athlete: string;
  phone_parent: string;
  already_member: boolean;
  previous_club: string;
  played_volleyball?: boolean | null;
  played_at_school?: boolean;
  played_in_society?: boolean;
  years_in_society?: string;
  previous_sport?: string;
  championships_played: string;
  role_played: string;
  interest_level: string;
  notes: string;
  source: string;
  created_at: string;
}

interface Stats {
  total: number;
  interested: number;
  thinking: number;
  not_interested: number;
  existing_members: number;
  new_athletes: number;
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') { alert(`${title}\n${message}`); }
  else { Alert.alert(title, message); }
};

// Auto-formatta input data come gg/mm/aaaa mentre l'utente digita
const formatDateInput = (text: string): string => {
  const digits = (text || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// Converte data ISO (YYYY-MM-DD o YYYY-MM-DDTHH:..) in formato italiano gg/mm/aaaa
const isoToItalianDate = (iso?: string | null): string => {
  if (!iso) return '';
  const datePart = String(iso).split('T')[0];
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Se è già in formato italiano, restituisci così com'è
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) return datePart;
  return '';
};

// Converte data italiana gg/mm/aaaa in ISO YYYY-MM-DD per il backend.
// Restituisce null se incompleta/invalida.
const italianToIsoDate = (it: string): string | null => {
  if (!it) return null;
  const m = it.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

export default function PreseasonAdmin() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedResponse, setSelectedResponse] = useState<ResponseItem | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [togglingReminders, setTogglingReminders] = useState<string | null>(null);
  // 🆕 27/02/2026 — Anteprima social (WhatsApp/Facebook simulation) prima della condivisione
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [societyName, setSocietyName] = useState<string>('');
  const [societyLogo, setSocietyLogo] = useState<string>('');
  // 🆕 16/07/2026 — Card collassabili: mostro SOLO l'header compatto (thumb+titolo)
  // e nascondo descrizione/azioni finché l'admin non tocca "Espandi". Così con più
  // eventi aperti la lista resta corta e leggibile.
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };


  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEventInfo, setNewEventInfo] = useState('');  // 🆕 27/02/2026
  // 🆕 27/02/2026 — Immagine di copertina campagna (base64 data URI) per anteprima social
  const [newCoverImage, setNewCoverImage] = useState('');
  // 🐛 18/08/2026 — In MODIFICA inviamo cover_image nel PATCH SOLO se l'utente l'ha
  // effettivamente cambiata/rimossa. Prima veniva inviata sempre (anche vuota) e,
  // se il base64 non era ancora stato ricaricato, azzerava la copertina esistente
  // (causa delle anteprime evento sparite nei link WhatsApp).
  const [coverChanged, setCoverChanged] = useState(false);

  // 🆕 29/06/2026 — Ref per textarea (necessari per leggere selectionStart su Web)
  const eventInfoRef = useRef<TextInput | null>(null);
  const descRef = useRef<TextInput | null>(null);

  // 🆕 30/06/2026 — Helper UNICO per inserire link in Info evento O Descrizione.
  // Migliorato: prompt esplicativi, validazione URL e default svuotati per non
  // generare per sbaglio link `[qui](https://)` rotti.
  const insertLinkInto = (
    fieldKey: 'description' | 'event_info',
    currentValue: string,
    setValue: (v: string) => void,
    nodeRef: React.MutableRefObject<TextInput | null>,
  ) => {
    if (Platform.OS !== 'web') {
      window.alert?.('Il pulsante link è disponibile solo da browser desktop/web.');
      return;
    }
    let selectionStart = currentValue.length;
    let selectionEnd = currentValue.length;
    let selectedText = '';
    const node = nodeRef.current as any;
    if (node && typeof node.selectionStart === 'number') {
      selectionStart = node.selectionStart ?? currentValue.length;
      selectionEnd = node.selectionEnd ?? selectionStart;
      selectedText = currentValue.substring(selectionStart, selectionEnd);
    }
    // 1) Testo del link — DEFAULT = testo selezionato dall'utente (se c'è)
    //    oppure stringa VUOTA (così l'utente non rischia di confermare "qui").
    const t = window.prompt('1/2 — Scrivi il testo che vuoi rendere cliccabile (es. clicca qui per la mappa):', selectedText);
    if (t === null) return; // annullato
    const testo = (t || '').trim();
    if (!testo) {
      window.alert('Il testo non può essere vuoto. Operazione annullata.');
      return;
    }
    // 2) URL — DEFAULT VUOTO (l'utente DEVE incollare l'URL completo).
    const u = window.prompt(`2/2 — Incolla qui l'URL completo del link (deve iniziare con https://, http://, mailto: o tel:):`, '');
    if (u === null) return;
    let url = (u || '').trim();
    if (!url) {
      window.alert('URL non valido. Operazione annullata.');
      return;
    }
    // Auto-prefix https:// se l'utente ha incollato solo "goo.gl/maps/abc"
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
      url = 'https://' + url.replace(/^\/+/, '');
    }
    // Validazione minima: deve contenere almeno un punto (dominio) E avere
    // qualcosa dopo il protocollo (no "https://" da solo).
    const afterProto = url.replace(/^https?:\/\/|^mailto:|^tel:/i, '');
    if (afterProto.length < 3 || (!url.startsWith('mailto:') && !url.startsWith('tel:') && !/\./.test(afterProto))) {
      window.alert(`URL "${url}" non valido. Inserisci un indirizzo completo (es. https://goo.gl/maps/...). Operazione annullata.`);
      return;
    }
    const insert = `[${testo}](${url})`;
    const next = currentValue.substring(0, selectionStart) + insert + currentValue.substring(selectionEnd);
    setValue(next);
    // Riposiziona il cursore subito DOPO il link inserito
    setTimeout(() => {
      if (node && typeof node.setSelectionRange === 'function') {
        const pos = selectionStart + insert.length;
        try { node.focus(); node.setSelectionRange(pos, pos); } catch {}
      }
    }, 0);
  };

  const insertEventInfoLink = () => insertLinkInto('event_info', newEventInfo, setNewEventInfo, eventInfoRef);
  const insertDescriptionLink = () => insertLinkInto('description', newDesc, setNewDesc, descRef);
  const [newOpenDate, setNewOpenDate] = useState('');
  const [newCloseDate, setNewCloseDate] = useState('');
  const [creating, setCreating] = useState(false);

  const [sendingNotifications, setSendingNotifications] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/preseason/campaigns');
      setCampaigns(res.data);
    } catch (err) {
      console.log('Error loading campaigns', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // 🆕 27/02/2026 — Precarica nome + logo società per l'Anteprima social
  useEffect(() => {
    (async () => {
      try {
        // include_images=true perché serve il logo base64 per la preview
        const res = await api.get('/settings/society?include_images=true');
        setSocietyName(res.data?.name || res.data?.ragione_sociale || '');
        // 🐛 27/02/2026 — Il logo nel DB spesso è raw base64 SENZA prefisso "data:image/*;base64,".
        // <Image source={{uri: ...}}> richiede un data URI valido, altrimenti render vuoto ("?").
        const raw = res.data?.logo || '';
        const normalized = raw && !raw.startsWith('data:')
          ? `data:image/png;base64,${raw}`
          : raw;
        setSocietyLogo(normalized);
      } catch {}
    })();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSeason.trim()) {
      showAlert('Errore', 'Inserisci titolo e stagione');
      return;
    }

    // Valida e converte data chiusura italiana gg/mm/aaaa in ISO per il backend
    const closeIso = newCloseDate.trim() ? italianToIsoDate(newCloseDate.trim()) : null;
    if (newCloseDate.trim() && !closeIso) {
      showAlert('Errore', 'Data di chiusura non valida. Usa il formato gg/mm/aaaa');
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        title: newTitle.trim(),
        season: newSeason.trim(),
        description: newDesc.trim(),
        event_info: newEventInfo.trim() || null,
        open_date: null,
        close_date: closeIso,
      };
      // 🐛 18/08/2026 — Includi cover_image SOLO in creazione oppure se l'utente
      // l'ha davvero cambiata in modifica. In modifica senza modifiche alla
      // copertina, NON inviarla: il PATCH (exclude_unset) la lascia intatta.
      if (!editingId || coverChanged) {
        payload.cover_image = newCoverImage || '';
      }
      if (editingId) {
        await api.patch(`/preseason/campaigns/${editingId}`, payload);
      } else {
        await api.post('/preseason/campaigns', payload);
      }
      setShowCreate(false);
      setEditingId(null);
      setNewTitle(''); setNewSeason(''); setNewDesc(''); setNewEventInfo(''); setNewOpenDate(''); setNewCloseDate('');
      setNewCoverImage('');
      setCoverChanged(false);
      loadCampaigns();
      showAlert('Successo', editingId ? 'Campagna aggiornata!' : 'Campagna creata!');
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    } finally {
      setCreating(false);
    }
  };

  // 🆕 Apre il modal in modalità "modifica" pre-popolando i campi
  const handleOpenEdit = async (campaign: Campaign) => {
    setEditingId(campaign.id);
    setNewTitle(campaign.title || '');
    setNewSeason(campaign.season || '');
    setNewDesc(campaign.description || '');
    setNewEventInfo(campaign.event_info || '');
    setNewOpenDate(isoToItalianDate(campaign.open_date));
    setNewCloseDate(isoToItalianDate(campaign.close_date));
    setShowCreate(true);
    setCoverChanged(false);
    // ⚡ 15/08/2026 — La lista non porta più il base64 della copertina (performance).
    // In modifica lo recuperiamo dal dettaglio (solo per l'ANTEPRIMA nel modal).
    // Il salvataggio NON invia cover_image a meno che coverChanged sia true,
    // quindi anche se questo fetch fallisce la copertina non viene mai cancellata.
    if (campaign.has_cover) {
      setNewCoverImage('');
      try {
        const res = await api.get(`/preseason/campaigns/${campaign.id}`);
        setNewCoverImage((res.data as any)?.cover_image || '');
      } catch { /* se fallisce, l'utente può ri-caricare l'immagine */ }
    } else {
      setNewCoverImage('');
    }
  };

  // 🆕 27/02/2026 — Picker immagine di copertina (Web + Native).
  const handlePickCoverImage = async () => {
    try {
      if (Platform.OS === 'web') {
        // Su Web usiamo un input file nativo (più affidabile di ImagePicker sul browser)
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          // ⚡ 18/08/2026 — Comprimi SEMPRE lato client (canvas): ridimensiona a max
          // 1200px lato lungo e riesporta in JPEG. Così qualsiasi locandina (anche
          // da diversi MB) diventa un payload leggero (~200-400KB) e l'upload non
          // fallisce più al proxy/su Render. Niente più blocco "immagine troppo grande".
          try {
            const dataUri = await new Promise<string>((resolve, reject) => {
              const rd = new FileReader();
              rd.onerror = () => reject(new Error('read'));
              rd.onload = () => {
                const im = new (window as any).Image();
                im.onerror = () => reject(new Error('img'));
                im.onload = () => {
                  const maxDim = 1200;
                  let { width, height } = im;
                  if (Math.max(width, height) > maxDim) {
                    if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
                    else { width = Math.round(width * maxDim / height); height = maxDim; }
                  }
                  const canvas = document.createElement('canvas');
                  canvas.width = width; canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) { reject(new Error('ctx')); return; }
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, width, height);
                  ctx.drawImage(im, 0, 0, width, height);
                  resolve(canvas.toDataURL('image/jpeg', 0.82));
                };
                im.src = String(rd.result || '');
              };
              rd.readAsDataURL(file);
            });
            setNewCoverImage(dataUri);
            setCoverChanged(true);
          } catch (e) {
            showAlert('Errore', 'Impossibile elaborare l\'immagine. Riprova con un altro file.');
          }
        };
        input.click();
        return;
      }
      // Native: expo-image-picker
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        showAlert('Permesso negato', 'Serve accesso alla galleria per caricare l\'immagine.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
        aspect: [1200, 630],
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const dataUri = `data:image/${asset.uri.endsWith('.png') ? 'png' : 'jpeg'};base64,${asset.base64}`;
        setNewCoverImage(dataUri);
        setCoverChanged(true);
      }
    } catch (e: any) {
      showAlert('Errore', 'Impossibile caricare l\'immagine: ' + (e?.message || 'errore sconosciuto'));
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    // 🐛 27/02/2026 — Aggiunta conferma prima di chiudere/riaprire.
    // Chiudere una campagna attiva blocca nuove iscrizioni → richiede conferma.
    const isClosing = campaign.is_active;
    const confirm = Platform.OS === 'web'
      ? window.confirm(
          isClosing
            ? `Vuoi CHIUDERE la campagna "${campaign.title}"?\n\nI nuovi utenti non potranno più iscriversi. Le risposte già ricevute rimarranno visibili. Potrai riaprirla in qualsiasi momento.`
            : `Vuoi RIAPRIRE la campagna "${campaign.title}"?\n\nGli utenti potranno di nuovo iscriversi.`
        )
      : await new Promise(resolve => Alert.alert(
          isClosing ? 'Chiudi campagna' : 'Riapri campagna',
          isClosing
            ? `Chiudere "${campaign.title}"? I nuovi utenti non potranno più iscriversi.`
            : `Riaprire "${campaign.title}"?`,
          [
            { text: 'Annulla', onPress: () => resolve(false) },
            { text: isClosing ? 'Chiudi' : 'Riapri', style: isClosing ? 'destructive' : 'default', onPress: () => resolve(true) },
          ]
        ));
    if (!confirm) return;
    try {
      await api.patch(`/preseason/campaigns/${campaign.id}`, { is_active: !campaign.is_active });
      loadCampaigns();
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    }
  };

  const handleToggleReminders = async (campaign: Campaign) => {
    const newEnabled = !campaign.auto_reminders_enabled;
    setTogglingReminders(campaign.id);
    try {
      await api.patch(`/preseason/campaigns/${campaign.id}`, { 
        auto_reminders_enabled: newEnabled,
        reminder_frequency_days: campaign.reminder_frequency_days || 7,
      });
      loadCampaigns();
      showAlert(
        newEnabled ? 'Promemoria Attivati' : 'Promemoria Disattivati',
        newEnabled 
          ? `I genitori che non hanno risposto riceveranno un promemoria automatico ogni ${campaign.reminder_frequency_days || 7} giorni.`
          : 'I promemoria automatici sono stati disattivati.'
      );
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    } finally {
      setTogglingReminders(null);
    }
  };

  const handleChangeFrequency = async (campaign: Campaign, days: number) => {
    try {
      await api.patch(`/preseason/campaigns/${campaign.id}`, { reminder_frequency_days: days });
      loadCampaigns();
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    }
  };

  const handleSendNotifications = async (campaign: Campaign) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Inviare email e notifiche ai genitori che non hanno ancora risposto per "${campaign.title}"?`)
      : await new Promise(resolve => Alert.alert('Invia Notifiche', `Inviare email ai genitori che non hanno risposto?`, [
          { text: 'Annulla', onPress: () => resolve(false) },
          { text: 'Invia', onPress: () => resolve(true) },
        ]));
    if (!confirm) return;
    
    setSendingNotifications(campaign.id);
    try {
      const res = await api.post(`/preseason/campaigns/${campaign.id}/send-notifications`);
      const d = res.data;
      showAlert('Notifiche Inviate', `${d.notified_count} genitori notificati (${d.email_sent} email inviate).\n${d.already_responded_count} avevano gia risposto su ${d.total_parents} totali.`);
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore invio notifiche');
    } finally {
      setSendingNotifications(null);
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    // 🐛 27/02/2026 — Doppia conferma per eliminazione permanente:
    //   Step 1: confirm dialog generico
    //   Step 2: l'admin deve DIGITARE il titolo della campagna (pattern GitHub)
    // Evita eliminazioni accidentali di campagne con risposte reali.
    const step1 = Platform.OS === 'web'
      ? window.confirm(`⚠️ 1/2 — Eliminare definitivamente "${campaign.title}"?\n\nQuesta operazione:\n• Cancella la campagna\n• Cancella TUTTE le ${campaign.response_count || 0} risposte ricevute\n• Non è reversibile\n\nProcedi solo se sei certa/o.`)
      : await new Promise(resolve => Alert.alert('Conferma 1/2', `Eliminare "${campaign.title}"? Cancellerà anche tutte le risposte.`, [
          { text: 'Annulla', onPress: () => resolve(false) },
          { text: 'Continua', style: 'destructive', onPress: () => resolve(true) },
        ]));
    if (!step1) return;
    
    // Step 2: typing confirmation (solo Web ha window.prompt affidabile)
    if (Platform.OS === 'web') {
      const typed = window.prompt(
        `⚠️ 2/2 — Per confermare, digita esattamente il titolo della campagna:\n\n"${campaign.title}"`,
        ''
      );
      if (typed === null) return; // annullato
      if ((typed || '').trim() !== campaign.title.trim()) {
        showAlert('Eliminazione annullata', 'Il titolo digitato non corrisponde. La campagna NON è stata eliminata.');
        return;
      }
    } else {
      const step2 = await new Promise(resolve => Alert.alert(
        'Conferma finale 2/2',
        `Sei DAVVERO sicura/o di voler eliminare "${campaign.title}"? Verranno cancellate anche tutte le risposte.`,
        [
          { text: 'Annulla', onPress: () => resolve(false) },
          { text: 'Elimina definitivamente', style: 'destructive', onPress: () => resolve(true) },
        ]
      ));
      if (!step2) return;
    }
    
    try {
      await api.delete(`/preseason/campaigns/${campaign.id}`);
      loadCampaigns();
      if (selectedCampaign?.id === campaign.id) { setSelectedCampaign(null); setResponses([]); setStats(null); }
      showAlert('Eliminata', `Campagna "${campaign.title}" eliminata.`);
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    }
  };

  const viewResponses = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoadingResponses(true);
    try {
      const res = await api.get(`/preseason/campaigns/${campaign.id}/responses`);
      setResponses(res.data.responses);
      setStats(res.data.stats);
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleExport = async (campaignId: string) => {
    try {
      const res = await api.get(`/preseason/campaigns/${campaignId}/export`, { responseType: 'blob' });
      if (Platform.OS === 'web') {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preiscrizioni_${campaignId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      showAlert('Errore', 'Errore durante l\'esportazione');
    }
  };

  const getPublicLink = (campaignId: string) => {
    // Use the backend /api/preseason/share/{id} endpoint so WhatsApp/social crawlers
    // get the dynamic OpenGraph preview with the society name & logo. Regular users
    // are auto-redirected to the SPA route /preseason/{id}.
    // IMPORTANT: in production Vercel rewrites ALL paths to index.html, so /api/* on
    // the frontend domain returns "Unmatched Route". We MUST point to the backend
    // (Render) URL directly via EXPO_PUBLIC_BACKEND_URL.
    const backend = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
    const baseUrl = backend || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${baseUrl}/api/preseason/share/${campaignId}`;
  };

  const copyLink = (campaignId: string) => {
    const link = getPublicLink(campaignId);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showAlert('Copiato!', 'Link copiato negli appunti. Condividilo su WhatsApp o social!');
    }
  };

  const interestLabel = (level: string) => {
    switch (level) {
      case 'si': return { text: 'Interessato', color: '#2E7D32', bg: '#E8F5E9' };
      case 'ci_penso': return { text: 'Ci pensa', color: '#F57F17', bg: '#FFF8E1' };
      case 'no': return { text: 'No', color: '#C62828', bg: '#FFEBEE' };
      default: return { text: level, color: '#666', bg: '#F5F5F5' };
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} data-testid="preseason-back-btn">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0D47A1' }}>EVENTI IN PROGRAMMA</Text>
        </View>
      </View>

      {/* Campaigns List — 🆕 27/02/2026 divisi in "In programma" (attivi) e "Scaduti/Chiusi" */}
      {campaigns.length === 0 ? (
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center' }}>
          <Ionicons name="megaphone-outline" size={48} color="#CCC" />
          <Text style={{ fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' }}>
            Nessuna campagna creata. Crea la tua prima campagna di pre-iscrizione!
          </Text>
        </View>
      ) : (
        (() => {
          // 🆕 27/02/2026 — Un evento è "scaduto" se:
          //   - is_active === false, OPPURE
          //   - close_date è passata (data limite superata)
          const now = new Date();
          const isExpired = (c: Campaign): boolean => {
            if (!c.is_active) return true;
            if (c.close_date) {
              try {
                const cd = new Date(c.close_date);
                if (!isNaN(cd.getTime()) && cd < now) return true;
              } catch {}
            }
            return false;
          };
          const active = campaigns.filter(c => !isExpired(c));
          const expired = campaigns.filter(c => isExpired(c));

          const renderCard = (c: Campaign) => {
            const isExpanded = expandedCards.has(c.id);
            return (
            <View key={c.id} style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: c.is_active ? '#2E7D32' : '#999', overflow: 'hidden' }}>
            {/* 🆕 27/02/2026 — Cover image + titolo cliccabili → apre modal di modifica */}
            {/* 🆕 27/02/2026 — Layout compatto: thumbnail cover 72x72 a sinistra +
                titolo/stagione a destra. Con più eventi aperti si riduce il "caos". */}
            {/* 🆕 16/07/2026 — Tap sull'header espande/comprime la card. La chevron
                indica lo stato. Il tap NON apre più la modal di modifica: c'è il
                bottone dedicato "Modifica" (visibile quando espanso). */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => toggleExpanded(c.id)}
              data-testid={`campaign-toggle-${c.id}`}
            >
              <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center', gap: 12 }}>
                {campaignCoverUri(c) ? (
                  <Image
                    source={{ uri: campaignCoverUri(c) }}
                    style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: '#f0f0f0' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="megaphone" size={30} color="#1565C0" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1565C0', letterSpacing: 0.3 }}>
                      Stagione {c.season}
                    </Text>
                    <View style={{
                      backgroundColor: c.is_active ? '#E8F5E9' : '#F5F5F5',
                      borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: c.is_active ? '#2E7D32' : '#999' }}>
                        {c.is_active ? 'ATTIVA' : 'CHIUSA'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0D47A1', marginTop: 3 }} numberOfLines={2} data-testid={`campaign-title-${c.id}`}>{c.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="people" size={13} color="#666" />
                      <Text style={{ fontSize: 12, color: '#666', fontWeight: '600' }}>{c.response_count} risposte</Text>
                    </View>
                    {c.close_date ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={13} color="#666" />
                        <Text style={{ fontSize: 12, color: '#666' }}>chiude {new Date(c.close_date).toLocaleDateString('it-IT')}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#999" />
              </View>
            </TouchableOpacity>
            {isExpanded && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>

            {/* Descrizione mostrata a chi si iscrive */}
            {c.description ? (
              <View style={{ marginTop: 10, backgroundColor: '#F8F9FB', borderLeftWidth: 3, borderLeftColor: '#1565C0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, color: '#333', lineHeight: 20 }} data-testid={`campaign-description-${c.id}`}>
                  {/* 🆕 30/06/2026 — Link cliccabili nella descrizione */}
                  {renderRichText(c.description)}
                </Text>
              </View>
            ) : null}

            {/* 🆕 27/02/2026 — Info evento (Open Day, indicazioni) */}
            {(c as any).event_info ? (
              <View style={{ marginTop: 8, backgroundColor: '#FFF8E1', borderLeftWidth: 3, borderLeftColor: '#F9A825', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="information-circle" size={14} color="#F9A825" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#7A5D00' }}>Info evento</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#5D4400', lineHeight: 18 }} data-testid={`campaign-event-info-${c.id}`}>
                  {/* 🆕 30/06/2026 — Link cliccabili anche su info evento */}
                  {renderRichText((c as any).event_info, { color: '#1565C0', textDecorationLine: 'underline', fontWeight: '700' })}
                </Text>
              </View>
            ) : null}

            {/* Stats row — 🆕 27/02/2026 rimossa (spostata nell'header compatto sopra).
                Manteniamo solo il badge "genitori mancanti" quando rilevante. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {/* 🐛 27/02/2026 — Il badge "genitori mancanti" ha senso SOLO dopo
                  che l'admin ha inviato almeno una notifica ai genitori esistenti.
                  Per campagne pre-iscrizione open-day (rivolte a famiglie NUOVE
                  senza account), il conteggio dei "parent" della società è fuorviante. */}
              {c.last_notification_sent && (c as any).missing_parents > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Ionicons name="alert-circle" size={16} color="#E65100" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#E65100' }}>
                    {(c as any).missing_parents} {(c as any).missing_parents === 1 ? 'genitore ancora' : 'genitori ancora'} da notificare
                  </Text>
                </View>
              )}
              {c.last_notification_sent && (c as any).missing_parents === 0 && (c as any).total_parents > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E7D32' }}>Tutti notificati</Text>
                </View>
              )}
              {c.created_at && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="time-outline" size={16} color="#2E7D32" />
                  <Text style={{ fontSize: 13, color: '#2E7D32', fontWeight: '600' }}>
                    {(() => {
                      const days = Math.max(0, Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000));
                      if (days === 0) return 'Aperta oggi';
                      if (days === 1) return 'Aperta da 1 giorno';
                      return `Aperta da ${days} giorni`;
                    })()}
                  </Text>
                </View>
              )}
              {c.close_date && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="calendar" size={16} color="#555" />
                  <Text style={{ fontSize: 13, color: '#555' }}>
                    Scade: {new Date(c.close_date).toLocaleDateString('it-IT')}
                  </Text>
                </View>
              )}
              {c.last_notification_sent && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="notifications" size={16} color="#6A1B9A" />
                  <Text style={{ fontSize: 13, color: '#6A1B9A' }}>
                    Notifiche: {c.notification_count || 0}x
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F2FD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => viewResponses(c)}
                data-testid={`view-responses-${c.id}`}
              >
                <Ionicons name="list" size={16} color="#1565C0" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1565C0' }}>Risposte</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => handleExport(c.id)}
                data-testid={`export-${c.id}`}
              >
                <Ionicons name="download-outline" size={16} color="#2E7D32" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E7D32' }}>CSV</Text>
              </TouchableOpacity>
              {c.is_active && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDE7F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, opacity: sendingNotifications === c.id ? 0.6 : 1 }}
                  onPress={() => handleSendNotifications(c)}
                  disabled={sendingNotifications === c.id}
                  data-testid={`send-notifications-${c.id}`}
                >
                  {sendingNotifications === c.id ? (
                    <ActivityIndicator size={16} color="#6A1B9A" />
                  ) : (
                    <Ionicons name="notifications-outline" size={16} color="#6A1B9A" />
                  )}
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#6A1B9A' }}>Notifica</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => copyLink(c.id)}
                data-testid={`copy-link-${c.id}`}
              >
                <Ionicons name="link" size={16} color="#E65100" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#E65100' }}>Link</Text>
              </TouchableOpacity>
              {/* 🆕 27/02/2026 — Anteprima social (simulazione WhatsApp/Facebook) */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3E5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => setPreviewCampaign(c)}
                data-testid={`preview-campaign-${c.id}`}
              >
                <Ionicons name="eye-outline" size={16} color="#6A1B9A" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6A1B9A' }}>Anteprima</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => handleToggleActive(c)}
                data-testid={`toggle-active-${c.id}`}
              >
                <Ionicons name={c.is_active ? 'pause' : 'play'} size={16} color="#666" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#666' }}>{c.is_active ? 'Chiudi' : 'Riapri'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3F2FD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => handleOpenEdit(c)}
                data-testid={`edit-campaign-${c.id}`}
              >
                <Ionicons name="create-outline" size={16} color="#1565C0" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1565C0' }}>Modifica</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFEBEE', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                onPress={() => handleDelete(c)}
                data-testid={`delete-campaign-${c.id}`}
              >
                <Ionicons name="trash-outline" size={16} color="#C62828" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#C62828' }}>Elimina</Text>
              </TouchableOpacity>
            </View>

            {/* Auto-Reminders Section */}
            {c.is_active && (
              <View style={{ marginTop: 14, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="alarm-outline" size={18} color={c.auto_reminders_enabled ? '#E65100' : '#999'} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.auto_reminders_enabled ? '#E65100' : '#666' }}>
                      Promemoria automatici
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: c.auto_reminders_enabled ? '#E65100' : '#DDD',
                      borderRadius: 14, width: 52, height: 28, justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}
                    onPress={() => handleToggleReminders(c)}
                    disabled={togglingReminders === c.id}
                    data-testid={`toggle-reminders-${c.id}`}
                  >
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
                      alignSelf: c.auto_reminders_enabled ? 'flex-end' : 'flex-start',
                    }} />
                  </TouchableOpacity>
                </View>
                {c.auto_reminders_enabled && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 13, color: '#555', marginBottom: 8, fontWeight: '600' }}>Frequenza invio:</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {[3, 5, 7, 14].map(days => (
                        <TouchableOpacity
                          key={days}
                          style={{
                            backgroundColor: (c.reminder_frequency_days || 7) === days ? '#E65100' : '#EEE',
                            borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
                          }}
                          onPress={() => handleChangeFrequency(c, days)}
                        >
                          <Text style={{
                            fontSize: 13, fontWeight: '700',
                            color: (c.reminder_frequency_days || 7) === days ? '#fff' : '#555',
                          }}>
                            {days} giorni
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {c.last_auto_reminder_sent && (
                      <Text style={{ fontSize: 13, color: '#555', marginTop: 10, lineHeight: 18 }}>
                        Ultimo invio: {new Date(c.last_auto_reminder_sent).toLocaleDateString('it-IT')} ({c.auto_reminder_count || 0}x)
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
          )}
          </View>
          );
          };

          return (
            <>
              {active.length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7D32', marginTop: 4, marginBottom: 10, letterSpacing: 0.5 }}>
                    IN PROGRAMMA · {active.length}
                  </Text>
                  {active.map(renderCard)}
                </>
              )}
              {expired.length > 0 && (
                <>
                  <View style={{ marginTop: 20, marginBottom: 10, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#F9A825' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#7A5D00', letterSpacing: 0.5 }}>
                      ⏰ SCADUTI / CHIUSI · {expired.length}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#5D4400', marginTop: 4, lineHeight: 16 }}>
                      Per riattivare un evento: espandi la card e premi {'"'}Modifica{'"'}, aggiorna la data di chiusura e/o rimetti {'"'}Attiva{'"'}.
                    </Text>
                  </View>
                  {expired.map(renderCard)}
                </>
              )}
            </>
          );
        })()
      )}

      {/* Responses View */}
      {/* 🐛 27/02/2026 — Wrappato in Modal così l'admin vede subito le risposte
          quando clicca "Risposte" (prima il pannello era in fondo alla pagina
          e su mobile risultava invisibile → sembrava non funzionare). */}
      {selectedCampaign && (
        <Modal visible={true} animationType="slide" transparent={false} onRequestClose={() => { setSelectedCampaign(null); setResponses([]); setStats(null); setActiveFilter('all'); }}>
          <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0D47A1' }}>
              Risposte: {selectedCampaign.title}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedCampaign(null); setResponses([]); setStats(null); setActiveFilter('all'); }}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Stats cards - clickable filters */}
          {stats && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <StatCard label="Totali" value={stats.total} color="#1565C0" bg="#E3F2FD" active={activeFilter === 'all'} onPress={() => setActiveFilter(activeFilter === 'all' ? 'all' : 'all')} />
              <StatCard label="Interessati" value={stats.interested} color="#2E7D32" bg="#E8F5E9" active={activeFilter === 'interested'} onPress={() => setActiveFilter(activeFilter === 'interested' ? 'all' : 'interested')} />
              <StatCard label="Ci pensano" value={stats.thinking} color="#F57F17" bg="#FFF8E1" active={activeFilter === 'thinking'} onPress={() => setActiveFilter(activeFilter === 'thinking' ? 'all' : 'thinking')} />
              <StatCard label="No" value={stats.not_interested} color="#C62828" bg="#FFEBEE" active={activeFilter === 'no'} onPress={() => setActiveFilter(activeFilter === 'no' ? 'all' : 'no')} />
              <StatCard label="Gia iscritti" value={stats.existing_members} color="#6A1B9A" bg="#F3E5F5" active={activeFilter === 'existing'} onPress={() => setActiveFilter(activeFilter === 'existing' ? 'all' : 'existing')} />
              <StatCard label="Nuovi" value={stats.new_athletes} color="#00695C" bg="#E0F2F1" active={activeFilter === 'new'} onPress={() => setActiveFilter(activeFilter === 'new' ? 'all' : 'new')} />
            </View>
          )}

          {loadingResponses ? (
            <ActivityIndicator size="large" color="#1565C0" />
          ) : responses.length === 0 ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#999' }}>Nessuna risposta ancora.</Text>
            </View>
          ) : (
            responses.filter((r) => {
              if (activeFilter === 'all') return true;
              if (activeFilter === 'interested') return r.interest_level === 'si';
              if (activeFilter === 'thinking') return r.interest_level === 'ci_penso';
              if (activeFilter === 'no') return r.interest_level === 'no';
              if (activeFilter === 'existing') return r.already_member === true;
              if (activeFilter === 'new') return r.already_member === false;
              return true;
            }).length === 0 ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#999' }}>Nessuna risposta per questo filtro.</Text>
              </View>
            ) : responses.filter((r) => {
              if (activeFilter === 'all') return true;
              if (activeFilter === 'interested') return r.interest_level === 'si';
              if (activeFilter === 'thinking') return r.interest_level === 'ci_penso';
              if (activeFilter === 'no') return r.interest_level === 'no';
              if (activeFilter === 'existing') return r.already_member === true;
              if (activeFilter === 'new') return r.already_member === false;
              return true;
            }).map((r) => {
              const il = interestLabel(r.interest_level);
              return (
                <TouchableOpacity key={r.id} onPress={() => setSelectedResponse(r)} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: il.color }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>
                      {r.last_name} {r.first_name}
                    </Text>
                    <View style={{ backgroundColor: il.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: il.color }}>{il.text}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                    <Text style={{ fontSize: 11, color: '#666' }}>Nato/a: {r.birth_date}</Text>
                    {r.phone_athlete ? <Text style={{ fontSize: 11, color: '#666' }}>Tel: {r.phone_athlete}</Text> : null}
                    {r.phone_parent ? <Text style={{ fontSize: 11, color: '#666' }}>Gen: {r.phone_parent}</Text> : null}
                    <Text style={{ fontSize: 11, color: r.already_member ? '#2E7D32' : '#E65100', fontWeight: '600' }}>
                      {r.already_member ? 'Gia iscritto' : 'Nuovo'}
                    </Text>
                  </View>
                  {(r.championships_played || r.role_played || r.previous_club || r.played_volleyball !== undefined) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                      {r.played_volleyball === true && (
                        <Text style={{ fontSize: 11, color: '#1565C0', fontWeight: '600' }}>
                          Pallavolo: {[r.played_at_school ? 'Scuola' : '', r.played_in_society ? `Societa${r.years_in_society ? ` (${r.years_in_society} anni)` : ''}` : ''].filter(Boolean).join(', ') || 'Si'}
                        </Text>
                      )}
                      {r.played_volleyball === false && r.previous_sport && (
                        <Text style={{ fontSize: 11, color: '#888' }}>Sport precedente: {r.previous_sport}</Text>
                      )}
                      {r.played_volleyball === false && !r.previous_sport && (
                        <Text style={{ fontSize: 11, color: '#888' }}>Nessuna esperienza pallavolo</Text>
                      )}
                      {r.championships_played ? <Text style={{ fontSize: 11, color: '#888' }}>Campionati: {r.championships_played}</Text> : null}
                      {r.role_played ? <Text style={{ fontSize: 11, color: '#888' }}>Ruolo: {r.role_played}</Text> : null}
                      {r.previous_club ? <Text style={{ fontSize: 11, color: '#888' }}>Da: {r.previous_club}</Text> : null}
                    </View>
                  )}
                  {r.notes ? <Text style={{ fontSize: 11, color: '#aaa', marginTop: 4, fontStyle: 'italic' }}>Note: {r.notes}</Text> : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
        </ScrollView>
        </View>
        </Modal>
      )}

      {/* 🆕 27/02/2026 — Modal Anteprima social (simulazione WhatsApp + Facebook)
          Mostra all'admin come apparirà la card di anteprima nei principali social
          PRIMA di condividere il link. Dati letti dagli OG tags configurati sul
          backend endpoint /api/preseason/share/{id}. */}
      {previewCampaign && (
        <Modal visible={true} animationType="fade" transparent onRequestClose={() => setPreviewCampaign(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '92%' }}>
              {/* Header */}
              <View style={{ backgroundColor: '#6A1B9A', paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="eye-outline" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Anteprima condivisione</Text>
                </View>
                <TouchableOpacity onPress={() => setPreviewCampaign(null)} style={{ padding: 4 }} data-testid="preview-close-btn">
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 16 }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  Ecco come apparirà il tuo link quando lo condividi. Se qualcosa non ti convince, torna alla campagna e modifica titolo/descrizione/info evento.
                </Text>
                {/* WhatsApp bubble simulation */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#25D366', marginTop: 12, marginBottom: 6 }}>
                  💬 Come appare su WhatsApp
                </Text>
                <View style={{ backgroundColor: '#DCF8C6', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#c7e6b4' }}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' }}>
                    {campaignCoverUri(previewCampaign) || societyLogo ? (
                      <Image source={{ uri: campaignCoverUri(previewCampaign) || societyLogo }} style={{ width: '100%', height: 140, backgroundColor: '#f0f0f0' }} resizeMode={campaignCoverUri(previewCampaign) ? 'cover' : 'contain'} />
                    ) : (
                      <View style={{ width: '100%', height: 140, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={40} color="#bbb" />
                      </View>
                    )}
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a2e' }} numberOfLines={2}>
                        {(previewCampaign.title || societyName || 'Titolo campagna') + ((previewCampaign as any).season ? ` — Stagione ${(previewCampaign as any).season}` : '')}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#555', marginTop: 4 }} numberOfLines={3}>
                        {previewCampaign.description || 'Descrizione della campagna...'}
                        {(previewCampaign as any).event_info ? `\n\n📅 ${(previewCampaign as any).event_info}` : ''}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 6 }} numberOfLines={1}>
                        {(getPublicLink(previewCampaign.id) || '').replace(/^https?:\/\//, '')}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Facebook card simulation */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1877F2', marginTop: 16, marginBottom: 6 }}>
                  📘 Come appare su Facebook / Telegram
                </Text>
                <View style={{ backgroundColor: '#F0F2F5', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' }}>
                  {campaignCoverUri(previewCampaign) || societyLogo ? (
                    <Image source={{ uri: campaignCoverUri(previewCampaign) || societyLogo }} style={{ width: '100%', height: 200, backgroundColor: '#fff' }} resizeMode={campaignCoverUri(previewCampaign) ? 'cover' : 'contain'} />
                  ) : (
                    <View style={{ width: '100%', height: 200, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="image-outline" size={50} color="#bbb" />
                    </View>
                  )}
                  <View style={{ padding: 12, backgroundColor: '#F7F8FA', borderTopWidth: 1, borderTopColor: '#e4e6eb' }}>
                    <Text style={{ fontSize: 11, color: '#65676B', textTransform: 'uppercase' }} numberOfLines={1}>
                      {(getPublicLink(previewCampaign.id) || '').replace(/^https?:\/\//, '').split('/')[0]}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#050505', marginTop: 3 }} numberOfLines={2}>
                      {(previewCampaign.title || societyName) + ((previewCampaign as any).season ? ` — Stagione ${(previewCampaign as any).season}` : '')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#65676B', marginTop: 3 }} numberOfLines={3}>
                      {previewCampaign.description || ''}
                      {(previewCampaign as any).event_info ? `\n📅 ${(previewCampaign as any).event_info}` : ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#8a8d91', marginTop: 3 }}>
                      {societyName || 'Società Sportiva'}
                    </Text>
                  </View>
                </View>
                {/* Hint */}
                <View style={{ marginTop: 14, backgroundColor: '#FFF8E1', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#FBC02D' }}>
                  <Text style={{ fontSize: 11, color: '#795548', lineHeight: 16 }}>
                    ⚠️ Le anteprime social possono metterci qualche minuto ad aggiornarsi. Se hai appena modificato titolo o descrizione e la vedi ancora {'"'}vecchia{'"'} su WhatsApp, forza il refresh su{' '}
                    <Text style={{ fontWeight: '700' }}>developers.facebook.com/tools/debug</Text>.
                  </Text>
                </View>
                {/* Copy link button */}
                <TouchableOpacity
                  style={{ marginTop: 14, backgroundColor: '#6A1B9A', borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onPress={() => { copyLink(previewCampaign.id); }}
                  data-testid="preview-copy-link-btn"
                >
                  <Ionicons name="copy-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Copia link e condividi</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Response Detail Modal */}
      {selectedResponse && (
        <Modal visible={true} animationType="fade" transparent onRequestClose={() => setSelectedResponse(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90%' }}>
              <View style={{ backgroundColor: '#0D47A1', paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 }}>
                  {selectedResponse.last_name} {selectedResponse.first_name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedResponse(null)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 16 }}>
                {/* Interest level badge */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ backgroundColor: interestLabel(selectedResponse.interest_level).bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: interestLabel(selectedResponse.interest_level).color }}>
                      {interestLabel(selectedResponse.interest_level).text}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: selectedResponse.already_member ? '#2E7D32' : '#E65100', fontWeight: '700' }}>
                    {selectedResponse.already_member ? 'Gia iscritto' : 'Nuovo'}
                  </Text>
                </View>

                {/* Anagrafica */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 8 }}>Dati Personali</Text>
                <View style={{ backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <DetailRow label="Nome" value={`${selectedResponse.first_name} ${selectedResponse.last_name}`} />
                  <DetailRow label="Data di nascita" value={selectedResponse.birth_date} />
                  {selectedResponse.phone_athlete ? <DetailRow label="Telefono atleta" value={selectedResponse.phone_athlete} /> : null}
                  {selectedResponse.phone_parent ? <DetailRow label="Telefono genitore" value={selectedResponse.phone_parent} /> : null}
                </View>

                {/* Esperienza */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 8 }}>Esperienza Sportiva</Text>
                <View style={{ backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  {selectedResponse.played_volleyball === true && (
                    <>
                      <DetailRow label="Pallavolo" value="Si" />
                      {selectedResponse.played_at_school && <DetailRow label="A scuola" value="Si" />}
                      {selectedResponse.played_in_society && <DetailRow label="In societa" value={selectedResponse.years_in_society ? `Si (${selectedResponse.years_in_society} anni)` : 'Si'} />}
                      {selectedResponse.championships_played ? <DetailRow label="Campionati" value={selectedResponse.championships_played} /> : null}
                      {selectedResponse.role_played ? <DetailRow label="Ruolo" value={selectedResponse.role_played} /> : null}
                    </>
                  )}
                  {selectedResponse.played_volleyball === false && (
                    <>
                      <DetailRow label="Pallavolo" value="No" />
                      {selectedResponse.previous_sport ? <DetailRow label="Sport praticato" value={selectedResponse.previous_sport} /> : null}
                    </>
                  )}
                </View>

                {/* Note */}
                {selectedResponse.notes ? (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 8 }}>Note</Text>
                    <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                      <Text style={{ fontSize: 13, color: '#555', fontStyle: 'italic' }}>{selectedResponse.notes}</Text>
                    </View>
                  </>
                ) : null}

                {/* Data invio */}
                {selectedResponse.created_at && (
                  <Text style={{ fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 8 }}>
                    Inviato il: {new Date(selectedResponse.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}

                {/* Pulsante WhatsApp — contatta la famiglia iscritta all'evento */}
                {(() => {
                  const rawPhone = selectedResponse.phone_parent || selectedResponse.phone_athlete;
                  if (!rawPhone) return null;
                  const digits = String(rawPhone).replace(/\D/g, '');
                  const phoneWithCountry = digits.startsWith('39') ? digits : `39${digits}`;
                  const waLabel = selectedResponse.phone_parent ? 'WhatsApp Genitore' : 'WhatsApp Atleta';
                  return (
                    <TouchableOpacity
                      testID="preseason-whatsapp-btn"
                      onPress={() => Linking.openURL(`https://wa.me/${phoneWithCountry}`)}
                      style={{ backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 4 }}
                    >
                      <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{waLabel}</Text>
                    </TouchableOpacity>
                  );
                })()}

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 16 }}>
                  {Platform.OS === 'web' && (
                    <TouchableOpacity 
                      onPress={() => {
                        const r = selectedResponse;
                        const il = interestLabel(r.interest_level);
                        const text = `PRE-ISCRIZIONE\n\nNome: ${r.first_name} ${r.last_name}\nData nascita: ${r.birth_date}\n${r.phone_athlete ? 'Tel atleta: ' + r.phone_athlete + '\n' : ''}${r.phone_parent ? 'Tel genitore: ' + r.phone_parent + '\n' : ''}Interesse: ${il.text}\nStato: ${r.already_member ? 'Gia iscritto' : 'Nuovo'}\n${r.played_volleyball === true ? 'Pallavolo: Si\n' : r.played_volleyball === false ? 'Pallavolo: No\n' : ''}${r.previous_sport ? 'Sport precedente: ' + r.previous_sport + '\n' : ''}${r.previous_club ? 'Club precedente: ' + r.previous_club + '\n' : ''}${r.championships_played ? 'Campionati: ' + r.championships_played + '\n' : ''}${r.role_played ? 'Ruolo: ' + r.role_played + '\n' : ''}${r.notes ? 'Note: ' + r.notes : ''}`;
                        if (navigator.share) {
                          navigator.share({ title: `Pre-iscrizione ${r.first_name} ${r.last_name}`, text });
                        } else {
                          navigator.clipboard.writeText(text);
                          alert('Copiato negli appunti!');
                        }
                      }}
                      style={{ flex: 1, backgroundColor: '#1565C0', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="share-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Condividi</Text>
                    </TouchableOpacity>
                  )}
                  {Platform.OS === 'web' && (
                    <TouchableOpacity 
                      onPress={() => { window.print(); }}
                      style={{ flex: 1, backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="print-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Stampa</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Create Campaign Modal */}
      <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => { setShowCreate(false); setEditingId(null); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#0D47A1', paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {editingId ? 'Modifica Campagna Pre-iscrizione' : 'Nuova Campagna Pre-iscrizione'}
              </Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); setEditingId(null); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={true}>
              <Text style={lbl}>Titolo *</Text>
              <TextInput style={inp} value={newTitle} onChangeText={setNewTitle} placeholder="Es: Pre-iscrizione 2026/2027" data-testid="new-campaign-title" />

              <Text style={lbl}>Stagione *</Text>
              <TextInput style={inp} value={newSeason} onChangeText={setNewSeason} placeholder="Es: 2026/2027" data-testid="new-campaign-season" />

              <Text style={lbl}>Descrizione</Text>
              <Text style={{ fontSize: 12, color: '#777', marginTop: -2, marginBottom: 6, lineHeight: 16 }}>
                Questo testo viene mostrato a chi si iscrive: scrivi qualcosa di accogliente e chiaro.
              </Text>
              {/* 🆕 30/06/2026 — Toolbar inserimento link anche su Descrizione
                  (richiesto perché spesso l'URL della mappa va in descrizione). */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                <TouchableOpacity
                  onPress={insertDescriptionLink}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F2FD', borderColor: '#1976D2', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                  data-testid="description-add-link-btn"
                >
                  <Ionicons name="link" size={14} color="#1976D2" />
                  <Text style={{ color: '#1976D2', fontWeight: '700', fontSize: 12 }}>Aggiungi link</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 11, color: '#999', flex: 1 }}>
                  Seleziona una parola e premi “Aggiungi link”
                </Text>
              </View>
              <TextInput
                ref={descRef}
                style={[inp, { minHeight: 130, height: 130, textAlignVertical: 'top', paddingTop: 10, paddingBottom: 10 }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Es. Ciao! Ti proponiamo una pre-iscrizione non vincolante per organizzare al meglio la prossima stagione."
                placeholderTextColor="#AAA"
                multiline
                numberOfLines={6}
                data-testid="new-campaign-desc"
              />

              {/* 🆕 27/02/2026 — Campo Info Evento (es. Open Day, indicazioni stradali, contatti) */}
              <Text style={lbl}>📌 Info evento (opzionale)</Text>
              <Text style={{ fontSize: 12, color: '#777', marginTop: -2, marginBottom: 6, lineHeight: 16 }}>
                Informazioni aggiuntive per i partecipanti (es. indicazioni Open Day, contatti, orari, materiale da portare). Visibile a chi si iscrive in un riquadro evidenziato.
              </Text>
              {/* 🆕 29/06/2026 — Toolbar inserimento link.
                  Su Web: prompt testo+URL e inserisce [testo](url) markdown
                  alla posizione corrente / sulla selezione. Sul pubblico il
                  segnaposto viene reso come link cliccabile (vedi /preseason/[id]). */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                <TouchableOpacity
                  onPress={insertEventInfoLink}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F2FD', borderColor: '#1976D2', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                  data-testid="event-info-add-link-btn"
                >
                  <Ionicons name="link" size={14} color="#1976D2" />
                  <Text style={{ color: '#1976D2', fontWeight: '700', fontSize: 12 }}>Aggiungi link</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 11, color: '#999', flex: 1 }}>
                  Seleziona prima il testo, poi premi “Aggiungi link”
                </Text>
              </View>
              <TextInput
                ref={eventInfoRef}
                style={[inp, { minHeight: 100, height: 100, textAlignVertical: 'top', paddingTop: 10, paddingBottom: 10 }]}
                value={newEventInfo}
                onChangeText={setNewEventInfo}
                placeholder="Es. OPEN DAY 7 LUGLIO ore 17:30 presso il Palazzetto Comunale (Via Roma 12). Portare scarpe da ginnastica e bottiglia d'acqua. Info: 333-1234567"
                placeholderTextColor="#AAA"
                multiline
                numberOfLines={5}
                data-testid="new-campaign-event-info"
              />

              {/* 🆕 27/02/2026 — Immagine di copertina per anteprima social */}
              <Text style={lbl}>🖼️ Immagine di copertina (opzionale)</Text>
              <Text style={{ fontSize: 12, color: '#777', marginTop: -2, marginBottom: 8, lineHeight: 16 }}>
                Banner mostrato quando qualcuno condivide il link su WhatsApp/Facebook/Telegram. Dimensione consigliata <Text style={{ fontWeight: '700' }}>1200×630 px</Text> (max 3 MB). Se non caricata, viene usato il logo della società.
              </Text>
              {newCoverImage ? (
                <View style={{ marginBottom: 10 }}>
                  <Image source={{ uri: newCoverImage }} style={{ width: '100%', aspectRatio: 1200 / 630, borderRadius: 10, backgroundColor: '#f0f0f0' }} resizeMode="cover" />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={handlePickCoverImage}
                      style={{ flex: 1, backgroundColor: '#E3F2FD', borderColor: '#1976D2', borderWidth: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      data-testid="cover-image-change-btn"
                    >
                      <Ionicons name="refresh" size={16} color="#1976D2" />
                      <Text style={{ color: '#1976D2', fontWeight: '700', fontSize: 13 }}>Cambia</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setNewCoverImage(''); setCoverChanged(true); }}
                      style={{ flex: 1, backgroundColor: '#FFEBEE', borderColor: '#C62828', borderWidth: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      data-testid="cover-image-remove-btn"
                    >
                      <Ionicons name="trash-outline" size={16} color="#C62828" />
                      <Text style={{ color: '#C62828', fontWeight: '700', fontSize: 13 }}>Rimuovi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePickCoverImage}
                  style={{ borderWidth: 2, borderColor: '#c8c8c8', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 26, alignItems: 'center', marginBottom: 10, backgroundColor: '#FAFAFA' }}
                  data-testid="cover-image-upload-btn"
                >
                  <Ionicons name="image-outline" size={32} color="#888" />
                  <Text style={{ color: '#555', fontWeight: '700', fontSize: 13, marginTop: 6 }}>Carica immagine copertina</Text>
                  <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>JPG o PNG · max 3 MB</Text>
                </TouchableOpacity>
              )}

              <View>
                <Text style={lbl}>Data chiusura</Text>
                <TextInput
                  style={inp}
                  value={newCloseDate}
                  onChangeText={(t) => setNewCloseDate(formatDateInput(t))}
                  placeholder="gg/mm/aaaa"
                  placeholderTextColor="#AAA"
                  keyboardType="numeric"
                  inputMode="numeric"
                  maxLength={10}
                  data-testid="new-campaign-close"
                />
              </View>
              <Text style={{ fontSize: 12, color: '#777', marginTop: 6, lineHeight: 16 }}>
                Inserisci solo i numeri: le barre vengono aggiunte automaticamente (es. 01092026 → 01/09/2026).{'\n'}
                La campagna è attiva dal momento della creazione fino alla data di chiusura.
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: creating ? '#90CAF9' : '#0D47A1',
                  borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8,
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                }}
                onPress={handleCreate}
                disabled={creating}
                data-testid="confirm-create-campaign"
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="megaphone" size={18} color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {creating ? (editingId ? 'Salvataggio...' : 'Creazione...') : (editingId ? 'Salva Modifiche' : 'Crea Campagna')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Floating Action Button - Nuova Campagna */}
    <TouchableOpacity
      style={{
        position: 'absolute',
        right: 20,
        bottom: 24,
        backgroundColor: '#0D47A1',
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 100,
      }}
      onPress={() => { setEditingId(null); setNewTitle(''); setNewSeason(''); setNewDesc(''); setNewEventInfo(''); setNewOpenDate(''); setNewCloseDate(''); setNewCoverImage(''); setCoverChanged(false); setShowCreate(true); }}
      data-testid="create-campaign-btn"
    >
      <Ionicons name="add-circle" size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Nuova Campagna</Text>
    </TouchableOpacity>
    </View>
  );
}

function StatCard({ label, value, color, bg, active, onPress }: { label: string; value: number; color: string; bg: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 80, alignItems: 'center', borderWidth: active ? 2 : 0, borderColor: active ? color : 'transparent', opacity: active === false ? 0.5 : 1 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color, marginTop: 2 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const lbl: any = { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 10 };
const inp: any = {
  borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  fontSize: 14, color: '#333', backgroundColor: '#FAFAFA',
};


function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
      <Text style={{ fontSize: 12, color: '#888', flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: '#333', fontWeight: '600', flex: 1, textAlign: 'right' }}>{value || '-'}</Text>
    </View>
  );
}