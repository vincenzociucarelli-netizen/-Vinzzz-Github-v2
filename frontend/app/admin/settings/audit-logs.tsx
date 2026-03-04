import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Icon } from '../../../src/components/Icon';
import { useRouter } from 'expo-router';
import api from '../../../src/services/api';

interface AuditLog {
  id: string;
  timestamp?: string;
  created_at?: string;
  action: string;
  user_id: string;
  user_email: string;
  society_id: string;
  target_user_id?: string;
  target_user_name?: string;
  ip_address?: string;
  details?: Record<string, any>;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  login: { label: 'Login', icon: 'log-in', color: '#007AFF' },
  certificate_modified: { label: 'Certificato Modificato', icon: 'document-text', color: '#FF9500' },
  certificate_override: { label: 'Override Certificato', icon: 'shield-checkmark', color: '#FF3B30' },
  certificate_block_changed: { label: 'Blocco Certificati', icon: 'medical', color: '#E65100' },
  compensation_modified: { label: 'Compenso Modificato', icon: 'cash', color: '#34C759' },
  document_accepted: { label: 'Documento Accettato', icon: 'checkmark-circle', color: '#5856D6' },
  document_signed: { label: 'Documento Firmato', icon: 'create', color: '#8E44AD' },
  user_deleted: { label: 'Utente Eliminato', icon: 'trash', color: '#FF3B30' },
  qr_codes_regenerated: { label: 'QR Rigenerati', icon: 'qr-code', color: '#FF9500' },
  stripe_settings_updated: { label: 'Impostazioni Stripe', icon: 'card', color: '#6772E5' },
  stripe_keys_deleted: { label: 'Chiavi Stripe Eliminate', icon: 'card', color: '#FF3B30' },
};

const ACTION_FILTERS = [
  { key: 'all', label: 'Tutti' },
  { key: 'login', label: 'Login' },
  { key: 'certificate_modified', label: 'Certificati' },
  { key: 'certificate_override', label: 'Override' },
  { key: 'certificate_block_changed', label: 'Blocco Cert.' },
  { key: 'compensation_modified', label: 'Compensi' },
  { key: 'document_accepted', label: 'Documenti' },
  { key: 'user_deleted', label: 'Eliminazioni' },
];

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const loadLogs = async (reset = false) => {
    try {
      const skip = reset ? 0 : page * LIMIT;
      const actionParam = selectedFilter === 'all' ? '' : `&action=${selectedFilter}`;
      const response = await api.get(`/audit-logs?skip=${skip}&limit=${LIMIT}${actionParam}`);
      
      if (reset) {
        setLogs(response.data.logs);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...response.data.logs]);
      }
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadLogs(true);
  }, [selectedFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs(true);
  };

  const loadMore = () => {
    if (logs.length < total) {
      setPage(prev => prev + 1);
      loadLogs(false);
    }
  };

  const formatDate = (log: AuditLog) => {
    // Support both timestamp and created_at fields
    const dateStr = log.timestamp || log.created_at;
    if (!dateStr) return 'Data non disponibile';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Data non valida';
    
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDetails = (log: AuditLog) => {
    const details = log.details;
    if (!details || Object.keys(details).length === 0) return null;
    
    const items: string[] = [];
    
    // Handle certificate_block_changed action
    if (log.action === 'certificate_block_changed') {
      if (details.action_type === 'enabled') {
        items.push('🟢 Blocco ATTIVATO');
      } else if (details.action_type === 'disabled') {
        items.push('🔴 Blocco DISATTIVATO');
      }
      if (details.old_value !== undefined) {
        const oldText = details.old_value === true ? 'attivo' : 
                       details.old_value === false ? 'disattivo' : 'non configurato';
        items.push(`Prima: ${oldText}`);
      }
      return items.length > 0 ? items.join(' • ') : null;
    }
    
    if (details.role) items.push(`Ruolo: ${details.role}`);
    if (details.deleted_role) items.push(`Ruolo eliminato: ${details.deleted_role}`);
    if (details.deleted_email) items.push(`Email: ${details.deleted_email}`);
    if (details.old_expiry) items.push(`Vecchia scadenza: ${details.old_expiry?.split('T')[0]}`);
    if (details.new_expiry) items.push(`Nuova scadenza: ${details.new_expiry?.split('T')[0]}`);
    if (details.reason) items.push(`Motivo: ${details.reason}`);
    if (details.old_compensation !== undefined) items.push(`Vecchio compenso: €${details.old_compensation}`);
    if (details.new_compensation !== undefined) items.push(`Nuovo compenso: €${details.new_compensation}`);
    if (details.document_type) items.push(`Documento: ${details.document_type}`);
    if (details.athletes_count) items.push(`Atleti aggiornati: ${details.athletes_count}`);
    
    return items.length > 0 ? items.join(' • ') : null;
  };

  const getActionInfo = (log: AuditLog) => {
    const action = log.action;
    const baseInfo = ACTION_LABELS[action] || { label: action, icon: 'help-circle', color: '#999' };
    
    // Dynamic color for certificate_block_changed based on action_type
    if (action === 'certificate_block_changed' && log.details?.action_type) {
      if (log.details.action_type === 'enabled') {
        return { ...baseInfo, color: '#34C759' }; // Green for enabled
      } else if (log.details.action_type === 'disabled') {
        return { ...baseInfo, color: '#FF3B30' }; // Red for disabled
      }
    }
    
    return baseInfo;
  };

  const renderLogItem = (log: AuditLog) => {
    const actionInfo = getActionInfo(log);
    const details = formatDetails(log);
    
    return (
      <View key={log.id} style={styles.logItem}>
        <View style={[styles.logIcon, { backgroundColor: actionInfo.color + '20' }]}>
          <Icon name={actionInfo.icon as any} size={20} color={actionInfo.color} />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={[styles.logAction, { color: actionInfo.color }]}>
              {actionInfo.label}
            </Text>
            <Text style={styles.logTime}>{formatDate(log)}</Text>
          </View>
          <Text style={styles.logUser}>
            {log.user_email}
          </Text>
          {log.target_user_name && (
            <Text style={styles.logTarget}>
              → {log.target_user_name}
            </Text>
          )}
          {details && (
            <Text style={styles.logDetails}>{details}</Text>
          )}
          {log.ip_address && (
            <Text style={styles.logIp}>IP: {log.ip_address}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Audit Log</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <Icon name="shield-checkmark" size={18} color="#007AFF" />
        <Text style={styles.statsText}>
          {total} eventi registrati
        </Text>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {ACTION_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              selectedFilter === filter.key && styles.filterChipActive
            ]}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text style={[
              styles.filterChipText,
              selectedFilter === filter.key && styles.filterChipTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logs List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Caricamento log...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.logsList}
          contentContainerStyle={styles.logsContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
            if (isCloseToBottom && logs.length < total && !loading) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessun log trovato</Text>
            </View>
          ) : (
            logs.map(renderLogItem)
          )}
          
          {logs.length > 0 && logs.length < total && (
            <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
              <Text style={styles.loadMoreText}>Carica altri...</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
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
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    gap: 8,
  },
  statsText: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '500',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    maxHeight: 50,
  },
  filtersContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  logsList: {
    flex: 1,
  },
  logsContent: {
    padding: 12,
  },
  logItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 11,
    color: '#999',
  },
  logUser: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  logTarget: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  logDetails: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    lineHeight: 16,
  },
  logIp: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    color: '#007AFF',
    fontSize: 14,
  },
});
