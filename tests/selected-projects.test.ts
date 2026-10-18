import { expect, it } from "vitest";
import type { Project } from "../src/lib/portfolio/model";
import {
  selectShowcaseProjects,
  selectedProjectNames,
  showcaseTitle,
  showcaseSchema,
} from "../src/lib/portfolio/selection";

function project(id: string, patch: Partial<Project> = {}): Project {
  return {
    id,
    title: "Fictional project fixture",
    slug: "fictional-project",
    subtitle: "",
    summary: "Fictional sample",
    description: "",
    organization: null,
    start_date: null,
    end_date: null,
    status: "ACTIVE",
    featured: false,
    is_public: true,
    archived: false,
    display_order: 0,
    skill_ids: [],
    achievement_ids: [],
    links: [],
    updated_at: "2026-01-01",
    ...patch,
  };
}
it("showcases the selected apps and owner-featured work while excluding private, archived and unrelated records", () => {
  const ids = Object.keys(selectedProjectNames);
  const selected = selectShowcaseProjects([
    project("other"),
    project(ids[2]),
    project(ids[0]),
    project(ids[1]),
    project(ids[3]),
    project("featured", { featured: true }),
    project("private", { featured: true, is_public: false }),
    project("archived", { featured: true, archived: true }),
  ]);
  expect(selected.map((p) => p.id)).toEqual([
    ...ids.slice(1),
    "featured",
    ids[0],
  ]);
  expect(
    selected.filter((p) => p.id !== "featured").map(showcaseTitle),
  ).toEqual([
    "SystemWright LMS",
    "Resume Builder",
    "BabyCat / Rules Engine",
    "Sonaway",
  ]);
  expect(
    selectShowcaseProjects(ids.map((id) => project(id, { is_public: false }))),
  ).toEqual([]);
  expect(
    selectShowcaseProjects(ids.map((id) => project(id, { archived: true }))),
  ).toEqual([]);
});
it("keeps the public card contract free of account, tracking, and unpublished metadata", () => {
  const card = {
    slug: "fictional-project",
    title: "Fictional example",
    subtitle: "",
    summary: "",
    cover: null,
  };
  expect(showcaseSchema.safeParse({ projects: [card] }).success).toBe(true);
  expect(
    showcaseSchema.safeParse({ projects: [{ ...card, account_id: "private" }] })
      .success,
  ).toBe(false);
  expect(
    showcaseSchema.safeParse({ projects: [{ ...card, slug: "../admin" }] })
      .success,
  ).toBe(false);
});
