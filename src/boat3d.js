/* =========================================================================
   boat3d.js: 3D zone-picker for the boat-repair quote of Carrozzeria
   Cipressina

   The sibling of autocolor's carVisual.js. Every boat is a real model: one
   meshopt-compressed GLB per boat type (models/<type>.glb), loaded with
   GLTFLoader. Five boats: gommone (RIB), open, cabinato, yacht and vela.

   It keeps carVisual's design principles:

     - It owns NO selection state of its own. Every click asks the host page
       (via `onPartToggle`) to mutate its set, and queries the host (via
       `isPartSelected`) to decide how to draw the selected/hover overlays.
     - It exposes a small controller API (resize / refreshSelection /
       resetView / setView / setColors / setWaterVisible / destroy /
       loadFailed) instead of wiring its own sidebar.
     - It draws on demand (see requestRender), not in a permanent loop,
       except on the turntable of a hero viewer (`spin`).
     - Camera distance and clipping planes come from the loaded model's own
       bounding box, never from constants, so a 6 m RIB and an 18 m yacht
       are framed by the same code.
     - The GLB download is watched: a 15 s stall timer re-armed on every
       progress event, and one retry on a fresh URL (`?reintento=2`).

   THE MODEL CONTRACT (what the GLB files must look like)

     - Metres, +X is the bow, +Y is up, +Z is starboard (destra). The boat is
       centred on X/Z, the waterline is at y = 0.
     - Every selectable zone is a node named exactly with the zone id (a Mesh,
       or an Object3D whose descendant meshes form the zone). Any other node
       is decoration (named deco_*): it blocks raycasts but is never
       selectable.
     - Materials are recoloured by name: `antifouling` (the bottom), `boot`
       (the waterline stripe), `tube` (RIB tubes), `gelcoat` (white topsides,
       deck, cabin...). setColors() paints `gelcoat` only on the zones that
       ask for it (topside_* for `topsides`, deck for `deck`), on a private
       clone made at load, so the cabin does not turn red with the hull.
     - A zone id listed in BOAT_MODELS[type].parts but missing from the GLB is
       skipped with a console.warn.

   Import this lazily (`import('./boat3d.js')`) and only where a viewer is
   shown. Exactly one viewer per canvas; destroy() releases the GPU.
   ========================================================================= */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/* -------------------------------------------------------------------------
   Public model table

   `parts` are the zone ids a customer can select: the node names in the GLB
   and the ids the host stores. `defaultLabelsIt` is only a fallback for hosts
   without their own labels. `dims` are the nominal length overall and beam in
   metres. `hiddenNodes` are node names switched off at load (stray helpers).
   `frameMaxY` (optional) leaves everything above that height out of the
   camera framing: a tall mast would shrink the hull to a toy.
------------------------------------------------------------------------- */
export const BOAT_TYPES = ['gommone', 'open', 'cabinato', 'yacht', 'vela'];

const LABELS_IT = {
  bottom: 'Opera viva (carena)',
  boot: 'Linea di galleggiamento',
  topside_port: 'Fiancata sinistra',
  topside_starboard: 'Fiancata destra',
  transom: 'Specchio di poppa',
  deck: 'Coperta',
  console: 'Consolle',
  cabin: 'Cabina',
  hardtop: 'Hard top',
  sterndrive: 'Piede poppiero',
  flybridge: 'Flybridge',
  propeller: 'Eliche e linee d’asse',
  rudder: 'Timone',
  keel: 'Deriva e bulbo',
  outboard: 'Motore fuoribordo',
  tube_port: 'Tubolare sinistro',
  tube_starboard: 'Tubolare destro',
};

function modelEntry(type, parts, dims, labelOverrides = {}, extra = {}) {
  const defaultLabelsIt = {};
  for (const id of parts) defaultLabelsIt[id] = labelOverrides[id] || LABELS_IT[id];
  return {
    // Resolved against this module, so it works wherever the site is served.
    url: new URL(`../models/${type}.glb`, import.meta.url).href,
    parts,
    defaultLabelsIt,
    dims,
    hiddenNodes: [],
    ...extra,
  };
}

export const BOAT_MODELS = {
  gommone: modelEntry('gommone',
    ['bottom', 'topside_port', 'topside_starboard', 'tube_port', 'tube_starboard',
      'console', 'deck', 'transom', 'outboard'],
    { loa: 6.5, beam: 2.55 },
    { bottom: 'Carena in vetroresina', topside_port: 'Fiancata sinistra (vetroresina)', topside_starboard: 'Fiancata destra (vetroresina)' }),
  open: modelEntry('open',
    ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'console', 'outboard'],
    { loa: 8.0, beam: 2.7 }),
  cabinato: modelEntry('cabinato',
    ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'hardtop', 'outboard'],
    { loa: 11.0, beam: 3.6 }),
  // A flybridge motor yacht. The source model has no props, shafts or rudder.
  yacht: modelEntry('yacht',
    ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'flybridge'],
    { loa: 18.0, beam: 4.75 },
    { cabin: 'Sovrastruttura' }),
  vela: modelEntry('vela',
    ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'keel', 'rudder'],
    { loa: 12.0, beam: 3.8 },
    { cabin: 'Tuga' },
    // The mast reaches ~17 m; frame the hull and cabin, not the rig.
    { frameMaxY: 4.5 }),
};

// Which setColors() key repaints which material, by material name.
const MATERIAL_PAINT = { antifouling: 'bottom', boot: 'boot', tube: 'topsides', deck: 'deck' };
// `gelcoat` is shared by many zones, so it follows the ZONE it sits on.
const GELCOAT_ZONE_PAINT = {
  topside_port: 'topsides', topside_starboard: 'topsides',
  tube_port: 'topsides', tube_starboard: 'topsides',
  deck: 'deck',
};
const PAINT_KEYS = ['topsides', 'bottom', 'deck', 'boot'];

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const SIDE_AXIS = new THREE.Vector3(0, 0, 1);    // starboard

const FOV_DEG = 40;
const CAMERA_PADDING = 1.14;
const HOVER_OPACITY = 0.38;
const SELECTED_OPACITY = 0.58;
const HOVER_THROTTLE_MS = 50;
const DRAG_PX = 6;            // a pointer that moves further than this is a swipe, not a tap
const SWIPE_PX = 40;          // a horizontal swipe this long steps to the next side view
const MS_PER_QUARTER_TURN = 620;
const MIN_FLIGHT_MS = 420;
const MAX_FLIGHT_MS = 1150;
const SPIN_MS_PER_TURN = 26000;
const SPIN_TILT_DEG = 14;
const MODEL_ATTEMPTS = 2;
const MODEL_STALL_MS = 15000;
const FRAME_SAMPLES = 6000;   // vertices sampled from the model to fit the camera

// select / hover / water colours come from the page theme. The hull colours
// (topsides, bottom, deck, boot) are applied only when the page gives them:
// otherwise the model keeps the colours it was authored with.
const DEFAULT_THEME = {
  select: '#1aa64a',
  hover: '#2f6bff',
  water: '#2a6f97',
};

const TAU = Math.PI * 2;
const { clamp, lerp, smoothstep } = THREE.MathUtils;

/* =========================================================================
   MODEL HELPERS
========================================================================= */

// 'Gelcoat', 'gelcoat.001' and 'gelcoat_2' are all `gelcoat`.
function baseMaterialName(mat) {
  return String((mat && mat.name) || '').toLowerCase().replace(/[._-]\d+$/, '');
}

function materialsOf(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function isGlassMaterial(mat) {
  return !!mat && ((mat.transparent && mat.opacity < 1) || /glass|vetro|window/i.test(mat.name || ''));
}

function isVisibleInTree(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

// Every mesh below (and including) a node, in the order the loader made them.
function meshesUnder(node) {
  const out = [];
  node.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

function disposeMaterial(mat) {
  if (!mat) return;
  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (value && value.isTexture) value.dispose();
  }
  mat.dispose();
}

function disposeTree(rootObj) {
  rootObj.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();   // overlays share geometry: a second dispose is a no-op
    if (obj.material) materialsOf(obj).forEach(disposeMaterial);
  });
}

function formatBytes(n) {
  if (n > 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n > 1e3) return (n / 1e3).toFixed(0) + ' KB';
  return n + ' B';
}

/* =========================================================================
   VIEWER
========================================================================= */

// The only views: the six axes, from the boat's centre towards the camera,
// in boat axes (x bow, y up, z starboard). No oblique angle and no free
// orbit: the camera always looks straight along one axis.
const VIEW_DIRS = {
  prua: new THREE.Vector3(1, 0, 0),
  poppa: new THREE.Vector3(-1, 0, 0),
  sinistra: new THREE.Vector3(0, 0, -1),
  destra: new THREE.Vector3(0, 0, 1),
  alto: new THREE.Vector3(0, 1, 0),
  sotto: new THREE.Vector3(0, -1, 0),
};
// Each view's screen-up. From above and below the beam is up, so the hull
// lies along the wide canvas, bow to the right in both.
const VIEW_UPS = {
  prua: new THREE.Vector3(0, 1, 0),
  poppa: new THREE.Vector3(0, 1, 0),
  sinistra: new THREE.Vector3(0, 1, 0),
  destra: new THREE.Vector3(0, 1, 0),
  alto: new THREE.Vector3(0, 0, -1),
  sotto: new THREE.Vector3(0, 0, 1),
};
// Where a viewer opens: the starboard profile, bow to the right.
const DEFAULT_VIEW = 'destra';
// A horizontal swipe steps round the boat in this order (a swipe to the left
// turns the boat to the left, as the old drag-orbit did).
const RING = ['prua', 'destra', 'poppa', 'sinistra'];
// The hero turntable is not a view: it starts on a 3/4 bow-port angle.
const SPIN_START_DIR = new THREE.Vector3(0.78, 0, -0.62).normalize();

// Soft radial disc with per-vertex alpha: the water melts into the page
// instead of ending at a hard edge. `ellipse` squashes it for the shadow.
function makeFadeDisc(radius, centerAlpha, segments = 64, rings = 10) {
  const pos = [], col = [], idx = [], nor = [];
  pos.push(0, 0, 0); col.push(1, 1, 1, centerAlpha);
  for (let r = 1; r <= rings; r++) {
    const f = r / rings, alpha = centerAlpha * (1 - smoothstep(f, 0.25, 1));
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * TAU;
      pos.push(Math.cos(a) * radius * f, 0, Math.sin(a) * radius * f);
      col.push(1, 1, 1, alpha);
    }
  }
  for (let s = 0; s < segments; s++) idx.push(0, 1 + ((s + 1) % segments), 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segments, a1 = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      idx.push(a0 + s, a0 + s2, a1 + s2, a0 + s, a1 + s2, a1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  for (let i = 0; i < pos.length / 3; i++) nor.push(0, 1, 0);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function mountBoat3D(options) {
  const {
    boatType,
    canvasEl,
    canvasWrapEl,
    overlayEl,
    errorEl,
    loadingLabelEl,    // optional: the «loading…» text inside the overlay, gets the progress
    progressBarEl,     // optional: a bar whose width follows the download
    buttonsEl,         // container holding buttons with [data-view]
    isPartSelected,    // fn(id) => bool, reads the host's shared state
    onPartToggle,      // fn(id) => void, mutates the host's shared state
    onHover,           // optional fn(id|null): for a host tooltip
    onLoadError,       // optional fn(): WebGL or the model failed to load
    // A viewer for looking at a boat, not for editing a selection: the home
    // page hero. `interactive: false` binds no pointer handler at all;
    // `spin: true` turns the boat on a turntable (see startSpin).
    interactive = true,
    spin = false,
    // Camera pitch of the turntable in degrees: positive looks down from above
    // (default 14), negative looks up from below the waterline, which is what
    // shows the bottom (opera viva) next to the topsides, like a boat on a
    // cradle seen from the ground. Meant for `showWater: false`.
    spinPitch = SPIN_TILT_DEG,
    showWater = true,
    theme: themeIn = {},
    loadErrorText = 'Impossibile aprire il visore 3D. Scegli le zone dall’elenco qui sotto.',
    modelUrl,          // optional: override the GLB URL (tests, a CDN copy)
  } = options;

  const theme = { ...DEFAULT_THEME, ...themeIn };
  const model = BOAT_MODELS[boatType];
  if (!model) throw new Error('[boat3d] Unknown boat type: ' + boatType);
  const baseUrl = modelUrl || model.url;

  let destroyed = false;
  let failed = false;

  const loadingBaseText = loadingLabelEl ? loadingLabelEl.textContent : '';

  function showError() {
    if (overlayEl) overlayEl.classList.remove('hidden');
    if (progressBarEl && progressBarEl.parentElement) progressBarEl.parentElement.style.display = 'none';
    if (loadingLabelEl) loadingLabelEl.hidden = true;
    if (errorEl) { errorEl.hidden = false; errorEl.textContent = loadErrorText; }
  }
  function fail(err) {
    failed = true;
    console.error('[boat3d]', err);
    showError();
    if (typeof onLoadError === 'function') onLoadError();
  }
  const deadController = () => ({
    boatType,
    loadFailed: () => true,
    resize() {}, refreshSelection() {}, resetView() {}, setView() {}, setColors() {}, pauseSpin() {}, resumeSpin() {},
    setWaterVisible() {}, destroy() { destroyed = true; },
  });

  // The renderer is the first thing that can throw (no WebGL, blocked
  // context, GPU process crash): hand the host a dead controller instead of
  // an exception so it can fall back to its checklist.
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  } catch (err) {
    fail(err);
    return deadController();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // No scene.background: the canvas stays transparent so the boat floats on
  // the page background (and the water fades into it).
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.05, 500);
  camera.position.set(8, 4, -8);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8672, 0.6));
  // The key light sits on the port bow (the side the default view shows) and
  // the second one on the opposite quarter, so neither flank is left flat.
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(5, 8, -6);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.3);
  rimLight.position.set(-6, 5, 7);
  scene.add(rimLight);

  // The room environment is only there to give the clearcoat and the glass
  // something to reflect: kept subtle so it never overpowers the lights above.
  let pmrem = null, envTex = null, roomEnv = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    roomEnv = new RoomEnvironment();
    envTex = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.9;
  } catch (err) {
    console.warn('[boat3d] environment map unavailable, continuing without reflections:', err);
  }

  // Frames are drawn on demand, not in a permanent loop (see carVisual).
  let renderQueued = null;
  function requestRender() {
    if (renderQueued !== null || destroyed) return;
    renderQueued = requestAnimationFrame(() => {
      renderQueued = null;
      if (!destroyed) renderer.render(scene, camera);
    });
  }

  function resizeRenderer() {
    const w = canvasWrapEl.clientWidth, h = canvasWrapEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }
  resizeRenderer();

  /* -----------------------------------------------------------------------
     State that exists only once the model has arrived
  ----------------------------------------------------------------------- */
  let modelAccepted = false;     // a GLB has been taken (even if building the scene then failed)
  let modelReady = false;        // the scene is built and the camera placed
  let modelRoot = null;
  const center = new THREE.Vector3();
  let fitPts = new Float32Array(0);
  // With `frameMaxY` (the sailing boat's mast) the near plane follows the
  // framed box, so the part left out of the framing is cut away instead of
  // filling the screen: from above the mast would end inches from the lens.
  let clipBox = null;
  let baseNear = 0.05;
  const cornerTmp = new THREE.Vector3();
  let waterGroup = null, shadow = null;
  let waterRadius = 0;

  const spinTilt = spinPitch != null && Number.isFinite(+spinPitch) ? clamp(+spinPitch, -30, 60) : SPIN_TILT_DEG;
  const spinTiltRad = THREE.MathUtils.degToRad(spinTilt);
  const spinPitchGiven = spinTilt !== SPIN_TILT_DEG;
  let waterWanted = !!showWater;
  let currentView = null;
  let pendingView = null;        // a setView() that arrived before the model did
  function applyWater() {
    if (!waterGroup) return;
    // The bottom view looks up through where the water would be.
    waterGroup.visible = waterWanted && currentView !== 'sotto';
    // The contact shadow lies on the water, or on an imaginary ground when the
    // water is off in a turntable seen from above. From below it would be a
    // dark disc floating over the boat, so it is hidden when the pitch is < 0.
    const groundShadow = spin && spinTilt >= 0;
    shadow.visible = (waterWanted || groundShadow) && currentView !== 'sotto' && !(spin && spinTilt < 0);
  }

  /* -----------------------------------------------------------------------
     Framing from the loaded model
  ----------------------------------------------------------------------- */
  // The bounding box of the model sets the clipping planes and the water. The
  // framing itself is fitted to a sample of the model's actual vertices
  // (always inside that box) rather than to the box's corners: at an oblique
  // angle the corners of an empty box stick far out beyond a slim hull, and
  // the boat would end up half the size it could be.

  // Up vector for a camera looking along `forward`, for the framing and the
  // turntable: world-up for horizontal views, the beam axis (as VIEW_UPS)
  // once the view is steep enough that world-up stops meaning anything.
  // Views and flights between them set their up explicitly (placeCamera).
  function upHintFor(forward) {
    const projUp = UP_AXIS.clone().addScaledVector(forward, -forward.dot(UP_AXIS));
    const projSide = SIDE_AXIS.clone().addScaledVector(forward, -forward.dot(SIDE_AXIS));
    if (forward.y < 0) projSide.negate();
    if (projUp.lengthSq() < 1e-10) return projSide.normalize();
    if (projSide.lengthSq() < 1e-10) return projUp.normalize();
    const blend = smoothstep(Math.abs(forward.dot(UP_AXIS)), 0.6, 0.97);
    return projUp.normalize().lerp(projSide.normalize(), blend).normalize();
  }

  // Distance at which the whole boat fits with padding when seen along `dir`
  // (the direction from the centre towards the camera). Exact for any oblique
  // view: every sampled vertex is projected into the camera's frame, and the
  // distance is the one that puts the worst vertex on the padded frustum edge.
  const fwdTmp = new THREE.Vector3(), upTmp = new THREE.Vector3(), rightTmp = new THREE.Vector3();
  function fitDistance(dir) {
    fwdTmp.copy(dir).negate();
    upTmp.copy(upHintFor(fwdTmp));
    rightTmp.crossVectors(fwdTmp, upTmp).normalize();
    upTmp.crossVectors(rightTmp, fwdTmp).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV_DEG) / 2) / CAMERA_PADDING;
    const tanH = tanV * camera.aspect;
    const fx = fwdTmp.x, fy = fwdTmp.y, fz = fwdTmp.z;
    const ux = upTmp.x, uy = upTmp.y, uz = upTmp.z;
    const rx = rightTmp.x, ry = rightTmp.y, rz = rightTmp.z;
    let d = 0;
    for (let i = 0; i < fitPts.length; i += 3) {
      const x = fitPts[i], y = fitPts[i + 1], z = fitPts[i + 2];
      const depth = x * fx + y * fy + z * fz;
      d = Math.max(d, Math.abs(x * rx + y * ry + z * rz) / tanH - depth, Math.abs(x * ux + y * uy + z * uz) / tanV - depth);
    }
    return d;
  }

  let presets = {};
  let spinRadius = 0;
  let spinHome = null;   // the turntable's resting camera position
  function computePresets() {
    presets = {};
    for (const name of Object.keys(VIEW_DIRS)) {
      presets[name] = center.clone().addScaledVector(VIEW_DIRS[name], fitDistance(VIEW_DIRS[name]));
    }
    const homeDir = new THREE.Vector3(Math.cos(spinTiltRad) * SPIN_START_DIR.x, Math.sin(spinTiltRad), Math.cos(spinTiltRad) * SPIN_START_DIR.z);
    spinHome = center.clone().addScaledVector(homeDir, fitDistance(homeDir));
    // The turntable keeps one distance all the way round: the widest one it
    // passes through, so the boat never breathes in and out as it turns.
    const tilt = spinTiltRad;
    spinRadius = 0;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      const dir = new THREE.Vector3(Math.cos(tilt) * Math.cos(a), Math.sin(tilt), Math.cos(tilt) * Math.sin(a));
      spinRadius = Math.max(spinRadius, fitDistance(dir));
    }
  }

  const forwardTmp = new THREE.Vector3();
  // `up` (optional) is the screen-up to use; without it upHintFor decides.
  function placeCamera(position, up) {
    forwardTmp.copy(center).sub(position).normalize();
    camera.up.copy(up || upHintFor(forwardTmp));
    camera.position.copy(position);
    camera.lookAt(center);
    // Only looking down does the mast come near the lens; in the side views
    // the near plane must stay put or it would cut the water in front.
    if (clipBox && forwardTmp.y < -0.5) {
      let minDepth = Infinity;
      for (let k = 0; k < 8; k++) {
        cornerTmp.set(k & 1 ? clipBox.max.x : clipBox.min.x, k & 2 ? clipBox.max.y : clipBox.min.y, k & 4 ? clipBox.max.z : clipBox.min.z);
        minDepth = Math.min(minDepth, cornerTmp.sub(position).dot(forwardTmp));
      }
      camera.near = Math.max(baseNear, minDepth * 0.97);
      camera.updateProjectionMatrix();
    } else if (camera.near !== baseNear) {
      camera.near = baseNear;
      camera.updateProjectionMatrix();
    }
    requestRender();
  }

  /* -----------------------------------------------------------------------
     Camera flights (same arcs as carVisual)
  ----------------------------------------------------------------------- */
  let flying = false;
  let flightId = 0;

  const viewButtons = buttonsEl ? Array.prototype.slice.call(buttonsEl.querySelectorAll('[data-view]')) : [];
  function syncViewButtons() {
    viewButtons.forEach((btn) => {
      const active = btn.dataset.view === currentView;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function slerpDirection(from, to, t, out) {
    const theta = Math.acos(clamp(from.dot(to), -1, 1));
    const sinTheta = Math.sin(theta);
    if (sinTheta < 1e-6) return out.copy(to);
    return out.copy(from)
      .multiplyScalar(Math.sin((1 - t) * theta) / sinTheta)
      .addScaledVector(to, Math.sin(t * theta) / sinTheta);
  }

  const flightDir = new THREE.Vector3();
  const flightPos = new THREE.Vector3();

  function flyToView(view, immediate = false) {
    if (destroyed || !VIEW_DIRS[view]) return;
    if (!modelReady) {
      // Nothing to frame yet: remember the wish, the load applies it.
      pendingView = view;
      currentView = view;
      syncViewButtons();
      return;
    }
    if (!presets[view]) return;
    const target = presets[view];

    // Claiming the view (and the button state) up front lets a flight be
    // redirected in mid-air, exactly as in carVisual.
    const id = ++flightId;
    currentView = view;
    syncViewButtons();
    applyWater();

    const fromDir = camera.position.clone().sub(center);
    const fromRadius = fromDir.length() || 1;
    fromDir.divideScalar(fromRadius);
    const toDir = target.clone().sub(center);
    const toRadius = toDir.length() || 1;
    toDir.divideScalar(toRadius);

    // Opposite views have no single arc between them: route them over the
    // top, or (top to bottom) round the port side.
    const via = Math.abs(fromDir.dot(UP_AXIS)) < 0.9 ? UP_AXIS.clone() : VIEW_DIRS.sinistra.clone();
    const waypoints = fromDir.dot(toDir) < -0.9 ? [fromDir, via, toDir] : [fromDir, toDir];
    const angles = [];
    let totalAngle = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const angle = Math.acos(clamp(waypoints[i].dot(waypoints[i + 1]), -1, 1));
      angles.push(angle);
      totalAngle += angle;
    }

    const toUp = VIEW_UPS[view];
    if (immediate || totalAngle < 1e-4 || prefersReducedMotion()) {
      placeCamera(target, toUp);
      flying = false;
      return;
    }

    // Screen-up during the flight: the starting up is carried along the arc
    // (the rotation of each leg applied to it), and whatever roll is still
    // missing to land on the view's own up is spread over the whole flight.
    // A per-frame guess from fixed axes flipped the boat in one frame on
    // arcs over the top.
    const fromUp = camera.up.clone().addScaledVector(fromDir, -camera.up.dot(fromDir));
    if (fromUp.lengthSq() < 1e-10) fromUp.copy(upHintFor(fromDir.clone().negate()));
    fromUp.normalize();
    const legAxes = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const axis = new THREE.Vector3().crossVectors(waypoints[i], waypoints[i + 1]);
      legAxes.push(axis.lengthSq() > 1e-12 ? axis.normalize() : null);
    }
    const carryUp = (leg, f, out) => {
      out.copy(fromUp);
      for (let i = 0; i <= leg; i++) {
        if (legAxes[i]) out.applyAxisAngle(legAxes[i], angles[i] * (i < leg ? 1 : f));
      }
      return out;
    };
    const endUp = carryUp(angles.length - 1, 1, new THREE.Vector3());
    const roll = Math.atan2(toDir.dot(new THREE.Vector3().crossVectors(endUp, toUp)), endUp.dot(toUp));
    const flightUp = new THREE.Vector3();

    const duration = clamp(MS_PER_QUARTER_TURN * (totalAngle / (Math.PI / 2)), MIN_FLIGHT_MS, MAX_FLIGHT_MS);
    const startTime = performance.now();
    flying = true;

    function step(now) {
      if (destroyed || id !== flightId) return;   // superseded by a newer flight
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeInOutSine(t);
      let travelled = eased * totalAngle;
      let leg = 0;
      while (leg < angles.length - 1 && travelled > angles[leg]) { travelled -= angles[leg]; leg++; }
      const f = angles[leg] > 1e-6 ? travelled / angles[leg] : 1;
      slerpDirection(waypoints[leg], waypoints[leg + 1], f, flightDir);
      flightPos.copy(center).addScaledVector(flightDir, lerp(fromRadius, toRadius, eased));
      carryUp(leg, f, flightUp).applyAxisAngle(flightDir, roll * eased);
      placeCamera(flightPos, flightUp);
      if (t < 1) requestAnimationFrame(step);
      else {
        // Land on the preset as it is NOW: a resize during the flight
        // recomputed the presets.
        placeCamera(presets[view] || target, toUp);
        flying = false;
      }
    }
    requestAnimationFrame(step);
  }

  const viewButtonBindings = viewButtons.map((btn) => {
    const handler = () => flyToView(btn.dataset.view);
    btn.addEventListener('click', handler);
    return { btn, handler };
  });

  /* -----------------------------------------------------------------------
     The turntable (`spin`): the one permanent loop in this file.
     Somebody who asked their system not to animate gets a static 3/4 view.
  ----------------------------------------------------------------------- */
  let spinFrame = null;
  let spinning = false;
  let spinElapsed = 0;          // ms of lap already travelled, kept across pauses
  let spinCancelled = false;    // the user took the camera (view button, drag): never auto-restart
  const spinDir = new THREE.Vector3();
  const spinPos = new THREE.Vector3();

  // The reduced-motion picture. Kept as a function because onResize has to
  // re-place it at the recomputed distance instead of falling back to spinHome.
  let spinStatic = false;
  function placeStaticSpin() {
    const a = Math.atan2(SPIN_START_DIR.z, SPIN_START_DIR.x);
    if (!spinStatic) { placeCamera(spinHome); return; }
    spinDir.set(Math.cos(spinTiltRad) * Math.cos(a), Math.sin(spinTiltRad), Math.cos(spinTiltRad) * Math.sin(a));
    placeCamera(spinPos.copy(center).addScaledVector(spinDir, spinRadius));
  }

  function startSpin() {
    if (destroyed || spinning || !spinRadius) return;
    // The lap starts on the 3/4 bow-port view the static boat would show.
    const startAngle = Math.atan2(SPIN_START_DIR.z, SPIN_START_DIR.x);
    const tilt = spinTiltRad;
    if (prefersReducedMotion()) {
      // Static picture: with an explicit spinPitch the host wants that angle
      // (the hero previews the bottom colour), otherwise the usual 3/4 view.
      spinStatic = spinPitchGiven;
      placeStaticSpin();
      return;
    }
    spinning = true;
    const startTime = performance.now() - spinElapsed;
    function step(now) {
      spinFrame = null;
      if (destroyed || !spinning) return;
      spinElapsed = now - startTime;
      // Off the clock, not a frame counter: same speed on a slow screen.
      const a = startAngle - (spinElapsed / SPIN_MS_PER_TURN) * TAU;
      spinDir.set(Math.cos(tilt) * Math.cos(a), Math.sin(tilt), Math.cos(tilt) * Math.sin(a));
      spinPos.copy(center).addScaledVector(spinDir, spinRadius);
      placeCamera(spinPos);
      spinFrame = requestAnimationFrame(step);
    }
    spinFrame = requestAnimationFrame(step);
  }
  function stopSpin() {
    spinCancelled = true;
    pauseLoop();
  }
  // Cancels the rAF loop but keeps the lap position, so resumeSpin() carries
  // on from where the boat was (the host pauses it while off screen).
  function pauseLoop() {
    spinning = false;
    if (spinFrame !== null) cancelAnimationFrame(spinFrame);
    spinFrame = null;
  }

  /* -----------------------------------------------------------------------
     Zones, overlays and selection
  ----------------------------------------------------------------------- */
  const hoverMat = new THREE.MeshBasicMaterial({
    color: theme.hover, transparent: true, opacity: HOVER_OPACITY, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const selectMat = new THREE.MeshBasicMaterial({
    color: theme.select, transparent: true, opacity: SELECTED_OPACITY, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });

  function makeOverlay(mesh, mat) {
    const overlayMesh = new THREE.Mesh(mesh.geometry, mat);
    overlayMesh.visible = false;
    overlayMesh.renderOrder = 999;
    overlayMesh.raycast = () => {};    // overlays must never be pickable
    mesh.add(overlayMesh);             // parenting inherits the exact transform
    return overlayMesh;
  }

  // Everything that can block a ray (zones AND decoration), filled at load
  // before any overlay exists. Only meshes tagged userData.zone are selectable.
  const pickable = [];
  // Several meshes can share a zone (both outboards, the bimini and the
  // slab...): the overlays are per mesh, the state is per zone.
  const zones = new Map();   // id -> { meshes, hover: [overlay], selected: [overlay] }
  let hoveredZone = null;

  function paintZone(id) {
    const z = zones.get(id);
    if (!z) return;
    const sel = typeof isPartSelected === 'function' && !!isPartSelected(id);
    z.selected.forEach((o) => { o.visible = sel; });
    z.hover.forEach((o) => { o.visible = !sel && id === hoveredZone; });
  }
  function paintAll() { zones.forEach((_, id) => paintZone(id)); }

  function setHovered(id) {
    if (id === hoveredZone) return;
    const prev = hoveredZone;
    hoveredZone = id;
    if (prev) paintZone(prev);
    if (id) paintZone(id);
    canvasEl.classList.toggle('hoverable', !!id);
    if (typeof onHover === 'function') onHover(id);
    requestRender();
  }

  /* -----------------------------------------------------------------------
     Colours. Which materials answer to which setColors() key is worked out
     at load (see setupModel); before that the wish is simply remembered.
  ----------------------------------------------------------------------- */
  const paintTargets = { topsides: new Set(), bottom: new Set(), deck: new Set(), boot: new Set() };
  const colorsWanted = {};
  for (const key of PAINT_KEYS) {
    if (themeIn[key] !== undefined && themeIn[key] !== null) colorsWanted[key] = themeIn[key];
  }
  if (colorsWanted.boot === undefined && colorsWanted.bottom !== undefined) colorsWanted.boot = colorsWanted.bottom;

  function applyColors(keys) {
    for (const key of keys) {
      if (colorsWanted[key] === undefined) continue;
      paintTargets[key].forEach((m) => { if (m.color) m.color.set(colorsWanted[key]); });
    }
  }

  /* -----------------------------------------------------------------------
     Turning the GLB into the scene
  ----------------------------------------------------------------------- */
  const retiredMaterials = [];    // originals replaced by a private clone: still ours to dispose

  function setupModel(root) {
    scene.add(root);
    modelRoot = root;
    for (const name of model.hiddenNodes || []) {
      const stray = root.getObjectByName(name);
      if (stray) stray.visible = false;
    }
    root.updateMatrixWorld(true);

    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry || !isVisibleInTree(o)) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      meshes.push(o);
    });

    // 1. Tag the zones. A zone node is a Mesh or a group of meshes.
    const zoneMeshes = new Map();
    for (const id of model.parts) {
      const node = root.getObjectByName(id);
      const found = node ? meshesUnder(node).filter((m) => meshes.includes(m)) : [];
      if (!found.length) {
        console.warn('[boat3d] zone missing from the model, skipped:', boatType, id);
        continue;
      }
      for (const m of found) if (!m.userData.zone) m.userData.zone = id;
      zoneMeshes.set(id, found);
    }

    // 2. Materials: collect what each setColors() key repaints. `gelcoat` is
    // cloned per zone so painting the topsides leaves the cabin alone.
    const privateGelcoat = new Map();    // `${material uuid}|${zone}` -> clone
    for (const mesh of meshes) {
      const zone = mesh.userData.zone;
      const list = materialsOf(mesh).map((mat) => {
        if (!mat) return mat;
        if (isGlassMaterial(mat) && envTex) {
          // A material given its own envMap ignores scene.environmentIntensity
          // and uses its envMapIntensity instead: dark glass must reflect far
          // less than the gelcoat or it turns into a chrome mirror.
          mat.envMap = envTex;
          mat.envMapIntensity = 0.28;
        }
        if (mat.map) mat.map.anisotropy = maxAniso;
        const name = baseMaterialName(mat);
        let key = MATERIAL_PAINT[name];
        if (name === 'gelcoat') {
          key = zone ? GELCOAT_ZONE_PAINT[zone] : undefined;
          if (!key) return mat;
          const cacheKey = mat.uuid + '|' + zone;
          let own = privateGelcoat.get(cacheKey);
          if (!own) {
            own = mat.clone();
            privateGelcoat.set(cacheKey, own);
            retiredMaterials.push(mat);
          }
          paintTargets[key].add(own);
          return own;
        }
        if (key) paintTargets[key].add(mat);
        return mat;
      });
      mesh.material = Array.isArray(mesh.material) ? list : list[0];
    }
    applyColors(PAINT_KEYS);

    // 3. Raycast targets, before any overlay is attached: decoration blocks
    // rays like everything else but has no zone. Glass is the exception, or
    // a window would make the cabin behind it unclickable.
    for (const mesh of meshes) {
      const clear = materialsOf(mesh).every((m) => isGlassMaterial(m));
      if (mesh.userData.zone || !clear) pickable.push(mesh);
    }

    // 4. Overlays, sharing the zone meshes' geometry.
    for (const [id, found] of zoneMeshes) {
      const z = { meshes: found, hover: [], selected: [] };
      for (const m of found) {
        z.hover.push(makeOverlay(m, hoverMat));
        z.selected.push(makeOverlay(m, selectMat));
      }
      zones.set(id, z);
    }
    paintAll();

    // 5. Bounding box, and a vertex sample for the camera fit.
    const box = new THREE.Box3();
    const tmpBox = new THREE.Box3();
    let totalVerts = 0;
    for (const mesh of meshes) {
      const g = mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      box.union(tmpBox.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld));
      totalVerts += g.attributes.position.count;
    }
    if (box.isEmpty()) throw new Error('[boat3d] the model has no geometry: ' + baseUrl);
    const stride = Math.max(1, Math.floor(totalVerts / FRAME_SAMPLES));
    const frameMaxY = model.frameMaxY !== undefined ? model.frameMaxY : Infinity;
    const samples = [];
    const frameBox = new THREE.Box3();
    const v = new THREE.Vector3();
    let counter = 0;
    for (const mesh of meshes) {
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (counter++ % stride) continue;
        v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        if (v.y > frameMaxY) continue;
        samples.push(v.x, v.y, v.z);
        frameBox.expandByPoint(v);
      }
    }
    if (frameBox.isEmpty()) frameBox.copy(box);
    frameBox.getCenter(center);
    fitPts = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 3) {
      fitPts[i] = samples[i] - center.x; fitPts[i + 1] = samples[i + 1] - center.y; fitPts[i + 2] = samples[i + 2] - center.z;
    }

    const size = box.getSize(new THREE.Vector3());
    const boundRadius = size.length() / 2;
    waterRadius = Math.max(size.x, size.z) * 2.6;
    baseNear = Math.max(boundRadius * 0.01, 0.05);
    camera.near = baseNear;
    clipBox = model.frameMaxY !== undefined ? frameBox.clone() : null;
    camera.far = Math.max(waterRadius * 2.2, boundRadius * 30);
    camera.updateProjectionMatrix();

    // 6. The water: a big translucent disc at y = 0 that fades out at its rim
    // (per-vertex alpha), plus a soft contact shadow under the hull. Both are
    // hidden together. depthWrite is off so the hull below the surface still
    // shows through, and FrontSide only so the underside is clear from below.
    // Lambert plus a little emissive: the host's water colour has to stay
    // recognisable. A glossy standard material turned white at the grazing
    // angles of the side views (Fresnel) and showed a glare patch of the key
    // light under the boat.
    waterGroup = new THREE.Group();
    const waterMat = new THREE.MeshLambertMaterial({
      color: theme.water, emissive: theme.water, emissiveIntensity: 0.5,
      transparent: true, opacity: 1, vertexColors: true, depthWrite: false, side: THREE.FrontSide,
    });
    const water = new THREE.Mesh(makeFadeDisc(waterRadius, 0.82), waterMat);
    water.renderOrder = -2;
    water.raycast = () => {};
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 1, vertexColors: true, depthWrite: false, side: THREE.FrontSide,
    });
    shadow = new THREE.Mesh(makeFadeDisc(1, 0.34, 48, 8), shadowMat);
    shadow.scale.set(size.x * 0.62, 1, size.z * 0.78);
    shadow.position.y = -0.01;
    shadow.renderOrder = -3;
    shadow.raycast = () => {};
    waterGroup.add(water);
    scene.add(waterGroup, shadow);
  }

  /* -----------------------------------------------------------------------
     Loading the GLB, with one fallback attempt

     The failure that actually shows up is not a 404. It is a transfer that
     never gets going, or that stops halfway. The error callback never fires
     for that one (three's FileLoader has no timeout), so a request the
     network dropped silently would leave the overlay reading «loading…» for
     as long as the customer is willing to wait. Two things watch the
     download: the error callback for the loud failures, and a watchdog for
     the quiet one, re-armed on every progress event so what trips it is bytes
     that STOP arriving, not bytes that arrive slowly. Either way the model is
     fetched a second time before the viewer gives up.

     The retry asks for a URL nobody has written off yet: FileLoader keeps an
     in-flight table keyed by URL and would hand a second request for the same
     URL the callbacks of the stalled first one. The query string makes it a
     new request; the static server routes on the path alone.

     The first model to arrive wins, whichever attempt it belonged to.
  ----------------------------------------------------------------------- */
  let attempts = 0;
  let stallTimer = null;

  function clearStallTimer() {
    if (stallTimer === null) return;
    clearTimeout(stallTimer);
    stallTimer = null;
  }

  function armStallTimer() {
    clearStallTimer();
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (destroyed || modelAccepted) return;
      console.warn(`[boat3d] the model stopped advancing after ${MODEL_STALL_MS} ms:`, boatType);
      retryOrFail(new Error('The 3D model download stalled.'));
    }, MODEL_STALL_MS);
  }

  function setProgress(loaded, total) {
    if (!loadingLabelEl && !progressBarEl) return;
    if (total) {
      const pct = Math.min(100, Math.round((loaded / total) * 100));
      if (progressBarEl) progressBarEl.style.width = pct + '%';
      if (loadingLabelEl) loadingLabelEl.textContent = loadingBaseText.replace(/[….]+$/, '') + '… ' + pct + '%';
    } else if (loadingLabelEl) {
      loadingLabelEl.textContent = loadingBaseText.replace(/[….]+$/, '') + '… ' + formatBytes(loaded);
    }
  }

  function retryOrFail(err) {
    if (destroyed || modelAccepted) return;
    clearStallTimer();
    if (attempts < MODEL_ATTEMPTS) {
      console.warn('[boat3d] retrying the model:', boatType, err && err.message);
      startLoad();
      return;
    }
    fail(err);
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  function startLoad() {
    const attempt = ++attempts;
    let url = baseUrl;
    if (attempt > 1) {
      const u = new URL(baseUrl, window.location.href);
      u.searchParams.set('reintento', String(attempt));
      url = u.href;
      if (loadingLabelEl) { loadingLabelEl.hidden = false; loadingLabelEl.textContent = loadingBaseText; }
      if (progressBarEl) progressBarEl.style.width = '0%';
    }
    armStallTimer();
    // Progress and errors only count for the newest attempt: an older one
    // that fails after the retry started must not end the retry, and its late
    // progress must not re-arm the retry's watchdog. A model from any attempt
    // still wins (onModelLoaded).
    loader.load(url, onModelLoaded,
      (xhr) => { if (attempt === attempts) onModelProgress(xhr); },
      (err) => { if (attempt === attempts && !destroyed) retryOrFail(err); });
  }

  function onModelProgress(xhr) {
    if (destroyed || modelAccepted) return;
    // Everything is here: the last chunk of a transfer that announced its
    // size disarms the watchdog, because what comes next is meshopt decoding
    // and parsing: seconds of silence, and none of it a stall.
    if (xhr.total && xhr.loaded >= xhr.total) clearStallTimer();
    else armStallTimer();
    setProgress(xhr.loaded, xhr.total);
  }

  function onModelLoaded(gltf) {
    // Late arrival of the losing attempt, or the viewer is gone: free it.
    if (destroyed || modelAccepted) { disposeTree(gltf.scene); return; }
    modelAccepted = true;
    clearStallTimer();
    try {
      setupModel(gltf.scene);
    } catch (err) {
      fail(err);
      return;
    }
    modelReady = true;
    // An older attempt can still land after the newest one gave up.
    failed = false;
    if (errorEl) errorEl.hidden = true;
    if (loadingLabelEl) { loadingLabelEl.textContent = loadingBaseText; }

    applyWater();
    computePresets();
    // A turntable rests on its own 3/4 angle; every other viewer opens on an
    // axis view.
    const first = pendingView && presets[pendingView] ? pendingView : spin ? null : DEFAULT_VIEW;
    pendingView = null;
    currentView = first;
    if (first) placeCamera(presets[first], VIEW_UPS[first]);
    else placeCamera(spinHome);
    syncViewButtons();
    applyWater();
    // The turntable can only start once the model has been measured, which
    // is what gives it a radius to ride at. A setView() before the load
    // already took the camera, though.
    if (spin && !spinCancelled) startSpin();
    requestRender();
    if (overlayEl) overlayEl.classList.add('hidden');
  }

  /* -----------------------------------------------------------------------
     Pointer interaction: hover (throttled), tap-to-toggle and a swipe.
     There is no free orbit: a horizontal swipe of SWIPE_PX steps to the next
     side view (RING), from above or below it lands on a side. A pointer that
     travels further than DRAG_PX is a swipe and its click is swallowed, so
     turning the boat never toggles a zone.
  ----------------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function zoneUnder(event) {
    if (!pickable.length) return null;
    const rect = canvasEl.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickable, false);
    // The nearest surface decides: decoration in front has no zone, so it
    // blocks the zone behind it.
    return hits.length ? hits[0].object.userData.zone || null : null;
  }

  let down = null;               // { id, x, y, dragging }
  let suppressClick = false;
  let lastHoverTime = 0;

  function swipe(dx) {
    if (!modelReady) return;
    stopSpin();
    const i = RING.indexOf(currentView);
    let next;
    if (i === -1) next = dx < 0 ? 'destra' : 'sinistra';
    else next = RING[(i + (dx < 0 ? 1 : RING.length - 1)) % RING.length];
    flyToView(next);
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    suppressClick = false;
    down = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    try { canvasEl.setPointerCapture(event.pointerId); } catch (e) { /* synthetic events cannot be captured */ }
  }

  function onPointerMove(event) {
    if (down && event.pointerId === down.id) {
      if (!down.dragging && Math.hypot(event.clientX - down.x, event.clientY - down.y) > DRAG_PX) {
        down.dragging = true;
        setHovered(null);
      }
      if (down.dragging) return;
    }
    // Hover is a mouse thing: on a touchscreen it would only flash under the
    // finger right before a tap.
    if (event.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - lastHoverTime < HOVER_THROTTLE_MS) return;
    lastHoverTime = now;
    setHovered(zoneUnder(event));
  }

  function clearHover() { setHovered(null); }

  function onPointerUp(event) {
    if (down && event.pointerId === down.id) {
      suppressClick = down.dragging;
      const dx = event.clientX - down.x, dy = event.clientY - down.y;
      if (down.dragging && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) swipe(dx);
      down = null;
      try { canvasEl.releasePointerCapture(event.pointerId); } catch (e) { /* not captured */ }
    }
    // pointerup lands BEFORE click: clearing the touch hover here is what
    // stops a just-deselected zone from being re-lit (see carVisual).
    if (event.pointerType !== 'mouse') clearHover();
  }

  function onPointerCancel() { down = null; suppressClick = false; clearHover(); }

  function onClick(event) {
    if (suppressClick) { suppressClick = false; return; }
    const id = zoneUnder(event);
    if (!id) return;
    onPartToggle(id);
    paintZone(id);
    requestRender();
  }

  if (interactive) {
    // Horizontal swipes step the view; vertical pans stay with the page on touch.
    canvasEl.style.touchAction = 'pan-y';
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerCancel);
    canvasEl.addEventListener('pointerleave', clearHover);
    canvasEl.addEventListener('click', onClick);
  }

  /* -----------------------------------------------------------------------
     Sizing
  ----------------------------------------------------------------------- */
  function onResize() {
    resizeRenderer();
    if (!modelReady) return;
    computePresets();
    if (spinning) return;
    if (spinStatic && !spinCancelled) { placeStaticSpin(); return; }
    // Framing depends on the aspect ratio: re-place the current view at the
    // recomputed distance.
    const here = currentView && presets[currentView];
    if (here && !flying) placeCamera(here, VIEW_UPS[currentView]);
    else if (!currentView && spin && !spinCancelled && !flying) placeCamera(spinHome);
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
  if (resizeObserver) resizeObserver.observe(canvasWrapEl);
  else window.addEventListener('resize', onResize);
  canvasEl.addEventListener('webglcontextrestored', requestRender);

  /* -----------------------------------------------------------------------
     Start: show the loading state and ask for the model
  ----------------------------------------------------------------------- */
  syncViewButtons();
  if (overlayEl) overlayEl.classList.remove('hidden');
  if (loadingLabelEl) loadingLabelEl.hidden = false;
  if (errorEl) errorEl.hidden = true;
  startLoad();

  /* -----------------------------------------------------------------------
     Controller returned to the host page
  ----------------------------------------------------------------------- */
  return {
    boatType,
    loadFailed() { return failed; },
    // Call after un-hiding the container: its size is 0 while hidden.
    resize() { onResize(); },
    // Call after the selection changed from outside a canvas click
    // (checklist, remove button, "clear all").
    refreshSelection() { paintAll(); requestRender(); },
    resetView() { flyToView(DEFAULT_VIEW); },
    // For the hero turntable: the host stops the loop while the viewer is
    // off screen or the tab is hidden, and restarts it afterwards. Both are
    // no-ops once destroyed, and resumeSpin only restarts a spin that was
    // requested, with reduced motion off and the camera still the turntable's.
    pauseSpin() {
      if (destroyed || !spinning) return;
      pauseLoop();
    },
    resumeSpin() {
      if (destroyed || !modelReady || !spin || spinning || spinCancelled || prefersReducedMotion()) return;
      startSpin();
    },
    // `immediate` skips the flight (handy for screenshots and tests). Before
    // the model has loaded the view is remembered and applied on arrival.
    setView(name, immediate = false) {
      if (!VIEW_DIRS[name]) return;
      stopSpin();
      flyToView(name, immediate);
    },
    // Repaints the materials live; any key may be omitted. Colours are CSS
    // strings or numbers: THREE.Color takes both. Before the model has loaded
    // the colours are remembered and applied on arrival.
    setColors(colors = {}) {
      const keys = [];
      for (const key of PAINT_KEYS) {
        if (colors[key] === undefined || colors[key] === null) continue;
        colorsWanted[key] = colors[key];
        keys.push(key);
      }
      if (modelReady) applyColors(keys);
      requestRender();
    },
    setWaterVisible(visible) {
      waterWanted = !!visible;
      applyWater();
      requestRender();
    },
    // Releases everything the viewer allocated, including the WebGL context
    // (the canvas cannot be reused afterwards).
    destroy() {
      destroyed = true;
      clearStallTimer();
      stopSpin();
      flightId++;
      if (renderQueued !== null) cancelAnimationFrame(renderQueued);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', onResize);
      canvasEl.removeEventListener('webglcontextrestored', requestRender);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      canvasEl.removeEventListener('pointermove', onPointerMove);
      canvasEl.removeEventListener('pointerup', onPointerUp);
      canvasEl.removeEventListener('pointercancel', onPointerCancel);
      canvasEl.removeEventListener('pointerleave', clearHover);
      canvasEl.removeEventListener('click', onClick);
      viewButtonBindings.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));

      disposeTree(scene);
      retiredMaterials.forEach(disposeMaterial);
      hoverMat.dispose(); selectMat.dispose();
      scene.clear();
      pickable.length = 0;
      zones.clear();
      Object.values(paintTargets).forEach((s) => s.clear());
      modelRoot = null;
      if (envTex) envTex.dispose();
      if (roomEnv && typeof roomEnv.dispose === 'function') roomEnv.dispose();
      if (pmrem) pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
