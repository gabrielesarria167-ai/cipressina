"""Split a downloaded boat GLB into named zone nodes (rough), recolour, export .blend + GLB (pre-compression).
usage: Blender -b -P split_zones.py -- <type> [--out DIR]
Per-boat rules live in the build_<type>() functions below; parameters in config/<type>.json."""
import sys, os, re, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zonelib import *

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out')   # intermediates, gitignored

MATS = {
    'gelcoat': ((0.93, 0.93, 0.94), 0.35, 0.0),
    'antifouling': ((0.11, 0.23, 0.56), 0.6, 0.0),
    'boot': ((0.03, 0.07, 0.25), 0.5, 0.0),
    'tube': ((0.78, 0.79, 0.81), 0.7, 0.0),
    'engine': ((0.16, 0.17, 0.18), 0.5, 0.2),
}
ZONE_MAT = {'propeller': 'engine', 'bottom': 'antifouling', 'keel': 'antifouling', 'boot': 'boot', 'tube_port': 'tube', 'tube_starboard': 'tube',
            'outboard': 'engine', 'sterndrive': 'engine', 'inboard': 'engine', 'propeller': 'engine', 'rudder': 'antifouling',
            'console': 'gelcoat'}
GELCOAT_ZONES = {'deco_hardtop', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'hardtop', 'flybridge', 'console'}

def mk_mat(name):
    rgb, rough, metal = MATS[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL' and n.type != 'BSDF_PRINCIPLED': nt.nodes.remove(n)
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None) or nt.nodes.new('ShaderNodeBsdfPrincipled')
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
    for l in list(bsdf.inputs['Base Color'].links): nt.links.remove(l)
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if not out.inputs['Surface'].links: nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    m.diffuse_color = (*rgb, 1)
    return m

def set_single_material(o, mname):
    o.data.materials.clear()
    o.data.materials.append(mk_mat(mname))
    # drop uv layers (no textures on painted zones) and vertex colours (GLTFLoader would multiply them in)
    for uv in list(o.data.uv_layers): o.data.uv_layers.remove(uv)
    for ca in list(o.data.color_attributes): o.data.color_attributes.remove(ca)

def hull_zones(hull, wl, L, boot=0.0, transom_frac=0.10, transom_nx=0.55, topside_nout=0.15, deck_name='deck'):
    """hull: object holding the hull shell faces (world coords already normalised, +X bow, +Y port).
    Cuts at wl (and wl+-boot), labels faces. Returns dict of objects: bottom, boot?, topside_port, topside_starboard, transom, deck."""
    planes = [wl] + ([wl - boot, wl + boot] if boot else [])
    for z in planes:
        bisect(hull, (0, 0, z), (0, 0, 1))
    cen, nr, ar, mi = face_data(hull)
    co = vcos(hull)
    xmin, xmax = co[:, 0].min(), co[:, 0].max()
    lab = np.full(len(cen), '', dtype=object)
    z = cen[:, 2]
    transom = (nr[:, 0] < -transom_nx) & (cen[:, 0] < xmin + transom_frac * (xmax - xmin))
    below = z < wl - boot
    band = (np.abs(z - wl) <= boot) & (boot > 0) & (np.abs(nr[:, 2]) < 0.85)
    above = z >= wl + boot if boot else z >= wl
    out_n = nr[:, 1] * np.sign(cen[:, 1])
    lat = (np.abs(nr[:, 1]) > 0.5) & (np.abs(cen[:, 1]) > 0.1)
    if lat.any() and np.average(out_n[lat], weights=ar[lat]) < 0:   # normals flipped in this model: orient by position
        out_n = -out_n
    side = above & (nr[:, 2] < 0.5) & (out_n > topside_nout)
    lab[above] = deck_name                      # up-facing / inward faces above waterline -> deck
    lab[side & (cen[:, 1] > 0)] = 'topside_port'
    lab[side & (cen[:, 1] <= 0)] = 'topside_starboard'
    lab[band] = 'boot'
    lab[below & ~band] = 'bottom'
    lab[transom] = 'transom'
    left = (lab == '')
    lab[left & (z < wl)] = 'bottom'; lab[left & (z >= wl)] = deck_name
    return split_off(hull, lab, ['transom', 'bottom', 'boot', 'topside_port', 'topside_starboard', deck_name])

# ------------------------------------------------------------------------------------------------
def build_gommone(P, cfg):
    wl = cfg['wl']
    O = P.o
    tube = P.comps_where(mat='Zodiac_couleur_boudin.')
    tube_cap = P.comps_where(mat='Zodiac_Gris', area=(0.3, 1), lo={'x': (-3.6, -3.0)})   # tube end cones
    hullc = list(P.comps_where(mat='Zodiac_noir_mat', area=(0.9, 20))) + list(P.comps_where(mat='Zodiac_gris_fonc', area=(2.5, 3.5)))
    hullc = [c for c in hullc if P.c_lo[c, 2] < 0.55 and c not in P.comps_where(nf=(208, 208))]
    deckc = P.comps_where(mat='Zodiac_gris_fonc', nf=(10, 20), area=(4, 6))
    consolec = list(P.comps_where(nf=(208, 208))) + list(P.comps_where(lo={'x': (-0.95, 0.35)}, hi={'x': (-0.95, 0.4), 'z': (0.6, 3)}))
    lab = np.full(len(P.cen), '', dtype=object)
    cen = P.cen
    m = P.comp_mask(tube) | P.comp_mask(tube_cap)
    lab[m & (cen[:, 1] > 0)] = 'tube_port'; lab[m & (cen[:, 1] <= 0)] = 'tube_starboard'
    lab[P.comp_mask(hullc)] = 'HULL'
    lab[P.comp_mask(deckc)] = 'deck'
    # outboards: everything else behind the transom, between the tubes
    eng = (lab == '') & (cen[:, 0] < -2.75) & (np.abs(cen[:, 1]) < 0.7)
    lab[eng] = 'outboard'
    lab[(lab == '') & P.comp_mask(consolec) & (cen[:, 0] > -0.95) & (cen[:, 0] < 0.4) & (np.abs(cen[:, 1]) < 1.0) & (cen[:, 2] > 0.5)] = 'console'
    parts = split_off(O, lab)
    zones = {}
    hz = hull_zones(parts.pop('HULL'), wl, cfg['loa'])
    for k, v in hz.items():
        if k == '': continue
        if v is not None: zones.setdefault(k, []).append(v)
    for k, v in parts.items():
        if k == '' or v is None: continue
        zones.setdefault(k, []).append(v)
    return zones, ([parts['']] if parts.get('') else []), {'propulsion': 'outboard'}

def mark_below(P, lab, zmin, keep=()):
    """label comps lying entirely below zmin (ground shadows, water sheets) for deletion."""
    below = P.comps_where(hi={'z': (-1e9, zmin)})
    m = P.comp_mask(below) & (lab == '')
    lab[m] = 'DEL'

def collect(zones, parts, hz=None):
    if parts.get('DEL') is not None: delete(parts['DEL']); parts['DEL'] = None
    for k, v in (hz or {}).items():
        if k and v is not None: zones.setdefault(k, []).append(v)
    for k, v in parts.items():
        if k and k != 'HULL' and v is not None: zones.setdefault(k, []).append(v)

def build_open(P, cfg):
    wl = cfg['wl']; cen = P.cen
    lab = np.full(len(cen), '', dtype=object)
    lab[P.matname == 'Engine_047other_01.001'] = 'outboard'
    hull = P.comps_where(mat='Base.000', area=(40, 60))
    lab[P.comp_mask(hull)] = 'HULL'
    topc = P.comps_where(mat='Base.000', area=(15, 30), lo={'z': (3, 4)})
    lab[P.comp_mask(topc)] = 'deco_hardtop'
    deckc = P.comps_where(mat='Base.000', area=(15, 30), lo={'z': (0, 1.2)})
    lab[P.comp_mask(deckc)] = 'deck'
    consc = P.comps_where(mat='Base.000', area=(0.5, 15), lo={'x': (-1.6, 1.0)}, hi={'x': (-1.0, 1.8), 'z': (1.4, 3)})
    lab[(lab == '') & P.comp_mask(consc)] = 'console'
    lab[(lab == '') & (P.matname == 'Driver_047Bathroom.001')] = 'console'
    mark_below(P, lab, cfg['floor'])
    parts = split_off(P.o, lab)
    zones = {}
    collect(zones, parts, hull_zones(parts['HULL'], wl, cfg['loa'], boot=cfg.get('boot', 0.06)))
    return zones, [parts['']] if parts.get('') else [], {'propulsion': 'outboard'}

def obj_faces(P, name):
    """faces that came from a given source object: we use a per-face source tag computed at join time."""
    return P.src == name

def build_cabinato(P, cfg):
    wl = cfg['wl']; cen = P.cen
    lab = np.full(len(cen), '', dtype=object)
    S = P.src
    lab[S == 'Object_5'] = 'outboard'
    hull = P.comps_where(nf=(6000, 6500), area=(30, 40))
    lab[P.comp_mask(hull)] = 'HULL'
    top = P.comps_where(lo={'z': (1.3, 2)}, area=(1.3, 6))
    lab[(lab == '') & P.comp_mask(top)] = 'hardtop'
    cabc = [c for c in P.comps_where(area=(1.0, 20), lo={'x': (-0.9, 1.0), 'z': (-0.3, 0.4)}) if 0.5 < P.c_hi[c, 2] < 0.7]
    lab[(lab == '') & P.comp_mask(cabc) & (S == 'Object_8')] = 'cabin'
    deckc = [c for c in P.comps_where(mat='Smooth_032Textures', area=(1.9, 9), lo={'z': (-0.8, 0.0)}) if P.c_hi[c, 2] < 0.7]
    deckc = [c for c in deckc if c not in hull]
    lab[(lab == '') & P.comp_mask(deckc) & (S == 'Object_8')] = 'deck'
    mark_below(P, lab, cfg['floor'])
    parts = split_off(P.o, lab)
    zones = {}
    collect(zones, parts, hull_zones(parts['HULL'], wl, cfg['loa'], boot=cfg.get('boot', 0.06)))
    return zones, [parts['']] if parts.get('') else [], {'propulsion': 'outboard'}

def build_flybridge(P, cfg):
    wl = cfg['wl']; cen = P.cen
    lab = np.full(len(cen), '', dtype=object)
    G = 'Grand_Base'
    hull = P.comps_where(mat=G, area=(30, 45), lo={'z': (-3.5, -2.0)})
    lab[P.comp_mask(hull)] = 'HULL'
    rud = P.comps_where(mat=G, area=(0, 1.0), lo={'x': (-5.5, -5.0), 'z': (-3.5, -2.4)})
    lab[(lab == '') & P.comp_mask(rud)] = 'rudder'
    prop = P.comps_where(mat=G, area=(0, 1.0), lo={'x': (-5.0, -3.0), 'z': (-3.5, -2.6)}, hi={'x': (-5.0, -3.0)})
    lab[(lab == '') & P.comp_mask(prop) & (np.abs(cen[:, 1]) < 1.0) & (cen[:, 2] < -2.5)] = 'propeller'
    cab = P.comps_where(mat=G, area=(20, 60), lo={'z': (-1.5, 0.5)})
    lab[(lab == '') & P.comp_mask(cab)] = 'cabin'
    fly = P.comps_where(mat=G, area=(0.5, 60), lo={'z': (0.45, 3)})
    lab[(lab == '') & P.comp_mask(fly)] = 'flybridge'
    deck = list(P.comps_where(mat='Grand_Wood_02', area=(3, 20))) + list(P.comps_where(mat=G, area=(10, 11), lo={'x': (1.2, 1.6), 'z': (-1.3, -1.0)})) + list(P.comps_where(mat='Grand_Other_03', area=(4, 5)))
    lab[(lab == '') & P.comp_mask(deck)] = 'deck'
    mark_below(P, lab, cfg['floor'], )
    parts = split_off(P.o, lab)
    zones = {}
    collect(zones, parts, hull_zones(parts['HULL'], wl, cfg['loa'], boot=cfg.get('boot', 0.07)))
    return zones, [parts['']] if parts.get('') else [], {'propulsion': 'inboard'}

def build_vela(P, cfg):
    wl = cfg['wl']; cen = P.cen
    lab = np.full(len(cen), '', dtype=object)
    B = 'Base_Material_Other_01.001'
    # sails (big thin sheets above deck) and degenerate ghost sheets -> delete; mast stays as decoration
    sails = [c for c in P.comps_where(area=(7, 70), lo={'z': (2.9, 9)}) if P.c_lo[c, 0] > -4.5 and (P.c_hi[c, 2] - P.c_lo[c, 2]) > 3 and P.c_hi[c, 0] - P.c_lo[c, 0] > 2]
    sails = list(sails) + list(P.comps_where(nf=(3, 3), area=(7, 8)))
    lab[P.comp_mask(sails)] = 'DEL'
    lab[(lab == '') & (P.ar < 1e-9)] = 'DEL'
    hull = [c for c in P.comps_where(mat=B, area=(3.5, 40), lo={'z': (-0.5, 1.9)}) if P.c_hi[c, 2] < 2.45 and P.c_hi[c, 0] > 2.0]
    lab[(lab == '') & P.comp_mask(hull)] = 'HULL'
    rud = P.comps_where(mat=B, nf=(596, 596), area=(1, 3))
    lab[P.comp_mask(rud)] = 'rudder'
    cab = P.comps_where(mat=B, area=(10, 20), lo={'z': (2.0, 2.3)}, hi={'z': (2.7, 3.0)})
    lab[(lab == '') & P.comp_mask(cab)] = 'cabin'
    deck = list(P.comps_where(mat=B, area=(12, 14), lo={'z': (2.0, 2.2)}, hi={'z': (2.3, 2.5)}))
    lab[(lab == '') & P.comp_mask(deck)] = 'deck'
    mark_below(P, lab, cfg['floor'])
    parts = split_off(P.o, lab)
    zones = {}
    if parts.get('rudder') is not None: drop_faces_below(parts['rudder'], -1.3)
    hz = hull_zones(parts['HULL'], wl, cfg['loa'], boot=cfg.get('boot', 0.07))
    # fin keel = bottom faces hanging below the hull's own bottom line
    b = hz['bottom']
    bc, bn, ba, bm = face_data(b)
    kl = np.where((bc[:, 2] < cfg['keel_z']) & (np.abs(bc[:, 1]) < 0.6), 'keel', '')
    kp = split_off(b, kl, ['keel'])
    hz['bottom'] = kp[''] if kp.get('') is not None else None
    if kp.get('keel') is not None: hz['keel'] = kp['keel']
    collect(zones, parts, hz)
    return zones, [parts['']] if parts.get('') else [], {'propulsion': 'inboard'}

def face_vcolor(o):
    """mean vertex colour (rgb) per face; None if the mesh has no colour attribute."""
    me = o.data
    if not me.color_attributes: return None
    ca = me.color_attributes[0]
    if ca.domain == 'POINT':
        a = np.empty(len(me.vertices) * 4, np.float32); ca.data.foreach_get('color', a); a = a.reshape(-1, 4)
        idx = np.empty(len(me.polygons) * 3, np.int32); me.polygons.foreach_get('vertices', idx)
        return a[idx.reshape(-1, 3)].mean(1)[:, :3]
    a = np.empty(len(me.loops) * 4, np.float32); ca.data.foreach_get('color', a)
    return a.reshape(-1, 3, 4).mean(1)[:, :3]

def build_yacht(P, cfg):
    """OBJ-converted model: one untextured white material for most of the boat, colours in vertex colours.
    Hull = the black faces of the two hull meshes (split at midships in the source). Superstructure = white faces
    of the plain materials, split by height: flybridge above fly_z, deck = up-facing faces below foredeck_z,
    cabin = the rest above the sheer. No props or rudders in the model."""
    wl = cfg['wl']; cen = P.cen; nr = P.nr
    vc = face_vcolor(P.o)
    lab = np.full(len(cen), '', dtype=object)
    dark = vc.max(1) < 0.1
    white = vc.min(1) > 0.9
    hull_src = np.isin(P.src, ['Object_12', 'Object_3'])
    lab[hull_src & dark] = 'HULL'
    plain = np.isin(P.matname, ['Default_0', 'White_0', 'material_0', 'Mat_12'])   # Mat_12 = swim platform + fore hull
    sup = (lab == '') & plain & white
    z = cen[:, 2]
    sheer = 2.2   # top of the black hull (z here is still source height x scale; keel line at -0.24)
    lab[sup & (z >= cfg['fly_z'])] = 'flybridge'
    # normals of this OBJ conversion point either way, so test |n|
    lab[sup & (z > wl) & (np.abs(nr[:, 2]) > 0.8) & (z < cfg['foredeck_z'])] = 'deck'
    lab[sup & (lab == '') & (z < cfg['fly_z']) & (z > sheer)] = 'cabin'
    # the white stern wall (garage door) above the swim platform is the transom; the black hull only wraps its corners
    lab[sup & (np.abs(nr[:, 0]) > 0.6) & (cen[:, 0] < cen[:, 0].min() + 1.8) & (z > wl) & (z < sheer + 0.1)] = 'transom'
    mark_below(P, lab, cfg['floor'])
    parts = split_off(P.o, lab)
    zones = {}
    # hull faces above the waterline that hull_zones does not call topside (spray-rail tops) stay on their own side
    hz = hull_zones(parts['HULL'], wl, cfg['loa'], boot=cfg.get('boot', 0.07), deck_name='HULLTOP')
    top = hz.pop('HULLTOP', None)
    if top is not None:
        c = face_data(top)[0]
        for k, v in split_off(top, np.where(c[:, 1] > 0, 'topside_port', 'topside_starboard')).items():
            if k and v is not None: zones.setdefault(k, []).append(v)
    collect(zones, parts, hz)
    return zones, [parts['']] if parts.get('') else [], {'propulsion': 'inboard'}

BUILDERS = {'vela': build_vela, 'flybridge': build_flybridge, 'yacht': build_yacht, 'gommone': build_gommone, 'open': build_open, 'cabinato': build_cabinato}

# ------------------------------------------------------------------------------------------------
ORDER = {
    'vela': ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'keel', 'rudder'],
    'flybridge': ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'flybridge', 'propeller', 'rudder'],
    'yacht': ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'flybridge'],
    'cabinato': ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'cabin', 'hardtop', 'outboard'],
    'open': ['bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'deck', 'console', 'outboard'],
    'gommone': ['bottom', 'topside_port', 'topside_starboard', 'tube_port', 'tube_starboard', 'console', 'deck', 'transom', 'outboard'],
}

def slug(s):
    s = re.sub(r'[^A-Za-z0-9]+', '_', s or 'misc').strip('_').lower()
    return s[:30] or 'misc'

def strip_textures(cfg):
    """materials whose atlas textures carry logos/labels/gauges -> plain colour."""
    for name, rgb in cfg.get('strip_materials', {}).items():
        m = bpy.data.materials.get(name)
        if m is None or not m.use_nodes: continue
        nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        for inp in b.inputs:
            for l in list(inp.links): nt.links.remove(l)
        for n in [n for n in nt.nodes if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'SEPARATE_COLOR', 'MIX', 'MAPPING', 'TEX_COORD', 'UVMAP')]:
            nt.nodes.remove(n)
        b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = 0.6
        m.diffuse_color = (*rgb, 1)

def drop_faces_below(o, z):
    """remove faces having any vertex below z (stray ghost geometry)."""
    me = o.data; co = vcos(o); n = len(me.polygons)
    idx = np.empty(n * 3, dtype=np.int32); me.polygons.foreach_get('vertices', idx); idx = idx.reshape(n, 3)
    bad = (co[idx][:, :, 2] < z).any(1)
    if bad.any(): extract(o, bad, 'tmp_trash'); delete(bpy.data.objects.get('tmp_trash'))

def finalize(t, cfg, zones, rest, info):
    wl = cfg['wl']
    strip_textures(cfg)
    final = []
    for name, lst in zones.items():
        o = join(lst, name)
        o.name = name; o.data.name = name
        final.append(o)
        if name in ZONE_MAT: set_single_material(o, ZONE_MAT[name])
        elif name in GELCOAT_ZONES: set_single_material(o, 'gelcoat')
    # decoration: group leftovers by material
    for r in rest:
        if r is None or len(r.data.polygons) == 0: continue
        cen, nr, ar, mi = face_data(r)
        mats = [mat_name(r, i) for i in range(len(r.data.materials))]
        lab = np.array(['deco_' + slug(mats[i] if i < len(mats) else None) for i in mi], dtype=object)
        parts = split_off(r, lab)
        for k, v in parts.items():
            if v is None: continue
            v.name = k; final.append(v)
    # unique deco names without dots
    seen = {}
    for o in final:
        if o.name.startswith('deco_'):
            base = o.name
            n = seen.get(base, 0); seen[base] = n + 1
            if n: o.name = f"{base}_{n + 1}"
    # waterline to y=0 (blender z)
    for o in final:
        if 'srcid' in o.data.attributes: o.data.attributes.remove(o.data.attributes['srcid'])
        o.data.transform(Matrix.Translation((0, 0, -wl)))
        o.data.name = o.name
        # re-link object into scene collection if needed
        if o.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(o)
    return final

def main():
    bpy.context.preferences.filepaths.save_version = 0
    argv = sys.argv[sys.argv.index('--') + 1:]
    t = argv[0]
    cfg, objs = stage1(t)
    # per-face source-object tag (kept through join as a face-int attribute)
    src_names = []
    for o in objs:
        src_names.append(o.name)
        a = o.data.attributes.new('srcid', 'INT', 'FACE'); a.data.foreach_set('value', np.full(len(o.data.polygons), len(src_names) - 1, dtype=np.int32))
    all_ = join(objs, 'ALL')
    P = Pool(all_)
    sid = np.empty(len(all_.data.polygons), dtype=np.int32); all_.data.attributes['srcid'].data.foreach_get('value', sid)
    P.src = np.array(src_names, dtype=object)[sid]
    zones, rest, info = BUILDERS[t](P, cfg)
    final = finalize(t, cfg, zones, rest, info)
    print('ZONES', {o.name: len(o.data.polygons) for o in final})
    os.makedirs(os.path.join(ROOT, 'blend'), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'blend', t + '.blend'))
    zjson = os.path.join(OUT, t + '_info.json')
    json.dump({'info': info, 'zones': {o.name: len(o.data.polygons) for o in final}}, open(zjson, 'w'))

if __name__ == '__main__':
    main()
