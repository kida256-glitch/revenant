import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_PATH } from "@/core/budget";
import { deckText, measureDeck } from "@/core/text";
import { DEFAULT_PROFILE, isProfileId, PROFILES } from "@/core/types";
import type { GetJson } from "@/adapters/http";
import { resolveDeck, type Resolved } from "@/adapters/router";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const input = {
  path: z.string().describe('Revenant path, e.g. "/", "/wiki/search?q=uganda", "/wiki/a/Kampala", "/weather/gulu", "/money"'),
  profile: z.string().optional().describe('"nokia3310" (14x6, default) or "generic" (20x10)'),
};

const err = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });

/** Resolve a path for a tool call. Returns an error result for anything but a 200 deck. */
async function load(path: unknown, profile: unknown, get?: GetJson): Promise<Resolved | ToolResult> {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > MAX_PATH) {
    return err(`Invalid path: must start with "/" and be at most ${MAX_PATH} characters.`);
  }
  if (profile !== undefined && !isProfileId(profile)) return err('Invalid profile: use "nokia3310" or "generic".');
  const r = await resolveDeck(path, PROFILES[isProfileId(profile) ? profile : DEFAULT_PROFILE], get);
  if (r.status !== 200) return err(`Error ${r.status} for ${path}:\n${deckText(r.deck)}`);
  return r;
}

/** Read-only MCP server over the same router, adapters and core as /api/deck. */
export function createServer(get?: GetJson): McpServer {
  const server = new McpServer({ name: "revenant", version: "0.1.0" });
  const safe = (fn: (a: { path: string; profile?: string }) => Promise<ToolResult>) =>
    async (a: { path: string; profile?: string }): Promise<ToolResult> => {
      try {
        return await fn(a);
      } catch {
        return err("Internal error.");
      }
    };

  server.registerTool(
    "render_deck",
    {
      title: "Render deck",
      description: "Fetch a Revenant page as tiny plain-text cards (Wikipedia, Ugandan weather, UGX rates) plus its byte size.",
      inputSchema: input,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ path, profile }) => {
      const r = await load(path, profile, get);
      if ("content" in r) return r;
      const m = measureDeck(r.deck);
      return { content: [{ type: "text", text: `${deckText(r.deck)}\n\n(${m.responseBytes} bytes, ${m.cards} cards${r.deck.offline ? ", offline/stale" : ""})` }] };
    }),
  );

  server.registerTool(
    "measure_deck",
    {
      title: "Measure deck",
      description: "Byte size, card count and card/deck budget checks for a Revenant page.",
      inputSchema: input,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ path, profile }) => {
      const r = await load(path, profile, get);
      if ("content" in r) return r;
      return { content: [{ type: "text", text: JSON.stringify({ path: r.deck.path, ...measureDeck(r.deck) }) }] };
    }),
  );
  return server;
}
