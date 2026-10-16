import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * 🆕 Informativa mostrata PRIMA della firma della quietanza (punto 4).
 * Con la firma il collaboratore dichiara di aver ricevuto il NETTO, di essere
 * consapevole che lordo e netto possono differire per le trattenute previdenziali,
 * che RegistraTEAM usa progressivi distinti (previdenziale/fiscale) e di aver
 * dichiarato correttamente i compensi pregressi e quelli presso altri committenti.
 */
export default function CompensoInformativa() {
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Ionicons name="information-circle-outline" size={18} color="#1565C0" />
        <Text style={styles.title}>Informativa prima della firma</Text>
      </View>
      <Text style={styles.text}>
        Con la firma dichiaro di aver ricevuto l'importo netto indicato nella quietanza.
        Sono consapevole che il compenso lordo e il netto effettivamente ricevuto possono
        essere diversi in presenza di trattenute previdenziali. Ai fini del monitoraggio
        delle soglie, RegistraTEAM utilizza progressivi distinti (previdenziale e fiscale),
        secondo la normativa applicabile. Dichiaro inoltre di aver comunicato correttamente
        gli eventuali compensi pregressi e quelli percepiti presso altri committenti.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  text: { fontSize: 11, color: '#37474F', lineHeight: 16 },
});
