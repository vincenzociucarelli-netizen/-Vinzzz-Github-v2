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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import api from '../../src/services/api';

export default function PrimaNotaPagamenti() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [registro, setRegistro] = useState<any>(null);
  const [loadingRegistro, setLoadingRegistro] = useState(false);
  const [solleciti, setSolleciti] = useState<any[]>([]);
  const [loadingSolleciti, setLoadingSolleciti] = useState(false);
  const [selectedSolleciti, setSelectedSolleciti] = useState<string[]>([]);
  const [sendingNotifiche, setSendingNotifiche] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [activeSection, setActiveSection] = useState<'import' | 'registro' | 'solleciti'>('import');
  const [resolutions, setResolutions] = useState<Record<number, string>>({});
  const [resolvingImport, setResolvingImport] = useState(false);

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

  // === DOWNLOAD XLSX HELPER ===
  const downloadXlsx = async (wb: XLSX.WorkBook, filename: string) => {
    if (Platform.OS === 'web') {
      try {
        XLSX.writeFile(wb, filename);
      } catch (e) {
        // Fallback: manual blob download
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    } else {
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: filename,
        });
      }
    }
  };

  // === SEZIONE 1: IMPORT ===
  const downloadTemplate = async () => {
    try {
      const headerRow = ['Cognome', 'Nome', 'DataPagamento', 'Importo', 'TipoPagamento', 'DataRegistrazione', 'Causale'];
      const dataRows = [
        ['ROSSI', 'GIULIA', '15/01/2025', '150,00', 'B', '16/01/2025', 'Quota Gennaio-Febbraio'],
        ['RIGO', 'ISA', '20/01/2025', '250,00', 'P', '', 'Quota Trimestrale'],
        ['RIGO', 'PIA', '22/01/2025', '250,00', 'C', '', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
      
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
      await downloadXlsx(wb, 'Template_Pagamenti.xlsx');
    } catch (error) {
      showAlert('Errore', 'Impossibile creare il template');
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
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(response.data);
      if (response.data.imported > 0) {
        showAlert('Importazione completata', response.data.message);
      }
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'importazione');
    } finally {
      setImporting(false);
    }
  };

  // === RESOLVE AMBIGUOUS ===
  const resolveUnresolved = async () => {
    if (!importResult?.unresolved?.length) return;
    
    const unresolvedItems = importResult.unresolved;
    const resolvedList = unresolvedItems
      .filter((_: any, idx: number) => resolutions[idx])
      .map((item: any, idx: number) => ({
        athlete_id: resolutions[idx],
        row_data: item.row_data,
      }));
    
    if (resolvedList.length === 0) {
      showAlert('Attenzione', 'Seleziona almeno un atleta per ogni riga da risolvere');
      return;
    }
    
    setResolvingImport(true);
    try {
      const response = await api.post('/payments/import-resolve', { resolutions: resolvedList });
      showAlert('Risoluzione completata', response.data.message);
      // Clear resolved items from importResult
      setImportResult((prev: any) => ({
        ...prev,
        imported: prev.imported + response.data.imported,
        unresolved: prev.unresolved.filter((_: any, idx: number) => !resolutions[idx]),
        unresolved_count: prev.unresolved.filter((_: any, idx: number) => !resolutions[idx]).length,
      }));
      setResolutions({});
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la risoluzione');
    } finally {
      setResolvingImport(false);
    }
  };

  // === SEZIONE 2: REGISTRO STAGIONE ===
  const loadRegistro = async () => {
    setLoadingRegistro(true);
    try {
      const response = await api.get('/payments/registro-stagione');
      setRegistro(response.data);
    } catch (error) {
      showAlert('Errore', 'Impossibile caricare il registro');
    } finally {
      setLoadingRegistro(false);
    }
  };

  const downloadRegistro = async () => {
    if (!registro || registro.rows.length === 0) {
      showAlert('Attenzione', 'Nessun pagamento registrato nella stagione corrente');
      return;
    }
    try {
      if (Platform.OS === 'web') {
        const token = api.defaults.headers.common['Authorization'];
        const baseUrl = api.defaults.baseURL || '';
        const response = await api.get('/export-csv/prima-nota', { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Prima_Nota_Cassa_${registro.season.replace('/', '-')}.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 200);
      } else {
        const headers = ['Ric. Fiscale', 'Data Registrazione', 'Cognome', 'Nome', 'Data Pagamento', 'Tipo', 'Importo', 'Causale'];
        const data = registro.rows.map((r: any) => [
          r['Ric. Fiscale'], r['Data Registrazione'], r['Cognome'], r['Nome'],
          r['Data Pagamento'], r['Tipo'], r['Importo'], r['Causale']
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Registro ${registro.season}`);
        await downloadXlsx(wb, `Registro_Stagione_${registro.season.replace('/', '-')}.xlsx`);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile scaricare il registro');
    }
  };

  // === SEZIONE 3: SOLLECITI ===
  const loadSolleciti = async () => {
    setLoadingSolleciti(true);
    try {
      const response = await api.get('/payments/solleciti');
      setSolleciti(response.data);
      setSelectedSolleciti([]);
    } catch (error) {
      showAlert('Errore', 'Impossibile caricare i solleciti');
    } finally {
      setLoadingSolleciti(false);
    }
  };

  const toggleSollecito = (athleteId: string) => {
    setSelectedSolleciti(prev => 
      prev.includes(athleteId) 
        ? prev.filter(id => id !== athleteId) 
        : [...prev, athleteId]
    );
  };

  const selectAllSolleciti = () => {
    if (selectedSolleciti.length === solleciti.length) {
      setSelectedSolleciti([]);
    } else {
      setSelectedSolleciti(solleciti.map(s => s.athlete_id));
    }
  };

  const sendNotifiche = async () => {
    if (selectedSolleciti.length === 0) {
      showAlert('Attenzione', 'Seleziona almeno un atleta');
      return;
    }
    setSendingNotifiche(true);
    try {
      const response = await api.post('/payments/solleciti/notifica', {
        athlete_ids: selectedSolleciti,
        send_email: sendEmail,
      });
      showAlert('Solleciti inviati', response.data.message);
      setSelectedSolleciti([]);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore invio notifiche');
    } finally {
      setSendingNotifiche(false);
    }
  };

  const downloadSolleciti = async () => {
    if (solleciti.length === 0) {
      showAlert('Attenzione', 'Nessun sollecito da esportare');
      return;
    }
    try {
      const headers = ['Cognome', 'Nome', 'Squadra', 'Genitore', 'Email Genitore', 'Telefono Genitore', 'Importo Dovuto', 'Rate Scadute'];
      const data = solleciti.map((s: any) => [
        s.cognome, s.nome, s.squadra, s.parent_name, s.parent_email, s.parent_phone,
        s.total_due.toFixed(2).replace('.', ','),
        s.installments.map((i: any) => `${i.description} (${i.due_date})`).join('; ')
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Solleciti');
      await downloadXlsx(wb, 'Solleciti_Pagamenti.xlsx');
    } catch (error) {
      showAlert('Errore', 'Impossibile scaricare i solleciti');
    }
  };

  // === Section tab switching ===
  const onSectionChange = (section: 'import' | 'registro' | 'solleciti') => {
    setActiveSection(section);
    if (section === 'registro' && !registro) loadRegistro();
    if (section === 'solleciti' && solleciti.length === 0) loadSolleciti();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prima Nota Pagamenti</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Section Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'import' && styles.tabActive]}
          onPress={() => onSectionChange('import')}
          data-testid="tab-import"
        >
          <Ionicons name="cloud-upload-outline" size={18} color={activeSection === 'import' ? '#007AFF' : '#888'} />
          <Text style={[styles.tabText, activeSection === 'import' && styles.tabTextActive]}>Import</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'registro' && styles.tabActive]}
          onPress={() => onSectionChange('registro')}
          data-testid="tab-registro"
        >
          <Ionicons name="book-outline" size={18} color={activeSection === 'registro' ? '#007AFF' : '#888'} />
          <Text style={[styles.tabText, activeSection === 'registro' && styles.tabTextActive]}>Registro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'solleciti' && styles.tabActive]}
          onPress={() => onSectionChange('solleciti')}
          data-testid="tab-solleciti"
        >
          <Ionicons name="alert-circle-outline" size={18} color={activeSection === 'solleciti' ? '#E53935' : '#888'} />
          <Text style={[styles.tabText, activeSection === 'solleciti' && styles.tabTextActive]}>Solleciti</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* ========== SEZIONE IMPORT ========== */}
        {activeSection === 'import' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Come importare i pagamenti</Text>
              <Text style={styles.instruction}>1. Scarica il <Text style={styles.bold}>Template</Text></Text>
              <Text style={styles.instruction}>2. Compila con <Text style={styles.bold}>Cognome, Nome, importo e data</Text> dalla prima nota</Text>
              <Text style={styles.instruction}>3. Il sistema abbina automaticamente i nomi agli atleti</Text>
              <Text style={styles.instruction}>4. Importa il file compilato</Text>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#FF9500', flex: 1 }]} 
                onPress={downloadTemplate}
                data-testid="download-template-btn"
              >
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Scarica Template</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#007AFF', marginBottom: 16 }, importing && { opacity: 0.6 }]} 
              onPress={importPayments}
              disabled={importing}
              data-testid="import-payments-btn"
            >
              {importing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Importa Pagamenti</Text>
                </>
              )}
            </TouchableOpacity>

            {importResult && (
              <View style={[styles.resultCard, 
                (importResult.errors?.length > 0 || importResult.duplicates_count > 0 || importResult.unresolved_count > 0) 
                  ? styles.resultWarning : styles.resultSuccess
              ]}>
                <Text style={styles.resultTitle}>
                  {importResult.unresolved_count > 0 
                    ? 'Importazione: scelte richieste'
                    : importResult.errors?.length > 0 || importResult.duplicates_count > 0 
                      ? 'Importazione con avvisi' : 'Importazione completata'}
                </Text>
                <Text style={styles.resultText}>Pagamenti importati: {importResult.imported}</Text>

                {/* UNRESOLVED - Disambiguation UI */}
                {importResult.unresolved?.length > 0 && (
                  <View style={[styles.warningBox, { backgroundColor: '#E3F2FD', borderLeftWidth: 3, borderLeftColor: '#1565C0', padding: 12 }]}>
                    <Text style={[styles.warningTitle, { color: '#1565C0', fontSize: 14, marginBottom: 8 }]}>
                      Omonimi trovati ({importResult.unresolved.length}) - Scegli l'atleta corretto:
                    </Text>
                    {importResult.unresolved.map((item: any, idx: number) => (
                      <View key={idx} style={styles.unresolvedItem}>
                        <Text style={styles.unresolvedName}>
                          Riga {item.row_index}: <Text style={{ fontWeight: '800' }}>{item.cognome} {item.nome}</Text>
                          {' '}({item.row_data?.Importo || ''} EUR)
                        </Text>
                        {item.candidates.map((c: any) => (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.candidateBtn,
                              resolutions[idx] === c.id && styles.candidateBtnSelected
                            ]}
                            onPress={() => setResolutions(prev => ({ ...prev, [idx]: c.id }))}
                            data-testid={`candidate-${idx}-${c.id}`}
                          >
                            <Ionicons 
                              name={resolutions[idx] === c.id ? "radio-button-on" : "radio-button-off"} 
                              size={20} 
                              color={resolutions[idx] === c.id ? '#1565C0' : '#999'} 
                            />
                            <Text style={[styles.candidateText, resolutions[idx] === c.id && { color: '#1565C0', fontWeight: '700' }]}>
                              {c.first_name} {c.last_name} - <Text style={{ fontStyle: 'italic' }}>{c.team}</Text>
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#1565C0', marginTop: 12 }, resolvingImport && { opacity: 0.6 }]}
                      onPress={resolveUnresolved}
                      disabled={resolvingImport}
                      data-testid="resolve-import-btn"
                    >
                      {resolvingImport ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.actionBtnText}>Conferma e importa</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {importResult.duplicates_count > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>Duplicati ignorati ({importResult.duplicates_count}):</Text>
                    {importResult.duplicates?.slice(0, 5).map((dup: string, idx: number) => (
                      <Text key={idx} style={styles.warningText}>- {dup}</Text>
                    ))}
                  </View>
                )}
                {importResult.errors?.length > 0 && (
                  <View style={[styles.warningBox, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.warningTitle, { color: '#C62828' }]}>Errori:</Text>
                    {importResult.errors.map((err: string, idx: number) => (
                      <Text key={idx} style={[styles.warningText, { color: '#B71C1C' }]}>- {err}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Formato Template</Text>
              {[
                { label: 'Cognome', desc: 'Es: ROSSI' },
                { label: 'Nome', desc: 'Es: GIULIA' },
                { label: 'DataPagamento', desc: 'Es: 15/01/2025' },
                { label: 'Importo', desc: 'Es: 150,00' },
                { label: 'TipoPagamento', desc: 'B / P / C / A' },
              ].map((item, idx) => (
                <View key={idx} style={styles.formatItem}>
                  <Text style={styles.formatLabel}>{item.label}</Text>
                  <Text style={styles.formatDesc}>{item.desc}</Text>
                </View>
              ))}
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>B=Bonifico, P=POS, C=Contanti, A=Assegno</Text>
              </View>
              <View style={[styles.hintBox, { backgroundColor: '#E8F5E9', marginTop: 8 }]}>
                <Text style={[styles.hintText, { color: '#2E7D32' }]}>Il sistema abbina automaticamente Cognome+Nome all'atleta</Text>
              </View>
            </View>
          </>
        )}

        {/* ========== SEZIONE REGISTRO ========== */}
        {activeSection === 'registro' && (
          <>
            {loadingRegistro ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Caricamento registro...</Text>
              </View>
            ) : registro ? (
              <>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Stagione {registro.season}</Text>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNumber}>{registro.total_payments}</Text>
                      <Text style={styles.summaryLabel}>Pagamenti</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNumber}>{registro.total_amount.toFixed(2).replace('.', ',')} EUR</Text>
                      <Text style={styles.summaryLabel}>Totale incassato</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: '#4CAF50', marginBottom: 16 }]}
                  onPress={downloadRegistro}
                  data-testid="download-registro-btn"
                >
                  <Ionicons name="download-outline" size={22} color="#fff" />
                  <Text style={styles.actionBtnText}>Scarica Registro CSV</Text>
                </TouchableOpacity>

                {registro.rows.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Ultimi pagamenti registrati</Text>
                    {registro.rows.slice(-10).reverse().map((row: any, idx: number) => (
                      <View key={idx} style={styles.registroRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.registroName}>{row.Cognome} {row.Nome}</Text>
                          <Text style={styles.registroDetail}>{row['Data Pagamento']} - {row.Tipo} - Ric. {row['Ric. Fiscale']}</Text>
                        </View>
                        <Text style={styles.registroAmount}>{row.Importo} EUR</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="document-text-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>Nessun pagamento registrato in questa stagione</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: '#78909C', marginBottom: 16 }]}
                  onPress={loadRegistro}
                >
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Aggiorna</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="book-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Caricamento in corso...</Text>
              </View>
            )}
          </>
        )}

        {/* ========== SEZIONE SOLLECITI ========== */}
        {activeSection === 'solleciti' && (
          <>
            {loadingSolleciti ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#E53935" />
                <Text style={styles.loadingText}>Caricamento solleciti...</Text>
              </View>
            ) : (
              <>
                {solleciti.length > 0 ? (
                  <>
                    <View style={[styles.summaryCard, { borderLeftColor: '#E53935' }]}>
                      <Text style={[styles.summaryTitle, { color: '#C62828' }]}>
                        {solleciti.length} atleti con pagamenti in sospeso
                      </Text>
                      <Text style={styles.summarySubtitle}>
                        Totale: {solleciti.reduce((sum: number, s: any) => sum + s.total_due, 0).toFixed(2).replace('.', ',')} EUR
                      </Text>
                    </View>

                    <View style={styles.buttonsRow}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#FF9800', flex: 1 }]}
                        onPress={downloadSolleciti}
                        data-testid="download-solleciti-btn"
                      >
                        <Ionicons name="download-outline" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Scarica Excel</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.card}>
                      <View style={styles.sollecitHeaderRow}>
                        <TouchableOpacity onPress={selectAllSolleciti} style={styles.checkboxArea} data-testid="select-all-solleciti">
                          <Ionicons 
                            name={selectedSolleciti.length === solleciti.length ? "checkbox" : "square-outline"} 
                            size={22} 
                            color={selectedSolleciti.length === solleciti.length ? '#007AFF' : '#999'} 
                          />
                          <Text style={styles.selectAllText}>
                            {selectedSolleciti.length === solleciti.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {solleciti.map((s: any, idx: number) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={styles.sollecitoItem}
                          onPress={() => toggleSollecito(s.athlete_id)}
                          data-testid={`sollecito-item-${idx}`}
                        >
                          <Ionicons 
                            name={selectedSolleciti.includes(s.athlete_id) ? "checkbox" : "square-outline"} 
                            size={22} 
                            color={selectedSolleciti.includes(s.athlete_id) ? '#007AFF' : '#ccc'} 
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.sollecitoName}>{s.cognome} {s.nome}</Text>
                            <Text style={styles.sollecitoDetail}>
                              {s.squadra}{s.parent_name ? ` - Gen.: ${s.parent_name}` : ''}
                            </Text>
                            {s.installments.map((inst: any, iIdx: number) => (
                              <Text key={iIdx} style={styles.sollecitoRate}>
                                - {inst.description}: {inst.amount.toFixed(2).replace('.', ',')} EUR {inst.due_date ? `(scad. ${inst.due_date})` : ''}
                              </Text>
                            ))}
                          </View>
                          <Text style={styles.sollecitoAmount}>{s.total_due.toFixed(2).replace('.', ',')} EUR</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {selectedSolleciti.length > 0 && (
                      <View style={styles.sendOptionsCard}>
                        {/* Email toggle */}
                        <TouchableOpacity 
                          style={styles.emailToggle} 
                          onPress={() => setSendEmail(!sendEmail)}
                          data-testid="toggle-email-solleciti"
                        >
                          <Ionicons 
                            name={sendEmail ? "checkbox" : "square-outline"} 
                            size={22} 
                            color={sendEmail ? '#E53935' : '#999'} 
                          />
                          <Ionicons name="mail-outline" size={18} color={sendEmail ? '#E53935' : '#888'} style={{ marginLeft: 8 }} />
                          <Text style={[styles.emailToggleText, sendEmail && { color: '#E53935', fontWeight: '700' }]}>
                            Invia anche email sollecito
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: '#E53935' }, sendingNotifiche && { opacity: 0.6 }]}
                          onPress={sendNotifiche}
                          disabled={sendingNotifiche}
                          data-testid="send-notifiche-btn"
                        >
                          {sendingNotifiche ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="notifications" size={22} color="#fff" />
                              <Text style={styles.actionBtnText}>
                                Invia Sollecito{sendEmail ? ' + Email' : ''} ({selectedSolleciti.length})
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#78909C', marginBottom: 16 }]}
                      onPress={loadSolleciti}
                    >
                      <Ionicons name="refresh" size={20} color="#fff" />
                      <Text style={styles.actionBtnText}>Aggiorna</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
                    <Text style={[styles.emptyText, { color: '#4CAF50' }]}>Nessun pagamento in sospeso</Text>
                    <Text style={styles.emptySubtext}>Tutti gli atleti sono in regola</Text>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#78909C', marginTop: 16 }]}
                      onPress={loadSolleciti}
                    >
                      <Ionicons name="refresh" size={20} color="#fff" />
                      <Text style={styles.actionBtnText}>Ricarica</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  tabsContainer: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#007AFF', fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  instruction: { fontSize: 14, color: '#555', marginBottom: 8, lineHeight: 20 },
  bold: { fontWeight: 'bold', color: '#007AFF' },
  buttonsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 10, gap: 8,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  resultSuccess: { backgroundColor: '#E8F5E9', borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  resultWarning: { backgroundColor: '#FFF3E0', borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  resultText: { fontSize: 14, color: '#333' },
  warningBox: { marginTop: 10, padding: 10, backgroundColor: '#FFF8E1', borderRadius: 8 },
  warningTitle: { fontSize: 13, fontWeight: '600', color: '#F57C00', marginBottom: 4 },
  warningText: { fontSize: 12, color: '#E65100', marginBottom: 2 },
  formatItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  formatLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  formatDesc: { fontSize: 13, color: '#666' },
  hintBox: { backgroundColor: '#E3F2FD', padding: 8, borderRadius: 6, marginTop: 4 },
  hintText: { fontSize: 11, color: '#1565C0', fontStyle: 'italic' },
  // Unresolved / disambiguation
  unresolvedItem: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#BBDEFB',
  },
  unresolvedName: { fontSize: 14, color: '#333', marginBottom: 8 },
  candidateBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, marginBottom: 4, backgroundColor: '#F5F5F5', gap: 8,
  },
  candidateBtnSelected: {
    backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#1565C0',
  },
  candidateText: { fontSize: 14, color: '#555' },
  // Registro
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
    borderLeftWidth: 4, borderLeftColor: '#4CAF50',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  summarySubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50' },
  summaryLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#e0e0e0' },
  registroRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  registroName: { fontSize: 14, fontWeight: '600', color: '#333' },
  registroDetail: { fontSize: 12, color: '#888', marginTop: 2 },
  registroAmount: { fontSize: 15, fontWeight: 'bold', color: '#4CAF50', marginLeft: 8 },
  // Solleciti
  sollecitHeaderRow: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  checkboxArea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { fontSize: 14, color: '#555' },
  sollecitoItem: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  sollecitoName: { fontSize: 14, fontWeight: '700', color: '#333' },
  sollecitoDetail: { fontSize: 12, color: '#888', marginTop: 2 },
  sollecitoRate: { fontSize: 11, color: '#E65100', marginTop: 2 },
  sollecitoAmount: { fontSize: 15, fontWeight: 'bold', color: '#E53935', marginLeft: 8 },
  // Send options
  sendOptionsCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#FFCDD2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  emailToggle: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  emailToggleText: { fontSize: 14, color: '#666', marginLeft: 6 },
  // Empty states
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 40, marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  emptyText: { fontSize: 16, color: '#888', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#aaa', marginTop: 4 },
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 14, color: '#888', marginTop: 12 },
});
