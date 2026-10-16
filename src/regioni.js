/* =========================================================================
   regioni.js: window.IT_REGIONI, the 20 Italian regions and their provinces

   Official list: ISTAT, "Codici dei comuni, delle province e delle regioni"
   https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/
   (Veneto and Friuli-Venezia Giulia also checked against the Wikipedia pages
   cited in research.md §6.)

   For the sketches only five regions carry their provinces: the ones the
   shop's customers are most likely to come from (Veneto, where Martellago is,
   and its neighbours). The other fifteen map to null, and the wizard shows a
   free-text "provincia" for them. In production this file takes the complete
   ISTAT list (107 provinces/metropolitan cities).

   The five lists below are stable public facts (names as ISTAT writes them,
   including the bilingual Bolzano/Bozen).

   Shape: { "Region": ["Province", ...] | null }. app.js sorts both with
   localeCompare(…, "it") and appends its own «Estero / Fuori Italia» option.
   ========================================================================= */
window.IT_REGIONI = {
    "Abruzzo": null,
    "Basilicata": null,
    "Calabria": null,
    "Campania": null,
    "Emilia-Romagna": [
        "Bologna", "Ferrara", "Forlì-Cesena", "Modena", "Parma",
        "Piacenza", "Ravenna", "Reggio Emilia", "Rimini"
    ],
    "Friuli-Venezia Giulia": ["Gorizia", "Pordenone", "Trieste", "Udine"],
    "Lazio": null,
    "Liguria": null,
    "Lombardia": [
        "Bergamo", "Brescia", "Como", "Cremona", "Lecco", "Lodi",
        "Mantova", "Milano", "Monza e della Brianza", "Pavia", "Sondrio", "Varese"
    ],
    "Marche": null,
    "Molise": null,
    "Piemonte": null,
    "Puglia": null,
    "Sardegna": null,
    "Sicilia": null,
    "Toscana": null,
    "Trentino-Alto Adige": ["Bolzano/Bozen", "Trento"],
    "Umbria": null,
    "Valle d'Aosta": null,
    "Veneto": ["Belluno", "Padova", "Rovigo", "Treviso", "Venezia", "Verona", "Vicenza"]
};
