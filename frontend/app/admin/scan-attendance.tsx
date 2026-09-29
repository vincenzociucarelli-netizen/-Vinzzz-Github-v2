import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Alert,
  TextInput, Linking, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';
import { formatRomeTime } from '../../src/utils/datetime';

// Web QR scanner (html5-qrcode) — importato dinamicamente solo su web
let Html5QrcodeScanner: any = null;
if (Platform.OS === 'web') {
  try {
    const lib = require('html5-qrcode');
    Html5QrcodeScanner = lib.Html5QrcodeScanner;
  } catch (e) {
    Html5QrcodeScanner = null;
  }
}

export default function AdminScanAttendance() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = typeof params.team_id === 'string' ? params.team_id : '';
  const teamName = typeof params.team_name === 'string' ? params.team_name : '';

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [webActive, setWebActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; text: string } | null>(null);
  const webRef = useRef<any>(null);
  const cooldownRef = useRef(false);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const registerScan = async (code: string, force = false, note = '') => {
    if (!code || !code.trim()) return;
    if (!teamId) { showAlert('Squadra mancante', 'Apri lo scanner dalla scheda della squadra.'); return; }
    setBusy(true);
    try {
      const res = await api.post('/attendance/check', {
        qr_code: code.trim(),
        team_id: teamId,
        force,
        force_note: force ? (note || 'Forzatura admin') : undefined,
      });
      const att = res.data;
      if (att.status === 'already_registered') {
        const t = att.check_in_time ? formatRomeTime(att.check_in_time, '') : '';
        setLastResult({ ok: false, text: `⚠️ ${att.athlete_name || 'Atleta'} già registrato/a oggi${t ? ' alle ' + t : ''}` });
        showAlert('⚠️ Già registrata', `${att.athlete_name || 'Atleta'} è già stato/a registrato/a oggi.`);
      } else if (att.status === 'wrong_team') {
        const confirmForce = Platform.OS === 'web'
          ? window.confirm(`${att.athlete_name} è tesserato/a in ${att.actual_team}. Registrare comunque la presenza in ${teamName}?`)
          : await new Promise<boolean>((resolve) => {
              Alert.alert('Squadra diversa', `${att.athlete_name} è in ${att.actual_team}. Registrare comunque?`, [
                { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Registra', onPress: () => resolve(true) },
              ]);
            });
        if (confirmForce) await registerScan(code, true, `Allenamento con ${teamName}`);
      } else if (att.status === 'blocked') {
        setLastResult({ ok: false, text: `⛔ ${att.athlete_name || 'Atleta'}: ${att.block_reason || 'non autorizzato'}` });
        showAlert('⛔ Accesso negato', `${att.athlete_name || 'Atleta'}\n\n${att.block_reason || 'Non autorizzato'}`);
      } else {
        let badge = '';
        if (att.is_trial) {
          badge = `\n🔵 In prova: ${att.trial_sessions_count}/${att.trial_max_sessions} allenamenti`;
        }
        setLastResult({ ok: true, text: `✅ ${att.athlete_name || 'Atleta'} registrato/a${badge}` });
        showAlert('✅ Presenza registrata', `${att.athlete_name || 'Atleta'}${badge}`);
      }
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setBusy(false);
      setManualCode('');
    }
  };

  const onNativeScan = async ({ data }: { data: string }) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setScanning(false);
    await registerScan(data);
    setTimeout(() => { cooldownRef.current = false; }, 1500);
  };

  const startCamera = async () => {
    if (Platform.OS === 'web') { startWebScanner(); return; }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        if (!res.canAskAgain) {
          Alert.alert('Permesso fotocamera', 'Abilita la fotocamera dalle impostazioni per scansionare i QR.', [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Apri Impostazioni', onPress: () => Linking.openSettings() },
          ]);
        }
        return;
      }
    }
    setScanning(true);
  };

  const startWebScanner = () => {
    if (Platform.OS !== 'web' || !Html5QrcodeScanner) {
      showAlert('Scanner non disponibile', 'Usa l\'inserimento manuale del codice.');
      return;
    }
    setWebActive(true);
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner('admin-qr-scanner', {
          fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true,
        }, false);
        scanner.render(async (decoded: string) => {
          await scanner.clear();
          setWebActive(false);
          await registerScan(decoded);
        }, () => {});
        webRef.current = scanner;
      } catch (e) {
        setWebActive(false);
        showAlert('Errore scanner', 'Impossibile avviare lo scanner. Usa l\'inserimento manuale.');
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (webRef.current) { try { webRef.current.clear(); } catch (e) { /* noop */ } }
    };
  }, []);

  // Vista camera nativa a pieno schermo
  if (scanning && permission?.granted && Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onNativeScan}
        />
        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
          <View style={styles.frame} />
          <Text style={styles.frameText}>Inquadra il QR dell’atleta</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={() => setScanning(false)}>
            <Text style={styles.stopBtnText}>Chiudi scanner</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="scan-back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Scansiona Presenze</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{teamName || 'Squadra'}</Text>
        </View>
        <Ionicons name="qr-code-outline" size={24} color="#fff" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {Platform.OS === 'web' && webActive ? (
          <View>
            <View nativeID="admin-qr-scanner" style={{ width: '100%', minHeight: 320 }} />
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { if (webRef.current) { try { webRef.current.clear(); } catch (e) {} } setWebActive(false); }}>
              <Text style={styles.secondaryBtnText}>Chiudi scanner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.scanBtn} onPress={startCamera} disabled={busy} testID="scan-start">
            <Ionicons name="qr-code" size={28} color="#fff" />
            <Text style={styles.scanBtnText}>Avvia scansione QR</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.orText}>oppure inserisci il codice manualmente</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Codice atleta / QR"
            autoCapitalize="characters"
            testID="scan-manual-input"
          />
          <TouchableOpacity
            style={[styles.manualBtn, (busy || !manualCode.trim()) && { opacity: 0.5 }]}
            onPress={() => registerScan(manualCode)}
            disabled={busy || !manualCode.trim()}
            testID="scan-manual-submit"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualBtnText}>Registra</Text>}
          </TouchableOpacity>
        </View>

        {lastResult && (
          <View style={[styles.resultCard, { backgroundColor: lastResult.ok ? '#E8F5E9' : '#FFEBEE', borderColor: lastResult.ok ? '#A5D6A7' : '#EF9A9A' }]}>
            <Text style={[styles.resultText, { color: lastResult.ok ? '#1B5E20' : '#B71C1C' }]}>{lastResult.text}</Text>
          </View>
        )}

        <Text style={styles.footerHint}>
          Le presenze registrate qui contano come lo scan del coach (anche per il periodo di prova) e sono tracciate negli audit log.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: {
    backgroundColor: '#5856D6', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 1 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#5856D6', paddingVertical: 18, borderRadius: 14,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { marginTop: 12, backgroundColor: '#455A64', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#fff', fontWeight: '700' },
  orText: { textAlign: 'center', color: '#888', marginVertical: 18, fontSize: 13 },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD',
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#222',
  },
  manualBtn: { backgroundColor: '#5856D6', paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  manualBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resultCard: { marginTop: 18, borderRadius: 10, borderWidth: 1, padding: 14 },
  resultText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  footerHint: { fontSize: 11.5, color: '#888', textAlign: 'center', marginTop: 24, fontStyle: 'italic', lineHeight: 17 },
  cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 250, height: 250, borderWidth: 3, borderColor: '#fff', borderRadius: 16, backgroundColor: 'transparent' },
  frameText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 20 },
  stopBtn: { marginTop: 40, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  stopBtnText: { color: '#fff', fontWeight: '700' },
});
