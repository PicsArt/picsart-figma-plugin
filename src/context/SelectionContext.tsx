import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  TYPE_IMAGE_SELECTED,
  TYPE_IMAGE_BYTES_RESULT,
  TYPE_REQUEST_IMAGE_BYTES,
} from "@constants/types";
import { sendMessageToSandBox } from "@api/index";
import type { BytesResult, SelectionDescriptor, SelectionState } from "@app-types/messages";

/**
 * The one place selection state lives.
 *
 * It used to be re-derived in three places from the byte length of a Uint8Array
 * held in App state, which meant "is an image selected" and "what was the last
 * result" were the same variable. Matches the shape of the two contexts already
 * in this repo (BalanceContext, ActiveContext).
 */
interface ISelection {
  selection: SelectionState;
  /**
   * Reads the bytes of a node on demand, saying why when it cannot. The reason
   * matters: "the layer was deleted", "that layer holds no image" and "no reply
   * arrived" all used to come back as the same bare null, so every caller showed
   * one generic message for three different situations.
   */
  requestBytes: (nodeId: string) => Promise<BytesResult>;
}

const SelectionContext: React.Context<ISelection> = createContext<ISelection>({
  selection: { kind: "unknown" },
  requestBytes: async () => ({ ok: false, reason: "timeout" }),
});

// A request that gets no answer at all should give up rather than leave the button
// spinning forever. The sandbox queues its reply until the iframe reports ready, so
// this only fires when something genuinely went wrong on the other side.
const BYTES_REQUEST_TIMEOUT_MS = 15000;

const toSelectionState = (descriptor: SelectionDescriptor | null): SelectionState => {
  if (!descriptor) return { kind: "none" };
  return descriptor.hasImageFill
    ? { kind: "image", descriptor }
    : { kind: "no-image", descriptor };
};

export const SelectionProvider = ({ children }: { children: ReactNode }) => {
  // Starts as "unknown", not "none". The UI mounts before the sandbox has said
  // anything, and claiming nothing is selected during that gap is what made the
  // banner lie on every single launch.
  const [selection, setSelection] = useState<SelectionState>({ kind: "unknown" });

  const pending = useRef<Map<string, (result: BytesResult) => void>>(new Map());
  const nextRequestId = useRef(0);

  useEffect(() => {
    const handler = ({ data: { pluginMessage } }: MessageEvent) => {
      if (!pluginMessage) return;

      if (pluginMessage.type === TYPE_IMAGE_SELECTED) {
        setSelection(toSelectionState(pluginMessage.payload ?? null));
        return;
      }

      if (pluginMessage.type === TYPE_IMAGE_BYTES_RESULT) {
        const resolve = pending.current.get(pluginMessage.requestId);
        if (!resolve) return;
        pending.current.delete(pluginMessage.requestId);
        // The sandbox posts a plain object across postMessage, so what arrives is
        // array-like rather than a Uint8Array instance.
        const raw = pluginMessage.bytes;
        resolve(
          raw
            ? { ok: true, bytes: new Uint8Array(raw) }
            : {
                ok: false,
                reason: pluginMessage.reason ?? "read-failed",
                error: pluginMessage.error,
              }
        );
      }
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      pending.current.clear();
    };
  }, []);

  const requestBytes = useCallback((nodeId: string): Promise<BytesResult> => {
    const requestId = `bytes-${++nextRequestId.current}`;

    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (result: BytesResult) => {
        if (settled) return;
        settled = true;
        // Cleared on the answer as well as on the timeout. The timer used to be
        // left running after a reply arrived, so every byte read kept a pending
        // task alive for 15 seconds after it had finished.
        if (timer !== null) clearTimeout(timer);
        pending.current.delete(requestId);
        resolve(result);
      };

      pending.current.set(requestId, settle);
      timer = setTimeout(() => settle({ ok: false, reason: "timeout" }), BYTES_REQUEST_TIMEOUT_MS);

      sendMessageToSandBox(true, "", TYPE_REQUEST_IMAGE_BYTES, undefined, {
        nodeId,
        requestId,
      });
    });
  }, []);

  return (
    <SelectionContext.Provider value={{ selection, requestBytes }}>
      {children}
    </SelectionContext.Provider>
  );
};

export const useSelection = () => {
  const context: ISelection = useContext<ISelection>(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
};
