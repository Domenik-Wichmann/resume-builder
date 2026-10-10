import { rawRates } from "./model";
export type AnalyticsInput = {
  applications: { id: string; sent_at: string | null }[];
  snapshots: { application_id: string; variant_id: string | null }[];
  variants: {
    id: string;
    label: string;
    experiment_id: string;
    strategy: string;
  }[];
  links: { id: string; application_id: string }[];
  visits: { link_id: string; session_id: string }[];
  workspaces: { id: string; tracking_link_id: string | null }[];
  questions: { workspace_id: string }[];
  events: { workspace_id: string; event_type: string }[];
  explorer: { workspace_id: string }[];
  outcomes: { application_id: string; status: string }[];
};
export function applicationAnalytics(
  input: AnalyticsInput,
  applicationId: string,
) {
  const links = new Set(
    input.links
      .filter((l) => l.application_id === applicationId)
      .map((l) => l.id),
  );
  const workspaces = new Set(
    input.workspaces
      .filter((w) => w.tracking_link_id && links.has(w.tracking_link_id))
      .map((w) => w.id),
  );
  return {
    visits: new Set(
      input.visits
        .filter((v) => links.has(v.link_id))
        .map((v) => `${v.link_id}:${v.session_id}`),
    ).size,
    workspaces: workspaces.size,
    questions: input.questions.filter((q) => workspaces.has(q.workspace_id))
      .length,
    engagement: input.explorer.filter((e) => workspaces.has(e.workspace_id))
      .length,
    previews: input.events.filter(
      (e) =>
        workspaces.has(e.workspace_id) && e.event_type === "resume_preview",
    ).length,
    exports: input.events.filter(
      (e) =>
        workspaces.has(e.workspace_id) && e.event_type === "workspace_export",
    ).length,
  };
}
export function experimentAnalytics(input: AnalyticsInput) {
  return input.variants.map((v) => {
    const apps = new Set(
      input.snapshots
        .filter((s) => s.variant_id === v.id)
        .map((s) => s.application_id),
    );
    const sent = new Set(
      input.applications
        .filter((a) => apps.has(a.id) && a.sent_at)
        .map((a) => a.id),
    );
    const links = new Set(
      input.links.filter((l) => sent.has(l.application_id)).map((l) => l.id),
    );
    const ws = new Set(
      input.workspaces
        .filter((w) => w.tracking_link_id && links.has(w.tracking_link_id))
        .map((w) => w.id),
    );
    const countOutcome = (states: string[]) =>
      new Set(
        input.outcomes
          .filter(
            (o) => sent.has(o.application_id) && states.includes(o.status),
          )
          .map((o) => o.application_id),
      ).size;
    return {
      ...v,
      assigned: apps.size,
      ...rawRates(
        sent.size,
        countOutcome(["INTERVIEW", "SECOND_INTERVIEW", "OFFER", "ACCEPTED"]),
        countOutcome(["OFFER", "ACCEPTED"]),
      ),
      visits: new Set(
        input.visits
          .filter((e) => links.has(e.link_id))
          .map((e) => `${e.link_id}:${e.session_id}`),
      ).size,
      workspace_starts: ws.size,
      questions: input.questions.filter((q) => ws.has(q.workspace_id)).length,
      engagement: input.explorer.filter((e) => ws.has(e.workspace_id)).length,
      resume_previews: input.events.filter(
        (e) => ws.has(e.workspace_id) && e.event_type === "resume_preview",
      ).length,
      exports: input.events.filter(
        (e) => ws.has(e.workspace_id) && e.event_type === "workspace_export",
      ).length,
    };
  });
}
export function coverageSuggestions(
  topics: { topic: string; evidence_strength: string; question_id: string }[],
  signals: { skill_id: string | null; project_id: string | null }[],
  evidence: { id: string; title: string; skills: string[] }[],
  included: Set<string>,
) {
  const counts = new Map<string, number>();
  for (const t of topics) counts.set(t.topic, (counts.get(t.topic) || 0) + 1);
  for (const s of signals) {
    const r = evidence.find((r) => r.id === (s.skill_id || s.project_id));
    if (r) counts.set(r.title, (counts.get(r.title) || 0) + 1);
  }
  return [...counts]
    .map(([topic, count]) => {
      const matches = evidence.filter(
        (r) =>
          r.title.toLowerCase().includes(topic.toLowerCase()) ||
          r.skills.some((s) => s.toLowerCase() === topic.toLowerCase()),
      );
      return {
        topic,
        count,
        evidence: matches.length,
        included: matches.filter((r) => included.has(r.id)).length,
        suggestion: !matches.length
          ? "Investigate a possible evidence gap"
          : matches.every((r) => !included.has(r.id))
            ? "Consider emphasizing this existing evidence"
            : "Already represented in saved résumés",
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}
