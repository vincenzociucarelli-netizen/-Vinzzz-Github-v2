// Fiscal Receipt Generation - Uses expo-print for PDF generation
import { Platform } from 'react-native';

interface PaymentData {
  date: string;
  receipt_number: string;
  amount: number;
  description?: string;
  payment_method?: string;
}

interface AthleteData {
  first_name: string;
  last_name: string;
  fiscal_code?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  date_of_birth?: string;
  birth_place?: string;
  birth_province?: string;
}

interface ParentData {
  first_name: string;
  last_name: string;
  fiscal_code?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  date_of_birth?: string;
  birth_place?: string;
}

interface SocietyData {
  name: string;
  address?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  fiscal_code?: string;
  phone?: string;
  phone2?: string;
  president_name?: string;
  logo?: string;
  stamp_signature?: string;
  sport_type?: string;
}

export interface ReceiptData {
  athlete: AthleteData;
  parent: ParentData;
  society: SocietyData;
  payments: PaymentData[];
  season: string;
  receipt_number: string;
  team_name?: string;
}

// Helper function to format date
const formatDateIT = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return `€ ${amount.toFixed(2).replace('.', ',')}`;
};

// Generate HTML for the receipt
export const generateReceiptHTML = (data: ReceiptData): string => {
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const totalPaid = data.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // Generate payments table rows
  const paymentRows = data.payments.map((payment, index) => {
    const bgColor = index % 2 === 0 ? '#fff' : '#f5f5f5';
    const payDate = formatDateIT(payment.date);
    const method = payment.payment_method || '-';
    const desc = (payment.description || '').substring(0, 25);
    
    return `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 8px; border: 1px solid #ddd;">${payDate}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${payment.receipt_number || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${formatCurrency(payment.amount || 0)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${method}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${desc}</td>
      </tr>
    `;
  }).join('');

  // Build logo HTML if available
  const logoHtml = data.society.logo 
    ? `<img src="data:image/jpeg;base64,${data.society.logo}" style="max-height: 60px; max-width: 120px; object-fit: contain;" />`
    : '';

  // Build stamp/signature HTML if available
  let stampSignatureHtml = '';
  if (data.society.stamp_signature) {
    // Check if it already has the data URI prefix
    const imgSrc = data.society.stamp_signature.startsWith('data:') 
      ? data.society.stamp_signature 
      : `data:image/png;base64,${data.society.stamp_signature}`;
    stampSignatureHtml = `<img src="${imgSrc}" style="max-height: 80px; max-width: 150px; object-fit: contain;" />`;
  }

  // Build address line
  const addressParts = [data.society.address, data.society.postal_code, data.society.city, data.society.province].filter(Boolean);
  const addressLine = addressParts.join(' - ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Attestato di Versamento</title>
      <style>
        @page { margin: 8mm; size: A4; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; width: 100%; }
        body { 
          font-family: Arial, Helvetica, sans-serif; 
          padding: 8px 12px;
          font-size: 11px;
          line-height: 1.3;
        }
        .header { text-align: center; margin-bottom: 8px; }
        .header h1 { color: #1a237e; font-size: 16px; margin-bottom: 2px; }
        .header p { color: #666; font-size: 10px; margin: 1px 0; }
        .title-bar {
          background-color: #1a237e;
          color: white;
          padding: 6px;
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          margin: 8px 0;
        }
        .receipt-info { margin-bottom: 6px; color: #666; font-size: 10px; }
        .box {
          background-color: #f8f8f8;
          border: 1px solid #ccc;
          padding: 6px 8px;
          margin-bottom: 6px;
        }
        .box-title { font-weight: bold; color: #333; margin-bottom: 4px; font-size: 11px; }
        .box-row { display: flex; flex-wrap: wrap; gap: 6px; font-size: 10px; }
        .box-row span { margin-right: 10px; }
        .amount-section { display: flex; align-items: center; margin: 6px 0; gap: 8px; }
        .amount-label { font-weight: bold; color: #333; font-size: 12px; }
        .amount-value { font-size: 18px; font-weight: bold; color: #1a237e; }
        .table-container { margin: 6px 0; }
        .table-title { color: #1a237e; font-weight: bold; margin-bottom: 4px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background-color: #1a237e; color: white; padding: 4px 6px; text-align: left; }
        td { padding: 4px 6px; border-bottom: 1px solid #ddd; }
        .total-row { background-color: #f0f0f0; font-weight: bold; }
        .total-row td { padding: 6px; border: 1px solid #1a237e; }
        .footer { margin-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
        .bollo { border: 1px solid #999; padding: 6px; width: 70px; text-align: center; font-size: 8px; color: #666; }
        .note { font-size: 8px; color: #666; flex: 1; padding-left: 12px; }
        .signature { text-align: right; }
        .signature p { font-size: 10px; margin: 1px 0; }
        .signature-line { border-top: 1px solid #666; width: 140px; margin-top: 30px; padding-top: 4px; font-size: 10px; }
        @media print {
          body { padding: 5mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHtml ? `<div style="margin-bottom: 4px;">${logoHtml}</div>` : ''}
        <h1>${data.society.name || 'SOCIETÀ SPORTIVA'}</h1>
        <p>${addressLine || ''}</p>
        <p>Cod. Fiscale: ${data.society.fiscal_code || 'N/A'}</p>
        ${data.society.phone ? `<p>Tel: ${data.society.phone}${data.society.phone2 ? ' - ' + data.society.phone2 : ''}</p>` : ''}
        ${data.team_name ? `<p style="font-weight: bold; color: #1a237e;">${data.team_name}</p>` : ''}
      </div>

      <div class="title-bar">ATTESTATO DI VERSAMENTO</div>

      <div class="receipt-info">
        <span style="font-weight: bold;">alla data del: ${dateStr}</span>
      </div>

      <div class="box-title">Abbiamo ricevuto da:</div>
      <div class="box" style="min-height: 50px;">
        <div class="box-row">
          <span><b>Cognome:</b> ${data.parent.last_name || '<span style="display:inline-block;width:180px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
          <span><b>Nome:</b> ${data.parent.first_name || '<span style="display:inline-block;width:120px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
        </div>
        <div class="box-row" style="margin-top: 6px;">
          <span><b>Cod. Fisc.:</b> ${data.parent.fiscal_code || '<span style="display:inline-block;width:180px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
        </div>
        <div class="box-row" style="margin-top: 6px;">
          <span><b>Residente in:</b> ${data.parent.address || '<span style="display:inline-block;width:250px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
        </div>
        <div class="box-row" style="margin-top: 6px;">
          <span><b>CAP:</b> ${data.parent.postal_code || '<span style="display:inline-block;width:60px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
          <span><b>Città:</b> ${data.parent.city || '<span style="display:inline-block;width:200px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
          <span><b>Prov.:</b> ${data.parent.province || '<span style="display:inline-block;width:30px;border-bottom:1px solid #999;">&nbsp;</span>'}</span>
        </div>
      </div>

      <div class="amount-section">
        <span class="amount-label">la somma di:</span>
        <span class="amount-value">${formatCurrency(totalPaid)}</span>
      </div>

      <p style="margin-bottom: 6px; font-size: 10px;">per l'attività di ${(data.society.sport_type || 'SPORT').toUpperCase()} nella stagione sportiva ${data.season} svolta da:</p>

      <div class="box">
        <div class="box-row">
          <span><b>Cognome:</b> ${data.athlete.last_name || ''}</span>
          <span><b>Nome:</b> ${data.athlete.first_name || ''}</span>
          <span><b>Cod. Fisc.:</b> ${data.athlete.fiscal_code || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 3px;">
          <span><b>Residente in:</b> ${data.athlete.address || ''}</span>
          <span><b>CAP:</b> ${data.athlete.postal_code || ''}</span>
          <span><b>Città:</b> ${data.athlete.city || ''}</span>
          <span><b>Prov.:</b> ${data.athlete.province || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 3px;">
          <span><b>Data di nascita:</b> ${formatDateIT(data.athlete.date_of_birth || '')}</span>
          <span><b>Comune di nascita:</b> ${data.athlete.birth_place || ''}</span>
          <span><b>Prov.:</b> ${data.athlete.birth_province || ''}</span>
        </div>
      </div>

      <div class="table-container">
        <div class="table-title">Dettaglio versamenti:</div>
        <table>
          <thead>
            <tr>
              <th>Data vers.</th>
              <th>Ricevuta</th>
              <th>Importo</th>
              <th>Metodo</th>
              <th>Descrizione</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows}
            <tr class="total-row">
              <td colspan="2"><b>TOTALE VERSATO:</b></td>
              <td colspan="3" style="text-align: right;"><b>${formatCurrency(totalPaid)}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div class="bollo">
          Soggetta a bollo<br/>vigente
        </div>
        <div class="note">
          * Somme non soggette ad IVA ai sensi del 4° comma del DPR 633/72<br/>
          e successive modifiche ed integrazioni
        </div>
        <div class="signature">
          <p>${data.society.name || ''}</p>
          <p>Il Presidente</p>
          ${stampSignatureHtml 
            ? `<div style="margin-top: 5px;">${stampSignatureHtml}</div>` 
            : `<div class="signature-line">${data.society.president_name || ''}</div>`
          }
        </div>
      </div>
    </body>
    </html>
  `;
};

export const downloadFiscalReceipt = async (data: ReceiptData, filename?: string) => {
  const html = generateReceiptHTML(data);
  const defaultFilename = `Ricevuta_${data.athlete.last_name}_${data.athlete.first_name}_${data.season.replace('/', '-')}.pdf`;
  const finalFilename = filename || defaultFilename;
  
  if (Platform.OS === 'web') {
    // On web: open HTML in new window and trigger print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      // Fallback: download as HTML file
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
    // On mobile: use expo-print to generate PDF and share
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    
    try {
      // Generate PDF from HTML
      const { uri } = await Print.printToFileAsync({ html });
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Ricevuta Fiscale',
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: just print
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to print dialog
      await Print.printAsync({ html });
    }
  }
};
// Modified Sat Feb 14 08:05:25 UTC 2026
