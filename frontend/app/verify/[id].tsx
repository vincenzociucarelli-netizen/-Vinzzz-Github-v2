import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

/**
 * Public document authenticity verification page.
 *
 * Reached by scanning the QR code on signed PDFs. Fetches verification info
 * from the backend (no auth required) and renders a sober, mobile-friendly
 * page showing only the authenticity proof (masked name, signing timestamp,
 * threshold/month, ID, hash).
 */
export default function VerifyDocumentPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const docId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!docId) {
        setError('ID documento mancante');
        setLoading(false);
        return;
      }
      try {
        const apiUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '';
        const res = await fetch(`${apiUrl}/api/documents/verify/${docId}?format=json`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) {
          if (cancelled) return;
          setError(res.status === 404 ? 'Documento non trovato' : 'Errore di verifica');
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Errore di rete');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: '#f5f5f5' }]}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={{ marginTop: 12, color: '#666' }}>Verifica in corso…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.center, { backgroundColor: '#f5f5f5', padding: 24 }]}>
        <Text style={{ fontSize: 48, color: '#D32F2F' }}>✕</Text>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#D32F2F', marginTop: 12, textAlign: 'center' }}>
          {error}
        </Text>
        <Text style={{ color: '#666', marginTop: 8, textAlign: 'center', maxWidth: 400 }}>
          L'identificativo non corrisponde ad alcun documento firmato nei nostri archivi, oppure il QR code non è leggibile.
        </Text>
        <Text style={{ color: '#999', marginTop: 16, fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace' }}>
          ID: {docId}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#f5f5f5' }} contentContainerStyle={{ padding: 16 }}>
      <View style={s.box}>
        <View style={s.header}>
          <View style={s.badge}>
            <Text style={s.badgeText}>✓ DOCUMENTO AUTENTICO</Text>
          </View>
          <Text style={s.headerTitle}>{data.type_label}</Text>
        </View>
        <View style={s.body}>
          <Row label="Società" value={data.society_name || '—'} />
          <Row label="Firmatario" value={data.signer_masked || '—'} />
          <RowMultiline
            label="Data firma"
            value={data.signed_at_rome || '—'}
            sub="(Europe/Rome)"
          />
          {data.kind === 'threshold' ? (
            <>
              <Row label="Soglia superata" value={`€ ${data.threshold === '15000' ? '15.000' : '5.000'}`} />
              <Row label="Mese di superamento" value={data.month_ref || '—'} />
            </>
          ) : (
            <>
              <Row label="Mese di riferimento" value={data.month_ref || '—'} />
              <Row label="Importo lordo" value={data.amount_str || '—'} />
            </>
          )}
          <Row label="ID documento" value={data.document_id} mono />
          <Row label="Hash firma" value={`${data.signature_hash_prefix || ''}…`} mono last />
          <View style={s.note}>
            <Text style={s.noteText}>
              Per tutela della privacy non vengono mostrati nome completo, codice fiscale, importo dettagliato o immagine della firma. Questa pagina prova solo l'<Text style={{ fontWeight: 'bold' }}>esistenza e l'autenticità</Text> della firma elettronica sul documento.
            </Text>
          </View>
        </View>
        <View style={s.foot}>
          <Text style={s.footText}>Generato da RegistraTEAM</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={[s.val, mono && { fontFamily: 'monospace', fontSize: 11 }]} selectable>
        {value}
      </Text>
    </View>
  );
}

function RowMultiline({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.lbl}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.val}>{value}</Text>
        {sub && <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: {
    backgroundColor: '#fff',
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  header: { backgroundColor: '#2E7D32', padding: 22, alignItems: 'center' },
  badge: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: { color: '#2E7D32', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', lineHeight: 24, textAlign: 'center' },
  body: { padding: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lbl: { color: '#666', fontWeight: '500', fontSize: 14, flexShrink: 0, paddingRight: 12 },
  val: { color: '#222', fontWeight: '600', fontSize: 14, textAlign: 'right', flexShrink: 1 },
  note: {
    backgroundColor: '#FFF9E5',
    borderLeftWidth: 3,
    borderLeftColor: '#FBC02D',
    padding: 12,
    marginTop: 16,
    borderRadius: 6,
  },
  noteText: { fontSize: 12, color: '#666', lineHeight: 18 },
  foot: { padding: 12, alignItems: 'center' },
  footText: { fontSize: 11, color: '#999' },
});
