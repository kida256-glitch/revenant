import { notFoundDeck } from "@/core/budget";
import { toLite } from "@/core/lite";
import { DEFAULT_PROFILE, PROFILES } from "@/core/types";
import { resolveDeck } from "@/adapters/router";
import { pathFromRequest } from "@/adapters/request";

export async function GET(req: Request): Promise<Response> {
  let body: string;
  let status = 200;
  try {
    const { path, profile } = pathFromRequest(req.url, "/lite");
    const r = await resolveDeck(path, profile, undefined, async () => undefined);
    status = r.status;
    body = toLite(r.deck, profile.id);
  } catch {
    status = 500;
    body = toLite(notFoundDeck("/", PROFILES[DEFAULT_PROFILE]));
  }
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
