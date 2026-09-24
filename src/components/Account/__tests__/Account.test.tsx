// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialDescriptor } from "@app-types/credential";
import {
  REMOVE_KEY_BTN_TEXT,
  SIGN_IN_BTN_TEXT,
  SIGN_OUT_BTN_TEXT,
  SUBMIT_KEY_BTN_TEXT,
} from "@ui_constants/texts";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  refreshBalance: vi.fn(),
  sendMessageToSandBox: vi.fn(),
}));

vi.mock("@api/index", () => ({
  getBalance: mocks.getBalance,
  refreshBalance: mocks.refreshBalance,
  sendMessageToSandBox: mocks.sendMessageToSandBox,
}));

import { BalanceProvider } from "../../../context/BalanceContext";
import Account from "../Account";

const OAUTH: CredentialDescriptor = { kind: "oauth", token: "access-token" };
const API_KEY: CredentialDescriptor = { kind: "apikey", token: "a-key" };

const show = (credential: CredentialDescriptor, apiKey: string) =>
  render(
    <BalanceProvider>
      <Account
        credential={credential}
        apiKey={apiKey}
        setIsCreditsInsufficient={vi.fn()}
        onSignIn={vi.fn()}
        changeKey={vi.fn()}
      />
    </BalanceProvider>
  );

beforeEach(() => {
  mocks.getBalance.mockReset();
  mocks.refreshBalance.mockReset().mockResolvedValue(undefined);
  mocks.sendMessageToSandBox.mockReset();
});

afterEach(cleanup);

describe("Account carries the API-key form", () => {
  it("renders the key input and submit for an API-key user", () => {
    show(API_KEY, "a-key");

    expect(screen.queryByPlaceholderText("New API Key")).not.toBeNull();
    expect(screen.queryByText(SUBMIT_KEY_BTN_TEXT)).not.toBeNull();
  });

  it("renders it for a signed-in user too, which is their only route to a key", () => {
    show(OAUTH, "");

    expect(screen.queryByPlaceholderText("New API Key")).not.toBeNull();
  });

  it("offers Remove API key only when one is actually stored", () => {
    show(OAUTH, "");
    expect(screen.queryByText(REMOVE_KEY_BTN_TEXT)).toBeNull();

    cleanup();

    show(OAUTH, "a-retained-key");
    expect(screen.queryByText(REMOVE_KEY_BTN_TEXT)).not.toBeNull();
  });
});

describe("Account sign-in controls", () => {
  it("offers sign-out to a signed-in user and sign-in to a key user", () => {
    show(OAUTH, "");
    expect(screen.queryByText(SIGN_OUT_BTN_TEXT)).not.toBeNull();
    expect(screen.queryByText(SIGN_IN_BTN_TEXT)).toBeNull();

    cleanup();

    show(API_KEY, "a-key");
    expect(screen.queryByText(SIGN_IN_BTN_TEXT)).not.toBeNull();
    expect(screen.queryByText(SIGN_OUT_BTN_TEXT)).toBeNull();
  });
});
