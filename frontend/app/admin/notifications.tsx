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
  data?: {
    athlete_id?: string;
    athlete_name?: string;
    parent_name?: string;
    changed_by?: string;
    changed_by_role?: string;
    issue_date?: string;
    expiry_date?: string;
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

  useEffect(() => {
    if (notifications.length > 0 && notifications.some(n => !n.read)) {
      markAllAsRead();
    }
  }, [notifications.length]);

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
      default:
        return { name: 'notifications', color: '#007AFF' };
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter + group
  const groupedNotifications = useMemo<DateGroup[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? notifications.filter(n =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.data?.athlete_name || '').toLowerCase().includes(q) ||
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
                  return (
                    <TouchableOpacity
                      key={notification.id}
                      style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                      onPress={() => markAsRead(notification.id)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <View style={styles.notificationIcon}>
                        <Ionicons name={icon.name as any} size={20} color={icon.color} />
                      </View>
                      <View style={styles.notificationContent}>
                        <View style={styles.notificationHeader}>
                          <Text style={styles.notificationTitle}>{notification.title}</Text>
                          {!notification.read && <View style={styles.unreadDot} />}
                        </View>
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
                        <Text style={styles.notificationDate}>{formatDate(notification.created_at)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => deleteNotification(notification.id)}
                        data-testid={`delete-notification-${notification.id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color="#999" />
                      </TouchableOpacity>
                    </TouchableOpacity>
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
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
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
});
