import "server-only";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { complete } from "../src/lib/ai/openrouter";
import { primaryAccountId } from "../src/lib/account-id";
import {
  emptyMemory,
  type Session,
  type Message,
} from "../src/lib/interview/model";
import { demoSession } from "../src/lib/interview/demo";
import {
  interviewInstructions,
  planSchema,
  planningContext,
  validatePlan,
} from "../src/lib/interview/planning";
import {
  searchCareer,
  inspectRequirement,
} from "../src/lib/interview/retrieval";
import type { BrainRecord } from "../src/lib/career-brain/repository";

// Controlled synthetic qualification only. No owner evidence is read or changed.
// Provider accounting uses the existing primary-account usage ledger.
if (process.env.APP_MODE !== "live")
  throw new Error(
    "Live qualification requires explicit APP_MODE=live and configured providers.",
  );
function fictionalRecord(title: string, values: string[]): BrainRecord {
  return {
    id: randomUUID(),
    kind: "project",
    key: title.toLowerCase().replaceAll(" ", "-"),
    title,
    subtitle: "Fictional qualification fixture",
    summary: values.join(" "),
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: values[0],
    published: false,
    archived: false,
    hash: "a".repeat(64),
    updated_at: "2026-10-08T00:00:00Z",
    evidence_version: null,
    aliases: [],
    uncertainties: [],
    claims: values.map((value) => ({
      attribute: "action",
      value,
      availability: "CONFIRMED",
      attribution: "PERSONAL",
      evidence: [{ quote: value, start: 0, end: value.length }],
    })),
  };
}
const automation = fictionalRecord("Fictional Coupa validation tool", [
  "I built validation rules and a SQL checking tool.",
  "Two coworkers used the validation tool.",
]);
const sql = fictionalRecord("Fictional database work", [
  "I wrote SQL joins, window functions, and query plans to implement reporting.",
  "I used SQL daily to validate customer data and troubleshoot reporting queries.",
]);
const builder = fictionalRecord("Fictional Resume Builder", [
  "I implemented a retrieval service with relational records and embeddings.",
]);
const records = [automation, sql, builder];
function msg(
  role: Message["role"],
  content: string,
  sequence: number,
): Message {
  return {
    id: randomUUID(),
    session_id: demoSession.id,
    role,
    content,
    sequence,
    rationale: "",
    created_at: "2026-10-08T00:00:00Z",
  };
}
const base: Session = {
  ...demoSession,
  id: randomUUID(),
  title: "Fictional controlled scenario",
  job_description: "",
  state: emptyMemory(),
  turn_count: 0,
};
const scenarios: [string, Session, Message[]][] = [
  ["A — general discovery", { ...base, mode: "general" }, []],
  [
    "B/C — partial adoption, strong SQL",
    {
      ...base,
      mode: "job",
      job_description:
        "Fictional Senior Automation Analyst. Requires strong SQL, introducing automation to coworkers, training and change adoption.",
    },
    [],
  ],
  [
    "D — explicit no",
    {
      ...base,
      mode: "job",
      job_description:
        "Fictional role requires AWS, process automation, and stakeholder communication.",
    },
    [
      msg(
        "assistant",
        "Have you used AWS in a job or project, even briefly?",
        1,
      ),
      msg("user", "No, I have never used AWS.", 2),
    ],
  ],
  [
    "E — unexpected language evidence",
    { ...base, mode: "role", target_role: "AI transformation analyst" },
    [
      msg("assistant", "Who besides you used the validation tool?", 1),
      msg(
        "user",
        "A couple coworkers. I showed one of them the regex rules because their files were different. I also explained technical failures to a client in German.",
        2,
      ),
    ],
  ],
  [
    "Record deep dive",
    { ...base, mode: "record", target_record_id: builder.id },
    [],
  ],
  [
    "Metric uncertainty",
    { ...base, mode: "record", target_record_id: automation.id },
    [
      msg(
        "assistant",
        "Do you remember roughly how much time the tool saved?",
        1,
      ),
      msg(
        "user",
        "I genuinely do not remember. I cannot give a reliable estimate.",
        2,
      ),
    ],
  ],
];
const sections: string[] = [
  "# Career Interview live synthetic qualification",
  "All career facts, job descriptions, and owner answers in this report are fictional controlled fixtures. These selected questions are model outputs, not canonical career evidence. The existing provider wrapper records token/cost usage. No private Career Brain records are read and no canonical records, sources, or interviews are written.",
];
let failures = 0;
for (const [name, session, messages] of scenarios) {
  const query = [
    session.target_role,
    session.job_description,
    messages.at(-1)?.content,
  ].join(" ");
  const evidence = searchCareer(records, query, session.target_record_id);
  const requirements = ["SQL", "Change adoption", "AWS"].map((r) =>
    inspectRequirement(records, r),
  );
  try {
    const raw = await complete(
      interviewInstructions,
      JSON.stringify(
        planningContext(session, messages, evidence, requirements),
      ),
      planSchema,
      {
        model: process.env.CAREER_INTERVIEW_MODEL || "openai/gpt-6-luna-pro",
        maxTokens: 4500,
        timeoutMs: 90000,
        usage: {
          accountId: primaryAccountId,
          operation: "career_interview_qualification",
        },
      },
    );
    const result = validatePlan(raw, session, messages, evidence, requirements);
    sections.push(
      `## ${name}\n\n${result.question}\n\nRationale: ${result.rationale}\n\nFocus: ${result.state.focus}\n\nDenials: ${result.state.denials.join(", ") || "None"}\n\nUnresolved: ${result.state.unresolved.join("; ") || "None"}`,
    );
    console.log(`${name}: structured output and application guards passed`);
  } catch {
    failures++;
    sections.push(
      `## ${name}\n\nProvider or application validation failed; no canonical data changed.`,
    );
    console.log(`${name}: failed`);
  }
}
sections.push(
  "## Persistence and review\n\nScenarios F/G are covered separately by committed-migration PGlite tests: fresh reads, independent sessions, archived history, tenant isolation, answer-first retries, atomic reviewed drafts, preserved owner-only sources, and unchanged canonical records.",
);
await writeFile(
  "docs/qualification/career-interview-live.md",
  sections.join("\n\n") + "\n",
);
if (failures) process.exitCode = 1;
