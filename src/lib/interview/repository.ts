import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sessionSchema,
  sessionListSchema,
  messageSchema,
  type Session,
  type Message,
  type InterviewAction,
} from "./model";
import { HttpError } from "../http";
import { loadBrain } from "../career-brain/repository";
import { complete } from "../ai/openrouter";
import { productionGate } from "../career-brain/provider";
import { proposeBrain } from "../career-brain/propose";
import { contentHash } from "../embeddings/content";
import { searchCareer, inspectRequirement } from "./retrieval";
import {
  planSchema,
  interviewInstructions,
  planningContext,
  validatePlan,
  interviewSource,
} from "./planning";

function fail(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("INTERVIEW_NOT_FOUND"))
    throw new HttpError(404, "Interview not found.");
  if (error.message.includes("INTERVIEW_"))
    throw new HttpError(
      409,
      "Interview changed or is busy. Reload and continue; your saved answers are preserved.",
    );
  throw new Error("Cannot persist private interview.");
}
export async function listInterviews(
  db: SupabaseClient,
  accountId: string,
  offset = 0,
) {
  const result = await db
    .from("career_interview_sessions")
    .select("id,mode,status,title,turn_count,last_activity_at")
    .eq("account_id", accountId)
    .order("last_activity_at", { ascending: false })
    .range(offset, offset + 49);
  fail(result.error);
  return z.array(sessionListSchema).parse(result.data);
}
export async function readInterview(
  db: SupabaseClient,
  accountId: string,
  id: string,
  before?: number,
) {
  const result = await db
    .from("career_interview_sessions")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  fail(result.error);
  if (!result.data) throw new HttpError(404, "Interview not found.");
  let query = db
    .from("career_interview_messages")
    .select("id,session_id,sequence,role,content,rationale,created_at")
    .eq("account_id", accountId)
    .eq("session_id", id);
  if (before) query = query.lt("sequence", before);
  const messages = await query
    .order("sequence", { ascending: false })
    .limit(100);
  fail(messages.error);
  const session = sessionSchema.parse(result.data);
  const batch = session.last_import_id
    ? await db
        .from("career_imports")
        .select("status")
        .eq("account_id", accountId)
        .eq("id", session.last_import_id)
        .maybeSingle()
    : null;
  if (batch) fail(batch.error);
  return {
    session,
    messages: z.array(messageSchema).parse(messages.data).reverse(),
    importStatus: batch?.data?.status || "",
  };
}
async function transcript(
  db: SupabaseClient,
  accountId: string,
  id: string,
): Promise<Message[]> {
  const result = await db
    .from("career_interview_messages")
    .select("id,session_id,sequence,role,content,rationale,created_at")
    .eq("account_id", accountId)
    .eq("session_id", id)
    .order("sequence")
    .limit(801);
  fail(result.error);
  return z.array(messageSchema).parse(result.data);
}
async function release(db: SupabaseClient, id: string, token: string) {
  await db
    .from("career_interview_sessions")
    .update({ pending_token: null, pending_until: null })
    .eq("id", id)
    .eq("pending_token", token);
}
export async function interviewAction(
  db: SupabaseClient,
  accountId: string,
  input: InterviewAction,
) {
  if (input.action === "start") {
    if (input.mode === "record") {
      const records = await loadBrain(db, accountId);
      if (
        !records.some(
          (r) =>
            r.id === input.target_record_id &&
            !r.archived &&
            ["experience", "project", "achievement"].includes(r.kind),
        )
      )
        throw new HttpError(404, "Active career record not found.");
    }
    const result = await db
      .from("career_interview_sessions")
      .insert({
        account_id: accountId,
        mode: input.mode,
        title: input.title,
        target_role: input.mode === "role" ? input.target_role : "",
        job_description: input.mode === "job" ? input.job_description : "",
        target_record_id:
          input.mode === "record" ? input.target_record_id : null,
      })
      .select("*")
      .single();
    fail(result.error);
    // Save the empty session before inference. Failed first questions remain resumable.
    return {
      session: sessionSchema.parse(result.data),
      messages: [] as Message[],
    };
  }
  const current = await readInterview(db, accountId, input.id);
  if (input.action === "rename" || input.action === "status") {
    if (
      current.session.pending_until &&
      new Date(current.session.pending_until).getTime() > Date.now()
    )
      throw new HttpError(
        409,
        "Wait for the current interview action to finish.",
      );
    const result = await db
      .from("career_interview_sessions")
      .update({
        ...(input.action === "rename"
          ? { title: input.title }
          : { status: input.status }),
        version: input.version + 1,
      })
      .eq("id", input.id)
      .eq("account_id", accountId)
      .eq("version", input.version)
      .select("*")
      .maybeSingle();
    fail(result.error);
    if (!result.data)
      throw new HttpError(409, "Interview changed. Reload and continue.");
    return { ...current, session: sessionSchema.parse(result.data) };
  }
  const token = randomUUID();
  const leased = await db.rpc("begin_career_interview", {
    p_id: input.id,
    p_version: input.version,
    p_token: token,
    p_answer: input.action === "turn" ? input.answer : null,
    p_review: input.action === "review",
  });
  fail(leased.error);
  const session: Session = sessionSchema.parse(leased.data);
  try {
    const messages = await transcript(db, accountId, input.id);
    const records = await loadBrain(db, accountId);
    if (input.action === "turn") {
      const query = [
        session.target_role,
        session.job_description.slice(0, 5000),
        session.state.focus,
        messages.filter((m) => m.role === "user").at(-1)?.content,
      ].join(" ");
      const evidence = searchCareer(records, query, session.target_record_id);
      const probes = session.state.requirements.length
        ? session.state.requirements.map((r) => r.requirement)
        : [session.target_role || session.job_description]
            .join("")
            .split(/[\n.;•]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 16)
            .map((s) => s.slice(0, 180));
      const requirements = probes
        .slice(0, 16)
        .map((r) => inspectRequirement(records, r));
      const raw = await productionGate(
        "career-interview-planning",
        "OPENROUTER",
        () =>
          complete(
            interviewInstructions,
            JSON.stringify(
              planningContext(session, messages, evidence, requirements),
            ),
            planSchema,
            {
              model:
                process.env.CAREER_INTERVIEW_MODEL || "openai/gpt-6-luna-pro",
              maxTokens: 6500,
              timeoutMs: 90000,
              usage: { accountId, operation: "career_interview_plan" },
            },
          ),
      );
      const plan = validatePlan(raw, session, messages, evidence, requirements);
      const result = await db.rpc("complete_career_interview", {
        p_id: input.id,
        p_token: token,
        p_content: plan.question,
        p_rationale: plan.rationale,
        p_state: plan.state,
      });
      fail(result.error);
      return readInterview(db, accountId, input.id);
    }
    const source = interviewSource(messages, session.reviewed_through);
    if (source.text.trim().length < 10) {
      if (input.finish && !source.text) {
        const result = await db
          .from("career_interview_sessions")
          .update({
            status: "FINISHED",
            pending_token: null,
            pending_until: null,
          })
          .eq("id", input.id)
          .eq("pending_token", token);
        fail(result.error);
        return {
          ...(await readInterview(db, accountId, input.id)),
          importId: session.last_import_id,
        };
      }
      throw new HttpError(
        400,
        "Add at least ten characters of new owner answers before reviewing discoveries.",
      );
    }
    const { changes } = await proposeBrain(
      db,
      accountId,
      source.text,
      records,
      false,
      productionGate,
      source.context,
    );
    const result = await db.rpc("review_career_interview", {
      p_id: input.id,
      p_token: token,
      p_source: source.text,
      p_context: source.context,
      p_hash: contentHash(source.text),
      p_candidates: changes,
      p_through: source.through,
      p_finish: input.finish && !source.hasMore,
    });
    fail(result.error);
    return {
      ...(await readInterview(db, accountId, input.id)),
      importId: z.uuid().parse(result.data),
      hasMore: source.hasMore,
    };
  } catch (error) {
    await release(db, input.id, token);
    throw error;
  }
}
