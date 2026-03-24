import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/components/Icon';

export default function PrivacyPolicy() {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => backHandler.remove();
  }, [goBack]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} data-testid="back-button">
          <Ionicons name="arrow-back" size={28} color="#1565C0" />
          <Text style={{ color: '#1565C0', fontSize: 16, marginLeft: 4, fontWeight: '600' }}>Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informativa sulla Privacy</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.title}>Privacy Policy - RegistraTEAM</Text>
        <Text style={styles.date}>Ultimo aggiornamento: 13 marzo 2026</Text>

        <Text style={styles.sectionTitle}>1. Introduzione</Text>
        <Text style={styles.text}>
          RegistraTEAM è un'applicazione progettata per supportare associazioni sportive dilettantistiche nella gestione delle squadre e nella registrazione delle presenze agli allenamenti. La presente informativa descrive come vengono trattati i dati personali degli utenti che utilizzano l'applicazione.
        </Text>

        <Text style={styles.sectionTitle}>2. Titolare del trattamento</Text>
        <Text style={styles.text}>
          Il titolare del trattamento dei dati personali è l'associazione sportiva dilettantistica che utilizza RegistraTEAM per la gestione dei propri atleti e delle attività sportive. L'associazione decide quali dati inserire nel sistema, le finalità del trattamento e i soggetti autorizzati ad accedere alle informazioni.
        </Text>

        <Text style={styles.sectionTitle}>3. Responsabile del trattamento</Text>
        <Text style={styles.text}>
          Il servizio RegistraTEAM fornisce l'infrastruttura tecnica necessaria al funzionamento dell'applicazione e può operare come responsabile del trattamento limitatamente alle attività tecniche di gestione, manutenzione e sicurezza del sistema. Gli amministratori tecnici del servizio possono accedere ai sistemi informatici esclusivamente per attività di manutenzione, supporto tecnico o risoluzione di problemi.
        </Text>

        <Text style={styles.sectionTitle}>4. Tipologia di dati trattati e modalità</Text>
        <Text style={styles.text}>
          L'applicazione può trattare le seguenti categorie di dati:{'\n'}{'\n'}
          {'\u2022'} Nome e cognome dell'atleta{'\n'}
          {'\u2022'} Squadra di appartenenza{'\n'}
          {'\u2022'} Presenze agli allenamenti{'\n'}
          {'\u2022'} Identificativo QR associato all'atleta{'\n'}
          {'\u2022'} Informazioni tecniche di accesso all'app (log di sistema){'\n'}{'\n'}
          L'applicazione non raccoglie dati sanitari né dati sensibili.{'\n'}{'\n'}
          La società può avvalersi di applicativi gestionali informatici per supportare l'organizzazione delle attività sportive e amministrative. Tali strumenti hanno funzione di supporto operativo e non sostituiscono le responsabilità organizzative della società.
        </Text>

        <Text style={styles.sectionTitle}>5. Finalità del trattamento</Text>
        <Text style={styles.text}>
          I dati personali sono trattati esclusivamente per:{'\n'}{'\n'}
          {'\u2022'} gestione degli atleti delle squadre sportive{'\n'}
          {'\u2022'} registrazione delle presenze agli allenamenti{'\n'}
          {'\u2022'} consultazione delle statistiche di partecipazione{'\n'}
          {'\u2022'} gestione organizzativa delle attività sportive dell'associazione
        </Text>

        <Text style={styles.sectionTitle}>6. Conservazione e infrastruttura dei dati</Text>
        <Text style={styles.text}>
          I dati sono archiviati su infrastrutture informatiche situate all'interno dell'Unione Europea. Il database del sistema è ospitato su servizi cloud con data center europei (es. MongoDB Atlas con regioni UE come Milano o Francoforte). Questa scelta garantisce che il trattamento dei dati avvenga nel rispetto della normativa europea sulla protezione dei dati personali.
        </Text>

        <Text style={styles.sectionTitle}>7. Utilizzo di immagini e video</Text>
        <Text style={styles.text}>
          Durante le attività sportive potranno essere realizzate fotografie e/o riprese video degli atleti.{'\n'}{'\n'}
          Le immagini potranno essere utilizzate:{'\n'}
          {'\u2022'} per finalità interne alla società (es. documentazione attività, comunicazioni alle famiglie);{'\n'}
          {'\u2022'} per eventuali attività informative e promozionali della società sportiva (es. sito web, social network, materiale informativo).{'\n'}{'\n'}
          L'utilizzo per finalità promozionali è subordinato al consenso specifico del genitore/tutore.{'\n'}{'\n'}
          Il consenso all'utilizzo delle immagini può essere revocato in qualsiasi momento mediante richiesta al Titolare del trattamento.
        </Text>

        <Text style={styles.sectionTitle}>8. Sicurezza</Text>
        <Text style={styles.text}>
          RegistraTEAM adotta misure tecniche e organizzative adeguate per proteggere i dati personali, tra cui:{'\n'}{'\n'}
          {'\u2022'} autenticazione degli utenti{'\n'}
          {'\u2022'} controlli di accesso alle informazioni{'\n'}
          {'\u2022'} protezione dei sistemi informatici{'\n'}
          {'\u2022'} monitoraggio dei log di accesso
        </Text>

        <Text style={styles.sectionTitle}>9. Conservazione dei dati</Text>
        <Text style={styles.text}>
          I dati vengono conservati per il tempo necessario alla gestione delle attività sportive dell'associazione e possono essere modificati o eliminati dagli amministratori dell'associazione stessa.
        </Text>

        <Text style={styles.sectionTitle}>10. Condivisione dei dati</Text>
        <Text style={styles.text}>
          I dati non vengono venduti né condivisi con terze parti per finalità commerciali. Possono essere accessibili esclusivamente a:{'\n'}{'\n'}
          {'\u2022'} allenatori e dirigenti autorizzati dall'associazione{'\n'}
          {'\u2022'} amministratori tecnici del sistema per finalità di manutenzione
        </Text>

        <Text style={styles.sectionTitle}>11. Diritti degli interessati</Text>
        <Text style={styles.text}>
          Gli interessati possono esercitare i diritti previsti dal Regolamento Europeo (UE) 2016/679 (GDPR), tra cui:{'\n'}{'\n'}
          {'\u2022'} accesso ai propri dati personali{'\n'}
          {'\u2022'} richiesta di rettifica o aggiornamento{'\n'}
          {'\u2022'} richiesta di cancellazione dei dati{'\n'}
          {'\u2022'} limitazione del trattamento{'\n'}{'\n'}
          Le richieste devono essere rivolte all'associazione sportiva titolare del trattamento.
        </Text>

        <Text style={styles.sectionTitle}>12. Modifiche alla presente informativa</Text>
        <Text style={styles.text}>
          La presente Privacy Policy può essere aggiornata nel tempo. Eventuali modifiche saranno pubblicate all'interno dell'applicazione o sul sito del servizio.
        </Text>

        <Text style={styles.sectionTitle}>13. Contatti</Text>
        <Text style={styles.text}>
          Per informazioni relative al trattamento dei dati personali è possibile contattare l'associazione sportiva che utilizza l'applicazione oppure il responsabile tecnico del servizio RegistraTEAM all'indirizzo: privacy@registrateam.app
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 12, flexDirection: 'row', alignItems: 'center', minHeight: 44, minWidth: 44 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  content: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  date: { fontSize: 13, color: '#888', marginBottom: 20, fontStyle: 'italic' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1565C0', marginTop: 20, marginBottom: 8 },
  text: { fontSize: 14, color: '#444', lineHeight: 22 },
});
