import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/components/Icon';

export default function TermsOfUse() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1565C0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termini di utilizzo</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.title}>Termini di Utilizzo della Piattaforma RegistraTEAM</Text>
        <Text style={styles.date}>Versione 1.0 - Ultimo aggiornamento: 13 marzo 2026</Text>

        <Text style={styles.sectionTitle}>1. Oggetto del Servizio</Text>
        <Text style={styles.text}>
          RegistraTEAM è una piattaforma gestionale per società sportive dilettantistiche. Consente la gestione digitale di atleti, staff tecnico, dirigenti, certificati medici, presenze, pagamenti e comunicazioni interne.
        </Text>

        <Text style={styles.sectionTitle}>2. Attivazione del Servizio</Text>
        <Text style={styles.text}>
          L'attivazione di RegistraTEAM avviene da parte di un rappresentante autorizzato della società sportiva. Con l'attivazione, la società accetta le presenti condizioni d'uso e si assume la responsabilità della corretta gestione degli account interni (admin, dirigenti, allenatori, collaboratori).
        </Text>

        <Text style={styles.sectionTitle}>3. Ruoli e Responsabilità</Text>
        <Text style={styles.text}>
          La società è responsabile dell'assegnazione dei ruoli all'interno della piattaforma. L'amministratore della piattaforma può creare e gestire utenti con diversi livelli di accesso (admin, dirigente, allenatore, collaboratore, atleta, genitore). La società garantisce che gli utenti ai quali vengono assegnati ruoli operativi siano stati preventivamente autorizzati.
        </Text>

        <Text style={styles.sectionTitle}>4. Trattamento dei Dati Personali</Text>
        <Text style={styles.text}>
          L'utilizzo della piattaforma comporta il trattamento di dati personali degli utenti registrati. La società sportiva opera in qualità di Titolare del trattamento ai sensi del Regolamento UE 2016/679 (GDPR). Il fornitore della piattaforma opera in qualità di Responsabile del trattamento, garantendo adeguate misure di sicurezza tecniche e organizzative. Ogni utente riceve un'informativa privacy al momento della registrazione e, dove previsto, presta il proprio consenso digitale. I dettagli sono indicati nell'Informativa Privacy della piattaforma.
        </Text>

        <Text style={styles.sectionTitle}>5. Certificati Medici Sportivi</Text>
        <Text style={styles.text}>
          La piattaforma consente la registrazione della data di emissione e di scadenza dei certificati medici sportivi degli atleti. Non è previsto il caricamento o la conservazione digitale di copie dei certificati medici. La custodia del documento originale resta a carico della società sportiva, in conformità con la normativa vigente.
        </Text>

        <Text style={styles.sectionTitle}>6. Attestati di Versamento</Text>
        <Text style={styles.text}>
          La piattaforma può gestire la registrazione delle quote associative e dei contributi sportivi. Non sostituisce la documentazione fiscale ufficiale. La società è tenuta a conservare i documenti contabili e fiscali secondo le normative vigenti.
        </Text>

        <Text style={styles.sectionTitle}>7. Versione Gratuita del Servizio</Text>
        <Text style={styles.text}>
          RegistraTEAM è disponibile gratuitamente e senza limiti di funzionalità:{'\n'}{'\n'}
          {'\u2022'} fino al 30 giugno 2026 con un limite massimo di 150 utenti registrati (atleti, staff, genitori) per società;{'\n'}
          {'\u2022'} successivamente con limite massimo di 30 utenti registrati per società nella versione gratuita.{'\n'}{'\n'}
          Il fornitore si riserva la facoltà di modificare nel tempo limiti di utilizzo, funzionalità e condizioni economiche del servizio.
        </Text>

        <Text style={styles.sectionTitle}>8. Limitazione di Responsabilità</Text>
        <Text style={styles.text}>
          Il fornitore non è responsabile per eventuali danni diretti o indiretti derivanti dall'uso improprio della piattaforma, dalla perdita di dati dovuta a cause esterne, o dall'utilizzo non conforme alle presenti condizioni. Il servizio è fornito "così com'è" e il fornitore si impegna a garantire la continuità del servizio nei limiti delle proprie possibilità tecniche.
        </Text>

        <Text style={styles.sectionTitle}>9. Accettazione</Text>
        <Text style={styles.text}>
          L'attivazione della piattaforma implica la piena accettazione dei presenti Termini di Utilizzo. Il fornitore si riserva il diritto di aggiornare i presenti termini, dandone comunicazione agli utenti registrati tramite la piattaforma stessa o via email. L'utilizzo continuato del servizio successivamente alla modifica dei termini costituisce accettazione delle nuove condizioni. Per qualsiasi richiesta relativa ai presenti termini è possibile contattare il fornitore tramite i canali indicati nella piattaforma o nel sito web dell'attività sportiva.
        </Text>

        <View style={styles.contactBox}>
          <Text style={styles.contactText}>
            Per informazioni: privacy@registrateam.app
          </Text>
        </View>
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  content: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  date: { fontSize: 13, color: '#888', marginBottom: 20, fontStyle: 'italic' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1565C0', marginTop: 20, marginBottom: 8 },
  text: { fontSize: 14, color: '#444', lineHeight: 22 },
  contactBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  contactText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },
});
