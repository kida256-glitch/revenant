import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";

export const SIG_HEADER = "X-Revenant-Signature";
export const KEY_HEADER = "X-Revenant-Key-Id";
export const UNSIGNED = "unsigned";
const MAX_VERIFY_BODY = 16_000;

export interface Signer {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Base64 SPKI DER of the Ed25519 public key. */
  publicKeyB64: string;
  keyId: string;
}

let memo: { env: string; signer: Signer | null } | null = null;

/** Signer from a base64 PKCS#8 DER Ed25519 key, or null if missing/invalid (decks are then served unsigned). */
export function loadSigner(env: string | undefined = process.env.REVENANT_SIGNING_KEY): Signer | null {
  const key = (env ?? "").trim();
  if (memo && memo.env === key) return memo.signer;
  let signer: Signer | null = null;
  if (key) {
    try {
      const privateKey = createPrivateKey({ key: Buffer.from(key, "base64"), format: "der", type: "pkcs8" });
      if (privateKey.asymmetricKeyType === "ed25519") {
        const publicKey = createPublicKey(privateKey);
        const der = publicKey.export({ format: "der", type: "spki" });
        signer = { privateKey, publicKey, publicKeyB64: der.toString("base64"), keyId: createHash("sha256").update(der).digest("hex").slice(0, 16) };
      }
    } catch {
      signer = null;
    }
  }
  memo = { env: key, signer };
  return signer;
}

/** Ed25519 signature (base64) over the exact UTF-8 bytes of the body. */
export function signBody(body: string | Uint8Array, signer: Signer): string {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return sign(null, bytes, signer.privateKey).toString("base64");
}

/** Never throws. */
export function verifyBytes(bytes: Uint8Array, sigB64: string, publicKey: KeyObject): boolean {
  try {
    const sig = Buffer.from(sigB64, "base64");
    return sig.length === 64 && verify(null, bytes, publicKey, sig);
  } catch {
    return false;
  }
}

/** Headers for a deck response: signature + key id, or "unsigned" when no key is configured. */
export function signatureHeaders(body: string, signer: Signer | null = loadSigner()): Record<string, string> {
  if (!signer) return { [SIG_HEADER]: UNSIGNED };
  return { [SIG_HEADER]: signBody(body, signer), [KEY_HEADER]: signer.keyId };
}

export type VerifyBody =
  | { valid: boolean; keyId: string; publicKey: string }
  | { valid: false; error: string };

/** Check a deck body + signature against this server's key. Never throws; always JSON-safe. */
export function verifyRequest(body: unknown, sig: unknown, signer: Signer | null = loadSigner()): { status: number; json: VerifyBody } {
  try {
    if (typeof body !== "string" || typeof sig !== "string" || body.length > MAX_VERIFY_BODY || sig.length > 200) {
      return { status: 400, json: { valid: false, error: "bad input" } };
    }
    if (!signer) return { status: 200, json: { valid: false, error: "server unsigned" } };
    const valid = verifyBytes(Buffer.from(body, "utf8"), sig, signer.publicKey);
    return { status: 200, json: { valid, keyId: signer.keyId, publicKey: signer.publicKeyB64 } };
  } catch {
    return { status: 400, json: { valid: false, error: "bad input" } };
  }
}
