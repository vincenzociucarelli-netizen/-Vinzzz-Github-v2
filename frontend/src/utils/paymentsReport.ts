/**
 * Export pagamenti per il commercialista: CSV + PDF.
 * - Riepilogo mensile dei netti (chi pagare, quanto, firma/bonifico)
 * - Riepilogo annuale per persona (lordo, netto, pagato)
 */
import { Platform } from 'react-native';

const eur = (n: any): string => `€${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (v: any): string => {
  if (v == null) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
const ROLE_LABEL: Record<string, string> = { coach: 'Coach', dirigente: 'Dirigente', collaboratore: 'Collaboratore', athlete: 'Atleta' };

// CSV: valore numerico in formato italiano (virgola decimale) racchiuso tra virgolette per sicurezza
const csvNum = (n: any): string => `"${Number(n || 0).toFixed(2).replace('.', ',')}"`;
const csvStr = (v: any): string => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

/** Scarica/condividi un file di testo (CSV) in modo cross-platform. */
export const downloadTextFile = async (filename: string, content: string, mime = 'text/csv') => {
  if (Platform.OS === 'web') {
    const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const uri = `${(FileSystem as any).cacheDirectory}${filename}`;
    await (FileSystem as any).writeAsStringAsync(uri, '\ufeff' + content, { encoding: 'utf8' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
    }
  }
};

/** Stampa/condividi un documento HTML come PDF, cross-platform. */
export const printHTMLtoPDF = async (html: string, title = 'Documento') => {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
      } else { await Print.printAsync({ html }); }
    } catch { await Print.printAsync({ html }); }
  }
};

// ─────────────────────── RIEPILOGO MENSILE (netti) ───────────────────────
export interface MonthlyRow {
  user_role: string; full_name: string; fiscal_code: string;
  amount_gross: number; amount_net: number; importo_versare: number;
  exceeded_5000: boolean; receipt_signed: boolean; payment_made: boolean;
  estimated?: boolean;
}
export interface MonthlyExport {
  societyName: string; societyLogo?: string | null;
  monthName: string; year: number;
  rows: MonthlyRow[];
  totals: { count: number; total_gross: number; total_versare: number };
}

export const monthlyPaymentsCSV = (d: MonthlyExport): string => {
  const head = ['Nominativo', 'Codice fiscale', 'Ruolo', 'Lordo', 'Netto da pagare', 'Da versare (F24)', 'Bonifico', 'Quietanza firmata'];
  const lines = [head.map(csvStr).join(';')];
  d.rows.forEach(r => {
    lines.push([
      csvStr(r.full_name), csvStr(r.fiscal_code), csvStr(ROLE_LABEL[r.user_role] || r.user_role),
      csvNum(r.amount_gross), csvNum(r.amount_net), csvNum(r.importo_versare),
      csvStr(r.payment_made ? 'Fatto' : 'Da fare'), csvStr(r.receipt_signed ? 'Firmata' : 'Non firmata'),
    ].join(';'));
  });
  const totNet = d.rows.reduce((s, r) => s + Number(r.amount_net || 0), 0);
  lines.push(['', '', 'TOTALI', csvNum(d.totals.total_gross), csvNum(totNet), csvNum(d.totals.total_versare), '', ''].join(';'));
  return lines.join('\r\n');
};

const logoSrc = (l?: string | null) => (!l ? '' : (l.startsWith('data:') ? l : `data:image/jpeg;base64,${l}`));

export const monthlyPaymentsHTML = (d: MonthlyExport): string => {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const totNet = d.rows.reduce((s, r) => s + Number(r.amount_net || 0), 0);
  const rows = d.rows.length
    ? d.rows.map(r => `
      <tr class="${(r.exceeded_5000 || r.importo_versare > 0) ? 'hl' : ''}">
        <td>${esc(r.full_name)}</td>
        <td>${esc(r.fiscal_code)}</td>
        <td>${esc(ROLE_LABEL[r.user_role] || r.user_role)}</td>
        <td style="text-align:right;">${eur(r.amount_gross)}</td>
        <td style="text-align:right;font-weight:bold;">${eur(r.amount_net)}${r.estimated ? ' <span style="color:#8E44AD;font-weight:normal;font-size:9px;">(stima)</span>' : ''}</td>
        <td style="text-align:right;">${r.importo_versare > 0 ? eur(r.importo_versare) + (r.estimated ? ' <span style="color:#8E44AD;font-size:9px;">(stima)</span>' : '') : '—'}</td>
        <td style="text-align:center;">${r.payment_made ? '✔︎' : '—'}</td>
        <td style="text-align:center;">${r.receipt_signed ? '✔︎' : '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="8" style="text-align:center;color:#666;font-style:italic;">Nessun compenso nel mese</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794">
<title>Pagamenti ${esc(d.monthName)} ${d.year}</title>
<style>
  @page { margin: 12mm; size: A4 landscape; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:4mm; font-size:12px; }
  .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #5856D6; padding-bottom:10px; margin-bottom:14px; }
  .head .left { display:flex; align-items:center; gap:12px; }
  .head img { max-height:54px; max-width:84px; object-fit:contain; }
  .head h1 { font-size:19px; color:#5856D6; }
  .head .sub { font-size:12px; color:#555; margin-top:3px; }
  .head .society { text-align:right; font-size:13px; font-weight:bold; color:#333; }
  .head .society .gen { display:block; font-size:10px; font-weight:normal; color:#888; margin-top:2px; }
  table.rec { width:100%; border-collapse:collapse; }
  table.rec th, table.rec td { border:1px solid #D1D5DB; padding:5px 7px; font-size:11.5px; }
  table.rec th { background:#5856D6; color:#fff; text-align:left; }
  table.rec tr.hl td { background:#FEF3C7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tot { margin-top:12px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:10px 12px; font-size:13px; }
  .tot b { color:#1E3A8A; }
  .foot { margin-top:18px; font-size:10px; color:#888; text-align:center; }
</style></head><body>
  <div class="head">
    <div class="left">
      ${d.societyLogo ? `<img src="${logoSrc(d.societyLogo)}" />` : ''}
      <div><h1>Pagamenti del mese</h1><div class="sub">${esc(d.monthName)} ${d.year}</div></div>
    </div>
    <div class="society">${esc(d.societyName)}<span class="gen">Generato il ${esc(todayStr)}</span></div>
  </div>
  <table class="rec">
    <thead><tr>
      <th>Nominativo</th><th>Codice fiscale</th><th>Ruolo</th>
      <th style="text-align:right;">Lordo</th><th style="text-align:right;">Netto da pagare</th>
      <th style="text-align:right;">Da versare (F24)</th><th style="text-align:center;">Bonifico</th><th style="text-align:center;">Firmata</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    Persone con compenso: <b>${d.totals.count}</b> &nbsp;·&nbsp;
    Totale lordo: <b>${eur(d.totals.total_gross)}</b> &nbsp;·&nbsp;
    Totale netto da pagare: <b>${eur(totNet)}</b> &nbsp;·&nbsp;
    Totale da versare (F24): <b>${eur(d.totals.total_versare)}</b>
  </div>
  <div class="foot">${d.rows.some(r => r.estimated) ? 'Gli importi contrassegnati con (stima) sono provvisori e verranno confermati alla firma della quietanza.<br/>' : ''}Documento generato automaticamente da RegistraTEAM.</div>
</body></html>`;
};

// ─────────────────────── RIEPILOGO ANNUALE ───────────────────────
export interface AnnualRow {
  user_role: string; full_name: string; fiscal_code: string;
  months: number; total_gross: number; total_net: number; total_paid: number;
  total_versare: number; exceeded_5000: boolean; exceeded_15000: boolean;
}
export interface AnnualExport {
  societyName: string; societyLogo?: string | null;
  year: number; rows: AnnualRow[];
  totals: { count: number; total_gross: number; total_net: number; total_paid: number; total_versare: number };
}

export const annualSummaryCSV = (d: AnnualExport): string => {
  const head = ['Nominativo', 'Codice fiscale', 'Ruolo', 'Mensilità', 'Totale lordo', 'Totale netto', 'Totale pagato', 'Da versare (F24)', 'Soglia'];
  const lines = [head.map(csvStr).join(';')];
  d.rows.forEach(r => {
    const soglia = r.exceeded_15000 ? 'Oltre 15.000' : (r.exceeded_5000 ? 'Oltre 5.000' : 'Sotto soglia');
    lines.push([
      csvStr(r.full_name), csvStr(r.fiscal_code), csvStr(ROLE_LABEL[r.user_role] || r.user_role),
      csvStr(r.months), csvNum(r.total_gross), csvNum(r.total_net), csvNum(r.total_paid),
      csvNum(r.total_versare), csvStr(soglia),
    ].join(';'));
  });
  lines.push(['', '', 'TOTALI', '', csvNum(d.totals.total_gross), csvNum(d.totals.total_net), csvNum(d.totals.total_paid), csvNum(d.totals.total_versare), ''].join(';'));
  return lines.join('\r\n');
};

export const annualSummaryHTML = (d: AnnualExport): string => {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const rows = d.rows.length
    ? d.rows.map(r => `
      <tr class="${(r.exceeded_5000 || r.total_versare > 0) ? 'hl' : ''}">
        <td>${esc(r.full_name)}</td>
        <td>${esc(r.fiscal_code)}</td>
        <td>${esc(ROLE_LABEL[r.user_role] || r.user_role)}</td>
        <td style="text-align:center;">${r.months}</td>
        <td style="text-align:right;">${eur(r.total_gross)}</td>
        <td style="text-align:right;font-weight:bold;">${eur(r.total_net)}</td>
        <td style="text-align:right;">${eur(r.total_paid)}</td>
        <td style="text-align:right;">${r.total_versare > 0 ? eur(r.total_versare) : '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="8" style="text-align:center;color:#666;font-style:italic;">Nessun compenso nell'anno</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794">
<title>Riepilogo annuale ${d.year}</title>
<style>
  @page { margin: 12mm; size: A4 landscape; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:4mm; font-size:12px; }
  .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #1E3A8A; padding-bottom:10px; margin-bottom:14px; }
  .head .left { display:flex; align-items:center; gap:12px; }
  .head img { max-height:54px; max-width:84px; object-fit:contain; }
  .head h1 { font-size:19px; color:#1E3A8A; }
  .head .sub { font-size:12px; color:#555; margin-top:3px; }
  .head .society { text-align:right; font-size:13px; font-weight:bold; color:#333; }
  .head .society .gen { display:block; font-size:10px; font-weight:normal; color:#888; margin-top:2px; }
  table.rec { width:100%; border-collapse:collapse; }
  table.rec th, table.rec td { border:1px solid #D1D5DB; padding:5px 7px; font-size:11.5px; }
  table.rec th { background:#1E3A8A; color:#fff; text-align:left; }
  table.rec tr.hl td { background:#FEF3C7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tot { margin-top:12px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:10px 12px; font-size:13px; }
  .tot b { color:#1E3A8A; }
  .foot { margin-top:18px; font-size:10px; color:#888; text-align:center; }
</style></head><body>
  <div class="head">
    <div class="left">
      ${d.societyLogo ? `<img src="${logoSrc(d.societyLogo)}" />` : ''}
      <div><h1>Riepilogo annuale compensi</h1><div class="sub">Anno ${d.year}</div></div>
    </div>
    <div class="society">${esc(d.societyName)}<span class="gen">Generato il ${esc(todayStr)}</span></div>
  </div>
  <table class="rec">
    <thead><tr>
      <th>Nominativo</th><th>Codice fiscale</th><th>Ruolo</th><th style="text-align:center;">Mesi</th>
      <th style="text-align:right;">Totale lordo</th><th style="text-align:right;">Totale netto</th>
      <th style="text-align:right;">Totale pagato</th><th style="text-align:right;">Da versare (F24)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    Persone: <b>${d.totals.count}</b> &nbsp;·&nbsp;
    Totale lordo anno: <b>${eur(d.totals.total_gross)}</b> &nbsp;·&nbsp;
    Totale netto anno: <b>${eur(d.totals.total_net)}</b> &nbsp;·&nbsp;
    Totale pagato: <b>${eur(d.totals.total_paid)}</b> &nbsp;·&nbsp;
    Da versare (F24): <b>${eur(d.totals.total_versare)}</b>
  </div>
  <div class="foot">Documento generato automaticamente da RegistraTEAM.</div>
</body></html>`;
};
