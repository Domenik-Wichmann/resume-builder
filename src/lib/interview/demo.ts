import { emptyMemory, type Session, type Message } from "./model";
// Explicitly fictional layout fixtures, never loaded by live interview APIs.
const id = "00000000-0000-4000-8000-000000000101";
const created = "2026-10-08T10:00:00.000Z";
export const demoMessages: Message[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    session_id: id,
    sequence: 1,
    role: "assistant",
    content:
      "The fictional validation-tool example has useful automation detail, but less about how people adopted it. Who besides you used it, and how did they start?",
    rationale:
      "This sample role emphasizes process adoption. The demonstration evidence describes the tool, but not its introduction to coworkers.",
    created_at: created,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    session_id: id,
    sequence: 2,
    role: "user",
    content:
      "A couple coworkers. I showed one of them how the regex rules worked because their files were slightly different. I also explained technical failures to a customer in German.",
    rationale: "",
    created_at: created,
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    session_id: id,
    sequence: 3,
    role: "assistant",
    content:
      "You mentioned explaining failures to a customer in **German**. Was German something you regularly used with customers in that role?",
    rationale:
      "Your answer introduced professional language usage that may strengthen both the career narrative and client communication evidence.",
    created_at: created,
  },
];
export const demoSession: Session = {
  id,
  account_id: "00000000-0000-4000-8000-000000000001",
  mode: "job",
  status: "ACTIVE",
  title: "AI Transformation — Senior Analyst",
  target_role: "",
  job_description:
    "Fictional demonstration job description.\nResponsibilities: introduce automation, support process adoption, communicate with stakeholders.\nRequirements: SQL, AI implementation, AWS, business impact.\n".repeat(
      8,
    ),
  target_record_id: null,
  state: {
    ...emptyMemory(),
    summary:
      "Fictional demonstration: adoption and customer communication are being explored.",
    focus: "Professional German & client communication",
    topics: ["Tool adoption", "Training"],
    findings: [
      {
        note: "Coworker training and different file formats (unreviewed demonstration)",
        message_id: demoMessages[1].id,
        quote:
          "I showed one of them how the regex rules worked because their files were slightly different.",
      },
    ],
    requirements: [
      {
        requirement: "SQL",
        strength: "STRONG",
        evidence_ids: [],
        improved: false,
      },
      {
        requirement: "Change adoption",
        strength: "PARTIAL",
        evidence_ids: [],
        improved: true,
      },
      {
        requirement: "AWS",
        strength: "NONE",
        evidence_ids: [],
        improved: false,
      },
    ],
  },
  version: 2,
  turn_count: 2,
  reviewed_through: 0,
  last_import_id: null,
  pending_token: null,
  pending_until: null,
  created_at: created,
  updated_at: created,
  last_activity_at: created,
};
export const demoSessions: Session[] = [
  demoSession,
  {
    ...demoSession,
    id: "00000000-0000-4000-8000-000000000102",
    mode: "general",
    title: "General career discovery",
    state: emptyMemory(),
    job_description: "",
    turn_count: 0,
  },
  {
    ...demoSession,
    id: "00000000-0000-4000-8000-000000000103",
    mode: "record",
    title: "Resume Builder deep dive",
    state: emptyMemory(),
    job_description: "",
    turn_count: 0,
  },
];
