import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from './Icon';
import api from '../services/api';

export interface ConvocationNoticeItem {
  id: string;
  team_name: string;
  opponent: string;
  match_number?: string;
  home_away: string;
  match_date: string;
  match_time: string;
  venue: string;
  venue_address: string;
  maps_url: string;
  city: string;
  meeting_place: string;
  meeting_time: string;
  start_time: string;
  notes: string;
  coach_name: string;
  coach_phone: string;
}

const normalizePhone = (raw: string): string => {
  let p = (raw || '').replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('00')) p = p.substring(2);
  if (p.startsWith('39')) return p;
  p = p.replace(/^0+/, '');
  return `39${p}`;
};

const openUrl = (url: string) => {
  if (!url) return;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};

interface Props { athleteId?: string; accentColor?: string; }

export default function ConvocationNotice({ athleteId, accentColor = '#5856D6' }: Props) {
  const [items, setItems] = useState<ConvocationNoticeItem[]>([]);

  const load = useCallback(async () => {
    if (!athleteId) return;
    try {
      const res = await api.get(`/convocations/for-athlete/${athleteId}`);
      setItems(res.data || []);
    } catch {
      setItems([]);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      {items.map((c) => {
        const title = c.home_away === 'home' ? `${c.team_name} vs ${c.opponent}` : `${c.opponent} vs ${c.team_name}`;
        const when = [c.match_date, c.match_time].filter(Boolean).join(' · ');
        const wa = normalizePhone(c.coach_phone);
        return (
          <View key={c.id} style={[styles.card, { borderLeftColor: accentColor }]}>
            <View style={styles.headRow}>
              <Ionicons name="megaphone" size={18} color={accentColor} />
              <Text style={[styles.badge, { color: accentColor }]}>SEI CONVOCATA</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {!!c.match_number && <Text style={styles.line}>🏷️ Gara n. {c.match_number}</Text>}
            {!!when && <Text style={styles.line}>📅 {when}</Text>}
            {(!!c.venue || !!c.city) && <Text style={styles.line}>📍 {[c.venue, c.city].filter(Boolean).join(' · ')}</Text>}
            {!!c.venue_address && <Text style={styles.sub}>{c.venue_address}</Text>}
            {(!!c.meeting_place || !!c.meeting_time) && (
              <Text style={styles.line}>⏰ Ritrovo: {[c.meeting_place, c.meeting_time].filter(Boolean).join(' ore ')}</Text>
            )}
            {!!c.start_time && <Text style={styles.line}>🕐 Inizio gara: {c.start_time}</Text>}
            {!!c.notes && <Text style={styles.line}>📝 {c.notes}</Text>}

            {!!c.maps_url && (
              <TouchableOpacity style={[styles.mapBtn]} onPress={() => openUrl(c.maps_url)}>
                <Ionicons name="navigate" size={15} color="#1E3A8A" />
                <Text style={styles.mapBtnText}>Apri su Google Maps</Text>
              </TouchableOpacity>
            )}

            <View style={styles.alert}>
              <Text style={styles.alertText}>
                ⚠️ In caso di impossibilità, avvisa <Text style={{ fontWeight: '700' }}>subito il coach{c.coach_name ? ` (${c.coach_name})` : ''}</Text> per telefono o WhatsApp.
              </Text>
              {!!c.coach_phone && (
                <View style={styles.contactRow}>
                  <TouchableOpacity style={[styles.cBtn, { backgroundColor: '#E8EAF6' }]} onPress={() => openUrl(`tel:${c.coach_phone}`)}>
                    <Ionicons name="call" size={15} color="#303F9F" />
                    <Text style={[styles.cBtnText, { color: '#303F9F' }]}>Chiama</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => openUrl(`https://wa.me/${wa}`)}>
                    <Ionicons name="logo-whatsapp" size={15} color="#2E7D32" />
                    <Text style={[styles.cBtnText, { color: '#2E7D32' }]}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  badge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 6 },
  line: { fontSize: 13.5, color: '#444', marginTop: 2 },
  sub: { fontSize: 12, color: '#888', marginTop: 1, marginLeft: 18 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  mapBtnText: { color: '#1E3A8A', fontWeight: '700', fontSize: 13 },
  alert: { backgroundColor: '#FFF8E1', borderRadius: 8, padding: 10, marginTop: 10 },
  alertText: { fontSize: 12.5, color: '#8D6E00', lineHeight: 18 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  cBtnText: { fontWeight: '700', fontSize: 13 },
});
