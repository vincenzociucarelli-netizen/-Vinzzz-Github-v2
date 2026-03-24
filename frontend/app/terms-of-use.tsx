import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/components/Icon';

export default function TermsOfUsePage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#1565C0" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termini di Utilizzo</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.mainTitle}>RegistraTEAM</Text>
        <Text style={styles.subtitle}>Termini di Utilizzo</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Oggetto</Text>
          <Text style={styles.sectionText}>
            RegistraTEAM è un software gestionale per associazioni sportive dilettantistiche.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Natura del servizio</Text>
          <Text style={styles.sectionText}>
            Il software è fornito nello stato in cui si trova, senza garanzia di assenza totale di errori o interruzioni.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Utilizzo</Text>
          <Text style={styles.sectionText}>
            L'app è utilizzata sotto la responsabilità dell'associazione sportiva.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Dati e responsabilità</Text>
          <Text style={styles.sectionText}>
            L'associazione è responsabile della correttezza dei dati e del rispetto delle normative.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Presenze</Text>
          <Text style={styles.sectionText}>
            Le presenze hanno valore organizzativo e statistico.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Pagamenti</Text>
          <Text style={styles.sectionText}>
            I dati relativi ai pagamenti sono inseriti e gestiti dall'associazione. RegistraTEAM non è responsabile per errori nei dati, anche per usi amministrativi o fiscali.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Limitazione di responsabilità</Text>
          <Text style={styles.sectionText}>
            Il fornitore non è responsabile per perdite di dati o danni indiretti.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Backup</Text>
          <Text style={styles.sectionText}>
            La gestione dei dati è responsabilità dell'associazione.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Condizioni economiche</Text>
          <Text style={styles.sectionText}>
            RegistraTEAM è disponibile gratuitamente e senza limiti di funzionalità:{'\n\n'}
            {'\u2022'} fino al 30 settembre 2026 con un limite massimo di 150 utenti registrati (atleti, staff, genitori) per società;{'\n'}
            {'\u2022'} successivamente con limite massimo di 30 utenti registrati per società nella versione gratuita.{'\n\n'}
            Superati i limiti indicati, sarà necessario sottoscrivere un piano a pagamento. Prezzi e condizioni saranno comunicati tramite l'app o il sito ufficiale.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Modifiche</Text>
          <Text style={styles.sectionText}>
            Il servizio può essere aggiornato nel tempo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Accettazione</Text>
          <Text style={styles.sectionText}>
            L'utilizzo dell'app implica l'accettazione dei presenti termini.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#1565C0',
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#1565C0', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  sectionText: { fontSize: 14, color: '#444', lineHeight: 22 },
});
