import { beforeEach, describe, expect, it } from "vitest";
import { rememberBalance } from "../balance";
import CustomSessionStorage from "../CustomSessionStorage";
import { apiKeyIdentity } from "../credentialIdentity";

/**
 * One guard, three writers. This check existed in exactly one of the three places that
 * cache the credit balance — `MessageListeners` had it with a comment explaining the
 * poisoning; `openPanel` and `IntroController` cast whatever arrived to `number`.
 *
 * What a rejected value costs: the balance crosses postMessage as a string, nothing
 * re-fetches it within a session, and `payload <= 0` on a string is `false` — so a
 * cached error message leaves every paid button enabled against a balance nobody read.
 */

const cache = () => CustomSessionStorage.getInstance();

const IDENTITY = apiKeyIdentity("test-api-key");
const cached = () => cache().balanceFor(IDENTITY);

describe("rememberBalance", () => {
  beforeEach(() => cache().setBalance(17, IDENTITY));

  it.each([
    ["a number", 42, 42],
    ["a numeric string, which is how it crosses postMessage", "42", 42],
    ["zero, which is a real balance", 0, 0],
    ["a decimal", "12.5", 12.5],
  ])("accepts %s", (_label, input, expected) => {
    expect(rememberBalance(input, IDENTITY)).toBe(true);
    expect(cached()).toBe(expected);
  });

  it.each([
    ["undefined, from a failed fetch", undefined],
    ["null", null],
    ["an empty string", ""],
    ["an error message", "API key is wrong"],
    ["the string 'undefined'", "undefined"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["a boolean", true],
    ["an object", { credits: 5 }],
    ["an array", []],
  ])("refuses %s and leaves the cache alone", (_label, input) => {
    expect(rememberBalance(input, IDENTITY)).toBe(false);
    expect(cached()).toBe(17);
  });

  it("refuses an empty array rather than reading it as zero credits", () => {
    // Number([]) is 0, so an unguarded cast would tell a paying user they are out of
    // credits and send them to the pricing page.
    rememberBalance([], IDENTITY);
    expect(cached()).toBe(17);
  });
});

describe("the credential tag", () => {
  const OTHER = apiKeyIdentity("a-different-key");

  beforeEach(() => cache().reset());

  it("does not serve one credential's balance to another", () => {
    rememberBalance(42, IDENTITY);

    expect(cache().balanceFor(IDENTITY)).toBe(42);
    expect(cache().balanceFor(OTHER)).toBeUndefined();
  });

  it("is not warm for a credential it has never fetched", () => {
    rememberBalance(42, IDENTITY);
    cache().markWarm(IDENTITY);

    expect(cache().isWarmFor(IDENTITY)).toBe(true);
    expect(cache().isWarmFor(OTHER)).toBe(false);
  });

  it("goes cold when the credential changes, so the next open re-fetches", () => {
    rememberBalance(42, IDENTITY);
    cache().markWarm(IDENTITY);

    rememberBalance(7, OTHER);

    expect(cache().isWarmFor(OTHER)).toBe(false);
    expect(cache().balanceFor(OTHER)).toBe(7);
    expect(cache().balanceFor(IDENTITY)).toBeUndefined();
  });

  it("refuses to mark warmth for a credential the cached number is not from", () => {
    rememberBalance(42, IDENTITY);
    cache().markWarm(OTHER);

    expect(cache().isWarmFor(OTHER)).toBe(false);
    expect(cache().isWarmFor(IDENTITY)).toBe(false);
  });
});
