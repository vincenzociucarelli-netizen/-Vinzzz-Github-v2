import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';

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
- fino al 30 settembre 2026 con un limite massimo di 150 utenti registrati (atleti, staff, genitori) per società;
- successivamente con limite massimo di 30 utenti registrati per società nella versione gratuita.
Il fornitore si riserva la facoltà di modificare nel tempo limiti di utilizzo, funzionalità e condizioni economiche del servizio.

8. LIMITAZIONE DI RESPONSABILITÀ
Il fornitore non è responsabile per eventuali danni diretti o indiretti derivanti dall'uso improprio della piattaforma, dalla perdita di dati dovuta a cause esterne, o dall'utilizzo non conforme alle presenti condizioni. Il servizio è fornito "così com'è" e il fornitore si impegna a garantire la continuità del servizio nei limiti delle proprie possibilità tecniche.

9. ACCETTAZIONE
L'attivazione della piattaforma implica la piena accettazione dei presenti Termini di Utilizzo. Il fornitore si riserva il diritto di aggiornare i presenti termini, dandone comunicazione agli utenti registrati tramite la piattaforma stessa o via email. L'utilizzo continuato del servizio successivamente alla modifica dei termini costituisce accettazione delle nuove condizioni. Per qualsiasi richiesta relativa ai presenti termini è possibile contattare il fornitore tramite i canali indicati nella piattaforma o nel sito web dell'attività sportiva.`;

function TermsAcceptanceInline({ onAccepted }: { onAccepted: () => void }) {
  const [checked, setChecked] = useState(false);
  const [dataProcessorChecked, setDataProcessorChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const allChecked = checked && dataProcessorChecked;

  const handleAccept = async () => {
    if (!allChecked) return;
    setLoading(true);
    try {
      await api.post('/societies/accept-terms');
      onAccepted();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore durante l\'accettazione';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={ts.container}>
      <View style={ts.header}>
        <Ionicons name="document-text" size={32} color="#fff" />
        <Text style={ts.headerTitle}>Attivazione RegistraTEAM</Text>
        <Text style={ts.headerSubtitle}>Per continuare, leggi e accetta i Termini di Utilizzo</Text>
      </View>
      <View style={ts.termsContainer}>
        <ScrollView style={ts.termsScroll}>
          <Text style={ts.termsText}>{TERMS_TEXT}</Text>
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
      <View style={ts.footer}>
        <TouchableOpacity style={ts.checkboxRow} onPress={() => setChecked(!checked)} data-testid="terms-checkbox">
          <View style={[ts.checkbox, checked && ts.checkboxChecked]}>
            {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={ts.checkboxLabel}>
            Dichiaro di essere autorizzato dalla Società ad attivare e utilizzare RegistraTEAM e accetto i Termini di utilizzo della piattaforma.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={ts.checkboxRow} onPress={() => setDataProcessorChecked(!dataProcessorChecked)} data-testid="data-processor-checkbox">
          <View style={[ts.checkbox, dataProcessorChecked && ts.checkboxChecked]}>
            {dataProcessorChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={ts.checkboxLabel}>
            Dichiaro di essere stato nominato Responsabile del Trattamento dei dati personali ai sensi dell'art. 28 del Regolamento UE 2016/679 (GDPR) e di impegnarmi a trattare i dati degli utenti in conformità alla normativa vigente.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ts.acceptBtn, (!allChecked || loading) && ts.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!allChecked || loading}
          data-testid="accept-terms-btn"
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ts.acceptBtnText}>Accetta e Continua</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminLayout() {
  const router = useRouter();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const isAuthenticated = !isChecking && !isLoading && !!user && user.role === 'admin';

  useEffect(() => {
    const checkAuth = async () => {
      await loadAuth();
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!user || user.role !== 'admin') {
        router.replace('/login');
      } else {
        api.get('/societies/terms-status')
          .then(res => setTermsAccepted(res.data.terms_accepted || false))
          .catch(() => setTermsAccepted(false));
      }
    }
  }, [user, isLoading, isChecking]);

  if (isChecking || isLoading || termsAccepted === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Society terms acceptance - admin only
  if (termsAccepted === false) {
    return <TermsAcceptanceInline onAccepted={() => setTermsAccepted(true)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="athletes" />
      <Stack.Screen name="athlete-search" />
      <Stack.Screen name="attendances" />
      <Stack.Screen name="prime-squadre" />
      <Stack.Screen name="prime-squadre/[id]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

const ts = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#1565C0', padding: 24, paddingTop: 48, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 8 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' },
  termsContainer: { flex: 1, margin: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden' },
  termsScroll: { flex: 1, padding: 16 },
  termsText: { fontSize: 13, lineHeight: 20, color: '#333' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#1565C0', marginRight: 12, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#1565C0' },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 19, color: '#333', fontWeight: '500' },
  acceptBtn: { backgroundColor: '#1565C0', borderRadius: 12, padding: 16, alignItems: 'center' },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
