import { TYPE_TAB } from "@constants/index";
import {
  activeCredential,
  armSignIn,
  postAuthState,
  postCredential,
  type ActiveCredential,
} from "@services/authSession";
import { loadExchangePage } from "@services/exchangePage";
import { deliverBalance } from "@services/balance";
import { sendImageSelectionStatus } from "@services/ImageProcessor";
import { beginUiSession, onUiReady, postToUi } from "@services/UiBridge";

export interface OpenPanelOptions {
  /** The tab the UI should render. */
  tab: string;
  /** Omit for a hidden UI — the instant-removal and support flows have no panel. */
  height?: number;
  width?: number;
  visible?: boolean;
  /** Skip for tabs with no selection-dependent UI, e.g. Support. */
  includeImageSelection?: boolean;
  /** Skip for flows that fetch the balance themselves. */
  includeBalance?: boolean;
}

/**
 * The one boot sequence, replacing five near-copies.
 *
 * `showUIForTab` in MessageListeners.ts covered three of the five controller shapes.
 * The two it could not cover were the reason: IntroController used a 300ms delay,
 * its own `figma.ui.onmessage`, and never called setMessageListeners;
 * RemoveBackgroundController called showUI twice around a key-validation promise
 * whose handler was later overwritten. UiBridge fixes the parts that made those two
 * special — the timing guess and the single-owner listener — so one helper now fits
 * all of them.
 *
 * Message-handler registration is deliberately NOT done here. This module would then
 * import MessageListeners, which needs to call openPanel to service a tab switch, and
 * the resulting import cycle resolves to undefined at module-eval time depending on
 * which side webpack reaches first. Callers register their own handlers.
 */
const openPanel = async (
  options: OpenPanelOptions,
  /**
   * Injected so the boot sequence is testable, matching the seam ImageProcessor and
   * MessageListeners already use. Defaults to the global, so no caller changes.
   * `openPanel` was the last function in the sandbox reaching for `figma` directly,
   * and it holds one of the three balance writers — the one that used to cache an
   * error string and mark the session warm at the same time.
   */
  pluginApi: PluginAPI = figma,
  /**
   * The inlined UI document, injected because `__html__` only exists inside Figma.
   *
   * Read lazily below rather than defaulted with a `typeof` guard. The guard version fell
   * back to `""` when `__html__` was not a string, which `showUI` accepts happily — it
   * opens a correctly sized, completely empty panel with nothing logged. That is
   * indistinguishable from the message-loss bug this plugin already has a history of, and
   * it would have been a fresh way to produce it. Better to throw.
   */
  html?: string
): Promise<ActiveCredential> => {
  const {
    tab,
    height,
    width,
    visible = true,
    includeImageSelection = true,
    includeBalance = true,
  } = options;

  const active = await activeCredential(pluginApi);

  // `__html__` is only evaluated when no document was injected, so a test never touches
  // it and the sandbox never silently gets an empty string.
  pluginApi.showUI(html ?? __html__, {
    visible,
    themeColors: true,
    ...(height !== undefined ? { height } : {}),
    ...(width !== undefined ? { width } : {}),
  });

  // Immediately after showUI, because showUI reloads the iframe and invalidates any
  // previous ready state.
  beginUiSession(pluginApi);

  // Queued, not delayed. These land the moment the UI reports it has mounted.
  postCredential(pluginApi, active);

  postAuthState(pluginApi);

  void armSignIn(pluginApi);

  loadExchangePage(pluginApi);

  if (includeImageSelection) {
    onUiReady(pluginApi, () => sendImageSelectionStatus(pluginApi));
  }

  postToUi(pluginApi, { type: TYPE_TAB, payload: tab });

  const credential = active.credential;

  if (includeBalance && credential) {
    void deliverBalance(pluginApi, credential);
  }

  return active;
};

export default openPanel;
