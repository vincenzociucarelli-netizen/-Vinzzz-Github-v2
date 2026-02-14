// Fiscal Receipt Generation - Uses expo-print for PDF generation

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
  fiscal_code?: string;
  phone?: string;
  phone2?: string;
  president_name?: string;
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Attestato di Versamento</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, Helvetica, sans-serif; 
          padding: 20px;
          font-size: 12px;
          line-height: 1.4;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #1a237e; font-size: 18px; margin-bottom: 5px; }
        .header p { color: #666; font-size: 10px; }
        .title-bar {
          background-color: #1a237e;
          color: white;
          padding: 10px;
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          margin: 15px 0;
        }
        .receipt-info { display: flex; justify-content: space-between; margin-bottom: 15px; color: #666; font-size: 10px; }
        .box {
          background-color: #f5f5f5;
          border: 1px solid #ccc;
          padding: 12px;
          margin-bottom: 15px;
        }
        .box-title { font-weight: bold; color: #333; margin-bottom: 8px; font-size: 11px; }
        .box-row { display: flex; flex-wrap: wrap; gap: 10px; font-size: 10px; }
        .box-row span { margin-right: 15px; }
        .amount-section { display: flex; justify-content: space-between; align-items: center; margin: 15px 0; }
        .amount-label { font-weight: bold; color: #333; }
        .amount-value { font-size: 20px; font-weight: bold; color: #1a237e; }
        .table-container { margin: 15px 0; }
        .table-title { color: #1a237e; font-weight: bold; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background-color: #1a237e; color: white; padding: 8px; text-align: left; }
        .total-row { background-color: #f0f0f0; font-weight: bold; }
        .total-row td { padding: 10px; border: 2px solid #1a237e; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
        .bollo { border: 1px solid #999; padding: 10px; width: 80px; text-align: center; font-size: 8px; color: #666; }
        .note { font-size: 8px; color: #666; flex: 1; padding-left: 20px; }
        .signature { text-align: right; }
        .signature-line { border-top: 1px solid #666; width: 150px; margin-top: 40px; padding-top: 5px; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.society.name || 'SOCIETÀ SPORTIVA'}</h1>
        <p>${data.society.address || ''} - ${data.society.postal_code || ''} ${data.society.city || ''}</p>
        <p>Cod. Fiscale: ${data.society.fiscal_code || 'N/A'}</p>
        ${data.society.phone ? `<p>Tel: ${data.society.phone}${data.society.phone2 ? ' - ' + data.society.phone2 : ''}</p>` : ''}
        ${data.team_name ? `<p style="font-weight: bold; color: #1a237e; margin-top: 5px;">${data.team_name}</p>` : ''}
      </div>

      <div class="title-bar">ATTESTATO DI VERSAMENTO</div>

      <div class="receipt-info">
        <span>N° ${data.receipt_number}</span>
        <span>Data: ${dateStr}</span>
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
          <div class="signature-line">
            ${data.society.president_name || ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const downloadFiscalReceipt = async (data: ReceiptData, filename?: string) => {
  // Import expo-print dynamically for web/mobile compatibility
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 15;
  let y = 15;

  // Helper function to draw a box
  const drawBox = (x: number, yPos: number, width: number, height: number, fill = false) => {
    if (fill) {
      doc.setFillColor(245, 245, 245);
      doc.rect(x, yPos, width, height, 'F');
    }
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, yPos, width, height);
  };

  // ===== HEADER =====
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 126);
  doc.text(data.society.name || 'SOCIETÀ SPORTIVA', pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const addressLine = `${data.society.address || ''} - ${data.society.postal_code || ''} ${data.society.city || ''}`;
  doc.text(addressLine, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.text(`Cod. Fiscale: ${data.society.fiscal_code || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  if (data.society.phone) {
    const phones = data.society.phone2 
      ? `Tel: ${data.society.phone} - ${data.society.phone2}`
      : `Tel: ${data.society.phone}`;
    doc.text(phones, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  if (data.team_name) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 35, 126);
    doc.text(data.team_name, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  y += 5;

  // ===== TITLE =====
  doc.setFillColor(26, 35, 126);
  doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ATTESTATO DI VERSAMENTO', pageWidth / 2, y + 7, { align: 'center' });
  y += 15;

  // Receipt number and date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  doc.text(`N° ${data.receipt_number}`, margin, y);
  doc.text(`Data: ${dateStr}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // ===== RICEVIAMO DA (PARENT) =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('Riceviamo da:', margin, y);
  y += 6;

  drawBox(margin, y, pageWidth - 2 * margin, 25, true);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  let yBox = y + 5;
  doc.text(`Cognome: ${data.parent.last_name || ''}`, margin + 3, yBox);
  doc.text(`Nome: ${data.parent.first_name || ''}`, margin + 70, yBox);
  doc.text(`Cod. Fisc.: ${data.parent.fiscal_code || ''}`, margin + 120, yBox);
  yBox += 6;
  
  doc.text(`Residente in: ${data.parent.address || ''}`, margin + 3, yBox);
  yBox += 6;
  
  doc.text(`CAP: ${data.parent.postal_code || ''}`, margin + 3, yBox);
  doc.text(`Città: ${data.parent.city || ''}`, margin + 35, yBox);
  doc.text(`Prov.: ${data.parent.province || ''}`, margin + 100, yBox);
  
  y += 30;

  // ===== IMPORTO =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('la somma di:', margin, y);
  
  const totalPaid = data.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  doc.setFontSize(16);
  doc.setTextColor(26, 35, 126);
  doc.text(`€ ${totalPaid.toFixed(2).replace('.', ',')}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // ===== MOTIVO =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  doc.text(`per l'attività di PALLAVOLO nella stagione sportiva ${data.season} svolta da:`, margin, y);
  y += 8;

  // ===== ATLETA =====
  drawBox(margin, y, pageWidth - 2 * margin, 35, true);
  doc.setFontSize(9);
  
  yBox = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Cognome: ${data.athlete.last_name || ''}`, margin + 3, yBox);
  doc.text(`Nome: ${data.athlete.first_name || ''}`, margin + 70, yBox);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cod. Fisc.: ${data.athlete.fiscal_code || ''}`, margin + 120, yBox);
  yBox += 6;
  
  doc.text(`Residente in: ${data.athlete.address || ''}`, margin + 3, yBox);
  yBox += 6;
  
  doc.text(`CAP: ${data.athlete.postal_code || ''}`, margin + 3, yBox);
  doc.text(`Città: ${data.athlete.city || ''}`, margin + 35, yBox);
  doc.text(`Prov.: ${data.athlete.province || ''}`, margin + 100, yBox);
  yBox += 6;
  
  let dobFormatted = data.athlete.date_of_birth || '';
  if (dobFormatted && dobFormatted.includes('T')) {
    const dob = new Date(dobFormatted);
    dobFormatted = `${String(dob.getDate()).padStart(2, '0')}/${String(dob.getMonth() + 1).padStart(2, '0')}/${dob.getFullYear()}`;
  }
  
  doc.text(`Data di nascita: ${dobFormatted}`, margin + 3, yBox);
  doc.text(`Comune di nascita: ${data.athlete.birth_place || ''}`, margin + 60, yBox);
  doc.text(`Prov.: ${data.athlete.birth_province || ''}`, margin + 140, yBox);
  
  y += 40;

  // ===== TABELLA PAGAMENTI =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 126);
  doc.text('Dettaglio versamenti:', margin, y);
  y += 5;

  const colWidths = [35, 25, 30, 25, 30, 35];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableX = margin;
  
  doc.setFillColor(26, 35, 126);
  doc.rect(tableX, y, tableWidth, 8, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  
  let xPos = tableX + 2;
  const headers = ['Data vers.', 'Ricevuta', 'Importo', 'Tipo', 'Descrizione', 'Note'];
  headers.forEach((header, i) => {
    doc.text(header, xPos, y + 5.5);
    xPos += colWidths[i];
  });
  
  y += 8;
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'normal');

  data.payments.forEach((payment, index) => {
    const bgColor = index % 2 === 0 ? 255 : 245;
    doc.setFillColor(bgColor, bgColor, bgColor);
    doc.rect(tableX, y, tableWidth, 7, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(tableX, y, tableWidth, 7);
    
    xPos = tableX + 2;
    
    let payDateFormatted = payment.date || '';
    if (payDateFormatted && payDateFormatted.includes('T')) {
      const pd = new Date(payDateFormatted);
      payDateFormatted = `${String(pd.getDate()).padStart(2, '0')}/${String(pd.getMonth() + 1).padStart(2, '0')}/${pd.getFullYear()}`;
    }
    
    doc.setFontSize(8);
    doc.text(payDateFormatted, xPos, y + 5);
    xPos += colWidths[0];
    
    doc.text(payment.receipt_number || '-', xPos, y + 5);
    xPos += colWidths[1];
    
    doc.text(`€ ${(payment.amount || 0).toFixed(2).replace('.', ',')}`, xPos, y + 5);
    xPos += colWidths[2];
    
    const typeShort = payment.description?.includes('Bonifico') ? 'Bon.' 
      : payment.description?.includes('Contanti') ? 'Cont.'
      : payment.description?.includes('POS') ? 'POS'
      : '-';
    doc.text(typeShort, xPos, y + 5);
    xPos += colWidths[3];
    
    const desc = (payment.description || '').substring(0, 20);
    doc.text(desc, xPos, y + 5);
    
    y += 7;
  });

  // Total row
  y += 2;
  doc.setFillColor(240, 240, 240);
  doc.rect(tableX, y, tableWidth, 8, 'F');
  doc.setDrawColor(26, 35, 126);
  doc.setLineWidth(0.5);
  doc.rect(tableX, y, tableWidth, 8);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 126);
  doc.text('TOTALE VERSATO:', tableX + 5, y + 6);
  doc.text(`€ ${totalPaid.toFixed(2).replace('.', ',')}`, tableX + tableWidth - 5, y + 6, { align: 'right' });
  
  y += 15;

  // ===== BOLLO E NOTE =====
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, 30, 20);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Soggetta a bollo', margin + 3, y + 8);
  doc.text('vigente', margin + 3, y + 12);
  
  doc.setFontSize(7);
  doc.text('* Somme non soggette ad IVA ai sensi del 4° comma del DPR 633/72', margin + 35, y + 10);
  doc.text('e successive modifiche ed integrazioni', margin + 35, y + 14);
  
  y += 25;

  // ===== FIRMA =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 51, 51);
  doc.text(data.society.name || '', pageWidth - margin - 50, y);
  y += 5;
  doc.text('Il Presidente', pageWidth - margin - 50, y);
  y += 15;
  
  doc.setDrawColor(150, 150, 150);
  doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
  
  if (data.society.president_name) {
    doc.setFontSize(8);
    doc.text(data.society.president_name, pageWidth - margin - 30, y + 5, { align: 'center' });
  }

  // Save the PDF
  const defaultFilename = `Ricevuta_${data.athlete.last_name}_${data.athlete.first_name}_${data.season.replace('/', '-')}.pdf`;
  doc.save(filename || defaultFilename);
};
