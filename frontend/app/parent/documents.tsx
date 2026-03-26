import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface Document {
  id: string;
  document_type: string;
  document_title: string;
  minor_id?: string;
  minor_name?: string;
  created_at?: string;
  signed_at?: string;
  is_consent_record?: boolean;
  consent_metadata?: {
    source?: string;
    ip_address?: string;
    document_version?: string;
    user_id?: string;
  };
  gdpr_metadata?: {
    document_version: string;
    timestamp: string;
  };
}

interface MinorGroup {
  minor_id: string;
  minor_name: string;
  documents: Document[];
}

interface GroupedDocuments {
  personal: Document[];
  minors: MinorGroup[];
}

// Colori per distinguere i figli (stesso schema della dashboard)
const CHILD_COLORS = [
  '#E91E63', // Rosa
  '#2196F3', // Blu
  '#4CAF50', // Verde
  '#FF9800', // Arancione
  '#9C27B0', // Viola
  '#00BCD4', // Ciano
];

export default function ParentDocuments() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [grouped, setGrouped] = useState<GroupedDocuments>({ personal: [], minors: [] });
  const [parentName, setParentName] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['personal']));
  const [selectedConsent, setSelectedConsent] = useState<Document | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await api.get('/documents/my-documents');
      if (response.data.grouped) {
        setGrouped(response.data.grouped);
        setParentName(response.data.grouped.parent_name || '');
        // Auto-expand all sections with documents
        const sections = new Set<string>();
        if (response.data.grouped.personal?.length > 0) {
          sections.add('personal');
        }
        response.data.grouped.minors?.forEach((m: MinorGroup) => {
          if (m.documents?.length > 0) {
            sections.add(m.minor_id);
          }
        });
        setExpandedSections(sections);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const openDocument = async (docId: string, docTitle?: string) => {
    try {
      if (Platform.OS === 'web') {
        const token = localStorage.getItem('token') || '';
        const baseUrl = api.defaults.baseURL || '';
        const response = await fetch(`${baseUrl}/documents/signed/${docId}/pdf`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Errore sconosciuto');
          Alert.alert('Errore', `Impossibile aprire il documento: ${response.status}`);
          return;
        }
        const blob = await response.blob();
        if (blob.size === 0) {
          Alert.alert('Errore', 'Il documento è vuoto o non disponibile');
          return;
        }
        const blobUrl = window.URL.createObjectURL(blob);
        // Try opening in new tab first, fallback to download
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
          // Popup blocked - fallback to download
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${docTitle || 'documento'}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
      } else {
        const url = `${api.defaults.baseURL}/documents/signed/${docId}/pdf`;
        await Linking.openURL(url);
      }
    } catch (error: any) {
      console.error('Error opening document:', error);
      Alert.alert('Errore', 'Impossibile aprire il documento. Riprova.');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getDocumentIcon = (docType: string) => {
    if (docType.includes('privacy') || docType.includes('gdpr')) {
      return 'shield-checkmark';
    }
    if (docType.includes('certificate') || docType.includes('certificato')) {
      return 'document-text';
    }
    if (docType.includes('receipt') || docType.includes('quietanza')) {
      return 'receipt';
    }
    return 'document';
  };

  const openConsentDocument = (docType: string) => {
    let url = '';
    if (docType.includes('privacy')) url = '/privacy-policy';
    else if (docType.includes('data_processing')) url = '/privacy-policy';
    else if (docType.includes('terms')) url = '/terms-of-use';
    if (url && Platform.OS === 'web') {
      window.open(url, '_blank');
    } else if (url) {
      Linking.openURL(url);
    }
  };

  const renderDocumentItem = (doc: Document) => {
    const isConsent = doc.is_consent_record;
    
    return (
      <TouchableOpacity
        key={doc.id}
        style={styles.documentItem}
        onPress={isConsent ? () => setSelectedConsent(doc) : () => openDocument(doc.id, doc.document_title || doc.document_type)}
        data-testid={`doc-item-${doc.id}`}
      >
        <View style={[styles.documentIcon, isConsent && { backgroundColor: '#E8F5E9' }]}>
          <Ionicons
            name={isConsent ? 'checkmark-circle' : getDocumentIcon(doc.document_type)}
            size={24}
            color={isConsent ? '#4CAF50' : '#8E44AD'}
          />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentTitle} numberOfLines={2}>
            {doc.document_title || doc.document_type}
          </Text>
          <Text style={styles.documentDate}>
            {formatDate(doc.created_at || doc.signed_at)}
          </Text>
          {isConsent && doc.consent_metadata?.source && (
            <View style={styles.consentBadge}>
              <Ionicons name="finger-print" size={10} color="#2196F3" />
              <Text style={styles.consentBadgeText}>
                {doc.consent_metadata.source === 'registration' ? 'Accettato alla registrazione' : 'Accettato'}
              </Text>
            </View>
          )}
          {isConsent && doc.consent_metadata?.document_version && (
            <View style={styles.gdprBadge}>
              <Ionicons name="shield" size={10} color="#27AE60" />
              <Text style={styles.gdprText}>v{doc.consent_metadata.document_version}</Text>
            </View>
          )}
          {!isConsent && doc.gdpr_metadata && (
            <View style={styles.gdprBadge}>
              <Ionicons name="shield" size={10} color="#27AE60" />
              <Text style={styles.gdprText}>GDPR v{doc.gdpr_metadata.document_version}</Text>
            </View>
          )}
        </View>
        <Ionicons name="open-outline" size={20} color="#999" />
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    sectionId: string,
    documents: Document[],
    color: string,
    icon: string
  ) => {
    const isExpanded = expandedSections.has(sectionId);
    const docCount = documents.length;

    return (
      <View key={sectionId} style={styles.section}>
        <TouchableOpacity
          style={[styles.sectionHeader, { borderLeftColor: color }]}
          onPress={() => toggleSection(sectionId)}
        >
          <View style={[styles.sectionIconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
            <Text style={styles.sectionCount}>
              {docCount} document{docCount !== 1 ? 'i' : 'o'}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {docCount === 0 ? (
              <Text style={styles.emptyText}>Nessun documento</Text>
            ) : (
              documents.map(renderDocumentItem)
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Caricamento documenti...</Text>
      </View>
    );
  }

  const hasAnyDocuments = grouped.personal.length > 0 || grouped.minors.some(m => m.documents.length > 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>I Miei Documenti</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8E44AD']} />
        }
      >
        {!hasAnyDocuments ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Nessun documento</Text>
            <Text style={styles.emptySubtitle}>
              I documenti firmati appariranno qui, organizzati per ogni figlio
            </Text>
          </View>
        ) : (
          <>
            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#3498DB" />
              <Text style={styles.infoBannerText}>
                I documenti sono organizzati per figlio. Tocca per espandere o comprimere le sezioni.
              </Text>
            </View>

            {/* Personal Documents Section */}
            {grouped.personal.length > 0 && renderSection(
              parentName ? `Documenti di ${parentName}` : 'I Miei Documenti',
              'personal',
              grouped.personal,
              '#8E44AD',
              'person'
            )}

            {/* Minor Documents Sections */}
            {grouped.minors.map((minor, index) => renderSection(
              `Documenti di ${minor.minor_name}`,
              minor.minor_id,
              minor.documents,
              CHILD_COLORS[index % CHILD_COLORS.length],
              'person-circle'
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Consent Detail Modal */}
      <Modal
        visible={!!selectedConsent}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedConsent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark" size={28} color="#4CAF50" />
              <Text style={styles.modalTitle}>{selectedConsent?.document_title}</Text>
            </View>

            <View style={styles.metadataSection}>
              <View style={styles.metadataRow}>
                <Ionicons name="person" size={16} color="#666" />
                <Text style={styles.metadataLabel}>Titolare:</Text>
                <Text style={styles.metadataValue}>{parentName}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Ionicons name="calendar" size={16} color="#666" />
                <Text style={styles.metadataLabel}>Data accettazione:</Text>
                <Text style={styles.metadataValue}>{formatDate(selectedConsent?.signed_at)}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Ionicons name="finger-print" size={16} color="#666" />
                <Text style={styles.metadataLabel}>Modalita:</Text>
                <Text style={styles.metadataValue}>
                  {selectedConsent?.consent_metadata?.source === 'registration' ? 'Accettazione alla registrazione' : selectedConsent?.consent_metadata?.source || '-'}
                </Text>
              </View>
              {selectedConsent?.consent_metadata?.ip_address && (
                <View style={styles.metadataRow}>
                  <Ionicons name="globe" size={16} color="#666" />
                  <Text style={styles.metadataLabel}>Indirizzo IP:</Text>
                  <Text style={styles.metadataValue}>{selectedConsent.consent_metadata.ip_address}</Text>
                </View>
              )}
              {selectedConsent?.consent_metadata?.document_version && (
                <View style={styles.metadataRow}>
                  <Ionicons name="document-text" size={16} color="#666" />
                  <Text style={styles.metadataLabel}>Versione documento:</Text>
                  <Text style={styles.metadataValue}>v{selectedConsent.consent_metadata.document_version}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.viewDocButton}
              onPress={() => {
                if (selectedConsent) openConsentDocument(selectedConsent.document_type);
              }}
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.viewDocButtonText}>Visualizza Documento Completo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedConsent(null)}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#8E44AD',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#2980B9',
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F5EEF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: '#999',
  },
  gdprBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  gdprText: {
    fontSize: 10,
    color: '#27AE60',
    fontWeight: '500',
  },
  consentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  consentBadgeText: {
    fontSize: 10,
    color: '#2196F3',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  metadataSection: {
    gap: 12,
    marginBottom: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metadataLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  metadataValue: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  viewDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E44AD',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 10,
  },
  viewDocButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 14,
  },
});
