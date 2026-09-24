import { describe, expect, it } from "vitest";
import { needsManualCode, parseAuthorizationResponse, rendezvousMode } from "../rendezvous";

describe("parseAuthorizationResponse", () => {
    it("takes a bare code, which is what a redirect page shows", () => {
        expect(parseAuthorizationResponse("ac:abcdef1234567890")).toEqual({
            kind: "code",
            code: "ac:abcdef1234567890",
        });
    });

    it("takes the whole redirected address, which is what the browser gives the user", () => {
        expect(
            parseAuthorizationResponse(
                "http://localhost:8080/callback.html?code=ac%3Aabc123&state=xyz789"
            )
        ).toEqual({ kind: "code", code: "ac:abc123", state: "xyz789" });
    });

    it("takes a bare query string, with or without the leading question mark", () => {
        expect(parseAuthorizationResponse("?code=abc12345&state=s1")).toEqual({
            kind: "code",
            code: "abc12345",
            state: "s1",
        });
        expect(parseAuthorizationResponse("code=abc12345&state=s1")).toEqual({
            kind: "code",
            code: "abc12345",
            state: "s1",
        });
    });

    it("trims what a copy-paste brings with it", () => {
        expect(parseAuthorizationResponse("  \n ac:abcdef123456 \t ")).toEqual({
            kind: "code",
            code: "ac:abcdef123456",
        });
    });

    it("drops a fragment rather than reading a code out of it", () => {
        expect(
            parseAuthorizationResponse("https://host/cb?code=abc12345&state=s1#section")
        ).toEqual({ kind: "code", code: "abc12345", state: "s1" });
    });

    it("reads an error, and reads it in preference to a code", () => {
        expect(
            parseAuthorizationResponse(
                "https://host/cb?error=access_denied&error_description=User+said+no"
            )
        ).toEqual({ kind: "error", error: "access_denied", description: "User said no" });

        expect(
            parseAuthorizationResponse("https://host/cb?code=abc12345&error=server_error")
        ).toMatchObject({ kind: "error", error: "server_error" });
    });

    it("decodes `+` as a space in a description, which decodeURIComponent does not", () => {
        const parsed = parseAuthorizationResponse("?error=x&error_description=a+b%20c");
        expect(parsed).toMatchObject({ description: "a b c" });
    });

    it("survives a malformed percent escape instead of discarding the whole response", () => {
        const parsed = parseAuthorizationResponse("?code=abc12345&state=100%");
        expect(parsed).toMatchObject({ kind: "code", code: "abc12345", state: "100%" });
    });

    it("reports anything else as unreadable rather than guessing", () => {
        expect(parseAuthorizationResponse("")).toEqual({ kind: "unreadable" });
        expect(parseAuthorizationResponse("   ")).toEqual({ kind: "unreadable" });
        expect(parseAuthorizationResponse("nope")).toEqual({ kind: "unreadable" });
        expect(parseAuthorizationResponse("https://host/callback.html")).toEqual({
            kind: "unreadable",
        });
        expect(parseAuthorizationResponse("Sign-in complete! Close this tab.")).toEqual({
            kind: "unreadable",
        });
    });

    it("does not mistake a URL for a bare code", () => {
        expect(parseAuthorizationResponse("https://host/cb?foo=bar")).toEqual({
            kind: "unreadable",
        });
    });
});

describe("the mode", () => {
    it("is relay, and needsManualCode is derived from it rather than tracked separately", () => {
        expect(rendezvousMode()).toBe("relay");
        expect(needsManualCode()).toBe(false);
    });
});
