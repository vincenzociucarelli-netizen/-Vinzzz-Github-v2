import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import QuietanzeArchive from '../../src/components/admin/QuietanzeArchive';
import DeclarationsArchive from '../../src/components/admin/DeclarationsArchive';

const MONTH_NAMES = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'coach': return '🏐 Coach';
    case 'dirigente': return '🏅 Dirigente';
    case 'collaboratore': return '👤 Collaboratore';
    case 'athlete': return '🏆 Atleta Pro';
    default: return role;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'coach': return '#2196F3';
    case 'dirigente': return '#8E44AD';
    case 'collaboratore': return '#FF9800';
    case 'athlete': return '#C9A227';
    default: return '#666';
  }
};

export default function QuietanzePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'report' | 'gestione' | 'dichiarazioni'>('gestione');
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, custom_pending: 0, custom_signed: 0 });
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'signed'>('all');
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Wipe user compensation data
  const [wipeModalVisible, setWipeModalVisible] = useState(false);
  const [wipeEmail, setWipeEmail] = useState('');
  const [wipeYear, setWipeYear] = useState('');  // vuoto = tutti gli anni
  const [wiping, setWiping] = useState(false);

  const handleWipeUser = async () => {
    const email = wipeEmail.trim().toLowerCase();
    if (!email) {
      Alert.alert('Errore', 'Inserisci l\'email dell\'utente');
      return;
    }
    const yearInt = wipeYear.trim() ? parseInt(wipeYear.trim(), 10) : null;
    if (wipeYear.trim() && (isNaN(yearInt as number) || (yearInt as number) < 2020 || (yearInt as number) > 2100)) {
      Alert.alert('Errore', 'Anno non valido (lascia vuoto per cancellare tutti gli anni)');
      return;
    }
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Conferma cancellazione',
        yearInt
          ? `Sto per cancellare DEFINITIVAMENTE tutte le quietanze, comunicazioni soglia e dichiarazioni di ${email} per l'anno ${yearInt}. Procedere?`
          : `Sto per cancellare DEFINITIVAMENTE tutte le quietanze, comunicazioni soglia e dichiarazioni di ${email} (TUTTI gli anni). Procedere?`,
        [
          { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Sì, cancella', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!proceed) return;
    try {
      setWiping(true);
      const body: any = { email, confirm: 'YES_DELETE_ALL' };
      if (yearInt) body.year = yearInt;
      const res = await api.post('/admin/wipe-user-compensation-data', body);
      const d = res.data?.deleted || {};
      Alert.alert(
        'Pulizia completata',
        `Utente: ${email}${yearInt ? `\nAnno: ${yearInt}` : '\nTutti gli anni'}\n\n` +
        `Compensations: ${(d.coach_compensations || 0) + (d.collaboratore_compensations || 0) + (d.dirigente_compensations || 0) + (d.atleta_pro_compensations || 0) + (d.compensations || 0)}\n` +
        `Documenti firmati: ${d.signed_documents || 0}\n` +
        `File PDF su disco: ${d.files_removed || 0}\n` +
        `Dichiarazioni soglia: ${d.threshold_declarations || 0}\n` +
        `Compensi esterni: ${d.external_compensations || 0}\n` +
        `yearly_limits reset: ${d.yearly_limits_reset || 0}`
      );
      setWipeModalVisible(false);
      setWipeEmail('');
      setWipeYear('');
      if (activeTab === 'gestione') loadReceipts();
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Errore durante la pulizia');
    } finally {
      setWiping(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'gestione') {
      loadReceipts();
    }
  }, [activeTab]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/quietanze/all');
      setReceipts(response.data.receipts || []);
      setStats({
        total: response.data.total || 0,
        pending: response.data.pending || 0,
        custom_pending: response.data.custom_pending || 0,
        custom_signed: response.data.custom_signed || 0
      });
    } catch (error) {
      console.error('Error loading receipts:', error);
      Alert.alert('Errore', 'Impossibile caricare le quietanze');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (receipt: any) => {
    // 🆕 28/06/2026 — route mapping role → endpoint path (athlete usa "athletes" plurale)
    const rolePath = receipt.user_role === 'athlete' ? 'athletes' : receipt.user_role;
    const endpoint = `/admin/${rolePath}/${receipt.user_id}/compensation/${receipt.year}/${receipt.month}`;
    const msg = `Eliminare la quietanza di ${receipt.user_name} per ${MONTH_NAMES[receipt.month]} ${receipt.year}?`;
    
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      try {
        await api.delete(endpoint);
        alert('Quietanza eliminata con successo');
        loadReceipts();
      } catch (error: any) {
        alert(error.response?.data?.detail || 'Impossibile eliminare');
      }
    } else {
      Alert.alert('Elimina Quietanza', msg, [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(endpoint);
              Alert.alert('Eliminata', 'Quietanza eliminata con successo');
              loadReceipts();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Impossibile eliminare');
            }
          }
        }
      ]);
    }
  };

  const handleEdit = (receipt: any) => {
    setSelectedReceipt(receipt);
    setEditAmount(String(receipt.amount_gross || ''));
    setEditModalVisible(true);
  };
  
  const handleSaveEdit = async () => {
    if (!selectedReceipt || !editAmount) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido');
      return;
    }
    
    try {
      setSaving(true);
      // 🆕 28/06/2026 — route mapping role → endpoint path (athlete usa "athletes" plurale)
      const rolePath = selectedReceipt.user_role === 'athlete' ? 'athletes' : selectedReceipt.user_role;
      // Use the create-receipt endpoint which updates if exists
      await api.post(`/admin/${rolePath}/${selectedReceipt.user_id}/compensation/create-receipt`, {
        month: selectedReceipt.month,
        year: selectedReceipt.year,
        amount_gross: amount
      });
      Alert.alert('Salvato', 'Quietanza aggiornata con successo');
      setEditModalVisible(false);
      loadReceipts();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare');
    } finally {
      setSaving(false);
    }
  };

  // 🆕 FASE 1 — Bonifico + sollecito firma WhatsApp
  const normalizePhone = (raw: string): string => {
    let p = (raw || '').replace(/\D/g, '');
    if (!p) return '';
    if (p.startsWith('00')) p = p.substring(2);
    if (p.startsWith('39')) return p;
    p = p.replace(/^0+/, '');
    return `39${p}`;
  };

  const markPayment = async (receipt: any, paid: boolean) => {
    try {
      await api.post('/admin/quietanze/mark-payment', {
        user_role: receipt.user_role, user_id: receipt.user_id,
        year: receipt.year, month: receipt.month, paid,
      });
      loadReceipts();
    } catch (e: any) {
      const m = e.response?.data?.detail || 'Operazione non riuscita';
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Errore', m);
    }
  };

  const remindWhatsApp = (receipt: any) => {
    const norm = normalizePhone(receipt.phone);
    if (!norm) {
      const m = 'Numero di telefono non presente nella scheda di questo utente.';
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Nessun numero', m);
      return;
    }
    const msg = `Ciao ${receipt.user_name}, è stato effettuato il bonifico del compenso di ${MONTH_NAMES[receipt.month]} ${receipt.year}. Ti chiediamo di firmare al più presto la quietanza nell'app RegistraTEAM. Grazie!`;
    const url = `https://wa.me/${norm}?text=${encodeURIComponent(msg)}`;
    if (Platform.OS === 'web') window.open(url, '_blank'); else Linking.openURL(url);
  };

  const [bulkModal, setBulkModal] = useState(false);
  const [bulkYear, setBulkYear] = useState(String(new Date().getFullYear()));
  const [bulkMonth, setBulkMonth] = useState(String(new Date().getMonth() + 1));
  const [bulkBusy, setBulkBusy] = useState(false);

  const runBulkPayment = async () => {
    const y = parseInt(bulkYear, 10); const m = parseInt(bulkMonth, 10);
    if (!y || !m || m < 1 || m > 12) { Alert.alert('Errore', 'Mese/anno non validi'); return; }
    try {
      setBulkBusy(true);
      const res = await api.post('/admin/quietanze/mark-payment-bulk', { year: y, month: m, user_role: filterRole || undefined });
      const n = res.data?.updated ?? 0;
      const msg = `Bonifici segnati: ${n} quietanze di ${MONTH_NAMES[m]} ${y}${filterRole ? ` (${getRoleLabel(filterRole)})` : ''}.`;
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Fatto', msg);
      setBulkModal(false);
      loadReceipts();
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Operazione non riuscita');
    } finally { setBulkBusy(false); }
  };

  const renderReceiptActions = (receipt: any) => {
    if (receipt.receipt_signed) return null;
    return (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actBtn, receipt.payment_made ? styles.actBtnDone : styles.actBtnPay]}
          onPress={() => markPayment(receipt, !receipt.payment_made)}
        >
          <Ionicons name={receipt.payment_made ? 'checkmark-circle' : 'cash-outline'} size={15} color={receipt.payment_made ? '#2E7D32' : '#fff'} />
          <Text style={[styles.actBtnText, { color: receipt.payment_made ? '#2E7D32' : '#fff' }]}>
            {receipt.payment_made ? 'Bonifico fatto' : 'Segna bonifico'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actBtn, styles.actBtnWa]} onPress={() => remindWhatsApp(receipt)}>
          <Ionicons name="logo-whatsapp" size={15} color="#fff" />
          <Text style={[styles.actBtnText, { color: '#fff' }]}>Sollecita firma</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const filteredReceipts = receipts.filter(r => {
    if (filterRole && r.user_role !== filterRole) return false;
    if (filterStatus === 'pending' && r.receipt_signed) return false;
    if (filterStatus === 'signed' && !r.receipt_signed) return false;
    return true;
  });

  // Separate custom from standard
  const customReceipts = filteredReceipts.filter(r => r.is_custom);
  const pendingCustom = customReceipts.filter(r => !r.receipt_signed);
  const signedCustom = customReceipts.filter(r => r.receipt_signed);
  // 🆕 Quietanze standard (importo = compenso mensile): prima non venivano mostrate
  // nel riepilogo (es. collaboratore con Set 2026 firmata), ora elencate in sezioni dedicate.
  const standardReceipts = filteredReceipts.filter(r => !r.is_custom);
  const pendingStandard = standardReceipts.filter(r => !r.receipt_signed);
  const signedStandard = standardReceipts.filter(r => r.receipt_signed);
  const signedTotal = filteredReceipts.filter(r => r.receipt_signed).length;
  const pendingTotal = filteredReceipts.length - signedTotal;

  const renderStandardCard = (receipt: any, index: number, signed: boolean) => (
    <View
      key={`std-${signed ? 's' : 'p'}-${index}`}
      style={[styles.receiptCard, styles.standardCard, signed ? styles.receiptSigned : styles.receiptPending]}
      data-testid={`standard-receipt-${receipt.user_role}-${receipt.year}-${receipt.month}`}
    >
      <View style={styles.receiptHeader}>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(receipt.user_role) + '20' }]}>
          <Text style={[styles.roleBadgeText, { color: getRoleColor(receipt.user_role) }]}>
            {getRoleLabel(receipt.user_role)}
          </Text>
        </View>
        <Text style={styles.receiptDate}>{MONTH_NAMES[receipt.month]} {receipt.year}</Text>
      </View>
      <View style={styles.standardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.receiptName}>{receipt.user_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name={signed ? 'checkmark-circle' : 'time-outline'} size={13} color={signed ? '#4CAF50' : '#FF9800'} />
            <Text style={{ fontSize: 12, color: signed ? '#4CAF50' : '#FF9800', fontWeight: '600' }}>
              {signed ? 'Firmata' : 'In attesa di firma'}
            </Text>
          </View>
        </View>
        <Text style={[styles.amountValue, { color: signed ? '#2E7D32' : '#333' }]}>{formatCurrency(receipt.amount_gross)}</Text>
        <TouchableOpacity style={styles.iconDeleteBtn} onPress={() => handleDelete(receipt)} data-testid="standard-receipt-delete">
          <Ionicons name="trash-outline" size={18} color="#D32F2F" />
        </TouchableOpacity>
      </View>
      {renderReceiptActions(receipt)}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📋 Quietanze</Text>
        <TouchableOpacity
          onPress={() => router.push('/admin/commercialista')}
          data-testid="header-commercialista-btn"
          style={{ padding: 8 }}
        >
          <Ionicons name="briefcase-outline" size={22} color="#5856D6" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setWipeModalVisible(true)}
          data-testid="header-wipe-user-btn"
          style={{ padding: 8 }}
        >
          <Ionicons name="trash-bin" size={22} color="#D32F2F" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gestione' && styles.tabActive]}
          onPress={() => setActiveTab('gestione')}
        >
          <Text style={[styles.tabText, activeTab === 'gestione' && styles.tabTextActive]}>
            Gestione Quietanze
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.tabActive]}
          onPress={() => setActiveTab('report')}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
            Archivio Firmate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dichiarazioni' && styles.tabActive]}
          onPress={() => setActiveTab('dichiarazioni')}
          testID="tab-dichiarazioni"
        >
          <Text style={[styles.tabText, activeTab === 'dichiarazioni' && styles.tabTextActive]}>
            Dichiarazioni
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'gestione' ? (
        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8E44AD" />
              <Text style={styles.loadingText}>Caricamento quietanze...</Text>
            </View>
          ) : (
            <>
              {/* Stats Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.statNumber, { color: '#E65100' }]}>{pendingTotal}</Text>
                  <Text style={styles.statLabel}>In attesa{stats.custom_pending ? ` (${stats.custom_pending} custom)` : ''}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{signedTotal}</Text>
                  <Text style={styles.statLabel}>Firmate{stats.custom_signed ? ` (${stats.custom_signed} custom)` : ''}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.statNumber, { color: '#1565C0' }]}>{filteredReceipts.length}</Text>
                  <Text style={styles.statLabel}>Totale</Text>
                </View>
              </View>

              {/* Filters */}
              <View style={styles.filtersRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.filterChip, !filterRole && styles.filterChipActive]}
                    onPress={() => setFilterRole(null)}
                  >
                    <Text style={[styles.filterChipText, !filterRole && styles.filterChipTextActive]}>Tutti</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'coach' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'coach' ? null : 'coach')}
                  >
                    <Text style={[styles.filterChipText, filterRole === 'coach' && styles.filterChipTextActive]}>🏐 Coach</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'dirigente' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'dirigente' ? null : 'dirigente')}
                  >
                    <Text style={[styles.filterChipText, filterRole === 'dirigente' && styles.filterChipTextActive]}>🏅 Dirigenti</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'collaboratore' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'collaboratore' ? null : 'collaboratore')}
                  >
                    <Text style={[styles.filterChipText, filterRole === 'collaboratore' && styles.filterChipTextActive]}>👤 Collaboratori</Text>
                  </TouchableOpacity>
                  {/* 🆕 28/06/2026 — Filtro Atleta Pro (compensated) */}
                  <TouchableOpacity
                    style={[styles.filterChip, filterRole === 'athlete' && styles.filterChipActive]}
                    onPress={() => setFilterRole(filterRole === 'athlete' ? null : 'athlete')}
                    data-testid="filter-chip-athlete"
                  >
                    <Text style={[styles.filterChipText, filterRole === 'athlete' && styles.filterChipTextActive]}>🏆 Atleti Pro</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* 🆕 Bonifici in blocco per mese */}
              <TouchableOpacity style={styles.bulkBtn} onPress={() => setBulkModal(true)} data-testid="bulk-payment-btn">
                <Ionicons name="cash-outline" size={18} color="#fff" />
                <Text style={styles.bulkBtnText}>Segna bonifici del mese</Text>
              </TouchableOpacity>

              {/* Pending Custom Receipts */}
              {pendingCustom.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⏳ Quietanze Personalizzate in Attesa ({pendingCustom.length})</Text>
                  {pendingCustom.map((receipt, index) => (
                    <View key={`pending-${index}`} style={[styles.receiptCard, styles.receiptPending]}>
                      <View style={styles.receiptHeader}>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(receipt.user_role) + '20' }]}>
                          <Text style={[styles.roleBadgeText, { color: getRoleColor(receipt.user_role) }]}>
                            {getRoleLabel(receipt.user_role)}
                          </Text>
                        </View>
                        <Text style={styles.receiptDate}>{MONTH_NAMES[receipt.month]} {receipt.year}</Text>
                      </View>
                      <Text style={styles.receiptName}>{receipt.user_name}</Text>
                      {receipt.created_by_name && (
                        <Text style={styles.createdByText}>Creata da: {receipt.created_by_name}</Text>
                      )}
                      <View style={styles.receiptAmounts}>
                        <View>
                          <Text style={styles.amountLabel}>Importo custom</Text>
                          <Text style={styles.amountValue}>{formatCurrency(receipt.amount_gross)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Standard</Text>
                          <Text style={styles.amountStandard}>{formatCurrency(receipt.standard_amount)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Differenza</Text>
                          <Text style={[styles.amountDiff, { color: receipt.amount_gross > receipt.standard_amount ? '#4CAF50' : '#F44336' }]}>
                            {receipt.amount_gross > receipt.standard_amount ? '+' : ''}{formatCurrency(receipt.amount_gross - receipt.standard_amount)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.receiptActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(receipt)}>
                          <Ionicons name="pencil" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Modifica</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(receipt)}>
                          <Ionicons name="trash" size={16} color="#fff" />
                          <Text style={styles.actionBtnText}>Elimina</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                        <Ionicons name="time-outline" size={14} color="#FF9800" />
                        <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '600' }}>{receipt.payment_made ? 'Bonifico fatto — in attesa di firma' : 'In attesa di firma'}</Text>
                      </View>
                      {renderReceiptActions(receipt)}
                    </View>
                  ))}
                </View>
              )}

              {/* Signed Custom Receipts */}
              {signedCustom.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>✅ Quietanze Personalizzate Firmate ({signedCustom.length})</Text>
                  {signedCustom.map((receipt, index) => (
                    <View key={`signed-${index}`} style={[styles.receiptCard, styles.receiptSigned]}>
                      <View style={styles.receiptHeader}>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(receipt.user_role) + '20' }]}>
                          <Text style={[styles.roleBadgeText, { color: getRoleColor(receipt.user_role) }]}>
                            {getRoleLabel(receipt.user_role)}
                          </Text>
                        </View>
                        <Text style={styles.receiptDate}>{MONTH_NAMES[receipt.month]} {receipt.year}</Text>
                      </View>
                      <Text style={styles.receiptName}>{receipt.user_name}</Text>
                      {receipt.created_by_name && (
                        <Text style={styles.createdByText}>Creata da: {receipt.created_by_name}</Text>
                      )}
                      <View style={styles.receiptAmounts}>
                        <View>
                          <Text style={styles.amountLabel}>Importo pagato</Text>
                          <Text style={styles.amountValue}>{formatCurrency(receipt.amount_gross)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Standard</Text>
                          <Text style={styles.amountStandard}>{formatCurrency(receipt.standard_amount)}</Text>
                        </View>
                        <View>
                          <Text style={styles.amountLabel}>Differenza</Text>
                          <Text style={[styles.amountDiff, { color: receipt.amount_gross > receipt.standard_amount ? '#4CAF50' : '#F44336' }]}>
                            {receipt.amount_gross > receipt.standard_amount ? '+' : ''}{formatCurrency(receipt.amount_gross - receipt.standard_amount)}
                          </Text>
                        </View>
                      </View>
                      {(receipt.exceeded_5000 || receipt.exceeded_15000) && (
                        <View style={styles.thresholdBadges}>
                          {receipt.exceeded_5000 && (
                            <View style={[styles.thresholdBadge, { backgroundColor: '#FF980020' }]}>
                              <Text style={{ color: '#E65100', fontSize: 11 }}>Superato €5k</Text>
                            </View>
                          )}
                          {receipt.exceeded_15000 && (
                            <View style={[styles.thresholdBadge, { backgroundColor: '#9C27B020' }]}>
                              <Text style={{ color: '#7B1FA2', fontSize: 11 }}>Superato €15k</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: '600' }}>Firmata dal coach</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 🆕 Quietanze standard (coach, dirigenti, collaboratori, atleti pro) */}
              {signedStandard.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>✅ Quietanze Standard Firmate ({signedStandard.length})</Text>
                  {signedStandard.map((r, i) => renderStandardCard(r, i, true))}
                </View>
              )}
              {pendingStandard.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⏳ Quietanze Standard in Attesa ({pendingStandard.length})</Text>
                  {pendingStandard.map((r, i) => renderStandardCard(r, i, false))}
                </View>
              )}

              {filteredReceipts.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>Nessuna quietanza</Text>
                  <Text style={styles.emptyStateSubtext}>Le quietanze mensili di coach, dirigenti, collaboratori e atleti pro appariranno qui</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : activeTab === 'dichiarazioni' ? (
        // 🆕 Archivio di tutte le dichiarazioni firmate (pregresso, previdenza, soglie) per il commercialista
        <DeclarationsArchive />
      ) : (
        // 🆕 Archivio di tutte le quietanze firmate, mese per mese (PDF singolo + ZIP)
        <QuietanzeArchive />
      )}
      
      {/* 🆕 Bonifici in blocco Modal */}
      <Modal visible={bulkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>💸 Bonifici in blocco</Text>
              <TouchableOpacity onPress={() => setBulkModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Segna il bonifico per TUTTE le quietanze non ancora firmate del mese scelto{filterRole ? ` (solo ${getRoleLabel(filterRole)})` : ''}. I destinatari vedranno l{'\u2019'}avviso di firma.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editModalLabel}>Mese (1-12)</Text>
                <TextInput style={styles.editInput} value={bulkMonth} onChangeText={setBulkMonth} keyboardType="numeric" placeholder="Es: 10" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.editModalLabel}>Anno</Text>
                <TextInput style={styles.editInput} value={bulkYear} onChangeText={setBulkYear} keyboardType="numeric" placeholder="Es: 2026" />
              </View>
            </View>
            <View style={styles.editModalActions}>
              <TouchableOpacity style={[styles.editModalBtn, styles.editModalCancelBtn]} onPress={() => setBulkModal(false)}>
                <Text style={styles.editModalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editModalBtn, styles.editModalSaveBtn, bulkBusy && { opacity: 0.5 }]} onPress={runBulkPayment} disabled={bulkBusy}>
                {bulkBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editModalSaveText}>Segna bonifici</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>✏️ Modifica Quietanza</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedReceipt && (
              <>
                <View style={styles.editModalInfo}>
                  <Text style={styles.editModalLabel}>Utente</Text>
                  <Text style={styles.editModalValue}>{selectedReceipt.user_name}</Text>
                  
                  <Text style={styles.editModalLabel}>Periodo</Text>
                  <Text style={styles.editModalValue}>{MONTH_NAMES[selectedReceipt.month]} {selectedReceipt.year}</Text>
                  
                  <Text style={styles.editModalLabel}>Importo standard</Text>
                  <Text style={styles.editModalValue}>{formatCurrency(selectedReceipt.standard_amount)}</Text>
                </View>
                
                <View style={styles.editInputContainer}>
                  <Text style={styles.editModalLabel}>Nuovo importo (€)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="numeric"
                    placeholder="Es: 5000"
                  />
                </View>
                
                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    style={[styles.editModalBtn, styles.editModalCancelBtn]}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.editModalCancelText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editModalBtn, styles.editModalSaveBtn, saving && { opacity: 0.5 }]}
                    onPress={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.editModalSaveText}>Salva</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Wipe User Data Modal */}
      <Modal
        visible={wipeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWipeModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="warning" size={26} color="#D32F2F" />
              <Text style={{ fontSize: 18, fontWeight: '700', marginLeft: 10, color: '#D32F2F' }}>
                Pulizia totale dati compensi
              </Text>
            </View>
            <Text style={{ color: '#444', marginBottom: 14, lineHeight: 20 }}>
              Cancella in modo DEFINITIVO tutte le quietanze, comunicazioni soglia, dichiarazioni soglia
              e file PDF di un utente. Da usare per ripartire da zero in caso di test/bug.
              {'\n\n'}
              <Text style={{ fontWeight: '700', color: '#D32F2F' }}>Operazione irreversibile.</Text>
            </Text>
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Email utente</Text>
            <TextInput
              value={wipeEmail}
              onChangeText={setWipeEmail}
              placeholder="es. lella@test.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              data-testid="wipe-email-input"
              style={{
                borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                backgroundColor: '#fafafa', marginBottom: 12,
              }}
            />
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Anno (opzionale)</Text>
            <TextInput
              value={wipeYear}
              onChangeText={setWipeYear}
              placeholder="es. 2026 — vuoto = tutti gli anni"
              keyboardType="number-pad"
              maxLength={4}
              data-testid="wipe-year-input"
              style={{
                borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                backgroundColor: '#fafafa', marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setWipeModalVisible(false); setWipeEmail(''); setWipeYear(''); }}
                disabled={wiping}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e0e0e0' }}
              >
                <Text style={{ color: '#333', fontWeight: '600' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleWipeUser}
                disabled={wiping}
                data-testid="wipe-confirm-btn"
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#D32F2F', opacity: wiping ? 0.6 : 1 }}
              >
                {wiping ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Cancella TUTTO</Text>
                )}
              </TouchableOpacity>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#8E44AD',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  filtersRow: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#8E44AD',
    borderColor: '#8E44AD',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  receiptPending: {
    borderLeftColor: '#FF9800',
  },
  receiptSigned: {
    borderLeftColor: '#4CAF50',
  },
  standardCard: {
    padding: 12,
  },
  standardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  iconDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  receiptDate: {
    fontSize: 13,
    color: '#666',
  },
  receiptName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  createdByText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  receiptAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  amountStandard: {
    fontSize: 14,
    color: '#666',
  },
  amountDiff: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  actBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  actBtnPay: { backgroundColor: '#FB8C00' },
  actBtnDone: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' },
  actBtnWa: { backgroundColor: '#25D366' },
  actBtnText: { fontSize: 13, fontWeight: '700' },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FB8C00',
    paddingVertical: 11,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bulkBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 13,
  },
  thresholdBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  thresholdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editModalInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  editModalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  editModalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  editInputContainer: {
    marginBottom: 20,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 6,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editModalCancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  editModalSaveBtn: {
    backgroundColor: '#8E44AD',
  },
  editModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  editModalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
