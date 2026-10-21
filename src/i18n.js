/* =========================================================================
   i18n.js: window.CIPRESSINA_I18N, the strings every skin shares

   Four languages: it (master copy, «tu»), en, es (Spain-neutral, «tú») and fr
   («vous»). EN/ES/FR are drafts: traduzione da revisionare, with a native
   reviewer, before anything goes live.

   How the dictionary is written. Each row is  R(key, it, en, es, fr), so the
   four versions of a sentence sit side by side and a missing translation is
   visible in the diff (the test in the scratchpad also fails on it). A value
   is either a string or a plural object {one, other} chosen with
   Intl.PluralRules from params.count.

   Placeholders: «{name}» in a string is replaced from the params object.
   Keys ending in «.h» hold trusted HTML (they carry <span class="ph">…</span>,
   the placeholder marker) and are for data-i18n-html only.

   Page-specific copy (the home sections' headings and paragraphs) is NOT
   here: each skin adds its own with extend(), or sets
   window.CIPRESSINA_I18N_EXTRA = {it:{…},en:{…},…} (object or array of them)
   before this script loads. Both forms may be used together.

   DOM helpers (see CONTRACT.md):
     [data-i18n="key"]                      sets textContent (leaf elements only)
     [data-i18n-html="key"]                 sets innerHTML (trusted «.h» keys)
     [data-i18n-attr="attr:key;attr2:key2"] sets attributes
     [data-i18n-params='{"n":4}']           optional params for the three above
   ========================================================================= */
(function () {
    "use strict";

    var W = typeof window !== "undefined" ? window : globalThis;
    var has = Object.prototype.hasOwnProperty;
    var LANGS = ["it", "en", "es", "fr"];
    var STORAGE_KEY = "cipressina.lang";
    var dict = { it: {}, en: {}, es: {}, fr: {} };

    function R(key, it, en, es, fr) {
        dict.it[key] = it;
        dict.en[key] = en;
        dict.es[key] = es;
        dict.fr[key] = fr;
    }

    /* ---------------- Chrome: ribbon, skip link, nav, menu ---------------- */
    R("skip", "Vai al contenuto", "Skip to content", "Saltar al contenido", "Aller au contenu");
    R("lang.label", "Lingua", "Language", "Idioma", "Langue");
    R("ribbon",
        "Bozza di design · prezzi e alcuni dati sono segnaposto",
        "Design draft · prices and some details are placeholders",
        "Borrador de diseño · precios y algunos datos son provisionales",
        "Maquette · prix et certaines données sont provisoires");
    R("nav.label", "Navigazione principale", "Main navigation", "Navegación principal", "Navigation principale");
    R("nav.home", "Cipressina Barche, torna all'inizio", "Cipressina Barche, back to the top", "Cipressina Barche, volver al inicio", "Cipressina Barche, retour à l'accueil");
    R("nav.servizi", "Servizi", "Services", "Servicios", "Services");
    R("nav.come", "Come funziona", "How it works", "Cómo funciona", "Comment ça marche");
    R("nav.interventi", "Interventi", "Packages", "Intervenciones", "Interventions");
    R("nav.galleria", "Galleria", "Gallery", "Galería", "Galerie");
    R("nav.chi", "Chi siamo", "About us", "Quiénes somos", "Qui sommes-nous");
    R("nav.contatti", "Contatti", "Contact", "Contacto", "Contact");
    R("nav.quote", "Preventivo", "Get a quote", "Presupuesto", "Devis");
    R("menu.open", "Apri il menu", "Open the menu", "Abrir el menú", "Ouvrir le menu");
    R("menu.close", "Chiudi il menu", "Close the menu", "Cerrar el menú", "Fermer le menu");
    R("lb.label", "Foto ingrandita", "Enlarged photo", "Foto ampliada", "Photo agrandie");
    R("lb.prev", "Precedente", "Previous", "Anterior", "Précédente");
    R("lb.next", "Successiva", "Next", "Siguiente", "Suivante");
    R("lb.close", "Chiudi", "Close", "Cerrar", "Fermer");
    R("lb.count", "{n} di {total}", "{n} of {total}", "{n} de {total}", "{n} sur {total}");
    R("fab.label", "Scrivici su WhatsApp", "Message us on WhatsApp", "Escríbenos por WhatsApp", "Écrivez-nous sur WhatsApp");

    /* ---------------- Buttons ---------------- */
    R("btn.saveContinue", "Salva e continua", "Save and continue", "Guardar y continuar", "Enregistrer et continuer");
    R("btn.continue", "Continua", "Continue", "Continuar", "Continuer");
    R("btn.send", "Invia richiesta", "Send request", "Enviar solicitud", "Envoyer la demande");
    R("btn.sending", "Invio in corso…", "Sending…", "Enviando…", "Envoi en cours…");
    R("btn.back", "Indietro", "Back", "Atrás", "Retour");
    R("btn.copy", "Copia", "Copy", "Copiar", "Copier");
    R("btn.copied", "Copiato!", "Copied!", "¡Copiado!", "Copié !");
    R("btn.reset", "Nuova richiesta", "New request", "Nueva solicitud", "Nouvelle demande");
    R("btn.removeAll", "Rimuovi tutte", "Remove all", "Quitar todas", "Tout retirer");
    R("btn.remove", "Rimuovi {label}", "Remove {label}", "Quitar {label}", "Retirer {label}");
    R("copy.manual",
        "Copia non riuscita: il testo è selezionato, copialo a mano.",
        "Couldn't copy automatically: the text is selected, copy it manually.",
        "No se ha podido copiar: el texto está seleccionado, cópialo a mano.",
        "Copie impossible : le texte est sélectionné, copiez-le à la main.");

    /* ---------------- Wizard shell ---------------- */
    R("wiz.progress", "Avanzamento della richiesta", "Quote progress", "Progreso de la solicitud", "Avancement de la demande");
    R("prog.1", "Barca", "Boat", "Barco", "Bateau");
    R("prog.2", "Pacchetto", "Package", "Paquete", "Formule");
    R("prog.3", "Zone", "Zones", "Zonas", "Zones");
    R("prog.4", "Contatti", "Contact", "Contacto", "Coordonnées");
    R("prog.sr.done", "Passo {n} di {total}, completato", "Step {n} of {total}, completed", "Paso {n} de {total}, completado", "Étape {n} sur {total}, terminée");
    R("prog.sr.current", "Passo {n} di {total}, in corso", "Step {n} of {total}, in progress", "Paso {n} de {total}, en curso", "Étape {n} sur {total}, en cours");
    R("prog.sr.todo", "Passo {n} di {total}, da fare", "Step {n} of {total}, to do", "Paso {n} de {total}, pendiente", "Étape {n} sur {total}, à venir");

    R("step1.title", "Dati della barca", "Boat details", "Datos del barco", "Informations sur le bateau");
    R("step1.sub",
        "Completa i dati per identificare la tua barca.",
        "Fill in the details so we can identify your boat.",
        "Completa los datos para identificar tu barco.",
        "Renseignez les informations pour identifier votre bateau.");
    R("step1.cardBoat", "Barca", "Boat", "Barco", "Bateau");
    R("step1.cardOwner", "Proprietario", "Owner", "Propietario", "Propriétaire");
    R("step2.title", "Pacchetto di manutenzione", "Maintenance package", "Paquete de mantenimiento", "Formule d'entretien");
    R("step2.sub",
        "Offriamo diversi pacchetti di manutenzione per soddisfare ogni esigenza. Scegli quello che fa per te, oppure nessun pacchetto se ti servono solo lavori su alcune zone.",
        "We offer several maintenance packages to suit every need. Pick the one that's right for you, or no package if you only need work on some zones.",
        "Ofrecemos diversos paquetes de mantenimiento para satisfacer todas tus necesidades. Elige el que mejor te encaje, o ningún paquete si solo necesitas trabajos en algunas zonas.",
        "Nous proposons différentes formules d'entretien pour répondre à tous vos besoins. Choisissez celle qui vous convient, ou aucune formule si vous avez seulement besoin de travaux sur certaines zones.");
    R("step3.title", "Quali zone?", "Which zones?", "¿Qué zonas?", "Quelles zones ?");
    R("step3.sub",
        "Tocca le zone da trattare, riverniciare o riparare: si aggiungono al pacchetto. Con un pacchetto puoi anche non sceglierne nessuna.",
        "Tap the zones to treat, repaint or repair: they are added to the package. With a package you can also leave them all out.",
        "Toca las zonas que hay que tratar, repintar o reparar: se suman al paquete. Con un paquete también puedes no elegir ninguna.",
        "Touchez les zones à traiter, repeindre ou réparer : elles s'ajoutent à la formule. Avec une formule, vous pouvez aussi n'en choisir aucune.");
    R("step4.title", "Contatti", "Contact details", "Datos de contacto", "Vos coordonnées");
    R("step4.sub.h",
        "Ti invieremo un preventivo personalizzato entro <span class=\"ph\">24 ore</span>.",
        "We'll send you a personalised quote within <span class=\"ph\">24 hours</span>.",
        "Te enviaremos un presupuesto personalizado en un plazo de <span class=\"ph\">24 horas</span>.",
        "Nous vous enverrons un devis personnalisé sous <span class=\"ph\">24 heures</span>.");

    R("hint.step1", "Completa i campi evidenziati per continuare.", "Fill in the highlighted fields to continue.", "Completa los campos marcados para continuar.", "Renseignez les champs signalés pour continuer.");
    R("hint.step2", "Scegli un pacchetto per continuare.", "Choose a package to continue.", "Elige un paquete para continuar.", "Choisissez une formule pour continuer.");
    R("hint.step3",
        "Scegli almeno una zona: toccala sulla barca o selezionala dall'elenco.",
        "Choose at least one zone: tap it on the boat or tick it in the list.",
        "Elige al menos una zona: tócala en el barco o márcala en la lista.",
        "Choisissez au moins une zone : touchez-la sur le bateau ou cochez-la dans la liste.");
    R("hint.step4", "Completa i campi evidenziati per inviare la richiesta.", "Fill in the highlighted fields to send your request.", "Completa los campos marcados para enviar la solicitud.", "Renseignez les champs signalés pour envoyer la demande.");

    /* ---------------- Field labels, hints, options ---------------- */
    R("fld.boatType", "Tipo di barca", "Type of boat", "Tipo de barco", "Type de bateau");
    R("fld.builder", "Cantiere", "Builder", "Astillero", "Chantier");
    R("fld.model", "Modello", "Model", "Modelo", "Modèle");
    R("fld.year", "Anno", "Year", "Año", "Année");
    R("fld.loa", "Lunghezza fuori tutto (LOA)", "Length overall (LOA)", "Eslora total (LOA)", "Longueur hors tout (LOA)");
    R("fld.unit", "Unità di misura", "Unit of measure", "Unidad de medida", "Unité de mesure");
    R("fld.beam", "Larghezza massima (baglio)", "Beam (maximum width)", "Manga (anchura máxima)", "Largeur maximale (bau)");
    R("fld.registered", "Immatricolazione", "Registration", "Matriculación", "Immatriculation");
    R("fld.registration", "Sigla di immatricolazione", "Registration number", "Matrícula", "Numéro d'immatriculation");
    R("fld.engineHours", "Ore motore", "Engine hours", "Horas de motor", "Heures moteur");
    R("fld.berthKind", "Dove si trova la barca?", "Where is the boat?", "¿Dónde está el barco?", "Où se trouve le bateau ?");
    R("fld.location", "Porto o località", "Marina or place", "Puerto o localidad", "Port ou localité");
    R("fld.boatName", "Nome della barca", "Boat name", "Nombre del barco", "Nom du bateau");
    R("fld.colorCode", "Codice colore / gelcoat", "Colour / gelcoat code", "Código de color / gelcoat", "Code couleur / gelcoat");
    R("fld.firstName", "Nome", "First name", "Nombre", "Prénom");
    R("fld.lastName", "Cognome", "Last name", "Apellidos", "Nom");
    R("fld.phone", "Telefono", "Phone", "Teléfono", "Téléphone");
    R("fld.email", "Email", "Email", "Correo electrónico", "E-mail");
    R("fld.notes", "Note", "Notes", "Notas", "Notes");
    R("fld.optional", "(opzionale)", "(optional)", "(opcional)", "(facultatif)");

    R("hint.builder",
        "Scegli dall'elenco, oppure scrivilo se non lo trovi.",
        "Pick from the list, or type it if it isn't there.",
        "Elige de la lista o escríbelo si no aparece.",
        "Choisissez dans la liste, ou saisissez-le s'il n'y figure pas.");
    R("hint.model",
        "Se scegli un modello dell'elenco, compiliamo noi lunghezza e tipo.",
        "If you pick a model from the list, we fill in length and type for you.",
        "Si eliges un modelo de la lista, rellenamos nosotros la eslora y el tipo.",
        "Si vous choisissez un modèle de la liste, nous renseignons la longueur et le type.");
    R("hint.loa", "Nell'unità scelta qui sopra, ad esempio 28 ft o 8,5 m.", "In the unit chosen above, for example 28 ft or 8,5 m.", "En la unidad elegida arriba, por ejemplo 28 ft u 8,5 m.", "Dans l'unité choisie ci-dessus, par exemple 28 ft ou 8,5 m.");
    R("hint.beam", "La parte più larga dello scafo. Se scegli un modello dell'elenco la compiliamo noi.", "The widest part of the hull. If you pick a model from the list, we fill it in.", "La parte más ancha del casco. Si eliges un modelo de la lista, la rellenamos nosotros.", "La partie la plus large de la coque. Si vous choisissez un modèle de la liste, nous la renseignons.");
    R("hint.registration.h",
        "Come riportata sui documenti. <span class=\"ph\">Formato da verificare.</span>",
        "As shown on the papers. <span class=\"ph\">Format to be checked.</span>",
        "Tal como figura en la documentación. <span class=\"ph\">Formato por verificar.</span>",
        "Telle qu'elle figure sur les papiers. <span class=\"ph\">Format à vérifier.</span>");
    R("hint.engineHours", "La trovi sul contaore del motore.", "You can read it on the engine hour meter.", "La encuentras en el horómetro del motor.", "Vous la trouvez sur le compteur d'heures du moteur.");
    R("hint.location",
        "Solo zona di Venezia: porto, rimessaggio o località.",
        "Venice area only: marina, storage yard or place.",
        "Solo zona de Venecia: puerto, varadero o localidad.",
        "Région de Venise uniquement : port, hivernage ou localité.");
    R("hint.colorCode.h",
        "Spesso è nel manuale del cantiere. <span class=\"ph\">Da verificare.</span>",
        "Often in the builder's manual. <span class=\"ph\">To be checked.</span>",
        "Suele estar en el manual del astillero. <span class=\"ph\">Por verificar.</span>",
        "Souvent dans le manuel du chantier. <span class=\"ph\">À vérifier.</span>");
    R("hint.phone",
        "Cellulare (3…) o fisso (0…). Per un numero estero scrivi anche il prefisso, ad esempio +33.",
        "Mobile (3…) or landline (0…). For a non-Italian number, include the prefix, for example +33.",
        "Móvil (3…) o fijo (0…). Para un número extranjero, escribe también el prefijo, por ejemplo +33.",
        "Mobile (3…) ou fixe (0…). Pour un numéro étranger, ajoutez l'indicatif, par exemple +33.");
    R("hint.email", "Qui ti inviamo il codice di monitoraggio.", "This is where we send your tracking code.", "Aquí te enviamos el código de seguimiento.", "C'est ici que nous vous envoyons le code de suivi.");
    R("ph.notes",
        "Danni da riparare, tempi, dove si trova la barca o altri dettagli utili",
        "Damage to repair, timing, where the boat is, or any other useful detail",
        "Daños que reparar, plazos, dónde está el barco u otros detalles útiles",
        "Dégâts à réparer, délais, lieu où se trouve le bateau ou autres détails utiles");
    R("opt.unit.ft", "Piedi (ft)", "Feet (ft)", "Pies (ft)", "Pieds (ft)");
    R("opt.unit.m", "Metri (m)", "Metres (m)", "Metros (m)", "Mètres (m)");
    R("opt.registrata", "Immatricolata", "Registered", "Matriculado", "Immatriculé");
    R("opt.natante", "Natante (non immatricolata)", "Unregistered («natante»)", "Sin matricular («natante»)", "Non immatriculé («natante»)");
    R("opt.berth.acqua", "In acqua", "In the water", "En el agua", "À l'eau");
    R("opt.berth.terra", "A terra / in rimessaggio", "On land / in storage", "En tierra / en varadero", "À terre / en hivernage");
    R("opt.berth.carrello", "Su carrello", "On a trailer", "En remolque", "Sur remorque");
    // What each boat-type card also covers (shown under its name), and the
    // note under the cards for anything that is not on the list.
    R("type.sub.gommone",
        "RIB, battello pneumatico, tender",
        "RIB, inflatable boat, tender",
        "RIB, embarcación neumática, auxiliar",
        "Semi-rigide, bateau pneumatique, annexe");
    R("type.sub.open",
        "Fuoribordo, walkaround, center console, day cruiser, barchino, gozzo",
        "Outboard, walkaround, centre console, day cruiser, runabout, gozzo",
        "Fueraborda, walkaround, consola central, day cruiser, lancha, gozzo",
        "Hors-bord, walkaround, console centrale, day cruiser, runabout, gozzo");
    R("type.sub.cabinato",
        "Sport cruiser, hard-top, entrofuoribordo",
        "Sport cruiser, hard-top, sterndrive",
        "Sport cruiser, hard-top, intra-fueraborda",
        "Sport cruiser, hard-top, inbord à embase");
    R("type.sub.yacht",
        "Motoryacht, flybridge, navetta, trawler",
        "Motor yacht, flybridge, navetta, trawler",
        "Yate a motor, flybridge, navetta, trawler",
        "Yacht à moteur, flybridge, navetta, trawler");
    R("type.sub.vela",
        "Cabinata, monoscafo",
        "Cabin sailboat, monohull",
        "Cabinada, monocasco",
        "Voilier de croisière, monocoque");
    R("type.note",
        "Catamarano o altro tipo? Scegli il più simile e descrivilo nelle note.",
        "Catamaran or another type? Choose the closest one and describe it in the notes.",
        "¿Catamarán u otro tipo? Elige el más parecido y descríbelo en las notas.",
        "Catamaran ou autre type ? Choisissez le plus proche et décrivez-le dans les notes.");
    R("model.autofilled",
        "Tipo, lunghezza e larghezza compilati dal catalogo, verifica i dati.",
        "Type, length and beam filled in from the catalogue, please check them.",
        "Tipo, eslora y manga rellenados desde el catálogo, revisa los datos.",
        "Type, longueur et bau renseignés depuis le catalogue, vérifiez les données.");
    R("model.source", "dati da {host}", "data from {host}", "datos de {host}", "données de {host}");
    R("note.natante10.h",
        "<span class=\"ph\">Oltre i 10 m le unità da diporto vanno immatricolate: controlla i dati.</span>",
        "<span class=\"ph\">Pleasure craft over 10 m have to be registered: please check the details.</span>",
        "<span class=\"ph\">Las embarcaciones de recreo de más de 10 m deben matricularse: revisa los datos.</span>",
        "<span class=\"ph\">Au-delà de 10 m, les unités de plaisance doivent être immatriculées : vérifiez les données.</span>");
    // Where the job is done: the body shop for small boats, the local
    // shipyard for bigger ones. The length limit and the yard are placeholders.
    R("note.site.shop.h",
        "Lavoriamo solo nella zona di Venezia. Fino a <span class=\"ph\">{max} m</span> il lavoro si fa <strong>in carrozzeria</strong>, a Olmo di Martellago.",
        "We only work in the Venice area. Up to <span class=\"ph\">{max} m</span> the work is done <strong>at our body shop</strong> in Olmo di Martellago.",
        "Solo trabajamos en la zona de Venecia. Hasta <span class=\"ph\">{max} m</span> el trabajo se hace <strong>en nuestro taller</strong> de Olmo di Martellago.",
        "Nous travaillons uniquement dans la région de Venise. Jusqu'à <span class=\"ph\">{max} m</span>, le travail se fait <strong>dans notre atelier</strong> d'Olmo di Martellago.");
    R("note.site.yard.h",
        "Lavoriamo solo nella zona di Venezia. Oltre <span class=\"ph\">{max} m</span> il lavoro si fa <strong>in cantiere</strong>, <span class=\"ph\">cantiere da confermare</span>.",
        "We only work in the Venice area. Over <span class=\"ph\">{max} m</span> the work is done <strong>at the local shipyard</strong>, <span class=\"ph\">yard to be confirmed</span>.",
        "Solo trabajamos en la zona de Venecia. Con más de <span class=\"ph\">{max} m</span> el trabajo se hace <strong>en el astillero</strong> de la zona, <span class=\"ph\">astillero por confirmar</span>.",
        "Nous travaillons uniquement dans la région de Venise. Au-delà de <span class=\"ph\">{max} m</span>, le travail se fait <strong>au chantier naval</strong> local, <span class=\"ph\">chantier à confirmer</span>.");
    R("zones.cleared",
        "Le zone scelte sono state azzerate perché hai cambiato tipo di barca.",
        "Your selected zones were cleared because you changed the type of boat.",
        "Se han borrado las zonas elegidas porque has cambiado el tipo de barco.",
        "Les zones choisies ont été effacées car vous avez changé de type de bateau.");

    /* ---------------- Errors (what to do, with an example) ---------------- */
    R("err.boatType",
        "Scegli il tipo di barca: ci serve per mostrarti il modello 3D giusto.",
        "Choose the type of boat: we need it to show you the right 3D model.",
        "Elige el tipo de barco: lo necesitamos para mostrarte el modelo 3D adecuado.",
        "Choisissez le type de bateau : nous en avons besoin pour afficher le bon modèle 3D.");
    R("err.berthKind",
        "Indica dove si trova la barca: in acqua, a terra o su carrello.",
        "Say where the boat is: in the water, on land or on a trailer.",
        "Indica dónde está el barco: en el agua, en tierra o en remolque.",
        "Indiquez où se trouve le bateau : à l'eau, à terre ou sur remorque.");
    R("err.builder", "Indica il cantiere costruttore, ad esempio Beneteau.", "Enter the builder, for example Beneteau.", "Indica el astillero, por ejemplo Beneteau.", "Indiquez le chantier, par exemple Beneteau.");
    R("err.model", "Indica il modello.", "Enter the model.", "Indica el modelo.", "Indiquez le modèle.");
    R("err.year", "Inserisci un anno tra {min} e {max}.", "Enter a year between {min} and {max}.", "Introduce un año entre {min} y {max}.", "Saisissez une année entre {min} et {max}.");
    R("err.loa",
        "Inserisci la lunghezza in {unit}, tra {min} e {max} (es. 8,5).",
        "Enter the length in {unit}, between {min} and {max} (e.g. 8,5).",
        "Introduce la eslora en {unit}, entre {min} y {max} (p. ej. 8,5).",
        "Saisissez la longueur en {unit}, entre {min} et {max} (par ex. 8,5).");
    R("err.beam",
        "Inserisci la larghezza in {unit}, tra {min} e {max} e minore della lunghezza.",
        "Enter the beam in {unit}, between {min} and {max} and less than the length.",
        "Introduce la manga en {unit}, entre {min} y {max} y menor que la eslora.",
        "Saisissez le bau en {unit}, entre {min} et {max} et inférieur à la longueur.");
    R("err.registered",
        "Indica se la barca è immatricolata o è un natante.",
        "Say whether the boat is registered or not.",
        "Indica si el barco está matriculado o no.",
        "Indiquez si le bateau est immatriculé ou non.");
    R("err.registration",
        "Controlla la sigla di immatricolazione: servono da 3 a 15 tra lettere e numeri.",
        "Check the registration number: it needs 3 to 15 letters and digits.",
        "Revisa la matrícula: deben ser entre 3 y 15 letras y números.",
        "Vérifiez le numéro d'immatriculation : 3 à 15 lettres et chiffres.");
    R("err.engineHours", "Le ore motore non possono superare {max}.", "Engine hours can't exceed {max}.", "Las horas de motor no pueden superar {max}.", "Les heures moteur ne peuvent pas dépasser {max}.");
    R("err.firstName", "Inserisci il nome.", "Enter your first name.", "Escribe tu nombre.", "Saisissez votre prénom.");
    R("err.lastName", "Inserisci il cognome.", "Enter your last name.", "Escribe tus apellidos.", "Saisissez votre nom.");
    R("err.phone",
        "Inserisci un numero valido: cellulare (3…) o fisso (0…), oppure con il prefisso internazionale (+33…).",
        "Enter a valid number: mobile (3…) or landline (0…), or with the international prefix (+33…).",
        "Introduce un número válido: móvil (3…) o fijo (0…), o con el prefijo internacional (+33…).",
        "Saisissez un numéro valide : mobile (3…) ou fixe (0…), ou avec l'indicatif international (+33…).");
    R("err.email.empty",
        "Scrivi la tua email: lì ti inviamo il codice di monitoraggio.",
        "Enter your email: that's where we send your tracking code.",
        "Escribe tu correo electrónico: ahí te enviamos el código de seguimiento.",
        "Saisissez votre e-mail : c'est là que nous envoyons votre code de suivi.");
    R("err.email.bad",
        "Inserisci un'email valida, ad esempio nome@dominio.it.",
        "Enter a valid email, for example name@domain.com.",
        "Introduce un correo válido, por ejemplo nombre@dominio.es.",
        "Saisissez un e-mail valide, par exemple nom@domaine.fr.");

    /* ---------------- Finish tiers (the site's own package names) ---------- */
    R("tier.base.name", "Pacchetto Base", "Base package", "Paquete Base", "Formule Base");
    R("tier.completo.name", "Pacchetto Completo", "Complete package", "Paquete Completo", "Formule Complète");
    R("tier.premium.name", "Pacchetto Premium", "Premium package", "Paquete Premium", "Formule Premium");
    /* Contents as listed under «Pacchetti di manutenzione» on
       carrozzeriacipressina.it/manuntenzione-barche/ (ES / FR follow the
       site's own translations). */
    R("tier.base.i1", "Controllo generale del motore", "General engine check", "Revisión general del motor", "Contrôle général du moteur");
    R("tier.base.i2", "Lavaggio della carrozzeria", "Exterior wash", "Lavado de la carrocería", "Lavage de la coque");
    R("tier.completo.i1", "Manutenzione completa di motore e scafo", "Full engine and hull maintenance", "Mantenimiento completo del motor y el casco", "Entretien complet du moteur et de la coque");
    R("tier.completo.i2", "Servizi di riparazione", "Repair services", "Servicios de reparación", "Services de réparation");
    R("tier.premium.i1", "Tutti i servizi del Pacchetto Completo", "Every service in the Complete package", "Todos los servicios del Paquete Completo", "Tous les services de la formule Complète");
    R("tier.premium.i2", "Monitoraggio stagionale", "Seasonal monitoring", "Seguimiento estacional", "Suivi saisonnier");
    R("tier.premium.i3", "Assistenza prioritaria", "Priority assistance", "Asistencia prioritaria", "Assistance prioritaire");
    R("tier.nessuno.name", "Nessun pacchetto", "No package", "Ningún paquete", "Aucune formule");
    R("tier.nessuno.i1", "Solo i lavori sulle zone che scegli al passo 3", "Only the work on the zones you pick in step 3", "Solo los trabajos en las zonas que elijas en el paso 3", "Uniquement les travaux sur les zones choisies à l'étape 3");
    R("tier.from", "da {price} al metro (minimo {min})", "from {price} per metre (minimum {min})", "desde {price} el metro (mínimo {min})", "à partir de {price} le mètre (minimum {min})");
    R("tier.choose", "Scegli questo pacchetto", "Choose this package", "Elegir este paquete", "Choisir cette formule");
    R("tier.badge.h",
        "<span class=\"ph\">Più scelto</span>",
        "<span class=\"ph\">Most popular</span>",
        "<span class=\"ph\">El más elegido</span>",
        "<span class=\"ph\">Le plus choisi</span>");

    /* ---------------- 3D viewer, zone summary, estimate ---------------- */
    R("viewer.loading", "Caricamento del modello 3D…", "Loading the 3D model…", "Cargando el modelo 3D…", "Chargement du modèle 3D…");
    R("viewer.errorImport",
        "Impossibile caricare il visore 3D. Scegli le zone dall'elenco qui sotto.",
        "Couldn't load the 3D viewer. Choose the zones from the list below.",
        "No se ha podido cargar el visor 3D. Elige las zonas en la lista de abajo.",
        "Impossible de charger la vue 3D. Choisissez les zones dans la liste ci-dessous.");
    R("viewer.errorMount",
        "Impossibile aprire il visore 3D. Scegli le zone dall'elenco qui sotto.",
        "Couldn't open the 3D viewer. Choose the zones from the list below.",
        "No se ha podido abrir el visor 3D. Elige las zonas en la lista de abajo.",
        "Impossible d'ouvrir la vue 3D. Choisissez les zones dans la liste ci-dessous.");
    R("viewer.label",
        "Modello 3D della barca. Tocca una zona per selezionarla.",
        "3D model of the boat. Tap a zone to select it.",
        "Modelo 3D del barco. Toca una zona para seleccionarla.",
        "Modèle 3D du bateau. Touchez une zone pour la sélectionner.");
    R("viewer.views", "Angolo di vista", "Viewing angle", "Ángulo de vista", "Angle de vue");
    R("view.prua", "Prua", "Bow", "Proa", "Proue");
    R("view.poppa", "Poppa", "Stern", "Popa", "Poupe");
    R("view.sinistra", "Sinistra", "Port", "Babor", "Bâbord");
    R("view.destra", "Destra", "Starboard", "Estribor", "Tribord");
    R("view.alto", "Alto", "Top", "Arriba", "Dessus");
    R("view.sotto", "Sotto", "Underside", "Abajo", "Dessous");
    R("viewer.hint",
        "Tocca una zona della barca per selezionarla o toglierla. Usa i pulsanti, o scorri di lato, per cambiare vista.",
        "Tap a zone of the boat to select or deselect it. Use the buttons, or swipe sideways, to change the view.",
        "Toca una zona del barco para seleccionarla o quitarla. Usa los botones, o desliza de lado, para cambiar de vista.",
        "Touchez une zone du bateau pour la sélectionner ou la retirer. Utilisez les boutons, ou balayez de côté, pour changer de vue.");

    R("sum.title", "Zone selezionate", "Selected zones", "Zonas seleccionadas", "Zones sélectionnées");
    R("sum.count",
        { one: "{count} zona", other: "{count} zone" },
        { one: "{count} zone", other: "{count} zones" },
        { one: "{count} zona", other: "{count} zonas" },
        { one: "{count} zone", other: "{count} zones" });
    R("sum.empty",
        "Nessuna zona selezionata. Tocca la barca per sceglierne una.",
        "No zones selected yet. Tap the boat to pick one.",
        "Ninguna zona seleccionada. Toca el barco para elegir una.",
        "Aucune zone sélectionnée. Touchez le bateau pour en choisir une.");
    // Step 3: the choices that change the price. The +25 % is zones.js SURCHARGE.
    R("opt.title", "Dettagli del lavoro", "Job details", "Detalles del trabajo", "Détails du travail");
    R("fld.finish", "Finitura", "Finish", "Acabado", "Finition");
    R("opt.finish.pastello", "Pastello (tinta unita)", "Solid colour", "Color liso", "Teinte unie");
    R("opt.finish.metallizzato", "Metallizzato (+25%)", "Metallic (+25%)", "Metalizado (+25%)", "Métallisé (+25%)");
    R("fld.repair", "Condizioni dello scafo", "Condition of the hull", "Estado del casco", "État de la coque");
    R("opt.repair.stuccature", "Piccole stuccature", "Minor filling", "Pequeños masillados", "Petits rebouchages");
    R("opt.repair.resinatura", "Resinatura moderata (+25%)", "Moderate resin repair (+25%)", "Reparación moderada con resina (+25%)", "Réparation modérée à la résine (+25%)");
    R("opt.repair.gravose", "Riparazioni gravose (preventivo personalizzato)", "Heavy repairs (custom quote)", "Reparaciones importantes (presupuesto personalizado)", "Réparations importantes (devis personnalisé)");
    R("opt.nonSlip", "Antisdrucciolo sulla coperta (+25%)", "Non-slip deck (+25%)", "Antideslizante en la cubierta (+25%)", "Antidérapant sur le pont (+25%)");
    R("fld.bottomWork", "Lavoro sull'opera viva", "Underwater hull work", "Trabajo en la obra viva", "Travail sur les œuvres vives");
    R("opt.bottom.antivegetativa", "Solo antivegetativa", "Antifouling only", "Solo antiincrustante", "Antifouling seul");
    R("opt.bottom.sabbiatura", "Sabbiatura e ripristino", "Sandblasting and restoration", "Chorreado y restauración", "Sablage et remise en état");
    R("opt.hardware", "Stacco e riattacco di accessori e ferramenta (a consuntivo, 40 €/h + IVA)", "Removal and refitting of fittings and hardware (charged as worked, €40/h + VAT)", "Desmontaje y montaje de accesorios y herrajes (a posteriori, 40 €/h + IVA)", "Dépose et repose des accessoires et de la quincaillerie (sur facture, 40 €/h + TVA)");

    R("sum.subtotal", "Lavori sulle zone", "Zone work", "Trabajos en las zonas", "Travaux sur les zones");
    R("sum.total", "Totale stimato", "Estimated total", "Total estimado", "Total estimé");
    R("sum.note",
        "{tier}, calcolato su {loa} × {beam} {unit}. Prezzi IVA esclusa. Prezzo indicativo: il preventivo definitivo lo conferma l'officina.",
        "{tier}, calculated on {loa} × {beam} {unit}. Prices exclude VAT. Indicative price: the workshop confirms the final quote.",
        "{tier}, calculado sobre {loa} × {beam} {unit}. Precios sin IVA. Precio orientativo: el taller confirma el presupuesto definitivo.",
        "{tier}, calculé sur {loa} × {beam} {unit}. Prix hors TVA. Prix indicatif : l'atelier confirme le devis définitif.");
    R("sum.custom", "Preventivo personalizzato", "Custom quote", "Presupuesto personalizado", "Devis personnalisé");
    R("sum.customNote",
        "Con riparazioni gravose il prezzo si definisce dopo un sopralluogo.",
        "With heavy repairs the price is set after an inspection.",
        "Con reparaciones importantes el precio se fija tras una inspección.",
        "Avec des réparations importantes, le prix est fixé après une inspection.");
    R("sum.hardware",
        "Stacco e riattacco: a consuntivo, {price}/h + IVA.",
        "Removal and refitting: charged as worked, {price}/h + VAT.",
        "Desmontaje y montaje: a posteriori, {price}/h + IVA.",
        "Dépose et repose : sur facture, {price}/h + TVA.");
    R("sum.unpriced",
        { one: "Non include {count} zona senza prezzo di listino.", other: "Non include {count} zone senza prezzo di listino." },
        { one: "Doesn't include {count} zone without a list price.", other: "Doesn't include {count} zones without a list price." },
        { one: "No incluye {count} zona sin precio de tarifa.", other: "No incluye {count} zonas sin precio de tarifa." },
        { one: "Ne comprend pas {count} zone sans prix catalogue.", other: "Ne comprend pas {count} zones sans prix catalogue." });
    R("sum.placeholder.h",
        "<span class=\"ph\">prezzi segnaposto</span>",
        "<span class=\"ph\">placeholder prices</span>",
        "<span class=\"ph\">precios provisionales</span>",
        "<span class=\"ph\">prix provisoires</span>");
    R("est.none", "—", "—", "—", "—");
    R("zones.picker", "Scegli le zone da un elenco", "Choose the zones from a list", "Elige las zonas de una lista", "Choisir les zones dans une liste");
    R("zones.pickerLegend", "Zone della barca", "Zones of the boat", "Zonas del barco", "Zones du bateau");

    /* ---------------- Home: hero swatches and the price sentence ----------- */
    R("hero.swatchLabel",
        "Prova un colore di antivegetativa sull'opera viva",
        "Try an antifouling colour on the hull below the waterline",
        "Prueba un color de antiincrustante en la obra viva",
        "Essayez une couleur d'antifouling sur les œuvres vives");
    R("hero.swatchChosen", "Colore scelto:", "Selected colour:", "Color elegido:", "Couleur choisie :");
    R("hero.swatchNote",
        "Colori indicativi: l'antivegetativa reale può differire.",
        "Indicative colours: the actual antifouling may differ.",
        "Colores orientativos: el antiincrustante real puede variar.",
        "Couleurs indicatives : l'antifouling réel peut différer.");
    R("hero.boatAlt", "Barca con l'opera viva colorata", "Boat with a coloured underwater hull", "Barco con la obra viva coloreada", "Bateau aux œuvres vives colorées");

    // The ten antifouling colours of research.md §5 (names as the makers print
    // them, codes included) plus «Originale».
    R("sw.original", "Originale", "Original", "Original", "D'origine");
    R("sw.bianco", "Bianco", "White", "Blanco", "Blanc");
    R("sw.azzurro", "Azzurro", "Light blue", "Azul claro", "Bleu clair");
    R("sw.grigio12400", "Grigio 12400", "Grey 12400", "Gris 12400", "Gris 12400");
    R("sw.grigioScuro", "Grigio scuro", "Dark grey", "Gris oscuro", "Gris foncé");
    R("sw.verde", "Verde BQA643", "Green BQA643", "Verde BQA643", "Vert BQA643");
    R("sw.marrone", "Marrone BQA648", "Brown BQA648", "Marrón BQA648", "Brun BQA648");
    R("sw.rosso", "Rosso", "Red", "Rojo", "Rouge");
    R("sw.bluScuro", "Blu scuro", "Dark blue", "Azul oscuro", "Bleu foncé");
    R("sw.blu37110", "Blu scuro 37110", "Dark blue 37110", "Azul oscuro 37110", "Bleu foncé 37110");
    R("sw.nero", "Nero", "Black", "Negro", "Noir");

    // Step 3: the optional antifouling colour, offered when «Opera viva» is a
    // selected zone. Colour names are the sw.<id> keys above.
    R("af.label", "Colore antivegetativa (indicativo)", "Antifouling colour (indicative)", "Color del antiincrustante (orientativo)", "Couleur d'antifouling (indicative)");
    R("af.note.h",
        "<span class=\"ph\">colori indicativi</span>",
        "<span class=\"ph\">indicative colours</span>",
        "<span class=\"ph\">colores orientativos</span>",
        "<span class=\"ph\">couleurs indicatives</span>");

    R("ql.pre", "Intervenire su", "Working on", "Intervenir en", "Intervenir sur");
    R("ql.zoneOne", "zona", "zone", "zona", "zone");
    R("ql.zoneMany", "zone", "zones", "zonas", "zones");
    R("ql.mid1", "di una barca lunga", "of a boat", "de un barco de", "d'un bateau de");
    R("ql.afterLoa", "", "long", "de eslora", "de long");
    R("ql.mid2", "con il", "with the", "con el", "avec la"); // design/sketches only
    R("ql.opt.base", "con il Pacchetto Base", "with the Base package", "con el Paquete Base", "avec la formule Base");
    R("ql.opt.completo", "con il Pacchetto Completo", "with the Complete package", "con el Paquete Completo", "avec la formule Complète");
    R("ql.opt.premium", "con il Pacchetto Premium", "with the Premium package", "con el Paquete Premium", "avec la formule Premium");
    R("ql.opt.nessuno", "senza pacchetto", "without a package", "sin paquete", "sans formule");
    R("ql.post", "costa da", "costs from", "cuesta desde", "coûte à partir de");
    R("ql.cta", "Seleziona le zone in 3D", "Pick the zones in 3D", "Selecciona las zonas en 3D", "Sélectionner les zones en 3D");
    R("ql.countLabel", "Numero di zone", "Number of zones", "Número de zonas", "Nombre de zones");
    R("ql.loaLabel", "Lunghezza della barca", "Boat length", "Eslora del barco", "Longueur du bateau");
    R("ql.tierLabel", "Pacchetto", "Package", "Paquete", "Formule");

    /* ---------------- Success and lookup ---------------- */
    R("success.title", "Richiesta inviata!", "Request sent!", "¡Solicitud enviada!", "Demande envoyée !");
    R("success.lede",
        "Grazie! Con il codice qui sotto potrai verificare lo stato della richiesta.",
        "Thank you! Use the code below to check the status of your request.",
        "¡Gracias! Con el código de abajo podrás consultar el estado de tu solicitud.",
        "Merci ! Le code ci-dessous vous permettra de suivre l'état de votre demande.");
    R("success.code", "Il tuo codice di monitoraggio", "Your tracking code", "Tu código de seguimiento", "Votre code de suivi");
    // success.demo, success.demoNote.h, lookup.res.sample, lookup.demoNote.h: only the design/sketches use them.
    R("success.demo", "codice dimostrativo", "demo code", "código de demostración", "code de démonstration");
    R("success.demoNote.h",
        "Questa è una bozza di design: <span class=\"ph\">nessuna richiesta è stata davvero inviata.</span>",
        "This is a design draft: <span class=\"ph\">no request has actually been sent.</span>",
        "Esto es un borrador de diseño: <span class=\"ph\">no se ha enviado ninguna solicitud de verdad.</span>",
        "Ceci est une maquette : <span class=\"ph\">aucune demande n'a réellement été envoyée.</span>");
    R("success.lookup", "Verifica la tua richiesta", "Check your request", "Consulta tu solicitud", "Suivre votre demande");
    // A failed send (src/app.js sendErrorKey), shown under the main button.
    R("send.err.busy",
        "Abbiamo ricevuto troppe richieste dalla tua connessione. Riprova più tardi o scrivici su WhatsApp.",
        "We've had too many requests from your connection. Try again later or message us on WhatsApp.",
        "Hemos recibido demasiadas solicitudes desde tu conexión. Inténtalo más tarde o escríbenos por WhatsApp.",
        "Nous avons reçu trop de demandes depuis votre connexion. Réessayez plus tard ou écrivez-nous sur WhatsApp.");
    R("send.err.bad",
        "Alcuni dati non sono stati accettati. Ricarica la pagina, controlla i passaggi e riprova.",
        "Some details weren't accepted. Reload the page, check the steps and try again.",
        "Algunos datos no se han aceptado. Recarga la página, revisa los pasos e inténtalo de nuevo.",
        "Certaines données n'ont pas été acceptées. Rechargez la page, vérifiez les étapes et réessayez.");
    R("send.err.down",
        "Il servizio non risponde in questo momento. Riprova tra un minuto: la richiesta non è ancora stata salvata.",
        "The service isn't answering right now. Try again in a minute: your request hasn't been saved yet.",
        "El servicio no responde en este momento. Inténtalo de nuevo en un minuto: tu solicitud aún no se ha guardado.",
        "Le service ne répond pas pour le moment. Réessayez dans une minute : votre demande n'a pas encore été enregistrée.");

    R("lookup.title", "Verifica la tua richiesta", "Check your request", "Consulta tu solicitud", "Suivre votre demande");
    R("lookup.sub", "Inserisci il codice di 10 cifre che hai ricevuto.", "Enter the 10-digit code you received.", "Introduce el código de 10 dígitos que recibiste.", "Saisissez le code à 10 chiffres que vous avez reçu.");
    R("lookup.label", "Codice di 10 cifre", "10-digit code", "Código de 10 dígitos", "Code à 10 chiffres");
    R("lookup.submit", "Verifica", "Check", "Consultar", "Vérifier");
    R("lookup.busy", "Verifica in corso…", "Checking…", "Consultando…", "Vérification…");
    R("lookup.err", "Il codice ha 10 cifre. Controllalo e riprova.", "The code has 10 digits. Check it and try again.", "El código tiene 10 dígitos. Revísalo e inténtalo de nuevo.", "Le code comporte 10 chiffres. Vérifiez-le et réessayez.");
    R("lookup.notFound", "Nessuna richiesta con questo codice. Controllalo e riprova.", "No request has this code. Check it and try again.", "No hay ninguna solicitud con este código. Revísalo e inténtalo de nuevo.", "Aucune demande ne correspond à ce code. Vérifiez-le et réessayez.");
    R("lookup.down", "Non riusciamo a verificare adesso. Riprova tra un minuto.", "We can't check right now. Try again in a minute.", "No podemos consultarlo ahora. Inténtalo de nuevo en un minuto.", "Impossible de vérifier pour le moment. Réessayez dans une minute.");
    R("lookup.res.code", "Codice", "Code", "Código", "Code");
    R("lookup.res.boat", "Barca", "Boat", "Barco", "Bateau");
    R("lookup.res.name", "Intestatario", "Owner", "Titular", "Titulaire");
    R("lookup.res.status", "Stato", "Status", "Estado", "État");
    R("lookup.res.sample", "(dato di esempio)", "(sample data)", "(dato de ejemplo)", "(donnée d'exemple)");
    R("lookup.demoNote.h",
        "Esito dimostrativo: <span class=\"ph\">stati e dati reali da collegare.</span>",
        "Demo result: <span class=\"ph\">real statuses and data still to be connected.</span>",
        "Resultado de demostración: <span class=\"ph\">estados y datos reales por conectar.</span>",
        "Résultat de démonstration : <span class=\"ph\">statuts et données réels à raccorder.</span>");
    // Request statuses: the CHECK list in server/schema.sql. The vocabulary is a placeholder until the owner confirms it.
    R("status.ricevuta", "Ricevuta", "Received", "Recibida", "Reçue");
    R("status.alaggio", "Alaggio", "Haul-out", "Puesta en seco", "Mise à terre");
    R("status.trasporto", "Trasporto", "Transport", "Transporte", "Transport");
    R("status.preparazione", "Preparazione", "Preparation", "Preparación", "Préparation");
    R("status.verniciatura", "Verniciatura", "Painting", "Pintura", "Peinture");
    R("status.antivegetativa", "Antivegetativa", "Antifouling", "Antiincrustante", "Antifouling");
    R("status.varo", "Varo", "Launch", "Botadura", "Mise à l'eau");
    R("status.pronta", "Pronta", "Ready", "Lista", "Prête");
    R("status.consegnata", "Consegnata", "Delivered", "Entregada", "Livrée");
    R("status.annullata", "Annullata", "Cancelled", "Cancelada", "Annulée");

    /* ---------------- Contact, footer, FAQ ---------------- */
    R("contact.address", "Indirizzo", "Address", "Dirección", "Adresse");
    R("contact.phone", "Telefono", "Phone", "Teléfono", "Téléphone");
    R("contact.email", "Email", "Email", "Correo electrónico", "E-mail");
    R("contact.hours", "Orari", "Opening hours", "Horario", "Horaires");
    R("contact.mapTitle", "Mappa: Officina Carrozzeria Cipressina, Olmo di Martellago", "Map: Officina Carrozzeria Cipressina, Olmo di Martellago", "Mapa: Officina Carrozzeria Cipressina, Olmo di Martellago", "Carte : Officina Carrozzeria Cipressina, Olmo di Martellago");
    R("contact.whatsapp", "WhatsApp", "WhatsApp", "WhatsApp", "WhatsApp");
    R("contact.openingHours.h",
        "Lun–Ven: 07:15–12:30, 13:30–19:15<br>Sab: 07:30–12:00<br>Dom: chiuso",
        "Mon–Fri: 07:15–12:30, 13:30–19:15<br>Sat: 07:30–12:00<br>Sun: closed",
        "Lun–Vie: 07:15–12:30, 13:30–19:15<br>Sáb: 07:30–12:00<br>Dom: cerrado",
        "Lun–Ven : 07:15–12:30, 13:30–19:15<br>Sam : 07:30–12:00<br>Dim : fermé");
    R("contact.whatsappTbc.h",
        "<span class=\"ph\">WhatsApp: numero da confermare</span>",
        "<span class=\"ph\">WhatsApp: number to be confirmed</span>",
        "<span class=\"ph\">WhatsApp: número por confirmar</span>",
        "<span class=\"ph\">WhatsApp : numéro à confirmer</span>");
    R("contact.map", "Apri in Google Maps", "Open in Google Maps", "Abrir en Google Maps", "Ouvrir dans Google Maps");
    R("foot.vat", "P.IVA", "VAT no.", "N.º de IVA", "N° de TVA");
    R("foot.models", "Modelli 3D", "3D models", "Modelos 3D", "Modèles 3D");
    R("foot.modelsMod", "modificati (zone, colori, loghi rimossi)", "modified (zones, colours, logos removed)", "modificados (zonas, colores, logotipos eliminados)", "modifiés (zones, couleurs, logos supprimés)");
    R("privacy.h",
        "Inviando la richiesta accetti l'<span class=\"ph\">informativa sulla privacy (da collegare)</span>.",
        "By sending the request you accept the <span class=\"ph\">privacy notice (to be linked)</span>.",
        "Al enviar la solicitud aceptas la <span class=\"ph\">política de privacidad (por enlazar)</span>.",
        "En envoyant la demande, vous acceptez la <span class=\"ph\">politique de confidentialité (à relier)</span>.");

    R("faq.q1", "Quanto dura un lavoro?", "How long does a job take?", "¿Cuánto dura una intervención?", "Combien de temps dure une intervention ?");
    R("faq.q2", "Dovete vedere la barca prima di dare il prezzo?", "Do you need to see the boat before quoting a price?", "¿Tenéis que ver el barco antes de dar un precio?", "Devez-vous voir le bateau avant de donner un prix ?");
    R("faq.q3", "Ogni quanto va rifatta l'antivegetativa?", "How often should the antifouling be redone?", "¿Cada cuánto hay que renovar el antiincrustante?", "À quelle fréquence faut-il refaire l'antifouling ?");
    R("faq.q4", "Meglio gelcoat o verniciatura?", "Gelcoat or paint: which is better?", "¿Mejor gelcoat o pintura?", "Gelcoat ou peinture : que choisir ?");
    R("faq.q5", "Vi occupate di alaggio e trasporto?", "Do you handle haul-out and transport?", "¿Os encargáis de la puesta en seco y el transporte?", "Vous occupez-vous de la mise à terre et du transport ?");
    R("faq.q6", "Che garanzia date sui lavori?", "What warranty do you give on the work?", "¿Qué garantía dais en los trabajos?", "Quelle garantie donnez-vous sur les travaux ?");
    R("faq.q7",
        "Qual è il periodo migliore per intervenire (rimessaggio invernale)?",
        "When is the best time to book the work (winter storage)?",
        "¿Cuál es la mejor época para intervenir (invernada en seco)?",
        "Quelle est la meilleure période pour intervenir (hivernage) ?");
    R("faq.q8", "Quali pagamenti accettate?", "Which payment methods do you accept?", "¿Qué formas de pago aceptáis?", "Quels moyens de paiement acceptez-vous ?");
    R("faq.a.h",
        "<span class=\"ph\">Risposta da confermare con l'officina.</span>",
        "<span class=\"ph\">Answer to be confirmed with the workshop.</span>",
        "<span class=\"ph\">Respuesta por confirmar con el taller.</span>",
        "<span class=\"ph\">Réponse à confirmer avec l'atelier.</span>");

    /* ---------------- Boat types: one source, zones.js ---------------- */
    // zones.js loads first. The type labels live there (the checklist and the
    // type cards need them even without this file), and are exposed here as
    // type.<id> so skins and app.js use one lookup.
    var Z = W.CIPRESSINA_ZONES;
    if (Z && Z.TYPES) {
        Object.keys(Z.TYPES).forEach(function (id) {
            LANGS.forEach(function (l) { dict[l]["type." + id] = Z.TYPES[id][l]; });
        });
    }

    /* ---------------- Engine ---------------- */
    function detect() {
        try {
            var saved = W.localStorage.getItem(STORAGE_KEY);
            if (saved && LANGS.indexOf(saved) !== -1) return saved;
        } catch (e) { /* storage blocked: fall through */ }
        var nav = typeof navigator !== "undefined" ? navigator : null;
        var guess = nav && nav.language ? String(nav.language).slice(0, 2).toLowerCase() : "";
        return LANGS.indexOf(guess) !== -1 ? guess : "it";
    }
    var lang = detect();

    var pluralRules = {};
    function pluralCategory(l, count) {
        if (typeof Intl === "undefined" || !Intl.PluralRules) return count === 1 ? "one" : "other";
        if (!pluralRules[l]) pluralRules[l] = new Intl.PluralRules(l);
        return pluralRules[l].select(Number(count));
    }

    // t("key", {n: 3}, "en"). A missing key falls back to Italian, then to the
    // key itself (so a typo is visible on screen instead of blank).
    function t(key, params, l) {
        var code = l && has.call(dict, l) ? l : lang;
        var value;
        if (has.call(dict[code], key)) value = dict[code][key];
        else if (has.call(dict.it, key)) value = dict.it[key];
        else return key;
        if (value && typeof value === "object") {
            var category = pluralCategory(code, params ? params.count : 0);
            value = has.call(value, category) ? value[category] : value.other;
        }
        return String(value).replace(/\{(\w+)\}/g, function (match, name) {
            return params && has.call(params, name) ? String(params[name]) : match;
        });
    }

    function paramsOf(el) {
        var raw = el.getAttribute("data-i18n-params");
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch (e) { return undefined; }
    }

    function each(root, selector, fn) {
        if (root.matches && root.matches(selector)) fn(root);
        Array.prototype.forEach.call(root.querySelectorAll(selector), fn);
    }

    function apply(root) {
        root = root || W.document;
        if (!root || !root.querySelectorAll) return;
        each(root, "[data-i18n]", function (el) {
            el.textContent = t(el.getAttribute("data-i18n"), paramsOf(el));
        });
        each(root, "[data-i18n-html]", function (el) {
            el.innerHTML = t(el.getAttribute("data-i18n-html"), paramsOf(el));
        });
        each(root, "[data-i18n-attr]", function (el) {
            el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
                var cut = pair.indexOf(":");
                if (cut < 1) return;
                el.setAttribute(pair.slice(0, cut).trim(), t(pair.slice(cut + 1).trim(), paramsOf(el)));
            });
        });
    }

    // extend({it: {key: "…"}, en: {…}, …}): a page adds its own copy. Later
    // calls win. Applies straight away, so it is safe before or after app.js.
    function extend(extra) {
        if (!extra) return;
        LANGS.forEach(function (l) {
            if (!extra[l]) return;
            Object.keys(extra[l]).forEach(function (key) { dict[l][key] = extra[l][key]; });
        });
        if (W.document && W.document.body) apply(W.document);
    }

    function getLang() { return lang; }

    function setLang(next) {
        if (LANGS.indexOf(next) === -1) return;
        lang = next;
        if (W.document && W.document.documentElement) W.document.documentElement.lang = next;
        try { W.localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage blocked: the choice lasts until reload */ }
        apply(W.document);
        try {
            W.document.dispatchEvent(new W.CustomEvent("cipressina:lang", { detail: { lang: next } }));
        } catch (e) { /* no DOM (tests) */ }
    }

    var pre = W.CIPRESSINA_I18N_EXTRA;
    (Array.isArray(pre) ? pre : pre ? [pre] : []).forEach(extend);
    if (W.document && W.document.documentElement) W.document.documentElement.lang = lang;

    W.CIPRESSINA_I18N = {
        LANGS: LANGS,
        dict: dict,
        t: t,
        apply: apply,
        extend: extend,
        setLang: setLang,
        getLang: getLang
    };
})();
