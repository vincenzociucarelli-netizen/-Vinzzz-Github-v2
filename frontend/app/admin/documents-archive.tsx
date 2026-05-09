import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';

import { formatCurrency, formatAmount } from '../../src/utils/formatCurrency';
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Document {
  id: string;
  document_type: string;
  document_title: string;
  figure_type: string;
  figure_name: string;
  month: number | null;
  year: number | null;
  amount_gross: number | null;
  signed_at: string;
  pdf_filename: string | null;
}

interface ArchiveResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  available_seasons: string[];
}

const FIGURE_TYPES = [
  { value: '', label: 'Tutte le figure' },
  { value: 'coach', label: 'Coach' },
  { value: 'dirigente', label: 'Dirigenti' },
  { value: 'collaboratore', label: 'Collaboratori' },
  { value: 'genitore', label: 'Genitori' },
  { value: 'atleta', label: 'Atleti' },
];

const DOCUMENT_TYPES = [
  { value: '', label: 'Tutti i tipi' },
  { value: 'privacy_consent', label: 'Consenso Privacy' },
  { value: 'receipt_standard', label: 'Quietanza Standard' },
  { value: 'receipt_5000', label: 'Quietanza > 5.000€' },
  { value: 'receipt_15000', label: 'Quietanza > 15.000€' },
];

const MONTH_NAMES = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export default function DocumentsArchive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
  const [teams, setTeams] = useState<{id: string, name: string}[]>([]);
  
  // Filters
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedFigureType, setSelectedFigureType] = useState<string>('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Load teams for filter
  const loadTeams = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${API_URL}/api/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(Array.isArray(data) ? data : data.teams || []);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadDocuments = useCallback(async (pageNum: number = 1, resetList: boolean = false) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', '20');
      if (selectedSeason) params.append('season', selectedSeason);
      if (selectedFigureType) params.append('figure_type', selectedFigureType);
      if (selectedDocumentType) params.append('document_type', selectedDocumentType);
      if (selectedTeamId) params.append('team_id', selectedTeamId);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_URL}/api/documents/archive?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento documenti');
      }

      const data: ArchiveResponse = await response.json();
      
      if (resetList || pageNum === 1) {
        setDocuments(data.documents);
      } else {
        setDocuments(prev => [...prev, ...data.documents]);
      }
      
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.total_pages);
      setAvailableSeasons(data.available_seasons);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Errore', 'Impossibile caricare i documenti');
    } finally {
      setLoading(false);
    }
  }, [selectedSeason, selectedFigureType, selectedDocumentType, selectedTeamId, searchQuery, router]);

  useEffect(() => {
    loadDocuments(1, true);
    loadTeams();
  }, [selectedSeason, selectedFigureType, selectedDocumentType, selectedTeamId]);

  // Reset filters function
  const handleResetFilters = () => {
    setSelectedSeason('');
    setSelectedFigureType('');
    setSelectedDocumentType('');
    setSelectedTeamId('');
    setSearchQuery('');
  };

  const handleSearch = () => {
    loadDocuments(1, true);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (Platform.OS === 'web') {
          window.alert('Sessione scaduta. Effettua nuovamente il login.');
        } else {
          Alert.alert('Errore', 'Sessione scaduta. Effettua nuovamente il login.');
        }
        return;
      }

      const downloadUrl = `${API_URL}/api/documents/download/${doc.id}`;
      
      if (Platform.OS === 'web') {
        try {
          console.log('Downloading document:', doc.id);
          
          const response = await fetch(downloadUrl, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/pdf'
            },
          });
          
          console.log('Response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Download error response:', errorText);
            throw new Error(`Download failed: ${response.status}`);
          }
          
          const blob = await response.blob();
          console.log('Blob size:', blob.size, 'type:', blob.type);
          
          if (blob.size === 0) {
            throw new Error('Empty PDF response');
          }
          
          // Create object URL for the PDF
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          const objectUrl = window.URL.createObjectURL(pdfBlob);
          
          // Create download link
          const filename = doc.pdf_filename || `documento_${doc.id}.pdf`;
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up URL after download
          setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
          
        } catch (fetchError: any) {
          console.error('Fetch error:', fetchError);
          window.alert(`Errore nel download: ${fetchError.message || 'Errore sconosciuto'}`);
        }
      } else {
        // For mobile, use Linking
        Linking.openURL(downloadUrl);
      }
    } catch (error: any) {
      console.error('Download error:', error);
      if (Platform.OS === 'web') {
        window.alert('Impossibile aprire il documento');
      } else {
        Alert.alert('Errore', 'Impossibile aprire il documento');
      }
    }
  };

  const loadMore = () => {
    if (page < totalPages && !loading) {
      loadDocuments(page + 1);
    }
  };

  const getFigureTypeColor = (type: string) => {
    switch (type) {
      case 'coach': return '#2196F3';
      case 'dirigente': return '#9C27B0';
      case 'collaboratore': return '#FF9800';
      case 'genitore': return '#E91E63';
      case 'atleta': return '#4CAF50';
      default: return '#757575';
    }
  };

  const getFigureTypeLabel = (type: string) => {
    switch (type) {
      case 'coach': return 'Coach';
      case 'dirigente': return 'Dirigente';
      case 'collaboratore': return 'Collaboratore';
      case 'genitore': return 'Genitore';
      case 'atleta': return 'Atleta';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderDocument = (doc: Document) => (
    <View key={doc.id} style={styles.documentCard}>
      <View style={styles.documentHeader}>
        <View style={[styles.figureTypeBadge, { backgroundColor: getFigureTypeColor(doc.figure_type) }]}>
          <Text style={styles.figureTypeBadgeText}>{getFigureTypeLabel(doc.figure_type)}</Text>
        </View>
        {doc.pdf_filename && (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => handleDownload(doc)}
            data-testid={`download-btn-${doc.id}`}
          >
            <Ionicons name="eye-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.documentTitle}>{doc.document_title}</Text>
      <Text style={styles.figureName}>{doc.figure_name}</Text>
      
      <View style={styles.documentDetails}>
        {doc.month && doc.year && (
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{MONTH_NAMES[doc.month]} {doc.year}</Text>
          </View>
        )}
        {doc.amount_gross && (
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{doc.amount_gross.toFixed(2)} EUR</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.detailText}>{formatDate(doc.signed_at)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backButton}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archivio Documenti</Text>
        <TouchableOpacity 
          onPress={() => setShowFilters(!showFilters)} 
          style={styles.filterToggle}
          data-testid="toggle-filters-btn"
        >
          <Ionicons name="filter" size={24} color={showFilters ? '#2196F3' : '#333'} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Search */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca per nome..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              data-testid="search-input"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Season Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Stagione:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedSeason && styles.filterChipActive]}
                onPress={() => setSelectedSeason('')}
              >
                <Text style={[styles.filterChipText, !selectedSeason && styles.filterChipTextActive]}>
                  Tutte
                </Text>
              </TouchableOpacity>
              {availableSeasons.map(season => (
                <TouchableOpacity
                  key={season}
                  style={[styles.filterChip, selectedSeason === season && styles.filterChipActive]}
                  onPress={() => setSelectedSeason(season)}
                >
                  <Text style={[styles.filterChipText, selectedSeason === season && styles.filterChipTextActive]}>
                    {season}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Figure Type Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Figura:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FIGURE_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[styles.filterChip, selectedFigureType === type.value && styles.filterChipActive]}
                  onPress={() => setSelectedFigureType(type.value)}
                >
                  <Text style={[styles.filterChipText, selectedFigureType === type.value && styles.filterChipTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Document Type Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Tipo Doc:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DOCUMENT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[styles.filterChip, selectedDocumentType === type.value && styles.filterChipActive]}
                  onPress={() => setSelectedDocumentType(type.value)}
                >
                  <Text style={[styles.filterChipText, selectedDocumentType === type.value && styles.filterChipTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Team Filter */}
          {teams.length > 0 && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Squadra:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedTeamId && styles.filterChipActive]}
                  onPress={() => setSelectedTeamId('')}
                >
                  <Text style={[styles.filterChipText, !selectedTeamId && styles.filterChipTextActive]}>
                    Tutte
                  </Text>
                </TouchableOpacity>
                {teams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.filterChip, selectedTeamId === team.id && styles.filterChipActive]}
                    onPress={() => setSelectedTeamId(team.id)}
                  >
                    <Text style={[styles.filterChipText, selectedTeamId === team.id && styles.filterChipTextActive]}>
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reset Filters Button */}
          {(selectedSeason || selectedFigureType || selectedDocumentType || selectedTeamId || searchQuery) && (
            <TouchableOpacity 
              style={styles.resetFiltersButton} 
              onPress={handleResetFilters}
            >
              <Ionicons name="refresh" size={16} color="#F44336" />
              <Text style={styles.resetFiltersText}>Azzera filtri</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results Count */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {total} documenti trovati
        </Text>
      </View>

      {/* Documents List */}
      <ScrollView 
        style={styles.documentsList}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 50) {
            loadMore();
          }
        }}
      >
        {loading && documents.length === 0 ? (
          <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
        ) : documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessun documento trovato</Text>
          </View>
        ) : (
          <>
            {documents.map(renderDocument)}
            {loading && (
              <ActivityIndicator size="small" color="#2196F3" style={styles.loadingMore} />
            )}
            {page < totalPages && !loading && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Carica altri</Text>
              </TouchableOpacity>
            )}
          </>
        )}
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  filterToggle: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  resultsInfo: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  documentsList: {
    flex: 1,
    padding: 12,
  },
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  figureTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  figureTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  figureName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  documentDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  loader: {
    marginTop: 50,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  loadingMore: {
    marginVertical: 20,
  },
  loadMoreButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 20,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  resetFiltersText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
    marginLeft: 6,
  },
});
