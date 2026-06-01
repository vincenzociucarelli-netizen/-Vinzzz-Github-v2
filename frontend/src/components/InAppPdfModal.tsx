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
 * Opens the given URL inside an <iframe> (web) so the user can close it with
 * the visible "Chiudi" button OR with the Android hardware back button —
 * instead of being kicked out of the webapp when the OS back is pressed.
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
  },
  closeBigBtn: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBigBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
