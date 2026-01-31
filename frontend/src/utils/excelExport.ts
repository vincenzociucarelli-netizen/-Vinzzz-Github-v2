import * as XLSX from 'xlsx';
import { Platform } from 'react-native';

export const exportToExcel = async (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    throw new Error('Nessun dato da esportare');
  }

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dati');

  // Auto-size columns
  const maxWidth = 30;
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(maxWidth, Math.max(key.length, ...data.map(row => String(row[key] || '').length)))
  }));
  worksheet['!cols'] = colWidths;

  if (Platform.OS === 'web') {
    // Web export - direct download
    try {
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      return true;
    } catch (error) {
      console.error('Web export error:', error);
      // Fallback: use blob download
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }
  } else {
    // Mobile export using file system
    try {
      const FileSystem = require('expo-file-system');
      const Sharing = require('expo-sharing');
      
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.documentDirectory + `${filename}.xlsx`;
      
      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Esporta ${filename}`,
          UTI: 'com.microsoft.excel.xlsx'
        });
      }
      
      return true;
    } catch (error) {
      console.error('Mobile export error:', error);
      throw new Error('Errore durante l\'esportazione su mobile');
    }
  }
};
