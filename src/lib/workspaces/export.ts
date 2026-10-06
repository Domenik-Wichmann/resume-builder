import type { Workspace } from "./model";
import { answerDisplay } from "../answer-display";
/** An explicit allowlist excludes source IDs, vectors, prompts, and attribution metadata. */
export function exportWorkspaceText(workspace: Workspace) {
  const lines = [
    workspace.demo
      ? "DEMO WORKSPACE · fictional career data"
      : "CAREER WORKSPACE",
    workspace.title,
    `Presentation: ${workspace.market}`,
  ];
  if (workspace.job_description)
    lines.push("\nROLE REQUIREMENTS", workspace.job_description);
  if (workspace.match)
    lines.push(
      "\nMATCH FINDINGS",
      answerDisplay(workspace.match.overall_summary),
      "Supported matches:",
      ...workspace.match.strong_matches.map(
        (item) => `- ${answerDisplay(item)}`,
      ),
      "Evidence gaps:",
      ...workspace.match.gaps.map((item) => `- ${item}`),
    );
  lines.push(
    "\nRELEVANT CAREER EVIDENCE",
    ...workspace.evidence.flatMap((record) => [
      record.title,
      record.subtitle,
      record.summary,
      record.skills.length ? `Skills: ${record.skills.join(", ")}` : "",
      "",
    ]),
  );
  lines.push(
    "\nQUESTIONS & ANSWERS",
    ...workspace.questions.flatMap((question) => [
      `Q: ${question.question}`,
      `A: ${answerDisplay(question.answer)}`,
      "",
    ]),
  );
  return lines.join("\n");
}
