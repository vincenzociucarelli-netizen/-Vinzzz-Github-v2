import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import InstitutionalBanner from '../../../src/components/InstitutionalBanner';
import api from '../../../src/services/api';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { SportIcon, clearSportIconCache } from '../../../src/components/SportIcon';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function SocietySettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Logo e immagini
  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(50);
  const [sportImage, setSportImage] = useState<string | null>(null);
  const [stampSignature, setStampSignature] = useState<string | null>(null);

  // Dati società
  const [societyName, setSocietyName] = useState('');
  const [ragioneSociale, setRagioneSociale] = useState('');
  const [sportPraticato, setSportPraticato] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [societyEmail, setSocietyEmail] = useState('');
  const [societyPec, setSocietyPec] = useState('');
  const [blockExpiredCertificates, setBlockExpiredCertificates] = useState(true);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideKeepDisabled, setOverrideKeepDisabled] = useState(false);
  const [overrideAutoReactivateAt, setOverrideAutoReactivateAt] = useState<string | null>(null);
  const [overrideKeepDisabledSaved, setOverrideKeepDisabledSaved] = useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [primaryAdminName, setPrimaryAdminName] = useState<string | null>(null);
  const [primaryDeclarationSigned, setPrimaryDeclarationSigned] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/primary-admin/status');
        setIsPrimaryAdmin(!!res.data?.is_current_user_primary);
        setPrimaryAdminName(res.data?.primary_admin_name || null);
        setPrimaryDeclarationSigned(!!res.data?.declaration_signed);
      } catch {
        // ignore
      }
    })();
  }, []);

  const formatReactivateLabel = (iso: string | null): string | null => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  // Called when Admin confirms the disable action in the modal
  const submitDisableBlock = async () => {
    const reason = overrideReason.trim();
    if (reason.length < 5) {
      showAlert('Errore', 'Inserisci il motivo della disattivazione (minimo 5 caratteri).');
      return;
    }
    setOverrideSubmitting(true);
    try {
      await api.patch('/settings/society', {
        block_expired_certificates: false,
        override_keep_disabled: overrideKeepDisabled,
        override_deactivation_reason: reason,
      });
      setShowOverrideModal(false);
      setOverrideReason('');
      await loadSettings();
      showAlert(
        overrideKeepDisabled ? '⚠️ Blocco disattivato a tempo indeterminato' : '⚠️ Blocco disattivato fino a mezzanotte',
        overrideKeepDisabled
          ? 'Il blocco resterà disattivato finché non lo riattivi manualmente. Ogni accesso Admin mostrerà un promemoria giornaliero.'
          : 'Alle ore 00:00 (ora italiana) il blocco verrà riattivato automaticamente.'
      );
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile salvare';
      showAlert('Errore', msg);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // Re-enable immediately (no modal, no reason)
  const reenableBlock = async () => {
    try {
      await api.patch('/settings/society', { block_expired_certificates: true });
      await loadSettings();
      showAlert('✅ Blocco riattivato', 'Il blocco certificati è ora attivo.');
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile riattivare';
      showAlert('Errore', msg);
    }
  };

  // Stagione sportiva
  const [seasonStartMonth, setSeasonStartMonth] = useState(7);
  const [seasonStartDay, setSeasonStartDay] = useState(1);
  const [seasonEndMonth, setSeasonEndMonth] = useState(6);
  const [seasonEndDay, setSeasonEndDay] = useState(30);

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    try {
      const authResponse = await api.get('/auth/me');
      if (authResponse.data?.role !== 'admin') {
        setIsAdmin(false);
        router.replace('/');
        return;
      }
      setIsAdmin(true);
      await loadSettings();
    } catch (error) {
      setIsAdmin(false);
      router.replace('/');
    }
  };

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/society?include_images=true');
      setSocietyName(response.data.name || '');
      setLogo(response.data.logo || null);
      setLogoSize(response.data.logo_size || 50);
      setSportImage(response.data.sport_image || null);
      setRagioneSociale(response.data.ragione_sociale || '');
      setSportPraticato(response.data.sport_praticato || '');
      setAddress(response.data.address || '');
      setPostalCode(response.data.postal_code || '');
      setCity(response.data.city || '');
      setProvince(response.data.province || '');
      setFiscalCode(response.data.fiscal_code || '');
      setPhone(response.data.phone || '');
      setPhone2(response.data.phone2 || '');
      setPresidentName(response.data.president_name || '');
      setStampSignature(response.data.stamp_signature || null);
      setSocietyEmail(response.data.email || '');
      setSocietyPec(response.data.pec || '');
      setBlockExpiredCertificates(response.data.block_expired_certificates !== false);
      setOverrideAutoReactivateAt(response.data.override_auto_reactivate_at || null);
      setOverrideKeepDisabledSaved(Boolean(response.data.override_keep_disabled));
      setSeasonStartMonth(response.data.season_start_month || 7);
      setSeasonStartDay(response.data.season_start_day || 1);
      setSeasonEndMonth(response.data.season_end_month || 6);
      setSeasonEndDay(response.data.season_end_day || 30);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/society', {
        name: societyName,
        logo: logo,
        logo_size: logoSize,
        sport_image: sportImage,
        ragione_sociale: ragioneSociale,
        sport_praticato: sportPraticato,
        address: address,
        postal_code: postalCode,
        city: city,
        province: province,
        fiscal_code: fiscalCode,
        phone: phone,
        phone2: phone2,
        president_name: presidentName,
        stamp_signature: stampSignature,
        email: societyEmail,
        pec: societyPec,
        season_start_month: seasonStartMonth,
        season_start_day: seasonStartDay,
        season_end_month: seasonEndMonth,
        season_end_day: seasonEndDay,
      });
      // Clear the sport icon cache so all components reload the new image
      clearSportIconCache();
      showAlert('Successo', 'Dati società salvati con successo');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLogo(result.assets[0].base64);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleSelectSportImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSportImage(result.assets[0].base64);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const handleSelectStampSignature = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setStampSignature(result.assets[0].base64);
      }
    } catch (error) {
      showAlert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#1565C0' }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dati Società</Text>
        <View style={{ width: 40 }} />
      </View>

      <InstitutionalBanner />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Certificato Medico */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏥 Certificato Medico</Text>
          <Text style={styles.sectionDesc}>
            Gestione scadenza certificati medici atleti
          </Text>
          
          <View>
          <Pressable 
            onPress={() => {
              if (blockExpiredCertificates) {
                setOverrideReason('');
                setOverrideKeepDisabled(false);
                setShowOverrideModal(true);
              } else {
                reenableBlock();
              }
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 10,
              backgroundColor: blockExpiredCertificates ? '#E8F5E9' : '#FFF3E0',
              borderWidth: 1,
              borderColor: blockExpiredCertificates ? '#66BB6A' : '#FFB74D',
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }} pointerEvents="none">
              <Text style={{ fontSize: 14, fontWeight: '700', color: blockExpiredCertificates ? '#2E7D32' : '#E65100', marginBottom: 4 }}>
                {blockExpiredCertificates ? 'Blocco automatico ATTIVO' : 'Blocco automatico DISATTIVO'}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>
                {blockExpiredCertificates 
                  ? 'La scansione QR blocca gli atleti con certificato scaduto/non valido. Il Coach può richiedere override al singolo atleta.'
                  : overrideKeepDisabledSaved
                    ? '⚠️ Override attivo a tempo indeterminato (promemoria giornaliero all\'accesso Admin)'
                    : overrideAutoReactivateAt
                      ? `Riattivazione automatica: ${formatReactivateLabel(overrideAutoReactivateAt) || 'a mezzanotte'}`
                      : 'Gli atleti con certificato scaduto possono entrare'}
              </Text>
            </View>
            <View pointerEvents="none" style={[{
              width: 50, height: 28, borderRadius: 14, padding: 2,
              backgroundColor: blockExpiredCertificates ? '#66BB6A' : '#ccc',
              justifyContent: 'center',
            }]}>
              <View style={[{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: '#fff',
                alignSelf: blockExpiredCertificates ? 'flex-end' : 'flex-start',
              }]} />
            </View>
          </Pressable>
          </View>
          
          {/* Pulsante esplicito di disattivazione (visibile solo quando blocco è ATTIVO).
              Risolve il bug del touch event mancato sul Pressable principale su Chrome Android. */}
          {blockExpiredCertificates && (
            <TouchableOpacity
              data-testid="disable-cert-block-btn"
              activeOpacity={0.7}
              onPress={() => {
                setOverrideReason('');
                setOverrideKeepDisabled(false);
                setShowOverrideModal(true);
              }}
              style={{
                marginTop: 8,
                backgroundColor: '#FF6B35',
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="lock-open-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                Disattiva blocco (con motivo)
              </Text>
            </TouchableOpacity>
          )}

          {/* Pulsante "Riattiva ora" quando override è ON */}
          {!blockExpiredCertificates && (
            <TouchableOpacity
              data-testid="reenable-cert-block-btn"
              activeOpacity={0.7}
              onPress={reenableBlock}
              style={{
                marginTop: 8,
                backgroundColor: '#2E7D32',
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                Riattiva blocco ora
              </Text>
            </TouchableOpacity>
          )}
          
          {blockExpiredCertificates && (
            <View style={{ backgroundColor: '#FFF8E1', padding: 10, borderRadius: 8, marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: '#F57F17' }}>
                📌 Regole quando attivo:{'\n'}
                • QR non consente registrazione presenze con certificato scaduto{'\n'}
                • Solo Admin può fare override (valido per singola sessione){'\n'}
                • Motivo override obbligatorio{'\n'}
                • Ogni override viene tracciato con log
              </Text>
            </View>
          )}
        </View>

        {/* Nome Società */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nome Società</Text>
          <TextInput
            style={styles.input}
            value={societyName}
            onChangeText={setSocietyName}
            placeholder="Es: ASD Volley Club"
            placeholderTextColor="#999"
          />
        </View>

        {/* Dati Fiscali */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Dati per Ricevuta Fiscale</Text>
          
          <Text style={styles.inputLabel}>Ragione Sociale</Text>
          <TextInput
            style={styles.input}
            value={ragioneSociale}
            onChangeText={setRagioneSociale}
            placeholder="Es: ASD PALLAVOLO PERUGIA"
            placeholderTextColor="#999"
          />
          
          <Text style={styles.inputLabel}>Sport Praticato</Text>
          <TextInput
            style={styles.input}
            value={sportPraticato}
            onChangeText={setSportPraticato}
            placeholder="Es: Pallavolo, Calcio, Basket..."
            placeholderTextColor="#999"
          />
          
          <Text style={styles.inputLabel}>Indirizzo</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Es: Via Roma, 123"
            placeholderTextColor="#999"
          />
          
          <View style={styles.row}>
            <View style={styles.smallInputContainer}>
              <Text style={styles.inputLabel}>CAP</Text>
              <TextInput
                style={styles.input}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="06100"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.mediumInputContainer}>
              <Text style={styles.inputLabel}>Città</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Perugia"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.smallInputContainer}>
              <Text style={styles.inputLabel}>Prov.</Text>
              <TextInput
                style={styles.input}
                value={province}
                onChangeText={(text) => setProvince(text.toUpperCase())}
                placeholder="PG"
                placeholderTextColor="#999"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>
          
          <Text style={styles.inputLabel}>Codice Fiscale</Text>
          <TextInput
            style={styles.input}
            value={fiscalCode}
            onChangeText={setFiscalCode}
            placeholder="Es: 12345678901"
            placeholderTextColor="#999"
            autoCapitalize="characters"
          />
          
          <View style={styles.row}>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>Telefono 1</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Es: 075 1234567"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>Telefono 2</Text>
              <TextInput
                style={styles.input}
                value={phone2}
                onChangeText={setPhone2}
                placeholder="Es: 333 1234567"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
          </View>
          
          <Text style={styles.inputLabel}>Nome Presidente</Text>
          <TextInput
            style={styles.input}
            value={presidentName}
            onChangeText={setPresidentName}
            placeholder="Es: Mario Rossi"
            placeholderTextColor="#999"
          />

          <View style={styles.row}>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>Email Società</Text>
              <TextInput
                style={styles.input}
                value={societyEmail}
                onChangeText={setSocietyEmail}
                placeholder="info@societasportiva.it"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.halfInputContainer}>
              <Text style={styles.inputLabel}>PEC</Text>
              <TextInput
                style={styles.input}
                value={societyPec}
                onChangeText={setSocietyPec}
                placeholder="societa@pec.it"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Timbro e Firma */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖊️ Timbro e Firma Presidente</Text>
          <Text style={styles.sectionDesc}>
            Per le ricevute fiscali (opzionale)
          </Text>
          
          <View style={styles.logoContainer}>
            {stampSignature ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/png;base64,${stampSignature}` }}
                  style={{ width: 150, height: 80, resizeMode: 'contain' }}
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={() => setStampSignature(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.logoPlaceholder, { width: 150, height: 80 }]}>
                <Ionicons name="create-outline" size={32} color="#ccc" />
                <Text style={styles.logoPlaceholderText}>Nessun timbro</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectStampSignature}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {stampSignature ? 'Cambia' : 'Seleziona'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stagione Sportiva */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Stagione Sportiva</Text>
          <Text style={styles.sectionDesc}>
            Definisci le date di inizio e fine della stagione sportiva
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Giorno Inizio</Text>
              <TextInput
                style={styles.input}
                value={String(seasonStartDay)}
                onChangeText={(v) => setSeasonStartDay(parseInt(v) || 1)}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#999"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Mese Inizio</Text>
              <TextInput
                style={styles.input}
                value={String(seasonStartMonth)}
                onChangeText={(v) => setSeasonStartMonth(parseInt(v) || 7)}
                keyboardType="numeric"
                placeholder="7"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Giorno Fine</Text>
              <TextInput
                style={styles.input}
                value={String(seasonEndDay)}
                onChangeText={(v) => setSeasonEndDay(parseInt(v) || 30)}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#999"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Mese Fine</Text>
              <TextInput
                style={styles.input}
                value={String(seasonEndMonth)}
                onChangeText={(v) => setSeasonEndMonth(parseInt(v) || 6)}
                keyboardType="numeric"
                placeholder="6"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: '#2E7D32' }}>
              Stagione corrente: dal {String(seasonStartDay).padStart(2, '0')}/{String(seasonStartMonth).padStart(2, '0')} al {String(seasonEndDay).padStart(2, '0')}/{String(seasonEndMonth).padStart(2, '0')} dell'anno successivo
            </Text>
          </View>
        </View>

        {/* Logo Società */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 Logo Società</Text>
          <View style={styles.logoContainer}>
            {logo ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${logo}` }}
                  style={[styles.logoImage, { width: logoSize, height: logoSize }]}
                  resizeMode="contain"
                />
                <TouchableOpacity 
                  style={styles.removeLogoBtn}
                  onPress={() => setLogo(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#ccc" />
                <Text style={styles.logoPlaceholderText}>Nessun logo</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.selectLogoBtn} onPress={handleSelectLogo}>
              <Ionicons name="cloud-upload" size={20} color="#007AFF" />
              <Text style={styles.selectLogoBtnText}>
                {logo ? 'Cambia Logo' : 'Seleziona Logo'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {logo && (
            <View style={styles.sizeControl}>
              <Text style={styles.sizeLabel}>Dimensione Logo nell'header: {logoSize}px</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Piccolo</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={30}
                  maximumValue={80}
                  step={5}
                  value={logoSize}
                  onValueChange={setLogoSize}
                  minimumTrackTintColor="#1565C0"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#1565C0"
                />
                <Text style={styles.sliderLabel}>Grande</Text>
              </View>
            </View>
          )}
        </View>

        {/* Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Override Modal: reason + keep_disabled flag */}
      <Modal visible={showOverrideModal} animationType="fade" transparent onRequestClose={() => setShowOverrideModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 440 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="warning" size={22} color="#E65100" />
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#333' }}>Disattivare il blocco certificati?</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 19 }}>
              Gli atleti con certificato scaduto o non autenticato potranno accedere agli allenamenti senza richiesta di override. L'operazione sarà registrata nell'audit log.
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 6 }}>
              Motivo della disattivazione (obbligatorio, min 5 caratteri)
            </Text>
            <TextInput
              data-testid="disable-reason-input"
              style={{
                borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 8,
                padding: 10, fontSize: 13, color: '#222', minHeight: 60,
                backgroundColor: '#FAFAFA', textAlignVertical: 'top', marginBottom: 14,
              }}
              placeholder="es. Torneo fuori sede, verifica massiva certificati..."
              placeholderTextColor="#999"
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
              numberOfLines={3}
              autoFocus
            />

            {/* Keep disabled checkbox - only enabled for Primary Admin with signed declaration */}
            {(() => {
              const canKeepDisabled = isPrimaryAdmin && primaryDeclarationSigned;
              return (
                <>
                  <TouchableOpacity
                    data-testid="keep-disabled-checkbox"
                    onPress={() => {
                      if (!canKeepDisabled) {
                        const msg = !isPrimaryAdmin
                          ? `Solo il Responsabile Admin${primaryAdminName ? ` (${primaryAdminName})` : ''} può mantenere l'override disattivato oltre la mezzanotte.`
                          : "Devi firmare la dichiarazione di Responsabile Admin prima di usare questa opzione. La dichiarazione appare automaticamente al tuo accesso.";
                        showAlert('Accesso riservato', msg);
                        return;
                      }
                      setOverrideKeepDisabled(!overrideKeepDisabled);
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                      backgroundColor: !canKeepDisabled ? '#F5F5F5' : (overrideKeepDisabled ? '#FFEBEE' : '#F5F5F5'),
                      padding: 12, borderRadius: 8, marginBottom: 8,
                      borderWidth: 1, borderColor: !canKeepDisabled ? '#E0E0E0' : (overrideKeepDisabled ? '#EF9A9A' : '#E0E0E0'),
                      opacity: !canKeepDisabled ? 0.55 : 1,
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                      borderColor: overrideKeepDisabled && canKeepDisabled ? '#C62828' : '#999',
                      backgroundColor: overrideKeepDisabled && canKeepDisabled ? '#C62828' : 'transparent',
                      alignItems: 'center', justifyContent: 'center', marginTop: 2,
                    }}>
                      {overrideKeepDisabled && canKeepDisabled && <Ionicons name="checkmark" size={14} color="#fff" />}
                      {!canKeepDisabled && <Ionicons name="lock-closed" size={12} color="#999" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: overrideKeepDisabled && canKeepDisabled ? '#C62828' : '#444' }}>
                        Mantieni disattivato oltre la mezzanotte
                      </Text>
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 17 }}>
                        Sotto la mia responsabilità. Ogni accesso Admin mostrerà un promemoria giornaliero finché non riattivo il blocco.
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {!canKeepDisabled && (
                    <View style={{
                      backgroundColor: '#E3F2FD', padding: 8, borderRadius: 6, marginBottom: 10,
                      borderLeftWidth: 3, borderLeftColor: '#1565C0',
                    }}>
                      <Text style={{ fontSize: 11, color: '#0D47A1', lineHeight: 16 }}>
                        🔒 {!isPrimaryAdmin
                          ? `Opzione riservata al Responsabile Admin${primaryAdminName ? ` (${primaryAdminName})` : ''}. Il blocco si riattiverà automaticamente alle 00:00.`
                          : 'Devi firmare la dichiarazione di Responsabile Admin per abilitare questa opzione.'}
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}

            <View style={{ backgroundColor: '#FFF8E1', padding: 10, borderRadius: 6, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#FF9800' }}>
              <Text style={{ fontSize: 11, color: '#E65100', lineHeight: 16 }}>
                {overrideKeepDisabled
                  ? '⚠️ Il blocco resterà disattivato a tempo indeterminato.'
                  : '⏰ Il blocco si riattiverà automaticamente alle 00:00 (ora italiana).'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowOverrideModal(false)}
                disabled={overrideSubmitting}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#EEE', alignItems: 'center' }}
                data-testid="disable-cancel-btn"
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#666' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitDisableBlock}
                disabled={overrideSubmitting || overrideReason.trim().length < 5}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#E65100',
                  alignItems: 'center', opacity: (overrideSubmitting || overrideReason.trim().length < 5) ? 0.5 : 1,
                }}
                data-testid="disable-confirm-btn"
              >
                {overrideSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>DISATTIVA</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Save Button */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Salva</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoPreview: {
    position: 'relative',
  },
  logoImage: {
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  logoPlaceholderText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  removeLogoBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  selectLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 8,
  },
  selectLogoBtnText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  sizeControl: {
    marginTop: 16,
  },
  sizeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  smallInputContainer: {
    flex: 1,
  },
  mediumInputContainer: {
    flex: 2,
  },
  halfInputContainer: {
    flex: 1,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  saveButton: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Toggle styles
  toggleContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  toggleActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#4CAF50',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: {
    transform: [{ translateX: 22 }],
  },
  toggleNote: {
    marginTop: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
  },
  toggleNoteText: {
    fontSize: 13,
    color: '#795548',
    lineHeight: 20,
  },
});
