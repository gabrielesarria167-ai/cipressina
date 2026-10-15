# The Cipressina look (from carrozzeriacipressina.it, observed 2026-10-15)

User feedback on the sketches: "laguna one looks good. But the problem is that the website doesnt feel like cipressina. If you look onto their website, its much more plain and sober. You should only adapt autocolors features, but mantain cipressinas feel."

Rule: **features from autocolor, look from Cipressina.** This file wins over brief.md's "three directions" section; brief.md still governs facts, the artifact contract, features and data.

Reference screenshots: `scratchpad/lead/site-home.png`, `scratchpad/lead/site-barche.png`. Source CSS: the child theme `flixify/style.css` (`--bs-primary #007bff`, `--bs-primary-dark #0464cb`, `--bs-secondary #004c9e`, `--bs-secondary-dark #013874`) on top of Bootstrap; font Source Sans Pro.

## What their site looks like
- **Header:**
  - white, about 100px tall, with a hairline bottom border; the logo is on the left at about 150px wide;
  - the menu is right-aligned, uppercase, Source Sans 600, about 15–16px, colour `#004c9e`;
  - the active and hover items turn `#007bff`, with a 4px `#007bff` bar along the bottom edge of the header under the item;
  - the language switcher is a text dropdown «🇮🇹 Italiano +» with a tiny flag, showing the other languages with flags;
  - a round solid `#007bff` icon button (search) sits at the far right.
- **Page-title band** (every inner page): a full-width band about 160–230px tall with a dark photo under a black overlay at about 0.75 opacity. Inside it:
  - a centred white bold title, about 36–40px, sentence case, e.g. «Manutenzione Barche»;
  - below it a white breadcrumb, «⌂ Home :: Manutenzione Barche».
- **Body:**
  - white ground, with the content in a Bootstrap container (about 1140px). Text sits in a left column about 2/3 wide; the right third is empty or a sidebar;
  - body text is **blue `#004c9e`** at 16px with a 1.6 line height;
  - subheadings are bold blue at 16–18px; the boat page uses UPPERCASE bold headings («PERCHÉ SCEGLIERE NOI?», «I NOSTRI SERVIZI», «MANUTENZIONE DEL MOTORE»);
  - plain disc bullet lists, and plain rectangular photos with no frames or effects.
- **Footer:** a solid `#004c9e` band with white text.
- **Floating WhatsApp:** a teal `#26a69a` pill (not a circle) at the bottom right, with a WA icon and «Sono a tua disposizione».
- **No dark mode.** It is a light, corporate, Bootstrap-like site: square or slightly rounded (4px) corners, no shadows except the subtle Bootstrap ones, no decorative illustration.

## How to apply it to the boat site
- **One type family:** Source Sans 3, weights 400/600/700. No serif, no condensed, no mono.
- **Colours:**
  - white ground; text `#004c9e`; links, buttons and active states `#007bff` (hover `#0464cb`);
  - light panels `#f4f7fb`; borders `#dde3ea`;
  - green `#009642` only in the logo, for the selected state in 3D/checklists, and for success ticks;
  - the footer is `#004c9e`.
- **Single light look:** set every colour explicitly, put `color-scheme: light` on `:root`, and omit the dark blocks. This is deliberate: the client's site has no dark mode.
- **Header and page band:**
  - the header copies theirs: nav labels in uppercase, the active bar, the «Italiano +» style language switcher (IT / EN / ES / FR with tiny CSS or SVG flags), and a solid `#007bff` «Preventivo» button with 4px radius instead of the search circle;
  - each view opens with the page-title band (a dark photo placeholder with a 0.75 black overlay, or a dark neutral if there is no photo, plus a centred white title and breadcrumb):
    - home: «Manutenzione Barche», with breadcrumb «Home :: Barche»;
    - wizard: «Preventivo barca»;
    - lookup: «Verifica la tua richiesta».
- **Home content, in plain sections and the same order as now:**
  - **Intro + 3D:** two columns. Left: their boat-page intro tone («LA TUA BARCA È UN BENE PREZIOSO…» is verbatim from their site, sourced in research.md), the CTA buttons, and «Perché scegliere noi?» with the three sourced bullets. Right: the 3D boat on a plain `#f4f7fb` panel. Under it, a row of small square colour chips (antivegetativa) with the chosen name and «colori indicativi».
  - No panoramic water band, no illustration, no big display headline. The 3D boat and the chips are the only "special" element on the page.
  - **Servizi:** uppercase bold heading and two bulleted lists (Scafo e coperta / Motore), like their page.
  - **Come funziona:** a plain numbered list of 4 steps (small `#007bff` number circles are fine).
  - **Interventi:** the price sentence in plain text with inline selects, a simple discount table, and three plain bordered boxes for the packages (1px border, 4px radius, no shadow, the «Più scelto» ribbon as a small `#007bff` label).
  - **Chi siamo:** the facilities as a bullet list (their own wording), the awards list, and one plain photo placeholder.
  - **FAQ:** plain `<details>` with a thin border.
  - **Contatti:** an address/phone/email list with copy buttons.
- **Wizard:** a Bootstrap-form feel.
  - Labels bold blue; inputs with a 1px `#ced4da` border, 4px radius, and a `#007bff` focus ring.
  - The progress is a simple 4-step bar (`#007bff` done/current, grey todo).
  - Primary buttons solid `#007bff`; Indietro is an outline button.
  - Step-3 viewer on a `#f4f7fb` panel, with camera buttons as small outline buttons; the summary and estimate as a plain table.
- **Keep everything functional:** every contract id and hook, the i18n keys, the `.ph` placeholders (amber dashed is fine, as it marks the draft), the draft ribbon, and the 3D config (`heroSpinPitch: -10`).
- **3D theme:** water `#cfe3f3`, select `#009642`, hover `#007bff`, topsides white, bottom `#1d3b8f`.
