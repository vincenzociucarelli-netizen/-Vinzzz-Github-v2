/**
 * 🆕 08/07/2026 — Sezione "Società" riusabile con contatti.
 *
 * Mostra:
 *  - Logo società grande centrato in alto
 *  - 3 accordion (Dirigenti / Coach / Collaboratori) chiusi di default
 *  - Ogni contatto ha WhatsApp + tel
 *
 * Usato in Coach, Collaboratore, Dirigente per uniformità UX.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

interface Contact {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  qualification?: string;
  activity_type?: string;
}

interface Props {
  currentUserId?: string;
  /** Nasconde alcune categorie se non pertinenti (default: mostra tutte) */
  show?: { dirigenti?: boolean; coaches?: boolean; collaboratori?: boolean };
}

const COLORS = ['#1565C0', '#6A1B9A', '#00838F', '#2E7D32', '#D84315', '#4527A0', '#AD1457', '#00695C'];

function initialsFor(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

function bgFor(name?: string) {
  const idx = name ? name.charCodeAt(0) % COLORS.length : 0;
  return COLORS[idx];
}

function openWhatsapp(phone: string) {
  const clean = phone.replace(/\D/g, '');
  const withPrefix = clean.startsWith('39') ? clean : `39${clean}`;
  Linking.openURL(`https://wa.me/${withPrefix}`);
}

const ContactCard: React.FC<{ c: Contact; me?: boolean }> = ({ c, me }) => {
  const name = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—';
  return (
    <View style={[styles.card, me && { borderLeftWidth: 3, borderLeftColor: '#1565C0' }]}>
      <View style={[styles.avatar, { backgroundColor: bgFor(name) }]}>
        <Text style={styles.avatarText}>{initialsFor(name)}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.name}>{name}{me ? ' (tu)' : ''}</Text>
        {c.qualification ? <Text style={styles.qual}>{c.qualification}</Text> : null}
        {c.activity_type ? <Text style={styles.qual}>{c.activity_type}</Text> : null}
        {c.email ? <Text style={styles.email}>{c.email}</Text> : null}
        {c.phone && !me ? (
          <View style={styles.phoneRow}>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)}>
              <Text style={styles.phone}>{c.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.wa} onPress={() => openWhatsapp(c.phone!)}>
              <Ionicons name="logo-whatsapp" size={12} color="#fff" />
              <Text style={styles.waText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default function SocietyContactsSection({ currentUserId, show }: Props) {
  const [dirigenti, setDirigenti] = useState<Contact[]>([]);
  const [coaches, setCoaches] = useState<Contact[]>([]);
  const [collaboratori, setCollaboratori] = useState<Contact[]>([]);
  const [expanded, setExpanded] = useState({ dirigenti: false, coaches: false, collaboratori: false });
  const wantDir = show?.dirigenti ?? true;
  const wantCoa = show?.coaches ?? true;
  const wantCol = show?.collaboratori ?? true;

  useEffect(() => {
    (async () => {
      try {
        if (wantDir) {
          const r = await api.get('/users/fellow-dirigenti').catch(() => ({ data: [] }));
          setDirigenti(Array.isArray(r.data) ? r.data : (r.data?.items || []));
        }
      } catch { /* silent */ }
      try {
        if (wantCoa) {
          const r = await api.get('/users/fellow-coaches').catch(() => ({ data: [] }));
          setCoaches(Array.isArray(r.data) ? r.data : (r.data?.items || []));
        }
      } catch { /* silent */ }
      try {
        if (wantCol) {
          const r = await api.get('/users/staff-collaboratori').catch(() => ({ data: [] }));
          setCollaboratori(Array.isArray(r.data) ? r.data : (r.data?.items || []));
        }
      } catch { /* silent */ }
    })();
  }, [wantDir, wantCoa, wantCol]);

  const renderAccordion = (
    key: keyof typeof expanded,
    title: string,
    subtitle: string,
    items: Contact[],
    emptyIcon: keyof typeof Ionicons.glyphMap,
    emptyText: string,
  ) => (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
        style={styles.sectionHeader}
        data-testid={`contacts-toggle-${key}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title} ({items.length})</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Ionicons name={expanded[key] ? 'chevron-up' : 'chevron-down'} size={22} color="#666" />
      </TouchableOpacity>
      {expanded[key] && (items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name={emptyIcon} size={40} color="#ccc" />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        items.map((c) => <ContactCard key={c.id} c={c} me={c.id === currentUserId} />)
      ))}
    </View>
  );

  return (
    <View>
      {wantDir && renderAccordion('dirigenti', 'Dirigenti della Societa', 'Contatta i dirigenti tramite WhatsApp', dirigenti, 'people-outline', 'Nessun dirigente trovato')}
      {wantCoa && renderAccordion('coaches', 'Allenatori della Societa', 'I coach della societa', coaches, 'fitness-outline', 'Nessun allenatore trovato')}
      {wantCol && renderAccordion('collaboratori', 'Collaboratori della Societa', 'Groundskeepers, segreteria, ecc.', collaboratori, 'construct-outline', 'Nessun collaboratore trovato')}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  empty: { alignItems: 'center', padding: 20 },
  emptyText: { color: '#999', marginTop: 6, fontStyle: 'italic' },
  card: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  qual: { fontSize: 12, color: '#666', marginTop: 2 },
  email: { fontSize: 12, color: '#666', marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  phone: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  wa: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#25D366', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  waText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
