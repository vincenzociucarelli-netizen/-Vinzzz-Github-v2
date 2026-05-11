import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface ArchivedCertificate {
  id: string;
  athlete_id: string;
  last_name: string;
  first_name: string;
  full_name: string;
  team_name?: string;
  issue_date: string;
  expiry_date: string;
  uploaded_at: string;
  uploaded_by: string;
}

export default function MedicalCertificatesArchiveScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [certificates, setCertificates] = useState<ArchivedCertificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState<{ total_certificates: number; by_year: Record<string, number> } | null>(null);
  
  // View certificate modal
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);
  const [loadingCertificate, setLoadingCertificate] = useState(false);

  const loadData = async (pageNum: number = 1, searchTerm: string = '') => {
    try {
      const params: any = { page: pageNum, limit: 50 };
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      const response = await api.get('/admin/medical-certificates-archive', { params });
      setCertificates(response.data.certificates);
      setTotal(response.data.total);
      setPage(pageNum);
      
      // Load stats
      const statsResponse = await api.get('/admin/medical-certificates-archive/stats');
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error loading certificates archive:', error);
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
    loadData(1, search);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setLoading(true);
    loadData(1, searchInput);
  };

  const handleViewCertificate = async (cert: ArchivedCertificate) => {
    setLoadingCertificate(true);
    setViewModalVisible(true);
    
    try {
      const response = await api.get(`/admin/medical-certificates-archive/${cert.id}`);
      setSelectedCertificate(response.data);
    } catch (error) {
      console.error('Error loading certificate:', error);
      if (Platform.OS === 'web') {
        window.alert('Errore nel caricamento del certificato');
      }
    } finally {
      setLoadingCertificate(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!selectedCertificate?.certificate_data) return;
    
    if (Platform.OS === 'web') {
      try {
        const data = selectedCertificate.certificate_data;
        const link = document.createElement('a');
        link.href = data;
        link.download = `Certificato_${selectedCertificate.last_name}_${selectedCertificate.first_name}_${selectedCertificate.expiry_date}.${data.includes('pdf') ? 'pdf' : 'jpg'}`;
        link.click();
      } catch (error) {
        console.error('Error downloading:', error);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateStr;
    }
  };

  const isExpired = (expiryDate: string) => {
    try {
      return new Date(expiryDate) < new Date();
    } catch {
      return false;
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#FF5722" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archivio Certificati Medici</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Card */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>📊 Statistiche Archivio</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_certificates}</Text>
                <Text style={styles.statLabel}>Totale Certificati</Text>
              </View>
              {Object.entries(stats.by_year).slice(0, 3).map(([year, count]) => (
                <View key={year} style={styles.statItem}>
                  <Text style={styles.statValue}>{count}</Text>
                  <Text style={styles.statLabel}>{year}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.legalNote}>
              ⚖️ Conservazione obbligatoria 5 anni (normativa ASD)
            </Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca per cognome o nome..."
              placeholderTextColor="#999"
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchInput('');
                setSearch('');
                loadData(1, '');
              }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Cerca</Text>
          </TouchableOpacity>
        </View>

        {/* Results count */}
        <Text style={styles.resultsCount}>
          {total} certificati trovati {search && `per "${search}"`}
        </Text>

        {/* Certificates List */}
        {certificates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessun certificato nell'archivio</Text>
          </View>
        ) : (
          certificates.map((cert) => (
            <TouchableOpacity
              key={cert.id}
              style={styles.certCard}
              onPress={() => handleViewCertificate(cert)}
            >
              <View style={styles.certIcon}>
                <Ionicons 
                  name="document-text" 
                  size={28} 
                  color={isExpired(cert.expiry_date) ? '#FF3B30' : '#4CAF50'} 
                />
              </View>
              <View style={styles.certInfo}>
                <Text style={styles.certName}>
                  {cert.last_name?.toUpperCase()} {cert.first_name}
                </Text>
                {cert.team_name && (
                  <Text style={styles.certTeam}>{cert.team_name}</Text>
                )}
                <View style={styles.certDates}>
                  <Text style={styles.certDate}>
                    Emissione: {formatDate(cert.issue_date)}
                  </Text>
                  <Text style={[
                    styles.certDate,
                    isExpired(cert.expiry_date) && styles.certExpired
                  ]}>
                    Scadenza: {formatDate(cert.expiry_date)}
                  </Text>
                </View>
                <Text style={styles.certUploaded}>
                  Caricato: {formatDate(cert.uploaded_at)} da {cert.uploaded_by}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ))
        )}

        {/* Pagination */}
        {total > 50 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
              onPress={() => page > 1 && loadData(page - 1, search)}
              disabled={page === 1}
            >
              <Text style={styles.pageButtonText}>← Precedente</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Pagina {page} di {Math.ceil(total / 50)}</Text>
            <TouchableOpacity
              style={[styles.pageButton, page >= Math.ceil(total / 50) && styles.pageButtonDisabled]}
              onPress={() => page < Math.ceil(total / 50) && loadData(page + 1, search)}
              disabled={page >= Math.ceil(total / 50)}
            >
              <Text style={styles.pageButtonText}>Successiva →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* View Certificate Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Certificato Medico</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingCertificate ? (
              <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 40 }} />
            ) : selectedCertificate ? (
              <ScrollView style={styles.modalBody}>
                <View style={styles.certDetails}>
                  <Text style={styles.detailLabel}>Atleta:</Text>
                  <Text style={styles.detailValue}>
                    {selectedCertificate.last_name?.toUpperCase()} {selectedCertificate.first_name}
                  </Text>
                  
                  <Text style={styles.detailLabel}>Squadra:</Text>
                  <Text style={styles.detailValue}>{selectedCertificate.team_name || '-'}</Text>
                  
                  <Text style={styles.detailLabel}>Data Emissione:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedCertificate.issue_date)}</Text>
                  
                  <Text style={styles.detailLabel}>Data Scadenza:</Text>
                  <Text style={[
                    styles.detailValue,
                    isExpired(selectedCertificate.expiry_date) && { color: '#FF3B30' }
                  ]}>
                    {formatDate(selectedCertificate.expiry_date)}
                    {isExpired(selectedCertificate.expiry_date) && ' (SCADUTO)'}
                  </Text>
                  
                  <Text style={styles.detailLabel}>Caricato:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedCertificate.uploaded_at)} da {selectedCertificate.uploaded_by}
                  </Text>
                </View>

                {selectedCertificate.certificate_data && (
                  <View style={styles.certificatePreview}>
                    {selectedCertificate.certificate_data.includes('application/pdf') ? (
                      <View style={styles.pdfPreview}>
                        <Ionicons name="document" size={64} color="#FF3B30" />
                        <Text style={styles.pdfPreviewText}>Documento PDF</Text>
                        <Text style={styles.pdfPreviewHint}>Clicca scarica per visualizzare</Text>
                      </View>
                    ) : (
                      <Image 
                        source={{ uri: selectedCertificate.certificate_data }}
                        style={styles.certificateImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                )}

                {selectedCertificate.certificate_data && (
                  <TouchableOpacity 
                    style={styles.downloadButton}
                    onPress={handleDownloadCertificate}
                  >
                    <Ionicons name="download" size={20} color="#fff" />
                    <Text style={styles.downloadButtonText}>Scarica Certificato</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
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
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  legalNote: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  certIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  certInfo: {
    flex: 1,
  },
  certName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  certTeam: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  certDates: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  certDate: {
    fontSize: 12,
    color: '#888',
  },
  certExpired: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  certUploaded: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  pageButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageButtonDisabled: {
    backgroundColor: '#ccc',
  },
  pageButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pageInfo: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  certDetails: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  certificatePreview: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  certificateImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#fff',
  },
  pdfPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  pdfPreviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  pdfPreviewHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});
