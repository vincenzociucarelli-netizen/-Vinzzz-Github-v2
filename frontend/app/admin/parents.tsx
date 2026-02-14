import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  RefreshControl,
  Platform,
  TextInput,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface Athlete {
  id: string;
  full_name: string;
  team_name?: string;
  status: string;
}

interface Parent {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  athletes_count: number;
  athletes?: Athlete[];
  created_at: string;
  approved_at?: string;
  phone?: string;
}

export default function ParentsScreen() {
  const router = useRouter();
  const [parents, setParents] = useState<Parent[]>([]);
  const [pendingParents, setPendingParents] = useState<Parent[]>([]);
  const [allAthletes, setAllAthletes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{parents: Parent[], athletes: any[]}>({parents: [], athletes: []});
  const [isSearching, setIsSearching] = useState(false);

  const loadData = async () => {
    try {
      const [parentsRes, pendingRes, athletesRes] = await Promise.all([
        api.get('/users/parents'),
        api.get('/users/pending'),
        api.get('/athletes'),
      ]);
      
      // All parents with their athletes
      const allParents = parentsRes.data;
      
      // Get all athletes and map them to parents
      const athletes = athletesRes.data;
      setAllAthletes(athletes);
      
      // Enrich parents with their athletes
      const enrichedParents = allParents.map((p: Parent) => ({
        ...p,
        athletes: athletes.filter((a: any) => a.parent_id === p.id).map((a: any) => ({
          id: a.id,
          full_name: a.full_name,
          team_name: a.team_name,
          status: a.status,
        })),
      }));
      
      // Sort by name
      enrichedParents.sort((a: Parent, b: Parent) => 
        a.full_name.localeCompare(b.full_name)
      );
      
      // Filter approved parents
      const approvedParents = enrichedParents.filter((p: Parent) => p.status === 'approved');
      setParents(approvedParents);
      
      // Filter pending parents and enrich them too
      const pending = pendingRes.data.filter((u: Parent) => u.role === 'parent');
      const enrichedPending = pending.map((p: Parent) => ({
        ...p,
        athletes: athletes.filter((a: any) => a.parent_id === p.id).map((a: any) => ({
          id: a.id,
          full_name: a.full_name,
          team_name: a.team_name,
          status: a.status,
        })),
      }));
      setPendingParents(enrichedPending);
    } catch (error) {
      console.error('Error loading parents:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setIsSearching(true);
      const query = searchQuery.toLowerCase();
      
      // Search parents
      const matchingParents = parents.filter(p => 
        p.full_name.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query)
      );
      
      // Search athletes and find their parents
      const matchingAthletes = allAthletes.filter(a =>
        a.full_name.toLowerCase().includes(query)
      ).map(a => ({
        ...a,
        parent: parents.find(p => p.id === a.parent_id),
      }));
      
      setSearchResults({ parents: matchingParents, athletes: matchingAthletes });
    } else {
      setIsSearching(false);
      setSearchResults({ parents: [], athletes: [] });
    }
  }, [searchQuery, parents, allAthletes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleApprove = async (parent: Parent) => {
    try {
      await api.patch(`/users/${parent.id}/status`, { status: 'approved' });
      showAlert('Successo', `${parent.full_name} è stato approvato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'approvazione');
    }
    setActionModalVisible(false);
  };

  const handleReject = async (parent: Parent) => {
    try {
      await api.patch(`/users/${parent.id}/status`, { status: 'rejected' });
      showAlert('Successo', `${parent.full_name} è stato rifiutato`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il rifiuto');
    }
    setActionModalVisible(false);
  };

  const handleSuspend = async (parent: Parent) => {
    try {
      await api.patch(`/users/${parent.id}/status`, { status: 'suspended' });
      showAlert('Successo', `${parent.full_name} è stato sospeso`);
      await loadData();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante la sospensione');
    }
    setActionModalVisible(false);
  };

  const handleDelete = async (parent: Parent) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm(`Sei sicuro di voler eliminare ${parent.full_name}?\n\nAttenzione: verranno eliminati anche tutti gli atleti associati!`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Conferma Eliminazione',
            `Sei sicuro di voler eliminare ${parent.full_name}?\n\nAttenzione: verranno eliminati anche tutti gli atleti associati!`,
            [
              { text: 'Annulla', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Elimina', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });
    
    if (confirmed) {
      try {
        await api.delete(`/users/${parent.id}`);
        showAlert('Successo', 'Genitore eliminato con successo');
        await loadData();
      } catch (error: any) {
        showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
      }
    }
    setActionModalVisible(false);
  };

  const openActionModal = (parent: Parent) => {
    setSelectedParent(parent);
    setActionModalVisible(true);
  };

  const openDetailModal = (parent: Parent) => {
    setSelectedParent(parent);
    setDetailModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'active': return '#34C759';
      case 'pending': return '#FF9500';
      case 'rejected': case 'blocked': return '#FF3B30';
      case 'suspended': return '#8E8E93';
      case 'trial': return '#007AFF';
      default: return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Attivo';
      case 'active': return 'Attivo';
      case 'pending': return 'In attesa';
      case 'rejected': return 'Rifiutato';
      case 'suspended': return 'Sospeso';
      case 'trial': return 'Prova';
      case 'blocked': return 'Bloccato';
      default: return status;
    }
  };

  const renderPendingItem = ({ item }: { item: Parent }) => (
    <View style={styles.pendingCard}>
      <TouchableOpacity style={styles.pendingInfo} onPress={() => openDetailModal(item)}>
        <Text style={styles.pendingName}>{item.full_name}</Text>
        <Text style={styles.pendingEmail}>{item.email}</Text>
        {item.athletes && item.athletes.length > 0 && (
          <View style={styles.athletesList}>
            <Text style={styles.athletesLabel}>👶 Figli registrati:</Text>
            {item.athletes.map((a, idx) => (
              <Text key={idx} style={styles.athleteName}>
                • {a.full_name}{a.team_name ? ` - ${a.team_name}` : ''}
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => handleApprove(item)}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleReject(item)}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderParentItem = ({ item }: { item: Parent }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => openDetailModal(item)}>
      <View style={styles.userAvatar}>
        <Ionicons name="people" size={24} color="#E91E63" />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        {/* Show athletes inline with team name */}
        {item.athletes && item.athletes.length > 0 && (
          <View style={styles.inlineAthletes}>
            <Ionicons name="person" size={12} color="#666" />
            <Text style={styles.inlineAthletesText}>
              {item.athletes.map(a => `${a.full_name}${a.team_name ? ` (${a.team_name})` : ''}`).join(', ')}
            </Text>
          </View>
        )}
        <View style={styles.userMeta}>
          <View style={styles.athletesBadge}>
            <Ionicons name="person" size={12} color="#666" />
            <Text style={styles.athletesText}>{item.athletes?.length || 0} atleti</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => openActionModal(item)}>
        <Ionicons name="ellipsis-vertical" size={20} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Search result item for athletes
  const renderSearchAthleteItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.searchResultCard}
      onPress={() => router.push(`/admin/athlete/${item.id}`)}
    >
      <View style={styles.searchResultIcon}>
        <Ionicons name="person" size={20} color="#9C27B0" />
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.full_name}</Text>
        <Text style={styles.searchResultType}>Atleta</Text>
        {item.team_name && (
          <Text style={styles.searchResultTeam}>Squadra: {item.team_name}</Text>
        )}
        {item.parent && (
          <View style={styles.searchResultParent}>
            <Ionicons name="people" size={12} color="#E91E63" />
            <Text style={styles.searchResultParentText}>Genitore: {item.parent.full_name}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  // Search result item for parents
  const renderSearchParentItem = ({ item }: { item: Parent }) => (
    <TouchableOpacity 
      style={styles.searchResultCard}
      onPress={() => openDetailModal(item)}
    >
      <View style={[styles.searchResultIcon, { backgroundColor: '#FCE4EC' }]}>
        <Ionicons name="people" size={20} color="#E91E63" />
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.full_name}</Text>
        <Text style={styles.searchResultType}>Genitore</Text>
        {item.athletes && item.athletes.length > 0 && (
          <Text style={styles.searchResultChildren}>
            Figli: {item.athletes.map(a => `${a.full_name}${a.team_name ? ` (${a.team_name})` : ''}`).join(', ')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Genitori</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca genitore o atleta..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {isSearching ? (
        /* Search Results View */
        <ScrollView style={styles.content}>
          {searchResults.parents.length > 0 && (
            <View style={styles.searchSection}>
              <Text style={styles.searchSectionTitle}>👨‍👩‍👧 Genitori trovati ({searchResults.parents.length})</Text>
              {searchResults.parents.map((item, index) => (
                <View key={item.id}>{renderSearchParentItem({ item })}</View>
              ))}
            </View>
          )}
          
          {searchResults.athletes.length > 0 && (
            <View style={styles.searchSection}>
              <Text style={styles.searchSectionTitle}>🏃 Atleti trovati ({searchResults.athletes.length})</Text>
              {searchResults.athletes.map((item, index) => (
                <View key={item.id}>{renderSearchAthleteItem({ item })}</View>
              ))}
            </View>
          )}
          
          {searchResults.parents.length === 0 && searchResults.athletes.length === 0 && (
            <View style={styles.noResults}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.noResultsText}>Nessun risultato per "{searchQuery}"</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* Normal List View */
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Pending Section */}
          {pendingParents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>⏳ Richieste in attesa</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingParents.length}</Text>
                </View>
              </View>
              {pendingParents.map((item) => (
                <View key={item.id}>{renderPendingItem({ item })}</View>
              ))}
            </View>
          )}

          {/* Approved Parents Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Genitori approvati ({parents.length})</Text>
            {parents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Nessun genitore approvato</Text>
              </View>
            ) : (
              parents.map((item) => (
                <View key={item.id}>{renderParentItem({ item })}</View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>👨‍👩‍👧 Dettaglio Genitore</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedParent && (
              <ScrollView style={styles.detailBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Nome</Text>
                  <Text style={styles.detailValue}>{selectedParent.full_name}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedParent.email}</Text>
                </View>
                
                {/* Phone and WhatsApp */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Telefono</Text>
                  {selectedParent.phone ? (
                    <View style={styles.phoneRow}>
                      <Text style={styles.detailValue}>{selectedParent.phone}</Text>
                      <TouchableOpacity
                        style={styles.whatsappBtn}
                        onPress={() => {
                          const phone = selectedParent.phone!.replace(/\D/g, '');
                          const phoneWithCountry = phone.startsWith('39') ? phone : `39${phone}`;
                          Linking.openURL(`https://wa.me/${phoneWithCountry}`);
                        }}
                      >
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                        <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.noPhoneText}>Non disponibile</Text>
                  )}
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Stato</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDotLarge, { backgroundColor: getStatusColor(selectedParent.status) }]} />
                    <Text style={[styles.detailValue, { color: getStatusColor(selectedParent.status) }]}>
                      {getStatusLabel(selectedParent.status)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>👶 Figli Registrati ({selectedParent.athletes?.length || 0})</Text>
                  {selectedParent.athletes && selectedParent.athletes.length > 0 ? (
                    selectedParent.athletes.map((athlete, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.athleteCard}
                        onPress={() => {
                          setDetailModalVisible(false);
                          router.push(`/admin/athlete/${athlete.id}`);
                        }}
                      >
                        <View style={styles.athleteIcon}>
                          <Ionicons name="person" size={20} color="#9C27B0" />
                        </View>
                        <View style={styles.athleteInfo}>
                          <Text style={styles.athleteCardName}>{athlete.full_name}</Text>
                          {athlete.team_name && (
                            <Text style={styles.athleteTeam}>{athlete.team_name}</Text>
                          )}
                        </View>
                        <View style={[styles.athleteStatus, { backgroundColor: getStatusColor(athlete.status) }]}>
                          <Text style={styles.athleteStatusText}>{getStatusLabel(athlete.status)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.noAthletesText}>Nessun atleta registrato</Text>
                  )}
                </View>
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={styles.closeDetailBtn}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.closeDetailBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedParent?.full_name}</Text>
            <Text style={styles.modalSubtitle}>{selectedParent?.email}</Text>
            
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#007AFF' }]}
              onPress={() => {
                setActionModalVisible(false);
                openDetailModal(selectedParent!);
              }}
            >
              <Ionicons name="eye" size={20} color="#fff" />
              <Text style={styles.modalBtnText}>Visualizza Dettagli</Text>
            </TouchableOpacity>
            
            {selectedParent?.status === 'approved' && (
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#FF9500' }]}
                onPress={() => selectedParent && handleSuspend(selectedParent)}
              >
                <Ionicons name="pause-circle" size={20} color="#fff" />
                <Text style={styles.modalBtnText}>Sospendi</Text>
              </TouchableOpacity>
            )}
            
            {selectedParent?.status === 'suspended' && (
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#34C759' }]}
                onPress={() => selectedParent && handleApprove(selectedParent)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.modalBtnText}>Riattiva</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]}
              onPress={() => selectedParent && handleDelete(selectedParent)}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.modalBtnText}>Elimina</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setActionModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Annulla</Text>
            </TouchableOpacity>
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
  header: {
    backgroundColor: '#E91E63',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pendingBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pendingEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  pendingRole: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  athletesList: {
    marginTop: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
  },
  athletesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  athleteName: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  pendingActions: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#34C759',
  },
  rejectBtn: {
    backgroundColor: '#FF3B30',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FCE4EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  inlineAthletes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inlineAthletesText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  athletesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  athletesText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  // Search styles
  searchSection: {
    marginBottom: 20,
  },
  searchSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  searchResultCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  searchResultType: {
    fontSize: 12,
    color: '#999',
  },
  searchResultTeam: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchResultParent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  searchResultParentText: {
    fontSize: 12,
    color: '#E91E63',
    marginLeft: 4,
  },
  searchResultChildren: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#999',
  },
  // Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detailBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  athleteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  athleteTeam: {
    fontSize: 12,
    color: '#666',
  },
  athleteStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  athleteStatusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  noAthletesText: {
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  closeDetailBtn: {
    backgroundColor: '#E91E63',
    margin: 20,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeDetailBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Action Modal
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelBtn: {
    alignItems: 'center',
    padding: 14,
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  noPhoneText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
});
