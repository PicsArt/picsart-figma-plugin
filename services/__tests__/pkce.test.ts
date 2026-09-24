import { createHash, randomFillSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    base64UrlEncode,
    challengeFor,
    createPkcePair,
    createState,
    sha256,
} from "../pkce";

const random = (length: number): Promise<Uint8Array> =>
    Promise.resolve(randomFillSync(new Uint8Array(length)));

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

const ascii = (text: string): Uint8Array => {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
    return out;
};

describe("sha256", () => {
    it("matches the published FIPS 180-4 digests", () => {
        expect(hex(sha256(ascii("")))).toBe(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        expect(hex(sha256(ascii("abc")))).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        expect(
            hex(sha256(ascii("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")))
        ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    });

    it("agrees with Node's crypto across every block and padding boundary", () => {
        for (const length of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000]) {
            const input = ascii("a".repeat(length));
            const expected = createHash("sha256").update(Buffer.from(input)).digest("hex");
            expect(hex(sha256(input)), `length ${length}`).toBe(expected);
        }
    });

    it("hashes bytes above 0x7f, which an ASCII-only test would never reach", () => {
        const input = new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0xfe, 0x01]);
        expect(hex(sha256(input))).toBe(
            createHash("sha256").update(Buffer.from(input)).digest("hex")
        );
    });
});

describe("base64UrlEncode", () => {
    it("uses the URL alphabet and no padding", () => {
        expect(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe("-__-");
        expect(base64UrlEncode(new Uint8Array([0x01]))).toBe("AQ");
        expect(base64UrlEncode(new Uint8Array([0x01, 0x02]))).toBe("AQI");
        expect(base64UrlEncode(new Uint8Array([]))).toBe("");
    });

    it("agrees with Node for every length modulo 3", () => {
        for (let length = 0; length < 16; length++) {
            const bytes = new Uint8Array(length);
            for (let i = 0; i < length; i++) bytes[i] = (i * 37 + 11) & 0xff;
            const expected = Buffer.from(bytes)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
            expect(base64UrlEncode(bytes), `length ${length}`).toBe(expected);
        }
    });
});

describe("challengeFor", () => {
    it("matches the RFC 7636 Appendix B test vector", () => {
        expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    });
});

describe("createPkcePair", () => {
    it("produces a verifier of the RFC's minimum length, from the unreserved set", async () => {
        const { verifier, challenge } = await createPkcePair(random);

        expect(verifier).toHaveLength(43);
        expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
        expect(challenge).toBe(challengeFor(verifier));
    });

    it("does not repeat itself", async () => {
        const seen = new Set<string>();
        for (let i = 0; i < 32; i++) seen.add((await createPkcePair(random)).verifier);
        expect(seen.size).toBe(32);
    });

    it("asks for exactly the 32 bytes a 43-character verifier needs", async () => {
        const asked: number[] = [];
        await createPkcePair((length) => {
            asked.push(length);
            return random(length);
        });
        expect(asked).toEqual([32]);
    });

    it("propagates a refusal instead of producing a verifier without entropy", async () => {
        const boom = new Error("no entropy");
        await expect(createPkcePair(() => Promise.reject(boom))).rejects.toBe(boom);
    });
});

describe("createState", () => {
    it("is a fresh value each time", async () => {
        expect(await createState(random)).not.toBe(await createState(random));
        expect(await createState(random)).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("draws 16 bytes", async () => {
        const asked: number[] = [];
        await createState((length) => {
            asked.push(length);
            return random(length);
        });
        expect(asked).toEqual([16]);
    });
});
