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
        
        // Medical certificate - REMOVED from this list to avoid duplication
        // The medical certificate is shown in the dedicated section on the main athlete page
        // if (athleteRes.data.medical_certificate_expiry || athleteRes.data.medical_certificate_url) {
        //   docs.push({
        //     id: 'medical',
        //     type: 'medical',
        //     name: 'Certificato Medico',
        //     date: athleteRes.data.medical_certificate_expiry || '',
        //     url: athleteRes.data.medical_certificate_url,
        //   });
        // }
        
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

  // Handle medical certificate upload
  const handleUploadMedicalCertificate = async () => {
    if (Platform.OS === 'web') {
      // For web, use file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else {
      // For mobile, use ImagePicker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso negato', 'Serve il permesso per accedere alla galleria');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].base64!, result.assets[0].uri);
      }
    }
  };

  const handleWebFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      if (Platform.OS === 'web') {
        window.alert('Formato non supportato. Usa immagini (JPG, PNG) o PDF.');
      }
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await uploadFile(base64, file.name, file.type);
    };
    reader.readAsDataURL(file);
  };

  const uploadFile = async (base64: string, filename: string, mimeType?: string) => {
    setUploading(true);
    try {
      // Upload the certificate
      const response = await api.post('/certificates/upload-self', {
        certificate_data: base64,
        filename: filename,
        mime_type: mimeType || 'image/jpeg',
      });

      if (Platform.OS === 'web') {
        window.alert('Certificato medico caricato con successo!');
      } else {
        Alert.alert('Successo', 'Certificato medico caricato con successo!');
      }
      
      // Reload documents
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore durante il caricamento';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Errore', msg);
      }
    } finally {
      setUploading(false);
    }
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
        {/* Medical certificate upload section removed - it's available in the main athlete dashboard */}

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
                    // Handle base64 data URLs (medical certificates, images)
                    if (doc.url.startsWith('data:')) {
                      // For base64 images/PDFs, create a blob and open
                      try {
                        const [header, base64Data] = doc.url.split(',');
                        const mimeMatch = header.match(/data:([^;]+)/);
                        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                        
                        // Convert base64 to blob
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        
                        const blobUrl = window.URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                        
                        // Cleanup after a delay
                        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
                      } catch (error) {
                        console.error('Error opening base64 document:', error);
                        window.alert('Impossibile aprire il documento');
                      }
                    }
                    // For API URLs, fetch with auth token
                    else if (doc.url.startsWith('/api/')) {
                      try {
                        const response = await api.get(doc.url.replace('/api/', '/'), {
                          responseType: 'blob'
                        });
                        const blob = new Blob([response.data], { type: 'application/pdf' });
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } catch (error) {
                        console.error('Error downloading document:', error);
                        window.alert('Impossibile scaricare il documento');
                      }
                    } else {
                      // Regular URL
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
  uploadSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
