import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { proposeBrain } from "../../../../src/lib/career-brain/propose";
import {
  loadBrain,
  applyBrain,
  actorFor,
} from "../../../../src/lib/career-brain/repository";
import { reconcile } from "../../../../src/lib/career-brain/model";
import { packets } from "../../../../src/lib/career-brain/packets";
import {
  compilePacketResume,
  answerPackets,
} from "../../../../src/lib/career-brain/serving";
import {
  hydrateClaims,
  applyConflicts,
  type StatePacket,
  type StateRecord,
} from "../../../../src/lib/career-brain/state";
import type { Gate } from "../../../../src/lib/career-brain/provider";
import { careerSchema } from "../../../../src/lib/career/model";
import { newWorkspace } from "../../../../src/lib/workspaces/model";
import { checked, provenance } from "../claim-repair/database";
import { reviewedRevision } from "../continuation/sequence";
import { fixture, root, type Inputs } from "./fixtures";

export async function productionSmoke(
  owner: SupabaseClient,
  accountId: string,
  gate: Gate,
  inputs: Inputs,
  write: (name: string, value: unknown) => Promise<void>,
) {
  const started = performance.now();
  const v1Source = fixture("A-clean-v1").source;
  const native = await proposeBrain(owner, accountId, v1Source, [], true, gate);
  await write("production-ingest-native", native);
  if (
    !native.changes.length ||
    native.changes.some((c) => c.status === "REMOVED")
  )
    throw new Error("Initial ingest smoke failed");
  async function accept(source: string, approved: StateRecord[]) {
    const before = await loadBrain(owner, accountId);
    const sourceRow = await checked(
      await owner
        .from("career_sources")
        .insert({
          account_id: accountId,
          kind: "MASTER",
          content: source,
          evidence_text: source,
          content_hash: createHash("sha256").update(source).digest("hex"),
        })
        .select("id")
        .single(),
    );
    const batch = await checked(
      await owner
        .from("career_imports")
        .insert({
          account_id: accountId,
          source_id: sourceRow!.id,
          candidates: approved,
          model: "explicit-synthetic-owner-reviewed-production-smoke",
        })
        .select("id")
        .single(),
    );
    await applyBrain(
      owner,
      accountId,
      batch!.id,
      sourceRow!.id,
      source,
      approved.map((r) => ({
        before:
          before.find((b) => b.kind === r.kind && b.key === r.key) || null,
        after: r,
        status: "UPDATED",
      })),
      before,
    );
    const state = await loadBrain(owner, accountId);
    const proof = await provenance(owner, accountId, state);
    if (
      proof.total !== proof.valid ||
      proof.primaryTotal !== proof.primaryValid
    )
      throw new Error("Production provenance mismatch");
    if (before.some((b) => !state.some((a) => a.id === b.id)))
      throw new Error("Production identity loss");
    if (state.some((r) => r.published))
      throw new Error("Synthetic records must remain private");
    return { state, proof, preserved: before.length, after: state.length };
  }
  const first = reconcile(inputs.richV1.records, []).records.map((r) =>
    hydrateClaims(
      {
        ...r,
        id: "",
        hash: "",
        updated_at: "",
        archived: false,
        published: false,
      },
      "CONFIRMED",
    ),
  );
  const v1 = await accept(v1Source, first);
  let revised = reviewedRevision(v1.state, "V2").map((r) =>
    hydrateClaims(
      {
        ...r,
        id: "",
        hash: "",
        updated_at: "",
        archived: false,
        published: false,
      },
      "CONFIRMED",
    ),
  );
  revised.find((r) => r.kind === "certification")!.claims = v1.state
    .find((r) => r.kind === "certification")!
    .claims.map((c) => ({ ...c, availability: "PENDING_REVIEW" }));
  const v2 = await accept(fixture("A-clean-v2").source, revised);
  if (
    v2.state
      .find((r) => r.kind === "certification")!
      .claims.some((c) => c.availability !== "PENDING_REVIEW")
  )
    throw new Error("Certificate review state lost");
  const v3Source = fixture("A-clean-v3").source;
  revised = reviewedRevision(v2.state, "V3").map((r) =>
    hydrateClaims(
      {
        ...r,
        id: "",
        hash: "",
        updated_at: "",
        archived: false,
        published: false,
      },
      "CONFIRMED",
    ),
  );
  revised.find((r) => r.kind === "certification")!.claims = revised
    .find((r) => r.kind === "certification")!
    .claims.map((c) => ({ ...c, availability: "CONFIRMED" }));
  const original = JSON.parse(
    await readFile(`${root}/sequence-v3-native.json`, "utf8"),
  ) as { conflicts: Parameters<typeof applyConflicts>[1] };
  revised = applyConflicts(revised, original.conflicts, v3Source);
  if (!revised.some((r) => r.claims.some((c) => c.availability === "DISPUTED")))
    throw new Error("Conflict replay did not match reviewed state");
  const trainingQuote =
    "For Dispatch Loom I personally trained 12 dispatch coworkers in two workshops and wrote a plain-language handbook.";
  for (const r of revised.filter(
    (r) =>
      r.kind === "experience" ||
      (r.kind === "achievement" && /training/i.test(r.title)),
  ))
    if (
      !r.claims.some(
        (c) =>
          c.availability === "CONFIRMED" &&
          /trained dispatch coworkers in two workshops/i.test(c.value),
      )
    )
      r.claims.push({
        attribute: "action",
        value:
          "Personally trained dispatch coworkers in two workshops and wrote a plain-language handbook",
        attribution: "PERSONAL",
        availability: "CONFIRMED",
        evidence: [
          {
            quote: trainingQuote,
            start: v3Source.indexOf(trainingQuote),
            end: v3Source.indexOf(trainingQuote) + trainingQuote.length,
          },
        ],
      });
  const v3 = await accept(v3Source, revised);
  if (
    !v3.state
      .find((r) => r.kind === "certification")!
      .claims.every((c) => c.availability === "CONFIRMED")
  )
    throw new Error("Certificate restoration failed");
  const role = v3.state.find((r) => r.kind === "experience")!;
  // Owner JWT authorizes this PRIVATE smoke. Publication flags below affect only
  // in-memory packet construction; no synthetic record is published in Supabase.
  const evidence = (
    packets([{ ...role, published: true }], [role.id]) as StatePacket[]
  ).map((p) => ({
    ...p,
    summary: "",
    skills: [],
    outcomes: [],
    claims: p.claims.filter((c) =>
      /train|cowork|handbook|attendance/i.test(c.value),
    ),
  }));
  const career = careerSchema.parse({
    profile: { name: "Ada Rowan", title: "", introduction: "" },
    experiences: [
      {
        id: role.id,
        slug: role.key,
        title: role.title,
        subtitle: role.subtitle,
        summary: "",
        skills: [],
        organization: role.organization,
        start_date: role.start_date,
        end_date: role.end_date,
      },
    ],
    projects: [],
    skills: [],
    skill_records: [],
    achievements: [],
    education: [],
    certifications: [],
    demo: false,
  });
  const workspace = {
    ...newWorkspace("private-smoke", "US", false),
    job_description:
      "Personally performed coworker training and handbook work; exact attendance is unresolved",
    evidence: career.experiences,
  };
  const ir = await compilePacketResume(
    career,
    workspace,
    {
      market: "US",
      location: "",
      contact_email: "",
      phone: "",
      work_authorization: "",
    },
    evidence,
    "TRADITIONAL",
    accountId,
    gate,
  );
  if (!ir.experiences.length || /\b(?:12|14)\b/.test(JSON.stringify(ir)))
    throw new Error(
      "Private resume smoke lost safe work or revived disputed attendance",
    );
  const answer = await answerPackets(
    "Did Ada train dispatch coworkers and write a handbook, and is an exact attendee count established?",
    { actor: actorFor(v3.state), packets: evidence },
    { accountId, operation: "production_smoke" },
    gate,
  );
  if (
    !answer.evidence_ids.length ||
    !/train|handbook/i.test(answer.answer) ||
    /(?:exactly|trained)\s+(?:12|14)\b/i.test(answer.answer)
  )
    throw new Error("Private QA smoke failed");
  const result = {
    v1,
    v2,
    v3,
    ir,
    answer,
    publicRows: 0,
    latencyMs: Math.round(performance.now() - started),
    ownerReviewed: true,
  };
  await write("production-smoke", result);
  return result;
}
