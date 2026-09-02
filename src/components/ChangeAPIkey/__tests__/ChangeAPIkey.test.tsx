// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BALANCE_UNAVAILABLE_ERR,
  KEY_SET,
  KEY_WRONG_ERR,
  TYPE_REMOVE_KEY,
  TYPE_SET_BALANCE,
  TYPE_SET_KEY,
} from "@constants/index";
import { REMOVE_KEY_BTN_TEXT, SUBMIT_KEY_BTN_TEXT } from "@ui_constants/texts";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  sendMessageToSandBox: vi.fn(),
}));

vi.mock("@api/index", () => ({
  getBalance: mocks.getBalance,
  sendMessageToSandBox: mocks.sendMessageToSandBox,
}));

import ChangeAPIkey from "../ChangeAPIkey";

const KEY = "test-api-key";

const typeKey = (value = KEY) => {
  fireEvent.change(screen.getByPlaceholderText("New API Key"), {
    target: { value },
  });
};

const submit = () => fireEvent.click(screen.getByText(SUBMIT_KEY_BTN_TEXT));

const sentWithType = (type: string) =>
  mocks.sendMessageToSandBox.mock.calls.filter((call) => call[2] === type);

beforeEach(() => {
  mocks.getBalance.mockReset();
  mocks.sendMessageToSandBox.mockReset();
});

afterEach(cleanup);

describe("ChangeAPIkey failure reporting", () => {
  it("shows the reason getBalance gave, not a wrong-key message, when the balance is unreadable", async () => {
    mocks.getBalance.mockResolvedValue({
      success: false,
      msg: BALANCE_UNAVAILABLE_ERR,
    });
    render(<ChangeAPIkey changeKey={vi.fn()} />);

    typeKey();
    await submit();

    expect(await screen.findByText(BALANCE_UNAVAILABLE_ERR)).toBeTruthy();
    expect(screen.queryByText(KEY_WRONG_ERR)).toBeNull();
    expect(sentWithType(TYPE_SET_KEY)).toHaveLength(0);
    expect(sentWithType(TYPE_SET_BALANCE)).toHaveLength(0);
  });

  it("still shows the wrong-key message when that is what getBalance decided", async () => {
    mocks.getBalance.mockResolvedValue({ success: false, msg: KEY_WRONG_ERR });
    render(<ChangeAPIkey changeKey={vi.fn()} />);

    typeKey();
    await submit();

    expect(await screen.findByText(KEY_WRONG_ERR)).toBeTruthy();
  });

  it("falls back to the wrong-key message when a failure carries no reason", async () => {
    mocks.getBalance.mockResolvedValue({ success: false, msg: undefined });
    render(<ChangeAPIkey changeKey={vi.fn()} />);

    typeKey();
    await submit();

    expect(await screen.findByText(KEY_WRONG_ERR)).toBeTruthy();
  });

  it("stores the key and the balance on success", async () => {
    mocks.getBalance.mockResolvedValue({ success: true, msg: 25 });
    const changeKey = vi.fn();
    render(<ChangeAPIkey changeKey={changeKey} />);

    typeKey();
    await submit();

    expect(await screen.findByText(KEY_SET)).toBeTruthy();
    expect(sentWithType(TYPE_SET_KEY)[0]).toEqual([true, KEY, TYPE_SET_KEY]);
    expect(sentWithType(TYPE_SET_BALANCE)[0]).toEqual([
      true,
      "25",
      TYPE_SET_BALANCE,
    ]);
    expect(changeKey).toHaveBeenCalledWith(KEY);
  });
});

describe("ChangeAPIkey remove action", () => {
  it("asks the sandbox to delete the key", () => {
    render(<ChangeAPIkey changeKey={vi.fn()} />);

    fireEvent.click(screen.getByText(REMOVE_KEY_BTN_TEXT));

    expect(sentWithType(TYPE_REMOVE_KEY)).toHaveLength(1);
  });

  it("does not clear the panel itself — the sandbox confirms the delete first", () => {
    const changeKey = vi.fn();
    render(<ChangeAPIkey changeKey={changeKey} />);

    fireEvent.click(screen.getByText(REMOVE_KEY_BTN_TEXT));

    expect(changeKey).not.toHaveBeenCalled();
  });

  it("is available with no key typed, because it acts on what is stored", () => {
    render(<ChangeAPIkey changeKey={vi.fn()} />);

    fireEvent.click(screen.getByText(REMOVE_KEY_BTN_TEXT));

    expect(sentWithType(TYPE_REMOVE_KEY)).toHaveLength(1);
  });

  it("is not offered when nothing is stored to remove", () => {
    render(<ChangeAPIkey changeKey={vi.fn()} hasStoredKey={false} />);

    expect(screen.queryByText(REMOVE_KEY_BTN_TEXT)).toBeNull();
  });

  it("still offers it when the caller says nothing, because that is the safer default", () => {
    render(<ChangeAPIkey changeKey={vi.fn()} />);

    expect(screen.queryByText(REMOVE_KEY_BTN_TEXT)).not.toBeNull();
  });
});
