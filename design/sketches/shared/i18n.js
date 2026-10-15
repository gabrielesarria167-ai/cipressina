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
        "Bozza di design · prezzi, foto e alcuni dati sono segnaposto",
        "Design draft · prices, photos and some details are placeholders",
        "Borrador de diseño · precios, fotos y algunos datos son provisionales",
        "Maquette · prix, photos et certaines données sont provisoires");
    R("nav.label", "Navigazione principale", "Main navigation", "Navegación principal", "Navigation principale");
    R("nav.home", "Cipressina Barche, torna all'inizio", "Cipressina Barche, back to the top", "Cipressina Barche, volver al inicio", "Cipressina Barche, retour à l'accueil");
    R("nav.servizi", "Servizi", "Services", "Servicios", "Services");
    R("nav.come", "Come funziona", "How it works", "Cómo funciona", "Comment ça marche");
    R("nav.interventi", "Interventi", "Packages", "Intervenciones", "Interventions");
    R("nav.chi", "Chi siamo", "About us", "Quiénes somos", "Qui sommes-nous");
    R("nav.contatti", "Contatti", "Contact", "Contacto", "Contact");
    R("nav.quote", "Preventivo", "Get a quote", "Presupuesto", "Devis");
    R("menu.open", "Apri il menu", "Open the menu", "Abrir el menú", "Ouvrir le menu");
    R("menu.close", "Chiudi il menu", "Close the menu", "Cerrar el menú", "Fermer le menu");
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
    R("prog.2", "Intervento", "Work", "Intervención", "Intervention");
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
    R("step2.title", "Livello di intervento", "Level of work", "Nivel de intervención", "Niveau d'intervention");
    R("step2.sub",
        "Scegli il pacchetto che fa per te. La composizione è indicativa: la confermiamo nel preventivo.",
        "Pick the package that suits you. What each one includes is indicative: we confirm it in the quote.",
        "Elige el paquete que mejor te encaje. La composición es orientativa: la confirmamos en el presupuesto.",
        "Choisissez la formule qui vous convient. Le contenu est indicatif : nous le confirmons dans le devis.");
    R("step3.title", "Quali zone?", "Which zones?", "¿Qué zonas?", "Quelles zones ?");
    R("step3.sub",
        "Tocca le zone della barca su cui vuoi intervenire.",
        "Tap the zones of the boat you want us to work on.",
        "Toca las zonas del barco en las que quieres que intervengamos.",
        "Touchez les zones du bateau sur lesquelles nous devons intervenir.");
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
    R("fld.registered", "Immatricolazione", "Registration", "Matriculación", "Immatriculation");
    R("fld.registration", "Sigla di immatricolazione", "Registration number", "Matrícula", "Numéro d'immatriculation");
    R("fld.engineHours", "Ore motore", "Engine hours", "Horas de motor", "Heures moteur");
    R("fld.berthKind", "Dove si trova la barca?", "Where is the boat?", "¿Dónde está el barco?", "Où se trouve le bateau ?");
    R("fld.location", "Porto o località", "Marina or place", "Puerto o localidad", "Port ou localité");
    R("fld.boatName", "Nome della barca", "Boat name", "Nombre del barco", "Nom du bateau");
    R("fld.colorCode", "Codice colore / gelcoat", "Colour / gelcoat code", "Código de color / gelcoat", "Code couleur / gelcoat");
    R("fld.firstName", "Nome", "First name", "Nombre", "Prénom");
    R("fld.lastName", "Cognome", "Last name", "Apellidos", "Nom");
    R("fld.region", "Regione", "Region", "Región", "Région");
    R("fld.province", "Provincia", "Province", "Provincia", "Province");
    R("fld.country", "Paese", "Country", "País", "Pays");
    R("fld.phone", "Telefono", "Phone", "Teléfono", "Téléphone");
    R("fld.phoneIntl", "Telefono con prefisso internazionale", "Phone with country code", "Teléfono con prefijo internacional", "Téléphone avec indicatif international");
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
    R("hint.loa", "In metri, ad esempio 8,5.", "In metres, for example 8,5.", "En metros, por ejemplo 8,5.", "En mètres, par exemple 8,5.");
    R("hint.registration.h",
        "Come riportata sui documenti. <span class=\"ph\">Formato da verificare.</span>",
        "As shown on the papers. <span class=\"ph\">Format to be checked.</span>",
        "Tal como figura en la documentación. <span class=\"ph\">Formato por verificar.</span>",
        "Telle qu'elle figure sur les papiers. <span class=\"ph\">Format à vérifier.</span>");
    R("hint.engineHours", "La trovi sul contaore del motore.", "You can read it on the engine hour meter.", "La encuentras en el horómetro del motor.", "Vous la trouvez sur le compteur d'heures du moteur.");
    R("hint.location",
        "Porto, rimessaggio o altro: ci aiuta a organizzare l'intervento.",
        "Marina, storage yard or elsewhere: it helps us plan the job.",
        "Puerto, varadero u otro lugar: nos ayuda a organizar la intervención.",
        "Port, hivernage ou autre : cela nous aide à organiser l'intervention.");
    R("hint.colorCode.h",
        "Spesso è nel manuale del cantiere. <span class=\"ph\">Da verificare.</span>",
        "Often in the builder's manual. <span class=\"ph\">To be checked.</span>",
        "Suele estar en el manual del astillero. <span class=\"ph\">Por verificar.</span>",
        "Souvent dans le manuel du chantier. <span class=\"ph\">À vérifier.</span>");
    R("hint.phone", "Cellulare (3…) o fisso (0…), senza prefisso.", "Mobile (3…) or landline (0…), without the prefix.", "Móvil (3…) o fijo (0…), sin prefijo.", "Mobile (3…) ou fixe (0…), sans indicatif.");
    R("hint.email", "Qui ti inviamo il codice di monitoraggio.", "This is where we send your tracking code.", "Aquí te enviamos el código de seguimiento.", "C'est ici que nous vous envoyons le code de suivi.");
    R("ph.notes",
        "Danni da riparare, tempi, dove si trova la barca o altri dettagli utili",
        "Damage to repair, timing, where the boat is, or any other useful detail",
        "Daños que reparar, plazos, dónde está el barco u otros detalles útiles",
        "Dégâts à réparer, délais, lieu où se trouve le bateau ou autres détails utiles");
    R("opt.choose", "Scegli…", "Choose…", "Elige…", "Choisir…");
    R("opt.chooseRegion", "Scegli prima la regione", "Choose the region first", "Elige primero la región", "Choisissez d'abord la région");
    R("opt.estero", "Estero / Fuori Italia", "Abroad / Outside Italy", "Extranjero / Fuera de Italia", "Étranger / Hors d'Italie");
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
    R("type.sub.flybridge",
        "Motoryacht, navetta, trawler",
        "Motor yacht, navetta, trawler",
        "Yate a motor, navetta, trawler",
        "Yacht à moteur, navetta, trawler");
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
        "Tipo e lunghezza compilati dal catalogo, verifica i dati.",
        "Type and length filled in from the catalogue, please check them.",
        "Tipo y eslora rellenados desde el catálogo, revisa los datos.",
        "Type et longueur renseignés depuis le catalogue, vérifiez les données.");
    R("model.source", "dati da {host}", "data from {host}", "datos de {host}", "données de {host}");
    R("note.natante10.h",
        "<span class=\"ph\">Oltre i 10 m le unità da diporto vanno immatricolate: controlla i dati.</span>",
        "<span class=\"ph\">Pleasure craft over 10 m have to be registered: please check the details.</span>",
        "<span class=\"ph\">Las embarcaciones de recreo de más de 10 m deben matricularse: revisa los datos.</span>",
        "<span class=\"ph\">Au-delà de 10 m, les unités de plaisance doivent être immatriculées : vérifiez les données.</span>");
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
        "Inserisci la lunghezza in metri, tra {min} e {max} (es. 8,5).",
        "Enter the length in metres, between {min} and {max} (e.g. 8,5).",
        "Introduce la eslora en metros, entre {min} y {max} (p. ej. 8,5).",
        "Saisissez la longueur en mètres, entre {min} et {max} (par ex. 8,5).");
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
    R("err.region", "Scegli la regione.", "Choose your region.", "Elige la región.", "Choisissez la région.");
    R("err.province", "Scegli la provincia.", "Choose your province.", "Elige la provincia.", "Choisissez la province.");
    R("err.provinceText", "Indica la provincia.", "Enter your province.", "Indica la provincia.", "Indiquez la province.");
    R("err.country", "Indica il Paese.", "Enter your country.", "Indica el país.", "Indiquez le pays.");
    R("err.phone",
        "Inserisci un numero italiano valido dopo +39: cellulare (3…) o fisso (0…).",
        "Enter a valid Italian number after +39: mobile (3…) or landline (0…).",
        "Introduce un número italiano válido después de +39: móvil (3…) o fijo (0…).",
        "Saisissez un numéro italien valide après +39 : mobile (3…) ou fixe (0…).");
    R("err.phoneIntl",
        "Inserisci il numero con il prefisso internazionale, ad esempio +33 6 12 34 56 78.",
        "Enter the number with the international prefix, for example +33 6 12 34 56 78.",
        "Introduce el número con prefijo internacional, por ejemplo +33 6 12 34 56 78.",
        "Saisissez le numéro avec l'indicatif international, par exemple +33 6 12 34 56 78.");
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
    R("tier.base.i1", "Lavaggio completo e lucidatura", "Full wash and polish", "Lavado completo y pulido", "Lavage complet et polissage");
    R("tier.base.i2", "Applicazione di antivegetativa", "Antifouling application", "Aplicación de antiincrustante", "Application d'antifouling");
    R("tier.completo.i1", "Tutto il Pacchetto Base", "Everything in the Base package", "Todo el Paquete Base", "Tout le contenu de la formule Base");
    R("tier.completo.i2", "Riverniciatura e riparazioni del gelcoat", "Repainting and gelcoat repairs", "Repintado y reparaciones del gelcoat", "Remise en peinture et réparations du gelcoat");
    R("tier.premium.i1", "Tutto il Pacchetto Completo", "Everything in the Complete package", "Todo el Paquete Completo", "Tout le contenu de la formule Complète");
    R("tier.premium.i2", "Riparazione di crepe o danni strutturali", "Repair of cracks or structural damage", "Reparación de grietas o daños estructurales", "Réparation des fissures ou des dégâts structurels");
    R("tier.premium.i3", "Trattamento osmosi", "Osmosis treatment", "Tratamiento de ósmosis", "Traitement de l'osmose");
    R("tier.from", "da {price} al metro", "from {price} per metre", "desde {price} el metro", "à partir de {price} le mètre");
    R("tier.choose", "Scegli questo pacchetto", "Choose this package", "Elegir este paquete", "Choisir cette formule");
    R("tier.badge.h",
        "<span class=\"ph\">Più scelto</span>",
        "<span class=\"ph\">Most popular</span>",
        "<span class=\"ph\">El más elegido</span>",
        "<span class=\"ph\">Le plus choisi</span>");
    R("tier.note.h",
        "<span class=\"ph\">composizione indicativa</span>",
        "<span class=\"ph\">indicative content</span>",
        "<span class=\"ph\">composición orientativa</span>",
        "<span class=\"ph\">contenu indicatif</span>");

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
    R("viewer.water.hide", "Nascondi acqua", "Hide water", "Ocultar agua", "Masquer l'eau");
    R("viewer.water.show", "Mostra acqua", "Show water", "Mostrar agua", "Afficher l'eau");
    R("viewer.hint",
        "Tocca una zona della barca per selezionarla o toglierla. Usa i pulsanti per cambiare vista.",
        "Tap a zone of the boat to select or deselect it. Use the buttons to change the view.",
        "Toca una zona del barco para seleccionarla o quitarla. Usa los botones para cambiar de vista.",
        "Touchez une zone du bateau pour la sélectionner ou la retirer. Utilisez les boutons pour changer de vue.");

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
    R("sum.subtotal", "Subtotale", "Subtotal", "Subtotal", "Sous-total");
    R("sum.discount", "Sconto per {count} zone ({rate}%)", "Discount for {count} zones ({rate}%)", "Descuento por {count} zonas ({rate}%)", "Remise pour {count} zones ({rate}%)");
    R("sum.total", "Totale stimato", "Estimated total", "Total estimado", "Total estimé");
    R("sum.note",
        "{tier}, calcolato su {loa} m. Prezzo indicativo: il preventivo definitivo lo conferma l'officina.",
        "{tier}, calculated on {loa} m. Indicative price: the workshop confirms the final quote.",
        "{tier}, calculado sobre {loa} m. Precio orientativo: el taller confirma el presupuesto definitivo.",
        "{tier}, calculé sur {loa} m. Prix indicatif : l'atelier confirme le devis définitif.");
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

    // The nudge under the zone list (zones.js discountHint). {next} is the
    // percentage the next zone would unlock.
    R("disc.first",
        "Scegli 2 zone o più e ti scontiamo il {next}%.",
        "Pick 2 or more zones and get {next}% off.",
        "Elige 2 zonas o más y te hacemos un {next}% de descuento.",
        "Choisissez 2 zones ou plus et bénéficiez de {next}% de remise.");
    R("disc.add",
        "Aggiungi 1 zona e lo sconto sale al {next}%.",
        "Add 1 more zone and the discount rises to {next}%.",
        "Añade 1 zona más y el descuento sube al {next}%.",
        "Ajoutez 1 zone et la remise passe à {next}%.");
    R("disc.max",
        "Hai lo sconto massimo per più zone: {next}%.",
        "You have the maximum multi-zone discount: {next}%.",
        "Tienes el descuento máximo por varias zonas: {next}%.",
        "Vous avez la remise maximale pour plusieurs zones : {next}%.");
    R("disc.title", "Più zone, meno paghi", "More zones, lower price", "Más zonas, menos pagas", "Plus de zones, moins à payer");
    R("disc.zonesPlus", "{count} o più zone", "{count} or more zones", "{count} zonas o más", "{count} zones ou plus");

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
    R("ql.mid2", "con il", "with the", "con el", "avec la");
    R("ql.post", "costa da", "costs from", "cuesta desde", "coûte à partir de");
    R("ql.without", "senza lo sconto del {rate}% per più zone", "without the {rate}% multi-zone discount", "sin el descuento del {rate}% por varias zonas", "sans la remise de {rate}% pour plusieurs zones");
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
    R("success.demo", "codice dimostrativo", "demo code", "código de demostración", "code de démonstration");
    R("success.demoNote.h",
        "Questa è una bozza di design: <span class=\"ph\">nessuna richiesta è stata davvero inviata.</span>",
        "This is a design draft: <span class=\"ph\">no request has actually been sent.</span>",
        "Esto es un borrador de diseño: <span class=\"ph\">no se ha enviado ninguna solicitud de verdad.</span>",
        "Ceci est une maquette : <span class=\"ph\">aucune demande n'a réellement été envoyée.</span>");
    R("success.lookup", "Verifica la tua richiesta", "Check your request", "Consulta tu solicitud", "Suivre votre demande");

    R("lookup.title", "Verifica la tua richiesta", "Check your request", "Consulta tu solicitud", "Suivre votre demande");
    R("lookup.sub", "Inserisci il codice di 10 cifre che hai ricevuto.", "Enter the 10-digit code you received.", "Introduce el código de 10 dígitos que recibiste.", "Saisissez le code à 10 chiffres que vous avez reçu.");
    R("lookup.label", "Codice di 10 cifre", "10-digit code", "Código de 10 dígitos", "Code à 10 chiffres");
    R("lookup.submit", "Verifica", "Check", "Consultar", "Vérifier");
    R("lookup.busy", "Verifica in corso…", "Checking…", "Consultando…", "Vérification…");
    R("lookup.err", "Il codice ha 10 cifre. Controllalo e riprova.", "The code has 10 digits. Check it and try again.", "El código tiene 10 dígitos. Revísalo e inténtalo de nuevo.", "Le code comporte 10 chiffres. Vérifiez-le et réessayez.");
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
    // Demo statuses (flow-spec §7 #9); the real vocabulary is a placeholder.
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
    R("contact.whatsapp", "WhatsApp", "WhatsApp", "WhatsApp", "WhatsApp");
    R("contact.hoursTbc.h",
        "<span class=\"ph\">Orari: da confermare</span>",
        "<span class=\"ph\">Opening hours: to be confirmed</span>",
        "<span class=\"ph\">Horario: por confirmar</span>",
        "<span class=\"ph\">Horaires : à confirmer</span>");
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
