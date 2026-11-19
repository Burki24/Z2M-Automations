#!/usr/bin/env bash
set -euo pipefail

if (( $# < 2 )); then
  echo "Usage: bash scripts/build-snap-prototype.sh APP.deb OUTPUT_DIRECTORY [SNAPCRAFT_OPTIONS...]" >&2
  exit 2
fi

deb=$(realpath -e -- "$1")
output=$2
shift 2

if [[ $(dpkg-deb -f "$deb" Package) != z2m-automations || $(dpkg-deb -f "$deb" Architecture) != amd64 ]]; then
  echo "Expected an amd64 z2m-automations Debian package." >&2
  exit 1
fi
version=$(dpkg-deb -f "$deb" Version)
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Expected an application version in major.minor.patch format." >&2
  exit 1
fi

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p -- "$output"
output=$(realpath -e -- "$output")
project=$(mktemp -d -- "$output/.snap-build.XXXXXXXX")
trap 'rm -rf -- "$project"' EXIT

mkdir -- "$project/snap"
cp -- "$deb" "$project/app.deb"
sed "s/@DEB_VERSION@/$version/" "$root/apps/desktop/snap/snapcraft.yaml" > "$project/snap/snapcraft.yaml"
cd -- "$project"
filename="z2m-automations_${version}_amd64.snap"
snapcraft pack "$@" --output "$filename"
mv -- "$filename" "$output/$filename"
