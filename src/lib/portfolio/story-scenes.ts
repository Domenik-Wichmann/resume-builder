// Plain explanations of implemented behavior. Personal facts come from the public projection.
export const storyScenes = [
  { chapter: "Intro", title: "", description: "", footnote: "" },
  {
    chapter: "The Project",
    title: "This portfolio website\nis also one of my projects.",
    description:
      "I built Resume Builder to keep my career history organized and make it easier to explore. This portfolio shows the project, and the project runs the portfolio you are using.",
    footnote:
      "One system stores my career evidence, creates role-specific r\u00e9sum\u00e9s and answers recruiter questions.",
  },
  {
    chapter: "Import",
    title: "Turning documents and conversation\ninto structured career facts.",
    description:
      "I write about my work in my own words, upload my notes, or answer a few questions. AI picks out the jobs, projects and skills and puts them into an organized draft. I check the draft before accepting the facts.",
    footnote: "Write naturally. Upload your notes. Review the facts it finds.",
  },
  {
    chapter: "Structure",
    title: "Connecting career records\nand their supporting evidence.",
    description:
      "The system separates my history into jobs, projects, skills, languages and achievements. It connects the pieces: which skills a project used, what it achieved, and where each fact came from. The original passage stays attached, so I can check it.",
    footnote:
      "Connected facts, with the original evidence kept alongside them.",
  },
  {
    chapter: "Diff",
    title: "Comparing new information\nwith the existing career records.",
    description:
      "New information is compared with what is already saved. The system shows what is new, what changed, what stayed the same and what needs a decision. I review the changes; nothing is automatically removed or published.",
    footnote:
      "New information updates the existing knowledge, after my review.",
  },
  {
    chapter: "Use",
    title: "Using the same evidence\nfor answers and r\u00e9sum\u00e9s.",
    description:
      "For a question, the application finds relevant facts and follows their connections to understand the context. For a job description, it chooses the experience that fits. Both answers and r\u00e9sum\u00e9s come from the same saved career history.",
    footnote:
      "One career history. Two uses: answer questions and build tailored r\u00e9sum\u00e9s.",
  },
  {
    chapter: "Feedback",
    title: "Seeing which experience\nrecruiters investigate.",
    description:
      "I can see which applications bring visitors, what topics they ask about and which r\u00e9sum\u00e9s they open. This helps me understand what interests recruiters and where I need to explain my work better.",
    footnote:
      "Illustrative activity only. Recruiter questions and applications stay private.",
  },
  {
    chapter: "Stack",
    title: "The stack behind\nthis portfolio.",
    description:
      "The website, database and AI work together. AI helps read what I write, find useful information and explain it. The application decides who can access it, what gets saved and what is ready to share.",
    footnote:
      "AI helps make sense of the information. Reviewed facts stay in the database.",
  },
  {
    chapter: "Ask Me Anything",
    title: "Ask about my work.",
    description:
      "Ask about my work, projects, skills or how my experience might fit your team. Open an example below to see an answer, then continue to the conversation.",
    footnote:
      "Open an example to read a saved answer. Start the conversation when you are ready.",
  },
] as const;
export const finalStoryStep = storyScenes.length - 1;

export const portfolioIntroTitle = "Systems, automation & AI";
export const portfolioIntroDescription =
  "I build systems that turn messy information into something useful. I use AI to extract knowledge, organize it into connected data and graphs, and automate the work around it.";
