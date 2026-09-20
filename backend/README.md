# ZenHealth agent API

Backend for the Holistic Health & Wellness Agent: deterministic symptom triage, condition-aware
nutrition, multimodal meal recognition, and RAG over a clinical corpus. FastAPI, NVIDIA NIM, no other infrastructure required to run it.

**The model never decides anything that matters.** Urgency comes from a pure function. Nutrition
verdicts come from condition rules. Anomalies come from arithmetic. The LLM writes prose, reads
photos, and breaks routing ties — nothing else.

---

## Run it

```bash
# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows PowerShell (use `py` if `python` opens the Microsoft Store)
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1

cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
python -m pip install -r requirements.txt
python -m app.rag.ingest      # build the index (optional — startup does it too)
python -m uvicorn app.main:app --reload --port 8000
pytest                        # 60+ assertions, no key needed
```

It runs **without a key**. Triage, routing, nutrition rules, anomaly detection and lexical RAG are
all local. You lose the plain-language summaries, meal photos, dense retrieval and reranking.

Interactive docs at `http://localhost:8000/docs`.

---

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/health` | Key status, resolved model ids, index mode |
| `POST` | `/api/route` | Deterministic intent classification (clinical / wellness / admin) |
| `POST` | `/api/triage` | Rule-scored urgency + grounded non-diagnostic summary + citations |
| `POST` | `/api/meal/analyse` | Meal photo → macros → per-condition verdicts |
| `POST` | `/api/rag/search` | Retrieval with scores and sources |
| `POST` | `/api/rag/reindex` | Rebuild the index after editing the corpus |
| `POST` | `/api/chat/stream` | SSE coach: red-flag screen → route → RAG → stream |
| `GET` | `/api/me` | Verify a Firebase token; returns uid, email, whether persistence is on |
| `GET` `PUT` | `/api/me/profile` | Saved conditions and display name |
| `GET` `PUT` | `/api/me/state` | The app's whole per-person record as one opaque JSON document (max ~900 KB); the client merges, the server stores it scoped to the token's uid |
| `GET` | `/api/me/triage` · `/meals` · `/chats` | Newest-first history (`?limit=`) |
| `GET` | `/api/me/chats/{chat_id}` | One saved thread with its messages |
| `DELETE` | `/api/me/data` | Erase everything stored for the signed-in user |

### SSE contract

`/api/chat/stream` emits named events so the frontend can render each one differently:

```
event: chat         {"chat_id":"..."}     # only for signed-in users; send it back to continue the thread
event: route        {"route":"wellness","confidence":0.85,"decided_by":"rule",...}
event: citations    {"retriever":"nim","hits":[{"id":"sodium-blood-pressure#0",...}]}
event: reasoning    {"text":"..."}        # only when thinking=true
event: content      {"text":"..."}        # the answer, token by token
event: done         {"reason":"complete","model_called":true}
```

---

## How the requirements map to code

**Clinical safety and escalation.** `app/safety/redflags.py` is a curated regex lexicon that runs
before any model sees the text — cardiac, stroke, breathing, bleeding, neuro, abdominal, obstetric.
`app/services/triage.py` holds five escalation rules that force the band to `immediate` regardless of
severity or duration. When the band is `immediate` the model is never called; a fixed sentence is
returned. Model output is not filtered: there is no output guardrail or guard-model pass, and
answers stream to the client exactly as generated. The prompts in `app/nim/prompts.py` still
instruct the model on scope.

**Intent routing.** `app/services/router.py` decides by precedence:
`red flag > clinical lexicon > admin > wellness > model tiebreak > clinical`. Ties break toward
clinical because under-triage is the expensive error. The model is only consulted for text that
matches no lexicon at all, and at temperature 0. `test_router.py` asserts repeatability.

**Multimodal meal recognition.** `app/services/vision.py` sends the photo to the VLM with a strict
JSON schema, then validates: plausibility bounds per field, and a macro-versus-calorie consistency
check. Vision models routinely return macros that contradict their own calorie figure; when the gap
exceeds 20% the macro-derived value wins and confidence is downgraded, because the macros are what
the condition rules consume.

**Constraint enforcement.** `app/services/nutrition.py` decides what a food means for this person —
glycaemic load for diabetes, sodium against a configurable target for hypertension, trigger tags and
fat for reflux, sodium and protein for CKD. The model is never asked for a verdict, so it cannot be
talked out of one. A 240 kcal bowl of white rice still warns for diabetes and passes for blood
pressure; that test is in `test_nutrition.py`.

**Sensor anomaly detection** now lives entirely in the browser (`frontend/src/lib/anomaly.js`), running over
readings the person logs. The backend no longer generates or streams any sample data.

**RAG.** `app/rag/` ingests markdown with frontmatter, chunks on paragraphs with overlap, embeds via
NeMo Retriever (`input_type` set correctly for queries versus passages — getting this wrong quietly
wrecks recall), stores vectors in a numpy matrix, and reranks the shortlist through `/v1/ranking`.
BM25 covers the no-key path. Retrieved passages are injected with their ids so the model can cite
them and the API can return verifiable citations. Corpus lives in `app/data/corpus/` — six
guideline-style documents; replace with your PubMed or guideline set and run `/api/rag/reindex`.

---

## About your `NimReq`

`app/nim/client.py` is that function rebuilt for a server process. Three things changed:

1. **`time.sleep()` blocks the event loop.** Under FastAPI that freezes every concurrent request,
   not just the one calling NIM. The 1.5 s pacing is now a shared async rate limiter.
2. **The streaming and non-streaming paths were tangled.** In the original, `if not stream: return
   completion.choices[0]...` sits inside `if elapsed < 1.5`, so when the call takes longer than 1.5 s
   with `stream=False`, execution falls through and returns a generator that iterates a
   non-streaming object. They are separate functions here: `complete()` and `stream()`.
3. **No retries.** NIM rate-limits, and 429 is a normal Tuesday. There is now exponential backoff on
   429 and 5xx, capped at `NIM_MAX_RETRIES`.

Also worth keeping from your version: `stream()` still separates `reasoning_content` from `content`,
but yields them as tagged tuples so the frontend can render thinking in its own panel instead of
splicing it into the answer.

---

## Deployment notes

- `NVIDIA_API_KEY` is server-side only. Nothing in this repo exposes it to a browser.
- `ALLOWED_ORIGINS` is an explicit allowlist. Never reflect the Origin header, never wildcard with
  credentials.
- Add auth in front of `/api/rag/reindex` — it costs embedding calls.
- Never log symptom text, notes, or meal photos. The error handler deliberately returns a generic
  message rather than leaking internals.
- `localStorage`-style session state does not exist here; add a real record store with consent,
  retention and audit before this touches a real patient.
- Model ids are settings, not constants. Confirm them against the live catalogue:
  `curl -s $NIM_BASE_URL/models -H "Authorization: Bearer $NVIDIA_API_KEY" | jq '.data[].id'`

## Firebase

Optional, like the NIM key. With no credentials the API behaves exactly as before: open, nothing
saved. With credentials, a signed-in user's triage results, meal analyses and chat threads are
stored in Firestore and can be read back under `/api/me/*`.

**Turn it on**

1. Firebase console → *Build → Authentication → Get started*, and enable a sign-in method.
2. *Build → Firestore Database → Create database.*
3. *Project settings → Service accounts → Generate new private key.* Save it as
   `backend/firebase-service-account.json` (already git-ignored) and set, in `.env`:

   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CREDENTIALS_PATH=firebase-service-account.json
   ```

   On hosts without a file system use `FIREBASE_CREDENTIALS_JSON` (raw JSON or base64), and on
   Google Cloud use `FIREBASE_USE_ADC=true`.
4. Lock the database to the API: `firebase deploy --only firestore:rules` publishes
   `firebase/firestore.rules`, which denies all direct client access. The Admin SDK bypasses the
   rules, so the backend is unaffected.
5. `pip install -r requirements.txt`, restart, and check `GET /api/health` → `firebase.ready: true`.

**How requests are authenticated.** Clients send the Firebase **ID token** (not the refresh token):
`Authorization: Bearer <idToken>`, from `await user.getIdToken()` on the web SDK, which refreshes it
automatically.

- `/api/triage`, `/api/meal/analyse`, `/api/chat/stream` stay open to anonymous callers. A symptom
  check never sits behind a login, and an expired or invalid token is treated as "anonymous" rather
  than an error, so it can never block an emergency screen. Signed-in callers get their history
  saved after the response is sent, so it adds no latency and a Firestore outage cannot break a reply.
- `/api/me/*` always needs a valid token (401 otherwise, 503 if Firebase is off).
- Every path is scoped by the uid inside the verified token, never a client-supplied id.
- Set `FIREBASE_CHECK_REVOKED=true` to also reject tokens revoked at sign-out (one extra call per request).

**What is stored**

```
users/{uid}                        condition_ids, display_name, updated_at
users/{uid}/triage/{auto}          request (incl. notes) + result, created_at
users/{uid}/meals/{auto}           macros, impacts, note, created_at   (never the photo)
users/{uid}/chats/{chat_id}        title, created_at, updated_at
users/{uid}/chats/{chat_id}/messages/{auto}   role, content, created_at, route, red_flag
```

This is health information. Before real patients touch it: decide retention, keep the Firebase
project in the right region, review access to the service account, and tell users what is saved.
`DELETE /api/me/data` erases everything above; deleting the Firebase Auth account itself is done
from the client SDK.

## Output limits

Every model call reads its token budget from settings (see `app/config.py`), so a limit is an
`.env` change, not a code change:

| Variable | Default | Used for |
| --- | --- | --- |
| `NIM_MAX_TOKENS_CHAT` | 4096 | streamed coach answer |
| `NIM_MAX_TOKENS_TRIAGE` | 1536 | triage summary (JSON) |
| `NIM_MAX_TOKENS_VISION` | 2048 | meal-photo estimate (JSON) |
| `NIM_MAX_TOKENS_ROUTER` | 256 | intent tiebreak (JSON) |
| `NIM_MAX_TOKENS_DEFAULT` | 4096 | any other `complete()` call |
| `NIM_REASONING_BUDGET` | 8192 | thinking tokens, **added on top of** the answer budget when Thinking is on |
| `NIM_TIMEOUT_S` | 90 | upstream read timeout; raise it further if you raise the budgets a lot |

---

*ZenHealth does not diagnose, prescribe, or replace a clinician. In an emergency, call your local
emergency number.*
