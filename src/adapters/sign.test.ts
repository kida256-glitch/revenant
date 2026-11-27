import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateKeyPairSync } from "node:crypto";
import { envelope, pageDeck } from "@/core/budget";
import { paginate } from "@/core/fit";
import { PROFILES } from "@/core/types";
import { loadSigner, signatureHeaders, signBody, SIG_HEADER, UNSIGNED, verifyBytes, verifyRequest } from "./sign";

const keyB64 = generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const signer = loadSigner(keyB64);
if (!signer) throw new Error("test key failed to load");

const bodyArb = fc.tuple(fc.string({ maxLength: 40 }), fc.string({ maxLength: 600 }), fc.constantFrom(...Object.values(PROFILES)))
  .map(([title, text, p]) => envelope(pageDeck(paginate(title || "T", text, p, "a"), 0, () => "/x", p)).body);

describe("signed decks", () => {
  it("property: changing any byte of a signed deck makes verification fail", () => {
    fc.assert(
      fc.property(bodyArb, fc.nat(), fc.integer({ min: 1, max: 255 }), (body, pos, x) => {
        const bytes = Buffer.from(body, "utf8");
        const sig = signBody(bytes, signer);
        expect(verifyBytes(bytes, sig, signer.publicKey)).toBe(true);
        const bad = Buffer.from(bytes);
        const i = pos % bad.length;
        bad[i] = (bad[i] ?? 0) ^ x;
        expect(verifyBytes(bad, sig, signer.publicKey)).toBe(false);
      }),
      { numRuns: 300 },
    );
  });

  it("property: any hostile input to /api/verify returns JSON and never throws", () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.boolean(), (body, sig, hasKey) => {
        const r = verifyRequest(body, sig, hasKey ? signer : null);
        expect(JSON.parse(JSON.stringify(r.json)).valid).toBe(r.json.valid);
        expect([200, 400]).toContain(r.status);
      }),
      { numRuns: 300 },
    );
    expect(verifyRequest("x".repeat(20_000), "a", signer).status).toBe(400);
  });

  it("verifies a real signed body and reports unsigned without a key", () => {
    const body = envelope(pageDeck(paginate("Hi", "Hello", PROFILES.nokia3310, "a"), 0, () => "/", PROFILES.nokia3310)).body;
    const h = signatureHeaders(body, signer);
    expect(verifyRequest(body, h[SIG_HEADER], signer).json).toMatchObject({ valid: true, keyId: signer.keyId });
    expect(verifyRequest(body + " ", h[SIG_HEADER], signer).json.valid).toBe(false);
    expect(signatureHeaders(body, null)).toEqual({ [SIG_HEADER]: UNSIGNED });
    expect(loadSigner("not a key")).toBeNull();
  });
});
