# Cipressina Barche · Cosa serve dal titolare

Questa è la checklist del sito barche (versione del 20/10/2026, ramo `main`). Il sito è online su https://cipressina.onrender.com, e il pannello dell'officina è su https://cipressina.onrender.com/pgs/officina.html.

Sul sito ogni dato segnaposto è in un riquadro giallo tratteggiato. Quando arriva il dato vero, si sostituisce il testo e si toglie il riquadro.

- **Novità**: cosa è cambiato in questa versione.
- **Parte A**: cinque decisioni, due sui prezzi e tre sul servizio.
- **Parte B**: i dati da fornire.
- **Parte C**: il lavoro tecnico, che spetta a noi e non al titolare.

---

## Novità di questa versione

- **Il sito è online.** Il modulo invia davvero la richiesta: il server la salva in un database, con il preventivo calcolato in quel momento, e dà al cliente un codice di 10 cifre. «Verifica la tua richiesta» mostra lo stato vero della barca.
- **Il pannello dell'officina** (solo in italiano). Si entra con una password, in due modi:
  - **dal computer dell'officina.** Ci sono le schede della squadra, con foto e nome. Ognuno tocca il suo nome, e il suo PIN se ce l'ha, per iniziare o finire il turno e per vedere le sue barche e le sue presenze. Ci sono anche «Cose da fare», la lista condivisa, e «Barche in officina», dove si assegna ogni barca a una o due persone in turno e se ne cambia lo stato;
  - **come titolare.** Vede gli avvisi (ritardi, assenze, straordinari, turni da completare) e la squadra in quel momento, con le barche di ognuno. Può scrivere una nota a ogni dipendente. In «Presenze» vede la settimana, il mese o un periodo a scelta, e può stampare o scaricare il file per Excel. Lì imposta anche foto, orario e PIN di ognuno.
- **Regole dei turni.** Un turno di meno di 5 minuti non viene salvato. Un turno rimasto aperto si chiude da solo dopo 12 ore o alle 23:00, e poi il titolare indica l'ora vera di uscita.

---

## A. Decisioni

### Prezzi

Il preventivo ha due parti che si sommano:

- il **pacchetto di manutenzione** (Base, Completo o Premium), con il contenuto preso dalla vostra pagina «Manutenzione Barche»;
- i **lavori sulle zone** scelte sul modello 3D (antivegetativa, riverniciatura, riparazioni).

Chi vuole solo i lavori sulle zone può scegliere «Nessun pacchetto».

Esempio con i prezzi segnaposto: una barca di 8 m con il Pacchetto Completo, l'antivegetativa e le due fiancate costa 440 € + 1.680 € − 7 % di sconto sulle zone, cioè **2.002 €**.

### A1. Su cosa si calcola il prezzo dei pacchetti?

- [ ] Sulla lunghezza della barca (€ al metro, con un minimo), come adesso.
- [ ] Sul tipo e sul numero di motori. Nel modulo vanno aggiunte le domande sui motori.
- [ ] Altro: ______________________________

> Dove si cambia: `src/zones.js:154` (`PACKAGES`)

### A2. Il Pacchetto Completo include i «servizi di riparazione». Con il pacchetto i lavori sulle zone devono costare meno?

- [ ] No, i lavori sulle zone costano uguale con qualsiasi pacchetto (come adesso).
- [ ] Sì, con uno sconto del ____ % con il Completo e del ____ % con il Premium.
- [ ] Altro: ______________________________

### Servizio

### A3. Quando si lavora in carrozzeria e quando in cantiere?

Ora il modulo decide solo in base alla lunghezza: fino a **8 m** (segnaposto) in carrozzeria, oltre in cantiere.

- [ ] Va bene la lunghezza. Il limite vero è ____ m.
- [ ] Conta anche dove si trova la barca, per esempio «su carrello» va sempre in carrozzeria.
- [ ] Altro criterio: ______________________________

> Dove si cambia: `src/app.js:795` (`SHOP_MAX_LOA`), oppure aggiungendo `shopMaxLoa` in `CIPRESSINA_CONFIG` (`src/site.js`). I testi sono in `src/i18n.js:242` e `src/i18n.js:247`.

### A4. «Porto o località» deve essere obbligatorio?

Ora è facoltativo. Se è obbligatorio, sapete sempre se la barca è nella zona di Venezia prima di rispondere.

- [ ] Sì, obbligatorio.
- [ ] No, resta facoltativo (come adesso).

> Dove si cambia: `pgs/preventivo.html` (campo `location`) e una nuova regola in `src/app.js` (`defineRules`).

### A5. L'attesa alla prima visita

Il sito usa i piani gratuiti di Render e di Neon. Dopo 15 minuti senza visite il server si spegne, e il primo cliente che arriva dopo aspetta fino a un minuto prima di vedere la pagina. Con un piano a pagamento di Render il server resta sempre acceso (il prezzo è da verificare sul sito di Render).

- [ ] Va bene così, per ora.
- [ ] Passiamo a un piano a pagamento.

---

## B. Dati da fornire

### B1. Prezzi

**Pacchetti** (`src/zones.js:154`)

| Pacchetto | Contenuto (dalla vostra pagina) | Segnaposto | Prezzo vero |
|---|---|---|---|
| Base | Controllo generale del motore, lavaggio carrozzeria | 30 €/m, minimo 180 € | ______ |
| Completo | Manutenzione completa di motore e scafo, servizi di riparazione | 55 €/m, minimo 350 € | ______ |
| Premium | Tutto il Completo, più monitoraggio stagionale e assistenza prioritaria | 80 €/m, minimo 500 € | ______ |

**Lavori sulle zone** (`src/zones.js:162`)

| Lavoro | Segnaposto | Prezzo vero |
|---|---|---|
| Opera viva (antivegetativa) | 40 €/m, minimo 150 € | ______ |
| Opera morta, per lato | 85 €/m, minimo 300 € | ______ |
| Coperta | 70 €/m, minimo 250 € | ______ |
| Tuga, hard-top, sovrastruttura, fly | 65 €/m, minimo 250 € | ______ |
| Specchio di poppa | 35 €/m, minimo 150 € | ______ |
| Tubolare del gommone, per lato | 35 €/m, minimo 200 € | ______ |
| Timone, chiglia / bulbo | 28 €/m, minimo 150 € | ______ |
| Linea di galleggiamento | 12 €/m, minimo 120 € | ______ |
| Parti piccole (consolle, fuoribordo, piede, eliche) | 14 €/m, minimo 100 € | ______ |

**Sconto per più zone** (`src/zones.js:199` e la nota «Percentuali di esempio» in `src/site.js:49`)

| Zone scelte | 2 | 3 | 4 | 5 o più |
|---|---|---|---|---|
| Segnaposto | 5 % | 7 % | 9 % | 10 % |
| Sconto vero | ____ | ____ | ____ | ____ |

- [ ] Nessuno sconto per più zone.

**Etichetta «Più scelto» sul Pacchetto Completo** (`src/i18n.js:324`)

- [ ] È davvero il più scelto, quindi la lasciamo.
- [ ] La mettiamo su un altro pacchetto: ____________
- [ ] La togliamo.

### B2. Dati dell'officina

| Dato | Segnaposto attuale | Dove | Dato vero |
|---|---|---|---|
| Orari di apertura | Fatto: lun–ven 07:15–12:30 e 13:30–19:15, sab 07:30–12:00, dom chiuso, presi dalla scheda di Google Maps (16/10/2026) | `src/i18n.js:537` | ✓ |
| Numero WhatsApp | Fatto: +39 339 181 0099, preso dal pulsante WhatsApp del vostro sito, con lo stesso aspetto e lo stesso messaggio precompilato | `index.html` (pulsante e «Contatti») | ✓ |
| Tempo per inviare il preventivo | «entro 24 ore» | `src/i18n.js:119` | ______ |
| Tempi di risposta | «da confermare» | `src/site.js:46` | ______ |
| Dimensioni della cabina di verniciatura | «da confermare» | `src/site.js:84` | ______ |
| Lunghezza massima della barca che potete lavorare | «da confermare». Il modulo ora accetta fino a 30 m. | `src/site.js:84`, `src/app.js:790` | ______ m |
| Cantiere per le barche grandi | «cantiere da confermare» | `src/i18n.js:247` | Nome e località: ______ |
| Nuova sede per i motori entro bordo | «Da poco abbiamo attivato una nuova sede operativa…» | `src/site.js:37` | È ancora valido? Va scritto l'indirizzo? ______ |

### B3. Domande frequenti

Le 8 risposte dicono tutte «Risposta da confermare con l'officina» (`src/i18n.js:569`).

1. **Quanto dura un lavoro?**
   ______________________________
2. **Dovete vedere la barca prima di dare il prezzo?**
   ______________________________
3. **Ogni quanto va rifatta l'antivegetativa?**
   ______________________________
4. **Meglio gelcoat o verniciatura?**
   ______________________________
5. **Vi occupate di alaggio e trasporto?** (Vale soprattutto per le barche che vengono in carrozzeria.)
   ______________________________
6. **Che garanzia date sui lavori?**
   ______________________________
7. **Qual è il periodo migliore per intervenire (rimessaggio invernale)?**
   ______________________________
8. **Quali pagamenti accettate?**
   ______________________________

### B4. Foto e logo

- [x] Il titolare ha dato il permesso di usare le foto delle pagine «Gallery» e «Manutenzione Barche» (16/10/2026). Sul sito ora ci sono:
  - la galleria con 11 foto di barche e 8 foto della sede (viste aeree comprese);
  - 4 foto dell'officina in «Chi siamo».

  Sono escluse le foto di auto e mezzi.
- [x] Il logo è il file originale del sito (`img/logo-cipressina.jpg`, JPEG 450 × 131).
- [ ] Facoltativo: un logo in SVG o in PNG più grande, per gli schermi ad alta risoluzione.

### B4-bis. Indirizzo

Il vecchio sito diceva «Via N. Sauro, 15». La scheda di Google Maps dice «Viale Nazario Sauro, 13-15».

- [x] Usiamo «Viale Nazario Sauro, 13-15 · 30030 Olmo di Martellago (VE)» (16/10/2026). È aggiornato in «Contatti», nel link e nella mappa di Google Maps e nel piè di pagina di entrambe le pagine.

### B5. Piccole verifiche

| Testo segnaposto | Dove | Correzione |
|---|---|---|
| Formato del numero di immatricolazione: «Formato da verificare» | `src/i18n.js:165` | ______ |
| Dove trovare il codice colore o gelcoat: «Spesso è nel manuale del cantiere. Da verificare.» | `src/i18n.js:176` | ______ |
| «Oltre i 10 m le unità da diporto vanno immatricolate» (è una frase legale, va controllata) | `src/i18n.js:235` | ______ |

### B6. Pannello dell'officina

**Gli stati della barca.** Il cliente li vede in «Verifica la tua richiesta», e l'officina li cambia nel pannello. Per ora sono segnaposto (`src/zones.js`, `STATUSES`, e `server/schema.sql`):

Ricevuta → Alaggio → Trasporto → Preparazione → Verniciatura → Antivegetativa → Varo → Pronta → Consegnata, più Annullata.

- [ ] Vanno bene così.
- [ ] Da cambiare: ______________________________

**La squadra.** Ora nel pannello ci sono 40 dipendenti di prova.

- [ ] L'elenco vero, con nome e cognome di ognuno. Il codice interno (due lettere e cinque cifre, per esempio AB12345) lo diamo noi.
- [ ] Il codice con cui il computer dell'officina entra nel pannello. Ora è «OFFICINA», provvisorio.
- [ ] Dopo: il titolare imposta nel pannello la foto, l'orario e il PIN di ognuno («Presenze» → «Foto, orario e PIN»).

> L'elenco non va nel codice, che è pubblico: si scrive nelle impostazioni di Render (`CIPRESSINA_WORKER_IDS`, vedi `render.yaml`).

---

## C. Lavoro tecnico (spetta a noi)

- [x] **Invio della richiesta.** Il modulo invia la richiesta al server, che è online su Render e la salva nel database Neon con il preventivo calcolato in quel momento.
- [x] **Verifica della richiesta.** «Verifica la tua richiesta» legge lo stato vero dal database, e l'officina lo cambia dal pannello.
- [x] **Pannello dell'officina.** È online (vedi «Novità»). Tiene il database a riposo quando nessuno lo tocca per 10 minuti, così le ore gratuite di Neon bastano per tutto il mese.
- [ ] **Email.** Il cliente non riceve un'email di conferma, e l'officina non riceve un avviso quando arriva una richiesta: per ora la vede solo nel pannello. Per gli avvisi serve sapere a quale indirizzo mandarli.
- [ ] **Informativa sulla privacy.** Il modulo raccoglie nome, telefono ed email, quindi serve il link all'informativa vera (`src/i18n.js:551`).
- [ ] **Cookie della mappa.** La mappa di Google in «Contatti» carica cookie di terze parti. Prima della messa online serve il consenso ai cookie, oppure una mappa che si carica solo dopo un clic.
- [ ] **Traduzioni.** Un madrelingua deve rivedere l'inglese, lo spagnolo e il francese, soprattutto i termini nautici segnati come non verificati in `src/zones.js:124`.
- [ ] **Zone dei modelli 3D.** Le zone dello yacht sono divise in modo approssimativo. Vanno rifinite in Blender (`design/models/blend/yacht.blend`), come per gli altri modelli.
- [ ] **GitHub Pages.** Pubblica ancora una copia del sito senza server, dove l'invio non funziona. Va spenta (Settings → Pages).
- [ ] **Richiesta di prova.** Nel database c'è la richiesta 1596077196 («TEST / Da cancellare»). Va cancellata prima della messa online.
- [ ] **Messa online.** Quando tutto è completo, va tolta la fascia gialla «Bozza di design» in alto su tutte e due le pagine (`index.html:12`, `pgs/preventivo.html:13`).

Da ricordare a ogni modifica: va cambiato il numero di versione `?v=` dei file cambiati in tutte le pagine che li usano (`index.html`, `pgs/preventivo.html`, `pgs/officina.html`), altrimenti i browser tengono i file vecchi (`src/CONTRACT.md`).

Questi restano così:

- i colori dell'antivegetativa nell'anteprima, che sono approssimazioni dei colori reali e hanno già l'etichetta «colori indicativi»;
- il catalogo delle barche nel modulo, con dati presi dai siti dei cantieri.
