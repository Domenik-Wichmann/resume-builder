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
  "Write as the candidate personally applying to win this job: first-person implied, with confident action-led bullets such as 'Built...' or 'Co-founded...', and 'I' only where natural in the summary. Make the strongest specific case supported by the work: concrete systems, implementation methods and useful outcomes, not generic chores. Never describe the candidate as he, his, the candidate, or by their name. Do not write assessor commentary such as 'reported', 'evidence suggests', 'end date unconfirmed', or 'dates not recorded'. Put missing information and verification notes only in private review notes; omit uncertain facts from resume prose. Never add defensive comparisons such as 'only used personally', 'not a team-wide tool', 'not production experience' or 'no professional experience'. Describe the actual positive scope instead: 'Built a personal ...', 'Prototyped ...', 'Contributed ...'. If that work is weak for the job, select stronger evidence. Preserve material factual scope naturally, including team contributions, AI assistance, basic ability and prototype status; omission never licenses a stronger claim.";

export function resumeStyleIssue(text: string) {
  if (
    /\b(?:not (?:as )?(?:an? )?(?:team[ -]wide|company[ -]wide|enterprise[ -]wide|production|professional)|(?:only|just|solely) (?:use[ds]? |used .*? )?(?:it |this |for )?(?:personally|personal use)|(?:no|without) (?:professional|team[ -]wide|production) experience)\b/i.test(
      text,
    )
  )
    return "Describe the actual positive scope of the work; keep defensive comparisons and limitations in private review notes. Do not remove a qualifier in a way that enlarges the claim.";
  return /\b(he|his|him|the candidate|evidence (?:suggests|shows|indicates)|(?:start|end) date (?:unconfirmed|unknown|not recorded)|dates? (?:unconfirmed|not recorded)|(?:reported|documented) (?:experience|ability|skills?|start))\b/i.test(
    text,
  )
    ? "Rewrite in the candidate's own resume voice; keep assessment and missing-data notes private."
    : undefined;
}
