import { readFile } from "node:fs/promises";
import type { RichCandidate } from "../evidence";
import { fixture } from "../continuation/fixtures";
import {
  actor,
  root as previousRoot,
  type AdmissionCase,
} from "../claim-repair/fixtures";
import type { StateRecord } from "../claim-repair/claims";
export { actor, fixture, previousRoot };
export const root = "experiments/career-brain/v2/omission-repair/results";
export type Inputs = {
  richB: { records: RichCandidate[] };
  richV1: { records: RichCandidate[] };
  cases: AdmissionCase[];
};
export async function priorInputs(): Promise<Inputs> {
  return JSON.parse(await readFile(`${previousRoot}/inputs.json`, "utf8"));
}
export function dropCases(current: StateRecord[]) {
  const project = current.find(
    (r) => r.kind === "project" && /Dispatch Loom/i.test(r.title),
  )!;
  const role = current.find((r) => r.kind === "experience")!;
  const sql = current.find((r) => r.kind === "skill" && r.title === "SQL")!;
  const achievement = current.find(
    (r) => r.kind === "achievement" && r.skill_keys.length,
  )!;
  return [
    {
      id: "one-skill",
      record: project,
      after: { ...project, skill_keys: project.skill_keys.slice(1) },
    },
    {
      id: "one-achievement",
      record: project,
      after: {
        ...project,
        achievement_keys: project.achievement_keys.slice(1),
      },
    },
    { id: "all-role-skills", record: role, after: { ...role, skill_keys: [] } },
    {
      id: "training-handbook-claim",
      record: role,
      after: {
        ...role,
        claims: role.claims.filter((c) => !/trained.*handbook/i.test(c.value)),
      },
    },
    {
      id: "partial-project-skills",
      record: project,
      after: { ...project, skill_keys: project.skill_keys.slice(0, 2) },
    },
    { id: "category-link", record: sql, after: { ...sql, category_key: null } },
    {
      id: "role-achievement",
      record: role,
      after: { ...role, achievement_keys: role.achievement_keys.slice(1) },
    },
    {
      id: "achievement-skill",
      record: achievement,
      after: { ...achievement, skill_keys: achievement.skill_keys.slice(1) },
    },
  ];
}
