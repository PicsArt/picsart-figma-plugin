/// <reference types="node" />
//
// File-scoped, and the only file in the repo that needs it. `tsconfig.json` sets
// `types: ["plugin-typings"]` project-wide on purpose — that restriction is what stops
// UI code reaching for sandbox or node globals — so this test opts itself in for
// `process.env` and `node:zlib` rather than widening the setting for everything.
import { describe, expect, it } from "vitest";
import { editImage, getBalance } from "../index";
import pollInference from "../pollInference";
import { fetchResultBytes } from "../apiError";
import { EDITIMAGE_POLL_PATHS, EDIT_IMAGE_FAILED_ERR } from "@constants/index";
import type { PreparedSource } from "@utils/imageBinary";
// A node builtin, in a node-environment test. Nothing imports this file into the UI
// bundle, so it never reaches the iframe.
import { deflateSync } from "node:zlib";

const KEY = process.env.PICSART_LIVE_KEY;

// A 64x64 PNG built inline: no fixture file to keep in sync, and comfortably over the
// API's 16px floor.
const makePng = (): Uint8Array => {
  const W = 64;
  const H = 64;
  const raw: number[] = [];
  for (let y = 0; y < H; y++) {
    raw.push(0); // filter type
    for (let x = 0; x < W; x++) raw.push((x * 4) % 256, (y * 4) % 256, 128);
  }
  // Uint8Array throughout rather than Buffer: `Buffer` is a global, and this repo's
  // tsconfig deliberately loads only the Figma plugin typings globally.
  const idat: Uint8Array = deflateSync(new Uint8Array(raw));

  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (bytes: Uint8Array): number => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const be32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const chunk = (tag: string, data: Uint8Array): number[] => {
    const tagBytes = tag.split("").map((ch) => ch.charCodeAt(0));
    const body = new Uint8Array([...tagBytes, ...Array.from(data)]);
    return [...be32(data.length), ...Array.from(body), ...be32(crc32(body))];
  };

  const ihdr = new Uint8Array([...be32(W), ...be32(H), 8 /* depth */, 2 /* truecolour */, 0, 0, 0]);
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", idat),
    ...chunk("IEND", new Uint8Array()),
  ]);
};

describe.skipIf(!KEY)("live: the shipped edit path, end to end", () => {
  it("edits, polls and downloads through the plugin's own code", async () => {
    const key = KEY as string;
    const before = await getBalance(key);
    expect(before.success).toBe(true);

    const bytes = makePng();
    const source: PreparedSource = {
      blob: new Blob([bytes as BlobPart], { type: "image/png" }),
      extension: "png",
      width: 64,
      height: 64,
      downscaled: false,
    };

    const started = await editImage(source, key, {
      prompt: "make the background a plain white studio backdrop",
      count: 1,
      format: "PNG",
      model: "",
    });
    expect(started.success).toBe(true);
    if (!started.success) return;

    // QUESTION 1: is `mode=async` still honoured? If this is ever undefined while
    // `imageUrls` is populated, the endpoint has started answering synchronously and the
    // polling module has become an error-path fallback for edit mode — which also means
    // the advancing loading copy describes a wait that no longer happens in stages.
    expect(started.inferenceId).toBeTruthy();
    console.log("  mode=async honoured, inference_id:", started.inferenceId);

    const outcome = await pollInference({
      paths: EDITIMAGE_POLL_PATHS,
      inferenceId: started.inferenceId as string,
      credential: key,
      transient: EDIT_IMAGE_FAILED_ERR,
      rejected: EDIT_IMAGE_FAILED_ERR,
    });
    expect(outcome.status).toBe("finished");
    if (outcome.status !== "finished") return;
    expect(outcome.imageUrls).toHaveLength(1);

    // QUESTION 2: is the result host still on the allowlist? If RESULT_HOST_ALLOWLIST
    // or the manifest's allowedDomains ever fall behind, this is where it shows —
    // inside Figma it would surface as a download failure naming the wrong cause, on a
    // result the user has already paid for.
    const downloaded = await fetchResultBytes(outcome.imageUrls[0]);
    expect("ok" in downloaded).toBe(true);
    if (!("ok" in downloaded)) return;
    // PNG magic number: proves `format=PNG` was honoured, which matters because JPG
    // would flatten a transparent source to black.
    expect(downloaded.bytes[0]).toBe(0x89);
    console.log("  downloaded", downloaded.bytes.length, "bytes from", outcome.imageUrls[0].split("?")[0]);

    // QUESTION 3, and the one that was assumed wrong everywhere:
    // `x-picsart-credit-available` is the balance at AUTHORIZATION, not after the
    // charge. If this assertion ever flips, the header has become usable as a balance
    // and `refreshBalance` could be dropped — until then, do not post the header.
    const after = await getBalance(key);
    console.log(`  balance ${before.msg} -> ${after.msg}, header said ${started.updatedCredits}`);
    expect(started.updatedCredits).toBe(before.msg);
    expect(after.msg as number).toBeLessThan(before.msg as number);
  }, 240_000);
});
