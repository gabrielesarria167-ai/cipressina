# Cipressina Barche · Cosa serve dal titolare

Questa è la checklist della bozza del sito barche (versione del 16/10/2026, commit `006b877`).

Sul sito ogni dato segnaposto è in un riquadro giallo tratteggiato. Quando arriva il dato vero, si sostituisce il testo e si toglie il riquadro.

- **Parte A**: due decisioni sui prezzi.
- **Parte B**: i dati da fornire.
- **Parte C**: il lavoro tecnico, che spetta a noi e non al titolare.

---

## A. Decisioni sui prezzi

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
| Tuga, hard-top, fly | 65 €/m, minimo 250 € | ______ |
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

**Etichetta «Più scelto» sul Pacchetto Completo** (`src/i18n.js:318`)

- [ ] È davvero il più scelto, quindi la lasciamo.
- [ ] La mettiamo su un altro pacchetto: ____________
- [ ] La togliamo.

### B2. Dati dell'officina

| Dato | Segnaposto attuale | Dove | Dato vero |
|---|---|---|---|
| Orari di apertura | «Orari: da confermare» | `src/i18n.js:513` | ______ |
| Numero WhatsApp | Fatto: +39 339 181 0099, preso dal pulsante WhatsApp del vostro sito, con lo stesso aspetto e lo stesso messaggio precompilato | `index.html` (pulsante e «Contatti») | ✓ |
| Tempo per inviare il preventivo | «entro 24 ore» | `src/i18n.js:113` | ______ |
| Tempi di risposta | «da confermare» | `src/site.js:46` | ______ |
| Dimensioni della cabina di verniciatura | «da confermare» | `src/site.js:53` | ______ |
| Lunghezza massima della barca che potete lavorare | «da confermare». Il modulo ora accetta fino a 30 m. | `src/site.js:53`, `src/app.js:732` | ______ m |
| Nuova sede per i motori entro bordo | «Da poco abbiamo attivato una nuova sede operativa…» | `src/site.js:37` | È ancora valido? Va scritto l'indirizzo? ______ |

### B3. Domande frequenti

Le 8 risposte dicono tutte «Risposta da confermare con l'officina» (`src/i18n.js:545`).

1. **Quanto dura un lavoro?**
   ______________________________
2. **Dovete vedere la barca prima di dare il prezzo?**
   ______________________________
3. **Ogni quanto va rifatta l'antivegetativa?**
   ______________________________
4. **Meglio gelcoat o verniciatura?**
   ______________________________
5. **Vi occupate di alaggio e trasporto?**
   ______________________________
6. **Che garanzia date sui lavori?**
   ______________________________
7. **Qual è il periodo migliore per intervenire (rimessaggio invernale)?**
   ______________________________
8. **Quali pagamenti accettate?**
   ______________________________

### B4. Foto e logo

- [x] Il titolare ha dato il permesso di usare le foto delle pagine «Gallery» e «Manutenzione Barche» (16/10/2026). Sul sito ora ci sono la galleria con 11 foto di barche e 8 foto della sede (viste aeree comprese), e 4 foto dell'officina in «Chi siamo». Sono escluse le foto di auto e mezzi.
- [x] Il logo è il file originale del sito (`img/logo-cipressina.jpg`, JPEG 450 × 131).
- [ ] Facoltativo: un logo in SVG o in PNG più grande, per gli schermi ad alta risoluzione.

### B4-bis. Indirizzo

Il sito dice «Via N. Sauro, 15». La scheda di Google Maps dice «Viale Nazario Sauro, 13-15».

- [ ] Quale indirizzo scriviamo? ______________________________

### B5. Piccole verifiche

| Testo segnaposto | Dove | Correzione |
|---|---|---|
| Formato del numero di immatricolazione: «Formato da verificare» | `src/i18n.js:163` | ______ |
| Dove trovare il codice colore o gelcoat: «Spesso è nel manuale del cantiere. Da verificare.» | `src/i18n.js:174` | ______ |
| «Oltre i 10 m le unità da diporto vanno immatricolate» (è una frase legale, va controllata) | `src/i18n.js:232` | ______ |

---

## C. Lavoro tecnico (spetta a noi)

- [ ] **Invio della richiesta.** Ora il modulo non invia niente: registra la richiesta solo nel browser (`src/app.js:1724`). Va collegato a un servizio email o a un piccolo backend.
- [ ] **Verifica della richiesta.** La pagina «Verifica la tua richiesta» e il codice di monitoraggio sono una dimostrazione (`src/app.js:1955`). Vanno collegati a stati reali.
- [ ] **Informativa sulla privacy.** Va messo il link all'informativa vera (`src/i18n.js:527`).
- [ ] **Cookie della mappa.** La mappa di Google in «Contatti» carica cookie di terze parti. Prima della messa online serve il consenso ai cookie, oppure una mappa che si carica solo dopo un clic.
- [ ] **Traduzioni.** Un madrelingua deve rivedere l'inglese, lo spagnolo e il francese, soprattutto i termini nautici segnati come non verificati in `src/zones.js`.
- [ ] **Messa online.** Quando tutto è completo, va tolta la fascia gialla «Bozza di design» in alto su tutte e due le pagine (`index.html:13`, `pgs/preventivo.html:13`).

Questi restano così:

- i colori dell'antivegetativa nell'anteprima, che sono approssimazioni dei colori reali e hanno già l'etichetta «colori indicativi»;
- il catalogo delle barche nel modulo, con dati presi dai siti dei cantieri.
