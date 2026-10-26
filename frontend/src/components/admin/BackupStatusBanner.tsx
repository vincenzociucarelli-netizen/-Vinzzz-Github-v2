import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../Icon';
import api from '../../services/api';

export default function BackupStatusBanner() {
  const router = useRouter();
  const [info, setInfo] = useState<{ last: string | null; enabled: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get('/admin/backup/schedule');
        if (alive) setInfo({ last: r.data?.last_backup_at || null, enabled: !!r.data?.enabled });
      } catch {
        if (alive) setInfo({ last: null, enabled: false });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!info) return null;

  let daysAgo = Infinity;
  let dateLabel = '';
  if (info.last) {
    const d = new Date(info.last);
    dateLabel = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
  }
  const ok = info.last && daysAgo <= 7;

  return (
    <TouchableOpacity
      style={[styles.banner, ok ? styles.ok : styles.warn]}
      onPress={() => router.push('/admin/settings/export-data')}
      activeOpacity={0.85}
    >
      <Ionicons
        name={ok ? 'shield-checkmark' : 'warning'}
        size={20}
        color={ok ? '#1B5E20' : '#8A6D00'}
      />
      <View style={{ flex: 1 }}>
        {info.last ? (
          <Text style={[styles.text, ok ? styles.textOk : styles.textWarn]}>
            Ultimo backup: {dateLabel}{daysAgo > 7 ? ` (${daysAgo} giorni fa)` : ''}
          </Text>
        ) : (
          <Text style={[styles.text, styles.textWarn]}>Nessun backup ancora eseguito</Text>
        )}
        <Text style={styles.sub}>
          {info.enabled ? 'Backup automatico attivo · tocca per gestire' : 'Tocca per attivare il backup automatico'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ok ? '#1B5E20' : '#8A6D00'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  ok: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  warn: { backgroundColor: '#FFF8E1', borderColor: '#FFE082' },
  text: { fontSize: 13.5, fontWeight: '700' },
  textOk: { color: '#1B5E20' },
  textWarn: { color: '#8A6D00' },
  sub: { fontSize: 11, color: '#777', marginTop: 2 },
});
