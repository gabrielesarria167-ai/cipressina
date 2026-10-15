# Cipressina Barche

A boat version of the autocolor quote site for Officina Carrozzeria Cipressina (Martellago, VE). It has a landing page and a 4-step quote wizard, with zones picked on a 3D model of the boat. The site is in Italian, with English, Spanish and French translations. This is a design draft: prices and photos are placeholders.

- **Site (GitHub Pages):** `design/sketches/index.html`. The repo root redirects to it.
- **Source pages:** `design/sketches/*.html`. These are written for Claude artifacts, without a document skeleton. After editing one, run `python3 design/tools/build-pages.py` to regenerate the Pages copies (`index.html`, `*.page.html`).
- **Shared logic:** `design/sketches/shared/`, with the DOM contract in `shared/CONTRACT.md`. The 3D viewer is `design/sketches/boat3d.js`.
- **3D models:** `design/models/`.
  - Blender sources are in `blend/`.
  - The build pipeline is `build-all.sh`.
  - Licences are in `CREDITS.md` (CC BY 4.0, attribution required).
  - The web files `design/sketches/models/<type>.glb` and `.json` are generated. The page loads the `.json`, because artifacts don't serve `.glb`.
- **Research and specs:** `design/sketches/research.md`, `flow-spec.md`, `brief.md`, `cipressina-look.md`.
