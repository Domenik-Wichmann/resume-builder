import { expect, it, vi } from "vitest";
const query = vi.hoisted(() => {
  const eq = vi.fn();
  const is = vi.fn();
  const single = vi.fn();
  return { eq, is, single };
});
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
vi.mock("../src/lib/db", () => ({
  database: () => {
    const chain = {
      select: () => chain,
      eq: (...args: unknown[]) => {
        query.eq(...args);
        return chain;
      },
      is: (...args: unknown[]) => {
        query.is(...args);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: query.single,
    };
    return { from: () => chain };
  },
}));
import { getPresentation } from "../src/lib/market-server";

it("falls back to configured default contacts while retaining the requested presentation and public account scope", async () => {
  query.single
    .mockResolvedValueOnce({ data: { id: "profile" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: { id: "profile" }, error: null })
    .mockResolvedValueOnce({
      data: {
        market: "US",
        location: "Actual configured residence",
        contact_email: "public@example.test",
        phone: "",
        work_authorization: "",
      },
      error: null,
    });
  const presentation = await getPresentation("BG", "account");
  expect(presentation.market).toBe("BG");
  expect(presentation.location).toBe("Actual configured residence");
  expect(presentation.contact_email).toBe("public@example.test");
  expect(query.eq).toHaveBeenCalledWith("account_id", "account");
  expect(query.eq).toHaveBeenCalledWith("is_public", true);
  expect(query.is).toHaveBeenCalledWith("archived_at", null);
  expect(query.single).toHaveBeenCalledTimes(4);
});
