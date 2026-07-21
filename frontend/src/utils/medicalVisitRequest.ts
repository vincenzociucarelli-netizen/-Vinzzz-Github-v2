/**
 * Medical Visit Request Generator — USL Umbria 1 template (D.M. 18.2.82).
 * 🆕 19/07/2026.
 *
 * Genera una richiesta di visita medico-sportiva per idoneità agonistica
 * pre-compilata con i dati dell'atleta e della società, con firma e timbro
 * digitali del Presidente applicati automaticamente.
 *
 * Uso: import { downloadMedicalVisitRequest } from '.../medicalVisitRequest';
 *      await downloadMedicalVisitRequest(receiptData);
 *
 * NOTE: il template grafico segue il modulo USL Umbria 1. Le società fuori Umbria
 * lo possono comunque usare (i dati sono gli stessi in tutto il D.M. 18.2.82) ma
 * potrebbero volere un template regionale diverso in futuro.
 */
import { Platform } from 'react-native';

interface AthleteLike {
  first_name?: string;
  last_name?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  date_of_birth?: string;
  birth_place?: string;
  birth_province?: string;
  country_of_birth?: string;
}

interface SocietyLike {
  name?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  president_name?: string;
  stamp_signature?: string;
  region?: string; // se presente sul settings/society, altrimenti dedotta da province
}

export interface MedicalVisitRequestData {
  athlete: AthleteLike;
  society: SocietyLike;
}

const PROVINCE_TO_REGION: Record<string, string> = {
  // Umbria
  PG: 'Umbria', TR: 'Umbria',
  // Lazio
  RM: 'Lazio', VT: 'Lazio', RI: 'Lazio', LT: 'Lazio', FR: 'Lazio',
  // Toscana
  FI: 'Toscana', PI: 'Toscana', LI: 'Toscana', SI: 'Toscana', AR: 'Toscana',
  PO: 'Toscana', PT: 'Toscana', LU: 'Toscana', MS: 'Toscana', GR: 'Toscana',
  // Marche
  AN: 'Marche', PU: 'Marche', MC: 'Marche', AP: 'Marche', FM: 'Marche',
  // Lombardia
  MI: 'Lombardia', BG: 'Lombardia', BS: 'Lombardia', CO: 'Lombardia', CR: 'Lombardia',
  LC: 'Lombardia', LO: 'Lombardia', MB: 'Lombardia', MN: 'Lombardia', PV: 'Lombardia',
  SO: 'Lombardia', VA: 'Lombardia',
  // Piemonte
  TO: 'Piemonte', AL: 'Piemonte', AT: 'Piemonte', BI: 'Piemonte', CN: 'Piemonte',
  NO: 'Piemonte', VB: 'Piemonte', VC: 'Piemonte',
  // Veneto
  VE: 'Veneto', VR: 'Veneto', VI: 'Veneto', PD: 'Veneto', TV: 'Veneto',
  RO: 'Veneto', BL: 'Veneto',
  // Emilia-Romagna
  BO: 'Emilia-Romagna', MO: 'Emilia-Romagna', PR: 'Emilia-Romagna', RE: 'Emilia-Romagna',
  FE: 'Emilia-Romagna', FC: 'Emilia-Romagna', RA: 'Emilia-Romagna', RN: 'Emilia-Romagna',
  PC: 'Emilia-Romagna',
  // Campania
  NA: 'Campania', SA: 'Campania', AV: 'Campania', BN: 'Campania', CE: 'Campania',
  // Sicilia
  PA: 'Sicilia', CT: 'Sicilia', ME: 'Sicilia', AG: 'Sicilia', CL: 'Sicilia',
  EN: 'Sicilia', RG: 'Sicilia', SR: 'Sicilia', TP: 'Sicilia',
  // Puglia
  BA: 'Puglia', BT: 'Puglia', BR: 'Puglia', FG: 'Puglia', LE: 'Puglia', TA: 'Puglia',
  // Calabria
  CS: 'Calabria', CZ: 'Calabria', KR: 'Calabria', RC: 'Calabria', VV: 'Calabria',
  // Sardegna
  CA: 'Sardegna', NU: 'Sardegna', OR: 'Sardegna', SS: 'Sardegna', SU: 'Sardegna',
  // Abruzzo
  AQ: 'Abruzzo', CH: 'Abruzzo', PE: 'Abruzzo', TE: 'Abruzzo',
  // Molise
  CB: 'Molise', IS: 'Molise',
  // Basilicata
  MT: 'Basilicata', PZ: 'Basilicata',
  // Trentino / FVG / Liguria / VdA
  TN: 'Trentino-Alto Adige', BZ: 'Trentino-Alto Adige',
  TS: 'Friuli-Venezia Giulia', UD: 'Friuli-Venezia Giulia', GO: 'Friuli-Venezia Giulia', PN: 'Friuli-Venezia Giulia',
  GE: 'Liguria', SP: 'Liguria', SV: 'Liguria', IM: 'Liguria',
  AO: 'Valle d\'Aosta',
};

const formatDateIT = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const escapeHtml = (v: string | undefined | null): string => {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const inferRegion = (society: SocietyLike): string => {
  if (society.region) return society.region;
  const prov = (society.province || '').toUpperCase().trim();
  if (prov && PROVINCE_TO_REGION[prov]) return PROVINCE_TO_REGION[prov];
  return 'Umbria';
};

export const generateMedicalVisitRequestHTML = (data: MedicalVisitRequestData): string => {
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const athlete = data.athlete || {};
  const society = data.society || {};

  const region = inferRegion(society);
  const athleteFullName = `${athlete.first_name || ''} ${athlete.last_name || ''}`.trim().toUpperCase();
  const birthPlace = [athlete.birth_place, athlete.birth_province ? `(${athlete.birth_province})` : '']
    .filter(Boolean).join(' ');
  const birthDate = formatDateIT(athlete.date_of_birth);
  const residenceCity = [athlete.city, athlete.province ? `(${athlete.province})` : '', athlete.postal_code]
    .filter(Boolean).join(' ');
  const residenceStreet = athlete.address || '';

  // Sede società = indirizzo + città + provincia
  const societyAddrParts = [society.address, society.postal_code, society.city, society.province ? `(${society.province})` : '']
    .filter(Boolean);
  const societyFullAddress = societyAddrParts.join(' ');

  const societyName = (society.name || '').toUpperCase();

  // Firma + timbro digitale (identico pattern fiscalReceipt)
  let stampSignatureHtml = '';
  if (society.stamp_signature) {
    const imgSrc = society.stamp_signature.startsWith('data:')
      ? society.stamp_signature
      : `data:image/png;base64,${society.stamp_signature}`;
    stampSignatureHtml = `<img src="${imgSrc}" style="max-height: 90px; max-width: 200px; object-fit: contain; display:block;" />`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Richiesta Visita Medico-Sportiva</title>
  <style>
    @page { margin: 10mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; }
    body {
      font-family: 'Times New Roman', Times, serif;
      padding: 2mm 4mm;
      font-size: 11px;
      color: #000;
      line-height: 1.35;
    }
    /* Blocco per forzare tutto su una sola pagina */
    .page-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      gap: 20px;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .usl-logo {
      width: 78px;
      height: 78px;
      background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="none" stroke="%23222" stroke-width="0.8" stroke-dasharray="1.6,1.6"><path d="M32 8 C 22 12 18 22 20 32 C 12 38 10 50 18 56 C 12 64 18 76 30 78 C 44 84 56 78 62 68 C 72 62 74 50 68 42 C 74 34 68 22 56 18 C 50 8 42 6 32 8 Z"/></g><path d="M32 8 C 22 12 18 22 20 32 C 12 38 10 50 18 56 C 12 64 18 76 30 78 C 44 84 56 78 62 68 C 72 62 74 50 68 42 C 74 34 68 22 56 18 C 50 8 42 6 32 8 Z" fill="%234a4a4a"/><path d="M32 8 C 26 10 22 16 22 24 C 20 30 24 40 32 42 C 40 40 46 34 48 26 C 50 18 44 10 32 8 Z" fill="%23222"/><path d="M50 20 C 46 22 46 28 50 30 C 54 32 58 28 56 22 C 55 19 52 19 50 20 Z" fill="%23333"/></svg>') center center no-repeat;
      background-size: contain;
    }
    .usl-text {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 26px;
      font-weight: bold;
      letter-spacing: -0.5px;
      line-height: 1;
    }
    .usl-text .part1 { color: #333; }
    .usl-text .part2 { color: #7EC8E3; font-weight: 400; }
    .header-right {
      text-align: right;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      color: #6b6b6b;
      font-weight: 400;
    }
    .header-right .site { font-size: 9.5px; color: #999; margin-top: 3px; font-style: normal; }
    .sub-header {
      font-family: 'Times New Roman', Times, serif;
      font-style: italic;
      font-size: 10.5px;
      color: #333;
      padding-top: 6px;
      padding-bottom: 2px;
      line-height: 1.3;
      margin-bottom: 6px;
    }
    .sub-header .strong-name { font-style: italic; font-weight: bold; }
    h1.title {
      text-align: center;
      font-family: 'Times New Roman', Times, serif;
      font-size: 13px;
      font-weight: bold;
      margin: 12px 0 2px;
      letter-spacing: 0.3px;
    }
    .subtitle {
      text-align: center;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11px;
      margin-bottom: 12px;
    }
    .row { margin: 6px 0; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
    .row .label { white-space: normal; }  /* 🐛 21/07/2026 — Permette wrap su label lunghe (es. "Una visita medico-sportiva...") per non tagliare l'ultima parola */
    .filled {
      flex: 1;
      border-bottom: 1px solid #000;
      padding: 0 4px 1px;
      min-height: 15px;
      font-weight: 600;
    }
    .filled.small { flex: 0 0 auto; min-width: 120px; max-width: 200px; }
    .checkboxes {
      display: flex;
      justify-content: space-around;
      margin: 14px 40px 12px;
      font-size: 11.5px;
    }
    .cb { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; vertical-align: middle; margin-right: 6px; }
    /* 🔄 21/07/2026 — Ripristinata sezione firma come originale: "Il Presidente ____ firma e timbro ____" su unica riga */
    .president-row {
      margin-top: 14px;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      font-size: 11.5px;
    }
    .president-row .lbl { padding-bottom: 3px; white-space: nowrap; }
    .president-line {
      flex: 1;
      border-bottom: 1px solid #000;
      min-height: 15px;
      position: relative;
    }
    .president-line .stamp-inline {
      position: absolute;
      right: 6px;
      bottom: -2px;
    }
    .stamp-only { display: none; }
    .stamp-inline img { max-height: 40px; max-width: 140px; object-fit: contain; }
    /* 🔄 21/07/2026 — Timbro Sirio allineato a destra accanto a "Il Presidente ______" */
    .stamp-side {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-left: 12px;
    }
    .stamp-side img {
      max-height: 70px;
      max-width: 170px;
      object-fit: contain;
      display: block;
    }
    .allegato {
      font-size: 10px;
      font-style: italic;
      color: #333;
      margin-top: 18px;
      padding-top: 6px;
      border-top: 1px solid #999;
      line-height: 1.4;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #333;
      margin-top: 14px;
      padding-top: 8px;
      border-top: 2px solid #000;
    }
    .footer .col { flex: 1; padding: 0 6px; }
    .footer .col strong { display: block; font-size: 9.5px; margin-bottom: 2px; }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <div class="usl-logo"></div>
      <div class="usl-text"><span class="part1">USL</span><span class="part2">Umbria1</span></div>
    </div>
    <div class="header-right">
      Azienda Unità Sanitaria Locale Umbria 1
      <div class="site">www.uslumbria1.gov.it</div>
    </div>
  </div>

  <div class="sub-header">
    <span class="strong-name">Struttura Complessa Medicina dello Sport</span><br/>
    Direttore: Dr. Luigi Repace<br/>
    Via della Pallotta n° 42 (CS Grocco) – 06126 Perugia<br/>
    Tel. 075 5412956 – Fax. 075 5412957 / E-mail: medsport.pg@uslumbria1.it<br/>
    <span style="font-size:10px">Sedi distaccate: Bastia – Castiglione del Lago – Città di Castello – Gualdo Tadino – Gubbio – Magione – Marsciano – Umbertide</span>
  </div>

  <h1 class="title">RICHIESTA DI VISITA MEDICO-SPORTIVA<br/>PER L'IDONEITÀ ALLA PRATICA AGONISTICA</h1>
  <div class="subtitle">(D.M. 18.2.82)</div>

  <div class="row">
    <span class="label">Data</span>
    <span class="filled small">${escapeHtml(dateStr)}</span>
    <span style="width:60px;"></span>
    <span class="label">Regione</span>
    <span class="filled small">${escapeHtml(region)}</span>
  </div>

  <div class="row">
    <span class="label">La Società Sportiva</span>
    <span class="filled">${escapeHtml(societyName)}</span>
  </div>

  <div class="row">
    <span class="label">con sede in</span>
    <span class="filled">${escapeHtml(societyFullAddress)}</span>
  </div>

  <div class="row">
    <span class="label">affiliata alla Federazione Sportiva Nazionale</span>
    <span class="filled">FIPAV</span>
  </div>

  <div class="row">
    <span class="label">o Ente di Promozione Sportiva</span>
    <span class="filled">CSEN e CSI</span>
  </div>

  <div style="margin: 4px 0 6px;">riconosciuta dal CONI,</div>

  <div class="row">
    <span class="label">chiede per il proprio atleta</span>
    <span class="filled">${escapeHtml(athleteFullName)}</span>
  </div>

  <div class="row">
    <span class="label">Nato a</span>
    <span class="filled">${escapeHtml(birthPlace)}</span>
    <span class="label">il</span>
    <span class="filled small">${escapeHtml(birthDate)}</span>
  </div>

  <div class="row">
    <span class="label">Residente a</span>
    <span class="filled">${escapeHtml(residenceCity)}</span>
  </div>

  <div class="row">
    <span class="label">Via</span>
    <span class="filled">${escapeHtml(residenceStreet)}</span>
  </div>

  <div class="row" style="margin-top:10px;">
    <span class="label">Una visita medico-sportiva per l'idoneità alla pratica agonistica dello sport</span>
    <span class="filled">PALLAVOLO</span>
  </div>

  <div class="checkboxes">
    <div><span class="cb"></span>prima affiliazione</div>
    <div><span class="cb"></span>rinnovo</div>
  </div>

  <div class="president-row">
    <span class="lbl">Il Presidente</span>
    <div class="president-line"></div>
    <div class="stamp-side">${stampSignatureHtml}</div>
  </div>

  <div class="allegato">
    Alla presente richiesta bisogna allegare l'ultimo certificato medico-sportivo. La richiesta non può essere presentata prima di 30gg dalla scadenza del certificato precedente.
  </div>

  <div class="footer">
    <div class="col">
      <strong>Azienda Unità Sanitaria Locale Umbria 1</strong>
      tel. 075 54 11 – 075 85 091
    </div>
    <div class="col">
      <strong>Sede Legale (provvisoria)</strong>
      06127 – Perugia Via Guerra 21/17
    </div>
    <div class="col" style="text-align:right;">
      <strong>(l.r. n.18/12.11.2012)</strong>
      p.iva / c.f. 03301860544
    </div>
  </div>

</body>
</html>`;
};

export const downloadMedicalVisitRequest = async (data: MedicalVisitRequestData, filename?: string) => {
  const html = generateMedicalVisitRequestHTML(data);
  const lastName = (data.athlete?.last_name || 'atleta').replace(/\s+/g, '_');
  const firstName = (data.athlete?.first_name || '').replace(/\s+/g, '_');
  const defaultFilename = `Richiesta_visita_medico_sportiva_${lastName}_${firstName}.pdf`;
  const finalFilename = filename || defaultFilename;

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename.replace('.pdf', '.html');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } else {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Richiesta Visita Medico-Sportiva',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Error generating medical visit request PDF:', error);
      await Print.printAsync({ html });
    }
  }
};
