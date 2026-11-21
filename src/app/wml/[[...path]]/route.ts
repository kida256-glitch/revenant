import { notFoundDeck } from "@/core/budget";
import { DEFAULT_PROFILE, PROFILES } from "@/core/types";
import { toWml, WML_TYPE } from "@/core/wml";
import { resolveDeck } from "@/adapters/router";
import { pathFromRequest } from "@/adapters/request";

export async function GET(req: Request): Promise<Response> {
  let body: string;
  let status = 200;
  try {
    const { path, profile } = pathFromRequest(req.url, "/wml");
    const r = await resolveDeck(path, profile, undefined, async () => undefined);
    status = r.status;
    body = toWml(r.deck, profile.id);
  } catch {
    status = 500;
    body = toWml(notFoundDeck("/", PROFILES[DEFAULT_PROFILE]));
  }
  return new Response(body, {
    status,
    headers: { "Content-Type": WML_TYPE, "Cache-Control": status === 200 ? "public, max-age=60" : "no-store" },
  });
}
