/** Result of checking a deck signature in the client. */
export type SigCheck = "valid" | "invalid" | "unsupported";

function fromB64(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Verify an Ed25519 signature (base64) over the exact response bytes with Web
 * Crypto, given the SPKI public key (base64). "unsupported" when the runtime
 * has no Ed25519 in crypto.subtle. Never throws.
 */
export async function verifyEd25519(
  spkiB64: string,
  sigB64: string,
  bytes: Uint8Array<ArrayBuffer>,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<SigCheck> {
  if (typeof subtle?.importKey !== "function" || typeof subtle.verify !== "function") return "unsupported";
  const der = fromB64(spkiB64);
  const sig = fromB64(sigB64);
  if (!der || !sig || sig.length !== 64) return "invalid";
  let key: CryptoKey;
  try {
    key = await subtle.importKey("spki", der, { name: "Ed25519" }, false, ["verify"]);
  } catch (err) {
    return err instanceof Error && err.name === "NotSupportedError" ? "unsupported" : "invalid";
  }
  try {
    return (await subtle.verify({ name: "Ed25519" }, key, sig, bytes)) ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}
