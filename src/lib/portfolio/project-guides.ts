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
  contribution: string;
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
    headline: "Applying catalog experience to a traceable data workflow.",
    summary:
      "I built BabyCat to turn the catalog problems I work with into a coherent application: incoming supplier files, reusable rules, visible changes and controlled exports. The project demonstrates how I translate operational requirements into data structures, workflow rules and a usable interface.",
    problem:
      "Supplier files arrive with different columns, formats and mistakes. A corrected spreadsheet can quickly become another untraceable copy. BabyCat keeps the incoming file, the working data and the released result connected, so teams can inspect what changed and decide what should leave the system.",
    contribution:
      "I defined the catalog lifecycle, the rule-driven workflow and the points where a person needs to inspect or approve a result. I used AI-assisted development to build and refine the application around those requirements. My contribution connects practical catalog experience with system design, data quality and workflow automation.",
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
        title: "Catalog workflow design",
        text: "I translated supplier-data work into an explicit sequence: receive, map, verify, transform, review and export. Saved mappings and retained upload history make repeated work more consistent and easier to investigate.",
      },
      {
        title: "Rules and data transformation",
        text: "I designed around reusable, ordered rules rather than one-off spreadsheet fixes. Raw and Working views, changed-cell inspection and a nearby rule editor make the effect of those rules visible.",
      },
      {
        title: "Data quality and release controls",
        text: "I separated incoming verification, output validation and export approval. The resulting workflow ties a release decision to a specific frozen output and its rule revisions.",
      },
      {
        title: "Operational interface design",
        text: "I brought supplier uploads, correction loops, email templates and contextual assistance into the same workflow. This shows how I connect a data engine to the people who need to use its results.",
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
      "I structured the application around separate responsibilities: the product layer owns access and lifecycle decisions, while the engines evaluate transformations and comparisons. The build uses Python and Azure Functions, with SQLite for local work and Azure SQL plus Blob Storage for hosted configuration. Keeping original uploads, rule revisions and frozen exports connected makes the result inspectable. This is an example of the architecture and validation decisions I work through with AI-assisted implementation.",
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
    headline:
      "Turning a training problem into an interactive learning workflow.",
    summary:
      "I built SystemWright LMS around a practical onboarding need: explain a process, let someone practise it, answer their questions and show the coordinator where they need help. The project brings together workflow design, multilingual content, media synchronization and course-grounded AI assistance.",
    problem:
      "A video explains the process, but a learner still needs the right template, a clear next step and a way to ask a question. Coordinators also need to see where people stop or get confused. SystemWright brings those pieces into one guided learning experience.",
    contribution:
      "I shaped the learner journey and the administrator workflows, including video checkpoints, translated guidance, narration, resources and progress tracking. Using AI-assisted development, I turned that experience into a working application and iterated on how its parts fit together. The work connects an operational training need with product design and media integration.",
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
        title: "Learning-experience design",
        text: "I designed a journey that moves from explanation to practice: the video pauses at configured checkpoints while the learner has the relevant guidance and resources nearby.",
      },
      {
        title: "Multilingual media workflows",
        text: "I connected course structure with language-specific narration, captions, instructions and prompts. This demonstrates how I organize content and coordinate media rather than treat translation as a separate final step.",
      },
      {
        title: "Grounded AI integration",
        text: "I included course-grounded assistance so questions can be answered in the context of the lesson. The workflow also retains questions for administrator review, connecting assistance with content improvement.",
      },
      {
        title: "Administration and operational visibility",
        text: "I designed for the people running the training as well as the learner: course management, access links, quizzes, narration preparation and progress review belong to the same application.",
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
      "I chose a native HTML video element because its timing events allow checkpoints and guidance to follow the lesson. Separate narration tracks support multiple languages without recreating an entire video for each one. The implementation combines React and Firebase with server-side Gemini and ElevenLabs calls. The design work was coordinating playback, language, course state and learner progress into one experience through AI-assisted development.",
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
    headline: "Modeling the constraints behind an everyday planning problem.",
    summary:
      "I built Kernel to explore how a household planner can connect preferences, recipes, time, equipment, ingredients and nutrition constraints. The project demonstrates systems thinking: a plan has to remain consistent with shopping, pantry stock, preparation and what people actually eat.",
    problem:
      "A meal plan is only useful if it works with the household’s preferences, available equipment, time and ingredients. Buying food, cooking a meal, eating it and liking it are different events. Kernel keeps those distinctions so the plan can respond to what actually happened.",
    contribution:
      "I defined the household workflows and the distinctions the model needs to preserve: planning, buying, cooking, eating and liking are separate events. I used AI-assisted development to explore the implementation and refine its behavior. My focus is connecting a practical user need to a structured domain model, explicit constraints and checks on the resulting plan.",
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
        title: "Domain and state modeling",
        text: "I distinguished planned meals from physical purchases, preparation and confirmed eating. That distinction shapes how replanning works without discarding pantry stock or treating a plan as completed activity.",
      },
      {
        title: "Constraint-based problem framing",
        text: "I expressed the planning problem in terms of household restrictions, available time, equipment and configured nutrient bounds. Variety, preference and ingredient reuse guide selection within those constraints.",
      },
      {
        title: "Connected workflow design",
        text: "I linked recipe discovery to planning, shopping and cooking instead of building separate lists. Partial purchases and meal requirements provide concrete examples of how one action affects the rest of the workflow.",
      },
      {
        title: "Structured knowledge and validation",
        text: "I explored recipes as ingredients and preparation actions with source-linked review. Quantity and nutrition checks separate an extracted recipe draft from a recipe ready to enter household planning.",
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
      "I organized the project around an Expo client, a FastAPI backend and PostgreSQL, with OR-Tools handling constrained meal selection. A separate numerical validation step checks the plan, while recipe graphs retain source evidence and unresolved quantities. Working through these boundaries with AI-assisted development demonstrates how I specify system behavior, inspect the resulting model and keep uncertain inputs explicit.",
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
    headline: "Designing a knowledge model that can explain and govern change.",
    summary:
      "I defined Sonaway’s operational problem, product behavior and architecture direction, then used AI-assisted development and experiments to evolve the implementation. The project demonstrates my approach to knowledge modeling, evidence-backed retrieval and the boundaries between AI interpretation, review and authorized change.",
    problem:
      "A procedure describes a step. A conversation explains the exception. A different document identifies the responsible role. When any of these change, a useful system needs to preserve the relationships, the evidence and the authority behind the change.",
    contribution:
      "My work centers on deciding what the system needs to represent, how meaning and evidence stay connected, and how a proposed update becomes an authorized version. I use experiments and failure reports to refine those decisions. AI contributes substantially to implementation; I drive requirements, architecture reasoning, acceptance criteria and iteration.",
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
        title: "Ontology and knowledge modeling",
        text: "I defined the need to keep actions, roles, conditions and source evidence connected. This shows how I reason about operational meaning beyond a collection of documents or text chunks.",
      },
      {
        title: "Evidence-backed AI architecture",
        text: "I shaped a lifecycle in which AI interpretations remain linked to source material and unresolved ambiguity remains visible. Retrieval and review can then work with the model’s context and provenance.",
      },
      {
        title: "Governed change and versioning",
        text: "I separated understanding a change from authorizing it. Exact-baseline comparison, bounded operations and immutable versions make the consequences of an update concrete and reviewable.",
      },
      {
        title: "Experiment-led product development",
        text: "I used experiments and failure reports to investigate missing context, ownership and the behavior of proposed changes. The public demonstrations make inheritance, exceptions and role-specific guidance easier to inspect.",
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
      "I separated the lifecycle into ingest and staging, Canonical history, semantic comparison and approval, and the manager interface. The central design decision is where to allow probabilistic interpretation and where to require deterministic checks, current authority and an exact baseline. I used AI-assisted development to explore that architecture and refine it through experiments. The separate public website demonstrates contextual views and guided updates with scripted examples.",
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
