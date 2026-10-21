# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Boat owners in the Venice area (motorboats, cabin cruisers, RIBs, yachts, sailboats) who need hull, deck, paint, antifouling or engine work. On the homepage they are comparing yards and deciding whether to trust this one; the quote comes after trust. Secondary: the owner and staff, who use the private workshop panel (`pgs/officina.html`).

## Product Purpose
The boat side of Officina Carrozzeria Cipressina S.R.L., a car body shop in Olmo di Martellago (VE) that also works on boats. The site shows the work and the workshop, then lets the owner describe the boat, pick zones on a 3D model, read an estimate and send a request with a tracking code. Success: a qualified request from a nearby boat owner.

## Positioning
A real paint shop with its own booth, drying oven, tintometers and colorimeters, run by a long-standing local family firm with civic awards, that treats boats with body-shop paint precision. The 3D zone picker gives a price before any phone call.

## Operating Context
Visitors arrive on phone or desktop, often off-season, planning haul-out work. Small boats are worked on at the body shop; bigger ones at a local shipyard (name to be confirmed). Service area: Venice area only.

## Capabilities and Constraints
- Pages: `index.html` (home), `pgs/preventivo.html` (4-step wizard, lookup at `#stato`), `pgs/officina.html` (staff panel, Italian only).
- Static HTML/CSS/JS, no framework; served by a small Node server on Render with Neon Postgres.
- Italian main, with EN/ES/FR via `data-i18n` keys in `src/site.js` and `src/i18n.js`.
- Real rates: topsides and transom 300 €/m², deck 400 €/m², sandblasting 400 €/m², antifouling 120 €/m of length. Packages (Base/Completo/Premium) are still placeholder prices.
- The 3D boat model is the owner's top priority and lives in the wizard.

## Brand Commitments
- The original logo (blue #0E0E9E crescent and wordmark, green #009642 crescent) stays.
- 2026-10-21: the user gave free rein on the visual look and approved the «Giro della barca» sketch, now applied to the whole site. The earlier «plain and sober» rule no longer binds the public pages; the staff panel stays simple.
- WhatsApp Click to Chat (+39 339 181 0099) stays.

## Evidence on Hand
- Client photos (owner approved): `img/barche/` (11 boats in the workshop), `img/sede/` (8 of the premises, red-and-blue sheds, aerial views, sign), `img/officina/` (staff, booth, tintometer, colorimeter).
- Awards: Mercurio d'oro, Alfiere Economico, Venezia che Lavora, Lavoro e Progresso.
- Facilities: paint oven and drying booth, 3 preparation zones, 4 tintometers, 2 electronic colorimeters.
- Confirmed by the owner (2026-10-21): «Iscritta al Registro Imprese di Venezia dal 1978». That is the registration year; that the shop has been at Olmo di Martellago since then is not confirmed.
- Absent, never invent: a founding date other than that registration, number of boats served, reviews or testimonials, boat certifications, response times, warranty terms.

## Product Principles
- Show the workshop doing the work; photos of real boats beat claims.
- Every price shown is either the owner's real rate or marked as a placeholder.
- A visitor can reach the quote and WhatsApp from anywhere in one tap.
- Four languages, equal care.
