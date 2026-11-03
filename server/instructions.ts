import path from "node:path";
import { buildFullInstructions } from "../shared/instructions";
import { agentStorageDir } from "./data-source";

export function buildAgentInstructions(
  webLookups: boolean,
  extraFolders: readonly string[] = [],
  agentId?: string,
): string {
  const directory = path.resolve(agentStorageDir(agentId ?? "")).replaceAll(path.sep, "/");
  const storage = agentId
    ? `Your absolute thread storage directory is ${JSON.stringify(directory)}.`
    : `Your thread storage directory is the absolute root ${JSON.stringify(directory)} joined with your PASEO_AGENT_ID. Paseo already supplies PASEO_AGENT_ID to each session's shell environment. Read it as $env:PASEO_AGENT_ID in PowerShell or $PASEO_AGENT_ID in POSIX shells; do not use the native OpenCode session ID.`;
  return buildFullInstructions(
    webLookups,
    extraFolders,
    `# Thread storage\n${storage}\nUse this directory for generated reports and assets, creating it if needed. Replace <thread-storage> in shell examples with the resolved absolute path and quote paths when needed. $BB_THREAD_STORAGE and $PASEO_THREAD_STORAGE are file aliases for Load, Snippet and Image, not exported shell variables. A render_ui tool is not required to save files or display inline ui blocks.`,
  );
}
