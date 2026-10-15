// node verify-boats.mjs : checks that every zone id listed in zones-found.json is a node name in the output GLB
// (names must survive prune/meshopt, with no dots), and prints bbox / size / tris per model. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, bboxOf } from './glb-util.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const found = JSON.parse(fs.readFileSync(path.join(here, 'zones-found.json'), 'utf8'));
const outDir = path.join(here, '..', 'sketches', 'models');
const f3 = v => v.map(x => x.toFixed(2)).join(', ');
let bad = 0;

for (const [type, info] of Object.entries(found)) {
  const file = path.join(outDir, type + '.glb');
  if (!fs.existsSync(file)) { console.log(`FAIL ${type}: ${file} missing`); bad++; continue; }
  const { json, bytes } = readGlb(file);
  const names = new Set(json.nodes.map(n => n.name));
  const missing = info.parts.filter(p => !names.has(p));
  const dots = [...names].filter(n => /\./.test(n || ''));
  const box = bboxOf(json);
  const mats = (json.materials || []).map(m => m.name);
  console.log(`\n== ${type}  (${(bytes / 1048576).toFixed(2)} MB, ${Math.round(box.tris)} tris, source ${info.source})`);
  console.log(`   bbox  min [${f3(box.lo)}]  max [${f3(box.hi)}]`);
  console.log(`   size  X(length) ${box.size[0].toFixed(2)}  Y(height) ${box.size[1].toFixed(2)}  Z(beam) ${box.size[2].toFixed(2)}   centre X ${((box.lo[0] + box.hi[0]) / 2).toFixed(2)} Z ${((box.lo[2] + box.hi[2]) / 2).toFixed(2)}`);
  for (const p of info.parts) {
    const b = names.has(p) ? bboxOf(json, p) : null;
    console.log(`   ${names.has(p) ? 'ok  ' : 'MISS'} ${p.padEnd(18)} ${b ? `x ${b.lo[0].toFixed(2)}..${b.hi[0].toFixed(2)}  y ${b.lo[1].toFixed(2)}..${b.hi[1].toFixed(2)}  z ${b.lo[2].toFixed(2)}..${b.hi[2].toFixed(2)}  ${Math.round(b.tris)} tris` : ''}`);
  }
  // orientation sanity: +X bow (aft zones at negative X), +Z starboard, +Y up
  const cx = n => { const b = names.has(n) ? bboxOf(json, n) : null; return b ? [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2] : null; };
  const checks = [];
  const aft = ['transom', 'outboard', 'sterndrive', 'inboard', 'propeller', 'rudder'].find(n => names.has(n) && n !== 'rudder' || false);
  const tp = cx('topside_port'), ts = cx('topside_starboard'), bt = cx('bottom'), dk = cx('deck'), tr = cx('transom');
  if (tp && ts) checks.push(['port at -Z, starboard at +Z', tp[2] < 0 && ts[2] > 0]);
  if (tr) checks.push(['transom aft (x < 0)', tr[0] < 0]);
  if (bt && dk) checks.push(['bottom below deck', bt[1] < dk[1]]);
  if (bt) checks.push(['bottom at/below waterline (y <= 0.05)', bboxOf(json, 'bottom').hi[1] <= 0.05]);
  if (Math.abs((box.lo[0] + box.hi[0]) / 2) > 0.3 || Math.abs((box.lo[2] + box.hi[2]) / 2) > 0.3) checks.push(['centred on X/Z', false]);
  for (const [label, ok] of checks) { console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) bad++; }
  console.log(`   materials: ${mats.join(', ')}`);
  if (missing.length) { console.log(`FAIL ${type}: missing nodes ${missing.join(', ')}`); bad++; }
  if (dots.length) { console.log(`FAIL ${type}: node names with dots: ${dots.join(', ')}`); bad++; }
  if (bytes > 8 * 1048576) { console.log(`FAIL ${type}: over the 8 MB cap`); bad++; }
  else if (bytes > 5 * 1048576) console.log(`WARN ${type}: over the 5 MB target`);
}
console.log(bad ? `\n${bad} problem(s)` : '\nall zone nodes present');
process.exit(bad ? 1 : 0);
