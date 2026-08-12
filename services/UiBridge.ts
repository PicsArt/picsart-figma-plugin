import { TYPE_UI_READY } from "@constants/index";

/**
 * The sandbox side of the postMessage seam: one message queue, one onmessage owner.
 *
 * Two problems this replaces.
 *
 * **The timing guess.** Every controller wrapped its first postMessage in
 * `setTimeout(..., 400)` — IntroController used 300 — to wait for the iframe to
 * finish rendering. CLAUDE.md names that handshake as the recurring cause of lost
 * messages, and it is a guess either way: too short and the message is dropped
 * silently, too long and the panel sits blank. Messages are now queued until the UI
 * says it has mounted.
 *
 * The old timeout is kept as a fallback flush. If TYPE_UI_READY never arrives —
 * an older UI bundle, a mount that throws — the queue drains anyway at the same
 * moment it would have been sent before. This can only behave better than what it
 * replaces, never worse.
 *
 * **The overwritten listener.** `figma.ui.onmessage` is a single assignable slot,
 * and IntroController and RemoveBackgroundController each assigned their own,
 * clobbering whatever was there. RemoveBackgroundController's key-validation
 * handler was itself later overwritten by setMessageListeners. Handlers register
 * here instead, and every registered handler sees every message.
 */

type PluginMessage = { type?: string; [key: string]: unknown };
type MessageHandler = (message: PluginMessage) => void | Promise<void>;

// Matches the delay the controllers used, so the fallback path reproduces the old
// behaviour exactly rather than introducing a new number.
const READY_FALLBACK_MS = 400;

let uiReady = false;
let queue: PluginMessage[] = [];
let readyCallbacks: (() => void)[] = [];
let handlers: MessageHandler[] = [];
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let installedOn: PluginAPI | null = null;

/**
 * The boot burst, kept so it can be delivered again.
 *
 * **A launch creates more than one iframe.** `src/code.ts` shows a hidden UI, and then a
 * controller shows the real panel — and `RemoveBackgroundController` shows its own hidden
 * one in between to run the key check. Each `showUI` replaces the iframe, but the one it
 * replaced is still alive long enough to finish mounting and post its own
 * `TYPE_UI_READY`.
 *
 * If that late arrival lands after the *next* session has begun, the queue drains into an
 * iframe that has not attached its listener yet. The messages are gone, `uiReady` is now
 * true, and when the real panel finally announces itself there is nothing left to send it:
 * **a blank panel, forever, with no error anywhere.** That is the exact failure this file
 * exists to prevent, arriving by a different route.
 *
 * So the boot burst is retained and re-sent to any later `TYPE_UI_READY` in the same
 * session. Every message in it is idempotent state — the key, the tab, the balance, the
 * selection descriptor — so a second delivery costs nothing and the UI simply sets the
 * same values again.
 *
 * Only the burst is retained, not the whole session: messages posted after the UI is
 * listening go straight out and are never replayed, so a stale ready cannot resurrect an
 * old byte-read reply or placement acknowledgement.
 */
let bootPayload: PluginMessage[] = [];
/** True only while `flush` is running, so callback output joins the retained burst. */
let capturingBoot = false;

const flush = (pluginApi: PluginAPI) => {
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  uiReady = true;

  const pending = queue;
  queue = [];
  bootPayload = pending.slice();

  // Anything an onUiReady callback posts is part of the burst too — that is how the
  // selection descriptor gets sent, and it would otherwise be the one boot message that
  // could not be re-delivered.
  capturingBoot = true;
  try {
    pending.forEach((message) => pluginApi.ui.postMessage(message));

    const callbacks = readyCallbacks;
    readyCallbacks = [];
    callbacks.forEach((cb) => cb());
  } finally {
    capturingBoot = false;
  }
};

/**
 * Send the boot burst again, for an iframe that announced itself after an earlier one
 * had already drained the queue.
 *
 * The callbacks are deliberately NOT re-run: their output is already in the burst, and
 * re-running them would repeat their side effects.
 */
const redeliver = (pluginApi: PluginAPI) => {
  if (bootPayload.length === 0) return;
  console.warn(
    `A second UI reported ready in the same session; re-sending ${bootPayload.length} boot message(s). ` +
      `A launch creates more than one iframe, and the first one's ready signal can drain the queue into the second before it is listening.`
  );
  bootPayload.forEach((message) => pluginApi.ui.postMessage(message));
};

/**
 * Install the single onmessage dispatcher. Idempotent per PluginAPI, so controllers
 * can call it without tracking whether someone else already did.
 */
const install = (pluginApi: PluginAPI) => {
  if (installedOn === pluginApi) return;
  installedOn = pluginApi;

  pluginApi.ui.onmessage = async (message: PluginMessage) => {
    if (message && message.type === TYPE_UI_READY) {
      // Already flushed means a previous iframe announced itself and took the queue
      // with it. Send the burst again rather than leaving this one with nothing.
      if (uiReady) redeliver(pluginApi);
      else flush(pluginApi);
      return;
    }
    // A copy, so a handler that registers another handler mid-dispatch cannot
    // mutate the list being iterated.
    for (const handler of handlers.slice()) {
      await handler(message);
    }
  };
};

/**
 * Call immediately after every `figma.showUI`. showUI reloads the iframe, so the UI
 * that was ready a moment ago no longer is — a tab switch re-shows the UI and the
 * React app mounts again from scratch.
 */
export const beginUiSession = (pluginApi: PluginAPI) => {
  install(pluginApi);
  uiReady = false;
  queue = [];
  readyCallbacks = [];
  // A new session's burst has not been built yet, so the previous one must not be
  // replayed into it — its tab and balance are stale by definition.
  bootPayload = [];

  if (fallbackTimer !== null) clearTimeout(fallbackTimer);
  fallbackTimer = setTimeout(() => {
    // The UI never announced itself. Send anyway, on the schedule the old code used.
    console.warn(
      `UI did not report ready within ${READY_FALLBACK_MS}ms; flushing queued messages on the fallback timer.`
    );
    flush(pluginApi);
  }, READY_FALLBACK_MS);
};

/** Post to the UI now if it is listening, or as soon as it is. Order is preserved. */
export const postToUi = (pluginApi: PluginAPI, message: PluginMessage) => {
  if (uiReady) {
    if (capturingBoot) bootPayload.push(message);
    pluginApi.ui.postMessage(message);
    return;
  }
  queue.push(message);
};

/** Run work once the UI is listening — for anything that is not just a postMessage. */
export const onUiReady = (pluginApi: PluginAPI, callback: () => void) => {
  install(pluginApi);
  if (uiReady) {
    callback();
    return;
  }
  readyCallbacks.push(callback);
};

/** Register a handler for UI -> sandbox messages. Never replaces an existing one. */
export const addUiMessageHandler = (pluginApi: PluginAPI, handler: MessageHandler) => {
  install(pluginApi);
  if (handlers.indexOf(handler) === -1) {
    handlers.push(handler);
  }
};

export const removeUiMessageHandler = (handler: MessageHandler) => {
  handlers = handlers.filter((existing) => existing !== handler);
};

/** Test seam: drop all module state between cases. */
export const resetUiBridge = () => {
  if (fallbackTimer !== null) clearTimeout(fallbackTimer);
  fallbackTimer = null;
  uiReady = false;
  queue = [];
  readyCallbacks = [];
  bootPayload = [];
  capturingBoot = false;
  handlers = [];
  installedOn = null;
};

export const isUiReady = () => uiReady;
