import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
}

/**
 * Generic in-app PDF viewer modal.
 *
 * 🐛 10/07/2026 (v7.15) — HOTFIX "PDF non si apre su Chrome Android".
 * Chrome mobile Android NON renderizza PDF inline dentro <iframe> con blob URL:
 * mostra un placeholder generico con "Apri" (che apre un'app esterna se
 * installata, altrimenti non fa nulla). Per garantire l'accesso al documento
 * su qualunque dispositivo aggiungiamo un bottone "SCARICA" affidabile che
 * salva il PDF con nome leggibile.
 *
 * Su desktop e iOS l'iframe continua a renderizzare inline (funziona bene).
 */
export const InAppPdfModal: React.FC<Props> = ({ visible, url, title, onClose }) => {
  // Android hardware back: close the modal instead of exiting the app.
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!url) return null;

  const _safeFilename = (() => {
    const base = (title || 'documento').replace(/[^\w.\-]+/g, '_').replace(/_+$/, '');
    return `${base}.pdf`;
  })();

  const handleDownload = () => {
    // Su web: crea un anchor con `download` e scatena il click programmatico.
    // Chrome mobile Android salverà il file in Downloads con il nome corretto.
    if (Platform.OS !== 'web' || !url) return;
    try {
      // @ts-ignore document/window sono globali su react-native-web
      const a = document.createElement('a');
      a.href = url;
      a.download = _safeFilename;
      // @ts-ignore
      document.body.appendChild(a);
      a.click();
      // @ts-ignore
      document.body.removeChild(a);
    } catch {
      // Fallback: apri in nuova scheda
      // @ts-ignore
      window.open(url, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    if (Platform.OS !== 'web' || !url) return;
    try {
      // @ts-ignore
      window.open(url, '_blank');
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            data-testid="in-app-pdf-back-btn"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Documento'}
          </Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            data-testid="in-app-pdf-close-btn"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {Platform.OS === 'web' ? (
            // @ts-ignore — iframe is fine on react-native-web
            <iframe
              src={url}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={title || 'Documento PDF'}
            />
          ) : (
            <View style={styles.fallback}>
              <Text style={styles.fallbackText}>
                Apertura PDF su dispositivo non supportata in modale.
              </Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          {Platform.OS === 'web' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.downloadBtn]}
                onPress={handleDownload}
                data-testid="in-app-pdf-download-btn"
              >
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>SCARICA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.newTabBtn]}
                onPress={handleOpenInNewTab}
                data-testid="in-app-pdf-newtab-btn"
              >
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>NUOVA SCHEDA</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.hint}>
            💡 Su Android il tasto &quot;Apri&quot; del riquadro grigio spesso NON funziona.
            Usa <Text style={{ fontWeight: '700', color: '#2E7D32' }}>SCARICA</Text> per salvare il PDF e aprirlo con la tua app (Google Drive, Adobe, ecc.).
          </Text>
          <TouchableOpacity
            style={styles.closeBigBtn}
            onPress={onClose}
            data-testid="in-app-pdf-close-big-btn"
          >
            <Text style={styles.closeBigBtnText}>CHIUDI</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  closeBtn: { padding: 4 },
  title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  body: { flex: 1, backgroundColor: '#fff' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { color: '#333', textAlign: 'center' },
  footer: {
    backgroundColor: '#fff',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
  },
  downloadBtn: { backgroundColor: '#2E7D32' },
  newTabBtn: { backgroundColor: '#455A64' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  hint: { fontSize: 11, color: '#666', textAlign: 'center', lineHeight: 15 },
  closeBigBtn: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBigBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
