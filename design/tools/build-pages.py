#!/usr/bin/env python3
"""Builds GitHub Pages copies of the sketch pages.

The sketches are written for Claude artifacts, which add the document
skeleton (<!doctype>, <html>, <head>, <body>) at publish time. Served as-is,
browsers would render them in quirks mode, so this wraps each one in the same
skeleton. The output sits next to the source, so relative paths (shared/,
boat3d.js, models/) keep working.

    python3 design/tools/build-pages.py      # run after editing a sketch
"""
import pathlib

SKETCHES = pathlib.Path(__file__).resolve().parent.parent / "sketches"
PAGES = {  # source -> GitHub Pages file
    "c-laguna.html": "index.html",
    "a-officina.html": "a-officina.page.html",
    "b-cantiere.html": "b-cantiere.page.html",
}
HEAD = ('<!doctype html>\n<html lang="it"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style>'
        '</head><body>\n')
TAIL = '\n</body></html>\n'

for src, out in PAGES.items():
    text = (SKETCHES / src).read_text(encoding="utf-8")
    if text.lstrip().lower().startswith("<!doctype"):
        page = text  # already a full document
    else:
        page = HEAD + "<!-- GENERATED from " + src + " by design/tools/build-pages.py; edit the source. -->\n" + text + TAIL
    (SKETCHES / out).write_text(page, encoding="utf-8")
    print(f"{src} -> sketches/{out}")
