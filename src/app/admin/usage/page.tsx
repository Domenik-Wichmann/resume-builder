import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Usage records · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function Usage() {
  let a;
  try {
    a = await requireAccount();
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 403) throw e;
    return (
      <main className="wrap prose">
        <h1>Usage records</h1>
        <Link href="/auth/login">Sign in</Link>
      </main>
    );
  }
  const [usage, ledger, balance] = await Promise.all([
    a.db
      .from("provider_usage_events")
      .select(
        "provider,model,operation_type,input_tokens,output_tokens,units,provider_cost_micro,status,created_at",
        { count: "exact" },
      )
      .eq("account_id", a.accountId)
      .order("created_at", { ascending: false })
      .limit(50),
    a.db
      .from("credit_transactions")
      .select("reason,amount_micro,expires_at,created_at")
      .eq("account_id", a.accountId)
      .order("created_at", { ascending: false })
      .limit(50),
    a.db.rpc("credit_balance", { p_account: a.accountId }),
  ]);
  if (usage.error || ledger.error || balance.error)
    throw new Error("Cannot load usage.");
  return (
    <main className="wrap portfolio-main">
      <Link href="/account">← Account</Link>
      <h1>Usage & ledger.</h1>
      <section className="surface">
        <h2>{usage.count || 0} provider events</h2>
        <p>
          Costs are recorded only when supplied by the provider. Unknown
          quantities appear as —. Platform credit charging, purchases and public
          trial grants are disabled. BYOK key persistence is deferred.
        </p>
        <p>
          Gross ledger balance: {String(balance.data)} micro-units. Expiry is
          readiness metadata; credit redemption and expiry allocation are not
          enabled.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Provider / model</th>
                <th>Operation</th>
                <th>Input / output</th>
                <th>Units</th>
                <th>Provider cost (µUSD)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(usage.data || []).map((u, i) => (
                <tr key={i}>
                  <td>
                    {u.provider} / {u.model}
                  </td>
                  <td>{u.operation_type}</td>
                  <td>
                    {u.input_tokens ?? "—"} / {u.output_tokens ?? "—"}
                  </td>
                  <td>{u.units ?? "—"}</td>
                  <td>{u.provider_cost_micro ?? "—"}</td>
                  <td>{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="surface">
        <h2>Recent credit transactions</h2>
        {!ledger.data?.length && <p>No credit transactions.</p>}
        {(ledger.data || []).map((t, i) => (
          <p key={i}>
            {t.reason} · {t.amount_micro} micro-units
            {t.expires_at
              ? ` · Expiry metadata: ${t.expires_at.slice(0, 10)}`
              : ""}
          </p>
        ))}
      </section>
    </main>
  );
}
