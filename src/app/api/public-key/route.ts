import { loadSigner } from "@/adapters/sign";

/** GET /api/public-key -> { keyId, publicKey } (Ed25519 SPKI, base64), or 404 when the server is unsigned. */
export async function GET(): Promise<Response> {
  const s = loadSigner();
  if (!s) return Response.json({ error: "unsigned" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { keyId: s.keyId, publicKey: s.publicKeyB64, alg: "Ed25519" },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } },
  );
}
