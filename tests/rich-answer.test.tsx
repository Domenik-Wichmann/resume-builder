import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  richAnswerBlocks,
  plainRichAnswer,
} from "../src/lib/portfolio/rich-answer";
import { RichCareerAnswer } from "../src/components/rich-career-answer";
import { RichProjectEvidence } from "../src/components/rich-project-evidence";
import { projectContextSchema } from "../src/lib/portfolio/project-context";
import { RichRoleMatch } from "../src/components/rich-role-match";
const flow =
  "```career-flow\n" +
  JSON.stringify({
    title: "Fictional process",
    steps: [
      { title: "Receive", detail: "Keep the original." },
      { title: "Review", detail: "Inspect the changes." },
    ],
  }) +
  "\n```";

it("renders mixed grounded prose, comparison tables and bounded process diagrams", () => {
  const text = `A fictional example.\n\n## Design decisions\n- Keep context.\n\n${flow}\n\n| Stage | Purpose |\n| --- | --- |\n| Review | Inspect |`;
  const blocks = richAnswerBlocks(text);
  expect(blocks.map((b) => b.type)).toEqual([
    "text",
    "section",
    "flow",
    "table",
  ]);
  const html = renderToStaticMarkup(<RichCareerAnswer text={text} />);
  expect(html).toContain('aria-label="Fictional process"');
  expect(html).toContain("<table>");
  expect(html).toContain('scope="col"');
  expect(html).toContain('scope="row"');
  expect(html).not.toContain("```");
  expect(plainRichAnswer(text)).toContain("1. Receive: Keep the original.");
  expect(plainRichAnswer(text)).not.toContain('"steps"');
});

it("rejects executable or unbounded visual payloads and leaves hostile text inert", () => {
  for (const payload of [
    { title: "X", steps: [] },
    {
      title: "X",
      steps: Array.from({ length: 7 }, () => ({ title: "A", detail: "B" })),
    },
    {
      title: "X",
      steps: [
        { title: "A", detail: "B" },
        { title: "C", detail: "D" },
      ],
      html: "<script>alert(1)</script>",
    },
  ]) {
    expect(
      richAnswerBlocks(
        "```career-flow\n" + JSON.stringify(payload) + "\n```",
      )[0].type,
    ).toBe("unavailable");
  }
  const text =
    '## <img src=x onerror=alert(1)>\n<script>alert(1)</script>\n\n| Name | Value |\n| --- | --- |\n| X | <iframe src="javascript:alert(1)"> |';
  const html = renderToStaticMarkup(<RichCareerAnswer text={text} />);
  expect(html).not.toMatch(/<(script|iframe|img)\b/);
  expect(html).toContain("&lt;script&gt;");
  expect(richAnswerBlocks("```career-flow\nnot json\n```")[0].type).toBe(
    "unavailable",
  );
});

it("keeps ordinary old answers readable and safely exports presentation blocks", () => {
  expect(richAnswerBlocks("A short answer.")).toEqual([
    { type: "text", text: "A short answer." },
  ]);
  const text = "## Evidence\n- A fact.\n\n```python\nprint('example')\n```";
  expect(plainRichAnswer(text)).toContain("print('example')");
  expect(renderToStaticMarkup(<RichCareerAnswer text={text} />)).toContain(
    "<code>",
  );
});

it("keeps older project payloads compatible and rejects unsafe previews or destinations", () => {
  const legacy = {
    title: "Fictional",
    url: "/projects/fictional",
    links: [],
    images: [],
  };
  const project = projectContextSchema.parse({ projects: [legacy] })
    .projects[0];
  expect(project.skills).toEqual([]);
  expect(project.preview).toBeNull();
  expect(
    projectContextSchema.safeParse({
      projects: [
        {
          ...legacy,
          preview: {
            src: "https://private.example/image",
            alt: "x",
            label: "x",
          },
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    projectContextSchema.safeParse({
      projects: [{ ...legacy, url: "javascript:alert(1)" }],
    }).success,
  ).toBe(false);
  expect(
    renderToStaticMarkup(<RichProjectEvidence projects={[project]} />),
  ).toContain('href="/projects/fictional"');
});

it("does not repeat an identical role-fit answer as another supported match", () => {
  const html = renderToStaticMarkup(
    <RichRoleMatch
      match={{
        overall_summary: "Fictional supported work.",
        strong_matches: ["Fictional supported work."],
        supporting_experience: [],
        skills: [],
        gaps: ["Needs evidence."],
        suggested_resume_emphasis: [],
      }}
    />,
  );
  expect(html.match(/Fictional supported work\./g)).toHaveLength(1);
  expect(html).toContain("Needs further evidence");
});
