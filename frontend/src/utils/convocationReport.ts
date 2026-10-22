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

// Costruisce il PDF della convocazione nativamente con jsPDF (solo web):
// testo selezionabile, ruoli garantiti dai dati, file piccolo e condivisibile.
const buildConvocationPdf = (JsPDF: any, d: ConvocationPDFData) => {
  const pdf = new JsPDF('p', 'mm', 'a4');
  const PW = 210, PH = 297, M = 12, CW = PW - M * 2;
  let y = M;
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  // Intestazione
  let textX = M;
  if (d.societyLogo) {
    try {
      const src = d.societyLogo.startsWith('data:') ? d.societyLogo : `data:image/jpeg;base64,${d.societyLogo}`;
      const fmt = src.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(src, fmt, M, y, 18, 18);
      textX = M + 22;
    } catch { /* logo opzionale */ }
  }
  pdf.setTextColor(30, 58, 138); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20);
  pdf.text('Convocazione', textX, y + 7);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(85, 85, 85);
  pdf.text(d.teamName || '', textX, y + 13);

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(51, 51, 51);
  pdf.text(d.societyName || '', PW - M, y + 3, { align: 'right' });
  let ry = y + 3;
  if (d.matchNumber) {
    ry += 5; pdf.setTextColor(198, 40, 40); pdf.setFontSize(11);
    pdf.text(`Gara n. ${d.matchNumber}`, PW - M, ry, { align: 'right' });
  }
  ry += 4.5;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(136, 136, 136);
  pdf.text(`Generato il ${todayStr}`, PW - M, ry, { align: 'right' });

  y += 20;
  pdf.setDrawColor(30, 58, 138); pdf.setLineWidth(0.8); pdf.line(M, y, PW - M, y);
  y += 6;

  // Riquadro gara
  const matchTitle = d.homeAway === 'home'
    ? `${d.societyName} - ${d.opponent}`
    : `${d.opponent} - ${d.societyName}`;
  const dateLine = [d.matchDate, d.matchTime].filter(Boolean).join('  -  ');
  const boxH = dateLine ? 16 : 11;
  pdf.setFillColor(238, 242, 255); pdf.setDrawColor(199, 210, 254); pdf.setLineWidth(0.3);
  pdf.roundedRect(M, y, CW, boxH, 2, 2, 'FD');
  pdf.setTextColor(30, 58, 138); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
  pdf.text(matchTitle, M + 4, y + 6, { maxWidth: CW - 8 });
  if (dateLine) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(51, 51, 51);
    pdf.text(dateLine, M + 4, y + 12);
  }
  y += boxH + 5;

  // Tabella info
  const info: { label: string; value: string; link?: string }[] = [];
  info.push({ label: 'Casa/Trasferta', value: d.homeAway === 'home' ? 'Casa' : 'Trasferta' });
  if (d.venue) info.push({ label: 'Impianto', value: d.venue });
  if (d.venueAddress) info.push({ label: 'Indirizzo', value: d.venueAddress });
  if (d.city) info.push({ label: 'Citta', value: d.city });
  if (d.mapsUrl) info.push({ label: 'Mappa', value: 'Apri su Google Maps', link: d.mapsUrl });
  if (d.meetingPlace) info.push({ label: 'Luogo di ritrovo', value: d.meetingPlace });
  if (d.meetingTime) info.push({ label: 'Ora di ritrovo', value: d.meetingTime });
  if (d.startTime) info.push({ label: 'Inizio gara', value: d.startTime });
  if (d.notes) info.push({ label: 'Note', value: d.notes });

  const labelW = 42, valW = CW - labelW;
  for (const r of info) {
    pdf.setFontSize(9);
    const lines = r.link ? [r.value] : pdf.splitTextToSize(r.value, valW - 6);
    const rowH = Math.max(7, lines.length * 4.4 + 2.6);
    pdf.setFillColor(243, 244, 246); pdf.setDrawColor(229, 231, 235); pdf.setLineWidth(0.2);
    pdf.rect(M, y, labelW, rowH, 'FD');
    pdf.setFillColor(255, 255, 255);
    pdf.rect(M + labelW, y, valW, rowH, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(85, 85, 85);
    pdf.text(r.label, M + 2, y + 4.8, { maxWidth: labelW - 3 });
    pdf.setFont('helvetica', 'normal');
    if (r.link) {
      pdf.setTextColor(30, 58, 138);
      pdf.textWithLink(r.value, M + labelW + 3, y + 4.8, { url: r.link });
    } else {
      pdf.setTextColor(17, 17, 17);
      pdf.text(lines, M + labelW + 3, y + 4.8);
    }
    y += rowH;
  }
  y += 5;

  // Avviso
  const alertText = `Attenzione: in caso di impossibilita a partecipare, avvisare immediatamente il coach${d.coachName ? ` (${d.coachName})` : ''}${d.coachPhone ? ` al numero ${d.coachPhone}` : ''} telefonicamente o con un messaggio WhatsApp.`;
  pdf.setFontSize(9);
  const alLines = pdf.splitTextToSize(alertText, CW - 8);
  const alH = alLines.length * 4.4 + 5;
  pdf.setFillColor(255, 243, 224); pdf.setDrawColor(255, 204, 128); pdf.setLineWidth(0.3);
  pdf.roundedRect(M, y, CW, alH, 2, 2, 'FD');
  pdf.setTextColor(146, 64, 14); pdf.setFont('helvetica', 'normal');
  pdf.text(alLines, M + 4, y + 5);
  y += alH + 6;

  // Titolo elenco
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(30, 58, 138);
  pdf.text(`Atleti convocati (${d.athletes.length})`, M, y);
  y += 2;
  pdf.setDrawColor(229, 231, 235); pdf.setLineWidth(0.2); pdf.line(M, y, PW - M, y);
  y += 4;

  // Tabella atleti
  const c0 = 24, c2 = 42, c1 = CW - c0 - c2, rowH = 7;
  const drawHeader = () => {
    pdf.setFillColor(30, 58, 138); pdf.rect(M, y, CW, rowH, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
    pdf.text('N. maglia', M + c0 / 2, y + 4.8, { align: 'center' });
    pdf.text('Atleta', M + c0 + 2, y + 4.8);
    pdf.text('Ruolo', M + c0 + c1 + 2, y + 4.8);
    y += rowH;
  };
  drawHeader();
  pdf.setFont('helvetica', 'normal');
  d.athletes.forEach((a, idx) => {
    if (y + rowH > PH - M) { pdf.addPage(); y = M; drawHeader(); pdf.setFont('helvetica', 'normal'); }
    if (idx % 2 === 1) { pdf.setFillColor(243, 244, 246); pdf.rect(M, y, CW, rowH, 'F'); }
    pdf.setDrawColor(209, 213, 219); pdf.setLineWidth(0.2);
    pdf.rect(M, y, c0, rowH); pdf.rect(M + c0, y, c1, rowH); pdf.rect(M + c0 + c1, y, c2, rowH);
    pdf.setTextColor(17, 17, 17); pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(a.jersey_number || ''), M + c0 / 2, y + 4.8, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(pdf.splitTextToSize(a.full_name || '', c1 - 4)[0] || '', M + c0 + 2, y + 4.8);
    pdf.text(pdf.splitTextToSize(a.role || '', c2 - 4)[0] || '', M + c0 + c1 + 2, y + 4.8);
    y += rowH;
  });
  if (d.athletes.length === 0) {
    pdf.setDrawColor(209, 213, 219); pdf.rect(M, y, CW, rowH);
    pdf.setTextColor(102, 102, 102);
    pdf.text('Nessun atleta convocato', M + CW / 2, y + 4.8, { align: 'center' });
    y += rowH;
  }

  // Footer
  pdf.setFontSize(8); pdf.setTextColor(136, 136, 136);
  pdf.text('Documento generato automaticamente da RegistraTEAM.', PW / 2, Math.min(y + 8, PH - 6), { align: 'center' });

  return pdf;
};

export const downloadConvocationPDF = async (d: ConvocationPDFData) => {
  const fileName = (d.fileName || 'convocazione').replace(/[^a-zA-Z0-9_-]+/g, '_');
  if (Platform.OS === 'web') {
    const { jsPDF } = await import('jspdf');
    const pdf = buildConvocationPdf(jsPDF, d);
    const blob = pdf.output('blob');
    const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });
    const nav = navigator as any;
    // Condivisione del FILE (non di un link blob): su mobile apre il foglio di
    // condivisione e lo allega direttamente a WhatsApp/email, ecc.
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Convocazione' });
        return;
      } catch (err: any) {
        if (err && err.name === 'AbortError') return; // annullato dall'utente
        // altri errori -> fallback al download
      }
    }
    // Fallback (desktop o condivisione file non supportata): scarica il PDF.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fileName}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    const html = generateConvocationHTML(d);
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
