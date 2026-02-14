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
        @page { margin: 15mm; size: A4; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
          height: 100%;
          width: 100%;
        }
        body { 
          font-family: Arial, Helvetica, sans-serif; 
          padding: 25px;
          font-size: 13px;
          line-height: 1.5;
          min-height: 297mm;
          display: flex;
          flex-direction: column;
        }
        .content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .header { text-align: center; margin-bottom: 25px; }
        .header h1 { color: #1a237e; font-size: 22px; margin-bottom: 8px; }
        .header p { color: #666; font-size: 11px; }
        .title-bar {
          background-color: #1a237e;
          color: white;
          padding: 12px;
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          margin: 20px 0;
        }
        .receipt-info { display: flex; justify-content: space-between; margin-bottom: 20px; color: #666; font-size: 11px; }
        .box {
          background-color: #f5f5f5;
          border: 1px solid #ccc;
          padding: 15px;
          margin-bottom: 20px;
        }
        .box-title { font-weight: bold; color: #333; margin-bottom: 10px; font-size: 13px; }
        .box-row { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; }
        .box-row span { margin-right: 18px; }
        .amount-section { display: flex; align-items: center; margin: 20px 0; gap: 12px; }
        .amount-label { font-weight: bold; color: #333; font-size: 14px; }
        .amount-value { font-size: 24px; font-weight: bold; color: #1a237e; }
        .table-container { margin: 20px 0; flex: 1; }
        .table-title { color: #1a237e; font-weight: bold; margin-bottom: 10px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background-color: #1a237e; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        .total-row { background-color: #f0f0f0; font-weight: bold; }
        .total-row td { padding: 12px; border: 2px solid #1a237e; }
        .footer { margin-top: auto; padding-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
        .bollo { border: 1px solid #999; padding: 12px; width: 90px; text-align: center; font-size: 9px; color: #666; }
        .note { font-size: 9px; color: #666; flex: 1; padding-left: 25px; }
        .signature { text-align: right; }
        .signature-line { border-top: 1px solid #666; width: 180px; margin-top: 50px; padding-top: 8px; font-size: 11px; }
        @media print {
          body { min-height: auto; }
          .content-wrapper { min-height: 250mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHtml ? `<div style="margin-bottom: 10px;">${logoHtml}</div>` : ''}
        <h1>${data.society.name || 'SOCIETÀ SPORTIVA'}</h1>
        <p>${addressLine || ''}</p>
        <p>Cod. Fiscale: ${data.society.fiscal_code || 'N/A'}</p>
        ${data.society.phone ? `<p>Tel: ${data.society.phone}${data.society.phone2 ? ' - ' + data.society.phone2 : ''}</p>` : ''}
        ${data.team_name ? `<p style="font-weight: bold; color: #1a237e; margin-top: 5px;">${data.team_name}</p>` : ''}
      </div>

      <div class="title-bar">ATTESTATO DI VERSAMENTO</div>

      <div class="receipt-info">
        <span style="font-weight: bold;">alla data del: ${dateStr}</span>
      </div>

      <div class="box-title">Riceviamo da:</div>
      <div class="box">
        <div class="box-row">
          <span><b>Cognome:</b> ${data.parent.last_name || ''}</span>
          <span><b>Nome:</b> ${data.parent.first_name || ''}</span>
          <span><b>Cod. Fisc.:</b> ${data.parent.fiscal_code || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 5px;">
          <span><b>Residente in:</b> ${data.parent.address || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 5px;">
          <span><b>CAP:</b> ${data.parent.postal_code || ''}</span>
          <span><b>Città:</b> ${data.parent.city || ''}</span>
          <span><b>Prov.:</b> ${data.parent.province || ''}</span>
        </div>
      </div>

      <div class="amount-section">
        <span class="amount-label">la somma di:</span>
        <span class="amount-value">${formatCurrency(totalPaid)}</span>
      </div>

      <p style="margin-bottom: 10px;">per l'attività di PALLAVOLO nella stagione sportiva ${data.season} svolta da:</p>

      <div class="box">
        <div class="box-row">
          <span><b>Cognome:</b> ${data.athlete.last_name || ''}</span>
          <span><b>Nome:</b> ${data.athlete.first_name || ''}</span>
          <span><b>Cod. Fisc.:</b> ${data.athlete.fiscal_code || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 5px;">
          <span><b>Residente in:</b> ${data.athlete.address || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 5px;">
          <span><b>CAP:</b> ${data.athlete.postal_code || ''}</span>
          <span><b>Città:</b> ${data.athlete.city || ''}</span>
          <span><b>Prov.:</b> ${data.athlete.province || ''}</span>
        </div>
        <div class="box-row" style="margin-top: 5px;">
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
            ? `<div style="margin-top: 10px;">${stampSignatureHtml}</div>` 
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
