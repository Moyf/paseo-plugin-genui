import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import type { PluginHookContext } from "@getpaseo/plugin/server";
import { specProblems } from "../shared/fallback";
import { GENUI_BLOCK_KIND } from "../shared/segment";
import { loadAgentFile } from "./data-source";

type PaseoApi = PluginHookContext["paseo"];

/** Where the MCP shim finds the endpoint; rewritten on each plugin start, so a restart keeps old agents working. */
export function renderEndpointFile(): string {
  return path.join(process.env.PASEO_HOME || path.join(os.homedir(), ".paseo"), "genui-render-endpoint.json");
}

/**
 * The local endpoint behind the render_ui tool: checks a spec and appends it to
 * the agent's timeline only when it renders cleanly.
 * ponytail: `getPaseo` returns the API captured from the last hook call, since the
 * plugin SDK gives no top-level client; if none was captured yet the call fails.
 * Upgrade when the SDK exposes `server.paseo`.
 */
export async function startRenderEndpoint(getPaseo: () => PaseoApi | null): Promise<Server> {
  const token = randomBytes(24).toString("hex");
  let seq = 0;
  const server = createServer((req, res) => {
    const send = (status: number, body: { ok: boolean; text: string }) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.headers.authorization !== `Bearer ${token}`) return send(403, { ok: false, text: "forbidden" });
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      raw += chunk;
    });
    req.on("end", async () => {
      try {
        const { agentId, spec } = JSON.parse(raw) as { agentId: string; spec: string };
        const paseo = getPaseo();
        if (paseo === null) return send(503, { ok: false, text: "The genui plugin is not ready yet; write a ```ui block instead." });
        const { problems } = await specProblems(spec, (request) => loadAgentFile(paseo, agentId, request.path, request));
        if (problems.length > 0) {
          return send(200, { ok: false, text: `Nothing was shown. Fix these and call render_ui again:\n${problems.join("\n")}` });
        }
        const id = `genui-render-${Date.now()}-${++seq}`;
        await paseo.agents.ref(agentId).timeline.append({
          type: "plugin",
          id,
          kind: GENUI_BLOCK_KIND,
          version: 1,
          data: { language: "ui", code: spec, complete: true, fenceIndex: 0, messageId: id },
        });
        send(200, { ok: true, text: "Shown to the user. Do not repeat its content in text." });
      } catch (error) {
        send(500, { ok: false, text: `render_ui failed: ${error instanceof Error ? error.message : String(error)}` });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await writeFile(renderEndpointFile(), JSON.stringify({ url: `http://127.0.0.1:${port}/render`, token }), { mode: 0o600 });
  return server;
}
