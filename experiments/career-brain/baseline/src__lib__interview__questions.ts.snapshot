import type { Canonical } from "../ingestion/model";
export type InterviewQuestion = {
  id: string;
  question: string;
  reason: string;
  priority: number;
  record_key: string | null;
};
const probes = [
  {
    id: "ownership",
    question:
      "What did you personally design, build or own, and what did others contribute?",
    terms: /\b(owned|designed|built|implemented|led)\b/i,
  },
  {
    id: "adoption",
    question: "Who used this work, and how did you help them adopt it?",
    terms: /\b(users|adoption|trained|teams|clients)\b/i,
  },
  {
    id: "outcome",
    question:
      "What changed afterward? If you know the scale or time saved, what supports that estimate?",
    terms: /\b(saved|reduced|increased|improved|result|outcome)\b|\d/i,
  },
  {
    id: "purpose",
    question: "What problem existed beforehand, and why did solving it matter?",
    terms: /\b(problem|because|challenge|needed)\b/i,
  },
  {
    id: "stakeholders",
    question:
      "Who helped define the requirements, and how did you explain decisions to them?",
    terms: /\b(requirements|stakeholder|manager|communicat)\b/i,
  },
];
export function interviewQuestions(
  records: Canonical[],
  mode: "general" | "job" | "record",
  job: string,
  key: string | null,
  asked: string[] = [],
): InterviewQuestion[] {
  const active = records.filter(
    (row) =>
      !row.archived &&
      ["experience", "project", "achievement"].includes(row.kind),
  );
  const selected =
    mode === "record"
      ? active.filter((row) => `${row.kind}:${row.key}` === key)
      : active;
  const terms = [
    ...new Set(job.toLowerCase().match(/[a-z]{3,}/g) || []),
  ].filter(
    (term) => !["the", "and", "with", "for", "you", "this"].includes(term),
  );
  const candidates: InterviewQuestion[] = selected.flatMap((row) =>
    probes
      .filter((probe) => !probe.terms.test(row.summary))
      .map((probe) => {
        const relevance =
          mode === "job"
            ? terms.filter((term) =>
                `${row.title} ${row.summary} ${row.skill_keys.join(" ")}`
                  .toLowerCase()
                  .includes(term),
              ).length
            : 0;
        return {
          id: `${row.kind}:${row.key}:${probe.id}`,
          question: `About “${row.title}”: ${probe.question}`,
          reason: `${probe.id} is not explicit in the current evidence${relevance ? `; ${relevance} job terms overlap` : ""}. Missing documentation does not imply missing experience.`,
          priority:
            10 +
            Math.min(relevance, 10) * 3 +
            (row.summary.length < 100 ? 5 : 0),
          record_key: `${row.kind}:${row.key}`,
        };
      }),
  );
  if (!selected.length)
    candidates.push({
      id: "starting-point",
      question:
        "Describe one role or project: what problem did you work on, what did you personally do, and who benefited?",
      reason: "No active project or experience is stored yet.",
      priority: 30,
      record_key: null,
    });
  if (mode === "job")
    for (const term of terms
      .slice(0, 20)
      .filter(
        (term) =>
          !active.some((row) =>
            `${row.title} ${row.summary} ${row.skill_keys.join(" ")}`
              .toLowerCase()
              .includes(term),
          ),
      ))
      candidates.push({
        id: `job:${term}`,
        question: `This role mentions “${term}”. Can you describe a concrete task or project where you worked with it, if any? It is fine to say there is no example.`,
        reason:
          "The requirement has no explicit career evidence; investigate rather than assume a skill gap.",
        priority: 20,
        record_key: null,
      });
  return candidates
    .filter((row) => !asked.includes(row.id))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, 6);
}
