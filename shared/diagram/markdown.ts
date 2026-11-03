/**
 * A small Markdown subset for the prose around a diagram.
 *
 * Taking over a timeline item means taking over its text too, so this exists to
 * keep that text readable. It covers what agents actually write around a
 * diagram: headings, paragraphs, lists, code, inline emphasis and highlights.
 * Anything else survives as plain text rather than as broken markup.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; content: Inline[] }
  | { kind: "italic"; content: Inline[] }
  | { kind: "highlight"; content: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; content: Inline[]; url: string };

export type Block =
  | { kind: "heading"; level: number; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "bullet"; items: Inline[][] }
  | { kind: "ordered"; items: Inline[][]; start: number }
  | { kind: "code"; language: string; text: string }
  | { kind: "quote"; content: Inline[] }
  | { kind: "rule" };

const CODE = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/;
const ESCAPE = /\\[\\`*_=]/;
const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;
// A bare URL drops trailing punctuation, so "see https://x.dev." links to https://x.dev.
const INLINE = new RegExp(
  `${CODE.source}|${ESCAPE.source}|${LINK.source.slice(1, -1)}|` +
    String.raw`https?:\/\/[^\s<>]*[^\s<>.,;:!?'"\)\]*_]|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|==`,
  "g",
);
// A delimiter inside code or a link target does not close the surrounding highlight.
const HIGHLIGHT_TOKEN = new RegExp(
  `${CODE.source}|${ESCAPE.source}|${LINK.source.slice(1, -1)}|==`,
  "g",
);

const WORD_CHAR = /[A-Za-z0-9]/;

/** `_x_` inside a word, as in review_gate_per_project, is not emphasis (CommonMark's rule). */
function intraword(text: string, start: number, length: number): boolean {
  return (
    WORD_CHAR.test(text.slice(start - 1, start)) ||
    WORD_CHAR.test(text.slice(start + length, start + length + 1))
  );
}

function delimiter(text: string, index: number): boolean {
  return text[index - 1] !== "=" && text[index + 2] !== "=";
}

function highlightEnd(text: string, start: number): number {
  if (!delimiter(text, start) || !/\S/.test(text[start + 2] ?? "")) return -1;
  const newline = text.indexOf("\n", start);
  const rest = text.slice(start + 2, newline < 0 ? text.length : newline);
  for (const match of rest.matchAll(HIGHLIGHT_TOKEN)) {
    const end = start + 2 + match.index;
    if (match[0] === "==" && delimiter(text, end) && /\S/.test(text[end - 1])) return end;
  }
  return -1;
}

function inlineToken(piece: string, source: string, start: number, allowLinks: boolean): Inline {
  if (piece.startsWith("\\")) return { kind: "text", text: piece.slice(1) };
  const ticks = /^`+/.exec(piece)?.[0];
  if (ticks) return { kind: "code", text: piece.slice(ticks.length, -ticks.length) };
  if (piece.startsWith("_") && intraword(source, start, piece.length))
    return { kind: "text", text: piece };
  const link = LINK.exec(piece);
  if (link) {
    // Only web and mail links open; any other scheme shows as its text.
    return allowLinks && /^(https?:|mailto:)/i.test(link[2])
      ? { kind: "link", content: parseInline(link[1], false), url: link[2] }
      : { kind: "text", text: link[1] };
  }
  if (/^https?:\/\//.test(piece))
    return allowLinks
      ? { kind: "link", content: [{ kind: "text", text: piece }], url: piece }
      : { kind: "text", text: piece };
  const bold = piece.startsWith("**") || piece.startsWith("__");
  return {
    kind: bold ? "bold" : "italic",
    content: parseInline(piece.slice(bold ? 2 : 1, bold ? -2 : -1), allowLinks),
  };
}

function appendInline(out: Inline[], span: Inline): void {
  const last = out.at(-1);
  if (last?.kind === "text" && span.kind === "text") last.text += span.text;
  else out.push(span);
}

export function parseInline(text: string, allowLinks = true): Inline[] {
  const out: Inline[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index < cursor) continue;
    if (match.index > cursor)
      appendInline(out, { kind: "text", text: text.slice(cursor, match.index) });
    cursor = match.index + match[0].length;
    if (match[0] === "==") {
      const end = highlightEnd(text, match.index);
      if (end < 0) appendInline(out, { kind: "text", text: "==" });
      else {
        out.push({ kind: "highlight", content: parseInline(text.slice(cursor, end), allowLinks) });
        cursor = end + 2;
      }
    } else appendInline(out, inlineToken(match[0], text, match.index, allowLinks));
  }
  if (cursor < text.length) appendInline(out, { kind: "text", text: text.slice(cursor) });
  return out;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])\s*(?:\1\s*){2,}$/;
const FENCE = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split("\n");
  let paragraph: string[] = [];

  const flush = () => {
    const text = paragraph.join(" ").trim();
    if (text.length > 0) blocks.push({ kind: "paragraph", content: parseInline(text) });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: "code", language: fence[2], text: body.join("\n") });
      continue;
    }

    if (line.trim().length === 0) {
      flush();
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, content: parseInline(heading[2]) });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      const items: Inline[][] = [parseInline(bullet[1])];
      while (index + 1 < lines.length) {
        const next = BULLET.exec(lines[index + 1]);
        if (!next) break;
        items.push(parseInline(next[1]));
        index += 1;
      }
      blocks.push({ kind: "bullet", items });
      continue;
    }

    const ordered = ORDERED.exec(line);
    if (ordered) {
      flush();
      const items: Inline[][] = [parseInline(ordered[2])];
      while (index + 1 < lines.length) {
        const next = ORDERED.exec(lines[index + 1]);
        if (!next) break;
        items.push(parseInline(next[2]));
        index += 1;
      }
      blocks.push({ kind: "ordered", items, start: Number(ordered[1]) });
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      flush();
      blocks.push({ kind: "quote", content: parseInline(quote[1]) });
      continue;
    }

    paragraph.push(line.trim());
  }

  flush();
  return blocks;
}
