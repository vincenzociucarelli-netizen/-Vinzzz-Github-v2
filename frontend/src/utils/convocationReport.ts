/**
 * Convocazione — Export PDF stampabile.
 * Genera un PDF della convocazione gara (logo + nome società in alto, dettagli
 * gara, ritrovo/orari, note e l'elenco degli atleti convocati).
 * Stesso pattern print di matchCalendarReport.ts (window.open+print su web,
 * expo-print su mobile).
 */
import { Platform } from 'react-native';

export interface ConvocationAthlete {
  id: string;
  full_name: string;
  role?: string;
  jersey_number?: string;
}

export interface ConvocationPDFData {
  societyName: string;
  societyLogo?: string | null; // base64 (con o senza prefisso data:)
  teamName: string;
  opponent: string;
  matchNumber?: string;
  homeAway: string; // 'home' | 'away'
  matchDate: string;
  matchTime: string;
  venue: string;
  city: string;
  meetingPlace: string;
  meetingTime: string;
  startTime: string;
  notes: string;
  venueAddress?: string;
  mapsUrl?: string;
  coachName?: string;
  coachPhone?: string;
  athletes: ConvocationAthlete[];
  fileName: string;
}

const esc = (v: string | undefined | null): string => {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const logoSrc = (logo?: string | null): string => {
  if (!logo) return '';
  return logo.startsWith('data:') ? logo : `data:image/jpeg;base64,${logo}`;
};

const row = (label: string, value: string): string =>
  value ? `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>` : '';

export const generateConvocationHTML = (d: ConvocationPDFData): string => {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const matchTitle = d.homeAway === 'home'
    ? `${esc(d.societyName)} &ndash; ${esc(d.opponent)}`
    : `${esc(d.opponent)} &ndash; ${esc(d.societyName)}`;
  const dateLine = [d.matchDate, d.matchTime].filter(Boolean).join(' · ');

  const athletesRows = d.athletes.length
    ? d.athletes.map((a) => `
      <tr>
        <td style="text-align:center; font-weight:bold;">${esc(a.jersey_number || '')}</td>
        <td>${esc(a.full_name)}</td>
        <td>${esc(a.role || '')}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center; color:#666; font-style:italic;">Nessun atleta convocato</td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794">
<title>Convocazione — ${esc(d.teamName)}</title>
<style>
  @page { margin: 12mm; size: A4 portrait; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:4mm; font-size:12px; }
  .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #1E3A8A; padding-bottom:10px; margin-bottom:16px; }
  .head .left { display:flex; align-items:center; gap:12px; }
  .head img { max-height:60px; max-width:90px; object-fit:contain; }
  .head h1 { font-size:22px; color:#1E3A8A; }
  .head .sub { font-size:12px; color:#555; margin-top:3px; }
  .head .society { text-align:right; font-size:13px; font-weight:bold; color:#333; }
  .head .society .gen { display:block; font-size:10px; font-weight:normal; color:#888; margin-top:2px; }
  .head .society .gara { display:block; font-size:13px; font-weight:bold; color:#C62828; margin-top:3px; }
  .matchbox { background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:12px 14px; margin-bottom:14px; }
  .matchbox .vs { font-size:17px; font-weight:bold; color:#1E3A8A; }
  .matchbox .when { font-size:13px; color:#333; margin-top:4px; }
  table.info { width:100%; border-collapse:collapse; margin-bottom:16px; }
  table.info td { padding:5px 8px; font-size:12px; vertical-align:top; }
  table.info td.lbl { width:160px; color:#555; font-weight:bold; background:#F3F4F6; border:1px solid #E5E7EB; }
  table.info td.val { border:1px solid #E5E7EB; }
  h2.sec { font-size:14px; color:#1E3A8A; margin:6px 0 6px; padding-bottom:4px; border-bottom:1px solid #E5E7EB; }
  .alert { background:#FFF3E0; border:1px solid #FFCC80; border-radius:8px; padding:10px 12px; margin-bottom:16px; font-size:12px; color:#92400E; }
  table.ath { width:100%; border-collapse:collapse; }
  table.ath th, table.ath td { border:1px solid #D1D5DB; padding:5px 8px; font-size:12px; text-align:left; }
  table.ath th { background:#1E3A8A; color:#fff; }
  table.ath tbody tr:nth-child(even) { background:#F3F4F6; }
  .foot { margin-top:22px; font-size:10px; color:#888; text-align:center; }
</style></head>
<body>
  <div class="head">
    <div class="left">
      ${d.societyLogo ? `<img src="${logoSrc(d.societyLogo)}" />` : ''}
      <div>
        <h1>Convocazione</h1>
        <div class="sub">${esc(d.teamName)}</div>
      </div>
    </div>
    <div class="society">${esc(d.societyName)}${d.matchNumber ? `<span class="gara">Gara n. ${esc(d.matchNumber)}</span>` : ''}<span class="gen">Generato il ${esc(todayStr)}</span></div>
  </div>

  <div class="matchbox">
    <div class="vs">${matchTitle}</div>
    ${dateLine ? `<div class="when">📅 ${esc(dateLine)}</div>` : ''}
  </div>

  <table class="info">
    ${row('Casa/Trasferta', d.homeAway === 'home' ? 'Casa' : 'Trasferta')}
    ${row('Impianto', d.venue)}
    ${row('Indirizzo', d.venueAddress || '')}
    ${row('Città', d.city)}
    ${d.mapsUrl ? `<tr><td class="lbl">Mappa</td><td class="val"><a href="${esc(d.mapsUrl)}" style="color:#1E3A8A;">📍 Apri su Google Maps</a></td></tr>` : ''}
    ${row('Luogo di ritrovo', d.meetingPlace)}
    ${row('Ora di ritrovo', d.meetingTime)}
    ${row('Inizio gara', d.startTime)}
    ${row('Note', d.notes)}
  </table>

  <div class="alert">
    ⚠️ In caso di impossibilità a partecipare, avvisare <strong>immediatamente il coach</strong>${d.coachName ? ` (${esc(d.coachName)})` : ''}${d.coachPhone ? ` al numero <strong>${esc(d.coachPhone)}</strong>` : ''} telefonicamente o con un messaggio WhatsApp.
  </div>

  <h2 class="sec">Atleti convocati <span style="font-size:11px; color:#888; font-weight:normal;">(${d.athletes.length})</span></h2>
  <table class="ath">
    <thead><tr><th style="width:44px; text-align:center;">N° maglia</th><th>Atleta</th><th style="width:140px;">Ruolo</th></tr></thead>
    <tbody>${athletesRows}</tbody>
  </table>

  <div class="foot">Documento generato automaticamente da RegistraTEAM.</div>
</body></html>`;
};

export const downloadConvocationPDF = async (d: ConvocationPDFData) => {
  const html = generateConvocationHTML(d);
  if (Platform.OS === 'web') {
    // Stampa affidabile tramite iframe nascosto (niente blocco popup): dalla
    // finestra di stampa si può scegliere "Salva come PDF" = download del PDF.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(html); doc.close();
      const win = iframe.contentWindow as Window;
      const run = () => {
        try { win.focus(); win.print(); } catch { /* noop */ }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 1500);
      };
      if (doc.readyState === 'complete') setTimeout(run, 350);
      else { win.onload = () => setTimeout(run, 350); }
    }
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Convocazione', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      await Print.printAsync({ html });
    }
  }
};
