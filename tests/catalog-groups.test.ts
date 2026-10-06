import { expect, it } from "vitest";
import {
  catalogGroups,
  catalogRecords,
  type Catalog,
} from "../src/lib/career/catalog";
import { languagesGroupId } from "../src/lib/career/grouping";
import { fixture } from "../src/lib/career/fixture";

const catalog: Catalog = { career: fixture, skill_categories: [], answers: [] };

it("groups work and education by stored organizations and leaves missing organizations unassigned", () => {
  const rows = [
    { ...fixture.projects[0], id: "a", organization: "Example Studio" },
    { ...fixture.projects[0], id: "b", organization: " Example Studio " },
    {
      ...fixture.projects[0],
      id: "c",
      organization: null,
      title: "Work for Imaginary Company",
    },
    { ...fixture.projects[0], id: "d", organization: "  " },
  ];
  for (const category of [
    "experiences",
    "projects",
    "achievements",
    "education",
    "certifications",
  ] as const) {
    const groups = catalogGroups(
      { ...catalog, career: { ...fixture, [category]: rows } },
      category,
    );
    expect(groups).toEqual([
      {
        id: "organization:example studio",
        title: "Example Studio",
        recordIds: ["a", "b"],
      },
    ]);
  }
});

it("uses the same language records in both entry points, preserves learning status, and keeps work-only language evidence", () => {
  const make = (id: string, title: string, summary = "Fictional evidence") => ({
    ...fixture.skill_records[0],
    id,
    title,
    summary,
  });
  const germanSkill = make(
    "german-skill",
    " German ",
    "Fictional support work",
  );
  const other = make(
    "work-only",
    "Fictional language",
    "Work evidence; no proficiency level",
  );
  const languages = [
    make("german", "German", "Below native"),
    make("english", "English", "Native"),
    make("dutch", "Dutch", "Learning; no confirmed proficiency"),
  ];
  const data: Catalog = {
    ...catalog,
    career: {
      ...fixture,
      skill_records: [...fixture.skill_records, germanSkill, other],
      languages,
    },
    skill_categories: [
      {
        id: "language-category",
        title: "Languages",
        skill_ids: [germanSkill.id, other.id],
      },
    ],
  };
  const list = catalogRecords(data, "languages");
  const group = catalogGroups(data, "skill_records").find(
    (entry) => entry.id === languagesGroupId,
  )!;
  const skillList = catalogRecords(data, "skill_records");
  expect(skillList.filter((row) => group.recordIds.includes(row.id))).toEqual(
    list,
  );
  expect(list).toEqual([...languages, other]);
  expect(skillList.some((row) => row.id === germanSkill.id)).toBe(false);
  expect(skillList).toHaveLength(9);
  expect(new Set(skillList.map((row) => row.id)).size).toBe(skillList.length);
});

it("groups canonical languages even without a skill category and leaves programming language categories intact", () => {
  const english = {
    ...fixture.skill_records[0],
    id: "english",
    title: "English",
    summary: "Fictional native language",
  };
  const data = {
    ...catalog,
    career: { ...fixture, languages: [english] },
    skill_categories: [
      {
        id: "programming",
        title: "Programming languages",
        skill_ids: [fixture.skill_records[0].id],
      },
    ],
  };
  expect(catalogGroups(data, "skill_records")).toEqual([
    { id: languagesGroupId, title: "Languages", recordIds: ["english"] },
    {
      id: "programming",
      title: "Programming languages",
      recordIds: [fixture.skill_records[0].id],
    },
  ]);
});

it("merges organization labels only across case and whitespace differences", () => {
  const rows = [
    " Example Studio ",
    "example   studio",
    "Different employer",
  ].map((organization, index) => ({
    ...fixture.projects[0],
    id: String(index),
    organization,
  }));
  const groups = catalogGroups(
    { ...catalog, career: { ...fixture, projects: rows } },
    "projects",
  );
  expect(groups.map((group) => group.recordIds)).toEqual([["2"], ["0", "1"]]);
  expect(groups.flatMap((group) => group.recordIds).sort()).toEqual([
    "0",
    "1",
    "2",
  ]);
});

it("keeps languages flat and does not guess skill categories from names", () => {
  expect(catalogGroups(catalog, "skill_records")).toEqual([]);
  expect(
    catalogGroups(
      {
        ...catalog,
        career: {
          ...fixture,
          languages: [{ ...fixture.projects[0], organization: "Example" }],
        },
      },
      "languages",
    ),
  ).toEqual([]);
});

it("shows only nonempty skill categories and retains all skills for the all-records view", () => {
  const data = {
    ...catalog,
    skill_categories: [
      { id: "data", title: "Data", skill_ids: ["skill-sql", "missing"] },
      { id: "empty", title: "Empty", skill_ids: ["missing"] },
    ],
  };
  expect(catalogGroups(data, "skill_records")).toEqual([
    { id: "data", title: "Data", recordIds: ["skill-sql"] },
  ]);
  expect(data.career.skill_records).toHaveLength(5);
});
