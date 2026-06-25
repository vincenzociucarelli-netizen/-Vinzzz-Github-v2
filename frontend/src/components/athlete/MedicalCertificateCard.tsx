// 🆕 27/02/2026 — Card Certificato Medico estratta dal /athlete/index.tsx
// Card completa con stato + form inline di modifica data. Usata in /athlete/profile.tsx (tab Anagrafica).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '../Icon';
import api from '../../services/api';

interface Props {
  profile: any;
  societyEmail?: string;
  isMinor?: boolean;
  onSaved: () => void; // chiamato dopo salvataggio (per refetch /auth/me)
}

const formatDateIT = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  } catch {
    return dateStr;
  }
};

export default function MedicalCertificateCard({ profile, societyEmail, isMinor, onSaved }: Props) {
  const [showCertForm, setShowCertForm] = useState(false);
  const [certIssueDate, setCertIssueDate] = useState('');
  const [certValidityMonths, setCertValidityMonths] = useState('12');
  const [savingCert, setSavingCert] = useState(false);

  const handleSaveCert = async () => {
    const parts = certIssueDate.split('/');
    if (parts.length !== 3) return;
    const issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
    const expiryDate = new Date(issueDate);
    const months = parseInt(certValidityMonths) || 12;
    expiryDate.setMonth(expiryDate.getMonth() + months);
    expiryDate.setDate(expiryDate.getDate() - 1);
    setSavingCert(true);
    try {
      await api.post('/certificates/simple', {
        athlete_id: profile?.athlete_record_id || profile?.athlete_id || profile?.id,
        issue_date: issueDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        verified: false,
      });
      setCertIssueDate('');
      setCertValidityMonths('12');
      setShowCertForm(false);
      onSaved();
      if (Platform.OS === 'web') {
        window.alert('Certificato salvato con successo!');
      } else {
        Alert.alert('Successo', 'Certificato salvato!');
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore nel salvataggio';
      if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Errore', msg); }
    } finally {
      setSavingCert(false);
    }
  };

  return (
    <View style={styles.card} data-testid="medical-certificate-card">
      <Text style={styles.cardTitle}>🩺 Certificato Medico</Text>

      {profile?.medical_certificate_expiry ? (
        <View>
          {(() => {
            const expiryDate = new Date(profile.medical_certificate_expiry);
            const today = new Date();
            const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const isExpired = daysLeft < 0;
            const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;
            const statusColor = isExpired ? '#FF3B30' : isExpiringSoon ? '#FF9500' : '#34C759';
            const statusBg = isExpired ? '#FFF0F0' : isExpiringSoon ? '#FFF8E1' : '#E8F5E9';
            const statusText = isExpired ? 'SCADUTO' : isExpiringSoon ? `Scade tra ${daysLeft} giorni` : 'In corso di validità';
            return (
              <View style={{ backgroundColor: statusBg, padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: statusColor }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={isExpired ? 'close-circle' : isExpiringSoon ? 'alert-circle' : 'checkmark-circle'}
                    size={22}
                    color={statusColor}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: statusColor }}>
                    Scadenza: {formatDateIT(profile.medical_certificate_expiry)}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: statusColor, fontWeight: '600', marginTop: 4, paddingLeft: 30 }}>
                  {statusText}
                </Text>
              </View>
            );
          })()}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 4 }}>
            <Ionicons
              name={profile?.medical_certificate_verified ? 'shield-checkmark' : 'shield-outline'}
              size={18}
              color={profile?.medical_certificate_verified ? '#4CAF50' : '#FF9500'}
            />
            <Text style={{ marginLeft: 8, fontSize: 13, color: profile?.medical_certificate_verified ? '#4CAF50' : '#FF9500', fontWeight: '600' }}>
              {profile?.medical_certificate_verified ? "Verificato dall'admin" : "Non ancora verificato dall'admin"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={24} color="#FF9500" />
          <Text style={styles.warningText}>Nessun certificato inserito</Text>
        </View>
      )}

      {/* Banner viola per inserimento/modifica date - solo per adulti */}
      {!isMinor && (
        <TouchableOpacity
          style={{
            backgroundColor: '#EDE7F6', borderRadius: 10, padding: 12, marginTop: 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderWidth: 1, borderColor: '#CE93D8',
          }}
          onPress={() => setShowCertForm(!showCertForm)}
          data-testid="toggle-cert-form-btn"
        >
          <Ionicons name={showCertForm ? "chevron-up" : "calendar-outline"} size={18} color="#7B1FA2" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#7B1FA2' }}>
            {profile?.medical_certificate_expiry ? 'Modifica data certificato' : 'Inserisci dati certificato'}
          </Text>
        </TouchableOpacity>
      )}

      {showCertForm && (
        <View>
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 }}>Data di Emissione (GG/MM/AAAA)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' }}
              value={certIssueDate}
              onChangeText={(text) => {
                let cleaned = text.replace(/\D/g, '');
                if (cleaned.length >= 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
                if (cleaned.length >= 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
                if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
                setCertIssueDate(cleaned);
              }}
              placeholder="gg/mm/aaaa"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
              data-testid="cert-issue-date-input"
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 }}>Validità (mesi)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' }}
              value={certValidityMonths}
              onChangeText={setCertValidityMonths}
              placeholder="12"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={2}
              data-testid="cert-validity-months-input"
            />
            {certIssueDate.length === 10 && parseInt(certValidityMonths) > 0 && (
              <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#666' }}>SCADENZA CERTIFICATO</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2E7D32', marginTop: 2 }}>
                  {(() => {
                    const parts = certIssueDate.split('/');
                    if (parts.length === 3) {
                      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
                      const months = parseInt(certValidityMonths) || 12;
                      d.setMonth(d.getMonth() + months);
                      d.setDate(d.getDate() - 1);
                      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    }
                    return '';
                  })()}
                </Text>
                <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>(data emissione + {certValidityMonths || '12'} mesi - 1 giorno)</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginTop: 10, alignItems: 'center', opacity: certIssueDate.length === 10 && parseInt(certValidityMonths) > 0 ? 1 : 0.5 }}
              disabled={certIssueDate.length !== 10 || !(parseInt(certValidityMonths) > 0) || savingCert}
              onPress={handleSaveCert}
              data-testid="save-cert-btn"
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {savingCert ? 'Salvataggio...' : 'Salva Data Certificato'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#FF9800' }}>
            <Text style={{ fontSize: 12, color: '#E65100', lineHeight: 18 }}>
              Copia del certificato dovrà essere consegnata alla Società e inviata per e-mail al seguente indirizzo: <Text style={{ fontWeight: 'bold' }}>{profile?.society_email || societyEmail || '-'}</Text> in formato pdf
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
  },
});
