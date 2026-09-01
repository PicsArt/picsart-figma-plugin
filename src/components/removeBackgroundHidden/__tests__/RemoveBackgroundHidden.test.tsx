// @vitest-environment jsdom
//
// The regression test for the most expensive bug in this repo: RemoveBackgroundHidden
// ran its useEffect with no dependency array, so removeBackgroundApi — a billable
// call — re-fired on every render. This flow renders nothing, so a user had no way
// to see they were being charged more than once.
//
// These tests assert the guarantee, not the implementation. They pass whether the
// fix is a dependency array, a ref, or something else, and fail if any of it is
// removed.
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectionDescriptor, SelectionState } from "@app-types/messages";

const mocks = vi.hoisted(() => ({
  removeBackgroundApi: vi.fn(),
  sendMessageToSandBox: vi.fn(),
  takeImage: vi.fn(),
  applyImageToCanvas: vi.fn(),
  selection: { current: { kind: "unknown" } as SelectionState },
}));

vi.mock("@api/index", () => ({
  removeBackgroundApi: mocks.removeBackgroundApi,
  sendMessageToSandBox: mocks.sendMessageToSandBox,
}));

// This flow closes the plugin the moment it finishes, so it deliberately reports no
// balance — there is no strip left on screen to update.

// Stubbed at the hook boundary rather than the context boundary, so these tests
// describe the component's contract with useSelectedImage and stay unaffected by
// how SelectionContext talks to the sandbox.
vi.mock("@hooks/useSelectedImage", () => ({
  default: () => ({
    selection: mocks.selection.current,
    hasImage: mocks.selection.current.kind === "image",
    isUnknown: mocks.selection.current.kind === "unknown",
    descriptor: null,
    takeImage: mocks.takeImage,
  }),
  // Named export as well as the default: the component asks this for the sentence
  // that goes with a failed read.
  describeBytesFailure: () => "no image",
}));

// The placement seam. Stubbed so these tests describe what the component asks the
// sandbox to do without depending on a postMessage round trip.
vi.mock("@utils/placement", () => ({
  applyImageToCanvas: mocks.applyImageToCanvas,
}));

import RemoveBackgroundHidden from "../RemoveBackgroundHidden";

const KEY = "test-api-key";
const bytes = () => new Uint8Array([1, 2, 3, 4]);

const descriptor: SelectionDescriptor = {
  nodeId: "1:23",
  nodeType: "RECTANGLE",
  name: "Photo",
  width: 800,
  height: 600,
  hasImageFill: true,
  selectionCount: 1,
};

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("RemoveBackgroundHidden — billable call guard", () => {
  beforeEach(() => {
    mocks.removeBackgroundApi.mockReset();
    mocks.sendMessageToSandBox.mockReset();
    mocks.takeImage.mockReset();
    mocks.applyImageToCanvas.mockReset();
    mocks.selection.current = { kind: "image", descriptor };
    mocks.removeBackgroundApi.mockResolvedValue({ success: true, msg: bytes() });
    mocks.takeImage.mockResolvedValue({
      ok: true,
      nodeId: descriptor.nodeId,
      bytes: bytes(),
      width: descriptor.width,
      height: descriptor.height,
    });
    mocks.applyImageToCanvas.mockResolvedValue({ ok: true, message: "done" });
  });

  it("calls the paid API exactly once for one mount", async () => {
    render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await vi.waitFor(() => {
      expect(mocks.removeBackgroundApi).toHaveBeenCalledTimes(1);
    });
  });

  it("does not re-charge when re-rendered with the same props", async () => {
    const { rerender } = render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await vi.waitFor(() => {
      expect(mocks.removeBackgroundApi).toHaveBeenCalledTimes(1);
    });

    rerender(<RemoveBackgroundHidden gottenKey={KEY} />);
    rerender(<RemoveBackgroundHidden gottenKey={KEY} />);
    rerender(<RemoveBackgroundHidden gottenKey={KEY} />);

    await tick();
    expect(mocks.removeBackgroundApi).toHaveBeenCalledTimes(1);
  });

  it("does not re-charge when the sandbox re-posts the same selection", async () => {
    // The dependency array alone does not cover this. The selection object is a
    // fresh identity on every message from the sandbox, and selectionchange fires
    // freely, so this is the case the ref guard exists for.
    const { rerender } = render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await vi.waitFor(() => {
      expect(mocks.removeBackgroundApi).toHaveBeenCalledTimes(1);
    });

    mocks.selection.current = { kind: "image", descriptor: { ...descriptor } };
    rerender(<RemoveBackgroundHidden gottenKey={KEY} />);

    await tick();
    expect(mocks.removeBackgroundApi).toHaveBeenCalledTimes(1);
  });

  it("waits for the sandbox instead of treating the startup gap as no selection", async () => {
    // The UI mounts ~400ms before the sandbox reports the selection. Acting during
    // that window is how this flow used to decide there was nothing to work on.
    mocks.selection.current = { kind: "unknown" };
    render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await tick();
    expect(mocks.takeImage).not.toHaveBeenCalled();
    expect(mocks.removeBackgroundApi).not.toHaveBeenCalled();
  });

  it("never calls the paid API without a key", async () => {
    render(<RemoveBackgroundHidden gottenKey="" />);

    await tick();
    expect(mocks.removeBackgroundApi).not.toHaveBeenCalled();
  });

  it("closes the plugin without charging when the selection holds no image", async () => {
    mocks.takeImage.mockResolvedValue({ ok: false, reason: "no-image" });
    render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await vi.waitFor(() => {
      expect(mocks.sendMessageToSandBox).toHaveBeenCalled();
    });
    expect(mocks.removeBackgroundApi).not.toHaveBeenCalled();
  });

  it("sends the result to the node it was read from, not to the live selection", async () => {
    render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await vi.waitFor(() => {
      expect(mocks.applyImageToCanvas).toHaveBeenCalledTimes(1);
    });

    expect(mocks.applyImageToCanvas.mock.calls[0][0]).toMatchObject({
      nodeId: descriptor.nodeId,
    });
  });

  it("waits for the placement acknowledgement before closing the plugin", async () => {
    // The regression this test exists for: these two messages used to go out back to
    // back. figma.ui.onmessage is a plain callback and Figma does not await what a
    // handler returns, so the apply suspended at `await getNodeByIdAsync` and the
    // close terminated the plugin before it resumed — the user was charged and the
    // layer never changed, with no error at all.
    let releaseAck: (value: unknown) => void = () => {};
    mocks.applyImageToCanvas.mockReturnValue(
      new Promise((resolve) => {
        releaseAck = resolve;
      })
    );

    render(<RemoveBackgroundHidden gottenKey={KEY} />);

    await vi.waitFor(() => {
      expect(mocks.applyImageToCanvas).toHaveBeenCalledTimes(1);
    });

    // Placement has not acknowledged yet, so the plugin must still be open.
    const closedEarly = mocks.sendMessageToSandBox.mock.calls.some(
      (call) => call[2] === "validateclose-plugin"
    );
    expect(closedEarly).toBe(false);

    releaseAck({ ok: true, message: "done" });

    await vi.waitFor(() => {
      const closed = mocks.sendMessageToSandBox.mock.calls.some(
        (call) => call[2] === "validateclose-plugin"
      );
      expect(closed).toBe(true);
    });
  });
});
