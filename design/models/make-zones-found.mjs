// node make-zones-found.mjs : (re)builds zones-found.json from the output GLBs + models-meta.json (hand-kept notes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, bboxOf } from './glb-util.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(fs.readFileSync(path.join(here, 'models-meta.json'), 'utf8'));
const ZONE_IDS = new Set(['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'console', 'cabin', 'hardtop',
  'flybridge', 'tube_port', 'tube_starboard', 'outboard', 'sterndrive', 'inboard', 'propeller', 'rudder', 'keel']);
const res = {};
for (const type of Object.keys(meta)) {
  const file = path.join(here, '..', 'sketches', 'models', type + '.glb');
  if (!fs.existsSync(file)) continue;
  const { json, bytes } = readGlb(file);
  const order = meta[type].order;
  const names = new Set(json.nodes.map(n => n.name));
  const box = bboxOf(json);
  res[type] = {
    source: meta[type].source,
    parts: order.filter(z => names.has(z)),
    extra_zone_like_nodes: [...names].filter(n => ZONE_IDS.has(n) && !order.includes(n)),
    loa_m: +box.size[0].toFixed(2),
    waterline_note: meta[type].waterline_note,
    propulsion: meta[type].propulsion,
    tris: Math.round(box.tris),
    bytes,
    missing: order.filter(z => !names.has(z)),
  };
}
fs.writeFileSync(path.join(here, 'zones-found.json'), JSON.stringify(res, null, 2) + '\n');
console.log('wrote zones-found.json for', Object.keys(res).join(', '));
