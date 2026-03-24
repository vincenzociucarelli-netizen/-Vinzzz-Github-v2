import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/components/Icon';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#1565C0" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informativa sulla Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.mainTitle}>RegistraTEAM</Text>
        <Text style={styles.subtitle}>Privacy Policy</Text>
        <Text style={styles.updateDate}>Ultimo aggiornamento: 23 marzo 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Introduzione</Text>
          <Text style={styles.sectionText}>
            RegistraTEAM è un'applicazione progettata per supportare associazioni sportive dilettantistiche nella gestione delle squadre, delle presenze e delle attività amministrative.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Titolare del trattamento</Text>
          <Text style={styles.sectionText}>
            Il titolare del trattamento è l'associazione sportiva che utilizza l'applicazione.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Responsabile del trattamento</Text>
          <Text style={styles.sectionText}>
            RegistraTEAM fornisce l'infrastruttura tecnica e può operare come responsabile del trattamento per attività tecniche e manutenzione.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Dati trattati</Text>
          <Text style={styles.sectionText}>
            {'\u2022'} Nome e cognome{'\n'}
            {'\u2022'} Squadra di appartenenza{'\n'}
            {'\u2022'} Presenze agli allenamenti{'\n'}
            {'\u2022'} Email{'\n'}
            {'\u2022'} Numero di telefono{'\n'}
            {'\u2022'} Identificativo QR{'\n'}
            {'\u2022'} Dati relativi ai pagamenti (importo, data, numero rata, stato pagamento){'\n'}
            {'\u2022'} Informazioni relative all'idoneità sportiva (tipologia certificato, data emissione, validità, scadenza){'\n'}
            {'\u2022'} Log tecnici
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Finalità</Text>
          <Text style={styles.sectionText}>
            {'\u2022'} Gestione atleti e squadre{'\n'}
            {'\u2022'} Registrazione presenze{'\n'}
            {'\u2022'} Accesso all'app (login){'\n'}
            {'\u2022'} Comunicazioni tra utenti{'\n'}
            {'\u2022'} Invio notifiche{'\n'}
            {'\u2022'} Gestione quote associative{'\n'}
            {'\u2022'} Generazione attestati per uso amministrativo/fiscale
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Infrastruttura</Text>
          <Text style={styles.sectionText}>
            I dati sono archiviati su server situati nell'Unione Europea.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Conservazione</Text>
          <Text style={styles.sectionText}>
            I dati sono conservati per il tempo necessario alle attività sportive e amministrative.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Sicurezza</Text>
          <Text style={styles.sectionText}>
            Sono adottate misure tecniche adeguate per proteggere i dati.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Condivisione dei dati</Text>
          <Text style={styles.sectionText}>
            I dati non vengono venduti e sono accessibili solo a personale autorizzato e amministratori tecnici.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Diritti</Text>
          <Text style={styles.sectionText}>
            Gli utenti possono esercitare i diritti GDPR rivolgendosi all'associazione.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Modifiche</Text>
          <Text style={styles.sectionText}>
            La policy può essere aggiornata nel tempo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contatti</Text>
          <Text style={styles.sectionText}>
            Contattare l'associazione sportiva o il servizio RegistraTEAM.
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
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 4 },
  updateDate: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  sectionText: { fontSize: 14, color: '#444', lineHeight: 22 },
});
