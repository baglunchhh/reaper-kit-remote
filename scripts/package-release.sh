#!/usr/bin/env bash
# Builds dist/reaper-kit-remote-<version>.zip (+ .sha256) from the files in this repo.
# Usage: bash scripts/package-release.sh v1.0.0
set -euo pipefail
VER="${1:?usage: package-release.sh <version>}"
TOP="reaper-kit-remote-${VER}"

rm -rf dist
mkdir -p "dist/${TOP}/reaper_www_root/fonts" "dist/${TOP}/extras"
cp index.html main.js Background-Wood.jpg "dist/${TOP}/reaper_www_root/"
cp fonts/RobotoCondensed-Variable.woff2 "dist/${TOP}/reaper_www_root/fonts/"
cp LICENSE "dist/${TOP}/"
cp spec-export.jsx "dist/${TOP}/extras/"
# INSTALL.txt with the version filled in and Windows line endings
sed "s/@@VERSION@@/${VER}/g; s/\$/\r/" scripts/INSTALL.txt > "dist/${TOP}/INSTALL.txt"

(
  cd dist
  zip -qr -X "${TOP}.zip" "${TOP}"
  unzip -tq "${TOP}.zip"
  sha256sum "${TOP}.zip" > "${TOP}.zip.sha256"
)
echo "built dist/${TOP}.zip"
