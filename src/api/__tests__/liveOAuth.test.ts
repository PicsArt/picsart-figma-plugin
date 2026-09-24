/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { getBalance } from "../getBalance";
import { asCredential, credentialHeaders } from "../customFetch";
import { mayReceiveCredential } from "../apiError";
import {
  BALANACE,
  BEARER_PREFIX,
  HEADERAPI,
  HEADER_AUTHORIZATION,
  KEY_WRONG_ERR,
  PICSARTURL,
  REQUIRED_OAUTH_SCOPES,
} from "@constants/index";
import { accessTokenExpiry, checkGrantedScopes, grantedScopes } from "@services/grantedScope";
import type { CredentialDescriptor } from "@app-types/credential";

const TOKEN = process.env.PICSART_LIVE_TOKEN;

const credential = (): CredentialDescriptor => ({
  kind: "oauth",
  token: TOKEN as string,
  scopes: grantedScopes(TOKEN as string),
  expiresAt: accessTokenExpiry(TOKEN as string),
});

describe.skipIf(!TOKEN)("a real Picsart user bearer", () => {
  it("is a decodable, in-window token carrying the scope the plugin needs", () => {
    const check = checkGrantedScopes(TOKEN as string);
    expect(check).toMatchObject({ ok: true });
    expect(check.granted).toEqual(expect.arrayContaining([...REQUIRED_OAUTH_SCOPES]));

    const expiry = accessTokenExpiry(TOKEN as string);
    expect(expiry).toBeDefined();
    expect(expiry as number).toBeGreaterThan(Date.now());
    console.log(
      `[live] token valid for ${Math.round(((expiry as number) - Date.now()) / 1000)}s, scopes: ${check.granted.join(" ")}`
    );
  });

  it("travels in Authorization: Bearer, and an API key does not", () => {
    expect(credentialHeaders(credential())).toEqual({
      [HEADER_AUTHORIZATION]: `${BEARER_PREFIX}${TOKEN}`,
    });
    expect(credentialHeaders(asCredential("paat-xyz"))).toEqual({ [HEADERAPI]: "paat-xyz" });
  });

  it("is allowed to reach the balance host at all", () => {
    expect(mayReceiveCredential(PICSARTURL + BALANACE)).toBe(true);
  });

  it("never produces the wrong-key sentence for a bearer, whatever the server answers", async () => {
    const result = await getBalance(credential());

    console.log(
      `[live] GET ${BALANACE} with a user bearer -> success=${result.success} msg=${JSON.stringify(result.msg)}`
    );

    if (result.success) {
      expect(typeof result.msg).toBe("number");
    } else {
      expect(result.msg).not.toBe(KEY_WRONG_ERR);
    }
  });

  it("reports the same answer in either header position, or tells us which one works", async () => {
    const asBearer = await getBalance(credential());
    const asApiKey = await getBalance(TOKEN as string);

    console.log(
      `[live] bearer position: ${asBearer.success ? "accepted" : "refused"}; ` +
        `api-key position: ${asApiKey.success ? "accepted" : "refused"}`
    );

    if (!asApiKey.success) expect(asApiKey.msg).toBe(KEY_WRONG_ERR);
    if (!asBearer.success) expect(asBearer.msg).not.toBe(KEY_WRONG_ERR);
  });

  it("exposes the credit header to the plugin's opaque origin", async () => {
    const response = await fetch(PICSARTURL + BALANACE, {
      method: "OPTIONS",
      headers: {
        Origin: "null",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });

    const allowOrigin = response.headers.get("access-control-allow-origin");
    const allowHeaders = (response.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    const exposed = (response.headers.get("access-control-expose-headers") ?? "").toLowerCase();

    console.log(
      `[live] preflight from origin null -> ${response.status}; ` +
        `allow-origin=${allowOrigin}; authorization allowed=${allowHeaders.includes("authorization")}`
    );

    expect(allowOrigin).toBe("null");
    expect(allowHeaders).toContain("authorization");
    expect(exposed).toContain("x-picsart-credit-available");
  });
});
