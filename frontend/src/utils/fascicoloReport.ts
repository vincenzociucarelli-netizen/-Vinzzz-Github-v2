/**
 * Fascicolo personale per il commercialista — PDF.
 * Anagrafica, dati accordo, dichiarazioni (pregresso/previdenza), elenco quietanze
 * del periodo (soglia €5.000 evidenziata) e riepilogo importi da versare + totale.
 */
import { Platform } from 'react-native';

export interface FascicoloReceipt {
  year: number; month: number; month_name: string;
  amount_gross: number; amount_net: number; importo_versare: number;
  receipt_signed: boolean; exceeded_5000: boolean; exceeded_15000: boolean;
}
export interface FascicoloData {
  societyName: string;
  societyLogo?: string | null;
  roleLabel: string;
  anagrafica: {
    full_name: string; fiscal_code: string; birth_date: string; birth_place: string;
    address: string; iban: string; email: string; phone: string;
    other_annual_compensation: number; previdenza_altra: boolean;
    contract_total: number; contract_start: string; contract_end: string;
  };
  receipts: FascicoloReceipt[];
  totals: { total_gross: number; total_versare: number; over_5000: boolean; over_15000: boolean };
  scopeLabel: string;
  fileName: string;
}

const esc = (v: any): string => {
  if (v == null) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
const eur = (n: any): string => `€${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const logoSrc = (l?: string | null) => (!l ? '' : (l.startsWith('data:') ? l : `data:image/jpeg;base64,${l}`));
const infoRow = (l: string, v: string) => (v ? `<tr><td class="lbl">${esc(l)}</td><td class="val">${esc(v)}</td></tr>` : '');

export const generateFascicoloHTML = (d: FascicoloData): string => {
  const a = d.anagrafica;
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const rows = d.receipts.length
    ? d.receipts.map((r) => `
      <tr class="${r.exceeded_5000 ? 'hl' : ''}">
        <td>${esc(r.month_name)} ${r.year}</td>
        <td style="text-align:right;">${eur(r.amount_gross)}</td>
        <td style="text-align:right;">${eur(r.amount_net)}</td>
        <td style="text-align:right;">${r.exceeded_5000 ? eur(r.importo_versare) : '—'}</td>
        <td style="text-align:center;">${r.receipt_signed ? '✔︎' : '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#666;font-style:italic;">Nessuna quietanza nel periodo</td></tr>`;

  const sogliaBadge = d.totals.over_15000
    ? '<span class="badge b15">OLTRE €15.000</span>'
    : (d.totals.over_5000 ? '<span class="badge b5">OLTRE €5.000 — contributi dovuti</span>' : '<span class="badge bok">Sotto soglia</span>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794">
<title>Fascicolo — ${esc(a.full_name)}</title>
<style>
  @page { margin: 12mm; size: A4 portrait; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:4mm; font-size:12px; }
  .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #1E3A8A; padding-bottom:10px; margin-bottom:14px; }
  .head .left { display:flex; align-items:center; gap:12px; }
  .head img { max-height:58px; max-width:88px; object-fit:contain; }
  .head h1 { font-size:20px; color:#1E3A8A; }
  .head .sub { font-size:12px; color:#555; margin-top:3px; }
  .head .society { text-align:right; font-size:13px; font-weight:bold; color:#333; }
  .head .society .gen { display:block; font-size:10px; font-weight:normal; color:#888; margin-top:2px; }
  h2.sec { font-size:13px; color:#1E3A8A; margin:14px 0 6px; padding-bottom:4px; border-bottom:1px solid #E5E7EB; }
  table.info { width:100%; border-collapse:collapse; }
  table.info td { padding:5px 8px; font-size:12px; vertical-align:top; }
  table.info td.lbl { width:170px; color:#555; font-weight:bold; background:#F3F4F6; border:1px solid #E5E7EB; }
  table.info td.val { border:1px solid #E5E7EB; }
  table.rec { width:100%; border-collapse:collapse; }
  table.rec th, table.rec td { border:1px solid #D1D5DB; padding:5px 8px; font-size:12px; }
  table.rec th { background:#1E3A8A; color:#fff; text-align:left; }
  table.rec tr.hl td { background:#FEF3C7; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight:bold; }
  .tot { margin-top:10px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:10px 12px; font-size:13px; }
  .tot b { color:#1E3A8A; }
  .badge { display:inline-block; padding:3px 8px; border-radius:10px; font-size:11px; font-weight:bold; }
  .b5 { background:#FEF3C7; color:#92400E; } .b15 { background:#FEE2E2; color:#991B1B; } .bok { background:#DCFCE7; color:#166534; }
  .foot { margin-top:20px; font-size:10px; color:#888; text-align:center; }
</style></head><body>
  <div class="head">
    <div class="left">
      ${d.societyLogo ? `<img src="${logoSrc(d.societyLogo)}" />` : ''}
      <div><h1>Fascicolo compensi</h1><div class="sub">${esc(a.full_name)} — ${esc(d.roleLabel)} · ${esc(d.scopeLabel)}</div></div>
    </div>
    <div class="society">${esc(d.societyName)}<span class="gen">Generato il ${esc(todayStr)}</span></div>
  </div>

  <h2 class="sec">Anagrafica</h2>
  <table class="info">
    ${infoRow('Nominativo', a.full_name)}
    ${infoRow('Codice fiscale', a.fiscal_code)}
    ${infoRow('Nato/a il', a.birth_date)}
    ${infoRow('Luogo di nascita', a.birth_place)}
    ${infoRow('Residenza', a.address)}
    ${infoRow('IBAN', a.iban)}
    ${infoRow('Email', a.email)}
    ${infoRow('Telefono', a.phone)}
  </table>

  <h2 class="sec">Accordo e dichiarazioni</h2>
  <table class="info">
    ${a.contract_total ? infoRow('Compenso da accordo', eur(a.contract_total)) : ''}
    ${a.contract_start ? infoRow('Inizio accordo', String(a.contract_start).slice(0, 10)) : ''}
    ${a.contract_end ? infoRow('Fine accordo', String(a.contract_end).slice(0, 10)) : ''}
    ${infoRow('Dichiarazione importo pregresso', eur(a.other_annual_compensation))}
    ${infoRow('Altra previdenza obbligatoria', a.previdenza_altra ? 'Sì' : 'No')}
  </table>

  <h2 class="sec">Quietanze del periodo ${sogliaBadge}</h2>
  <table class="rec">
    <thead><tr><th>Mese</th><th style="text-align:right;">Lordo</th><th style="text-align:right;">Netto</th><th style="text-align:right;">Da versare (F24)</th><th style="text-align:center;">Firmata</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="tot">
    Totale compensi lordi del periodo: <b>${eur(d.totals.total_gross)}</b><br/>
    Totale importi da versare (F24): <b>${eur(d.totals.total_versare)}</b>
  </div>

  <div class="foot">Documento generato automaticamente da RegistraTEAM.</div>
</body></html>`;
};

export const downloadFascicoloPDF = async (d: FascicoloData) => {
  const html = generateFascicoloHTML(d);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Fascicolo', UTI: 'com.adobe.pdf' });
      } else { await Print.printAsync({ html }); }
    } catch { await Print.printAsync({ html }); }
  }
};

/** Genera il PDF e ne restituisce il base64 (solo mobile). Su web ritorna null. */
export const fascicoloPdfBase64 = async (d: FascicoloData): Promise<string | null> => {
  if (Platform.OS === 'web') return null;
  const html = generateFascicoloHTML(d);
  const Print = await import('expo-print');
  const FileSystem = await import('expo-file-system');
  const { uri } = await Print.printToFileAsync({ html });
  return await (FileSystem as any).readAsStringAsync(uri, { encoding: 'base64' });
};
