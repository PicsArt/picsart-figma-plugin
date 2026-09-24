import { describe, expect, it, vi } from "vitest";
import { API_KEY_NAME } from "../../constants/index";
import { readApiKey } from "../apiKeyStorage";
import { makeFigmaStub } from "./figmaStub";

const KEY = "test-api-key";

describe("readApiKey", () => {
  it("returns the stored key", async () => {
    const { api } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });
    await expect(readApiKey(api)).resolves.toBe(KEY);
  });

  it("returns undefined when nothing is stored", async () => {
    const { api } = makeFigmaStub({ clientStorage: {} });
    await expect(readApiKey(api)).resolves.toBeUndefined();
  });

  it("resolves rather than rejecting when the read fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { api } = makeFigmaStub({ storageFails: { get: true } });

    await expect(readApiKey(api)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("refuses an empty string, which is not a key", async () => {
    const { api } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: "" } });
    await expect(readApiKey(api)).resolves.toBeUndefined();
  });

  it("refuses a non-string, because clientStorage is untyped", async () => {
    const { api } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: 42 } });
    await expect(readApiKey(api)).resolves.toBeUndefined();
  });
});
