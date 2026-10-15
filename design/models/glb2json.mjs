// Converts design/sketches/models/<type>.glb into <type>.json: the same glTF with
// its binary chunk embedded as a base64 data URI. Claude artifacts don't serve
// .glb, but they serve .json, and GLTFLoader reads either.
// usage: node glb2json.mjs [type...]
import fs from 'node:fs';
import path from 'node:path';
const DIR = new URL('../sketches/models/', import.meta.url).pathname;
const types = process.argv.slice(2).length ? process.argv.slice(2) : ['gommone', 'open', 'cabinato', 'flybridge', 'vela'];
for (const t of types) {
  const buf = fs.readFileSync(path.join(DIR, t + '.glb'));
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(t + ': not a GLB');
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  if (bin) {
    const b = json.buffers.find((x) => x.uri === undefined);
    b.uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
  }
  const out = path.join(DIR, t + '.json');
  fs.writeFileSync(out, JSON.stringify(json));
  console.log(t, (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');
}
