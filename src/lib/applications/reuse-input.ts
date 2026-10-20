import { z } from "zod";
import { resumeUrl } from "../resume-design/fixed-content";

export const reuseInput = z
  .object({
    action: z.literal("reuse"),
    id: z.uuid(),
    request_id: z.uuid(),
    organization: z.string().trim().min(1).max(200),
    role: z.string().trim().min(1).max(200),
    job_description: z.string().trim().max(12000),
    learning_demo: resumeUrl.nullable(),
  })
  .strict();
