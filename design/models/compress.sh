#!/bin/zsh
# compress.sh <type> : autocolor recipe (prune -> reorder -> webp (if textures) -> meshopt) from the Blender-exported raw GLB
set -e
T=$1
S=/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/models/out
OUT=/Users/gabrielesarria/cipressina/design/sketches/models
mkdir -p $OUT
G() { npx --yes @gltf-transform/cli@4.5 "$@"; }
G prune $S/${T}_raw.glb $S/${T}_s1.glb --keep-attributes false --keep-leaves true
G reorder $S/${T}_s1.glb $S/${T}_s2.glb --target size
if node -e "const b=require('fs').readFileSync('$S/${T}_s2.glb');const l=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+l));process.exit((j.textures||[]).length?0:1)"; then
  G webp $S/${T}_s2.glb $S/${T}_s3.glb
else
  cp $S/${T}_s2.glb $S/${T}_s3.glb
fi
G meshopt $S/${T}_s3.glb $OUT/${T}.glb --level medium
ls -l $OUT/${T}.glb
