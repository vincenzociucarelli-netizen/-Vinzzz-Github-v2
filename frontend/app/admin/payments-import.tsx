import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import api from '../../src/services/api';

export default function PaymentsImport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    loadAthletesCodes();
  }, []);

  const loadAthletesCodes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payments/export-athletes-codes');
      setAthletes(response.data);
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const downloadTemplate = async () => {
    try {
      // Create header row - new format with Cognome+Nome instead of CodiceAtleta
      const headerRow = ['Cognome', 'Nome', 'DataPagamento', 'Importo', 'TipoPagamento', 'DataRegistrazione', 'Causale'];
      
      // Example data rows matching Prima Nota workflow
      const dataRows = [
        ['ROSSI', 'GIULIA', '15/01/2025', '150,00', 'B', '16/01/2025', 'Quota Gennaio-Febbraio'],
        ['RIGO', 'ISA', '20/01/2025', '250,00', 'P', '', 'Quota Trimestrale'],
        ['RIGO', 'PIA', '22/01/2025', '250,00', 'C', '', ''],
      ];
      
      // Create worksheet with array of arrays
      const wsData = [headerRow, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Cognome
        { wch: 20 }, // Nome
        { wch: 14 }, // DataPagamento
        { wch: 12 }, // Importo
        { wch: 14 }, // TipoPagamento
        { wch: 16 }, // DataRegistrazione
        { wch: 30 }, // Causale
      ];
      
      // Create instructions sheet
      const instructionsData = [
        ['ISTRUZIONI PER LA COMPILAZIONE'],
        [''],
        ['Colonna', 'Formato', 'Esempio', 'Note'],
        ['Cognome', 'Testo', 'ROSSI', 'Cognome dell\'atleta (il sistema abbina automaticamente)'],
        ['Nome', 'Testo', 'GIULIA', 'Nome dell\'atleta'],
        ['DataPagamento', 'gg/mm/aaaa', '15/01/2025', 'Data del pagamento effettivo'],
        ['Importo', 'Numero', '150,00', 'Importo in euro (senza simbolo)'],
        ['TipoPagamento', 'Lettera', 'B', 'B=Bonifico, P=POS, C=Contanti, A=Assegno'],
        ['DataRegistrazione', 'gg/mm/aaaa', '16/01/2025', 'Opzionale - data registrazione contabile'],
        ['Causale', 'Testo', 'Quota mensile', 'Opzionale - descrizione del pagamento'],
        [''],
        ['NOTE IMPORTANTI:'],
        ['- Il sistema abbina automaticamente Cognome+Nome all\'atleta registrato'],
        ['- In caso di omonimi, viene segnalata l\'ambiguita con la squadra'],
        ['- Maiuscolo/minuscolo e accenti sono ignorati nel matching'],
      ];
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
      wsInstructions['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 55 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pagamenti');
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Istruzioni');

      if (Platform.OS === 'web') {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Template_Pagamenti.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = FileSystem.documentDirectory + 'Template_Pagamenti.xlsx';
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (sharingAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Template Pagamenti',
          });
        }
      }
    } catch (error) {
      console.error('Error creating template:', error);
      showAlert('Errore', 'Impossibile creare il template');
    }
  };

  const downloadAthletesList = async () => {
    try {
      if (athletes.length === 0) {
        showAlert('Attenzione', 'Nessun atleta trovato');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(athletes);
      
      ws['!cols'] = [
        { wch: 15 }, // CodiceAtleta
        { wch: 20 }, // Cognome
        { wch: 20 }, // Nome
        { wch: 15 }, // Squadra
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Atleti');

      if (Platform.OS === 'web') {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Lista_Atleti_Codici.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = FileSystem.documentDirectory + 'Lista_Atleti_Codici.xlsx';
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (sharingAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Lista Atleti con Codici',
          });
        }
      }
    } catch (error) {
      console.error('Error exporting athletes:', error);
      showAlert('Errore', 'Impossibile esportare la lista');
    }
  };

  const importPayments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setImporting(true);
      setImportResult(null);

      const file = result.assets[0];
      
      // Create form data
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append('file', blob, file.name);
      } else {
        formData.append('file', {
          uri: file.uri,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: file.name,
        } as any);
      }

      const response = await api.post('/payments/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(response.data);
      
      if (response.data.imported > 0) {
        showAlert('Importazione completata', response.data.message);
      }

    } catch (error: any) {
      console.error('Error importing:', error);
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'importazione');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Pagamenti</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Instructions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Come importare i pagamenti</Text>
          <Text style={styles.instruction}>1. Scarica il <Text style={styles.bold}>Template Pagamenti</Text></Text>
          <Text style={styles.instruction}>2. Compila con <Text style={styles.bold}>Cognome, Nome, importo e data</Text> dalla prima nota</Text>
          <Text style={styles.instruction}>3. Il sistema abbina automaticamente i nomi agli atleti</Text>
          <Text style={styles.instruction}>4. Importa il file compilato</Text>
        </View>

        {/* Download Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity 
            style={[styles.downloadBtn, styles.templateBtn, { flex: 1 }]} 
            onPress={downloadTemplate}
            data-testid="download-template-btn"
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.downloadBtnText}>Scarica Template</Text>
          </TouchableOpacity>
        </View>

        {/* Import Button */}
        <TouchableOpacity 
          style={[styles.importBtn, importing && styles.importBtnDisabled]} 
          onPress={importPayments}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="#fff" />
              <Text style={styles.importBtnText}>Importa Pagamenti</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Import Result */}
        {importResult && (
          <View style={[styles.resultCard, 
            (importResult.errors?.length > 0 || importResult.duplicates_count > 0) 
              ? styles.resultWarning 
              : styles.resultSuccess
          ]}>
            <Text style={styles.resultTitle}>
              {importResult.errors?.length > 0 || importResult.duplicates_count > 0 
                ? '⚠️ Importazione con avvisi' 
                : '✅ Importazione completata'}
            </Text>
            <Text style={styles.resultText}>Pagamenti importati: {importResult.imported}</Text>
            
            {/* Duplicates Warning */}
            {importResult.duplicates_count > 0 && (
              <View style={styles.duplicatesContainer}>
                <Text style={styles.duplicatesTitle}>🔄 Duplicati ignorati ({importResult.duplicates_count}):</Text>
                {importResult.duplicates?.slice(0, 5).map((dup: string, idx: number) => (
                  <Text key={idx} style={styles.duplicateText}>• {dup}</Text>
                ))}
                {importResult.duplicates_count > 5 && (
                  <Text style={styles.duplicateText}>...e altri {importResult.duplicates_count - 5} duplicati</Text>
                )}
              </View>
            )}
            
            {/* Errors */}
            {importResult.errors?.length > 0 && (
              <View style={styles.errorsContainer}>
                <Text style={styles.errorsTitle}>❌ Errori:</Text>
                {importResult.errors.map((err: string, idx: number) => (
                  <Text key={idx} style={styles.errorText}>• {err}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Athletes Preview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Atleti registrati ({athletes.length})</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <View style={styles.athletesList}>
              {athletes.slice(0, 10).map((a, idx) => (
                <View key={idx} style={styles.athleteItem}>
                  <Text style={styles.athleteName}>{a.Cognome} {a.Nome}</Text>
                  <Text style={styles.athleteTeam}>{a.Squadra}</Text>
                </View>
              ))}
              {athletes.length > 10 && (
                <Text style={styles.moreText}>...e altri {athletes.length - 10} atleti</Text>
              )}
            </View>
          )}
        </View>

        {/* Template Format */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Formato Template</Text>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>Cognome</Text>
            <Text style={styles.formatDesc}>Es: ROSSI</Text>
          </View>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>Nome</Text>
            <Text style={styles.formatDesc}>Es: GIULIA</Text>
          </View>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>DataPagamento</Text>
            <Text style={styles.formatDesc}>Es: 15/01/2025</Text>
          </View>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>Importo</Text>
            <Text style={styles.formatDesc}>Es: 150,00</Text>
          </View>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>TipoPagamento</Text>
            <Text style={styles.formatDesc}>B / P / C / A</Text>
          </View>
          <View style={styles.formatHint}>
            <Text style={styles.formatHintText}>B=Bonifico, P=POS, C=Contanti, A=Assegno</Text>
          </View>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>DataRegistrazione</Text>
            <Text style={styles.formatDesc}>(Opzionale)</Text>
          </View>
          <View style={styles.formatItem}>
            <Text style={styles.formatLabel}>Causale</Text>
            <Text style={styles.formatDesc}>(Opzionale)</Text>
          </View>
          <View style={[styles.formatHint, { backgroundColor: '#E8F5E9', marginTop: 8 }]}>
            <Text style={[styles.formatHintText, { color: '#2E7D32' }]}>Il sistema abbina automaticamente Cognome+Nome all'atleta registrato</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  instruction: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  listBtn: {
    backgroundColor: '#34C759',
  },
  templateBtn: {
    backgroundColor: '#FF9500',
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  importBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  importBtnDisabled: {
    opacity: 0.6,
  },
  importBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultSuccess: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  resultWarning: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
  },
  errorsContainer: {
    marginTop: 12,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#BF360C',
    marginBottom: 2,
  },
  duplicatesContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  duplicatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 4,
  },
  duplicateText: {
    fontSize: 13,
    color: '#E65100',
    marginBottom: 2,
  },
  athletesList: {
    marginTop: 8,
  },
  athleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  athleteCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    width: 90,
  },
  athleteName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  athleteTeam: {
    fontSize: 12,
    color: '#888',
  },
  moreText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  formatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  formatDesc: {
    fontSize: 13,
    color: '#666',
  },
  formatHint: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    marginTop: -4,
  },
  formatHintText: {
    fontSize: 11,
    color: '#1565C0',
    fontStyle: 'italic',
  },
});
