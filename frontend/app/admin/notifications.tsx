import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  athlete_id?: string;
  athlete_name?: string;
  team_id?: string;
  team_name?: string;
  override_status?: 'pending' | 'authorized' | 'denied' | null;
  override_reason?: string;
  override_authorized_by_name?: string;
  override_authorized_at?: string;
  override_deny_reason?: string;
  override_denied_by_name?: string;
  override_denied_at?: string;
  data?: {
    athlete_id?: string;
    athlete_name?: string;
    team_id?: string;
    team_name?: string;
    coach_name?: string;
    parent_name?: string;
    changed_by?: string;
    changed_by_role?: string;
    issue_date?: string;
    expiry_date?: string;
    block_reason?: string;
    action?: string;
    [key: string]: any;
  };
  related_user_id?: string;
  related_user_name?: string;
  read: boolean;
  created_at: string;
}

interface DateGroup {
  label: string;
  sortKey: string;
  notifications: Notification[];
}

export default function AdminNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedNotifications, setExpandedNotifications] = useState<Record<string, boolean>>({});
  // Certificate override state (athlete-specific) per notification id
  const [overrideReasonByNotif, setOverrideReasonByNotif] = useState<Record<string, string>>({});
  const [overrideLoadingByNotif, setOverrideLoadingByNotif] = useState<Record<string, boolean>>({});
  // Screenshot blob URLs per notification (photo_removal_request)
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});
  const [screenshotLoading, setScreenshotLoading] = useState<Record<string, boolean>>({});

  const loadScreenshot = async (notificationId: string) => {
    if (screenshotUrls[notificationId] || screenshotLoading[notificationId]) return;
    setScreenshotLoading(prev => ({ ...prev, [notificationId]: true }));
    try {
      const res = await api.get(`/admin/notifications/${notificationId}/screenshot`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setScreenshotUrls(prev => ({ ...prev, [notificationId]: url }));
    } catch (e) {
      console.error('Error loading screenshot:', e);
    } finally {
      setScreenshotLoading(prev => ({ ...prev, [notificationId]: false }));
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await api.get('/admin/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const toggleNotification = (notificationId: string, isRead: boolean) => {
    setExpandedNotifications(prev => ({
      ...prev,
      [notificationId]: !prev[notificationId]
    }));
    // Mark as read when expanding for the first time
    if (!isRead) {
      markAsRead(notificationId);
    }
    // Auto-load screenshot for photo removal requests when expanding
    const notif = notifications.find(n => n.id === notificationId);
    if (notif && notif.type === 'photo_removal_request' && notif.data?.has_screenshot) {
      loadScreenshot(notificationId);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/admin/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/admin/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Eliminare questa notifica?')
      : await new Promise((resolve) => {
          Alert.alert('Elimina Notifica', 'Sei sicuro di voler eliminare questa notifica?', [
            { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Elimina', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmDelete) return;
    try {
      await api.delete(`/admin/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

    if (isSameDay(date, today)) return 'Oggi';
    if (isSameDay(date, yesterday)) return 'Ieri';
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getDateKey = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'coach_exceeded_5000':
      case 'dirigente_exceeded_5000':
        return { name: 'warning', color: '#FF9500' };
      case 'coach_exceeded_15000':
      case 'dirigente_exceeded_15000':
        return { name: 'alert-circle', color: '#FF3B30' };
      case 'deletion_requested':
        return { name: 'trash', color: '#FF3B30' };
      case 'deletion_approved':
        return { name: 'checkmark-circle', color: '#34C759' };
      case 'deletion_rejected':
        return { name: 'close-circle', color: '#FF9500' };
      case 'expired_cert_scan':
        return { name: 'medkit', color: '#E53935' };
      case 'photo_removal_request':
        return { name: 'image-outline', color: '#D32F2F' };
      default:
        return { name: 'notifications', color: '#007AFF' };
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Authorize athlete-specific certificate override from notification
  const authorizeOverride = async (notification: Notification) => {
    const reason = (overrideReasonByNotif[notification.id] || '').trim();
    if (reason.length < 5) {
      const msg = 'Inserisci il motivo dell\'override (minimo 5 caratteri).';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Errore', msg);
      return;
    }
    setOverrideLoadingByNotif(prev => ({ ...prev, [notification.id]: true }));
    try {
      const res = await api.post(`/admin/notifications/${notification.id}/authorize-override`, { reason });
      const athleteName = res.data?.athlete_name || notification.athlete_name || 'Atleta';
      const successMsg = `Override autorizzato per ${athleteName}.\n\nIl Coach può ora ripetere la scansione del QR. L'override sarà consumato al primo ingresso valido.`;
      if (Platform.OS === 'web') window.alert(`✅ AUTORIZZATO\n\n${successMsg}`);
      else Alert.alert('✅ Autorizzato', successMsg);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id
          ? { ...n, override_status: 'authorized', override_reason: reason, read: true }
          : n)
      );
      setOverrideReasonByNotif(prev => ({ ...prev, [notification.id]: '' }));
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail || 'Impossibile autorizzare l\'override';
      if (Platform.OS === 'web') window.alert(`Errore: ${errMsg}`);
      else Alert.alert('Errore', errMsg);
    } finally {
      setOverrideLoadingByNotif(prev => ({ ...prev, [notification.id]: false }));
    }
  };

  // Deny override request
  const denyOverride = async (notification: Notification) => {
    const confirmDeny = Platform.OS === 'web'
      ? window.confirm(`Rifiutare la richiesta di override per ${notification.athlete_name || 'l\'atleta'}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Rifiuta override', `Rifiutare la richiesta per ${notification.athlete_name || 'l\'atleta'}?`, [
            { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Rifiuta', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmDeny) return;
    setOverrideLoadingByNotif(prev => ({ ...prev, [notification.id]: true }));
    try {
      await api.post(`/admin/notifications/${notification.id}/deny-override`, { reason: '' });
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, override_status: 'denied', read: true } : n)
      );
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail || 'Impossibile rifiutare';
      if (Platform.OS === 'web') window.alert(`Errore: ${errMsg}`);
      else Alert.alert('Errore', errMsg);
    } finally {
      setOverrideLoadingByNotif(prev => ({ ...prev, [notification.id]: false }));
    }
  };

  // Filter + group
  const groupedNotifications = useMemo<DateGroup[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? notifications.filter(n =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.data?.athlete_name || '').toLowerCase().includes(q) ||
          (n.athlete_name || '').toLowerCase().includes(q) ||
          (n.data?.changed_by || '').toLowerCase().includes(q) ||
          (n.related_user_name || '').toLowerCase().includes(q)
        )
      : notifications;

    const groups: Record<string, { label: string; sortKey: string; notifications: Notification[] }> = {};
    for (const n of filtered) {
      const key = getDateKey(n.created_at);
      if (!groups[key]) {
        groups[key] = { label: formatDateLabel(n.created_at), sortKey: key, notifications: [] };
      }
      groups[key].notifications.push(n);
    }
    // Sort notifications inside each group: most recent first
    for (const k of Object.keys(groups)) {
      groups[k].notifications.sort((a, b) => {
        const ta = new Date(a.created_at).getTime() || 0;
        const tb = new Date(b.created_at).getTime() || 0;
        return tb - ta;
      });
    }
    return Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [notifications, searchQuery]);

  const totalFiltered = groupedNotifications.reduce((sum, g) => sum + g.notifications.length, 0);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Caricamento notifiche...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backBtn}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifiche</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Segna tutte lette</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca notifiche..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          data-testid="notifications-search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} data-testid="clear-search">
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {searchQuery.length > 0 && (
        <Text style={styles.resultCount}>
          {totalFiltered} risultat{totalFiltered === 1 ? 'o' : 'i'} trovat{totalFiltered === 1 ? 'o' : 'i'}
        </Text>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {groupedNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name={searchQuery ? 'search' : 'notifications-off-outline'} size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Nessun risultato' : 'Nessuna notifica'}
            </Text>
          </View>
        ) : (
          groupedNotifications.map((group) => {
            const isCollapsed = collapsedGroups[group.sortKey] || false;
            const groupUnread = group.notifications.filter(n => !n.read).length;
            return (
              <View key={group.sortKey} style={styles.dateGroup}>
                {/* Date header - collapsible */}
                <TouchableOpacity
                  style={styles.dateHeader}
                  onPress={() => toggleGroup(group.sortKey)}
                  data-testid={`date-group-${group.sortKey}`}
                >
                  <Ionicons
                    name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                    size={16}
                    color="#666"
                  />
                  <Text style={styles.dateLabel}>{group.label}</Text>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{group.notifications.length}</Text>
                  </View>
                  {groupUnread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{groupUnread} nuove</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Notifications list */}
                {!isCollapsed && group.notifications.map((notification) => {
                  const icon = getNotificationIcon(notification.type);
                  const isExpanded = expandedNotifications[notification.id] || false;
                  return (
                    <View key={notification.id}>
                      <TouchableOpacity
                        style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                        onPress={() => toggleNotification(notification.id, notification.read)}
                        data-testid={`notification-${notification.id}`}
                      >
                        <View style={styles.notificationIcon}>
                          <Ionicons name={icon.name as any} size={20} color={icon.color} />
                        </View>
                        <View style={styles.notificationContent}>
                          <View style={styles.notificationHeader}>
                            <Text style={[styles.notificationTitle, !notification.read && { fontWeight: '800' }]} numberOfLines={isExpanded ? undefined : 1}>
                              {notification.title}
                            </Text>
                            <View style={styles.headerRight}>
                              {!notification.read && <View style={styles.unreadDot} />}
                              <Ionicons 
                                name={isExpanded ? "chevron-up" : "chevron-down"} 
                                size={14} 
                                color="#999" 
                              />
                            </View>
                          </View>
                          {!isExpanded && (
                            <Text style={styles.notificationPreview} numberOfLines={1}>
                              {notification.message}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={[styles.expandedContent, !notification.read && { borderLeftColor: '#007AFF' }]}>
                          <Text style={styles.notificationMessage}>{notification.message}</Text>
                          {notification.data?.athlete_name && (
                            <View style={styles.detailRow}>
                              <Ionicons name="person" size={12} color="#1565C0" />
                              <Text style={styles.detailText}>Atleta: {notification.data.athlete_name}</Text>
                            </View>
                          )}
                          {notification.data?.expiry_date && (
                            <View style={styles.detailRow}>
                              <Ionicons name="calendar" size={12} color="#E65100" />
                              <Text style={styles.detailText}>Nuova scadenza: {notification.data.expiry_date}</Text>
                            </View>
                          )}
                          {notification.data?.issue_date && (
                            <View style={styles.detailRow}>
                              <Ionicons name="document-text" size={12} color="#2E7D32" />
                              <Text style={styles.detailText}>Emissione: {notification.data.issue_date}</Text>
                            </View>
                          )}
                          {notification.data?.changed_by && (
                            <View style={styles.detailRow}>
                              <Ionicons name="create" size={12} color="#7B1FA2" />
                              <Text style={styles.detailText}>Aggiornato da: {notification.data.changed_by} ({notification.data.changed_by_role || ''})</Text>
                            </View>
                          )}

                          {/* Photo removal request: nota + screenshot */}
                          {notification.type === 'photo_removal_request' && (
                            <View style={styles.photoRemovalBlock} data-testid={`photo-removal-block-${notification.id}`}>
                              {notification.data?.note && (
                                <View style={styles.photoRemovalNoteBox}>
                                  <Text style={styles.photoRemovalNoteLabel}>Nota dell'utente:</Text>
                                  <Text style={styles.photoRemovalNoteText}>"{notification.data.note}"</Text>
                                </View>
                              )}
                              {notification.data?.has_screenshot && (
                                <View style={styles.photoRemovalScreenshotBox}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <Ionicons name="image" size={14} color="#1976D2" />
                                    <Text style={styles.photoRemovalScreenshotLabel}>
                                      Screenshot allegato {notification.data.screenshot_filename ? `(${notification.data.screenshot_filename})` : ''}
                                    </Text>
                                  </View>
                                  {screenshotLoading[notification.id] && !screenshotUrls[notification.id] ? (
                                    <ActivityIndicator size="small" color="#1976D2" style={{ marginVertical: 16 }} />
                                  ) : screenshotUrls[notification.id] ? (
                                    <>
                                      {Platform.OS === 'web' ? (
                                        // @ts-ignore - web-only img tag for full responsive zoom on click
                                        <img
                                          src={screenshotUrls[notification.id]}
                                          alt={notification.data.screenshot_filename || 'screenshot'}
                                          style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 6, backgroundColor: '#eee', cursor: 'zoom-in' }}
                                          onClick={() => window.open(screenshotUrls[notification.id], '_blank')}
                                          data-testid={`screenshot-img-${notification.id}`}
                                        />
                                      ) : (
                                        <Text>Screenshot disponibile (web only)</Text>
                                      )}
                                      <Text style={styles.photoRemovalHint}>Click per aprire a dimensione reale</Text>
                                    </>
                                  ) : (
                                    <TouchableOpacity onPress={() => loadScreenshot(notification.id)} style={styles.loadScreenshotBtn}>
                                      <Ionicons name="download-outline" size={14} color="#1976D2" />
                                      <Text style={{ fontSize: 12, color: '#1976D2', fontWeight: '600' }}>Carica screenshot</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              )}
                              {!notification.data?.note && !notification.data?.has_screenshot && (
                                <Text style={styles.photoRemovalEmptyHint}>
                                  L'utente non ha allegato nota né screenshot.
                                </Text>
                              )}
                            </View>
                          )}

                          {/* Certificate override actions (athlete-specific) */}
                          {notification.type === 'expired_cert_scan' && (
                            <View style={styles.overrideBlock}>
                              {notification.data?.coach_name && (
                                <View style={styles.detailRow}>
                                  <Ionicons name="person-circle" size={12} color="#1565C0" />
                                  <Text style={styles.detailText}>Coach: {notification.data.coach_name}</Text>
                                </View>
                              )}
                              {notification.data?.team_name && (
                                <View style={styles.detailRow}>
                                  <Ionicons name="people" size={12} color="#1565C0" />
                                  <Text style={styles.detailText}>Squadra: {notification.data.team_name}</Text>
                                </View>
                              )}

                              {(!notification.override_status || notification.override_status === 'pending') && (
                                <>
                                  <Text style={styles.overrideHint}>
                                    Override valido per <Text style={{ fontWeight: '700' }}>UN solo ingresso</Text>, riservato esclusivamente a {notification.athlete_name || 'questo atleta'}.
                                  </Text>
                                  <Text style={styles.overrideLabel}>Motivo dell'override (obbligatorio, min 5 caratteri):</Text>
                                  <TextInput
                                    style={styles.overrideInput}
                                    placeholder="es. Certificato in fase di rinnovo, gara imminente..."
                                    placeholderTextColor="#999"
                                    value={overrideReasonByNotif[notification.id] || ''}
                                    onChangeText={(t) => setOverrideReasonByNotif(prev => ({ ...prev, [notification.id]: t }))}
                                    multiline
                                    numberOfLines={2}
                                    data-testid={`override-reason-${notification.id}`}
                                  />
                                  <View style={styles.overrideActions}>
                                    <TouchableOpacity
                                      style={[styles.overrideDenyBtn, overrideLoadingByNotif[notification.id] && styles.btnDisabled]}
                                      onPress={() => denyOverride(notification)}
                                      disabled={!!overrideLoadingByNotif[notification.id]}
                                      data-testid={`deny-override-${notification.id}`}
                                    >
                                      {overrideLoadingByNotif[notification.id] ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                      ) : (
                                        <>
                                          <Ionicons name="close-circle" size={16} color="#fff" />
                                          <Text style={styles.overrideBtnText}>RIFIUTA</Text>
                                        </>
                                      )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[
                                        styles.overrideAuthBtn,
                                        ((overrideReasonByNotif[notification.id] || '').trim().length < 5 || overrideLoadingByNotif[notification.id]) && styles.btnDisabled
                                      ]}
                                      onPress={() => authorizeOverride(notification)}
                                      disabled={(overrideReasonByNotif[notification.id] || '').trim().length < 5 || !!overrideLoadingByNotif[notification.id]}
                                      data-testid={`authorize-override-${notification.id}`}
                                    >
                                      {overrideLoadingByNotif[notification.id] ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                      ) : (
                                        <>
                                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                          <Text style={styles.overrideBtnText}>AUTORIZZA</Text>
                                        </>
                                      )}
                                    </TouchableOpacity>
                                  </View>
                                </>
                              )}

                              {notification.override_status === 'authorized' && (
                                <View style={styles.statusAuthorized}>
                                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                                  <Text style={styles.statusAuthorizedText}>
                                    Override autorizzato{notification.override_authorized_by_name ? ` da ${notification.override_authorized_by_name}` : ''}
                                    {notification.override_reason ? ` — Motivo: ${notification.override_reason}` : ''}
                                  </Text>
                                </View>
                              )}

                              {notification.override_status === 'denied' && (
                                <View style={styles.statusDenied}>
                                  <Ionicons name="close-circle" size={16} color="#C62828" />
                                  <Text style={styles.statusDeniedText}>
                                    Richiesta rifiutata{notification.override_denied_by_name ? ` da ${notification.override_denied_by_name}` : ''}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={styles.expandedFooter}>
                            <Text style={styles.notificationDate}>{formatDate(notification.created_at)}</Text>
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => deleteNotification(notification.id)}
                              data-testid={`delete-notification-${notification.id}`}
                            >
                              <Ionicons name="trash-outline" size={16} color="#E53935" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  backBtnInner: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  markAllBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: '#333',
    paddingVertical: 0,
  },
  resultCount: {
    fontSize: 12,
    color: '#888',
    marginHorizontal: 20,
    marginBottom: 4,
    marginTop: 4,
  },
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#999',
  },
  // Date group
  dateGroup: {
    marginTop: 12,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginLeft: 6,
    flex: 1,
    textTransform: 'capitalize',
  },
  dateBadge: {
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  // Notification card
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: '#E8F4FD',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  notificationPreview: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  expandedContent: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
    marginTop: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  expandedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 6,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 3,
    paddingLeft: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500' as const,
  },
  notificationDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
  // Certificate override styles
  overrideBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
  },
  overrideHint: {
    fontSize: 12,
    color: '#E65100',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    lineHeight: 17,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  overrideLabel: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  overrideInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: '#333',
    minHeight: 50,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top' as const,
  },
  overrideActions: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 10,
  },
  overrideAuthBtn: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  overrideDenyBtn: {
    flex: 1,
    backgroundColor: '#C62828',
    paddingVertical: 10,
    borderRadius: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  overrideBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  statusAuthorized: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  statusAuthorizedText: {
    fontSize: 12,
    color: '#1B5E20',
    flex: 1,
    fontWeight: '500' as const,
    lineHeight: 17,
  },
  statusDenied: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#C62828',
  },
  statusDeniedText: {
    fontSize: 12,
    color: '#B71C1C',
    flex: 1,
    fontWeight: '500' as const,
  },
  // Photo removal request blocks
  photoRemovalBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFEBEE',
    gap: 8,
  },
  photoRemovalNoteBox: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 3,
    borderLeftColor: '#F9A825',
    padding: 10,
    borderRadius: 6,
  },
  photoRemovalNoteLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#E65100',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  photoRemovalNoteText: {
    fontSize: 13,
    color: '#5D4037',
    fontStyle: 'italic' as const,
    lineHeight: 18,
  },
  photoRemovalScreenshotBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
  },
  photoRemovalScreenshotLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1976D2',
    flex: 1,
  },
  photoRemovalHint: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  photoRemovalEmptyHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    paddingVertical: 6,
  },
  loadScreenshotBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
});
