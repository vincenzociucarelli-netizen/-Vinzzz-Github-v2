/**
 * Pulsante compatto Bacheca Note Admin per la dashboard.
 * 🆕 19/07/2026.
 *
 * Al posto di occupare spazio permanente sulla dashboard, mostriamo un semplice
 * pulsante che:
 *   - Riporta il conteggio delle note attive
 *   - Se ci sono note "urgenti" (priorità alta o scadute/in scadenza)
 *     si trasforma in "pulsante" animato con ombra pulsante + colore acceso
 *   - Al click porta a /admin/notes (pagina dedicata con la bacheca completa)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../services/api';

interface AdminNoteSummary {
  id: string;
  priority: 'high' | 'medium' | 'low';
  due_date?: string | null;
  completed: boolean;
}

function isUrgent(n: AdminNoteSummary): boolean {
  if (n.priority === 'high') return true;
  if (n.due_date) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(n.due_date + 'T00:00:00');
      const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000);
      if (diffDays <= 3) return true; // scadute, oggi o entro 3 giorni
    } catch {
      // ignore
    }
  }
  return false;
}

export const AdminNotesButton: React.FC = () => {
  const [notes, setNotes] = useState<AdminNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/notes');
      setNotes(res.data || []);
    } catch {
      // non admin: nasconde silenziosamente
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // ricarica ogni 60s per aggiornare contatore/urgenza in background
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const activeCount = notes.length;
  const urgentCount = useMemo(() => notes.filter(isUrgent).length, [notes]);
  const hasUrgent = urgentCount > 0;

  // Animazione pulsating: solo se ci sono urgenze
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (hasUrgent) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulse.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [hasUrgent, pulse]);

  if (loading || activeCount === 0 && !hasUrgent && notes.length === 0) {
    // Se non ci sono note affatto (o loading), mostriamo comunque un pulsante calmo
    // per permettere all'admin di creare la prima nota.
  }
  if (loading) return null;

  const goToNotes = () => router.push('/admin/notes');

  const urgentStyle = hasUrgent ? styles.urgent : styles.normal;
  const iconColor = hasUrgent ? '#fff' : '#1a237e';
  const textColor = hasUrgent ? '#fff' : '#1a237e';
  const subColor = hasUrgent ? '#FFE0E0' : '#666';

  return (
    <View style={styles.wrapper}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={[styles.button, urgentStyle]}
          onPress={goToNotes}
          activeOpacity={0.85}
          testID="admin-notes-button"
        >
          <View style={styles.iconWrap}>
            <Ionicons name="bookmark" size={22} color={iconColor} />
            {activeCount > 0 && (
              <View style={styles.badge} testID="admin-notes-button-badge">
                <Text style={styles.badgeText}>{activeCount > 99 ? '99+' : activeCount}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: textColor }]}>
              {hasUrgent ? '⚠️ Note Admin — azioni urgenti' : 'Bacheca Note Admin'}
            </Text>
            <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
              {activeCount === 0
                ? 'Nessuna nota attiva • Tocca per aggiungerne una'
                : hasUrgent
                ? `${urgentCount} da gestire subito • ${activeCount} attive in totale`
                : `${activeCount} ${activeCount === 1 ? 'nota attiva' : 'note attive'}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={hasUrgent ? '#fff' : '#666'} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginTop: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  normal: {
    backgroundColor: '#F8F9FE',
    borderColor: '#E3E7F5',
  },
  urgent: {
    backgroundColor: '#C62828',
    borderColor: '#8B0000',
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: { position: 'relative', width: 30, alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#EF6C00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
});

export default AdminNotesButton;
