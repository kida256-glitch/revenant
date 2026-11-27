import latest from "../../anchors/latest.json";

export interface AnchorSummary {
  txHash: string;
  explorerUrl: string;
  root: string;
  keyId: string;
  timestamp: string;
  pages: string[];
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Validate anchors/latest.json (committed data; still treated as untrusted). */
export function parseAnchor(x: unknown): AnchorSummary | null {
  if (!x || typeof x !== "object") return null;
  const a = x as Record<string, unknown>;
  const tx = typeof a.txHash === "string" ? a.txHash : "";
  if (!/^0x[0-9a-f]{64}$/.test(tx) || typeof a.root !== "string" || !HEX64.test(a.root)) return null;
  const keyId = typeof a.keyId === "string" && /^[0-9a-f]{16}$/.test(a.keyId) ? a.keyId : "?";
  const ts = typeof a.timestamp === "string" && !Number.isNaN(Date.parse(a.timestamp)) ? new Date(a.timestamp).toISOString().slice(0, 16).replace("T", " ") : "?";
  const pages = Array.isArray(a.leaves)
    ? a.leaves.map((l) => (l && typeof l === "object" && typeof (l as { path?: unknown }).path === "string" ? (l as { path: string }).path : "")).filter((p) => /^\/[\w/.-]{0,40}$/.test(p))
    : [];
  return { txHash: tx, explorerUrl: `https://sepolia.basescan.org/tx/${tx}`, root: a.root, keyId, timestamp: ts, pages };
}

export const latestAnchor = (): AnchorSummary | null => parseAnchor(latest);
