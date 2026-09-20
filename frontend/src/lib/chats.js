import { makeId } from './storage.js';

// Chat threads are kept apart from the health state: they are larger and only
// the chat page reads them. Same rule as the rest: one key per person.
const key = (uid) => `zenhealth.chats.v1.${uid || 'guest'}`;
export const MAX_CHATS = 30;
export const MAX_MESSAGES = 100;

// The backend only accepts thread ids of 8 to 64 letters, digits, _ and -.
export const newChatId = () => makeId('chat');

export function readChats(uid, storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(key(uid)) || '[]');
    return Array.isArray(raw) ? raw.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages)) : [];
  } catch {
    return [];
  }
}

export function writeChats(uid, chats, storage = globalThis.localStorage) {
  const trimmed = [...chats]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_CHATS)
    .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES).map((m) => { const c = { ...m }; delete c.pending; return c; }) }));
  try {
    storage.setItem(key(uid), JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function clearChats(uid, storage = globalThis.localStorage) {
  try {
    storage.removeItem(key(uid));
  } catch {
    /* nothing to clear */
  }
}

export const titleFrom = (text) => {
  const one = String(text || '').replace(/\s+/g, ' ').trim();
  return one.length > 60 ? `${one.slice(0, 57)}...` : one || 'New chat';
};
