/**
 * Calendario Gare — Export PDF stampabile.
 * 🆕 24/09/2026. Genera un PDF del calendario gare (intera società o singola
 * squadra), con intestazione (logo + nome società + data) e UN'UNICA lista
 * di tutte le gare in ordine cronologico (come il foglio Riepilogo dell'Excel).
 * Segue lo stesso pattern print di fipavPresencesReport.ts
 * (window.open + print su web, expo-print su mobile).
 */
import { Platform } from 'react-native';

export interface MatchRow {
  squadra: string;
  campionato: string;
  casaTrasferta: string;
  avversario: string;
  data: string;
  ora: string;
  impianto: string;
  citta: string;
  ritrovo: string;
  risultato: string;
}

export interface MatchCalendarPDFData {
  societyName: string;
  societyLogo?: string | null; // base64 (con o senza prefisso data:)
  subtitle: string; // descrizione filtri applicati
  rows: MatchRow[]; // 🆕 tutte le gare in ordine cronologico (unica lista, come il Riepilogo Excel)
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

// 🆕 Unica tabella cronologica con tutte le gare (stesso layout del foglio Riepilogo Excel).
const matchesTable = (rows: MatchRow[]): string => {
  const body = rows.length
    ? rows.map((r, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${esc(r.data)}</td>
        <td style="text-align:center;">${esc(r.ora)}</td>
        <td style="text-align:center;">${esc(r.casaTrasferta)}</td>
        <td>${esc(r.squadra)}</td>
        <td>${esc(r.avversario)}</td>
        <td>${esc(r.impianto)}</td>
        <td>${esc(r.citta)}</td>
        <td style="text-align:center;">${esc(r.ritrovo)}</td>
        <td style="text-align:center;">${esc(r.risultato)}</td>
      </tr>`).join('')
    : `<tr><td colspan="10" style="text-align:center; color:#666; font-style:italic;">Nessuna gara</td></tr>`;
  return `<table>
    <thead><tr>
      <th style="width:26px; text-align:center;">#</th>
      <th style="width:78px;">Data</th>
      <th style="width:44px; text-align:center;">Ora</th>
      <th style="width:70px; text-align:center;">Casa/Tras.</th>
      <th style="width:110px;">Squadra</th>
      <th>Avversario</th>
      <th>Impianto</th>
      <th style="width:90px;">Città</th>
      <th style="width:56px; text-align:center;">Ritrovo</th>
      <th style="width:64px; text-align:center;">Risult.</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
};

export const generateMatchCalendarHTML = (d: MatchCalendarPDFData): string => {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const section = `<h2 class="sec">Tutte le gare in ordine cronologico <span class="count">(${d.rows.length} gare)</span></h2>
    ${matchesTable(d.rows)}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=1123">
<title>Calendario Gare — ${esc(d.societyName)}</title>
<style>
  @page { margin: 10mm; size: A4 landscape; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:4mm; font-size:11px; }
  .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #1E3A8A; padding-bottom:10px; margin-bottom:14px; }
  .head .left { display:flex; align-items:center; gap:12px; }
  .head img { max-height:56px; max-width:80px; object-fit:contain; }
  .head h1 { font-size:20px; color:#1E3A8A; }
  .head .sub { font-size:11px; color:#555; margin-top:3px; }
  .head .society { text-align:right; font-size:13px; font-weight:bold; color:#333; }
  .head .society .gen { display:block; font-size:10px; font-weight:normal; color:#888; margin-top:2px; }
  h2.sec { font-size:14px; color:#1E3A8A; margin:16px 0 6px; padding-bottom:4px; border-bottom:1px solid #E5E7EB; }
  h2.sec .count { font-size:11px; color:#888; font-weight:normal; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th, td { border:1px solid #D1D5DB; padding:4px 6px; font-size:10.5px; vertical-align:top; }
  th { background:#1E3A8A; color:#fff; text-align:left; font-size:10px; }
  tbody tr:nth-child(even) { background:#F3F4F6; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .foot { margin-top:20px; font-size:9.5px; color:#888; text-align:center; }
</style></head>
<body>
  <div class="head">
    <div class="left">
      ${d.societyLogo ? `<img src="${logoSrc(d.societyLogo)}" />` : ''}
      <div>
        <h1>Calendario Gare</h1>
        <div class="sub">${esc(d.subtitle)}</div>
      </div>
    </div>
    <div class="society">${esc(d.societyName)}<span class="gen">Generato il ${esc(todayStr)}</span></div>
  </div>

  ${section}

  <div class="foot">Documento generato automaticamente da RegistraTEAM.</div>
</body></html>`;
};

export const downloadMatchCalendarPDF = async (d: MatchCalendarPDFData) => {
  const html = generateMatchCalendarHTML(d);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => { w.print(); };
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${d.fileName}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Calendario Gare', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ html });
      }
    } catch (e) {
      await Print.printAsync({ html });
    }
  }
};
