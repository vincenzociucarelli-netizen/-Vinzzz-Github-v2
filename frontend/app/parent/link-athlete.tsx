import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';

export default function ParentLinkPage() {
  const router = useRouter();
  const [cognome, setCognome] = useState('');
  const [nome, setNome] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [toApprove, setToApprove] = useState<any[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { loadRequests(); }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/parent-link/requests');
      setPendingRequests(response.data.my_requests || []);
      setToApprove(response.data.to_approve || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchAthlete = async () => {
    if (!cognome.trim()) {
      showAlert('Attenzione', 'Inserisci almeno il cognome');
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const response = await api.post('/parent-link/search', {
        cognome: cognome.trim(),
        nome: nome.trim(),
      });
      setResults(response.data.results || []);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la ricerca');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (athleteId: string, athleteName: string) => {
    setSending(athleteId);
    try {
      const response = await api.post('/parent-link/request', { athlete_id: athleteId });
      showAlert('Richiesta inviata', response.data.message);
      setResults(prev => prev.filter(r => r.id !== athleteId));
      loadRequests();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'invio');
    } finally {
      setSending(null);
    }
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
    setResponding(requestId);
    try {
      const response = await api.post('/parent-link/respond', {
        request_id: requestId,
        action: action,
      });
      showAlert(action === 'accept' ? 'Approvato' : 'Rifiutato', response.data.message);
      loadRequests();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore');
    } finally {
      setResponding(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'In attesa', color: '#FF9800', bg: '#FFF3E0' };
      case 'accepted': return { label: 'Approvata', color: '#4CAF50', bg: '#E8F5E9' };
      case 'rejected': return { label: 'Rifiutata', color: '#E53935', bg: '#FFEBEE' };
      default: return { label: status, color: '#999', bg: '#F5F5F5' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collega un atleta</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Requests to approve */}
        {toApprove.length > 0 && (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#FF9800' }]}>
            <Text style={styles.cardTitle}>Richieste ricevute</Text>
            <Text style={styles.cardSubtitle}>Un genitore chiede di essere collegato al tuo atleta</Text>
            {toApprove.map((req) => (
              <View key={req.id} style={styles.requestItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestName}>{req.requester_name}</Text>
                  <Text style={styles.requestEmail}>{req.requester_email}</Text>
                  <Text style={styles.requestAthlete}>vuole collegarsi a: <Text style={{ fontWeight: '700' }}>{req.athlete_name}</Text></Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.respondBtn, { backgroundColor: '#4CAF50' }]}
                    onPress={() => respondToRequest(req.id, 'accept')}
                    disabled={responding === req.id}
                    data-testid={`accept-request-${req.id}`}
                  >
                    {responding === req.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.respondBtn, { backgroundColor: '#E53935' }]}
                    onPress={() => respondToRequest(req.id, 'reject')}
                    disabled={responding === req.id}
                    data-testid={`reject-request-${req.id}`}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Search section - nascosta di default, visibile solo su richiesta manuale */}
        {!showSearch && (
          <TouchableOpacity
            style={{ backgroundColor: '#E3F2FD', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#90CAF9' }}
            onPress={() => setShowSearch(true)}
            data-testid="show-search-btn"
          >
            <Ionicons name="search" size={20} color="#1565C0" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1565C0' }}>Cerca un atleta da collegare manualmente</Text>
          </TouchableOpacity>
        )}
        {showSearch && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Cerca atleta</Text>
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearched(false); setResults([]); }}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <Text style={styles.cardSubtitle}>Inserisci cognome e nome dell'atleta che vuoi collegare al tuo profilo</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Cognome *"
              value={cognome}
              onChangeText={setCognome}
              autoCapitalize="characters"
              data-testid="search-cognome-input"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Nome"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="characters"
              data-testid="search-nome-input"
            />
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, searching && { opacity: 0.6 }]}
            onPress={searchAthlete}
            disabled={searching}
            data-testid="search-athlete-btn"
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="#fff" />
                <Text style={styles.searchBtnText}>Cerca</Text>
              </>
            )}
          </TouchableOpacity>
          </View>
        )}

        {/* Search results */}
        {showSearch && searched && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {results.length > 0 ? `Risultati (${results.length})` : 'Nessun risultato'}
            </Text>
            {results.length === 0 && (
              <Text style={styles.emptyText}>Nessun atleta trovato con questo nome. Verifica il cognome e riprova.</Text>
            )}
            {results.map((athlete) => (
              <View key={athlete.id} style={styles.resultItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{athlete.last_name} {athlete.first_name}</Text>
                  <Text style={styles.resultDetail}>
                    <Ionicons name="people-outline" size={12} color="#666" /> {athlete.team || 'Senza squadra'}
                  </Text>
                  {athlete.date_of_birth && (
                    <Text style={styles.resultDetail}>
                      <Ionicons name="calendar-outline" size={12} color="#666" /> Nato/a: {athlete.date_of_birth}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.linkBtn, sending === athlete.id && { opacity: 0.6 }]}
                  onPress={() => sendRequest(athlete.id, `${athlete.first_name} ${athlete.last_name}`)}
                  disabled={sending === athlete.id}
                  data-testid={`link-athlete-${athlete.id}`}
                >
                  {sending === athlete.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="link" size={18} color="#fff" />
                      <Text style={styles.linkBtnText}>Collega</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* My requests history */}
        {pendingRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Le mie richieste</Text>
            {pendingRequests.map((req) => {
              const badge = getStatusBadge(req.status);
              return (
                <View key={req.id} style={styles.myRequestItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestAthlete}>{req.athlete_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#007AFF', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  backBtn: { backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0',
  },
  searchBtn: {
    backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  resultName: { fontSize: 15, fontWeight: '700', color: '#333' },
  resultDetail: { fontSize: 12, color: '#666', marginTop: 3 },
  linkBtn: {
    backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 10,
  },
  linkBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  requestItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  requestName: { fontSize: 15, fontWeight: '700', color: '#333' },
  requestEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  requestAthlete: { fontSize: 13, color: '#555', marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8, marginLeft: 10 },
  respondBtn: {
    borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  myRequestItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
});
