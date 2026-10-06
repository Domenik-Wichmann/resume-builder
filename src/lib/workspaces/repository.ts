import "server-only";
import { database } from "../db";
import { getCareer } from "../career/repository";
import { semanticEntities, deduplicate } from "../embeddings/content";
import { workspaceSchema, type Workspace } from "./model";
import { HttpError } from "../http";
import { z } from "zod";
import type { Career } from "../career/model";
import { primaryAccountId } from "../account-id";
export async function loadWorkspace(
  id: string,
  visitorId: string,
  currentCareer?: Promise<Career>,
): Promise<Workspace> {
  const db = database();
  const { data: row, error } = await db
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .eq("visitor_id", visitorId)
    .eq("account_id", primaryAccountId)
    .maybeSingle();
  if (error) throw new Error("Cannot load workspace.");
  if (!row) throw new HttpError(404, "Workspace not found.");
  const [evidence, questions, requirements, signals, career, categories] =
    await Promise.all([
      db.from("workspace_evidence").select("*").eq("workspace_id", id),
      db
        .from("workspace_questions")
        .select("*")
        .eq("workspace_id", id)
        .order("created_at"),
      db
        .from("workspace_requirements")
        .select("*")
        .eq("workspace_id", id)
        .order("position"),
      db
        .from("explorer_events")
        .select("skill_id,project_id,category_id")
        .eq("account_id", primaryAccountId)
        .eq("workspace_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      currentCareer || getCareer(),
      db
        .from("skill_categories")
        .select("id,title")
        .eq("account_id", primaryAccountId)
        .eq("is_public", true)
        .is("archived_at", null),
    ]);
  if (
    [evidence, questions, requirements, signals].some((result) => result.error)
  )
    throw new Error("Cannot load workspace context.");
  const questionIds = (questions.data || []).map((question) => question.id);
  const [topics, citations] = questionIds.length
    ? await Promise.all([
        db.from("question_topics").select("*").in("question_id", questionIds),
        db.from("question_evidence").select("*").in("question_id", questionIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (topics.error || citations.error)
    throw new Error("Cannot load question evidence.");
  const entities = semanticEntities(career);
  const selected = entities.filter((e) =>
    (signals.data || []).some(
      (s) => s.skill_id === e.record.id || s.project_id === e.record.id,
    ),
  );
  if (categories.error) throw new Error("Cannot load published interests.");
  const interests = [
    ...new Set([
      ...selected.map((e) => e.record.title),
      ...(categories.data || [])
        .filter((c) => (signals.data || []).some((s) => s.category_id === c.id))
        .map((c) => c.title),
    ]),
  ].slice(0, 30);
  const refs = new Map((evidence.data || []).map((ref) => [ref.id, ref]));
  const canonical = deduplicate(
    [
      ...(evidence.data || []).flatMap((ref) => {
        const found = entities.find(
          (entity) =>
            entity.type === ref.entity_type &&
            entity.record.id === ref.entity_id,
        );
        return found ? [found.record] : [];
      }),
      ...selected.map((e) => e.record),
      ...entities
        .filter((e) => e.record.skills.some((s) => interests.includes(s)))
        .map((e) => e.record),
    ],
    60,
  );
  return workspaceSchema.parse({
    id: row.id,
    title: row.title,
    market: row.market,
    job_description: row.job_description,
    match: row.match_analysis,
    created_at: row.created_at,
    updated_at: row.updated_at,
    demo: false,
    requirements: (requirements.data || []).map(
      (requirement) => requirement.requirement,
    ),
    evidence: canonical,
    interests,
    questions: (questions.data || []).map((question) => ({
      question: question.question,
      answer: question.answer,
      created_at: question.created_at,
      evidence_ids: (citations.data || [])
        .filter((citation) => citation.question_id === question.id)
        .flatMap((citation) => {
          const ref = refs.get(citation.evidence_id);
          return ref && canonical.some((record) => record.id === ref.entity_id)
            ? [ref.entity_id]
            : [];
        }),
      topics: (topics.data || [])
        .filter((topic) => topic.question_id === question.id)
        .map((topic) => ({
          topic: topic.topic,
          strength: topic.evidence_strength,
        })),
    })),
  });
}
export async function saveWorkspace(
  workspace: Workspace,
  visitorId: string,
  previousQuestionCount: number,
) {
  const entities = semanticEntities(await getCareer());
  const evidence = workspace.evidence.flatMap((record) => {
    const entity = entities.find(
      (candidate) => candidate.record.id === record.id,
    );
    return entity ? [{ entity_type: entity.type, entity_id: record.id }] : [];
  });
  const { error } = await database().rpc("save_workspace_context", {
    p_workspace_id: workspace.id,
    p_visitor_id: visitorId,
    p_title: workspace.title,
    p_market: workspace.market,
    p_job: workspace.job_description,
    p_match: workspace.match,
    p_requirements: workspace.requirements,
    p_evidence: evidence,
    p_question: workspace.questions.slice(previousQuestionCount)[0] || null,
  });
  if (error) throw new Error("Cannot atomically save workspace context.");
}
export async function listWorkspaces(visitorId: string) {
  const { data, error } = await database()
    .from("workspaces")
    .select("id,title,market,updated_at")
    .eq("visitor_id", visitorId)
    .eq("account_id", primaryAccountId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Cannot list workspaces.");
  return z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        market: z.enum(["US", "BG"]),
        updated_at: z.string(),
      }),
    )
    .parse(data);
}
