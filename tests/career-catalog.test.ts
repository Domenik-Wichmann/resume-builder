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
import {
  catalogSchema,
  catalogGroups,
  catalogRecords,
} from "../src/lib/career/catalog";
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
it("keeps a confirmed public certificate visible without inventing dates or hiding it in skill groups", async () => {
  const certificate = {
    ...record,
    kind: "certification",
    id: "confirmed-certificate",
    title: "Fictional test certificate",
    claims: [{ ...claim, value: "Holds the fictional test certificate." }],
  };
  mocks.load.mockResolvedValue([
    certificate,
    { ...certificate, id: "private-certificate", published: false },
    { ...certificate, id: "archived-certificate", archived: true },
    {
      ...certificate,
      id: "pending-certificate",
      claims: [{ ...claim, availability: "PENDING_REVIEW" }],
    },
  ]);
  const catalog = catalogSchema.parse(await (await GET()).json());
  const certificates = catalogRecords(catalog, "certifications");
  expect(certificates).toHaveLength(1);
  expect(certificates[0]).toMatchObject({
    id: "confirmed-certificate",
    title: "Fictional test certificate",
    summary: "Holds the fictional test certificate.",
    start_date: null,
    end_date: null,
  });
  expect(catalogGroups(catalog, "certifications")).toEqual([]);
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

it("groups only verified public categories and skills without leaking hidden relationships", async () => {
  const category = {
    ...record,
    kind: "category",
    id: "development",
    key: "development",
    title: "Development",
  };
  const skill = {
    ...record,
    kind: "skill",
    id: "typescript",
    key: "typescript",
    title: "TypeScript",
    category_key: "development",
  };
  mocks.load.mockResolvedValue([
    category,
    skill,
    { ...skill, id: "private-skill", published: false },
    { ...skill, id: "archived-skill", archived: true },
    { ...skill, id: "unsupported-skill", claims: [] },
    {
      ...category,
      id: "hidden-category",
      key: "secret-category",
      title: "Secret label",
      published: false,
    },
    {
      ...category,
      id: "archived-category",
      key: "archived-category",
      title: "Archived label",
      archived: true,
    },
    {
      ...category,
      id: "unsupported-category",
      key: "unsupported-category",
      title: "Unsupported label",
      claims: [],
    },
    {
      ...category,
      id: "empty-category",
      key: "empty-category",
      title: "Empty label",
    },
    { ...skill, id: "unassigned", category_key: null },
    { ...skill, id: "hidden-parent", category_key: "secret-category" },
    { ...skill, id: "archived-parent", category_key: "archived-category" },
    {
      ...skill,
      id: "unsupported-parent",
      category_key: "unsupported-category",
    },
  ]);
  const body = await (await GET()).json();
  const catalog = catalogSchema.parse(body);
  expect(catalog.skill_categories).toEqual([
    { id: "development", title: "Development", skill_ids: ["typescript"] },
  ]);
  const grouped = catalogGroups(catalog, "skill_records").flatMap(
    (group) => group.recordIds,
  );
  expect(
    catalog.career.skill_records
      .filter((row) => !grouped.includes(row.id))
      .map((row) => row.id),
  ).toEqual([
    "unassigned",
    "hidden-parent",
    "archived-parent",
    "unsupported-parent",
  ]);
  for (const secret of [
    "Secret label",
    "Archived label",
    "Unsupported label",
    "secret-category",
    "private-skill",
    "private-source",
    "private-hash",
  ])
    expect(JSON.stringify(body)).not.toContain(secret);
});
it("language browsing never reveals private or unsupported proficiency and preserves public work-only evidence", async () => {
  const category = {
    ...record,
    kind: "category",
    id: "language-category",
    key: "languages",
    title: "Languages",
  };
  const skill = {
    ...record,
    kind: "skill",
    id: "german-skill",
    key: "german-skill",
    category_key: "languages",
    title: "German",
  };
  const language = {
    ...record,
    kind: "language",
    id: "german-language",
    key: "german-language",
    title: "German",
    claims: [{ ...claim, value: "Below native" }],
  };
  mocks.load.mockResolvedValue([
    category,
    skill,
    language,
    {
      ...language,
      id: "private-language",
      title: "Secret language",
      published: false,
    },
    {
      ...language,
      id: "unsupported-language",
      title: "Unsupported language",
      claims: [],
    },
    {
      ...language,
      id: "archived-language",
      title: "Archived language",
      archived: true,
    },
  ]);
  const body = await (await GET()).json();
  const catalog = catalogSchema.parse(body);
  const languages = catalogRecords(catalog, "languages");
  expect(languages.map((row) => row.id)).toEqual([language.id]);
  expect(catalogRecords(catalog, "skill_records")).toEqual(languages);
  expect(languages[0].summary).toBe("Below native");
  for (const secret of [
    "Secret language",
    "Unsupported language",
    "Archived language",
    "private-source",
  ])
    expect(JSON.stringify(body)).not.toContain(secret);
  mocks.load.mockResolvedValue([
    category,
    skill,
    { ...language, published: false },
  ]);
  const privateCatalog = catalogSchema.parse(await (await GET()).json());
  expect(
    catalogRecords(privateCatalog, "languages").map((row) => row.id),
  ).toEqual([skill.id]);
  expect(catalogRecords(privateCatalog, "languages")[0].summary).toBe(
    "Approved fact",
  );
});
