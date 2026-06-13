/**
 * 🆕 13/06/2026 — HUB PERSONA (lato Admin)
 *
 * Pagina centrale unica per ogni persona della società. Mostra:
 *  - Anagrafica unificata (nome, CF, contatti, residenza)
 *  - 2 pulsanti d'ingresso: Atleta + Coach (solo se dual-role)
 *  - Pulsante "Compensi" (rimanda alla pagina compensi unificata — coming Step 2)
 *
 * Se la persona ha SOLO un ruolo, l'hub redireziona automaticamente alla scheda
 * del ruolo posseduto (athlete/[id] o coach/[id]) — backward compatible.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '../../../../src/components/Icon';
import api from '../../../../src/services/api';

interface PersonProfile {
  user_id: string | null;
  athlete_id: string | null;
  is_dual_role: boolean;
  has_athlete_role: boolean;
  has_coach_role: boolean;
  coach_role_name: string | null;
  profile: {
    first_name: string;
    last_name: string;
    fiscal_code: string;
    email: string;
    phone: string;
    birth_date?: string | null;
    birth_place?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    photo_url?: string | null;
    qr_identifier?: string | null;
  };
}

export default function PersonaHubPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PersonProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/persons/${id}/profile`)
      .then(res => {
        const d: PersonProfile = res.data;
        setData(d);
        // Auto-redirect se SINGLE ROLE — niente hub
        if (!d.is_dual_role) {
          if (d.has_athlete_role && d.athlete_id) {
            router.replace(`/admin/athlete/${d.athlete_id}`);
          } else if (d.has_coach_role && d.user_id) {
            router.replace(`/admin/coach/${d.user_id}`);
          }
        }
      })
      .catch(e => setError(e?.response?.data?.detail || 'Errore caricamento'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>Caricamento profilo...</Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={48} color="#C62828" />
        <Text style={styles.errorText}>{error || 'Profilo non trovato'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data.is_dual_role) {
    // Sta redirigendo — placeholder spinner
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#1976D2" />
      </View>
    );
  }

  const p = data.profile;
  const fullName = `${p.last_name} ${p.first_name}`.trim() || 'Persona';

  const goAtleta = () => {
    if (data.athlete_id) router.push(`/admin/athlete/${data.athlete_id}`);
  };
  const goCoach = () => {
    if (data.user_id) router.push(`/admin/coach/${data.user_id}`);
  };
  const goCompensi = () => {
    // Pagina compensi unificata Doppio Ruolo
    const hubId = data.user_id || data.athlete_id;
    if (hubId) router.push(`/admin/persona/${hubId}/compensi`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header anagrafica */}
      <View style={styles.header} testID="persona-hub-header">
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow} testID="back-button">
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {p.photo_url ? (
            <Image source={{ uri: p.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(p.first_name?.[0] || '') + (p.last_name?.[0] || '')}
              </Text>
            </View>
          )}
          <Text style={styles.headerName} testID="person-name">{fullName.toUpperCase()}</Text>
          {p.fiscal_code ? <Text style={styles.headerSub}>{p.fiscal_code}</Text> : null}
          <View style={styles.dualBadge}>
            <Ionicons name="people" size={14} color="#fff" />
            <Text style={styles.dualBadgeText}>Doppio Ruolo</Text>
          </View>
        </View>
      </View>

      {/* Anagrafica essenziale */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📇 Anagrafica</Text>
        <Row icon="mail" label="Email" value={p.email} />
        <Row icon="call" label="Telefono" value={p.phone} />
        {p.address ? <Row icon="home" label="Indirizzo" value={`${p.address}, ${p.city || ''} ${p.province ? `(${p.province})` : ''} ${p.postal_code || ''}`.trim()} /> : null}
        {p.birth_place ? <Row icon="calendar" label="Nato a" value={`${p.birth_place} ${p.birth_date ? `il ${p.birth_date}` : ''}`.trim()} /> : null}
      </View>

      {/* 2 bottoni d'accesso ai ruoli */}
      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Scegli scheda da gestire</Text>

        <TouchableOpacity
          style={[styles.roleBtn, styles.roleBtnAtleta]}
          onPress={goAtleta}
          testID="hub-btn-atleta"
        >
          <View style={[styles.roleIcon, { backgroundColor: '#FFE082' }]}>
            <Text style={{ fontSize: 30 }}>🏃</Text>
          </View>
          <View style={styles.roleBtnText}>
            <Text style={styles.roleBtnTitle}>Atleta</Text>
            <Text style={styles.roleBtnSub}>Tesseramento, contratto atleta, squadra, certificato medico</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#F57C00" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleBtn, styles.roleBtnCoach]}
          onPress={goCoach}
          testID="hub-btn-coach"
        >
          <View style={[styles.roleIcon, { backgroundColor: '#BBDEFB' }]}>
            <Text style={{ fontSize: 30 }}>🥎</Text>
          </View>
          <View style={styles.roleBtnText}>
            <Text style={styles.roleBtnTitle}>{data.coach_role_name === 'dirigente' ? 'Dirigente' : data.coach_role_name === 'collaboratore' ? 'Collaboratore' : 'Allenatore'}</Text>
            <Text style={styles.roleBtnSub}>Tessera tecnica, contratto, squadra assegnata</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#1976D2" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleBtn, styles.roleBtnCompensi]}
          onPress={goCompensi}
          testID="hub-btn-compensi"
        >
          <View style={[styles.roleIcon, { backgroundColor: '#C8E6C9' }]}>
            <Text style={{ fontSize: 30 }}>💰</Text>
          </View>
          <View style={styles.roleBtnText}>
            <Text style={styles.roleBtnTitle}>Compensi (Doppio Ruolo)</Text>
            <Text style={styles.roleBtnSub}>Riepilogo unificato Atleta + Coach con regola quartili</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <Text style={styles.footnote}>
        💡 Hub unico per la gestione delle persone con doppio ruolo. I dati anagrafici e fiscali
        sono condivisi tra le due schede.
      </Text>
    </ScrollView>
  );
}

const Row = ({ icon, label, value }: { icon: any; label: string; value: any }) => {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color="#777" style={{ marginRight: 10 }} />
      <Text style={styles.rowLabel}>{label}:</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#F4F6FA' },
  loadingText: { marginTop: 10, color: '#666' },
  errorText: { marginTop: 12, color: '#C62828', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  backBtn: { marginTop: 18, padding: 12, paddingHorizontal: 28, backgroundColor: '#1976D2', borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  header: {
    backgroundColor: '#1565C0',
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 30 : 50,
    paddingBottom: 28,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  backArrow: { position: 'absolute', top: Platform.OS === 'web' ? 20 : 40, left: 10, padding: 8, zIndex: 2 },
  headerCenter: { alignItems: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#3F51B5' },
  avatarInitial: { fontSize: 30, fontWeight: '700', color: '#fff' },
  headerName: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12, letterSpacing: 0.5 },
  headerSub: { fontSize: 13, color: '#E3F2FD', marginTop: 4, fontFamily: 'monospace' },
  dualBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#3F51B5',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginTop: 12, gap: 6,
  },
  dualBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 14, marginTop: 14, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A237E', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: '#666', minWidth: 80, fontWeight: '500' },
  rowValue: { fontSize: 13, color: '#222', flex: 1 },

  actionsCard: { marginHorizontal: 14, marginTop: 14 },
  actionsTitle: { fontSize: 13, color: '#777', fontWeight: '600', marginBottom: 10, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleBtn: {
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10,
    borderLeftWidth: 5, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  roleBtnAtleta: { borderLeftColor: '#F57C00' },
  roleBtnCoach: { borderLeftColor: '#1976D2' },
  roleBtnCompensi: { borderLeftColor: '#2E7D32' },
  roleIcon: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  roleBtnText: { flex: 1 },
  roleBtnTitle: { fontSize: 17, fontWeight: '700', color: '#1A237E' },
  roleBtnSub: { fontSize: 12, color: '#666', marginTop: 3, lineHeight: 16 },

  footnote: { fontSize: 11, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 18, paddingHorizontal: 20, lineHeight: 16 },
});
