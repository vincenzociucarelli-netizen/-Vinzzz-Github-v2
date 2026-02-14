// jsPDF will be imported dynamically to avoid SSR issues
// Use: const { jsPDF } = await import('jspdf/dist/jspdf.umd.min.js');

interface PaymentData {
  date: string;
  receipt_number: string;
  amount: number;
  description?: string;
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

export const downloadFiscalReceipt = async (data: ReceiptData, filename?: string) => {
  // Dynamic import for web compatibility
  const { jsPDF } = await import('jspdf');
  
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
