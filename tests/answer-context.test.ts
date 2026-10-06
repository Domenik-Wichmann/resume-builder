import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  answerEvidence,
  answerEvidenceLimit,
} from "../src/lib/ai/answer-evidence";
import type { Career, CareerRecord } from "../src/lib/career/model";
import { newWorkspace } from "../src/lib/workspaces/model";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  packets: vi.fn(),
  answer: vi.fn(),
}));
vi.mock("../src/lib/embeddings/retrieval", () => ({
  retrieveCareerEvidence: mocks.retrieve,
}));
vi.mock("../src/lib/career-brain/serving", () => ({
  publishedPackets: mocks.packets,
  answerPackets: mocks.answer,
}));
import { analyze } from "../src/lib/ai/service";

function record(
  id: string,
  title: string,
  extra: Partial<CareerRecord> = {},
): CareerRecord {
  return {
    id,
    title,
    slug: id,
    subtitle: "",
    summary: "Fictional test evidence.",
    skills: [],
    ...extra,
  };
}
function career(extra: Partial<Career> = {}): Career {
  return {
    profile: { name: "Fictional candidate", title: "", introduction: "" },
    experiences: [],
    projects: [],
    achievements: [],
    skills: [],
    skill_records: [],
    education: [],
    certifications: [],
    languages: [],
    demo: false,
    ...extra,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.packets.mockResolvedValue({
    actor: { name: "Fictional candidate", aliases: [], firstPersonOwner: true },
    packets: [],
  });
  mocks.answer.mockResolvedValue({
    answer: "Fictional verified answer.",
    evidence_ids: ["sql"],
  });
});
afterEach(() => vi.unstubAllEnvs());

it("finds published Dutch learning even when vector results contain only other languages", () => {
  const dutch = record("dutch", "Dutch", {
    summary:
      "Fictional candidate is learning Dutch; current level is not established.",
  });
  const german = record("german", "German");
  expect(
    answerEvidence(
      career({ languages: [dutch, german] }),
      [german],
      "Does he speak Dutch?",
    )[0],
  ).toEqual(dutch);
});
it("includes every published spoken language and connected work before noisy semantic candidates", () => {
  const languages = [
    "English",
    "German",
    "Mandarin Chinese",
    "Dutch",
    "Bulgarian",
  ].map((name) => record(name, name));
  const support = record("support", "Fictional support role", {
    skills: ["German"],
    related_ids: ["German"],
  });
  const teaching = record("teaching", "Fictional teaching role", {
    skills: ["English Teaching"],
  });
  const noise = Array.from({ length: 8 }, (_, i) =>
    record(`noise-${i}`, "Unrelated fictional project"),
  );
  const selected = answerEvidence(
    career({ languages, experiences: [support, teaching], projects: noise }),
    noise,
    "What languages does he speak?",
  );
  expect(selected.slice(0, 5)).toEqual(languages);
  expect(selected).toContainEqual(support);
  expect(selected).toContainEqual(teaching);
  expect(selected.length).toBeLessThanOrEqual(answerEvidenceLimit);
  expect(
    answerEvidence(
      career({ languages }),
      [],
      "What programming languages does he use?",
    ),
  ).toEqual([]);
});
it("adds concrete SQL jobs and projects even when skills occupy the retrieved slots", () => {
  const sql = record("sql", "SQL");
  const job = record("job", "Fictional feed operations", {
    skills: ["SQL"],
    related_ids: [sql.id],
    summary: "Fictional product-data cleaning and query analysis.",
  });
  const project = record("project", "Fictional reporting project", {
    skills: ["SQL"],
    related_ids: [sql.id],
    summary: "Fictional joins and validation queries.",
  });
  const noise = Array.from({ length: 8 }, (_, i) =>
    record(`skill-${i}`, "Other fictional skill"),
  );
  const selected = answerEvidence(
    career({
      skill_records: [sql, ...noise],
      experiences: [job],
      projects: [project],
    }),
    [sql, ...noise],
    "Has he worked with SQL?",
  );
  expect(selected.slice(0, 3)).toEqual([sql, job, project]);
});
it("covers a broad job history beyond the old eight-packet limit and stays bounded", () => {
  const experiences = Array.from({ length: 20 }, (_, i) =>
    record(`job-${i}`, `Fictional job ${i}`),
  );
  const selected = answerEvidence(
    career({ experiences }),
    experiences.slice(-8),
    "What jobs has he done?",
  );
  expect(selected).toEqual(experiences.slice(0, answerEvidenceLimit));
});
it("lets an explicit job-history question replace an earlier SQL topic", () => {
  const sql = record("sql", "SQL");
  const jobs = [
    record("chef", "Fictional chef"),
    record("teacher", "Fictional teacher"),
  ];
  const selected = answerEvidence(
    career({ experiences: jobs, skill_records: [sql] }),
    [sql],
    "What jobs has he done, specifically?",
    "Earlier question: has he worked with SQL?",
  );
  expect(selected.slice(0, 2)).toEqual(jobs);
});
it("uses fresh public content and excludes IDs absent from the published career", () => {
  const sql = record("sql", "SQL", { summary: "Current fictional evidence." });
  const privateProject = record("private", "Private fictional project", {
    related_ids: [sql.id],
  });
  expect(
    answerEvidence(
      career({ skill_records: [sql] }),
      [{ ...sql, summary: "Stale or injected text." }, privateProject],
      "SQL",
    ),
  ).toEqual([sql]);
});
it("rechecks selected language evidence before generation, without requiring a language embedding", async () => {
  const dutch = record("dutch", "Dutch");
  mocks.retrieve.mockResolvedValue([]);
  mocks.answer.mockResolvedValue({
    answer: "Fictional candidate is learning Dutch.",
    evidence_ids: [dutch.id],
  });
  const result = await analyze(
    "ask",
    "Does he speak Dutch?",
    undefined,
    {},
    career({ languages: [dutch] }),
  );
  expect(mocks.packets).toHaveBeenCalledWith(
    [dutch.id],
    undefined,
    answerEvidenceLimit,
  );
  expect(result.evidence).toEqual([dutch]);
});
it("resolves a follow-up from questions without treating previous answer prose as evidence", async () => {
  const sql = record("sql", "SQL");
  mocks.retrieve.mockResolvedValue([sql]);
  const workspace = {
    ...newWorkspace("test", "US", false),
    questions: [
      {
        question: "Has he worked with SQL?",
        answer: "Invented previous model prose must never become proof.",
        evidence_ids: [],
        topics: [],
        created_at: "2026-10-06",
      },
    ],
  };
  await analyze(
    "ask",
    "What did he work on with it?",
    workspace,
    {},
    career({ skill_records: [sql] }),
  );
  expect(mocks.retrieve.mock.calls[0][0][1]).toContain(
    "Has he worked with SQL?",
  );
  expect(JSON.stringify(mocks.retrieve.mock.calls)).not.toContain(
    "Invented previous model prose",
  );
  expect(mocks.answer.mock.calls[0][4].turns[0]).toMatchObject({
    question: "Has he worked with SQL?",
    answer: "Invented previous model prose must never become proof.",
  });
});

it("recovers fresh citations for ordinal follow-ups without a keyword gate", async () => {
  const sql = record("sql", "Fictional second project", {
    summary: "Fresh public evidence.",
  });
  mocks.retrieve.mockResolvedValue([]);
  const workspace = newWorkspace("test", "US", false);
  workspace.questions.push({
    question: "List two projects",
    answer: "1. First. 2. Second.",
    evidence_ids: ["removed", "sql"],
    topics: [],
    created_at: "2026-10-06",
  });
  const result = await analyze(
    "ask",
    "And the second one?",
    workspace,
    {},
    career({ projects: [sql] }),
  );
  expect(result.evidence).toEqual([sql]);
  expect(mocks.packets).toHaveBeenCalledWith(
    ["sql"],
    undefined,
    answerEvidenceLimit,
  );
  expect(mocks.answer.mock.calls[0][4].turns[0].answer).toBe(
    "1. First. 2. Second.",
  );
  expect(mocks.retrieve.mock.calls[0][0]).toHaveLength(2);
});
it("keeps provider conversation isolated between workspaces", async () => {
  const sql = record("sql", "SQL");
  mocks.retrieve.mockResolvedValue([sql]);
  const first = newWorkspace("first", "US", false);
  first.questions.push({
    question: "Private first question",
    answer: "Private first answer",
    evidence_ids: ["sql"],
    topics: [],
    created_at: "2026-10-06",
  });
  await analyze("ask", "SQL", first, {}, career({ skill_records: [sql] }));
  await analyze(
    "ask",
    "SQL",
    newWorkspace("second", "US", false),
    {},
    career({ skill_records: [sql] }),
  );
  expect(mocks.answer.mock.calls[1][4].turns).toEqual([]);
  expect(JSON.stringify(mocks.answer.mock.calls[1])).not.toContain(
    "Private first",
  );
});
