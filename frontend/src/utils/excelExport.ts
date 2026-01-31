import * as XLSX from 'xlsx';
import { Platform, Alert } from 'react-native';

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
    // Web export - direct download using blob
    try {
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
    } catch (error) {
      console.error('Web export error:', error);
      throw new Error('Errore durante l\'esportazione');
    }
  } else {
    // Mobile export - dynamically import modules
    try {
      // Dynamic imports to avoid bundling issues
      const FileSystem = await import('expo-file-system');
      const Sharing = await import('expo-sharing');
      
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.documentDirectory + `${filename}.xlsx`;
      
      // Write file with base64 encoding
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType?.Base64 || 'base64'
      });
      
      // Share the file
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Esporta ${filename}`,
        });
      } else {
        Alert.alert('Attenzione', 'File salvato ma condivisione non disponibile');
      }
      
      return true;
    } catch (error: any) {
      console.error('Mobile export error:', error);
      // Fallback: show message to use web version
      Alert.alert(
        'Esportazione non disponibile', 
        'Per esportare i dati in Excel, utilizza la versione web dell\'app.',
        [{ text: 'OK' }]
      );
      throw new Error('Esportazione mobile non supportata. Usa la versione web.');
    }
  }
};
