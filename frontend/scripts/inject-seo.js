// 🆕 23/02/2026 — Post-build SEO inject per Vercel
// Aggiunge meta description, og:*, twitter:*, e contenuto statico nel <noscript>
// così Google indicizza correttamente e non mostra più "sito inattivo".
const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(INDEX)) {
  console.error('[inject-seo] dist/index.html non trovato — salto.');
  process.exit(0);
}

let html = fs.readFileSync(INDEX, 'utf-8');

const META = `
    <meta name="description" content="RegistraTEAM — Software gestionale per società sportive: tesseramenti, presenze, compensi, GDPR, Riforma Sport. Pallavolo, calcio e altre discipline." />
    <meta name="keywords" content="software gestionale società sportiva, tesseramento atleti, presenze allenamenti, riforma sport, gdpr atleti, compensi sportivi, app pallavolo, gestione palestra, attestato versamento, soglie 5000 15000" />
    <meta name="author" content="RegistraTEAM" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="RegistraTEAM — Gestionale società sportive" />
    <meta property="og:description" content="Gestionale all-in-one per società sportive: tesseramenti, presenze, compensi, Riforma Sport, GDPR." />
    <meta property="og:url" content="https://www.registrateam.it" />
    <meta property="og:image" content="https://www.registrateam.it/favicon.ico" />
    <meta property="og:locale" content="it_IT" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="RegistraTEAM" />
    <meta name="twitter:description" content="Gestionale all-in-one per società sportive." />
    <link rel="canonical" href="https://www.registrateam.it" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "RegistraTEAM",
      "url": "https://www.registrateam.it",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, iOS, Android",
      "description": "Software gestionale per società sportive: tesseramenti, presenze, compensi, GDPR, Riforma Sport.",
      "inLanguage": "it"
    }
    </script>`;

// Inserisci i meta subito dopo il <title>
html = html.replace(/(<title>[^<]*<\/title>)/, `$1${META}`);

// Sostituisci il <noscript> con contenuto descrittivo per crawler
const STATIC_NOSCRIPT = `
    <noscript>
      <div style="max-width:680px;margin:60px auto;padding:24px;font-family:system-ui,Arial,sans-serif;color:#222;">
        <h1>RegistraTEAM — Software gestionale per società sportive</h1>
        <p>RegistraTEAM è una piattaforma all-in-one per la gestione di società sportive: tesseramenti, presenze allenamenti, compensi (Riforma Sport €5.000/€15.000), GDPR, attestati di versamento per detrazioni fiscali.</p>
        <p><strong>Funzionalità principali</strong>: anagrafica atleti, dirigenti, coach, collaboratori · gestione squadre e palestre · firme digitali quietanze · documenti GDPR · QR code presenze · pagamenti quote · multi-tenancy per società.</p>
        <p>Per usare la piattaforma è necessario abilitare JavaScript nel browser e accedere con le credenziali fornite dalla tua società sportiva.</p>
        <p>Contatti: <a href="https://www.registrateam.it">www.registrateam.it</a></p>
      </div>
    </noscript>`;
html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, STATIC_NOSCRIPT.trim());

// Cambia lang
html = html.replace(/<html lang="en">/, '<html lang="it">');

fs.writeFileSync(INDEX, html, 'utf-8');
console.log('[inject-seo] meta + noscript content iniettati in dist/index.html ✓');
