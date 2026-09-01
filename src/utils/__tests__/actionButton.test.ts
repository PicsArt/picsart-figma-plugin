import { describe, expect, it, vi } from "vitest";
import resolveActionButton from "../actionButton";
import { BtnType } from "@app-types/enums";

/**
 * Six branches, one shared state machine, and an ordering CLAUDE.md calls load-bearing
 * — with no coverage at all. Three components carried their own copy of this chain
 * before it was extracted, so the thing worth pinning is the priority, not the return
 * values.
 */

const base = {
  isOffline: false,
  hasKey: true,
  isReady: true,
  isCreditsInsufficient: false,
  active: BtnType.UPSCALE_ACTIVE,
  noCredits: BtnType.UPSCALE_NO_CREDITS,
  disabled: BtnType.UPSCALE_DISABLED,
};

describe("resolveActionButton", () => {
  it("runs the action when everything is in place", () => {
    const onAction = vi.fn();
    const { btnType, cb } = resolveActionButton({ ...base, onAction });

    expect(btnType).toBe(BtnType.UPSCALE_ACTIVE);
    cb();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("offers credits when the only thing missing is credits", () => {
    const onAction = vi.fn();
    const { btnType } = resolveActionButton({
      ...base,
      isCreditsInsufficient: true,
      onAction,
    });

    expect(btnType).toBe(BtnType.UPSCALE_NO_CREDITS);
    // The no-credits callback opens the pricing page; it must never run the paid work.
    expect(onAction).not.toHaveBeenCalled();
  });

  it("puts NOT READY ahead of NO CREDITS", () => {
    // This is the ordering that matters. Reversed, a user who simply has not selected
    // a layer yet is told to buy credits — an answer to a question they did not ask,
    // pointing at a payment page.
    const onAction = vi.fn();
    const { btnType } = resolveActionButton({
      ...base,
      isReady: false,
      isCreditsInsufficient: true,
      onAction,
    });

    expect(btnType).toBe(BtnType.UPSCALE_DISABLED);
  });

  it("puts OFFLINE ahead of everything", () => {
    // The offline banner already explains why nothing works, so the button says
    // nothing extra — including nothing about credits.
    const { btnType } = resolveActionButton({
      ...base,
      isOffline: true,
      isReady: false,
      isCreditsInsufficient: true,
      hasKey: false,
      onAction: vi.fn(),
    });

    expect(btnType).toBe(BtnType.UPSCALE_DISABLED);
  });

  it("disables without a key", () => {
    const { btnType } = resolveActionButton({ ...base, hasKey: false, onAction: vi.fn() });
    expect(btnType).toBe(BtnType.UPSCALE_DISABLED);
  });

  it("never hands back the real action from a disabled state", () => {
    // Every disabled branch returns a no-op rather than the action, because the button
    // stays in the DOM and answers Enter.
    const onAction = vi.fn();
    const inputs = [
      { isOffline: true },
      { hasKey: false },
      { isReady: false },
    ];

    for (const override of inputs) {
      const { cb } = resolveActionButton({ ...base, ...override, onAction });
      cb();
    }

    expect(onAction).not.toHaveBeenCalled();
  });

  it("uses the caller's own button variants, so edit mode can relabel", () => {
    // Generate Image passes a different triple depending on whether a layer is
    // selected. That is how the button tells the user which endpoint their credits are
    // about to go to.
    const { btnType } = resolveActionButton({
      ...base,
      active: BtnType.EDIT_IMAGE_ACTIVE,
      noCredits: BtnType.EDIT_IMAGE_NO_CREDITS,
      disabled: BtnType.EDIT_IMAGE_DISABLED,
      onAction: vi.fn(),
    });

    expect(btnType).toBe(BtnType.EDIT_IMAGE_ACTIVE);
  });
});
