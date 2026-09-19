# ZenHealth

A holistic health and wellness agent: symptom triage, condition-aware nutrition, coaching chat, and
wearable anomaly detection in one place. React 19 + Vite on the front, talking to the FastAPI
backend in [`zenhealth-backend`](../zenhealth-backend) (deterministic triage, RAG, vitals, and a
streaming chat coach) which holds the NVIDIA NIM key.

---

## Quick start

Two processes, two terminals — the backend is a separate Python service, not part of this repo.

```bash
# terminal 1 — backend (../zenhealth-backend)
cd ../zenhealth-backend
cp .env.example .env          # add your nvapi- key and confirm the model ids
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2 — this frontend
cp .env.example .env          # only needed if the backend isn't on localhost:8000
npm install
npm run dev                   # web on :5173, proxying /api to the backend on :8000
```

The app runs **without** a key. Every model call degrades to the local deterministic engine (or, on
the backend, to lexical search / a static message), so triage scoring, nutrition rules and the
anomaly detector all work offline — you only lose the plain-language summaries, meal-photo analysis,
and the coaching chat's model replies (routing and red-flag screening still work; they're rule-based).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, watching |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the production bundle locally |
| `npm test` | Vitest — triage rules, nutrition scoring, anomaly detector |
| `npm run lint` | ESLint |

The backend's default `ALLOWED_ORIGINS` already includes `http://localhost:5173`, so no CORS
changes are needed for local development. In production, serve `dist/` from any static host and
point `API_ORIGIN` / your reverse proxy at wherever the FastAPI backend runs.

---

## Pages

| Route | What lives there |
| --- | --- |
| `/` | Dashboard — today's log, the morning anomaly, urgency at a glance |
| `/chat` | Coaching chat — streams from the backend, with routing, citations and a reasoning panel |
| `/triage` | Body map, symptom form, deterministic urgency result |
| `/nutrition` | Food search, meal photo, per-condition verdicts, running day total |
| `/vitals` | Four wearable streams, flagged windows, detector settings |
| `/care` | Urgency gauge, video callback, clinician availability, medicines |
| `/library` | Preventive care that's due, reading filtered by condition |
| `/settings` | Conditions, text size, theme, contrast, motion |

---

## Architecture

```
browser (React)                         zenhealth-backend (FastAPI)      NVIDIA NIM
─────────────────                       ──────────────────────────      ──────────
lib/triage.js      decides urgency
lib/nutrition.js   scores food          POST /api/triage        ─────►  reasoning model
lib/anomaly.js     watches streams      POST /api/meal/analyse  ─────►  vision model
lib/api.js         ──────────────────►  POST /api/route         ─────►  light model
  · explainTriage()                     POST /api/chat/stream   ─────►  reasoning + RAG
  · analyseMealPhoto()                  POST /api/rag/search
  · streamChat()      (SSE)             GET  /api/vitals/*
                                         (key lives here only)
```

**The model never decides anything that matters, on either side.** `scoreTriage()` in
`src/lib/triage.js` gives an instant, local band the moment the person submits the form — same
input, same band, every time. `explainTriage()` then asks the backend's own rule engine
(`app/services/triage.py`) to do the same scoring server-side and, only for non-emergency bands, adds
a grounded, non-diagnostic summary with citations. If either side calls the band `immediate`, there is
no model round-trip in front of it.

The chat coach (`/chat`) follows the same order server-side, before a single token is generated:
red-flag lexicon screen → intent routing → RAG retrieval → the model, streamed as generated. The SSE stream surfaces each stage as its own event (`route`, `citations`,
`reasoning`, `content`, `done`) so the UI can render them separately rather than
splicing everything into one blob of text — see `streamChat()` in `src/lib/api.js`. If the backend
flags a message as a red flag mid-conversation, the chat page opens the same `EmergencyDialog` the
rest of the app uses; it does not wait for the person to notice the badge.

Two layers sit in the request path:

1. **Deterministic rules first.** Red-flag symptoms and escalation combinations (chest pressure with
   breathlessness, stroke signs, GI bleeding) jump straight to the top band regardless of anything
   else, on both the client's local engine and the backend's.
2. **Prompts as reviewable code.** `app/nim/prompts.py` (backend) sets the model's scope. Model
   output itself is not filtered or rewritten after generation.

---

## Wiring the NVIDIA models

The nvapi key and model ids are configured entirely on the backend — see
`../zenhealth-backend/.env.example` and its README. Nothing in this repo ever holds the key; anything
prefixed `VITE_` here would ship to the browser, so don't put it there.

The catalog changes constantly. Confirm the exact strings before trusting the defaults:

```bash
curl -s https://integrate.api.nvidia.com/v1/models \
  -H "Authorization: Bearer $NVIDIA_API_KEY" | jq '.data[].id'
```

---

## What is real and what is sample data

Real: the triage rule engine, the nutrition scoring rules, the anomaly detector, the routing, every
piece of the interface, and the whole backend path (including RAG over a real corpus in
`app/data/corpus/`).

Sample: the profile (`src/data/profile.js`), the food table (`src/data/foods.js`), the wearable
streams (`src/data/vitals.js`, seeded pseudo-random so they are reproducible), clinician availability
and the article list. Swap each for a real source without touching a component — the shapes are the
contract.

---

## Accessibility

Built to the floor, not bolted on: skip link, focus moves to `<main>` on every route change, visible
focus rings everywhere, 48px minimum interactive height, native `<dialog>` for focus trapping,
`prefers-reduced-motion` respected plus a manual override, a high-contrast mode, and three text sizes
that scale the whole type system from the root.

Body text is 17px at 1.7 line-height by default. If that still reads tight on your screens, raise
`--text-base` in `src/styles/tokens.css` — every size and most spacing values derive from it.

---

## Deployment notes

- Never expose `NVIDIA_API_KEY` to the client. Anything prefixed `VITE_` ships to the browser — the
  key belongs only in the backend's `.env`.
- `ALLOWED_ORIGINS` on the backend is an explicit allowlist. Do not reflect the Origin header, never
  wildcard it with credentials.
- Add auth in front of `/api/rag/reindex` on the backend before deploying — it costs embedding calls.
- Add structured logging and tracing at the backend boundary, but never log symptom text, chat
  messages, or meal photos — the backend's error handler deliberately returns a generic message
  rather than leaking internals.
- Session data lives in `localStorage` only, on the client. Before this touches real patients, that
  becomes a server-side record with proper consent, retention and audit.

---

*ZenHealth does not diagnose, prescribe, or replace a clinician. In an emergency, call your local
emergency number.*
