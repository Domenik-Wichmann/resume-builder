import "server-only";
import { fixture } from "./fixture";
import { careerSchema, type CareerRecord } from "./model";
import { validateEnv } from "../env";
import { database } from "../db";

export async function getCareer() {
  if (validateEnv(process.env).mode === "demo") return fixture;
  const db = database();
  const tables = [
    "profile",
    "experiences",
    "projects",
    "skills",
    "achievements",
    "education",
    "certifications",
  ] as const;
  const results = await Promise.all(
    tables.map((table) =>
      db.from(table).select("*").eq("is_public", true).order("created_at"),
    ),
  );
  if (results.some((result) => result.error))
    throw new Error("Unable to load published career data.");
  const [
    profiles,
    experiences,
    projects,
    skills,
    achievements,
    education,
    certifications,
  ] = results.map((result) => result.data || []);
  const links = await Promise.all(
    ["experience_skills", "project_skills", "achievement_skills"].map((table) =>
      db.from(table).select("*"),
    ),
  );
  if (links.some((result) => result.error))
    throw new Error("Unable to load career relationships.");
  const skillNames = new Map(skills.map((skill) => [skill.id, skill.name]));
  function records(
    rows: typeof experiences,
    junction: number,
    foreignKey: string,
  ): CareerRecord[] {
    return rows.map((row) => ({
      ...row,
      skills: (links[junction].data || [])
        .filter((link) => link[foreignKey] === row.id)
        .flatMap((link) =>
          skillNames.has(link.skill_id) ? [skillNames.get(link.skill_id)] : [],
        ),
    })) as CareerRecord[];
  }
  return careerSchema.parse({
    profile: profiles[0] || {
      name: "",
      title: "",
      introduction: "No approved career profile has been published yet.",
    },
    experiences: records(experiences, 0, "experience_id"),
    projects: records(projects, 1, "project_id"),
    skills: skills.map((skill) => skill.name),
    skill_records: skills.map((skill) => ({
      id: skill.id,
      slug: skill.slug,
      title: skill.name,
      subtitle: "Published skill",
      summary: skill.description,
      skills: [skill.name],
    })),
    achievements: records(achievements, 2, "achievement_id"),
    education: education.map((row) => ({ ...row, skills: [] })),
    certifications: certifications.map((row) => ({ ...row, skills: [] })),
    demo: false,
  });
}
