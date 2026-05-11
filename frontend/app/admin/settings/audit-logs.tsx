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
import InstitutionalBanner from '../../../src/components/InstitutionalBanner';
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
  deletion_requested: { label: 'Richiesta Cancellazione', icon: 'trash', color: '#FF3B30' },
  deletion_approved: { label: 'Cancellazione Approvata', icon: 'checkmark-done-circle', color: '#FF3B30' },
  deletion_rejected: { label: 'Cancellazione Rifiutata', icon: 'close-circle', color: '#FF9500' },
  deletion_request_cancelled: { label: 'Cancellazione Annullata', icon: 'arrow-undo-circle', color: '#007AFF' },
  parent_account_deleted: { label: 'Account Genitore Eliminato', icon: 'person-remove', color: '#FF3B30' },
  qr_codes_regenerated: { label: 'QR Rigenerati', icon: 'qr-code', color: '#FF9500' },
  stripe_settings_updated: { label: 'Impostazioni Stripe', icon: 'card', color: '#6772E5' },
  stripe_keys_deleted: { label: 'Chiavi Stripe Eliminate', icon: 'card', color: '#FF3B30' },
  trial_document_signed: { label: 'Firma Dichiarazione Prova', icon: 'pencil', color: '#7B1FA2' },
  attendance_recorded: { label: 'Presenza Registrata', icon: 'checkmark-circle', color: '#34C759' },
  trial_started: { label: 'Inizio Periodo di Prova', icon: 'play-circle', color: '#FF9500' },
};

const ACTION_FILTERS = [
  { key: 'all', label: 'Tutti' },
  { key: 'login', label: 'Login' },
  { key: 'certificate_modified', label: 'Certificati' },
  { key: 'certificate_override', label: 'Override' },
  { key: 'certificate_block_changed', label: 'Blocco Cert.' },
  { key: 'compensation_modified', label: 'Compensi' },
  { key: 'deletion_requested', label: 'Cancellazioni' },
  { key: 'document_signed', label: 'Documenti' },
  { key: 'trial_document_signed', label: 'Firme Prova' },
  { key: 'attendance_recorded', label: 'Presenze' },
  { key: 'trial_started', label: 'Inizio Prova' },
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const LIMIT = 50;

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    try {
      const authResponse = await api.get('/auth/me');
      if (authResponse.data?.role !== 'admin') {
        setIsAdmin(false);
        router.replace('/');
        return;
      }
      setIsAdmin(true);
      await loadLogs(true);
    } catch (error) {
      setIsAdmin(false);
      router.replace('/');
    }
  };

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

  const getLogTitle = (log: AuditLog) => {
    const details = log.details || {};
    const action = log.action;
    
    // Build a concise title with key info
    switch (action) {
      case 'deletion_approved':
        return details.athlete_name?.trim() ? `Atleta: ${details.athlete_name}` : log.target_user_name || '';
      case 'deletion_requested':
        return details.athlete_name?.trim() ? `Atleta: ${details.athlete_name}` : log.target_user_name || '';
      case 'deletion_rejected':
        return details.athlete_name?.trim() ? `Atleta: ${details.athlete_name}` : log.target_user_name || '';
      case 'deletion_request_cancelled':
        return details.athlete_name?.trim() ? `Atleta: ${details.athlete_name}` : log.target_user_name || '';
      case 'parent_account_deleted':
        return details.parent_name ? `${details.parent_name}` : log.target_user_name || '';
      case 'user_deleted':
        return log.target_user_name || details.deleted_email || '';
      case 'certificate_modified':
      case 'certificate_override':
        return log.target_user_name || '';
      case 'document_signed':
      case 'document_accepted':
        return details.document_type || log.target_user_name || '';
      case 'trial_document_signed':
        return details.athlete_name || log.target_user_name || '';
      case 'attendance_recorded':
        return log.target_user_name || '';
      case 'trial_started':
        return log.target_user_name || '';
      case 'login':
        return '';
      case 'compensation_modified':
        return log.target_user_name || '';
      default:
        return log.target_user_name || '';
    }
  };

  // Brief summary visible without expanding
  const getLogSummary = (log: AuditLog): string => {
    const details = log.details || {};
    const action = log.action;
    switch (action) {
      case 'deletion_approved':
        return details.had_obligations ? 'Con obblighi pendenti' : 'Nessun obbligo';
      case 'deletion_requested':
        return details.parent_name ? `Da: ${details.parent_name}` : '';
      case 'deletion_request_cancelled':
        return details.parent_name ? `${details.parent_name} ha rinunciato alla cancellazione` : 'Cancellazione ritirata';
      case 'certificate_modified':
        return details.new_expiry ? `Nuova scadenza: ${details.new_expiry.split('T')[0]}` : '';
      case 'certificate_override':
        return details.reason || '';
      case 'compensation_modified':
        if (details.old_compensation !== undefined && details.new_compensation !== undefined)
          return `${details.old_compensation} -> ${details.new_compensation}`;
        return '';
      case 'document_signed':
        return details.signer_name || '';
      case 'trial_document_signed':
        return details.signer_name ? `Firmato da: ${details.signer_name}` : '';
      case 'attendance_recorded':
        return details.team_name ? `Squadra: ${details.team_name}` : '';
      case 'trial_started':
        return details.team_name ? `Squadra: ${details.team_name}` : '';
      default:
        return '';
    }
  };

  const formatExpandedDetails = (log: AuditLog) => {
    const details = log.details;
    if (!details || Object.keys(details).length === 0) return [];
    
    const items: { label: string; value: string }[] = [];
    
    // Certificate block changed
    if (log.action === 'certificate_block_changed') {
      if (details.action_type === 'enabled') items.push({ label: 'Stato', value: 'Blocco ATTIVATO' });
      else if (details.action_type === 'disabled') items.push({ label: 'Stato', value: 'Blocco DISATTIVATO' });
      if (details.old_value !== undefined) {
        items.push({ label: 'Prima', value: details.old_value === true ? 'attivo' : details.old_value === false ? 'disattivo' : 'non configurato' });
      }
      return items;
    }
    
    // Deletion specific
    if (details.athlete_name?.trim()) items.push({ label: 'Atleta', value: details.athlete_name.trim() });
    if (details.parent_name) items.push({ label: 'Genitore', value: details.parent_name });
    if (details.parent_email) items.push({ label: 'Email genitore', value: details.parent_email });
    if (details.executor_name) items.push({ label: 'Eseguito da', value: details.executor_name });
    if (details.requester_name) items.push({ label: 'Richiesto da', value: details.requester_name });
    if (details.originally_requested_by_name) items.push({ label: 'Richiesto da', value: details.originally_requested_by_name });
    if (details.originally_requested_at) items.push({ label: 'Richiesto il', value: details.originally_requested_at.split(' ')[0] || details.originally_requested_at });
    if (details.had_obligations !== undefined) items.push({ label: 'Obblighi', value: details.had_obligations ? 'Si' : 'Nessuno' });
    if (details.reason) {
      const reasonMap: Record<string, string> = {
        'no_other_children_no_obligations': 'Nessun altro figlio e nessun obbligo',
        'has_other_children': 'Ha altri figli iscritti',
        'has_obligations': 'Ha obblighi fiscali/amministrativi',
      };
      items.push({ label: 'Motivo', value: reasonMap[details.reason] || details.reason });
    }
    
    // General fields
    if (details.role) items.push({ label: 'Ruolo', value: details.role });
    if (details.deleted_role) items.push({ label: 'Ruolo eliminato', value: details.deleted_role });
    if (details.deleted_email) items.push({ label: 'Email eliminata', value: details.deleted_email });
    if (details.deleted_by_role) items.push({ label: 'Eliminato da', value: details.deleted_by_role });
    if (details.old_expiry) items.push({ label: 'Vecchia scadenza', value: details.old_expiry?.split('T')[0] });
    if (details.new_expiry) items.push({ label: 'Nuova scadenza', value: details.new_expiry?.split('T')[0] });
    if (details.old_compensation !== undefined) items.push({ label: 'Vecchio compenso', value: `€${details.old_compensation}` });
    if (details.new_compensation !== undefined) items.push({ label: 'Nuovo compenso', value: `€${details.new_compensation}` });
    if (details.document_type) items.push({ label: 'Documento', value: details.document_type });
    if (details.athletes_count) items.push({ label: 'Atleti aggiornati', value: String(details.athletes_count) });
    
    return items;
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

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const renderLogItem = (log: AuditLog) => {
    const actionInfo = getActionInfo(log);
    const title = getLogTitle(log);
    const summary = getLogSummary(log);
    const expandedDetails = formatExpandedDetails(log);
    const isExpanded = expandedLogs.has(log.id);
    const hasDetails = expandedDetails.length > 0 || log.ip_address;
    
    return (
      <TouchableOpacity 
        key={log.id} 
        style={styles.logItem}
        onPress={() => hasDetails && toggleExpand(log.id)}
        activeOpacity={hasDetails ? 0.7 : 1}
        data-testid={`audit-log-${log.id}`}
      >
        <View style={[styles.logIcon, { backgroundColor: actionInfo.color + '20' }]}>
          <Icon name={actionInfo.icon as any} size={20} color={actionInfo.color} />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                <Text style={[styles.logAction, { color: actionInfo.color }]}>
                  {actionInfo.label}
                </Text>
                {title ? (
                  <Text style={{ fontSize: 12, color: '#333', fontWeight: '500', flexShrink: 1 }}>
                    - {title}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.logUser}>{log.user_email}</Text>
              {summary ? (
                <Text style={{ fontSize: 11, color: '#888', marginTop: 1 }} numberOfLines={1}>{summary}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.logTime}>{formatDate(log)}</Text>
              {hasDetails && (
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
              )}
            </View>
          </View>
          
          {isExpanded && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              {expandedDetails.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: '#888', width: 110 }}>{item.label}:</Text>
                  <Text style={{ fontSize: 11, color: '#333', flex: 1 }}>{item.value}</Text>
                </View>
              ))}
              {log.ip_address && (
                <View style={{ flexDirection: 'row', marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: '#888', width: 110 }}>IP:</Text>
                  <Text style={{ fontSize: 11, color: '#333', flex: 1 }}>{log.ip_address}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.title}>Audit Log</Text>
        <View style={{ width: 40 }} />
      </View>

      <InstitutionalBanner />

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
    padding: 12,
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
