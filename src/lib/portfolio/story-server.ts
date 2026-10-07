import "server-only";
import { careerFromBrain } from "../career/repository";
import { fixture } from "../career/fixture";
import { validateEnv } from "../env";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { loadBrain } from "../career-brain/repository";
import { usable } from "../career-brain/state";
import { portfolioStory, type StorySource } from "./story";

export async function getPortfolioStory() {
  if (validateEnv(process.env).mode === "demo") return portfolioStory(fixture);
  // This loader verifies publication and current source hashes. Whole owner
  // documents, source IDs and review metadata never enter the public projection.
  const records = await loadBrain(database(), primaryAccountId, true);
  const sources = new Map<string, StorySource>();
  for (const record of records) {
    if (!record.published || record.archived) continue;
    const confirmed = record.claims.filter(usable);
    const claim =
      (!/resume builder|career brain/i.test(record.title) &&
        confirmed.find((row) => row.attribute === "action")) ||
      confirmed.find(
        (row) =>
          row.attribute === "tool" &&
          row.evidence.some((span) =>
            /sql|typescript|automation|cohere|next\.js/i.test(span.quote),
          ),
      ) ||
      confirmed.find((row) => row.attribute === "action") ||
      confirmed[0];
    if (!claim) continue;
    const quote = [...new Set(claim.evidence.map((span) => span.quote))].join(
      "\n\n",
    );
    if (!quote) continue;
    // Keep every supporting span of the selected claim together. A single span
    // may support only one part of a claim, so dropping the others misleads.
    sources.set(record.id, { quote, claims: [claim.value] });
  }
  return portfolioStory(careerFromBrain(records), sources);
}
