import { z } from "zod";
import { resumeIRSchema } from "../resume-ir";
import { strategies } from "./model";

const responseSchema = z.object({
  id: z.string().optional(),
  preview_id: z.string().optional(),
  stage: z.number().optional(),
  label: z.string().optional(),
  tracking_code: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8}$/)
    .optional(),
  strategy: z.enum(strategies).optional(),
  options: z.record(z.string(), resumeIRSchema).optional(),
  review: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export async function applicationAction(
  payload: unknown,
  interruptedMessage = "The server response was interrupted. Resume your saved generation to try again.",
) {
  const response = await fetch("/api/admin/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = responseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) throw new Error(interruptedMessage);
  if (!response.ok)
    throw new Error(
      parsed.data.error || "Unable to complete this step. Try again.",
    );
  return parsed.data;
}

export async function continueApplicationGeneration(
  id: string,
  progress: (stage: number, label: string) => void,
) {
  let state = await applicationAction({ action: "status", preview_id: id });
  while (state.stage !== undefined && state.stage < 4) {
    progress(state.stage, state.label || "Preparing your draft");
    state = await applicationAction({
      action: "generate",
      preview_id: id,
      stage: state.stage,
    });
  }
  return state;
}
