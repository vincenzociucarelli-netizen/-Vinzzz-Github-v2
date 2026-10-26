import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { Icon } from '../../../src/components/Icon';
import InstitutionalBanner from '../../../src/components/InstitutionalBanner';
import { useRouter } from 'expo-router';
import api from '../../../src/services/api';

interface ExportOption {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  endpoint: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    key: 'athletes',
    title: 'Atleti',
    description: 'Nome, codice fiscale, contatti, squadra, certificato, QR code',
    icon: 'people',
    color: '#007AFF',
    endpoint: '/export-csv/athletes',
  },
  {
    key: 'attendances',
    title: 'Presenze',
    description: 'Data, atleta, squadra, orario check-in, stato, forzature',
    icon: 'calendar',
    color: '#34C759',
    endpoint: '/export-csv/attendances',
  },
  {
    key: 'compensations',
    title: 'Compensi Staff',
    description: 'Coach, collaboratori, dirigenti con compensi e date contratto',
    icon: 'cash',
    color: '#FF9500',
    endpoint: '/export-csv/compensations',
  },
  {
    key: 'audit-logs',
    title: 'Audit Log',
    description: 'Cronologia azioni: login, modifiche, eliminazioni (GDPR)',
    icon: 'shield-checkmark',
    color: '#5856D6',
    endpoint: '/export-csv/audit-logs',
  },
  {
    key: 'prima-nota',
    title: 'Prima Nota Cassa',
    description: 'Data registrazione, progressivo, data pagamento, atleta, squadra, metodo, importo',
    icon: 'receipt',
    color: '#FF2D55',
    endpoint: '/export-csv/prima-nota',
  },
];

export default function ExportDataPage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any>(null);
  const [savingSched, setSavingSched] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const authResponse = await api.get('/auth/me');
      if (authResponse.data?.role !== 'admin') {
        setIsAdmin(false);
        router.replace('/');
        return;
      }
      setIsAdmin(true);
      loadSchedule();
    } catch (error) {
      setIsAdmin(false);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#8E44AD" />
      </View>
    );
  }

  if (!isAdmin) return null;

  const handleExport = async (option: ExportOption) => {
    setDownloading(option.key);
    
    try {
      // Get token from storage
      const token = await getToken();
      
      if (Platform.OS === 'web') {
        // On web, open download in new tab
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        const url = `${baseUrl}/api${option.endpoint}`;
        
        // Create a temporary link and trigger download
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${option.key}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        showAlert('Download completato', `File ${option.title} scaricato con successo!`);
      } else {
        // On native, show info
        showAlert(
          'Export su Mobile',
          'Per scaricare i file CSV, accedi all\'app da un browser web.'
        );
      }
    } catch (error: any) {
      console.error('Export error:', error);
      showAlert('Errore', 'Impossibile scaricare il file. Riprova.');
    } finally {
      setDownloading(null);
    }
  };

  const getToken = async (): Promise<string> => {
    // Try to get token from localStorage on web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return localStorage.getItem('token') || '';
    }
    // On native, use AsyncStorage
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return await AsyncStorage.getItem('token') || '';
    } catch {
      return '';
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const loadSchedule = async () => {
    try {
      const r = await api.get('/admin/backup/schedule');
      const d = r.data || {};
      setSchedule({
        enabled: !!d.enabled,
        frequency_days: d.frequency_days || 1,
        hour: typeof d.hour === 'number' ? d.hour : 3,
        email: d.email || d.default_email || '',
        last_run_at: d.last_run_at || null,
        last_status: d.last_status || null,
      });
    } catch {
      setSchedule({ enabled: false, frequency_days: 1, hour: 3, email: '', last_run_at: null, last_status: null });
    }
  };

  const saveSchedule = async () => {
    if (!schedule) return;
    if (schedule.enabled && !(schedule.email || '').trim()) {
      showAlert('Email mancante', 'Inserisci l\'email dove ricevere il backup.');
      return;
    }
    setSavingSched(true);
    try {
      await api.put('/admin/backup/schedule', {
        enabled: schedule.enabled,
        frequency_days: schedule.frequency_days,
        hour: schedule.hour,
        email: (schedule.email || '').trim(),
      });
      showAlert('Salvato', schedule.enabled
        ? `Backup automatico attivo: ogni ${schedule.frequency_days === 1 ? 'giorno' : schedule.frequency_days + ' giorni'} intorno alle ${String(schedule.hour).padStart(2, '0')}:00, inviato a ${(schedule.email || '').trim()}.`
        : 'Backup automatico disattivato.');
    } catch {
      showAlert('Errore', 'Impossibile salvare le impostazioni.');
    } finally {
      setSavingSched(false);
    }
  };

  const sendNow = async () => {
    setSendingNow(true);
    try {
      const r = await api.post('/admin/backup/send-now', { email: (schedule?.email || '').trim() || undefined });
      showAlert('Backup inviato', r.data?.message || 'Backup inviato via email.');
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Invio del backup fallito. Riprova.');
    } finally {
      setSendingNow(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Icon name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.title}>Esporta Dati</Text>
        <View style={{ width: 40 }} />
      </View>

      <InstitutionalBanner detail="Gli export GDPR personali devono essere richiesti dal Legale Rappresentante o dal singolo interessato." />

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="information-circle" size={20} color="#1565C0" />
        <Text style={styles.infoText}>
          I file CSV possono essere aperti con Excel, Google Sheets o altri programmi di foglio di calcolo.
        </Text>
      </View>

      {/* Export Options */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* BACKUP COMPLETO — card speciale in cima */}
        <TouchableOpacity
          style={[styles.exportCard, styles.backupCard]}
          onPress={async () => {
            setDownloading('backup-full');
            try {
              const token = await getToken();
              if (Platform.OS === 'web') {
                const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
                const res = await fetch(`${baseUrl}/api/admin/backup/export`, {
                  headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('Backup failed');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_${new Date().toISOString().split('T')[0]}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showAlert('Backup completato', 'Archivio ZIP scaricato con successo! Conservalo in un luogo sicuro.');
              } else {
                showAlert('Backup su Mobile', 'Per scaricare il backup completo accedi all\'app da un browser web.');
              }
            } catch (e) {
              showAlert('Errore', 'Impossibile scaricare il backup. Riprova.');
            } finally {
              setDownloading(null);
            }
          }}
          disabled={downloading !== null}
          data-testid="backup-full-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#fff3' }]}>
            <Icon name="archive" size={28} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#fff' }]}>🗄️ Backup completo (ZIP)</Text>
            <Text style={[styles.cardDescription, { color: '#fff', opacity: 0.9 }]}>
              Scarica TUTTI i dati della società in un unico archivio ZIP (JSON). Consigliato prima di grosse operazioni o come assicurazione GDPR periodica.
            </Text>
          </View>
          {downloading === 'backup-full' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="download-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>

        {/* BACKUP AUTOMATICO VIA EMAIL */}
        {schedule && (
          <View style={styles.schedCard}>
            <View style={styles.schedHeader}>
              <Icon name="time-outline" size={22} color="#5856D6" />
              <Text style={styles.schedTitle}>Backup automatico via email</Text>
              <Switch
                value={schedule.enabled}
                onValueChange={(v) => setSchedule({ ...schedule, enabled: v })}
                trackColor={{ true: '#5856D6', false: '#ccc' }}
              />
            </View>
            <Text style={styles.schedDesc}>
              {"Ricevi il backup (ZIP con JSON + CSV) via email, in automatico. È una copia di sicurezza indipendente dall'app: resta nella tua posta anche se l'app non è raggiungibile."}
            </Text>

            <Text style={styles.schedLabel}>Frequenza</Text>
            <View style={styles.segRow}>
              {[{ l: 'Ogni giorno', v: 1 }, { l: 'Ogni 2 gg', v: 2 }, { l: 'Ogni 3 gg', v: 3 }, { l: 'Settimanale', v: 7 }].map((o) => (
                <TouchableOpacity
                  key={o.v}
                  style={[styles.seg, schedule.frequency_days === o.v && styles.segActive]}
                  onPress={() => setSchedule({ ...schedule, frequency_days: o.v })}
                >
                  <Text style={[styles.segText, schedule.frequency_days === o.v && styles.segTextActive]}>{o.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.schedLabel}>Orario (circa)</Text>
            <View style={styles.hourRow}>
              <TouchableOpacity style={styles.hourBtn} onPress={() => setSchedule({ ...schedule, hour: (schedule.hour + 23) % 24 })}>
                <Icon name="remove" size={22} color="#5856D6" />
              </TouchableOpacity>
              <Text style={styles.hourText}>{String(schedule.hour).padStart(2, '0')}:00</Text>
              <TouchableOpacity style={styles.hourBtn} onPress={() => setSchedule({ ...schedule, hour: (schedule.hour + 1) % 24 })}>
                <Icon name="add" size={22} color="#5856D6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.schedLabel}>Email destinatario</Text>
            <TextInput
              style={styles.schedInput}
              value={schedule.email}
              onChangeText={(t) => setSchedule({ ...schedule, email: t })}
              placeholder="esempio@gmail.com"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity style={styles.schedSave} onPress={saveSchedule} disabled={savingSched}>
              {savingSched ? <ActivityIndicator color="#fff" /> : <Text style={styles.schedSaveText}>Salva impostazioni</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.schedNow} onPress={sendNow} disabled={sendingNow}>
              {sendingNow ? <ActivityIndicator color="#5856D6" /> : <Text style={styles.schedNowText}>📩 Invia backup ora</Text>}
            </TouchableOpacity>
            {schedule.last_run_at ? (
              <Text style={styles.schedMeta}>Ultimo invio automatico: {new Date(schedule.last_run_at).toLocaleString('it-IT')}</Text>
            ) : null}
          </View>
        )}

        {EXPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.exportCard, { borderLeftColor: option.color }]}
            onPress={() => handleExport(option)}
            disabled={downloading !== null}
          >
            <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
              <Icon name={option.icon as any} size={28} color={option.color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
            </View>
            {downloading === option.key ? (
              <ActivityIndicator size="small" color={option.color} />
            ) : (
              <Icon name="download-outline" size={24} color="#666" />
            )}
          </TouchableOpacity>
        ))}

        {/* GDPR Notice */}
        <View style={styles.gdprNotice}>
          <Icon name="shield-checkmark-outline" size={18} color="#666" />
          <Text style={styles.gdprText}>
            L'esportazione dei dati è conforme al GDPR. I file contengono solo i dati della tua società sportiva.
          </Text>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  backupCard: {
    backgroundColor: '#1565C0',
    borderLeftColor: '#0D47A1',
    marginBottom: 18,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  gdprNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  gdprText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  schedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#5856D6',
  },
  schedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  schedTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#222' },
  schedDesc: { fontSize: 12.5, color: '#666', lineHeight: 18, marginTop: 8 },
  schedLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 16, marginBottom: 8 },
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seg: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f7f7f7' },
  segActive: { backgroundColor: '#5856D6', borderColor: '#5856D6' },
  segText: { fontSize: 13, fontWeight: '600', color: '#555' },
  segTextActive: { color: '#fff' },
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  hourBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEEEFB', alignItems: 'center', justifyContent: 'center' },
  hourText: { fontSize: 22, fontWeight: '700', color: '#333', minWidth: 72, textAlign: 'center' },
  schedInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fafafa', color: '#222' },
  schedSave: { backgroundColor: '#5856D6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  schedSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  schedNow: { borderWidth: 1.5, borderColor: '#5856D6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  schedNowText: { color: '#5856D6', fontSize: 15, fontWeight: '700' },
  schedMeta: { fontSize: 11, color: '#999', marginTop: 10, textAlign: 'center' },
});
