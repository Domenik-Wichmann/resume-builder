import "server-only";
import { reserveAIQuota } from "../http";
import { measure } from "../performance";
export type Gate = <T>(
  label: string,
  provider: "OPENROUTER" | "COHERE",
  call: () => Promise<T>,
) => Promise<T>;
// Every production inference, including independent verification, reserves quota.
export const productionGate: Gate = async (label, _provider, call) => {
  await measure("quota", () => reserveAIQuota());
  return measure(label.replaceAll("-", "_"), call);
};
