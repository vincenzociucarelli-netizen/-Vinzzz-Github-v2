/**
 * Privacy Policy RegistraTEAM — GDPR compliant (UE 2016/679)
 *
 * Versione pubblica accessibile senza login. Deve essere firmata dai tesserati
 * e dai loro tutori in fase di onboarding.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/components/Icon';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Informativa sulla Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.mainTitle}>RegistraTEAM</Text>
        <Text style={styles.subtitle}>Informativa Privacy (GDPR — UE 2016/679)</Text>
        <Text style={styles.updateDate}>Ultimo aggiornamento: 2 maggio 2026 — v2.0</Text>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color="#1565C0" />
          <Text style={styles.infoText}>
            Ai sensi degli artt. 13–14 del Reg. UE 2016/679 (GDPR), la presente informativa descrive come RegistraTEAM e la Società sportiva che la utilizza trattano i tuoi dati personali.
          </Text>
        </View>

        <Sec title="1. Titolare del Trattamento">
          Titolare del Trattamento è la <B>Società sportiva</B> che gestisce l'app RegistraTEAM nella propria istanza (denominazione, sede legale e C.F./P.IVA sono quelle indicate nel profilo Società accessibile da Impostazioni → Dati Società). Il Legale Rappresentante della Società è il referente principale per ogni questione privacy.
        </Sec>

        <Sec title="2. Responsabile del Trattamento">
          RegistraTEAM (Emergent Labs) agisce come <B>Responsabile del Trattamento</B> ai sensi dell'art. 28 GDPR per le attività tecniche (hosting, manutenzione, backup, sicurezza). Il rapporto è disciplinato da accordo contrattuale. I sub-responsabili sono: MongoDB Atlas (database, server UE), Render/Vercel (hosting applicativo, server UE), Brevo/Sendinblue (invio email transazionali, server UE).
        </Sec>

        <Sec title="3. Categorie di dati trattati">
          <B>3.1 Dati anagrafici e di contatto</B>{'\n'}
          Nome, cognome, data e luogo di nascita, codice fiscale, indirizzo di residenza, email, numero di telefono.{'\n\n'}
          <B>3.2 Dati relativi ai minori</B>{'\n'}
          Per i minorenni: consenso firmato da entrambi i genitori/tutori, dati anagrafici dei genitori, eventuali dati di un tutore legale. Accesso specifico per i tutori.{'\n\n'}
          <B>3.3 Dati sanitari (art. 9 GDPR — categoria particolare)</B>{'\n'}
          Certificato di idoneità sportiva (tipologia: agonistica/non agonistica, data rilascio, data scadenza, medico certificatore). Il certificato in PDF è conservato in forma cifrata e accessibile solo agli admin della Società.{'\n\n'}
          <B>3.4 Dati tecnici e di log</B>{'\n'}
          IP di accesso, timestamp di login, identificativo QR personale, sessioni. Usati esclusivamente per sicurezza e audit.{'\n\n'}
          <B>3.5 Dati amministrativi e fiscali</B>{'\n'}
          Quote associative, ricevute, compensi staff (coach/collaboratori/dirigenti) con soglie Riforma Sport (5k/15k €), codici FIGC/FIPAV/CONI.{'\n\n'}
          <B>3.6 Immagini e foto</B>{'\n'}
          Foto degli atleti caricate per finalità associative (es. tesseramento). Possono essere richieste rimozioni via apposita funzione.
        </Sec>

        <Sec title="4. Base giuridica del trattamento (art. 6 GDPR)">
          {'\u2022'} <B>Esecuzione di un contratto</B> (art. 6.1.b): gestione del rapporto associativo.{'\n'}
          {'\u2022'} <B>Obbligo di legge</B> (art. 6.1.c): adempimenti fiscali, Riforma Sport (D.Lgs. 36/2021 e ss.mm.ii.), FIGC/FIPAV/CONI.{'\n'}
          {'\u2022'} <B>Consenso</B> (art. 6.1.a + art. 9.2.a per dati sanitari): trattamento certificato medico, pubblicazione foto, invio newsletter.{'\n'}
          {'\u2022'} <B>Legittimo interesse</B> (art. 6.1.f): sicurezza informatica, prevenzione frodi, audit log.
        </Sec>

        <Sec title="5. Finalità del trattamento">
          {'\u2022'} Gestione anagrafiche di atleti, dirigenti, coach, collaboratori, genitori.{'\n'}
          {'\u2022'} Registrazione presenze allenamenti tramite QR code.{'\n'}
          {'\u2022'} Gestione squadre, calendari, partite, sedi.{'\n'}
          {'\u2022'} Verifica validità certificati medici e blocco accessi a chi ne è sprovvisto.{'\n'}
          {'\u2022'} Gestione pagamenti, quote, rimborsi (Stripe, bonifici).{'\n'}
          {'\u2022'} Invio notifiche (certificati in scadenza, approvazioni, comunicazioni).{'\n'}
          {'\u2022'} Audit log obbligatorio per tracciabilità.{'\n'}
          {'\u2022'} Generazione PDF legali (consensi, tesseramenti, informative).
        </Sec>

        <Sec title="6. Modalità del trattamento">
          Il trattamento è effettuato con strumenti informatici e telematici con misure di sicurezza adeguate (crittografia TLS in transito, hash bcrypt per password, backup cifrati, controllo accessi basato sui ruoli). Il personale autorizzato è limitato agli admin della Società e al Legale Rappresentante.
        </Sec>

        <Sec title="7. Comunicazione e trasferimento dati">
          I dati possono essere comunicati a:{'\n'}
          {'\u2022'} Federazioni sportive (FIGC, FIPAV, CONI) per tesseramento obbligatorio.{'\n'}
          {'\u2022'} Enti fiscali e previdenziali (Agenzia Entrate, INPS) per adempimenti Riforma Sport.{'\n'}
          {'\u2022'} Soggetti esterni solo se autorizzati da norma di legge o dal consenso esplicito dell'interessato.{'\n\n'}
          <B>I dati NON vengono venduti a terzi</B>. I server sono dislocati nell'<B>Unione Europea</B>. Non sono previsti trasferimenti verso paesi terzi.
        </Sec>

        <Sec title="8. Conservazione dei dati">
          {'\u2022'} <B>Durante il rapporto associativo</B>: per tutto il tempo necessario.{'\n'}
          {'\u2022'} <B>Dopo la cessazione</B>: 10 anni per obblighi fiscali (art. 2220 c.c.), 5 anni per dati sanitari (certificati medici). Audit log conservati 5 anni.{'\n'}
          {'\u2022'} <B>Dati sensibili minori</B>: 1 anno oltre il compimento della maggiore età salvo specifici obblighi.{'\n'}
          Scaduti i termini i dati vengono cancellati o anonimizzati.
        </Sec>

        <Sec title="9. Diritti dell'interessato (artt. 15–22 GDPR)">
          In qualsiasi momento puoi esercitare i seguenti diritti scrivendo al Titolare:{'\n'}
          {'\u2022'} <B>Accesso</B> (art. 15): sapere quali dati abbiamo su di te.{'\n'}
          {'\u2022'} <B>Rettifica</B> (art. 16): correggere dati errati.{'\n'}
          {'\u2022'} <B>Cancellazione / Oblio</B> (art. 17): richiedere l'eliminazione.{'\n'}
          {'\u2022'} <B>Limitazione</B> (art. 18): sospendere temporaneamente il trattamento.{'\n'}
          {'\u2022'} <B>Portabilità</B> (art. 20): ottenere i dati in formato strutturato (export JSON/CSV fornito dall'app).{'\n'}
          {'\u2022'} <B>Opposizione</B> (art. 21): opporti al trattamento per motivi legittimi.{'\n'}
          {'\u2022'} <B>Revoca del consenso</B> (art. 7.3): senza pregiudicare la liceità del trattamento già effettuato.{'\n'}
          {'\u2022'} <B>Reclamo al Garante</B>: se ritieni che il trattamento violi il GDPR, puoi proporre reclamo al Garante Privacy italiano (www.garanteprivacy.it).
        </Sec>

        <Sec title="10. Cookie e tecnologie di tracciamento">
          L'applicazione usa <B>cookie tecnici strettamente necessari</B> al funzionamento (autenticazione, sessione). Non sono usati cookie di profilazione o di marketing di terze parti. Consulta il banner cookie per dettagli e preferenze.
        </Sec>

        <Sec title="11. Minori">
          Il servizio tratta dati di minori solo con il consenso firmato di entrambi i genitori/tutori. Per atleti dai 14 anni è previsto un account personale ma vincolato all'approvazione del genitore per le azioni sensibili.
        </Sec>

        <Sec title="12. Data Breach">
          In caso di violazione dei dati personali che comporti rischi per gli utenti, il Titolare provvederà entro 72 ore a notificare l'evento al Garante Privacy (art. 33 GDPR) e, se necessario, agli interessati (art. 34 GDPR).
        </Sec>

        <Sec title="13. Modifiche dell'informativa">
          La presente informativa può essere aggiornata. Le versioni precedenti sono consultabili dietro richiesta. Ogni aggiornamento sostanziale sarà notificato agli utenti attivi.
        </Sec>

        <Sec title="14. Contatti">
          <B>Titolare del Trattamento</B>: la Società sportiva utilizzatrice (vedi "Dati Società" nell'app).{'\n'}
          <B>Referente tecnico</B>: RegistraTEAM — supporto tramite l'amministratore della tua Società.{'\n'}
          <B>Autorità di controllo</B>: Garante per la Protezione dei Dati Personali, Piazza Venezia 11, 00187 Roma — www.garanteprivacy.it
        </Sec>
      </ScrollView>
    </View>
  );
}

const Sec = ({ title, children }: any) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionText}>{children}</Text>
  </View>
);

const B = ({ children }: any) => <Text style={{ fontWeight: '700' }}>{children}</Text>;

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
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 4 },
  updateDate: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 20 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#E3F2FD', borderColor: '#90CAF9', borderWidth: 1,
    padding: 12, borderRadius: 8, marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, color: '#0D47A1', lineHeight: 18 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1565C0', marginBottom: 6 },
  sectionText: { fontSize: 13.5, color: '#333', lineHeight: 21 },
});
