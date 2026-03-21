import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CampaignInfo {
  id: string;
  title: string;
  season: string;
  description: string;
  society_name: string;
  society_logo: string;
  close_date?: string;
}

export default function PublicPreseasonForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phoneAthlete, setPhoneAthlete] = useState('');
  const [phoneParent, setPhoneParent] = useState('');
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [previousClub, setPreviousClub] = useState('');
  const [championships, setChampionships] = useState('');
  const [role, setRole] = useState('');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadCampaign();
  }, [id]);

  const loadCampaign = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/preseason/public/${id}`);
      setCampaign(res.data);
    } catch (err: any) {
      if (err.response?.status === 410) {
        setError('Questa campagna non e piu attiva o e scaduta.');
      } else {
        setError('Campagna non trovata.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !birthDate.trim()) {
      alert('Compila almeno Nome, Cognome e Data di nascita.');
      return;
    }
    if (!interest) {
      alert('Indica il tuo livello di interesse.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/preseason/public/${id}/respond`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate.trim(),
        phone_athlete: phoneAthlete.trim(),
        phone_parent: phoneParent.trim(),
        already_member: alreadyMember,
        previous_club: previousClub.trim(),
        championships_played: championships.trim(),
        role_played: role.trim(),
        interest_level: interest,
        notes: notes.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Errore durante l\'invio. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 20 }}>
        <Ionicons name="close-circle-outline" size={60} color="#C62828" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#C62828', marginTop: 16, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 20 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', maxWidth: 420, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
          <Ionicons name="checkmark-circle" size={64} color="#2E7D32" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#2E7D32', marginTop: 16, textAlign: 'center' }}>
            Grazie!
          </Text>
          <Text style={{ fontSize: 14, color: '#555', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            La tua manifestazione di interesse e stata registrata. La societa ti contattera per ulteriori informazioni.
          </Text>
          {campaign?.society_name && (
            <Text style={{ fontSize: 13, color: '#888', marginTop: 12, fontStyle: 'italic' }}>
              {campaign.society_name}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
          {campaign?.society_logo ? (
            <Image source={{ uri: campaign.society_logo }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }} />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="trophy" size={36} color="#fff" />
            </View>
          )}
          {campaign?.society_name ? (
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1565C0', textAlign: 'center' }}>{campaign.society_name}</Text>
          ) : null}
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0D47A1', marginTop: 8, textAlign: 'center' }} data-testid="campaign-title">
            {campaign?.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Stagione {campaign?.season}</Text>
          {campaign?.description ? (
            <Text style={{ fontSize: 13, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20, maxWidth: 380 }}>
              {campaign.description}
            </Text>
          ) : null}
          <View style={{ backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 }}>
            <Text style={{ fontSize: 11, color: '#2E7D32', fontWeight: '600' }}>Compilazione non vincolante</Text>
          </View>
        </View>

        {/* Form */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, maxWidth: 520, alignSelf: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>

          {/* Nome e Cognome */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Nome *</Text>
              <TextInput style={inputStyle} value={firstName} onChangeText={setFirstName} placeholder="Nome" data-testid="preseason-first-name" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Cognome *</Text>
              <TextInput style={inputStyle} value={lastName} onChangeText={setLastName} placeholder="Cognome" data-testid="preseason-last-name" />
            </View>
          </View>

          {/* Data di nascita */}
          <View style={{ marginBottom: 14 }}>
            <Text style={labelStyle}>Data di nascita *</Text>
            <TextInput style={inputStyle} value={birthDate} onChangeText={setBirthDate} placeholder="GG/MM/AAAA" data-testid="preseason-birth-date" />
          </View>

          {/* Telefoni */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Telefono atleta</Text>
              <TextInput style={inputStyle} value={phoneAthlete} onChangeText={setPhoneAthlete} placeholder="Cellulare" keyboardType="phone-pad" data-testid="preseason-phone-athlete" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Telefono genitore</Text>
              <TextInput style={inputStyle} value={phoneParent} onChangeText={setPhoneParent} placeholder="Se minorenne" keyboardType="phone-pad" data-testid="preseason-phone-parent" />
            </View>
          </View>

          {/* Gia iscritto */}
          <View style={{ marginBottom: 14 }}>
            <Text style={labelStyle}>Gia iscritto nella societa?</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[chipStyle, alreadyMember && chipActiveStyle]}
                onPress={() => setAlreadyMember(true)}
                data-testid="preseason-member-yes"
              >
                <Text style={[chipTextStyle, alreadyMember && chipTextActiveStyle]}>Si</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[chipStyle, !alreadyMember && chipActiveStyle]}
                onPress={() => setAlreadyMember(false)}
                data-testid="preseason-member-no"
              >
                <Text style={[chipTextStyle, !alreadyMember && chipTextActiveStyle]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Club precedente */}
          {!alreadyMember && (
            <View style={{ marginBottom: 14 }}>
              <Text style={labelStyle}>Da quale societa/club vieni?</Text>
              <TextInput style={inputStyle} value={previousClub} onChangeText={setPreviousClub} placeholder="Nome societa precedente" data-testid="preseason-previous-club" />
            </View>
          )}

          {/* Campionati e Ruolo */}
          <View style={{ marginBottom: 14 }}>
            <Text style={labelStyle}>Campionati giocati</Text>
            <TextInput style={inputStyle} value={championships} onChangeText={setChampionships} placeholder="Es: Under 14, Serie C, Prima Divisione..." data-testid="preseason-championships" />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={labelStyle}>Ruolo giocato</Text>
            <TextInput style={inputStyle} value={role} onChangeText={setRole} placeholder="Es: Palleggiatore, Schiacciatore, Libero..." data-testid="preseason-role" />
          </View>

          {/* Interesse */}
          <View style={{ marginBottom: 14 }}>
            <Text style={labelStyle}>Interesse per la prossima stagione *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[chipStyle, interest === 'si' && { backgroundColor: '#2E7D32', borderColor: '#2E7D32' }]}
                onPress={() => setInterest('si')}
                data-testid="preseason-interest-yes"
              >
                <Text style={[chipTextStyle, interest === 'si' && chipTextActiveStyle]}>Si, interessato</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[chipStyle, interest === 'ci_penso' && { backgroundColor: '#F57F17', borderColor: '#F57F17' }]}
                onPress={() => setInterest('ci_penso')}
                data-testid="preseason-interest-thinking"
              >
                <Text style={[chipTextStyle, interest === 'ci_penso' && chipTextActiveStyle]}>Ci sto pensando</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[chipStyle, interest === 'no' && { backgroundColor: '#C62828', borderColor: '#C62828' }]}
                onPress={() => setInterest('no')}
                data-testid="preseason-interest-no"
              >
                <Text style={[chipTextStyle, interest === 'no' && chipTextActiveStyle]}>No, grazie</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Note */}
          <View style={{ marginBottom: 20 }}>
            <Text style={labelStyle}>Note (opzionale)</Text>
            <TextInput
              style={[inputStyle, { height: 70, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Altre informazioni..."
              multiline
              data-testid="preseason-notes"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={{
              backgroundColor: submitting ? '#90CAF9' : '#0D47A1',
              borderRadius: 10, paddingVertical: 14, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
            onPress={handleSubmit}
            disabled={submitting}
            data-testid="preseason-submit-btn"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              {submitting ? 'Invio in corso...' : 'Invia manifestazione di interesse'}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 10, lineHeight: 16 }}>
            Questa e una manifestazione di interesse non vincolante. Non costituisce impegno di iscrizione.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const labelStyle: any = { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4 };
const inputStyle: any = {
  borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  fontSize: 14, color: '#333', backgroundColor: '#FAFAFA',
};
const chipStyle: any = {
  borderWidth: 1.5, borderColor: '#CCC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
};
const chipActiveStyle: any = { backgroundColor: '#1565C0', borderColor: '#1565C0' };
const chipTextStyle: any = { fontSize: 13, fontWeight: '600', color: '#666' };
const chipTextActiveStyle: any = { color: '#fff' };
