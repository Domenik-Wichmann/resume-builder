import { loadBrain } from "@/lib/career-brain/repository";
import { usable } from "@/lib/career-brain/state";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { fixture } from "@/lib/career/fixture";
import { validateEnv } from "@/lib/env";
import { publicAnswers } from "@/lib/portfolio/answers-server";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const demo = validateEnv(process.env).mode === "demo";
    // Explicit public-only, primary-account read; hash and source verification
    // happens inside loadBrain. Private notes and source quotes never leave here.
    const records = demo
      ? []
      : (await loadBrain(database(), primaryAccountId, true)).filter(
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
    const answers = await publicAnswers();
    return Response.json({
      career,
      answers: answers.map(({ question, answer }) => ({ question, answer })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
