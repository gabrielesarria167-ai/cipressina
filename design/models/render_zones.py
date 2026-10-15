"""Blender -b <file.blend> -P render_zones.py -- <prefix>   : zone-coloured side/under/top/rear renders of a split model."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zonelib import *
prefix = sys.argv[sys.argv.index('--') + 1]
objs = [o for o in bpy.data.objects if o.type == 'MESH']
def cf(o):
    if o.name.startswith('deco_'): return (0.65, 0.65, 0.65)
    return PALETTE.get(o.name, (0.2, 0.2, 0.2))
# unlink dots
fit = [o for o in objs if o.name in PALETTE and o.name not in ('console',)]
if os.environ.get('FULLFIT'): fit = None
render_views(objs, prefix, VIEWS_STD + [('bow3q', (1, 1, 0.5))], color_fn=cf, fit=fit)
