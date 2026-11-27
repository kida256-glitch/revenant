import { describe, expect, it } from "vitest";
import { validDeck } from "@/core/budget";
import { PROFILES } from "@/core/types";
import { merkleRoot, sha256 } from "./merkle";
import { parseAnchor } from "./proof";
import { resolveDeck } from "./router";

// Expected values computed independently with .NET SHA256 (PowerShell).
const leaf = (s: string) => sha256(Buffer.from(s, "utf8"));

describe("merkleRoot", () => {
  it("matches a fixed test vector", () => {
    expect(leaf("a").toString("hex")).toBe("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
    expect(merkleRoot([leaf("a"), leaf("b")]).toString("hex")).toBe("e5a01fee14e0ed5c48714f22180f25ad8365b53f9779f79dc4a3d7e93963f94a");
    expect(merkleRoot([leaf("a"), leaf("b"), leaf("c")]).toString("hex")).toBe("d31a37ef6ac14a2db1470c4316beb5592e6afd4465022339adafda76a18ffabe");
  });
  it("single leaf is its own root; empty throws; order matters", () => {
    expect(merkleRoot([leaf("a")]).equals(leaf("a"))).toBe(true);
    expect(() => merkleRoot([])).toThrow();
    expect(merkleRoot([leaf("b"), leaf("a")]).toString("hex")).not.toBe("e5a01fee14e0ed5c48714f22180f25ad8365b53f9779f79dc4a3d7e93963f94a");
  });
});

describe("/about/proof", () => {
  const tx = "0x" + "ab".repeat(32);
  const good = { txHash: tx, root: "cd".repeat(32), keyId: "0123456789abcdef", timestamp: "2026-10-31T12:00:00.000Z", leaves: [{ path: "/" }, { path: "/lite" }] };
  it("parses a valid anchor and rejects bad ones", () => {
    expect(parseAnchor(good)).toMatchObject({ explorerUrl: `https://sepolia.basescan.org/tx/${tx}`, pages: ["/", "/lite"] });
    for (const bad of [null, { anchored: false }, { ...good, txHash: "javascript:alert(1)" }, { ...good, root: "zz" }]) expect(parseAnchor(bad)).toBeNull();
  });
  it("serves a valid deck with or without an anchor", async () => {
    for (const p of Object.values(PROFILES)) {
      const r = await resolveDeck("/about/proof", p, async () => { throw new Error("no network"); });
      expect(r.status).toBe(200);
      expect(validDeck(r.deck, p)).toBe(true);
    }
  });
});
