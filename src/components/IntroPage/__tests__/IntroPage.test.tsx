// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BALANCE_UNAVAILABLE_ERR, TYPE_SET_BALANCE, TYPE_SET_KEY } from "@constants/index";
import { CONTINUE_BTN_TEXT } from "@ui_constants/texts";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  sendMessageToSandBox: vi.fn(),
}));

vi.mock("@api/index", () => ({
  getBalance: mocks.getBalance,
  sendMessageToSandBox: mocks.sendMessageToSandBox,
}));

vi.mock("../../../context/ActiveContext", () => ({
  useActive: () => ({ isActive: true, setIsActive: vi.fn() }),
}));

import IntroPage from "../IntroPage";

const KEY = "test-api-key";

const input = () => screen.getByPlaceholderText("API Key");
const cta = () => screen.getByText(CONTINUE_BTN_TEXT);
const typeKey = (value = KEY) =>
  fireEvent.change(input(), { target: { value } });
const sentWithType = (type: string) =>
  mocks.sendMessageToSandBox.mock.calls.filter((call) => call[2] === type);

beforeEach(() => {
  mocks.getBalance.mockReset();
  mocks.getBalance.mockResolvedValue({ success: true, msg: 25 });
  mocks.sendMessageToSandBox.mockReset();
});

afterEach(cleanup);

describe("IntroPage submission", () => {
  it("submits on Enter in the input", async () => {
    render(<IntroPage />);
    typeKey();

    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter" });
    });

    expect(sentWithType(TYPE_SET_KEY)[0]).toEqual([true, KEY, TYPE_SET_KEY]);
    expect(sentWithType(TYPE_SET_BALANCE)[0]).toEqual([true, "25", TYPE_SET_BALANCE]);
  });

  it("submits on the button", async () => {
    render(<IntroPage />);
    typeKey();

    await act(async () => {
      fireEvent.click(cta());
    });

    expect(sentWithType(TYPE_SET_KEY)).toHaveLength(1);
  });

  it("shows the reason a failed check gave", async () => {
    mocks.getBalance.mockResolvedValue({
      success: false,
      msg: BALANCE_UNAVAILABLE_ERR,
    });
    render(<IntroPage />);
    typeKey();

    await act(async () => {
      fireEvent.click(cta());
    });

    expect(screen.getByText(BALANCE_UNAVAILABLE_ERR)).toBeTruthy();
    expect(sentWithType(TYPE_SET_BALANCE)).toHaveLength(0);
  });

  it("does not run a second check while the first is in flight", async () => {
    let release: (v: unknown) => void = () => undefined;
    mocks.getBalance.mockReturnValue(new Promise((resolve) => (release = resolve)));
    render(<IntroPage />);
    typeKey();

    fireEvent.click(cta());
    fireEvent.click(cta());
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(mocks.getBalance).toHaveBeenCalledTimes(1);

    await act(async () => release({ success: true, msg: 25 }));
  });
});

describe("IntroPage disabled CTA", () => {
  it("is inert with an empty input, and says so", () => {
    render(<IntroPage />);

    const button = cta().closest('[role="button"]')!;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("tabindex")).toBe("-1");
  });

  it("does nothing when clicked with an empty input", async () => {
    render(<IntroPage />);

    await act(async () => {
      fireEvent.click(cta());
    });

    expect(mocks.getBalance).not.toHaveBeenCalled();
  });

  it("does nothing on Enter with an empty input either", async () => {
    render(<IntroPage />);

    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter" });
    });

    expect(mocks.getBalance).not.toHaveBeenCalled();
  });

  it("becomes active once a key is typed, and enters the tab order", () => {
    render(<IntroPage />);
    typeKey();

    const button = cta().closest('[role="button"]')!;
    expect(button.getAttribute("aria-disabled")).toBeNull();
    expect(button.getAttribute("tabindex")).toBe("0");
  });

  it("keeps the input in the tab order at 0", () => {
    render(<IntroPage />);
    expect(input().getAttribute("tabindex")).toBe("0");
  });
});
