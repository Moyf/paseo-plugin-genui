import { describe, expect, it } from "vitest";
import { specProblems } from "./fallback";

const load = async () => ({ ok: false as const, error: "no files" });

describe("cards with only buttons", () => {
  it("refuses the two cards that hid their explanation", async () => {
    const decision = `Card("Fix the missing behavior", [
  Button("Do both (recommended)", Send("Do both"), variant: "primary"),
  Button("Only the clearer instructions", Send("Only instructions")),
  Other()
])`;
    const rowOfButtons = `Card("Fix genui instructions?", [Row([Button("Make both edits"), Button("Only one")])])`;
    for (const spec of [decision, rowOfButtons]) {
      expect((await specProblems(spec, load)).problems.join("\n")).toContain("only buttons");
    }
  });

  it("accepts buttons beside content", async () => {
    const spec = `Card("Which queue?", [Text("pg-boss reuses Postgres; BullMQ needs Redis."), Button("pg-boss"), Button("BullMQ")])`;
    expect((await specProblems(spec, load)).problems).toEqual([]);
  });
});
