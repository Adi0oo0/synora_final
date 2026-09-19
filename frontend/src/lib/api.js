/**
 * Browser-side API client.
 *
 * Every model call goes to our own backend at /api/* — the FastAPI service in
 * ../zenhealth-backend (see vite.config.js for the dev proxy target). The
 * nvapi key never reaches the browser. If the backend is not running, each
 * helper degrades to the local deterministic engine so the app is still
 * usable offline — a demo that dies without a key is not a demo.
 */

const TIMEOUT_MS = 20000;

// Empty in dev: Vite proxies /api/* to the backend. In production (Vercel) set
// VITE_API_BASE to the backend's origin, e.g. https://synora-api.vercel.app
const API_BASE = (import.meta.env?.VITE_API_BASE ?? '').replace(/\/+$/, '');

async function request(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${res.status} ${detail.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const post = (path, body) => request(path, { method: 'POST', body });
const get = (path) => request(path);

/** Backend Macro shape (kcal, carbs_g, protein_g, ...) → the flat shape the
 * rest of the app (lib/nutrition.js, data/foods.js) already reads. */
function mapMacro(m) {
  if (!m) return null;
  return {
    name: m.name,
    portion: m.portion,
    items: m.items ?? [],
    kcal: m.kcal,
    carbs: m.carbs_g,
    protein: m.protein_g,
    fat: m.fat_g,
    fibre: m.fibre_g,
    sodium: m.sodium_mg,
    gi: m.glycemic_index,
    tags: m.tags ?? [],
    confidence: m.confidence,
  };
}

/**
 * Runs the full rule-scored triage on the server (same rules as
 * lib/triage.js, plus a grounded plain-language summary and citations when a
 * model is configured). The client's local scoreTriage() already gave the
 * person an instant band; this call enriches it rather than gates on it.
 */
export async function explainTriage({ region, symptoms, triggers, severity, duration, notes, conditionIds }) {
  try {
    const data = await post('/api/triage', {
      region,
      symptoms,
      triggers,
      severity,
      duration,
      notes: (notes || '').slice(0, 800),
      condition_ids: conditionIds,
      explain: true,
    });
    return { ok: true, source: 'nim', ...data };
  } catch (error) {
    return { ok: false, source: 'local', error: String(error.message || error) };
  }
}

/** Sends a meal photo to the vision model and expects strict JSON back. */
export async function analyseMealPhoto(dataUrl, conditionIds) {
  try {
    const data = await post('/api/meal/analyse', {
      image: dataUrl,
      condition_ids: conditionIds,
    });
    const food = mapMacro(data.food);
    return {
      ok: true,
      source: 'nim',
      food,
      confidence: food?.confidence,
      impacts: data.impacts,
      overall: data.overall,
      disclaimer: data.disclaimer,
    };
  } catch (error) {
    return { ok: false, source: 'local', error: String(error.message || error) };
  }
}

/** Deterministic intent classification (clinical / wellness / admin). */
export async function classifyIntent(text) {
  try {
    const data = await post('/api/route', { text });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  }
}

/** Retrieval over the clinical corpus, with scores and sources. */
export async function searchLibrary(query, topK = 4) {
  try {
    const data = await post('/api/rag/search', { query, top_k: topK });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, hits: [], error: String(error.message || error) };
  }
}

export async function health() {
  try {
    const data = await get('/api/health');
    return { ok: true, configured: data.nim_configured, ...data };
  } catch {
    return { ok: false, configured: false, models: null };
  }
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Streams a coaching reply from POST /api/chat/stream. EventSource can't send
 * a POST body, so this reads the SSE frames off a fetch() stream by hand.
 * Each backend event (`route`, `citations`, `reasoning`, `content`,
 * `done`, `error`) is dispatched to the matching handler.
 *
 * Returns an { abort() } handle so the caller can cancel mid-stream.
 */
export function streamChat({ messages, conditionIds = [], thinking = false, useRag = true }, handlers = {}) {
  const controller = new AbortController();
  const { onRoute, onCitations, onReasoning, onContent, onDone, onError } = handlers;

  (async () => {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          condition_ids: conditionIds,
          thinking,
          use_rag: useRag,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name !== 'AbortError') onError?.(String(error.message || error));
      return;
    }

    if (!res.ok || !res.body) {
      const detail = await res.text?.().catch(() => '') ?? '';
      onError?.(`${res.status} ${detail.slice(0, 200)}`.trim());
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    
    const dispatch = (frame) => {
      let event = 'message';
      const dataLines = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (!dataLines.length) return;
    
      let payload;
      try { payload = JSON.parse(dataLines.join('\n')); } catch { return; }
    
      switch (event) {
        case 'route': onRoute?.(payload); break;
        case 'citations': onCitations?.(payload); break;
        case 'reasoning': onReasoning?.(payload.text); break;
        case 'content': onContent?.(payload.text); break;
        case 'done': finished = true; onDone?.(payload); break;
        case 'error': finished = true; onError?.(payload.message || 'Model call failed.'); break;
        default: break;
      }
    };
    
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        // Normalise CRLF so both "\n\n" and "\r\n\r\n" frame breaks work.
        buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
    
        let split;
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          dispatch(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
        }
      }
      if (buffer.trim()) dispatch(buffer);   // flush a trailing frame
      if (!finished) onDone?.({});           // stream closed without "done"
    } catch (error) {
      if (error.name !== 'AbortError') onError?.(String(error.message || error));
    }
    })();

  return { abort: () => controller.abort() };
}
