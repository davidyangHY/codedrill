// Bridges the streaming AI IPC into per-request callbacks.
// window.api.ai.chat(messages) returns a requestId; chunks arrive globally
// and we dispatch them to the handler registered for that id.

const handlers = new Map();
let initialized = false;

function ensureInit() {
  if (initialized) return;
  if (!window.api || !window.api.ai) return;
  initialized = true;

  window.api.ai.onChunk(({ requestId, delta }) => {
    const h = handlers.get(requestId);
    if (h && h.onDelta) h.onDelta(delta);
  });

  window.api.ai.onDone(({ requestId, full }) => {
    const h = handlers.get(requestId);
    handlers.delete(requestId);
    if (h && h.onDone) h.onDone(full);
  });

  window.api.ai.onError(({ requestId, message, code }) => {
    const h = handlers.get(requestId);
    handlers.delete(requestId);
    if (h && h.onError) h.onError(message, code);
  });
}

/**
 * Send one tutor turn. Conversation memory lives in the main process (the Agent
 * SDK session is resumed each turn), so we only send this turn's text.
 * @param {string} text - the user's message for this turn.
 * @param {{onDelta?, onDone?, onError?}} cbs
 * @param {{reset?: boolean}} opts - reset drops prior context (new session).
 * @returns {{ requestId: string, cancel: () => void }}
 */
export function streamChat(text, cbs = {}, opts = {}) {
  ensureInit();
  const requestId = window.api.ai.chat(text, opts.reset, opts.ephemeral);
  handlers.set(requestId, cbs);
  return {
    requestId,
    cancel: () => {
      window.api.ai.cancel(requestId);
      handlers.delete(requestId);
    },
  };
}
