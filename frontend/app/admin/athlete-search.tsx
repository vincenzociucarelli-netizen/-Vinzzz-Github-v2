import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import api from '../../src/services/api';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface Athlete {
  id: string;
  full_name: string;
  date_of_birth: string;
  postal_code?: string;
  athlete_role?: string;
  athlete_height?: number;
  team_name?: string;
}

interface FilterState {
  role: string;
  birthYearFrom: string;
  birthYearTo: string;
  postalCode: string;
  heightMin: string;
  heightMax: string;
}

interface SocietySettings {
  athlete_roles: string[];
}

export default function AthleteSearchScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [filteredAthletes, setFilteredAthletes] = useState<Athlete[]>([]);
  const [settings, setSettings] = useState<SocietySettings>({ athlete_roles: [] });
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState<FilterState>({
    role: '',
    birthYearFrom: '',
    birthYearTo: '',
    postalCode: '',
    heightMin: '',
    heightMax: '',
  });

  // Generate birth year options (last 20 years)
  const currentYear = new Date().getFullYear();
  const birthYears = Array.from({ length: 20 }, (_, i) => currentYear - 5 - i);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [athletesRes, settingsRes] = await Promise.all([
        api.get('/athletes'),
        api.get('/settings/society'),
      ]);
      setAthletes(athletesRes.data || []);
      setFilteredAthletes(athletesRes.data || []);
      setSettings({
        athlete_roles: settingsRes.data.athlete_roles || [],
      });
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Errore', 'Impossibile caricare i dati');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const applyFilters = () => {
    let result = [...athletes];

    // Filter by role
    if (filters.role) {
      result = result.filter(a => a.athlete_role === filters.role);
    }

    // Filter by birth year range
    if (filters.birthYearFrom) {
      const yearFrom = parseInt(filters.birthYearFrom);
      result = result.filter(a => {
        if (!a.date_of_birth) return false;
        const year = new Date(a.date_of_birth).getFullYear();
        return year >= yearFrom;
      });
    }
    if (filters.birthYearTo) {
      const yearTo = parseInt(filters.birthYearTo);
      result = result.filter(a => {
        if (!a.date_of_birth) return false;
        const year = new Date(a.date_of_birth).getFullYear();
        return year <= yearTo;
      });
    }

    // Filter by postal code
    if (filters.postalCode) {
      result = result.filter(a => 
        a.postal_code && a.postal_code.startsWith(filters.postalCode)
      );
    }

    // Filter by height range
    if (filters.heightMin) {
      const minHeight = parseInt(filters.heightMin);
      result = result.filter(a => 
        a.athlete_height && a.athlete_height >= minHeight
      );
    }
    if (filters.heightMax) {
      const maxHeight = parseInt(filters.heightMax);
      result = result.filter(a => 
        a.athlete_height && a.athlete_height <= maxHeight
      );
    }

    setFilteredAthletes(result);
  };

  const clearFilters = () => {
    setFilters({
      role: '',
      birthYearFrom: '',
      birthYearTo: '',
      postalCode: '',
      heightMin: '',
      heightMax: '',
    });
    setFilteredAthletes(athletes);
  };

  const exportToXLS = async () => {
    if (filteredAthletes.length === 0) {
      Alert.alert('Attenzione', 'Nessun atleta da esportare');
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredAthletes.map(athlete => ({
        'Nome Completo': athlete.full_name,
        'Data di Nascita': athlete.date_of_birth ? new Date(athlete.date_of_birth).toLocaleDateString('it-IT') : '',
        'Età': athlete.date_of_birth ? calculateAge(athlete.date_of_birth) : '',
        'Ruolo': athlete.athlete_role || '',
        'Altezza (cm)': athlete.athlete_height || '',
        'CAP': athlete.postal_code || '',
        'Squadra': athlete.team_name || '',
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Atleti');

      // Generate file
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      if (Platform.OS === 'web') {
        // For web, download directly
        const blob = new Blob([s2ab(atob(wbout))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `atleti_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('✅ Esportato', 'File XLS scaricato');
      } else {
        // For mobile, use FileSystem and Sharing
        const fileName = `atleti_${new Date().toISOString().split('T')[0]}.xlsx`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Esporta Lista Atleti',
          });
        } else {
          Alert.alert('✅ Esportato', `File salvato: ${fileName}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Errore', 'Impossibile esportare i dati');
    }
  };

  // Helper function for web export
  const s2ab = (s: string) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  };

  const calculateAge = (dateOfBirth: string) => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const getBirthYear = (dateOfBirth: string) => {
    return new Date(dateOfBirth).getFullYear();
  };

  const renderAthleteItem = ({ item }: { item: Athlete }) => (
    <TouchableOpacity 
      style={styles.athleteCard}
      onPress={() => router.push(`/admin/athlete/${item.id}`)}
    >
      <View style={styles.athleteInfo}>
        <Text style={styles.athleteName}>{item.full_name}</Text>
        <View style={styles.athleteDetails}>
          {item.date_of_birth && (
            <View style={styles.detailBadge}>
              <Ionicons name="calendar" size={12} color="#666" />
              <Text style={styles.detailText}>
                {getBirthYear(item.date_of_birth)} ({calculateAge(item.date_of_birth)} anni)
              </Text>
            </View>
          )}
          {item.athlete_role && (
            <View style={[styles.detailBadge, styles.roleBadge]}>
              <Ionicons name="person" size={12} color="#007AFF" />
              <Text style={[styles.detailText, { color: '#007AFF' }]}>{item.athlete_role}</Text>
            </View>
          )}
          {item.athlete_height && (
            <View style={styles.detailBadge}>
              <Ionicons name="resize-outline" size={12} color="#666" />
              <Text style={styles.detailText}>{item.athlete_height} cm</Text>
            </View>
          )}
          {item.postal_code && (
            <View style={styles.detailBadge}>
              <Ionicons name="location" size={12} color="#666" />
              <Text style={styles.detailText}>{item.postal_code}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔍 Ricerca Atleti</Text>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name={showFilters ? "chevron-up" : "filter"} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      {showFilters && (
        <View style={styles.filtersSection}>
          <Text style={styles.filtersTitle}>Filtri di Ricerca</Text>
          
          {/* Role Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Ruolo</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.role}
                onValueChange={(value) => setFilters({...filters, role: value})}
                style={styles.picker}
              >
                <Picker.Item label="Tutti i ruoli" value="" />
                {settings.athlete_roles.map((role, index) => (
                  <Picker.Item key={index} label={role} value={role} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Birth Year Range Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Anno di Nascita</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={[styles.filterInput, styles.rangeInput]}
                value={filters.birthYearFrom}
                onChangeText={(text) => setFilters({...filters, birthYearFrom: text})}
                placeholder="Da"
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={[styles.filterInput, styles.rangeInput]}
                value={filters.birthYearTo}
                onChangeText={(text) => setFilters({...filters, birthYearTo: text})}
                placeholder="A"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
          </View>

          {/* Postal Code Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>CAP (inizia con)</Text>
            <TextInput
              style={styles.filterInput}
              value={filters.postalCode}
              onChangeText={(text) => setFilters({...filters, postalCode: text})}
              placeholder="es: 061"
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          {/* Height Range Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Altezza (cm)</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={[styles.filterInput, styles.rangeInput]}
                value={filters.heightMin}
                onChangeText={(text) => setFilters({...filters, heightMin: text})}
                placeholder="Da"
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={[styles.filterInput, styles.rangeInput]}
                value={filters.heightMax}
                onChangeText={(text) => setFilters({...filters, heightMax: text})}
                placeholder="A"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterButtons}>
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Pulisci</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.applyButtonText}>Cerca</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Results Section */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredAthletes.length} atleti trovati
        </Text>
        {filteredAthletes.length > 0 && (
          <TouchableOpacity style={styles.exportButton} onPress={exportToXLS}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.exportButtonText}>Esporta XLS</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredAthletes}
          keyExtractor={(item) => item.id}
          renderItem={renderAthleteItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessun atleta trovato</Text>
              <Text style={styles.emptySubtext}>Prova a modificare i filtri</Text>
            </View>
          }
        />
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
    backgroundColor: '#007AFF',
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
  filtersSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 55,
  },
  picker: {
    height: 55,
  },
  filterInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeInput: {
    flex: 1,
    textAlign: 'center',
  },
  rangeSeparator: {
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#666',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  clearButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  athleteDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleBadge: {
    backgroundColor: '#E3F2FD',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
});
