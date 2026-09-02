import { describe, expect, it } from "vitest";
import {
  NO_CREDENTIAL_IDENTITY,
  apiKeyIdentity,
  credentialIdentity,
} from "../credentialIdentity";

describe("credentialIdentity", () => {
  it("is stable for the same credential", () => {
    expect(credentialIdentity({ kind: "apikey", token: "k" })).toBe(
      credentialIdentity({ kind: "apikey", token: "k" })
    );
  });

  it("differs for different tokens", () => {
    expect(credentialIdentity({ kind: "apikey", token: "one" })).not.toBe(
      credentialIdentity({ kind: "apikey", token: "two" })
    );
  });

  it("differs across kinds even when the tokens agree", () => {
    expect(credentialIdentity({ kind: "apikey", token: "same" })).not.toBe(
      credentialIdentity({ kind: "oauth", token: "same" })
    );
  });

  it("does not contain the credential", () => {
    const key = "sk-a-real-looking-api-key-value";

    expect(credentialIdentity({ kind: "apikey", token: key })).not.toContain(key);
  });

  it("gives the keyless case a value rather than a gap", () => {
    expect(credentialIdentity()).toBe(NO_CREDENTIAL_IDENTITY);
    expect(credentialIdentity({ kind: "apikey", token: "" })).toBe(NO_CREDENTIAL_IDENTITY);
    expect(apiKeyIdentity(undefined)).toBe(NO_CREDENTIAL_IDENTITY);
    expect(apiKeyIdentity("")).toBe(NO_CREDENTIAL_IDENTITY);
  });

  it("agrees with the descriptor form for an API key", () => {
    expect(apiKeyIdentity("k")).toBe(credentialIdentity({ kind: "apikey", token: "k" }));
  });

  it("stays short regardless of how long the credential is", () => {
    const identity = apiKeyIdentity("x".repeat(4096));

    expect(identity.length).toBeLessThan(20);
  });
});
