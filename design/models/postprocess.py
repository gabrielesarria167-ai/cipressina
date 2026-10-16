"""Blender -b blend/<type>.blend -P postprocess.py -- <type> : decimate heavy parts, shrink textures, export raw GLB + thumbnail.
Does NOT modify blend/<type>.blend (the pre-decimation file for hand refinement)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zonelib import *

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out')   # intermediates, gitignored
THUMBS = os.path.join(ROOT, '..', '..', 'models', 'thumbs')
t = sys.argv[sys.argv.index('--') + 1]
cfg = load_config(t)
BUDGET = cfg.get('budget_tris', 240000)
KEEP_FULL = {'bottom', 'boot', 'topside_port', 'topside_starboard', 'transom', 'keel', 'rudder', 'tube_port', 'tube_starboard'}

objs = [o for o in bpy.data.objects if o.type == 'MESH']
tris = {o.name: len(o.data.polygons) for o in objs}
total = sum(tris.values())
fixed = sum(v for k, v in tris.items() if k in KEEP_FULL)
heavy = [o for o in objs if o.name not in KEEP_FULL]
heavy_tris = sum(tris[o.name] for o in heavy)
print('TRIS before', total, 'fixed', fixed, 'heavy', heavy_tris)
if total > BUDGET:
    r = max(0.03, (BUDGET - fixed) / heavy_tris)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in heavy:
        n = tris[o.name]
        if n < 300: continue
        # gentler on mid-size zone parts (cabin/deck/console), harder on bulk deco
        ratio = min(1.0, r)
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = ratio; m.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.remove(m)
        old = o.data; o.data = me; me.name = o.name
        bpy.data.meshes.remove(old)
    print('decimation ratio', round(r, 3))
objs = [o for o in bpy.data.objects if o.type == 'MESH']
tot2 = sum(len(o.data.polygons) for o in objs)
print('TRIS after', tot2)

# textures: cap at 1024 px, set viewport colours (used by thumbnail)
for im in bpy.data.images:
    if im.size[0] > 1024 or im.size[1] > 1024:
        k = 1024 / max(im.size); im.scale(max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k)))
for m in bpy.data.materials:
    if m.use_nodes:
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b: m.diffuse_color = b.inputs['Base Color'].default_value
for o in objs:
    for k in list(o.data.attributes.keys()):
        if k in ('srcid',): o.data.attributes.remove(o.data.attributes[k])

# export raw GLB (Y-up conversion is done by the exporter: Blender +Z up -> glTF +Y up, Blender -Y -> glTF +Z)
os.makedirs(OUT, exist_ok=True)
raw = os.path.join(OUT, t + '_raw.glb')
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', export_yup=True, export_cameras=False, export_lights=False)
print('EXPORTED', raw, os.path.getsize(raw))

# thumbnail --------------------------------------------------------------------------------------
sc = bpy.context.scene
mn, mx = bbox(objs)
loa = mx[0] - mn[0]
disc = bpy.data.objects.new('ground', bpy.data.meshes.new('ground')); sc.collection.objects.link(disc)
bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=loa * 6, segments=64); bm.to_mesh(disc.data); bm.free()
gm = bpy.data.materials.new('ground'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.42, 0.46, 0.52, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
gm.diffuse_color = (0.42, 0.46, 0.52, 1); disc.data.materials.append(gm)
disc.location = (0, 0, -0.005)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 1.3; sun.data.angle = 0.2; sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN')); sc.collection.objects.link(fill)
fill.data.energy = 0.4; fill.rotation_euler = (math.radians(70), 0, math.radians(135))
sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = False
sc.render.resolution_x, sc.render.resolution_y = 480, 320
sc.render.image_settings.file_format = 'PNG'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.9, 0.92, 0.95, 1); bg.inputs['Strength'].default_value = 0.8
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
fit = [o for o in objs if not (t == 'vela' and False)]
if t == 'vela':
    fit = [o for o in objs if o.name in PALETTE]   # frame hull + cabin; mast may crop at the top, keep it whole instead:
    fit = objs
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.clip_end = 1000
c = (mn + mx) / 2; c[2] = (mn[2] + mx[2]) / 2
dv = Vector((1.0, -0.85, 0.55)).normalized()
q = (-dv).to_track_quat('-Z', 'Y'); cam.rotation_euler = q.to_euler(); rot = np.array(q.to_matrix())
pts = np.concatenate([vcos(o)[::4] for o in fit])
if t == 'vela': pts = pts[pts[:, 2] < 6.0]   # frame hull + lower mast only (mast is 16 m tall); the top is allowed to crop
c = (pts.min(0) + pts.max(0)) / 2
loc = rot.T @ (pts - c).T
xs, ys = loc[0], loc[1]
cam.data.ortho_scale = max(xs.max() - xs.min(), (ys.max() - ys.min()) * 1.5) * 1.12
off = rot @ np.array([(xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2, 0])
cam.location = Vector(c) + dv * 200 + Vector(off)
os.makedirs(THUMBS, exist_ok=True)
png = os.path.join(OUT, t + '_thumb.png')
sc.render.filepath = png
bpy.ops.render.render(write_still=True)
# try WebP
try:
    im = bpy.data.images.load(png)
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.quality = 85
    im.save_render(os.path.join(THUMBS, t + '.webp'), scene=sc)
    print('THUMB webp')
except Exception as e:
    import shutil; shutil.copy(png, os.path.join(THUMBS, t + '.png')); print('THUMB png', e)
json.dump({'tris': tot2}, open(os.path.join(OUT, t + '_post.json'), 'w'))
