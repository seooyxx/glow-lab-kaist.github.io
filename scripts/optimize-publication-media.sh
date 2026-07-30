#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="${REPOSITORY_DIR}/assets/publications/media-manifest.json"
PUBLICATION_DIR="${REPOSITORY_DIR}/assets/publications"
CARD_MEDIA_DIR="${PUBLICATION_DIR}/card-media"
MOTION_DIR="${PUBLICATION_DIR}/motion"
MEDIA_WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/glow-publication-media.XXXXXX")"
GENERATED_DIR="${MEDIA_WORK_DIR}/generated"

cleanup_media_work_dir() {
  if [[ -n "${MEDIA_WORK_DIR}" && -d "${MEDIA_WORK_DIR}" ]]; then
    rm -rf -- "${MEDIA_WORK_DIR}"
  fi
}

trap cleanup_media_work_dir EXIT HUP INT TERM

usage() {
  printf '%s\n' \
    "Usage: bash scripts/optimize-publication-media.sh [--check] [--all | slug ...]" \
    "" \
    "  --all    Rebuild all entries (the default when no slug is given)." \
    "  --check  Validate the manifest and generated file coverage without downloading." \
    "  slug     Rebuild only the named publication; multiple slugs are accepted."
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command curl
require_command ffmpeg
require_command jq
require_command mktemp

mkdir -p "${GENERATED_DIR}" "${PUBLICATION_DIR}" "${CARD_MEDIA_DIR}" "${MOTION_DIR}"

if ! jq empty "${MANIFEST_PATH}"; then
  printf 'Invalid JSON: %s\n' "${MANIFEST_PATH}" >&2
  exit 1
fi

LIST_WIDTH="$(jq -r '.outputs.list.width' "${MANIFEST_PATH}")"
LIST_HEIGHT="$(jq -r '.outputs.list.height' "${MANIFEST_PATH}")"
LIST_QUALITY="$(jq -r '.outputs.list.quality' "${MANIFEST_PATH}")"
CARD_WIDTH="$(jq -r '.outputs.card.width' "${MANIFEST_PATH}")"
CARD_HEIGHT="$(jq -r '.outputs.card.height' "${MANIFEST_PATH}")"
CARD_QUALITY="$(jq -r '.outputs.card.quality' "${MANIFEST_PATH}")"
MOTION_WIDTH="$(jq -r '.outputs.motion.width' "${MANIFEST_PATH}")"
MOTION_HEIGHT="$(jq -r '.outputs.motion.height' "${MANIFEST_PATH}")"
MOTION_FPS="$(jq -r '.outputs.motion.fps' "${MANIFEST_PATH}")"
MOTION_CRF="$(jq -r '.outputs.motion.crf' "${MANIFEST_PATH}")"
MOTION_DURATION="$(jq -r '.outputs.motion.duration' "${MANIFEST_PATH}")"

download_asset() {
  local url="$1"
  local destination="$2"

  curl \
    --fail \
    --location \
    --retry 3 \
    --retry-delay 1 \
    --silent \
    --show-error \
    --user-agent "Mozilla/5.0 (compatible; GLOW-Lab-media-optimizer/1.0)" \
    "${url}" \
    --output "${destination}"
}

cover_filter() {
  local width="$1"
  local height="$2"
  local focal_x="$3"
  local focal_y="$4"

  printf \
    "scale=%s:%s:force_original_aspect_ratio=increase:flags=lanczos,crop=%s:%s:(iw-%s)*%s:(ih-%s)*%s" \
    "${width}" \
    "${height}" \
    "${width}" \
    "${height}" \
    "${width}" \
    "${focal_x}" \
    "${height}" \
    "${focal_y}"
}

encode_still_webp() {
  local input="$1"
  local output="$2"
  local width="$3"
  local height="$4"
  local quality="$5"
  local focal_x="$6"
  local focal_y="$7"
  local seek="${8:-0}"
  local filter

  filter="$(cover_filter "${width}" "${height}" "${focal_x}" "${focal_y}")"
  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -ss "${seek}" \
    -i "${input}" \
    -frames:v 1 \
    -an \
    -map_metadata -1 \
    -vf "${filter}" \
    -c:v libwebp \
    -quality "${quality}" \
    -compression_level 6 \
    "${output}"
}

encode_motion_poster() {
  local input="$1"
  local output="$2"
  local seek="$3"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -ss "${seek}" \
    -i "${input}" \
    -frames:v 1 \
    -an \
    -map_metadata -1 \
    -c:v libwebp \
    -quality "${CARD_QUALITY}" \
    -compression_level 6 \
    "${output}"
}

encode_list_from_motion() {
  local input="$1"
  local output="$2"
  local seek="$3"
  local filter

  filter="$(cover_filter "${LIST_WIDTH}" "${LIST_HEIGHT}" 0.5 0.5)"
  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -ss "${seek}" \
    -i "${input}" \
    -frames:v 1 \
    -an \
    -map_metadata -1 \
    -vf "${filter}" \
    -c:v libwebp \
    -quality "${LIST_QUALITY}" \
    -compression_level 6 \
    "${output}"
}

encode_motion() {
  local input="$1"
  local output="$2"
  local focal_x="$3"
  local focal_y="$4"
  local seek="$5"
  local duration="$6"
  local fps="$7"
  local loop_input="${8:-false}"
  local filter
  local -a input_options=()

  if [[ "${loop_input}" == "true" ]]; then
    input_options=(-stream_loop -1)
  fi

  filter="$(cover_filter "${MOTION_WIDTH}" "${MOTION_HEIGHT}" "${focal_x}" "${focal_y}"),fps=${fps}"
  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -ss "${seek}" \
    "${input_options[@]}" \
    -i "${input}" \
    -t "${duration}" \
    -an \
    -map_metadata -1 \
    -vf "${filter}" \
    -c:v libx264 \
    -crf "${MOTION_CRF}" \
    -preset slow \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "${output}"
}

fetch_nearest_page_image() {
  local page_url="$1"
  local title_fragment="$2"
  local output="$3"

  require_command python3
  python3 - "${page_url}" "${title_fragment}" "${output}" <<'PY'
import html
import re
import sys
import urllib.parse
import urllib.request

page_url, title_fragment, output_path = sys.argv[1:]
headers = {"User-Agent": "Mozilla/5.0 (compatible; GLOW-Lab-media-optimizer/1.0)"}
request = urllib.request.Request(page_url, headers=headers)
markup = urllib.request.urlopen(request, timeout=30).read().decode("utf-8", "ignore")
title_offset = markup.lower().find(title_fragment.lower())
if title_offset < 0:
    raise RuntimeError(f"Could not find {title_fragment!r} on {page_url}")
images = [
    (match.start(), html.unescape(match.group(1)))
    for match in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', markup, re.IGNORECASE)
]
if not images:
    raise RuntimeError(f"Could not find an image on {page_url}")
_, relative_image_url = min(images, key=lambda item: abs(item[0] - title_offset))
image_url = urllib.parse.urljoin(page_url, relative_image_url)
image_request = urllib.request.Request(image_url, headers=headers)
with urllib.request.urlopen(image_request, timeout=30) as response:
    with open(output_path, "wb") as output:
        output.write(response.read())
PY
}

extract_pdf_image() {
  local pdf_url="$1"
  local xref="$2"
  local output="$3"
  local pdf_path="${MEDIA_WORK_DIR}/source.pdf"

  require_command python3
  if ! python3 -c "import fitz" >/dev/null 2>&1; then
    printf '%s\n' "PyMuPDF is required for PDF image extraction: python3 -m pip install PyMuPDF" >&2
    exit 1
  fi

  download_asset "${pdf_url}" "${pdf_path}"
  python3 - "${pdf_path}" "${output}" "${xref}" <<'PY'
import sys
import fitz

pdf_path, output_path, xref = sys.argv[1], sys.argv[2], int(sys.argv[3])
document = fitz.open(pdf_path)
asset = document.extract_image(xref)
with open(output_path, "wb") as output:
    output.write(asset["image"])
PY
}

fetch_still_source() {
  local entry="$1"
  local slug="$2"
  local source_type
  local output="${MEDIA_WORK_DIR}/${slug}.still-source"

  source_type="$(jq -r '.still.type // empty' <<<"${entry}")"
  case "${source_type}" in
    url)
      download_asset "$(jq -r '.still.url' <<<"${entry}")" "${output}"
      ;;
    nearest-page-image)
      fetch_nearest_page_image \
        "$(jq -r '.still.pageUrl' <<<"${entry}")" \
        "$(jq -r '.still.titleFragment' <<<"${entry}")" \
        "${output}"
      ;;
    pdf-xref)
      extract_pdf_image \
        "$(jq -r '.still.url' <<<"${entry}")" \
        "$(jq -r '.still.xref' <<<"${entry}")" \
        "${output}"
      ;;
    *)
      printf 'Unsupported still source type for %s: %s\n' "${slug}" "${source_type}" >&2
      exit 1
      ;;
  esac

  printf '%s\n' "${output}"
}

build_stacked_gif_motion() {
  local entry="$1"
  local output="$2"
  local focal_x="$3"
  local focal_y="$4"
  local duration="$5"
  local fps="$6"
  local top_source="${MEDIA_WORK_DIR}/polymorphicgan-top.gif"
  local bottom_source="${MEDIA_WORK_DIR}/polymorphicgan-bottom.gif"
  local cover

  download_asset "$(jq -r '.motion.topUrl' <<<"${entry}")" "${top_source}"
  download_asset "$(jq -r '.motion.bottomUrl' <<<"${entry}")" "${bottom_source}"
  cover="$(cover_filter "${MOTION_WIDTH}" "${MOTION_HEIGHT}" "${focal_x}" "${focal_y}")"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -stream_loop -1 \
    -i "${top_source}" \
    -stream_loop -1 \
    -i "${bottom_source}" \
    -filter_complex \
    "[0:v]fps=${fps},crop=1292:194:0:33[top];[1:v]fps=${fps},crop=1292:194:0:33[bottom];[top][bottom]vstack=inputs=2[stack];[stack]${cover}[out]" \
    -map "[out]" \
    -t "${duration}" \
    -an \
    -map_metadata -1 \
    -c:v libx264 \
    -crf "${MOTION_CRF}" \
    -preset slow \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "${output}"
}

build_motion_source() {
  local entry="$1"
  local slug="$2"
  local output="$3"
  local focal_x="$4"
  local focal_y="$5"
  local motion_type
  local seek
  local duration
  local fps
  local source
  local animated_gif

  motion_type="$(jq -r '.motion.type' <<<"${entry}")"
  seek="$(jq -r '.motion.seek // 0' <<<"${entry}")"
  duration="$(jq -r --arg fallback "${MOTION_DURATION}" '.motion.duration // ($fallback | tonumber)' <<<"${entry}")"
  fps="$(jq -r --arg fallback "${MOTION_FPS}" '.motion.fps // ($fallback | tonumber)' <<<"${entry}")"

  case "${motion_type}" in
    url)
      source="${MEDIA_WORK_DIR}/${slug}.motion-source"
      download_asset "$(jq -r '.motion.url' <<<"${entry}")" "${source}"
      encode_motion "${source}" "${output}" "${focal_x}" "${focal_y}" "${seek}" "${duration}" "${fps}"
      ;;
    animated-webp)
      require_command convert
      source="${MEDIA_WORK_DIR}/${slug}.animated.webp"
      animated_gif="${MEDIA_WORK_DIR}/${slug}.animated.gif"
      download_asset "$(jq -r '.motion.url' <<<"${entry}")" "${source}"
      convert "${source}" -coalesce -layers Optimize "${animated_gif}"
      encode_motion "${animated_gif}" "${output}" "${focal_x}" "${focal_y}" "${seek}" "${duration}" "${fps}" true
      ;;
    stacked-gifs)
      build_stacked_gif_motion "${entry}" "${output}" "${focal_x}" "${focal_y}" "${duration}" "${fps}"
      ;;
    *)
      printf 'Unsupported motion source type for %s: %s\n' "${slug}" "${motion_type}" >&2
      exit 1
      ;;
  esac
}

rebuild_publication() {
  local slug="$1"
  local entry
  local focal_x
  local focal_y
  local poster_time
  local list_output="${GENERATED_DIR}/${slug}.list.webp"
  local card_output="${GENERATED_DIR}/${slug}.card.webp"
  local motion_output="${GENERATED_DIR}/${slug}.mp4"
  local still_source

  entry="$(jq -c --arg slug "${slug}" '.publications[] | select(.slug == $slug)' "${MANIFEST_PATH}")"
  if [[ -z "${entry}" ]]; then
    printf 'Unknown publication slug: %s\n' "${slug}" >&2
    exit 1
  fi

  focal_x="$(jq -r '.focalPoint.x // 0.5' <<<"${entry}")"
  focal_y="$(jq -r '.focalPoint.y // 0.5' <<<"${entry}")"
  poster_time="$(jq -r '.posterTime // 0.5' <<<"${entry}")"

  printf 'Optimizing %s\n' "${slug}"
  if jq -e '.motion' >/dev/null <<<"${entry}"; then
    build_motion_source \
      "${entry}" \
      "${slug}" \
      "${motion_output}" \
      "${focal_x}" \
      "${focal_y}"
    encode_motion_poster "${motion_output}" "${card_output}" "${poster_time}"
    encode_list_from_motion "${motion_output}" "${list_output}" "${poster_time}"
    mv -f -- "${motion_output}" "${MOTION_DIR}/${slug}.mp4"
  else
    still_source="$(fetch_still_source "${entry}" "${slug}")"
    encode_still_webp \
      "${still_source}" \
      "${card_output}" \
      "${CARD_WIDTH}" \
      "${CARD_HEIGHT}" \
      "${CARD_QUALITY}" \
      "${focal_x}" \
      "${focal_y}"
    encode_still_webp \
      "${still_source}" \
      "${list_output}" \
      "${LIST_WIDTH}" \
      "${LIST_HEIGHT}" \
      "${LIST_QUALITY}" \
      "${focal_x}" \
      "${focal_y}"
  fi

  mv -f -- "${card_output}" "${CARD_MEDIA_DIR}/${slug}.webp"
  mv -f -- "${list_output}" "${PUBLICATION_DIR}/${slug}.webp"
}

check_manifest() {
  local manifest_count
  local missing_count=0
  local slug

  manifest_count="$(jq '.publications | length' "${MANIFEST_PATH}")"
  if [[ "${manifest_count}" -ne 30 ]]; then
    printf 'Expected 30 publication entries, found %s.\n' "${manifest_count}" >&2
    return 1
  fi

  while IFS= read -r slug; do
    if [[ ! -f "${PUBLICATION_DIR}/${slug}.webp" ]]; then
      printf 'Missing list thumbnail: %s.webp\n' "${slug}" >&2
      missing_count=$((missing_count + 1))
    fi
    if [[ ! -f "${CARD_MEDIA_DIR}/${slug}.webp" ]]; then
      printf 'Missing card media: card-media/%s.webp\n' "${slug}" >&2
      missing_count=$((missing_count + 1))
    fi
    if jq -e --arg slug "${slug}" '.publications[] | select(.slug == $slug) | .motion' "${MANIFEST_PATH}" >/dev/null; then
      if [[ ! -f "${MOTION_DIR}/${slug}.mp4" ]]; then
        printf 'Missing motion preview: motion/%s.mp4\n' "${slug}" >&2
        missing_count=$((missing_count + 1))
      fi
    fi
  done < <(jq -r '.publications[].slug' "${MANIFEST_PATH}")

  if [[ "${missing_count}" -ne 0 ]]; then
    return 1
  fi

  printf 'Manifest valid: %s publications, 30 list thumbnails, 30 card images, 13 motion previews.\n' "${manifest_count}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--check" ]]; then
  check_manifest
  exit
fi

declare -a target_slugs=()
if [[ "$#" -eq 0 || "${1:-}" == "--all" ]]; then
  mapfile -t target_slugs < <(jq -r '.publications[].slug' "${MANIFEST_PATH}")
else
  target_slugs=("$@")
fi

for slug in "${target_slugs[@]}"; do
  rebuild_publication "${slug}"
done

check_manifest
printf 'Optimized %s publication media set(s).\n' "${#target_slugs[@]}"
