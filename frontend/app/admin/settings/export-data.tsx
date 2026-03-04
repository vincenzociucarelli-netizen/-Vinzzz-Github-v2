import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Icon } from '../../../src/components/Icon';
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
];

export default function ExportDataPage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Esporta Dati</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="information-circle" size={20} color="#1565C0" />
        <Text style={styles.infoText}>
          I file CSV possono essere aperti con Excel, Google Sheets o altri programmi di foglio di calcolo.
        </Text>
      </View>

      {/* Export Options */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
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
    padding: 8,
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
});
