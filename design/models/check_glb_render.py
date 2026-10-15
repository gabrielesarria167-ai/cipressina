"""Blender -b -P check_glb_render.py -- <glb> <out_prefix> : import an exported GLB (glTF axes) and render zone-coloured side/below/bow views.
Verifies axes: after import Blender is Z-up, glTF +Z (starboard) is Blender -Y. Camera at -Y therefore sees the starboard side, bow to the right."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zonelib import *
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
objs = []
dg = bpy.context.evaluated_depsgraph_get()
for o in list(bpy.data.objects):
    if o.type != 'MESH': continue
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); me.transform(o.matrix_world)
    n = bpy.data.objects.new('N_' + o.name, me); bpy.context.scene.collection.objects.link(n); objs.append((o.name, n))
for o in list(bpy.data.objects):
    if not o.name.startswith('N_'): bpy.data.objects.remove(o)
res = []
for nm, n in objs:
    n.name = nm.split('.')[0] if False else nm   # GLTFLoader/Blender may add .001; keep
    res.append(n)
def cf(o):
    base = o.name.split('.')[0]
    if base.startswith('deco_'): return (0.65, 0.65, 0.65)
    return PALETTE.get(base, (0.3, 0.3, 0.3))
fit = [o for o in res if o.name.split('.')[0] in PALETTE]
render_views(res, a[1], [('side_stbd', (0, -1, 0)), ('under', (0, 0, -1)), ('bow3q', (1, -1, 0.5))], color_fn=cf, fit=fit or None, res=(1200, 500))
