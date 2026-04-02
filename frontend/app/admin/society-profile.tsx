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
  Share,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

interface Affiliation {
  name: string;
  number: string;
}

export default function SocietyProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Logo
  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(50);
  const [stampSignature, setStampSignature] = useState<string | null>(null);

  // Dati societa
  const [societyName, setSocietyName] = useState('');
  const [ragioneSociale, setRagioneSociale] = useState('');
  const [sportPraticato, setSportPraticato] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [cellulare, setCellulare] = useState('');
  const [phone2, setPhone2] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [societyEmail, setSocietyEmail] = useState('');
  const [societyPec, setSocietyPec] = useState('');
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');

  // Affiliazioni sportive
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [newAffName, setNewAffName] = useState('');
  const [newAffNumber, setNewAffNumber] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/settings/society');
      setSocietyName(response.data.name || '');
      setLogo(response.data.logo || null);
      setLogoSize(response.data.logo_size || 50);
      setRagioneSociale(response.data.ragione_sociale || '');
      setSportPraticato(response.data.sport_praticato || '');
      setAddress(response.data.address || '');
      setPostalCode(response.data.postal_code || '');
      setCity(response.data.city || '');
      setProvince(response.data.province || '');
      setFiscalCode(response.data.fiscal_code || '');
      setCellulare(response.data.phone || '');
      setPhone2(response.data.phone2 || '');
      setPresidentName(response.data.president_name || '');
      setStampSignature(response.data.stamp_signature || null);
      setSocietyEmail(response.data.email || '');
      setSocietyPec(response.data.pec || '');
      setIban(response.data.iban || '');
      setBankName(response.data.bank_name || '');
      setAffiliations(response.data.affiliations || []);
    } catch (error) {
      console.error('Errore caricamento profilo:', error);
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
        ragione_sociale: ragioneSociale,
        sport_praticato: sportPraticato,
        address: address,
        postal_code: postalCode,
        city: city,
        province: province,
        fiscal_code: fiscalCode,
        phone: cellulare,
        phone2: phone2,
        president_name: presidentName,
        stamp_signature: stampSignature,
        email: societyEmail,
        pec: societyPec,
        iban: iban,
        bank_name: bankName,
        affiliations: affiliations,
      });
      setEditMode(false);
      showAlert('Successo', 'Profilo societa aggiornato');
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

  // Affiliazioni
  const addAffiliation = () => {
    if (newAffName.trim() && newAffNumber.trim()) {
      setAffiliations([...affiliations, { name: newAffName.trim(), number: newAffNumber.trim() }]);
      setNewAffName('');
      setNewAffNumber('');
    } else {
      showAlert('Errore', 'Compila sia il nome che il numero di affiliazione');
    }
  };
  const removeAffiliation = (index: number) => {
    setAffiliations(affiliations.filter((_, i) => i !== index));
  };

  // Testo biglietto da visita
  const buildBusinessCardText = () => {
    const lines = [societyName];
    if (ragioneSociale) lines.push(ragioneSociale);
    if (sportPraticato) lines.push(`Sport: ${sportPraticato}`);
    lines.push('');
    if (address) lines.push(address);
    if (postalCode || city || province) lines.push(`${postalCode} ${city} (${province})`.trim());
    lines.push('');
    if (cellulare) lines.push(`Cell: ${cellulare}`);
    if (phone2) lines.push(`Tel: ${phone2}`);
    if (societyEmail) lines.push(`Email: ${societyEmail}`);
    if (societyPec) lines.push(`PEC: ${societyPec}`);
    if (fiscalCode) lines.push(`C.F.: ${fiscalCode}`);
    if (presidentName) lines.push(`Presidente: ${presidentName}`);
    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(buildBusinessCardText());
    const phoneNum = cellulare.replace(/\s/g, '').replace('+', '');
    if (Platform.OS === 'web') {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } else {
      Share.share({ message: buildBusinessCardText() });
    }
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`${societyName} - Contatti`);
    const body = encodeURIComponent(buildBusinessCardText());
    if (Platform.OS === 'web') {
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    } else {
      Share.share({ message: buildBusinessCardText(), title: societyName });
    }
  };

  // Scarica Card JPG Dati Fiscali
  const handleDownloadFiscalCard = async () => {
    try {
      const res = await api.post('/society/card-fiscale', {}, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Biglietto_${societyName?.replace(/\s+/g, '_') || 'Societa'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      let msg = 'Errore nel download';
      if (e.response?.data instanceof Blob) {
        try { const text = await e.response.data.text(); const json = JSON.parse(text); msg = json.detail || msg; } catch {}
      } else if (e.response?.data?.detail) { msg = e.response.data.detail; }
      showAlert('Errore', msg);
    }
  };

  // Scarica Card JPG Dati Bancari
  const handleDownloadBankCard = async () => {
    try {
      const res = await api.get('/society/card-bancaria', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dati_Bancari_${societyName?.replace(/\s+/g, '_') || 'Societa'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      let msg = 'Errore nel download';
      if (e.response?.data instanceof Blob) {
        try { const text = await e.response.data.text(); const json = JSON.parse(text); msg = json.detail || msg; } catch {}
      } else if (e.response?.data?.detail) { msg = e.response.data.detail; }
      showAlert('Errore', msg);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  const InfoRow = ({ label, value, icon }: { label: string; value: string; icon: string }) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Ionicons name={icon as any} size={16} color="#888" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Intestazione */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
            <Ionicons name="chevron-back" size={24} color="#1565C0" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profilo Societa</Text>
        <TouchableOpacity
          onPress={() => editMode ? handleSave() : setEditMode(true)}
          style={{ padding: 8 }}
          data-testid="society-edit-toggle"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={editMode ? "checkmark-circle" : "create"} size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Card Profilo */}
        <View style={styles.profileCard} data-testid="society-profile-card">
          <View style={styles.profileHeader}>
            {editMode ? (
              <TouchableOpacity onPress={handleSelectLogo} style={styles.avatarEdit}>
                {logo ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${logo}` }} style={styles.avatar} resizeMode="contain" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={28} color="#999" />
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : (
              <View>
                {logo ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${logo}` }} style={styles.avatar} resizeMode="contain" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="business" size={36} color="#999" />
                  </View>
                )}
              </View>
            )}
            <View style={styles.profileInfo}>
              {editMode ? (
                <>
                  <TextInput style={styles.editInput} value={societyName} onChangeText={setSocietyName} placeholder="Nome Societa" placeholderTextColor="#999" />
                  <TextInput style={[styles.editInput, { fontSize: 13 }]} value={ragioneSociale} onChangeText={setRagioneSociale} placeholder="Ragione Sociale" placeholderTextColor="#999" />
                </>
              ) : (
                <>
                  <Text style={styles.profileName}>{societyName || 'Nome Societa'}</Text>
                  {ragioneSociale ? <Text style={styles.profileSubtitle}>{ragioneSociale}</Text> : null}
                  {sportPraticato ? (
                    <View style={styles.sportBadge}>
                      <Ionicons name="fitness" size={14} color="#1565C0" />
                      <Text style={styles.sportBadgeText}>{sportPraticato}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* Pulsanti condivisione */}
          {!editMode && (
            <View style={styles.shareRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareWhatsApp} data-testid="share-whatsapp-btn">
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={[styles.shareBtnText, { color: '#25D366' }]}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareEmail} data-testid="share-email-btn">
                <Ionicons name="mail" size={18} color="#1565C0" />
                <Text style={[styles.shareBtnText, { color: '#1565C0' }]}>Email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* === MODALITA VISUALIZZAZIONE === */}
        {!editMode && (
          <>
            {/* Sede */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sede</Text>
              <InfoRow icon="location" label="Indirizzo" value={address} />
              <InfoRow icon="navigate" label="Citta" value={`${postalCode} ${city} (${province})`.trim()} />
            </View>

            {/* Contatti */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contatti</Text>
              <InfoRow icon="phone-portrait" label="Cellulare" value={cellulare} />
              {phone2 ? <InfoRow icon="call" label="Telefono" value={phone2} /> : null}
              <InfoRow icon="mail" label="Email" value={societyEmail} />
              <InfoRow icon="document-text" label="PEC" value={societyPec} />
            </View>

            {/* Dati Fiscali + Card PDF */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Dati Fiscali</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 }}
                  onPress={handleDownloadFiscalCard}
                  data-testid="download-fiscal-card-btn"
                >
                  <Ionicons name="download" size={14} color="#1565C0" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1565C0' }}>JPG</Text>
                </TouchableOpacity>
              </View>
              <InfoRow icon="card" label="Codice Fiscale" value={fiscalCode} />
              <InfoRow icon="person" label="Presidente" value={presidentName} />
            </View>

            {/* Dati Bancari + Card JPG */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Dati Bancari</Text>
                {iban ? (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 }}
                    onPress={handleDownloadBankCard}
                    data-testid="download-bank-card-btn"
                  >
                    <Ionicons name="download" size={14} color="#2E7D32" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#2E7D32' }}>JPG</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <InfoRow icon="wallet" label="IBAN" value={iban} />
              {bankName ? <InfoRow icon="business" label="Banca" value={bankName} /> : null}
              {!iban && <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Nessun IBAN inserito</Text>}
            </View>

            {/* Affiliazioni Sportive */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Affiliazioni Sportive</Text>
              {affiliations.length > 0 ? (
                affiliations.map((aff, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 10 }}>
                    <Ionicons name="ribbon" size={16} color="#E65100" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#888' }}>{aff.name}</Text>
                      <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{aff.number}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Nessuna affiliazione inserita</Text>
              )}
            </View>

            {/* Timbro e Firma */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Timbro e Firma</Text>
              {stampSignature ? (
                <Image source={{ uri: `data:image/png;base64,${stampSignature}` }} style={{ width: 150, height: 80, resizeMode: 'contain', alignSelf: 'center', marginTop: 8 }} />
              ) : (
                <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Nessun timbro caricato</Text>
              )}
            </View>
          </>
        )}

        {/* === MODALITA MODIFICA === */}
        {editMode && (
          <>
            {/* Sport */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sport</Text>
              <TextInput style={styles.input} value={sportPraticato} onChangeText={setSportPraticato} placeholder="Es: Pallavolo, Calcio, Basket..." placeholderTextColor="#999" />
            </View>

            {/* Sede */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sede</Text>
              <Text style={styles.inputLabel}>Indirizzo</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Via Roma, 123" placeholderTextColor="#999" />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CAP</Text>
                  <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="06100" placeholderTextColor="#999" keyboardType="numeric" />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Citta</Text>
                  <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Perugia" placeholderTextColor="#999" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Prov.</Text>
                  <TextInput style={styles.input} value={province} onChangeText={(t) => setProvince(t.toUpperCase())} placeholder="PG" placeholderTextColor="#999" maxLength={2} autoCapitalize="characters" />
                </View>
              </View>
            </View>

            {/* Contatti */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contatti</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Cellulare</Text>
                  <TextInput style={styles.input} value={cellulare} onChangeText={setCellulare} placeholder="333 1234567" placeholderTextColor="#999" keyboardType="phone-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Telefono fisso</Text>
                  <TextInput style={styles.input} value={phone2} onChangeText={setPhone2} placeholder="075 1234567" placeholderTextColor="#999" keyboardType="phone-pad" />
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput style={styles.input} value={societyEmail} onChangeText={setSocietyEmail} placeholder="info@societa.it" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PEC</Text>
                  <TextInput style={styles.input} value={societyPec} onChangeText={setSocietyPec} placeholder="societa@pec.it" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>
            </View>

            {/* Dati Fiscali */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dati Fiscali</Text>
              <Text style={styles.inputLabel}>Codice Fiscale</Text>
              <TextInput style={styles.input} value={fiscalCode} onChangeText={setFiscalCode} placeholder="12345678901" placeholderTextColor="#999" autoCapitalize="characters" />
              <Text style={styles.inputLabel}>Presidente</Text>
              <TextInput style={styles.input} value={presidentName} onChangeText={setPresidentName} placeholder="Mario Rossi" placeholderTextColor="#999" />
            </View>

            {/* Dati Bancari */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dati Bancari</Text>
              <Text style={styles.inputLabel}>IBAN</Text>
              <TextInput style={styles.input} value={iban} onChangeText={setIban} placeholder="IT60X0542811101000000123456" placeholderTextColor="#999" autoCapitalize="characters" />
              <Text style={styles.inputLabel}>Nome Banca</Text>
              <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="Banca di Credito" placeholderTextColor="#999" />
            </View>

            {/* Affiliazioni Sportive */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Affiliazioni Sportive</Text>
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                Aggiungi le federazioni e gli enti a cui la societa e affiliata
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 2 }}>
                  <TextInput style={styles.input} value={newAffName} onChangeText={setNewAffName} placeholder="Es: FIPAV, UISP..." placeholderTextColor="#999" />
                </View>
                <View style={{ flex: 2 }}>
                  <TextInput style={styles.input} value={newAffNumber} onChangeText={setNewAffNumber} placeholder="N. affiliazione" placeholderTextColor="#999" />
                </View>
                <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center' }} onPress={addAffiliation}>
                  <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              {affiliations.map((aff, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 8, padding: 10, marginBottom: 6, gap: 8 }}>
                  <Ionicons name="ribbon" size={16} color="#1565C0" />
                  <Text style={{ flex: 1, fontSize: 14, color: '#333' }}>{aff.name}: <Text style={{ fontWeight: '600' }}>{aff.number}</Text></Text>
                  <TouchableOpacity onPress={() => removeAffiliation(idx)}>
                    <Ionicons name="close-circle" size={22} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
              {affiliations.length === 0 && <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Nessuna affiliazione inserita</Text>}
            </View>

            {/* Timbro e Firma */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Timbro e Firma</Text>
              <View style={styles.imageRow}>
                {stampSignature ? (
                  <View style={styles.imagePreview}>
                    <Image source={{ uri: `data:image/png;base64,${stampSignature}` }} style={{ width: 150, height: 80, resizeMode: 'contain' }} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => setStampSignature(null)}>
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="create-outline" size={28} color="#ccc" />
                    <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>Nessun timbro</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.uploadBtn} onPress={handleSelectStampSignature}>
                  <Ionicons name="cloud-upload" size={18} color="#1565C0" />
                  <Text style={{ color: '#1565C0', fontWeight: '500', fontSize: 13 }}>{stampSignature ? 'Cambia' : 'Carica'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Logo - dimensione */}
            {logo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Logo</Text>
                <Text style={styles.inputLabel}>Dimensione nell'header: {logoSize}px</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#999' }}>Piccolo</Text>
                  <Slider
                    style={{ flex: 1, height: 40 }}
                    minimumValue={30}
                    maximumValue={80}
                    step={5}
                    value={logoSize}
                    onValueChange={setLogoSize}
                    minimumTrackTintColor="#1565C0"
                    maximumTrackTintColor="#ddd"
                    thumbTintColor="#1565C0"
                  />
                  <Text style={{ fontSize: 11, color: '#999' }}>Grande</Text>
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: editMode ? 100 : 40 }} />
      </ScrollView>

      {/* Pulsante Salva (modalita modifica) */}
      {editMode && (
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditMode(false); loadProfile(); }}>
            <Text style={{ color: '#666', fontWeight: '600', fontSize: 15 }}>Annulla</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Salva</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1565C0', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1 },
  profileCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: -1, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 16 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' },
  avatarEdit: { position: 'relative' as const },
  avatarEditBadge: { position: 'absolute' as const, bottom: -2, right: -2, backgroundColor: '#1565C0', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  profileSubtitle: { fontSize: 13, color: '#888' },
  sportBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 6, gap: 4 },
  sportBadgeText: { fontSize: 12, fontWeight: '600', color: '#1565C0' },
  editInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, backgroundColor: '#fafafa', marginBottom: 8 },
  shareRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#f5f7fa', gap: 6 },
  shareBtnText: { fontSize: 13, fontWeight: '600' },
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel: { fontSize: 11, color: '#888' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 10 },
  inputLabel: { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 4, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  imagePreview: { position: 'relative' as const },
  imagePlaceholder: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed' },
  removeBtn: { position: 'absolute' as const, top: -8, right: -8 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#E3F2FD', borderRadius: 8, gap: 6 },
  floatingButtonContainer: { position: 'absolute' as const, bottom: 20, left: 20, right: 20, flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
  saveButton: { flex: 2, backgroundColor: '#1565C0', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
