// @vitest-environment jsdom
//
// The panel's pinned chrome, asserted as DOM structure.
//
// `.scrollable-content` is `overflow-y: auto`, so anything rendered inside it
// scrolls away when the content is taller than the window — and Figma clamps the
// window to the screen, so on a short display that is every panel. Two elements
// must never be in there: the tab row, because a user who scrolls to reach a
// control should not lose the way back to another tab, and the footer host,
// because it holds the one button the panel exists for.
//
// The footer was moved out once already (a `flex-shrink: 0` inside an
// `overflow-y: auto` box pins nothing) and the navbar was left behind, where it
// did something worse than scroll: as a flex item with the default
// `flex-shrink: 1` it compressed from 32px to 14px first, silently absorbing the
// first 18px of every overflow, so a panel that was already too short showed no
// symptom until it was 18px past too short.
//
// Heights themselves are not testable here — jsdom computes no layout. They are
// measured by loading dist/ui.html in headless Chromium; see the note in
// constants/env.ts.
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TYPE_KEY } from "@constants/types";

const mocks = vi.hoisted(() => ({
  sendMessageToSandBox: vi.fn(),
  getBalance: vi.fn(async () => ({ success: true, msg: 100 })),
}));

vi.mock("@api/index", () => ({
  sendMessageToSandBox: mocks.sendMessageToSandBox,
  getBalance: mocks.getBalance,
}));
// ui.tsx imports these from "./api" rather than the alias.
vi.mock("../api", () => ({
  sendMessageToSandBox: mocks.sendMessageToSandBox,
  getBalance: mocks.getBalance,
}));

vi.mock("@hooks/useOffline", () => ({ default: () => false }));

// Stand-ins for the tab bodies: this test is about where ui.tsx puts the panel
// chrome, not about what any one tab renders. PANEL_FOOTER_ID stays the real
// value so the id ui.tsx renders is the id PanelFooter portals into.
vi.mock("@components/index", () => ({
  PANEL_FOOTER_ID: "panel-footer",
  Navbar: () => <div data-testid="navbar" className="navbar-container" />,
  Account: () => <div />,
  BalanceBanner: () => <div data-testid="balance-banner" />,
  ChangeAPIkey: () => <div />,
  IntroPage: () => <div data-testid="intro" />,
  RemoveBackground: () => <div />,
  RemoveBackgroundHidden: () => <div />,
  Support: () => <div />,
  Upscale: () => <div />,
  GenerateImage: () => <div data-testid="tab-body" />,
  OfflineBanner: () => <div />,
}));

import { App } from "../ui";

const authenticate = () =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { pluginMessage: { type: TYPE_KEY, payload: "test-key" } },
      })
    );
  });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("panel chrome placement", () => {
  it("keeps the tab row out of the scroller", () => {
    const { container } = render(<App />);
    authenticate();

    const scroller = container.querySelector(".scrollable-content");
    const navbar = container.querySelector('[data-testid="navbar"]');

    expect(scroller).not.toBeNull();
    expect(navbar).not.toBeNull();
    // The assertion that fails on the regression: the navbar rendered as a child
    // of the scroller, so it scrolled out of view and squashed under pressure.
    expect(scroller!.contains(navbar!)).toBe(false);
  });

  it("keeps the footer host out of the scroller", () => {
    const { container } = render(<App />);
    authenticate();

    const scroller = container.querySelector(".scrollable-content");
    const footer = container.querySelector("#panel-footer");

    expect(footer).not.toBeNull();
    expect(scroller!.contains(footer!)).toBe(false);
  });

  it("orders the chrome tabs, then scroller, then footer, then credits", () => {
    const { container } = render(<App />);
    authenticate();

    const main = container.querySelector(".main-content")!;
    const order = Array.from(main.children).map((el) =>
      el.classList.contains("navbar-container")
        ? "navbar"
        : el.classList.contains("scrollable-content")
          ? "scroller"
          : el.id === "panel-footer"
            ? "footer"
            : el.classList.contains("bottom-banner")
              ? "credits"
              : "other"
    );

    // The credits strip is context for the spend and the button is the spend, so
    // the button stays the last thing before it.
    expect(order).toEqual(["navbar", "scroller", "footer", "credits"]);
  });

  it("renders no chrome around the intro page when there is no key", () => {
    const { container } = render(<App />);

    // A keyless user has no tabs to switch between and no action to pin, so the
    // panel is the intro page and nothing else.
    expect(container.querySelector('[data-testid="navbar"]')).toBeNull();
    expect(container.querySelector("#panel-footer")).toBeNull();
    expect(container.querySelector('[data-testid="intro"]')).not.toBeNull();
  });
});
