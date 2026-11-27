import { DEFAULT_PROFILE, isProfileId, PROFILES, type Profile } from "@/core/types";

/** Client IP from proxy headers (Vercel sets x-forwarded-for), for rate limiting only. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Turn a `/wml/...` or `/lite/...` request URL into an app path and profile (`?pf=`). */
export function pathFromRequest(reqUrl: string, base: string): { path: string; profile: Profile } {
  const url = new URL(reqUrl);
  const pf = url.searchParams.get("pf");
  url.searchParams.delete("pf");
  const rest = url.pathname.slice(base.length);
  const path = (rest.startsWith("/") ? rest : "/" + rest) + url.search;
  return { path, profile: PROFILES[isProfileId(pf) ? pf : DEFAULT_PROFILE] };
}
