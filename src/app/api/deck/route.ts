import { envelope, notFoundDeck } from "@/core/budget";
import { DEFAULT_PROFILE, isProfileId, PROFILES } from "@/core/types";
import { resolveDeck } from "@/adapters/router";

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const pid = params.get("profile");
  const profile = PROFILES[isProfileId(pid) ? pid : DEFAULT_PROFILE];
  let status = 200;
  let deck;
  try {
    ({ deck, status } = await resolveDeck(params.get("path") ?? "/", profile));
  } catch {
    deck = notFoundDeck("/", profile);
    status = 500;
  }
  const { body } = envelope(deck);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 && !deck.offline ? "public, max-age=60" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
