import "server-only";
import { getCareer, careerFromBrain } from "./career/repository";
import { usable } from "./career-brain/state";
import { loadBrain } from "./career-brain/repository";
import { database } from "./db";
import { primaryAccountId } from "./account-id";
import { validateEnv } from "./env";
import type { CareerRecord } from "./career/model";
/** Public resume prose uses reviewed canonical display text, not the full retrieval claim inventory. */
export async function getResume() {
  if (validateEnv(process.env).mode === "demo") return getCareer();
  const records = await loadBrain(database(), primaryAccountId, true);
  const career = careerFromBrain(records);
  const display = (items: CareerRecord[]) =>
    items.map((item) => ({
      ...item,
      summary:
        records.find((record) => record.id === item.id)?.summary ||
        item.summary,
    }));
  return {
    ...career,
    profile: {
      ...career.profile,
      introduction:
        records.find(
          (record) => record.kind === "profile" && record.claims.some(usable),
        )?.summary || career.profile.introduction,
    },
    experiences: display(career.experiences),
    projects: display(career.projects),
    achievements: display(career.achievements),
    education: display(career.education),
    certifications: display(career.certifications),
    languages: display(career.languages || []),
  };
}
