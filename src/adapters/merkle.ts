import { createHash } from "node:crypto";

export const sha256 = (b: Uint8Array): Buffer => createHash("sha256").update(b).digest();

/**
 * SHA-256 Merkle root. Leaves are sha256(body bytes); each parent is
 * sha256(left || right); an odd node at any level is paired with itself.
 */
export function merkleRoot(leaves: Uint8Array[]): Buffer {
  if (leaves.length === 0) throw new Error("no leaves");
  let level: Buffer[] = leaves.map((l) => Buffer.from(l));
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i] as Buffer;
      const r = level[i + 1] ?? l;
      next.push(sha256(Buffer.concat([l, r])));
    }
    level = next;
  }
  return level[0] as Buffer;
}
