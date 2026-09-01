import CustomSessionStorage from "./CustomSessionStorage";

/**
 * The one guard that decides what may be cached as the credit balance.
 *
 * This check existed in exactly one of the three places that write the balance.
 * `MessageListeners` had it, with a comment explaining the poisoning it prevents;
 * `openPanel` and `IntroController` cast whatever arrived straight to `number`.
 *
 * The failure it prevents: the balance crosses postMessage as a string and
 * `getBalance` used to return an error message in the same field as a credit count,
 * so a failed fetch cached `"API key is wrong"` or `undefined` for the rest of the
 * session — and nothing re-fetches. Downstream, `payload <= 0` on a string is
 * `false`, so every button stayed enabled and every paid call went ahead against a
 * balance nobody had actually read.
 *
 * @returns true when the value was accepted, so callers can decide whether the
 *          session is warm enough to stop re-fetching.
 */
export const rememberBalance = (value: unknown): boolean => {
  // Guarded before Number(): Number(null) and Number([]) are both 0, and Number("")
  // is 0 too, so a missing balance would otherwise cache as "out of credits" and
  // send the user to the pricing page with credits in their account.
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    return false;
  }
  if (typeof value !== "number" && typeof value !== "string") return false;

  const credits = Number(value);
  if (!Number.isFinite(credits)) return false;

  CustomSessionStorage.getInstance().setBalance(credits);
  return true;
};

export default rememberBalance;
