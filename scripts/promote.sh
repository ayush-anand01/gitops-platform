#!/usr/bin/env bash
# Copy image tags from one environment's values file to another.
# Usage: scripts/promote.sh dev staging
set -euo pipefail

from="${1:?source env}"
to="${2:?target env}"
src="gitops/envs/$from/values.yaml"
dst="gitops/envs/$to/values.yaml"

for svc in backend frontend; do
  tag=$(yq ".$svc.image.tag" "$src")
  yq -i ".$svc.image.tag = \"$tag\"" "$dst"
  echo "$svc: $from -> $to = $tag"
done
