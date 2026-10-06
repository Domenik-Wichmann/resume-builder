export type Visit = {
  session_id: string;
  link_id: string | null;
  page_path: string | null;
  created_at: string;
};
export type Question = {
  question: string;
  answer?: string;
  created_at: string;
};
export type Topic = {
  topic: string;
  question_id: string;
  evidence_strength: string;
};
export type Activity = { event_type: string; created_at: string };
export function rankQuestions(questions: Question[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of questions) {
    const label = row.question.trim().replace(/\s+/g, " ");
    const key = label.toLocaleLowerCase("en-US");
    const value = counts.get(key) || { label, count: 0 };
    value.count++;
    counts.set(key, value);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}
export function rankTopics(topics: Topic[]) {
  const counts = new Map<
    string,
    {
      label: string;
      count: number;
      strong: number;
      partial: number;
      none: number;
    }
  >();
  const seen = new Set<string>();
  for (const row of topics) {
    const key = JSON.stringify([row.topic, row.question_id]);
    if (seen.has(key)) continue;
    seen.add(key);
    const value = counts.get(row.topic) || {
      label: row.topic,
      count: 0,
      strong: 0,
      partial: 0,
      none: 0,
    };
    value.count++;
    if (row.evidence_strength === "STRONG") value.strong++;
    if (row.evidence_strength === "PARTIAL") value.partial++;
    if (row.evidence_strength === "NONE") value.none++;
    counts.set(row.topic, value);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}
export function summarizeAnalytics(
  visits: Visit[],
  questions: Question[],
  topics: Topic[],
  activities: Activity[],
  days: number,
  now = new Date(),
) {
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - days + index + 1);
    const label = date.toISOString().slice(0, 10);
    return {
      label,
      views: visits.filter((v) => v.created_at.slice(0, 10) === label).length,
      questions: questions.filter((q) => q.created_at.slice(0, 10) === label)
        .length,
    };
  });
  const pageCounts = new Map<string, number>();
  for (const visit of visits) {
    const label = visit.page_path || "Historical short-link landing";
    pageCounts.set(label, (pageCounts.get(label) || 0) + 1);
  }
  return {
    daily,
    sessions: new Set(visits.map((v) => v.session_id)).size,
    attributedViews: visits.filter((v) => v.link_id !== null).length,
    pages: [...pageCounts]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    questions: rankQuestions(questions),
    topics: rankTopics(topics),
    previews: activities.filter((a) => a.event_type === "resume_preview")
      .length,
    exports: activities.filter((a) => a.event_type === "workspace_export")
      .length,
  };
}
