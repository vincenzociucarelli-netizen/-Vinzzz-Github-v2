/**
 * 🆕 27/02/2026 — Dashboard Coordinatore.
 *
 * Mostra SOLO le sezioni per cui il coordinatore ha ottenuto permesso dal Main Admin.
 * Le sezioni con permesso mancante non sono visibili.
 * Le sezioni amministrative (pagamenti/compensi/IBAN/sponsor) sono SEMPRE nascoste.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import SocietyBranding from '../../src/components/SocietyBranding';
import GuideButton from '../../src/components/GuideButton';

interface PermItem {
  key: string;
  label: string;
  icon: any;
  color: string;
  route?: string;
  description: string;
}

const SECTIONS: PermItem[] = [
  { key: 'teams', label: 'Squadre e roster', icon: 'people', color: '#1565C0', route: '/admin/athletes', description: 'Elenco squadre, atleti per squadra' },
  { key: 'athletes', label: 'Atleti (anagrafica)', icon: 'person', color: '#00838F', route: '/admin/athletes', description: 'Anagrafica atleti, ricerca, filtri' },
  { key: 'trainings', label: 'Allenamenti', icon: 'fitness', color: '#2E7D32', route: '/admin/settings/other', description: 'Calendario allenamenti settimanali' },
  { key: 'matches', label: 'Convocazioni e partite', icon: 'trophy', color: '#E65100', route: '/admin/matches', description: 'Gestione gare e convocazioni' },
  { key: 'attendance', label: 'Presenze e QR', icon: 'checkmark-done', color: '#4527A0', route: '/admin/attendance', description: 'Presenze allenamenti/partite, scanner QR' },
  { key: 'communications', label: 'Comunicazioni', icon: 'megaphone', color: '#6A1B9A', route: '/admin/broadcast', description: 'Broadcast e comunicazioni push/email' },
  { key: 'events', label: 'Eventi in programma', icon: 'calendar', color: '#F9A825', route: '/admin/preseason', description: 'Pre-iscrizioni, Open Day, eventi' },
  { key: 'certificates', label: 'Certificati medici', icon: 'medical', color: '#C62828', route: '/admin/certificates', description: 'Scadenze e archivio certificati' },
  { key: 'gdpr_view', label: 'GDPR (lettura)', icon: 'shield-checkmark', color: '#455A64', route: '/admin/gdpr', description: 'Documenti GDPR firmati (solo lettura)' },
];

export default function CoordinatorDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    // Legge i permessi dallo user object caricato da /auth/me
    const p = (user as any)?.coordinator_permissions || [];
    setPerms(p);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const allowed = SECTIONS.filter(s => perms.includes(s.key));

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <SocietyBranding />
          {/* 🆕 16/07/2026 — "Cappello" del Coordinatore: badge visibile con icona
              graduation-cap + label COORDINATORE, così l'utente ha conferma visiva
              del ruolo attivo (specchio dei badge Admin/Dirigente). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#FFB300', borderRadius: 14,
                paddingHorizontal: 10, paddingVertical: 4,
              }}
              data-testid="coordinatore-role-badge"
            >
              <Ionicons name="school" size={14} color="#3E2723" />
              <Text style={{ color: '#3E2723', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
                COORDINATORE
              </Text>
            </View>
          </View>
          <Text style={styles.title}>Coordinatore</Text>
          <Text style={styles.subtitle}>{user?.first_name} {user?.last_name}</Text>
        </View>
        <GuideButton role="coordinatore" compact />
        {/* 🆕 16/07/2026 — Switch to Dirigente per dual-role Coordinatore+Dirigente */}
        <TouchableOpacity
          onPress={() => router.replace('/dirigente')}
          style={{ marginLeft: 8, backgroundColor: '#fff', borderRadius: 20, padding: 8 }}
          data-testid="switch-to-dirigente-btn"
        >
          <Ionicons name="briefcase" size={20} color="#8E44AD" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 8 }} data-testid="coord-logout">
          <Ionicons name="log-out-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {allowed.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={48} color="#CCC" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#666', marginTop: 12, textAlign: 'center' }}>Nessuna sezione attiva</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
              Il Main Admin deve ancora assegnarti le sezioni di lavoro. Contattalo per ricevere i permessi.
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Sezioni abilitate: {allowed.length}
            </Text>
            {allowed.map(s => (
              <TouchableOpacity
                key={s.key}
                onPress={() => s.route && router.push(s.route as any)}
                style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: s.color }}
                data-testid={`coord-section-${s.key}`}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: s.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={s.icon} size={22} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>{s.label}</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{s.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#1565C0', paddingTop: 40, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  subtitle: { color: '#BBDEFB', fontSize: 12 },
});
