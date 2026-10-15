"""Shared helpers for split_zones.py (run inside Blender, headless).
Working frame inside Blender (Z-up): +X = bow, +Y = port, -Y = starboard, +Z = up.
(Blender's glTF exporter maps this to glTF +X bow, +Y up, +Z starboard.)"""
import bpy, bmesh, math, json, os
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))

def load_config(t):
    return json.load(open(os.path.join(HERE, 'config', t + '.json')))

def import_flat(path):
    """Import a GLB and bake every mesh (incl. skinned ones, rest pose) to a plain world-space mesh object,
    triangulated. Drops all non-mesh objects. Returns list of objects (names kept)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        me.transform(ev.matrix_world)
        n = bpy.data.objects.new('NEW_' + o.name, me)
        bpy.context.scene.collection.objects.link(n)
        out.append(n)
    keep = set(out)
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o)
    for o in out:
        o.name = o.name[4:]
        tri(o)
    return out

def tri(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free()

def mat_name(o, idx=0):
    ms = o.data.materials
    return ms[idx].name if len(ms) > idx and ms[idx] else None

def bbox(objs):
    mn = np.array([1e18] * 3); mx = -mn
    for o in objs:
        co = vcos(o)
        if len(co):
            mn = np.minimum(mn, co.min(0)); mx = np.maximum(mx, co.max(0))
    return mn, mx

def vcos(o):
    n = len(o.data.vertices)
    a = np.empty(n * 3, dtype=np.float32); o.data.vertices.foreach_get('co', a)
    a = a.reshape(n, 3).astype(np.float64)
    m = np.array(o.matrix_world)
    return a @ m[:3, :3].T + m[:3, 3]

def face_data(o):
    """returns centroids (n,3), normals (n,3), areas (n,), matidx (n,) in world space (assumes triangulated)."""
    me = o.data; co = vcos(o)
    n = len(me.polygons)
    idx = np.empty(n * 3, dtype=np.int32); me.polygons.foreach_get('vertices', idx); idx = idx.reshape(n, 3)
    p = co[idx]
    cen = p.mean(1)
    cr = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    ar = np.linalg.norm(cr, axis=1) / 2
    nr = cr / np.maximum(np.linalg.norm(cr, axis=1), 1e-12)[:, None]
    mi = np.empty(n, dtype=np.int32); me.polygons.foreach_get('material_index', mi)
    return cen, nr, ar, mi

def loose_labels(o):
    """connected-component label per face (via vertices) using union-find in numpy-ish python."""
    me = o.data; n = len(me.polygons); nv = len(me.vertices)
    idx = np.empty(n * 3, dtype=np.int32); me.polygons.foreach_get('vertices', idx); idx = idx.reshape(n, 3)
    lab = np.arange(nv)
    a, b, c = idx[:, 0], idx[:, 1], idx[:, 2]
    while True:
        m = np.minimum(np.minimum(lab[a], lab[b]), lab[c])
        new = lab.copy()
        for v in (a, b, c):
            np.minimum.at(new, v, m)
        # pointer jumping
        for _ in range(5): new = new[new]
        if (new == lab).all(): break
        lab = new
    u, inv = np.unique(lab[idx[:, 0]], return_inverse=True)
    return inv, len(u)

def select_faces(o, mask):
    me = o.data
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    me.polygons.foreach_set('select', np.asarray(mask, dtype=bool))
    # vertices/edges select flags must be consistent for edit-mode separate
    for v in me.vertices: v.select = False
    for e in me.edges: e.select = False
    for p in me.polygons:
        if p.select:
            for vi in p.vertices: me.vertices[vi].select = True
    for e in me.edges:
        if me.vertices[e.vertices[0]].select and me.vertices[e.vertices[1]].select: e.select = True

def extract(o, mask, name):
    """move the faces in mask out of o into a new object called `name` (UV/materials kept). Returns the new object or None."""
    mask = np.asarray(mask, dtype=bool)
    if not mask.any():
        return None
    if mask.all():
        o.name = name; return o
    me = o.data
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects: ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.mode_set(mode='OBJECT')
    # use bmesh to be reliable
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sel = [bm.faces[i] for i in np.nonzero(mask)[0]]
    # build a second bmesh containing only selected faces (copy verts)
    bm2 = bmesh.new()
    # copy layers
    for lay in bm.loops.layers.uv.values(): bm2.loops.layers.uv.new(lay.name)
    vmap = {}
    uvl = bm.loops.layers.uv.values(); uvl2 = bm2.loops.layers.uv.values()
    for f in sel:
        vs = []
        for v in f.verts:
            if v.index not in vmap:
                vmap[v.index] = bm2.verts.new(v.co)
            vs.append(vmap[v.index])
        try:
            nf = bm2.faces.new(vs)
        except ValueError:
            continue
        nf.material_index = f.material_index; nf.smooth = f.smooth
        for l, l2 in zip(f.loops, nf.loops):
            for a, b in zip(uvl, uvl2): l2[b].uv = l[a].uv
    bmesh.ops.delete(bm, geom=sel, context='FACES')
    # remove orphan verts
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me); bm.free()
    new = bpy.data.meshes.new(name)
    bm2.to_mesh(new); bm2.free()
    for m in me.materials: new.materials.append(m)
    ob = bpy.data.objects.new(name, new)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def join(objs, name):
    objs = [o for o in objs if o is not None]
    if not objs: return None
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for ob in bpy.context.selected_objects: ob.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name; o.data.name = name
    return o

def bisect(o, co, no):
    """cut mesh o with plane (point co, normal no) so no face straddles it."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6,
                           plane_co=co, plane_no=no)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free()

def delete(o):
    if o is not None and o.name in bpy.data.objects:
        bpy.data.objects.remove(o)

def transform_all(objs, fn_matrix):
    for o in objs:
        o.data.transform(fn_matrix)

def stage1(t):
    cfg = load_config(t)
    objs = import_flat(os.path.join(HERE, 'src', cfg['group'], cfg['source'], 'model.glb'))
    for o in list(objs):
        if o.name.startswith('Icosphere') or o.name in cfg.get('delete_objects', []) or mat_name(o) in cfg.get('delete_materials', []) or len(o.data.polygons) == 0:
            delete(o); objs.remove(o)
    # rotate so bow -> +X
    ang = {'+X': 0, '+Y': -90, '-X': 180, '-Y': 90}[cfg['bow']]
    R = Matrix.Rotation(math.radians(ang), 4, 'Z')
    for o in objs: o.data.transform(R)
    mn, mx = bbox(objs)
    s = cfg['loa'] / (mx[0] - mn[0])
    c = (mn + mx) / 2
    T = Matrix.Scale(s, 4) @ Matrix.Translation((-c[0], -c[1], 0))
    for o in objs: o.data.transform(T)
    return cfg, objs

# ---------- preview rendering (Workbench) ----------
PALETTE = {
    'bottom': (0.05, 0.1, 0.8), 'boot': (0.0, 0.0, 0.3), 'topside_port': (1.0, 0.1, 0.1), 'topside_starboard': (0.1, 0.8, 0.1),
    'transom': (1.0, 0.8, 0.0), 'deck': (0.0, 0.8, 0.8), 'cabin': (0.8, 0.0, 0.8), 'hardtop': (1.0, 0.5, 0.0),
    'flybridge': (0.5, 0.2, 0.9), 'console': (0.9, 0.5, 0.7), 'tube_port': (1.0, 0.4, 0.4), 'tube_starboard': (0.4, 1.0, 0.4),
    'outboard': (0.3, 0.2, 0.1), 'sterndrive': (0.3, 0.2, 0.1), 'inboard': (0.3, 0.2, 0.1), 'propeller': (0.9, 0.9, 0.1), 'rudder': (0.9, 0.1, 0.9),
    'keel': (0.0, 0.4, 0.4),
}
def render_views(objs, out_prefix, views, res=(1400, 600), color_fn=None, engine='BLENDER_WORKBENCH', fit=None):
    sc = bpy.context.scene
    sc.render.engine = engine
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = res
    w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.85, 0.85, 0.85)
    for o in objs:
        key = o.name
        c = (PALETTE.get(key) if color_fn is None else color_fn(o)) or (0.6, 0.6, 0.6)
        o.data.materials.clear()
        m = bpy.data.materials.new(key); m.diffuse_color = (*c, 1); o.data.materials.append(m)
    mn, mx = bbox(fit or objs); c = (mn + mx) / 2; d = float(np.linalg.norm(mx - mn))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.clip_end = d * 10
    pts = np.concatenate([vcos(o)[::5] for o in (fit or objs)])
    for name, dirv in views:
        dv = Vector(dirv).normalized()
        q = (-dv).to_track_quat('-Z', 'Y'); cam.rotation_euler = q.to_euler()
        rot = np.array(q.to_matrix())
        loc = rot.T @ (pts - c).T   # camera-space coords
        xs, ys = loc[0], loc[1]
        w_, h_ = xs.max() - xs.min(), ys.max() - ys.min()
        cam.data.ortho_scale = max(w_, h_ * res[0] / res[1]) * 1.08
        off = rot @ np.array([(xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2, 0])
        cam.location = Vector(c) + dv * d * 2 + Vector(off)
        sc.render.filepath = f"{out_prefix}_{name}.png"
        bpy.ops.render.render(write_still=True)
VIEWS_STD = [('side_stbd', (0, -1, 0)), ('under', (0, 0, -1)), ('top', (0, 0, 1)), ('rear', (-1, 0, 0))]


# ---------- face pool ----------
class Pool:
    """All faces of one joined mesh with per-face numpy arrays + connected-component table."""
    def __init__(self, obj):
        self.o = obj
        self.refresh()
    def refresh(self):
        o = self.o
        self.cen, self.nr, self.ar, self.mi = face_data(o)
        names = [mat_name(o, i) for i in range(len(o.data.materials))]
        self.matname = np.array([names[i] if i < len(names) else None for i in self.mi], dtype=object)
        self.lab, self.k = loose_labels(o)
        k = self.k
        self.c_nf = np.bincount(self.lab, minlength=k)
        self.c_ar = np.bincount(self.lab, weights=self.ar, minlength=k)
        lo = np.full((k, 3), 1e18); hi = np.full((k, 3), -1e18)
        for a in range(3):
            np.minimum.at(lo[:, a], self.lab, self.cen[:, a]); np.maximum.at(hi[:, a], self.lab, self.cen[:, a])
        self.c_lo, self.c_hi = lo, hi
        # dominant material per comp (first face)
        first = np.full(k, -1); first[self.lab[::-1]] = np.arange(len(self.lab))[::-1]
        self.c_mat = self.matname[first]
    def comp_mask(self, comps):
        return np.isin(self.lab, np.asarray(list(comps), dtype=int))
    def comps_where(self, mat=None, nf=None, area=None, lo=None, hi=None, matf=None):
        """comps filtered. lo/hi: dict axis->(min,max) constraint on comp centroid-bbox min/max."""
        m = np.ones(self.k, bool)
        if mat is not None:
            ms = mat if isinstance(mat, (list, tuple, set)) else [mat]
            m &= np.array([x in ms for x in self.c_mat])
        if matf is not None:
            m &= np.array([matf(x) for x in self.c_mat])
        if nf is not None: m &= (self.c_nf >= nf[0]) & (self.c_nf <= nf[1])
        if area is not None: m &= (self.c_ar >= area[0]) & (self.c_ar <= area[1])
        for dct, arr in ((lo, self.c_lo), (hi, self.c_hi)):
            if dct:
                for ax, (a, b) in dct.items():
                    m &= (arr[:, 'xyz'.index(ax)] >= a) & (arr[:, 'xyz'.index(ax)] <= b)
        return np.nonzero(m)[0]

def split_off(o, labels, order=None):
    """labels: array of str per face ('' = stays). Extracts each label into its own object named label.
    returns dict name->object (rest stays in o and is returned under ''), consuming faces in `order`."""
    labels = np.asarray(labels, dtype=object)
    res = {}
    names = order or [n for n in dict.fromkeys(labels) if n != '']
    cur = labels
    for n in names:
        m = (cur == n)
        if not m.any(): continue
        ob = extract(o, m, 'tmp_' + n)
        res[n] = ob
        cur = cur[~m]
    res[''] = o if (len(o.data.polygons) and o not in res.values()) else None
    return res
