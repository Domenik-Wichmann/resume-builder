import "server-only";
import { reserveAIQuota } from "../http";
export type Gate = <T>(
  label: string,
  provider: "OPENROUTER" | "COHERE",
  call: () => Promise<T>,
) => Promise<T>;
// Every production inference, including independent verification, reserves quota.
export const productionGate: Gate = async (_label, _provider, call) => {
  await reserveAIQuota();
  return call();
};
