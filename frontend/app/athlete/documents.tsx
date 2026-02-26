import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import * as ImagePicker from 'expo-image-picker';

interface Document {
  id: string;
  type: string;
  name: string;
  date: string;
  url?: string;
}

export default function AthleteDocumentsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const meRes = await api.get('/auth/me');
      const athleteId = meRes.data.athlete_id;
      
      if (athleteId) {
        const athleteRes = await api.get(`/athletes/${athleteId}`);
        setProfile(athleteRes.data);
        
        // Build documents list from profile data
        const docs: Document[] = [];
        
        // Privacy document - check for signed document in archive
        if (athleteRes.data.privacy_accepted) {
          // Try to get the signed document from the archive
          let privacyPdfUrl = athleteRes.data.privacy_pdf_url;
          
          // If no URL saved, try to find in signed_documents (if user has access)
          if (!privacyPdfUrl) {
            try {
              const archiveRes = await api.get('/documents/signed', {
                params: { 
                  page: 1, 
                  limit: 100,
                  related_entity_id: athleteId
                }
              });
              const privacyDoc = archiveRes.data?.documents?.find(
                (d: any) => d.document_type === 'privacy_consent'
              ) || archiveRes.data?.find?.(
                (d: any) => d.document_type === 'privacy_consent'
              );
              if (privacyDoc) {
                privacyPdfUrl = `/api/documents/signed/${privacyDoc.id}/pdf`;
              }
            } catch (e: any) {
              // User may not have access to archive - that's OK
              console.log('Could not fetch signed documents:', e?.response?.status);
            }
          }
          
          docs.push({
            id: 'privacy',
            type: 'privacy',
            name: 'Privacy - Informativa GDPR',
            date: athleteRes.data.privacy_accepted_date || '',
            url: privacyPdfUrl || undefined,
          });
        }
        
        // Medical certificate
        if (athleteRes.data.medical_certificate_expiry) {
          docs.push({
            id: 'medical',
            type: 'medical',
            name: 'Certificato Medico',
            date: athleteRes.data.medical_certificate_expiry,
          });
        }
        
        // ID documents
        if (athleteRes.data.id_front) {
          docs.push({
            id: 'id_front',
            type: 'id',
            name: 'Documento Identità (Fronte)',
            date: '',
            url: athleteRes.data.id_front,
          });
        }
        
        if (athleteRes.data.id_back) {
          docs.push({
            id: 'id_back',
            type: 'id',
            name: 'Documento Identità (Retro)',
            date: '',
            url: athleteRes.data.id_back,
          });
        }
        
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'privacy': return 'shield-checkmark';
      case 'medical': return 'medkit';
      case 'id': return 'card';
      default: return 'document';
    }
  };

  const getDocColor = (type: string) => {
    switch (type) {
      case 'privacy': return '#4CAF50';
      case 'medical': return '#2196F3';
      case 'id': return '#FF9800';
      default: return '#666';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>I Miei Documenti</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />}
      >
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessun documento disponibile</Text>
            <Text style={styles.emptySubtext}>
              I documenti caricati appariranno qui
            </Text>
          </View>
        ) : (
          documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.docCard}
              onPress={async () => {
                if (doc.url) {
                  if (Platform.OS === 'web') {
                    // For API URLs, fetch with auth token
                    if (doc.url.startsWith('/api/')) {
                      try {
                        const response = await api.get(doc.url.replace('/api/', '/'), {
                          responseType: 'blob'
                        });
                        const blob = new Blob([response.data], { type: 'application/pdf' });
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } catch (error) {
                        console.error('Error downloading document:', error);
                        Alert.alert('Errore', 'Impossibile scaricare il documento');
                      }
                    } else {
                      window.open(doc.url, '_blank');
                    }
                  }
                } else if (doc.type === 'privacy') {
                  // Privacy without PDF - show message
                  if (Platform.OS === 'web') {
                    window.alert('Documento privacy accettato. Il PDF firmato sarà disponibile dopo una nuova firma.');
                  } else {
                    Alert.alert('Info', 'Documento privacy accettato. Il PDF firmato sarà disponibile dopo una nuova firma.');
                  }
                }
              }}
            >
              <View style={[styles.docIcon, { backgroundColor: getDocColor(doc.type) + '20' }]}>
                <Ionicons name={getDocIcon(doc.type) as any} size={24} color={getDocColor(doc.type)} />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName}>{doc.name}</Text>
                {doc.date && (
                  <Text style={styles.docDate}>
                    {doc.type === 'medical' ? 'Scadenza: ' : 'Firmata: '}
                    {formatDate(doc.date)}
                  </Text>
                )}
              </View>
              {doc.url ? (
                <Ionicons name="download-outline" size={20} color="#007AFF" />
              ) : doc.type === 'privacy' ? (
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              ) : null}
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  docDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#1976D2',
  },
});
