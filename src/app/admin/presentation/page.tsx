import Link from "next/link";
import {
  presentationAccount,
  loadPresentationSettings,
} from "@/lib/presentation-settings";
import { HttpError } from "@/lib/http";
import { explorerData } from "@/lib/career-brain/record-management";
import { loadDesignStudio } from "@/lib/resume-design/server";
import { ProfileIdentityEditor } from "@/components/profile-identity-editor";
import { PresentationManager } from "@/components/presentation-manager";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Profile & contact · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function PresentationPage() {
  let settings, assets, brain;
  try {
    const account = await presentationAccount();
    [settings, { assets }, brain] = await Promise.all([
      loadPresentationSettings(account),
      loadDesignStudio(account.db, account.accountId),
      explorerData(account.db, account.accountId),
    ]);
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return (
      <main id="main" className="wrap prose">
        <h1>Profile & contact</h1>
        <p>{error.message}</p>
        <Link href={error.status === 403 ? "/admin" : "/admin/career"}>
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
      <h1>Personal information & photos</h1>
      <p>
        Manage the portrait, address and contact details shown for each market.
        Your career evidence stays shared.
      </p>
      <ProfileIdentityEditor initial={brain} />
      <h2>Contact details & portrait</h2>
      <PresentationManager initial={settings} initialAssets={assets} />
    </main>
  );
}
