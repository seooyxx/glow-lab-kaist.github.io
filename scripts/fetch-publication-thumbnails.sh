#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '%s\n' \
  "fetch-publication-thumbnails.sh is kept as a compatibility alias." \
  "Publication sources and crop settings now live in assets/publications/media-manifest.json."

exec bash "${REPOSITORY_DIR}/scripts/optimize-publication-media.sh" "$@"
