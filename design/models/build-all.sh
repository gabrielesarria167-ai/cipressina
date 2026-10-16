#!/bin/zsh
# build-all.sh [type...] : GLB -> zones (Blender) -> decimate/export/thumbnail (Blender) -> gltf-transform compress -> models/<type>.glb (repo root)
set -e
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
TYPES=("$@"); [ ${#TYPES[@]} -eq 0 ] && TYPES=(gommone open cabinato yacht vela)
for T in $TYPES; do
  echo "=== $T"
  $B -b -P split_zones.py -- $T 2>&1 | grep -E "ZONES|Error|Traceback" || true
  $B -b blend/$T.blend -P postprocess.py -- $T 2>&1 | grep -E "TRIS|EXPORTED|THUMB|Error|Traceback|ratio" || true
  ./compress.sh $T 2>&1 | tail -1
done
node make-zones-found.mjs

# For a Claude artifact preview (it does not serve .glb), also run: node glb2json.mjs
