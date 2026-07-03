#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${SURGE_DOMAIN:-chris-shina-portfolio.surge.sh}"

cd "$ROOT"

echo "Building production bundle..."
npm run build

echo "Trimming deploy artifacts..."
find dist -type f \( -name '*.source.glb' -o -name '*.tmp.glb' -o -name '*.bak' -o -name '*.beforeNeon.glb' \) -delete

for junk in \
  "dist/props/Neon Jesus.glb" \
  "dist/props/Lion Statue .glb" \
  "dist/props/V8 Cafe Model.glb" \
  "dist/props/Neon Car.glb" \
  "dist/props/Neon Car 8 bit .glb" \
  "dist/props/Saturn.glb" \
  "dist/props/MoreJesus.glb" \
  "dist/props/Sign.glb" \
  "dist/props/Gameboy Model .glb" \
  "dist/Tree.glb" \
  "dist/motorcycle.glb" \
  "dist/pyramid.glb" \
  "dist/sonic.glb"
do
  rm -f "$junk"
done

rm -f dist/landing/nameBlocks*.glb dist/vehicle/neonCar*.glb dist/areas/areas.glb.bak 2>/dev/null || true

compress_if_needed() {
  local src="$1"
  local dest="$2"
  if [[ -f "$dest" ]] && [[ "$(stat -f%z "$dest")" -gt 52428800 ]]; then
    echo "Compressing $(basename "$dest") for Surge (50MB limit)..."
    npx gltf-transform optimize "$src" "$dest" --compress draco
  fi
}

compress_if_needed "static/props/Name.glb" "dist/props/Name.glb"
compress_if_needed "static/props/FloorTexture.glb" "dist/props/FloorTexture.glb"
compress_if_needed "static/props/RetroMountain.glb" "dist/props/RetroMountain.glb"
compress_if_needed "static/props/Mecha.glb" "dist/props/Mecha.glb"
compress_if_needed "static/props/LionMotorcycle.glb" "dist/props/LionMotorcycle.glb"
compress_if_needed "static/props/2ndMotorcycle.glb" "dist/props/2ndMotorcycle.glb"
compress_if_needed "static/props/SpeedStarCar.glb" "dist/props/SpeedStarCar.glb"
compress_if_needed "static/props/Lion.glb" "dist/props/Lion.glb"
compress_if_needed "static/props/Garage.glb" "dist/props/Garage.glb"

echo "Deploying to https://${DOMAIN} ..."
surge "$ROOT/dist" "$DOMAIN"

echo "Done: https://${DOMAIN}"
