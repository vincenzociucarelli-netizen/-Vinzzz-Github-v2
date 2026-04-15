import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';

// Emoji icons for reliable cross-platform support
const Icons = {
  calendar: '📅',
  business: '🏢',
  people: '⚽',      // Changed: Atleti - pallone da calcio/sport
  fitness: '🏋️',    // Coach con pesi
  family: '👨‍👩‍👦',    // Changed: Famiglia più moderna
  layers: '📚',
  search: '🔍',
  clipboard: '📋',
  archive: '📦',
  card: '💳',
  person: '👤',
  settings: '⚙️',
  logout: '🚪',
  briefcase: '💼',
  gift: '🎉',
  chevron: '›',
  back: '←',
  add: '+',
  refresh: '🔄',
};

interface Stats {
  total_teams: number;
  total_athletes: number;
  active_athletes: number;
  today_attendances: number;
}

interface PendingCount {
  dirigenti: number;
  coaches: number;
  collaboratori: number;
  parents: number;
}

interface SocietySettings {
  name: string;
  logo: string | null;
  sport_image: string | null;
}

interface Birthday {
  id: string;
  name: string;
  type: string;
  age: number;
  icon: string;
}

interface ExpiringCertificates {
  count_today: number;
  count_30_days: number;
  expiring_today: any[];
  expiring_soon: any[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingCounts, setPendingCounts] = useState<PendingCount>({ dirigenti: 0, coaches: 0, collaboratori: 0, parents: 0 });
  const [pendingStaff, setPendingStaff] = useState<any[]>([]);
  const [pendingAthletes, setPendingAthletes] = useState<any[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const [society, setSociety] = useState<SocietySettings>({ name: 'Società Sportiva', logo: null, sport_image: null });
  const [refreshing, setRefreshing] = useState(false);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [todayAthletes, setTodayAthletes] = useState<any[]>([]);
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCertificates>({ count_today: 0, count_30_days: 0, expiring_today: [], expiring_soon: [] });
  const [inviteCode, setInviteCode] = useState<string>('');
  const [processingDeletion, setProcessingDeletion] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [showShareLink, setShowShareLink] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '' });
  const [proEnabled, setProEnabled] = useState<boolean>(false);

  // Refresh user data on mount to get profile_photo
  useEffect(() => {
    refreshUser();
  }, []);

  // Helper function for API calls with retry
  const fetchWithRetry = async (url: string, defaultValue: any, retries = 2): Promise<any> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await api.get(url);
        return response;
      } catch (error) {
        if (i === retries) {
          console.warn(`Failed to fetch ${url} after ${retries + 1} attempts`);
          return { data: defaultValue };
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
      }
    }
    return { data: defaultValue };
  };

  const loadStats = async () => {
    try {
      // Group 1: Critical data (stats, society)
      const [statsRes, societyRes] = await Promise.all([
        fetchWithRetry('/stats/overview', null),
        fetchWithRetry('/settings/society', { name: 'Società Sportiva', logo: null, sport_image: null }),
      ]);
      
      if (statsRes.data) setStats(statsRes.data);
      if (societyRes.data) {
        setSociety(societyRes.data);
        setProEnabled(societyRes.data.pro_enabled || false);
      }

      // Group 2: User-related data
      const [pendingRes, pendingAthletesRes, deletionRes] = await Promise.all([
        fetchWithRetry('/users/pending', []),
        fetchWithRetry('/athletes/pending', []),
        fetchWithRetry('/athletes/deletion-requests', []),
      ]);
      
      setPendingAthletes(pendingAthletesRes.data || []);
      setDeletionRequests(deletionRes.data || []);
      
      // Count pending by role and save staff pending list
      const pending = pendingRes.data || [];
      const staffRoles = ['coach', 'collaboratore', 'admin', 'viewer'];
      const staffPending = pending.filter((u: any) => staffRoles.includes(u.role));
      setPendingStaff(staffPending);
      const dirigentiPending = pending.filter((u: any) => u.role === 'admin' || u.role === 'viewer').length;
      const coachesPending = pending.filter((u: any) => u.role === 'coach').length;
      const collaboratoriPending = pending.filter((u: any) => u.role === 'collaboratore').length;
      const parentsPending = pending.filter((u: any) => u.role === 'parent').length;
      setPendingCounts({ dirigenti: dirigentiPending, coaches: coachesPending, collaboratori: collaboratoriPending, parents: parentsPending });

      // Group 3: Secondary data (can load slightly delayed)
      const [birthdaysRes, certsRes, inviteRes, notifRes] = await Promise.all([
        fetchWithRetry('/birthdays/today', []),
        fetchWithRetry('/certificates/expiring', { count_today: 0, count_30_days: 0, expiring_today: [], expiring_soon: [] }),
        fetchWithRetry('/societies/invite-code', { invite_code: '' }),
        fetchWithRetry('/admin/notifications/unread-count', { count: 0 }),
      ]);
      
      setBirthdays(birthdaysRes.data || []);
      
      // Load today's registered athletes
      try {
        const todayRes = await api.get('/athletes/registered-today');
        setTodayAthletes(todayRes.data?.athletes || []);
      } catch { setTodayAthletes([]); }
      const certsData = certsRes.data || { count_today: 0, count_30_days: 0, expiring_today: [], expiring_soon: [] };
      setExpiringCerts(certsData);
      setInviteCode(inviteRes.data?.invite_code || '');
      setUnreadNotifications(notifRes.data?.count || 0);
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleApproveDeletion = async (athleteId: string, athleteName: string) => {
    setProcessingDeletion(athleteId);
    try {
      // Pre-check obligations
      const checkRes = await api.get(`/athletes/${athleteId}/deletion-check`);
      const check = checkRes.data;
      
      let confirmMsg = `Sei sicuro di voler ELIMINARE definitivamente l'atleta "${athleteName}"?\n\n`;
      
      if (check.has_obligations) {
        confirmMsg += `ATTENZIONE - Obblighi amministrativi rilevati:\n`;
        if (check.obligations.unpaid_payments.count > 0) {
          confirmMsg += `- ${check.obligations.unpaid_payments.count} pagamenti non saldati (${check.obligations.unpaid_payments.total.toFixed(2)} EUR)\n`;
        }
        if (check.obligations.fiscal_documents.count > 0) {
          confirmMsg += `- ${check.obligations.fiscal_documents.count} documenti fiscali emessi\n`;
        }
        if (check.obligations.compensations.count > 0) {
          confirmMsg += `- ${check.obligations.compensations.count} compensi registrati\n`;
        }
        confirmMsg += `\nI dati fiscali minimi verranno conservati per obblighi di legge.\n`;
      }
      
      confirmMsg += `\nDati da eliminare: ${check.data_to_delete.attendances} presenze, ${check.data_to_delete.signed_documents} documenti, ${check.data_to_delete.payments} pagamenti.`;
      
      if (check.parent_info.parent_can_be_deleted) {
        confirmMsg += `\n\nAnche l'account genitore verra eliminato (nessun altro figlio).`;
      }
      
      confirmMsg += `\n\nQuesta azione e irreversibile!`;
      
      const confirmAction = Platform.OS === 'web'
        ? window.confirm(confirmMsg)
        : await new Promise((resolve) => {
            Alert.alert(
              'Conferma Eliminazione',
              confirmMsg,
              [
                { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                { text: 'ELIMINA', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (!confirmAction) {
        setProcessingDeletion(null);
        return;
      }
      
      const result = await api.post(`/athletes/${athleteId}/approve-deletion`);
      showAlert('Successo', result.data.message || 'Atleta eliminato con successo');
      loadStats();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
    } finally {
      setProcessingDeletion(null);
    }
  };

  const handleRejectDeletion = async (athleteId: string, athleteName: string) => {
    const confirmAction = Platform.OS === 'web'
      ? window.confirm(`Rifiutare la richiesta di cancellazione per "${athleteName}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Conferma',
            `Rifiutare la richiesta di cancellazione per "${athleteName}"?`,
            [
              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Rifiuta', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirmAction) return;
    
    setProcessingDeletion(athleteId);
    try {
      await api.post(`/athletes/${athleteId}/reject-deletion`);
      showAlert('Successo', 'Richiesta rifiutata');
      loadStats();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore');
    } finally {
      setProcessingDeletion(null);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleStaffAction = async (userId: string, userName: string, action: 'approved' | 'rejected') => {
    const actionLabel = action === 'approved' ? 'approvare' : 'rifiutare';
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Vuoi ${actionLabel} ${userName}?`)
      : await new Promise((resolve) => {
          Alert.alert('Conferma', `Vuoi ${actionLabel} ${userName}?`, [
            { text: 'Annulla', onPress: () => resolve(false) },
            { text: 'Conferma', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      await api.patch(`/users/${userId}/status`, { status: action });
      loadStats();
      showAlert('Successo', `${userName} ${action === 'approved' ? 'approvato' : 'rifiutato'}!`);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'coach': return 'Coach';
      case 'collaboratore': return 'Collaboratore';
      case 'admin': case 'viewer': return 'Dirigente';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'coach': return '#E67E22';
      case 'collaboratore': return '#3498DB';
      case 'admin': case 'viewer': return '#8E44AD';
      default: return '#666';
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Reload stats when screen comes into focus (after approving/rejecting users)
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        router.replace('/login');
      }
    } else {
      Alert.alert(
        'Logout',
        'Sei sicuro di voler uscire?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            style: 'destructive',
            onPress: async () => {
              try {
                await logout();
                router.replace('/login');
              } catch (error) {
                console.error('Logout error:', error);
                // Force logout anyway
                router.replace('/login');
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const showInfo = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Society Name Row */}
        <View style={styles.headerTopRow}>
          {society.logo && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${society.logo}` }}
              style={styles.headerLogo}
              resizeMode="cover"
            />
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>{society.name}</Text>
        </View>
        
        {/* Icons Row */}
        <View style={styles.headerButtons}>
          {/* Notifications Bell */}
          <TouchableOpacity 
            onPress={() => router.push('/admin/notifications')} 
            style={styles.headerIconBtn}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Switch to Dirigente button */}
          <TouchableOpacity 
            onPress={() => router.replace('/dirigente')} 
            style={styles.headerIconBtn}
          >
            <Text style={{ fontSize: 18 }}>{Icons.briefcase}</Text>
          </TouchableOpacity>
          {/* Settings button */}
          <TouchableOpacity onPress={() => router.push('/admin/settings')} style={styles.headerIconBtn}>
            <Text style={{ fontSize: 20 }}>{Icons.settings}</Text>
          </TouchableOpacity>
          {/* Logout button */}
          <TouchableOpacity onPress={handleLogout} style={styles.headerIconBtn}>
            <Text style={{ fontSize: 20 }}>{Icons.logout}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.welcomeText}>
          Benvenuto, {user?.full_name?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
        </Text>

        {/* Quick Stats */}
        {stats && (
          <View style={styles.quickStats}>
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => router.push('/admin/athletes')}
            >
              <Text style={styles.quickStatNumber}>{stats.total_athletes}</Text>
              <Text style={styles.quickStatLabel}>Atleti</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => router.push('/admin/teams')}
            >
              <Text style={styles.quickStatNumber}>{stats.total_teams}</Text>
              <Text style={styles.quickStatLabel}>Squadre</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => router.push('/admin/attendances')}
            >
              <Text style={styles.quickStatNumber}>{stats.today_attendances}</Text>
              <Text style={styles.quickStatLabel}>Presenze</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => birthdays.length > 0 && showInfo(
                '🎂 Compleanni di Oggi',
                birthdays.map(b => `${b.name} (${b.age} anni) - ${b.type}`).join('\n') || 'Nessun compleanno oggi'
              )}
            >
              <View style={styles.quickStatIconRow}>
                <Text style={{ fontSize: 16 }}>🎂</Text>
                <Text style={[styles.quickStatNumber, birthdays.length > 0 && { color: '#FF9500' }]}>
                  {birthdays.length}
                </Text>
              </View>
              <Text style={styles.quickStatLabel}>Auguri</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => {
                const total = expiringCerts.count_today + expiringCerts.count_30_days;
                if (total > 0) {
                  let message = '';
                  if (expiringCerts.count_today > 0) {
                    message += `⚠️ OGGI: ${expiringCerts.count_today} certificati\n`;
                    expiringCerts.expiring_today.forEach((c: any) => {
                      message += `• ${c.athlete_name}\n`;
                    });
                  }
                  if (expiringCerts.count_30_days > 0) {
                    message += `\n📋 Prossimi 30 giorni: ${expiringCerts.count_30_days}\n`;
                    expiringCerts.expiring_soon.slice(0, 5).forEach((c: any) => {
                      message += `• ${c.athlete_name} (${c.days_until_expiry}g)\n`;
                    });
                    if (expiringCerts.count_30_days > 5) {
                      message += `... e altri ${expiringCerts.count_30_days - 5}`;
                    }
                  }
                  showInfo('📋 Certificati in Scadenza', message);
                }
              }}
            >
              <View style={styles.quickStatIconRow}>
                <Text style={{ fontSize: 16 }}>📄</Text>
                <Text style={[
                  styles.quickStatNumber, 
                  expiringCerts.count_today > 0 && { color: '#FF3B30' },
                  expiringCerts.count_today === 0 && expiringCerts.count_30_days > 0 && { color: '#FF9500' }
                ]}>
                  {expiringCerts.count_today + expiringCerts.count_30_days}
                </Text>
              </View>
              <Text style={styles.quickStatLabel}>Scadenze</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invite Code Card + Share/Invite Buttons */}
        {inviteCode && (
          <View style={styles.inviteCodeCard}>
            <View style={styles.inviteCodeRow}>
              <View style={styles.inviteCodeLeft}>
                <Text style={{ fontSize: 14 }}>🎟️</Text>
                <Text style={styles.inviteCodeTitle}>Codice Invito</Text>
              </View>
              <View style={styles.inviteCodeRight}>
                <Text style={styles.inviteCodeValue}>{inviteCode}</Text>
                <TouchableOpacity 
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      navigator.clipboard.writeText(inviteCode);
                      showInfo('Copiato!', 'Codice negli appunti');
                    } else {
                      showInfo('Codice Invito', `${inviteCode}\n\nComunica questo codice ai tuoi membri`);
                    }
                  }}
                  style={styles.copyIconButton}
                >
                  <Text style={{ fontSize: 16 }}>📋</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Share + Invite buttons in single row */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#25D366', paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onPress={() => setShowShareLink(!showShareLink)}
                data-testid="share-link-btn"
              >
                <Ionicons name="share-social" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Condividi</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onPress={() => setShowInviteModal(true)}
                data-testid="invite-email-btn"
              >
                <Ionicons name="mail" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Invita Email</Text>
              </TouchableOpacity>
            </View>
            
            {/* Expandable Share Link Panel */}
            {showShareLink && (
              <View style={{ backgroundColor: '#f0f4f8', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#e0e0e0' }}>
                <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, color: '#333', fontFamily: 'monospace' }} selectable>
                    {Platform.OS === 'web' ? `${window.location.origin}/register?code=${inviteCode}` : `registrateam://register?code=${inviteCode}`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onPress={() => {
                      const link = Platform.OS === 'web' ? `${window.location.origin}/register?code=${inviteCode}` : '';
                      if (Platform.OS === 'web') { navigator.clipboard.writeText(link); showInfo('Copiato!', 'Link negli appunti'); }
                    }}
                    data-testid="copy-link-btn"
                  >
                    <Ionicons name="copy" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 11 }}>Copia Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: '#25D366', paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onPress={() => {
                      const link = Platform.OS === 'web' ? `${window.location.origin}/register?code=${inviteCode}` : '';
                      const msg = `Ciao! Per iscriverti alla ${society.name}, registrati qui:\n${link}\n\nCodice società: ${inviteCode}`;
                      if (Platform.OS === 'web') window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    data-testid="share-whatsapp-btn"
                  >
                    <Ionicons name="logo-whatsapp" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 11 }}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Invite Email Modal */}
        {showInviteModal && (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#333' }}>Invita via Email</Text>
              <TouchableOpacity onPress={() => { setShowInviteModal(false); setInviteForm({ email: '', first_name: '', last_name: '' }); }}>
                <Ionicons name="close-circle" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14 }}
              placeholder="Email *"
              value={inviteForm.email}
              onChangeText={(t) => setInviteForm({...inviteForm, email: t})}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14 }}
              placeholder="Nome (opzionale)"
              value={inviteForm.first_name}
              onChangeText={(t) => setInviteForm({...inviteForm, first_name: t})}
            />
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 }}
              placeholder="Cognome (opzionale)"
              value={inviteForm.last_name}
              onChangeText={(t) => setInviteForm({...inviteForm, last_name: t})}
            />
            <TouchableOpacity 
              style={{ backgroundColor: sendingInvite ? '#ccc' : '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              disabled={sendingInvite || !inviteForm.email}
              onPress={async () => {
                if (!inviteForm.email) return;
                setSendingInvite(true);
                try {
                  const res = await api.post('/athletes/invite', {
                    email: inviteForm.email,
                    first_name: inviteForm.first_name || undefined,
                    last_name: inviteForm.last_name || undefined,
                  });
                  showInfo('Invito Inviato', res.data.message || `Invito inviato a ${inviteForm.email}`);
                  setShowInviteModal(false);
                  setInviteForm({ email: '', first_name: '', last_name: '' });
                } catch (error: any) {
                  showInfo('Errore', error.response?.data?.detail || 'Errore nell\'invio');
                } finally {
                  setSendingInvite(false);
                }
              }}
              data-testid="send-invite-btn"
            >
              {sendingInvite ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Invia Invito</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Staff Section - Approvals for Dirigenti, Coach, Collaboratori */}
        {pendingStaff.length > 0 && (
          <View style={[styles.pendingAthletesCard, { borderLeftColor: '#8E44AD', borderLeftWidth: 4 }]} data-testid="pending-staff-section">
            <View style={styles.pendingAthletesHeader}>
              <Ionicons name="people" size={22} color="#8E44AD" />
              <Text style={[styles.pendingAthletesTitle, { color: '#8E44AD' }]}>
                Staff in Attesa di Approvazione ({pendingStaff.length})
              </Text>
            </View>
            {pendingStaff.map((staffUser: any) => {
              const displayName = staffUser.full_name || `${staffUser.last_name || ''} ${staffUser.first_name || ''}`.trim() || staffUser.email;
              return (
              <View key={staffUser.id} style={{ backgroundColor: '#fafafa', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#eee' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', flex: 1 }}>
                    {displayName}
                  </Text>
                  <View style={{ backgroundColor: getRoleColor(staffUser.role), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{getRoleLabel(staffUser.role)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Ionicons name="mail-outline" size={13} color="#888" />
                  <Text style={{ fontSize: 12, color: '#666' }}>{staffUser.email}</Text>
                </View>
                {staffUser.phone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <Ionicons name="call-outline" size={13} color="#888" />
                    <Text style={{ fontSize: 12, color: '#666' }}>{staffUser.phone}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); handleStaffAction(staffUser.id, displayName, 'approved'); }}
                    style={{ flex: 1, backgroundColor: '#4CAF50', paddingTop: 7, paddingBottom: 7, borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    data-testid={`approve-staff-${staffUser.id}`}
                  >
                    <Ionicons name="checkmark-circle" size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Approva</Text>
                  </a>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); handleStaffAction(staffUser.id, displayName, 'rejected'); }}
                    style={{ flex: 1, backgroundColor: '#F44336', paddingTop: 7, paddingBottom: 7, borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    data-testid={`reject-staff-${staffUser.id}`}
                  >
                    <Ionicons name="close-circle" size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Rifiuta</Text>
                  </a>
                </View>
              </View>
              );
            })}
          </View>
        )}

        {/* Pending Athletes Section */}
        {pendingAthletes.length > 0 && (
          <View style={styles.pendingAthletesCard}>
            <View style={styles.pendingAthletesHeader}>
              <Text style={{ fontSize: 22 }}>⏳</Text>
              <Text style={styles.pendingAthletesTitle}>
                Atleti in Attesa di Approvazione ({pendingAthletes.length})
              </Text>
            </View>
            {pendingAthletes.map((athlete) => (
              <View key={athlete.id} style={styles.pendingAthleteItem}>
                <View style={styles.pendingAthleteInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.pendingAthleteName}>{athlete.full_name}</Text>
                    {athlete.is_adult && (
                      <View style={{ backgroundColor: '#FF9800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>18+</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pendingAthleteTeam}>{athlete.team_name}</Text>
                  {athlete.is_adult ? (
                    <>
                      {athlete.athlete_phone && (
                        <Text style={styles.pendingAthleteParent}>📞 {athlete.athlete_phone}</Text>
                      )}
                      {athlete.athlete_email && (
                        <Text style={[styles.pendingAthleteParent, { fontSize: 11 }]}>✉️ {athlete.athlete_email}</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.pendingAthleteParent}>Genitore: {athlete.parent_name}</Text>
                  )}
                </View>
                <View style={styles.pendingAthleteActions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={async () => {
                      try {
                        await api.patch(`/athletes/${athlete.id}/approval`, { status: 'trial' });
                        showInfo('Approvato', `${athlete.full_name} è stato approvato in periodo di prova`);
                        loadStats();
                      } catch (e) {
                        showInfo('Errore', 'Impossibile approvare l\'atleta');
                      }
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={async () => {
                      const confirmReject = Platform.OS === 'web'
                        ? window.confirm(`Sei sicuro di voler rifiutare ${athlete.full_name}?`)
                        : true;
                      if (confirmReject) {
                        try {
                          await api.patch(`/athletes/${athlete.id}/approval`, { status: 'rejected' });
                          showInfo('Rifiutato', `${athlete.full_name} è stato rifiutato`);
                          loadStats();
                        } catch (e) {
                          showInfo('Errore', 'Impossibile rifiutare l\'atleta');
                        }
                      }
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16 }}>✗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Today's Registrations - Link to dedicated page */}
        {todayAthletes.length > 0 && (
          <TouchableOpacity 
            onPress={() => router.push('/admin/iscrizioni')}
            style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="person-add" size={18} color="#1565C0" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1565C0' }}>Nuove Iscrizioni Oggi</Text>
              <View style={{ backgroundColor: '#1565C0', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{todayAthletes.length}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#1565C0" />
          </TouchableOpacity>
        )}

        {/* Deletion Requests Section */}
        {deletionRequests.length > 0 && (
          <View style={styles.deletionRequestsCard}>
            <View style={styles.deletionRequestsHeader}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
              <Text style={styles.deletionRequestsTitle}>
                Richieste di Cancellazione ({deletionRequests.length})
              </Text>
            </View>
            {deletionRequests.map((request) => {
              const requestDate = request.requested_at ? new Date(request.requested_at) : null;
              const formattedDate = requestDate 
                ? `${String(requestDate.getDate()).padStart(2, '0')}/${String(requestDate.getMonth() + 1).padStart(2, '0')}/${requestDate.getFullYear()}`
                : '';
              
              return (
                <View key={request.id} style={styles.deletionRequestItem}>
                  <View style={styles.deletionRequestInfo}>
                    <Text style={styles.deletionRequestName}>{request.full_name}</Text>
                    <Text style={styles.deletionRequestTeam}>{request.team_name}</Text>
                    <Text style={styles.deletionRequestParent}>
                      Richiesto da: {request.requested_by_name}
                    </Text>
                    {formattedDate && (
                      <Text style={styles.deletionRequestDate}>📅 {formattedDate}</Text>
                    )}
                  </View>
                  <View style={styles.deletionRequestActions}>
                    <TouchableOpacity
                      style={[styles.rejectDeletionBtn, processingDeletion === request.id && styles.btnDisabled]}
                      onPress={() => handleRejectDeletion(request.id, request.full_name)}
                      disabled={processingDeletion === request.id}
                    >
                      <Text style={{ fontSize: 14 }}>❌</Text>
                      <Text style={styles.rejectDeletionText}>Rifiuta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveDeletionBtn, processingDeletion === request.id && styles.btnDisabled]}
                      onPress={() => handleApproveDeletion(request.id, request.full_name)}
                      disabled={processingDeletion === request.id}
                    >
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                      <Text style={styles.approveDeletionText}>Elimina</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Gestione</Text>

        {/* 4 Main Sections */}
        <View style={styles.menuContainer}>
          {/* Società - PRIMO */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/society-profile')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F4FD' }]}>
              {society.logo ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${society.logo}` }}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ fontSize: 26 }}>{Icons.business}</Text>
              )}
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>{society.name || 'Società'}</Text>
              <Text style={styles.menuCardSubtitle}>Profilo, dati e contatti</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Calendario Gare */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/matches')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FFF5EB' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.calendar}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Calendario Gare</Text>
              <Text style={styles.menuCardSubtitle}>Gestisci partite e impegni</Text>
            </View>
          </TouchableOpacity>

          {/* Importa Calendario Federazione */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/import-calendar')}
            data-testid="import-calendar-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={{ fontSize: 26 }}>🌐</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Importa Calendario</Text>
              <Text style={styles.menuCardSubtitle}>Da FIPAV e altre federazioni</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Pre-iscrizioni Stagione */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/preseason')}
            data-testid="preseason-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="megaphone-outline" size={26} color="#2E7D32" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Pre-iscrizioni</Text>
              <Text style={styles.menuCardSubtitle}>Sondaggio interesse prossima stagione</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Dirigenti / Admin */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/dirigenti')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={{ fontSize: 26 }}>👔</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Admin e Dirigenti</Text>
              <Text style={styles.menuCardSubtitle}>Gestione ruoli e accessi</Text>
            </View>
            {pendingCounts.dirigenti > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.dirigenti}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Atleti - DOPO SOCIETÀ */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/athletes')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
              {society.sport_image ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${society.sport_image}` }}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ fontSize: 26 }}>{Icons.people}</Text>
              )}
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Atleti</Text>
              <Text style={styles.menuCardSubtitle}>{stats?.total_athletes || 0} atleti registrati</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Coach */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/coaches')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.fitness}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Coach</Text>
              <Text style={styles.menuCardSubtitle}>Gestione allenatori</Text>
            </View>
            {pendingCounts.coaches > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.coaches}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Collaboratori */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/collaboratori')}
            data-testid="collaboratori-menu-card"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E0F7FA' }]}>
              <Text style={{ fontSize: 26 }}>👷</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Collaboratori</Text>
              <Text style={styles.menuCardSubtitle}>Staff e personale</Text>
            </View>
            {pendingCounts.collaboratori > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.collaboratori}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Genitori */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/parents')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FCE4EC' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.family}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Genitori</Text>
              <Text style={styles.menuCardSubtitle}>Gestione genitori e figli</Text>
            </View>
            {pendingCounts.parents > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.parents}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Squadre */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/teams')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.layers}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Squadre</Text>
              <Text style={styles.menuCardSubtitle}>{stats?.total_teams || 0} squadre registrate</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Prime Squadre - Premium Feature */}
          {proEnabled ? (
            // Versione sbloccata - va alla pagina Prime Squadre
            <TouchableOpacity
              style={[styles.menuCard, { borderWidth: 2, borderColor: '#FFD700' }]}
              onPress={() => router.push('/admin/prime-squadre')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FFF8E1' }]}>
                <Text style={{ fontSize: 26 }}>🏆</Text>
              </View>
              <View style={styles.menuCardContent}>
                <Text style={[styles.menuCardTitle, { color: '#B8860B' }]}>Prime Squadre</Text>
                <Text style={styles.menuCardSubtitle}>Compensi atleti e collaboratori serie maggiori</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>ATTIVO</Text>
                </View>
                <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            // Versione bloccata - mostra popup informativo
            <TouchableOpacity
              style={[styles.menuCard, { opacity: 0.7, borderWidth: 1, borderColor: '#FFD700', borderStyle: 'dashed' }]}
              onPress={() => {
                const message = `🏆 PRIME SQUADRE\n\nGestisci atleti e collaboratori delle serie maggiori:\n\n📋 FUNZIONALITÀ BASE:\n• Certificati medici\n• Luogo, giorno ed ora di allenamento\n• Calendario gare\n\n💰 FUNZIONALITÀ COMPENSI ATLETI E COLLABORATORI:\n• Quietanze mensili con firma digitale\n• Rilevamento superamento soglie €5K/€15K\n• PDF automatici e invio email\n• Collaboratori (scout, massaggiatori, segnapunti, etc.)\n\n👥 LIMITE: fino a 50 tesserati\n(Per società con più di 50 tesserati sono disponibili lotti aggiuntivi)\n\n━━━━━━━━━━━━━━━━━\n\n📅 Disponibile a pagamento dal 1° Luglio 2026.\n\nPer info: assistenza@registrateam.it`;
                
                if (Platform.OS === 'web') {
                  window.alert(message);
                } else {
                  Alert.alert('🏆 Prime Squadre', message, [{ text: 'Ho capito', style: 'default' }]);
                }
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FFF8E1' }]}>
                <Text style={{ fontSize: 26 }}>🏆</Text>
              </View>
              <View style={styles.menuCardContent}>
                <Text style={[styles.menuCardTitle, { color: '#B8860B' }]}>Prime Squadre</Text>
                <Text style={styles.menuCardSubtitle}>Compensi atleti e collaboratori serie maggiori</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, color: '#333', fontWeight: 'bold' }}>PREMIUM</Text>
                </View>
                <Text style={{ fontSize: 16 }}>🔒</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Report Mensile Quietanze - Per Coach e Collaboratori */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/quietanze')}
            data-testid="quietanze-menu-card"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={{ fontSize: 26 }}>📋</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Quietanze</Text>
              <Text style={styles.menuCardSubtitle}>Report e gestione compensi</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Archivio Documenti Firmati */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/documents-archive')}
            data-testid="documents-archive-menu-card"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
              <Text style={{ fontSize: 26 }}>📁</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Archivio Documenti</Text>
              <Text style={styles.menuCardSubtitle}>Quietanze e documenti firmati</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Ricerca Avanzata Atleti */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/athlete-search')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8EAF6' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.search}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Ricerca Avanzata</Text>
              <Text style={styles.menuCardSubtitle}>Filtra atleti per ruolo, anno, CAP, altezza</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Storico Presenze */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/attendances')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F0EFFF' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.clipboard}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Storico Presenze</Text>
              <Text style={styles.menuCardSubtitle}>Presenze di oggi: {stats?.today_attendances || 0}</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>
          
          {/* Archivio Stagioni */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/seasons')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FBE9E7' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.archive}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Archivio Stagioni</Text>
              <Text style={styles.menuCardSubtitle}>Storico atleti, coach e campionati</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>

          {/* Prima Nota Pagamenti */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/payments-import')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={{ fontSize: 26 }}>{Icons.card}</Text>
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Prima Nota Pagamenti</Text>
              <Text style={styles.menuCardSubtitle}>Import, registro stagione e solleciti</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#999' }}>{Icons.chevron}</Text>
          </TouchableOpacity>
        </View>

        {/* Rigenera Codice - A fondo pagina */}
        {inviteCode && (
          <View style={styles.regenSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>{Icons.settings}</Text>
              <Text style={styles.regenSectionTitle}>Impostazioni Avanzate</Text>
            </View>
            <TouchableOpacity 
              style={styles.regenButtonBottom}
              onPress={async () => {
                const confirmText = 'ATTENZIONE: Rigenerando il codice, quello vecchio non funzionerà più.\n\nTutti i link di registrazione già condivisi non funzioneranno più.\n\nSei sicuro di voler procedere?';
                const confirmRegen = Platform.OS === 'web' 
                  ? window.confirm(confirmText)
                  : await new Promise((resolve) => {
                      Alert.alert(
                        'Conferma Rigenerazione',
                        confirmText,
                        [
                          { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Sì, Rigenera', style: 'destructive', onPress: () => resolve(true) },
                        ]
                      );
                    });
                if (confirmRegen) {
                  try {
                    const res = await api.post('/societies/regenerate-invite-code');
                    setInviteCode(res.data.invite_code);
                    showInfo('Fatto!', `Nuovo codice: ${res.data.invite_code}`);
                  } catch (e) {
                    showInfo('Errore', 'Impossibile rigenerare il codice');
                  }
                }
              }}
            >
              <Text style={{ fontSize: 14 }}>🔄</Text>
              <Text style={styles.regenButtonBottomText}>Rigenera Codice Invito</Text>
            </TouchableOpacity>
            <Text style={styles.regenWarning}>
              ⚠️ Usa questa opzione solo se necessario. Il vecchio codice smetterà di funzionare.
            </Text>
          </View>
        )}

        {/* Bottom padding for Android navigation */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  betaBanner: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  betaBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  betaBannerText: {
    fontSize: 14,
    color: '#388E3C',
    fontWeight: '600',
  },
  betaBannerSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLogo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  headerBtn: {
    padding: 4,
  },
  headerIconBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  dirigenteSwitchBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 5,
  },
  regenBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: 6,
  },
  regenSection: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFF8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  regenSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  regenButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  regenButtonBottomText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  regenWarning: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    padding: 20,
    paddingBottom: 10,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quickStatNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  quickStatIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
    marginHorizontal: 2,
  },
  inviteCodeCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteCodeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inviteCodeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  inviteCodeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 2,
  },
  copyIconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  inviteCodeHint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  copyCodeButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  copyCodeButtonFull: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  copyCodeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteCodeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  regenerateCodeButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  regenerateCodeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteCodeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  regenerateIconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  pendingAthletesCard: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  pendingAthletesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pendingAthletesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
  },
  pendingAthleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pendingAthleteInfo: {
    flex: 1,
  },
  pendingAthleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pendingAthleteTeam: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
  },
  pendingAthleteParent: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  pendingAthleteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#34C759',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  menuContainer: {
    paddingHorizontal: 16,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuCardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Deletion Requests Styles
  deletionRequestsCard: {
    backgroundColor: '#FFF0F0',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  deletionRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  deletionRequestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  deletionRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  deletionRequestInfo: {
    flex: 1,
  },
  deletionRequestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deletionRequestTeam: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
  },
  deletionRequestParent: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deletionRequestDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  deletionRequestActions: {
    flexDirection: 'column',
    gap: 6,
  },
  rejectDeletionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF9500',
    gap: 4,
  },
  rejectDeletionText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
  },
  approveDeletionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  approveDeletionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
