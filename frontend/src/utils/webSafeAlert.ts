import { Alert, Platform } from 'react-native';

/**
 * 🆕 22/02/2026 — Web-safe Alert wrapper.
 *
 * BUG: react-native-web 0.21 ha `Alert.alert` come NO-OP (funzione vuota).
 * Sintomi: nessun alert/conferma appare mai sul web → l'utente vede solo
 * spinner che parte e si ferma senza feedback (Anna Coach firma €5k bloccata,
 * Sarnari Andrea Pall. Perugia, Fede, ecc.).
 *
 * Soluzione: su Platform.OS === 'web' usiamo window.alert/confirm.
 * Su native (iOS/Android) usiamo l'Alert.alert nativo che funziona normalmente.
 */

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export function webSafeAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS === 'web') {
    const fullText = message ? `${title}\n\n${message}` : title;

    // Nessun bottone o un solo bottone "OK": usiamo window.alert
    if (!buttons || buttons.length <= 1) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(fullText);
      }
      // Esegui callback eventuale del bottone OK
      if (buttons && buttons[0]?.onPress) {
        try { buttons[0].onPress(); } catch { /* no-op */ }
      }
      return;
    }

    // Più bottoni: usiamo window.confirm (OK/Annulla)
    // L'ultimo bottone non-cancel è il "principale" (es. "Vai a Profilo")
    const primary = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];
    const cancel = buttons.find(b => b.style === 'cancel');

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const choice = window.confirm(`${fullText}\n\n[ OK = ${primary.text} ] [ Annulla = ${cancel?.text || 'Annulla'} ]`);
      if (choice && primary.onPress) {
        try { primary.onPress(); } catch { /* no-op */ }
      } else if (!choice && cancel?.onPress) {
        try { cancel.onPress(); } catch { /* no-op */ }
      }
    }
    return;
  }

  // Native: usa Alert.alert standard
  Alert.alert(title, message, buttons as any);
}
