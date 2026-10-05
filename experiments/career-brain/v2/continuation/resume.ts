import { randomUUID } from "node:crypto";
import type { Career, CareerRecord } from "../../../../src/lib/career/model";
import { compileResumeIR } from "../../../../src/lib/resume-ir";
import { newWorkspace } from "../../../../src/lib/workspaces/model";
import { goldPackets } from "../gold-packets";
import { packets, type EvidencePacket } from "../packets";
import type { RichCanonical } from "../evidence";
import { fixture, stableId, type SupportCase } from "./fixtures";

export function compileAdmission(input: EvidencePacket[], query: string) {
  const admitted = input.filter(
    (p) => p.support === "SUPPORTS" && !p.uncertainties.length,
  );
  const record = (p: EvidencePacket): CareerRecord => ({
    id: p.id,
    slug: p.id,
    title: p.title,
    subtitle: "",
    summary: p.summary,
    organization: p.organization,
    start_date: p.dates.start,
    end_date: p.dates.end,
    skills: p.skills,
  });
  const select = (kind: EvidencePacket["kind"]) =>
    input.filter((p) => p.kind === kind).map(record);
  const career: Career = {
    profile: {
      name: "Ada Rowan",
      title: "Operations Analyst",
      introduction: "",
    },
    experiences: select("experience"),
    projects: select("project"),
    achievements: select("achievement"),
    skill_records: select("skill"),
    education: select("education"),
    certifications: select("certification"),
    skills: [],
    languages: select("language"),
    demo: true,
  };
  const workspace = newWorkspace(randomUUID(), "US", true);
  workspace.requirements = [query];
  workspace.evidence = admitted.map(record);
  const ir = compileResumeIR(career, workspace, {
    market: "US",
    location: "",
    contact_email: "",
    phone: "",
    work_authorization: "",
  });
  const sections = [
    ...ir.experiences,
    ...ir.projects,
    ...ir.education,
    ...ir.certifications,
    ...ir.supporting_sections,
  ];
  return {
    admittedIds: admitted.map((p) => p.id),
    compiledIds: sections.flatMap((s) => s.evidence_ids),
    ir,
  };
}
export function resumeChecks(cases: SupportCase[]) {
  return cases.map((q) => {
    const result = compileAdmission(q.packets, q.text);
    const unsupported = result.admittedIds.filter(
      (id) => q.expected.find((e) => e.id === id)?.support !== "SUPPORTS",
    );
    const escaped = result.compiledIds.filter(
      (id) => !result.admittedIds.includes(id),
    );
    return {
      id: q.id,
      answerGroup: q.answerGroup,
      expected: q.expected,
      ...result,
      unsupportedAdmissionIds: unsupported,
      escapedIds: escaped,
    };
  });
}
export function warningCompilerCanary() {
  const r = goldPackets(fixture("A-clean-v1")).find(
    (r) => r.key === "dispatch-loom",
  )!;
  const poisoned: RichCanonical = {
    ...r,
    id: stableId("warning-compiler-canary"),
    summary:
      "Personally wrote SQL checks and implemented a visible warning for late files.",
  };
  // Mirrors the observed ingest failure: sound SQL claim beside an overstated
  // canonical summary. Even direct SQL support does not prove the whole bullet.
  const p = packets([poisoned], [poisoned.id])[0];
  p.support = "SUPPORTS";
  const compiled = compileAdmission([p], "What SQL checks did Ada implement?");
  return {
    scope:
      "Controlled malformed-canonical canary, distinct from clean-gold native query results",
    sourceFixture: "A-clean-v1",
    packet: p,
    ...compiled,
    unsupportedWarningCompiled: compiled.ir.projects.some((s) =>
      s.bullets.some((b) => b.includes("implemented a visible warning")),
    ),
  };
}
