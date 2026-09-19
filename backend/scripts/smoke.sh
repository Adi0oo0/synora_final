#!/usr/bin/env bash
# Quick manual smoke test against a running server.
set -euo pipefail
BASE="${BASE:-http://localhost:8000}"

echo "── health ─────────────────────────────────────────"
curl -s "$BASE/api/health" | jq

echo "── routing: wellness ──────────────────────────────"
curl -s -X POST "$BASE/api/route" -H 'Content-Type: application/json' \
  -d '{"text":"what should I eat for lunch"}' | jq

echo "── routing: clinical inside wellness framing ──────"
curl -s -X POST "$BASE/api/route" -H 'Content-Type: application/json' \
  -d '{"text":"is it ok to run with this chest pain"}' | jq

echo "── triage: low band ───────────────────────────────"
curl -s -X POST "$BASE/api/triage" -H 'Content-Type: application/json' \
  -d '{"region":"chest","symptoms":["burning"],"triggers":["meals"],"severity":3,
       "duration":"days","condition_ids":["gerd","t2d"]}' | jq '{band,score,summary,citations}'

echo "── triage: forced escalation ──────────────────────"
curl -s -X POST "$BASE/api/triage" -H 'Content-Type: application/json' \
  -d '{"region":"chest","symptoms":["pressure","breath"],"severity":2,"duration":"today"}' \
  | jq '{band,score,escalation_rules,summary}'

echo "── rag ────────────────────────────────────────────"
curl -s -X POST "$BASE/api/rag/search" -H 'Content-Type: application/json' \
  -d '{"query":"how much sodium is hiding in broth","top_k":3}' | jq '.hits[] | {id,title,score}'

echo "── vitals snapshot ────────────────────────────────"
curl -s "$BASE/api/vitals/snapshot?stream_id=hr&count=120" | jq '{anomalies,stats}'

echo "── vitals live stream (10s) ───────────────────────"
curl -sN --max-time 10 "$BASE/api/vitals/stream?count=60&interval_ms=150" | head -20
