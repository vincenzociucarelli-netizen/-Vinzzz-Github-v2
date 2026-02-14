import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete, Team } from '../../src/types';
import { exportToExcel } from '../../src/utils/excelExport';
import { useAuthStore } from '../../src/store/authStore';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function AdminAthletes() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<{[key: string]: Team}>({});
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sectionListRef = useRef<SectionList>(null);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/athletes');
      await exportToExcel(response.data, 'Atleti');
      showAlert('Successo', 'File Excel esportato con successo');
    } catch (error: any) {
      showAlert('Errore', error.message || 'Errore durante l\'esportazione');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      const [athletesRes, teamsRes] = await Promise.all([
        api.get('/athletes'),
        api.get('/teams'),
      ]);

      setAthletes(athletesRes.data);
      
      const teamsMap: {[key: string]: Team} = {};
      teamsRes.data.forEach((team: Team) => {
        teamsMap[team.id] = team;
      });
      setTeams(teamsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Get surname from athlete - uses last_name if available, otherwise extracts from full_name
  const getSurname = (athlete: Athlete) => {
    // If last_name field is available, use it
    if (athlete.last_name) {
      return athlete.last_name.trim();
    }
    // Otherwise, assume full_name is "Nome Cognome" and take the last word
    const parts = athlete.full_name.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

  // Sort and filter athletes
  const processedAthletes = useMemo(() => {
    let filtered = athletes;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = athletes.filter(a => 
        a.full_name.toLowerCase().includes(query) ||
        teams[a.team_id]?.name?.toLowerCase().includes(query)
      );
    }
    
    // Sort by surname alphabetically
    return filtered.sort((a, b) => {
      const surnameA = getSurname(a).toUpperCase();
      const surnameB = getSurname(b).toUpperCase();
      return surnameA.localeCompare(surnameB, 'it');
    });
  }, [athletes, searchQuery, teams]);

  // Group athletes by first letter of surname for sections
  const sections = useMemo(() => {
    const grouped: { [key: string]: Athlete[] } = {};
    
    processedAthletes.forEach(athlete => {
      const surname = getSurname(athlete);
      const firstLetter = surname.charAt(0).toUpperCase() || '#';
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(athlete);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'it'))
      .map(letter => ({
        title: letter,
        data: grouped[letter],
      }));
  }, [processedAthletes]);

  // Get available letters for sidebar
  const availableLetters = useMemo(() => {
    return sections.map(s => s.title);
  }, [sections]);

  const scrollToLetter = (letter: string) => {
    const sectionIndex = sections.findIndex(s => s.title === letter);
    if (sectionIndex !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    }
  };

  // Format name as "COGNOME Nome" for display
  const formatAthleteNameForDisplay = (athlete: Athlete) => {
    if (athlete.last_name && athlete.first_name) {
      return `${athlete.last_name.toUpperCase()} ${athlete.first_name}`;
    }
    // If no separate fields, try to reverse "Nome Cognome" to "COGNOME Nome"
    const parts = athlete.full_name.trim().split(' ');
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      const name = parts.slice(0, -1).join(' ');
      return `${surname.toUpperCase()} ${name}`;
    }
    return athlete.full_name;
  };

  const getStatusText = (item: Athlete) => {
    if (item.is_withdrawn) return 'Ritirato';
    if (item.status === 'trial') return 'In prova';
    return 'Attivo';
  };

  const getStatusColor = (item: Athlete) => {
    if (item.is_withdrawn) return '#FF3B30';
    if (item.status === 'trial') return '#FF9500';
    return '#34C759';
  };

  const renderAthleteItem = ({ item }: { item: Athlete }) => (
    <TouchableOpacity 
      style={[
        styles.athleteCard,
        item.is_withdrawn && styles.athleteCardWithdrawn
      ]}
      onPress={() => router.push(`/admin/athlete/${item.id}`)}
    >
      <View style={styles.athleteInfo}>
        <View style={styles.athleteNameRow}>
          <Text style={[
            styles.athleteName,
            item.is_withdrawn && styles.athleteNameWithdrawn
          ]} numberOfLines={1}>
            {formatAthleteNameForDisplay(item)}
          </Text>
          {(item as any).athlete_code && (
            <Text style={styles.athleteCode}>{(item as any).athlete_code}</Text>
          )}
          {(item as any).has_overpayment && (
            <View style={styles.overpaymentBadge}>
              <Ionicons name="alert-circle" size={14} color="#FF3B30" />
              <Text style={styles.overpaymentBadgeText}>€{Math.abs((item as any).payment_residual)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.teamName} numberOfLines={1}>
          {teams[item.team_id]?.name || '-'}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor(item) }]}>
          {getStatusText(item)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Atleti ({processedAthletes.length})</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca atleta o squadra..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.contentContainer}>
        {/* Athletes List */}
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderAthleteItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nessun risultato' : 'Nessun atleta registrato'}
              </Text>
            </View>
          }
          getItemLayout={(data, index) => ({
            length: 56,
            offset: 56 * index,
            index,
          })}
          onScrollToIndexFailed={() => {}}
        />

        {/* Alphabet Sidebar */}
        {!searchQuery && processedAthletes.length > 10 && (
          <View style={styles.alphabetSidebar}>
            {ALPHABET.map((letter) => {
              const isAvailable = availableLetters.includes(letter);
              return (
                <TouchableOpacity
                  key={letter}
                  style={styles.alphabetItem}
                  onPress={() => isAvailable && scrollToLetter(letter)}
                  disabled={!isAvailable}
                >
                  <Text style={[
                    styles.alphabetText,
                    !isAvailable && styles.alphabetTextDisabled
                  ]}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
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
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: '#000',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    paddingRight: 30,
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  athleteCard: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  athleteCardWithdrawn: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  athleteInfo: {
    flex: 1,
    marginRight: 8,
  },
  athleteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  athleteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  athleteCode: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overpaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  overpaymentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF3B30',
  },
  athleteNameWithdrawn: {
    color: '#FF3B30',
    textDecorationLine: 'line-through',
  },
  teamName: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  alphabetSidebar: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  alphabetItem: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  alphabetText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007AFF',
  },
  alphabetTextDisabled: {
    color: '#ddd',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});
