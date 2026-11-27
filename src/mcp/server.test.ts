import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server";

async function connect() {
  const offline = async () => { throw new Error("no network in tests"); };
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([createServer(offline).connect(a), client.connect(b)]);
  return client;
}
const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0]?.text ?? "");

describe("MCP server", () => {
  it("lists exactly render_deck and measure_deck", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["measure_deck", "render_deck"]);
  });

  it("renders and measures a static deck", async () => {
    const c = await connect();
    const r = await c.callTool({ name: "render_deck", arguments: { path: "/about" } });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain("Wikipedia");
    const m = JSON.parse(text(await c.callTool({ name: "measure_deck", arguments: { path: "/", profile: "generic" } })));
    expect(m).toMatchObject({ fitsCardBudget: true, fitsDeckBudget: true });
    expect(m.responseBytes).toBeGreaterThan(0);
  });

  it("returns error results for hostile input, never crashes", async () => {
    const c = await connect();
    const hostile = ["", "../../etc/passwd", "https://evil.com", "/wiki/a/%E0%A4%A", "/x".repeat(500), "/\u0000<script>", "/nope", "/weather/gulu"];
    for (const path of hostile) {
      for (const name of ["render_deck", "measure_deck"]) {
        const r = await c.callTool({ name, arguments: { path } });
        expect(r.isError).toBe(true);
      }
    }
    expect((await c.callTool({ name: "render_deck", arguments: { path: "/", profile: "x" } })).isError).toBe(true);
    // Wrong types fail schema validation: an error result or a protocol error, and the server keeps running.
    const wrong = await c.callTool({ name: "render_deck", arguments: { path: 42 } }).then((r) => r.isError, () => true);
    expect(wrong).toBe(true);
    expect((await c.callTool({ name: "render_deck", arguments: { path: "/" } })).isError).toBeFalsy();
  });
});
