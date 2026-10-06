import "server-only";
import { loadBrain } from "../career-brain/repository";
import { usable } from "../career-brain/state";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { fixture } from "./fixture";
import { validateEnv } from "../env";
import { publicAnswers } from "../portfolio/answers-server";
import { catalogSchema } from "./catalog";

export async function getCareerCatalog() {
  const demo = validateEnv(process.env).mode === "demo";
  // Labels and relationships use only current, published, hash-verified evidence.
  const brainPromise = demo
    ? Promise.resolve([])
    : loadBrain(database(), primaryAccountId, true);
  const [brain, answers] = await Promise.all([
    brainPromise,
    publicAnswers(brainPromise),
  ]);
  const records = brain.filter(
    (record) =>
      record.published && !record.archived && record.claims.some(usable),
  );
  const map = (kind: (typeof records)[number]["kind"]) =>
    records
      .filter((record) => record.kind === kind)
      .map((record) => ({
        id: record.id,
        slug: record.key,
        title: record.title,
        subtitle: record.subtitle,
        summary: record.claims
          .filter(usable)
          .map((claim) => claim.value)
          .join(". "),
        organization: record.organization,
        start_date: record.start_date,
        end_date: record.end_date,
        skills: records
          .filter(
            (skill) =>
              skill.kind === "skill" && record.skill_keys.includes(skill.key),
          )
          .map((skill) => skill.title),
        related_ids: records
          .filter(
            (other) =>
              (other.kind === "skill" &&
                record.skill_keys.includes(other.key)) ||
              (other.kind === "achievement" &&
                record.achievement_keys?.includes(other.key)),
          )
          .map((other) => other.id),
      }));
  const career = demo
    ? {
        experiences: fixture.experiences,
        projects: fixture.projects,
        skill_records: fixture.skill_records,
        achievements: fixture.achievements,
        education: fixture.education,
        certifications: fixture.certifications,
        languages: fixture.languages,
        demo,
      }
    : {
        experiences: map("experience"),
        projects: map("project"),
        skill_records: map("skill"),
        achievements: map("achievement"),
        education: map("education"),
        certifications: map("certification"),
        languages: map("language"),
        demo,
      };
  return catalogSchema.parse({
    career,
    skill_categories: demo
      ? [
          {
            id: "demo-development",
            title: "Software development",
            skill_ids: ["skill-typescript", "skill-react"],
          },
          {
            id: "demo-data",
            title: "Data & databases",
            skill_ids: ["skill-sql", "skill-postgresql"],
          },
        ]
      : records
          .filter((record) => record.kind === "category")
          .map((category) => ({
            id: category.id,
            title: category.title,
            skill_ids: records
              .filter(
                (record) =>
                  record.kind === "skill" &&
                  record.category_key === category.key,
              )
              .map((record) => record.id),
          }))
          .filter((category) => category.skill_ids.length > 0),
    answers: answers.map(({ question, answer }) => ({
      question,
      answer,
    })),
  });
}
