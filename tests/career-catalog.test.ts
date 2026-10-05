import { beforeEach, expect, it, vi } from "vitest";
import { primaryAccountId } from "../src/lib/account-id";
const mocks = vi.hoisted(() => ({ load: vi.fn(), answers: vi.fn(), db: {} }));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: mocks.load,
}));
vi.mock("../src/lib/portfolio/answers-server", () => ({
  publicAnswers: mocks.answers,
}));
vi.mock("../src/lib/db", () => ({ database: () => mocks.db }));
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
import { GET } from "../src/app/api/career-catalog/route";
const claim = {
  value: "Approved fact",
  availability: "CONFIRMED",
  attribution: "EXPLICIT",
  evidence: [{ start: 0, end: 4, quote: "fact", source_id: "private-source" }],
};
const record = {
  id: "published",
  key: "published",
  kind: "experience",
  title: "Published role",
  subtitle: "",
  published: true,
  archived: false,
  claims: [claim],
  skill_keys: [],
  organization: null,
  start_date: null,
  end_date: null,
  hash: "private-hash",
  account_id: "private-account",
  notes: "private note",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.answers.mockResolvedValue([]);
});
it("requests primary-account public evidence and excludes private, archived and unsupported records", async () => {
  mocks.load.mockResolvedValue([
    record,
    { ...record, id: "private", published: false },
    { ...record, id: "archived", archived: true },
    {
      ...record,
      id: "uncertain",
      claims: [{ ...claim, attribution: "UNCERTAIN" }],
    },
  ]);
  const response = await GET();
  const body = await response.json();
  expect(mocks.load).toHaveBeenCalledWith(mocks.db, primaryAccountId, true);
  expect(body.career.experiences.map((row: { id: string }) => row.id)).toEqual([
    "published",
  ]);
  const text = JSON.stringify(body);
  for (const secret of [
    "private-source",
    "private-hash",
    "private-account",
    "private note",
  ])
    expect(text).not.toContain(secret);
  expect(body.career.experiences[0].summary).toBe("Approved fact");
});
it("only exposes reviewed answer text without owner or source metadata", async () => {
  mocks.load.mockResolvedValue([]);
  mocks.answers.mockResolvedValue([
    {
      question: "Question",
      answer: "Reviewed answer",
      account_id: "private",
      sources: [{ id: "private" }],
    },
  ]);
  const body = await (await GET()).json();
  expect(body.answers).toEqual([
    { question: "Question", answer: "Reviewed answer" },
  ]);
});
