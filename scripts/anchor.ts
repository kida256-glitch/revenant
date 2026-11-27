// Local-only: anchor a Merkle root of signed demo pages on Base Sepolia (testnet).
// Usage: $env:ANCHOR_WALLET_KEY="0x..."; npm run anchor -- https://your-app.vercel.app
//        npm run anchor -- http://localhost:3000 --dry-run   (no transaction, no file)
import { createPublicKey, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { merkleRoot, sha256 } from "../src/adapters/merkle";
import { verifyBytes } from "../src/adapters/sign";

const PAGES = [
  { path: "/", url: "/api/deck?path=%2F&profile=nokia3310" },
  { path: "/lite", url: "/lite" },
  { path: "/wiki/a/Kampala", url: "/api/deck?path=%2Fwiki%2Fa%2FKampala&profile=nokia3310" },
];

function fail(msg: string): never {
  console.error(`anchor: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baseArg = args.find((a) => !a.startsWith("--")) ?? fail("pass the base URL, e.g. https://revenant-henna.vercel.app");
let base: URL;
try {
  base = new URL(baseArg);
} catch {
  fail(`not a URL: ${baseArg}`);
}
if (base.protocol !== "https:" && base.hostname !== "localhost") fail("base URL must be https (or http://localhost)");
const origin = base.origin;

const walletKey = process.env.ANCHOR_WALLET_KEY;
if (!dryRun && !/^0x[0-9a-fA-F]{64}$/.test(walletKey ?? "")) fail("set ANCHOR_WALLET_KEY (0x + 64 hex) in this shell");

const leaves = [];
let publicKey = "";
let keyId = "";
for (const p of PAGES) {
  const res = await fetch(origin + p.url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) fail(`${p.path}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const sig = res.headers.get("x-revenant-signature") ?? "";
  if (!sig || sig === "unsigned") fail(`${p.path} is unsigned: set REVENANT_SIGNING_KEY on the server and redeploy`);
  const v = await fetch(`${origin}/api/verify?${new URLSearchParams({ body: new TextDecoder().decode(bytes), sig })}`, { signal: AbortSignal.timeout(15_000) });
  const vj = (await v.json()) as { valid?: boolean; publicKey?: string; keyId?: string };
  if (vj.valid !== true || !vj.publicKey || !vj.keyId) fail(`${p.path}: server says signature is not valid`);
  // Check locally too, against the key the server reports.
  const pub = createPublicKey({ key: Buffer.from(vj.publicKey, "base64"), format: "der", type: "spki" });
  if (!verifyBytes(bytes, sig, pub)) fail(`${p.path}: local signature check failed`);
  if (publicKey && publicKey !== vj.publicKey) fail("pages signed by different keys");
  publicKey = vj.publicKey;
  keyId = vj.keyId;
  leaves.push({ path: p.path, url: origin + p.url, bytes: bytes.length, sha256: sha256(bytes).toString("hex"), signature: sig });
  console.log(`ok ${p.path} (${bytes.length} B)`);
}
if (keyId !== createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex").slice(0, 16)) fail("key id mismatch");

const root = merkleRoot(leaves.map((l) => Buffer.from(l.sha256, "hex"))).toString("hex");
const payload = `revenant-anchor:v1;root=${root};key=${publicKey}`;
console.log(`root ${root}`);
if (dryRun) {
  console.log(`dry run: would publish ${payload.length} bytes of data; nothing sent or written`);
  process.exit(0);
}

const account = privateKeyToAccount(walletKey as `0x${string}`);
const transport = http(process.env.BASE_SEPOLIA_RPC || undefined);
const wallet = createWalletClient({ account, chain: baseSepolia, transport });
const client = createPublicClient({ chain: baseSepolia, transport });
const txHash = await wallet.sendTransaction({ to: account.address, value: 0n, data: toHex(payload) });
console.log(`sent ${txHash}, waiting for receipt...`);
const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
if (receipt.status !== "success") fail(`transaction ${txHash} failed`);

const explorer = baseSepolia.blockExplorers.default.url;
const out = {
  network: "base-sepolia",
  chainId: baseSepolia.id,
  txHash,
  explorerUrl: `${explorer}/tx/${txHash}`,
  blockNumber: Number(receipt.blockNumber),
  timestamp: new Date().toISOString(),
  root,
  keyId,
  publicKey,
  data: payload,
  leaves,
};
mkdirSync("anchors", { recursive: true });
writeFileSync("anchors/latest.json", JSON.stringify(out, null, 2) + "\n");
console.log(`wrote anchors/latest.json\n${out.explorerUrl}`);
