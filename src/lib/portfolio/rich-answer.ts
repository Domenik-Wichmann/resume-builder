import { z } from "zod";

export const flowSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    steps: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(60),
            detail: z.string().trim().max(240),
          })
          .strict(),
      )
      .min(2)
      .max(6),
  })
  .strict();
export type AnswerFlow = z.infer<typeof flowSchema>;
export type AnswerBlock =
  | { type: "text"; text: string }
  | { type: "section"; title: string; text: string }
  | { type: "table"; headings: string[]; rows: string[][] }
  | { type: "flow"; flow: AnswerFlow }
  | { type: "code"; text: string }
  | { type: "unavailable" };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
const divider = (line: string) =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

/** Whitelisted presentation only: model text never becomes HTML, SVG or code. */
export function richAnswerBlocks(text: string): AnswerBlock[] {
  const lines = text.replace(/\r\n/g, "\n").slice(0, 12000).split("\n");
  const blocks: AnswerBlock[] = [];
  let pending: string[] = [],
    title = "";
  const flush = () => {
    const text = pending.join("\n").trim();
    if (title || text)
      blocks.push(
        title ? { type: "section", title, text } : { type: "text", text },
      );
    pending = [];
    title = "";
  };
  for (let i = 0; i < lines.length; i++) {
    const fence = /^\s*```([\w-]*)\s*$/.exec(lines[i]);
    if (fence) {
      flush();
      const body: string[] = [];
      while (++i < lines.length && !/^\s*```\s*$/.test(lines[i]))
        body.push(lines[i]);
      if (fence[1] === "career-flow" || fence[1] === "json") {
        try {
          const parsed = flowSchema.safeParse(JSON.parse(body.join("\n")));
          blocks.push(
            parsed.success
              ? { type: "flow", flow: parsed.data }
              : fence[1] === "career-flow"
                ? { type: "unavailable" }
                : { type: "code", text: body.join("\n") },
          );
        } catch {
          blocks.push(
            fence[1] === "career-flow"
              ? { type: "unavailable" }
              : { type: "code", text: body.join("\n") },
          );
        }
      } else blocks.push({ type: "code", text: body.join("\n") });
    } else if (lines[i].includes("|") && divider(lines[i + 1] || "")) {
      flush();
      const headings = cells(lines[i]);
      const rows: string[][] = [];
      i++;
      while (
        i + 1 < lines.length &&
        lines[i + 1].includes("|") &&
        lines[i + 1].trim()
      )
        rows.push(cells(lines[++i]));
      if (
        headings.length >= 2 &&
        headings.length <= 6 &&
        rows.length <= 20 &&
        rows.every((row) => row.length === headings.length)
      )
        blocks.push({ type: "table", headings, rows });
      else
        blocks.push({
          type: "text",
          text: [
            headings.join(" · "),
            ...rows.map((row) => row.join(" · ")),
          ].join("\n"),
        });
    } else {
      const heading = /^#{1,3}\s+(.+)$/.exec(lines[i]);
      if (heading) {
        flush();
        title = heading[1];
      } else pending.push(lines[i]);
    }
  }
  flush();
  return blocks;
}

export function plainRichAnswer(text: string): string {
  return richAnswerBlocks(text)
    .map((block) => {
      switch (block.type) {
        case "flow":
          return `${block.flow.title}\n${block.flow.steps.map((step, i) => `${i + 1}. ${step.title}: ${step.detail}`).join("\n")}`;
        case "table":
          return [
            block.headings.join(" | "),
            ...block.rows.map((row) => row.join(" | ")),
          ].join("\n");
        case "section":
          return `${block.title}\n${block.text}`;
        case "text":
        case "code":
          return block.text;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export const richAnswerInstruction = ` The answer is shown inside a rich career chat. Continue to return the same JSON answer and evidence_ids. Within answer, use short ## headings to group substantial examples into distinct visual cards. For a genuine comparison, use a compact Markdown pipe table (2–4 columns, no more than 8 rows); preserve uncertainty in cells. For a documented workflow or architecture sequence, you MAY add one fenced career-flow block containing ONLY JSON of this shape: {"title":"Short descriptive title","steps":[{"title":"Step name","detail":"Brief grounded explanation"},{"title":"Next step","detail":"Brief grounded explanation"}]}. Use the exact fence label career-flow. Use 2–6 steps, all directly established by the supplied CONFIRMED quotes; do not turn an unordered tool list into a process or invent order, causal links, results or implementation. Describe proposed designs as proposed in the diagram title and details. Place the diagram after a concise written explanation and avoid repeating all its details in prose. Never include executable code, HTML, SVG, Mermaid, arbitrary URLs or internal IDs in a visual block. Do not invent charts, proficiency scores, percentages, dates or metrics to decorate an answer. Simple questions need a simple answer, not forced cards or diagrams. Cite all supporting evidence in the existing evidence_ids field.`;
