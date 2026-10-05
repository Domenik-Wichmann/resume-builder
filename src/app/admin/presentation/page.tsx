import Link from "next/link";
import {
  presentationAccount,
  loadPresentationSettings,
} from "@/lib/presentation-settings";
import { HttpError } from "@/lib/http";
import { PresentationManager } from "@/components/presentation-manager";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Profile & contact · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function PresentationPage() {
  let settings;
  try {
    const account = await presentationAccount();
    settings = await loadPresentationSettings(account);
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return (
      <main id="main" className="wrap prose">
        <h1>Profile & contact</h1>
        <p>{error.message}</p>
        <Link href={error.status === 403 ? "/auth/login" : "/admin/career"}>
          {error.status === 403
            ? "Sign in as the owner"
            : "Open Import & interview"}
        </Link>
      </main>
    );
  }
  return (
    <main id="main" className="wrap admin-main">
      <p className="eyebrow">Profile presentation</p>
      <h1>Be local. Stay yourself.</h1>
      <p>
        Manage the portrait, address and contact details shown for each market.
        Your career evidence stays shared.
      </p>
      <p>
        A valid tracking link takes priority. Otherwise, a coarse country signal
        selects Bulgaria for BG and the United States presentation for other or
        unknown countries. No precise location is requested.
      </p>
      <PresentationManager initial={settings} />
    </main>
  );
}
