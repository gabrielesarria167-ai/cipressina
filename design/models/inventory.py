# Step 0: inventory of the downloaded Sketchfab GLBs.
# usage: Blender -b -P inventory.py -- [model.glb ...]      (no args = the five picks)
# Prints per model: objects (mesh/empty/armature), materials, triangle counts, world bounding boxes, up axis, image sizes.
# Axes: glTF is +Y up; Blender's importer converts to +Z up, so the boxes below are Blender X, Y, Z (= glTF X, -Z, Y).
# Skinned meshes are measured on the evaluated (rest-pose) geometry.
import bpy, sys, os
import mathutils

HERE = os.path.dirname(os.path.abspath(__file__))
PICKS = ['gommone/zodiac-redc130', 'open/grady-freedom-325', 'cabinato/whaler-285-conquest',
         'flybridge/grand-banks-2002', 'vela/irwin-38']
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
paths = args or [os.path.join(HERE, 'src', p, 'model.glb') for p in PICKS]


def inventory(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    dg = bpy.context.evaluated_depsgraph_get()
    print('===', path)
    tot = 0
    mn = mathutils.Vector((1e9,) * 3)
    mx = mathutils.Vector((-1e9,) * 3)
    rows = []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            rows.append((0, f"  [{o.type}] {o.name} parent={o.parent.name if o.parent else None}"))
            continue
        ev = o.evaluated_get(dg)
        em = ev.to_mesh()
        pts = [ev.matrix_world @ v.co for v in em.vertices] or [mathutils.Vector((0, 0, 0))]
        ev.to_mesh_clear()
        n = sum(len(p.vertices) - 2 for p in o.data.polygons)
        tot += n
        lo = mathutils.Vector(min(p[i] for p in pts) for i in range(3))
        hi = mathutils.Vector(max(p[i] for p in pts) for i in range(3))
        for i in range(3):
            mn[i] = min(mn[i], lo[i]); mx[i] = max(mx[i], hi[i])
        mats = [m.name if m else None for m in o.data.materials]
        rows.append((n, f"  {o.name[:34]:34} tris={n:8} mats={mats} lo=({lo.x:.2f},{lo.y:.2f},{lo.z:.2f}) hi=({hi.x:.2f},{hi.y:.2f},{hi.z:.2f})"))
    for _, r in sorted(rows, key=lambda r: -r[0]):
        print(r)
    print('TOTAL tris', tot, 'objects', len(bpy.data.objects), 'materials', len(bpy.data.materials))
    print('BBOX (Blender Z-up) size', tuple(round(mx[i] - mn[i], 2) for i in range(3)), 'min', tuple(round(x, 2) for x in mn), 'max', tuple(round(x, 2) for x in mx))
    print('images:', sorted({tuple(i.size) for i in bpy.data.images}), 'count', len(bpy.data.images))


for p in paths:
    inventory(p)
