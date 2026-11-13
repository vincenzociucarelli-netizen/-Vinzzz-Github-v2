import { Alert, Platform } from 'react-native';

export type ResetMode = 'all' | 'unsigned' | null;

/**
 * Chiede all'admin COME azzerare i compensi:
 *  - 'all'      → elimina tutto, anche i compensi firmati/percepiti (utenti di test)
 *  - 'unsigned' → elimina solo le quietanze NON firmate (mantiene i firmati, utenti reali)
 *  - null       → annullato
 */
export function chooseResetMode(personName: string): Promise<ResetMode> {
  const name = personName || 'questa persona';
  if (Platform.OS === 'web') {
    // Web: due conferme in sequenza (window.confirm è solo a 2 vie)
    const keepSigned = window.confirm(
      `Azzera compensi di ${name}.\n\n` +
      `OK = elimina SOLO le quietanze NON firmate (mantiene i firmati/percepiti).\n` +
      `Annulla = scegli di eliminare TUTTO.`
    );
    if (keepSigned) return Promise.resolve('unsigned');
    const all = window.confirm(
      `Vuoi eliminare TUTTI i compensi di ${name}, compresi quelli già firmati/percepiti?\n\n` +
      `Operazione irreversibile. (adatta agli utenti di test)`
    );
    return Promise.resolve(all ? 'all' : null);
  }
  return new Promise<ResetMode>((resolve) => {
    Alert.alert(
      'Azzera compensi',
      `Come vuoi azzerare i compensi di ${name}?`,
      [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Solo i non firmati', onPress: () => resolve('unsigned') },
        { text: 'Tutti (anche firmati)', style: 'destructive', onPress: () => resolve('all') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}
