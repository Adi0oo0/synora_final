# ZenHealth

Two projects, wired together:

- **`backend/`** — the FastAPI service (your `zenhealth-backend` zip, unmodified). Deterministic
  symptom triage, condition-aware nutrition, meal-photo recognition, RAG over a clinical corpus,
  wearable anomaly detection, and a streaming chat coach. Holds the NVIDIA NIM key.
- **`frontend/`** — the React app (from `health-agent-synora`), updated to talk to `backend/`
  instead of its original Express BFF, plus a new **`/chat`** page for the streaming coach.

See `frontend/README.md` for the full architecture writeup and `backend/README.md` for how the
backend's rules, routing, and safety layers work. This file is just the two-minute version.

## Run both

```bash
# terminal 1 — backend
cd backend
# Windows PowerShell: use `py` if `python` opens the Microsoft Store
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env  # add your nvapi- key (optional — runs without one)
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# macOS/Linux
# python3 -m venv .venv
# source .venv/bin/activate
# cp .env.example .env
# python3 -m pip install -r requirements.txt
# python3 -m uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

That's it — the frontend's Vite dev server proxies `/api/*` to `http://localhost:8000` by default
(see `frontend/vite.config.js`), and the backend's default `ALLOWED_ORIGINS` already includes
`http://localhost:5173`, so CORS is already set up for this pairing. Neither side needs a key to
run: rule-based triage, nutrition scoring, routing, and red-flag screening all work offline. What
you lose without a key is model-generated prose — plain-language triage summaries, meal-photo
analysis, and the chat coach's actual replies (the chat page's routing and emergency screening still
work, since those are rule-based and happen before any model call).

## Firebase (optional)

The backend can verify Firebase sign-in tokens and keep each user's triage results, meal analyses
and chat threads in Firestore. It is off until you add credentials, so nothing above changes if you
skip it. Setup, the data layout and the auth rules are in `backend/README.md` under **Firebase**.
The frontend does not sign users in yet: until it sends `Authorization: Bearer <idToken>`, every
request is treated as anonymous and nothing is saved.

## Deploying to Vercel

Two Vercel projects from one repo: the backend (Root Directory `backend`, FastAPI is detected
from `app/main.py`) and the frontend (Root Directory `frontend`, Vite).

- **Backend env vars:** everything in `backend/.env` except the file itself: `NVIDIA_API_KEY`,
  the `NIM_*` settings, `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_JSON` (base64 of the
  service-account key: there is no file system for `FIREBASE_CREDENTIALS_PATH`), and
  `ALLOWED_ORIGINS` set to the frontend's URL.
- **Frontend env var:** `VITE_API_BASE` set to the backend's URL. It is baked in at build time.
- **Prebuilt RAG index:** run `python -m app.rag.ingest` locally (with the key set, so vectors are
  included) and commit `backend/app/data/index/`. Vercel's file system is read-only, so the index
  cannot be built or saved at runtime.
- On Vercel, Firestore history is written before the response is sent (`VERCEL` is detected
  automatically) because the instance can be frozen right after responding.

## What changed in the frontend to make this work

| Area | Before | Now |
| --- | --- | --- |
| API target | `server/` — a small Express BFF on `:8787` | proxies straight to `backend/` on `:8000` |
| `src/lib/api.js` | called `/api/triage/explain`, `/api/route` with camelCase fields | calls the backend's actual routes/fields (`condition_ids`, full `/api/triage`, mapped meal macros), plus a new `streamChat()` SSE client |
| Chat | did not exist | new `/chat` page: streams from `POST /api/chat/stream`, renders routing/citations/reasoning as they arrive, opens the existing emergency dialog if the backend flags a red flag mid-conversation |
| `server/` (Express BFF) | present | removed — superseded by `backend/` |

Full details, including the exact event contract the chat page consumes, are in
`frontend/README.md` under **Architecture**.

## Known pre-existing issue (not introduced by this integration)

`frontend`'s Vitest suite has one pre-existing, unrelated failure — `anomaly.test.js` /
"catches a sustained rise" — in `src/lib/anomaly.js`, the client-side wearable-anomaly detector.
It predates this integration (that file and its test were untouched here) and is worth a look
separately; everything else (11 triage tests, 10 nutrition tests, the backend's full 68-assertion
pytest suite) passes.

---

*ZenHealth does not diagnose, prescribe, or replace a clinician. In an emergency, call your local
emergency number.*
