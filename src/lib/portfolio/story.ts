import type { Career } from "../career/model";
import { finalStoryStep } from "./story-scenes";

// A deliberately small public projection: no identifiers or private context enter the hero.
export type StorySource = { quote: string; claims: string[] };
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
  return {
    profile: career.profile,
    demo: career.demo,
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
        claims: sources.get(row.id)?.claims || [],
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
