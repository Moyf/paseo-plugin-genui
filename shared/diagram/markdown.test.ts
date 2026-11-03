import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline links", () => {
  it("reads a Markdown link", () => {
    expect(parseInline("see [the docs](https://paseo.sh/docs) now")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", content: [{ kind: "text", text: "the docs" }], url: "https://paseo.sh/docs" },
      { kind: "text", text: " now" },
    ]);
  });

  it("links a bare URL without its trailing punctuation", () => {
    expect(parseInline("go to https://paseo.sh/a_b_c.")).toEqual([
      { kind: "text", text: "go to " },
      {
        kind: "link",
        content: [{ kind: "text", text: "https://paseo.sh/a_b_c" }],
        url: "https://paseo.sh/a_b_c",
      },
      { kind: "text", text: "." },
    ]);
  });

  it("leaves a URL inside code alone", () => {
    expect(parseInline("`https://paseo.sh`")).toEqual([{ kind: "code", text: "https://paseo.sh" }]);
  });

  it("shows a link with an unsafe scheme as its text", () => {
    expect(parseInline("[x](javascript:void)")).toEqual([{ kind: "text", text: "x" }]);
  });

  it("keeps the authored target when a highlighted label looks like a URL", () => {
    expect(parseInline("[==https://label.dev==](https://target.dev)")).toEqual([
      {
        kind: "link",
        url: "https://target.dev",
        content: [{ kind: "highlight", content: [{ kind: "text", text: "https://label.dev" }] }],
      },
    ]);
  });
});

describe("Markdown highlights", () => {
  it("reads adjacent Chinese highlights without adding spaces", () => {
    expect(parseInline("前==高亮格式==后==第二处==。")).toEqual([
      { kind: "text", text: "前" },
      { kind: "highlight", content: [{ kind: "text", text: "高亮格式" }] },
      { kind: "text", text: "后" },
      { kind: "highlight", content: [{ kind: "text", text: "第二处" }] },
      { kind: "text", text: "。" },
    ]);
  });

  it("keeps emphasis, code and links inside a highlight", () => {
    expect(parseInline("==**重要：**请读 `file.ts` 和 [文档](https://paseo.sh)==")).toEqual([
      {
        kind: "highlight",
        content: [
          { kind: "bold", content: [{ kind: "text", text: "重要：" }] },
          { kind: "text", text: "请读 " },
          { kind: "code", text: "file.ts" },
          { kind: "text", text: " 和 " },
          { kind: "link", content: [{ kind: "text", text: "文档" }], url: "https://paseo.sh" },
        ],
      },
    ]);
  });

  it.each([
    ["**前==高亮==后**", "bold"],
    ["*前==高亮==后*", "italic"],
    ["[前==高亮==后](https://paseo.sh)", "link"],
  ])("reads highlights nested in %s", (source, kind) => {
    expect(parseInline(source)[0]).toMatchObject({
      kind,
      content: [
        { kind: "text", text: "前" },
        { kind: "highlight", content: [{ kind: "text", text: "高亮" }] },
        { kind: "text", text: "后" },
      ],
    });
  });

  it.each(["==", "====", "===literal===", "==unfinished", "== padded ==", "==two\nlines=="])(
    "keeps invalid or unfinished delimiters literal: %s",
    (source) => {
      expect(parseInline(source)).toEqual([{ kind: "text", text: source }]);
    },
  );

  it("keeps escaped delimiters literal", () => {
    expect(parseInline(String.raw`\=\=literal\=\= and \==literal==`)).toEqual([
      { kind: "text", text: "==literal== and ==literal==" },
    ]);
  });

  it.each(["`==literal==`", "``==literal ` code==``"])(
    "keeps highlight markers literal inside code: %s",
    (source) => {
      expect(parseInline(source)).toEqual([{ kind: "code", text: source.replace(/^`+|`+$/g, "") }]);
    },
  );

  it("skips a delimiter inside inline code when closing a highlight", () => {
    expect(parseInline("==use `a==b` here==")).toEqual([
      {
        kind: "highlight",
        content: [
          { kind: "text", text: "use " },
          { kind: "code", text: "a==b" },
          { kind: "text", text: " here" },
        ],
      },
    ]);
  });

  it("keeps equals signs in a highlighted link target", () => {
    expect(parseInline("==[文档](https://paseo.sh?q=a==b)==")).toEqual([
      {
        kind: "highlight",
        content: [
          {
            kind: "link",
            content: [{ kind: "text", text: "文档" }],
            url: "https://paseo.sh?q=a==b",
          },
        ],
      },
    ]);
  });

  it("keeps code fences literal while highlighting prose blocks", () => {
    expect(parseMarkdown("# ==标题==\n\n- ==项目==\n\n> ==引用==\n\n```md\n==原文==\n```")).toEqual(
      [
        {
          kind: "heading",
          level: 1,
          content: [{ kind: "highlight", content: [{ kind: "text", text: "标题" }] }],
        },
        {
          kind: "bullet",
          items: [[{ kind: "highlight", content: [{ kind: "text", text: "项目" }] }]],
        },
        {
          kind: "quote",
          content: [{ kind: "highlight", content: [{ kind: "text", text: "引用" }] }],
        },
        { kind: "code", language: "md", text: "==原文==" },
      ],
    );
  });
});

describe("parseInline underscores", () => {
  it("keeps underscores inside identifiers as text", () => {
    const spans = parseInline(
      "One migration for: review_gate per project, task_checks, task_ideas, task_links.",
    );
    expect(spans.every((span) => span.kind === "text")).toBe(true);
    expect(spans.map((span) => (span.kind === "text" ? span.text : "")).join("")).toBe(
      "One migration for: review_gate per project, task_checks, task_ideas, task_links.",
    );
  });

  it("still reads _word_ and __word__ at word boundaries", () => {
    expect(parseInline("an _important_ step")[1]).toEqual({
      kind: "italic",
      content: [{ kind: "text", text: "important" }],
    });
    expect(parseInline("a __bold__ word")[1]).toEqual({
      kind: "bold",
      content: [{ kind: "text", text: "bold" }],
    });
  });
});
