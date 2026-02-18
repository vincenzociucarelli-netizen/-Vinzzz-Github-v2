import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

interface SelectOption {
  id: string;
  name: string;
}

interface PreviewMatch {
  match_number: string;
  date: string;
  home_team: string;
  away_team: string;
  result?: string;
  championship?: string;
  giornata?: string;
}

interface Team {
  id: string;
  name: string;
}

interface TeamMapping {
  federation_team_name: string;
  local_team_id: string;
}

export default function ImportCalendarScreen() {
  const router = useRouter();
  
  // Step state
  const [step, setStep] = useState(1);
  
  // Federation config
  const [federation, setFederation] = useState('fipav');
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('umbria');
  
  // Season and championship
  const [seasons, setSeasons] = useState<SelectOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [championships, setChampionships] = useState<SelectOption[]>([]);
  const [selectedChampionships, setSelectedChampionships] = useState<string[]>([]);
  
  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Match selection
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  
  // Society
  const [societies, setSocieties] = useState<SelectOption[]>([]);
  const [selectedSociety, setSelectedSociety] = useState('');
  const [selectedSocietyName, setSelectedSocietyName] = useState('');
  
  // Local teams
  const [localTeams, setLocalTeams] = useState<Team[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  
  // Preview
  const [previewMatches, setPreviewMatches] = useState<PreviewMatch[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  // Loading states
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [loadingChampionships, setLoadingChampionships] = useState(false);
  const [loadingSocieties, setLoadingSocieties] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Load regions on mount
  useEffect(() => {
    loadRegions();
    loadLocalTeams();
  }, []);

  // Load seasons when region changes
  useEffect(() => {
    if (selectedRegion) {
      loadSeasons();
    }
  }, [selectedRegion, federation]);

  // Load championships and societies when season changes
  useEffect(() => {
    if (selectedSeason) {
      loadChampionships();
      loadSocieties();
    }
  }, [selectedSeason]);

  const loadRegions = async () => {
    setLoadingRegions(true);
    try {
      const response = await api.get('/federation/regions', { params: { federation } });
      setRegions(response.data);
    } catch (error) {
      console.error('Error loading regions:', error);
    } finally {
      setLoadingRegions(false);
    }
  };

  const loadSeasons = async () => {
    setLoadingSeasons(true);
    try {
      const response = await api.get('/federation/seasons', {
        params: { federation, region: selectedRegion }
      });
      setSeasons(response.data);
      if (response.data.length > 0) {
        setSelectedSeason(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoadingSeasons(false);
    }
  };

  const loadChampionships = async () => {
    setLoadingChampionships(true);
    try {
      const response = await api.get('/federation/championships', {
        params: { federation, region: selectedRegion, season_id: selectedSeason }
      });
      setChampionships(response.data);
    } catch (error) {
      console.error('Error loading championships:', error);
    } finally {
      setLoadingChampionships(false);
    }
  };

  const loadSocieties = async () => {
    setLoadingSocieties(true);
    try {
      const response = await api.get('/federation/societies', {
        params: { federation, region: selectedRegion, season_id: selectedSeason }
      });
      setSocieties(response.data);
    } catch (error) {
      console.error('Error loading societies:', error);
    } finally {
      setLoadingSocieties(false);
    }
  };

  const loadLocalTeams = async () => {
    setLoadingTeams(true);
    try {
      const response = await api.get('/teams');
      setLocalTeams(response.data);
    } catch (error) {
      console.error('Error loading local teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleSocietySelect = (societyId: string) => {
    setSelectedSociety(societyId);
    const society = societies.find(s => s.id === societyId);
    if (society) {
      setSelectedSocietyName(society.name);
      // Auto-create a mapping for each local team
      const autoMappings = localTeams.map(team => ({
        federation_team_name: society.name,
        local_team_id: team.id
      }));
      setTeamMappings(autoMappings);
    }
  };

  const toggleChampionship = (champId: string) => {
    setSelectedChampionships(prev => {
      if (prev.includes(champId)) {
        return prev.filter(id => id !== champId);
      } else {
        return [...prev, champId];
      }
    });
  };

  const updateTeamMapping = (index: number, localTeamId: string) => {
    setTeamMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], local_team_id: localTeamId };
      return updated;
    });
  };

  const updateTeamMappingName = (index: number, newName: string) => {
    setTeamMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], federation_team_name: newName };
      return updated;
    });
  };

  const addTeamMapping = () => {
    setTeamMappings(prev => [
      ...prev,
      { federation_team_name: selectedSocietyName, local_team_id: '' }
    ]);
  };

  const removeTeamMapping = (index: number) => {
    setTeamMappings(prev => prev.filter((_, i) => i !== index));
  };

  const loadPreview = async () => {
    if (!selectedSociety) {
      showAlert('Errore', 'Seleziona una società dalla federazione');
      return;
    }

    setPreviewLoading(true);
    try {
      // Use the name from the first mapping (user can modify it)
      const searchName = teamMappings.length > 0 && teamMappings[0].federation_team_name 
        ? teamMappings[0].federation_team_name 
        : selectedSocietyName;
      
      const response = await api.post('/federation/preview', {
        federation,
        region: selectedRegion,
        society_name: searchName,
        federation_society_id: selectedSociety,
        season_id: selectedSeason,
        championship_id: selectedChampionships.length > 0 ? selectedChampionships[0] : null
      });
      const matches = response.data.matches || [];
      setPreviewMatches(matches);
      // Initialize all matches as selected
      setSelectedMatches(new Set(matches.map((_: any, i: number) => i)));
      setSelectAll(true);
      // Update the displayed name to show what was searched
      setSelectedSocietyName(searchName);
      setStep(3);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore nel caricamento anteprima');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (teamMappings.length === 0 || teamMappings.every(m => !m.local_team_id)) {
      showAlert('Errore', 'Configura almeno un mapping tra squadra federazione e squadra locale');
      return;
    }

    if (selectedMatches.size === 0) {
      showAlert('Errore', 'Seleziona almeno una partita da importare');
      return;
    }

    // Get selected matches from previewMatches
    const matchesToImport = previewMatches.filter((_, index) => selectedMatches.has(index));

    // Use the name from the first mapping (user can modify it)
    const searchName = teamMappings.length > 0 && teamMappings[0].federation_team_name 
      ? teamMappings[0].federation_team_name 
      : selectedSocietyName;

    setImporting(true);
    try {
      const response = await api.post('/federation/import-selected', {
        matches: matchesToImport,
        society_name: searchName,
        team_mappings: teamMappings.filter(m => m.local_team_id)
      });
      setImportResult(response.data);
      setStep(4);
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante importazione');
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>1. Seleziona Federazione e Regione</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Federazione</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={federation}
            onValueChange={(value) => setFederation(value)}
            style={styles.picker}
          >
            <Picker.Item label="FIPAV - Pallavolo" value="fipav" />
            <Picker.Item label="FIP - Basket (non disponibile)" value="fip" />
          </Picker>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Regione</Text>
        {loadingRegions ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedRegion}
              onValueChange={(value) => setSelectedRegion(value)}
              style={styles.picker}
            >
              {regions.map(region => (
                <Picker.Item key={region.id} label={region.name} value={region.id} />
              ))}
            </Picker>
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Stagione Sportiva</Text>
        {loadingSeasons ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedSeason}
              onValueChange={(value) => setSelectedSeason(value)}
              style={styles.picker}
            >
              {seasons.map(season => (
                <Picker.Item key={season.id} label={season.name} value={season.id} />
              ))}
            </Picker>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, !selectedSeason && styles.buttonDisabled]}
        onPress={() => setStep(2)}
        disabled={!selectedSeason}
        data-testid="next-step-1-btn"
      >
        <Text style={styles.buttonText}>Avanti</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>2. Seleziona Società e Campionati</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>La tua Società sulla federazione</Text>
        {loadingSocieties ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedSociety}
              onValueChange={handleSocietySelect}
              style={styles.picker}
            >
              <Picker.Item label="-- Seleziona società --" value="" />
              {societies.map(society => (
                <Picker.Item key={society.id} label={society.name} value={society.id} />
              ))}
            </Picker>
          </View>
        )}
      </View>

      {selectedSociety && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Campionati (opzionale - filtra partite)</Text>
            {loadingChampionships ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <ScrollView style={styles.championshipList} nestedScrollEnabled>
                {championships.map(champ => (
                  <TouchableOpacity
                    key={champ.id}
                    style={[
                      styles.championshipItem,
                      selectedChampionships.includes(champ.id) && styles.championshipSelected
                    ]}
                    onPress={() => toggleChampionship(champ.id)}
                  >
                    <Text style={[
                      styles.championshipText,
                      selectedChampionships.includes(champ.id) && styles.championshipTextSelected
                    ]}>
                      {champ.name}
                    </Text>
                    {selectedChampionships.includes(champ.id) && (
                      <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Associa Squadre Locali</Text>
            <Text style={styles.hint}>
              Modifica il nome per trovare le partite (es. "PALLAVOLO PERUGIA" invece di "PALLAVOLO PERUGIA SSD a RL")
            </Text>
            
            {teamMappings.map((mapping, index) => (
              <View key={index} style={styles.mappingRow}>
                <TextInput
                  style={styles.mappingInput}
                  value={mapping.federation_team_name}
                  onChangeText={(text) => updateTeamMappingName(index, text)}
                  placeholder="Nome squadra federazione"
                />
                <Ionicons name="arrow-forward" size={16} color="#666" />
                <View style={[styles.pickerContainer, { flex: 1 }]}>
                  <Picker
                    selectedValue={mapping.local_team_id}
                    onValueChange={(value) => updateTeamMapping(index, value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="-- Seleziona --" value="" />
                    {localTeams.map(team => (
                      <Picker.Item key={team.id} label={team.name} value={team.id} />
                    ))}
                  </Picker>
                </View>
                <TouchableOpacity onPress={() => removeTeamMapping(index)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity style={styles.addMappingBtn} onPress={addTeamMapping}>
              <Ionicons name="add-circle" size={20} color="#007AFF" />
              <Text style={styles.addMappingText}>Aggiungi mapping</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => setStep(1)}>
          <Ionicons name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.buttonSecondaryText}>Indietro</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, (!selectedSociety || previewLoading) && styles.buttonDisabled]}
          onPress={loadPreview}
          disabled={!selectedSociety || previewLoading}
          data-testid="load-preview-btn"
        >
          {previewLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Anteprima</Text>
              <Ionicons name="eye" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Parse Italian date format (gg/mm/aaaa) to Date object
  const parseItalianDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    // Try gg/mm/aaaa format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      let year = parseInt(parts[2], 10);
      // Handle 2-digit year
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    // Fallback to standard Date parsing
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  // Filter matches by date
  const getFilteredMatches = () => {
    return previewMatches.filter(match => {
      const matchDate = new Date(match.date);
      if (dateFrom) {
        const from = parseItalianDate(dateFrom);
        if (from && matchDate < from) return false;
      }
      if (dateTo) {
        const to = parseItalianDate(dateTo);
        if (to) {
          to.setHours(23, 59, 59);
          if (matchDate > to) return false;
        }
      }
      return true;
    });
  };

  const filteredMatches = getFilteredMatches();

  const toggleMatchSelection = (index: number) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(filteredMatches.map((_, i) => i)));
    }
    setSelectAll(!selectAll);
  };

  // Initialize selection when matches load
  const initializeSelection = () => {
    setSelectedMatches(new Set(previewMatches.map((_, i) => i)));
    setSelectAll(true);
  };

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>3. Seleziona Partite da Importare</Text>
      
      <Text style={styles.previewCount}>
        Trovate {previewMatches.length} partite per "{selectedSocietyName}"
      </Text>

      {/* Date Filter */}
      <View style={styles.dateFilterContainer}>
        <Text style={styles.filterLabel}>Filtra per data:</Text>
        <View style={styles.dateInputRow}>
          <View style={styles.dateInputGroup}>
            <Text style={styles.dateInputLabel}>Da:</Text>
            <TextInput
              style={styles.dateInput}
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="gg/mm/aaaa"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.dateInputGroup}>
            <Text style={styles.dateInputLabel}>A:</Text>
            <TextInput
              style={styles.dateInput}
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="gg/mm/aaaa"
              placeholderTextColor="#999"
            />
          </View>
        </View>
        <Text style={styles.filterInfo}>
          Mostrate {filteredMatches.length} di {previewMatches.length} partite
        </Text>
      </View>

      {/* Select All */}
      <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
        <Ionicons 
          name={selectAll ? "checkbox" : "square-outline"} 
          size={24} 
          color="#007AFF" 
        />
        <Text style={styles.selectAllText}>
          {selectAll ? "Deseleziona tutte" : "Seleziona tutte"}
        </Text>
        <Text style={styles.selectedCount}>
          ({selectedMatches.size} selezionate)
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.previewList} nestedScrollEnabled>
        {filteredMatches.map((match, index) => {
          const originalIndex = previewMatches.indexOf(match);
          const isSelected = selectedMatches.has(originalIndex);
          
          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.matchCard, isSelected && styles.matchCardSelected]}
              onPress={() => toggleMatchSelection(originalIndex)}
            >
              <View style={styles.matchSelectRow}>
                <Ionicons 
                  name={isSelected ? "checkbox" : "square-outline"} 
                  size={22} 
                  color={isSelected ? "#34C759" : "#ccc"} 
                />
                <View style={styles.matchContent}>
                  <View style={styles.matchHeader}>
                    <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
                    {match.championship && (
                      <Text style={styles.matchChamp}>{match.championship}</Text>
                    )}
                  </View>
                  <View style={styles.matchTeams}>
                    <Text style={[
                      styles.matchTeam,
                      match.home_team.toLowerCase().includes(selectedSocietyName.toLowerCase().split(' ')[0]) && styles.matchTeamHighlight
                    ]}>
                      {match.home_team}
                    </Text>
                    <Text style={styles.matchVs}>vs</Text>
                    <Text style={[
                      styles.matchTeam,
                      match.away_team.toLowerCase().includes(selectedSocietyName.toLowerCase().split(' ')[0]) && styles.matchTeamHighlight
                    ]}>
                      {match.away_team}
                    </Text>
                  </View>
                  {match.result && match.result !== '-' && (
                    <Text style={styles.matchResult}>Risultato: {match.result}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => setStep(2)}>
          <Ionicons name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.buttonSecondaryText}>Indietro</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.buttonSuccess, (importing || selectedMatches.size === 0) && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={importing || selectedMatches.size === 0}
          data-testid="import-btn"
        >
          {importing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-download" size={20} color="#fff" />
              <Text style={styles.buttonText}>Importa {selectedMatches.size} Partite</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#34C759" />
        <Text style={styles.successTitle}>Importazione Completata!</Text>
        
        {importResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>
              Partite importate: <Text style={styles.resultNumber}>{importResult.imported}</Text>
            </Text>
            <Text style={styles.resultText}>
              Partite saltate: <Text style={styles.resultNumber}>{importResult.skipped}</Text>
            </Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => {
              setStep(1);
              setPreviewMatches([]);
              setImportResult(null);
            }}
          >
            <Ionicons name="refresh" size={20} color="#007AFF" />
            <Text style={styles.buttonSecondaryText}>Nuova Importazione</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/admin/matches')}
          >
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text style={styles.buttonText}>Vai alle Partite</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Importa Calendario Federazione</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map(s => (
          <View
            key={s}
            style={[
              styles.progressStep,
              s <= step && styles.progressStepActive,
              s < step && styles.progressStepComplete
            ]}
          >
            {s < step ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={[styles.progressNumber, s <= step && styles.progressNumberActive]}>
                {s}
              </Text>
            )}
          </View>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>
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
  backBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 18,
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 30,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: '#007AFF',
  },
  progressStepComplete: {
    backgroundColor: '#34C759',
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  progressNumberActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  championshipList: {
    maxHeight: 350,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  championshipItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  championshipSelected: {
    backgroundColor: '#E3F2FD',
  },
  championshipText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  championshipTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  mappingInput: {
    flex: 1,
    minWidth: 120,
    maxWidth: 180,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#333',
  },
  mappingLabel: {
    fontSize: 12,
    color: '#666',
    width: 100,
  },
  addMappingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  addMappingText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  buttonSuccess: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    flex: 1,
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  previewCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  previewList: {
    maxHeight: 400,
  },
  matchCard: {
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
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  matchChamp: {
    fontSize: 12,
    color: '#666',
    maxWidth: '50%',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchTeam: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  matchTeamHighlight: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  matchVs: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 8,
  },
  matchResult: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 8,
    fontWeight: '500',
  },
  matchCardSelected: {
    borderWidth: 2,
    borderColor: '#34C759',
    backgroundColor: '#f0fff4',
  },
  matchSelectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  matchContent: {
    flex: 1,
  },
  dateFilterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  filterInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 10,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  selectedCount: {
    fontSize: 12,
    color: '#666',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 20,
    marginBottom: 30,
  },
  resultBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 30,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  resultNumber: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
});
