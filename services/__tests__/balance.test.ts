import { beforeEach, describe, expect, it } from "vitest";
import { rememberBalance } from "../balance";
import CustomSessionStorage from "../CustomSessionStorage";

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

describe("rememberBalance", () => {
  beforeEach(() => cache().setBalance(17));

  it.each([
    ["a number", 42, 42],
    ["a numeric string, which is how it crosses postMessage", "42", 42],
    ["zero, which is a real balance", 0, 0],
    ["a decimal", "12.5", 12.5],
  ])("accepts %s", (_label, input, expected) => {
    expect(rememberBalance(input)).toBe(true);
    expect(cache().getBalance()).toBe(expected);
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
    expect(rememberBalance(input)).toBe(false);
    expect(cache().getBalance()).toBe(17);
  });

  it("refuses an empty array rather than reading it as zero credits", () => {
    // Number([]) is 0, so an unguarded cast would tell a paying user they are out of
    // credits and send them to the pricing page.
    rememberBalance([]);
    expect(cache().getBalance()).toBe(17);
  });
});
