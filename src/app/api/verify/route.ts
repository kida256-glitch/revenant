import { verifyRequest } from "@/adapters/sign";

/** GET /api/verify?body=<exact deck body>&sig=<base64 signature> -> { valid, keyId, publicKey } */
export async function GET(req: Request): Promise<Response> {
  const p = new URL(req.url).searchParams;
  const { status, json } = verifyRequest(p.get("body"), p.get("sig"));
  return Response.json(json, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
