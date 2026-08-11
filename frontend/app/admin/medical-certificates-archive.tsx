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
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface CertExpiryRow {
  athlete_id: string;
  full_name: string;
  team_name?: string;
  issue_date: string | null;
  expiry_date: string | null;
  verified: boolean;
  days_until_expiry: number | null;
  status: 'expired' | 'expiring' | 'valid' | 'missing';
}

interface ExpiryStats {
  total: number;
  count_expired: number;
  count_expiring: number;
  count_valid: number;
  count_missing: number;
}

export default function MedicalCertificatesArchiveScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<CertExpiryRow[]>([]);
  const [stats, setStats] = useState<ExpiryStats | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadData = async (searchTerm: string = '') => {
    try {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      const response = await api.get('/admin/certificates-expiry-list', { params });
      setItems(response.data.items || []);
      setStats({
        total: response.data.total || 0,
        count_expired: response.data.count_expired || 0,
        count_expiring: response.data.count_expiring || 0,
        count_valid: response.data.count_valid || 0,
        count_missing: response.data.count_missing || 0,
      });
    } catch (error) {
      console.error('Error loading certificates expiry list:', error);
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
    loadData(search);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setLoading(true);
    loadData(searchInput);
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
        <Text style={styles.headerTitle}>Scadenze Certificati</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Card */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>📊 Scadenzario Certificati</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#FF3B30' }]}>{stats.count_expired}</Text>
                <Text style={styles.statLabel}>Scaduti</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#FF9500' }]}>{stats.count_expiring}</Text>
                <Text style={styles.statLabel}>In scadenza</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#34C759' }]}>{stats.count_valid}</Text>
                <Text style={styles.statLabel}>Validi</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#999' }]}>{stats.count_missing}</Text>
                <Text style={styles.statLabel}>Mancanti</Text>
              </View>
            </View>
            <Text style={styles.legalNote}>
              🔒 Per privacy non archiviamo l&apos;immagine del certificato: qui trovi solo le scadenze
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
                loadData('');
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
          {stats?.total || 0} atleti {search && `per "${search}"`}
        </Text>

        {/* Certificates Expiry List */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessun atleta trovato</Text>
          </View>
        ) : (
          items.map((row) => {
            const statusMap: Record<string, { color: string; label: string; icon: any }> = {
              expired: { color: '#FF3B30', label: 'Scaduto', icon: 'close-circle' },
              expiring: { color: '#FF9500', label: 'In scadenza', icon: 'alert-circle' },
              valid: { color: '#34C759', label: 'Valido', icon: 'checkmark-circle' },
              missing: { color: '#999', label: 'Mancante', icon: 'help-circle' },
            };
            const s = statusMap[row.status] || statusMap.missing;
            return (
              <TouchableOpacity
                key={row.athlete_id}
                style={styles.certCard}
                onPress={() => router.push(`/admin/athlete/${row.athlete_id}`)}
                testID={`cert-row-${row.athlete_id}`}
              >
                <View style={styles.certIcon}>
                  <Ionicons name={s.icon} size={28} color={s.color} />
                </View>
                <View style={styles.certInfo}>
                  <Text style={styles.certName}>{row.full_name}</Text>
                  {!!row.team_name && (
                    <Text style={styles.certTeam}>{row.team_name}</Text>
                  )}
                  <View style={styles.certDates}>
                    {row.expiry_date ? (
                      <Text style={[styles.certDate, { color: s.color, fontWeight: '600' }]}>
                        Scadenza: {formatDate(row.expiry_date)}
                        {typeof row.days_until_expiry === 'number' && row.days_until_expiry >= 0
                          ? ` (tra ${row.days_until_expiry}gg)`
                          : (typeof row.days_until_expiry === 'number' ? ` (${Math.abs(row.days_until_expiry)}gg fa)` : '')}
                      </Text>
                    ) : (
                      <Text style={[styles.certDate, { color: '#999', fontStyle: 'italic' }]}>
                        Nessun certificato registrato
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: s.color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: s.color }}>{s.label}</Text>
                    </View>
                    {row.expiry_date && !row.verified && (
                      <View style={{ backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#E65100' }}>Da verificare</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            );
          })
        )}

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
