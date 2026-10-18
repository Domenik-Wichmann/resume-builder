import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { AdminPageHeader } from "@/components/admin-page-header";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Usage records",
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
    <main id="main" className="wrap admin-main">
      <AdminPageHeader
        section="Insights"
        title="AI usage"
        description="Review recent AI requests, provider-reported costs and request status. Unknown costs or token counts appear as —."
      />
      <section className="surface">
        <h2>{usage.count || 0} provider events</h2>
        <p>
          Showing the latest 50 events. Provider costs are in millionths of a US
          dollar: 1,000,000 µUSD = $1.
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
      <details className="admin-overview-details">
        <summary>Credit ledger details</summary>
        <p>
          Recorded balance: {String(balance.data)} micro-units. Credit purchases
          and redemption are not enabled.
        </p>
        {!ledger.data?.length && <p>No credit transactions.</p>}
        {(ledger.data || []).map((t, i) => (
          <p key={i}>
            {t.reason} · {t.amount_micro} micro-units
            {t.expires_at
              ? ` · Expiry metadata: ${t.expires_at.slice(0, 10)}`
              : ""}
          </p>
        ))}
      </details>
    </main>
  );
}
