import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const TERMS_TEXT = `TERMINI DI UTILIZZO DELLA PIATTAFORMA
REGISTRATEAM

Versione 1.0

1. OGGETTO DEL SERVIZIO
RegistraTEAM è una piattaforma gestionale per società sportive dilettantistiche. Consente la gestione digitale di atleti, staff tecnico, dirigenti, certificati medici, presenze, pagamenti e comunicazioni interne.

2. ATTIVAZIONE DEL SERVIZIO
L'attivazione di RegistraTEAM avviene da parte di un rappresentante autorizzato della società sportiva. Con l'attivazione, la società accetta le presenti condizioni d'uso e si assume la responsabilità della corretta gestione degli account interni (admin, dirigenti, allenatori, collaboratori).

3. RUOLI E RESPONSABILITÀ
La società è responsabile dell'assegnazione dei ruoli all'interno della piattaforma. L'amministratore della piattaforma può creare e gestire utenti con diversi livelli di accesso (admin, dirigente, allenatore, collaboratore, atleta, genitore). La società garantisce che gli utenti ai quali vengono assegnati ruoli operativi siano stati preventivamente autorizzati.

4. TRATTAMENTO DEI DATI PERSONALI
L'utilizzo della piattaforma comporta il trattamento di dati personali degli utenti registrati. La società sportiva opera in qualità di Titolare del trattamento ai sensi del Regolamento UE 2016/679 (GDPR). Il fornitore della piattaforma opera in qualità di Responsabile del trattamento, garantendo adeguate misure di sicurezza tecniche e organizzative. Ogni utente riceve un'informativa privacy al momento della registrazione e, dove previsto, presta il proprio consenso digitale. I dettagli sono indicati nell'Informativa Privacy della piattaforma.

5. CERTIFICATI MEDICI SPORTIVI
La piattaforma consente la registrazione della data di emissione e di scadenza dei certificati medici sportivi degli atleti. Non è previsto il caricamento o la conservazione digitale di copie dei certificati medici. La custodia del documento originale resta a carico della società sportiva, in conformità con la normativa vigente.

6. ATTESTATI DI VERSAMENTO
La piattaforma può gestire la registrazione delle quote associative e dei contributi sportivi. Non sostituisce la documentazione fiscale ufficiale. La società è tenuta a conservare i documenti contabili e fiscali secondo le normative vigenti.

7. VERSIONE GRATUITA DEL SERVIZIO
RegistraTEAM è disponibile gratuitamente e senza limiti di funzionalità:
- fino al 30 giugno 2026 con un limite massimo di 150 utenti registrati (atleti, staff, genitori) per società;
- successivamente con limite massimo di 30 utenti registrati per società nella versione gratuita.
Il fornitore si riserva la facoltà di modificare nel tempo limiti di utilizzo, funzionalità e condizioni economiche del servizio.

8. LIMITAZIONE DI RESPONSABILITÀ
Il fornitore non è responsabile per eventuali danni diretti o indiretti derivanti dall'uso improprio della piattaforma, dalla perdita di dati dovuta a cause esterne, o dall'utilizzo non conforme alle presenti condizioni. Il servizio è fornito "così com'è" e il fornitore si impegna a garantire la continuità del servizio nei limiti delle proprie possibilità tecniche.

9. ACCETTAZIONE
L'attivazione della piattaforma implica la piena accettazione dei presenti Termini di Utilizzo. Il fornitore si riserva il diritto di aggiornare i presenti termini, dandone comunicazione agli utenti registrati tramite la piattaforma stessa o via email. L'utilizzo continuato del servizio successivamente alla modifica dei termini costituisce accettazione delle nuove condizioni. Per qualsiasi richiesta relativa ai presenti termini è possibile contattare il fornitore tramite i canali indicati nella piattaforma o nel sito web dell'attività sportiva.`;

export default function TermsAcceptanceScreen() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 50) {
      setScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!checked) {
      showAlert('Attenzione', 'Devi accettare i Termini di Utilizzo per continuare.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/societies/accept-terms');
      router.replace('/admin');
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={32} color="#1565C0" />
        <Text style={styles.headerTitle}>Attivazione RegistraTEAM</Text>
        <Text style={styles.headerSubtitle}>Per continuare, leggi e accetta i Termini di Utilizzo</Text>
      </View>

      <View style={styles.termsContainer}>
        <ScrollView
          style={styles.termsScroll}
          onScroll={handleScroll}
          scrollEventThrottle={100}
        >
          <Text style={styles.termsText} data-testid="terms-text">{TERMS_TEXT}</Text>
          <View style={{ height: 20 }} />
        </ScrollView>
        {!scrolledToBottom && (
          <View style={styles.scrollHint}>
            <Ionicons name="chevron-down" size={16} color="#999" />
            <Text style={styles.scrollHintText}>Scorri per leggere tutto il documento</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setChecked(!checked)}
          data-testid="terms-checkbox"
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            Dichiaro di essere autorizzato dalla Società ad attivare e utilizzare RegistraTEAM e accetto i Termini di utilizzo della piattaforma.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptBtn, (!checked || loading) && styles.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!checked || loading}
          data-testid="accept-terms-btn"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.acceptBtnText}>Accetta e Continua</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#1565C0',
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    textAlign: 'center',
  },
  termsContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  termsScroll: {
    flex: 1,
    padding: 16,
  },
  termsText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  scrollHintText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1565C0',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1565C0',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#333',
    fontWeight: '500',
  },
  acceptBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
