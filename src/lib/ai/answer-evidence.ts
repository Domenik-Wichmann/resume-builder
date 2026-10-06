import "server-only";
import type { Career, CareerRecord } from "../career/model";
import { deduplicate } from "../career/utils";
import { answerEvidenceLimit } from "./contracts";
export { answerEvidenceLimit } from "./contracts";

function mentions(question: string, name: string) {
  if (!name.trim()) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(
    question,
  );
}

/** The caller supplies the current published career, never browser-owned evidence. */
export function answerEvidence(
  career: Career,
  retrieved: CareerRecord[],
  question: string,
  followUpContext = "",
) {
  const languages = career.languages || [];
  const records = [
    ...career.experiences,
    ...career.projects,
    ...career.achievements,
    ...career.skill_records,
    ...career.education,
    ...career.certifications,
    ...languages,
  ];
  const current = new Map(records.map((record) => [record.id, record]));
  // Retrieval ranks candidates; fresh public records provide their actual content.
  const candidates = retrieved.flatMap((record) => {
    const publicRecord = current.get(record.id);
    return publicRecord ? [publicRecord] : [];
  });
  const namedLanguages = languages.filter((record) =>
    record.title.split(/\s+/).some((name) => mentions(question, name)),
  );
  const languageOverview =
    !namedLanguages.length &&
    /\b(languages?|multilingual|polyglot)\b/i.test(question) &&
    !/\b(programming|coding|code|software)\b/i.test(question);
  const namedSkills = career.skill_records.filter((record) =>
    mentions(question, record.title),
  );
  const jobsOverview =
    /\b(jobs?|roles?|employment|work history|career history|career background|professional background)\b/i.test(
      question,
    ) &&
    !namedSkills.length &&
    !namedLanguages.length;
  const named = [...namedLanguages, ...namedSkills];
  const contextual = [...languages, ...career.skill_records].filter((record) =>
    mentions(followUpContext, record.title),
  );
  // An explicit new question takes precedence over earlier conversation topics.
  const focus = languageOverview
    ? languages
    : named.length
      ? named
      : jobsOverview
        ? []
        : contextual;
  const seeds = focus.length ? focus : candidates;
  const connected = records.filter(
    (record) =>
      !career.skill_records.includes(record) &&
      !languages.includes(record) &&
      seeds.some(
        (seed) =>
          record.related_ids?.includes(seed.id) ||
          seed.related_ids?.includes(record.id) ||
          record.skills.some((skill) => mentions(skill, seed.title)),
      ),
  );
  const examples = candidates.filter((record) =>
    [...career.experiences, ...career.projects].includes(record),
  );
  return deduplicate(
    [
      ...(jobsOverview ? career.experiences : []),
      ...focus,
      ...connected,
      ...examples,
      ...candidates,
    ],
    answerEvidenceLimit,
  );
}
