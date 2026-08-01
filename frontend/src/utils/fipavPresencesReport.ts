/**
 * FIPAV — Riepilogo Presenze Gara (camp3) stampabile.
 * 🆕 01/08/2026. Genera un PDF/HTML del registro presenze datato dell'atleta,
 * utile in caso di controlli federali. Segue lo stesso pattern print di
 * medicalVisitRequest.ts (window.open + print su web, expo-print su mobile).
 */
import { Platform } from 'react-native';

export interface FipavPresenceRow {
  date: string; // YYYY-MM-DD
  championship: string;
  level: 'upper' | 'category' | string;
}

export interface FipavReportData {
  athleteName: string;
  birthYear?: string | null;
  gender?: string | null;
  societyName?: string;
  upperPresences: number;
  weeklyMax: number;
  violationWeeks: { week_start: string; week_end: string; count: number }[];
  presences: FipavPresenceRow[];
  categoryChampionships: string[];
  killswitchDate: string;
  blocked: boolean;
}

const esc = (v: string | undefined | null): string => {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const itDate = (iso?: string): string => {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const p = s.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return s;
};

export const generateFipavPresencesHTML = (d: FipavReportData): string => {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const rows = [...(d.presences || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rowsHtml = rows.length
    ? rows.map((r, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${esc(itDate(r.date))}</td>
        <td>${esc(r.championship)}</td>
        <td style="text-align:center;">
          <span class="badge ${r.level === 'upper' ? 'sup' : 'cat'}">${r.level === 'upper' ? 'Serie Superiore' : 'Categoria'}</span>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center; color:#666; font-style:italic;">Nessun ingresso registrato</td></tr>`;

  const violHtml = (d.violationWeeks || []).length
    ? `<div class="warn">⚠ Superato il limite di 3 gare/settimana in: ${(d.violationWeeks || [])
        .map(w => `${esc(itDate(w.week_start))}–${esc(itDate(w.week_end))} (${w.count} gare)`).join(', ')}</div>`
    : '';

  const blockedHtml = d.blocked
    ? `<div class="warn">🚫 Atleta bloccato dal campionato inferiore (raggiunta soglia o post killswitch ${esc(d.killswitchDate)}).</div>`
    : '';

  const upperColor = d.upperPresences >= 11 ? '#DC2626' : (d.upperPresences >= 10 ? '#EA580C' : '#059669');
  const weekColor = d.weeklyMax > 3 ? '#DC2626' : (d.weeklyMax === 3 ? '#EA580C' : '#059669');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794">
<title>Riepilogo Presenze FIPAV — ${esc(d.athleteName)}</title>
<style>
  @page { margin: 12mm; size: A4 portrait; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:6mm; font-size:12px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1E3A8A; padding-bottom:10px; margin-bottom:14px; }
  .head h1 { font-size:18px; color:#1E3A8A; }
  .head .sub { font-size:11px; color:#555; margin-top:2px; }
  .head .society { text-align:right; font-size:12px; color:#333; }
  .meta { display:flex; gap:24px; flex-wrap:wrap; margin-bottom:14px; font-size:12px; }
  .meta div b { color:#1E3A8A; }
  .cards { display:flex; gap:12px; margin-bottom:16px; }
  .card { flex:1; border:1px solid #E5E7EB; border-radius:8px; padding:10px 12px; }
  .card .lbl { font-size:10.5px; color:#666; }
  .card .val { font-size:20px; font-weight:bold; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  th, td { border:1px solid #D1D5DB; padding:6px 8px; font-size:12px; }
  th { background:#1E3A8A; color:#fff; text-align:left; font-size:11px; }
  .badge { font-size:9.5px; font-weight:bold; padding:2px 6px; border-radius:4px; }
  .badge.sup { background:#FEE2E2; color:#991B1B; }
  .badge.cat { background:#DBEAFE; color:#1E40AF; }
  .warn { background:#FEF3C7; border:1px solid #FCD34D; color:#7C2D12; padding:8px 10px; border-radius:6px; margin-top:10px; font-size:11.5px; }
  .rule { font-size:10.5px; color:#555; margin-top:16px; line-height:1.5; border-top:1px solid #E5E7EB; padding-top:8px; }
  .foot { margin-top:22px; font-size:10px; color:#888; text-align:center; }
  .cats { font-size:11px; color:#333; margin-top:4px; }
</style></head>
<body>
  <div class="head">
    <div>
      <h1>Riepilogo Presenze Gara (camp3)</h1>
      <div class="sub">Regolamento FIPAV minorenni — Serie superiore &amp; gare settimanali</div>
    </div>
    <div class="society">${esc(d.societyName || '')}<br/><span style="font-size:10px;color:#888;">Generato il ${esc(todayStr)}</span></div>
  </div>

  <div class="meta">
    <div><b>Atleta:</b> ${esc(d.athleteName)}</div>
    ${d.birthYear ? `<div><b>Anno di nascita:</b> ${esc(d.birthYear)}</div>` : ''}
    ${d.gender ? `<div><b>Genere:</b> ${esc((d.gender || '').toUpperCase().startsWith('M') ? 'Maschile' : 'Femminile')}</div>` : ''}
  </div>

  <div class="cards">
    <div class="card">
      <div class="lbl">Presenze in Serie Superiore</div>
      <div class="val" style="color:${upperColor};">${d.upperPresences} / 10</div>
    </div>
    <div class="card">
      <div class="lbl">Max gare in una settimana</div>
      <div class="val" style="color:${weekColor};">${d.weeklyMax} / 3</div>
    </div>
    <div class="card">
      <div class="lbl">Ingressi totali registrati</div>
      <div class="val" style="color:#1E3A8A;">${(d.presences || []).length}</div>
    </div>
  </div>

  ${(d.categoryChampionships || []).length ? `<div class="cats"><b>Campionati di categoria:</b> ${esc((d.categoryChampionships || []).join(', '))}</div>` : ''}

  ${blockedHtml}
  ${violHtml}

  <table>
    <thead><tr><th style="width:36px; text-align:center;">#</th><th style="width:120px;">Data</th><th>Campionato / Gara</th><th style="width:130px; text-align:center;">Tipo</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="rule">
    <b>Norme di riferimento:</b> fino a Under 17 max 2 campionati di categoria e max 3 gare a settimana (rif. presenza a camp3).
    Serie superiore (Serie C/D/1ª Div): max 10 presenze — dall'11ª l'atleta non può più giocare in serie inferiore
    (maschi nati dal 2006, femmine dal 2008). Killswitch: ${esc(d.killswitchDate)}.
  </div>

  <div class="foot">Documento generato automaticamente da RegistraTEAM — riepilogo interno a fini di controllo tesseramenti.</div>
</body></html>`;
};

export const downloadFipavPresencesReport = async (d: FipavReportData) => {
  const html = generateFipavPresencesHTML(d);
  const safeName = (d.athleteName || 'atleta').replace(/\s+/g, '_');
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
      a.href = url; a.download = `Presenze_FIPAV_${safeName}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Riepilogo Presenze FIPAV', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ html });
      }
    } catch (e) {
      await Print.printAsync({ html });
    }
  }
};
