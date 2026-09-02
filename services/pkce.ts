import type { RandomSource } from "./entropy";

const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (value: number, bits: number): number =>
    ((value >>> bits) | (value << (32 - bits))) >>> 0;

export const sha256 = (input: Uint8Array): Uint8Array => {
    const h = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
        0x1f83d9ab, 0x5be0cd19,
    ];

    const bitLength = input.length * 8;
    const blockCount = Math.ceil((input.length + 9) / 64);
    const padded = new Uint8Array(blockCount * 64);
    padded.set(input);
    padded[input.length] = 0x80;
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    for (let i = 0; i < 4; i++) {
        padded[padded.length - 8 + i] = (high >>> (24 - i * 8)) & 0xff;
        padded[padded.length - 4 + i] = (low >>> (24 - i * 8)) & 0xff;
    }

    const w = new Array<number>(64);

    for (let block = 0; block < blockCount; block++) {
        const base = block * 64;
        for (let i = 0; i < 16; i++) {
            const offset = base + i * 4;
            w[i] =
                ((padded[offset] << 24) |
                    (padded[offset + 1] << 16) |
                    (padded[offset + 2] << 8) |
                    padded[offset + 3]) >>>
                0;
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }

        let [a, b, c, d, e, f, g, hh] = h;

        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            hh = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }

        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
        h[5] = (h[5] + f) >>> 0;
        h[6] = (h[6] + g) >>> 0;
        h[7] = (h[7] + hh) >>> 0;
    }

    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
        out[i * 4] = (h[i] >>> 24) & 0xff;
        out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
        out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
        out[i * 4 + 3] = h[i] & 0xff;
    }
    return out;
};

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const base64UrlEncode = (bytes: Uint8Array): string => {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

        out += BASE64URL[b0 >>> 2];
        out += BASE64URL[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >>> 4)];
        if (b1 === undefined) break;
        out += BASE64URL[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >>> 6)];
        if (b2 === undefined) break;
        out += BASE64URL[b2 & 0x3f];
    }
    return out;
};

const asciiBytes = (text: string): Uint8Array => {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
};

export const VERIFIER_BYTES = 32;
export const STATE_BYTES = 16;

export interface PkcePair {
    verifier: string;
    challenge: string;
}

export const createPkcePair = async (random: RandomSource): Promise<PkcePair> => {
    const verifier = base64UrlEncode(await random(VERIFIER_BYTES));
    return { verifier, challenge: challengeFor(verifier) };
};

export const challengeFor = (verifier: string): string =>
    base64UrlEncode(sha256(asciiBytes(verifier)));

export const createState = async (random: RandomSource): Promise<string> =>
    base64UrlEncode(await random(STATE_BYTES));

export default createPkcePair;
