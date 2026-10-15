// Minimal GLB reader (no deps): JSON chunk, node tree, world bbox, triangle count.
import fs from 'node:fs';

export function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': not a GLB');
  const len = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  return { json, bytes: b.length };
}

const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
function mulMat(a, b) { // column-major 4x4
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function localMat(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], t = n.translation || [0, 0, 0], s = n.scale || [1, 1, 1];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1];
}
function applyMat(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

/** walk the default scene; returns [{name, path, mesh, world(4x4), parent}] for every node */
export function walk(json) {
  const out = [];
  const rec = (i, parentM, path, parentName) => {
    const n = json.nodes[i];
    const m = mulMat(parentM, localMat(n));
    const rec_ = { index: i, name: n.name, mesh: n.mesh, world: m, parent: parentName, path: path.concat(n.name) };
    out.push(rec_);
    (n.children || []).forEach(c => rec(c, m, rec_.path, n.name));
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  json.scenes[json.scene || 0].nodes.forEach(i => rec(i, I, [], null));
  return out;
}

function meshBox(json, meshIdx) {
  let lo = [1e18, 1e18, 1e18], hi = [-1e18, -1e18, -1e18], tris = 0;
  for (const p of json.meshes[meshIdx].primitives) {
    const a = json.accessors[p.attributes.POSITION];
    if (a.min && a.max) {
      const k = a.normalized ? NORM[a.componentType] : 1;
      const mn = a.min.map(v => v / k), mx = a.max.map(v => v / k);
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], mn[i]); hi[i] = Math.max(hi[i], mx[i]); }
    }
    if (p.indices != null) tris += json.accessors[p.indices].count / 3; else tris += a.count / 3;
  }
  return { lo, hi, tris };
}

/** bbox of a node subtree (or whole scene when rootName is null) in world space + triangle count */
export function bboxOf(json, rootName = null) {
  const nodes = walk(json);
  const inSub = n => rootName == null || n.path.includes(rootName);
  let lo = [1e18, 1e18, 1e18], hi = [-1e18, -1e18, -1e18], tris = 0, found = false;
  for (const n of nodes) {
    if (!inSub(n) || n.mesh == null) continue;
    const b = meshBox(json, n.mesh); tris += b.tris; found = true;
    for (let c = 0; c < 8; c++) {
      const p = applyMat(n.world, [c & 1 ? b.hi[0] : b.lo[0], c & 2 ? b.hi[1] : b.lo[1], c & 4 ? b.hi[2] : b.lo[2]]);
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    }
  }
  return found ? { lo, hi, size: hi.map((h, i) => h - lo[i]), tris } : null;
}
