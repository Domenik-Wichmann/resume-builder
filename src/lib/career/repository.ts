import "server-only";
import { fixture } from "./fixture";
import { careerSchema } from "./model";
import { validateEnv } from "../env";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { loadBrain } from "../career-brain/repository";
import { usable } from "../career-brain/state";

export async function getCareer(accountId = primaryAccountId) {
  if (validateEnv(process.env).mode === "demo") return fixture;
  const records = await loadBrain(database(), accountId, true);
  const available = records.filter(
    (r) => r.published && !r.archived && r.claims.some(usable),
  );
  const profile = available.find((r) => r.kind === "profile");
  const identity = records.find((r) => r.kind === "profile");
  const summary = (r: (typeof records)[number]) =>
    r.claims
      .filter(usable)
      .map((c) => c.value)
      .join(". ");
  const mapped = (kind: (typeof records)[number]["kind"]) =>
    available
      .filter((r) => r.kind === kind)
      .map((r) => ({
        id: r.id,
        slug: r.key,
        title: r.title,
        subtitle: r.subtitle,
        summary: summary(r),
        organization: r.organization,
        start_date: r.start_date,
        end_date: r.end_date,
        skills: available
          .filter((s) => s.kind === "skill" && r.skill_keys.includes(s.key))
          .map((s) => s.title),
        // Only current, published, usable endpoints may reach the public map.
        related_ids: available
          .filter(
            (other) =>
              (other.kind === "skill" && r.skill_keys.includes(other.key)) ||
              (other.kind === "achievement" &&
                r.achievement_keys.includes(other.key)),
          )
          .map((other) => other.id),
      }));
  return careerSchema.parse({
    profile: {
      name: identity?.title || "",
      title: profile?.subtitle || "",
      introduction: profile
        ? summary(profile)
        : "No approved career profile has been published yet.",
    },
    experiences: mapped("experience"),
    projects: mapped("project"),
    achievements: mapped("achievement"),
    skill_records: mapped("skill"),
    skills: available.filter((r) => r.kind === "skill").map((r) => r.title),
    education: mapped("education"),
    certifications: mapped("certification"),
    languages: mapped("language"),
    demo: false,
  });
}
