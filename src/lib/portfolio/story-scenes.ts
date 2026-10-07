// This walkthrough describes implemented product behavior, not additional career claims.
export const portfolioPremise = "This portfolio is one of my projects.";
export const portfolioPremiseDescription =
  "I built this application to present my work, answer recruiter questions and create role-specific r\u00e9sum\u00e9s from supported career facts.";
export const portfolioPayoff =
  "This website is both my portfolio and a working example of the system I built.";
export const storyScenes = [
  { chapter: "Why", title: "", description: "", footnote: "" },
  {
    chapter: "Input",
    title: "Extracting structured data\nfrom text and conversations.",
    description:
      "I can paste career material, upload text or Markdown, or answer a guided career interview. An AI model proposes structured facts; I review the changes before accepting them.",
    footnote:
      "The public passage shown here illustrates the input. Original documents and interview answers stay private.",
  },
  {
    chapter: "Model",
    title: "Connecting career facts\nin a relational database.",
    description:
      "I store the reviewed facts in Career Brain, the relational database behind this portfolio. It connects jobs, projects, skills and achievements, with exact source passages attached to the approved claims.",
    footnote:
      "Select a record or skill to inspect its connection to the evidence.",
  },
  {
    chapter: "Search",
    title: "Retrieving evidence\nfor recruiter questions.",
    description:
      "A question searches the published career model. Embeddings find potentially useful evidence; the system checks what that evidence actually supports before generating an answer.",
    footnote:
      "This is a walkthrough of the retrieval path, not a live AI response.",
  },
  {
    chapter: "R\u00e9sum\u00e9",
    title: "Matching job requirements\nto supported career facts.",
    description:
      "The job is broken into requirements. Matching evidence is checked, and supported claims become a structured r\u00e9sum\u00e9. Application code renders the document; the model never generates its final HTML.",
    footnote:
      "Illustrative role brief and document preview. No new qualifications are generated in this tour.",
  },
  {
    chapter: "System",
    title: "How the application\nis built.",
    description:
      "PostgreSQL stores the approved career records and evidence. Embeddings help find relevant records. Models extract and compose text; application code enforces permissions, review, publication and r\u00e9sum\u00e9 compilation.",
    footnote:
      "A single Next.js application connects the owner tools and recruiter experience.",
  },
  {
    chapter: "Feedback",
    title: "Tracking visits, questions\nand r\u00e9sum\u00e9 interactions.",
    description:
      "Application links connect visits, questions and r\u00e9sum\u00e9 interactions to an opportunity. Recorded outcomes and recurring questions help me understand which experience attracts attention and where more evidence is needed.",
    footnote:
      "Illustrative demo data. Recruiter questions are stored privately, with disclosure in chat.",
  },
  {
    chapter: "Use it",
    title: "Ask about my projects\nand experience.",
    description:
      "Ask about the work I have done, the tools I have used, or experience relevant to your role. Answers use the published career records and evidence shown in this walkthrough.",
    footnote: "Choose a question to draft it in chat. You choose when to send.",
  },
] as const;
export const finalStoryStep = storyScenes.length - 1;
