type Experience = { id: string; title: string; organization?: string | null };

/** Presentation preference only; the role's claims still need source verification. */
export function resumeExperiencePreference(record: Experience, role: string) {
  const technical =
    /\b(tech|technical|software|developer|engineering|engineer|data|automation|ai|machine learning|cloud|devops|full.?stack|front.?end|back.?end|programming|information technology)\b/i.test(
      role,
    );
  const supportRelevant =
    /\b(german|deutsch|customer support|customer service|technical support|help.?desk|service desk|call cent(?:er|re)|contact cent(?:er|re))\b/i.test(
      role,
    );
  if (!technical || supportRelevant) return 0;
  const identity = `${record.title} ${record.organization || ""}`;
  if (
    record.id === "9c46d2d1-e8f1-4b23-a5f1-04db8ca763e3" ||
    /\bjuno (?:freeze dried|farms)\b/i.test(identity)
  )
    return 1;
  if (
    record.id === "057c18d5-d70a-4fff-9ccc-d1ca94e02e99" ||
    /\bsutherland\b/i.test(identity)
  )
    return -1;
  return 0;
}

export const resumeVoiceInstructions =
  "Write as the candidate writing their own resume: first-person implied, with action-led bullets such as 'Built...' or 'Co-founded...', and 'I' only where natural in the summary. Never describe the candidate as he, his, the candidate, or by their name. Do not write assessor commentary such as 'reported', 'evidence suggests', 'end date unconfirmed', or 'dates not recorded'. Put missing information and verification notes only in private review notes; omit uncertain facts from resume prose. Preserve material factual scope naturally, including team contributions, AI assistance, basic ability and prototype status; omission never licenses a stronger claim.";

export function resumeStyleIssue(text: string) {
  return /\b(he|his|him|the candidate|evidence (?:suggests|shows|indicates)|(?:start|end) date (?:unconfirmed|unknown|not recorded)|dates? (?:unconfirmed|not recorded)|(?:reported|documented) (?:experience|ability|skills?|start))\b/i.test(
    text,
  )
    ? "Rewrite in the candidate's own resume voice; keep assessment and missing-data notes private."
    : undefined;
}
