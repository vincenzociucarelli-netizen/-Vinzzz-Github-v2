import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import api from '../services/api';
import { webSafeAlert } from './webSafeAlert';

/**
 * 🆕 Apertura cross-platform dei PDF dei documenti firmati.
 *
 * BUG RISOLTO: le pagine profilo (coach/collaboratore/dirigente) usavano tag
 * HTML grezzi (`<a href>` / `<div onClick>`) per scaricare i PDF. Su iOS/Android
 * questi tag NON esistono in React Native → la pagina crashava (schermata bianca)
 * appena l'utente aveva almeno un documento firmato.
 *
 * Soluzione: funzione unica che segrega la logica:
 *  - WEB: scarica come Blob e apre il PDF in una nuova scheda (fallback download).
 *  - NATIVE: scarica i byte, li scrive in cache (expo-file-system) e apre il foglio
 *    di condivisione del sistema (expo-sharing) per visualizzare/salvare il PDF.
 *
 * Il pattern native replica quello già collaudato in app/admin/athlete/[id].tsx.
 */

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_');
}

export async function openSignedDocument(doc: { id: string; document_title?: string }): Promise<void> {
  const filename = sanitizeFilename(`${doc.document_title || 'documento'}_${(doc.id || '').slice(-8)}.pdf`);

  try {
    if (Platform.OS === 'web') {
      const response = await api.get(`/documents/signed/${doc.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newWin) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
      return;
    }

    // NATIVE (iOS / Android)
    const response = await api.get(`/documents/signed/${doc.id}/pdf`, { responseType: 'arraybuffer' });
    const bytes = new Uint8Array(response.data as ArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // Legacy API: proven working in admin/athlete/[id].tsx
    const FileSystem = require('expo-file-system/legacy');
    const localUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: doc.document_title || 'Documento',
        UTI: 'com.adobe.pdf',
      });
    } else {
      webSafeAlert('Documento salvato', `File salvato in: ${localUri}`);
    }
  } catch (err: any) {
    console.error('openSignedDocument error:', err);
    let msg = 'Impossibile aprire il documento';
    if (err?.response?.status === 401) {
      msg = 'Sessione scaduta. Effettua nuovamente il login.';
    } else if (Platform.OS === 'web' && err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        msg = json.detail || msg;
      } catch { /* no-op */ }
    } else if (err?.response?.data?.detail) {
      msg = err.response.data.detail;
    }
    webSafeAlert('Errore', msg);
  }
}
