import { Alert } from 'react-native';
import { router } from 'expo-router';

/**
 * Intercetta gli errori di tipo ANAGRAFICA_INCOMPLETA restituiti dal backend
 * quando l'utente prova a firmare un documento senza aver completato il proprio
 * profilo. Mostra un Alert chiaro con la lista dei campi mancanti e propone di
 * aprire la pagina profilo per completarla.
 *
 * Ritorna `true` se l'errore è stato gestito (è anagrafica incompleta), in tal
 * caso il chiamante NON deve mostrare ulteriori Alert/toast.
 */
export function handleAnagraficaError(error: any, profileRoute = '/profile'): boolean {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === 'object' && detail.code === 'ANAGRAFICA_INCOMPLETA') {
    const missingList: string[] = Array.isArray(detail.missing_labels) ? detail.missing_labels : [];
    const missingText = missingList.length
      ? '\n\nCampi mancanti:\n• ' + missingList.join('\n• ')
      : '';
    Alert.alert(
      'Anagrafica incompleta',
      'Per firmare documenti devi prima completare la tua anagrafica.' + missingText,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Vai a Profilo',
          onPress: () => {
            try {
              router.push(profileRoute as any);
            } catch {
              // fallback silenzioso
            }
          },
        },
      ]
    );
    return true;
  }
  return false;
}
