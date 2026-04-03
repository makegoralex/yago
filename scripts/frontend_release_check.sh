#!/usr/bin/env bash
set -uo pipefail

URL="${1:-https://yago-app.ru/}"
REQUESTS="${2:-20}"

if ! [[ "$REQUESTS" =~ ^[0-9]+$ ]] || (( REQUESTS < 1 )); then
  echo "REQUESTS must be a positive integer" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

printf "# Frontend release consistency check\n"
printf "URL: %s\n" "$URL"
printf "Requests: %s\n\n" "$REQUESTS"
printf "%-4s | %-24s | %-24s\n" "#" "index hash" "X-Release-Id / X-Build-Hash"
printf -- "%.0s-" {1..70}
printf "\n"

for i in $(seq 1 "$REQUESTS"); do
  headers_file="$tmp_dir/h.$i"
  body_file="$tmp_dir/b.$i"
  err_file="$tmp_dir/e.$i"

  if ! curl -sS --max-time 15 -D "$headers_file" "$URL" -o "$body_file" 2>"$err_file"; then
    err_msg="$(tr '\n' ' ' <"$err_file" | sed 's/[[:space:]]\\+/ /g')"
    printf "%-4s | %-24s | %-24s\\n" "$i" "<curl_error>" "${err_msg:-<missing>}"
    continue
  fi

  hash="$(sed -nE 's#.*(/assets/index-([A-Za-z0-9_-]+)\.js).*#\2#p' "$body_file" | head -n1 || true)"
  release_id="$(sed -nE 's/^x-release-id:[[:space:]]*(.+)$/\1/ip' "$headers_file" | head -n1 | tr -d '\r' || true)"

  if [[ -z "$release_id" ]]; then
    release_id="$(sed -nE 's/^x-build-hash:[[:space:]]*(.+)$/\1/ip' "$headers_file" | head -n1 | tr -d '\r' || true)"
  fi

  hash="${hash:-<missing>}"
  release_id="${release_id:-<missing>}"

  printf "%-4s | %-24s | %-24s\n" "$i" "$hash" "$release_id"
done

printf "\n# Aggregated\n"
python - <<'PY' "$tmp_dir" "$REQUESTS"
import os
import re
import sys
from collections import Counter

tmp_dir = sys.argv[1]
requests = int(sys.argv[2])

hashes = []
release_ids = []
for i in range(1, requests + 1):
    body_path = os.path.join(tmp_dir, f"b.{i}")
    header_path = os.path.join(tmp_dir, f"h.{i}")
    if not os.path.exists(body_path) or not os.path.exists(header_path):
        hashes.append("<curl_error>")
        release_ids.append("<curl_error>")
        continue

    with open(body_path, encoding="utf-8", errors="ignore") as f:
        body = f.read()
    with open(header_path, encoding="utf-8", errors="ignore") as f:
        headers = f.read()

    m = re.search(r"/assets/index-([A-Za-z0-9_-]+)\.js", body)
    hashes.append(m.group(1) if m else "<missing>")

    rid = None
    for line in headers.splitlines():
        low = line.lower()
        if low.startswith("x-release-id:") or low.startswith("x-build-hash:"):
            rid = line.split(":", 1)[1].strip() or "<empty>"
            break
    release_ids.append(rid if rid else "<missing>")

hash_counter = Counter(hashes)
release_counter = Counter(release_ids)

print("index hash counts:")
for value, count in hash_counter.items():
    print(f"  {value}: {count}")

print("release id counts:")
for value, count in release_counter.items():
    print(f"  {value}: {count}")

invalid = {"<missing>", "<curl_error>"}
if len(hash_counter) == 1 and len(release_counter) == 1 and not (set(hash_counter) & invalid) and not (set(release_counter) & invalid):
    print("\nSTATUS: OK - single frontend hash and single release id across all responses.")
else:
    print("\nSTATUS: MISMATCH - multiple hashes and/or missing release headers detected.")
    sys.exit(2)
PY
