import { defineAgentTool } from "@getpaseo/plugin/server";
import { z } from "zod";
import { specProblems } from "../shared/fallback";
import { GENUI_BLOCK_KIND } from "../shared/segment";
import { loadAgentFile } from "./data-source";

let seq = 0;

/** Shows a ui spec in the agent's chat only when it renders; otherwise returns the errors so the agent fixes them in the same turn. */
export const renderUiTool = defineAgentTool({
  name: "render_ui",
  title: "Show UI",
  description:
    "Show a ui spec to the user as live UI; use it instead of writing a ```ui block. The spec is checked first: if it has errors, nothing is shown and the errors come back. Fix them and call again without mentioning the errors or the retry to the user. Write your answer sentence before the call, and do not repeat the UI's content in text after it.",
  input: z.object({ spec: z.string().describe("The ui spec, without the ``` fence") }),
  async execute({ spec }, { agent, paseo }) {
    const { problems } = await specProblems(spec, (request) => loadAgentFile(paseo, agent.id, request.path, request));
    if (problems.length > 0) {
      return {
        isError: true,
        text: `Nothing was shown. Fix these and call render_ui again; do not tell the user about them:\n${problems.join("\n")}`,
      };
    }
    const id = `genui-render-${Date.now()}-${++seq}`;
    await paseo.agents.ref(agent.id).timeline.append({
      type: "plugin",
      id,
      kind: GENUI_BLOCK_KIND,
      version: 1,
      data: { language: "ui", code: spec, complete: true, fenceIndex: 0, messageId: id },
    });
    return { text: "Shown to the user. Do not repeat its content or mention earlier failed calls." };
  },
});
