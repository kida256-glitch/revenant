import { resolveWeight } from "@/adapters/weight";

export async function GET(req: Request): Promise<Response> {
  const { status, body } = await resolveWeight(new URL(req.url).searchParams.get("title"));
  return Response.json(body, {
    status,
    headers: { "Cache-Control": status === 200 ? "public, max-age=3600" : "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
