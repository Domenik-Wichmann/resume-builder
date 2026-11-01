// Owner-requested editorial project pages. Sources are repository documentation;
// these descriptions do not write career claims or alter the Career Brain.
export type ProjectGuide = {
  key: string;
  slug: string;
  name: string;
  category: string;
  headline: string;
  summary: string;
  problem: string;
  status: string;
  stack: string[];
  features: { title: string; text: string }[];
  steps: { title: string; text: string }[];
  engineering: string;
  limits: string;
  screens: { src: string; title: string; caption: string; kind: string }[];
  demo?: { label: string; url: string };
};

export const projectGuides: ProjectGuide[] = [
  {
    key: "babycat",
    slug: "configurable-excel-and-vba-rules-engine-78ff38898c",
    name: "BabyCat",
    category: "Catalog operations & automation",
    headline: "From supplier spreadsheets to controlled catalog releases.",
    summary:
      "A catalog workbench that brings incoming files, reusable transformation rules, change comparisons and release decisions into one workflow. Original uploads stay intact, and each export can be traced back to its source and rule revisions.",
    problem:
      "Supplier files arrive with different columns, formats and mistakes. A corrected spreadsheet can quickly become another untraceable copy. BabyCat keeps the incoming file, the working data and the released result connected, so teams can inspect what changed and decide what should leave the system.",
    status: "Working application · public sample and private demo workspaces",
    stack: [
      "Python",
      "Azure Functions",
      "JavaScript",
      "Azure SQL / SQLite",
      "Azure Blob Storage",
      "CSV & Excel",
      "Rule DSL",
    ],
    features: [
      {
        title: "Import once. Reuse the mapping.",
        text: "Accept CSV, XLSX and flat JSON, map supplier fields to a destination schema, and retain the mapping used for each incoming run. Organizations, suppliers and catalogs keep the work organized.",
      },
      {
        title: "Make the transformation visible.",
        text: "Apply ordered rules for values, columns, rows, calculations and formatting. Switch between Raw and Working data, inspect changed cells, and edit rules beside the table or on a dedicated page.",
      },
      {
        title: "Review before release.",
        text: "Verify incoming data, validate transformed values and evaluate governance thresholds. Material changes can require an approval of the specific frozen export rather than a loosely defined current file.",
      },
      {
        title: "Keep suppliers in the loop.",
        text: "Assigned supplier access supports uploads, issue review, corrections and resubmission. Shared email templates, contextual assistance and reviewed AI rule drafting support the surrounding workflow.",
      },
    ],
    steps: [
      { title: "Receive", text: "Keep the original file and map its fields." },
      { title: "Check", text: "Run incoming verification before acceptance." },
      { title: "Transform", text: "Apply ordered rules and compare results." },
      {
        title: "Release",
        text: "Approve when required, then export a frozen result.",
      },
    ],
    engineering:
      "The product layer handles sessions, workspace membership, resource scope and lifecycle decisions; the underlying engines evaluate rules and comparisons. Local development uses SQLite and file storage. Hosted configuration uses Azure SQL and immutable Blob artifacts. Rule revisions and frozen exports preserve the inputs behind a decision.",
    limits:
      "The sample uses fictional suppliers. The application supports bounded catalog sizes and practical Excel preservation, rather than every Excel feature. Email, SFTP and connected imports depend on deployment configuration; a public sample simulation does not demonstrate a live external delivery.",
    demo: {
      label: "Explore the BabyCat demo",
      url: "https://black-glacier-0b870d20f.1.azurestaticapps.net/demo.html",
    },
    screens: [
      {
        src: "/images/projects/babycat-dashboard.jpg",
        title: "A home for the supplier network",
        caption:
          "Organization overview with supplier activity, file counts and catalogs needing attention.",
        kind: "Actual app · fictional demo data",
      },
      {
        src: "/images/projects/babycat-mapping.jpg",
        title: "Map incoming data to a catalog",
        caption:
          "A saved field mapping sits beside the destination schema and the file intake area.",
        kind: "Actual app · fictional demo data",
      },
      {
        src: "/images/projects/babycat-table.jpg",
        title: "Inspect the working result",
        caption:
          "The catalog table keeps filters, source values and calculated output within the same workbench.",
        kind: "Actual app · fictional demo data",
      },
      {
        src: "/images/projects/babycat-editor.jpg",
        title: "Rules alongside the data",
        caption:
          "An ordered rule editor opens beside the table, keeping the working catalog in view.",
        kind: "Actual app · fictional demo data",
      },
      {
        src: "/images/projects/babycat-verification.jpg",
        title: "Catch problems before acceptance",
        caption:
          "Verification rules describe conditions and actions, including a positive-price check and premium-price review.",
        kind: "Actual app · fictional demo data",
      },
    ],
  },
  {
    key: "lms",
    slug: "multilingual-onboarding-and-mini-lms-51f0eca038",
    name: "SystemWright LMS",
    category: "Interactive training & media workflows",
    headline: "A lesson people can watch, practise and ask about.",
    summary:
      "A multilingual learning application that combines video, synchronized guidance, narration, knowledge checks and course-grounded assistance. Personalized learner links make it useful for supplier onboarding, team training and customer education.",
    problem:
      "A video explains the process, but a learner still needs the right template, a clear next step and a way to ask a question. Coordinators also need to see where people stop or get confused. SystemWright brings those pieces into one guided learning experience.",
    status: "Working learning platform · public overview available",
    stack: [
      "React",
      "Vite",
      "Firebase",
      "Firestore",
      "Firebase Functions",
      "Gemini",
      "ElevenLabs",
      "HTML5 video",
    ],
    features: [
      {
        title: "Learn by doing.",
        text: "Configured checkpoints pause a native video player for a task or question. Guidance, resources and progress sit beside the explanation, so practice belongs to the lesson rather than a separate email.",
      },
      {
        title: "One course, multiple languages.",
        text: "Language-specific narration, captions, guidance and prompts share a course structure. The media workflow supports transcript handling, translation and narration preparation.",
      },
      {
        title: "Ask in the moment.",
        text: "A course-grounded assistant uses the learning material as context. Learners can ask about the process while it is on screen, and administrators can review the questions being asked.",
      },
      {
        title: "Manage the whole learning journey.",
        text: "Administration includes course and content management, learner access, video and narration workflows, quizzes, progress and recorded responses. Personalized links reduce learner setup.",
      },
    ],
    steps: [
      {
        title: "Organize",
        text: "Arrange clients, courses and learning material.",
      },
      {
        title: "Create",
        text: "Add video, instructions, tasks and resources.",
      },
      {
        title: "Localize",
        text: "Prepare translated copy, captions and narration.",
      },
      {
        title: "Learn & improve",
        text: "Share learner links and review progress and questions.",
      },
    ],
    engineering:
      "A native HTML video element exposes timing events for checkpoints and synchronized instructions. Separate narration tracks allow language changes without creating a complete video for every language. React handles the learner interface; Firebase services provide hosted data, media and server-side provider calls.",
    limits:
      "The gallery distinguishes public website screenshots from the illustrative learner preview. Course content and available languages depend on configuration. Personalized access links must be treated as credentials; the public overview is not an administrator session.",
    demo: {
      label: "Visit SystemWright Learning",
      url: "https://systemwright-lms.web.app/",
    },
    screens: [
      {
        src: "/images/projects/lms-learner-preview.svg",
        title: "The learning experience, together",
        caption:
          "Illustrative arrangement of a video checkpoint, supporting guidance and course questions, using fictional course content.",
        kind: "Illustrative interface · sample data",
      },
      {
        src: "/images/projects/systemwright-lms.jpg",
        title: "Introducing the platform",
        caption:
          "The live public homepage introduces interactive learning, personalized delivery and learning insights.",
        kind: "Actual public website",
      },
      {
        src: "/images/projects/lms-workflow.jpg",
        title: "From source content to localized learning",
        caption:
          "The public workflow explains how copy, audio and review fit into preparing a multilingual course.",
        kind: "Actual public website",
      },
    ],
  },
  {
    key: "kernel",
    slug: "kernel",
    name: "Kernel",
    category: "Household planning & recipe knowledge",
    headline: "Connect the meal plan to the food, the people and the work.",
    summary:
      "A household meal planner that connects recipe discovery, weekly planning, shopping, pantry stock and cooking. Underneath the daily interface, recipes can be represented as structured ingredients, actions and evidence-backed food knowledge.",
    problem:
      "A meal plan is only useful if it works with the household’s preferences, available equipment, time and ingredients. Buying food, cooking a meal, eating it and liking it are different events. Kernel keeps those distinctions so the plan can respond to what actually happened.",
    status:
      "Development build · planning and recipe-knowledge workflows implemented",
    stack: [
      "Expo / React Native",
      "FastAPI",
      "PostgreSQL",
      "OR-Tools CP-SAT",
      "Supabase Auth",
      "Python",
      "Cohere (optional)",
    ],
    features: [
      {
        title: "Plan around the household.",
        text: "Generate a week with time, equipment, ingredient and configured nutrition constraints. Preference, variety and ingredient-reuse objectives guide selection, followed by independent numerical validation.",
      },
      {
        title: "Keep shopping connected.",
        text: "Derive requirements from selected meals, account for confirmed pantry stock, record partial purchases and add extra items. Replanning does not make physical purchases disappear.",
      },
      {
        title: "Support cooking as it happens.",
        text: "Follow instructions and timers, retain preparation state, and record cooking and eating separately. Planned portions are not silently treated as consumed food.",
      },
      {
        title: "Inspect the recipe’s structure.",
        text: "The knowledge studio supports recursive ingredient and action graphs, shared cooking concepts, method-and-food search and source-linked review. Quantity and nutrition review precedes promotion into a household recipe.",
      },
    ],
    steps: [
      {
        title: "Discover",
        text: "Browse recipes and record explicit preferences.",
      },
      { title: "Plan", text: "Select meals against household constraints." },
      {
        title: "Shop",
        text: "Cover meal requirements with purchases and pantry stock.",
      },
      {
        title: "Cook & record",
        text: "Follow the preparation and record what was actually eaten.",
      },
    ],
    engineering:
      "An Expo client talks to a FastAPI backend backed by PostgreSQL. OR-Tools models meal selection as a constrained optimization problem. Recipe graphs retain source evidence and unresolved quantities; optional language adapters help with search and extraction while deterministic validation checks the resulting structure.",
    limits:
      "Kernel remains a development build. The previews below are illustrative and use fictional household data. Broader reviewed recipe coverage, package and retailer optimization, native-device acceptance and production hardening remain ongoing work. Configured nutrient limits are user inputs, not medical prescriptions.",
    screens: [
      {
        src: "/images/projects/kernel-planner-preview.svg",
        title: "A week with the household in view",
        caption:
          "Illustrative weekly planner connecting selected meals, preparation time and a shopping summary.",
        kind: "Illustrative interface · sample data",
      },
      {
        src: "/images/projects/kernel-knowledge-preview.svg",
        title: "A recipe you can inspect",
        caption:
          "Illustrative recipe-knowledge view: ingredients and preparation actions remain linked to source and review state.",
        kind: "Illustrative interface · sample data",
      },
    ],
  },
  {
    key: "sonaway",
    slug: "sonaway-operational-knowledge-product-eb8c2d879b",
    name: "Sonaway",
    category: "Operational knowledge & governed change",
    headline:
      "Operational knowledge that stays connected when the work changes.",
    summary:
      "Sonaway turns scattered operational explanations into connected, evidence-backed knowledge. Ingest, semantic comparison, clarification, authority and versioned publication are separate parts of the lifecycle, giving retrieval a model of the work underneath it.",
    problem:
      "A procedure describes a step. A conversation explains the exception. A different document identifies the responsible role. When any of these change, a useful system needs to preserve the relationships, the evidence and the authority behind the change.",
    status:
      "Under development · governed runtime and illustrative public demonstrations",
    stack: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "pgvector",
      "Semantic graphs",
      "Evidence-backed retrieval",
      "Versioned publication",
    ],
    features: [
      {
        title: "Capture meaning with its evidence.",
        text: "Source material enters a semantic workspace containing connected actions, roles, conditions and other components. Evidence links preserve the passages behind an interpretation, and ambiguity remains a reviewable question.",
      },
      {
        title: "Review the specific change.",
        text: "Semantic comparison works against an exact baseline. Proposed operations, evidence verification, clarification and formal authority remain distinct; resolving meaning does not itself authorize publication.",
      },
      {
        title: "Preserve the accepted knowledge.",
        text: "Versioned Canonical records and bounded operation application preserve untouched components. Publication produces a new immutable version rather than silently overwriting the organization’s accepted model.",
      },
      {
        title: "Show the right context.",
        text: "The public demonstrations illustrate conversational updates, inherited policies, local exceptions, seasons, events and role-specific guidance. They explain the product direction using fictional browser-local scenarios.",
      },
    ],
    steps: [
      {
        title: "Capture",
        text: "Connect source material to a semantic workspace.",
      },
      {
        title: "Clarify",
        text: "Resolve ambiguity and compare the exact baseline.",
      },
      {
        title: "Authorize",
        text: "Review evidence and approve the bounded change.",
      },
      {
        title: "Publish",
        text: "Append a version for retrieval and contextual views.",
      },
    ],
    engineering:
      "The active runtime separates ingest and staging, Canonical history, semantic comparison and approval, and the manager interface. Deterministic checks constrain model-proposed interpretations and changes. The consulting website separately demonstrates policy inheritance and guided updates; those demonstrations are scripted examples rather than live model reasoning.",
    limits:
      "Sonaway is being developed rather than presented as a generally available operational platform. Runtime components, research and public website demonstrations have different readiness levels. The interface previews use fictional operations; the public website does not demonstrate production permissions or a live client deployment.",
    screens: [
      {
        src: "/images/projects/sonaway-knowledge-preview.svg",
        title: "Knowledge with its context attached",
        caption:
          "Illustrative operations workspace linking a procedure to its responsible role, location and supporting evidence.",
        kind: "Illustrative interface · sample data",
      },
      {
        src: "/images/projects/sonaway-review-preview.svg",
        title: "A focused, reviewable update",
        caption:
          "Illustrative change review separating proposed meaning, affected scope and the decision to publish.",
        kind: "Illustrative interface · sample data",
      },
    ],
  },
];
export function projectGuideForSlug(slug: string) {
  return projectGuides.find((guide) => guide.slug === slug);
}
