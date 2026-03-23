import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';

interface Campaign {
  id: string;
  title: string;
  season: string;
  description: string;
  is_active: boolean;
  open_date?: string;
  close_date?: string;
  response_count: number;
  created_at: string;
  auto_reminders_enabled?: boolean;
  reminder_frequency_days?: number;
  last_auto_reminder_sent?: string;
  auto_reminder_count?: number;
  last_notification_sent?: string;
  notification_count?: number;
}

interface ResponseItem {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone_athlete: string;
  phone_parent: string;
  already_member: boolean;
  previous_club: string;
  played_volleyball?: boolean | null;
  played_at_school?: boolean;
  played_in_society?: boolean;
  years_in_society?: string;
  previous_sport?: string;
  championships_played: string;
  role_played: string;
  interest_level: string;
  notes: string;
  source: string;
  created_at: string;
}

interface Stats {
  total: number;
  interested: number;
  thinking: number;
  not_interested: number;
  existing_members: number;
  new_athletes: number;
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') { alert(`${title}\n${message}`); }
  else { Alert.alert(title, message); }
};

export default function PreseasonAdmin() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [togglingReminders, setTogglingReminders] = useState<string | null>(null);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOpenDate, setNewOpenDate] = useState('');
  const [newCloseDate, setNewCloseDate] = useState('');
  const [creating, setCreating] = useState(false);

  const [sendingNotifications, setSendingNotifications] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/preseason/campaigns');
      setCampaigns(res.data);
    } catch (err) {
      console.log('Error loading campaigns', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSeason.trim()) {
      showAlert('Errore', 'Inserisci titolo e stagione');
      return;
    }
    setCreating(true);
    try {
      await api.post('/preseason/campaigns', {
        title: newTitle.trim(),
        season: newSeason.trim(),
        description: newDesc.trim(),
        open_date: newOpenDate.trim() || null,
        close_date: newCloseDate.trim() || null,
      });
      setShowCreate(false);
      setNewTitle(''); setNewSeason(''); setNewDesc(''); setNewOpenDate(''); setNewCloseDate('');
      loadCampaigns();
      showAlert('Successo', 'Campagna creata!');
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      await api.patch(`/preseason/campaigns/${campaign.id}`, { is_active: !campaign.is_active });
      loadCampaigns();
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    }
  };

  const handleToggleReminders = async (campaign: Campaign) => {
    const newEnabled = !campaign.auto_reminders_enabled;
    setTogglingReminders(campaign.id);
    try {
      await api.patch(`/preseason/campaigns/${campaign.id}`, { 
        auto_reminders_enabled: newEnabled,
        reminder_frequency_days: campaign.reminder_frequency_days || 7,
      });
      loadCampaigns();
      showAlert(
        newEnabled ? 'Promemoria Attivati' : 'Promemoria Disattivati',
        newEnabled 
          ? `I genitori che non hanno risposto riceveranno un promemoria automatico ogni ${campaign.reminder_frequency_days || 7} giorni.`
          : 'I promemoria automatici sono stati disattivati.'
      );
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    } finally {
      setTogglingReminders(null);
    }
  };

  const handleChangeFrequency = async (campaign: Campaign, days: number) => {
    try {
      await api.patch(`/preseason/campaigns/${campaign.id}`, { reminder_frequency_days: days });
      loadCampaigns();
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    }
  };

  const handleSendNotifications = async (campaign: Campaign) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Inviare email e notifiche ai genitori che non hanno ancora risposto per "${campaign.title}"?`)
      : await new Promise(resolve => Alert.alert('Invia Notifiche', `Inviare email ai genitori che non hanno risposto?`, [
          { text: 'Annulla', onPress: () => resolve(false) },
          { text: 'Invia', onPress: () => resolve(true) },
        ]));
    if (!confirm) return;
    
    setSendingNotifications(campaign.id);
    try {
      const res = await api.post(`/preseason/campaigns/${campaign.id}/send-notifications`);
      const d = res.data;
      showAlert('Notifiche Inviate', `${d.notified_count} genitori notificati (${d.email_sent} email inviate).\n${d.already_responded_count} avevano gia risposto su ${d.total_parents} totali.`);
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore invio notifiche');
    } finally {
      setSendingNotifications(null);
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Eliminare la campagna "${campaign.title}"? Tutte le risposte verranno cancellate.`)
      : await new Promise(resolve => Alert.alert('Conferma', `Eliminare "${campaign.title}"?`, [
          { text: 'Annulla', onPress: () => resolve(false) },
          { text: 'Elimina', style: 'destructive', onPress: () => resolve(true) },
        ]));
    if (!confirm) return;
    try {
      await api.delete(`/preseason/campaigns/${campaign.id}`);
      loadCampaigns();
      if (selectedCampaign?.id === campaign.id) { setSelectedCampaign(null); setResponses([]); setStats(null); }
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    }
  };

  const viewResponses = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoadingResponses(true);
    try {
      const res = await api.get(`/preseason/campaigns/${campaign.id}/responses`);
      setResponses(res.data.responses);
      setStats(res.data.stats);
    } catch (err: any) {
      showAlert('Errore', err.response?.data?.detail || 'Errore');
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleExport = async (campaignId: string) => {
    try {
      const res = await api.get(`/preseason/campaigns/${campaignId}/export`, { responseType: 'blob' });
      if (Platform.OS === 'web') {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preiscrizioni_${campaignId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      showAlert('Errore', 'Errore durante l\'esportazione');
    }
  };

  const getPublicLink = (campaignId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/preseason/${campaignId}`;
  };

  const copyLink = (campaignId: string) => {
    const link = getPublicLink(campaignId);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showAlert('Copiato!', 'Link copiato negli appunti. Condividilo su WhatsApp o social!');
    }
  };

  const interestLabel = (level: string) => {
    switch (level) {
      case 'si': return { text: 'Interessato', color: '#2E7D32', bg: '#E8F5E9' };
      case 'ci_penso': return { text: 'Ci pensa', color: '#F57F17', bg: '#FFF8E1' };
      case 'no': return { text: 'No', color: '#C62828', bg: '#FFEBEE' };
      default: return { text: level, color: '#666', bg: '#F5F5F5' };
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }} contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => router.back()} data-testid="preseason-back-btn">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0D47A1' }}>Pre-iscrizioni</Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#0D47A1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          onPress={() => setShowCreate(true)}
          data-testid="create-campaign-btn"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Nuova Campagna</Text>
        </TouchableOpacity>
      </View>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center' }}>
          <Ionicons name="megaphone-outline" size={48} color="#CCC" />
          <Text style={{ fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' }}>
            Nessuna campagna creata. Crea la tua prima campagna di pre-iscrizione!
          </Text>
        </View>
      ) : (
        campaigns.map((c) => (
          <View key={c.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: c.is_active ? '#2E7D32' : '#999' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0D47A1' }} data-testid={`campaign-title-${c.id}`}>{c.title}</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Stagione {c.season}</Text>
              </View>
              <View style={{
                backgroundColor: c.is_active ? '#E8F5E9' : '#F5F5F5',
                borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.is_active ? '#2E7D32' : '#999' }}>
                  {c.is_active ? 'Attiva' : 'Chiusa'}
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people" size={16} color="#1565C0" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1565C0' }}>{c.response_count}</Text>
                <Text style={{ fontSize: 11, color: '#888' }}>risposte</Text>
              </View>
              {(c as any).missing_parents > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Ionicons name="alert-circle" size={14} color="#E65100" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#E65100' }}>
                    {(c as any).missing_parents} genitori mancanti
                  </Text>
                </View>
              )}
              {(c as any).missing_parents === 0 && (c as any).total_parents > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#2E7D32" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#2E7D32' }}>Tutti hanno risposto</Text>
                </View>
              )}
              {c.close_date && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="calendar" size={14} color="#888" />
                  <Text style={{ fontSize: 11, color: '#888' }}>
                    Scade: {new Date(c.close_date).toLocaleDateString('it-IT')}
                  </Text>
                </View>
              )}
              {c.last_notification_sent && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="notifications" size={14} color="#6A1B9A" />
                  <Text style={{ fontSize: 11, color: '#6A1B9A' }}>
                    Notifiche: {c.notification_count || 0}x
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F2FD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                onPress={() => viewResponses(c)}
                data-testid={`view-responses-${c.id}`}
              >
                <Ionicons name="list" size={14} color="#1565C0" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1565C0' }}>Risposte</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                onPress={() => handleExport(c.id)}
                data-testid={`export-${c.id}`}
              >
                <Ionicons name="download-outline" size={14} color="#2E7D32" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#2E7D32' }}>CSV</Text>
              </TouchableOpacity>
              {c.is_active && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDE7F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: sendingNotifications === c.id ? 0.6 : 1 }}
                  onPress={() => handleSendNotifications(c)}
                  disabled={sendingNotifications === c.id}
                  data-testid={`send-notifications-${c.id}`}
                >
                  {sendingNotifications === c.id ? (
                    <ActivityIndicator size={14} color="#6A1B9A" />
                  ) : (
                    <Ionicons name="notifications-outline" size={14} color="#6A1B9A" />
                  )}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6A1B9A' }}>Notifica</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                onPress={() => copyLink(c.id)}
                data-testid={`copy-link-${c.id}`}
              >
                <Ionicons name="link" size={14} color="#E65100" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#E65100' }}>Link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                onPress={() => handleToggleActive(c)}
                data-testid={`toggle-active-${c.id}`}
              >
                <Ionicons name={c.is_active ? 'pause' : 'play'} size={14} color="#666" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>{c.is_active ? 'Chiudi' : 'Riapri'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                onPress={() => handleDelete(c)}
                data-testid={`delete-campaign-${c.id}`}
              >
                <Ionicons name="trash-outline" size={14} color="#C62828" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#C62828' }}>Elimina</Text>
              </TouchableOpacity>
            </View>

            {/* Auto-Reminders Section */}
            {c.is_active && (
              <View style={{ marginTop: 12, backgroundColor: '#FAFAFA', borderRadius: 8, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="alarm-outline" size={16} color={c.auto_reminders_enabled ? '#E65100' : '#999'} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.auto_reminders_enabled ? '#E65100' : '#999' }}>
                      Promemoria automatici
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: c.auto_reminders_enabled ? '#E65100' : '#DDD',
                      borderRadius: 12, width: 44, height: 24, justifyContent: 'center',
                      paddingHorizontal: 2,
                    }}
                    onPress={() => handleToggleReminders(c)}
                    disabled={togglingReminders === c.id}
                    data-testid={`toggle-reminders-${c.id}`}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                      alignSelf: c.auto_reminders_enabled ? 'flex-end' : 'flex-start',
                    }} />
                  </TouchableOpacity>
                </View>
                {c.auto_reminders_enabled && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Frequenza invio:</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[3, 5, 7, 14].map(days => (
                        <TouchableOpacity
                          key={days}
                          style={{
                            backgroundColor: (c.reminder_frequency_days || 7) === days ? '#E65100' : '#EEE',
                            borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
                          }}
                          onPress={() => handleChangeFrequency(c, days)}
                        >
                          <Text style={{
                            fontSize: 11, fontWeight: '600',
                            color: (c.reminder_frequency_days || 7) === days ? '#fff' : '#666',
                          }}>
                            {days}gg
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {c.last_auto_reminder_sent && (
                      <Text style={{ fontSize: 10, color: '#AAA', marginTop: 6 }}>
                        Ultimo invio: {new Date(c.last_auto_reminder_sent).toLocaleDateString('it-IT')} ({c.auto_reminder_count || 0}x)
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        ))
      )}

      {/* Responses View */}
      {selectedCampaign && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0D47A1' }}>
              Risposte: {selectedCampaign.title}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedCampaign(null); setResponses([]); setStats(null); }}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Stats cards */}
          {stats && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <StatCard label="Totali" value={stats.total} color="#1565C0" bg="#E3F2FD" />
              <StatCard label="Interessati" value={stats.interested} color="#2E7D32" bg="#E8F5E9" />
              <StatCard label="Ci pensano" value={stats.thinking} color="#F57F17" bg="#FFF8E1" />
              <StatCard label="No" value={stats.not_interested} color="#C62828" bg="#FFEBEE" />
              <StatCard label="Gia iscritti" value={stats.existing_members} color="#6A1B9A" bg="#F3E5F5" />
              <StatCard label="Nuovi" value={stats.new_athletes} color="#00695C" bg="#E0F2F1" />
            </View>
          )}

          {loadingResponses ? (
            <ActivityIndicator size="large" color="#1565C0" />
          ) : responses.length === 0 ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#999' }}>Nessuna risposta ancora.</Text>
            </View>
          ) : (
            responses.map((r) => {
              const il = interestLabel(r.interest_level);
              return (
                <View key={r.id} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: il.color }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>
                      {r.last_name} {r.first_name}
                    </Text>
                    <View style={{ backgroundColor: il.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: il.color }}>{il.text}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                    <Text style={{ fontSize: 11, color: '#666' }}>Nato/a: {r.birth_date}</Text>
                    {r.phone_athlete ? <Text style={{ fontSize: 11, color: '#666' }}>Tel: {r.phone_athlete}</Text> : null}
                    {r.phone_parent ? <Text style={{ fontSize: 11, color: '#666' }}>Gen: {r.phone_parent}</Text> : null}
                    <Text style={{ fontSize: 11, color: r.already_member ? '#2E7D32' : '#E65100', fontWeight: '600' }}>
                      {r.already_member ? 'Gia iscritto' : 'Nuovo'}
                    </Text>
                  </View>
                  {(r.championships_played || r.role_played || r.previous_club || r.played_volleyball !== undefined) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                      {r.played_volleyball === true && (
                        <Text style={{ fontSize: 11, color: '#1565C0', fontWeight: '600' }}>
                          Pallavolo: {[r.played_at_school ? 'Scuola' : '', r.played_in_society ? `Societa${r.years_in_society ? ` (${r.years_in_society} anni)` : ''}` : ''].filter(Boolean).join(', ') || 'Si'}
                        </Text>
                      )}
                      {r.played_volleyball === false && r.previous_sport && (
                        <Text style={{ fontSize: 11, color: '#888' }}>Sport precedente: {r.previous_sport}</Text>
                      )}
                      {r.played_volleyball === false && !r.previous_sport && (
                        <Text style={{ fontSize: 11, color: '#888' }}>Nessuna esperienza pallavolo</Text>
                      )}
                      {r.championships_played ? <Text style={{ fontSize: 11, color: '#888' }}>Campionati: {r.championships_played}</Text> : null}
                      {r.role_played ? <Text style={{ fontSize: 11, color: '#888' }}>Ruolo: {r.role_played}</Text> : null}
                      {r.previous_club ? <Text style={{ fontSize: 11, color: '#888' }}>Da: {r.previous_club}</Text> : null}
                    </View>
                  )}
                  {r.notes ? <Text style={{ fontSize: 11, color: '#aaa', marginTop: 4, fontStyle: 'italic' }}>Note: {r.notes}</Text> : null}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Create Campaign Modal */}
      <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#0D47A1', paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Nuova Campagna Pre-iscrizione</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={lbl}>Titolo *</Text>
              <TextInput style={inp} value={newTitle} onChangeText={setNewTitle} placeholder="Es: Pre-iscrizione 2026/2027" data-testid="new-campaign-title" />

              <Text style={lbl}>Stagione *</Text>
              <TextInput style={inp} value={newSeason} onChangeText={setNewSeason} placeholder="Es: 2026/2027" data-testid="new-campaign-season" />

              <Text style={lbl}>Descrizione</Text>
              <TextInput style={[inp, { height: 60 }]} value={newDesc} onChangeText={setNewDesc} placeholder="Testo introduttivo (opzionale)" multiline data-testid="new-campaign-desc" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={lbl}>Data apertura</Text>
                  <TextInput style={inp} value={newOpenDate} onChangeText={setNewOpenDate} placeholder="AAAA-MM-GG" data-testid="new-campaign-open" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={lbl}>Data chiusura</Text>
                  <TextInput style={inp} value={newCloseDate} onChangeText={setNewCloseDate} placeholder="AAAA-MM-GG" data-testid="new-campaign-close" />
                </View>
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: creating ? '#90CAF9' : '#0D47A1',
                  borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8,
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                }}
                onPress={handleCreate}
                disabled={creating}
                data-testid="confirm-create-campaign"
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="megaphone" size={18} color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{creating ? 'Creazione...' : 'Crea Campagna'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 80, alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const lbl: any = { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 10 };
const inp: any = {
  borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  fontSize: 14, color: '#333', backgroundColor: '#FAFAFA',
};
