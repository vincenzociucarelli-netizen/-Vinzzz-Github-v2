/**
 * 🆕 27/09/2026 — Popup "Certificati in Scadenza" ridimensionato.
 * Sostituisce l'alert nativo del browser: mostra TUTTI i certificati in scadenza
 * in un elenco scorrevole, con testo selezionabile e pulsante "Copia elenco".
 */
import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Linking, useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '../Icon';
import api from '../../services/api';

interface CertItem {
  id?: string;
  athlete_name?: string;
  expiry_date?: string;
  days_until_expiry?: number | null;
  phone?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  countToday: number;
  count30Days: number;
  expiringToday: CertItem[];
  expiringSoon: CertItem[];
}

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return '';
  }
};

const daysLabel = (n?: number | null) => {
  if (n == null) return '';
  if (n <= 0) return 'scaduto';
  if (n === 1) return 'tra 1 giorno';
  return `tra ${n} giorni`;
};

const ExpiringCertsModal: React.FC<Props> = ({
  visible, onClose, countToday, count30Days, expiringToday, expiringSoon,
}) => {
  const { height } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const plainText = useMemo(() => {
    const lines: string[] = ['CERTIFICATI IN SCADENZA', ''];
    if (countToday > 0) {
      lines.push(`SCADUTI / OGGI (${countToday})`);
      expiringToday.forEach((c) => {
        lines.push(`- ${c.athlete_name || '—'}${c.expiry_date ? `  [${formatDate(c.expiry_date)}]` : ''}`);
      });
      lines.push('');
    }
    if (count30Days > 0) {
      lines.push(`PROSSIMI 30 GIORNI (${count30Days})`);
      expiringSoon.forEach((c) => {
        const dl = daysLabel(c.days_until_expiry);
        lines.push(`- ${c.athlete_name || '—'}${dl ? ` (${dl})` : ''}${c.expiry_date ? `  [${formatDate(c.expiry_date)}]` : ''}`);
      });
    }
    if (countToday === 0 && count30Days === 0) lines.push('Nessun certificato in scadenza.');
    return lines.join('\n');
  }, [countToday, count30Days, expiringToday, expiringSoon]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  // 🆕 27/09/2026 — Sollecito WhatsApp immediato per il singolo atleta.
  const normalizePhone = (raw: string) => {
    let phone = (raw || '').replace(/\D/g, '');
    if (phone.startsWith('00')) phone = phone.substring(2);
    if (phone.startsWith('0') && phone.length <= 11) phone = '39' + phone.replace(/^0+/, '');
    if (!phone.startsWith('39') && (phone.length === 9 || phone.length === 10)) phone = '39' + phone;
    return phone;
  };

  const sendWhatsApp = async (item: CertItem) => {
    if (!item.phone) return;
    setSending(item.id || item.athlete_name || '');
    let message = `Ciao, ricordiamo che il certificato medico di ${item.athlete_name || ''} è in scadenza${item.expiry_date ? ` il ${formatDate(item.expiry_date)}` : ''}. Ti preghiamo di rinnovarlo.`;
    try {
      const r = await api.get('/admin/whatsapp/render', {
        params: { case: 'certificate_expiring', athlete_id: item.id, contact_name: item.athlete_name || '' },
      });
      if (r?.data?.message) message = r.data.message;
    } catch { /* usa messaggio di default */ }

    const phone = normalizePhone(item.phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    try {
      await api.post('/admin/whatsapp/log-sent', {
        case: 'certificate_expiring',
        target_athlete_id: item.id || null,
        target_phone: item.phone,
        message_sent: message,
      });
    } catch { /* non bloccante */ }
    if (Platform.OS === 'web') {
      // @ts-ignore
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
    setSending(null);
  };

  const total = countToday + count30Days;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { maxHeight: height * 0.88 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 20 }}>📄</Text>
              <Text style={styles.title}>Certificati in Scadenza</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID="close-certs-modal">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={[styles.badge, { backgroundColor: '#FDECEA' }]}>
              <Text style={[styles.badgeNum, { color: '#C62828' }]}>{countToday}</Text>
              <Text style={styles.badgeLabel}>Scaduti / Oggi</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.badgeNum, { color: '#EF6C00' }]}>{count30Days}</Text>
              <Text style={styles.badgeLabel}>Prossimi 30 gg</Text>
            </View>
          </View>

          {/* Lista scorrevole */}
          <ScrollView style={styles.listWrap} contentContainerStyle={{ paddingBottom: 12 }}>
            {total === 0 && (
              <Text style={styles.emptyText}>Nessun certificato in scadenza.</Text>
            )}

            {countToday > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: '#C62828' }]}>⚠️ Scaduti / Oggi ({countToday})</Text>
                {expiringToday.map((c, i) => (
                  <View key={`t-${c.id || i}`} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: '#C62828' }]} />
                    {/* @ts-ignore selectable è supportato su web */}
                    <Text selectable style={styles.rowText}>
                      {c.athlete_name || '—'}
                      {c.expiry_date ? `  ·  ${formatDate(c.expiry_date)}` : ''}
                    </Text>
                    {!!c.phone && (
                      <TouchableOpacity
                        style={styles.waBtn}
                        onPress={() => sendWhatsApp(c)}
                        disabled={sending === (c.id || c.athlete_name)}
                        testID={`wa-cert-${c.id || i}`}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                        <Text style={styles.waBtnText}>Sollecita</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}

            {count30Days > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: '#EF6C00', marginTop: countToday > 0 ? 14 : 0 }]}>
                  📋 Prossimi 30 giorni ({count30Days})
                </Text>
                {expiringSoon.map((c, i) => (
                  <View key={`s-${c.id || i}`} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: '#EF6C00' }]} />
                    {/* @ts-ignore selectable è supportato su web */}
                    <Text selectable style={styles.rowText}>
                      {c.athlete_name || '—'}
                      {c.days_until_expiry != null ? `  (${daysLabel(c.days_until_expiry)})` : ''}
                      {c.expiry_date ? `  ·  ${formatDate(c.expiry_date)}` : ''}
                    </Text>
                    {!!c.phone && (
                      <TouchableOpacity
                        style={styles.waBtn}
                        onPress={() => sendWhatsApp(c)}
                        disabled={sending === (c.id || c.athlete_name)}
                        testID={`wa-cert-soon-${c.id || i}`}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                        <Text style={styles.waBtnText}>Sollecita</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {/* Footer azioni */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.copyBtn, copied && { backgroundColor: '#2E7D32' }]}
              onPress={handleCopy}
              disabled={total === 0}
              testID="copy-certs-btn"
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" />
              <Text style={styles.copyBtnText}>{copied ? 'Copiato!' : 'Copia elenco'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.okBtn} onPress={onClose}>
              <Text style={styles.okBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 10px 40px rgba(0,0,0,0.25)' } as any,
      default: { elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    }),
  },
  header: {
    backgroundColor: '#5856D6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10, padding: 12 },
  badge: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  badgeNum: { fontSize: 22, fontWeight: '800' },
  badgeLabel: { fontSize: 12, color: '#555', marginTop: 2 },
  listWrap: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowText: { fontSize: 14, color: '#111', flex: 1 },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  waBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', paddingVertical: 24 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  copyBtn: {
    flex: 1,
    backgroundColor: '#5856D6',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  okBtn: {
    paddingHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEDFB',
  },
  okBtnText: { color: '#5856D6', fontSize: 15, fontWeight: '700' },
});

export default ExpiringCertsModal;
