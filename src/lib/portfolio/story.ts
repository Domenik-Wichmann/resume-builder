import type { Career, CareerRecord } from "../career/model";
import { finalStoryStep } from "./story-scenes";

// A deliberately small public projection: no identifiers or private context enter the hero.
export type StorySource = { quote: string; claims: string[]; facts?: string[] };
export type PublicAnswerItem = {
  title: string;
  kind: string;
  context: string;
  skills: string[];
  details: string[];
};
export type PublicQuestionExample = {
  topic: string;
  question: string;
  answer: string;
  items: PublicAnswerItem[];
};
export function portfolioStory(
  career: Career,
  sources: ReadonlyMap<string, StorySource> = new Map(),
) {
  const record =
    career.projects.find(
      (row) =>
        /resume builder|career brain/i.test(row.title) &&
        row.summary &&
        row.skills.length,
    ) ||
    career.projects.find((row) => row.summary && row.skills.length) ||
    career.experiences.find((row) => row.summary && row.skills.length);
  const modelRecord =
    career.projects.find(
      (row) =>
        /rules engine/i.test(row.title) && row.summary && row.skills.length,
    ) || record;
  const graphSkills = record
    ? [
        ...record.skills.filter((skill) =>
          ["Supabase and PostgreSQL", "Vector Search and HNSW"].includes(skill),
        ),
        ...record.skills.filter(
          (skill) =>
            !["Supabase and PostgreSQL", "Vector Search and HNSW"].includes(
              skill,
            ),
        ),
      ].slice(0, 2)
    : [];
  const preferredHighlights = [
    "Workflow Automation",
    "SQL",
    "AI-Assisted Development",
  ].filter((skill) => career.skills.includes(skill));
  const detail = (
    row: CareerRecord,
    kind: string,
    relevant?: RegExp,
  ): PublicAnswerItem => {
    const facts = (
      sources.get(row.id)?.facts ||
      sources.get(row.id)?.claims || [row.summary]
    ).filter(Boolean);
    return {
      title: row.title,
      kind,
      context: row.organization || row.subtitle,
      skills: [
        ...row.skills.filter((skill) => relevant?.test(skill)),
        ...row.skills.filter((skill) => !relevant?.test(skill)),
      ].slice(0, 3),
      details: [
        ...facts.filter((fact) => relevant?.test(fact)),
        ...facts.filter((fact) => !relevant?.test(fact)),
      ].slice(0, 3),
    };
  };
  const projectDetail = (row: CareerRecord, relevant?: RegExp) =>
    detail(
      row,
      career.projects.includes(row) ? "Project" : "Experience",
      relevant,
    );
  const firstName = career.profile.name.split(" ")[0] || "the candidate";
  const sqlRows = [...career.projects, ...career.experiences]
    .filter(
      (row) => row.summary && row.skills.some((skill) => /sql/i.test(skill)),
    )
    .slice(0, 2);
  const automationRows = [...career.projects, ...career.experiences]
    .filter(
      (row) =>
        row.summary &&
        row.skills.some((skill) => /automat|vba|rule engine/i.test(skill)),
    )
    .slice(0, 2);
  const questionExamples: PublicQuestionExample[] = [];
  const addExample = (
    topic: string,
    question: string,
    rows: PublicAnswerItem[],
  ) => {
    if (!rows.length) return;
    questionExamples.push({
      topic,
      question,
      answer: `Published examples include ${rows.map((row) => row.title).join(" and ")}.`,
      items: rows,
    });
  };
  addExample(
    "sql",
    `What has ${firstName} worked on with SQL?`,
    sqlRows.map((row) => projectDetail(row, /sql|postgres/i)),
  );
  if (record)
    addExample(
      "project",
      /resume builder|career brain/i.test(record.title)
        ? `How did ${firstName} build Resume Builder?`
        : `What projects has ${firstName} worked on?`,
      [projectDetail(record, /AI.assist|next|typescript|supabase|openrouter/i)],
    );
  addExample(
    "automation",
    `What automation work has ${firstName} done?`,
    automationRows.map((row) =>
      projectDetail(row, /vba|automat|rules|AI.assist/i),
    ),
  );
  addExample(
    "work",
    `What roles has ${firstName} worked in?`,
    career.experiences
      .filter((row) => row.summary)
      .slice(0, 2)
      .map((row) => detail(row, "Experience")),
  );
  addExample(
    "languages",
    `What language experience does ${firstName} have?`,
    (career.languages || [])
      .filter((row) => row.summary)
      .slice(0, 2)
      .map((row) => detail(row, "Language")),
  );
  const achievement = career.achievements.find((row) =>
    modelRecord?.related_ids?.includes(row.id),
  );
  const skill = career.skill_records.find((row) =>
    modelRecord?.skills.includes(row.title),
  );
  const schemaEntities = [
    {
      kind: "Project",
      row:
        modelRecord && career.projects.includes(modelRecord)
          ? modelRecord
          : career.projects[0],
    },
    { kind: "Experience", row: career.experiences[0] },
    { kind: "Achievement", row: achievement },
    { kind: "Skill", row: skill },
    { kind: "Language", row: career.languages?.[0] },
  ].map(({ kind, row }) => ({
    kind,
    title: row?.title || "No published record",
    claim: row
      ? sources.get(row.id)?.claims[0] || row.summary
      : "No relevant evidence is currently stored.",
    quote: row ? sources.get(row.id)?.quote || null : null,
    linked: Boolean(
      row &&
      modelRecord &&
      (modelRecord.related_ids?.includes(row.id) ||
        (kind === "Skill" && modelRecord.skills.includes(row.title))),
    ),
  }));
  return {
    profile: career.profile,
    demo: career.demo,
    questionExamples,
    schemaEntities,
    highlights: [
      ...preferredHighlights,
      ...career.skills.filter((skill) => !preferredHighlights.includes(skill)),
    ].slice(0, 3),
    evidence: record
      ? {
          title: record.title,
          passage: record.summary,
          skills: graphSkills,
          kind: career.projects.includes(record) ? "Project" : "Experience",
          source: sources.get(record.id) || null,
          achievements: career.achievements
            .filter((row) => record.related_ids?.includes(row.id))
            .map((row) => row.title)
            .slice(0, 2),
        }
      : null,
    modelEvidence: modelRecord
      ? {
          title: modelRecord.title,
          passage: modelRecord.summary,
          skills: [
            ...modelRecord.skills.filter((skill) =>
              ["VBA", "Regex and Conditional Logic"].includes(skill),
            ),
            ...modelRecord.skills.filter(
              (skill) =>
                !["VBA", "Regex and Conditional Logic"].includes(skill),
            ),
          ].slice(0, 2),
          kind: career.projects.includes(modelRecord)
            ? "Project"
            : "Experience",
          source: sources.get(modelRecord.id) || null,
          achievements: career.achievements
            .filter((row) => modelRecord.related_ids?.includes(row.id))
            .map((row) => row.title)
            .slice(0, 2),
        }
      : null,
    retrievalQuestion: career.skills.some((skill) => /\bsql\b/i.test(skill))
      ? `What has ${career.profile.name} done with SQL?`
      : graphSkills[0]
        ? `How has ${career.profile.name} used ${graphSkills[0]}?`
        : "What published career evidence is available?",
    examples: [...career.projects, ...career.experiences]
      .filter(
        (row) =>
          row.summary &&
          row.skills.some((skill) =>
            career.skills.some((name) => /\bsql\b/i.test(name))
              ? /sql/i.test(skill)
              : graphSkills.includes(skill),
          ),
      )
      .slice(0, 3)
      .map((row) => ({
        title: row.title,
        kind: career.projects.includes(row) ? "Project" : "Experience",
        skills: [
          ...row.skills.filter((skill) => /sql/i.test(skill)),
          ...row.skills.filter((skill) => !/sql/i.test(skill)),
        ].slice(0, 2),
        passage: sources.get(row.id)?.quote || row.summary,
        exact: sources.has(row.id),
        claims: sources.get(row.id)?.facts || sources.get(row.id)?.claims || [],
        context: row.organization || row.subtitle,
        achievements: career.achievements
          .filter((achievement) => row.related_ids?.includes(achievement.id))
          .map((achievement) => achievement.title),
      })),
    questions: record
      ? [
          `What did you do on ${record.title}?`,
          `How have you used ${graphSkills[0]}?`,
          "Which experiences are most relevant to my team?",
        ]
      : [
          "What career evidence is available?",
          "Which experiences are most relevant to my team?",
        ],
  };
}
export type PortfolioStory = ReturnType<typeof portfolioStory>;

export function storyStep(offset: number, stride: number) {
  return Math.max(
    0,
    Math.min(finalStoryStep, Math.floor((offset + 1) / stride)),
  );
}

// Require both a settled gesture and time to read before releasing final-scene momentum.
export function deliberateStoryExit(
  now: number,
  entered: number,
  lastGesture: number,
) {
  return now - entered >= 700 && now - lastGesture >= 180;
}
