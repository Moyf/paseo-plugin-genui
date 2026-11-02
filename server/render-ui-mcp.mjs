#!/usr/bin/env node
// Stdio MCP server the genui plugin gives each agent. It has one tool, render_ui,
// which forwards the spec to the plugin's local endpoint. The endpoint checks the
// spec and adds it to the agent's chat only when it renders; otherwise the errors
// come back as the tool result, so the agent fixes them in the same turn.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const endpointFile = process.argv[2];

const TOOL = {
  name: "render_ui",
  description:
    "Show a ```ui spec to the user as live UI. The spec is checked first: if it has errors, nothing is shown and the errors come back; fix them and call again. Write your answer sentence before calling.",
  inputSchema: {
    type: "object",
    properties: { spec: { type: "string", description: "The ui spec, without the ``` fence" } },
    required: ["spec"],
  },
};

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

async function render(spec) {
  const agentId = process.env.PASEO_AGENT_ID;
  if (!agentId) return { ok: false, text: "render_ui needs PASEO_AGENT_ID, which this process does not have." };
  const { url, token } = JSON.parse(readFileSync(endpointFile, "utf8"));
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ agentId, spec }),
  });
  return await response.json();
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = message;
  if (id === undefined) return;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "genui", version: "0.0.1" },
    });
  } else if (method === "tools/list") {
    reply(id, { tools: [TOOL] });
  } else if (method === "tools/call" && params?.name === "render_ui") {
    try {
      const result = await render(String(params.arguments?.spec ?? ""));
      reply(id, { content: [{ type: "text", text: result.text }], isError: !result.ok });
    } catch (error) {
      reply(id, { content: [{ type: "text", text: `render_ui failed: ${error}` }], isError: true });
    }
  } else {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${method}` } }) + "\n");
  }
});
